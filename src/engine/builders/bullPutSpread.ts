import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { roundPenny } from '../../domain/math/money';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildBullPutSpread(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const a = sliderValue / 100;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    // Generate all valid shortPut/longPut pairs
    const puts = options.filter(c => c.type === 'put' && isLiquid(c));
    for (let i = 0; i < puts.length - 1; i++) {
      const shortPut = puts[i];
      for (let j = i + 1; j < puts.length; j++) {
        const longPut = puts[j];
        const width = Math.abs(shortPut.strike_price - longPut.strike_price);
        if (width < 1 || width > 10) continue;
        const credit = (shortPut.bid || 0) - (longPut.ask || 0);
        if (credit <= 0) continue;
        const requiredCapital = roundPenny((shortPut.strike_price - longPut.strike_price) * 100);
        if (hasBudget && requiredCapital > userBudget) continue;
        const maxProfit = roundPenny(credit * 100);
        const maxLoss = roundPenny(requiredCapital - maxProfit);
        const returnOnRisk = maxLoss ? roundPenny((maxProfit / maxLoss) * 100) : 0;
        const chance = shortPut.delta ? roundPenny((1 - Math.abs(shortPut.delta)) * 100) : 0;
        const breakEven = roundPenny(shortPut.strike_price - credit);
        const spreadWidth = Math.abs(longPut.strike_price - shortPut.strike_price);
        const below = roundPenny(Number(longPut.strike_price) - Number(spreadWidth));
        const above = roundPenny(Number(shortPut.strike_price) + Number(spreadWidth));
        const payoffPoints = [
          { price: below, profit: -maxLoss },
          { price: longPut.strike_price, profit: -maxLoss },
          { price: breakEven, profit: 0 },
          { price: shortPut.strike_price, profit: maxProfit },
          { price: above, profit: maxProfit },
        ];
        candidates.push({
          name: `Bull Put Spread (${shortPut.strike_price}/${longPut.strike_price})`,
          contracts: [shortPut, longPut],
          returnOnRisk,
          chance,
          profit: maxProfit,
          risk: maxLoss,
          requiredCapital,
          sentimentFit: ['bullish', 'very_bullish', 'neutral'],
          breakEven,
          payoffPoints,
        });
      }
    }
  }
  return pickBestStrategy(candidates, sliderValue);
} 
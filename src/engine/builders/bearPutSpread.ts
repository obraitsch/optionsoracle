import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { safeNum } from '../../domain/math/money';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildBearPutSpread(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bearish' || sentiment === 'very_bearish') {
    const puts = options.filter(c => c.type === 'put' && isLiquid(c)).sort((a, b) => a.strike_price - b.strike_price);
    for (let i = 0; i < puts.length - 1; i++) {
      const shortPut = puts[i];
      for (let j = i + 1; j < puts.length; j++) {
        const longPut = puts[j];
        if (longPut.ask == null || shortPut.bid == null) continue;
        const debit = (safeNum(longPut.ask)) - (safeNum(shortPut.bid));
        if (debit <= 0) continue; // Not a debit spread
        const requiredCapital = debit * 100;
        if (hasBudget && requiredCapital > userBudget) continue;
        const maxProfit = (safeNum(longPut.strike_price) - safeNum(shortPut.strike_price)) * 100 - requiredCapital;
        const maxLoss = requiredCapital;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const chance = safeNum(longPut.delta) ? Math.abs(safeNum(longPut.delta)) * 100 : 0;
        const breakEven = safeNum(longPut.strike_price) - debit;
        const spreadWidth = Math.abs(safeNum(longPut.strike_price) - safeNum(shortPut.strike_price));
        const below = safeNum(shortPut.strike_price) - spreadWidth;
        const above = safeNum(longPut.strike_price) + spreadWidth;
        const payoffPoints = [
          { price: below, profit: maxProfit },
          { price: safeNum(shortPut.strike_price), profit: maxProfit },
          { price: breakEven, profit: 0 },
          { price: safeNum(longPut.strike_price), profit: -maxLoss },
          { price: above, profit: -maxLoss },
        ];
        candidates.push({
          name: `Bear Put Spread (${longPut.strike_price}/${shortPut.strike_price})`,
          contracts: [longPut, shortPut],
          returnOnRisk,
          chance,
          profit: maxProfit,
          risk: maxLoss,
          requiredCapital,
          sentimentFit: ['bearish', 'very_bearish'],
          breakEven,
          payoffPoints,
        });
      }
    }
  }
  return pickBestStrategy(candidates, sliderValue);
} 
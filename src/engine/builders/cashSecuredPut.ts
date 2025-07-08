import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { roundPenny } from '../../domain/math/money';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildCashSecuredPut(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const a = sliderValue / 100;
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const otmPuts = options.filter(c => c.type === 'put' && c.strike_price < S && isLiquid(c) && typeof c.delta === 'number');
    for (const put of otmPuts) {
      const premium = put.bid || 0;
      const strike = put.strike_price;
      const requiredCapital = roundPenny(strike * 100);
      if (hasBudget && requiredCapital > userBudget) continue;
      const maxProfit = roundPenny(premium * 100);
      const maxLoss = roundPenny((strike - premium) * 100);
      const returnOnRisk = maxLoss ? roundPenny((maxProfit / maxLoss) * 100) : 0;
      const chance = put.delta ? roundPenny((1 - Math.abs(put.delta)) * 100) : 0;
      const breakEven = roundPenny(strike - premium);
      const payoffPoints = [
        { price: roundPenny(strike * 0.9), profit: roundPenny(-(strike - strike * 0.9) * 100 + maxProfit) },
        { price: breakEven, profit: 0 },
        { price: strike, profit: maxProfit },
        { price: roundPenny(strike * 1.1), profit: maxProfit }
      ];
      candidates.push({
        name: `Cash Secured Put (${strike})`,
        contracts: [put],
        returnOnRisk,
        chance,
        profit: maxProfit,
        risk: maxLoss,
        requiredCapital,
        sentimentFit: ['bullish', 'very_bullish'],
        breakEven,
        payoffPoints,
      });
    }
  }
  return pickBestStrategy(candidates, sliderValue);
} 
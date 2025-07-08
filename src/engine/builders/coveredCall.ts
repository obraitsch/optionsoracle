import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildCoveredCall(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const a = sliderValue / 100;
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const otmCalls = options.filter(c => c.type === 'call' && c.strike_price > S && isLiquid(c) && typeof c.delta === 'number');
    for (const call of otmCalls) {
      const premium = call.bid || 0;
      const strike = call.strike_price;
      const requiredCapital = S * 100; // Cost of 100 shares
      if (hasBudget && requiredCapital > userBudget) continue;
      const maxProfit = premium * 100;
      const maxLoss = (S - strike + premium) * 100;
      const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
      const chance = call.delta ? (1 - call.delta) * 100 : 0;
      const breakEven = strike - premium;
      const payoffPoints = [
        { price: strike * 0.9, profit: Math.min(maxProfit, (strike * 0.9 - S) * 100 + maxProfit) },
        { price: breakEven, profit: 0 },
        { price: strike, profit: maxProfit },
        { price: strike * 1.1, profit: maxProfit }
      ];
      candidates.push({
        name: `Covered Call (${strike})`,
        contracts: [call],
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
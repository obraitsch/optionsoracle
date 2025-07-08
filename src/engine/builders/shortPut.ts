import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildShortPut(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const puts = options.filter(c => c.type === 'put' && isLiquid(c));
    for (const contract of puts) {
      const premium = typeof contract.bid === 'number' ? contract.bid : 0;
      const strike = typeof contract.strike_price === 'number' ? contract.strike_price : 0;
      const requiredCapital = strike * 100;
      if (hasBudget && requiredCapital > userBudget) continue;
      const maxProfit = premium * 100;
      const maxLoss = strike * 100 - premium * 100;
      const returnOnRisk = maxLoss ? Math.min((maxProfit / maxLoss) * 100, 1000) : 0;
      const chance = typeof contract.delta === 'number' ? (1 - Math.abs(contract.delta)) * 100 : 0;
      const breakEven = strike - premium;
      const below = strike - (strike - breakEven);
      const above = strike + (strike - breakEven);
      const payoffPoints = [
        { price: below, profit: -maxLoss },
        { price: breakEven, profit: 0 },
        { price: strike, profit: maxProfit },
        { price: above, profit: maxProfit },
        { price: above + (strike - breakEven), profit: maxProfit },
      ];
      candidates.push({
        name: `Short Put (${strike})`,
        contracts: [contract],
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
  return pickBestStrategy(candidates, sliderValue);
} 
import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { roundPenny } from '../../domain/math/money';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildStraddle(user: UserInputs, options: Contract[], sliderValue: number, sigma: number): StrategyResult[] {
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'directional' && S) {
    // Try all pairs of ATM/near-ATM call and put
    const calls = options.filter(c => c.type === 'call' && isLiquid(c));
    const puts = options.filter(c => c.type === 'put' && isLiquid(c));
    for (const call of calls) {
      for (const put of puts) {
        // ATM/near-ATM: strikes within 5% of each other
        if (Math.abs(call.strike_price - put.strike_price) > 0.05 * S) continue;
        const callPremium = call.ask || 0;
        const putPremium = put.ask || 0;
        const totalPremium = callPremium + putPremium;
        const requiredCapital = totalPremium * 100;
        if (hasBudget && requiredCapital > userBudget) continue;
        const maxLoss = requiredCapital;
        const maxProfit = Infinity;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const breakEvenLow = call.strike_price - totalPremium;
        const breakEvenHigh = call.strike_price + totalPremium;
        const chance = 30; // Estimate
        const payoffPoints = [
          { price: breakEvenLow - 10, profit: (breakEvenLow - (breakEvenLow - 10)) * 100 - maxLoss },
          { price: breakEvenLow, profit: 0 },
          { price: call.strike_price, profit: -maxLoss },
          { price: breakEvenHigh, profit: 0 },
          { price: breakEvenHigh + 10, profit: ((breakEvenHigh + 10) - breakEvenHigh) * 100 - maxLoss },
        ];
        candidates.push({
          name: `Straddle (${put.strike_price}/${call.strike_price})`,
          contracts: [call, put],
          returnOnRisk,
          chance,
          profit: maxProfit,
          risk: maxLoss,
          requiredCapital,
          sentimentFit: ['directional'],
          breakEven: breakEvenLow,
          payoffPoints,
        });
      }
    }
  }
  return pickBestStrategy(candidates, sliderValue);
} 
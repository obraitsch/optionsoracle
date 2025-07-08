import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { popBullCall } from '../../domain/math/probability';
import { safeNum } from '../../domain/math/money';
import { normalizeSentiment, parseBudget, isLiquid } from '../helpers';

export function buildBullCallSpread(user: UserInputs, options: Contract[]): StrategyResult[] {
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);
  const results: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const allCalls = options.filter(c => c.type === 'call' && isLiquid(c)).sort((a, b) => a.strike_price - b.strike_price);
    for (let i = 0; i < allCalls.length - 1; i++) {
      const longCall = allCalls[i];
      for (let j = i + 1; j < allCalls.length; j++) {
        const shortCall = allCalls[j];
        if (longCall.ask == null || shortCall.bid == null) continue;
        const debit = (safeNum(longCall.ask)) - (safeNum(shortCall.bid));
        if (debit <= 0) continue; // Not a debit spread
        const requiredCapital = debit * 100;
        if (hasBudget && requiredCapital > userBudget) continue;
        const maxProfit = (safeNum(shortCall.strike_price) - safeNum(longCall.strike_price)) * 100 - requiredCapital;
        const maxLoss = requiredCapital;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const S_0 = S;
        const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
        const r = 0.00;
        const chance = popBullCall({
          S: S_0,
          Klong: safeNum(longCall.strike_price),
          Kshort: safeNum(shortCall.strike_price),
          debit,
          T,
          sigma: (safeNum(longCall.iv) + safeNum(shortCall.iv)) / 2,
          r
        }) * 100;
        const breakEven = safeNum(longCall.strike_price) + debit;
        const spreadWidth = Math.abs(safeNum(shortCall.strike_price) - safeNum(longCall.strike_price));
        const below = safeNum(longCall.strike_price) - spreadWidth;
        const above = safeNum(shortCall.strike_price) + spreadWidth;
        const payoffPoints = [
          { price: below, profit: -maxLoss },
          { price: safeNum(longCall.strike_price), profit: -maxLoss },
          { price: breakEven, profit: 0 },
          { price: safeNum(shortCall.strike_price), profit: maxProfit },
          { price: above, profit: maxProfit },
        ];
        results.push({
          name: `Bull Call Spread (${longCall.strike_price}/${shortCall.strike_price})`,
          contracts: [longCall, shortCall],
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
  }
  // Only return the single best result (by highest returnOnRisk), or empty array if none
  if (results.length === 0) return [];
  const best = results.reduce((a, b) => (b.returnOnRisk > a.returnOnRisk ? b : a));
  return [best];
} 
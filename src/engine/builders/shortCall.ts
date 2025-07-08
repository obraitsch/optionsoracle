import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildShortCall(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const S = typeof user.quote?.price === 'number' ? user.quote.price : 0;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bearish' || sentiment === 'very_bearish') {
    const otmCalls = options.filter(c => c.type === 'call' && c.strike_price > S && isLiquid(c) && typeof c.delta === 'number');
    for (const call of otmCalls) {
      const premium = typeof call.bid === 'number' ? call.bid : 0;
      const strike = typeof call.strike_price === 'number' ? call.strike_price : 0;
      // Broker-style margin requirement
      const margin = Math.max(
        0.2 * S * 100 - (strike - S) * 100,
        strike * 100 - S * 100
      ) + premium * 100;
      if (hasBudget && margin > userBudget) continue;
      // Cap risk at a 1.5-sigma move
      const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
      const sigma = typeof call.iv === 'number' ? call.iv : (typeof user.quote?.iv === 'number' ? user.quote.iv : 0.25);
      const targetUp = S + 2.5 * sigma * Math.sqrt(T) * S;
      const breakEven = strike + premium;
      const cappedLoss = Math.max(0, (targetUp - breakEven) * 100);
      const maxLoss = cappedLoss;
      const maxProfit = premium * 100;
      const returnOnRisk = maxLoss ? Math.min((maxProfit / maxLoss) * 100, 1000) : 0;
      const chance = typeof call.delta === 'number' ? (1 - call.delta) * 100 : 0;
      const payoffPoints = [
        { price: strike * 0.9, profit: maxProfit },
        { price: strike, profit: maxProfit },
        { price: breakEven, profit: 0 },
        { price: strike * 1.1, profit: -((strike * 1.1 - breakEven) * 100) }
      ];
      candidates.push({
        name: `Short Call (Naked) (${strike})`,
        contracts: [call],
        returnOnRisk,
        chance,
        profit: maxProfit,
        risk: maxLoss,
        requiredCapital: margin,
        sentimentFit: ['bearish', 'very_bearish'],
        breakEven,
        payoffPoints,
      });
    }
  }
  return pickBestStrategy(candidates, sliderValue);
} 
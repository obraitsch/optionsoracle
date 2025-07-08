import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { popLongCall } from '../../domain/math/probability';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildLongCall(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const S = typeof user.quote?.price === 'number' ? user.quote.price : 0;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const calls = options.filter(c => c.type === 'call' && isLiquid(c));
    for (const contract of calls) {
      const premium = typeof contract.ask === 'number' ? contract.ask : 0;
      const requiredCapital = premium * 100;
      if (hasBudget && requiredCapital > userBudget) continue;
      const maxLoss = requiredCapital;
      // --- OptionStrat-style capped profit ---
      const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
      const sigma = typeof contract.iv === 'number' ? contract.iv : (typeof user.quote?.iv === 'number' ? user.quote.iv : 0.25);
      const targetMove = S > 0 ? sigma * Math.sqrt(T) * S * 1.5 : 0;
      const targetPrice = S > 0 ? S + targetMove : 0;
      const strikePrice = typeof contract.strike_price === 'number' ? contract.strike_price : 0;
      const breakEven = strikePrice + premium;
      const cappedProfit = Math.max(0, targetPrice - breakEven) * 100;
      const maxProfit = cappedProfit;
      const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
      // ---
      const S_0 = S;
      const K = strikePrice;
      const debit = premium;
      const r = 0.00;
      const chance = popLongCall({ S: S_0, K, premium: debit, T, sigma, r }) * 100;
      const below = strikePrice - premium;
      const above = strikePrice + premium * 2;
      const payoffPoints = [
        { price: below, profit: -maxLoss },
        { price: strikePrice, profit: -maxLoss },
        { price: breakEven, profit: 0 },
        { price: above, profit: (above - breakEven) * 100 },
      ];
      candidates.push({
        name: `Long Call (${strikePrice})`,
        contracts: [contract],
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
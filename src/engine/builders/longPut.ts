import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { popLongPut } from '../../domain/math/probability';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildLongPut(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const S = typeof user.quote?.price === 'number' ? user.quote.price : 0;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bearish' || sentiment === 'very_bearish') {
    const puts = options.filter(c => c.type === 'put' && isLiquid(c));
    for (const contract of puts) {
      const premium = typeof contract.ask === 'number' ? contract.ask : 0;
      const requiredCapital = premium * 100;
      if (hasBudget && requiredCapital > userBudget) continue;
      const maxLoss = requiredCapital;
      // --- OptionStrat-style capped profit for long put ---
      const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
      const sigma = typeof contract.iv === 'number' ? contract.iv : (typeof user.quote?.iv === 'number' ? user.quote.iv : 0.25);
      const k = 1.5;
      const sigmaMove = sigma * Math.sqrt(T) * S;
      const targetDown = S - k * sigmaMove;
      const strikePrice = typeof contract.strike_price === 'number' ? contract.strike_price : 0;
      const breakEven = strikePrice - premium;
      const cappedProfit = Math.max(0, breakEven - targetDown) * 100;
      const maxProfit = cappedProfit;
      const returnOnRisk = maxLoss ? Math.min((maxProfit / maxLoss) * 100, 1000) : 0;
      // ---
      const S_0 = S;
      const K = strikePrice;
      const debit = premium;
      const r = 0.00;
      const chance = popLongPut ? popLongPut({ S: S_0, K, premium: debit, T, sigma, r }) * 100 : (contract.delta ? Math.abs(contract.delta) * 100 : 0);
      const below = strikePrice - premium * 2;
      const above = strikePrice + premium;
      const payoffPoints = [
        { price: below, profit: (strikePrice - below) * 100 - maxLoss },
        { price: strikePrice, profit: -maxLoss },
        { price: breakEven, profit: 0 },
        { price: above, profit: -maxLoss },
      ];
      candidates.push({
        name: `Long Put (${strikePrice})`,
        contracts: [contract],
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
  return pickBestStrategy(candidates, sliderValue);
} 
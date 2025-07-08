/*  Short-Put builder with realistic margin (Fix #1)  */
/*  Only dependency that changed is helpers.parseBudget + helpers.isLiquid   */

import { UserInputs }           from '../../domain/types/UserInputs';
import { Contract }             from '../../domain/types/Contract';
import { StrategyResult }       from '../../domain/types/Strategy';
import { popLongCall }          from '../../domain/math/probability';   // we’ll reuse it
import {
  normalizeSentiment,
  parseBudget,
  isLiquid,
  pickBestStrategy,
}                               from '../helpers';

/**
 * CBOE-style naked‐put margin rule:
 *   max( 20 % · S − OTM , 10 % · S ) · 100  +  credit · 100
 */
function calcShortPutMargin(S: number, K: number, credit: number): number {
  const otm   = Math.max(0, S - K);          // dollars OTM
  const base  = 0.20 * S * 100 - otm * 100;
  const alt   = 0.10 * S * 100;
  return Math.max(base, alt) + credit * 100;
}

export function buildShortPut(
  user: UserInputs,
  options: Contract[],
  sliderValue: number,
): StrategyResult[] {

  const S = typeof user.quote?.price === 'number' ? user.quote.price : 0;
  const sentiment  = normalizeSentiment(user.sentiment);
  const candidates : StrategyResult[] = [];

  const userBudget = parseBudget(user.budget);
  const hasBudget  = !!user.budget && userBudget > 0;

  // Short puts fit bullish ➜ neutral views
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {

    const puts = options.filter(c => c.type === 'put' && isLiquid(c));

    for (const contract of puts) {
      const credit = typeof contract.bid === 'number' ? contract.bid : 0;
      if (credit <= 0) continue;                       // ignore stale quotes

      const strike = contract.strike_price;
      const margin = calcShortPutMargin(S, strike, credit);
      if (hasBudget && margin > userBudget) continue; // honour user budget

      const maxProfit     = credit * 100;             // keep UX intuitive
      const maxLoss       = margin;                   // capital at risk
      const returnOnRisk  = (maxProfit / maxLoss) * 100; // now ≈ 50–200 %

      /* --- Probability of profit (reuse popLongCall mirror) --- */
      const T = user.expiration
        ? (typeof user.expiration === 'number'
            ? user.expiration
            : Math.max(
                (new Date(user.expiration).getTime() - Date.now())
                / (365 * 24 * 60 * 60 * 1000), 1/365))
        : 0.1;
      const sigma = typeof contract.iv === 'number'
        ? contract.iv
        : typeof user.quote?.iv === 'number'
        ? user.quote.iv
        : 0.25;
      // popLongCall gives P(S_T ≥ K); short-put wins if price ≥ K
      const chance = popLongCall({ S, K: strike, premium: 0, T, sigma, r: 0 }) * 100;

      if (chance < 10) continue;
      /* -------------------------------------------------------- */

      const breakEven = strike - credit;

      /* Simple payoff plot */
      const payoffPoints = [
        { price: 0,               profit: -maxLoss },
        { price: breakEven,       profit: -maxLoss },
        { price: strike,          profit: 0 },
        { price: S * 1.25,        profit: maxProfit },
      ];

      candidates.push({
        name: `Short Put (${strike})`,
        contracts: [contract],
        returnOnRisk,
        chance,
        profit          : maxProfit,
        risk            : maxLoss,
        requiredCapital : margin,
        sentimentFit    : ['bullish', 'very_bullish'],
        breakEven,
        payoffPoints,
      });
    }
  }

  return pickBestStrategy(candidates, sliderValue);
}

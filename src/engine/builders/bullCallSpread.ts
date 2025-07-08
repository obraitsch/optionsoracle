import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { popBullCall } from '../../domain/math/probability';
import { safeNum } from '../../domain/math/money';
import { normalizeSentiment, parseBudget, isLiquid, pickBestStrategy } from '../helpers';

export function buildBullCallSpread(user: UserInputs, options: Contract[], sliderValue: number): StrategyResult[] {
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const calls = options
      .filter(c => c.type === 'call' && isLiquid(c))
      .sort((a, b) => a.strike_price - b.strike_price);
    for (let i = 0; i < calls.length - 1; i++) {
      const longCall = calls[i];
      for (let j = i + 1; j < calls.length && j <= i + 6; j++) {
        const shortCall = calls[j];
        const width = safeNum(shortCall.strike_price) - safeNum(longCall.strike_price);
        if (width < 1) continue; // width window
        const debit = safeNum(longCall.ask) - safeNum(shortCall.bid);
        if (debit <= 0) continue; // ignore zero-credit or inverted spreads
        const capitalReq = debit * 100;
        if (hasBudget && capitalReq > userBudget) continue;
        // --- Metrics ---
        // Cap ROR by expected move (σ-based cap)
        const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
        const sigma = typeof longCall.iv === 'number' && typeof shortCall.iv === 'number'
          ? (safeNum(longCall.iv) + safeNum(shortCall.iv)) / 2
          : (typeof user.quote?.iv === 'number' ? user.quote.iv : 0.25);
        const k = 1.5; // same as long call
        const targetUp = S && sigma && T ? S + k * sigma * Math.sqrt(T) * S : (shortCall.strike_price);
        const breakEven = safeNum(longCall.strike_price) + debit;
        // Cap maxProfit by expected move
        const cappedProfit = Math.max(0, (Math.min(targetUp, shortCall.strike_price) - breakEven) * 100);
        if (!cappedProfit) continue;        // skip unprofitable lottos
        const maxProfitRaw = width * 100 - debit * 100;
        const maxProfit    = Math.min(maxProfitRaw, cappedProfit);
        const maxLoss = debit * 100;
        const returnOnRisk = maxLoss ? Math.min((maxProfit / maxLoss) * 100, 1500) : 0;
        // PoP: analytic or delta-proxy

        const spreadDelta =
        typeof shortCall.delta === 'number'
          ? Math.abs(shortCall.delta)
          : typeof longCall.delta === 'number'
            ? Math.abs(longCall.delta)
            : 0.5;
        const r = 0.00;
        const chance = popBullCall
          ? popBullCall({
              S: S,
              Klong: safeNum(longCall.strike_price),
              Kshort: safeNum(shortCall.strike_price),
              debit,
              T,
              sigma,
              r
            }) * 100
            : (1 - spreadDelta) * 100;

        // Payoff points
        const below = safeNum(longCall.strike_price) - width * 2;
        const above = safeNum(shortCall.strike_price) + width;
        const payoffPoints = [
          { price: below, profit: -maxLoss },
          { price: safeNum(longCall.strike_price), profit: -maxLoss },
          { price: breakEven, profit: 0 },
          { price: safeNum(shortCall.strike_price), profit: maxProfit },
          { price: above, profit: maxProfit },
        ];
        candidates.push({
          name: `Bull Call Spread (${longCall.strike_price}/${shortCall.strike_price})`,
          contracts: [longCall, shortCall],
          returnOnRisk,
          chance,
          profit: maxProfit,
          risk: maxLoss,
          requiredCapital: capitalReq,
          sentimentFit: ['bullish', 'very_bullish'],
          breakEven,
          payoffPoints,
        });
      }
    }
  }
  return pickBestStrategy(candidates, sliderValue);
} 
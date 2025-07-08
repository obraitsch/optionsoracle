import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { popIronCondor } from '../../domain/math/probability';
import { roundPenny } from '../../domain/math/money';
import { normalizeSentiment, isLiquid, pickBestStrategy } from '../helpers';

export function buildIronCondor(user: UserInputs, options: Contract[], sliderValue: number, sigma: number): StrategyResult[] {
  const a = sliderValue / 100;
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);
  const candidates: StrategyResult[] = [];
  if (sentiment === 'neutral' && S) {
    // Generate all valid shortPut/longPut and shortCall/longCall pairs
    const puts = options.filter(c => c.type === 'put' && isLiquid(c));
    const calls = options.filter(c => c.type === 'call' && isLiquid(c));
    for (let i = 0; i < puts.length - 1; i++) {
      const shortPut = puts[i];
      for (let j = i + 1; j < puts.length; j++) {
        const longPut = puts[j];
        for (let k = 0; k < calls.length - 1; k++) {
          const shortCall = calls[k];
          for (let l = k + 1; l < calls.length; l++) {
            const longCall = calls[l];
            // Ensure strikes are ordered: longPut < shortPut < shortCall < longCall
            if (!(longPut.strike_price < shortPut.strike_price && shortPut.strike_price < shortCall.strike_price && shortCall.strike_price < longCall.strike_price)) continue;
            const putCredit = (shortPut.bid || 0) - (longPut.ask || 0);
            const callCredit = (shortCall.bid || 0) - (longCall.ask || 0);
            const netCredit = putCredit + callCredit;
            if (netCredit <= 0) continue;
            const requiredCapital = Math.max(
              (shortPut.strike_price - longPut.strike_price) * 100,
              (longCall.strike_price - shortCall.strike_price) * 100
            );
            const maxProfit = netCredit * 100;
            const maxLoss = requiredCapital - maxProfit;
            const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
            const S_0 = S;
            const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
            const r = 0.00;
            const chance = popIronCondor({
              S: S_0,
              KputShort: shortPut.strike_price,
              KcallShort: shortCall.strike_price,
              credit: netCredit,
              T,
              sigma,
              r
            }) * 100;
            const breakEvenLow = shortPut.strike_price - netCredit;
            const breakEvenHigh  = shortCall.strike_price + netCredit;
            const payoffPoints = [
              { price: longPut.strike_price - 5, profit: -maxLoss },
              { price: breakEvenLow, profit: 0 },
              { price: shortPut.strike_price, profit: maxProfit },
              { price: shortCall.strike_price, profit: maxProfit },
              { price: breakEvenHigh, profit: 0 },
              { price: longCall.strike_price + 5, profit: -maxLoss },
            ];
            candidates.push({
              name: `Iron Condor: (${longCall.strike_price}/${longPut.strike_price}/${shortCall.strike_price}/${shortPut.strike_price})`,
              contracts: [shortPut, longPut, shortCall, longCall],
              returnOnRisk,
              chance,
              profit: maxProfit,
              risk: maxLoss,
              requiredCapital,
              sentimentFit: ['neutral'],
              breakEven: breakEvenLow,
              payoffPoints,
            });
          }
        }
      }
    }
  }
  return pickBestStrategy(candidates, sliderValue);
} 
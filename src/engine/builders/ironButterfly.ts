import { UserInputs } from '../../domain/types/UserInputs';
import { Contract } from '../../domain/types/Contract';
import { StrategyResult } from '../../domain/types/Strategy';
import { roundPenny } from '../../domain/math/money';
import { normalizeSentiment, parseBudget, isLiquid } from '../helpers';

export function buildIronButterfly(user: UserInputs, options: Contract[], sliderValue: number, sigma: number): StrategyResult[] {
  const a = sliderValue / 100;
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);
  const results: StrategyResult[] = [];
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;
  if (sentiment === 'neutral' && S) {
    const atmStrike = roundPenny(S);
    let shortCallIB: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === atmStrike);
    let shortPutIB: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === atmStrike);
    if (!shortCallIB) {
      shortCallIB = options.reduce((prev, curr) => (curr.type === 'call' && Math.abs(curr.strike_price - atmStrike) < Math.abs((prev?.strike_price ?? 0) - atmStrike) ? curr : prev), null as Contract);
    }
    if (!shortPutIB) {
      shortPutIB = options.reduce((prev, curr) => (curr.type === 'put' && Math.abs(curr.strike_price - atmStrike) < Math.abs((prev?.strike_price ?? 0) - atmStrike) ? curr : prev), null as Contract);
    }
    const wingDist = roundPenny(sigma * (0.5 + 2 * a));
    let longCallIB: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === atmStrike + wingDist);
    let longPutIB: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === atmStrike - wingDist);
    if (!longCallIB) {
      longCallIB = options.reduce((prev, curr) => (curr.type === 'call' && Math.abs(curr.strike_price - (atmStrike + wingDist)) < Math.abs((prev?.strike_price ?? 0) - (atmStrike + wingDist)) ? curr : prev), null as Contract);
    }
    if (!longPutIB) {
      longPutIB = options.reduce((prev, curr) => (curr.type === 'put' && Math.abs(curr.strike_price - (atmStrike - wingDist)) < Math.abs((prev?.strike_price ?? 0) - (atmStrike - wingDist)) ? curr : prev), null as Contract);
    }
    if (shortCallIB && shortPutIB && longCallIB && isLiquid(longCallIB) && longPutIB && isLiquid(longPutIB)) {
      const shortCallCredit = shortCallIB.bid || 0;
      const shortPutCredit = shortPutIB.bid || 0;
      const longCallDebit = longCallIB.ask || 0;
      const longPutDebit = longPutIB.ask || 0;
      const netCredit = shortCallCredit + shortPutCredit - longCallDebit - longPutDebit;
      if (netCredit > 0) {
        const requiredCapital = Math.max(
          (longCallIB.strike_price - shortCallIB.strike_price) * 100,
          (shortPutIB.strike_price - longPutIB.strike_price) * 100
        );
        if (!hasBudget || requiredCapital <= userBudget) {
          const maxProfit = netCredit * 100;
          const maxLoss = requiredCapital - maxProfit;
          const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
          const chance = 40; // Estimate
          const breakEvenLow = shortPutIB.strike_price - netCredit;
          const breakEvenHigh = shortCallIB.strike_price + netCredit;
          const payoffPoints = [
            { price: longPutIB.strike_price - 5, profit: -maxLoss },
            { price: breakEvenLow, profit: 0 },
            { price: shortPutIB.strike_price, profit: maxProfit },
            { price: shortCallIB.strike_price, profit: maxProfit },
            { price: breakEvenHigh, profit: 0 },
            { price: longCallIB.strike_price + 5, profit: -maxLoss },
          ];
          results.push({
            name: 'Iron Butterfly',
            contracts: [shortCallIB, shortPutIB, longCallIB, longPutIB],
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
  return results;
} 
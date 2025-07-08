import { Contract } from '../domain/types/Contract';
import { StrategyResult } from '../domain/types/Strategy';

export function normalizeSentiment(sentiment: string): string {
  if (sentiment === 'very_bullish') return 'bullish';
  if (sentiment === 'very_bearish') return 'bearish';
  if (sentiment === 'directional') return 'directional';
  return sentiment;
}

export function parseBudget(budget: string): number {
  if (typeof budget === 'number') return budget;
  if (!budget) return 0;
  const n = Number(budget.toString().replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function isProfitableAtTarget(strategy: StrategyResult, targetPrice: string): boolean {
  if (!targetPrice || isNaN(Number(targetPrice))) return true;
  const target = Number(targetPrice);
  if (strategy.payoffPoints && Array.isArray(strategy.payoffPoints)) {
    let closest = strategy.payoffPoints[0];
    let minDiff = Math.abs(target - closest.price);
    for (const p of strategy.payoffPoints) {
      const diff = Math.abs(target - p.price);
      if (diff < minDiff) {
        closest = p;
        minDiff = diff;
      }
    }
    return closest.profit > 0;
  }
  if (typeof strategy.breakEven === 'number') {
    return target >= strategy.breakEven;
  }
  return true;
}

export function findOTMCalls(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'call' && c.strike_price > price)
    .sort((a, b) => a.strike_price - b.strike_price)
    .slice(0, count);
}

export function findOTMPuts(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'put' && c.strike_price < price)
    .sort((a, b) => b.strike_price - a.strike_price)
    .slice(0, count);
}

export function findITMCalls(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'call' && c.strike_price < price)
    .sort((a, b) => b.strike_price - a.strike_price)
    .slice(0, count);
}

export function findITMPuts(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'put' && c.strike_price > price)
    .sort((a, b) => a.strike_price - b.strike_price)
    .slice(0, count);
}

export function findBullCallSpreads(options: Contract[], price: number, count: number = 3) {
  const calls = options
    .filter(c => c.type === 'call' && c.strike_price > price)
    .sort((a, b) => a.strike_price - b.strike_price);
  const spreads = [];
  for (let i = 0; i < Math.min(calls.length - 1, count); i++) {
    for (let j = i + 1; j < Math.min(calls.length, i + 3); j++) {
      spreads.push({ longCall: calls[i], shortCall: calls[j] });
    }
  }
  return spreads.slice(0, count);
}

export function findBearPutSpreads(options: Contract[], price: number, count: number = 3) {
  const puts = options
    .filter(c => c.type === 'put' && c.strike_price < price)
    .sort((a, b) => b.strike_price - a.strike_price);
  const spreads = [];
  for (let i = 0; i < Math.min(puts.length - 1, count); i++) {
    for (let j = i + 1; j < Math.min(puts.length, i + 3); j++) {
      spreads.push({ longPut: puts[i], shortPut: puts[j] });
    }
  }
  return spreads.slice(0, count);
}

export function findBullPutSpreads(options: Contract[], price: number, count: number = 3) {
  const puts = options
    .filter(c => c.type === 'put' && c.strike_price < price)
    .sort((a, b) => b.strike_price - a.strike_price);
  const spreads = [];
  for (let i = 0; i < Math.min(puts.length - 1, count); i++) {
    for (let j = i + 1; j < Math.min(puts.length, i + 3); j++) {
      spreads.push({ shortPut: puts[i], longPut: puts[j] });
    }
  }
  return spreads.slice(0, count);
}

export function isLiquid(contract: Contract): boolean {
  const mid = (contract.bid + contract.ask) / 2;
  return mid > 0.05 && ((contract.open_interest || 0) + (contract.volume || 0)) > 0;
}

export function findContractByDelta(options: Contract[], type: 'call' | 'put', targetDelta: number, minDelta: number, maxDelta: number): Contract | null {
  const validContracts = options.filter(c => {
    if (c.type !== type) return false;
    if (typeof c.delta !== 'number') return false;
    const liquid = isLiquid(c);
    const inDeltaRange = c.delta >= minDelta && c.delta <= maxDelta;
    return liquid && inDeltaRange;
  });
  if (validContracts.length === 0) {
    return null;
  }
  const sorted = validContracts.sort((a, b) => Math.abs(a.delta! - targetDelta) - Math.abs(b.delta! - targetDelta));
  return sorted[0];
}

// Compute a 0-1 liquidity score for a contract or array of contracts
export function computeLiquidityScore(contracts: Contract[]): number {
  // Use open_interest + volume and bid-ask tightness
  let oi = 0, vol = 0, bidAskTightness = 0, n = 0;
  for (const c of contracts) {
    oi += c.open_interest || 0;
    vol += c.volume || 0;
    if (c.ask && c.bid) {
      bidAskTightness += Math.max(0, 1 - (c.ask - c.bid) / Math.max(0.01, c.ask));
      n++;
    }
  }
  // Normalize open interest and volume (log scale for diminishing returns)
  const oiScore = Math.log10(oi + 1) / 4; // 0-1 for oi up to 10,000
  const volScore = Math.log10(vol + 1) / 4; // 0-1 for vol up to 10,000
  const tightnessScore = n ? bidAskTightness / n : 0;
  // Blend: 60% tightness, 20% oi, 20% vol
  return Math.max(0, Math.min(1, 0.6 * tightnessScore + 0.2 * oiScore + 0.2 * volScore));
}

// Normalize an array of numbers to 0-1 (min-max)
export function normalizeArray(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  if (max === min) return arr.map(() => 0.5); // All same value
  return arr.map(x => (x - min) / (max - min));
}

// Main scoring pipeline for strategies
export function scoreStrategies<T extends StrategyResult>(
  candidates: T[],
  sliderValue: number
): (T & { score: number; rorNorm: number; popNorm: number; capEffNorm: number; liqNorm: number })[] {
  if (!candidates.length) return [];
  // Compute raw metrics
  // Log-scale ROR for better slider sensitivity
  const ror = candidates.map(s => Math.log10(Math.max(1, s.returnOnRisk)));
  const pop = candidates.map(s => Math.max(0, s.chance));
  const capEff = candidates.map(s => s.requiredCapital > 0 ? Math.max(0, s.profit / s.requiredCapital) : 0);
  const liq = candidates.map(s => computeLiquidityScore(s.contracts));
  // Normalize
  const rorNorm = normalizeArray(ror);
  const popNorm = normalizeArray(pop);
  const capEffNorm = normalizeArray(capEff);
  const liqNorm = normalizeArray(liq);
  // Slider weights
  const wReward = sliderValue / 100;
  const wRisk = 1 - wReward;
  // Score
  const scored = candidates.map((s, i) => ({
    ...s,
    rorNorm: rorNorm[i],
    popNorm: popNorm[i],
    capEffNorm: capEffNorm[i],
    liqNorm: liqNorm[i],
    score: wReward * rorNorm[i] + wRisk * popNorm[i] + 0.15 * capEffNorm[i] + 0.10 * liqNorm[i],
  }));
  // Sort: highest score, then higher PoP, then lower capital
  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score :
    b.popNorm !== a.popNorm ? b.popNorm - a.popNorm :
    a.requiredCapital - b.requiredCapital
  );
  return scored;
}

// Funnel: return only the top-scoring strategy (or [] if none)
export function pickBestStrategy<T extends StrategyResult>(candidates: T[], sliderValue: number): T[] {
  const scored = scoreStrategies(candidates, sliderValue);
  return scored.length ? [scored[0]] : [];
} 
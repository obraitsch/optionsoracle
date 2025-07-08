// Move all imports to the top
import { popLongCall, popBullCall, popIronCondor } from '../../utils/probability';

export interface UserInputs {
  ticker: string;
  quote: any;
  sentiment: string;
  riskReward: number;
  targetPrice: string;
  budget: string;
  expiration: string;
}

export interface Contract {
  symbol: string;
  type: string;
  strike_price: number;
  expiry: number;
  bid: number;
  ask: number;
  last: number;
  open_interest: number;
  volume: number;
  in_the_money: boolean;
  underlying_price: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface StrategyResult {
  name: string;
  contracts: Contract[];
  returnOnRisk: number;
  chance: number;
  profit: number;
  risk: number;
  requiredCapital: number;
  sentimentFit: string[];
  breakEven: number;
  payoffPoints?: { price: number; profit: number }[];
}

function normalizeSentiment(sentiment: string): string {
  if (sentiment === 'very_bullish') return 'bullish';
  if (sentiment === 'very_bearish') return 'bearish';
  if (sentiment === 'directional') return 'directional';
  return sentiment;
}

// Helper: Find multiple OTM calls with different strikes
function findOTMCalls(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'call' && c.strike_price > price)
    .sort((a, b) => a.strike_price - b.strike_price)
    .slice(0, count);
}

// Helper: Find multiple OTM puts with different strikes
function findOTMPuts(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'put' && c.strike_price < price)
    .sort((a, b) => b.strike_price - a.strike_price)
    .slice(0, count);
}

// Helper: Find multiple ITM calls with different strikes
function findITMCalls(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'call' && c.strike_price < price)
    .sort((a, b) => b.strike_price - a.strike_price)
    .slice(0, count);
}

// Helper: Find multiple ITM puts with different strikes
function findITMPuts(options: Contract[], price: number, count: number = 3) {
  return options
    .filter(c => c.type === 'put' && c.strike_price > price)
    .sort((a, b) => a.strike_price - b.strike_price)
    .slice(0, count);
}

// Helper: Find multiple Bull Call Spread combinations
function findBullCallSpreads(options: Contract[], price: number, count: number = 3) {
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

// Helper: Find multiple Bear Put Spread combinations
function findBearPutSpreads(options: Contract[], price: number, count: number = 3) {
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

// Helper: Find multiple Bull Put Spread combinations
function findBullPutSpreads(options: Contract[], price: number, count: number = 3) {
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

function parseBudget(budget: string): number {
  if (typeof budget === 'number') return budget;
  if (!budget) return 0;
  const n = Number(budget.toString().replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Helper to check if a strategy is profitable at the user's target price
function isProfitableAtTarget(strategy: StrategyResult, targetPrice: string): boolean {
  if (!targetPrice || isNaN(Number(targetPrice))) return true;
  const target = Number(targetPrice);
  // Use payoffPoints if available
  if (strategy.payoffPoints && Array.isArray(strategy.payoffPoints)) {
    // Find the closest payoff point to the target price
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
  // Fallback: compare to breakEven if available
  if (typeof strategy.breakEven === 'number') {
    return target >= strategy.breakEven;
  }
  return true;
}

// --- LIQUIDITY FILTER ---
export function filterLiquidContracts(contracts: Contract[]): Contract[] {
  return contracts.filter(c => {
    // Mid-price calculation
    const mid = (c.bid + c.ask) / 2;
    // Liquidity filter: skip if mid-price <= $0.05 or (volume + open_interest == 0)
    return mid > 0.05 && (c.volume + c.open_interest > 0);
  });
}

// --- NORMALIZATION & SCORING ---
export interface ScoredStrategy extends StrategyResult {
  roi_scaled: number;
  cop_scaled: number;
  score: number;
}

/**
 * Normalize ROI and COP to [0,1] scale for all strategies.
 * @param strategies Array of StrategyResult with .returnOnRisk and .chance
 * @returns Array of ScoredStrategy with .roi_scaled, .cop_scaled
 */
export function normalizeStrategies(strategies: StrategyResult[]): (ScoredStrategy & { rawROI: number; rawCOP: number })[] {
  const epsilon = 1e-8;
  const rois = strategies.map(s => s.returnOnRisk);
  const cops = strategies.map(s => s.chance);
  const min_roi = Math.min(...rois);
  const max_roi = Math.max(...rois);
  const min_cop = Math.min(...cops);
  const max_cop = Math.max(...cops);
  return strategies.map(s => ({
    ...s,
    roi_scaled: (s.returnOnRisk - min_roi) / (max_roi - min_roi + epsilon),
    cop_scaled: (s.chance - min_cop) / (max_cop - min_cop + epsilon),
    score: 0, // placeholder, to be set by scoreStrategies
    rawROI: s.returnOnRisk,
    rawCOP: s.chance,
  }));
}

/**
 * Score and sort strategies by slider value (0-100).
 * @param strategies Array of ScoredStrategy (with .roi_scaled, .cop_scaled)
 * @param sliderValue 0-100 (0=max chance, 100=max return)
 * @returns Sorted array with .score set
 */
export function scoreStrategies(strategies: ScoredStrategy[], sliderValue: number): ScoredStrategy[] {
  const w_roi = sliderValue / 100;
  const w_cop = 1 - w_roi;
  return strategies
    .map(s => ({ ...s, score: w_roi * s.roi_scaled + w_cop * s.cop_scaled }))
    .sort((a, b) => b.score - a.score);
}

// --- SLIDER-DRIVEN STRATEGY ENGINE (per detailed spec) ---

/**
 * Utility: Find the contract (call/put) with delta closest to targetDelta, with liquidity check.
 * @param options Option contracts array
 * @param type 'call' or 'put'
 * @param targetDelta Target delta (positive for calls, negative for puts)
 * @param minDelta Minimum allowed delta (for capping)
 * @param maxDelta Maximum allowed delta (for capping)
 * @returns The best contract or null
 */
function findContractByDelta(options: Contract[], type: 'call' | 'put', targetDelta: number, minDelta: number, maxDelta: number): Contract | null {
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

  // Find the contract closest to target delta
  const sorted = validContracts.sort((a, b) => Math.abs(a.delta! - targetDelta) - Math.abs(b.delta! - targetDelta));
  return sorted[0];
}

/**
 * Utility: Round a dollar value to the nearest valid strike increment.
 * @param value Dollar value
 * @param increments Array of valid strike increments (sorted ascending)
 * @returns Nearest increment
 */
function roundToIncrement(value: number, increments: number[]): number {
  if (!increments.length) return value;
  let closest = increments[0];
  let minDiff = Math.abs(value - closest);
  for (const inc of increments) {
    const diff = Math.abs(value - inc);
    if (diff < minDiff) {
      closest = inc;
      minDiff = diff;
    }
  }
  return closest;
}

/**
 * Utility: Check if a contract is liquid per spec (mid-price > $0.05 and OI+vol > 0)
 */
function isLiquid(contract: Contract): boolean {
  const mid = (contract.bid + contract.ask) / 2;
  return mid > 0.05 && ((contract.open_interest || 0) + (contract.volume || 0)) > 0;
}

/**
 * Main entry: Get strategies per slider, sentiment, and spec rules
 * @param user UserInputs
 * @param sigma One-sd implied move in dollars
 * @param options Option chain (array of Contract)
 * @param sliderValue 0-100
 * @returns Array of StrategyResult (one per template, with legs and metrics)
 */
export function getSliderDrivenStrategies(user: UserInputs, sigma: number, options: Contract[], sliderValue: number): StrategyResult[] {
  // 1. Compute aggressiveness
  const a = sliderValue / 100;
  const S = user.quote?.price;
  const sentiment = normalizeSentiment(user.sentiment);

  // TODO: Get valid strike increments from options chain
  const increments = Array.from(new Set(options.map(c => c.strike_price))).sort((a, b) => a - b);
  const results: StrategyResult[] = [];

  // Determine if budget is set (declare once for all strategies)
  const userBudget = parseBudget(user.budget);
  const hasBudget = !!user.budget && userBudget > 0;

/* =======================================================================
 * 1. SINGLE-LEG STRATEGIES - Long Call, Long Put, Short Call, Short Put (# Total 4)
 * ===================================================================== */

  // --- Long Call (slider-driven) *BULLISH* ---
  // Complete: PoP, Profit Loss Calculations, Breaking Point, Title
  // Incomplte: 
  // Needs debugging and Improvement: The Slider 
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    // targetDelta = 0.60 - 0.50 * a (cap at 0.10 min)
    let targetDelta = 0.6 - 0.5 * a;
    if (targetDelta < 0.1) targetDelta = 0.1;
    if (targetDelta > 0.9) targetDelta = 0.9;
    const contract = findContractByDelta(options, 'call', targetDelta, 0.1, 1.0);
    if (contract && isLiquid(contract)) {
      const premium = contract.ask || 0;
      const requiredCapital = premium * 100;
      if (!hasBudget || requiredCapital <= userBudget) {
        const maxLoss = requiredCapital;
        const maxProfit = Infinity;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        // Calculate probability of profit using the more accurate formula
        const S_0 = S;
        const K = contract.strike_price;
        const debit = premium;
        const sigma = contract.iv || user.quote?.iv; // || 0.5; // fallback to 0.5 if not available
        const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
        const r = 0.00; // Assume 0
        const chance = popLongCall({
          S: S_0,
          K,
          premium: debit,
          T,
          sigma,
          r
        }) * 100;
        const breakEven = contract.strike_price + premium;
        const below = contract.strike_price - premium;
        const above = contract.strike_price + premium * 2;
        const payoffPoints = [
          { price: below, profit: -maxLoss },
          { price: contract.strike_price, profit: -maxLoss },
          { price: breakEven, profit: 0 },
          { price: above, profit: (above - breakEven) * 100 },
        ];
        results.push({
          name: `Long Call (${contract.strike_price})`,
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
  }

  // --- Long Put (slider-driven) *BEARISH* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'bearish' || sentiment === 'very_bearish') {
    // Pick OTM puts, more OTM for higher slider value
    const otmPuts = options.filter(c => c.type === 'put' && isLiquid(c)).sort((a, b) => a.strike_price - b.strike_price);
    if (otmPuts.length > 0) {
      // Use slider to pick further OTM for higher slider
      const pickIndex = Math.round((otmPuts.length - 1) * (sliderValue / 100));
      const put = otmPuts[pickIndex] || otmPuts[0];
      const premium = put.ask || 0;
      const requiredCapital = premium * 100;
      if (!hasBudget || requiredCapital <= userBudget) {
        const maxLoss = requiredCapital;
        const maxProfit = put.strike_price * 100; // If stock goes to zero
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const chance = put.delta ? Math.abs(put.delta) * 100 : 0;
        const breakEven = put.strike_price - premium;
        const below = put.strike_price - premium * 2;
        const above = put.strike_price + premium;
        const payoffPoints = [
          { price: below, profit: (put.strike_price - below) * 100 - maxLoss },
          { price: put.strike_price, profit: -maxLoss },
          { price: breakEven, profit: 0 },
          { price: above, profit: -maxLoss },
        ];
        results.push({
          name: `Long Put (${put.strike_price})`,
          contracts: [put],
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
  }

  // --- Short Call (slider-driven) *BEARISH* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'bearish' || sentiment === 'very_bearish') {
    const otmCalls = options.filter(c => c.type === 'call' && c.strike_price > S && isLiquid(c) && typeof c.delta === 'number');
    let targetDelta = 0.4 - 0.3 * a;
    if (targetDelta < 0.1) targetDelta = 0.1;
    if (targetDelta > 0.7) targetDelta = 0.7;
    const sorted = otmCalls.sort((c1, c2) => Math.abs(c1.delta! - targetDelta) - Math.abs(c2.delta! - targetDelta));
    
    for (const call of sorted) {
      const premium = call.bid || 0;
      const strike = call.strike_price;
      const requiredCapital = strike * 100; // Margin requirement
      if (hasBudget && requiredCapital > userBudget) continue;
      
      const maxProfit = premium * 100;
      const maxLoss = Infinity;
      const returnOnRisk = 0; // Cannot calculate for unlimited risk
      const chance = call.delta ? (1 - call.delta) * 100 : 0;
      const breakEven = strike + premium;
      
      // Centered payoff points
      const priceRange = strike * 0.1; // 10% of strike for range
      const payoffPoints = [
        { price: strike * 0.9, profit: maxProfit },
        { price: strike, profit: maxProfit },
        { price: breakEven, profit: 0 },
        { price: strike * 1.1, profit: -((strike * 1.1 - breakEven) * 100) }
      ];
      
      results.push({
        name: `Short Call (${strike})`,
        contracts: [call],
        returnOnRisk,
        chance,
        profit: maxProfit,
        risk: maxLoss,
        requiredCapital,
        sentimentFit: ['bearish', 'very_bearish'],
        breakEven,
        payoffPoints,
      });
      break; // Only consider the best one
    }
  }

  // --- Short Put (slider-driven) *BULLISH* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    // targetDelta = -0.30 + 0.20 * a (cap at -0.05 max, -0.7 min)
    let targetDelta = -0.3 + 0.2 * a;
    if (targetDelta > -0.05) targetDelta = -0.05;
    if (targetDelta < -0.7) targetDelta = -0.7;
    const contract = findContractByDelta(options, 'put', targetDelta, -1.0, -0.05);
    if (contract && isLiquid(contract)) {
      const premium = contract.bid || 0;
      const requiredCapital = contract.strike_price * 100;
      if (!hasBudget || requiredCapital <= userBudget) {
        const maxProfit = premium * 100;
        const maxLoss = contract.strike_price * 100 - premium * 100;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const chance = contract.delta ? (1 - Math.abs(contract.delta)) * 100 : 0;
        const breakEven = contract.strike_price - premium;
        const strike = contract.strike_price;
        const below = strike - (strike - breakEven);
        const above = strike + (strike - breakEven);
        const payoffPoints = [
          { price: below, profit: -maxLoss },
          { price: breakEven, profit: 0 },
          { price: strike, profit: maxProfit },
          { price: above, profit: maxProfit },
          { price: above + (strike - breakEven), profit: maxProfit },
        ];
        results.push({
          name: `Short Put (${contract.strike_price})`,
          contracts: [contract],
          returnOnRisk,
          chance,
          profit: maxProfit,
          risk: maxLoss,
          requiredCapital,
          sentimentFit: ['bullish', 'very_bullish', 'neutral'],
          breakEven,
          payoffPoints,
        });
      }
    }
  }

 

/* =======================================================================
 * 2. SPREAD STRATEGIES - Bull Call Spread, Bear Put Spread, Bull Put Spread, Bear Call Spread *Missing* (# Total 4)
 * ===================================================================== */

  // --- Bull Call Spread (OptionStrat-style optimizer) *BULLISH* ---
  // Complete: PoP, Profit Loss Calculations, Breaking Point, Title
  // Incomplte: 
  // Needs debugging and Improvement: The Slider 
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    console.log('Entered bull call spread block');
    const allCalls = options.filter(c => c.type === 'call' && isLiquid(c)).sort((a, b) => a.strike_price - b.strike_price);
    const bullCallSpreads: StrategyResult[] = [];
    for (let i = 0; i < allCalls.length - 1; i++) {
      const longCall = allCalls[i];
      for (let j = i + 1; j < allCalls.length; j++) {
        const shortCall = allCalls[j];
        if (longCall.ask == null || shortCall.bid == null) continue;
        const debit = (safeNum(longCall.ask)) - (safeNum(shortCall.bid));
        if (debit <= 0) continue; // Not a debit spread
        const requiredCapital = debit * 100;
        // Only filter by budget if user has set a budget
        if (hasBudget && requiredCapital > userBudget) continue;
        const maxProfit = (safeNum(shortCall.strike_price) - safeNum(longCall.strike_price)) * 100 - requiredCapital;
        const maxLoss = requiredCapital;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const S_0 = S;
        // --- Time to expiry (years) --------------------------------------
        const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
        const r = 0.00; // Assume 0
        const chance = popBullCall({
          S: S_0,                       // ← current underlying quote
          Klong: safeNum(longCall.strike_price),
          Kshort: safeNum(shortCall.strike_price),
          debit,                              // net premium you already calculated
          T,             // convert days → years
          sigma: (safeNum(longCall.iv) + safeNum(shortCall.iv)) / 2, // or ATM IV
          r                                   // risk-free rate; pass 0 if you ignore carry
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
        const strategy: StrategyResult = {
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
        };
        if (isProfitableAtTarget(strategy, user.targetPrice)) {
          bullCallSpreads.push(strategy);
        }
      }
    }
    // Score and select top Bull Call Spread by slider
    if (bullCallSpreads.length > 0) {
      const norm = normalizeStrategies(bullCallSpreads);
      const scored = scoreStrategies(norm, sliderValue);
      if (scored.length > 0) {
        results.push(scored[0]); // Only push the top-scoring Bull Call Spread
      }
    }
  }

  // --- Bear Put Spread (slider-driven) *BEARISH* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'bearish' || sentiment === 'very_bearish') {
    const allPuts = options.filter(c => c.type === 'put' && isLiquid(c)).sort((a, b) => a.strike_price - b.strike_price);
    const bearPutSpreads: StrategyResult[] = [];
    for (let i = 0; i < allPuts.length - 1; i++) {
      const shortPut = allPuts[i];
      for (let j = i + 1; j < allPuts.length; j++) {
        const longPut = allPuts[j];
        if (longPut.ask == null || shortPut.bid == null) continue;
        const debit = (safeNum(longPut.ask)) - (safeNum(shortPut.bid));
        if (debit <= 0) continue; // Not a debit spread
        const requiredCapital = debit * 100;
        // Only filter by budget if user has set a budget
        if (hasBudget && requiredCapital > userBudget) continue;
        const maxProfit = (safeNum(longPut.strike_price) - safeNum(shortPut.strike_price)) * 100 - requiredCapital;
        const maxLoss = requiredCapital;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const chance = safeNum(longPut.delta) ? Math.abs(safeNum(longPut.delta)) * 100 : 0;
        const breakEven = safeNum(longPut.strike_price) - debit;
        const spreadWidth = Math.abs(safeNum(longPut.strike_price) - safeNum(shortPut.strike_price));
        const below = safeNum(shortPut.strike_price) - spreadWidth;
        const above = safeNum(longPut.strike_price) + spreadWidth;
        const payoffPoints = [
          { price: below, profit: maxProfit },
          { price: safeNum(shortPut.strike_price), profit: maxProfit },
          { price: breakEven, profit: 0 },
          { price: safeNum(longPut.strike_price), profit: -maxLoss },
          { price: above, profit: -maxLoss },
        ];
        const strategy: StrategyResult = {
          name: `Bear Put Spread (${longPut.strike_price}/${shortPut.strike_price})`,
          contracts: [longPut, shortPut],
          returnOnRisk,
          chance,
          profit: maxProfit,
          risk: maxLoss,
          requiredCapital,
          sentimentFit: ['bearish', 'very_bearish'],
          breakEven,
          payoffPoints,
        };
        if (isProfitableAtTarget(strategy, user.targetPrice)) {
          bearPutSpreads.push(strategy);
        }
      }
    }
    // Score and select top Bear Put Spread by slider
    if (bearPutSpreads.length > 0) {
      const norm = normalizeStrategies(bearPutSpreads);
      const scored = scoreStrategies(norm, sliderValue);
      if (scored.length > 0) {
        results.push(scored[0]); // Only push the top-scoring Bear Put Spread
      }
    }
  }

   // --- Bull Put Spread (slider-driven) *BULLISH & NEUTRAL* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    // targetDelta for short put: -0.30 + 0.20 * a (cap at -0.05 max, -0.7 min)
    let targetDelta = -0.3 + 0.2 * a;
    if (targetDelta > -0.05) targetDelta = -0.05;
    if (targetDelta < -0.7) targetDelta = -0.7;
    // Find short put by delta
    const shortPut = findContractByDelta(options, 'put', targetDelta, -1.0, -0.05);
    if (shortPut && isLiquid(shortPut)) {
      // Find long put below short put (spread width based on slider)
      const allPuts = options.filter(c => c.type === 'put' && c.strike_price < shortPut.strike_price && isLiquid(c));
      // Spread width: 1-3 strikes, wider for higher slider
      const spreadWidths = allPuts.map(p => Math.abs(shortPut.strike_price - p.strike_price));
      let bestLongPut = null;
      let bestWidth = 0;
      for (const longPut of allPuts) {
        const width = Math.abs(shortPut.strike_price - longPut.strike_price);
        if (width >= 1 && width <= 10) {
          if (!bestLongPut || Math.abs(width - (1 + 2 * a)) < Math.abs(bestWidth - (1 + 2 * a))) {
            bestLongPut = longPut;
            bestWidth = width;
          }
        }
      }
      if (bestLongPut) {
        const credit = (shortPut.bid || 0) - (bestLongPut.ask || 0);
        if (credit > 0) {
          const requiredCapital = roundPenny((shortPut.strike_price - bestLongPut.strike_price) * 100);
          if (!hasBudget || requiredCapital <= userBudget) {
            const maxProfit = roundPenny(credit * 100);
            const maxLoss = roundPenny(requiredCapital - maxProfit);
            const returnOnRisk = maxLoss ? roundPenny((maxProfit / maxLoss) * 100) : 0;
            const chance = shortPut.delta ? roundPenny((1 - Math.abs(shortPut.delta)) * 100) : 0;
            const breakEven = roundPenny(shortPut.strike_price - credit);
            let spreadWidth = Math.abs(bestLongPut.strike_price - shortPut.strike_price);
            let below = roundPenny(Number(bestLongPut.strike_price) - Number(spreadWidth));
            let above = roundPenny(Number(shortPut.strike_price) + Number(spreadWidth));
            const payoffPoints = [
              { price: below, profit: -maxLoss },
              { price: bestLongPut.strike_price, profit: -maxLoss },
              { price: breakEven, profit: 0 },
              { price: shortPut.strike_price, profit: maxProfit },
              { price: above, profit: maxProfit },
            ];
            results.push({
              name: `Bull Put Spread (${shortPut.strike_price}/${bestLongPut.strike_price})`,
              contracts: [shortPut, bestLongPut],
              returnOnRisk,
              chance,
              profit: maxProfit,
              risk: maxLoss,
              requiredCapital,
              sentimentFit: ['bullish', 'very_bullish', 'neutral'],
              breakEven,
              payoffPoints,
            });
          }
        }
      }
    }
  }

  /* =======================================================================
 * 3. IRON STRUCTURES - Iron Condor, Iron Butterfly, Inverse Iron Condor, Inverse Iron Butterfly (# Total 4)
 * ===================================================================== */


  // --- Iron Condor *NEUTRAL* ---
  // Complete: PoP, Profit Loss Calculations, Breaking Point, Title
  // Incomplte: 
  // Needs debugging and Improvement: The Slider, the PoP calculator
  let shortPutIC: Contract | null | undefined = findContractByDelta(options, 'put', -0.1 - 0.25 * a, -1.0, -0.1);
  let shortCallIC: Contract | null | undefined = findContractByDelta(options, 'call', 0.1 + 0.25 * a, 0.1, 1.0);
  if (!shortPutIC) {
    const puts = options.filter(c => c.type === 'put' && typeof c.delta === 'number');
    if (puts.length) {
      shortPutIC = puts.sort((c1, c2) => Math.abs(Number(c1.delta) + 0.1 + 0.25 * a) - Math.abs(Number(c2.delta) + 0.1 + 0.25 * a))[0];
    }
  }
  if (!shortCallIC) {
    const calls = options.filter(c => c.type === 'call' && typeof c.delta === 'number');
    if (calls.length) {
      shortCallIC = calls.sort((c1, c2) => Math.abs(Number(c1.delta) - (0.1 + 0.25 * a)) - Math.abs(Number(c2.delta) - (0.1 + 0.25 * a)))[0];
    }
  }
  if (shortPutIC && shortCallIC) {
    const wingWidth = roundToIncrement(sigma * (1 + 2 * a), increments);
    let longPutStrike = shortPutIC.strike_price - wingWidth;
    let longCallStrike = shortCallIC.strike_price + wingWidth;
    let longPutIC: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === longPutStrike);
    let longCallIC: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === longCallStrike);
    if (!longPutIC) {
      longPutIC = findClosestStrikeContract(options, 'put', longPutStrike);
    }
    if (!longCallIC) {
      longCallIC = findClosestStrikeContract(options, 'call', longCallStrike);
    }
    if (longPutIC && isLiquid(longPutIC) && longCallIC && isLiquid(longCallIC)) {
      const putCredit = (shortPutIC.bid || 0) - (longPutIC.ask || 0);
      const callCredit = (shortCallIC.bid || 0) - (longCallIC.ask || 0);
      const netCredit = putCredit + callCredit;
      if (netCredit > 0) {
        const requiredCapital = Math.max(
          (shortPutIC.strike_price - longPutIC.strike_price) * 100,
          (longCallIC.strike_price - shortCallIC.strike_price) * 100
        );
        const maxProfit = netCredit * 100;
        const maxLoss = requiredCapital - maxProfit;
        const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
        const S_0 = S;
        const T = user.expiration ? (typeof user.expiration === 'number' ? user.expiration : (typeof user.expiration === 'string' ? (Math.max((new Date(user.expiration).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 1/365)) : 0)) : 0.1;
        const r = 0.00;
        const chance = popIronCondor({
        S: S_0,
  KputShort: shortPutIC.strike_price,
  KcallShort: shortCallIC.strike_price,
  credit: netCredit,
  T,
  sigma,
  r
}) * 100;
        const breakEvenLow = shortPutIC.strike_price - netCredit;
        const breakEvenHigh  = shortCallIC.strike_price + netCredit;
        const payoffPoints = [
          { price: longPutIC.strike_price - 5, profit: -maxLoss },
          { price: breakEvenLow, profit: 0 },
          { price: shortPutIC.strike_price, profit: maxProfit },
          { price: shortCallIC.strike_price, profit: maxProfit },
          { price: breakEvenHigh, profit: 0 },
          { price: longCallIC.strike_price + 5, profit: -maxLoss },
        ];
        results.push({
          name: `Iron Condor: (${longCallIC.strike_price}/${longPutIC.strike_price}/${shortCallIC.strike_price}/${shortPutIC.strike_price})`,
          contracts: [shortPutIC, longPutIC, shortCallIC, longCallIC],
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

  // --- Iron Butterfly *NEUTRAL* ---
  // Complete: PoP, Profit Loss Calculations, Breaking Point, Title
  // Incomplte: 
  // Needs debugging and Improvement: 
  // Only show for neutral or directional sentiment
  if ((sentiment === 'neutral') && S) {
    const atmStrike = roundToIncrement(S, increments);
    let shortCallIB: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === atmStrike);
    let shortPutIB: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === atmStrike);
    if (!shortCallIB) {
      shortCallIB = findClosestStrikeContract(options, 'call', atmStrike);
    }
    if (!shortPutIB) {
      shortPutIB = findClosestStrikeContract(options, 'put', atmStrike);
    }
    const wingDist = roundToIncrement(sigma * (0.5 + 2 * a), increments);
    let longCallIB: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === atmStrike + wingDist);
    let longPutIB: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === atmStrike - wingDist);
    if (!longCallIB) {
      longCallIB = findClosestStrikeContract(options, 'call', atmStrike + wingDist);
    }
    if (!longPutIB) {
      longPutIB = findClosestStrikeContract(options, 'put', atmStrike - wingDist);
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
        // Only filter by budget if user has set a budget
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
    } else {
      // Handle case where legs are not found or not liquid
    }
  }

  // --- Inverse Iron Condor (slider-driven) *DIRECTIONAL* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'directional' && S) {
    const atmStrike = roundToIncrement(S, increments);
    const wingDist = roundToIncrement(sigma * (0.5 + 2 * a), increments);
    
    // Find OTM long options (body)
    let longCall = options.find(c => c.type === 'call' && c.strike_price === atmStrike + wingDist);
    let longPut = options.find(c => c.type === 'put' && c.strike_price === atmStrike - wingDist);
    if (!longCall) longCall = findClosestStrikeContract(options, 'call', atmStrike + wingDist) || undefined;
    if (!longPut) longPut = findClosestStrikeContract(options, 'put', atmStrike - wingDist) || undefined;
    
    // Find ATM short options (wings)
    let shortCall = options.find(c => c.type === 'call' && c.strike_price === atmStrike);
    let shortPut = options.find(c => c.type === 'put' && c.strike_price === atmStrike);
    if (!shortCall) shortCall = findClosestStrikeContract(options, 'call', atmStrike) || undefined;
    if (!shortPut) shortPut = findClosestStrikeContract(options, 'put', atmStrike) || undefined;
    
    if (longCall && longPut && shortCall && shortPut && 
        isLiquid(longCall) && isLiquid(longPut) && isLiquid(shortCall) && isLiquid(shortPut)) {
      
      // Calculate net debit
      const longCallDebit = longCall.ask || 0;
      const longPutDebit = longPut.ask || 0;
      const shortCallCredit = shortCall.bid || 0;
      const shortPutCredit = shortPut.bid || 0;
      const netDebit = longCallDebit + longPutDebit - shortCallCredit - shortPutCredit;
      
      if (netDebit > 0) {
        const requiredCapital = netDebit * 100;
        
        if (!hasBudget || requiredCapital <= userBudget) {
          const maxProfit = Infinity; // Unlimited profit potential
          const maxLoss = requiredCapital;
          const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
          const chance = 15; // Rough estimate for inverse iron condor
          const breakEvenLow = shortPut.strike_price - netDebit;
          const breakEvenHigh = shortCall.strike_price + netDebit;
          
          const payoffPoints = [
            { price: longPut.strike_price - 10, profit: (longPut.strike_price - (longPut.strike_price - 10)) * 100 - maxLoss },
            { price: breakEvenLow, profit: 0 },
            { price: shortPut.strike_price, profit: -maxLoss },
            { price: shortCall.strike_price, profit: -maxLoss },
            { price: breakEvenHigh, profit: 0 },
            { price: longCall.strike_price + 10, profit: ((longCall.strike_price + 10) - longCall.strike_price) * 100 - maxLoss },
          ];
          
          results.push({
            name: 'Inverse Iron Condor',
            contracts: [longPut, shortPut, longCall, shortCall],
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
  }

  // --- Inverse Iron Butterfly (slider-driven) *DIRECTIONAL* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'directional' && S) {
    // Center at ATM, wingspan based on slider
    const atmStrike = roundToIncrement(S, increments);
    const wingDist = roundToIncrement(sigma * (0.5 + 2 * a), increments);
    let longCall = options.find(c => c.type === 'call' && c.strike_price === atmStrike + wingDist);
    let longPut = options.find(c => c.type === 'put' && c.strike_price === atmStrike - wingDist);
    let shortCall = options.find(c => c.type === 'call' && c.strike_price === atmStrike);
    let shortPut = options.find(c => c.type === 'put' && c.strike_price === atmStrike);
    if (!longCall) longCall = findClosestStrikeContract(options, 'call', atmStrike + wingDist) || undefined;
    if (!longPut) longPut = findClosestStrikeContract(options, 'put', atmStrike - wingDist) || undefined;
    if (!shortCall) shortCall = findClosestStrikeContract(options, 'call', atmStrike) || undefined;
    if (!shortPut) shortPut = findClosestStrikeContract(options, 'put', atmStrike) || undefined;
    if (longCall && isLiquid(longCall) && longPut && isLiquid(longPut) && shortCall && isLiquid(shortCall) && shortPut && isLiquid(shortPut)) {
      const longCallDebit = longCall.ask || 0;
      const longPutDebit = longPut.ask || 0;
      const shortCallCredit = shortCall.bid || 0;
      const shortPutCredit = shortPut.bid || 0;
      const netDebit = longCallDebit + longPutDebit - shortCallCredit - shortPutCredit;
      if (netDebit > 0) {
        const requiredCapital = netDebit * 100;
        if (!hasBudget || requiredCapital <= userBudget) {
          const maxProfit = Infinity;
          const maxLoss = requiredCapital;
          const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
          const chance = 20;
          const breakEvenLow = shortPut.strike_price - netDebit;
          const breakEvenHigh = shortCall.strike_price + netDebit;
          const payoffPoints = [
            { price: longPut.strike_price - 10, profit: (longPut.strike_price - (longPut.strike_price - 10)) * 100 - maxLoss },
            { price: breakEvenLow, profit: 0 },
            { price: shortPut.strike_price, profit: -maxLoss },
            { price: shortCall.strike_price, profit: -maxLoss },
            { price: breakEvenHigh, profit: 0 },
            { price: longCall.strike_price + 10, profit: ((longCall.strike_price + 10) - longCall.strike_price) * 100 - maxLoss },
          ];
          results.push({
            name: 'Inverse Iron Butterfly',
            contracts: [longCall, longPut, shortCall, shortPut],
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
    } else {
      // Handle case where legs are not found or not liquid
    }
  }

  /* =======================================================================
 * 4. STRADDLES & STRANGLES - Straddle, Strangle, Short Straddle, Short Strangle (# Total 4)
 * ===================================================================== */


  // --- Straddle/Strangle *DIRECTIONAL* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (String(sentiment) === 'directional') {
    if (S) {
      const gap = sigma * (0.5 + 2 * a);
      if (a <= 0.3) {
        const atmStrike = roundToIncrement(S, increments);
        let call: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === atmStrike);
        let put: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === atmStrike);
        if (!call) {
          call = findClosestStrikeContract(options, 'call', atmStrike);
        }
        if (!put) {
          put = findClosestStrikeContract(options, 'put', atmStrike);
        }
        if (call && isLiquid(call) && put && isLiquid(put)) {
          const callPremium = call.ask || 0;
          const putPremium = put.ask || 0;
          const totalPremium = callPremium + putPremium;
          const requiredCapital = totalPremium * 100;
          // Only filter by budget if user has set a budget
          if (!hasBudget || requiredCapital <= userBudget) {
            const maxLoss = requiredCapital;
            const maxProfit = Infinity;
            const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
            const chance = 30; // Estimate
            const breakEvenLow = call.strike_price - totalPremium;
            const breakEvenHigh = call.strike_price + totalPremium;
            const payoffPoints = [
              { price: breakEvenLow - 10, profit: (breakEvenLow - (breakEvenLow - 10)) * 100 - maxLoss },
              { price: breakEvenLow, profit: 0 },
              { price: call.strike_price, profit: -maxLoss },
              { price: breakEvenHigh, profit: 0 },
              { price: breakEvenHigh + 10, profit: ((breakEvenHigh + 10) - breakEvenHigh) * 100 - maxLoss },
            ];
            results.push({
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
      } else {
        const putStrike = roundToIncrement(S - gap, increments);
        const callStrike = roundToIncrement(S + gap, increments);
        let put: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === putStrike);
        let call: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === callStrike);
        if (!put) {
          put = findClosestStrikeContract(options, 'put', putStrike);
        }
        if (!call) {
          call = findClosestStrikeContract(options, 'call', callStrike);
        }
        if (call && isLiquid(call) && put && isLiquid(put)) {
          const callPremium = call.ask || 0;
          const putPremium = put.ask || 0;
          const totalPremium = callPremium + putPremium;
          const requiredCapital = totalPremium * 100;
          // Only filter by budget if user has set a budget
          if (!hasBudget || requiredCapital <= userBudget) {
            const maxLoss = requiredCapital;
            const maxProfit = Infinity;
            const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
            const chance = 25; // Estimate
            const breakEvenLow = put.strike_price - totalPremium;
            const breakEvenHigh = call.strike_price + totalPremium;
            const payoffPoints = [
              { price: breakEvenLow - 10, profit: (breakEvenLow - (breakEvenLow - 10)) * 100 - maxLoss },
              { price: breakEvenLow, profit: 0 },
              { price: put.strike_price, profit: -maxLoss },
              { price: call.strike_price, profit: -maxLoss },
              { price: breakEvenHigh, profit: 0 },
              { price: breakEvenHigh + 10, profit: ((breakEvenHigh + 10) - breakEvenHigh) * 100 - maxLoss },
            ];
            results.push({
              name: 'Strangle',
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
    }
  }

  // --- Short Straddle (slider-driven) *NEUTRAL*  ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (String(sentiment) === 'neutral') {
    if (S) {
      // Use slider to determine aggressiveness - higher slider = more OTM strikes
      let targetDelta = 0.5 - 0.4 * a; // Range from 0.5 (ATM) to 0.1 (far OTM)
      if (targetDelta < 0.1) targetDelta = 0.1;
      if (targetDelta > 0.5) targetDelta = 0.5;
      
      // Find call and put with target delta
      const call = findContractByDelta(options, 'call', targetDelta, 0.1, 0.5);
      const put = findContractByDelta(options, 'put', -targetDelta, -0.5, -0.1);
      
      if (call && isLiquid(call) && put && isLiquid(put)) {
        const callPremium = call.bid || 0;
        const putPremium = put.bid || 0;
        const totalPremium = callPremium + putPremium;
        const requiredCapital = Math.max(call.strike_price, put.strike_price) * 100;
        if (!hasBudget || requiredCapital <= userBudget) {
          const maxProfit = totalPremium * 100;
          const maxLoss = Infinity;
          const returnOnRisk = 0; // Cannot calculate for unlimited risk
          const chance = 70 - (a * 20); // Higher slider = lower chance (more aggressive)
          const breakEvenLow = put.strike_price - totalPremium;
          const breakEvenHigh = call.strike_price + totalPremium;
          const payoffPoints = [
            { price: breakEvenLow - 10, profit: -((breakEvenLow - (breakEvenLow - 10)) * 100) },
            { price: breakEvenLow, profit: 0 },
            { price: put.strike_price, profit: maxProfit },
            { price: call.strike_price, profit: maxProfit },
            { price: breakEvenHigh, profit: 0 },
            { price: breakEvenHigh + 10, profit: -(((breakEvenHigh + 10) - breakEvenHigh) * 100) },
          ];
          results.push({
            name: `Short Straddle (${put.strike_price}/${call.strike_price})`,
            contracts: [call, put],
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

  // --- Short Strangle (slider-driven) *NEUTRAL* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (String(sentiment) === 'neutral') {
    if (S) {
      const gap = sigma * (0.5 + 2 * a);
      const putStrike = roundToIncrement(S - gap, increments);
      const callStrike = roundToIncrement(S + gap, increments);
      let put: Contract | null | undefined = options.find(c => c.type === 'put' && c.strike_price === putStrike);
      let call: Contract | null | undefined = options.find(c => c.type === 'call' && c.strike_price === callStrike);
      if (!put) {
        put = findClosestStrikeContract(options, 'put', putStrike);
      }
      if (!call) {
        call = findClosestStrikeContract(options, 'call', callStrike);
      }
      if (call && isLiquid(call) && put && isLiquid(put)) {
        const callPremium = call.bid || 0;
        const putPremium = put.bid || 0;
        const totalPremium = callPremium + putPremium;
        const requiredCapital = Math.max(call.strike_price, put.strike_price) * 100;
        if (!hasBudget || requiredCapital <= userBudget) {
          const maxProfit = totalPremium * 100;
          const maxLoss = Infinity;
          const returnOnRisk = 0; // Cannot calculate for unlimited risk
          const chance = 75; // Estimate
          const breakEvenLow = put.strike_price - totalPremium;
          const breakEvenHigh = call.strike_price + totalPremium;
          const payoffPoints = [
            { price: breakEvenLow - 10, profit: -((breakEvenLow - (breakEvenLow - 10)) * 100) },
            { price: breakEvenLow, profit: 0 },
            { price: put.strike_price, profit: maxProfit },
            { price: call.strike_price, profit: maxProfit },
            { price: breakEvenHigh, profit: 0 },
            { price: breakEvenHigh + 10, profit: -(((breakEvenHigh + 10) - breakEvenHigh) * 100) },
          ];
          results.push({
            name: `Short Strangle (${put.strike_price}/${call.strike_price})`,
            contracts: [call, put],
            returnOnRisk,
            chance,
            profit: maxProfit,
            risk: maxLoss,
            requiredCapital,
            sentimentFit: ['neutral'],
            breakEven: breakEvenLow, // Use lower break-even for display
            payoffPoints,
          });
        }
      }
    }
  }

  /* =======================================================================
 * 5. COVERED CALLS & CASH SECURED PUTS - Covered Call, Cash Secured Put (# Total 2)
 * ===================================================================== */

  // --- Covered Call (slider-driven) *BULLISH* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const otmCalls = options.filter(c => c.type === 'call' && c.strike_price > S && isLiquid(c) && typeof c.delta === 'number');
    let targetDelta = 0.4 - 0.3 * a;
    if (targetDelta < 0.1) targetDelta = 0.1;
    if (targetDelta > 0.7) targetDelta = 0.7;
    const sorted = otmCalls.sort((c1, c2) => Math.abs(c1.delta! - targetDelta) - Math.abs(c2.delta! - targetDelta));
    const coveredCallCandidates: StrategyResult[] = [];
    
    for (const call of sorted) {
      const premium = call.bid || 0;
      const strike = call.strike_price;
      const requiredCapital = S * 100; // Cost of 100 shares
      if (hasBudget && requiredCapital > userBudget) continue;
      
      const maxProfit = premium * 100;
      const maxLoss = (S - strike + premium) * 100;
      const returnOnRisk = maxLoss ? (maxProfit / maxLoss) * 100 : 0;
      const chance = call.delta ? (1 - call.delta) * 100 : 0;
      const breakEven = strike - premium;
      
      // Centered payoff points
      const priceRange = strike * 0.1; // 10% of strike for range
      const payoffPoints = [
        { price: strike * 0.9, profit: Math.min(maxProfit, (strike * 0.9 - S) * 100 + maxProfit) },
        { price: breakEven, profit: 0 },
        { price: strike, profit: maxProfit },
        { price: strike * 1.1, profit: maxProfit }
      ];
      
      const strategy: StrategyResult = {
        name: `Covered Call (${strike})`,
        contracts: [call],
        returnOnRisk,
        chance,
        profit: maxProfit,
        risk: maxLoss,
        requiredCapital,
        sentimentFit: ['bullish', 'very_bullish'],
        breakEven,
        payoffPoints,
      };
      coveredCallCandidates.push(strategy);
      break; // Only consider the best one
    }
    
    if (coveredCallCandidates.length > 0) {
      const norm = normalizeStrategies(coveredCallCandidates);
      const scored = scoreStrategies(norm, sliderValue);
      if (scored.length > 0) {
        results.push(scored[0]);
      }
    }
  }

  // --- Cash Secured Put (slider-driven) *BULLISH* ---
  // Complete: 
  // Incomplte: 
  // Needs debugging and Improvement: 
  if (sentiment === 'bullish' || sentiment === 'very_bullish') {
    const otmPuts = options.filter(c => c.type === 'put' && c.strike_price < S && isLiquid(c) && typeof c.delta === 'number');
    let targetDelta = -0.4 + 0.3 * a;
    if (targetDelta > -0.1) targetDelta = -0.1;
    if (targetDelta < -0.7) targetDelta = -0.7;
    const sorted = otmPuts.sort((c1, c2) => Math.abs(c1.delta! - targetDelta) - Math.abs(c2.delta! - targetDelta));
    const cashSecuredPutCandidates: StrategyResult[] = [];
    
    for (const put of sorted) {
      const premium = put.bid || 0;
      const strike = put.strike_price;
      const requiredCapital = roundPenny(strike * 100);
      if (hasBudget && requiredCapital > userBudget) continue;
      
      const maxProfit = roundPenny(premium * 100);
      const maxLoss = roundPenny((strike - premium) * 100);
      const returnOnRisk = maxLoss ? roundPenny((maxProfit / maxLoss) * 100) : 0;
      const chance = put.delta ? roundPenny((1 - Math.abs(put.delta)) * 100) : 0;
      const breakEven = roundPenny(strike - premium);
      
      // Centered payoff points
      const priceRange = strike * 0.1; // 10% of strike for range
      const payoffPoints = [
        { price: roundPenny(strike * 0.9), profit: roundPenny(-(strike - strike * 0.9) * 100 + maxProfit) },
        { price: breakEven, profit: 0 },
        { price: strike, profit: maxProfit },
        { price: roundPenny(strike * 1.1), profit: maxProfit }
      ];
      
      const strategy: StrategyResult = {
        name: `Cash Secured Put (${strike})`,
        contracts: [put],
        returnOnRisk,
        chance,
        profit: maxProfit,
        risk: maxLoss,
        requiredCapital,
        sentimentFit: ['bullish', 'very_bullish'],
        breakEven,
        payoffPoints,
      };
      cashSecuredPutCandidates.push(strategy);
      break; // Only consider the best one
    }
    
    if (cashSecuredPutCandidates.length > 0) {
      const norm = normalizeStrategies(cashSecuredPutCandidates);
      const scored = scoreStrategies(norm, sliderValue);
      if (scored.length > 0) {
        results.push(scored[0]);
      }
    }
  }

 

  

  
 




  return results;
} 

// Helper: Find closest contract by strike if exact strike is not available
function findClosestStrikeContract(options: Contract[], type: 'call' | 'put', strike: number): Contract | null {
  const filtered = options.filter(c => c.type === type);
  if (!filtered.length) return null;
  let closest = filtered[0];
  let minDiff = Math.abs(filtered[0].strike_price - strike);
  for (const c of filtered) {
    const diff = Math.abs(c.strike_price - strike);
    if (diff < minDiff) {
      closest = c;
      minDiff = diff;
    }
  }
  return closest;
}

// Helper to safely cast to number
function safeNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// Helper: Find ATM options for strangles
function findATMStrangles(options: Contract[], price: number, count: number = 2) {
  // Find options closest to current price (within 10% of price)
  const allOptions = options.filter(c => 
    Math.abs(c.strike_price - price) / price < 0.10
  );
  const calls = allOptions.filter(c => c.type === 'call' && c.strike_price > price);
  const puts = allOptions.filter(c => c.type === 'put' && c.strike_price < price);
  const strangles = [];
  for (let i = 0; i < Math.min(calls.length, count); i++) {
    for (let j = 0; j < Math.min(puts.length, count); j++) {
      strangles.push({ call: calls[i], put: puts[j] });
    }
  }
  return strangles.slice(0, count);
}

// Helper: Find Iron Butterfly combinations
function findIronButterflies(options: Contract[], price: number, count: number = 2) {
  // Find ATM options for the body (within 5% of price)
  const atmOptions = options.filter(c => 
    Math.abs(c.strike_price - price) / price < 0.05
  );
  const atmCalls = atmOptions.filter(c => c.type === 'call');
  const atmPuts = atmOptions.filter(c => c.type === 'put');
  // Find OTM options for the wings
  const otmCalls = options.filter(c => c.type === 'call' && c.strike_price > price * 1.05);
  const otmPuts = options.filter(c => c.type === 'put' && c.strike_price < price * 0.95);
  const butterflies = [];
  for (let i = 0; i < Math.min(atmCalls.length, count); i++) {
    for (let j = 0; j < Math.min(atmPuts.length, count); j++) {
      if (Math.abs(atmCalls[i].strike_price - atmPuts[j].strike_price) < 1) {
        for (let k = 0; k < Math.min(otmCalls.length, count); k++) {
          for (let l = 0; l < Math.min(otmPuts.length, count); l++) {
            butterflies.push({
              shortCall: atmCalls[i],
              shortPut: atmPuts[j],
              longCall: otmCalls[k],
              longPut: otmPuts[l],
            });
          }
        }
      }
    }
  }
  return butterflies.slice(0, count);
}

// Helper: Find Inverse Iron Butterfly combinations
function findInverseIronButterflies(options: Contract[], price: number, count: number = 2) {
  // Find OTM options for the body
  const otmCalls = options.filter(c => c.type === 'call' && c.strike_price > price * 1.05);
  const otmPuts = options.filter(c => c.type === 'put' && c.strike_price < price * 0.95);
  // Find ATM options for the wings
  const atmOptions = options.filter(c => 
    Math.abs(c.strike_price - price) / price < 0.05
  );
  const atmCalls = atmOptions.filter(c => c.type === 'call');
  const atmPuts = atmOptions.filter(c => c.type === 'put');
  const butterflies = [];
  for (let i = 0; i < Math.min(otmCalls.length, count); i++) {
    for (let j = 0; j < Math.min(otmPuts.length, count); j++) {
      for (let k = 0; k < Math.min(atmCalls.length, count); k++) {
        for (let l = 0; l < Math.min(atmPuts.length, count); l++) {
          if (Math.abs(atmCalls[k].strike_price - atmPuts[l].strike_price) < 1) {
            butterflies.push({
              longCall: otmCalls[i],
              longPut: otmPuts[j],
              shortCall: atmCalls[k],
              shortPut: atmPuts[l],
            });
          }
        }
      }
    }
  }
  return butterflies.slice(0, count);
}

// Helper: Find Inverse Iron Condor combinations
function findInverseIronCondors(options: Contract[], price: number, count: number = 2) {
  const calls = options
    .filter(c => c.type === 'call' && c.strike_price > price)
    .sort((a, b) => a.strike_price - b.strike_price);
  const puts = options
    .filter(c => c.type === 'put' && c.strike_price < price)
    .sort((a, b) => b.strike_price - a.strike_price);
  const condors = [];
  for (let i = 0; i < Math.min(calls.length - 1, 2); i++) {
    for (let j = i + 1; j < Math.min(calls.length, i + 2); j++) {
      for (let k = 0; k < Math.min(puts.length - 1, 2); k++) {
        for (let l = k + 1; l < Math.min(puts.length, k + 2); l++) {
          condors.push({
            longPut: puts[i],
            shortPut: puts[j],
            longCall: calls[k],
            shortCall: calls[l],
          });
        }
      }
    }
  }
  return condors.slice(0, count);
}

// Utility: Round to nearest penny
function roundPenny(n: number): number {
  return Math.round(n * 100) / 100;
}
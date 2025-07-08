// utils/greeks.ts

// Standard normal cumulative distribution function
export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

// Error function approximation
function erf(x: number): number {
  // Save the sign of x
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  // A&S formula 7.1.26
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// Black-Scholes formula for European options
export function blackScholes({
  S, K, T, r, sigma, type
}: {
  S: number; // underlying price
  K: number; // strike price
  T: number; // time to expiration in years
  r: number; // risk-free rate
  sigma: number; // volatility (annualized)
  type: 'call' | 'put';
}): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === 'call') {
    return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  } else {
    return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
  }
}

// Greeks: Delta, Gamma, Theta, Vega, Rho
export function greeks({
  S, K, T, r, sigma, type
}: {
  S: number; K: number; T: number; r: number; sigma: number; type: 'call' | 'put';
}) {
  const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const pdf = (x: number) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * Math.pow(x, 2));
  const delta = type === 'call' ? normCdf(d1) : normCdf(d1) - 1;
  const gamma = pdf(d1) / (S * sigma * Math.sqrt(T));
  const vega = S * pdf(d1) * Math.sqrt(T) / 100;
  const theta = type === 'call'
    ? (-S * pdf(d1) * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normCdf(d2)) / 365
    : (-S * pdf(d1) * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normCdf(-d2)) / 365;
  const rho = type === 'call'
    ? K * T * Math.exp(-r * T) * normCdf(d2) / 100
    : -K * T * Math.exp(-r * T) * normCdf(-d2) / 100;
  return { delta, gamma, vega, theta, rho };
}

// Calculate implied move based on options trader formula
// Implied move ($) = S_0 * σ_IV * Sqrt(DTE / 365)
export function calculateImpliedMove({
  S_0, // underlying price
  sigma_IV, // at-the-money implied volatility
  DTE // calendar days to expiration
}: {
  S_0: number;
  sigma_IV: number;
  DTE: number;
}): number {
  return S_0 * sigma_IV * Math.sqrt(DTE / 365);
}

// Calculate target price based on sentiment and implied move
export function calculateTargetPrice({
  currentPrice,
  impliedMove,
  sentiment
}: {
  currentPrice: number;
  impliedMove: number;
  sentiment: string;
}): number {
  switch (sentiment) {
    case 'very_bullish':
      return currentPrice + impliedMove * 2; // 2x implied move
    case 'bullish':
      return currentPrice + impliedMove; // 1x implied move
    case 'neutral':
      return currentPrice; // No movement expected
    case 'bearish':
      return currentPrice - impliedMove; // -1x implied move
    case 'very_bearish':
      return currentPrice - impliedMove * 2; // -2x implied move
    case 'directional':
      return currentPrice + impliedMove * 0.5; // 0.5x implied move (slight bullish bias)
    default:
      return currentPrice;
  }
} 
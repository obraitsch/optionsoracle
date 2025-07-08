/* =======================================================================
 *  probability.ts  –  analytic Probability-of-Profit helpers
 *  All functions return a value in [0 … 1].
 *  Pass r = 0 if you don't include financing on the debit / credit.
 * ===================================================================== */

const SQRT2PI = Math.sqrt(2 * Math.PI);

/*----------------  standard-normal CDF  --------------------------------*/
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const k =
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - (1 / SQRT2PI) * Math.exp(-0.5 * x * x) * k;
  return x < 0 ? 1 - cdf : cdf;
}

function z(
  price: number,
  S: number,
  sigma: number,
  T: number,
  r = 0
): number {
  return (
    (Math.log(price / S) - (r - 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T))
  );
}

function rightTail(b: number, S: number, σ: number, T: number, r = 0) {
  return 1 - normCdf(z(b, S, σ, T, r));
}
function leftTail(b: number, S: number, σ: number, T: number, r = 0) {
  return normCdf(z(b, S, σ, T, r));
}
function between(
  bL: number,
  bH: number,
  S: number,
  σ: number,
  T: number,
  r = 0
) {
  return normCdf(z(bH, S, σ, T, r)) - normCdf(z(bL, S, σ, T, r));
}
function outside(
  bL: number,
  bH: number,
  S: number,
  σ: number,
  T: number,
  r = 0
) {
  return 1 - between(bL, bH, S, σ, T, r);
}

/* =======================================================================
 * 1. SINGLE-LEG STRATEGIES
 * ===================================================================== */

/** Long Call */
export function popLongCall({
  S,
  K,
  premium,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  K: number;
  premium: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return rightTail(K + premium, S, sigma, T, r);
}

/** Long Put */
export function popLongPut({
  S,
  K,
  premium,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  K: number;
  premium: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return leftTail(K - premium, S, sigma, T, r);
}

/** Short Put */
export function popShortPut({
  S,
  K,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  K: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return rightTail(K - credit, S, sigma, T, r);
}

/** Short Call */
export function popShortCall({
  S,
  K,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  K: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return leftTail(K + credit, S, sigma, T, r);
}

/* =======================================================================
 * 2. VERTICAL SPREADS
 * ===================================================================== */

/** Bull Call (debit) */
export function popBullCall({
  S,
  Klong,
  Kshort,
  debit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Klong: number;
  Kshort: number;
  debit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  const width = Kshort - Klong;
  if (debit >= width) return 0;
  return rightTail(Klong + debit, S, sigma, T, r);
}

/** Bear Put (debit) */
export function popBearPut({
  S,
  KshortPut,
  KlongPut,
  debit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  KshortPut: number;
  KlongPut: number;
  debit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  const width = KshortPut - KlongPut;
  if (debit >= width) return 0;
  return leftTail(KshortPut - debit, S, sigma, T, r);
}

/** Bull Put (credit) */
export function popBullPut({
  S,
  Kshort,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Kshort: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return rightTail(Kshort - credit, S, sigma, T, r);
}

/** Bear Call (credit) */
export function popBearCall({
  S,
  Kshort,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Kshort: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return leftTail(Kshort + credit, S, sigma, T, r);
}

/* =======================================================================
 * 3. IRON STRUCTURES
 * ===================================================================== */

/** Iron Condor */
export function popIronCondor({
  S,
  KputShort,
  KcallShort,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  KputShort: number;
  KcallShort: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return between(
    KputShort - credit,
    KcallShort + credit,
    S,
    sigma,
    T,
    r
  );
}

/** Iron Butterfly */
export function popIronButterfly({
  S,
  Kbody,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Kbody: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return between(Kbody - credit, Kbody + credit, S, sigma, T, r);
}

/* =======================================================================
 * 4. STRADDLES & STRANGLES
 * ===================================================================== */

/** Short Straddle */
export function popShortStraddle({
  S,
  K,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  K: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return between(K - credit, K + credit, S, sigma, T, r);
}

/** Long Straddle */
export function popLongStraddle({
  S,
  K,
  debit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  K: number;
  debit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return outside(K - debit, K + debit, S, sigma, T, r);
}

/** Short Strangle */
export function popShortStrangle({
  S,
  Kput,
  Kcall,
  credit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Kput: number;
  Kcall: number;
  credit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return between(Kput - credit, Kcall + credit, S, sigma, T, r);
}

/** Long Strangle */
export function popLongStrangle({
  S,
  Kput,
  Kcall,
  debit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Kput: number;
  Kcall: number;
  debit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return outside(Kput - debit, Kcall + debit, S, sigma, T, r);
}

/* =======================================================================
 * 5. SYMMETRIC BUTTERFLY (1-2-1), debit version
 * ===================================================================== */

export function popButterfly({
  S,
  Klow,
  Khigh,
  debit,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Klow: number;
  Khigh: number;
  debit: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  return between(Klow + debit, Khigh - debit, S, sigma, T, r);
}

/* =======================================================================
 * 6. COLLAR (long stk + long put + short call)
 * ===================================================================== */

export function popCollar({
  S,
  Kput,
  putPrem,
  Kcall,
  callPrem,
  T,
  sigma,
  r = 0,
}: {
  S: number;
  Kput: number;
  putPrem: number;
  Kcall: number;
  callPrem: number;
  T: number;
  sigma: number;
  r?: number;
}) {
  const netDebit = putPrem - callPrem;
  return between(S - netDebit, Kcall - netDebit, S, sigma, T, r);
}

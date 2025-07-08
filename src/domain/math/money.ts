// Helper to safely cast to number
export function safeNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// Utility: Round to nearest penny
export function roundPenny(n: number): number {
  return Math.round(n * 100) / 100;
} 
export async function fetchStockQuote(ticker: string) {
  const res = await fetch(`/api/quote?ticker=${ticker}`);
  if (!res.ok) throw new Error('Failed to fetch quote');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchOptionsChain(ticker: string, expiration: string) {
  const res = await fetch(`/api/options?ticker=${ticker}&expiration=${expiration}`);
  if (!res.ok) throw new Error('Failed to fetch options chain');
  return res.json();
} 
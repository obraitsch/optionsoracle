import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const apiKey = process.env.POLYGON_API_KEY;
  const url = `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&limit=5&apiKey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  // Map to { symbol, name, logo }
  type TickerResult = { ticker: string; name: string; branding?: { logo_url?: string } };
  const results = (data.results || []).map((t: unknown) => {
    if (typeof t === 'object' && t !== null && 'ticker' in t && 'name' in t) {
      const tickerObj = t as TickerResult;
      return {
        symbol: tickerObj.ticker,
        name: tickerObj.name,
        logo: tickerObj.branding?.logo_url || '',
      };
    }
    return { symbol: '', name: '', logo: '' };
  });
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
} 
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
  const results = (data.results || []).map((t: any) => ({
    symbol: t.ticker,
    name: t.name,
    logo: t.branding?.logo_url || '',
  }));
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
} 
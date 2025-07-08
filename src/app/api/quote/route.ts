import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Missing ticker parameter' }, { status: 400 });
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    // Use mock data when API key is not available
    const mockQuote = {
      price: 150.00,
      change: 2.50,
      changePercent: 1.67,
      volume: 1000000,
      marketCap: 1500000000,
      pe: 15.5,
      dividend: 2.5,
      dividendYield: 1.67
    };
    return NextResponse.json(mockQuote);
  }
  
  try {
    // Fetch quote
    const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`);
    if (!quoteRes.ok) throw new Error('Failed to fetch quote');
    const quote = await quoteRes.json();
    if (!quote.c) throw new Error('Ticker not found');
    // Fetch company name
    const profileRes = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apiKey}`);
    const profile = profileRes.ok ? await profileRes.json() : {};
    return NextResponse.json({
      price: quote.c,
      change: quote.d,
      changePercent: quote.dp,
      currency: profile.currency || 'USD',
      name: profile.name || ticker,
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
} 
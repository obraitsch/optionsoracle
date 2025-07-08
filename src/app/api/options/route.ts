import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const expiration = searchParams.get('expiration');

  if (!ticker || !expiration) {
    return NextResponse.json({ error: 'Missing ticker or expiration parameter' }, { status: 400 });
  }

  const apiKey = process.env.MARKETDATA_API_KEY;

  if (!apiKey) {
    // Use mock data when API key is not available
    const mockOptions = generateMockOptions(ticker, expiration);
    return NextResponse.json(mockOptions);
  }

  try {
    // Correct MarketData.app endpoint for options chain
    const url = `https://api.marketdata.app/v1/options/chain/${ticker}/?expiration=${expiration}&token=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || 'MarketData.app error' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Map MarketData.app arrays to an array of contract objects
    const results = Array.isArray(data.optionSymbol)
      ? data.optionSymbol.map((symbol: string, i: number) => ({
          symbol,
          type: data.side?.[i],
          strike_price: data.strike?.[i],
          expiry: data.expiration?.[i],
          contract_type: data.side?.[i],
          exercise_style: 'American', // MarketData.app does not specify, so default
          shares_per_contract: 100, // Standard US options contract
          underlying_ticker: data.underlying?.[i],
          bid: data.bid?.[i],
          ask: data.ask?.[i],
          last: data.last?.[i],
          open_interest: data.openInterest?.[i],
          volume: data.volume?.[i],
          in_the_money: data.inTheMoney?.[i],
          intrinsic_value: data.intrinsicValue?.[i],
          extrinsic_value: data.extrinsicValue?.[i],
          underlying_price: data.underlyingPrice?.[i],
          iv: data.iv?.[i],
          delta: data.delta?.[i],
          gamma: data.gamma?.[i],
          theta: data.theta?.[i],
          vega: data.vega?.[i],
        }))
      : [];

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function generateMockOptions(ticker: string, expiration: string) {
  const currentPrice = 150; // Mock current price
  const mockResults = [];
  
  // Generate mock call options
  for (let i = 0; i < 5; i++) {
    const strike = currentPrice + (i * 5);
    mockResults.push({
      symbol: `${ticker}${expiration.replace(/-/g, '')}C${strike}`,
      type: 'call',
      strike_price: strike,
      expiry: expiration,
      contract_type: 'call',
      exercise_style: 'American',
      shares_per_contract: 100,
      underlying_ticker: ticker,
      bid: Math.max(0, (strike - currentPrice) + Math.random() * 2),
      ask: Math.max(0, (strike - currentPrice) + Math.random() * 2 + 0.5),
      last: Math.max(0, (strike - currentPrice) + Math.random() * 2),
      open_interest: Math.floor(Math.random() * 1000),
      volume: Math.floor(Math.random() * 500),
      in_the_money: strike < currentPrice,
      intrinsic_value: Math.max(0, currentPrice - strike),
      extrinsic_value: Math.random() * 2,
      underlying_price: currentPrice,
      iv: 25 + Math.random() * 15, // Random IV between 25-40%
      delta: Math.max(0, Math.min(1, (currentPrice - strike) / 10 + 0.5)),
      gamma: Math.random() * 0.1,
      theta: -(Math.random() * 0.5),
      vega: Math.random() * 10,
    });
  }
  
  // Generate mock put options
  for (let i = 0; i < 5; i++) {
    const strike = currentPrice - (i * 5);
    mockResults.push({
      symbol: `${ticker}${expiration.replace(/-/g, '')}P${strike}`,
      type: 'put',
      strike_price: strike,
      expiry: expiration,
      contract_type: 'put',
      exercise_style: 'American',
      shares_per_contract: 100,
      underlying_ticker: ticker,
      bid: Math.max(0, (currentPrice - strike) + Math.random() * 2),
      ask: Math.max(0, (currentPrice - strike) + Math.random() * 2 + 0.5),
      last: Math.max(0, (currentPrice - strike) + Math.random() * 2),
      open_interest: Math.floor(Math.random() * 1000),
      volume: Math.floor(Math.random() * 500),
      in_the_money: strike > currentPrice,
      intrinsic_value: Math.max(0, strike - currentPrice),
      extrinsic_value: Math.random() * 2,
      underlying_price: currentPrice,
      iv: 25 + Math.random() * 15, // Random IV between 25-40%
      delta: Math.max(-1, Math.min(0, (strike - currentPrice) / 10 - 0.5)),
      gamma: Math.random() * 0.1,
      theta: -(Math.random() * 0.5),
      vega: Math.random() * 10,
    });
  }
  
  return { results: mockResults };
} 
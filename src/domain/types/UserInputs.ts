export interface Quote {
  price: number;
  [key: string]: unknown;
}

export interface UserInputs {
  ticker: string;
  quote: Quote;
  sentiment: string;
  riskReward: number;
  targetPrice: string;
  budget: string;
  expiration: string;
} 
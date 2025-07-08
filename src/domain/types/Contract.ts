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
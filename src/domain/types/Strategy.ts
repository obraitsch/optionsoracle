import { Contract } from './Contract';

export interface StrategyResult {
  name: string;
  contracts: Contract[];
  returnOnRisk: number;
  chance: number;
  profit: number;
  risk: number;
  requiredCapital: number;
  sentimentFit: string[];
  breakEven: number;
  payoffPoints?: { price: number; profit: number }[];
}

export interface ScoredStrategy extends StrategyResult {
  roi_scaled: number;
  cop_scaled: number;
  score: number;
} 
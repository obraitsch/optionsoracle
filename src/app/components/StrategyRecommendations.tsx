'use client';
import { Box, Card, CardContent, Typography, Grid, Button, Alert, Paper, Chip, LinearProgress } from '@mui/material';
import { useContext, useEffect, useState, useMemo } from 'react';
import { UserPreferencesContext } from '../page';
import {
  // getAllStrategies,
  UserInputs,
  Contract,
  // filterLiquidContracts,
  // normalizeStrategies,
  // scoreStrategies,
  // ScoredStrategy,
  getSliderDrivenStrategies
} from '../../features/recommender/strategyEngine';
import PayoffChart from './PayoffChart';
import Tooltip from '@mui/material/Tooltip';

interface StrategyRecommendationsProps {
  optionsData: any;
  loading: boolean;
  error: string | null;
  impliedMoveData: {
    impliedMove: number | null;
    quote: any;
    atmVega: number | null;
    dte: number | null;
    targetPrice: string;
    isManualTarget: boolean;
  };
}

export default function StrategyRecommendations({ optionsData, loading, error, impliedMoveData }: StrategyRecommendationsProps) {
  const { ticker, quote, sentiment, riskReward, targetPrice, budget, expiration } = useContext(UserPreferencesContext);
  const userInputs: UserInputs = { ticker, quote, sentiment, riskReward, targetPrice, budget, expiration };
  const contracts: Contract[] = useMemo(() => optionsData?.results || [], [optionsData]);

  // --- SLIDER-DRIVEN STRATEGY UNIVERSE STATE ---
  const [universe, setUniverse] = useState<any[]>([]);

  // Calculate sigma (one-sd implied move in dollars)
  const S = quote?.price;
  const IV_ATM = impliedMoveData?.atmVega;
  const DTE = impliedMoveData?.dte;
  const sigma = S && IV_ATM && DTE ? S * IV_ATM * Math.sqrt(DTE / 365) : null;

  // Ensure all dependencies are always defined for a stable dependency array
  const safeContracts: Contract[] = contracts || [];
  const safeTicker: string = ticker || '';
  const safeQuote: any = quote || null;
  const safeSentiment: string = sentiment || '';
  const safeRiskReward: number = riskReward ?? 50;
  const safeTargetPrice: string = targetPrice || '';
  const safeBudget: string = budget || '';
  const safeExpiration: string = expiration || '';
  const safeSigma: number | null = sigma ?? null;

  // Build universe on any relevant change
  useEffect(() => {
    if (!safeContracts.length || !safeSentiment || !safeExpiration || !safeSigma) {
      setUniverse([]);
      return;
    }
    // Inline userInputs to avoid infinite loop from object identity
    const strategies = getSliderDrivenStrategies(
      { ticker: safeTicker, quote: safeQuote, sentiment: safeSentiment, riskReward: safeRiskReward, targetPrice: safeTargetPrice, budget: safeBudget, expiration: safeExpiration },
      safeSigma,
      safeContracts,
      safeRiskReward
    );
    setUniverse(strategies);
    // Dependency array must always be the same length and order for React
  }, [
    safeContracts,
    safeSentiment,
    safeExpiration,
    safeSigma,
    safeRiskReward,
    safeTargetPrice,
    safeBudget,
    safeQuote,
    safeTicker
  ]);

  // Color gradient helper (green to red)
  function getGradientColor(val: number) {
    // val: 0 (red) to 1 (green)
    const r = Math.round(244 + (76 - 244) * val); // #f44336 to #4caf50
    const g = Math.round(67 + (202 - 67) * val);
    const b = Math.round(54 + (80 - 54) * val);
    return `rgb(${r},${g},${b})`;
  }


  return (
    <Paper 
      elevation={0}
      sx={{ 
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 1.5,
        p: 2,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
    >
      <Typography 
        variant="h6" 
        sx={{ 
          fontWeight: 700, 
          mb: 1.5, 
          color: '#fff',
          textAlign: 'center',
          fontSize: { xs: '1.1rem', md: '1.3rem' }
        }}
      >
        Strategy Recommendations
      </Typography>

      {loading && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.7rem' }}>
            Analyzing options data and generating recommendations...
          </Typography>
        </Box>
      )}

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            background: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            color: '#f44336',
            fontSize: '0.65rem',
            '& .MuiAlert-icon': {
              color: '#f44336'
            }
          }}
        >
          {error}
        </Alert>
      )}

      {!loading && !error && !optionsData && (
        <Box sx={{ textAlign: 'center', py: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.65rem' }}>
            Configure your preferences and select an expiration to see strategy recommendations
          </Typography>
        </Box>
      )}

      {!loading && !error && optionsData && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Grid container spacing={1}>
            {universe.map((strategy, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    background: 'rgba(76, 175, 80, 0.1)',
                    border: '1px solid rgba(76, 175, 80, 0.2)',
                    borderRadius: 1,
                    p: 1.5,
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      background: 'rgba(76, 175, 80, 0.15)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)'
                    }
                  }}
                >
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 700, 
                      mb: 0.5, 
                      color: '#4caf50',
                      fontSize: '0.7rem'
                    }}
                  >
                    {strategy.name}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.8)', 
                      mb: 0.5,
                      fontSize: '0.6rem',
                      lineHeight: 1.3
                    }}
                  >
                    {strategy.description}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#2196f3', 
                      fontWeight: 600, 
                      fontSize: '0.62rem',
                      mb: 0.5
                    }}
                  >
                    {(() => {
                      const breakEven = strategy.breakEven;
                      const currentPrice = quote?.price;
                      if (typeof breakEven === 'number' && typeof currentPrice === 'number' && currentPrice !== 0) {
                        const percentMove = ((breakEven - currentPrice) / currentPrice) * 100;
                        const sign = percentMove >= 0 ? '+' : '';
                        return `Breakeven: $${breakEven.toFixed(2)} (${sign}${percentMove.toFixed(2)}%)`;
                      } else {
                        return 'Breakeven: --';
                      }
                    })()}
                  </Typography>
                  <PayoffChart strategy={strategy} quote={quote} targetPrice={targetPrice} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.55rem' }}>
                      Max Risk
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#f44336', fontSize: '0.6rem' }}>
                      {typeof strategy.risk === 'number' ? `$${strategy.risk.toFixed(2)}` : `$${strategy.maxRisk}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.55rem' }}>
                      Max Profit
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#4caf50', fontSize: '0.6rem' }}>
                      {typeof strategy.profit === 'number' ? `$${strategy.profit === Infinity ? '∞' : strategy.profit.toFixed(2)}` : `$${strategy.maxProfit}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.55rem' }}>
                      Probability
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.6rem' }}>
                      {typeof strategy.chance === 'number' ? `${strategy.chance.toFixed(2)}%` : `${strategy.probability}%`}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Paper>
  );
}
'use client';
import { Box, Typography, Grid, Alert, Paper } from '@mui/material';
import { useContext, useEffect, useState, useMemo } from 'react';
import { UserPreferencesContext } from '../page';
import { Contract } from '../../domain/types/Contract';
import { getStrategies } from '../../engine';
import PayoffChart from './PayoffChart';
import type { StrategyResult } from '../../domain/types/Strategy';
import type { Quote } from '../../domain/types/UserInputs';

interface StrategyRecommendationsProps {
  optionsData: { results?: Contract[] } | null;
  loading: boolean;
  error: string | null;
  impliedMoveData: {
    impliedMove: number | null;
    quote: Quote | null;
    atmVega: number | null;
    dte: number | null;
    targetPrice: string;
    isManualTarget: boolean;
  };
}

export default function StrategyRecommendations({ optionsData, loading, error, impliedMoveData }: StrategyRecommendationsProps) {
  const { ticker, quote, sentiment, riskReward, targetPrice, budget, expiration } = useContext(UserPreferencesContext);
  const contracts: Contract[] = useMemo(() => optionsData?.results || [], [optionsData]);
  const safeContracts = useMemo(() => contracts || [], [contracts]);

  // --- SLIDER-DRIVEN STRATEGY UNIVERSE STATE ---
  const [universe, setUniverse] = useState<StrategyResult[]>([]);

  // Calculate sigma (one-sd implied move in dollars)
  const S = quote?.price;
  const IV_ATM = impliedMoveData?.atmVega;
  const DTE = impliedMoveData?.dte;
  const sigma = S && IV_ATM && DTE ? S * IV_ATM * Math.sqrt(DTE / 365) : null;

  // Ensure all dependencies are always defined for a stable dependency array
  const safeTicker: string = ticker || '';
  const safeQuote: Quote | null = quote || null;
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
    const strategies = getStrategies({
      user: {
        ticker: safeTicker,
        quote: safeQuote,
        sentiment: safeSentiment,
        riskReward: safeRiskReward,
        targetPrice: safeTargetPrice,
        budget: safeBudget,
        expiration: safeExpiration
      },
      options: safeContracts,
      slider: safeRiskReward,
      sigma: safeSigma
    });
    setUniverse(strategies);
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
                  <PayoffChart 
                    strategy={strategy} 
                    quote={quote && typeof quote.price === 'number' ? quote : { price: 0 }}
                    targetPrice={typeof targetPrice === 'string' ? Number(targetPrice) : targetPrice}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.55rem' }}>
                      Max Risk
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#f44336', fontSize: '0.6rem' }}>
                      {typeof strategy.risk === 'number' ? `$${strategy.risk.toFixed(2)}` : '--'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.55rem' }}>
                      Max Profit
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#4caf50', fontSize: '0.6rem' }}>
                      {typeof strategy.profit === 'number' ? `$${strategy.profit === Infinity ? '∞' : strategy.profit.toFixed(2)}` : '--'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.55rem' }}>
                      Probability
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.6rem' }}>
                      {typeof strategy.chance === 'number' ? `${strategy.chance.toFixed(2)}%` : '--'}
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
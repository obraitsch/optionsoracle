'use client';
import React, { createContext, useState, Dispatch, SetStateAction, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import TickerAutocomplete from './components/TickerAutocomplete';
import SentimentTargetForm from './components/SentimentTargetForm';
import StrategyRecommendations from './components/StrategyRecommendations';
import { fetchOptionsChain } from '../adapters/api/polygon';
import type { Contract } from '../domain/types/Contract';

// Define the context type
interface Quote {
  price: number;
  [key: string]: unknown;
}
interface ImpliedMoveData {
  impliedMove: number | null;
  quote: Quote | null;
  atmVega: number | null;
  dte: number | null;
  targetPrice: string;
  isManualTarget: boolean;
  [key: string]: unknown;
}
interface OptionsData {
  results?: Contract[];
  [key: string]: unknown;
}
interface UserPreferencesContextType {
  ticker: string;
  setTicker: Dispatch<SetStateAction<string>>;
  quote: Quote | null;
  setQuote: Dispatch<SetStateAction<Quote | null>>;
  sentiment: string;
  setSentiment: Dispatch<SetStateAction<string>>;
  riskReward: number;
  setRiskReward: Dispatch<SetStateAction<number>>;
  targetPrice: string;
  setTargetPrice: Dispatch<SetStateAction<string>>;
  budget: string;
  setBudget: Dispatch<SetStateAction<string>>;
  expiration: string;
  setExpiration: Dispatch<SetStateAction<string>>;
}

// Define the context and its default values
export const UserPreferencesContext = createContext<UserPreferencesContextType>({
  ticker: 'AAPL',
  setTicker: () => {},
  quote: null,
  setQuote: () => {},
  sentiment: 'bullish',
  setSentiment: () => {},
  riskReward: 50,
  setRiskReward: () => {},
  targetPrice: '',
  setTargetPrice: () => {},
  budget: '',
  setBudget: () => {},
  expiration: '',
  setExpiration: () => {},
});

export default function Home() {
  const [ticker, setTicker] = useState('AAPL');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [sentiment, setSentiment] = useState('bullish');
  const [riskReward, setRiskReward] = useState(50);
  const [targetPrice, setTargetPrice] = useState('');
  const [budget, setBudget] = useState('');
  const [expiration, setExpiration] = useState('');
  const [impliedMoveData, setImpliedMoveData] = useState<ImpliedMoveData>({
    impliedMove: null,
    quote: null,
    atmVega: null,
    dte: null,
    targetPrice: '',
    isManualTarget: false
  });
  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker || !expiration) return;
    setOptionsLoading(true);
    setOptionsError(null);
    fetchOptionsChain(ticker, expiration)
      .then(data => setOptionsData(data))
      .catch(err => setOptionsError(err.message))
      .finally(() => setOptionsLoading(false));
  }, [ticker, expiration]);

  return (
    <UserPreferencesContext.Provider value={{
      ticker, setTicker,
      quote, setQuote,
      sentiment, setSentiment,
      riskReward, setRiskReward,
      targetPrice, setTargetPrice,
      budget, setBudget,
      expiration, setExpiration,
    }}>
      <Box 
        sx={{ 
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)',
          backgroundAttachment: 'fixed',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
            pointerEvents: 'none',
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <Box sx={{ pt: 5, pb: 1.5, textAlign: 'center' }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800,
                background: 'linear-gradient(45deg, #fff 30%, #e3f2fd 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
                fontSize: { xs: '1.5rem', md: '1.8rem' }
              }}
            >
              Options Oracle
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 400,
                fontSize: { xs: '0.8rem', md: '0.9rem' }
              }}
            >
              AI-Powered Options Strategy Recommendations
            </Typography>
          </Box>

          {/* Main Content */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 2}}>
            {/* Input Section */}
            <Paper 
              elevation={0}
              sx={{ 
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 1.5,
                p: 0.5, // smaller padding
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}
            >
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700, 
                  mb: 1, // less margin below
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: { xs: '1rem', md: '1.2rem' } // smaller font
                }}
              >
                Configure Your Strategy
          </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <TickerAutocomplete />
                <SentimentTargetForm onImpliedMoveData={setImpliedMoveData} />
              </Box>
            </Paper>

            {/* Recommendations Section */}
            <StrategyRecommendations
              optionsData={optionsData}
              loading={optionsLoading}
              error={optionsError}
              impliedMoveData={impliedMoveData}
            />

            {/* Summary Section */}
            <Grid container spacing={1}>
              {/* Implied Move Box */}
              <Grid item xs={12} md={4}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 1.5,
                    p: 1.5,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    height: '100%'
                  }}
                >
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 700, 
                      mb: 0.75, 
                      color: '#fff',
                      fontSize: '0.8rem'
                    }}
                  >
                    Implied Move Analysis
                  </Typography>
                  
                  {impliedMoveData.impliedMove && impliedMoveData.quote?.price ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                          Implied Move
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#2196f3', fontSize: '0.8rem' }}>
                          ${impliedMoveData.impliedMove.toFixed(2)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                          Move %
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                          {((impliedMoveData.impliedMove / impliedMoveData.quote.price) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                          Current Price
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                          ${impliedMoveData.quote.price.toFixed(2)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                          ATM IV
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                          {impliedMoveData.atmVega ? `${(impliedMoveData.atmVega * 100).toFixed(1)}%` : '--'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                          Days to Expiry
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                          {impliedMoveData.dte || '--'}
                        </Typography>
                      </Box>
                      
                      {impliedMoveData.targetPrice && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                            Target Price
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                              ${impliedMoveData.targetPrice}
                            </Typography>
                            {impliedMoveData.isManualTarget && (
                              <Chip 
                                label="Manual" 
                                size="small" 
                                sx={{ 
                                  background: 'rgba(255, 193, 7, 0.2)',
                                  color: '#ffc107',
                                  fontSize: '0.55rem',
                                  height: 16
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      )}
                      
                      {impliedMoveData.targetPrice && impliedMoveData.quote?.price && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                            Target %
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              color: Number(impliedMoveData.targetPrice) > impliedMoveData.quote.price ? '#4caf50' : Number(impliedMoveData.targetPrice) < impliedMoveData.quote.price ? '#f44336' : '#fff'
                            }}
                          >
                            {((Number(impliedMoveData.targetPrice) - impliedMoveData.quote.price) / impliedMoveData.quote.price * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.65rem' }}>
                      Configure your preferences to see implied move analysis
                    </Typography>
                  )}
                </Paper>
              </Grid>

              {/* User Preferences */}
              <Grid item xs={12} md={4}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 1.5,
                    p: 1.5,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    height: '100%'
                  }}
                >
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 700, 
                      mb: 0.75, 
                      color: '#fff',
                      fontSize: '0.8rem'
                    }}
                  >
                    Strategy Preferences
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                        Ticker
                      </Typography>
                      <Typography variant="body2" 
                      sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                        {ticker}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                        Current Price
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                        ${quote?.price?.toFixed(2) || '--'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                        Sentiment
                      </Typography>
                      <Chip 
                        label={sentiment.replace('_', ' ')} 
                        size="small" 
                        sx={{ 
                          background: 'rgba(25, 118, 210, 0.2)',
                          color: '#1976d2',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          fontSize: '0.6rem',
                          height: 18
                        }}
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                        Risk/Reward
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                        {riskReward}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                        Target Price
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                        ${targetPrice || '--'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                        Budget
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                        ${budget || '--'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                        Expiration
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                        {expiration || '--'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {/* Options Chain Data */}
              <Grid item xs={12} md={4}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 1.5,
                    p: 1.5,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    height: '100%'
                  }}
                >
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 700, 
                      mb: 0.75, 
                      color: '#fff',
                      fontSize: '0.8rem'
                    }}
                  >
                    Options Chain Data
                  </Typography>
                  
                  {optionsLoading && (
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.65rem' }}>
                      Loading options data...
                    </Typography>
                  )}
                  
                  {optionsError && (
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
                      {optionsError}
                    </Alert>
                  )}
                  
                  {optionsData && !optionsLoading && !optionsError && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {(() => {
                        const contracts = optionsData.results || [];
                        const calls = contracts.filter((c: Contract) => c.type === 'call');
                        const puts = contracts.filter((c: Contract) => c.type === 'put');
                        const strikes = contracts.map((c: Contract) => c.strike_price);
                        const minStrike = Math.min(...strikes);
                        const maxStrike = Math.max(...strikes);
                        
                        return (
                          <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                                Total Contracts
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                                {contracts.length}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                                Calls
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#4caf50', fontSize: '0.7rem' }}>
                                {calls.length}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                                Puts
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#f44336', fontSize: '0.7rem' }}>
                                {puts.length}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                                Strike Range
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                                ${minStrike.toFixed(2)} - ${maxStrike.toFixed(2)}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem' }}>
                                Sample Strike
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                                ${contracts[0]?.strike_price?.toFixed(2) || '--'}
                              </Typography>
                            </Box>
                          </>
                        );
                      })()}
                    </Box>
                  )}
                  
                  {!optionsData && !optionsLoading && !optionsError && (
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.65rem' }}>
                      Select an expiration date to load options data
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </UserPreferencesContext.Provider>
  );
}

'use client';
import { ToggleButton, ToggleButtonGroup, Typography, Box, Slider, Button, TextField, Alert, Paper, Chip } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { UserPreferencesContext } from '../page';
import { calculateImpliedMove, calculateTargetPrice } from '../../utils/greeks';
import { fetchOptionsChain } from '../../lib/api';
import dayjs from 'dayjs';

const sentiments = [
  { value: 'very_bearish', label: 'Very Bearish', icon: '⬇️', color: '#f44336' },
  { value: 'bearish', label: 'Bearish', icon: '↘️', color: '#ff9800' },
  { value: 'neutral', label: 'Neutral', icon: '➡️', color: '#9e9e9e' },
  { value: 'directional', label: 'Directional', icon: '🔀', color: '#2196f3' },
  { value: 'bullish', label: 'Bullish', icon: '↗️', color: '#4caf50' },
  { value: 'very_bullish', label: 'Very Bullish', icon: '⬆️', color: '#2e7d32' },
];

interface ExpirationDate {
  label: string;
  value: string;
  disabled: boolean;
}

interface ExpirationMonth {
  label: string;
  dates: ExpirationDate[];
}

function getExpirationOptions(): ExpirationMonth[] {
  // Generate options: current month (all Fridays), next month (2 Fridays), others (1 Friday)
  const today = dayjs();
  const months: ExpirationMonth[] = [];
  let monthCursor = today.startOf('month');
  for (let i = 0; i < 8; i++) {
    const month = monthCursor.add(i, 'month');
    const year = month.year();
    const monthNum = month.month();
    let fridays: dayjs.Dayjs[] = [];
    let d = month.startOf('month');
    while (d.month() === monthNum) {
      if (d.day() === 5) fridays.push(d);
      d = d.add(1, 'day');
    }
    if (i === 0) {
      // Current month: all Fridays
    } else if (i === 1) {
      // Next month: last 2 Fridays
      fridays = fridays.slice(-2);
    } else {
      // Others: last Friday only
      fridays = fridays.slice(-1);
    }
    months.push({
      label: month.format(i === 7 ? "MMM 'YY" : 'MMM'),
      dates: fridays.map(f => ({
        label: f.format('D'),
        value: f.format('YYYY-MM-DD'),
        disabled: false,
      })),
    });
  }
  // Add a disabled future month for visual effect
  months.push({ label: months[months.length-1].label === 'Mar' ? 'Apr' : 'Mar', dates: [{ label: '20', value: '', disabled: true }] });
  return months;
}

interface SentimentTargetFormProps {
  onImpliedMoveData?: (data: {
    impliedMove: number | null;
    quote: any;
    atmVega: number | null;
    dte: number | null;
    targetPrice: string;
    isManualTarget: boolean;
  }) => void;
}

export default function SentimentTargetForm({ onImpliedMoveData }: SentimentTargetFormProps) {
  const { 
    sentiment, setSentiment, 
    riskReward, setRiskReward, 
    targetPrice, setTargetPrice, 
    budget, setBudget, 
    expiration, setExpiration,
    quote,
    ticker
  } = useContext(UserPreferencesContext);
  
  const [expirationMonths, setExpirationMonths] = useState<ExpirationMonth[]>([]);
  const [isManualTarget, setIsManualTarget] = useState(false);
  const [impliedMove, setImpliedMove] = useState<number | null>(null);
  const [atmVega, setAtmVega] = useState<number | null>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setExpirationMonths(getExpirationOptions());
  }, []);

  // Fetch options chain data when ticker or expiration changes
  useEffect(() => {
    if (!ticker || !expiration) return;
    setLoading(true);
    fetchOptionsChain(ticker, expiration)
      .then(data => {
        setOptionsData(data);
        // Find ATM options to get implied volatility
        if (data.results && quote?.price) {
          const contracts = data.results;
          const currentPrice = quote.price;
          
          // Find ATM call and put (closest to current price)
          const atmCall = contracts
            .filter((c: any) => c.type === 'call')
            .sort((a: any, b: any) => Math.abs(a.strike_price - currentPrice) - Math.abs(b.strike_price - currentPrice))[0];
          
          const atmPut = contracts
            .filter((c: any) => c.type === 'put')
            .sort((a: any, b: any) => Math.abs(a.strike_price - currentPrice) - Math.abs(b.strike_price - currentPrice))[0];
          
          // Use the average of ATM call and put IV, or whichever is available
          let avgIV = null;
          if (atmCall?.iv && atmPut?.iv) {
            avgIV = (atmCall.iv + atmPut.iv) / 2;
          } else if (atmCall?.iv) {
            avgIV = atmCall.iv;
          } else if (atmPut?.iv) {
            avgIV = atmPut.iv;
          }
          
          setAtmVega(avgIV);
        }
      })
      .catch(err => console.error('Failed to fetch options data:', err))
      .finally(() => setLoading(false));
  }, [ticker, expiration, quote?.price]);

  // Calculate implied move when we have the necessary data
  useEffect(() => {
    if (quote?.price && atmVega && expiration) {
      const currentPrice = quote.price;
      const sigma_IV = atmVega; // IV is already in decimal format
      const DTE = dayjs(expiration).diff(dayjs(), 'day');
      
      if (DTE > 0) {
        const move = calculateImpliedMove({
          S_0: currentPrice,
          sigma_IV,
          DTE
        });
        setImpliedMove(move);
        
        // Auto-calculate target price if not manually set
        if (!isManualTarget) {
          const calculatedTarget = calculateTargetPrice({
            currentPrice,
            impliedMove: move,
            sentiment
          });
          setTargetPrice(calculatedTarget.toFixed(2));
        }
        // Pass up implied move data
        if (onImpliedMoveData) {
          onImpliedMoveData({
            impliedMove: move,
            quote,
            atmVega,
            dte: DTE,
            targetPrice,
            isManualTarget
          });
        }
      }
    } else if (onImpliedMoveData) {
      onImpliedMoveData({
        impliedMove: null,
        quote,
        atmVega,
        dte: null,
        targetPrice,
        isManualTarget
      });
    }
  }, [quote?.price, atmVega, expiration, sentiment, isManualTarget]);

  // Handle sentiment change
  const handleSentimentChange = (newSentiment: string) => {
    setSentiment(newSentiment);
    setIsManualTarget(false); // Reset to auto-calculation
    
    // Recalculate target price if we have the data
    if (quote?.price && impliedMove) {
      const calculatedTarget = calculateTargetPrice({
        currentPrice: quote.price,
        impliedMove,
        sentiment: newSentiment
      });
      setTargetPrice(calculatedTarget.toFixed(2));
    }
  };

  // Handle manual target price change
  const handleTargetPriceChange = (value: string) => {
    setTargetPrice(value);
    setIsManualTarget(true);
    
    // Auto-select sentiment based on percentage change
    if (value && quote?.price && impliedMove) {
      const targetPriceNum = Number(value);
      const currentPrice = quote.price;
      const percentageChange = ((targetPriceNum - currentPrice) / currentPrice) * 100;
      
      console.log('Manual target price entered:', {
        targetPrice: targetPriceNum,
        currentPrice,
        percentageChange,
        impliedMove,
        impliedMovePercent: (impliedMove / currentPrice) * 100
      });
      
      // Determine sentiment based on percentage change relative to implied move
      let newSentiment = sentiment; // Default to current sentiment
      
      // Convert implied move to percentage for easier comparison
      const impliedMovePercent = (impliedMove / currentPrice) * 100;
      
      if (percentageChange > impliedMovePercent * 2) {
        newSentiment = 'very_bullish';
      } else if (percentageChange > impliedMovePercent * 0.5) {
        newSentiment = 'bullish';
      } else if (percentageChange > -impliedMovePercent * 0.5) {
        newSentiment = 'neutral';
      } else if (percentageChange > -impliedMovePercent * 2) {
        newSentiment = 'bearish';
      } else {
        newSentiment = 'very_bearish';
      }
      
      console.log('Sentiment selection:', {
        percentageChange,
        impliedMovePercent,
        currentSentiment: sentiment,
        newSentiment,
        willUpdate: newSentiment !== sentiment
      });
      
      // Only update if sentiment actually changed
      if (newSentiment !== sentiment) {
        console.log('Updating sentiment from', sentiment, 'to', newSentiment);
        setSentiment(newSentiment);
      }
    }
  };

  // Calculate days to expiration
  const getDTE = () => {
    if (!expiration) return null;
    return dayjs(expiration).diff(dayjs(), 'day');
  };

  const dte = getDTE();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Sentiment Selection */}
      <Box>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: '#fff', 
            mb: 3,
            fontSize: '1.1rem'
          }}
        >
          Market Sentiment
        </Typography>
        <ToggleButtonGroup
          value={sentiment}
          exclusive
          onChange={(_, val) => val && handleSentimentChange(val)}
          color="primary"
          fullWidth
          sx={{
            '& .MuiToggleButton-root': {
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.7)',
              borderRadius: 2,
              py: 2,
              px: 1,
              fontWeight: 600,
              fontSize: '0.9rem',
              textTransform: 'none',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              },
              '&.Mui-selected': {
                background: 'rgba(25, 118, 210, 0.2)',
                border: '1px solid #1976d2',
                color: '#fff',
                '&:hover': {
                  background: 'rgba(25, 118, 210, 0.25)',
                }
              }
            }
          }}
        >
          {sentiments.map((s) => (
            <ToggleButton key={s.value} value={s.value} sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <span style={{ fontSize: 24 }}>{s.icon}</span>
                <span>{s.label}</span>
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Loading indicator */}
      {loading && (
        <Alert 
          severity="info" 
          sx={{ 
            background: 'rgba(25, 118, 210, 0.1)',
            border: '1px solid rgba(25, 118, 210, 0.3)',
            borderRadius: 2,
            color: '#fff',
            '& .MuiAlert-icon': {
              color: '#1976d2'
            }
          }}
        >
          <Typography variant="body2">
            Loading options data to calculate implied move...
          </Typography>
        </Alert>
      )}

      {/* Target Price and Budget */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: '#fff',
            fontSize: '1.1rem'
          }}
        >
          Strategy Parameters
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          alignItems: 'flex-end', 
          flexWrap: 'wrap'
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 150 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
              Target Price
            </Typography>
            <TextField
              size="medium"
              variant="outlined"
              type="number"
              value={targetPrice}
              onChange={e => handleTargetPriceChange(e.target.value)}
              placeholder="e.g. 207.80"
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 2,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  '&:hover': {
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  },
                  '&.Mui-focused': {
                    border: '1px solid #1976d2',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                  },
                  '& input': {
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: 600,
                  },
                  '& fieldset': {
                    border: 'none',
                  }
                }
              }}
              inputProps={{ min: 0 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 150 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
              Budget
            </Typography>
            <TextField
              size="medium"
              variant="outlined"
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="e.g. 1000"
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 2,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  '&:hover': {
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  },
                  '&.Mui-focused': {
                    border: '1px solid #1976d2',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                  },
                  '& input': {
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: 600,
                  },
                  '& fieldset': {
                    border: 'none',
                  }
                }
              }}
              inputProps={{ min: 0 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Risk vs Reward Slider */}
      <Box>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: '#fff', 
            mb: 2,
            fontSize: '1.1rem'
          }}
        >
          Risk vs Reward Balance
        </Typography>
        <Paper 
          elevation={0}
          sx={{ 
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            p: 3
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: '0.95rem' }}>
              Max Chance
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: '0.95rem' }}>
              Max Return
            </Typography>
          </Box>
          <Slider
            value={riskReward}
            onChange={(_, val) => typeof val === 'number' && setRiskReward(val)}
            min={0}
            max={100}
            step={10}
            marks={[
              { value: 50, label: 'Balanced' },
            ]}
            valueLabelDisplay="auto"
            sx={{ 
              color: '#1976d2',
              '& .MuiSlider-mark': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
              '& .MuiSlider-markLabel': {
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
              },
              '& .MuiSlider-valueLabel': {
                background: '#1976d2',
                fontWeight: 600,
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Chip 
              label="Conservative" 
              size="small" 
              sx={{ 
                background: 'rgba(76, 175, 80, 0.2)',
                color: '#4caf50',
                fontWeight: 600
              }}
            />
            <Chip 
              label="Aggressive" 
              size="small" 
              sx={{ 
                background: 'rgba(244, 67, 54, 0.2)',
                color: '#f44336',
                fontWeight: 600
              }}
            />
          </Box>
        </Paper>
      </Box>

      {/* Expiration Selection */}
      <Box>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: '#fff', 
            mb: 3,
            fontSize: '1.1rem'
          }}
        >
          Expiration Date
        </Typography>
        <Paper 
          elevation={0}
          sx={{ 
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            p: 3,
            overflowX: 'auto'
          }}
        >
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 2,
            minWidth: 'max-content',
            pb: 1,
          }}>
            {expirationMonths.map((month, i) => (
              <Box key={month.label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontWeight: 600, 
                    mb: 1,
                    fontSize: '0.9rem'
                  }}
                >
                  {month.label}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
                  {month.dates.map((date: ExpirationDate) => (
                    <Button
                      key={date.label}
                      variant={expiration === date.value ? 'contained' : 'outlined'}
                      color={date.disabled ? 'inherit' : 'primary'}
                      disabled={date.disabled}
                      onClick={() => !date.disabled && setExpiration(date.value)}
                      sx={{ 
                        minWidth: 36, 
                        px: 0, 
                        py: 1, 
                        fontWeight: 700, 
                        fontSize: '0.9rem', 
                        opacity: date.disabled ? 0.3 : 1, 
                        background: expiration === date.value 
                          ? 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)' 
                          : 'rgba(255, 255, 255, 0.08)',
                        color: expiration === date.value ? '#fff' : 'rgba(255, 255, 255, 0.8)', 
                        borderRadius: 2, 
                        border: expiration === date.value 
                          ? 'none' 
                          : '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: expiration === date.value 
                          ? '0 4px 12px rgba(25, 118, 210, 0.3)' 
                          : 'none',
                        '&:hover': { 
                          background: expiration === date.value 
                            ? 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)'
                            : 'rgba(255, 255, 255, 0.12)',
                          transform: 'translateY(-1px)',
                          boxShadow: expiration === date.value 
                            ? '0 6px 16px rgba(25, 118, 210, 0.4)'
                            : '0 2px 8px rgba(0, 0, 0, 0.2)',
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      {date.label}
                    </Button>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
} 
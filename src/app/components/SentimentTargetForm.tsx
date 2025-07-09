'use client';
import { ToggleButton, ToggleButtonGroup, Typography, Box, Slider, Button, TextField, Alert, Paper, Chip } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { UserPreferencesContext } from '../page';
import { calculateImpliedMove, calculateTargetPrice } from '../../domain/math/greeks';
import { fetchOptionsChain } from '../../adapters/api/polygon';
import dayjs from 'dayjs';
// Define ImpliedMoveData interface locally since it is not exported from page.tsx
interface ImpliedMoveData {
  impliedMove: number | null;
  quote: any;
  atmVega: number | null;
  dte: number | null;
  targetPrice: string;
  isManualTarget: boolean;
  [key: string]: unknown;
}

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
  const monthCursor = today.startOf('month');
  for (let i = 0; i < 8; i++) {
    const month = monthCursor.add(i, 'month');
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

interface OptionContract {
  type: string;
  strike_price: number;
  iv?: number;
  [key: string]: unknown;
}

interface SentimentTargetFormProps {
  onImpliedMoveData?: (data: ImpliedMoveData) => void;
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
        // Find ATM options to get implied volatility
        if (data.results && quote?.price) {
          const contracts = data.results;
          const currentPrice = quote.price;
          
          // Find ATM call and put (closest to current price)
          const atmCall = contracts
            .filter((c: OptionContract) => c.type === 'call')
            .sort((a: OptionContract, b: OptionContract) => Math.abs(a.strike_price - currentPrice) - Math.abs(b.strike_price - currentPrice))[0];
          
          const atmPut = contracts
            .filter((c: OptionContract) => c.type === 'put')
            .sort((a: OptionContract, b: OptionContract) => Math.abs(a.strike_price - currentPrice) - Math.abs(b.strike_price - currentPrice))[0];
          
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
  }, [quote?.price, atmVega, expiration, sentiment, isManualTarget, onImpliedMoveData, quote, setTargetPrice, targetPrice]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {/* Row: Market Sentiment | Strategy Parameters */}
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: '#fff',
          fontSize: '1.15rem',
          mt: 2.5,
          mb: 2,
          textAlign: 'center',
          width: '100%',
        }}
      >
        Market Sentiment & Strategy Parameters
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 4,
          alignItems: 'flex-start',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 900,
          mx: 'auto',
        }}
      >
        {/* Market Sentiment (left) */}
        <Box sx={{ width: 420, minWidth: 0, maxWidth: 420 }}>
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
                py: 0.5, // reduced vertical padding
                px: 0.5, // reduced horizontal padding
                fontWeight: 600,
                fontSize: '0.8rem', // smaller font
                textTransform: 'none',
                minHeight: 32, // smaller min height
                minWidth: 36, // smaller min width
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
              <ToggleButton key={s.value} value={s.value} sx={{ flex: 1, minWidth: 0, px: 0.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span> {/* smaller icon */}
                  <span style={{ fontSize: '0.8rem' }}>{s.label}</span> {/* smaller label */}
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Strategy Parameters (right) */}
        <Box sx={{ width: 420, minWidth: 0, maxWidth: 420 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 120 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, fontSize: '0.8rem', mb: 0.5 }}>
                Target Price
              </Typography>
              <TextField
                size="small"
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
                    height: 32, // compact height
                    fontSize: '0.8rem', // smaller font
                    '&:hover': {
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    },
                    '&.Mui-focused': {
                      border: '1px solid #1976d2',
                      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                    },
                    '& input': {
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '6px 8px', // compact padding
                    },
                    '& fieldset': {
                      border: 'none',
                    }
                  }
                }}
                inputProps={{ min: 0 }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 120 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, fontSize: '0.8rem', mb: 0.5 }}>
                Budget
              </Typography>
              <TextField
                size="small"
                variant="outlined"
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="e.g. 500"
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 2,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    height: 32, // compact height
                    fontSize: '0.8rem', // smaller font
                    '&:hover': {
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    },
                    '&.Mui-focused': {
                      border: '1px solid #1976d2',
                      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                    },
                    '& input': {
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '6px 8px', // compact padding
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

      {/* Expiration Selection */}
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 0.5 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: '#fff', 
            mb: 2,
            fontSize: '1.05rem',
            textAlign: 'center'
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
            p: 2,
            overflowX: 'auto',
            minWidth: 0,
            maxWidth: 600,
            mx: 'auto',
            boxShadow: 'none',
          }}
        >
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 1.5,
            minWidth: 0,
            pb: 1,
          }}>
            {expirationMonths.map((month) => (
              <Box key={month.label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontWeight: 600, 
                    mb: 0.5,
                    fontSize: '0.8rem'
                  }}
                >
                  {month.label}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.25 }}>
                  {month.dates.map((date: ExpirationDate) => (
                    <Button
                      key={date.label}
                      variant={expiration === date.value ? 'contained' : 'outlined'}
                      color={date.disabled ? 'inherit' : 'primary'}
                      disabled={date.disabled}
                      onClick={() => !date.disabled && setExpiration(date.value)}
                      sx={{ 
                        minWidth: 28,
                        px: 0.5,
                        py: 0.5,
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        opacity: date.disabled ? 0.3 : 1,
                        background: expiration === date.value
                          ? 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: expiration === date.value ? '#fff' : 'rgba(255, 255, 255, 0.8)',
                        borderRadius: 2,
                        border: expiration === date.value
                          ? 'none'
                          : '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: 'none',
                        '&:hover': {
                          background: expiration === date.value
                            ? 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)'
                            : 'rgba(255, 255, 255, 0.12)',
                          transform: 'translateY(-1px)',
                        },
                        transition: 'all 0.2s ease-in-out',
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

      {/* Risk vs Reward Slider */}
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600, 
            color: '#fff', 
            mb: 2,
            fontSize: '1.05rem',
            textAlign: 'center'
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
            p: 1,
            minWidth: 0,
            width: '100%',
            maxWidth: 920,
            mx: 'auto',
            boxShadow: 'none',
            px: 1,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              Max Chance
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
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
              { value: 0 }, { value: 10 }, { value: 20 }, 
              { value: 30 }, { value: 40 }, { value: 50, label: 'Balanced' }, 
              { value: 60 }, { value: 70 }, { value: 80}, 
              { value: 90 }, { value: 100 }
            ]}
            valueLabelDisplay="auto"
            sx={{ 
              color: '#1976d2',
              '& .MuiSlider-mark': {
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                width: 6,
                height: 12,
                borderRadius: 2,
                marginLeft: '-3px',
                marginTop: '0px',
              },
              '& .MuiSlider-markLabel': {
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: 700,
                fontSize: '1rem',
                marginTop: '8px',
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
    </Box>
  );
} 
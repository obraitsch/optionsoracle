"use client";

import { Box, TextField, Typography, CircularProgress, Paper, Chip } from '@mui/material';
import { useState, useEffect, useContext } from 'react';
import { fetchStockQuote } from '../../lib/api';
import { UserPreferencesContext } from '../page';

export default function TickerAutocomplete() {
  const { ticker, setTicker, quote, setQuote } = useContext(UserPreferencesContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ticker || !mounted) return;
    setLoading(true);
    setError(null);
    fetchStockQuote(ticker)
      .then(setQuote)
      .catch(() => {
        setQuote(null);
        setError('Not found');
      })
      .finally(() => setLoading(false));
  }, [ticker, mounted, setQuote]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
          Select Stock
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <TextField
            size="medium"
            variant="outlined"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
            sx={{ 
              width: { xs: '100%', sm: 200 },
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
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textAlign: 'center',
                },
                '& fieldset': {
                  border: 'none',
                }
              }
            }}
            inputProps={{ 
              maxLength: 8,
              style: { 
                textAlign: 'center',
                letterSpacing: '0.1em'
              } 
            }}
          />
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            flex: 1,
            minHeight: 56
          }}>
            {mounted && (
              <>
                {loading && (
                  <CircularProgress 
                    size={24} 
                    sx={{ 
                      color: '#1976d2',
                      mr: 2
                    }} 
                  />
                )}
                {error && (
                  <Chip 
                    label={error} 
                    color="error" 
                    variant="outlined"
                    sx={{ 
                      borderColor: '#f44336',
                      color: '#f44336',
                      fontWeight: 500
                    }}
                  />
                )}
                {quote && !loading && !error && (
                  <Paper 
                    elevation={0}
                    sx={{ 
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: 3,
                      p: 2,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      flexWrap: 'wrap'
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 700, 
                          color: '#fff',
                          fontSize: '1.2rem'
                        }}
                      >
                        {quote.name}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontWeight: 500
                        }}
                      >
                        {quote.currency}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          fontWeight: 800, 
                          color: '#fff',
                          fontSize: '2rem'
                        }}
                      >
                        ${quote.price?.toFixed(2)}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="h6"
                        component="span"
                        sx={{
                          fontWeight: 700,
                          color: quote.change > 0 ? '#4caf50' : quote.change < 0 ? '#f44336' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: '1.1rem',
                        }}
                      >
                        {quote.change > 0 ? '+' : ''}{quote.change?.toFixed(2)}
                      </Typography>
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{
                          fontWeight: 600,
                          color: quote.change > 0 ? '#4caf50' : quote.change < 0 ? '#f44336' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: '0.9rem',
                        }}
                      >
                        ({quote.changePercent > 0 ? '+' : ''}{quote.changePercent?.toFixed(2)}%)
                      </Typography>
                    </Box>
                  </Paper>
                )}
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
} 
'use client';
import { Box, TextField, Typography } from '@mui/material';
import { useContext } from 'react';
import { UserPreferencesContext } from '../page';

export default function TargetPriceBudgetForm() {
  const { targetPrice, setTargetPrice, budget, setBudget } = useContext(UserPreferencesContext);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="subtitle1">Target Price:</Typography>
        <TextField
          size="small"
          variant="outlined"
          type="number"
          value={targetPrice}
          onChange={e => setTargetPrice(e.target.value)}
          placeholder="e.g. 207.80"
          sx={{ width: 120 }}
          inputProps={{ min: 0, style: { color: '#fff', background: '#22223a' } }}
          InputLabelProps={{ style: { color: '#aaa' } }}
        />
        <Typography variant="subtitle1">Budget:</Typography>
        <TextField
          size="small"
          variant="outlined"
          type="number"
          value={budget}
          onChange={e => setBudget(e.target.value)}
          placeholder="e.g. 1000"
          sx={{ width: 120 }}
          inputProps={{ min: 0, style: { color: '#fff', background: '#22223a' } }}
          InputLabelProps={{ style: { color: '#aaa' } }}
        />
      </Box>
    </Box>
  );
} 
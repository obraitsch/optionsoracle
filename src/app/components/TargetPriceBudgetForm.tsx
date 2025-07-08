'use client';
import { Box, TextField, Typography, Button } from '@mui/material';
import { useContext } from 'react';
import { UserPreferencesContext } from '../page';

const expirationOptions = [
  { label: 'Jun', value: '2024-06-27' },
  { label: 'Jul', value: '2024-07-03' },
  { label: 'Jul', value: '2024-07-11' },
  { label: 'Jul', value: '2024-07-18' },
  { label: 'Jul', value: '2024-07-25' },
  { label: 'Aug', value: '2024-08-01' },
  { label: 'Aug', value: '2024-08-15' },
  { label: 'Sep', value: '2024-09-19' },
  { label: 'Oct', value: '2024-10-17' },
  { label: 'Nov', value: '2024-11-21' },
  { label: 'Dec', value: '2024-12-19' },
  { label: "Jan '26", value: '2026-01-16' },
  { label: 'Feb', value: '2026-02-20' },
  { label: 'Mar', value: '2026-03-20', disabled: true },
];

export default function TargetPriceBudgetForm() {
  const { targetPrice, setTargetPrice, budget, setBudget, expiration, setExpiration } = useContext(UserPreferencesContext);
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
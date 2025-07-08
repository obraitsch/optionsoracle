'use client';
import { ToggleButton, ToggleButtonGroup, Typography, Box, Slider, Button } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { UserPreferencesContext } from '../page';
import dayjs from 'dayjs';

const sentiments = [
  { value: 'very_bearish', label: 'Very Bearish', icon: '⬇️' },
  { value: 'bearish', label: 'Bearish', icon: '↘️' },
  { value: 'neutral', label: 'Neutral', icon: '➡️' },
  { value: 'directional', label: 'Directional', icon: '🔀' },
  { value: 'bullish', label: 'Bullish', icon: '↗️' },
  { value: 'very_bullish', label: 'Very Bullish', icon: '⬆️' },
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

export default function SentimentSelector() {
  const { sentiment, setSentiment, riskReward, setRiskReward, expiration, setExpiration } = useContext(UserPreferencesContext);
  const [expirationMonths, setExpirationMonths] = useState<ExpirationMonth[]>([]);

  useEffect(() => {
    setExpirationMonths(getExpirationOptions());
  }, []);

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Select your market sentiment:
      </Typography>
      <ToggleButtonGroup
        value={sentiment}
        exclusive
        onChange={(_, val) => val && setSentiment(val)}
        color="primary"
        fullWidth
      >
        {sentiments.map((s) => (
          <ToggleButton key={s.value} value={s.value} sx={{ flex: 1 }}>
            <span style={{ fontSize: 20, marginRight: 8 }}>{s.icon}</span>
            {s.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle2" gutterBottom>
          Risk vs Reward:
        </Typography>
        <Slider
          value={riskReward}
          onChange={(_, val) => typeof val === 'number' && setRiskReward(val)}
          min={0}
          max={100}
          step={1}
          marks={[{ value: 0, label: 'Max Chance' }, { value: 100, label: 'Max Return' }]}
          valueLabelDisplay="auto"
          sx={{ color: '#1976d2' }}
        />
      </Box>
      <Box sx={{
        mt: 4,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 1,
        overflowX: 'auto',
        pb: 1,
        px: 2,
        width: '100%',
        maxWidth: '100vw',
        scrollbarWidth: 'thin',
      }}>
        {expirationMonths.map((month) => (
          <Box key={month.label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
            <Button variant="text" disabled sx={{ color: '#ccc', fontWeight: 600, fontSize: 16, mb: 0.5, minWidth: 0, px: 1 }}>{month.label}</Button>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
              {month.dates.map((date: ExpirationDate) => (
                <Button
                  key={date.label}
                  variant={expiration === date.value ? 'contained' : 'outlined'}
                  color={date.disabled ? 'inherit' : 'primary'}
                  disabled={date.disabled}
                  onClick={() => !date.disabled && setExpiration(date.value)}
                  sx={{ minWidth: 32, px: 0, py: 0.5, fontWeight: 600, fontSize: 16, opacity: date.disabled ? 0.4 : 1, bgcolor: expiration === date.value ? '#1e88e5' : '#23234a', color: expiration === date.value ? '#fff' : '#ccc', borderRadius: 2, border: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#1976d2' } }}
                >
                  {date.label}
                </Button>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
} 
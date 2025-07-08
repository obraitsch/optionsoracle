import { Alert, Typography } from '@mui/material';
import React from 'react';

interface ImpliedMoveBoxProps {
  impliedMove: number | null;
  quote: any;
  atmVega: number | null;
  dte: number | null;
  targetPrice: string;
  isManualTarget: boolean;
}

const ImpliedMoveBox: React.FC<ImpliedMoveBoxProps> = ({
  impliedMove,
  quote,
  atmVega,
  dte,
  targetPrice,
  isManualTarget,
}) => {
  if (!impliedMove || !quote?.price) return null;
  return (
    <Alert severity="info" sx={{ bgcolor: '#23234a', color: '#fff', border: '1px solid #1976d2', flex: 1 }}>
      <Typography variant="body2">
        <strong>Implied Move:</strong> ${impliedMove.toFixed(2)} ({((impliedMove / quote.price) * 100).toFixed(1)}%)<br />
        <strong>Current Price:</strong> ${quote.price.toFixed(2)}<br />
        <strong>ATM Implied Volatility:</strong> {atmVega ? `${(atmVega * 100).toFixed(1)}%` : '--'}<br />
        <strong>Days to Expiration:</strong> {dte}<br />
        <strong>Target Price:</strong> ${targetPrice} {isManualTarget && '(Manual)'}
        {targetPrice && quote?.price && (
          <span style={{
            color: Number(targetPrice) > quote.price ? '#4caf50' : Number(targetPrice) < quote.price ? '#f44336' : '#fff',
            fontWeight: 'bold',
          }}>
            {' '}({((Number(targetPrice) - quote.price) / quote.price * 100).toFixed(1)}%)
          </span>
        )}
      </Typography>
    </Alert>
  );
};

export default ImpliedMoveBox; 
import React from 'react';
import { Box } from '@mui/material';
import ImpliedMoveBox from './ImpliedMoveBox';

interface Quote {
  price: number;
  [key: string]: unknown;
}

interface OptionContract {
  type: string;
  strike_price: number;
  [key: string]: unknown;
}

interface UserOptionsSummaryRowProps {
  ticker: string;
  quote: Quote;
  sentiment: string;
  riskReward: number;
  targetPrice: string;
  budget: string;
  expiration: string;
  loading?: boolean;
  error?: string | null;
  optionsData?: { results?: OptionContract[] };
  impliedMove?: number | null;
  impliedMoveQuote?: Quote;
  atmVega?: number | null;
  dte?: number | null;
  impliedMoveTargetPrice?: string;
  isManualTarget?: boolean;
}

const UserOptionsSummaryRow: React.FC<UserOptionsSummaryRowProps> = ({
  ticker,
  quote,
  sentiment,
  riskReward,
  targetPrice,
  budget,
  expiration,
  loading,
  error,
  optionsData,
  impliedMove,
  impliedMoveQuote,
  atmVega,
  dte,
  impliedMoveTargetPrice,
  isManualTarget,
}) => {
  const contracts: OptionContract[] = optionsData?.results || [];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, mb: 3 }}>
      {/* Implied Move Box */}
      <ImpliedMoveBox
        impliedMove={impliedMove}
        quote={impliedMoveQuote}
        atmVega={atmVega}
        dte={dte}
        targetPrice={impliedMoveTargetPrice || ''}
        isManualTarget={!!isManualTarget}
      />
      {/* User Preferences */}
      <Box sx={{ flex: 1, p: 2, bgcolor: '#23234a', borderRadius: 2, color: '#fff', minWidth: 0 }}>
        <strong>User Preferences:</strong><br />
        Ticker: {ticker}<br />
        Price: {quote?.price?.toFixed(2) || '--'}<br />
        Sentiment: {sentiment}<br />
        Risk/Reward: {riskReward}<br />
        Target Price: {targetPrice}<br />
        Budget: {budget}<br />
        Expiration: {expiration || '--'}
      </Box>
      {/* Options Chain Data */}
      <Box sx={{ flex: 1, p: 2, bgcolor: '#181836', borderRadius: 2, color: '#fff', minWidth: 0 }}>
        <strong>Options Chain Data:</strong><br />
        {loading && 'Loading options data...'}
        {error && <span style={{ color: '#f44336' }}>{error}</span>}
        {optionsData && !loading && !error && (
          <>
            <div>Contracts: {contracts.length || 0}</div>
            <div>Calls: {contracts.filter((c: OptionContract) => c.type === 'call').length}</div>
            <div>Puts: {contracts.filter((c: OptionContract) => c.type === 'put').length}</div>
            <div>Sample Strike: {contracts[0]?.strike_price || '--'}</div>
            <div>Price Range: ${Math.min(...contracts.map((c: OptionContract) => c.strike_price)).toFixed(2)} - ${Math.max(...contracts.map((c: OptionContract) => c.strike_price)).toFixed(2)}</div>
          </>
        )}
      </Box>
    </Box>
  );
};

export default UserOptionsSummaryRow; 
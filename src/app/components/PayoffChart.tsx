'use client';
import React from 'react';
import { Box } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler);

interface PayoffPoint {
  price: number;
  profit: number;
}

interface PayoffChartProps {
  strategy: {
    payoffPoints?: PayoffPoint[];
    breakEven?: number;
    requiredCapital?: number;
  };
  quote: { price: number };
  targetPrice?: number;
}

export default function PayoffChart({ strategy, quote, targetPrice }: PayoffChartProps) {
  // Placeholder data if not present
  const payoffPoints: PayoffPoint[] = strategy?.payoffPoints || [
    { price: 170, profit: 0 },
    { price: 200, profit: 0 },
    { price: 206.86, profit: 0 },
    { price: 210, profit: 200 },
    { price: 215, profit: 350 },
  ];
  const breakEven = strategy?.breakEven ?? 206.86;
  const currentPrice = quote?.price ?? 202;
  const minPrice = Math.min(...payoffPoints.map((p: PayoffPoint) => p.price));
  const maxPrice = Math.max(...payoffPoints.map((p: PayoffPoint) => p.price));
  const minProfit = Math.min(...payoffPoints.map((p: PayoffPoint) => p.profit));
  const maxProfit = Math.max(...payoffPoints.map((p: PayoffPoint) => p.profit));
  // Y axis min: clamp for readability
  const requiredCapital = strategy?.requiredCapital ?? 0;
  const clampMin = Math.max(-5000, -2 * Math.abs(requiredCapital || 2500));
  const yMin = Math.max(minProfit, clampMin);

  // Improved x-axis: include all relevant points with margin, but do not force current price to center
  const xRelevant = [minPrice, maxPrice, breakEven, currentPrice];
  if (targetPrice) xRelevant.push(targetPrice);
  const xMinRaw = Math.min(...xRelevant);
  const xMaxRaw = Math.max(...xRelevant);
  const xRange = xMaxRaw - xMinRaw;
  const xMargin = xRange * 0.1 + 1; // 10% or at least $1
  const xMin = xMinRaw - xMargin;
  const xMax = xMaxRaw + xMargin;

  // Helper to get profit at a given price (linear interpolation)
  function getProfitAt(price: number): number {
    if (!payoffPoints.length) return 0;
    for (let i = 1; i < payoffPoints.length; i++) {
      const p0 = payoffPoints[i - 1];
      const p1 = payoffPoints[i];
      if ((p0.price <= price && price <= p1.price) || (p1.price <= price && price <= p0.price)) {
        // Linear interpolation
        const t = (price - p0.price) / (p1.price - p0.price);
        return p0.profit + t * (p1.profit - p0.profit);
      }
    }
    // If out of bounds, clamp to nearest
    if (price < payoffPoints[0].price) return payoffPoints[0].profit;
    if (price > payoffPoints[payoffPoints.length - 1].price) return payoffPoints[payoffPoints.length - 1].profit;
    return 0;
  }

  const profitAtBreakEven = getProfitAt(breakEven);
  const profitAtCurrent = getProfitAt(currentPrice);
  const profitAtTarget = targetPrice ? getProfitAt(targetPrice) : 0;
  const yMaxRaw = Math.max(maxProfit, profitAtBreakEven, profitAtCurrent, profitAtTarget);
  const yMax = yMaxRaw + Math.abs(yMaxRaw) * 0.1 + 10; // 10% margin + $10 buffer

  // Convert all data to {x, y} for linear x axis
  const payoffData = payoffPoints.map((p: PayoffPoint) => ({ x: Number(p.price.toFixed(2)), y: Number(p.profit.toFixed(2)) }));

  const data = {
    datasets: [
      {
        label: 'Payoff',
        data: payoffData,
        fill: 'origin',
        borderColor: '#4caf50',
        pointRadius: 0,
        tension: 0.1,
        segment: {
          backgroundColor: (ctx: { p0: { parsed: { y: number } } }) => ctx.p0.parsed.y < 0 ? 'rgba(244,67,54,0.3)' : 'rgba(76,175,80,0.3)',
          borderColor: (ctx: { p0: { parsed: { y: number } } }) => ctx.p0.parsed.y < 0 ? '#f44336' : '#4caf50',
        },
      },
      // Break-even vertical line
      {
        label: 'Break Even',
        data: [
          { x: Number(breakEven.toFixed(2)), y: Number(minProfit.toFixed(2)) },
          { x: Number(breakEven.toFixed(2)), y: Number(maxProfit.toFixed(2)) },
        ],
        borderColor: '#2196f3',
        borderWidth: 2,
        pointRadius: 0,
        type: 'line' as const,
        fill: false,
        order: 1,
        showLine: true,
      },
      // Current price line
      {
        label: 'Current Price',
        data: [
          { x: Number(currentPrice.toFixed(2)), y: Number(minProfit.toFixed(2)) },
          { x: Number(currentPrice.toFixed(2)), y: Number(maxProfit.toFixed(2)) },
        ],
        borderColor: '#fff',
        borderWidth: 2,
        pointRadius: 0,
        type: 'line' as const,
        fill: false,
        order: 2,
        borderDash: [6, 4],
        showLine: true,
      },
      // Target price line
      {
        label: 'Target Price',
        data: [
          { x: Number(targetPrice?.toFixed?.(2) ?? targetPrice), y: Number(minProfit.toFixed(2)) },
          { x: Number(targetPrice?.toFixed?.(2) ?? targetPrice), y: Number(maxProfit.toFixed(2)) },
        ],
        borderColor: '#ff9800',
        borderWidth: 2,
        pointRadius: 0,
        type: 'line' as const,
        fill: false,
        order: 3,
        showLine: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: 'Stock Price' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#fff' },
        min: xMin,
        max: xMax,
      },
      y: {
        title: { display: true, text: 'Return ($)' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#fff' },
        min: yMin,
        max: yMax,
      },
    },
  };

  return (
    <Box sx={{ width: '100%', height: 260 }}>
      <Line data={data} options={options} />
    </Box>
  );
} 
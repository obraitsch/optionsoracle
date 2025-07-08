/*
 * PayoffChart.tsx – polished payoff graph with annotation plugin
 * -------------------------------------------------------------
 * - Gradient fill (green for gains, red for losses)
 * - Vertical markers for break-even, current price, and target
 * - Works with Chart.js v4 + chartjs-plugin-annotation v2
 * - Strict TypeScript typings (no `// @ts-ignore` needed)
 *
 *  → Install deps:
 *      npm i chart.js@^4 react-chartjs-2@^6 chartjs-plugin-annotation@^2
 */

'use client';

// Augment Chart.js types before importing anything else
/// <reference types="chartjs-plugin-annotation" />

import React, { useMemo, useRef } from 'react';
import { Box, useTheme } from '@mui/material';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js';
import annotationPlugin, {
  AnnotationOptions,
  AnnotationPluginOptions,
} from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

/* ------------------------------------------------------------------ */
/* ------------------------  Types  --------------------------------- */
/* ------------------------------------------------------------------ */
interface PayoffPoint { price: number; profit: number }
interface Strategy {
  payoffPoints?: PayoffPoint[];
  breakEven?: number;
  requiredCapital?: number;
}
interface Quote { price: number }
interface PayoffChartProps {
  strategy: Strategy;
  quote: Quote;
  targetPrice?: number;
  height?: number; // default 300
}

/* ------------------------------------------------------------------ */
/* ------------------------  Component  ------------------------------ */
/* ------------------------------------------------------------------ */
export default function PayoffChart({
  strategy,
  quote,
  targetPrice,
  height = 300,
}: PayoffChartProps) {
  const theme            = useTheme();
  const payoffPoints     = strategy.payoffPoints?.length
    ? [...strategy.payoffPoints].sort((a, b) => a.price - b.price)
    : [
        { price: 170, profit: 0 },
        { price: 200, profit: 0 },
        { price: 206.86, profit: 0 },
        { price: 210, profit: 200 },
        { price: 215, profit: 350 },
      ];
  const breakEven        = strategy.breakEven ?? 206.86;
  const currentPrice     = quote.price ?? 202;
  const requiredCapital  = strategy.requiredCapital ?? 0;

  /* Domain ----------------------------------------------------------------- */
  const xs               = payoffPoints.map(p => p.price);
  const ys               = payoffPoints.map(p => p.profit);
  const xMinRaw          = Math.min(...xs, breakEven, currentPrice, targetPrice ?? xs[0]);
  const xMaxRaw          = Math.max(...xs, breakEven, currentPrice, targetPrice ?? xs[xs.length-1]);
  const xPad             = (xMaxRaw - xMinRaw) * 0.08 + 1;
  const domainX          = { min: xMinRaw - xPad, max: xMaxRaw + xPad };

  const yMinRaw          = Math.min(...ys, -2 * Math.abs(requiredCapital || 2500));
  const yMaxRaw          = Math.max(...ys);
  const domainY          = { min: yMinRaw, max: yMaxRaw + Math.abs(yMaxRaw) * 0.1 + 10 };

  /* Helpers ---------------------------------------------------------------- */
  const fmt = (n: number) => n.toLocaleString(undefined, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  /* Gradient Fill ---------------------------------------------------------- */
  const chartRef = useRef<any>(null);
  const gradient = useMemo(() => {
    const ctx = chartRef.current?.ctx;
    if (!ctx) return undefined;
    const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    grad.addColorStop(0,   theme.palette.success.light + 'B3'); // 70 %
    grad.addColorStop(0.5, theme.palette.success.light + '55'); // 33 %
    grad.addColorStop(0.5, theme.palette.error.light   + '55');
    grad.addColorStop(1,   theme.palette.error.light   + 'B3');
    return grad;
  }, [theme]);

  /* Dataset ---------------------------------------------------------------- */
  const data: ChartData<'line'> = {
    labels: xs,
    datasets: [
      {
        label: 'Payoff',
        data: payoffPoints.map(p => ({ x: p.price, y: p.profit })),
        borderColor: theme.palette.success.main,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.15,
        fill: {
          target: 'origin',
          above: gradient ?? theme.palette.success.light,
          below: gradient ?? theme.palette.error.light,
        },
        segment: {
          borderColor: ctx => ctx.p0.parsed.y < 0 ? theme.palette.error.main : theme.palette.success.main,
        },
      },
    ],
  };

  /* Options ---------------------------------------------------------------- */
  const options: ChartOptions<'line'> & { plugins: { annotation: AnnotationPluginOptions } } = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      tooltip: {
        callbacks: {
          label: ctx => `${fmt(ctx.parsed.y)} at $${ctx.parsed.x.toFixed(2)}`,
        },
      },
      legend: { display: false },
      annotation: {
        annotations: {
          breakEven: {
            type: 'line',
            xMin: breakEven,
            xMax: breakEven,
            borderColor: theme.palette.info.main,
            borderWidth: 2,
            label: {
              content: 'Break-even',
              enabled: true,
              position: 'start',
              backgroundColor: theme.palette.info.main,
              color: theme.palette.common.white,
            },
          } as AnnotationOptions,
          current: {
            type: 'line',
            xMin: currentPrice,
            xMax: currentPrice,
            borderColor: theme.palette.text.primary,
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
              content: 'Now',
              enabled: true,
              position: 'start',
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
            },
          } as AnnotationOptions,
          ...(targetPrice ? {
            target: {
              type: 'line',
              xMin: targetPrice,
              xMax: targetPrice,
              borderColor: theme.palette.warning.main,
              borderWidth: 2,
              label: {
                content: 'Target',
                enabled: true,
                position: 'start',
                backgroundColor: theme.palette.warning.main,
                color: theme.palette.common.white,
              },
            } as AnnotationOptions,
          } : {}),
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: domainX.min,
        max: domainX.max,
        title: { display: true, text: 'Underlying Price ($)' },
        grid: { color: theme.palette.divider },
        ticks: { color: theme.palette.text.secondary },
      },
      y: {
        min: domainY.min,
        max: domainY.max,
        title: { display: true, text: 'P/L (USD)' },
        grid: { color: theme.palette.divider },
        ticks: { color: theme.palette.text.secondary, callback: v => fmt(Number(v)) },
      },
    },
  };

  return (
    <Box sx={{ width: '100%', height }}>
      <Line ref={chartRef} data={data} options={options} />
    </Box>
  );
}
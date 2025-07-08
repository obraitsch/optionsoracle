"use client";
import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import TickerAutocomplete from '../../app/components/TickerAutocomplete';

const schema = z.object({
  ticker: z.string().min(1, 'Ticker required'),
  budget: z.number().min(1, 'Budget required'),
  safety: z.number().min(0).max(1),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onSubmit: (values: FormValues) => void;
}

export function TickerBudgetForm({ onSubmit }: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ticker: '', budget: 1000, safety: 0.5 },
  });

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 max-w-xl mx-auto"
      >
        <div>
          <label className="block mb-1 font-medium">Ticker</label>
          <TickerAutocomplete />
        </div>
        <div>
          <label className="block mb-1 font-medium">Budget (USD)</label>
          <input
            type="number"
            step="1"
            min="1"
            {...methods.register('budget', { valueAsNumber: true })}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Safety ←→ Moonshot</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            {...methods.register('safety', { valueAsNumber: true })}
            className="w-full"
          />
          <div className="flex justify-between text-xs mt-1">
            <span>Safety</span>
            <span>Moonshot</span>
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Find Best Contract
        </button>
      </form>
    </FormProvider>
  );
} 
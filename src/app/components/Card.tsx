import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="rounded-lg shadow bg-white dark:bg-neutral-900 p-4 mb-4">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      {children}
    </div>
  );
} 
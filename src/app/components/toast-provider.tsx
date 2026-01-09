import React from 'react';
import { Toaster } from './ui/sonner';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(21, 27, 46, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            color: 'rgba(255, 255, 255, 1)',
          },
        }}
      />
    </>
  );
}

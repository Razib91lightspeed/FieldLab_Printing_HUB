import React, { createContext, useContext } from 'react';
import { PrinterData } from '../types';

interface PrinterContextType {
  printers: PrinterData[];
  refreshPrinters: () => void;
}

export const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export const usePrinterContext = () => {
  const context = useContext(PrinterContext);
  if (!context) throw new Error('usePrinterContext must be used within PrinterProvider');
  return context;
};

// Placeholder provider - implement if needed
export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

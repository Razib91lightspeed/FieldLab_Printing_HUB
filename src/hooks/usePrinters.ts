import { useState, useEffect } from 'react';
import { PrinterData } from '../types';
import { INITIAL_PRINTERS } from '../data/mockPrinters';

export const usePrinters = () => {
  const [printers, setPrinters] = useState<PrinterData[]>(INITIAL_PRINTERS);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrinters(current => 
        current.map(p => {
          if (p.status === 'printing') {
            return { 
              ...p, 
              progress: Math.min(p.progress + 0.5, 99),
              nozzleTemp: p.nozzleTemp + (Math.random() - 0.5)
            };
          }
          return p;
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return { printers, setPrinters };
};

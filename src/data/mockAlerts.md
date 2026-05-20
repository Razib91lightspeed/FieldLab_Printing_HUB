import { AlertItem } from '../types';

export const MOCK_ALERTS: AlertItem[] = [
  { id: 'a1', timestamp: '10:42 AM', printerId: 'p3', printerName: 'Lab-Printer-B1', severity: 'critical', message: 'Thermal Runaway Detected', status: 'active' },
  { id: 'a2', timestamp: '09:15 AM', printerId: 'p5', printerName: 'Lab-Printer-C1', severity: 'warning', message: 'Filament Runout', status: 'resolved' },
  { id: 'a3', timestamp: 'Yesterday', printerId: 'p2', printerName: 'Lab-Printer-A2', severity: 'info', message: 'Firmware Update Available', status: 'pending' },
];

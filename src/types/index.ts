export type PrinterStatus = 'printing' | 'idle' | 'error' | 'finished';

export type ViewType = 'fleet' | 'detail' | 'alerts' | 'visualization';

export interface PrinterData {
  id: string;
  name: string;
  status: PrinterStatus;
  jobName: string;
  progress: number;
  timeRemaining: string;
  elapsedTime: string;
  nozzleTemp: number;
  nozzleTarget: number;
  bedTemp: number;
  bedTarget: number;
  material: string;
  color: string;
  alerts: number;
}

export interface AlertItem {
  id: string;
  timestamp: string;
  printerId: string;
  printerName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  status: 'active' | 'resolved' | 'pending';
}

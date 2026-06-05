export type PrinterStatus = 'printing' | 'idle' | 'error' | 'finished';
export type ViewType = 'fleet' | 'detail' | 'alerts' | 'visualization' | 'booking' | 'settings';
export type BookingStatus = 'with-booking' | 'without-booking' | 'idle';

export type PrinterStatusReason =
  | 'printing'
  | 'paused'
  | 'failed'
  | 'stopped'
  | 'finished'
  | 'idle'
  | 'telemetry'
  | 'access-code'
  | 'unknown';
export interface PrinterData {
  id: string;
  name: string;
  ip: string;

  status: PrinterStatus;
  progress: number;

  jobName: string;
  timeRemaining: string;
  elapsedTime: string;

  nozzleTemp: number;
  nozzleTarget: number;

  bedTemp: number;
  bedTarget: number;

  material: string;
  color: string;

  alerts: number;
  rawStatus?: string | null;
  displayStatus?: string;
  statusReason?: PrinterStatusReason;

  printError?: number | string | null;
  failReason?: number | string | null;

  lastCommand?: string | null;
  lastCommandReason?: string | null;

  
  bookingWarning?: string | null;
  hasBooking?: boolean;
  bookingTitle?: string | null;
  bookingStatusText?: string | null;
  bookingStatusTone?: 'reserved' | 'free' | 'unknown';
  bookingPeriodText?: string | null;
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

export interface BookingInfo {
  bookingId: string;
  printerId: string;
  userName: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface PrinterBookingStatus {
  printerId: string;
  printerName: string;
  isPrinting: boolean;
  hasBooking: boolean;
  bookingStatus: BookingStatus;
  currentBooking?: BookingInfo;
  lastBooking?: BookingInfo;
  utilizationRate: number;
}
export type PrinterStatus = 'printing' | 'idle' | 'error' | 'finished';

export type ViewType = 'fleet' | 'detail' | 'alerts' | 'visualization' | 'booking';

export type BookingStatus = 'with-booking' | 'without-booking' | 'idle';

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

// Booking system interface (placeholder for Tuni.booking integration)
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
  utilizationRate: number; // percentage of time with valid booking
}

import { BookingInfo, PrinterBookingStatus } from '../types';

// Mock booking data from Tuni.booking system
export const MOCK_BOOKINGS: BookingInfo[] = [
  {
    bookingId: 'BK-2024-001',
    printerId: 'p1',
    userName: 'John Doe',
    startTime: '2024-02-11T08:00:00',
    endTime: '2024-02-11T12:00:00',
    purpose: 'Thesis prototype printing',
    status: 'active'
  },
  {
    bookingId: 'BK-2024-002',
    printerId: 'p3',
    userName: 'Jane Smith',
    startTime: '2024-02-11T09:00:00',
    endTime: '2024-02-11T11:00:00',
    purpose: 'Research project housing',
    status: 'active'
  },
  {
    bookingId: 'BK-2024-003',
    printerId: 'p4',
    userName: 'Mike Johnson',
    startTime: '2024-02-11T10:00:00',
    endTime: '2024-02-11T14:00:00',
    purpose: 'Drone parts',
    status: 'active'
  },
  {
    bookingId: 'BK-2024-004',
    printerId: 'p2',
    userName: 'Sarah Lee',
    startTime: '2024-02-11T13:00:00',
    endTime: '2024-02-11T15:00:00',
    purpose: 'Mechanical gripper',
    status: 'active'
  }
];

// Cross-match data: printer status + booking status
export const MOCK_PRINTER_BOOKING_STATUS: PrinterBookingStatus[] = [
  {
    printerId: 'p1',
    printerName: 'Bambu A1',
    isPrinting: true,
    hasBooking: true,
    bookingStatus: 'with-booking',
    currentBooking: MOCK_BOOKINGS[0],
    utilizationRate: 85
  },
  {
    printerId: 'p2',
    printerName: 'Bambu A2',
    isPrinting: false,
    hasBooking: true,
    bookingStatus: 'idle',
    currentBooking: MOCK_BOOKINGS[3],
    utilizationRate: 60
  },
  {
    printerId: 'p3',
    printerName: 'Bambu A3',
    isPrinting: true,
    hasBooking: true,
    bookingStatus: 'with-booking',
    currentBooking: MOCK_BOOKINGS[1],
    utilizationRate: 45
  },
  {
    printerId: 'p4',
    printerName: 'Bambu A4',
    isPrinting: true,
    hasBooking: true,
    bookingStatus: 'with-booking',
    currentBooking: MOCK_BOOKINGS[2],
    utilizationRate: 90
  },
  {
    printerId: 'p5',
    printerName: 'Bambu A5',
    isPrinting: false,
    hasBooking: false,
    bookingStatus: 'idle',
    utilizationRate: 30
  }
];

// TODO: Replace with real Tuni.booking API integration
// API Endpoint: https://tuni.booking.system/api/v1/printer-bookings
// Authentication: Bearer token required
// Response format: Array<BookingInfo>

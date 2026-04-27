import { PeppiBooking } from "../data/peppiApi";

export interface PrinterBookingInfo {
  printerId: string;
  printerName: string;
  hasActiveBooking: boolean;
  hasBookingToday: boolean;
  currentBooking?: PeppiBooking;
  todaysBookings: PeppiBooking[];
}

const PRINTER_MAP = [
  { id: "p1", name: "Bambu A1" },
  { id: "p2", name: "Bambu A2" },
  { id: "p3", name: "Bambu A3" },
  { id: "p4", name: "Bambu A4" },
  { id: "p5", name: "Bambu A5" }
];

function normalizeText(value: string | undefined | null): string {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bookingText(booking: PeppiBooking): string {
  return normalizeText(
    [
      booking.title,
      booking.description,
      ...(booking.resourceIds || [])
    ].join(" ")
  );
}

function bookingBelongsToPrinter(
  booking: PeppiBooking,
  printerName: string
): boolean {
  const printer = normalizeText(printerName);
  const text = bookingText(booking);

  /**
   * Peppi resource can be:
   * "3D tulostin_F0-16, Bambu A1"
   * "3D tulostin_F0-16, Bambu A5 AMS"
   *
   * UI printer can be:
   * "Bambu A1"
   * "Bambu A5"
   */
  return text.includes(printer);
}

function isBookingActiveNow(booking: PeppiBooking, now: Date): boolean {
  const start = new Date(booking.start);
  const end = new Date(booking.end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return now >= start && now <= end;
}

/*
--------------------------------------------------
MAP PEPPI BOOKINGS → PRINTER STATUS
--------------------------------------------------
hasBookingToday    = printer has any booking today
hasActiveBooking   = booking is active right now
currentBooking     = the active booking right now
todaysBookings     = all today's bookings for this printer
--------------------------------------------------
*/

export function mapPeppiToPrinters(
  bookings: PeppiBooking[]
): PrinterBookingInfo[] {
  const now = new Date();

  return PRINTER_MAP.map((printer) => {
    const printerBookings = bookings.filter((booking) =>
      bookingBelongsToPrinter(booking, printer.name)
    );

    const activeBooking = printerBookings.find((booking) =>
      isBookingActiveNow(booking, now)
    );

    return {
      printerId: printer.id,
      printerName: printer.name,
      hasActiveBooking: !!activeBooking,
      hasBookingToday: printerBookings.length > 0,
      currentBooking: activeBooking,
      todaysBookings: printerBookings
    };
  });
}
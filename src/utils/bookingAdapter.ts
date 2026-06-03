import { PeppiBooking } from "../data/peppiApi";

export interface PrinterBookingInfo {
  printerId: string;
  printerName: string;
  hasActiveBooking: boolean;
  hasBookingToday: boolean;
  currentBooking?: PeppiBooking;
  nextBooking?: PeppiBooking;
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

  return text.includes(printer);
}

function parseBookingDate(value: string | undefined | null): Date | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isBookingActiveNow(booking: PeppiBooking, now: Date): boolean {
  const start = parseBookingDate(booking.start);
  const end = parseBookingDate(booking.end);

  if (!start || !end) {
    return false;
  }

  return now >= start && now <= end;
}

function isBookingInFuture(booking: PeppiBooking, now: Date): boolean {
  const start = parseBookingDate(booking.start);

  if (!start) {
    return false;
  }

  return start > now;
}

export function mapPeppiToPrinters(
  bookings: PeppiBooking[]
): PrinterBookingInfo[] {
  const now = new Date();

  return PRINTER_MAP.map((printer) => {
    const printerBookings = bookings
      .filter((booking) => bookingBelongsToPrinter(booking, printer.name))
      .sort((a, b) => {
        const aStart = parseBookingDate(a.start)?.getTime() || 0;
        const bStart = parseBookingDate(b.start)?.getTime() || 0;
        return aStart - bStart;
      });

    const activeBooking = printerBookings.find((booking) =>
      isBookingActiveNow(booking, now)
    );

    const nextBooking = printerBookings.find((booking) =>
      isBookingInFuture(booking, now)
    );

    return {
      printerId: printer.id,
      printerName: printer.name,
      hasActiveBooking: !!activeBooking,
      hasBookingToday: printerBookings.length > 0,
      currentBooking: activeBooking,
      nextBooking,
      todaysBookings: printerBookings
    };
  });
}
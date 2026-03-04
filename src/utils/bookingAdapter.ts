import { PeppiBooking } from "../data/peppiApi";

export interface PrinterBookingInfo {
  printerId: string;
  printerName: string;
  hasActiveBooking: boolean;
  currentBooking?: PeppiBooking;
}

const PRINTER_MAP = [
  { id: "p1", name: "Bambu A1" },
  { id: "p2", name: "Bambu A2" },
  { id: "p3", name: "Bambu A3" },
  { id: "p4", name: "Bambu A4" },
  { id: "p5", name: "Bambu A5" }
];

/*
--------------------------------------------------
MAP PEPPI BOOKINGS → PRINTER STATUS
--------------------------------------------------
Detect which printer has an ACTIVE booking now
--------------------------------------------------
*/

export function mapPeppiToPrinters(
  bookings: PeppiBooking[]
): PrinterBookingInfo[] {

  const now = new Date();

  console.log("CURRENT TIME:", now);

  return PRINTER_MAP.map(printer => {

    const activeBooking = bookings.find(b => {

      if (!b.resourceIds) return false;

      // match printer name
      const matchesPrinter = b.resourceIds.some(r =>
        r.includes(printer.name)
      );

      if (!matchesPrinter) return false;

      const start = new Date(b.start);
      const end = new Date(b.end);

      const isActive = now >= start && now <= end;

      console.log(
        "CHECK",
        printer.name,
        "START:", start,
        "END:", end,
        "ACTIVE:", isActive
      );

      return isActive;
    });

    console.log("PRINTER", printer.name, "ACTIVE:", !!activeBooking);

    return {
      printerId: printer.id,
      printerName: printer.name,
      hasActiveBooking: !!activeBooking,
      currentBooking: activeBooking
    };
  });
}
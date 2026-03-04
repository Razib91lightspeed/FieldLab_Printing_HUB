import { PeppiBooking } from "../data/peppiApi";

export interface PrinterBookingInfo {
  printerId: string;
  printerName: string;
  hasActiveBooking: boolean;
  currentBooking?: PeppiBooking;
}

const PRINTER_MAP = [
  { id: "p1", name: "Bambu A1", peppi: "3D tulostin_F0-16, Bambu A1" },
  { id: "p2", name: "Bambu A2", peppi: "3D tulostin_F0-16, Bambu A2" },
  { id: "p3", name: "Bambu A3", peppi: "3D tulostin_F0-16, Bambu A3" },
  { id: "p4", name: "Bambu A4", peppi: "3D tulostin_F0-16, Bambu A4" },
  { id: "p5", name: "Bambu A5", peppi: "3D tulostin_F0-16, Bambu A5 AMS" }
];


// -----------------------------
// FIXED DATE PARSER
// -----------------------------
function parsePeppiDate(str: string): Date {

  if (!str) return new Date(0);

  // Example: 02.03.2026 11.45
  const [datePart, timePart] = str.split(" ");

  const [day, month, year] = datePart.split(".");
  const [hour, minute] = timePart.split(".");

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
}


// -----------------------------
// MAIN MAPPER
// -----------------------------
export function mapPeppiToPrinters(
  bookings: PeppiBooking[]
): PrinterBookingInfo[] {

  const now = new Date();

  console.log("NOW:", now);

  return PRINTER_MAP.map(printer => {

    const active = bookings.find(b => {

      if (!b.resourceIds?.includes(printer.peppi)) return false;

      const start = parsePeppiDate(b.start);
      const end = parsePeppiDate(b.end);

      const isActive = now >= start && now <= end;

      console.log(
        "CHECK:",
        printer.name,
        "NOW:", now,
        "START:", start,
        "END:", end,
        "ACTIVE:", isActive
      );

      return isActive;
    });

    console.log("PRINTER:", printer.name, "ACTIVE:", !!active);

    return {
      printerId: printer.id,
      printerName: printer.name,
      hasActiveBooking: !!active,
      currentBooking: active
    };
  });
}
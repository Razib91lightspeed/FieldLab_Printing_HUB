export interface PeppiBooking {
  id: string;
  resourceIds: string[];
  title: string;
  start: string;
  end: string;
  description?: string;
}

interface PeppiApiResponse {
  ok?: boolean;
  source?: "live" | "cache" | "none";
  updated_at?: string;
  days_ahead?: number;
  bookings?: PeppiBooking[];
  printers?: string[];
  warning?: string | null;
  error?: string;
  details?: string;
}

const PEPPI_API_BASE =
  process.env.REACT_APP_PEPPI_API_BASE || "http://localhost:5050";

const API_URL = `${PEPPI_API_BASE}/api/peppi`;

function isToday(start: string): boolean {
  const bookingDate = new Date(start);
  const now = new Date();

  return (
    bookingDate.getFullYear() === now.getFullYear() &&
    bookingDate.getMonth() === now.getMonth() &&
    bookingDate.getDate() === now.getDate()
  );
}

export async function fetchPeppiBookings(): Promise<PeppiBooking[]> {
  try {
    const response = await fetch(API_URL);
    const data: PeppiApiResponse | PeppiBooking[] = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        !Array.isArray(data)
          ? data?.details || data?.error || `Peppi API error: ${response.status}`
          : `Peppi API error: ${response.status}`
      );
    }

    /**
     * Supports both formats:
     * 1. Old format: [booking, booking, booking]
     * 2. New backend format: { ok: true, bookings: [...] }
     */
    const bookings: PeppiBooking[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.bookings)
      ? data.bookings
      : [];

    return bookings.filter((booking) => isToday(booking.start));
  } catch (error) {
    console.error("Failed to fetch Peppi bookings:", error);
    return [];
  }
}

export async function fetchAllPeppiBookings(): Promise<PeppiBooking[]> {
  try {
    const response = await fetch(API_URL);
    const data: PeppiApiResponse | PeppiBooking[] = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        !Array.isArray(data)
          ? data?.details || data?.error || `Peppi API error: ${response.status}`
          : `Peppi API error: ${response.status}`
      );
    }

    const bookings: PeppiBooking[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.bookings)
      ? data.bookings
      : [];

    return bookings;
  } catch (error) {
    console.error("Failed to fetch all Peppi bookings:", error);
    return [];
  }
}
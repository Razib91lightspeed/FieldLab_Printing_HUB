export interface PeppiBooking {
  id: string;
  resourceIds: string[];
  title: string;
  start: string;
  end: string;
  description?: string;
}

const API_URL = "http://localhost:4000/api/peppi";

/**
 * Check if booking is today
 */
function isToday(start: string): boolean {
  const bookingDate = new Date(start);
  const now = new Date();

  return (
    bookingDate.getFullYear() === now.getFullYear() &&
    bookingDate.getMonth() === now.getMonth() &&
    bookingDate.getDate() === now.getDate()
  );
}

/**
 * Fetch bookings from backend proxy (today only)
 */
export async function fetchPeppiBookings(): Promise<PeppiBooking[]> {

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Peppi API error: ${response.status}`);
    }

    const data: PeppiBooking[] = await response.json();

    console.log("✅ Peppi bookings received:", data);

    // ✅ FILTER ONLY TODAY BOOKINGS
    const todayBookings = data.filter(b => isToday(b.start));

    console.log("📅 Today bookings:", todayBookings);

    return todayBookings;

  } catch (error) {

    console.error("❌ Failed to fetch Peppi bookings:", error);

    return [];
  }
}
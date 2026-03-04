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
 * Fetch bookings from backend proxy (avoids CORS)
 */
export async function fetchPeppiBookings(): Promise<PeppiBooking[]> {

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Peppi API error: ${response.status}`);
    }

    const data = await response.json();

    console.log("✅ Peppi bookings received:", data);

    return data;

  } catch (error) {

    console.error("❌ Failed to fetch Peppi bookings:", error);

    return [];
  }
}
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000";

export async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/api/dashboard`);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.details || data?.error || `Dashboard API failed: ${res.status}`
    );
  }

  return data;
}
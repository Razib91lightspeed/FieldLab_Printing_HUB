export async function fetchDashboard() {
  const res = await fetch("http://localhost:4000/api/dashboard");

  if (!res.ok) {
    throw new Error(`Dashboard API failed: ${res.status}`);
  }

  return await res.json();
}
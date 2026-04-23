const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000";

export async function fetchPrinterConfig() {
  const res = await fetch(`${API_BASE}/api/printer-config`);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.details || data?.error || "Failed to load printer config"
    );
  }

  return data;
}

export async function updatePrinterConfig(
  printerId: string,
  data: {
    ip?: string;
    access_code?: string;
    enabled?: boolean;
  }
) {
  const res = await fetch(`${API_BASE}/api/printer-config/${printerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      result?.details || result?.error || "Failed to update printer config"
    );
  }

  return result;
}

export async function fetchLivePrinters() {
  const res = await fetch(`${API_BASE}/api/printers`);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.details || data?.error || "Failed to load live printer data"
    );
  }

  return data;
}
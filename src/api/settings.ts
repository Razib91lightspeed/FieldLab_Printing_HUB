const API_BASE =
  process.env.REACT_APP_API_BASE_URL || "http://10.10.1.54:4000";
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

export async function syncPiTimeFromBrowser() {
  const res = await fetch(`${API_BASE}/api/system-time/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      isoTime: new Date().toISOString(),
      restartBridge: true,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.details || data?.error || "Failed to sync Pi time"
    );
  }

  return data;
}
import { PrinterData, PrinterStatus } from "../types";

type FiwarePrinter = {
  id: string;
  status?: { value?: string };
  progress?: { value?: number };
  jobName?: { value?: string };
  nozzleTemp?: { value?: number };
  bedTemp?: { value?: number };
  material?: { value?: string };
  color?: { value?: string };
  lastSeen?: { value?: string };
  online?: { value?: boolean };
};

const PRINTER_META: Record<string, { ip: string }> = {
  "urn:ngsi-ld:Printer:Bambu_A1": { ip: "10.10.3.1" },
  "urn:ngsi-ld:Printer:Bambu_A2": { ip: "10.10.3.2" },
  "urn:ngsi-ld:Printer:Bambu_A3": { ip: "10.10.3.3" },
  "urn:ngsi-ld:Printer:Bambu_A4": { ip: "10.10.3.4" },
  "urn:ngsi-ld:Printer:Bambu_A5": { ip: "10.10.3.5" },
};

function extractPrinterName(id: string) {
  return id.split(":").pop()?.replaceAll("_", " ") || id;
}

function normalizeStatus(status?: string): PrinterStatus {
  const s = (status || "").toUpperCase();

  if (s === "RUNNING") return "printing";
  if (s === "PAUSE") return "error";
  if (s === "FAILED") return "error";
  if (s === "FINISH") return "finished";
  if (s === "IDLE") return "idle";

  return "idle";
}

function inferAlerts(status?: string): number {
  const s = (status || "").toUpperCase();

  if (s === "PAUSE" || s === "FAILED") return 1;

  return 0;
}

function inferTimeRemaining(status?: string, progress?: number): string {
  const s = (status || "").toUpperCase();
  const p = progress ?? 0;

  if (s === "FINISH") return "Done";
  if (s === "IDLE") return "-";
  if (s === "PAUSE") return "Paused";
  if (s === "FAILED") return "Failed";

  const remaining = Math.max(0, 100 - p);
  return `~${remaining} min`;
}

function normalizeMaterial(raw?: string): string {
  const value = (raw || "").trim();

  if (!value) return "Material status unavailable";

  // These are warning phrases, not actual material names.
  if (
    value.toLowerCase() === "please refill pla" ||
    value.toLowerCase() === "refill pla"
  ) {
    return "Material status unavailable";
  }

  return value;
}

export function mapDashboardData(printers: FiwarePrinter[]): PrinterData[] {
  return printers.map((p) => {
    const meta = PRINTER_META[p.id] || { ip: "-" };
    const material = normalizeMaterial(p.material?.value);

    return {
      id: p.id,
      name: extractPrinterName(p.id),
      ip: meta.ip,

      status: normalizeStatus(p.status?.value),
      progress: p.progress?.value ?? 0,

      jobName: p.jobName?.value || "-",
      timeRemaining: inferTimeRemaining(p.status?.value, p.progress?.value),
      elapsedTime: "-",

      nozzleTemp: p.nozzleTemp?.value ?? 0,
      nozzleTarget: p.nozzleTemp?.value ?? 0,

      bedTemp: p.bedTemp?.value ?? 0,
      bedTarget: p.bedTemp?.value ?? 0,

      material,
      color: p.color?.value || "Unknown",

      alerts: inferAlerts(p.status?.value),

      hasBooking: false,
      bookingTitle: null,
    };
  });
}
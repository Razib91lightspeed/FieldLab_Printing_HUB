import { PrinterData, PrinterStatus } from "../types";

type FiwareValue<T> = {
  value?: T;
};

type FiwarePrinter = {
  id: string;

  status?: FiwareValue<string>;
  progress?: FiwareValue<number>;

  /*
    These are the real remaining-time fields.
    remainingTimeMinutes is the one we will send from the Pi/FIWARE later.
    mc_remaining_time and remain_time are fallback names.
  */
  remainingTimeMinutes?: FiwareValue<number | string | null>;
  mc_remaining_time?: FiwareValue<number | string | null>;
  remain_time?: FiwareValue<number | string | null>;

  jobName?: FiwareValue<string>;
  nozzleTemp?: FiwareValue<number>;
  bedTemp?: FiwareValue<number>;
  material?: FiwareValue<string>;
  color?: FiwareValue<string>;
  lastSeen?: FiwareValue<string>;
  online?: FiwareValue<boolean>;
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
  const s = String(status || "").toUpperCase();

  if (s === "RUNNING") return "printing";
  if (s === "PRINTING") return "printing";

  if (s === "PAUSE") return "error";
  if (s === "PAUSED") return "error";

  if (s === "FAILED") return "error";
  if (s === "ERROR") return "error";

  if (s === "FINISH") return "finished";
  if (s === "FINISHED") return "finished";
  if (s === "COMPLETED") return "finished";
  if (s === "COMPLETE") return "finished";

  if (s === "IDLE") return "idle";

  return "idle";
}

function inferAlerts(status?: string): number {
  const s = String(status || "").toUpperCase();

  if (s === "PAUSE" || s === "PAUSED" || s === "FAILED" || s === "ERROR") {
    return 1;
  }

  return 0;
}

function formatRemainingTime(minutes?: number | string | null): string {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  const rounded = Math.round(value);

  if (rounded < 60) {
    return `~${rounded} min`;
  }

  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  if (mins === 0) {
    return `~${hours} h`;
  }

  return `~${hours} h ${mins} min`;
}

function inferTimeRemaining(
  status?: string,
  realRemainingMinutes?: number | string | null
): string {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "finished") {
    return "Done";
  }

  if (normalizedStatus === "error") {
    return "Failed";
  }

  if (normalizedStatus === "printing") {
    const formatted = formatRemainingTime(realRemainingMinutes);
    return formatted === "-" ? "Calculating..." : formatted;
  }

  return "-";
}

function normalizeMaterial(raw?: string): string {
  const value = String(raw || "").trim();

  if (!value) {
    return "Material status unavailable";
  }

  const lower = value.toLowerCase();

  // These are warning phrases, not actual material names.
  if (lower === "please refill pla" || lower === "refill pla") {
    return "Material status unavailable";
  }

  return value;
}

export function mapDashboardData(printers: FiwarePrinter[]): PrinterData[] {
  return printers.map((p) => {
    const meta = PRINTER_META[p.id] || { ip: "-" };
    const material = normalizeMaterial(p.material?.value);

    const realRemainingMinutes =
      p.remainingTimeMinutes?.value ??
      p.mc_remaining_time?.value ??
      p.remain_time?.value ??
      null;

    return {
      id: p.id,
      name: extractPrinterName(p.id),
      ip: meta.ip,

      status: normalizeStatus(p.status?.value),
      progress: p.progress?.value ?? 0,

      jobName: p.jobName?.value || "-",
      timeRemaining: inferTimeRemaining(
        p.status?.value,
        realRemainingMinutes
      ),
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
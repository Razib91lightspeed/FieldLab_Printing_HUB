import { PrinterData, PrinterStatus, PrinterStatusReason } from "../types";

type FiwareValue<T> = {
  value?: T;
};

type FiwarePrinter = {
  id: string;

  status?: FiwareValue<string>;
  progress?: FiwareValue<number>;

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

  printError?: FiwareValue<number | string | null>;
  print_error?: FiwareValue<number | string | null>;
  mc_print_error_code?: FiwareValue<number | string | null>;

  failReason?: FiwareValue<number | string | null>;
  fail_reason?: FiwareValue<number | string | null>;

  lastCommand?: FiwareValue<string | null>;
  last_command?: FiwareValue<string | null>;
  lastCommandReason?: FiwareValue<string | null>;
  last_command_reason?: FiwareValue<string | null>;
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

function normalizeRawStatus(status?: string | null): string {
  return String(status || "UNKNOWN").trim().toUpperCase();
}

/*
  This keeps the old UI severity field.
  It should only control broad UI color/shape, not the exact displayed label.
*/
function normalizeStatus(status?: string | null): PrinterStatus {
  const s = normalizeRawStatus(status);

  if (s === "RUNNING" || s === "PRINTING") return "printing";

  if (
    s === "PAUSE" ||
    s === "PAUSED" ||
    s === "FAILED" ||
    s === "ERROR" ||
    s === "STOPPED_BY_USER" ||
    s === "STOPPED" ||
    s === "CANCELLED" ||
    s === "CANCELED"
  ) {
    return "error";
  }

  if (
    s === "FINISH" ||
    s === "FINISHED" ||
    s === "COMPLETED" ||
    s === "COMPLETE"
  ) {
    return "finished";
  }

  if (s === "IDLE") return "idle";

  return "idle";
}

/*
  This is the important long-term field.
  It preserves the meaning that was previously lost when PAUSE/FAILED became "error".
*/
function getStatusReason(status?: string | null): PrinterStatusReason {
  const s = normalizeRawStatus(status);

  if (s === "RUNNING" || s === "PRINTING") return "printing";

  if (s === "PAUSE" || s === "PAUSED") return "paused";

  if (s === "FAILED" || s === "ERROR") return "failed";

  if (
    s === "STOPPED_BY_USER" ||
    s === "STOPPED" ||
    s === "CANCELLED" ||
    s === "CANCELED"
  ) {
    return "stopped";
  }

  if (
    s === "FINISH" ||
    s === "FINISHED" ||
    s === "COMPLETED" ||
    s === "COMPLETE"
  ) {
    return "finished";
  }

  if (s === "IDLE") return "idle";

  return "unknown";
}

function getDisplayStatus(reason: PrinterStatusReason): string {
  switch (reason) {
    case "printing":
      return "Printing";

    case "paused":
      return "Paused";

    case "failed":
      return "Failed printing";

    case "stopped":
      return "Stopped by user";

    case "finished":
      return "Finished";

    case "idle":
      return "Idle";

    case "telemetry":
      return "Telemetry Missing";

    case "access-code":
      return "Access Code Error";

    default:
      return "Unknown";
  }
}

function inferAlerts(status?: string | null): number {
  const reason = getStatusReason(status);

  if (reason === "paused" || reason === "failed" || reason === "stopped") {
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
  status?: string | null,
  realRemainingMinutes?: number | string | null
): string {
  const reason = getStatusReason(status);

  if (reason === "finished") {
    return "Done";
  }

  if (reason === "paused") {
    return "Paused";
  }

  if (reason === "failed") {
    return "Failed";
  }

  if (reason === "stopped") {
    return "Stopped";
  }

  if (reason === "printing") {
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

  if (lower === "please refill pla" || lower === "refill pla") {
    return "Material status unavailable";
  }

  return value;
}

function firstValue<T>(...values: Array<T | undefined | null>): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

export function mapDashboardData(printers: FiwarePrinter[]): PrinterData[] {
  return printers.map((p) => {
    const meta = PRINTER_META[p.id] || { ip: "-" };

    const rawStatus = normalizeRawStatus(p.status?.value);
    const statusReason = getStatusReason(rawStatus);
    const displayStatus = getDisplayStatus(statusReason);

    const material = normalizeMaterial(p.material?.value);

    const realRemainingMinutes =
      p.remainingTimeMinutes?.value ??
      p.mc_remaining_time?.value ??
      p.remain_time?.value ??
      null;

    const printError = firstValue(
      p.printError?.value,
      p.print_error?.value,
      p.mc_print_error_code?.value
    );

    const failReason = firstValue(
      p.failReason?.value,
      p.fail_reason?.value
    );

    const lastCommand = firstValue(
      p.lastCommand?.value,
      p.last_command?.value
    );

    const lastCommandReason = firstValue(
      p.lastCommandReason?.value,
      p.last_command_reason?.value
    );

    return {
      id: p.id,
      name: extractPrinterName(p.id),
      ip: meta.ip,

      status: normalizeStatus(rawStatus),
      rawStatus,
      statusReason,
      displayStatus,

      progress: p.progress?.value ?? 0,

      jobName: p.jobName?.value || "-",
      timeRemaining: inferTimeRemaining(rawStatus, realRemainingMinutes),
      elapsedTime: "-",

      nozzleTemp: p.nozzleTemp?.value ?? 0,
      nozzleTarget: p.nozzleTemp?.value ?? 0,

      bedTemp: p.bedTemp?.value ?? 0,
      bedTarget: p.bedTemp?.value ?? 0,

      material,
      color: p.color?.value || "Unknown",

      printError,
      failReason,
      lastCommand,
      lastCommandReason,

      alerts: inferAlerts(rawStatus),

      hasBooking: false,
      bookingTitle: null,
    };
  });
}
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'resolved';

export interface PrinterAlert {
  id: string;
  timestamp: string;
  printerName: string;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
}

interface PrinterConfigItem {
  id: string;
  name: string;
  ip?: string;
  enabled?: boolean;
  is_pipeline_healthy?: boolean;
  needs_verification?: boolean;
  health_message?: string;
  last_seen?: string;
  last_updated?: string;
}

interface LivePrinterItem {
  id?: string;
  name?: string | { value?: string };
  status?: string | { value?: string };
  online?: boolean | { value?: boolean };
  lastSeen?: string | { value?: string };
  last_seen?: string | { value?: string };
}

function valueOf<T>(field: T | { value?: T } | undefined): T | undefined {
  if (field && typeof field === 'object' && 'value' in field) {
    return field.value;
  }
  return field as T | undefined;
}

function normalize(value?: string) {
  return (value || '')
    .toLowerCase()
    .replace('urn:ngsi-ld:printer:', '')
    .replaceAll('_', ' ')
    .trim();
}

function parseDate(value?: string) {
  if (!value) return null;

  const normal = new Date(value);
  if (!Number.isNaN(normal.getTime())) return normal;

  // Handles format like: 25/04/2026, 20:49:15
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (match) {
    const [, dd, mm, yyyy, hh, min, ss] = match;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
  }

  return null;
}

function minutesSince(value?: string) {
  const date = parseDate(value);
  if (!date) return null;
  return (Date.now() - date.getTime()) / 60000;
}

function findLivePrinter(
  printer: PrinterConfigItem,
  livePrinters: LivePrinterItem[]
) {
  const printerName = normalize(printer.name);
  const printerId = normalize(printer.id);

  return livePrinters.find((live) => {
    const liveId = normalize(live.id);
    const liveName = normalize(valueOf<string>(live.name));

    return (
      liveId === printerId ||
      liveName === printerName ||
      liveId.endsWith(printerName.replaceAll(' ', '_')) ||
      liveId.endsWith(printerName.replaceAll(' ', ' '))
    );
  });
}

export function buildPrinterAlerts(
  printers: PrinterConfigItem[],
  livePrinters: LivePrinterItem[],
  staleAfterMinutes = 3
): PrinterAlert[] {
  const alerts: PrinterAlert[] = [];

  for (const printer of printers) {
    if (printer.enabled === false) continue;

    const live = findLivePrinter(printer, livePrinters);

    if (!live) {
      alerts.push({
        id: `${printer.id}-no-fiware`,
        timestamp: new Date().toLocaleString(),
        printerName: printer.name,
        severity: 'critical',
        message:
          'No FIWARE telemetry found. The MQTT bridge may not be receiving or forwarding data.',
        status: 'active',
      });
      continue;
    }

    const online = valueOf<boolean>(live.online);
    const status = valueOf<string>(live.status);
    const lastSeen =
      valueOf<string>(live.lastSeen) || valueOf<string>(live.last_seen);

    const ageMinutes = minutesSince(lastSeen);

    if (online === false) {
      alerts.push({
        id: `${printer.id}-offline`,
        timestamp: lastSeen || new Date().toLocaleString(),
        printerName: printer.name,
        severity: 'critical',
        message:
          'Printer is reported offline. MQTT connection, access code, or printer network may have failed.',
        status: 'active',
      });
    }

    if (ageMinutes !== null && ageMinutes > staleAfterMinutes) {
      alerts.push({
        id: `${printer.id}-stale`,
        timestamp: lastSeen || new Date().toLocaleString(),
        printerName: printer.name,
        severity: 'warning',
        message: `Telemetry is stale. Last update was about ${Math.round(
          ageMinutes
        )} minutes ago.`,
        status: 'active',
      });
    }

    if (!lastSeen) {
      alerts.push({
        id: `${printer.id}-missing-lastseen`,
        timestamp: new Date().toLocaleString(),
        printerName: printer.name,
        severity: 'warning',
        message:
          'Telemetry exists, but lastSeen timestamp is missing. Health check cannot verify freshness.',
        status: 'active',
      });
    }

    if (
      status &&
      ['error', 'failed', 'offline', 'disconnected'].some((word) =>
        status.toLowerCase().includes(word)
      )
    ) {
      alerts.push({
        id: `${printer.id}-status-${status}`,
        timestamp: lastSeen || new Date().toLocaleString(),
        printerName: printer.name,
        severity: 'critical',
        message: `Printer status reported: ${status}`,
        status: 'active',
      });
    }

    if (printer.needs_verification) {
      alerts.push({
        id: `${printer.id}-verification`,
        timestamp: printer.last_updated || new Date().toLocaleString(),
        printerName: printer.name,
        severity: 'warning',
        message:
          'Access code or printer configuration needs verification after update.',
        status: 'active',
      });
    }

    if (printer.is_pipeline_healthy === false) {
      alerts.push({
        id: `${printer.id}-pipeline`,
        timestamp: printer.last_seen || new Date().toLocaleString(),
        printerName: printer.name,
        severity: 'warning',
        message:
          printer.health_message ||
          'Local printer pipeline is marked unhealthy.',
        status: 'active',
      });
    }
  }

  return alerts.sort((a, b) => {
    const severityOrder = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
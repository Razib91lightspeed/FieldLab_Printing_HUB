import {
  LivePrinterItem,
  LivePrinterState,
  PrinterConfigItem,
  PrinterStatusState,
} from '../types/settings';

export const VERIFY_GRACE_MS = 15 * 1000;
export const HEALTHY_MAX_AGE_MINUTES = 3;

export function normalizeKey(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/urn:ngsi-ld:printer:/g, '')
    .replace(/urn:ngsi-ld:/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts different possible names/IDs into the same key.
 *
 * Examples:
 * p1                                  -> bambu a1
 * Bambu A1                            -> bambu a1
 * Bambu_A1                            -> bambu a1
 * urn:ngsi-ld:Printer:Bambu_A1        -> bambu a1
 * 3D tulostin_F0-16, Bambu A1         -> bambu a1
 */
export function canonicalBambuKey(value?: string | null) {
  const normalized = normalizeKey(value);

  if (!normalized) return '';

  const bambuMatch = normalized.match(/bambu\s*a\s*(\d+)/);
  if (bambuMatch) {
    return `bambu a${bambuMatch[1]}`;
  }

  const localIdMatch = normalized.match(/^p(\d+)$/);
  if (localIdMatch) {
    return `bambu a${localIdMatch[1]}`;
  }

  const shortAIdMatch = normalized.match(/^a\s*(\d+)$/);
  if (shortAIdMatch) {
    return `bambu a${shortAIdMatch[1]}`;
  }

  return normalized;
}

function uniqueKeys(values: Array<string | undefined | null>) {
  const keys = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    const normalized = normalizeKey(value);
    const canonical = canonicalBambuKey(value);

    if (normalized) keys.add(normalized);
    if (canonical) keys.add(canonical);
  }

  return Array.from(keys);
}

export function normalizeFiwarePrinterName(entityId: string) {
  const tail = entityId.split(':').pop() || entityId;
  return tail.replaceAll('_', ' ');
}

export function readNgsiValue(value: any) {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value;
  }

  return value;
}

export function parseBooleanValue(value: any): boolean | undefined {
  const raw = readNgsiValue(value);

  if (typeof raw === 'boolean') return raw;

  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim();

    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }

  return undefined;
}

export function extractLivePrinters(data: any): LivePrinterItem[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.printers)) return data.printers;
  if (Array.isArray(data?.entities)) return data.entities;
  if (Array.isArray(data?.data)) return data.data;
  if (data?.id) return [data];

  return [];
}

function normalizeIsoFractionalSeconds(raw: string) {
  /**
   * FIWARE/Python may return timestamps like:
   * 2026-05-07T19:40:11.740658Z
   *
   * JavaScript normally handles this, but trimming to milliseconds makes it safer.
   */
  return raw.replace(
    /\.(\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/,
    '.$1$2'
  );
}

export function parseBackendTimestamp(timestamp?: string | null) {
  if (!timestamp) return null;

  const raw = String(timestamp).trim();
  if (!raw) return null;

  const normalizedIso = normalizeIsoFractionalSeconds(raw);

  const dmyMatch = normalizedIso.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (dmyMatch) {
    const [, d, m, y, hh, mm, ss = '00'] = dmyMatch;

    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
  }

  const localIsoMatch = normalizedIso.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (localIsoMatch) {
    const [, y, m, d, hh, mm, ss = '00'] = localIsoMatch;

    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
  }

  const parsed = new Date(normalizedIso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function minutesSince(timestamp?: string | null) {
  const parsed = parseBackendTimestamp(timestamp);
  if (!parsed) return null;

  const diff = (Date.now() - parsed.getTime()) / (1000 * 60);
  return Math.max(0, diff);
}

export function formatTimestamp(timestamp?: string | null) {
  const parsed = parseBackendTimestamp(timestamp);
  return parsed ? parsed.toLocaleString() : '-';
}

export function formatAge(timestamp?: string | null) {
  const age = minutesSince(timestamp);

  if (age === null) return 'Unknown';
  if (age < 1) return 'Less than 1 min ago';
  if (age < 60) return `${Math.floor(age)} min ago`;

  const hours = Math.floor(age / 60);
  const mins = Math.floor(age % 60);

  return `${hours}h ${mins}m ago`;
}

function newerTimestamp(a?: string, b?: string) {
  const dateA = parseBackendTimestamp(a);
  const dateB = parseBackendTimestamp(b);

  if (!dateA && !dateB) return undefined;
  if (dateA && !dateB) return a;
  if (!dateA && dateB) return b;

  return dateA!.getTime() >= dateB!.getTime() ? a : b;
}

function collectTimestampCandidatesFromValue(value: any): string[] {
  const candidates: string[] = [];

  if (!value) return candidates;

  if (typeof value === 'string') {
    if (parseBackendTimestamp(value)) {
      candidates.push(value);
    }

    return candidates;
  }

  if (typeof value === 'object') {
    const possibleKeys = [
      'value',
      'observedAt',
      'modifiedAt',
      'createdAt',
      'dateModified',
      'lastSeen',
      'last_seen',
      'timestamp',
      'time',
    ];

    for (const key of possibleKeys) {
      const maybeTimestamp = value[key];

      if (
        typeof maybeTimestamp === 'string' &&
        parseBackendTimestamp(maybeTimestamp)
      ) {
        candidates.push(maybeTimestamp);
      }
    }
  }

  return candidates;
}

export function getFreshestTelemetryTimestamp(entity: LivePrinterItem) {
  let freshest: string | undefined;

  const preferredFields = [
    entity.lastSeen,
    entity.last_seen,
    entity.dateModified,
    entity.modifiedAt,
    entity.status,
    entity.progress,
    entity.jobName,
    entity.nozzleTemp,
    entity.bedTemp,
    entity.material,
    entity.color,
    entity.online,
  ];

  for (const field of preferredFields) {
    for (const candidate of collectTimestampCandidatesFromValue(field)) {
      freshest = newerTimestamp(freshest, candidate);
    }
  }

  for (const value of Object.values(entity)) {
    for (const candidate of collectTimestampCandidatesFromValue(value)) {
      freshest = newerTimestamp(freshest, candidate);
    }
  }

  return freshest;
}

export function buildLiveStateMap(printers: LivePrinterItem[]) {
  const map: Record<string, LivePrinterState> = {};

  for (const printer of printers || []) {
    const normalizedName = normalizeFiwarePrinterName(printer.id);
    const fiwareName = readNgsiValue(printer.name) || normalizedName;

    const lastSeen =
      readNgsiValue(printer.lastSeen) ||
      readNgsiValue(printer.last_seen);

    const freshestTelemetryTimestamp = getFreshestTelemetryTimestamp(printer);

    const liveState: LivePrinterState = {
      id: printer.id,
      name: fiwareName,
      status: readNgsiValue(printer.status),
      online: parseBooleanValue(printer.online),
      lastSeen,
      telemetryUpdatedAt: freshestTelemetryTimestamp || lastSeen,
    };

    const keys = uniqueKeys([
      printer.id,
      normalizedName,
      fiwareName,
      liveState.name,
      canonicalBambuKey(printer.id),
      canonicalBambuKey(normalizedName),
      canonicalBambuKey(fiwareName),
    ]);

    for (const key of keys) {
      map[key] = liveState;
    }
  }

  return map;
}

export function getLiveForPrinter(
  printer: PrinterConfigItem,
  liveStateMap: Record<string, LivePrinterState>
) {
  const keys = uniqueKeys([
    printer.id,
    printer.name,
    printer.serial,
    canonicalBambuKey(printer.id),
    canonicalBambuKey(printer.name),
    canonicalBambuKey(printer.serial),
  ]);

  for (const key of keys) {
    const live = liveStateMap[key];
    if (live) return live;
  }

  return undefined;
}

export function getBestTelemetryTimestamp(
  printer: PrinterConfigItem,
  live?: LivePrinterState
) {
  /**
   * lastSeen is the bridge health timestamp.
   * telemetryUpdatedAt is only fallback.
   */
  return live?.lastSeen || live?.telemetryUpdatedAt || printer.last_seen;
}

export function getPrinterStatus(
  printer: PrinterConfigItem,
  live?: LivePrinterState,
  verificationStartedAt?: string
): PrinterStatusState {
  if (!printer.enabled) {
    return {
      label: 'Disabled',
      color: 'text-gray-600 bg-gray-100 border border-gray-200',
      isWarning: false,
      description: 'This printer is disabled in local Pi configuration.',
    };
  }

  if (!live) {
    return {
      label: 'No FIWARE telemetry',
      color: 'text-red-600 bg-red-100 border border-red-200 animate-pulse',
      isWarning: true,
      description:
        'No matching FIWARE entity was found for this printer. Check whether the local printer name/id matches the FIWARE entity.',
    };
  }

  const bestTelemetryTimestamp = getBestTelemetryTimestamp(printer, live);
  const telemetryDate = parseBackendTimestamp(bestTelemetryTimestamp);
  const ageMinutes = minutesSince(bestTelemetryTimestamp);

  const activeVerificationTime = parseBackendTimestamp(verificationStartedAt);

  /**
   * CASE 1:
   * User just saved a new access code/IP/enabled state.
   * We only mark it healthy when FIWARE receives telemetry newer than save time.
   */
  if (activeVerificationTime) {
    const msAfterSave = Date.now() - activeVerificationTime.getTime();

    if (msAfterSave >= 0 && msAfterSave < VERIFY_GRACE_MS) {
      return {
        label: 'Restarting bridge...',
        color: 'text-yellow-700 bg-yellow-100 border border-yellow-200',
        isWarning: true,
        description:
          'Access code was saved. Waiting for the MQTT bridge to reconnect and publish fresh FIWARE telemetry.',
      };
    }

    const telemetryIsAfterSave =
      telemetryDate &&
      telemetryDate.getTime() > activeVerificationTime.getTime();

    const telemetryIsFresh =
      ageMinutes !== null && ageMinutes <= HEALTHY_MAX_AGE_MINUTES;

    if (telemetryIsAfterSave && telemetryIsFresh && live.online !== false) {
      return {
        label: 'Healthy ✓',
        color: 'text-green-700 bg-green-100 border border-green-200',
        isWarning: false,
        description:
          'Fresh FIWARE telemetry arrived after the latest access-code update. The MQTT pipeline is verified.',
      };
    }

    return {
      label: 'Access code not verified',
      color: 'text-red-600 bg-red-100 border border-red-200 animate-pulse',
      isWarning: true,
      description:
        'No fresh FIWARE telemetry arrived after saving. The access code, IP address, serial number, or MQTT connection may still be wrong.',
    };
  }

  /**
   * CASE 2:
   * Normal settings page status.
   * Do not trust old online/status values. Only trust fresh lastSeen.
   */
  if (!telemetryDate) {
    return {
      label: 'No telemetry timestamp',
      color: 'text-red-600 bg-red-100 border border-red-200 animate-pulse',
      isWarning: true,
      description:
        'FIWARE data exists, but no usable lastSeen timestamp was found. The dashboard cannot verify if the pipeline is alive.',
    };
  }

  if (ageMinutes !== null && ageMinutes > HEALTHY_MAX_AGE_MINUTES) {
    return {
      label: 'Pipeline / access code problem',
      color: 'text-red-600 bg-red-100 border border-red-200 animate-pulse',
      isWarning: true,
      description:
        'FIWARE has only old telemetry. The printer may still show an old RUNNING/FINISH/FAILED state, but the MQTT → FIWARE pipeline is not currently alive. The access code may be wrong.',
    };
  }

  if (live.online === false) {
    return {
      label: 'Printer offline',
      color: 'text-yellow-700 bg-yellow-100 border border-yellow-200',
      isWarning: true,
      description:
        'FIWARE telemetry is fresh, but the printer reports offline. Check printer power, LAN mode, WiFi, and access code.',
    };
  }

  return {
    label: 'Healthy ✓',
    color: 'text-green-700 bg-green-100 border border-green-200',
    isWarning: false,
    description:
      'Fresh FIWARE telemetry is arriving. The MQTT → FIWARE pipeline is healthy.',
  };
}

export function isValidIp(value: string) {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    const num = Number(part);
    return Number.isInteger(num) && num >= 0 && num <= 255;
  });
}

export function validatePrinter(printer: PrinterConfigItem) {
  if (!printer.name.trim()) return 'Printer name is missing.';
  if (!printer.serial.trim()) return 'Serial is missing.';
  if (!printer.access_code.trim()) return 'Access code is empty.';
  if (!isValidIp(printer.ip)) return 'IP address is invalid.';

  return '';
}

export function isPrinterDirty(
  printerId: string,
  currentConfig: { printers: PrinterConfigItem[] } | null,
  originalConfig: { printers: PrinterConfigItem[] } | null
) {
  if (!currentConfig || !originalConfig) return false;

  const current = currentConfig.printers.find((p) => p.id === printerId);
  const original = originalConfig.printers.find((p) => p.id === printerId);

  if (!current || !original) return false;

  return (
    current.ip.trim() !== original.ip.trim() ||
    current.access_code.trim() !== original.access_code.trim() ||
    current.enabled !== original.enabled
  );
}
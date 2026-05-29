export interface PeppiBooking {
  id: string;
  resourceIds: string[];
  title: string;
  start: string;
  end: string;
  description?: string;
  raw?: unknown;
}

interface PeppiApiResponse {
  ok?: boolean;
  source?: 'live' | 'cache' | 'none';
  updated_at?: string;
  days_ahead?: number;
  bookings?: unknown[];
  printers?: string[];
  warning?: string | null;
  error?: string;
  details?: string;
}

type AnyRecord = Record<string, any>;

const PEPPI_API_BASE =
  process.env.REACT_APP_PEPPI_API_BASE || 'http://172.16.101.22:5001';

const API_URL = `${PEPPI_API_BASE}/api/peppi`;

const KNOWN_PRINTER_RESOURCES = [
  '3D tulostin_F0-16, Bambu A1',
  '3D tulostin_F0-16, Bambu A2',
  '3D tulostin_F0-16, Bambu A3',
  '3D tulostin_F0-16, Bambu A4',
  '3D tulostin_F0-16, Bambu A5 AMS',
];

function safeString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeText(value: unknown) {
  return safeString(value)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[,:;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return safeString(value);
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object') {
    const record = value as AnyRecord;

    return toDate(
      record.dateTime ??
        record.date_time ??
        record.datetime ??
        record.date ??
        record.time ??
        record.value ??
        null
    );
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const european = raw.match(
    /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (european) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = european;

    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss)
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const normalizedDate = new Date(normalized);

  return Number.isNaN(normalizedDate.getTime()) ? null : normalizedDate;
}

function isToday(dateLike: unknown): boolean {
  const bookingDate = toDate(dateLike);
  if (!bookingDate) return false;

  const now = new Date();

  return (
    bookingDate.getFullYear() === now.getFullYear() &&
    bookingDate.getMonth() === now.getMonth() &&
    bookingDate.getDate() === now.getDate()
  );
}

function isDateLikeKey(key: string, mode: 'start' | 'end') {
  const normalized = key.toLowerCase();

  if (mode === 'start') {
    return (
      normalized.includes('start') ||
      normalized.includes('begin') ||
      normalized === 'from' ||
      normalized.includes('alkaa')
    );
  }

  return (
    normalized.includes('end') ||
    normalized.includes('finish') ||
    normalized === 'to' ||
    normalized.includes('loppu') ||
    normalized.includes('ends')
  );
}

function findDateByKeyDeep(
  value: unknown,
  mode: 'start' | 'end',
  depth = 0
): Date | null {
  if (!value || depth > 5) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDateByKeyDeep(item, mode, depth + 1);
      if (found) return found;
    }

    return null;
  }

  if (typeof value !== 'object') return null;

  const record = value as AnyRecord;

  for (const [key, raw] of Object.entries(record)) {
    if (isDateLikeKey(key, mode)) {
      const parsed = toDate(raw);
      if (parsed) return parsed;
    }
  }

  for (const raw of Object.values(record)) {
    const found = findDateByKeyDeep(raw, mode, depth + 1);
    if (found) return found;
  }

  return null;
}

function getStartDate(raw: AnyRecord) {
  return (
    toDate(
      raw.start ??
        raw.startTime ??
        raw.start_time ??
        raw.begin ??
        raw.beginTime ??
        raw.begin_time ??
        raw.from ??
        raw.startDate ??
        raw.start_date ??
        raw.startDateTime ??
        raw.start_datetime ??
        raw.startsAt ??
        raw.starts_at
    ) || findDateByKeyDeep(raw, 'start')
  );
}

function getEndDate(raw: AnyRecord) {
  return (
    toDate(
      raw.end ??
        raw.endTime ??
        raw.end_time ??
        raw.finish ??
        raw.finishTime ??
        raw.finish_time ??
        raw.to ??
        raw.endDate ??
        raw.end_date ??
        raw.endDateTime ??
        raw.end_datetime ??
        raw.endsAt ??
        raw.ends_at
    ) || findDateByKeyDeep(raw, 'end')
  );
}

function pushResource(resources: string[], value: unknown) {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((item) => pushResource(resources, item));
    return;
  }

  if (typeof value === 'object') {
    const record = value as AnyRecord;

    pushResource(
      resources,
      record.name ??
        record.title ??
        record.label ??
        record.resourceName ??
        record.resource_name ??
        record.id ??
        record.value
    );

    return;
  }

  const text = safeString(value).trim();

  if (text && !resources.includes(text)) {
    resources.push(text);
  }
}

function inferKnownPrinterResources(raw: AnyRecord) {
  const json = safeJson(raw);
  const normalizedJson = normalizeText(json);
  const compactJson = compactText(json);

  const resources: string[] = [];

  for (const knownResource of KNOWN_PRINTER_RESOURCES) {
    const normalizedKnown = normalizeText(knownResource);
    const compactKnown = compactText(knownResource);

    const shortNameMatch = knownResource.match(/Bambu\s+A\d(?:\s+AMS)?/i);
    const shortName = shortNameMatch?.[0] || knownResource;

    const normalizedShort = normalizeText(shortName);
    const compactShort = compactText(shortName);

    if (
      normalizedJson.includes(normalizedKnown) ||
      compactJson.includes(compactKnown) ||
      normalizedJson.includes(normalizedShort) ||
      compactJson.includes(compactShort)
    ) {
      resources.push(knownResource);
    }
  }

  return resources;
}

function getResourceIds(raw: AnyRecord, fallbackPrinters: string[]) {
  const resources: string[] = [];

  pushResource(resources, raw.resourceIds);
  pushResource(resources, raw.resource_ids);
  pushResource(resources, raw.resourceId);
  pushResource(resources, raw.resource_id);
  pushResource(resources, raw.resources);
  pushResource(resources, raw.resource);
  pushResource(resources, raw.rooms);
  pushResource(resources, raw.room);
  pushResource(resources, raw.roomName);
  pushResource(resources, raw.room_name);
  pushResource(resources, raw.location);
  pushResource(resources, raw.locations);
  pushResource(resources, raw.calendar);
  pushResource(resources, raw.calendarName);
  pushResource(resources, raw.calendar_name);

  for (const inferred of inferKnownPrinterResources(raw)) {
    pushResource(resources, inferred);
  }

  /*
    Important fallback:
    Some Peppi payloads only expose the selected printer in the backend
    printer list, not inside each event object. If there is exactly one
    matching printer name visible in the raw text, we use it.
  */
  const rawText = compactText(safeJson(raw));

  for (const printer of fallbackPrinters) {
    const printerShort = printer.match(/Bambu\s+A\d(?:\s+AMS)?/i)?.[0];

    if (!printerShort) continue;

    if (rawText.includes(compactText(printerShort))) {
      pushResource(resources, printer);
    }
  }

  return Array.from(new Set(resources));
}

function normalizeBooking(rawValue: unknown, fallbackPrinters: string[]): PeppiBooking | null {
  if (!rawValue || typeof rawValue !== 'object') return null;

  const raw = rawValue as AnyRecord;

  const startDate = getStartDate(raw);
  const endDate = getEndDate(raw);

  if (!startDate || !endDate) {
    console.warn('Skipping Peppi booking because start/end was not found:', raw);
    return null;
  }

  const resourceIds = getResourceIds(raw, fallbackPrinters);

  const id = safeString(
    raw.id ??
      raw.bookingId ??
      raw.booking_id ??
      raw.uid ??
      raw.eventId ??
      raw.event_id ??
      `${startDate.toISOString()}-${safeJson(resourceIds)}`
  );

  const title = safeString(
    raw.title ??
      raw.subject ??
      raw.name ??
      raw.summary ??
      raw.text ??
      raw.description ??
      'Peppi booking'
  );

  const description = safeString(
    raw.description ??
      raw.desc ??
      raw.details ??
      raw.body ??
      raw.info ??
      ''
  );

  return {
    id,
    resourceIds,
    title,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    description,
    raw,
  };
}

function unwrapPeppiApiData(data: PeppiApiResponse | unknown[] | null) {
  if (Array.isArray(data)) {
    return {
      bookings: data,
      printers: KNOWN_PRINTER_RESOURCES,
      warning: null as string | null,
    };
  }

  if (data && typeof data === 'object') {
    const record = data as PeppiApiResponse;

    return {
      bookings: Array.isArray(record.bookings) ? record.bookings : [],
      printers: Array.isArray(record.printers)
        ? record.printers
        : KNOWN_PRINTER_RESOURCES,
      warning: record.warning ?? null,
    };
  }

  return {
    bookings: [],
    printers: KNOWN_PRINTER_RESOURCES,
    warning: null as string | null,
  };
}

async function fetchPeppiApiRaw() {
  const response = await fetch(API_URL);

  const data: PeppiApiResponse | unknown[] | null = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      !Array.isArray(data)
        ? data?.details || data?.error || `Peppi API error: ${response.status}`
        : `Peppi API error: ${response.status}`
    );
  }

  return unwrapPeppiApiData(data);
}

export async function fetchPeppiBookings(): Promise<PeppiBooking[]> {
  try {
    const { bookings, printers, warning } = await fetchPeppiApiRaw();

    if (warning) {
      console.warn('Peppi API warning:', warning);
    }

    const normalized = bookings
      .map((booking) => normalizeBooking(booking, printers))
      .filter((booking): booking is PeppiBooking => Boolean(booking));

    console.log('Normalized Peppi bookings today:', normalized);

    return normalized.filter((booking) => isToday(booking.start));
  } catch (error) {
    console.error('Failed to fetch Peppi bookings:', error);
    return [];
  }
}

export async function fetchAllPeppiBookings(): Promise<PeppiBooking[]> {
  try {
    const { bookings, printers, warning } = await fetchPeppiApiRaw();

    if (warning) {
      console.warn('Peppi API warning:', warning);
    }

    const normalized = bookings
      .map((booking) => normalizeBooking(booking, printers))
      .filter((booking): booking is PeppiBooking => Boolean(booking));

    console.log('Normalized all Peppi bookings:', normalized);

    return normalized;
  } catch (error) {
    console.error('Failed to fetch all Peppi bookings:', error);
    return [];
  }
}
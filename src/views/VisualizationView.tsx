import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Printer,
  RefreshCw,
  TimerReset,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PrinterData } from '../types';
import { fetchDashboard } from '../api/dashboard';
import { fetchPeppiBookings, PeppiBooking } from '../data/peppiApi';
import { mapPeppiToPrinters } from '../utils/bookingAdapter';
import { mapDashboardData } from '../utils/mapDashboardData';

interface Props {
  printers: PrinterData[];
  onBack: () => void;
}

type AnalyticsRange = '7d' | '30d';

type Tone = 'purple' | 'green' | 'red' | 'orange' | 'slate' | 'yellow';

interface ConfigPrinter {
  id: string;
  name: string;
  ip?: string;
  serial?: string;
  enabled?: boolean;
  is_pipeline_healthy?: boolean;
  health_message?: string;
  last_seen?: string;
  last_updated?: string;
}

type ExtendedPrinterData = PrinterData & {
  rawStatus?: string;
  fiwareStatus?: string;
  statusRaw?: string;
  lastSeen?: string;
  last_seen?: string;
  hasBooking?: boolean;
  bookingTitle?: string | null;
  bookingWarning?: string | null;
};

interface BookingInfo {
  printerId: string;
  printerName: string;
  hasBooking: boolean;
  bookingTitle: string | null;
  bookingId: string | null;
  userName: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface PrinterObservation {
  observedAt: string;
  printerId: string;
  printerName: string;
  status: string;
  rawStatus: string;
  progress: number;
  jobName: string;
  material: string;
  color: string;
  lastSeen: string | null;
  isActive: boolean;
  isPrinting: boolean;
  isPaused: boolean;
  hasBooking: boolean;
  bookingStatus: 'with-booking' | 'without-booking' | 'booked-idle' | 'idle' | 'error';
  bookingId: string | null;
  bookingTitle: string | null;
  usedWithBooking: boolean;
  usedWithoutBooking: boolean;
  hasError: boolean;
  errorType: string | null;
  errorMessage: string | null;
  alertCount: number;
}

interface TodaySummary {
  usedWithBooking: number;
  usedWithoutBooking: number;
  mqttErrorsToday: number;
  avgErrorResolutionMinutes: number | null;
}

interface UsageByPrinterRow {
  printerName: string;
  usedWithBooking: number;
  usedWithoutBooking: number;
  errors: number;
}

interface TrendRow {
  label: string;
  usedWithBooking: number;
  usedWithoutBooking: number;
  errors: number;
}

interface AnalyticsSummary {
  lastUpdated?: string;
  today?: Record<string, unknown>;
  todaySummary?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  range?: Record<string, unknown>;
  byPrinter?: unknown[];
  usageByPrinter?: unknown[];
  printerUsage?: unknown[];
  errorByPrinter?: unknown[];
  printers?: unknown[];
  trend?: unknown[];
  dailyTrend?: unknown[];
  days?: unknown[];
}

const OBSERVE_INTERVAL_MS = 15000;

function getBackendBaseUrlCandidates() {
  const processEnv = (globalThis as any).process?.env || {};
  const fromLocalStorage = (() => {
    try {
      return window.localStorage.getItem('printerBackendUrl');
    } catch (_err) {
      return null;
    }
  })();

  const piIp =
    processEnv.REACT_APP_RASPBERRY_PI_IP ||
    processEnv.REACT_APP_PI_IP ||
    processEnv.RASPBERRY_PI_IP ||
    '';

  const configured = [
    fromLocalStorage,
    (window as any).__PRINTER_BACKEND_URL__,
    processEnv.REACT_APP_PRINTER_BACKEND_URL,
    processEnv.REACT_APP_BACKEND_URL,
    processEnv.REACT_APP_API_BASE_URL,
    piIp ? `http://${piIp}:4000` : null,
  ];

  const host = window.location.hostname;
  const autoDetected = [
    host ? `http://${host}:4000` : null,
    'http://172.16.101.22:4000',
    'http://127.0.0.1:4000',
    'http://192.168.0.21:4000',
  ];

  return Array.from(
    new Set(
      [...configured, ...autoDetected]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim().replace(/\/$/, ''))
    )
  );
}

async function fetchWithBackendFallback(path: string, init?: RequestInit) {
  const tried: string[] = [];

  const relativeResponse = await fetch(path, init).catch((err) => {
    tried.push(`${path} -> ${err?.message || 'network error'}`);
    return null;
  });

  if (relativeResponse) {
    const contentType = relativeResponse.headers.get('content-type') || '';

    if (relativeResponse.status !== 404 && contentType.includes('application/json')) {
      return relativeResponse;
    }

    if (relativeResponse.status !== 404) {
      tried.push(`${path} -> ${relativeResponse.status} ${contentType || 'non-json response'}`);
    }
  }

  if (relativeResponse) {
    tried.push(`${path} -> ${relativeResponse.status}`);
  }

  for (const baseUrl of getBackendBaseUrlCandidates()) {
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, init).catch((err) => {
      tried.push(`${url} -> ${err?.message || 'network error'}`);
      return null;
    });

    if (response) {
      const contentType = response.headers.get('content-type') || '';

      if (response.status !== 404 && contentType.includes('application/json')) {
        return response;
      }

      tried.push(`${url} -> ${response.status} ${contentType || 'non-json response'}`);
    }
  }

  throw new Error(`API route not found. Tried: ${tried.join(', ')}`);
}

const COLORS = {
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',
  purpleMid: '#A78BFA',
  green: '#64748B',
  red: '#EF4444',
  orange: '#94A3B8',
  yellow: '#FBBF24',
  slate: '#64748B',
  border: '#E5E7EB',
};

const TONE_CLASSES: Record<Tone, { text: string; bg: string; border: string }> = {
  purple: {
    text: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
  green: {
    text: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-100',
  },
  red: {
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  orange: {
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  yellow: {
    text: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  slate: {
    text: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-100',
  },
};

function numberValue(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizePrinterKey(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace('urn:ngsi-ld:printer:', '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactPrinterName(value?: string | null) {
  const normalized = normalizePrinterKey(value);
  return normalized
    .replace(/^printer\s+/i, '')
    .replace(/^bambu\s+/i, 'Bambu ')
    .replace(/\bbambu\s+a/i, 'Bambu A')
    .replace(/\b([a-z])/, (m) => m.toUpperCase());
}

function pickNumber(source: Record<string, unknown> | undefined, keys: string[], fallback = 0) {
  if (!source) return fallback;

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return numberValue(source[key], fallback);
    }
  }

  return fallback;
}

function pickString(source: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!source) return fallback;

  for (const key of keys) {
    if (typeof source[key] === 'string' && String(source[key]).trim()) {
      return String(source[key]);
    }
  }

  return fallback;
}

function getRawStatus(printer: ExtendedPrinterData) {
  return String(
    printer.rawStatus ||
      printer.fiwareStatus ||
      printer.statusRaw ||
      printer.status ||
      ''
  ).toUpperCase();
}

function getLastSeen(printer: ExtendedPrinterData) {
  return printer.lastSeen || printer.last_seen || null;
}

function parseDateValue(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLatestObservationDate(items: PrinterObservation[]) {
  const times = items
    .map((item) => parseDateValue(item.lastSeen || item.observedAt)?.getTime() || 0)
    .filter((value) => value > 0);

  if (times.length === 0) return null;

  return new Date(Math.max(...times));
}

function isPausedPrinter(printer: ExtendedPrinterData) {
  const raw = getRawStatus(printer);
  return raw.includes('PAUSE') || raw.includes('PAUSED');
}

function isErrorPrinter(printer: ExtendedPrinterData) {
  const raw = getRawStatus(printer);
  const warning = String(printer.bookingWarning || '').toLowerCase();

  if (warning.includes('printing without peppi booking')) {
    return false;
  }

  return (
    printer.status === 'error' ||
    raw.includes('FAILED') ||
    raw.includes('FAIL') ||
    raw.includes('ERROR') ||
    raw.includes('OFFLINE') ||
    raw.includes('DISCONNECTED') ||
    (printer.alerts || 0) > 0 ||
    warning.includes('fiware') ||
    warning.includes('mqtt') ||
    warning.includes('backend unavailable') ||
    warning.includes('pipeline stale')
  );
}

function isActivePrinter(printer: ExtendedPrinterData) {
  const raw = getRawStatus(printer);

  if (isErrorPrinter(printer)) return false;
  if (printer.status === 'printing') return true;

  return (
    raw.includes('RUNNING') ||
    raw.includes('PRINT') ||
    raw.includes('PAUSE') ||
    raw.includes('PREPARE') ||
    raw.includes('SLICING')
  );
}

function getErrorReason(printer: ExtendedPrinterData) {
  const raw = getRawStatus(printer);
  const warning = printer.bookingWarning || '';

  if (warning && !warning.toLowerCase().includes('printing without peppi booking')) {
    return warning;
  }

  if ((printer.alerts || 0) > 0) {
    return `${printer.alerts} active dashboard alert${printer.alerts === 1 ? '' : 's'}`;
  }

  if (printer.status === 'error' || raw.includes('FAILED') || raw.includes('FAIL')) {
    return 'Printer or FIWARE status is failed/error';
  }

  if (raw.includes('OFFLINE') || raw.includes('DISCONNECTED')) {
    return 'MQTT/FIWARE connection appears offline';
  }

  return null;
}

function configPrinterToDashboardPrinter(printer: ConfigPrinter): PrinterData {
  const enabled = printer.enabled !== false;

  return {
    id: printer.id,
    name: printer.name,
    ip: printer.ip || '',
    status: enabled ? 'error' : 'idle',
    progress: 0,
    jobName: enabled ? 'No live FIWARE telemetry' : 'Disabled',
    timeRemaining: enabled ? 'Pipeline stale' : '-',
    elapsedTime: '-',
    nozzleTemp: 0,
    nozzleTarget: 0,
    bedTemp: 0,
    bedTarget: 0,
    material: 'Unknown',
    color: 'Unknown',
    alerts: enabled ? 1 : 0,
    hasBooking: false,
    bookingTitle: null,
    bookingWarning: enabled ? 'No FIWARE telemetry' : null,
  } as PrinterData;
}

function mergeConfigWithLiveData(
  configPrinters: ConfigPrinter[],
  livePrinters: PrinterData[],
  fallbackPrinters: PrinterData[]
): PrinterData[] {
  const liveMap = new Map<string, PrinterData>();

  for (const live of livePrinters) {
    liveMap.set(normalizePrinterKey(live.id), live);
    liveMap.set(normalizePrinterKey(live.name), live);
  }

  const basePrinters =
    configPrinters.length > 0
      ? configPrinters.map(configPrinterToDashboardPrinter)
      : fallbackPrinters;

  return basePrinters.map((base) => {
    const live =
      liveMap.get(normalizePrinterKey(base.id)) ||
      liveMap.get(normalizePrinterKey(base.name));

    if (!live) return base;

    return {
      ...base,
      ...live,
      id: base.id,
      name: base.name,
      ip: base.ip || live.ip,
      alerts: live.alerts || 0,
      bookingWarning: (live as ExtendedPrinterData).bookingWarning || null,
    };
  });
}

function createBookingMap(peppiBookings: PeppiBooking[]): Map<string, BookingInfo> {
  const mapped = mapPeppiToPrinters(peppiBookings || []);
  const bookingMap = new Map<string, BookingInfo>();

  for (const item of mapped as any[]) {
    const currentBooking = item.currentBooking || null;
    const hasBooking = Boolean(item.hasActiveBooking ?? currentBooking);

    const info: BookingInfo = {
      printerId: String(item.printerId || ''),
      printerName: String(item.printerName || item.name || ''),
      hasBooking,
      bookingTitle: currentBooking?.title || item.bookingTitle || null,
      bookingId: currentBooking?.id || item.bookingId || null,
      userName: currentBooking?.userName || currentBooking?.teacher || null,
      startTime: currentBooking?.start || currentBooking?.startTime || null,
      endTime: currentBooking?.end || currentBooking?.endTime || null,
    };

    bookingMap.set(normalizePrinterKey(info.printerId), info);
    bookingMap.set(normalizePrinterKey(info.printerName), info);
  }

  return bookingMap;
}

function attachBookings(printers: PrinterData[], bookingMap: Map<string, BookingInfo>) {
  return printers.map((printer) => {
    const booking =
      bookingMap.get(normalizePrinterKey(printer.id)) ||
      bookingMap.get(normalizePrinterKey(printer.name));

    const hasBooking = Boolean(booking?.hasBooking);
    const extended = printer as ExtendedPrinterData;
    const active = isActivePrinter(extended);

    return {
      ...printer,
      hasBooking,
      bookingTitle: booking?.bookingTitle || null,
      bookingWarning:
        active && !hasBooking
          ? 'Printing without Peppi booking'
          : extended.bookingWarning || null,
    } as PrinterData;
  });
}

function buildObservations(printers: PrinterData[]): PrinterObservation[] {
  const observedAt = new Date().toISOString();

  return printers.map((printer) => {
    const extended = printer as ExtendedPrinterData;
    const rawStatus = getRawStatus(extended);
    const active = isActivePrinter(extended);
    const paused = isPausedPrinter(extended);
    const hasBooking = Boolean(extended.hasBooking);
    const hasError = isErrorPrinter(extended);
    const errorMessage = getErrorReason(extended);
    const usedWithBooking = active && hasBooking;
    const usedWithoutBooking = active && !hasBooking;

    let bookingStatus: PrinterObservation['bookingStatus'] = 'idle';
    if (hasError) bookingStatus = 'error';
    else if (usedWithBooking) bookingStatus = 'with-booking';
    else if (usedWithoutBooking) bookingStatus = 'without-booking';
    else if (hasBooking) bookingStatus = 'booked-idle';

    return {
      observedAt,
      printerId: String(printer.id || printer.name),
      printerName: String(printer.name || printer.id),
      status: String(printer.status || 'unknown'),
      rawStatus,
      progress: Math.round(numberValue(printer.progress, 0)),
      jobName: String(printer.jobName || ''),
      material: String(printer.material || 'Unknown'),
      color: String(printer.color || 'Unknown'),
      lastSeen: getLastSeen(extended),
      isActive: active,
      isPrinting: active && !paused,
      isPaused: paused,
      hasBooking,
      bookingStatus,
      bookingId: null,
      bookingTitle: extended.bookingTitle || null,
      usedWithBooking,
      usedWithoutBooking,
      hasError,
      errorType: hasError ? 'mqtt_or_fiware' : null,
      errorMessage,
      alertCount: numberValue(printer.alerts, 0),
    };
  });
}

async function fetchAnalyticsSummary(range: AnalyticsRange): Promise<AnalyticsSummary> {
  const response = await fetchWithBackendFallback(`/api/analytics/summary?range=${range}`);

  if (!response.ok) {
    throw new Error(`Analytics summary failed: ${response.status}`);
  }

  return response.json();
}

async function postAnalyticsObservations(observations: PrinterObservation[]) {
  if (observations.length === 0) {
    return { ok: true, observed: 0, skipped: true };
  }

  const observedAt = observations[0]?.observedAt || new Date().toISOString();

  const response = await fetchWithBackendFallback('/api/analytics/observe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      observedAt,
      source: 'VisualizationView',
      observations,
      printers: observations,
      snapshot: observations,
    }),
  });

  if (!response.ok) {
    throw new Error(`Analytics observe failed: ${response.status}`);
  }

  return response.json().catch(() => ({}));
}

function normalizeTodaySummary(
  summary: AnalyticsSummary | null,
  liveStats: TodaySummary
): TodaySummary {
  const source =
    (summary?.today as Record<string, unknown> | undefined) ||
    (summary?.todaySummary as Record<string, unknown> | undefined) ||
    (summary?.totals as Record<string, unknown> | undefined) ||
    undefined;

  const usedWithBooking = pickNumber(
    source,
    ['usedWithBooking', 'used_with_booking', 'withBooking', 'with_booking', 'bookedUsage'],
    0
  );

  const usedWithoutBooking = pickNumber(
    source,
    [
      'usedWithoutBooking',
      'used_without_booking',
      'withoutBooking',
      'without_booking',
      'unbookedUsage',
    ],
    0
  );

  const mqttErrorsToday = pickNumber(
    source,
    ['mqttErrorsToday', 'mqtt_errors_today', 'mqttErrors', 'fiwareErrors', 'errors', 'errorCount'],
    0
  );

  const avgMs = pickNumber(
    source,
    ['avgErrorResolutionMs', 'averageErrorResolutionMs', 'avg_resolution_ms'],
    NaN
  );

  const avgMinutes = pickNumber(
    source,
    [
      'avgErrorResolutionMinutes',
      'averageErrorResolutionMinutes',
      'averageResolutionMinutes',
      'avgResolutionMinutes',
      'avg_resolution_minutes',
    ],
    Number.isFinite(avgMs) ? avgMs / 60000 : NaN
  );

  return {
    usedWithBooking: Math.max(usedWithBooking, liveStats.usedWithBooking),
    usedWithoutBooking: Math.max(usedWithoutBooking, liveStats.usedWithoutBooking),
    mqttErrorsToday: Math.max(mqttErrorsToday, liveStats.mqttErrorsToday),
    avgErrorResolutionMinutes: Number.isFinite(avgMinutes) ? avgMinutes : null,
  };
}

function normalizeUsageByPrinter(
  summary: AnalyticsSummary | null,
  observations: PrinterObservation[]
): UsageByPrinterRow[] {
  const source =
    summary?.byPrinter ||
    summary?.usageByPrinter ||
    summary?.printerUsage ||
    summary?.printers ||
    [];

  const normalized = (source as unknown[])
    .map((item) => {
      const row = item as Record<string, unknown>;
      const printerName = pickString(row, ['printerName', 'name', 'printer', 'printer_id'], '');

      if (!printerName) return null;

      return {
        printerName: compactPrinterName(printerName),
        usedWithBooking: pickNumber(row, ['usedWithBooking', 'withBooking', 'with_booking'], 0),
        usedWithoutBooking: pickNumber(row, ['usedWithoutBooking', 'withoutBooking', 'without_booking'], 0),
        errors: pickNumber(row, ['errors', 'errorCount', 'mqttErrors', 'fiwareErrors'], 0),
      };
    })
    .filter(Boolean) as UsageByPrinterRow[];

  if (normalized.some((row) => row.usedWithBooking || row.usedWithoutBooking || row.errors)) {
    return normalized;
  }

  return observations.map((obs) => ({
    printerName: compactPrinterName(obs.printerName),
    usedWithBooking: obs.usedWithBooking ? 1 : 0,
    usedWithoutBooking: obs.usedWithoutBooking ? 1 : 0,
    errors: obs.hasError ? 1 : 0,
  }));
}

function buildEmptyTrend(range: AnalyticsRange): TrendRow[] {
  const days = range === '7d' ? 7 : 30;
  const today = new Date();

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));

    return {
      label: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      usedWithBooking: 0,
      usedWithoutBooking: 0,
      errors: 0,
    };
  });
}

function normalizeTrend(
  summary: AnalyticsSummary | null,
  range: AnalyticsRange,
  liveStats: TodaySummary
): TrendRow[] {
  const source =
    summary?.trend ||
    summary?.dailyTrend ||
    summary?.days ||
    (summary?.range as Record<string, unknown> | undefined)?.daily ||
    [];

  const normalized = (source as unknown[])
    .map((item) => {
      const row = item as Record<string, unknown>;
      const rawLabel = pickString(row, ['label', 'day', 'date'], '');
      const label = rawLabel.length === 10 && rawLabel.includes('-')
        ? new Date(`${rawLabel}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : rawLabel;

      if (!label) return null;

      return {
        label,
        usedWithBooking: pickNumber(row, ['usedWithBooking', 'withBooking', 'with_booking'], 0),
        usedWithoutBooking: pickNumber(row, ['usedWithoutBooking', 'withoutBooking', 'without_booking'], 0),
        errors: pickNumber(row, ['errors', 'errorCount', 'mqttErrors', 'fiwareErrors'], 0),
      };
    })
    .filter(Boolean) as TrendRow[];

  const base = normalized.length ? normalized : buildEmptyTrend(range);
  const lastIndex = base.length - 1;

  if (lastIndex >= 0) {
    base[lastIndex] = {
      ...base[lastIndex],
      usedWithBooking: Math.max(base[lastIndex].usedWithBooking, liveStats.usedWithBooking),
      usedWithoutBooking: Math.max(base[lastIndex].usedWithoutBooking, liveStats.usedWithoutBooking),
      errors: Math.max(base[lastIndex].errors, liveStats.mqttErrorsToday),
    };
  }

  return base;
}

const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    {children}
  </div>
);

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  tone?: Tone;
}> = ({ title, value, subtitle, icon, tone = 'purple' }) => {
  const style = TONE_CLASSES[tone];

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute left-0 top-0 h-1 w-full ${style.bg}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className={`mt-3 text-4xl font-black ${style.text}`}>{value}</p>
          <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${style.bg} ${style.border} ${style.text}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
};

const SectionTitle: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}> = ({ icon, title, subtitle }) => (
  <div className="mb-4 flex items-start justify-between gap-4">
    <div>
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
        <span className="text-purple-700">{icon}</span>
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  </div>
);

function formatResolution(value: number | null) {
  if (value === null) return '--';
  if (value < 1) return '<1 min';
  if (value < 60) return `${Math.round(value)} min`;

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}h ${minutes}m`;
}

export const VisualizationView: React.FC<Props> = ({ printers, onBack }) => {
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [livePrinters, setLivePrinters] = useState<PrinterData[]>(printers);
  const [observations, setObservations] = useState<PrinterObservation[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observeWarning, setObserveWarning] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const observeInFlightRef = useRef(false);

  const loadAnalytics = useCallback(
    async (silent = false) => {
      if (observeInFlightRef.current) return;
      observeInFlightRef.current = true;

      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        setError(null);
        setObserveWarning(null);

        const [dashboardData, peppiBookings] = await Promise.all([
          fetchDashboard(),
          fetchPeppiBookings(),
        ]);

        const mappedFiwarePrinters: PrinterData[] = mapDashboardData(
          dashboardData?.printers || []
        );

        const mergedPrinters = mergeConfigWithLiveData(
          dashboardData?.configPrinters || [],
          mappedFiwarePrinters,
          printers
        );

        const bookingMap = createBookingMap(peppiBookings || []);
        const mergedWithBookings = attachBookings(mergedPrinters, bookingMap);
        const nextObservations = buildObservations(mergedWithBookings);
        const latestHandshake = getLatestObservationDate(nextObservations);

        setLivePrinters(mergedWithBookings);
        setObservations(nextObservations);
        setLastUpdated(latestHandshake || new Date());

        // Important: render the dashboard immediately after live data is ready.
        // Analytics storage/summary can fail without freezing the page.
        setLoading(false);
        setRefreshing(false);

        postAnalyticsObservations(nextObservations)
          .then(() => fetchAnalyticsSummary(range))
          .then((nextSummary) => {
            setSummary(nextSummary);
            setLastUpdated(
              latestHandshake || parseDateValue(nextSummary.lastUpdated) || new Date()
            );
          })
          .catch((analyticsErr: any) => {
            console.warn('Analytics background sync failed:', analyticsErr);
            setObserveWarning(
              'Live data is shown. Historical analytics storage is currently offline.'
            );
          });
      } catch (err: any) {
        console.error('Visualization analytics load failed:', err);
        setError(err?.message || 'Live analytics data could not be loaded.');
        setLoading(false);
        setRefreshing(false);
      } finally {
        observeInFlightRef.current = false;
      }
    },
    [printers, range]
  );

  useEffect(() => {
    loadAnalytics(false);

    const interval = window.setInterval(() => {
      loadAnalytics(true);
    }, OBSERVE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [loadAnalytics]);

  const liveStats = useMemo<TodaySummary>(() => {
    return observations.reduce(
      (acc, obs) => {
        if (obs.usedWithBooking) acc.usedWithBooking += 1;
        if (obs.usedWithoutBooking) acc.usedWithoutBooking += 1;
        if (obs.hasError) acc.mqttErrorsToday += 1;
        return acc;
      },
      {
        usedWithBooking: 0,
        usedWithoutBooking: 0,
        mqttErrorsToday: 0,
        avgErrorResolutionMinutes: null,
      }
    );
  }, [observations]);

  const todaySummary = useMemo(
    () => normalizeTodaySummary(summary, liveStats),
    [summary, liveStats]
  );

  const usageByPrinter = useMemo(
    () => normalizeUsageByPrinter(summary, observations),
    [summary, observations]
  );

  const trendData = useMemo(
    () => normalizeTrend(summary, range, liveStats),
    [summary, range, liveStats]
  );

  const complianceData = useMemo(
    () => [
      {
        name: 'With booking',
        value: todaySummary.usedWithBooking,
        color: COLORS.purple,
      },
      {
        name: 'Without booking',
        value: todaySummary.usedWithoutBooking,
        color: COLORS.yellow,
      },
      {
        name: 'Booked but idle',
        value: Math.max(
          observations.filter((obs) => obs.bookingStatus === 'booked-idle').length,
          0
        ),
        color: COLORS.orange,
      },
    ].filter((item) => item.value > 0),
    [todaySummary, observations]
  );

  const activeObservations = useMemo(
    () => observations.filter((obs) => obs.isActive),
    [observations]
  );

  const pausedObservations = useMemo(
    () => observations.filter((obs) => obs.isPaused),
    [observations]
  );

  const attentionItems = useMemo(() => {
    const withoutBooking = observations
      .filter((obs) => obs.usedWithoutBooking)
      .map((obs) => ({
        printerName: obs.printerName,
        tone: 'yellow' as Tone,
        title: 'Printing without Peppi booking',
        subtitle: `${obs.progress}% • ${obs.jobName || 'Active job'}`,
      }));

    const errors = observations
      .filter((obs) => obs.hasError)
      .map((obs) => ({
        printerName: obs.printerName,
        tone: 'orange' as Tone,
        title: obs.errorMessage || 'MQTT/FIWARE issue',
        subtitle: `${obs.status} • ${obs.rawStatus || 'No raw status'}`,
      }));

    const paused = observations
      .filter((obs) => obs.isPaused && !obs.hasError)
      .map((obs) => ({
        printerName: obs.printerName,
        tone: 'purple' as Tone,
        title: 'Paused print job',
        subtitle: `${obs.progress}% • ${obs.hasBooking ? 'Booking exists' : 'No booking'}`,
      }));

    return [...withoutBooking, ...errors, ...paused];
  }, [observations]);

  const totalObserved = observations.length || livePrinters.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 p-6 pb-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex justify-end">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-3 shadow-sm">
            <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-2 text-center shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">
                Sync time
              </p>
              <p className="text-base font-black text-purple-800 leading-tight">
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'No data'}
              </p>
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {(['7d', '30d'] as AnalyticsRange[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setRange(item)}
                  className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                    range === item
                      ? 'bg-purple-600 text-white shadow-[0_8px_18px_rgba(124,58,237,0.22)]'
                      : 'text-slate-500 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  {item === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
            </div>

            <button
              onClick={() => loadAnalytics(true)}
              disabled={refreshing}
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-purple-600 to-fuchsia-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(124,58,237,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(124,58,237,0.38)] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw
                size={17}
                className={refreshing ? 'animate-spin' : 'transition group-hover:rotate-180'}
              />
              Sync now
            </button>
          </div>
        </div>

        {observeWarning && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-purple-100 bg-white px-5 py-3 text-sm font-bold text-slate-500 shadow-sm">
            <span>
              <span className="text-purple-700">Live mode:</span> {observeWarning}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">
            <span className="text-purple-700">Dashboard note:</span> {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-96 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-purple-600" />
              <p className="mt-4 text-sm font-bold text-slate-500">
                Loading live printer observations...
              </p>
            </div>
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Used with booking"
                value={todaySummary.usedWithBooking}
                subtitle="Active printing/paused jobs matched with Peppi"
                icon={<CalendarCheck size={24} />}
                tone="purple"
              />

              <StatCard
                title="Used without booking"
                value={todaySummary.usedWithoutBooking}
                subtitle="Active jobs without a matching Peppi booking"
                icon={<AlertTriangle size={24} />}
                tone={todaySummary.usedWithoutBooking > 0 ? 'red' : 'green'}
              />

              <StatCard
                title="MQTT/FIWARE errors"
                value={todaySummary.mqttErrorsToday}
                subtitle="Today, excluding booking-only warnings"
                icon={<Activity size={24} />}
                tone={todaySummary.mqttErrorsToday > 0 ? 'orange' : 'green'}
              />

              <StatCard
                title="Avg resolution time"
                value={formatResolution(todaySummary.avgErrorResolutionMinutes)}
                subtitle="Calculated by backend from error open/close observations"
                icon={<TimerReset size={24} />}
                tone="slate"
              />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
              <Card className="xl:col-span-2">
                <SectionTitle
                  icon={<CalendarCheck size={20} />}
                  title="Booking compliance"
                  subtitle="Only real printer activity is counted as usage. Peppi-only bookings are not counted as printer use."
                />

                {complianceData.length === 0 ? (
                  <div className="flex h-72 items-center justify-center rounded-2xl bg-slate-50 text-sm font-bold text-slate-400">
                    No active usage observation yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={complianceData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={98}
                        paddingAngle={4}
                      >
                        {complianceData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card className="xl:col-span-3">
                <SectionTitle
                  icon={<Printer size={20} />}
                  title="Usage by printer"
                  subtitle="With-booking usage, without-booking usage, and MQTT/FIWARE error samples."
                />

                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={usageByPrinter}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                    <XAxis dataKey="printerName" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="usedWithBooking" name="With booking" fill={COLORS.purple} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="usedWithoutBooking" name="Without booking" fill={COLORS.yellow} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="errors" name="Errors" fill={COLORS.orange} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
              <Card className="xl:col-span-3">
                <SectionTitle
                  icon={<BarChart3 size={20} />}
                  title={`${range === '7d' ? 'Weekly' : '30-day'} trend`}
                  subtitle="Usage and error trend from the analytics summary endpoint."
                />

                <ResponsiveContainer width="100%" height={290}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={range === '30d' ? 4 : 0}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="usedWithBooking"
                      name="With booking"
                      stroke={COLORS.purple}
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="usedWithoutBooking"
                      name="Without booking"
                      stroke={COLORS.yellow}
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="errors"
                      name="Errors"
                      stroke={COLORS.orange}
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="xl:col-span-2">
                <SectionTitle
                  icon={<Clock3 size={20} />}
                  title="Live attention panel"
                  subtitle={`${activeObservations.length} active job(s), ${pausedObservations.length} paused job(s), ${totalObserved} observed printer(s).`}
                />

                {attentionItems.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3 text-emerald-700">
                      <CheckCircle2 size={22} />
                      <p className="font-black">No immediate attention needed</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-emerald-700/80">
                      No unbooked active printing, MQTT/FIWARE errors, or paused jobs were detected in the latest observation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attentionItems.slice(0, 6).map((item, index) => {
                      const style = TONE_CLASSES[item.tone];

                      return (
                        <div
                          key={`${item.printerName}-${item.title}-${index}`}
                          className={`rounded-2xl border p-4 ${style.bg} ${style.border} ${item.tone === 'yellow' ? 'animate-pulse ring-2 ring-red-200/70' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-950">
                                {item.printerName}
                              </p>
                              <p className={`mt-1 text-sm font-bold ${style.text}`}>
                                {item.title}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                {item.subtitle}
                              </p>
                            </div>
                            <AlertTriangle size={18} className={style.text} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {observations.map((obs) => {
                const tone: Tone = obs.hasError
                  ? 'red'
                  : obs.usedWithoutBooking
                  ? 'yellow'
                  : obs.usedWithBooking
                  ? 'purple'
                  : obs.hasBooking
                  ? 'slate'
                  : 'green';
                const style = TONE_CLASSES[tone];

                return (
                  <div
                    key={obs.printerId}
                    className={`rounded-3xl border bg-white p-4 shadow-sm ${style.border} ${obs.usedWithoutBooking ? 'animate-pulse ring-2 ring-red-200/70' : ''} ${obs.hasError ? 'ring-2 ring-red-200/80' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-black text-slate-950">
                          {obs.printerName}
                        </h3>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                          {obs.rawStatus || obs.status}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${style.bg} ${style.text}`}>
                        {obs.bookingStatus.replace('-', ' ')}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-400">Progress</p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                          {obs.progress}%
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-400">Booking</p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                          {obs.hasBooking ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-400">Error</p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                          {obs.hasError ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>

                    {obs.bookingTitle && (
                      <p className="mt-3 truncate text-sm font-medium text-slate-500">
                        {obs.bookingTitle}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

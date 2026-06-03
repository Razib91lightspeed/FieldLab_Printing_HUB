import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { PrinterCard } from '../components/printer/PrinterCard';

import { fetchDashboard } from '../api/dashboard';
import { fetchPeppiBookings } from '../data/peppiApi';

import { PrinterData } from '../types';
import { mapDashboardData } from '../utils/mapDashboardData';
import { mapPeppiToPrinters } from '../utils/bookingAdapter';

interface Props {
  printers: PrinterData[];
  onSelectPrinter: (printer: PrinterData) => void;
  onViewAlerts: () => void;
}

interface ConfigPrinter {
  id: string;
  name: string;
  ip: string;
  access_code?: string;
  serial: string;
  enabled: boolean;
  is_pipeline_healthy?: boolean;

  // These may come from your backend/config health logic.
  health_message?: string | null;
  healthMessage?: string | null;
  last_error?: string | null;
  lastError?: string | null;
  error?: string | null;
  status_message?: string | null;
  pipeline_status?: string | null;

  last_seen?: string;
  last_updated?: string;

  [key: string]: any;
}

function normalizePrinterKey(value?: string) {
  return String(value || '')
    .toLowerCase()
    .replace('urn:ngsi-ld:printer:', '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBookingDate(value?: string | null): Date | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatBookingTime(value?: string | null): string {
  const date = parseBookingDate(value);

  if (!date) {
    return '';
  }

  return date.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function buildBookingBadge(booking: any) {
  const currentBooking = booking?.currentBooking || null;
  const nextBooking = booking?.nextBooking || null;

  if (currentBooking) {
    const startText = formatBookingTime(currentBooking.start);
    const endText = formatBookingTime(currentBooking.end);

    return {
      bookingStatusText: endText ? `Reserved until ${endText}` : 'Reserved',
      bookingStatusTone: 'reserved' as const,
      bookingPeriodText:
        startText && endText ? `${startText}–${endText}` : null,
    };
  }

  if (nextBooking) {
    const nextStartText = formatBookingTime(nextBooking.start);
    const nextEndText = formatBookingTime(nextBooking.end);

    return {
      bookingStatusText: nextStartText
        ? `Free until ${nextStartText}`
        : 'Free now',
      bookingStatusTone: 'free' as const,
      bookingPeriodText:
        nextStartText && nextEndText
          ? `Next booking: ${nextStartText}–${nextEndText}`
          : null,
    };
  }

  return {
    bookingStatusText: 'Free now',
    bookingStatusTone: 'free' as const,
    bookingPeriodText: null,
  };
}

/*
  This function is intentionally strict.

  It should NOT mark every stale FIWARE printer as Access Code Error.
  It only returns access-code warning when the config/backend explicitly gives
  access-code, MQTT, auth, password, or pipeline/access-code style information.
*/
function getAccessCodeWarning(printer: ConfigPrinter): string | null {
  if (!printer.enabled) {
    return null;
  }

  const combinedText = [
    printer.health_message,
    printer.healthMessage,
    printer.last_error,
    printer.lastError,
    printer.error,
    printer.status_message,
    printer.pipeline_status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const hasAccessCodeSignal =
    combinedText.includes('access code') ||
    combinedText.includes('mqtt') ||
    combinedText.includes('unauthorized') ||
    combinedText.includes('authentication') ||
    combinedText.includes('auth') ||
    combinedText.includes('password') ||
    combinedText.includes('wrong code') ||
    combinedText.includes('code may be wrong') ||
    combinedText.includes('pipeline / access code');

  const hasPipelineProblem =
    printer.is_pipeline_healthy === false ||
    combinedText.includes('pipeline') ||
    combinedText.includes('not receiving fresh telemetry') ||
    combinedText.includes('not alive');

  if (hasAccessCodeSignal && hasPipelineProblem) {
    return 'Access code error: printer MQTT/FIWARE pipeline is not receiving fresh telemetry. Check the current printer access code.';
  }

  return null;
}

function isAccessCodeWarning(value?: string | null): boolean {
  const text = String(value || '').toLowerCase();

  return (
    text.includes('access code error') ||
    text.includes('access code') ||
    text.includes('mqtt') ||
    text.includes('unauthorized') ||
    text.includes('authentication') ||
    text.includes('wrong code')
  );
}

function configPrinterToDashboardPrinter(printer: ConfigPrinter): PrinterData {
  const accessCodeWarning = getAccessCodeWarning(printer);

  return {
    id: printer.id,
    name: printer.name,
    ip: printer.ip,

    status: printer.enabled ? 'error' : 'idle',
    progress: 0,

    jobName: printer.enabled ? 'No live FIWARE telemetry' : 'Disabled',
    timeRemaining: printer.enabled ? 'Pipeline stale' : '-',
    elapsedTime: '-',

    nozzleTemp: 0,
    nozzleTarget: 0,

    bedTemp: 0,
    bedTarget: 0,

    material: 'Unknown',
    color: 'Unknown',

    alerts: printer.enabled ? 1 : 0,

    hasBooking: false,
    bookingTitle: null,
    bookingWarning:
      accessCodeWarning || (printer.enabled ? 'No FIWARE telemetry' : null),

    bookingStatusText: 'Free now',
    bookingStatusTone: 'free',
    bookingPeriodText: null,
  };
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

    if (!live) {
      return base;
    }

    const accessCodeWarning = isAccessCodeWarning(base.bookingWarning)
      ? base.bookingWarning
      : null;

    /*
      Normal case:
      Trust live FIWARE data.

      Access-code case:
      Do NOT trust stale FIWARE status like FAILED/FINISHED.
      Force the card to show Access Code Error.
    */
    return {
      ...base,
      ...live,

      id: base.id,
      name: base.name,
      ip: base.ip || live.ip,

      status: accessCodeWarning ? 'error' : live.status,

      alerts: accessCodeWarning
        ? Math.max(base.alerts || 0, live.alerts || 0, 1)
        : live.alerts || 0,

      bookingWarning: accessCodeWarning
        ? accessCodeWarning
        : live.bookingWarning || null,
    };
  });
}

export const FleetView: React.FC<Props> = ({
  printers,
  onSelectPrinter,
  onViewAlerts,
}) => {
  const [livePrinters, setLivePrinters] = useState<PrinterData[]>(printers);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setDashboardError('');

      const [dashboardData, peppiBookings] = await Promise.all([
        fetchDashboard(),
        fetchPeppiBookings(),
      ]);

      const mappedFiwarePrinters: PrinterData[] = mapDashboardData(
        dashboardData.printers || []
      );

      const mergedPrinters = mergeConfigWithLiveData(
        dashboardData.configPrinters || [],
        mappedFiwarePrinters,
        printers
      );

      const bookingInfo = mapPeppiToPrinters(peppiBookings || []);

      const mergedWithBookings: PrinterData[] = mergedPrinters.map((printer) => {
        const booking = bookingInfo.find(
          (item) =>
            item.printerName.toLowerCase() === printer.name.toLowerCase() ||
            item.printerId === printer.id
        );

        const hasBooking = !!booking?.hasActiveBooking;
        const isPrinting = printer.status === 'printing';

        const bookingWarning =
          isPrinting && !hasBooking
            ? 'Printing without Peppi booking'
            : printer.bookingWarning || null;

        const bookingBadge = buildBookingBadge(booking);

        return {
          ...printer,
          hasBooking,
          bookingTitle: booking?.currentBooking?.title || null,
          bookingWarning,

          bookingStatusText: bookingBadge.bookingStatusText,
          bookingStatusTone: bookingBadge.bookingStatusTone,
          bookingPeriodText: bookingBadge.bookingPeriodText,

          alerts: printer.alerts || 0,
        };
      });

      setLivePrinters(mergedWithBookings);
      setLoading(false);
    } catch (err: any) {
      console.error('Dashboard load failed', err);

      setDashboardError(err?.message || 'Dashboard backend is not reachable.');

      const fallback = printers.map((printer) => ({
        ...printer,
        status: 'error' as const,
        progress: 0,
        jobName: 'Backend unavailable',
        timeRemaining: 'No connection',
        alerts: Math.max(printer.alerts || 0, 1),
        bookingWarning: 'Dashboard backend unavailable',
        bookingStatusText: 'Booking unavailable',
        bookingStatusTone: 'unknown' as const,
        bookingPeriodText: null,
      }));

      setLivePrinters(fallback);
      setLoading(false);
    }
  };

  const activeCount = livePrinters.filter(
    (printer) => printer.status === 'printing'
  ).length;

  const totalAlerts = livePrinters.reduce(
    (sum, printer) => sum + (printer.alerts || 0),
    0
  );

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-lab-text">Lab Overview</h1>

          <p className="text-lab-subtext mt-1">
            Real-time monitoring of {livePrinters.length || 5} active stations
          </p>

          {dashboardError && (
            <p className="text-red-500 text-sm mt-2">{dashboardError}</p>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onViewAlerts}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-lab-secondary text-lab-primary rounded-lg shadow-sm hover:bg-lab-accent transition-colors"
          >
            <AlertCircle size={18} />
            <span>View Alerts</span>
          </button>

          <div className="text-right">
            <div className="text-2xl font-bold text-lab-primary">
              {activeCount}
            </div>
            <div className="text-xs text-lab-subtext uppercase tracking-wide">
              Active Jobs
            </div>
          </div>
        </div>
      </header>

      {totalAlerts > 0 && (
        <div className="mb-5 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          {totalAlerts} dashboard warning{totalAlerts === 1 ? '' : 's'} detected.
          Some printers may have telemetry, booking, or pipeline warnings.
        </div>
      )}

      {loading ? (
        <div className="text-lab-subtext">Loading printers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {livePrinters.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              onClick={() => onSelectPrinter(printer)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { PrinterCard } from '../components/printer/PrinterCard';

import { fetchDashboard } from '../api/dashboard';
import { fetchPrinterConfig } from '../api/settings';
import { fetchPeppiBookings } from '../data/peppiApi';

import { PrinterData } from '../types';
import { mapPeppiToPrinters } from '../utils/bookingAdapter';
import { mapDashboardData } from '../utils/mapDashboardData';

interface Props {
  printers: PrinterData[];
  onSelectPrinter: (printer: PrinterData) => void;
  onViewAlerts: () => void;
}

interface PrinterConfigItem {
  id: string;
  name: string;
  ip: string;
  access_code: string;
  serial: string;
  enabled: boolean;
  is_pipeline_healthy?: boolean;
  last_seen?: string;
  last_updated?: string;
}

interface PrinterConfigResponse {
  last_updated?: string;
  fiware_endpoint?: string;
  printers: PrinterConfigItem[];
}

const VERIFY_GRACE_MINUTES = 1;

function normalizeKey(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/urn:ngsi-ld:printer:/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFiwarePrinterName(entityId: string) {
  const tail = entityId.split(':').pop() || entityId;
  return tail.replaceAll('_', ' ');
}

function parseBackendTimestamp(timestamp?: string) {
  if (!timestamp) return null;

  const match = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (match) {
    const [, y, m, d, hh, mm, ss = '00'] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getEntityLastSeen(entity: any): string | undefined {
  return (
    entity?.lastSeen?.value ||
    entity?.last_seen?.value ||
    entity?.lastSeen ||
    entity?.last_seen
  );
}

function findRawFiwareEntity(rawPrinters: any[], printerName: string) {
  const target = normalizeKey(printerName);

  return rawPrinters.find((entity) => {
    const entityName = normalizeFiwarePrinterName(entity.id || '');
    const possibleName = entity.name?.value;

    return (
      normalizeKey(entityName) === target ||
      normalizeKey(possibleName) === target ||
      normalizeKey(entity.id).includes(target)
    );
  });
}

function findPrinterConfig(
  config: PrinterConfigResponse | null,
  printer: PrinterData
): PrinterConfigItem | undefined {
  if (!config?.printers) return undefined;

  return config.printers.find((item) => {
    return (
      normalizeKey(item.name) === normalizeKey(printer.name) ||
      normalizeKey(item.id) === normalizeKey(printer.id)
    );
  });
}

function isAccessCodeNotVerified(
  configPrinter?: PrinterConfigItem,
  rawEntity?: any
): boolean {
  if (!configPrinter?.enabled) return false;

  const configUpdated = parseBackendTimestamp(configPrinter?.last_updated);
  if (!configUpdated) return false;

  const minutesAfterConfigUpdate =
    (Date.now() - configUpdated.getTime()) / (1000 * 60);

  // Give bridge time to restart and reconnect
  if (minutesAfterConfigUpdate < VERIFY_GRACE_MINUTES) {
    return false;
  }

  const lastTelemetry = parseBackendTimestamp(
    getEntityLastSeen(rawEntity) || configPrinter.last_seen
  );

  if (!lastTelemetry) return true;

  return configUpdated.getTime() > lastTelemetry.getTime();
}

export const FleetView: React.FC<Props> = ({
  printers,
  onSelectPrinter,
  onViewAlerts
}) => {
  const [livePrinters, setLivePrinters] = useState<PrinterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashboardData, peppiBookings, configData] = await Promise.all([
        fetchDashboard(),
        fetchPeppiBookings(),
        fetchPrinterConfig()
      ]);

      const rawPrinters = dashboardData.printers || [];

      const mappedPrinters: PrinterData[] = mapDashboardData(rawPrinters);
      const bookingInfo = mapPeppiToPrinters(peppiBookings || []);

      const merged: PrinterData[] = mappedPrinters.map((printer) => {
        const booking = bookingInfo.find(
          (item) =>
            item.printerName.toLowerCase() === printer.name.toLowerCase() ||
            item.printerId === printer.id
        );

        const configPrinter = findPrinterConfig(configData, printer);
        const rawEntity = findRawFiwareEntity(rawPrinters, printer.name);

        const accessCodeNotVerified = isAccessCodeNotVerified(
          configPrinter,
          rawEntity
        );

        const hasBooking = !!booking?.hasActiveBooking;
        const isPrinting = printer.status === 'printing';

        const bookingWarning =
          isPrinting && !hasBooking
            ? 'Printing without Peppi booking'
            : null;

        const accessWarning = accessCodeNotVerified
          ? 'Access code changed but no new printer telemetry received'
          : null;

        const finalWarning = accessWarning || bookingWarning;

        return {
          ...printer,
          status: accessCodeNotVerified ? 'error' : printer.status,
          hasBooking,
          bookingTitle: booking?.currentBooking?.title || null,
          bookingWarning: finalWarning,
          alerts: finalWarning ? Math.max(printer.alerts, 1) : printer.alerts
        };
      });

      setLivePrinters(merged);
      setLoading(false);
    } catch (err) {
      console.error('Dashboard load failed', err);
      setLoading(false);
    }
  };

  const activeCount = livePrinters.filter(
    (printer) => printer.status === 'printing'
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-lab-text">
            Lab Overview
          </h1>

          <p className="text-lab-subtext mt-1">
            Real-time monitoring of 5 active stations
          </p>
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
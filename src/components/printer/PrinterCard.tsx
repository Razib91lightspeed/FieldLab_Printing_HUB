import React from 'react';
import {
  Printer,
  Clock,
  Layers,
  Thermometer,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { PrinterData } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface Props {
  printer: PrinterData;
  onClick: () => void;
}

const normalizeFilamentColor = (color?: string | null) => {
  if (!color) return null;

  const value = color.trim();

  if (!value || value.toLowerCase() === 'unknown') return null;

  if (value.startsWith('#')) return value;

  return `#${value}`;
};

const getBookingBadgeClasses = (
  tone?: 'reserved' | 'free' | 'unknown'
): string => {
  if (tone === 'reserved') {
    return 'bg-orange-50 text-orange-700 border border-orange-200';
  }

  if (tone === 'free') {
    return 'bg-green-50 text-green-700 border border-green-200';
  }

  return 'bg-gray-50 text-gray-600 border border-gray-200';
};

const getPrinterStatusLabel = (printer: PrinterData): string => {
  const jobName = String(printer.jobName || '').toLowerCase();
  const timeRemaining = String(printer.timeRemaining || '').toLowerCase();
  const warning = String(printer.bookingWarning || '').toLowerCase();

  const combinedText = `${jobName} ${timeRemaining} ${warning}`;

  /*
    Normal states.
    Finished will stay green because printer.status === 'finished'.
  */
  if (printer.status !== 'error') {
    switch (printer.status) {
      case 'printing':
        return 'Printing';

      case 'finished':
        return 'Finished';

      case 'idle':
        return 'Idle';

      default:
        return 'Error';
    }
  }

  /*
    Telemetry / FIWARE / backend problems.
    These are not real print failures.
  */
  if (
    combinedText.includes('no live fiware') ||
    combinedText.includes('pipeline stale') ||
    combinedText.includes('no fiware') ||
    combinedText.includes('fiware') ||
    combinedText.includes('telemetry') ||
    combinedText.includes('backend unavailable')
  ) {
    return 'Telemetry Missing';
  }

  /*
    Connection / access-code / MQTT problems.
    These are also not real print failures.
  */
  if (
    combinedText.includes('access code') ||
    combinedText.includes('mqtt') ||
    combinedText.includes('connection') ||
    combinedText.includes('connect') ||
    combinedText.includes('unreachable') ||
    combinedText.includes('offline')
  ) {
    return 'Connection Issue';
  }

  /*
    Paused state.
  */
  if (
    combinedText.includes('paused') ||
    combinedText.includes('pause')
  ) {
    return 'Paused';
  }

  /*
    Real failure indicators.
    These should show Failed because something went wrong physically/materially.
  */
  if (
    combinedText.includes('filament runout') ||
    combinedText.includes('filament error') ||
    combinedText.includes('filament stuck') ||
    combinedText.includes('filament jam') ||
    combinedText.includes('nozzle') ||
    combinedText.includes('clog') ||
    combinedText.includes('jam') ||
    combinedText.includes('spaghetti') ||
    combinedText.includes('bed adhesion') ||
    combinedText.includes('adhesion') ||
    combinedText.includes('thermal') ||
    combinedText.includes('temperature') ||
    combinedText.includes('overheat') ||
    combinedText.includes('hms') ||
    combinedText.includes('hardware') ||
    combinedText.includes('sensor error') ||
    combinedText.includes('motor') ||
    combinedText.includes('fan error') ||
    combinedText.includes('extruder') ||
    combinedText.includes('heatbed') ||
    combinedText.includes('ams error')
  ) {
    return 'Failed';
  }

  /*
    Manual/user stop indicators.
    If someone presses Stop on the physical printer, Bambu may still report it as Failed.
    So these cases should show Stopped on the dashboard.
  */
  if (
    combinedText.includes('stopped') ||
    combinedText.includes('stop') ||
    combinedText.includes('cancelled') ||
    combinedText.includes('canceled') ||
    combinedText.includes('cancel') ||
    combinedText.includes('abort') ||
    combinedText.includes('aborted') ||
    combinedText.includes('terminated') ||
    combinedText.includes('user stopped') ||
    combinedText.includes('user cancel') ||
    combinedText.includes('manual stop') ||
    combinedText.includes('stopped by user') ||
    combinedText.includes('cancelled by user') ||
    combinedText.includes('canceled by user')
  ) {
    return 'Stopped';
  }

  /*
    Important:
    If the only text we receive is plain "Failed", we show Stopped.
    This matches your real case: pressing Stop on the physical printer appears as Failed/Error.
    Real machine failures should be caught above by specific failure keywords.
  */
  if (combinedText.includes('failed')) {
    return 'Stopped';
  }

  /*
    If progress is halfway and printer becomes error, but no real failure reason exists,
    assume it was manually stopped.
  */
  if (printer.progress > 0 && printer.progress < 100) {
    return 'Stopped';
  }

  return 'Error';
};

export const PrinterCard: React.FC<Props> = ({ printer, onClick }) => {
  const showBookingWarning = !!printer.bookingWarning;
  const filamentColor = normalizeFilamentColor(printer.color);
  const hasAlerts = (printer.alerts || 0) > 0;
  const statusLabel = getPrinterStatusLabel(printer);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all group ${
        showBookingWarning
          ? 'border-yellow-300 ring-1 ring-yellow-200'
          : 'border-lab-accent hover:border-lab-secondary'
      }`}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-4 gap-3">
        {/* Left side: icon, name, status */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              printer.status === 'error'
                ? 'bg-red-50 text-red-500'
                : 'bg-lab-accent text-lab-primary'
            }`}
          >
            <Printer size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lab-text group-hover:text-lab-primary transition-colors truncate">
              {printer.name}
            </h3>

            <div className="mt-1 max-w-[155px]">
              <StatusBadge status={printer.status} label={statusLabel} />
            </div>
          </div>
        </div>

        {/* Right side: booking badge + alert badge */}
        <div className="flex flex-col items-end gap-2 shrink-0 max-w-[175px]">
          {printer.bookingStatusText && (
            <div
              className={`
                text-[11px]
                px-2.5
                py-1
                rounded-full
                font-semibold
                leading-tight
                text-center
                whitespace-normal
                break-words
                shadow-sm
                max-w-full
                ${getBookingBadgeClasses(printer.bookingStatusTone)}
              `}
              title={printer.bookingPeriodText || printer.bookingStatusText}
            >
              {printer.bookingStatusText}
            </div>
          )}

          {hasAlerts && (
            <div className="bg-red-500 text-white text-xs font-bold min-w-6 h-6 px-2 rounded-full flex items-center justify-center animate-pulse">
              {printer.alerts}
            </div>
          )}
        </div>
      </div>

      {/* Booking warning */}
      {showBookingWarning && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-yellow-800 animate-pulse">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="text-sm font-medium leading-snug break-words min-w-0">
            {printer.bookingWarning}
          </span>
        </div>
      )}

      {/* Progress and printer data */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-lab-subtext font-medium">
              Job Progress
            </span>

            <span className="font-bold text-lab-text">
              {Math.round(printer.progress)}%
            </span>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-1000 ${
                printer.status === 'error' ? 'bg-red-500' : 'bg-lab-primary'
              }`}
              style={{
                width: `${Math.min(Math.max(printer.progress, 0), 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
          <div className="flex items-center gap-2 text-sm text-lab-subtext min-w-0">
            <Layers size={16} className="shrink-0" />
            <span className="truncate" title={printer.jobName}>
              {printer.jobName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-lab-subtext min-w-0">
            <Clock size={16} className="shrink-0" />
            <span className="truncate" title={printer.timeRemaining}>
              {printer.timeRemaining}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-lab-subtext min-w-0">
            <Thermometer size={16} className="shrink-0" />
            <span className="truncate">
              Nozzle: {Math.round(printer.nozzleTemp)}°C
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-lab-subtext min-w-0">
            <Zap size={16} className="shrink-0" />

            {filamentColor && (
              <span
                className="w-5 h-5 rounded-full border border-gray-300 shrink-0"
                style={{ backgroundColor: filamentColor }}
                title={filamentColor}
              />
            )}

            <span
              className={`truncate ${
                printer.material === 'Material status unavailable'
                  ? 'text-gray-400'
                  : ''
              }`}
              title={printer.material}
            >
              {printer.material}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
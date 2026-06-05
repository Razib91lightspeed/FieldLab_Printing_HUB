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

const getFailureDetailLabel = (printer: PrinterData): string | null => {
  const jobName = String(printer.jobName || '').toLowerCase();
  const timeRemaining = String(printer.timeRemaining || '').toLowerCase();
  const warning = String(printer.bookingWarning || '').toLowerCase();
  const rawStatus = String(printer.rawStatus || '').toLowerCase();
  const material = String(printer.material || '').toLowerCase();
  const printError = String(printer.printError || '').toLowerCase();
  const failReason = String(printer.failReason || '').toLowerCase();

  const combinedText = `
    ${jobName}
    ${timeRemaining}
    ${warning}
    ${rawStatus}
    ${material}
    ${printError}
    ${failReason}
  `.toLowerCase();

  if (
    combinedText.includes('filament runout') ||
    combinedText.includes('filament error') ||
    combinedText.includes('filament stuck') ||
    combinedText.includes('filament jam')
  ) {
    return 'Filament issue';
  }

  if (
    combinedText.includes('nozzle') ||
    combinedText.includes('clog') ||
    combinedText.includes('jam') ||
    combinedText.includes('extruder')
  ) {
    return 'Nozzle/extruder issue';
  }

  if (
    combinedText.includes('spaghetti') ||
    combinedText.includes('bed adhesion') ||
    combinedText.includes('adhesion')
  ) {
    return 'Bed adhesion issue';
  }

  if (
    combinedText.includes('thermal') ||
    combinedText.includes('temperature') ||
    combinedText.includes('overheat') ||
    combinedText.includes('heatbed')
  ) {
    return 'Temperature issue';
  }

  if (combinedText.includes('ams error')) {
    return 'AMS issue';
  }

  if (
    combinedText.includes('sensor error') ||
    combinedText.includes('sensor')
  ) {
    return 'Sensor issue';
  }

  if (
    combinedText.includes('motor') ||
    combinedText.includes('fan error') ||
    combinedText.includes('hardware') ||
    combinedText.includes('hms')
  ) {
    return 'Hardware issue';
  }

  return null;
};

const getPrinterStatusLabel = (printer: PrinterData): string => {
  const warning = String(printer.bookingWarning || '').toLowerCase();

  /*
    Highest priority:
    Real access-code authentication problem.
    This should come from backend/FleetView warning, not from generic MQTT text.
  */
  const isAccessCodeProblem =
    warning.includes('access code error') ||
    warning.includes('mqtt authentication failed') ||
    warning.includes('wrong access code') ||
    warning.includes('invalid access code') ||
    warning.includes('access code invalid') ||
    warning.includes('unauthorized') ||
    warning.includes('not authorized') ||
    warning.includes('authentication failed');

  if (isAccessCodeProblem) {
    return 'Access Code Error';
  }

  /*
    Telemetry / FIWARE / backend problem.
  */
  const isTelemetryProblem =
    warning.includes('no live fiware') ||
    warning.includes('no fiware telemetry') ||
    warning.includes('dashboard backend unavailable') ||
    warning.includes('telemetry missing') ||
    warning.includes('telemetry stale') ||
    warning.includes('pipeline stale');

  if (isTelemetryProblem) {
    return 'Telemetry Missing';
  }

  /*
    Structured printer state.
    This is the long-term logic:
    PAUSE / FAILED / STOPPED_BY_USER should come from mapDashboardData,
    not from guessing jobName/timeRemaining text.
  */
  if (printer.statusReason === 'failed') {
    const failureDetail = getFailureDetailLabel(printer);

    return failureDetail
      ? `Failed printing: ${failureDetail}`
      : 'Failed printing';
  }

  if (printer.statusReason === 'paused') {
    return 'Paused';
  }

  if (printer.statusReason === 'stopped') {
    return 'Stopped by user';
  }

  if (printer.statusReason === 'printing') {
    return 'Printing';
  }

  if (printer.statusReason === 'finished') {
    return 'Finished';
  }

  if (printer.statusReason === 'idle') {
    return 'Idle';
  }

  if (printer.statusReason === 'telemetry') {
    return 'Telemetry Missing';
  }

  if (printer.statusReason === 'access-code') {
    return 'Access Code Error';
  }

  /*
    displayStatus fallback.
    This is useful if mapDashboardData gives a clean display label.
  */
  if (printer.displayStatus) {
    if (printer.displayStatus === 'Failed printing') {
      const failureDetail = getFailureDetailLabel(printer);

      return failureDetail
        ? `Failed printing: ${failureDetail}`
        : printer.displayStatus;
    }

    return printer.displayStatus;
  }

  /*
    Old fallback for older data shape.
    This should only be used if rawStatus/statusReason are missing.
  */
  switch (printer.status) {
    case 'printing':
      return 'Printing';

    case 'finished':
      return 'Finished';

    case 'idle':
      return 'Idle';

    case 'error':
      return 'Error';

    default:
      return 'Unknown';
  }
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
      <div className="flex justify-between items-start mb-4 gap-3">
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

            <div className="mt-1 max-w-[190px]">
              <StatusBadge status={printer.status} label={statusLabel} />
            </div>
          </div>
        </div>

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

      {showBookingWarning && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-yellow-800 animate-pulse">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="text-sm font-medium leading-snug break-words min-w-0">
            {printer.bookingWarning}
          </span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-lab-subtext font-medium">Job Progress</span>

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
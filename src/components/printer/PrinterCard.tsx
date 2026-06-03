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

export const PrinterCard: React.FC<Props> = ({ printer, onClick }) => {
  const showBookingWarning = !!printer.bookingWarning;
  const filamentColor = normalizeFilamentColor(printer.color);
  const hasAlerts = (printer.alerts || 0) > 0;

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
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              printer.status === 'error'
                ? 'bg-red-50 text-red-500'
                : 'bg-lab-accent text-lab-primary'
            }`}
          >
            <Printer size={24} />
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-lab-text group-hover:text-lab-primary transition-colors truncate">
              {printer.name}
            </h3>

            <div className="mt-1">
              <StatusBadge status={printer.status} />
            </div>
          </div>
        </div>

        {/* Right side: booking badge + alert badge */}
        <div className="flex flex-col items-end gap-2 shrink-0 max-w-[170px]">
          {printer.bookingStatusText && (
            <div
              className={`text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap shadow-sm ${getBookingBadgeClasses(
                printer.bookingStatusTone
              )}`}
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
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-yellow-800 animate-pulse">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="text-sm font-medium">
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
              style={{ width: `${Math.min(Math.max(printer.progress, 0), 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
          <div className="flex items-center gap-2 text-sm text-lab-subtext min-w-0">
            <Layers size={16} className="shrink-0" />
            <span className="truncate">{printer.jobName}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-lab-subtext min-w-0">
            <Clock size={16} className="shrink-0" />
            <span className="truncate">{printer.timeRemaining}</span>
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
            >
              {printer.material}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
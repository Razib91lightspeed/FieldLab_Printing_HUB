import React from 'react';
import { LivePrinterState, PrinterConfigItem } from '../../types/settings';
import {
  formatAge,
  formatTimestamp,
  getPrinterStatus,
  validatePrinter,
} from '../../utils/printerHealth';

interface Props {
  printer: PrinterConfigItem;
  index: number;
  live?: LivePrinterState;
  dirty: boolean;
  saving: boolean;
  verificationStartedAt?: string;
  cardMessage?: string;
  cardError?: string;
  onFieldChange: (
    index: number,
    field: keyof PrinterConfigItem,
    value: string | boolean
  ) => void;
  onSave: (printer: PrinterConfigItem) => void;
}

interface DisplayStatus {
  label: string;
  color: string;
  description: string;
}

function getDisplayStatus(
  printer: PrinterConfigItem,
  live: LivePrinterState | undefined,
  dirty: boolean,
  saving: boolean,
  verificationStartedAt: string | undefined,
  cardError: string | undefined
): DisplayStatus {
  /**
   * Highest priority:
   * Backend rejected the save, for example "Access code invalid".
   */
  if (cardError) {
    return {
      label: cardError.toLowerCase().includes('access code')
        ? 'Access code invalid'
        : 'Save failed',
      color: 'text-red-600 bg-red-100 border border-red-200 animate-pulse',
      description: cardError,
    };
  }

  /**
   * User changed IP/access code/enabled locally but has not saved yet.
   * At this point the typed value is NOT validated.
   * So we must not show green "Healthy".
   */
  if (dirty && !saving) {
    return {
      label: 'Unsaved changes',
      color: 'text-yellow-700 bg-yellow-100 border border-yellow-200',
      description:
        'This typed IP/access code has not been validated yet. Press Save to test it against the printer MQTT broker.',
    };
  }

  /**
   * Save is in progress.
   */
  if (saving) {
    return {
      label: 'Checking access code...',
      color: 'text-yellow-700 bg-yellow-100 border border-yellow-200',
      description:
        'The backend is checking whether this access code can connect to the printer MQTT broker.',
    };
  }

  /**
   * Normal status from FIWARE/live telemetry.
   */
  return getPrinterStatus(printer, live, verificationStartedAt);
}

export const PrinterSettingsCard: React.FC<Props> = ({
  printer,
  index,
  live,
  dirty,
  saving,
  verificationStartedAt,
  cardMessage,
  cardError,
  onFieldChange,
  onSave,
}) => {
  const status = getDisplayStatus(
    printer,
    live,
    dirty,
    saving,
    verificationStartedAt,
    cardError
  );

  const validationError = validatePrinter(printer);
  const displayLastSeen =
    live?.telemetryUpdatedAt || live?.lastSeen || printer.last_seen;

  return (
    <div className="bg-white rounded-xl border border-lab-accent p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-lab-text">{printer.name}</h2>

          <div className="text-sm text-lab-subtext mt-1">
            Serial: {printer.serial}
          </div>

          <div className="text-xs text-lab-subtext mt-2">
            FIWARE match:{' '}
            <span className="font-mono">
              {live?.id || 'No matching live entity'}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}
          >
            {status.label}
          </div>

          <div className="text-xs text-lab-subtext max-w-md md:text-right">
            {status.description}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-lab-subtext mb-1">
            IP address
          </label>

          <input
            type="text"
            value={printer.ip}
            onChange={(e) => onFieldChange(index, 'ip', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${
              dirty ? 'border-yellow-300 bg-yellow-50' : ''
            }`}
            placeholder="10.10.3.1"
          />
        </div>

        <div>
          <label className="block text-sm text-lab-subtext mb-1">
            Current access code
          </label>

          <input
            type="text"
            value={printer.access_code}
            onChange={(e) =>
              onFieldChange(index, 'access_code', e.target.value)
            }
            className={`w-full border rounded-lg px-3 py-2 font-mono ${
              dirty ? 'border-yellow-300 bg-yellow-50' : ''
            }`}
            placeholder="Access code"
          />
        </div>

        <div>
          <label className="block text-sm text-lab-subtext mb-1">Enabled</label>

          <select
            value={printer.enabled ? 'true' : 'false'}
            onChange={(e) =>
              onFieldChange(index, 'enabled', e.target.value === 'true')
            }
            className={`w-full border rounded-lg px-3 py-2 ${
              dirty ? 'border-yellow-300 bg-yellow-50' : ''
            }`}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-lab-subtext mb-1">
            Last detected telemetry update
          </label>

          <input
            type="text"
            value={formatTimestamp(displayLastSeen)}
            readOnly
            className="w-full border rounded-lg px-3 py-2 bg-gray-50"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-lab-subtext">
            Telemetry age
          </div>

          <div className="text-sm font-medium text-lab-text">
            {formatAge(displayLastSeen)}
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-lab-subtext">
            Last known job status
          </div>

          <div className="text-sm font-medium text-lab-text">
            {live?.status || 'Unknown'}
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-lab-subtext">
            Last known online value
          </div>

          <div className="text-sm font-medium text-lab-text">
            {typeof live?.online === 'boolean' ? String(live.online) : 'Unknown'}
          </div>
        </div>
      </div>

      {dirty && !saving && !cardError && (
        <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3">
          This value has been changed locally but not saved yet. The currently
          typed access code is not trusted until the backend validates it.
        </div>
      )}

      {verificationStartedAt && !dirty && (
        <div className="mt-4 rounded-lg bg-yellow-50 text-yellow-800 px-4 py-3">
          Verification started at {formatTimestamp(verificationStartedAt)}.
          Waiting for newer FIWARE telemetry.
        </div>
      )}

      {cardError && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3">
          {cardError}
        </div>
      )}

      {!cardError && validationError && dirty && (
        <div className="mt-4 rounded-lg bg-yellow-50 text-yellow-800 px-4 py-3">
          {validationError}
        </div>
      )}

      {cardMessage && !cardError && (
        <div className="mt-4 rounded-lg bg-green-50 text-green-700 px-4 py-3">
          {cardMessage}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onSave(printer)}
          disabled={saving || !dirty || !!validationError}
          className="px-5 py-2.5 bg-lab-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Checking...' : `Save ${printer.name}`}
        </button>

        {dirty && !saving && (
          <span className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
            Unsaved changes — press Save to validate
          </span>
        )}
      </div>
    </div>
  );
};
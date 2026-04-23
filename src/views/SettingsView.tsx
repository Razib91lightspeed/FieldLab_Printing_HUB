import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchPrinterConfig,
  updatePrinterConfig,
  fetchLivePrinters,
} from '../api/settings';

interface Props {
  onBack: () => void;
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

interface LivePrinterItem {
  id: string;
  status?: { value?: string };
  online?: { value?: boolean };
  lastSeen?: { value?: string };
}

interface LivePrinterState {
  status?: string;
  online?: boolean;
  lastSeen?: string;
}

function normalizeFiwarePrinterName(entityId: string) {
  const tail = entityId.split(':').pop() || entityId;
  return tail.replaceAll('_', ' ');
}

function minutesSince(timestamp?: string) {
  if (!timestamp) return null;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60);
}

function buildLiveStateMap(printers: LivePrinterItem[]) {
  const map: Record<string, LivePrinterState> = {};

  for (const printer of printers || []) {
    const name = normalizeFiwarePrinterName(printer.id);
    map[name] = {
      status: printer.status?.value,
      online: printer.online?.value,
      lastSeen: printer.lastSeen?.value,
    };
  }

  return map;
}

function getPrinterStatus(
  printer: PrinterConfigItem,
  live?: LivePrinterState
): {
  label: string;
  color: string;
  isWarning: boolean;
} {
  if (!printer.enabled) {
    return {
      label: 'Disabled',
      color: 'text-gray-600 bg-gray-100 border border-gray-200',
      isWarning: false,
    };
  }

  if (!live) {
    return {
      label: 'Checking…',
      color: 'text-gray-600 bg-gray-100 border border-gray-200',
      isWarning: false,
    };
  }

  const ageMinutes = minutesSince(live.lastSeen);

  if (live.online === false) {
    return {
      label: 'Pipeline needs attention',
      color: 'text-red-600 bg-red-100 border border-red-200 animate-pulse',
      isWarning: true,
    };
  }

  if (ageMinutes === null || ageMinutes > 5) {
    return {
      label: 'Pipeline needs attention',
      color: 'text-red-600 bg-red-100 border border-red-200 animate-pulse',
      isWarning: true,
    };
  }

  return {
    label: 'Healthy ✓',
    color: 'text-green-700 bg-green-100 border border-green-200',
    isWarning: false,
  };
}

function isValidIp(value: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value.trim());
}

export const SettingsView: React.FC<Props> = ({ onBack }) => {
  const [config, setConfig] = useState<PrinterConfigResponse | null>(null);
  const [originalConfig, setOriginalConfig] = useState<PrinterConfigResponse | null>(null);
  const [liveStateMap, setLiveStateMap] = useState<Record<string, LivePrinterState>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');
  const [cardMessages, setCardMessages] = useState<Record<string, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadLiveOnly, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      setPageError('');

      const [configData, liveData] = await Promise.all([
        fetchPrinterConfig(),
        fetchLivePrinters(),
      ]);

      setConfig(configData);
      setOriginalConfig(JSON.parse(JSON.stringify(configData)));
      setLiveStateMap(buildLiveStateMap(liveData || []));
    } catch (err: any) {
      console.error(err);
      setPageError(err?.message || 'Could not load printer settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadLiveOnly = async () => {
    try {
      const liveData = await fetchLivePrinters();
      setLiveStateMap(buildLiveStateMap(liveData || []));
    } catch (err) {
      console.error('Failed to refresh live printer states', err);
    }
  };

  const updatePrinterField = (
    index: number,
    field: keyof PrinterConfigItem,
    value: string | boolean
  ) => {
    if (!config) return;

    const updatedPrinters = [...config.printers];
    updatedPrinters[index] = {
      ...updatedPrinters[index],
      [field]: value,
    };

    setConfig({
      ...config,
      printers: updatedPrinters,
    });

    setCardMessages((prev) => ({
      ...prev,
      [updatedPrinters[index].id]: '',
    }));

    setCardErrors((prev) => ({
      ...prev,
      [updatedPrinters[index].id]: '',
    }));
  };

  const isPrinterDirty = (printerId: string) => {
    if (!config || !originalConfig) return false;

    const current = config.printers.find((p) => p.id === printerId);
    const original = originalConfig.printers.find((p) => p.id === printerId);

    if (!current || !original) return false;

    return JSON.stringify(current) !== JSON.stringify(original);
  };

  const validatePrinter = (printer: PrinterConfigItem) => {
    if (!printer.name.trim()) return 'Printer name is missing.';
    if (!printer.serial.trim()) return 'Serial is missing.';
    if (!printer.access_code.trim()) return 'Access code is empty.';
    if (!isValidIp(printer.ip)) return 'IP address is invalid.';
    return '';
  };

  const handleSavePrinter = async (printer: PrinterConfigItem) => {
    const validationError = validatePrinter(printer);
    if (validationError) {
      setCardErrors((prev) => ({
        ...prev,
        [printer.id]: validationError,
      }));
      return;
    }

    try {
      setSavingId(printer.id);

      setCardErrors((prev) => ({
        ...prev,
        [printer.id]: '',
      }));

      const result = await updatePrinterConfig(printer.id, {
        ip: printer.ip.trim(),
        access_code: printer.access_code.trim(),
        enabled: printer.enabled,
      });

      setCardMessages((prev) => ({
        ...prev,
        [printer.id]: result?.message || 'Printer updated successfully.',
      }));

      await loadAll();
    } catch (err: any) {
      console.error(err);
      setCardErrors((prev) => ({
        ...prev,
        [printer.id]: err?.message || 'Failed to update this printer.',
      }));
    } finally {
      setSavingId(null);
    }
  };

  const summary = useMemo(() => {
    if (!config?.printers?.length) {
      return { total: 0, warningCount: 0 };
    }

    const warningCount = config.printers.filter((printer) => {
      const live = liveStateMap[printer.name];
      return getPrinterStatus(printer, live).isWarning;
    }).length;

    return {
      total: config.printers.length,
      warningCount,
    };
  }, [config, liveStateMap]);

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  if (pageError && !config) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 text-lab-subtext hover:text-lab-primary transition-colors"
        >
          ← Back
        </button>

        <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-lab-text mb-3">Printer Settings</h1>
          <p className="text-red-600 mb-4">{pageError}</p>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-lab-primary text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 text-lab-subtext hover:text-lab-primary transition-colors"
        >
          ← Back
        </button>

        <div className="bg-white rounded-xl border border-lab-accent p-6 shadow-sm">
          No settings data found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <button
        onClick={onBack}
        className="mb-6 text-lab-subtext hover:text-lab-primary transition-colors"
      >
        ← Back
      </button>

      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-lab-text">Printer Settings</h1>
          <p className="text-lab-subtext mt-1">
            Update Pi printer access codes and IP addresses without breaking the bridge.
          </p>
          {config.last_updated && (
            <p className="text-sm text-lab-subtext mt-2">
              Last config update: {new Date(config.last_updated).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <div className="bg-white rounded-xl border border-lab-accent px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-lab-subtext">Printers</div>
            <div className="text-2xl font-bold text-lab-text">{summary.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-lab-accent px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-lab-subtext">Warnings</div>
            <div className="text-2xl font-bold text-red-500">{summary.warningCount}</div>
          </div>
        </div>
      </div>

      {pageError && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-600 px-4 py-3">
          {pageError}
        </div>
      )}

      <div className="space-y-5">
        {config.printers.map((printer, index) => {
          const live = liveStateMap[printer.name];
          const status = getPrinterStatus(printer, live);
          const dirty = isPrinterDirty(printer.id);
          const validationError = validatePrinter(printer);
          const displayLastSeen = live?.lastSeen || printer.last_seen;

          return (
            <div
              key={printer.id}
              className="bg-white rounded-xl border border-lab-accent p-5 shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-lab-text">{printer.name}</h2>
                  <div className="text-sm text-lab-subtext mt-1">
                    Serial: {printer.serial}
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                  {status.label}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-lab-subtext mb-1">IP address</label>
                  <input
                    type="text"
                    value={printer.ip}
                    onChange={(e) => updatePrinterField(index, 'ip', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-lab-subtext mb-1">Current access code</label>
                  <input
                    type="text"
                    value={printer.access_code}
                    onChange={(e) => updatePrinterField(index, 'access_code', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm text-lab-subtext mb-1">Enabled</label>
                  <select
                    value={printer.enabled ? 'true' : 'false'}
                    onChange={(e) =>
                      updatePrinterField(index, 'enabled', e.target.value === 'true')
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-lab-subtext mb-1">Last seen</label>
                  <input
                    type="text"
                    value={displayLastSeen ? new Date(displayLastSeen).toLocaleString() : '-'}
                    readOnly
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                  />
                </div>
              </div>

              {cardErrors[printer.id] && (
                <div className="mt-4 rounded-lg bg-red-50 text-red-600 px-4 py-3">
                  {cardErrors[printer.id]}
                </div>
              )}

              {!cardErrors[printer.id] && validationError && dirty && (
                <div className="mt-4 rounded-lg bg-yellow-50 text-yellow-800 px-4 py-3">
                  {validationError}
                </div>
              )}

              {cardMessages[printer.id] && (
                <div className="mt-4 rounded-lg bg-green-50 text-green-700 px-4 py-3">
                  {cardMessages[printer.id]}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => handleSavePrinter(printer)}
                  disabled={savingId === printer.id || !dirty || !!validationError}
                  className="px-5 py-2.5 bg-lab-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingId === printer.id ? 'Saving...' : `Save ${printer.name}`}
                </button>

                {dirty && savingId !== printer.id && (
                  <span className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
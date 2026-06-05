import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchPrinterConfig,
  fetchLivePrinters,
  updatePrinterConfig,
} from '../api/settings';
import { PrinterSettingsCard } from '../components/printer/PrinterSettingsCard';
import {
  LivePrinterState,
  PrinterConfigItem,
  PrinterConfigResponse,
} from '../types/settings';
import {
  buildLiveStateMap,
  extractLivePrinters,
  formatTimestamp,
  getLiveForPrinter,
  getPrinterStatus,
  isPrinterDirty,
  validatePrinter,
} from '../utils/printerHealth';

interface Props {
  onBack: () => void;
}

function cloneConfig(config: PrinterConfigResponse): PrinterConfigResponse {
  return JSON.parse(JSON.stringify(config));
}

function getErrorMessage(err: any) {
  const message =
    err?.details ||
    err?.error ||
    err?.message ||
    'Something went wrong.';

  if (Array.isArray(message)) {
    return message.join('; ');
  }

  return String(message);
}

function markPrinterWaitingForVerification(
  config: PrinterConfigResponse,
  savedPrinter: PrinterConfigItem,
  savedAt: string
): PrinterConfigResponse {
  return {
    ...config,
    last_updated: savedAt,
    printers: config.printers.map((printer) =>
      printer.id === savedPrinter.id
        ? {
            ...printer,
            ip: savedPrinter.ip.trim(),
            access_code: savedPrinter.access_code.trim(),
            enabled: savedPrinter.enabled,
            last_updated: savedAt,
            is_pipeline_healthy: false,
            health_message:
              'Waiting for fresh MQTT/FIWARE telemetry after access-code update',
          }
        : printer
    ),
  };
}
function mergeBackendHealthIntoCurrentConfig(
  current: PrinterConfigResponse,
  backend: PrinterConfigResponse
): PrinterConfigResponse {
  const backendById = new Map(
    backend.printers.map((printer) => [printer.id, printer])
  );

  return {
    ...current,
    last_updated: backend.last_updated || current.last_updated,
    printers: current.printers.map((printer) => {
      const backendPrinter = backendById.get(printer.id);

      if (!backendPrinter) {
        return printer;
      }

      return {
        ...printer,

        is_pipeline_healthy: backendPrinter.is_pipeline_healthy,
        health_code: backendPrinter.health_code,
        health_message: backendPrinter.health_message,

        last_error: backendPrinter.last_error,
        last_error_at: backendPrinter.last_error_at,
        last_seen: backendPrinter.last_seen,
        last_updated: backendPrinter.last_updated,

        access_validation_at: backendPrinter.access_validation_at,
        mqtt_validation_reason: backendPrinter.mqtt_validation_reason,
      };
    }),
  };
}

export const SettingsView: React.FC<Props> = ({ onBack }) => {
  const [config, setConfig] = useState<PrinterConfigResponse | null>(null);
  const [originalConfig, setOriginalConfig] =
    useState<PrinterConfigResponse | null>(null);

  const [liveStateMap, setLiveStateMap] = useState<
    Record<string, LivePrinterState>
  >({});

  const [verificationByPrinterId, setVerificationByPrinterId] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [pageError, setPageError] = useState('');
  const [liveRefreshError, setLiveRefreshError] = useState('');

  const [cardMessages, setCardMessages] = useState<Record<string, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const [uiTick, setUiTick] = useState(Date.now());

  useEffect(() => {
    loadAll();

    const interval = setInterval(() => {
      refreshLiveOnly();
      setUiTick(Date.now());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!config) return;

    const verifiedPrinterIds: string[] = [];

    for (const printer of config.printers) {
      const verificationStartedAt = verificationByPrinterId[printer.id];
      if (!verificationStartedAt) continue;

      const dirty = isPrinterDirty(printer.id, config, originalConfig);
      if (dirty) continue;

      const live = getLiveForPrinter(printer, liveStateMap);
      const status = getPrinterStatus(printer, live, verificationStartedAt);

      if (status.label.includes('Healthy')) {
        verifiedPrinterIds.push(printer.id);
      }
    }

    if (verifiedPrinterIds.length === 0) return;

    setVerificationByPrinterId((prev) => {
      const next = { ...prev };

      for (const id of verifiedPrinterIds) {
        delete next[id];
      }

      return next;
    });

    setCardMessages((prev) => {
      const next = { ...prev };

      for (const id of verifiedPrinterIds) {
        next[id] = 'Verified. Fresh FIWARE telemetry received.';
      }

      return next;
    });

    setCardErrors((prev) => {
      const next = { ...prev };

      for (const id of verifiedPrinterIds) {
        next[id] = '';
      }

      return next;
    });
  }, [config, liveStateMap, verificationByPrinterId, originalConfig, uiTick]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setPageError('');
      setLiveRefreshError('');

      const configData = await fetchPrinterConfig();

      setConfig(configData);
      setOriginalConfig(cloneConfig(configData));

      try {
        const liveData = await fetchLivePrinters();
        const extractedLivePrinters = extractLivePrinters(liveData);
        const builtLiveStateMap = buildLiveStateMap(extractedLivePrinters);

        setLiveStateMap(builtLiveStateMap);
        setLiveRefreshError('');
      } catch (liveErr: any) {
        console.error('Failed to load live printer states', liveErr);

        setLiveStateMap({});
        setLiveRefreshError(
          getErrorMessage(liveErr) ||
            'Live printer telemetry is not reachable. MQTT/FIWARE pipeline may be down.'
        );
      }
    } catch (err: any) {
      console.error(err);
      setPageError(getErrorMessage(err) || 'Could not load printer settings.');
    } finally {
      setLoading(false);
    }
  };

const refreshLiveOnly = async () => {
  try {
    const [liveData, configData] = await Promise.all([
      fetchLivePrinters(),
      fetchPrinterConfig(),
    ]);

    const extractedLivePrinters = extractLivePrinters(liveData);
    const builtLiveStateMap = buildLiveStateMap(extractedLivePrinters);

    setLiveStateMap(builtLiveStateMap);
    setLiveRefreshError('');

    setConfig((prev) => {
      if (!prev) return configData;

      return mergeBackendHealthIntoCurrentConfig(prev, configData);
    });

    setOriginalConfig((prev) => {
      if (!prev) return cloneConfig(configData);

      return mergeBackendHealthIntoCurrentConfig(prev, configData);
    });
  } catch (err: any) {
    console.error('Failed to refresh live printer states', err);

    setLiveStateMap({});
    setLiveRefreshError(
      getErrorMessage(err) ||
        'Live printer telemetry is not reachable. MQTT/FIWARE pipeline may be down.'
    );
  }
};

  const updatePrinterField = (
    index: number,
    field: keyof PrinterConfigItem,
    value: string | boolean
  ) => {
    if (!config) return;

    const updatedPrinters = [...config.printers];

    const updatedPrinter = {
      ...updatedPrinters[index],
      [field]: value,
    };

    updatedPrinters[index] = updatedPrinter;

    setConfig({
      ...config,
      printers: updatedPrinters,
    });

    setCardMessages((prev) => ({
      ...prev,
      [updatedPrinter.id]: '',
    }));

    setCardErrors((prev) => ({
      ...prev,
      [updatedPrinter.id]: '',
    }));
  };

  const applySavedStateFromBackendOrFallback = (
    savedPrinter: PrinterConfigItem,
    savedAt: string,
    result: any
  ) => {
    if (result?.config?.printers) {
      const backendConfig = result.config as PrinterConfigResponse;

      setConfig(backendConfig);
      setOriginalConfig(cloneConfig(backendConfig));
      return;
    }

    setConfig((prev) => {
      if (!prev) return prev;
      return markPrinterWaitingForVerification(prev, savedPrinter, savedAt);
    });

    setOriginalConfig((prev) => {
      if (!prev) return prev;
      return markPrinterWaitingForVerification(prev, savedPrinter, savedAt);
    });
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

    const verificationStartedAt = new Date().toISOString();

    try {
      setSavingId(printer.id);

      setCardErrors((prev) => ({
        ...prev,
        [printer.id]: '',
      }));

      setCardMessages((prev) => ({
        ...prev,
        [printer.id]: 'Checking access code with printer MQTT...',
      }));

      const result = await updatePrinterConfig(printer.id, {
        ip: printer.ip.trim(),
        access_code: printer.access_code.trim(),
        enabled: printer.enabled,
      });

      setVerificationByPrinterId((prev) => ({
        ...prev,
        [printer.id]: verificationStartedAt,
      }));

      applySavedStateFromBackendOrFallback(
        printer,
        verificationStartedAt,
        result
      );

      if (result?.mqtt_validation?.ok) {
        setCardMessages((prev) => ({
          ...prev,
          [printer.id]:
            'Access code accepted. Bridge restarted. Waiting for fresh FIWARE telemetry...',
        }));
      } else if (result?.restart?.ok && result?.restart?.skipped === false) {
        setCardMessages((prev) => ({
          ...prev,
          [printer.id]:
            'Saved. Bridge restarted. Waiting for fresh FIWARE telemetry...',
        }));
      } else if (result?.restart?.skipped) {
        setCardMessages((prev) => ({
          ...prev,
          [printer.id]:
            'Saved, but bridge restart was skipped. Fresh telemetry may not arrive until the bridge reconnects.',
        }));
      } else {
        setCardMessages((prev) => ({
          ...prev,
          [printer.id]:
            'Saved. Waiting for bridge restart and fresh FIWARE telemetry...',
        }));
      }

      setTimeout(() => {
        refreshLiveOnly();
        setUiTick(Date.now());
      }, 3000);
    } catch (err: any) {
      console.error(err);

      setVerificationByPrinterId((prev) => {
        const next = { ...prev };
        delete next[printer.id];
        return next;
      });

      const message = getErrorMessage(err);

      setCardErrors((prev) => ({
        ...prev,
        [printer.id]: message,
      }));

      setCardMessages((prev) => ({
        ...prev,
        [printer.id]: '',
      }));

      await loadAll();
    } finally {
      setSavingId(null);
      setUiTick(Date.now());
    }
  };

  const dirtyByPrinterId = useMemo(() => {
    const result: Record<string, boolean> = {};

    if (!config?.printers?.length) return result;

    for (const printer of config.printers) {
      result[printer.id] = isPrinterDirty(
        printer.id,
        config,
        originalConfig
      );
    }

    return result;
  }, [config, originalConfig, uiTick]);

  const summary = useMemo(() => {
    if (!config?.printers?.length) {
      return {
        total: 0,
        warningCount: 0,
        healthyCount: 0,
      };
    }

    let warningCount = 0;
    let healthyCount = 0;

    for (const printer of config.printers) {
      const dirty = dirtyByPrinterId[printer.id];

      if (dirty) {
        warningCount += 1;
        continue;
      }

      const live = getLiveForPrinter(printer, liveStateMap);

      const status = getPrinterStatus(
        printer,
        live,
        verificationByPrinterId[printer.id]
      );

      if (status.isWarning) warningCount += 1;
      if (status.label.includes('Healthy')) healthyCount += 1;
    }

    if (liveRefreshError && warningCount === 0) {
      warningCount = config.printers.filter((printer) => printer.enabled).length;
    }

    return {
      total: config.printers.length,
      warningCount,
      healthyCount,
    };
  }, [
    config,
    liveStateMap,
    verificationByPrinterId,
    dirtyByPrinterId,
    liveRefreshError,
    uiTick,
  ]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl border border-lab-accent p-6 shadow-sm">
          Loading settings...
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-lab-text mb-3">
            Printer Settings
          </h1>

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
          <h1 className="text-3xl font-bold text-lab-text">
            Printer Settings
          </h1>

          <p className="text-lab-subtext mt-1">
            Update local Pi printer access codes and IP addresses without
            exposing secrets to FIWARE.
          </p>

          {config.last_updated && (
            <p className="text-sm text-lab-subtext mt-2">
              Last config update: {formatTimestamp(config.last_updated)}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <div className="bg-white rounded-xl border border-lab-accent px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-lab-subtext">
              Printers
            </div>
            <div className="text-2xl font-bold text-lab-text">
              {summary.total}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-lab-accent px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-lab-subtext">
              Healthy
            </div>
            <div className="text-2xl font-bold text-green-600">
              {summary.healthyCount}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-lab-accent px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-lab-subtext">
              Warnings
            </div>
            <div
              className={`text-2xl font-bold ${
                summary.warningCount > 0 ? 'text-red-500' : 'text-green-600'
              }`}
            >
              {summary.warningCount}
            </div>
          </div>
        </div>
      </div>

      {pageError && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-600 px-4 py-3">
          {pageError}
        </div>
      )}

      {liveRefreshError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3">
          <strong>Live telemetry warning:</strong> {liveRefreshError}
          <div className="mt-1 text-sm text-red-600">
            The page is not receiving fresh live printer data. Check the MQTT
            bridge, FIWARE connection, or printer access codes.
          </div>
        </div>
      )}

      <div className="mb-5 rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 text-sm text-lab-subtext">
        Access codes are saved only in the Raspberry Pi local config. FIWARE is
        used only to display live telemetry. A changed access code is not trusted
        until you press Save and the backend validates it against the printer MQTT
        broker.
      </div>

      <div className="space-y-5">
        {config.printers.map((printer, index) => {
          const live = getLiveForPrinter(printer, liveStateMap);
          const dirty = dirtyByPrinterId[printer.id] || false;

          return (
            <PrinterSettingsCard
              key={printer.id}
              printer={printer}
              index={index}
              live={live}
              dirty={dirty}
              saving={savingId === printer.id}
              verificationStartedAt={verificationByPrinterId[printer.id]}
              cardMessage={cardMessages[printer.id]}
              cardError={cardErrors[printer.id]}
              onFieldChange={updatePrinterField}
              onSave={handleSavePrinter}
            />
          );
        })}
      </div>
    </div>
  );
};
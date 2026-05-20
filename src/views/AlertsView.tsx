import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  CheckCircle2,
  History,
  RefreshCw,
} from 'lucide-react';
import { fetchLivePrinters, fetchPrinterConfig } from '../api/settings';
import { buildPrinterAlerts } from '../utils/printerAlerts';

interface Props {
  onBack: () => void;
}

function asArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.printers)) return value.printers;
  if (Array.isArray(value?.entities)) return value.entities;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export const AlertsView: React.FC<Props> = ({ onBack }) => {
  const [printerConfig, setPrinterConfig] = useState<any>(null);
  const [livePrinters, setLivePrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);

      const [configResponse, liveResponse] = await Promise.all([
        fetchPrinterConfig(),
        fetchLivePrinters(),
      ]);

      setPrinterConfig(configResponse);
      setLivePrinters(asArray(liveResponse));
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setError('Failed to load real printer alerts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    const interval = window.setInterval(() => {
      loadAlerts(true);
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  const alerts = useMemo(() => {
    return buildPrinterAlerts(printerConfig?.printers || [], livePrinters);
  }, [printerConfig, livePrinters]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-lab-subtext hover:text-lab-primary mb-6 transition-colors"
      >
        <ChevronLeft size={20} />
        Back to Fleet
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-lab-text flex items-center gap-3">
          <History className="text-lab-primary" />
          System Alerts
        </h1>

        <button
          onClick={() => loadAlerts(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-lab-accent bg-white hover:bg-lab-bg text-sm font-medium text-lab-text disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-8 text-center text-lab-subtext">
          Loading real printer alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-green-600" size={36} />
          <h2 className="text-xl font-bold text-lab-text">
            No active alerts
          </h2>
          <p className="text-lab-subtext mt-2">
            All enabled printers currently look healthy based on available
            FIWARE telemetry and local configuration.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-lab-accent overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-700">
            <AlertTriangle size={18} />
            <span className="font-semibold">
              {alerts.length} active alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>

          <table className="w-full text-left">
            <thead className="bg-lab-bg border-b border-lab-accent">
              <tr>
                <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">
                  Time
                </th>
                <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">
                  Printer
                </th>
                <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">
                  Severity
                </th>
                <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">
                  Message
                </th>
                <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="p-4 text-sm text-lab-text">
                    {alert.timestamp}
                  </td>

                  <td className="p-4 text-sm font-medium text-lab-text">
                    {alert.printerName}
                  </td>

                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : alert.severity === 'warning'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </td>

                  <td className="p-4 text-sm text-lab-text">
                    {alert.message}
                  </td>

                  <td className="p-4">
                    <span
                      className={`font-medium ${
                        alert.status === 'active'
                          ? 'text-red-500'
                          : 'text-green-600'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Layers3,
  PieChart as PieIcon,
  Printer,
  Thermometer,
  Zap,
} from 'lucide-react';
import { PrinterData, PrinterStatus } from '../types';
import { Logo } from '../components/common/Logo';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Props {
  printers: PrinterData[];
  onBack: () => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  tone?: 'purple' | 'green' | 'red' | 'gray' | 'orange';
}

const TONE_STYLES = {
  purple: {
    accent: '#7C3AED',
    soft: 'rgba(124, 58, 237, 0.10)',
  },
  green: {
    accent: '#22C55E',
    soft: 'rgba(34, 197, 94, 0.10)',
  },
  red: {
    accent: '#EF4444',
    soft: 'rgba(239, 68, 68, 0.10)',
  },
  gray: {
    accent: '#6B7280',
    soft: 'rgba(107, 114, 128, 0.10)',
  },
  orange: {
    accent: '#F97316',
    soft: 'rgba(249, 115, 22, 0.10)',
  },
};

const STATUS_COLORS: Record<PrinterStatus, string> = {
  printing: '#7C3AED',
  idle: '#9CA3AF',
  error: '#EF4444',
  finished: '#22C55E',
};

const CHART_FALLBACK_COLORS = [
  '#7C3AED',
  '#8B5CF6',
  '#A78BFA',
  '#C4B5FD',
  '#DDD6FE',
  '#06B6D4',
  '#F97316',
  '#22C55E',
];

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  tone = 'purple',
}) => {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className="rounded-2xl p-6 bg-white relative overflow-hidden"
      style={{
        boxShadow:
          '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
        border: `1px solid ${styles.soft}`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: styles.accent }}
      />
      <p className="text-xs uppercase tracking-wider font-bold mb-2 text-gray-500">
        {title}
      </p>
      <div
        className="text-4xl font-black"
        style={{ color: styles.accent }}
      >
        {value}
      </div>
      {subtext && <p className="text-sm text-gray-500 mt-2">{subtext}</p>}
    </div>
  );
};

function normalizeColorCode(color?: string | null): string | null {
  if (!color || color === 'Unknown') return null;

  const cleaned = color.trim().replace('#', '');

  if (/^[0-9A-Fa-f]{8}$/.test(cleaned)) {
    return `#${cleaned.slice(0, 6).toUpperCase()}`;
  }

  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }

  if (/^[0-9A-Fa-f]{3}$/.test(cleaned)) {
    return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`.toUpperCase();
  }

  return null;
}

function getPrinterAttentionReason(printer: PrinterData): string | null {
  const bookingWarning = (printer as PrinterData & { bookingWarning?: string | null }).bookingWarning;

  if (bookingWarning) return bookingWarning;
  if (printer.status === 'error') return 'Printer reported an error';
  if (printer.alerts > 0) return `${printer.alerts} active alert${printer.alerts > 1 ? 's' : ''}`;
  return null;
}

function getStatusLabel(status: PrinterStatus) {
  switch (status) {
    case 'printing':
      return 'Printing';
    case 'idle':
      return 'Idle';
    case 'error':
      return 'Error';
    case 'finished':
      return 'Finished';
    default:
      return status;
  }
}

const LivePrinterCard: React.FC<{ printer: PrinterData }> = ({ printer }) => {
  const attentionReason = getPrinterAttentionReason(printer);
  const color = STATUS_COLORS[printer.status];

  return (
    <div
      className="rounded-2xl p-5 bg-white relative overflow-hidden"
      style={{
        boxShadow:
          '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
        border: `1px solid ${attentionReason ? 'rgba(239,68,68,0.22)' : 'rgba(124,58,237,0.08)'}`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: attentionReason ? '#EF4444' : color }}
      />

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-black">{printer.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                backgroundColor: `${color}15`,
                color,
              }}
            >
              {getStatusLabel(printer.status)}
            </span>

            {attentionReason && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-red-100 text-red-600 animate-pulse">
                Attention
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black" style={{ color }}>
            {Math.round(printer.progress)}%
          </div>
          <div className="text-xs text-gray-500">{printer.timeRemaining}</div>
        </div>
      </div>

      {attentionReason && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 animate-pulse">
          {attentionReason}
        </div>
      )}

      <div className="mb-4">
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-1000"
            style={{
              width: `${printer.progress}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Job</div>
          <div className="font-medium text-gray-700 truncate">
            {printer.jobName || '-'}
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Material</div>
          <div className="font-medium text-gray-700 truncate">
            {printer.material || '-'}
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Nozzle</div>
          <div className="font-medium text-gray-700">
            {Math.round(printer.nozzleTemp)}°C
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Bed</div>
          <div className="font-medium text-gray-700">
            {Math.round(printer.bedTemp)}°C
          </div>
        </div>
      </div>
    </div>
  );
};

export const VisualizationView: React.FC<Props> = ({ printers, onBack }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalPrinters = printers.length;

  const printingPrinters = useMemo(
    () => printers.filter((p) => p.status === 'printing'),
    [printers]
  );

  const idlePrinters = useMemo(
    () => printers.filter((p) => p.status === 'idle'),
    [printers]
  );

  const errorPrinters = useMemo(
    () => printers.filter((p) => p.status === 'error'),
    [printers]
  );

  const finishedPrinters = useMemo(
    () => printers.filter((p) => p.status === 'finished'),
    [printers]
  );

  const attentionPrinters = useMemo(
    () => printers.filter((p) => !!getPrinterAttentionReason(p)),
    [printers]
  );

  const healthyPrinters = Math.max(totalPrinters - attentionPrinters.length, 0);

  const avgPrintingProgress = printingPrinters.length
    ? Math.round(
        printingPrinters.reduce((sum, p) => sum + (p.progress || 0), 0) /
          printingPrinters.length
      )
    : 0;

  const avgNozzleTemp = printingPrinters.length
    ? Math.round(
        printingPrinters.reduce((sum, p) => sum + (p.nozzleTemp || 0), 0) /
          printingPrinters.length
      )
    : 0;

  const hottestPrinter = [...printers].sort(
    (a, b) => (b.nozzleTemp || 0) - (a.nozzleTemp || 0)
  )[0];

  const progressChartData = printers.map((p) => ({
    name: p.name.replace('Bambu ', ''),
    progress: Math.round(p.progress || 0),
    fill: STATUS_COLORS[p.status],
  }));

  const statusPieData = [
    {
      name: 'Printing',
      value: printingPrinters.length,
      color: STATUS_COLORS.printing,
    },
    {
      name: 'Idle',
      value: idlePrinters.length,
      color: STATUS_COLORS.idle,
    },
    {
      name: 'Error',
      value: errorPrinters.length,
      color: STATUS_COLORS.error,
    },
    {
      name: 'Finished',
      value: finishedPrinters.length,
      color: STATUS_COLORS.finished,
    },
  ].filter((item) => item.value > 0);

  const temperatureData = printers.map((p) => ({
    name: p.name.replace('Bambu ', ''),
    nozzle: Math.round(p.nozzleTemp || 0),
    bed: Math.round(p.bedTemp || 0),
  }));

  const materialMap = printers.reduce((acc, printer) => {
    const key = printer.material && printer.material !== '-' ? printer.material : 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const materialData = Object.entries(materialMap).map(([name, value], index) => ({
    name,
    value,
    color: CHART_FALLBACK_COLORS[index % CHART_FALLBACK_COLORS.length],
  }));

  const filamentColorData = printers
    .map((printer, index) => {
      const color = normalizeColorCode(printer.color);
      if (!color) return null;

      return {
        name: printer.name,
        material: printer.material,
        color,
      };
    })
    .filter(Boolean) as Array<{ name: string; material: string; color: string }>;

  const attentionList = printers
    .map((printer) => ({
      name: printer.name,
      reason: getPrinterAttentionReason(printer),
    }))
    .filter((item): item is { name: string; reason: string } => !!item.reason);

  return (
    <div
      className="min-h-screen p-6 pb-24"
      style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)' }}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="mb-2">
            <Logo size="lg" />
          </div>
          <p className="text-purple-400 font-medium">Live Production Dashboard</p>
          <p className="text-xs text-gray-400 mt-1">
            Real-time fleet snapshot
          </p>
        </div>

        <div className="text-right">
          <div className="text-4xl font-black text-black">
            {currentTime.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div className="text-purple-400 font-medium text-sm mt-1">
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Printing Now"
          value={printingPrinters.length}
          subtext={`${totalPrinters} printers in fleet`}
          tone="purple"
        />
        <StatCard
          title="Healthy Printers"
          value={healthyPrinters}
          subtext={attentionPrinters.length ? `${attentionPrinters.length} need attention` : 'No active issues'}
          tone={attentionPrinters.length ? 'green' : 'green'}
        />
        <StatCard
          title="Avg Active Progress"
          value={`${avgPrintingProgress}%`}
          subtext={printingPrinters.length ? 'Across running jobs' : 'No active jobs'}
          tone="orange"
        />
        <StatCard
          title="Avg Active Nozzle"
          value={printingPrinters.length ? `${avgNozzleTemp}°C` : '--'}
          subtext={hottestPrinter ? `Hottest: ${hottestPrinter.name}` : 'No temperature data'}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div
          className="rounded-2xl p-5 bg-white col-span-2"
          style={{
            boxShadow:
              '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
            border: '1px solid rgba(124, 58, 237, 0.08)',
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="text-purple-600" size={20} />
            Live Job Progress by Printer
          </h3>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={progressChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="progress" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-2xl p-5 bg-white"
          style={{
            boxShadow:
              '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
            border: '1px solid rgba(124, 58, 237, 0.08)',
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
            <PieIcon className="text-purple-600" size={20} />
            Fleet Status
          </h3>

          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={78}
                paddingAngle={4}
                dataKey="value"
              >
                {statusPieData.map((entry, index) => (
                  <Cell key={`status-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div
          className="rounded-2xl p-5 bg-white col-span-2"
          style={{
            boxShadow:
              '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
            border: '1px solid rgba(124, 58, 237, 0.08)',
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
            <Thermometer className="text-purple-600" size={20} />
            Temperature Snapshot
          </h3>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={temperatureData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="°C" />
              <Tooltip />
              <Bar dataKey="nozzle" fill="#F97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bed" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-2xl p-5 bg-white"
          style={{
            boxShadow:
              '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
            border: '1px solid rgba(124, 58, 237, 0.08)',
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
            <Layers3 className="text-purple-600" size={20} />
            Material Mix
          </h3>

          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={materialData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                dataKey="value"
                labelLine={false}
              >
                {materialData.map((entry, index) => (
                  <Cell key={`material-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2 mt-3">
            {materialData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div
          className="rounded-2xl p-5 bg-white col-span-2"
          style={{
            boxShadow:
              '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
            border: '1px solid rgba(124, 58, 237, 0.08)',
          }}
        >
          <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
            <Printer className="text-purple-600" size={20} />
            Live Printer Panels
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {printers.map((printer) => (
              <LivePrinterCard key={printer.id} printer={printer} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-2xl p-5 bg-white"
            style={{
              boxShadow:
                '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
              border: '1px solid rgba(124, 58, 237, 0.08)',
            }}
          >
            <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="text-purple-600" size={20} />
              Attention Panel
            </h3>

            {attentionList.length === 0 ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-green-700">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={18} />
                  All printers look healthy
                </div>
                <div className="text-sm mt-1">
                  No active booking or printer issues detected.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {attentionList.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 animate-pulse"
                  >
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm mt-1">{item.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="rounded-2xl p-5 bg-white"
            style={{
              boxShadow:
                '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
              border: '1px solid rgba(124, 58, 237, 0.08)',
            }}
          >
            <h3 className="text-black font-bold text-lg mb-4 flex items-center gap-2">
              <Clock3 className="text-purple-600" size={20} />
              Filament Colors in Use
            </h3>

            {filamentColorData.length === 0 ? (
              <div className="text-sm text-gray-500">No color data available.</div>
            ) : (
              <div className="space-y-3">
                {filamentColorData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.material}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: item.color }}
                        title={item.color}
                      />
                      <div className="text-xs text-gray-400 font-mono">{item.color}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {printingPrinters.length > 0 && (
        <div className="mb-6">
          <h2 className="text-black font-bold text-lg mb-3 flex items-center gap-2">
            <Zap className="text-purple-600" size={20} />
            Currently Printing
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {printingPrinters.map((printer) => (
              <div
                key={printer.id}
                className="rounded-2xl p-5 bg-white"
                style={{
                  boxShadow:
                    '0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124, 58, 237, 0.10)',
                  borderLeft: `5px solid ${STATUS_COLORS[printer.status]}`,
                }}
              >
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-black">{printer.name}</h3>
                    <p className="text-purple-600 font-medium text-sm break-words">
                      {printer.jobName}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-3xl font-black text-purple-600">
                      {Math.round(printer.progress)}%
                    </div>
                    <p className="text-gray-500 text-sm">{printer.timeRemaining} left</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-purple-100">
                  <div>
                    <p className="text-xs text-purple-400 uppercase font-bold mb-1">Nozzle</p>
                    <p className="text-xl font-bold text-black">{Math.round(printer.nozzleTemp)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-400 uppercase font-bold mb-1">Bed</p>
                    <p className="text-xl font-bold text-black">{Math.round(printer.bedTemp)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-400 uppercase font-bold mb-1">Material</p>
                    <p className="text-xl font-bold text-black">{printer.material}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onBack}
        className="fixed bottom-6 right-6 px-6 py-3 text-white rounded-full font-bold transform transition-all duration-300 hover:translate-y-[-3px] hover:scale-105 z-50"
        style={{
          background: 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
          boxShadow:
            '0 10px 25px -5px rgba(124,58,237,0.4), 0 6px 10px -5px rgba(0,0,0,0.1)',
        }}
      >
        Exit Display Mode
      </button>
    </div>
  );
};
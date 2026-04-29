import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { PrinterCard } from '../components/printer/PrinterCard';

import { fetchDashboard } from '../api/dashboard';
import { fetchPeppiBookings } from '../data/peppiApi';

import { PrinterData } from '../types';
import { mapPeppiToPrinters } from '../utils/bookingAdapter';
import { mapDashboardData } from '../utils/mapDashboardData';

interface Props {
  printers: PrinterData[];
  onSelectPrinter: (printer: PrinterData) => void;
  onViewAlerts: () => void;
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
      const [dashboardData, peppiBookings] = await Promise.all([
        fetchDashboard(),
        fetchPeppiBookings()
      ]);

      const mappedPrinters: PrinterData[] = mapDashboardData(
        dashboardData.printers || []
      );

      const bookingInfo = mapPeppiToPrinters(peppiBookings || []);

      const merged: PrinterData[] = mappedPrinters.map((printer) => {
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
            : null;

        return {
          ...printer,
          hasBooking,
          bookingTitle: booking?.currentBooking?.title || null,
          bookingWarning,
          alerts: bookingWarning ? Math.max(printer.alerts, 1) : printer.alerts
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
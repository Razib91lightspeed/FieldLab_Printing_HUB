import React, { useEffect, useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { FleetView } from './views/FleetView';
import { PrinterDetailView } from './views/PrinterDetailView';
import { AlertsView } from './views/AlertsView';
import { VisualizationView } from './views/VisualizationView';
import { BookingVizView } from './views/BookingVizView';
import { SettingsView } from './views/SettingsView';
import { SettingsAccessView } from './views/SettingsAccessView';
import { usePrinters } from './hooks/usePrinters';
import { ViewType, PrinterData } from './types';
import { syncPiTimeFromBrowser } from './api/settings';
import { markSettingsAccessLeft } from './utils/adminAuth';

const PI_TIME_SYNC_STORAGE_KEY = 'fieldlab_pi_time_last_synced_at';
const PI_TIME_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

type AppViewType = ViewType | 'settingsAccess';

function isSettingsRelatedView(view: AppViewType) {
  return view === 'settings' || view === 'settingsAccess';
}

function App() {
  const [view, setView] = useState<AppViewType>('fleet');
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterData | null>(
    null
  );

  const { printers } = usePrinters();

  const showNavbar = view !== 'visualization' && view !== 'booking';

  const goToView = (nextView: AppViewType) => {
    const leavingSettings =
      isSettingsRelatedView(view) && !isSettingsRelatedView(nextView);

    if (leavingSettings) {
      markSettingsAccessLeft();
    }

    setView(nextView);
  };

  const handleViewChange = (nextView: ViewType) => {
    if (nextView === 'settings') {
      goToView('settingsAccess');
      return;
    }

    goToView(nextView);
  };

  useEffect(() => {
    const syncPiTime = async () => {
      try {
        const lastSyncedAtRaw = localStorage.getItem(
          PI_TIME_SYNC_STORAGE_KEY
        );

        const lastSyncedAt = lastSyncedAtRaw
          ? Number(lastSyncedAtRaw)
          : 0;

        const now = Date.now();

        const recentlySynced =
          Number.isFinite(lastSyncedAt) &&
          now - lastSyncedAt < PI_TIME_SYNC_INTERVAL_MS;

        if (recentlySynced) {
          console.log('Pi time sync skipped: recently synced.');
          return;
        }

        const result = await syncPiTimeFromBrowser();

        localStorage.setItem(PI_TIME_SYNC_STORAGE_KEY, String(now));

        console.log('Pi time synced:', result);
      } catch (error) {
        console.error('Pi time sync failed:', error);
      }
    };

    syncPiTime();
  }, []);

  const navbarView: ViewType =
    view === 'settingsAccess' ? 'settings' : view;

  return (
    <div className="min-h-screen bg-lab-bg font-sans text-lab-text">
      {showNavbar && (
        <Navbar
          currentView={navbarView}
          onViewChange={handleViewChange}
        />
      )}

      <main>
        {view === 'fleet' && (
          <FleetView
            printers={printers}
            onSelectPrinter={(printer: PrinterData) => {
              setSelectedPrinter(printer);
              goToView('detail');
            }}
            onViewAlerts={() => goToView('alerts')}
          />
        )}

        {view === 'detail' && selectedPrinter && (
          <PrinterDetailView
            printer={selectedPrinter}
            onBack={() => goToView('fleet')}
          />
        )}

        {view === 'alerts' && (
          <AlertsView onBack={() => goToView('fleet')} />
        )}

        {view === 'visualization' && (
          <VisualizationView
            printers={printers}
            onBack={() => goToView('fleet')}
          />
        )}

        {view === 'booking' && (
          <BookingVizView onBack={() => goToView('fleet')} />
        )}

        {view === 'settingsAccess' && (
          <SettingsAccessView
            onBack={() => goToView('fleet')}
            onOpenSettings={() => goToView('settings')}
          />
        )}

        {view === 'settings' && (
          <SettingsView onBack={() => goToView('settingsAccess')} />
        )}
      </main>
    </div>
  );
}

export default App;
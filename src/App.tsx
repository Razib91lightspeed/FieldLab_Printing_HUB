import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { FleetView } from './views/FleetView';
import { PrinterDetailView } from './views/PrinterDetailView';
import { AlertsView } from './views/AlertsView';
import { VisualizationView } from './views/VisualizationView';
import { BookingVizView } from './views/BookingVizView';
import { usePrinters } from './hooks/usePrinters';
import { ViewType, PrinterData } from './types';

function App() {
  const [view, setView] = useState<ViewType>('fleet');
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterData | null>(null);
  const { printers } = usePrinters();

  const showNavbar = view !== 'visualization' && view !== 'booking';

  return (
    <div className="min-h-screen bg-lab-bg font-sans text-lab-text">
      {showNavbar && <Navbar currentView={view} onViewChange={setView} />}

      <main>
        {view === 'fleet' && (
          <FleetView
            printers={printers}
            onSelectPrinter={(printer: PrinterData) => {
              setSelectedPrinter(printer);
              setView('detail');
            }}
            onViewAlerts={() => setView('alerts')}
          />
        )}

        {view === 'detail' && selectedPrinter && (
          <PrinterDetailView
            printer={selectedPrinter}
            onBack={() => setView('fleet')}
          />
        )}

        {view === 'alerts' && (
          <AlertsView onBack={() => setView('fleet')} />
        )}

        {view === 'visualization' && (
          <VisualizationView
            printers={printers}
            onBack={() => setView('fleet')}
          />
        )}

        {view === 'booking' && (
          <BookingVizView
            onBack={() => setView('fleet')}
          />
        )}
      </main>
    </div>
  );
}

export default App;
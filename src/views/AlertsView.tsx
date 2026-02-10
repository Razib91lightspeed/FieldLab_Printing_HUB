import React from 'react';
import { ChevronLeft, History } from 'lucide-react';
import { MOCK_ALERTS } from '../data/mockAlerts';

interface Props {
  onBack: () => void;
}

export const AlertsView: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-lab-subtext hover:text-lab-primary mb-6 transition-colors"
      >
        <ChevronLeft size={20} />
        Back to Fleet
      </button>
      
      <h1 className="text-3xl font-bold text-lab-text mb-6 flex items-center gap-3">
        <History className="text-lab-primary" />
        System Alerts
      </h1>

      <div className="bg-white rounded-xl shadow-sm border border-lab-accent overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-lab-bg border-b border-lab-accent">
            <tr>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Time</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Printer</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Severity</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Message</th>
              <th className="p-4 text-sm font-bold text-lab-subtext uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MOCK_ALERTS.map((alert) => (
              <tr key={alert.id} className="hover:bg-gray-50">
                <td className="p-4 text-sm text-lab-text">{alert.timestamp}</td>
                <td className="p-4 text-sm font-medium text-lab-text">{alert.printerName}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {alert.severity}
                  </span>
                </td>
                <td className="p-4 text-sm text-lab-text">{alert.message}</td>
                <td className="p-4">
                  <span className={`font-medium ${
                    alert.status === 'active' ? 'text-red-500' :
                    alert.status === 'resolved' ? 'text-green-600' :
                    'text-lab-subtext'
                  }`}>
                    {alert.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

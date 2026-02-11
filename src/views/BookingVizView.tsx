import React, { useEffect, useState } from 'react';
import { PrinterBookingStatus, BookingStatus } from '../types';
import { MOCK_PRINTER_BOOKING_STATUS } from '../data/mockBookings';
import { Logo } from '../components/common/Logo';
import { CheckCircle2, XCircle, AlertCircle, Calendar, User, Clock, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Props {
  onBack: () => void;
}

// TODO: Replace with actual Tuni.booking API call
const fetchBookingData = async (): Promise<PrinterBookingStatus[]> => {
  // Simulating API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return MOCK_PRINTER_BOOKING_STATUS;
};

const StatusCard: React.FC<{ 
  title: string; 
  count: number; 
  total: number;
  icon: React.ReactNode; 
  color: string;
  description: string;
}> = ({ title, count, total, icon, color, description }) => {
  const percentage = Math.round((count / total) * 100);
  
  return (
    <div 
      className="rounded-2xl p-6 bg-white transform transition-all duration-300 hover:translate-y-[-4px] relative overflow-hidden"
      style={{ 
        boxShadow: `
          0 4px 6px -1px rgba(0, 0, 0, 0.05),
          0 10px 15px -3px rgba(124, 58, 237, 0.1),
          0 20px 30px -5px rgba(124, 58, 237, 0.08),
          inset 0 1px 0 0 rgba(255, 255, 255, 1)
        `,
        border: `2px solid ${color}20`
      }}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: color }}
      />
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="p-3 rounded-xl"
          style={{ backgroundColor: `${color}15`, color: color }}
        >
          {icon}
        </div>
        <div>
          <p className="text-gray-500 font-medium text-sm uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-black" style={{ color }}>{count} <span className="text-gray-400 text-lg">/ {total}</span></p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{description}</p>
        <span className="font-bold text-lg" style={{ color }}>{percentage}%</span>
      </div>
      <div 
        className="mt-3 w-full bg-gray-100 rounded-full h-2"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
      >
        <div 
          className="h-2 rounded-full transition-all duration-1000"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const PrinterBookingCard: React.FC<{ data: PrinterBookingStatus }> = ({ data }) => {
  const statusConfig: Record<BookingStatus, { 
    bg: string; 
    border: string; 
    icon: React.ReactNode;
    label: string;
    description: string;
  }> = {
    'with-booking': {
      bg: 'bg-green-50',
      border: '#22C55E',
      icon: <CheckCircle2 size={24} color="#22C55E" />,
      label: 'WITH BOOKING',
      description: 'Properly booked usage'
    },
    'without-booking': {
      bg: 'bg-red-50',
      border: '#EF4444',
      icon: <XCircle size={24} color="#EF4444" />,
      label: 'NO BOOKING',
      description: 'Unauthorized usage'
    },
    'idle': {
      bg: 'bg-gray-50',
      border: '#9CA3AF',
      icon: <AlertCircle size={24} color="#9CA3AF" />,
      label: 'IDLE',
      description: 'Available for booking'
    }
  };

  const config = statusConfig[data.bookingStatus];

  return (
    <div 
      className={`${config.bg} rounded-2xl p-5 transform transition-all duration-300 hover:translate-y-[-3px] relative overflow-hidden`}
      style={{ 
        boxShadow: `
          0 4px 6px -1px rgba(0, 0, 0, 0.05),
          0 10px 15px -3px rgba(124, 58, 237, 0.08),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.8)
        `,
        border: `2px solid ${config.border}30`,
        borderLeft: `6px solid ${config.border}`
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-black mb-1">{data.printerName}</h3>
          <div className="flex items-center gap-2">
            {config.icon}
            <span className="font-bold text-sm" style={{ color: config.border }}>{config.label}</span>
          </div>
        </div>
        <div 
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{ 
            backgroundColor: data.isPrinting ? '#7C3AED' : '#9CA3AF',
            color: 'white'
          }}
        >
          {data.isPrinting ? 'PRINTING' : 'IDLE'}
        </div>
      </div>

      {data.currentBooking && (
        <div className="bg-white/60 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <User size={14} className="text-purple-600" />
            <span className="font-medium text-sm text-gray-700">{data.currentBooking.userName}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-purple-600" />
            <span className="text-sm text-gray-600 truncate">{data.currentBooking.purpose}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-purple-600" />
            <span className="text-xs text-gray-500">
              {new Date(data.currentBooking.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
              {new Date(data.currentBooking.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-200/50">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Utilization Rate</span>
        <span className="font-bold text-lg text-purple-600">{data.utilizationRate}%</span>
      </div>
      <div className="mt-2 w-full bg-white rounded-full h-1.5">
        <div 
          className="h-1.5 rounded-full bg-purple-500"
          style={{ width: `${data.utilizationRate}%` }}
        />
      </div>
    </div>
  );
};

export const BookingVizView: React.FC<Props> = ({ onBack }) => {
  const [bookingData, setBookingData] = useState<PrinterBookingStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('https://tuni.booking.system/api/v1/printer-bookings');
      // const data = await response.json();
      const data = await fetchBookingData();
      setBookingData(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch booking data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalPrinters = bookingData.length;
  const withBooking = bookingData.filter(p => p.bookingStatus === 'with-booking').length;
  const withoutBooking = bookingData.filter(p => p.bookingStatus === 'without-booking').length;
  const idlePrinters = bookingData.filter(p => p.bookingStatus === 'idle').length;
  
  const avgUtilization = totalPrinters > 0 
    ? Math.round(bookingData.reduce((acc, p) => acc + p.utilizationRate, 0) / totalPrinters)
    : 0;

  // Chart data
  const statusChartData = [
    { name: 'With Booking', value: withBooking, color: '#22C55E' },
    { name: 'Without Booking', value: withoutBooking, color: '#EF4444' },
    { name: 'Idle', value: idlePrinters, color: '#9CA3AF' }
  ].filter(d => d.value > 0);

  const utilizationData = bookingData.map(p => ({
    name: p.printerName.replace('Bambu ', ''),
    rate: p.utilizationRate,
    fill: p.bookingStatus === 'with-booking' ? '#22C55E' : 
          p.bookingStatus === 'without-booking' ? '#EF4444' : '#9CA3AF'
  }));

  return (
    <div className="min-h-screen p-6 pb-24" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="mb-2">
            <Logo size="lg" />
          </div>
          <p className="text-purple-400 font-medium">Booking Compliance Monitor</p>
          <p className="text-xs text-gray-400 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">Mock Data</span>
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={loadData}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors text-sm"
          >
            Refresh Data
          </button>
          <div className="text-right">
            <div className="text-3xl font-black text-black">
              {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner for Tuni.booking Integration */}
      <div 
        className="mb-6 p-4 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50"
        style={{ boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.05)' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-200 rounded-lg">
            <Calendar className="text-purple-700" size={20} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-purple-900">Tuni.booking System Integration</h4>
            <p className="text-sm text-purple-700">
              Currently using mock data. Connect to 
              <code className="mx-1 px-2 py-0.5 bg-purple-200 rounded text-purple-800">https://tuni.booking.system/api/v1/printer-bookings</code>
              for live data.
            </p>
          </div>
          <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold">TODO</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatusCard 
              title="With Booking"
              count={withBooking}
              total={totalPrinters}
              icon={<CheckCircle2 size={24} />}
              color="#22C55E"
              description="Properly authorized"
            />
            <StatusCard 
              title="Without Booking"
              count={withoutBooking}
              total={totalPrinters}
              icon={<XCircle size={24} />}
              color="#EF4444"
              description="Unauthorized usage"
            />
            <StatusCard 
              title="Idle & Booked"
              count={idlePrinters}
              total={totalPrinters}
              icon={<AlertCircle size={24} />}
              color="#9CA3AF"
              description="Reserved but not in use"
            />
            <StatusCard 
              title="Avg Utilization"
              count={avgUtilization}
              total={100}
              icon={<Calendar size={24} />}
              color="#7C3AED"
              description="Booking compliance rate"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Status Distribution Pie Chart */}
            <div 
              className="rounded-2xl p-5 bg-white"
              style={{ 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.08)'
              }}
            >
              <h3 className="text-black font-bold text-lg mb-4">Booking Status Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {statusChartData.map(s => (
                  <div key={s.name} className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-600">{s.name}: {s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Utilization Bar Chart */}
            <div 
              className="rounded-2xl p-5 bg-white"
              style={{ 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.08)'
              }}
            >
              <h3 className="text-black font-bold text-lg mb-4">Printer Utilization Rate</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={utilizationData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Utilization']}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Printer Detail Cards */}
          <div>
            <h2 className="text-black font-bold text-xl mb-4 flex items-center gap-2">
              <Calendar className="text-purple-600" size={24} />
              Printer Booking Details
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {bookingData.map(printer => (
                <PrinterBookingCard key={printer.printerId} data={printer} />
              ))}
            </div>
          </div>

          {/* Integration Placeholder Section */}
          <div 
            className="mt-8 p-6 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-300"
          >
            <h3 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-200 rounded text-xs">API INTEGRATION</span>
              Tuni.booking System Connection
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-800 mb-1">Endpoint:</p>
                <code className="block p-2 bg-gray-800 text-green-400 rounded-lg text-xs">
                  GET /api/v1/printer-bookings
                </code>
              </div>
              <div>
                <p className="font-medium text-gray-800 mb-1">Authentication:</p>
                <code className="block p-2 bg-gray-800 text-yellow-400 rounded-lg text-xs">
                  Bearer {'<token>'}
                </code>
              </div>
              <div className="col-span-2">
                <p className="font-medium text-gray-800 mb-1">Required Data Fields:</p>
                <div className="flex gap-2 flex-wrap">
                  {['bookingId', 'printerId', 'userName', 'startTime', 'endTime', 'status'].map(field => (
                    <span key={field} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Exit Button */}
      <button
        onClick={onBack}
        className="fixed bottom-6 right-6 px-6 py-3 text-white rounded-full font-bold transform transition-all duration-300 hover:translate-y-[-3px] z-50"
        style={{ 
          background: 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
          boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.4)'
        }}
      >
        Exit Booking View
      </button>
    </div>
  );
};

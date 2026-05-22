// Booking page
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PrinterBookingStatus, BookingStatus } from '../types';
import { fetchPeppiBookings } from '../data/peppiApi';
import { mapPeppiToPrinters } from '../utils/bookingAdapter';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCcw,
  User,
} from 'lucide-react';

interface Props {
  onBack?: () => void;
}

type AnyRecord = Record<string, any>;

type BookingKind = 'free' | 'active' | 'upcoming_today';

type BookingStatusExtended = PrinterBookingStatus & {
  bookingKind?: BookingKind;
};

const DEFAULT_PRINTERS: AnyRecord[] = [
  { printerId: 'p1', printerName: 'Bambu A1' },
  { printerId: 'p2', printerName: 'Bambu A2' },
  { printerId: 'p3', printerName: 'Bambu A3' },
  { printerId: 'p4', printerName: 'Bambu A4' },
  { printerId: 'p5', printerName: 'Bambu A5' },
];

const ROOM_ALIASES: Record<string, string[]> = {
  'Bambu A1': [
    'bambu a1',
    'a1',
    'p1',
    '3d tulostin f0 16 bambu a1',
    '3d tulostin_f0-16, bambu a1',
  ],
  'Bambu A2': [
    'bambu a2',
    'a2',
    'p2',
    '3d tulostin f0 16 bambu a2',
    '3d tulostin_f0-16, bambu a2',
  ],
  'Bambu A3': [
    'bambu a3',
    'a3',
    'p3',
    '3d tulostin f0 16 bambu a3',
    '3d tulostin_f0-16, bambu a3',
  ],
  'Bambu A4': [
    'bambu a4',
    'a4',
    'p4',
    '3d tulostin f0 16 bambu a4',
    '3d tulostin_f0-16, bambu a4',
  ],
  'Bambu A5': [
    'bambu a5',
    'a5',
    'p5',
    'bambu a5 ams',
    '3d tulostin f0 16 bambu a5 ams',
    '3d tulostin_f0-16, bambu a5 ams',
  ],
};

function normalizeKey(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace('urn:ngsi-ld:printer:', '')
    .replace(/_/g, ' ')
    .replace(/[,:;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value?: string | null) {
  return normalizeKey(value).replace(/[^a-z0-9]/g, '');
}

function toDate(value?: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object') {
    const record = value as AnyRecord;
    return toDate(
      record.dateTime ??
        record.date_time ??
        record.datetime ??
        record.date ??
        record.time ??
        record.value ??
        null
    );
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  // Supports: 21/05/2026, 12:00:00 or 21/05/2026 12:00
  const slashMatch = raw.match(
    /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (slashMatch) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = slashMatch;
    const date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss)
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Supports: 2026-05-21 12:00:00
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const normalizedDate = new Date(normalized);

  return Number.isNaN(normalizedDate.getTime()) ? null : normalizedDate;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getNestedDateValue(value: unknown) {
  if (!value || typeof value !== 'object') return value;

  const record = value as AnyRecord;

  return (
    record.dateTime ??
    record.date_time ??
    record.datetime ??
    record.date ??
    record.time ??
    record.value ??
    value
  );
}

function getBookingStart(booking?: AnyRecord | null) {
  if (!booking) return '';

  return String(
    getNestedDateValue(
      booking.start ??
        booking.startTime ??
        booking.start_time ??
        booking.begin ??
        booking.beginTime ??
        booking.begin_time ??
        booking.from ??
        booking.startDate ??
        booking.start_date ??
        booking.startDateTime ??
        booking.start_datetime ??
        booking.startsAt ??
        booking.starts_at ??
        ''
    ) || ''
  );
}

function getBookingEnd(booking?: AnyRecord | null) {
  if (!booking) return '';

  return String(
    getNestedDateValue(
      booking.end ??
        booking.endTime ??
        booking.end_time ??
        booking.finish ??
        booking.finishTime ??
        booking.finish_time ??
        booking.to ??
        booking.endDate ??
        booking.end_date ??
        booking.endDateTime ??
        booking.end_datetime ??
        booking.endsAt ??
        booking.ends_at ??
        ''
    ) || ''
  );
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function classifyBooking(booking?: AnyRecord | null): BookingKind {
  const start = toDate(getBookingStart(booking));
  const end = toDate(getBookingEnd(booking));

  if (!start || !end || end.getTime() <= start.getTime()) {
    return 'free';
  }

  const now = new Date();
  const toleranceMs = 60 * 1000;

  if (
    now.getTime() >= start.getTime() - toleranceMs &&
    now.getTime() <= end.getTime() + toleranceMs
  ) {
    return 'active';
  }

  if (isSameLocalDay(start, now) && start.getTime() > now.getTime()) {
    return 'upcoming_today';
  }

  return 'free';
}

function calcBookingProgress(startStr?: string, endStr?: string) {
  const now = Date.now();
  const start = toDate(startStr)?.getTime();
  const end = toDate(endStr)?.getTime();

  if (!start || !end || end <= start) {
    return 0;
  }

  const percentage = ((now - start) / (end - start)) * 100;
  return Math.round(clamp(percentage));
}

function formatTime(value?: string) {
  const date = toDate(value);

  if (!date) return '--:--';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBookingState(startStr?: string, endStr?: string) {
  const now = Date.now();
  const start = toDate(startStr)?.getTime();
  const end = toDate(endStr)?.getTime();

  if (!start || !end) return 'Time unavailable';

  const diffMs = now < start ? start - now : end - now;
  const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const readable = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  if (now < start) return `Starts in ${readable}`;
  if (now > end) return 'Booking ended';

  return `${readable} remaining`;
}

function extractUserName(description?: string, fallback?: string) {
  if (fallback && fallback.trim()) return fallback.trim();
  if (!description) return 'Unknown user';

  const teacherMatch = description.match(/Teacher:\s*([A-Za-zÅÄÖåäö\s]+)/i);
  if (teacherMatch) return teacherMatch[1].trim();

  const nameMatch = description.match(/,\s*([A-Za-zÅÄÖåäö\s]+)/);
  if (nameMatch) return nameMatch[1].trim();

  return 'Unknown user';
}

function collectBookingCandidates(source: AnyRecord) {
  return [
    source.currentBooking,
    source.activeBooking,
    source.booking,
    source.event,
    ...(Array.isArray(source.bookings) ? source.bookings : []),
    ...(Array.isArray(source.events) ? source.events : []),
    ...(Array.isArray(source.reservations) ? source.reservations : []),
  ].filter(Boolean) as AnyRecord[];
}

function getAliasesForPrinter(printerId: string, printerName: string) {
  const baseName = String(printerName || printerId || '');
  const normalizedName = normalizeKey(baseName);
  const compactName = compact(baseName);

  const aliases = new Set<string>();

  aliases.add(normalizedName);
  aliases.add(compactName);
  aliases.add(normalizeKey(printerId));
  aliases.add(compact(printerId));

  const aNumberMatch = `${printerId} ${printerName}`.match(/(?:bambu\s*)?a\s*(\d)/i);
  const pNumberMatch = `${printerId} ${printerName}`.match(/p\s*(\d)/i);
  const number = aNumberMatch?.[1] || pNumberMatch?.[1];

  if (number) {
    aliases.add(`a${number}`);
    aliases.add(`bambu a${number}`);
    aliases.add(`p${number}`);
  }

  const knownAliases = ROOM_ALIASES[baseName] || ROOM_ALIASES[`Bambu A${number}`] || [];
  knownAliases.forEach((alias) => {
    aliases.add(normalizeKey(alias));
    aliases.add(compact(alias));
  });

  return Array.from(aliases).filter((alias) => alias.length >= 2);
}

function bookingTouchesPrinter(booking: AnyRecord, printerId: string, printerName: string) {
  const aliases = getAliasesForPrinter(printerId, printerName);
  const rawText = normalizeKey(JSON.stringify(booking));
  const compactText = compact(JSON.stringify(booking));

  return aliases.some((alias) => {
    const normalizedAlias = normalizeKey(alias);
    const compactAlias = compact(alias);

    if (normalizedAlias.length >= 3 && rawText.includes(normalizedAlias)) {
      return true;
    }

    if (compactAlias.length >= 3 && compactText.includes(compactAlias)) {
      return true;
    }

    return false;
  });
}

function findBestBookingForPrinter(
  mappedPrinter: AnyRecord,
  rawBookings: AnyRecord[],
  printerId: string,
  printerName: string
) {
  const mappedCandidates = collectBookingCandidates(mappedPrinter);
  const rawCandidates = rawBookings.filter((booking) =>
    bookingTouchesPrinter(booking, printerId, printerName)
  );

  const candidates = [...mappedCandidates, ...rawCandidates];

  const active = candidates.find((booking) => classifyBooking(booking) === 'active');
  if (active) return { booking: active, kind: 'active' as BookingKind };

  const upcomingToday = candidates
    .filter((booking) => classifyBooking(booking) === 'upcoming_today')
    .sort((a, b) => {
      const aStart = toDate(getBookingStart(a))?.getTime() || Infinity;
      const bStart = toDate(getBookingStart(b))?.getTime() || Infinity;
      return aStart - bStart;
    })[0];

  if (upcomingToday) {
    return { booking: upcomingToday, kind: 'upcoming_today' as BookingKind };
  }

  if (mappedPrinter.hasActiveBooking === true && mappedPrinter.currentBooking) {
    return { booking: mappedPrinter.currentBooking, kind: 'active' as BookingKind };
  }

  return { booking: null, kind: 'free' as BookingKind };
}

function normalizeBookingForCard(
  booking: AnyRecord,
  printerId: string
): PrinterBookingStatus['currentBooking'] {
  const start = getBookingStart(booking);
  const end = getBookingEnd(booking);
  const description = String(
    booking.description ?? booking.desc ?? booking.details ?? booking.body ?? ''
  );

  return {
    bookingId: String(
      booking.id ?? booking.bookingId ?? booking.uid ?? booking.eventId ?? `${printerId}-${start}`
    ),
    printerId,
    status: 'active',
    userName: extractUserName(
      description,
      booking.userName ??
        booking.user ??
        booking.teacher ??
        booking.owner ??
        booking.organizer ??
        booking.createdBy
    ),
    purpose: String(
      booking.title ?? booking.subject ?? booking.name ?? booking.summary ?? 'Peppi booking'
    ),
    startTime: start,
    endTime: end,
  };
}

function unwrapPeppiResponse(response: unknown) {
  if (Array.isArray(response)) {
    return {
      rawBookings: response as AnyRecord[],
      peppiPrinters: [] as string[],
    };
  }

  if (response && typeof response === 'object') {
    const record = response as AnyRecord;

    return {
      rawBookings: Array.isArray(record.bookings)
        ? (record.bookings as AnyRecord[])
        : [],
      peppiPrinters: Array.isArray(record.printers)
        ? (record.printers as string[])
        : [],
    };
  }

  return {
    rawBookings: [] as AnyRecord[],
    peppiPrinters: [] as string[],
  };
}

async function fetchBookingData(): Promise<BookingStatusExtended[]> {
  const peppiResponse = await fetchPeppiBookings();
  const { rawBookings, peppiPrinters } = unwrapPeppiResponse(peppiResponse);

  const mappedPrinters = mapPeppiToPrinters(
    rawBookings as unknown as Parameters<typeof mapPeppiToPrinters>[0]
  ) as AnyRecord[];
  const printerRows: AnyRecord[] =
    mappedPrinters.length > 0 ? mappedPrinters : DEFAULT_PRINTERS;

  console.log('Peppi booking board normalized data:', {
    peppiResponse,
    rawBookings,
    rawBookingsCount: rawBookings.length,
    peppiPrinters,
    mappedPrinters,
    printerRows,
  });

  return printerRows.map((printer) => {
    const printerId = String(printer.printerId || printer.id || printer.name || '');
    const printerName = String(printer.printerName || printer.name || printerId);

    const { booking, kind } = findBestBookingForPrinter(
      printer,
      rawBookings,
      printerId,
      printerName
    );

    const hasBooking = kind === 'active' || kind === 'upcoming_today';
    const bookingForCard = booking ? normalizeBookingForCard(booking, printerId) : undefined;

    return {
      printerId,
      printerName,
      isPrinting: false,
      hasBooking,
      bookingStatus: hasBooking ? 'with-booking' : 'idle',
      bookingKind: kind,
      utilizationRate: bookingForCard
        ? calcBookingProgress(bookingForCard.startTime, bookingForCard.endTime)
        : 0,
      currentBooking: bookingForCard,
    };
  });
}

const statusStyle: Record<
  BookingStatus,
  {
    label: string;
    badge: string;
    icon: React.ReactNode;
  }
> = {
  'with-booking': {
    label: 'Booked / Reserved',
    badge: 'bg-red-50 text-red-700 border-red-200',
    icon: <CheckCircle2 size={16} />,
  },
  'without-booking': {
    label: 'In use without booking',
    badge: 'bg-red-50 text-red-700 border-red-200',
    icon: <AlertCircle size={16} />,
  },
  idle: {
    label: 'Available now',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Calendar size={16} />,
  },
};

const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  active?: boolean;
}> = ({ title, value, subtitle, icon, active = false }) => {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-white p-5 transition ${
        active
          ? 'border-purple-300 bg-gradient-to-br from-white via-purple-50 to-white shadow-[0_18px_45px_rgba(124,58,237,0.18)] ring-2 ring-purple-100'
          : 'border-slate-200 shadow-sm'
      }`}
    >
      {active && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-purple-400/70 animate-pulse" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-purple-200/40 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-fuchsia-200/30 blur-2xl" />
        </>
      )}

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className={`mt-2 text-3xl font-black ${active ? 'text-purple-800' : 'text-slate-950'}`}>
            {value}
          </p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div
          className={`rounded-2xl p-3 ${
            active
              ? 'bg-white text-purple-700 shadow-md shadow-purple-100'
              : 'bg-purple-50 text-purple-700'
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

const BookingCard: React.FC<{ data: BookingStatusExtended }> = ({ data }) => {
  const style = statusStyle[data.bookingStatus];

  const isBooked =
    data.bookingStatus === 'with-booking' ||
    data.bookingStatus === 'without-booking' ||
    Boolean(data.hasBooking);

  const isFree = !isBooked;
  const isUpcoming = data.bookingKind === 'upcoming_today';

  const cardClass = isFree
    ? 'border-purple-300 bg-white ring-2 ring-purple-100 animate-pulse shadow-[0_10px_28px_rgba(124,58,237,0.14)]'
    : 'border-red-300 bg-red-50/75 ring-2 ring-red-100 animate-pulse shadow-[0_12px_30px_rgba(239,68,68,0.14)]';

  const peppiStateClass = isFree ? 'text-purple-700' : 'text-red-700';
  const iconClass = isBooked ? 'text-red-600' : 'text-purple-600';

  return (
    <div
      className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">{data.printerName}</h3>

          <div
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${style.badge}`}
          >
            {style.icon}
            {isUpcoming ? 'Booked later today' : style.label}
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Peppi</p>
          <p className={`text-sm font-bold ${peppiStateClass}`}>
            {isBooked ? 'Reserved' : 'Free'}
          </p>
        </div>
      </div>

      {data.currentBooking ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-white/70 p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User size={16} className={iconClass} />
              <span className="font-semibold text-slate-800">
                {data.currentBooking.userName}
              </span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <BookOpen size={16} className={`mt-0.5 ${iconClass}`} />
              <span className="line-clamp-2 text-slate-600">
                {data.currentBooking.purpose}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className={iconClass} />
              <span className="text-slate-600">
                {formatTime(data.currentBooking.startTime)} –{' '}
                {formatTime(data.currentBooking.endTime)}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">
                {formatBookingState(
                  data.currentBooking.startTime,
                  data.currentBooking.endTime
                )}
              </span>
              <span className="font-black text-red-700">
                {data.utilizationRate}%
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-700"
                style={{ width: `${data.utilizationRate}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 p-4">
          <p className="text-sm font-medium text-purple-700">
            No active or upcoming Peppi booking for this printer today.
          </p>
        </div>
      )}
    </div>
  );
};

export const BookingVizView: React.FC<Props> = ({ onBack: _onBack }) => {
  const [bookingData, setBookingData] = useState<BookingStatusExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      setError(null);

      const data = await fetchBookingData();

      setBookingData(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch booking data:', err);
      setError(err?.message || 'Could not load Peppi booking data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const interval = window.setInterval(() => {
      loadData(true);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  const stats = useMemo(() => {
    const total = bookingData.length;
    const bookedNow = bookingData.filter((printer) => printer.bookingStatus === 'with-booking').length;
    const availableNow = bookingData.filter((printer) => printer.bookingStatus === 'idle').length;
    const withoutBooking = bookingData.filter((printer) => printer.bookingStatus === 'without-booking').length;

    return {
      total,
      bookedNow,
      availableNow,
      withoutBooking,
    };
  }, [bookingData]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6 pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative overflow-hidden rounded-3xl border-2 border-purple-200 bg-gradient-to-br from-white via-purple-50 to-white px-6 py-5 shadow-[0_18px_45px_rgba(124,58,237,0.16)] ring-1 ring-purple-100">
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-purple-200/45 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 left-12 h-32 w-32 rounded-full bg-fuchsia-200/30 blur-2xl" />
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-500">
                Booking
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Peppi Booking Board</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Real-time booking view for FieldLab 3D printers
              </p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-3 shadow-sm lg:ml-auto">
            <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-2 text-center shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">
                Last sync
              </p>
              <p className="text-base font-black leading-tight text-purple-800">
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '--:--'}
              </p>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-purple-600 to-fuchsia-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(124,58,237,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(124,58,237,0.38)] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCcw
                size={17}
                className={refreshing ? 'animate-spin' : 'transition group-hover:rotate-180'}
              />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-80 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-purple-600" />
              <p className="mt-4 text-sm font-medium text-slate-500">Loading Peppi bookings...</p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <SummaryCard
                title="Booked / reserved"
                value={stats.bookedNow}
                subtitle={`${stats.total} printers connected to booking view`}
                icon={<CheckCircle2 size={24} />}
                active={stats.bookedNow > 0}
              />

              <SummaryCard
                title="Available now"
                value={stats.availableNow}
                subtitle="No active or upcoming booking today"
                icon={<Calendar size={24} />}
              />

              <SummaryCard
                title="Source"
                value="Peppi"
                subtitle="Auto-refresh every 30 seconds"
                icon={<RefreshCcw size={24} />}
                active
              />
            </section>

            {stats.withoutBooking > 0 && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {stats.withoutBooking} printer(s) appear to be in use without a matching booking.
              </div>
            )}

            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Current printer bookings</h2>
                  <p className="text-sm text-slate-500">
                    Showing active and upcoming Peppi bookings for today.
                  </p>
                </div>
              </div>

              {bookingData.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                  <p className="text-lg font-bold text-slate-800">No printer booking data found.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Check the Peppi backend connection or printer mapping.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {bookingData.map((printer) => (
                    <BookingCard key={printer.printerId} data={printer} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export const APP_NAME = 'PrintLab OS';

export const STATUS_COLORS = {
  printing: 'bg-blue-100 text-blue-700 border-blue-200',
  idle: 'bg-gray-100 text-gray-600 border-gray-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  finished: 'bg-green-100 text-green-700 border-green-200',
} as const;

export const STATUS_LABELS = {
  printing: 'Printing',
  idle: 'Idle',
  error: 'Error',
  finished: 'Finished',
} as const;

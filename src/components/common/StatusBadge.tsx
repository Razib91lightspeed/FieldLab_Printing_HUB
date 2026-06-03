import React from 'react';
import { PrinterStatus } from '../../types';

interface Props {
  status: PrinterStatus;
  label?: string;
}

const getStatusLabel = (status: PrinterStatus): string => {
  switch (status) {
    case 'printing':
      return 'Printing';
    case 'finished':
      return 'Finished';
    case 'idle':
      return 'Idle';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
};

const getStatusClasses = (status: PrinterStatus): string => {
  switch (status) {
    case 'printing':
      return 'bg-blue-100 text-blue-700 border border-blue-200';

    case 'finished':
      return 'bg-green-100 text-green-700 border border-green-200';

    case 'error':
      return 'bg-red-100 text-red-700 border border-red-200';

    case 'idle':
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

export const StatusBadge: React.FC<Props> = ({ status, label }) => {
  const displayLabel = label || getStatusLabel(status);

  return (
    <span
      className={`
        inline-flex
        items-center
        justify-center
        max-w-full
        rounded-full
        px-3
        py-1
        text-xs
        font-semibold
        leading-tight
        text-center
        whitespace-normal
        break-words
        ${getStatusClasses(status)}
      `}
      title={displayLabel}
    >
      {displayLabel}
    </span>
  );
};
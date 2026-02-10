import React from 'react';
import { PrinterStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

interface Props {
  status: PrinterStatus;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
};

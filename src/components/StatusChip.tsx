import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { SopStatus } from '../types';

const STATUS_CONFIG: Record<SopStatus, { label: string; color: ChipProps['color'] }> = {
  generating: { label: 'Generating...', color: 'info' },
  ready: { label: 'Ready', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
};

type StatusChipProps = {
  status: SopStatus;
  size?: ChipProps['size'];
};

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      variant="outlined"
      sx={{ height: 22, fontSize: 12, fontWeight: 600, borderRadius: 1 }}
    />
  );
}

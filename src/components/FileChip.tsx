import { Box, Chip, IconButton, Typography } from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { formatFileSize } from '../utils/fileCollection';

type FileChipProps = {
  name: string;
  size: number;
  isCurrentSop?: boolean;
  onRemove: () => void;
};

export default function FileChip({ name, size, isCurrentSop, onRemove }: FileChipProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 1.5,
        pr: 0.5,
        py: 0.5,
        borderRadius: 999,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: 'info.main' }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {name}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        ({formatFileSize(size)})
      </Typography>
      {isCurrentSop && (
        <Chip label="Current SOP" size="small" sx={{ bgcolor: 'action.hover', fontWeight: 700 }} />
      )}
      <IconButton size="small" aria-label={`Remove ${name}`} onClick={onRemove}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
}

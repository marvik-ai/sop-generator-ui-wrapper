import { useState } from 'react';
import { Box, Button, Drawer, IconButton, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type EditSopDrawerProps = {
  open: boolean;
  content: string;
  onCancel: () => void;
  onSave: (content: string) => void;
};

function EditSopDrawerContent({
  content,
  onCancel,
  onSave,
}: Omit<EditSopDrawerProps, 'open'>) {
  const [value, setValue] = useState(content);

  return (
    <Box
      sx={{
        width: 'min(900px, 100vw)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6">Edit SOP</Typography>
        <IconButton aria-label="Close" onClick={onCancel}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, p: 2, overflow: 'hidden', display: 'flex' }}>
        <TextField
          value={value}
          onChange={(event) => setValue(event.target.value)}
          multiline
          fullWidth
          variant="outlined"
          slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.875rem' } } }}
          sx={{
            flexGrow: 1,
            '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' },
            '& .MuiInputBase-input': {
              height: '100% !important',
              overflow: 'auto !important',
            },
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Button onClick={onCancel} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onSave(value)}>
          Save changes
        </Button>
      </Box>
    </Box>
  );
}

export default function EditSopDrawer({ open, content, onCancel, onSave }: EditSopDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onCancel}>
      {/* Remounted each time the drawer opens so its local edit state always starts
          from the latest content, without setState-in-effect. */}
      {open && <EditSopDrawerContent key={content} content={content} onCancel={onCancel} onSave={onSave} />}
    </Drawer>
  );
}

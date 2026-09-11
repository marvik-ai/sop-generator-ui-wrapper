import { useEffect, useRef } from 'react';
import { Button } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { PickedFile } from '../types';
import { ACCEPT, collectFromFileList } from '../utils/fileCollection';

type FilePickerButtonProps = {
  label: string;
  multiple?: boolean;
  folder?: boolean;
  variant?: 'outlined' | 'tonal';
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  onFiles: (picked: PickedFile[]) => void;
};

export default function FilePickerButton({
  label,
  multiple = false,
  folder = false,
  variant = 'outlined',
  fullWidth = false,
  sx,
  onFiles,
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // webkitdirectory isn't in React's JSX typings (or the DOM attribute set), so it
    // has to be set imperatively rather than as a prop.
    if (folder) inputRef.current?.setAttribute('webkitdirectory', '');
  }, [folder]);

  return (
    <>
      <Button
        variant={variant === 'outlined' ? 'outlined' : 'contained'}
        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
        fullWidth={fullWidth}
        onClick={() => inputRef.current?.click()}
        sx={[
          variant === 'tonal'
            ? { bgcolor: 'action.hover', color: 'text.primary', boxShadow: 'none' }
            : { borderColor: 'divider', color: 'text.primary' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple || folder}
        accept={folder ? undefined : ACCEPT}
        hidden
        onChange={(event) => {
          onFiles(collectFromFileList(event.target.files));
          event.target.value = '';
        }}
      />
    </>
  );
}

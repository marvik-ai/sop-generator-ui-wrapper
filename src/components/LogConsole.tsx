import { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { LogLine } from '../types';

const MAX_HEIGHT = 420;

function lineColor(text: string) {
  if (text.includes('WARNING')) return 'warning.main';
  // The pipeline indents sub-lines (per-file extraction counts, cache notes) by two
  // spaces; dim them so the top-level stages stand out.
  if (text.startsWith('  ')) return 'text.secondary';
  return 'text.primary';
}

type LogConsoleProps = {
  lines: LogLine[];
  isRunning: boolean;
};

export default function LogConsole({ lines, isRunning }: LogConsoleProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lines]);

  return (
    <Paper
      sx={{
        p: 2,
        maxHeight: MAX_HEIGHT,
        overflowY: 'auto',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
      }}
    >
      {lines.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {isRunning ? 'Waiting for the pipeline to start…' : 'No output.'}
        </Typography>
      ) : (
        lines.map((line) => (
          <Typography
            key={line.id}
            component="pre"
            sx={{
              m: 0,
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: lineColor(line.text),
            }}
          >
            {line.text}
          </Typography>
        ))
      )}
      <Box ref={bottomRef} />
    </Paper>
  );
}

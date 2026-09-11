import { useState } from 'react';
import { keyframes } from '@emotion/react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Menu,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GenerationSteps from '../../components/GenerationSteps';
import StatusChip from '../../components/StatusChip';
import useSopGeneration from '../../hooks/useSopGeneration';
import FileChip from '../../components/FileChip';
import FilePickerButton from '../../components/FilePickerButton';
import type { PickedFile } from '../../types';
import { collectFromDataTransfer } from '../../utils/fileCollection';
import { mdComponents } from './MarkdownRenderers';
import EditSopDrawer from './EditSopDrawer';

const rotateGradient = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

function downloadMarkdown(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name.replace(/[^\w-]+/g, '_') || 'sop'}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SopGenerator() {
  const [tab, setTab] = useState(0);
  const { sop, steps, progress, startGeneration, updateContent, reset } = useSopGeneration();
  const [name, setName] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [currentSop, setCurrentSop] = useState<PickedFile | null>(null);
  const [description, setDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const canGenerate = name.trim().length > 0 && files.length > 0;
  const closeAddMenu = () => setAddMenuAnchor(null);

  const clearAll = () => {
    setName('');
    setDescription('');
    setFiles([]);
    setCurrentSop(null);
  };

  const isReady = sop?.status === 'ready';
  const isFailed = sop?.status === 'failed';

  return (
    <>
      {sop === null ? (
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            py: 6,
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 800, textAlign: 'center' }}>
            Build your SOP from Scratch{' '}
            <AutoAwesomeIcon sx={{ fontSize: 28, color: 'text.primary', verticalAlign: 'middle' }} />
          </Typography>

          <Box
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: 700,
              borderRadius: 4,
              overflow: 'hidden',
              p: '2px',
              boxShadow: isDragOver
                ? '0 0 24px 4px rgba(11, 132, 227, 0.35)'
                : '0 0 16px 2px rgba(56, 189, 248, 0.25)',
              transition: 'box-shadow 0.3s ease',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: '-50%',
                background:
                  'conic-gradient(from 0deg, #a5f3fc, #38bdf8, #0b84e3, #38bdf8, #a5f3fc)',
                opacity: isDragOver ? 0.9 : 0.6,
                animation: `${rotateGradient} 6s linear infinite`,
              },
            }}
          >
            <Paper
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                void collectFromDataTransfer(event.dataTransfer).then((picked) =>
                  setFiles((previous) => [...previous, ...picked]),
                );
              }}
              sx={{
                position: 'relative',
                width: '100%',
                p: { xs: 3, sm: 4 },
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                borderRadius: 4,
              }}
            >
            <TextField
              variant="standard"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              fullWidth
              slotProps={{ input: { disableUnderline: false } }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'text.primary',
                },
                '& .MuiInputBase-input::placeholder': {
                  fontSize: '1.25rem',
                  fontWeight: 400,
                  color: 'text.disabled',
                  opacity: 1,
                },
              }}
            />

            <TextField
              variant="standard"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              fullWidth
              multiline
              minRows={2}
              sx={{
                '& .MuiInput-underline:before': { borderBottom: 'none' },
                '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                '& .MuiInput-underline:after': { borderBottom: 'none' },
                '& .MuiInputBase-input': { color: 'text.primary' },
                '& .MuiInputBase-input::placeholder': { color: 'text.disabled', opacity: 1 },
              }}
            />

            {(files.length > 0 || currentSop) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {files.map(({ file, relativePath }, index) => (
                  <FileChip
                    key={`${relativePath}-${index}`}
                    name={relativePath}
                    size={file.size}
                    onRemove={() => setFiles((previous) => previous.filter((_, i) => i !== index))}
                  />
                ))}
                {currentSop && (
                  <FileChip
                    name={currentSop.relativePath}
                    size={currentSop.file.size}
                    isCurrentSop
                    onRemove={() => setCurrentSop(null)}
                  />
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box onMouseLeave={closeAddMenu}>
                <IconButton
                  aria-label="Add files"
                  onMouseEnter={(event) => setAddMenuAnchor(event.currentTarget)}
                  onClick={(event) => setAddMenuAnchor(event.currentTarget)}
                  sx={{
                    bgcolor: 'action.hover',
                    color: 'text.primary',
                    transition: 'transform 0.2s ease',
                    '&:hover': { transform: 'scale(1.12)', bgcolor: 'action.selected' },
                  }}
                >
                  <AddIcon />
                </IconButton>
                <Menu
                  anchorEl={addMenuAnchor}
                  open={Boolean(addMenuAnchor)}
                  onClose={closeAddMenu}
                  disableAutoFocus
                  disableRestoreFocus
                  slotProps={{
                    list: {
                      onMouseLeave: closeAddMenu,
                      sx: { p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 },
                    },
                  }}
                >
                  <FilePickerButton
                    label="Base File(s)"
                    multiple
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                    onFiles={(picked) => {
                      setFiles((previous) => [...previous, ...picked]);
                      closeAddMenu();
                    }}
                  />
                  <FilePickerButton
                    label="Folder"
                    folder
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                    onFiles={(picked) => {
                      setFiles((previous) => [...previous, ...picked]);
                      closeAddMenu();
                    }}
                  />
                  <FilePickerButton
                    label="Current SOP"
                    variant="tonal"
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                    onFiles={(picked) => {
                      setCurrentSop(picked[0] ?? null);
                      closeAddMenu();
                    }}
                  />
                </Menu>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Button onClick={clearAll} sx={{ color: 'text.secondary', fontWeight: 400 }}>
                Clear All
              </Button>
              <Button
                variant="contained"
                disabled={!canGenerate}
                startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                onClick={() => {
                  void startGeneration(name.trim(), files, description.trim(), currentSop ?? undefined);
                  clearAll();
                  setTab(0);
                }}
                sx={{ borderRadius: 999 }}
              >
                Generate SOP
              </Button>
            </Box>
            </Paper>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="h4">{sop.name}</Typography>
            <StatusChip status={sop.status} />
            <Box sx={{ flexGrow: 1 }} />
            <IconButton
              aria-label="Edit SOP"
              disabled={!isReady || !sop.content}
              onClick={() => setIsEditing(true)}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, color: 'info.main' }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Download SOP"
              disabled={!isReady || !sop.content}
              onClick={() => sop.content && downloadMarkdown(sop.name, sop.content)}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, color: 'success.main' }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Delete SOP"
              onClick={reset}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, color: 'error.main' }}
            >
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, value: number) => setTab(value)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Generation Detail" sx={{ fontWeight: 700 }} />
            <Tab label="SOP" sx={{ fontWeight: 700 }} />
          </Tabs>

          {tab === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
              {isFailed && (
                <Alert severity="error">{sop.error ?? 'Generation failed.'}</Alert>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {progress === null ? (
                  <LinearProgress
                    color={isFailed ? 'error' : 'info'}
                    sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                  />
                ) : (
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    color={isFailed ? 'error' : isReady ? 'success' : 'info'}
                    sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                  />
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {progress === null ? 'Working...' : `${progress}% complete`}
                </Typography>
              </Box>
              <GenerationSteps steps={steps} />
            </Box>
          ) : (
            sop.content ? (
              <Paper sx={{ p: 3, mt: 2, maxHeight: 640, overflowY: 'auto' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {sop.content}
                </ReactMarkdown>
              </Paper>
            ) : (
              <Paper
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  py: 12,
                  mt: 2,
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {isFailed ? 'Generation failed' : 'Your SOP is being generated'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {isFailed
                    ? 'No SOP was produced. Check the generation log for what went wrong.'
                    : 'The generated SOP will appear here once the generation process is complete.'}
                </Typography>
                <Button
                  onClick={() => setTab(0)}
                  endIcon={<ArrowForwardIcon />}
                  sx={{ color: 'info.main', fontWeight: 400 }}
                >
                  {isFailed ? 'View generation log' : 'View live generation'}
                </Button>
              </Paper>
            )
          )}
        </Box>
      )}

      <EditSopDrawer
        open={isEditing}
        content={sop?.content ?? ''}
        onCancel={() => setIsEditing(false)}
        onSave={(content) => {
          updateContent(content);
          setIsEditing(false);
        }}
      />
    </>
  );
}

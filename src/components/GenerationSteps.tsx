import { useState } from 'react';
import { Box, Collapse, IconButton, Paper, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { Step } from '../types';

function StepIcon({ status }: { status: Step['status'] }) {
  if (status === 'running') return <CircularProgress size={20} color="info" />;
  if (status === 'done') return <CheckCircleOutlinedIcon color="success" />;
  return <RadioButtonUncheckedIcon sx={{ color: 'text.disabled' }} />;
}

function StepRow({ step }: { step: Step }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Paper
      variant="outlined"
      sx={{ borderColor: 'divider', overflow: 'hidden' }}
    >
      <Box
        onClick={() => step.subSteps.length > 0 && setExpanded((previous) => !previous)}
        onKeyDown={(event) => {
          if (step.subSteps.length === 0) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setExpanded((previous) => !previous);
          }
        }}
        role={step.subSteps.length > 0 ? 'button' : undefined}
        tabIndex={step.subSteps.length > 0 ? 0 : undefined}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          cursor: step.subSteps.length > 0 ? 'pointer' : 'default',
        }}
      >
        <StepIcon status={step.status} />
        <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>
          Step {step.index + 1}
          {step.title ? `: ${step.title}` : ''}
        </Typography>
        {step.subSteps.length > 0 && (
          <IconButton
            size="small"
            aria-label={expanded ? 'Collapse step' : 'Expand step'}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((previous) => !previous);
            }}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>
      <Collapse in={expanded && step.subSteps.length > 0}>
        <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {step.subSteps.map((subStep) => (
            <Box key={subStep.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              {subStep.status === 'warning' ? (
                <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main', mt: '2px' }} />
              ) : (
                <CheckCircleOutlinedIcon sx={{ fontSize: 18, color: 'success.main', mt: '2px' }} />
              )}
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {subStep.text}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

type GenerationStepsProps = {
  steps: Step[];
};

export default function GenerationSteps({ steps }: GenerationStepsProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column-reverse', gap: 1.5 }}>
      {steps.map((step) => (
        <StepRow key={step.index} step={step} />
      ))}
    </Box>
  );
}

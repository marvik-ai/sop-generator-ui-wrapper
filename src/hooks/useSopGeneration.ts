import { useCallback, useEffect, useRef, useState } from 'react';
import type { PickedFile, Sop, SopStatus, Step } from '../types';

const STAGE_COUNT = 4;

type LogEvent = { line: string };
type StatusEvent = { status: SopStatus; error: string | null };
type ProgressEvent = { stage_index: number; stage_count: number; label: string | null };

function emptySteps(): Step[] {
  return Array.from({ length: STAGE_COUNT }, (_, index) => ({
    index,
    title: '',
    status: 'pending',
    subSteps: [],
  }));
}

// One raw log line becomes one sub-step of the currently running step. The pipeline
// marks a resolved line with a trailing checkmark; lines with neither a checkmark nor
// a WARNING prefix are transient progress chatter and are not promoted to sub-steps.
function subStepFromLine(line: string): { text: string; status: 'done' | 'warning' } | null {
  const trimmed = line.trim();
  if (trimmed.startsWith('WARNING:')) {
    return { text: trimmed, status: 'warning' };
  }
  if (trimmed.endsWith('✅')) {
    return { text: trimmed.slice(0, -1).trim(), status: 'done' };
  }
  return null;
}

// Completed steps count fully; the running step contributes partial credit from the
// sub-steps seen so far, capped well short of a full step's share so the jump to
// "done" (on the next step's header) stays visible. Derived rather than stored: a
// separate `progress` state written from two places (log/progress events and the
// "force 100" on ready) can commit out of order and get stuck; deriving it from
// `steps` on every render means there's exactly one source of truth.
function computeProgress(steps: Step[]): number {
  const perStep = 100 / STAGE_COUNT;
  const done = steps.filter((step) => step.status === 'done').length;
  const running = steps.find((step) => step.status === 'running');
  const partial = running ? Math.min(running.subSteps.length * 2, perStep * 0.6) : 0;
  return Math.min(100, Math.round(done * perStep + partial));
}

type UseSopGeneration = {
  sop: Sop | null;
  steps: Step[];
  progress: number | null;
  startGeneration: (
    name: string,
    files: PickedFile[],
    description?: string,
    currentSop?: PickedFile,
  ) => Promise<void>;
  updateContent: (content: string) => void;
  reset: () => void;
};

export default function useSopGeneration(): UseSopGeneration {
  const [sop, setSop] = useState<Sop | null>(null);
  const [steps, setSteps] = useState<Step[]>(emptySteps());
  // null means indeterminate: the run failed, or the connection dropped mid-run, so the
  // last-seen stage mapping is no longer trustworthy.
  const [progressFailed, setProgressFailed] = useState(false);
  const progress = progressFailed ? null : computeProgress(steps);
  const sourceRef = useRef<EventSource | null>(null);
  // Mirrors sop.id so reset() can fire its DELETE without a side effect inside a
  // setState updater (StrictMode invokes updaters twice).
  const jobIdRef = useRef<string | null>(null);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => closeStream, [closeStream]);

  const subscribe = useCallback(
    (jobId: string) => {
      const source = new EventSource(`/api/runs/${jobId}/events`);
      sourceRef.current = source;

      source.addEventListener('log', (event) => {
        const { line } = JSON.parse((event as MessageEvent).data) as LogEvent;
        const subStep = subStepFromLine(line);
        if (subStep) {
          setSteps((previous) => {
            const runningIndex = previous.findIndex((step) => step.status === 'running');
            if (runningIndex === -1) return previous;
            const running = previous[runningIndex];
            const nextSteps = previous.slice();
            nextSteps[runningIndex] = {
              ...running,
              subSteps: [...running.subSteps, { ...subStep, id: running.subSteps.length + 1 }],
            };
            return nextSteps;
          });
        }
      });

      source.addEventListener('progress', (event) => {
        const { stage_index, label } = JSON.parse((event as MessageEvent).data) as ProgressEvent;
        setSteps((previous) =>
          previous.map((step) => {
            if (step.index < stage_index) return { ...step, status: 'done' as const };
            if (step.index === stage_index) {
              return { ...step, title: label ?? step.title, status: 'running' as const };
            }
            return step;
          }),
        );
      });

      source.addEventListener('status', (event) => {
        const { status, error } = JSON.parse((event as MessageEvent).data) as StatusEvent;
        closeStream();
        setSop((current) =>
          current ? { ...current, status, error: error ?? undefined } : current,
        );
        if (status === 'ready') {
          // Force every step done even if the stage mapping drifted mid-run (see
          // backend `progress_drift`) — a completed run showing a stalled percentage
          // is more confusing than 100% plus the WARNING log line the backend emits.
          setSteps((previous) => previous.map((step) => ({ ...step, status: 'done' as const })));
          void fetch(`/api/runs/${jobId}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((snapshot) => {
              if (!snapshot) return;
              setSop((current) =>
                current
                  ? {
                      ...current,
                      content: snapshot.sop_markdown ?? undefined,
                      gapsMarkdown: snapshot.gaps_markdown ?? undefined,
                    }
                  : current,
              );
            });
        } else if (status === 'failed') {
          // A failed run's last matched stage is no longer trustworthy progress info.
          setProgressFailed(true);
        }
      });

      source.onerror = () => {
        // The server closes the stream on terminal status; only treat a drop as a
        // failure if we never saw that status.
        setSop((current) => {
          if (!current || current.status !== 'generating') return current;
          return { ...current, status: 'failed', error: 'Lost connection to the server.' };
        });
        setProgressFailed(true);
        closeStream();
      };
    },
    [closeStream],
  );

  const startGeneration = useCallback(
    async (
      name: string,
      files: PickedFile[],
      description: string = '',
      currentSop?: PickedFile,
    ) => {
      closeStream();
      setSteps(emptySteps());
      setProgressFailed(false);
      // Switch to the generating view immediately — don't wait on the POST round-trip
      // (upload + disk staging on the backend) before giving feedback that the click
      // registered. The real job id is patched in once the response arrives.
      setSop({ id: '', name, files, status: 'generating' });

      const body = new FormData();
      body.append('name', name);
      body.append('description', description);
      // 'paths' entries line up 1:1 with 'files' entries by submission order, since the
      // backend zips them by index (multipart preserves field order within a request).
      files.forEach(({ file, relativePath }) => {
        body.append('files', file);
        body.append('paths', relativePath);
      });
      // Sent under its own field name so the backend can tell it apart from the base
      // files without relying on naming conventions — it drives the pipeline's separate
      // "existing SOP to revise" input, not the inputs/ corpus.
      if (currentSop) {
        body.append('draft', currentSop.file);
      }

      let response: Response;
      try {
        response = await fetch('/api/runs', { method: 'POST', body });
      } catch {
        setSop({
          id: '',
          name,
          files,
          status: 'failed',
          error: 'Could not reach the generator service. Is the backend running?',
        });
        return;
      }

      if (!response.ok) {
        const detail = await response
          .json()
          .then((data: { detail?: string }) => data.detail)
          .catch(() => undefined);
        setSop({
          id: '',
          name,
          files,
          status: 'failed',
          error: detail ?? `Request failed (${response.status}).`,
        });
        return;
      }

      const { job_id: jobId } = (await response.json()) as { job_id: string };
      jobIdRef.current = jobId;
      setSop((current) => (current ? { ...current, id: jobId } : current));
      subscribe(jobId);
    },
    [closeStream, subscribe],
  );

  const updateContent = useCallback((content: string) => {
    setSop((current) => (current ? { ...current, content } : current));
  }, []);

  const reset = useCallback(() => {
    closeStream();
    if (jobIdRef.current) {
      void fetch(`/api/runs/${jobIdRef.current}`, { method: 'DELETE' }).catch(() => undefined);
      jobIdRef.current = null;
    }
    setSop(null);
    setSteps(emptySteps());
    setProgressFailed(false);
  }, [closeStream]);

  return { sop, steps, progress, startGeneration, updateContent, reset };
}

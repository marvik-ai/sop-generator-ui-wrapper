import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogLine, PickedFile, Sop, SopStatus } from '../types';

type LogEvent = { line: string };
type StatusEvent = { status: SopStatus; error: string | null };
type ProgressEvent = { stage_index: number; stage_count: number; label: string | null };

type UseSopGeneration = {
  sop: Sop | null;
  lines: LogLine[];
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
  const [lines, setLines] = useState<LogLine[]>([]);
  // null means indeterminate: the stage mapping (owned by the backend, which is the
  // one place that imports the pipeline) never advanced, or the stream dropped mid-run.
  const [progress, setProgress] = useState<number | null>(0);
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
        // Derive the id from the list itself. Reading a counter ref inside the updater
        // is not safe: two events can land before React flushes, and both updaters then
        // read the same (already-advanced) value, producing duplicate keys.
        setLines((previous) => [...previous, { id: previous.length + 1, text: line }]);
      });

      source.addEventListener('progress', (event) => {
        const { stage_index, stage_count } = JSON.parse(
          (event as MessageEvent).data,
        ) as ProgressEvent;
        const value = Math.round(((stage_index + 1) / stage_count) * 100);
        setProgress((previous) => (previous === null ? previous : Math.max(previous, value)));
      });

      source.addEventListener('status', (event) => {
        const { status, error } = JSON.parse((event as MessageEvent).data) as StatusEvent;
        closeStream();
        setSop((current) =>
          current ? { ...current, status, error: error ?? undefined } : current,
        );
        if (status === 'ready') {
          // Force 100 even if the stage mapping drifted mid-run (see backend
          // `progress_drift`) — a completed run showing a stalled percentage is more
          // confusing than 100% plus the WARNING log line the backend already emits.
          setProgress(100);
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
          setProgress(null);
        }
      });

      source.onerror = () => {
        // The server closes the stream on terminal status; only treat a drop as a
        // failure if we never saw that status.
        setSop((current) => {
          if (!current || current.status !== 'generating') return current;
          return { ...current, status: 'failed', error: 'Lost connection to the server.' };
        });
        setProgress(null);
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
      setLines([]);
      setProgress(0);
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
    setLines([]);
    setProgress(0);
  }, [closeStream]);

  return { sop, lines, progress, startGeneration, updateContent, reset };
}

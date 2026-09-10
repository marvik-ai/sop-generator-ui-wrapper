"""In-memory job registry and the pipeline runner.

POC scope: one job at a time, no database, no queue. State lives in this module and
dies with the process.

The pipeline reports progress via bare `print()` calls and exposes no callback or
logging hook, so the only way to observe it is to capture stdout. `redirect_stdout`
swaps *process-global* `sys.stdout`, which is why `_run_lock` below is load-bearing
rather than merely tidy: two concurrent runs would interleave into each other's log
streams. If concurrency is ever needed, run each job in a multiprocessing child.
"""

from __future__ import annotations

import asyncio
import re
import shutil
import traceback
import uuid
from contextlib import redirect_stdout
from dataclasses import dataclass, field
from pathlib import Path

from starlette.concurrency import run_in_threadpool

from . import config
from .models import JobStatus

# Sentinel pushed onto a subscriber queue when the job reaches a terminal state.
_DONE = object()

# The pipeline marks each top-level stage with a "========SECTION NAME========" header
# line on stdout. Kept here, in the one module that already imports sop_pipeline, rather
# than in the frontend: if the pipeline's wording ever drifts, the coupling lives in a
# single place and the drift itself becomes observable (see `progress_drift` below)
# instead of the UI silently stalling.
_STAGE_HEADER_RE = re.compile(r'^={3,}\s*(.+?)\s*={3,}$')

# The pipeline also renders its own animated, carriage-return-style progress bars using
# ANSI CSI codes (e.g. "\x1b[K" to erase the line) and lines like "[████░░░░] 40%". Each
# frame arrives as its own captured line (see `_LineWriter`), so these are stripped/
# dropped here rather than treated as sub-step or stage-header content.
_ANSI_CSI_RE = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')
_PROGRESS_BAR_RE = re.compile(r'^\[[█░]+\]\s*\d+%$')

STAGE_COUNT = 4


def _clean_line(line: str) -> str:
    return _ANSI_CSI_RE.sub('', line)


def _is_progress_bar_line(line: str) -> bool:
    return bool(_PROGRESS_BAR_RE.match(line.strip()))


_ACRONYMS = {'SOP'}


def _title_case(name: str) -> str:
    return ' '.join(word if word in _ACRONYMS else word.capitalize() for word in name.split())


def _match_stage_header(line: str) -> str | None:
    """Return the title-cased stage name if `line` is a "===NAME===" header, else None."""
    match = _STAGE_HEADER_RE.match(line.strip())
    return _title_case(match.group(1)) if match else None


class _LineWriter:
    """A file-like sink that turns writes into complete lines.

    `print(x)` calls `write(str(x))` then `write('\\n')`, and the pipeline also emits
    multi-line strings, so writes must be buffered and split rather than treated as
    lines one-to-one.
    """

    def __init__(self, emit):
        self._emit = emit
        self._buffer = ''

    def write(self, text: str) -> int:
        self._buffer += text
        while '\n' in self._buffer:
            line, _, self._buffer = self._buffer.partition('\n')
            self._emit(line)
        return len(text)

    def flush(self) -> None:
        if self._buffer:
            self._emit(self._buffer)
            self._buffer = ''

    def isatty(self) -> bool:
        return False


@dataclass
class Job:
    id: str
    name: str
    status: JobStatus = 'generating'
    lines: list[str] = field(default_factory=list)
    error: str | None = None
    sop_markdown: str | None = None
    gaps_markdown: str | None = None
    stage_index: int = -1
    stage_labels: list[str] = field(default_factory=list)
    progress_drift: bool = False
    # An existing SOP to revise (the frontend's "Current SOP" upload), staged outside
    # inputs/ by main.py. None means generate from scratch.
    draft_path: Path | None = None
    subscribers: list[asyncio.Queue] = field(default_factory=list)

    @property
    def dir(self) -> Path:
        return config.RUNS_DIR / self.id


_jobs: dict[str, Job] = {}
_run_lock = asyncio.Lock()


def get(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def is_busy() -> bool:
    return _run_lock.locked()


def _progress_payload(job: Job) -> dict:
    return {
        'stage_index': job.stage_index,
        'stage_count': STAGE_COUNT,
        'label': job.stage_labels[job.stage_index] if job.stage_index >= 0 else None,
    }


def subscribe(job: Job) -> asyncio.Queue:
    """Attach a queue pre-loaded with everything logged so far.

    Replaying history means a client that connects late — or reconnects — sees the
    whole run, not just the tail.
    """
    queue: asyncio.Queue = asyncio.Queue()
    for line in job.lines:
        queue.put_nowait(('log', line))
    if job.stage_index >= 0:
        queue.put_nowait(('progress', _progress_payload(job)))
    if job.status != 'generating':
        queue.put_nowait(('status', job.status))
        queue.put_nowait((_DONE, None))
    else:
        job.subscribers.append(queue)
    return queue


def unsubscribe(job: Job, queue: asyncio.Queue) -> None:
    if queue in job.subscribers:
        job.subscribers.remove(queue)


def _publish(job: Job, event, data) -> None:
    for queue in list(job.subscribers):
        queue.put_nowait((event, data))


def create(name: str) -> Job:
    job = Job(id=uuid.uuid4().hex[:12], name=name)
    _jobs[job.id] = job
    (job.dir / 'inputs').mkdir(parents=True, exist_ok=True)
    return job


def delete(job_id: str) -> bool:
    job = _jobs.pop(job_id, None)
    if job is None:
        return False
    _publish(job, 'status', job.status)
    _publish(job, _DONE, None)
    shutil.rmtree(job.dir, ignore_errors=True)
    return True


async def run(job: Job) -> None:
    """Execute the pipeline for `job`, streaming its stdout to subscribers."""
    # Imported here rather than at module scope purely so an import error surfaces
    # against a job (and reaches the UI) instead of killing server startup.
    from sop_pipeline import pipeline

    loop = asyncio.get_running_loop()

    def emit(raw_line: str) -> None:
        # Called from the worker thread; hop back to the loop before touching
        # asyncio queues.
        def deliver() -> None:
            line = _clean_line(raw_line)
            if _is_progress_bar_line(line):
                return
            job.lines.append(line)
            _publish(job, 'log', line)
            label = _match_stage_header(line)
            if label is not None:
                job.stage_labels.append(label)
                job.stage_index = len(job.stage_labels) - 1
                _publish(job, 'progress', _progress_payload(job))

        loop.call_soon_threadsafe(deliver)

    def work() -> Path:
        writer = _LineWriter(emit)
        with redirect_stdout(writer):
            try:
                return pipeline.run(
                    job.dir / 'inputs',
                    job.dir / 'out',
                    config.SCHEMA_GUIDE_PATH,
                    sop_path=job.draft_path,
                )
            finally:
                writer.flush()

    async with _run_lock:
        try:
            sop_path = await run_in_threadpool(work)
            job.sop_markdown = sop_path.read_text(encoding='utf-8')
            gaps = job.dir / 'out' / 'gaps_report.md'
            if gaps.is_file():
                job.gaps_markdown = gaps.read_text(encoding='utf-8')
            if job.stage_index < STAGE_COUNT - 1:
                job.progress_drift = True
                job.lines.append(
                    f'WARNING: completed at stage {job.stage_index + 1}/{STAGE_COUNT}; '
                    'pipeline wording likely changed'
                )
                _publish(job, 'log', job.lines[-1])
            job.status = 'ready'
        except Exception as exc:  # noqa: BLE001 - the UI shows whatever went wrong
            job.status = 'failed'
            job.error = f'{type(exc).__name__}: {exc}' if str(exc) else type(exc).__name__
            traceback.print_exc()
        finally:
            _publish(job, 'status', job.status)
            _publish(job, _DONE, None)
            job.subscribers.clear()

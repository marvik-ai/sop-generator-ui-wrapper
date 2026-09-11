"""FastAPI host for the SOP pipeline.

No CORS config: the Vite dev server proxies /api to this process, so the browser only
ever talks to its own origin.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from . import config, jobs
from .models import JobSnapshot, RunAccepted

# How long to wait on a subscriber queue before emitting an SSE comment, so idle
# proxies don't drop the connection during the long silent LLM stages.
HEARTBEAT_SECONDS = 15.0


@asynccontextmanager
async def lifespan(_: FastAPI):
    config.check()
    yield


app = FastAPI(title='SOP Generator host', lifespan=lifespan)


def _safe_relative_path(path_str: str | None) -> Path:
    """Validate a client-supplied relative path, preserving one level of folder nesting.

    A loose file is just its name; a file picked from inside a folder in the UI is
    "<folder>/<name>". Reject anything that could escape `inputs/` (absolute paths,
    `..` components) rather than flattening it away, since the pipeline's `load_corpus`
    relies on that one level of directory structure being intact on disk.
    """
    raw = (path_str or '').replace('\\', '/')
    parts = [part for part in raw.split('/') if part not in ('', '.')]
    if not parts or any(part == '..' for part in parts) or Path(raw).is_absolute():
        raise HTTPException(400, f'Invalid file path: {path_str!r}')
    if any(part.startswith('.') for part in parts):
        raise HTTPException(400, f'Invalid file path: {path_str!r}')
    return Path(*parts)


@app.post('/api/runs', status_code=202, response_model=RunAccepted)
async def create_run(
    background: BackgroundTasks,
    name: str = Form(...),
    files: list[UploadFile] = File(...),
    paths: list[str] = Form(...),
    description: str = Form(''),
    draft: UploadFile | None = File(None),
) -> RunAccepted:
    if not name.strip():
        raise HTTPException(400, 'A name is required.')
    if jobs.is_busy():
        raise HTTPException(409, 'A generation is already running. Wait for it to finish.')
    if len(files) != len(paths):
        raise HTTPException(400, 'files and paths must line up 1:1.')

    staged: list[tuple[Path, bytes]] = []
    for upload, path_str in zip(files, paths):
        rel_path = _safe_relative_path(path_str)
        if rel_path.suffix.lower() not in config.ALLOWED_SUFFIXES:
            raise HTTPException(
                400,
                f'{rel_path}: unsupported file type. Allowed: '
                + ', '.join(sorted(config.ALLOWED_SUFFIXES)),
            )
        staged.append((rel_path, await upload.read()))

    if not staged:
        raise HTTPException(400, 'At least one input file is required.')

    staged_draft: tuple[Path, bytes] | None = None
    if draft is not None:
        draft_rel_path = _safe_relative_path(draft.filename)
        if draft_rel_path.suffix.lower() not in config.ALLOWED_SUFFIXES:
            raise HTTPException(
                400,
                f'{draft_rel_path}: unsupported file type. Allowed: '
                + ', '.join(sorted(config.ALLOWED_SUFFIXES)),
            )
        staged_draft = (draft_rel_path, await draft.read())

    job = jobs.create(name.strip(), description.strip())
    for rel_path, content in staged:
        destination = job.dir / 'inputs' / rel_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

    if staged_draft is not None:
        draft_rel_path, draft_content = staged_draft
        draft_destination = job.dir / 'draft' / draft_rel_path
        draft_destination.parent.mkdir(parents=True, exist_ok=True)
        draft_destination.write_bytes(draft_content)
        job.draft_path = draft_destination

    background.add_task(jobs.run, job)
    return RunAccepted(job_id=job.id)


@app.get('/api/runs/{job_id}', response_model=JobSnapshot)
async def get_run(job_id: str) -> JobSnapshot:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, 'No such job.')
    return JobSnapshot(
        id=job.id,
        name=job.name,
        status=job.status,
        lines=job.lines,
        error=job.error,
        sop_markdown=job.sop_markdown,
        gaps_markdown=job.gaps_markdown,
        stage_index=job.stage_index,
        progress_drift=job.progress_drift,
    )


@app.delete('/api/runs/{job_id}', status_code=204)
async def delete_run(job_id: str) -> None:
    if not jobs.delete(job_id):
        raise HTTPException(404, 'No such job.')


def _sse(event: str, payload: dict) -> str:
    return f'event: {event}\ndata: {json.dumps(payload)}\n\n'


@app.get('/api/runs/{job_id}/events')
async def stream_run(job_id: str) -> StreamingResponse:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, 'No such job.')

    queue = jobs.subscribe(job)

    async def events():
        try:
            while True:
                try:
                    event, data = await asyncio.wait_for(queue.get(), HEARTBEAT_SECONDS)
                except TimeoutError:
                    yield ': keep-alive\n\n'
                    continue

                if event == 'log':
                    yield _sse('log', {'line': data})
                elif event == 'progress':
                    yield _sse('progress', data)
                elif event == 'status':
                    yield _sse('status', {'status': data, 'error': job.error})
                else:
                    return
        finally:
            jobs.unsubscribe(job, queue)

    return StreamingResponse(
        events(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )

"""Wire formats. Kept separate from the in-memory Job so the SSE/JSON contract is
readable in one place."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

JobStatus = Literal['generating', 'ready', 'failed']


class RunAccepted(BaseModel):
    job_id: str


class JobSnapshot(BaseModel):
    id: str
    name: str
    status: JobStatus
    lines: list[str]
    error: str | None = None
    sop_markdown: str | None = None
    gaps_markdown: str | None = None
    stage_index: int = -1
    progress_drift: bool = False

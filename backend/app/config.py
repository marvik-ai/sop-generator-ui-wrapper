"""Settings resolution for the SOP host.

Everything is resolved once at import and validated explicitly by `check()`, which
main.py calls on startup so misconfiguration fails loudly at boot rather than three
minutes into a run.
"""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent


def _load_dotenv() -> None:
    """Read backend/.env into os.environ without adding a dependency.

    Mirrors the pipeline's own loader (sop_generator/src/sop_pipeline/llm.py): uses
    setdefault, so a real environment variable always beats the file.
    """
    env_path = BACKEND_DIR / '.env'
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

SOP_GENERATOR_PATH = Path(
    os.environ.get('SOP_GENERATOR_PATH') or REPO_DIR.parent / 'sop_generator'
).resolve()

# Env var wins; otherwise fall back to the guide tracked at the pipeline repo root.
SCHEMA_GUIDE_PATH = Path(
    os.environ.get('SCHEMA_GUIDE_PATH') or SOP_GENERATOR_PATH / 'sop_template_guide.md'
).resolve()

RUNS_DIR = Path(os.environ.get('RUNS_DIR') or BACKEND_DIR / 'runs').resolve()

# What the pipeline's ingest layer will read (ingest.py:20-21).
ALLOWED_SUFFIXES = {'.docx', '.md', '.markdown', '.txt', '.mp4', '.vtt'}


def check() -> None:
    """Raise with an actionable message if the host cannot possibly run a job."""
    if not SOP_GENERATOR_PATH.is_dir():
        raise RuntimeError(
            f'sop_generator repo not found at {SOP_GENERATOR_PATH}. '
            'Set SOP_GENERATOR_PATH in backend/.env.'
        )
    if not (SOP_GENERATOR_PATH / 'prompts').is_dir():
        raise RuntimeError(
            f'{SOP_GENERATOR_PATH} has no prompts/ directory. The pipeline resolves its '
            'prompts relative to the repo root, so it must be installed editable with the '
            'source tree intact.'
        )
    if not SCHEMA_GUIDE_PATH.is_file():
        raise RuntimeError(
            f'Schema guide not found at {SCHEMA_GUIDE_PATH}. '
            'Set SCHEMA_GUIDE_PATH in backend/.env.'
        )
    if not os.environ.get('OPENAI_API_KEY') and not (SOP_GENERATOR_PATH / '.env').is_file():
        raise RuntimeError(
            'OPENAI_API_KEY is not set and there is no sop_generator/.env to fall back to. '
            'Copy backend/.env.example to backend/.env and fill it in.'
        )
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

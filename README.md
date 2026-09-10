# SOP Generator UI Wrapper

This repository contains the web interface and FastAPI host for the SOP generation
pipeline. The frontend lets a user upload source files and watch generation progress;
the backend runs the pipeline from the sibling `sop_generator` repository and streams
its logs and result back to the browser.

## How the pieces fit together

```text
Browser (Vite + React, :5173)
        │ /api proxy
        ▼
FastAPI host (:8000)
        │ imports and runs the pipeline
        ▼
../sop_generator
```

The pipeline is not a third long-running server. Start the frontend and backend, then
the backend runs the pipeline in the background whenever the UI starts a generation.

## Prerequisites

- Node.js 20.19+ or a current Node.js LTS release
- pnpm
- Python 3.12
- [uv](https://docs.astral.sh/uv/)
- An OpenAI API key already configured for the pipeline
- The `sop_generator` repository checked out next to this repository

The default directory layout is:

```text
<parent-directory>/
├── sop-generator-ui-wrapper/
└── sop_generator/
```

The backend installs `sop_generator` as an editable local dependency and expects this
layout by default. If the pipeline repository is somewhere else, see
[Configuration](#configuration).

## First-time setup

Run these commands from the wrapper repository:

```bash
cd sop-generator-ui-wrapper

# Install the frontend dependencies.
pnpm install

# Install the backend, pipeline, and Python dependencies.
uv sync --project backend
```

No `backend/.env` file is required for the default setup. The pipeline uses the
existing configuration in the sibling `sop_generator/.env`, so you do not need to
create or duplicate a second API-key file in this repository. Leave that existing
pipeline configuration in place and start the backend as described below.

If you need to override paths or credentials specifically for the wrapper, create
`backend/.env` from `backend/.env.example` and set only the values you want to override:

```dotenv
OPENAI_API_KEY=your_api_key_here
```

The backend validates its configuration when it starts. It also checks that the
sibling pipeline contains both `prompts/` and `sop_template_guide.md`.

## Run the application

Use two terminals, both opened in `sop-generator-ui-wrapper`.

Terminal 1 — frontend:

```bash
pnpm dev
```

Terminal 2 — backend:

```bash
pnpm dev:api
```

Open [http://localhost:5173](http://localhost:5173). The Vite server proxies `/api`
requests to the FastAPI host at `http://127.0.0.1:8000`, so no separate CORS setup is
needed.

## Generate an SOP

1. Enter a name and, optionally, a description.
2. Add one or more source files, or select a folder of related files.
3. Supported input types are `.txt`, `.md`, `.markdown`, `.docx`, and `.mp4`.
4. Optionally upload a **Current SOP** to revise an existing SOP instead of starting
   from scratch.
5. Select **Generate SOP**.
6. Watch the streamed pipeline log in **Generation Detail**. When the run is ready,
   open the **SOP** tab or download the generated Markdown file.

Uploaded files and generated artifacts are stored under `backend/runs/` while the
backend is running. Job state is held in memory and is lost when the backend restarts.
Only one generation can run at a time.

## Configuration

`backend/.env.example` documents the available settings:

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | Optional wrapper override. If unset, the pipeline uses its existing `sop_generator/.env` configuration. |
| `SOP_GENERATOR_PATH` | `../sop_generator` | Absolute path to the pipeline repository. |
| `SCHEMA_GUIDE_PATH` | `$SOP_GENERATOR_PATH/sop_template_guide.md` | Markdown schema guide used to structure generated SOPs. |
| `RUNS_DIR` | `backend/runs` | Directory for per-job inputs and outputs. |

If `sop_generator` is not next to the wrapper, set `SOP_GENERATOR_PATH` and
`SCHEMA_GUIDE_PATH` to absolute paths in `backend/.env`. The editable dependency path
in `backend/pyproject.toml` also points to the sibling repository, so the default
layout is the simplest setup.

## Useful commands

```bash
# Frontend development server
pnpm dev

# FastAPI backend with reload
pnpm dev:api

# Type-check and build the frontend
pnpm build

# Lint the frontend
pnpm lint
```

For direct pipeline CLI usage outside the UI, see the
[`sop_generator` README](../sop_generator/README.md). The UI path normally does not
require a separate pipeline command: `pnpm dev:api` loads the pipeline and invokes it
for each submitted job.

## Troubleshooting

### `sop_generator repo not found`

Place the pipeline repository next to the wrapper, or set `SOP_GENERATOR_PATH` in
`backend/.env` and run `uv sync --project backend` again.

### `OPENAI_API_KEY is not available`

The default setup reads the pipeline's existing `sop_generator/.env` configuration. If
you choose to use a wrapper-specific override, create `backend/.env`, set a non-empty
`OPENAI_API_KEY`, and restart the backend terminal.

### The UI cannot connect or generation fails immediately

Confirm that both `pnpm dev` and `pnpm dev:api` are still running. The frontend only
proxies `/api` while the Vite server is running, and the backend must pass its startup
configuration checks before it can accept a job.

### A generation is already running

The current backend is intentionally single-run. Wait for the active job to finish
before starting another one.

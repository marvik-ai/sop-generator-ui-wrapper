# Baseline: connecting the SOP Generator frontend to the real pipeline

> **SUPERSEDED — kept for its audit of the pipeline, not for its recommendations.**
> The integration was built differently from what this doc proposes:
>
> - **FastAPI (`backend/`), not a Node host.** The pipeline turned out to be a clean
>   importable library (`pipeline.run(...)`, no import-time side effects), so the host
>   imports it rather than shelling out to `uv run sop-pipeline run`.
> - **The timeline UI was replaced by a log console**, not simplified into 9 flat stage
>   rows. `GenerationTimeline` / `GenerationStepCard` / `SubStepRow` are deleted.
> - **Open decisions resolved:** host lives in `backend/` in this repo; SSE (as suggested);
>   `--schema-guide` defaults to `<sop_generator>/sop_template_guide.md`, overridable via
>   `SCHEMA_GUIDE_PATH`; `OPENAI_API_KEY` comes from `backend/.env`, falling back to the
>   pipeline's own `.env`.
>
> Everything below about *what the pipeline is* (stage lines, inputs, outputs, runtime)
> is still accurate. See `CLAUDE.md` for the current architecture.

Handoff doc for the session that wires up the integration. Written from a read-only
audit of `../sop_generator` (**never modify that repo** — it's a separate, self-contained
project) plus the current state of this frontend.

## What the pipeline actually is

`../sop_generator` is a **local Python CLI**, not a service. There is no REST API,
no WebSocket, no queue — nothing to "connect" to over the network today.

- Entry point: `uv run sop-pipeline run --inputs inputs/ --schema-guide <path>`
  ([cli.py](../../sop_generator/src/sop_pipeline/cli.py)).
- Required args: `--inputs` (a folder of `.docx`/`.md`/`.txt`/`.mp4` files, subfolders
  = one related group), `--schema-guide` (a file path, **required, not tracked in that
  repo** — must be supplied out-of-band).
- Required env: `OPENAI_API_KEY` in `sop_generator/.env` (copy from `.env.example`).
  Optional model overrides live in the same file.
- Runtime: several sequential GPT-4o / gpt-4o-mini calls per stage — expect **minutes**,
  not seconds, per run.
- Output: `out/sop_generated.md` (the SOP, with an appended Mermaid diagram annex),
  plus `out/gaps_report.md`, `out/sop_flow_diagram.svg`/`.mmd`, and extraction JSON.
- Progress reporting is **plain `print()` lines**, one per stage, to stdout
  ([pipeline.py:948-1031](../../sop_generator/src/sop_pipeline/pipeline.py)):

  ```
  Loaded {n} input file(s).
  Extracting statements...
    extracted {n} statements from {file}
  Reconciling cross-file conflicts...
    found {n} cross-file conflict(s).
  Synthesizing SOP...
  Auditing for hallucinations / missing gaps...
  Revising SOP from audit findings...
  Generating flow diagram...
  Deriving cross-cutting invariants...
  Assembling front matter + Table of Contents...
  Done -> {sop_path}
  ```

  That's **9 flat stage names**, no percentage, no sub-step timing. There is no way
  to get finer-grained progress without editing the pipeline — which is off-limits.

## Why "direct connection" still needs a thin host process

The frontend is a static Vite/React SPA with no backend today (see root `CLAUDE.md`).
A browser cannot spawn a subprocess or read `sop_generator`'s local filesystem. So the
minimum viable "direct" integration for this POC is:

1. **A small local process host** — e.g. a lightweight Node server (Express/Fastify,
   or a Vite dev-server middleware) run alongside `pnpm dev`. This is the only new
   moving part; it is not a queue, database, or auth layer — just a subprocess runner.
2. **Frontend → host, over HTTP/SSE.** The host is the only thing that shells out to
   `uv run sop-pipeline run ...`.
3. **Flow:**
   - Frontend POSTs `{ name, files }` (files as multipart or base64) to the host.
   - Host writes files to a temp `inputs/<run-id>/` folder inside (or symlinked into)
     `sop_generator/`.
   - Host spawns `uv run sop-pipeline run --inputs <tmp> --schema-guide <fixed path> --out <tmp>/out`
     as a child process from `sop_generator`'s directory, with `cwd` and env
     (`OPENAI_API_KEY` etc.) set correctly.
   - Host tails the child's stdout and forwards each stage line to the frontend via
     Server-Sent Events (simplest for one-directional progress) or a WebSocket.
   - On process exit, host reads `out/sop_generated.md` (+ `gaps_report.md`) and either
     includes it in the final SSE event or serves it from a follow-up GET.
4. **`--schema-guide` needs a fixed answer for the POC** — since it's required and not
   tracked in `sop_generator`, decide now whether this frontend/host ships its own
   copy of a schema guide file (checked into this repo or the host) and always passes
   that same path. Don't make the user supply it through the UI for this baseline.

No retries, auth, or multi-tenant run isolation needed for a POC — one run at a time,
one host process, is enough to prove the concept end-to-end.

## What has to change in the current frontend code

- [`useSopGeneration.ts`](../src/hooks/useSopGeneration.ts) currently *simulates*
  progress with a `setInterval` over a fake 4-steps × 7-substeps plan
  ([useSopGeneration.ts:7-23](../src/hooks/useSopGeneration.ts)). That fake plan has
  **no real counterpart** — the pipeline only reports 9 flat stage names, no substeps,
  no per-substep seconds. The generated timeline UI ([GenerationTimeline.tsx](../src/components/GenerationTimeline.tsx),
  [GenerationStepCard.tsx](../src/components/GenerationStepCard.tsx),
  [SubStepRow.tsx](../src/components/SubStepRow.tsx)) will need to be simplified to
  render ~9 flat stage rows (done/running/pending) instead of nested steps/substeps —
  or accept a coarser, less "alive" looking progress UI than what's mocked today.
- `startGeneration(name, files)` needs to call the new host endpoint instead of driving
  the local timer, and consume the SSE/WebSocket stream to update `steps`/`progress`/`sop.status`.
- `sop.status` only has `generating`/`ready` today — add a `failed`/`error` status,
  since a real pipeline run (real LLM calls, real files) can fail in ways the mock
  never did. Surface the failure with the last stdout line or a generic message.
- File upload: `FileDropzone` currently only tracks `File.name` as a string
  ([SopGenerator.tsx](../src/pages/SopGenerator/SopGenerator.tsx)) — it will need to
  keep the actual `File` objects (or their contents) to send to the host.

## Open decisions for the next session

1. Where does the host process live — a new top-level `server/` in this repo, or a
   separate small service? (Recommend: inside this repo, since it's POC-scoped and
   only this frontend calls it.)
2. SSE vs WebSocket for progress — SSE is simpler and sufficient (one-directional,
   no reconnection logic needed for a single short-lived run).
3. Where does the fixed `--schema-guide` file live, and who owns keeping it in sync
   with the 11-section schema the pipeline expects?
4. Confirm `OPENAI_API_KEY` / `.env` handling for local dev — whose key, and how the
   host process picks it up (likely just its own `.env`, separate from `sop_generator/.env`
   unless the host runs pipeline commands with `sop_generator` as `cwd` and inherits
   that repo's `.env` via `uv run`).

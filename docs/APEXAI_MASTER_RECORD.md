# ApexAI Master Record

Last updated: 2026-06-11

## Purpose

This file is the canonical project record for ApexAI. It serves two jobs:

1. It stores the running implementation history from the start of the project.
2. It explains how the current system works across frontend, backend, APIs, data flow, and file structure.

Whenever a new change is made, this file must be updated in the same pass and the DOCX export should be regenerated from it.

## Documentation Discipline

Every implementation pass must leave a human-readable record behind. This is required for feature work, bug fixes, setup changes, styling changes, data-model changes, and operational fixes.

Each change log entry should explain:

- what changed in plain language
- why the change was made
- which parts of the system were touched
- how the change was verified
- any known caveats, follow-ups, or environment notes

For normal code changes, update this Markdown file before considering the task complete. If the change affects the user-facing app, API contracts, setup flow, data model, or project behavior, also regenerate `docs/ApexAI_Project_Record.docx` from this source using `docs/generate_project_doc.py`.

## Project Summary

ApexAI is a full-stack Formula 1 analytics platform built with:

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Recharts, custom Canvas replay rendering
- Backend: FastAPI, Pydantic, SQLAlchemy, JWT auth
- Data: FastF1 for live and historical F1 session data, SQLite for local product persistence, optional OpenAI-backed enhancements

The product currently includes:

- Landing and concept-driven product UI
- Login and protected app flows
- Telemetry analysis workspace
- Lap comparison and telemetry-derived insights
- Race replay system
- AI race engineer workflow
- Race report generator
- Result predictor
- F1 chatbot
- User profile management
- Activity history and saved outputs

## Chronological Update History

### Phase 29: One-Command Local Startup Pass

- Added a root-level one-command development launcher so the project can be started from a single terminal instead of opening separate backend and frontend shells every time.
- Added a root `package.json` with:
  - `npm run dev` for the default local startup flow
  - `npm run dev:ports` as a documented port-override entry point
  - `npm run stop` to shut both launcher-owned processes down cleanly
- Added a Windows-friendly PowerShell runner at `scripts/run-dev.ps1`:
  - checks that backend and frontend directories exist
  - checks that the backend virtualenv Python exists
  - locates `npm.cmd`
  - validates that the requested ports are free before startup
  - starts FastAPI and Next.js from one root command in the active Windows environment
  - waits for backend health and frontend HTTP readiness
  - writes runtime state so the services can be stopped later through one matching command
- Added `scripts/stop-dev.ps1` so the root launcher has a clear teardown path instead of leaving orphaned development processes behind.
- Added Git hygiene for local runner artifacts:
  - `.codex/` is now ignored so local Codex-generated logs and helper runtime files do not pollute Git status before a GitHub push
  - temporary launcher runtime folders remain ignored as local-only state
- Updated the top-level `README.md` so the default local run flow is now documented as a single command from the repo root.
- Preserved the original separate backend/frontend startup commands for debugging and direct service work. This pass adds orchestration convenience without removing the old paths.

Technical files changed in this pass:

- `package.json`
- `scripts/run-dev.ps1`
- `README.md`
- `docs/APEXAI_MASTER_RECORD.md`
- `docs/ApexAI_Project_Record.docx`

Verification for this pass:

- one-command launcher smoke test on alternate ports
- doc regeneration: `python docs/generate_project_doc.py`

Known notes:

- The new root launcher is designed around the current Windows development environment because that is the active project setup.

### Phase 28: Driver Compare Analytics Deepening Pass

- Extended the Driver Compare feature without changing its existing FastF1-backed request flow, lap selection model, or prior comparison blocks.
- Added a richer session-analysis layer at the top of compare:
  - session summary now appears directly inside the compare verdict area
  - weather and backend insight lines are surfaced so users can read the lap comparison in weekend context instead of as isolated numbers
- Added compare-specific coaching summaries using backend `performance` data:
  - benchmark summary
  - coaching focus
  - braking style
  - throttle style
  - corner profile
  - consistency score
  - mistake flags when the backend detects an execution signature
- Added a micro-sector swing section using backend `micro_sectors`:
  - counts how many micro-sectors each selected lap leads
  - highlights the biggest gain and biggest loss zone
  - lists segment distance ranges and corner-type tags so users can localize the pace difference more precisely
- Added a full trace-analysis layer to Driver Compare using the existing telemetry components:
  - synced speed, throttle, brake, steering, gear, RPM, and delta traces can now be shown directly inside compare
  - compare now includes a shared inspection window with zoom, pan, range sliders, drag-to-zoom, and a live cursor
  - compare now includes the backend track map and corner focus controls so the charts can be read in circuit context
  - all of this remains tied to the same selected FastF1 laps rather than any hardcoded compare dataset
- Expanded compare ranking readability:
  - benchmark rank cards now include lap delta to best
  - backend ranking summary text is shown directly in compare
  - backend main-loss corner context is surfaced when available
- Improved corner interpretation and naming on the compare page:
  - compare rows now prefer backend human-readable corner labels
  - official corner names are carried through when available
  - confidence percentage and segmentation quality are visible in the compare corner review
  - corner hints are surfaced so the analysis reads more like engineering notes and less like a raw table
- Added a compare-specific corner trust layer:
  - users can see which backend corner detections are low confidence
  - the page now explains how to treat those corners as directional rather than final truth
- Removed a stale unused reverse-pair variable from the compare page while keeping all existing compare behavior intact.

Technical files changed in this pass:

- `frontend/src/app/compare/page.tsx`
- `docs/APEXAI_MASTER_RECORD.md`
- `docs/ApexAI_Project_Record.docx`

Verification for this pass:

- frontend production build: `npm run build`
- doc regeneration: `python docs/generate_project_doc.py`

Known notes:

- This pass intentionally improves analytical depth and readability without attempting the larger compare-page visual decluttering pass that is still planned for later frontend work.

### Phase 27: Driver Compare Completion Pass

- Reworked Driver Compare from a shallow metric duel into a data-rich FastF1 telemetry comparison workspace.
- Preserved the existing FastF1 data source path by continuing to use the telemetry API rather than hardcoded comparison data.
- Added exact lap selection for each compared driver:
  - lap choices come from FastF1-backed `lap_options`
  - each side compares one selected lap so the result is a clean driver-versus-driver benchmark
  - default lap selection normalizes to the best available lap returned by the telemetry response
- Added a clear comparison verdict:
  - explains which selected lap is faster
  - uses backend `pair_deltas` when available
  - falls back safely when complete lap timing is not available
- Added richer driver cards with lap time, compound, throttle, brake time, and top-speed context.
- Added sector delta analysis for S1, S2, and S3 so the user can see broad lap-shape differences before reading corner-level detail.
- Added backend rank display using telemetry `benchmark_rankings`:
  - overall rank
  - braking rank
  - apex rank
  - exit rank
  - straight-line rank
  - consistency rank
- Added corner gain/loss analysis from backend `pair_deltas`:
  - strongest relative gain for the comparison trace
  - largest relative loss for the comparison trace
  - top corner rows with total, entry, apex, and exit deltas
  - braking-point and throttle-pickup distance shifts
- Added data-quality reporting for compare:
  - cache hit state
  - number of loaded telemetry traces
  - unavailable reason
  - FastF1 diagnostics when present
- Added a copyable comparison debrief for users who want to move the analysis into a report or notes.
- Removed hardcoded default driver assumptions from the compare workflow; selected drivers now come from the loaded FastF1 weekend context.

Technical files changed in this pass:

- `frontend/src/app/compare/page.tsx`
- `docs/APEXAI_MASTER_RECORD.md`
- `docs/ApexAI_Project_Record.docx`

Verification for this pass:

- frontend production build: `npm run build`

Known notes:

- This pass focuses on feature completeness and readable data presentation. A broader visual decluttering pass is intentionally deferred until after the remaining product features are functionally complete.

### Phase 26: Telemetry Finalization And Handoff Pass

- Closed the remaining telemetry feature gaps so the project can move on to other website features without leaving backend telemetry metadata unused.
- Surfaced backend-owned telemetry analytics in the dashboard:
  - side-panel benchmark ranking now prefers the backend `benchmark_rankings` contract
  - selected pair review now prefers the backend `pair_deltas` contract
  - fallback frontend calculations remain available if older payloads do not include the new fields
- Added visible telemetry data-quality reporting:
  - corner cards now show confidence percentage and segmentation quality
  - low-confidence corners are summarized in the side panel
  - cache hit state, cache key, generated timestamp, series count, unavailable reason, and diagnostics are shown in an operator-oriented data-quality panel
- Improved track-map confidence readability:
  - marker colors now reflect high, medium, and low backend corner confidence
  - corner shortcut chips include confidence percentage when available
- Added a telemetry debrief handoff block:
  - dashboard generates a concise text debrief from selected traces, benchmark ranking, pair delta, priority corner, cache state, and data quality
  - debrief can be copied for use in the report workflow or external notes
- Expanded backend official-corner fallback coverage for common F1 venues beyond the initial small map.
- Preserved all existing telemetry behavior, including selected lap overlays, chart toggles, corner focus, drag-to-zoom, live cursor, delta chart, track map, and coaching side panel.

Technical files changed in this pass:

- `backend/app/services/fastf1_service.py`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`
- `frontend/src/components/telemetry-track-map.tsx`
- `docs/APEXAI_MASTER_RECORD.md`
- `docs/ApexAI_Project_Record.docx`

Verification for this pass:

- backend syntax check: `python -m py_compile backend/app/services/fastf1_service.py`
- synthetic telemetry analytics tests: `pytest backend/tests/test_telemetry_analytics.py`
- full backend regression suite: `pytest backend/tests` with `24 passed`
- frontend production build: `npm run build`

Known notes:

- Telemetry is now considered complete enough to move on. Remaining future work would be deeper product integration, not missing core telemetry capability.

### Phase 25: Telemetry Backend Completion Pass

- Completed the backend-focused telemetry refinement pass so the feature can be treated as a stable analytics contract before moving attention to other product areas.
- Added track-specific corner naming fallback support:
  - known circuit maps can attach official names such as Silverstone `Abbey` to detected telemetry turns
  - inferred labels remain available when a circuit is not in the backend map
  - stable `T1`, `T2`, etc. identifiers are preserved for focus and navigation behavior
- Improved corner segmentation metadata:
  - each detected corner now carries a `confidence_score`
  - each detected corner now carries a `segmentation_quality` value of `low`, `medium`, or `high`
  - track-map corner markers inherit the same confidence and naming metadata
- Added richer backend-owned lap benchmarking:
  - `benchmark_rankings` ranks selected traces by overall lap time
  - rankings include braking, apex, exit, straight-line, and consistency ranks
  - rankings identify each trace's main backend-detected loss corner when one dominates
- Added pair-ready backend delta contracts:
  - `pair_deltas` now contains reference/comparison lap deltas for every selected trace pair
  - each pair includes corner-level entry, apex, exit, braking-point, and throttle-pickup deltas
  - this reduces how much comparison logic future frontend views need to reconstruct locally
- Added explicit telemetry unavailable diagnostics:
  - unavailable payloads now include `unavailable_reason`
  - cache metadata includes diagnostics explaining missing FastF1, missing session, missing selected drivers, or missing telemetry streams
- Added telemetry cache metadata:
  - responses include cache key, generation timestamp, series count, cache hit state, diagnostics, and unavailable reason
  - cached telemetry responses are marked as cache hits on subsequent backend reads
- Added focused synthetic backend tests for telemetry analytics helper behavior without depending on live FastF1 availability.

Technical files changed in this pass:

- `backend/app/schemas/telemetry.py`
- `backend/app/services/fastf1_service.py`
- `backend/app/services/telemetry_service.py`
- `backend/tests/test_telemetry_analytics.py`
- `frontend/src/types/api.ts`
- `docs/APEXAI_MASTER_RECORD.md`
- `docs/ApexAI_Project_Record.docx`

Verification for this pass:

- backend syntax check: `python -m py_compile backend/app/schemas/telemetry.py backend/app/services/fastf1_service.py backend/app/services/telemetry_service.py backend/tests/test_telemetry_analytics.py`
- synthetic telemetry analytics tests: `pytest backend/tests/test_telemetry_analytics.py`
- telemetry API regression test: `pytest backend/tests/test_api.py -k telemetry`
- full backend regression suite: `pytest backend/tests` with `24 passed`
- frontend production build: `npm run build`

Known notes:

- These changes are additive. Existing telemetry fields remain in place for current frontend behavior.
- Official corner naming is intentionally a backend fallback map, not a full FIA circuit database. Unsupported circuits still receive inferred telemetry labels.

### Phase 24: Telemetry Coaching And Benchmark Readability Pass

- Strengthened the telemetry coaching layer so the side panel now explains selected trace pace in a more actionable race-engineering format instead of only showing raw summary heuristics.
- Added richer selected-trace benchmark ranking:
  - each selected trace is ranked against the selected lap set
  - each trace shows delta to the best selected benchmark lap
  - each trace highlights its main corner deficit or best-matched corner
  - coaching cues point the user toward the highest-value driving correction
- Improved corner naming and labeling across the telemetry feature:
  - backend corner payloads now include `corner_label` and `corner_hint`
  - labels include corner number, speed class, approximate shape, and whether the window behaves like a corner or complex
  - track-map markers and dashboard corner controls now surface the richer labels and hints
- Extended telemetry performance summaries with:
  - `lap_rank`
  - `delta_to_best_seconds`
  - `benchmark_summary`
  - `coaching_focus`
- Preserved the existing `T1`, `T2`, etc. identifiers for stable focus behavior while adding descriptive labels for humans.
- Fixed a track-map payload omission so selected lap payloads carry `track_map_points` through to the composed telemetry response.
- Added this documentation discipline section so future implementation passes must be logged in the project record.

Technical files changed in this pass:

- `backend/app/schemas/telemetry.py`
- `backend/app/services/fastf1_service.py`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`
- `frontend/src/components/telemetry-track-map.tsx`
- `frontend/src/types/api.ts`
- `docs/APEXAI_MASTER_RECORD.md`
- `docs/ApexAI_Project_Record.docx`

Verification for this pass:

- backend syntax check: `python -m py_compile backend/app/schemas/telemetry.py backend/app/services/fastf1_service.py`
- frontend production build: `npm run build`
- telemetry API regression test: `pytest backend/tests/test_api.py -k telemetry`
- manual local run confirmed backend/frontend login and telemetry workspace behavior

Known notes:

- A full backend test run exposed an existing unrelated FastF1 weekend-context assertion where the endpoint reported `source=fastf1` with zero drivers. The telemetry-specific test passed.

### Phase 15: Telemetry Overlay And Stability Pass

- Fixed the dashboard telemetry request loop that was causing visible flickering and repeated `/api/v1/telemetry` calls whenever lap selections were normalized after each response.
- Hardened telemetry empty states so dashboard KPIs no longer surface invalid values such as negative infinity when FastF1 telemetry is temporarily unavailable or still loading.
- Promoted telemetry laps to first-class overlay traces instead of one-lap-per-driver state:
  - backend now supports multiple explicit lap selections for the same driver in a single request
  - frontend now stores per-driver lap arrays and sends repeated `lap_selections` query values
- Added stable telemetry trace identifiers and labels across the telemetry stack:
  - `series_key` for rendering identity
  - `label` for display identity such as `George Russell L21`
- Updated FastF1 telemetry aggregation so selected overlay laps are carried through:
  - session telemetry loading
  - metrics generation
  - micro-sector summaries
  - corner delta breakdown
  - smart analytics summaries
- Reworked telemetry charts and HUD rendering to use per-trace identifiers instead of driver-name-only keys, which prevents collisions when the same driver is shown more than once with different laps.
- Reworked the telemetry filter UI from a single selected lap dropdown into selectable lap overlay chips, with up to three laps per driver supported in the dashboard workspace.
- Fixed telemetry-side panel assumptions so richer telemetry payloads remain safe during loading and multi-lap rendering.
- Verified this pass with:
  - backend tests: `21 passed`
  - frontend production build: passed

Technical files changed in this pass:

- `backend/app/services/fastf1_service.py`
- `backend/app/services/telemetry_service.py`
- `backend/app/schemas/telemetry.py`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-chart.tsx`
- `frontend/src/components/telemetry-hud.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/api.ts`

### Phase 16: Telemetry Inspection Workflow Pass

- Extended the telemetry workspace from “overlay traces exist” to “overlay traces are inspectable”.
- Added shared telemetry inspection window state to the dashboard so all visible telemetry charts operate on the same focused distance slice.
- Added quick corner jump controls using the computed corner breakdown data, allowing the user to focus the charts on a specific braking zone and exit sequence without manually scanning the full lap.
- Added explicit delta pair selection so the delta chart no longer always compares the first two traces implicitly. Users can now choose which reference trace and which comparison trace should drive the delta graph.
- Added basic zoom and pan controls for the shared telemetry inspection window:
  - reset to full lap
  - zoom in
  - zoom out
  - shift left
  - shift right
- Updated telemetry chart rendering to accept a shared distance window and filter trace rows accordingly, keeping graph navigation aligned across speed, throttle, brake, steering, gear, RPM, and delta charts.
- Updated the delta chart to compare selected trace pairs by stable overlay identity instead of relying on series order alone.
- Cleaned up telemetry analysis panel labeling so trace identity is shown as explicit lap overlays rather than ambiguous driver-only labels.
- Fixed remaining display issues such as telemetry bullet separator encoding so the workspace reads more cleanly.

Technical files changed in this pass:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-chart.tsx`
- `frontend/src/components/telemetry-delta-chart.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 17: Telemetry Precision Controls Pass

- Added more precise shared distance-window controls to the telemetry dashboard using manual start and end range sliders.
- Added a live telemetry window readout so the user can see the exact distance slice being inspected and whether that slice is bound to a focused corner.
- Added same-driver lap-set comparison summaries in the telemetry side panel so multi-lap overlays are not only visual but analytically summarized.
- Preserved the shared overlay model and corner navigation workflow while improving the operator’s ability to inspect a subsection of the lap with less guesswork.

Technical files changed in this pass:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 18: Telemetry Pair Analysis Pass

- Added pair-specific telemetry analysis to the side rail so the currently selected delta pair is summarized in text, not just shown as a line chart.
- The telemetry side panel now explains:
  - selected lap gap for the chosen comparison pair
  - strongest gain corner
  - largest loss corner
  - focused-corner entry/apex/exit deltas
  - braking-point and throttle-pickup distance shifts for the chosen pair
- This makes the reference/comparison selector materially more useful by turning the selected delta pair into a readable engineering debrief.

Technical files changed in this pass:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 19: Telemetry Corner Modeling Pass

- Reworked telemetry corner detection on the backend so the dashboard no longer relies on a simple brake-threshold heuristic to find every corner.
- Corner zones are now detected from a blended activity model using brake pressure, steering load, throttle release, and speed context on the reference lap.
- Nearby zones are merged, duplicate apexes are filtered out, and corner windows are tightened so entry, apex, and exit timing align more closely with the actual shape of the lap.
- Entry, apex, and exit deltas now use phase boundaries derived from braking point and throttle pickup distance, which makes pair analysis and focused-corner readouts more believable.
- Cleaned the telemetry UI text layer so overlay chips, corner shortcuts, and the side analysis rail no longer show garbled bullet characters.

Technical files changed in this pass:

- `backend/app/services/fastf1_service.py`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 20: Telemetry Interaction Pass

- Rebuilt the main telemetry chart component and the delta chart component to support direct drag-to-zoom interaction on the plots themselves.
- The shared inspection window can now be created by dragging across any telemetry chart or the delta chart, and double-clicking resets the focused window.
- Wired those chart interactions back into the dashboard-level distance window state so every telemetry panel stays synchronized.
- Expanded same-driver overlay review in the side rail with average lap, set spread, and best consistency summaries, which makes multi-lap same-driver analysis much more useful.

Technical files changed in this pass:

- `frontend/src/components/telemetry-chart.tsx`
- `frontend/src/components/telemetry-delta-chart.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 21: Telemetry Shared Cursor Pass

- Added a synchronized live cursor across the telemetry workspace so hovering any telemetry chart or the delta chart creates a shared inspection position.
- Each chart now shows a shared vertical reference line at the active hover distance, which makes cross-chart reading much easier.
- The dashboard now exposes a live cursor distance readout in the inspection controls.
- The telemetry side rail now includes a `Live Cursor Readout` section that shows per-trace speed, throttle, brake, gear, RPM, and steering values at the hovered distance.
- This makes the telemetry page behave much more like a real linked-cursor analysis desk instead of a set of independent charts.

Technical files changed in this pass:

- `frontend/src/components/telemetry-chart.tsx`
- `frontend/src/components/telemetry-delta-chart.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 22: Telemetry Track Navigator Pass

- Added a real telemetry track map payload to the backend, derived from FastF1 lap position data and aligned to lap distance.
- The telemetry response now includes:
  - normalized reference-lap track points
  - corner markers placed at apex distances
  - track-aware corner positions for frontend navigation
- Replaced generic `C1`, `C2`-style corner naming with `T1`, `T2`, and so on, so the analysis reads more naturally.
- Added a `Track Navigator` panel to the dashboard:
  - clickable corner markers
  - highlighted focused corner
  - live cursor marker that follows the shared chart hover distance
- This makes the telemetry workspace spatial as well as numerical, which is a major step toward a real race-engineering desk.

Technical files changed in this pass:

- `backend/app/schemas/telemetry.py`
- `backend/app/services/fastf1_service.py`
- `backend/app/services/telemetry_service.py`
- `frontend/src/types/api.ts`
- `frontend/src/components/telemetry-track-map.tsx`
- `frontend/src/app/dashboard/page.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 23: Telemetry Interpretation Pass

- Reworked the telemetry side rail so it no longer behaves like a raw stats dump. It now explains how to read the workspace in operator language, section by section.
- Added a new `How To Read This Workspace` section to the telemetry rail that teaches users:
  - when to trust a whole-lap view
  - when to zoom into a focused slice
  - how to use the live cursor
  - how to interpret the selected delta pair
- Expanded the explanation copy across the telemetry rail:
  - `Performance Snapshot` now explains ideal lap, lap delta, and reference-lap meaning
  - `Selected Laps` explains why lap identity matters before judging pace
  - `Live Cursor Readout` now explains how to compare speed, brake, throttle, steering, gear, and RPM at the same distance point
  - `Same-Driver Lap Set Review` now frames spread and consistency as repeatability checks
  - `Delta Pair Review` now explains gain/loss logic, corner priority, and entry/apex/exit meaning
  - `Sector And Micro-Sector Analysis` now explains how to use broad sectors versus smaller distance slices
  - `Corner Loss Breakdown` now defines entry, apex, and exit in plain language
  - `Smart Analytics` now explicitly states that these are heuristics derived from FastF1-backed telemetry, not direct feed fields
- Added a top-level telemetry reading guide to the dashboard hero so users understand how to read charts, delta, and the track navigator before diving into the workspace.
- Added explanatory copy to:
  - telemetry signal charts
  - delta chart
  - track navigator
  - graph toggle controls
  - focused inspection window controls
- Hardened telemetry KPI summaries so invalid values such as `-Infinity km/h` do not surface when FastF1 returns incomplete session metrics or the page is still transitioning through loading states.
- Cleaned up remaining UI text artifacts and replaced broken encoded symbols in the telemetry workspace with stable plain-text formatting.

Technical files changed in this pass:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/telemetry-chart.tsx`
- `frontend/src/components/telemetry-delta-chart.tsx`
- `frontend/src/components/telemetry-side-panel.tsx`
- `frontend/src/components/telemetry-track-map.tsx`

Verification for this pass:

- backend tests: `21 passed`
- frontend production build: passed

### Phase 1: Initial Project Build

- Created the foundational full-stack project structure under `backend/` and `frontend/`.
- Built a FastAPI backend with route groups for telemetry, strategy, report, prediction, chat, and health.
- Built a Next.js frontend with route pages for Home, Dashboard, Compare, Engineer, Predictor, Report, and Chatbot.
- Added the initial README and dependency manifests.

### Phase 2: Local Run, Setup, and Verification

- Installed backend dependencies and validated backend startup.
- Confirmed `/api/v1/health` and FastAPI root route behavior.
- Validated frontend production builds locally once Node.js became available.
- Fixed early VS Code run-path issues where the backend was started from the wrong folder.

### Phase 3: Frontend Direction and Visual Design

- Reworked the frontend through multiple design passes to align it with the supplied futuristic F1 references.
- Introduced:
  - animated backgrounds
  - scanlines
  - motion overlays
  - stronger typography
  - HUD-style surfaces
  - route-level transitions
  - animated custom cards
- Integrated the MP4 abstract F1 motion background into the landing hero.
- Removed copy and styling traces that made the site feel derivative.

### Phase 4: Backend Persistence and Auth

- Replaced simple in-memory behavior with SQLite-backed persistence.
- Added SQLAlchemy database session management, models, and seeding.
- Added demo auth:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- Added profile persistence fields:
  - full name
  - role
  - favorite team
  - favorite driver
  - location
  - bio
  - profile image
- Added a protected frontend login flow and auth provider.
- Protected the main product pages and API routes.

### Phase 5: Navigation, Profile, and History

- Added a profile page with editable user details.
- Added profile picture support and avatar rendering in the header.
- Refined main navigation and removed awkward header states.
- Added saved activity persistence for:
  - strategy generations
  - reports
  - predictions
  - chatbot runs
- Added a History page with expandable entries.

### Phase 6: FastF1-First Data Integration

- Integrated FastF1 into the backend as the primary race/session data source.
- Added season-aware calendar loading.
- Added weekend context loading for a selected `year + grand_prix + session`.
- Extended backend metadata to expose:
  - seasons
  - race lists
  - available sessions
  - featured race context
- Tightened the app so explicit historical selections prefer FastF1 and do not silently substitute fake local season data.
- Fixed environment problems caused by broken proxy values (`127.0.0.1:9`) that were preventing FastF1 from fetching data.
- Added FastF1 caching under `backend/.fastf1-cache`.

### Phase 7: Replay Feature

- Rebuilt the race replay feature from a Python/Arcade reference repository into a web-native system.
- Created:
  - `frontend/src/components/replay/RaceReplay.tsx`
  - `frontend/src/components/replay/ReplayCanvas.tsx`
  - `frontend/src/components/replay/ReplayControls.tsx`
  - `frontend/src/services/replayEngine.ts`
  - `frontend/src/services/telemetryService.ts`
  - `frontend/src/types/replay.ts`
- Added backend replay dataset generation backed by FastF1 session position data.
- Added an honest unavailable state when XY replay telemetry is not available.
- Fixed cases where the replay UI showed the same fallback-looking track for different sessions.

### Phase 8: Chatbot Expansion

- Improved the chatbot so general F1 questions get independent answers instead of incorrectly using featured-race context.
- Added driver-aware, team-aware, race-aware, and rule-aware answer routing.
- Expanded the built-in F1 knowledge base with broader domain coverage:
  - tyres
  - DRS
  - ERS
  - flags
  - penalties
  - teams
  - drivers
  - race aliases
  - regulations and strategy concepts
- Removed noisy answer prefixes and removed retrieved-context UI clutter from the chatbot.

### Phase 9: Telemetry Evolution

- Upgraded telemetry from basic speed/throttle/brake traces into a richer FastF1-backed analysis system.
- Added:
  - multi-channel telemetry traces
  - RPM trace
  - gear trace
  - DRS metrics
  - distance-based telemetry sampling
  - telemetry weather and session summaries
  - telemetry insights
- Added synchronized telemetry charts using shared Recharts sync IDs.
- Added a telemetry delta graph.
- Added a telemetry analysis side rail with:
  - ideal lap
  - lap delta
  - sector comparison
  - micro-sector comparison
  - corner breakdown
  - performance summary
  - consistency and mistake heuristics
- Added selected-lap support per driver.
- Added estimated steering trace derived from position curvature.
- Fixed a telemetry request loop that caused repeated API calls and visible UI flickering.
- Fixed runtime crashes caused by partially-loaded side-panel data.
- Fixed invalid empty-state stats like `-Infinity km/h`.

### Phase 10: Repo Hygiene and GitHub Readiness

- Expanded `.gitignore` to exclude:
  - caches
  - venv
  - `.next`
  - `.env.local`
  - FastF1 cache
  - logs
  - local DB/runtime artifacts
- Cleaned ignored junk out of the Git index.
- Verified remote GitHub configuration.

## Current System Architecture

### High-Level Request Lifecycle

For most user-facing pages, the system follows a consistent request lifecycle:

1. A route page loads and reads auth state from `AuthProvider`.
2. The page calls a typed helper from `frontend/src/services/api.ts`.
3. The helper builds a request against `NEXT_PUBLIC_API_BASE_URL`.
4. The request wrapper injects JSON headers, bearer auth when present, and `cache: "no-store"`.
5. FastAPI route handlers validate input and enforce auth through shared dependencies.
6. Service-layer code talks to:
   - FastF1 for racing/session/telemetry/replay data
   - SQLAlchemy-backed persistence for app-owned data
7. Pydantic serializes the result into a stable response shape.
8. The frontend receives typed JSON and renders charts, panels, or replay visuals.

### Data Ownership Model

The app deliberately separates data into three categories:

- FastF1-owned live or historical racing data:
  - season calendars
  - session rosters
  - telemetry
  - weather
  - timing
  - results
  - replay position streams
- App-owned persistent data:
  - users
  - profile fields
  - saved activities
  - local knowledge-base support content
- Frontend transient UI state:
  - selected year/race/session
  - selected drivers
  - selected laps
  - graph visibility
  - replay playback state
  - form inputs

## Backend Architecture

### Entry Point

- `backend/app/main.py`
  - Creates the FastAPI application
  - Applies CORS middleware
  - Creates tables on startup
  - Performs SQLite-safe schema upgrades for profile fields and saved activities
  - Seeds the local database
  - Mounts the main API router

#### Startup lifecycle details

The backend startup path uses a FastAPI lifespan handler. The startup sequence is:

1. `Base.metadata.create_all(bind=engine)` creates tables if they do not exist.
2. `ensure_user_profile_columns()` performs SQLite-safe compatibility upgrades for older local databases.
3. The same function ensures `saved_activities` exists even if the DB file predates that feature.
4. `seed_database(db)` inserts required baseline data such as the demo account and knowledge content.
5. The API begins serving requests.

This avoids needing a separate migration tool for the current local-development workflow while still keeping older SQLite files usable.

### Router Composition

- `backend/app/api/router.py`
  - Central route aggregator
  - Mounts all route groups under `/api/v1`

Mounted route groups:

- `health`
- `auth`
- `metadata`
- `history`
- `telemetry`
- `strategy`
- `report`
- `predict`
- `chat`
- `replay`

### Backend Layers

- Route layer:
  - validates request inputs
  - enforces auth where required
  - returns Pydantic response models
- Service layer:
  - contains business logic
  - talks to FastF1
  - prepares analytics
  - builds reports, predictions, replay datasets, etc.
- DB/repository layer:
  - stores user/profile/history/persistent data
  - provides seeded domain data helpers where still appropriate

### FastF1 Integration Strategy

FastF1 is the primary dynamic data provider. The backend uses it in three main operating modes:

1. Calendar mode
   - loads season schedules
   - powers season and Grand Prix selectors
2. Weekend-context mode
   - loads session-specific driver rosters, weather, and contextual summaries
3. Telemetry and replay mode
   - loads lap telemetry, timing, and XY position streams for analysis and replay

The main integration hub is:

- `backend/app/services/fastf1_service.py`

This service also maintains in-memory caches for:

- season calendars
- season metadata
- loaded sessions
- session telemetry bundles
- per-driver lap telemetry bundles
- driver lookup maps
- weekend context payloads

## Frontend Architecture

### App Router

- `frontend/src/app`
  - contains top-level route pages
  - wraps the app in auth and shell/layout providers
  - defines standalone pages like `/dashboard`, `/compare`, `/replay`, `/chatbot`, etc.

### Component Layer

- `frontend/src/components`
  - shared UI surfaces
  - auth gate/provider
  - telemetry widgets
  - replay widgets
  - navigation shell
  - status and stat cards

### Service Layer

- `frontend/src/services/api.ts`
  - central HTTP client for all backend API calls
- `frontend/src/services/replayEngine.ts`
  - replay timing/interpolation logic for Canvas-based race replay
- `frontend/src/services/telemetryService.ts`
  - replay-data support and helper logic tied to telemetry/replay rendering

### Type Layer

- `frontend/src/types/api.ts`
  - shared TypeScript contracts for backend API responses
- `frontend/src/types/replay.ts`
  - replay dataset and animation-related types

## Backend File-by-File Explanation

### Core backend

- `backend/app/main.py`
  - FastAPI app bootstrap, startup lifecycle, DB table creation, schema compatibility checks, and route mounting.
- `backend/app/api/router.py`
  - Combines all route modules into the versioned API.
- `backend/app/api/dependencies.py`
  - Shared auth dependency helpers, especially current-user resolution.
- `backend/app/core/config.py`
  - Environment-backed configuration including API prefix, JWT settings, and CORS origins.
- `backend/app/core/security.py`
  - Security helpers such as token creation/verification support.

#### Auth dependency behavior

Protected backend routes share a common auth pattern:

1. The client sends `Authorization: Bearer <token>`.
2. `get_current_user` validates and decodes the JWT.
3. The matching user is resolved from the database.
4. On failure, the route returns `401`.
5. On success, the route receives a typed `User` model instance.

### Backend route files

- `backend/app/api/routes/health.py`
  - Basic service health route.
- `backend/app/api/routes/auth.py`
  - Login, current-user read, and profile update routes.
- `backend/app/api/routes/metadata.py`
  - Seasons, calendars, metadata, and weekend-context routes.
- `backend/app/api/routes/history.py`
  - Returns saved user activities.
- `backend/app/api/routes/telemetry.py`
  - Returns telemetry analysis data for selected drivers and lap selections.
- `backend/app/api/routes/strategy.py`
  - Builds AI race-engineer style strategy responses and saves them.
- `backend/app/api/routes/report.py`
  - Generates race reports and saves them.
- `backend/app/api/routes/predict.py`
  - Generates prediction results and saves them.
- `backend/app/api/routes/chat.py`
  - Runs the F1 chatbot and saves the chat activity.
- `backend/app/api/routes/replay.py`
  - Returns a replay dataset for the race replay page.

#### Metadata route details

`backend/app/api/routes/metadata.py` intentionally exposes multiple specialized APIs:

- `/metadata`
  - richer season-level metadata
- `/calendar`
  - lightweight season race list
- `/weekend-context`
  - selected session driver/team/weather context
- `/seasons`
  - descending year list from the current year back to 1950

This separation exists so selector-heavy pages do not need to fetch the full season payload every time a year changes.

#### Replay route details

`backend/app/api/routes/replay.py` exposes `/replay` with:

- `year`
- `grand_prix`
- `session`
- optional `drivers` limit

The route validates the return value against the `ReplayDataset` schema before sending it to the frontend. That gives the replay UI a stable contract even when FastF1 data is incomplete or unavailable.

### Backend schemas

- `backend/app/schemas/auth.py`
  - Login, token, and user profile response/update models.
- `backend/app/schemas/chat.py`
  - Chat request and response models.
- `backend/app/schemas/history.py`
  - Saved activity response models.
- `backend/app/schemas/metadata.py`
  - Metadata, season calendar, weekend context, and featured race structures.
- `backend/app/schemas/predict.py`
  - Predictor request/response models.
- `backend/app/schemas/replay.py`
  - Replay dataset, track, frame, and driver models.
- `backend/app/schemas/report.py`
  - Report request and response models.
- `backend/app/schemas/strategy.py`
  - Strategy request and response models.
- `backend/app/schemas/telemetry.py`
  - Telemetry points, series, metrics, lap options, micro-sectors, corner breakdown, and performance summary models.

#### Telemetry schema notes

The telemetry response is layered rather than flat:

- point layer
  - one sampled telemetry point with distance, time, signal values, and optional steering estimate
- series layer
  - one currently-selected lap trace per displayed driver
- metrics layer
  - per-driver lap summary metrics
- lap options
  - selectable laps per driver for the frontend
- micro-sectors
  - segmented lap slices for deeper comparative analysis
- corner breakdown
  - entry/apex/exit loss windows plus braking and throttle markers
- performance
  - higher-level heuristic summaries

### Backend data and persistence

- `backend/app/db/models.py`
  - SQLAlchemy models for users and saved activities.
- `backend/app/db/session.py`
  - SQLAlchemy engine, sessionmaker, and base metadata.
- `backend/app/db/repository.py`
  - Repository abstraction for database-backed and seeded-domain access.
- `backend/app/db/seeder.py`
  - Seeds users, F1 knowledge content, and local defaults.

#### Persistence model details

The `saved_activities` table stores generated user-facing outputs:

- strategy calls
- reports
- predictions
- chatbot runs

Each row stores:

- `user_id`
- `activity_type`
- `title`
- `summary`
- `payload`
- `created_at`

### Backend services

- `backend/app/services/fastf1_service.py`
  - Main FastF1 integration layer
  - Loads seasons, calendars, sessions, weekend context, telemetry bundles, replay bundles
  - Builds analytics such as lap options, micro-sectors, steering estimate, and corner breakdowns
  - Manages in-memory and file-backed FastF1 caching
- `backend/app/services/metadata_service.py`
  - Turns FastF1 season/weekend information into frontend-friendly metadata payloads.
- `backend/app/services/telemetry_service.py`
  - Converts FastF1 telemetry bundles into Pydantic API responses.
- `backend/app/services/strategy_service.py`
  - Builds strategy recommendations and rationale.
- `backend/app/services/report_service.py`
  - Builds report summaries and bullet points.
- `backend/app/services/predictor_service.py`
  - Produces weighted race-order predictions.
- `backend/app/services/chat_service.py`
  - Routes and answers F1 questions using FastF1 context plus the local knowledge base.

#### Telemetry service details

`backend/app/services/telemetry_service.py` acts as a response adapter:

1. it calls `FastF1Service.load_session_telemetry(...)`
2. it receives raw dict structures containing traces and analytics
3. it converts them into typed `TelemetryResponse` payloads
4. it preserves an honest unavailable state if FastF1 cannot provide telemetry

This keeps FastF1-specific transformation logic concentrated inside `fastf1_service.py`.

#### Replay service split

Replay logic is deliberately split across backend and frontend:

- backend responsibilities:
  - load FastF1 position data
  - normalize track coordinates
  - sample replay frames
  - serialize the replay dataset
- frontend responsibilities:
  - manage replay timing
  - interpolate between frames
  - draw to Canvas
  - control playback

### Backend utilities and domain models

- `backend/app/utils/passwords.py`
  - Password hashing and verification helpers.
- `backend/app/models/entities.py`
  - Local domain entity definitions used by the app’s model layer.

## Frontend File-by-File Explanation

### App shell and layout

- `frontend/src/app/layout.tsx`
  - Root layout, wraps the app in the auth provider and shared shell styles.
- `frontend/src/app/template.tsx`
  - Route transition wrapper for animated page changes.
- `frontend/src/app/globals.css`
  - Global design system, motion, theme variables, and visual effects.
- `frontend/src/app/page.tsx`
  - Landing page with cinematic hero and feature previews.

#### App Router behavior

Each page under `frontend/src/app` is responsible for:

- local UI state
- calling typed service helpers
- rendering domain-specific components

Shared provider, shell, and transition logic is centralized in the layout/template layer so route pages stay focused on product behavior.

### Frontend route pages

- `frontend/src/app/login/page.tsx`
  - Login form using backend auth.
- `frontend/src/app/profile/page.tsx`
  - Profile editing UI with avatar upload.
- `frontend/src/app/history/page.tsx`
  - History viewer for saved activities.
- `frontend/src/app/dashboard/page.tsx`
  - Main telemetry analysis workspace.
- `frontend/src/app/compare/page.tsx`
  - Driver-versus-driver telemetry and metric comparison surface.
- `frontend/src/app/engineer/page.tsx`
  - Race-engineer strategy generation page.
- `frontend/src/app/report/page.tsx`
  - Race report generation page.
- `frontend/src/app/predictor/page.tsx`
  - Race result prediction page.
- `frontend/src/app/chatbot/page.tsx`
  - F1 chatbot page.
- `frontend/src/app/replay/page.tsx`
  - Replay route host for the race replay feature.

### Shared frontend components

- `frontend/src/components/shell.tsx`
  - Main navigation shell and header.
- `frontend/src/components/auth-provider.tsx`
  - Global auth state, token storage, current-user fetch, and login/logout flow.
- `frontend/src/components/auth-gate.tsx`
  - Protects routes requiring auth.
- `frontend/src/components/section-card.tsx`
  - Shared content panel wrapper.
- `frontend/src/components/status-panel.tsx`
  - Shared status, warning, and error blocks.
- `frontend/src/components/stats-card.tsx`
  - Shared KPI/stat card component.
- `frontend/src/components/data-source-panel.tsx`
  - Shows year, race, session, and source information.
- `frontend/src/components/feature-poster.tsx`
  - Feature showcase/landing composition block.
- `frontend/src/components/compare-spectrum.tsx`
  - Visual spectrum-based compare component.

#### Auth provider details

`frontend/src/components/auth-provider.tsx` manages the client auth lifecycle:

1. On mount, it checks `localStorage` for `apexai_token`.
2. If found, it calls `getCurrentUser(token)`.
3. If validation fails, it clears stored auth state.
4. `login(username, password)`:
   - calls `/auth/login`
   - stores the token
   - immediately fetches the user profile
5. `updateProfile(payload)`:
   - sends `PUT /auth/profile`
   - updates in-memory user state from the backend response
6. `logout()`:
   - clears token and user state

### Telemetry-specific frontend components

- `frontend/src/components/telemetry-hud.tsx`
  - Per-driver telemetry HUD summary cards.
- `frontend/src/components/telemetry-chart.tsx`
  - Multi-series telemetry chart component for speed, throttle, brake, steering, gear, and RPM.
- `frontend/src/components/telemetry-delta-chart.tsx`
  - Distance-synced lap-time delta chart.
- `frontend/src/components/telemetry-side-panel.tsx`
  - Analysis side rail with lap summary, sectors, micro-sectors, corner loss, and smart analytics.

#### Telemetry charting model

The telemetry workspace is distance-based on the X-axis rather than wall-clock time-based for the visible chart layout.

Shared chart behaviors:

- `syncId`
  - links hover state and brush position across graphs
- `Brush`
  - enables zoom-window style inspection
- multi-series overlays
  - several drivers can be shown on one signal
- signal-specific rendering
  - brake uses area rendering
  - gear uses step rendering
  - speed, throttle, steering, and RPM use line traces

### Replay-specific frontend components

- `frontend/src/components/replay/RaceReplay.tsx`
  - Top-level replay feature container.
- `frontend/src/components/replay/ReplayCanvas.tsx`
  - Canvas renderer for track and animated car positions.
- `frontend/src/components/replay/ReplayControls.tsx`
  - Playback controls for play/pause/speed/scrubbing.

#### Replay engine details

`frontend/src/services/replayEngine.ts` contains the runtime replay math:

- `clampReplayTime`
  - keeps replay time inside valid bounds
- `interpolateValue`
  - generic interpolation helper
- `interpolateDriverPosition`
  - blends between two driver positions for any timestamp
- `getReplaySnapshot`
  - derives the current replay frame state from neighboring frames
- `ReplayClock`
  - timing controller with:
    - `setSpeed`
    - `seek`
    - `reset`
    - `tick`

This keeps replay time-based rather than frame-count-based.

### Frontend services and types

- `frontend/src/services/api.ts`
  - Central API call layer for every backend route.
- `frontend/src/services/replayEngine.ts`
  - Replay timing/interpolation loop logic.
- `frontend/src/services/telemetryService.ts`
  - Replay/telemetry helper service support.
- `frontend/src/types/api.ts`
  - Shared TypeScript API contracts.
- `frontend/src/types/replay.ts`
  - Replay-specific type definitions.

#### API service details

`frontend/src/services/api.ts` is the single source of truth for raw backend paths.

Important behavior:

- derives the API base from `NEXT_PUBLIC_API_BASE_URL`
- serializes query parameters for telemetry, replay, metadata, and calendar requests
- injects bearer auth when a token is supplied
- throws on non-OK responses so pages can show explicit error status panels
- returns typed promises for each endpoint helper

## API Reference

All APIs are mounted under:

- `/api/v1`

### Health

- `GET /api/v1/health`
  - Returns backend health status.

### Auth

- `POST /api/v1/auth/login`
  - Request:
    - `username`
    - `password`
  - Response:
    - `access_token`
    - `token_type`
- `GET /api/v1/auth/me`
  - Requires bearer token
  - Returns the current user profile
- `PUT /api/v1/auth/profile`
  - Requires bearer token
  - Updates current user profile fields

### Metadata and FastF1 context

- `GET /api/v1/seasons`
  - Returns season list
- `GET /api/v1/calendar?year=YYYY`
  - Returns the selected season calendar and available sessions
- `GET /api/v1/metadata?year=YYYY`
  - Returns richer season metadata
- `GET /api/v1/weekend-context?year=YYYY&grand_prix=...&session=...`
  - Returns session-aware driver roster, weather, and contextual insights

#### Metadata response purpose split

- `/seasons`
  - lightweight year selector source
- `/calendar`
  - race selector source for a chosen season
- `/weekend-context`
  - session-specific driver/team/weather context
- `/metadata`
  - broader season payload for pages that need richer context

### Telemetry

- `GET /api/v1/telemetry`
  - Query params:
    - `drivers` repeated
    - `lap_selections` repeated, using `Driver Name:LapNumber`
    - `year`
    - `grand_prix`
    - `session`
  - Returns:
    - telemetry series
    - telemetry metrics
    - lap options
    - micro-sectors
    - corner breakdown
    - performance summaries
    - source, notice, weather, summary, insights

#### Telemetry query behavior

The telemetry route is intentionally query-driven instead of POST-based because the selected state is naturally URL-like:

- multiple `drivers`
- multiple `lap_selections`
- one `year`
- one `grand_prix`
- one `session`

Example query shape:

- `/api/v1/telemetry?drivers=George%20Russell&drivers=Kimi%20Antonelli&year=2026&grand_prix=Australian%20Grand%20Prix&session=Q&lap_selections=George%20Russell:21&lap_selections=Kimi%20Antonelli:17`

### Replay

- `GET /api/v1/replay?year=YYYY&grand_prix=...&session=...&drivers=N`
  - Returns:
    - replay dataset
    - track points
    - driver metadata
    - time-sampled position frames
    - source / availability state

### Strategy

- `POST /api/v1/strategy`
  - Uses current race, lap, tyre, fuel, weather, and position context
  - Saves result to history

### Report

- `POST /api/v1/report`
  - Builds a race report from structured inputs
  - Saves result to history

### Prediction

- `POST /api/v1/predict`
  - Predicts the race finishing order
  - Saves result to history

### Chat

- `POST /api/v1/chat`
  - Request:
    - `question`
    - optional `year`
  - Returns:
    - `answer`
    - `context`
  - Saves chat activity

### History

- `GET /api/v1/history`
  - Returns saved user activities

## How the Frontend Calls the Backend

The frontend centralizes backend requests in:

- `frontend/src/services/api.ts`

Call flow:

1. Page or component calls a typed helper such as `getTelemetry(...)` or `getReplayDataset(...)`.
2. The helper calls the shared `request<T>()` wrapper.
3. The wrapper:
   - prepends `NEXT_PUBLIC_API_BASE_URL`
   - applies JSON headers
   - adds bearer token when present
   - disables cache via `cache: "no-store"`
4. The typed JSON response flows back into page state and child components.

Examples:

- Dashboard
  - `getSeasonCalendar(year)`
  - `getWeekendContext({ year, grandPrix, session })`
  - `getTelemetry(drivers, { year, grandPrix, session, lapSelections })`
- Replay
  - `getSeasonCalendar(year)`
  - `getReplayDataset({ year, grandPrix, session, drivers })`
- Login/Profile
  - `loginRequest(...)`
  - `getCurrentUser(token)`
  - `updateProfileRequest(...)`

### Error handling pattern

When a request fails:

1. `request<T>()` throws `Error("Request failed: <status>")`
2. the route page catches it
3. the page stores the failure in local state
4. the page renders a `StatusPanel` with error or warning tone

## Telemetry Page Deep Explanation

The telemetry page lives at:

- `frontend/src/app/dashboard/page.tsx`

### Data flow

1. The page loads the season calendar for the selected year.
2. After the user has a selected Grand Prix and session, the page loads weekend context.
3. The user picks drivers.
4. The page requests telemetry with:
   - selected drivers
   - year
   - grand prix
   - session
   - optional selected lap per driver
5. The backend uses FastF1 to:
   - find the session
   - load available laps for each selected driver
   - choose the current lap selection
   - build telemetry traces
   - estimate steering from position curvature
   - segment the lap into micro-sectors
   - build corner breakdowns and performance heuristics
6. The frontend renders:
   - headline stats
   - signal toggles
   - telemetry HUD cards
   - synchronized charts
   - delta graph
   - side analysis panel

### Telemetry backend analytics currently computed

The current telemetry backend computes or derives:

- per-driver selected-lap metrics
- candidate lap options per driver
- DRS usage percentage
- brake usage percentage
- RPM statistics
- gear-change count
- micro-sector timing slices
- corner entry/apex/exit delta windows
- braking point heuristics
- throttle pickup heuristics
- steering estimate from XY curvature
- performance summaries:
  - braking style
  - throttle style
  - corner profile
  - mistake indicators

### Telemetry frontend state model

The telemetry page currently manages:

- selected season
- selected Grand Prix
- selected session
- selected drivers
- selected lap per driver
- graph visibility toggles
- driver search
- season calendar response
- weekend context response
- telemetry response
- loading and error state

### Anti-flicker fix

The telemetry page previously flickered because lap selection state was being rewritten on every telemetry response, which retriggered the telemetry effect. The page now:

- normalizes lap selections only when they truly change
- computes a stable request key for the telemetry fetch
- avoids rerender-triggered request loops
- uses defensive defaults while loading

### Current telemetry limitations

The telemetry page is significantly richer than the original version, but some advanced goals are still partial or heuristic:

- steering is estimated, not directly supplied by FastF1
- corner segmentation is heuristic rather than track-map-authored
- multi-lap overlay is currently one selected lap per driver rather than arbitrary many laps per driver
- micro-sector logic is distance-segment-driven rather than official corner boundary data

## Replay Feature Deep Explanation

The replay feature is built across:

- `frontend/src/components/replay/RaceReplay.tsx`
- `frontend/src/components/replay/ReplayCanvas.tsx`
- `frontend/src/components/replay/ReplayControls.tsx`
- `frontend/src/services/replayEngine.ts`
- `frontend/src/types/replay.ts`
- `backend/app/api/routes/replay.py`
- `backend/app/schemas/replay.py`
- `backend/app/services/fastf1_service.py`

### Replay pipeline

1. User chooses year, Grand Prix, and session.
2. Frontend requests a replay dataset from `/api/v1/replay`.
3. Backend loads FastF1 position data where available.
4. Backend normalizes XY positions and samples them into replay frames.
5. Frontend replay engine interpolates time and drives the animation loop.
6. Canvas renders track and car movement.

### Replay backend details

The backend replay builder:

1. loads a FastF1 session
2. reads `session.pos_data`
3. groups samples by driver
4. filters unusable position rows
5. normalizes XY coordinates into 0..1 canvas space
6. resamples source timing into replay frames
7. emits:
   - track polyline
   - driver metadata
   - ordered position frames

### Replay frontend details

The frontend replay flow:

1. requests a replay dataset from `/api/v1/replay`
2. builds a replay clock
3. advances time with `requestAnimationFrame`
4. interpolates positions between frames
5. renders cars and track to Canvas
6. exposes play, pause, speed change, and timeline scrubbing

## Persistence and Local Data

SQLite file:

- `backend/apexai.db`

Tables currently supported:

- `users`
- `saved_activities`

Saved activities include:

- strategy
- report
- prediction
- chat

FastF1 cache:

- `backend/.fastf1-cache`

Purpose:

- stores downloaded session/timing assets
- speeds up repeat requests
- makes historical reuse possible without re-downloading everything every time

## Known Operational Notes

- FastF1 availability depends on:
  - internet access on first load
  - valid upstream connectivity
  - cache state
  - whether historical telemetry exists for that session
- Some very old races may not have modern XY replay or equivalent telemetry depth.
- The app now avoids silently substituting fake historical race telemetry for explicit FastF1 session selections.

## Update Maintenance Protocol

Every future change should follow this process:

1. Update this `docs/APEXAI_MASTER_RECORD.md` file.
2. Add a short dated note to the newest relevant history section.
3. If a new route, page, or service is added, extend:
   - file explanation sections
   - API reference section
   - architecture/data-flow sections if needed
4. Regenerate the DOCX export.

This makes the DOCX reproducible and keeps the project record synchronized with the codebase.

## Ongoing Documentation Rule

From this point onward, every future update, including minor UI tweaks and bugfixes, should be reflected in:

- `docs/APEXAI_MASTER_RECORD.md`
- `docs/ApexAI_Project_Record.docx`

Recommended workflow:

1. make the code change
2. update the master record
3. regenerate the DOCX using:
   - `backend/.venv/Scripts/python.exe docs/generate_project_doc.py`

That gives you a continuously-updated technical handoff package whenever you ask for it.

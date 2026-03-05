# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SketchSim is a browser-based interactive whiteboard that turns freehand sketches into live traffic microsimulations. Users draw road segments on an Excalidraw canvas, annotate with traffic volumes, and press Play to watch vehicles flow through their network in real time. Fully client-side, no backend.

## Build & Development Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # Production build (tsc -b && vite build)
npm run preview      # Preview production build
npx vitest run       # Run all unit tests (65 tests across 6 files)
npx vitest run src/utils/__tests__/geometry.test.ts  # Single test file
npx vitest --watch   # Watch mode
npx tsc --noEmit     # Type check only
```

## Tech Stack

- React 18 + TypeScript, Vite, Tailwind CSS v4 (via @tailwindcss/vite plugin)
- Excalidraw (drawing canvas), Zustand (state), lz-string (URL sharing)
- Vitest (unit tests), Playwright (E2E, planned)
- Path alias: `@/*` → `./src/*`

## Architecture — Three Layers

```
Canvas Layer (Excalidraw) → Interpreter Layer → Simulation Layer
```

**Canvas** (`src/canvas/`): Excalidraw wrapper + transparent HTML5 Canvas overlay synced to Excalidraw's viewport transform every frame. Toolbar with Play/Pause/Reset/Speed/Metrics/Share controls.

**Interpreter** (`src/interpreter/`): Rule-based pipeline (no AI/ML). `parseElements → snapEngine → textAssociator → signalDetector → turningRatios → graphBuilder → validator` → produces `NetworkGraph`.

**Simulation** (`src/simulation/`): Discrete-time agent-based microsim at 60fps. IDM car-following, Poisson arrivals, gap acceptance with deadlock breaker, angle-clustered signal phasing. Bezier turning arcs through intersections.

**Rendering** (`src/rendering/`): Agent renderer (on-edge + Bezier turns with lane offset), preview renderer, metrics overlay (queue badges, speed gradient).

**Other modules**: `src/metrics/` (per-edge flow rate with 60s sliding window), `src/store/` (3 Zustand stores: network, simulation, UI), `src/types/` (shared interfaces), `src/utils/` (geometry, scale, constants, colors, lzShare), `src/ui/` (toast system, onboarding overlay).

## Critical Design Rules

- **All physics in metric units.** `1 px = 0.5 m` (DEFAULT_SCALE). Convert via `ScaleContext`. Never use raw pixels for physics.
- **Two-tier snapping:** 10px auto-merge, 10–20px ghost suggestion only (no auto-merge).
- **Turning ratios by geometry:** straight 60%, right 25%, left 15%, U-turn 0%. Redistribute when categories missing.
- **Priority by geometry:** most-aligned edge pair = major road. Not demand-based.
- **Edge-level indexing:** `AgentManager.edgeIndex` keeps sorted agent lists per edge for O(N) car-following.
- **Viewport sync:** `ctx.setTransform(zoom, 0, 0, zoom, -scrollX * zoom, -scrollY * zoom)` every frame.
- **Excalidraw coords:** line points are relative offsets from `(x, y)`. Convert to absolute: `{ x: element.x + point[0], y: element.y + point[1] }`.
- **HiDPI:** canvas sized at `devicePixelRatio` × client dimensions, CSS-scaled back down.
- **`erasableSyntaxOnly` is enabled** in tsconfig — no parameter properties (`public foo`) in classes.

## Key Constants (src/utils/constants.ts)

All magic numbers live in one file. IDM params: v0=13.9 m/s, a=1.5 m/s^2, b=2.5 m/s^2, s0=2.0m, T=1.0s. Vehicle=4.5m. Snap: 10/20px. Critical gap: 2.5s. Deadlock: 8s max wait. Toast: 4s auto-dismiss.

## Test Files

- `src/utils/__tests__/geometry.test.ts` — 26 tests for all geometry functions
- `src/interpreter/__tests__/snapEngine.test.ts` — 5 tests (auto-merge, suggest, T-intersection, crossings)
- `src/interpreter/__tests__/turningRatios.test.ts` — 5 tests (4-way, T-intersection, dead end, sum-to-1)
- `src/interpreter/__tests__/integration.test.ts` — 10 tests (full pipeline scenarios)
- `src/simulation/__tests__/idm.test.ts` — 8 tests (free flow, car-following, emergency braking)
- `src/simulation/__tests__/intersectionControl.test.ts` — 11 tests (signals, gap acceptance, exit selection)

## Spec Documents

Detailed specs in `ProjSpecs/`:
- `SketchSim_Spec_v1.1.docx` — Product specification (architecture, data models, algorithms, UI/UX)
- `SketchSim_Dev_Spec.docx` — Step-by-step implementation guide with exact interfaces, algorithms, acceptance criteria, and test cases

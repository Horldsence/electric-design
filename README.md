# Electric Design

<p align="center">
  <strong>An open-source Bun + React application for automated circuit design workflows with tscircuit and KiCad.</strong>
</p>

<p align="center">
  Electric Design connects generation, compilation, conversion, validation, export, and download flows into a unified web-based toolchain.
</p>

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Bun" src="https://img.shields.io/badge/runtime-Bun-black">
  <img alt="React" src="https://img.shields.io/badge/frontend-React%2019-61dafb">
  <img alt="TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178c6">
  <img alt="KiCad" src="https://img.shields.io/badge/integration-KiCad-314cb6">
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-orange">
</p>

---

## Table of Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Features](#features)
- [Workspace](#workspace)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Development Notes](#development-notes)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Electric Design is an open-source project for building automated electronic design workflows on top of `Bun`, `React`, the `tscircuit` ecosystem, and KiCad-related tooling.

The project is designed to support an end-to-end workflow such as:

`input → generate → compile → convert → validate → export → download`

Today, the repository already includes a working backend service structure, a frontend console-style interface, KiCad-related validation and export flows, workspace-based version management, and tests around core parts of the pipeline.

### Goals

- Turn user input into executable circuit descriptions
- Compile circuit definitions into machine-processable intermediate data
- Convert circuit output into KiCad-compatible artifacts
- Run design validation and checks
- Export production-oriented deliverables such as Gerbers and BOMs
- Persist generated results into a local workspace with full version history
- Provide a web-based workflow around the complete process

---

## Screenshots

### Example Interface

![Electric Design Example](images/example.png)

---

## Features

### Current capabilities

- Bun-based HTTP server
- React frontend application
- WebSocket support
- Circuit generation endpoints
- Compilation and conversion endpoints
- KiCad validation endpoints
- Gerber and BOM export endpoints
- File download endpoints
- **Workspace management** — local file-system-based workspace with versioned circuit results
- Test coverage for KiCad validation workflows
- Internal logging and pipeline-oriented debugging documentation

### Workflow coverage

- Text or code input
- Circuit generation
- Compilation
- KiCad conversion
- ERC / DRC validation
- Gerber / BOM export
- Workspace save and version history
- Downloadable outputs

---

## Workspace

The workspace system is a core feature of Electric Design. It persists generated circuit results to a local directory on disk, organized as a versioned history. This allows you to iterate on circuit designs, compare revisions, and restore previous states.

### Concepts

| Concept | Description |
|---|---|
| **Workspace** | A local directory on disk that stores circuit design results and metadata |
| **Version** | A single saved state of a circuit, identified by a timestamp-based ID (e.g. `20260310_143052`) |
| **Current version** | The version that was most recently checked out or saved |
| **meta.json** | The workspace index file, stored at `<workspace>/.eai/meta.json` |

### Directory layout

When a workspace is initialized at `/path/to/my-circuit`, the following structure is created:

```
/path/to/my-circuit/
├── .eai/
│   ├── meta.json              # Workspace metadata and version index
│   └── versions/
│       ├── 20260310_143052/
│       │   └── code.tsx       # Generated circuit code for this version
│       └── 20260310_150412/
│           └── code.tsx
├── project.kicad_pcb          # KiCad PCB file (updated on save/checkout)
└── project.kicad_sch          # KiCad schematic file (updated on save/checkout)
```

### Workspace metadata (`meta.json`)

```json
{
  "name": "my-circuit",
  "createdAt": 1741600000000,
  "lastModified": 1741603200000,
  "currentVersion": "20260310_150412",
  "versions": [
    {
      "id": "20260310_143052",
      "prompt": "A 555 timer circuit blinking an LED at 1Hz",
      "codeFile": ".eai/versions/20260310_143052/code.tsx",
      "timestamp": 1741600000000,
      "isValid": true
    },
    {
      "id": "20260310_150412",
      "prompt": "A 555 timer circuit blinking an LED at 1Hz",
      "codeFile": ".eai/versions/20260310_150412/code.tsx",
      "timestamp": 1741603200000,
      "isValid": true
    }
  ]
}
```

### Workspace UI (`WorkspaceSelector`)

The `WorkspaceSelector` component is embedded in the main console interface. It provides:

- **Path input** — enter the absolute path of a local directory to use as the workspace
- **Name input** — optional display name for the workspace (defaults to the directory name)
- **Load** — load an existing workspace from disk and display its metadata and version history
- **New** — initialize a fresh workspace at the given path (creates `.eai/` structure)
- **Clear** — detach the current workspace from the UI session (does not delete files on disk)
- **Version list** — shows all saved versions sorted chronologically, with timestamp labels
- **New Version** — reset the active version pointer so the next generation is saved as a new version
- **Version click** — click any version to check it out: loads its code, re-compiles, and updates the preview

### Workspace API endpoints

All workspace operations are exposed under `/api/workspace`.

#### `POST /api/workspace` — Initialize or load a workspace

Initialize a new workspace at the given path, or return its metadata if it already exists.

**Request body:**

```json
{
  "path": "/path/to/workspace",
  "name": "optional-display-name"
}
```

**Response:**

```json
{
  "success": true,
  "data": { /* WorkspaceMeta */ }
}
```

---

#### `GET /api/workspace` — Read workspace metadata or version code

**Query parameters:**

| Parameter | Required | Description |
|---|---|---|
| `path` | Yes | Absolute path to the workspace directory |
| `versionId` | No | If provided, returns the source code of that version |

**Response (metadata):**

```json
{
  "success": true,
  "data": { /* WorkspaceMeta */ }
}
```

**Response (version code):**

```json
{
  "success": true,
  "data": {
    "versionId": "20260310_143052",
    "code": "/* circuit TSX source code */"
  }
}
```

---

#### `PUT /api/workspace` — Save a generated result to the workspace

Save a new version (or update an existing one) with the generated code and KiCad files.

**Request body:**

```json
{
  "path": "/path/to/workspace",
  "code": "/* circuit TSX source code */",
  "prompt": "A 555 timer blinking an LED at 1Hz",
  "kicadFiles": {
    "pcb": "/* KiCad PCB file content */",
    "sch": "/* KiCad schematic file content */"
  },
  "timestamp": 1741600000000,
  "isValid": true,
  "versionId": "20260310_143052"
}
```

> `versionId` is optional. If provided, the existing version is updated in place. If omitted, a new version is created.

**Response:**

```json
{
  "success": true,
  "versionId": "20260310_143052",
  "data": { /* WorkspaceMeta */ }
}
```

---

#### `PATCH /api/workspace` — Checkout or update a version

Supports two actions via the `action` field.

**Action: `checkout`** — Switch the workspace to a previous version. Writes that version's KiCad files to the workspace root.

```json
{
  "path": "/path/to/workspace",
  "action": "checkout",
  "versionId": "20260310_143052"
}
```

**Action: `update-code`** — Overwrite the source code of an existing version (used by error-fix flows).

```json
{
  "path": "/path/to/workspace",
  "action": "update-code",
  "versionId": "20260310_143052",
  "code": "/* corrected circuit TSX source code */",
  "isValid": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "versionId": "20260310_143052",
    "meta": { /* WorkspaceMeta */ }
  }
}
```

---

#### `DELETE /api/workspace` — Delete a version

**Query parameters:**

| Parameter | Required | Description |
|---|---|---|
| `path` | Yes | Absolute path to the workspace directory |
| `versionId` | Yes | ID of the version to delete |

**Response:**

```json
{
  "success": true,
  "data": { "meta": { /* WorkspaceMeta */ } }
}
```

> If the deleted version was the current version, the workspace automatically falls back to the most recent remaining version.

---

### Workspace-aware generation flow

When a workspace is active, the `handleSubmit` flow in `ConsoleInterface` changes behavior:

1. `POST /api/generate` — generate circuit code from the user's prompt
2. `POST /api/export` — compile, convert, validate, and save the result to the workspace in one call (passing `workspace` path and optional `versionId`)
3. The returned `versionId` is stored in component state, and the `WorkspaceSelector` is refreshed to show the new version

Without a workspace, the flow falls back to `POST /api/compile-and-convert` only, with no persistence.

### `FileManager` class

The backend workspace logic is implemented in `src/lib/file-manager.ts` via the `FileManager` class. Key methods:

| Method | Description |
|---|---|
| `init(options)` | Create `.eai/` directory structure and write initial `meta.json` |
| `getMeta()` | Read and parse `meta.json` |
| `updateMeta(updater)` | Apply a transformation to `meta.json` and write it back |
| `createVersion(options)` | Create a new version directory, write `code.tsx`, update `meta.json` |
| `saveGeneratedResult(options)` | Create a new version or update an existing one |
| `checkoutVersion(versionId)` | Write KiCad files for a version and set it as current |
| `deleteVersion(versionId)` | Remove version files and update `meta.json` |
| `readVersionCode(versionId)` | Read the `code.tsx` source for a given version |
| `updateVersionCode(versionId, code, isValid)` | Overwrite the `code.tsx` for a version |
| `writeKiCadFiles(pcb, sch)` | Write `project.kicad_pcb` and `project.kicad_sch` to the workspace root |
| `exists()` | Check if the workspace has been initialized (i.e. `meta.json` exists) |

---

## Architecture

The repository is organized around a service-oriented flow:

1. **Frontend UI** receives user input and displays workflow output
2. **Route handlers** expose HTTP APIs for generation, compilation, validation, export, workspace, and download
3. **Service modules** implement the core business logic
4. **`FileManager`** handles workspace persistence and version management on the local file system
5. **KiCad-related tooling** is used for validation and manufacturing outputs
6. **Tests and debug scripts** help verify CLI availability and pipeline behavior

At a high level, the project follows this progression:

- Input collection
- Circuit generation
- Circuit compilation
- KiCad conversion
- Design validation
- Export pipeline
- Workspace save / version management
- Artifact download

---

## Tech Stack

### Runtime and platform

- `Bun`
- `TypeScript`
- `React 19`
- `Bun.serve()`

### Circuit and conversion ecosystem

- `@tscircuit/core`
- `@tscircuit/eval`
- `@tscircuit/checks`
- `circuit-json`
- `circuit-to-svg`
- `circuit-json-to-kicad`
- `kicad-converter`
- `bun-match-svg`

### Tooling

- `Biome`
- `Stylelint`
- `bun test`

---

## Project Structure

```text
electric-design/
├── src/
│   ├── components/
│   │   ├── ConsoleInterface.tsx   # Main UI: prompt input, preview, workspace integration
│   │   ├── WorkspaceSelector.tsx  # Workspace load/init/clear/version management UI
│   │   ├── LogViewer.tsx          # Real-time log display
│   │   └── SchematicViewer.tsx    # SVG-based circuit preview
│   ├── examples/       # Examples and sample resources
│   ├── hooks/          # React hooks (e.g. use-socket.ts)
│   ├── lib/
│   │   ├── file-manager.ts        # FileManager: workspace and version persistence
│   │   ├── config.ts              # App configuration
│   │   ├── logger.ts              # Internal structured logger
│   │   ├── socket-manager.ts      # WebSocket connection manager
│   │   └── source-utils.ts        # Source code utility helpers
│   ├── routes/
│   │   ├── workspace.ts           # GET/POST/PUT/PATCH/DELETE /api/workspace
│   │   ├── generate.ts            # POST /api/generate
│   │   ├── compile.ts             # POST /api/compile
│   │   ├── convert.ts             # POST /api/convert
│   │   ├── compile-and-convert.ts # POST /api/compile-and-convert
│   │   ├── export.ts              # POST /api/export
│   │   ├── validate-kicad.ts      # KiCad validation and export routes
│   │   └── download.ts            # Download routes
│   ├── services/       # Core generation / compile / convert / validate logic
│   ├── types/
│   │   ├── workspace.ts           # WorkspaceMeta, WorkspaceVersion, and related types
│   │   ├── ai.ts
│   │   ├── errors.ts
│   │   ├── kicad.ts
│   │   └── tscircuit.ts
│   ├── util/           # Utility helpers
│   ├── web/            # Web-specific resources
│   ├── App.tsx         # Main app component
│   ├── frontend.tsx    # React entrypoint
│   ├── index.html      # HTML entrypoint
│   └── index.ts        # Bun server entrypoint
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   ├── examples/       # Example-driven tests
│   └── output/         # Test output artifacts
├── docs/               # Additional project documentation
├── dist/               # Build output
├── images/             # README image assets
├── AGENTS.md
├── CLAUDE.md
├── LICENSE
├── package.json
├── bunfig.toml
├── tsconfig.json
├── README.md
└── README.zh-CN.md
```

---

## Getting Started

## Requirements

Recommended environment:

- `Bun 1.3+`
- `KiCad CLI` for ERC / DRC / export-related capabilities
- macOS or Linux

## Installation

```sh
bun install
```

## Run in development

```sh
bun run dev
```

This starts the application in development mode with hot reloading enabled through the Bun-based server setup.

## Build for production

```sh
bun run build
```

Build output is written to:

- `dist/`

## Run in production

```sh
bun run start
```

## Run tests

```sh
bun test
```

Or through the project script:

```sh
bun run test
```

---

## Available Scripts

The repository currently provides the following scripts through `package.json`:

- `bun run dev` — start the development server
- `bun run build` — build production assets
- `bun run start` — start the production server
- `bun run test` — run tests
- `bun run test:watch` — run tests in watch mode
- `bun run test:coverage` — run tests with coverage
- `bun run lint` — run TypeScript and CSS linting
- `bun run lint:fix` — automatically fix supported lint issues
- `bun run format` — format code
- `bun run format:check` — verify formatting
- `bun run type-check` — run TypeScript type checks

### Quality checks

```sh
bun run lint
bun run format:check
bun run type-check
```

### Auto-fix formatting and lint issues

```sh
bun run lint:fix
bun run format
```

---

## API Overview

The server currently exposes endpoints covering the main workflow.

### Basic endpoints

- `GET /api/hello`
- `PUT /api/hello`
- `GET /api/hello/:name`

### Workflow endpoints

- `POST /api/generate`
- `POST /api/compile`
- `POST /api/convert`
- `POST /api/compile-and-convert`
- `POST /api/export`

### Workspace endpoints

- `POST /api/workspace` — initialize or load a workspace
- `GET /api/workspace` — read workspace metadata or a specific version's code
- `PUT /api/workspace` — save a generated result (create or update a version)
- `PATCH /api/workspace` — checkout a version or update version code
- `DELETE /api/workspace` — delete a version

### KiCad validation and export endpoints

- `POST /api/validate-kicad`
- `POST /api/check-kicad`
- `POST /api/export-gerber`
- `POST /api/export-bom`
- `POST /api/auto-fix-validation`

### Download endpoints

- `POST /api/download-kicad`
- `POST /api/download-schematic`
- `POST /api/download-gerbers`
- `POST /api/download-bom`

### WebSocket endpoint

- `GET /ws`

> The exact request and response payloads for non-workspace endpoints should be documented further as the API surface stabilizes. For workspace endpoints, see the [Workspace](#workspace) section above.

---

## Development Notes

### Bun-first workflow

This repository is designed around Bun as the default runtime and toolchain. Prefer:

- `bun install`
- `bun run <script>`
- `bun test`
- `bunx <package>`

### KiCad-dependent functionality

Some flows require local KiCad CLI availability. If validation or export features do not work as expected, check:

- whether `kicad-cli` is installed
- whether it is available on your `PATH`
- whether your environment has the required execution permissions

### Workspace persistence

The workspace system writes files directly to the local file system. There is no database involved. The `.eai/` subdirectory inside the workspace path is managed entirely by `FileManager`. Do not manually edit `meta.json` unless you understand the version index format.

KiCad files (`project.kicad_pcb`, `project.kicad_sch`) at the workspace root are always overwritten when a version is saved or checked out. They always reflect the current version's state.

### Current project maturity

Based on the current repository structure:

- backend and service workflows are relatively complete
- the pipeline has already covered multiple key stages including workspace versioning
- the frontend is still closer to a console/workbench experience than a polished product UI
- tests and internal docs are important for understanding expected behavior

---

## Documentation

Additional project docs are available in `docs/` and repository-level guides:

- `README.md` — English documentation
- `README.zh-CN.md` — Simplified Chinese documentation
- `LICENSE` — MIT License
- `AGENTS.md`
- `CLAUDE.md`
- `docs/CI.md`
- `docs/DOWNLOAD_FIX.md`
- `docs/FIX_SUMMARY.md`
- `docs/LOGGING.md`
- `docs/PROMPT_IMPROVEMENT_PLAN.md`
- `docs/架构.md`

If you are new to the codebase, a good reading order is:

1. `README.md`
2. `README.zh-CN.md`
3. `AGENTS.md`
4. `docs/架构.md`
5. `docs/LOGGING.md`
6. `src/lib/file-manager.ts`
7. `src/routes/workspace.ts`
8. `tests/kicad-validator.test.ts`

---

## Roadmap

Potential next steps for the project include:

- a more polished frontend interface
- more stable AI-assisted generation strategies
- richer templates and example circuits
- stronger validation and auto-fix flows
- workspace diff view between versions
- workspace export and sharing support
- preview, history, and task management capabilities
- improved CI/CD and release processes
- more complete API documentation
- public demo deployment guidance

---

## Contributing

Contributions are welcome.

If you want to contribute, a practical approach is:

1. Fork the repository
2. Create a feature branch
3. Make focused changes
4. Run linting, formatting, type checks, and tests
5. Open a pull request with a clear description

### Suggested local validation before submitting

```sh
bun run lint
bun run format:check
bun run type-check
bun run test
```

### Areas where contributions are especially useful

- frontend UX improvements
- API documentation
- test coverage expansion
- validation/export robustness
- workspace diff and history visualization
- pipeline observability
- example circuits and templates

---

## License

This project is licensed under the MIT License.

See the `LICENSE` file for the full license text.

Permissions under the MIT License include:

- commercial use
- modification
- distribution
- private use

The software is provided "as is", without warranty of any kind.
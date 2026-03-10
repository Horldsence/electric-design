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
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Development Notes](#development-notes)
- [Documentation](#documentation)
- [Today's Updates](#todays-updates)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Electric Design is an open-source project for building automated electronic design workflows on top of `Bun`, `React`, the `tscircuit` ecosystem, and KiCad-related tooling.

The project is designed to support an end-to-end workflow such as:

`input → generate → compile → convert → validate → export → download`

Today, the repository already includes a working backend service structure, a frontend console-style interface, KiCad-related validation and export flows, and tests around core parts of the pipeline.

### Goals

- Turn user input into executable circuit descriptions
- Compile circuit definitions into machine-processable intermediate data
- Convert circuit output into KiCad-compatible artifacts
- Run design validation and checks
- Export production-oriented deliverables such as Gerbers and BOMs
- Provide a web-based workflow around the complete process

---

## Today's Updates

Based on today's Git commits, the project has been updated in the following areas:

- **Page bug fix** — resolved a page-related issue to improve UI stability and overall usability
- **Workspace management** — added workspace loading, initialization, and save-to-workspace flows for organizing generated circuit results
- **Error-fix file editing support** — added file editing capability to support error-fixing workflows more effectively

These updates improve day-to-day usability and make the application more practical as a circuit design workbench.

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
- Test coverage for KiCad validation workflows
- Internal logging and pipeline-oriented debugging documentation

### Workflow coverage

- Text or code input
- Circuit generation
- Compilation
- KiCad conversion
- ERC / DRC validation
- Gerber / BOM export
- Downloadable outputs

---

## Architecture

The repository is organized around a service-oriented flow:

1. **Frontend UI** receives user input and displays workflow output
2. **Route handlers** expose HTTP APIs for generation, compilation, validation, export, and download
3. **Service modules** implement the core business logic
4. **KiCad-related tooling** is used for validation and manufacturing outputs
5. **Tests and debug scripts** help verify CLI availability and pipeline behavior

At a high level, the project follows this progression:

- Input collection
- Circuit generation
- Circuit compilation
- KiCad conversion
- Design validation
- Export pipeline
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
│   ├── components/     # Frontend components
│   ├── examples/       # Examples and sample resources
│   ├── hooks/          # React hooks
│   ├── lib/            # Config, logging, utilities, low-level helpers
│   ├── routes/         # Bun HTTP route handlers
│   ├── services/       # Core generation / compile / convert / validate logic
│   ├── types/          # Shared types
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

> The exact request and response payloads should be documented further as the API surface stabilizes.

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

### Current project maturity

Based on the current repository structure:

- backend and service workflows are relatively complete
- the pipeline has already covered multiple key stages
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
6. `tests/kicad-validator.test.ts`

---

## Roadmap

Potential next steps for the project include:

- a more polished frontend interface
- more stable AI-assisted generation strategies
- richer templates and example circuits
- stronger validation and auto-fix flows
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
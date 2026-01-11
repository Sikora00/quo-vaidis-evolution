# Quo Vaidis Evolution

A browser-based reconstruction of the evolutionary simulator described in Andrzej Dragan’s *Quo Vaidis*. The project models a 2D grid world with autonomous agents, food, poison, reproduction, and evolving movement “DNA.”

## Status
Early scaffold: UI + canvas renderer in TypeScript, simulation core in Rust compiled to WebAssembly, and a Web Worker bridge. Functional requirements are captured in `docs/functional_requirements.md`.

## Architecture
- **Model**: Rust + WebAssembly (`simulation-wasm`) — simulation logic and state.
- **Controller**: Web Worker (`src/simulation.worker.ts`) — runs the Wasm engine off the UI thread.
- **View**: TypeScript + Canvas (`src/main.ts`) — rendering and controls.

## Development
### Prerequisites
- Node.js + npm
- Rust toolchain
- `wasm-pack` (`cargo install wasm-pack`)

### Install
```bash
npm install
```

### Build Wasm
```bash
npm run build:wasm
```

### Run locally
```bash
npm run dev
```

### Production build
```bash
npm run build
```

## Repo Structure
- `simulation-wasm/` — Rust crate compiled to Wasm.
- `src/` — frontend UI, canvas renderer, worker bridge.
- `docs/` — source description and functional requirements.

## References
- `docs/source_description.md` — narrative source excerpt.
- `docs/functional_requirements.md` — detailed functional spec.

## License
TBD

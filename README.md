# Muikku (`muikku.app`)

**Real-time 3D spatiotemporal audio visualizer in the browser.**

Built with React 19, TypeScript, Vite, and Three.js (`@react-three/fiber` + `@react-three/drei`), Muikku renders live audio-reactive 3D **Shape Cloud** and **Point Cloud** scenes with ThinkOff color palettes, orbit controls, fullscreen display, and an optional `?voicechat` mode. It can also be embedded directly inside [`acid-control`](https://github.com/ThinkOffApp/acid-control) for live music sessions.

## Features

- **Two 3D visualization modes:** smooth camera transitions between `ShapeCloud` and `PointCloud` starfields.
- **Audio-reactive engine:** captures live microphone/audio input via Web Audio (`src/audio/AudioManager.ts`).
- **ThinkOff theme palettes:** cycle through curated color schemes (`src/constants/Colors.ts`) and fullscreen presentation mode.
- **Voice chat view:** append `?voicechat` (or `#voicechat`) to launch the interactive `VoiceChatDemo` overlay (`src/voice/`).

## Quick Start

Requires Node.js 20+.

```bash
git clone https://github.com/ThinkOffApp/muikku.git
cd muikku
npm install
npm run dev
```

### Build & Lint

```bash
npm run build
npm run preview
npm run lint
```

## Tech Stack

| Layer | Libraries |
|---|---|
| UI & Build | React 19, TypeScript, Vite |
| 3D Rendering | Three.js, `@react-three/fiber`, `@react-three/drei` |
| Vision / Tracking | `@mediapipe/tasks-vision` |
| Icons | `lucide-react` |

## License

GNU Affero General Public License v3.0 (`AGPL-3.0`). See [LICENSE](LICENSE).

---

Part of the [ThinkOff](https://thinkoff.io) family · Pairs with [`acid-control`](https://github.com/ThinkOffApp/acid-control) · Live at [muikku.app](https://muikku.app)

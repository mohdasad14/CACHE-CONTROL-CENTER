# Custom Cache Library — Live Metrics Dashboard & Control Center

A modern, high-performance developer observability dashboard for an in-memory Java 17+ Spring Boot cache with selectable LRU/LFU eviction, per-entry TTL, thread safety, and sample access pattern demonstrations.

---

## 1. Project Overview

This dashboard communicates with a Spring Boot Java backend (`http://localhost:8080`) implementing a concurrent in-memory cache. It exposes real-time performance telemetry, live TTL countdowns, eviction policy switching, interactive cache manipulations, and an automated deterministic access pattern demo for hackathon presentations.

---

## 2. Key Features

- **Live Real-Time Metrics Polling**: Periodically polls `GET /api/cache/metrics` without full-page reloads.
- **Key Performance Cards**: Real-time counters for Hit Rate, Miss Rate, Total Requests, Cache Size, Capacity, Hits, Misses, Evictions, Expirations, PUTs, and DELETEs.
- **Hit / Miss Time-Series Chart**: Recharts area chart maintaining a rolling 40-sample window.
- **Hit / Miss Rate Gauge & Donut Chart**: Immediate visual understanding of cache efficiency.
- **Cache Usage & Saturation**: Dynamic progress meter showing `X / Y` occupied slots with threshold color changes (Low, Moderate, Nearly Full, Full).
- **Selectable Eviction Policy (LRU / LFU)**: One-click strategy switching calling `POST /api/cache/policy`.
- **Cache Entry Management**:
  - `PUT /api/cache/{key}` with per-entry TTL validation and feedback.
  - `GET /api/cache/{key}` with visually distinct HIT and MISS banners.
  - `DELETE /api/cache/{key}` for individual entry eviction.
  - `DELETE /api/cache` with modal confirmation for full cache purge.
- **Cache Entries Table with Live Local TTL Countdowns**: Real-time decrementing countdowns (e.g. `4.8s -> 4.7s -> EXPIRED`) calculated from backend timestamp deltas without polling overhead.
- **Eviction Strategy Demo (Sample Access Pattern)**: Executes deterministic sequence `PUT [A, B, C], GET A, GET A, GET B, PUT D` via `POST /api/cache/demo` with animated step progression.
- **LRU vs LFU Comparison Panel**: Side-by-side visualization comparing recency vs frequency eviction candidates.
- **AI Systems Architect Diagnostic Box**: Multi-metric chart analysis powered by Gemini 3.8 Flash, evaluating health scores and tuning recommendations.
- **Web Audio Sound Effects & Ambient Music**: Audio feedback for hits, misses, puts, deletes, and ambient cybernetic background audio with mute controls.
- **Toast Notifications**: Interactive toast notifications for operations, policy changes, and connection alerts.
- **API Key Security**: Sensitive keys isolated exclusively on server-side environment variables (`process.env.GEMINI_API_KEY`).

---

## 3. Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts & Responsive SVG
- **Icons**: Lucide React
- **Audio**: Web Audio API Synthesizer
- **Backend API**: Java 17+ Spring Boot REST API (`http://localhost:8080`) / Express Proxy

---

## 4. Environment Setup

Copy `.env.example` to `.env`:

```bash
VITE_API_BASE_URL=http://localhost:8080
```

To connect to a remote backend or local proxy, update `VITE_API_BASE_URL` accordingly.

---

## 5. Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

The application will start on `http://localhost:3000`.

---

## 6. Backend API Endpoint Mapping

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cache/metrics` | Retrieve hit rate, miss rate, evictions, capacity, and counts |
| `GET` | `/api/cache` | List all active cache entries with remaining TTL |
| `GET` | `/api/cache/{key}` | Lookup single entry (HIT or MISS) |
| `PUT` | `/api/cache/{key}` | Insert/update entry with custom TTL in milliseconds |
| `DELETE` | `/api/cache/{key}` | Remove key immediately from cache and eviction policy |
| `DELETE` | `/api/cache` | Purge all entries from cache |
| `POST` | `/api/cache/policy` | Set eviction strategy (`{"policy": "LRU"}` or `{"policy": "LFU"}`) |
| `POST` | `/api/cache/metrics/reset` | Reset metric counters without clearing storage |
| `POST` | `/api/cache/demo` | Execute sample deterministic access sequence |

---

## 7. Hackathon Demo Walkthrough (7 Steps)

1. **Check Backend Status**: Observe `Backend Status: ● Online` in the top header.
2. **Observe Cache Capacity**: View current cache occupancy (e.g., `8 / 10 entries used`).
3. **Insert Entries**: Use the **PUT ENTRY** form to store `user:101` with a `30000` ms TTL. Watch the entry appear in the table with an active countdown.
4. **Demonstrate Cache Hits & Misses**:
   - Query `user:101` via **GET ENTRY** to observe a green **HIT** card and sound.
   - Query `nonexistent` to demonstrate a red **MISS** card.
5. **Switch Eviction Policy**: Toggle between **LRU** and **LFU** via the policy selector. Observe toast confirmation.
6. **Run Eviction Strategy Demo**: Click **▶ RUN SAMPLE** to execute `PUT [A, B, C], GET A, GET A, GET B, PUT D`. Watch animated step-by-step progress and observe that candidate `C` is evicted.
7. **Demonstrate Independent TTL**: Insert a key with a short TTL (e.g., `5000` ms). Watch the live countdown drop to `0.0s -> EXPIRED` and observe the expirations counter increase.

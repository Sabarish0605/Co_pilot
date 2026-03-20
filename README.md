# TELCO COPILOT v2.0 PRO

> **A real-time AI-powered support copilot for telecom call centers — with dual-model speech-to-text, policy-grounded AI agents, and live CoPilot intelligence.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Core Components](#4-core-components)
   - [Frontend — Next.js Dashboard](#41-frontend--nextjs-dashboard)
   - [Backend — FastAPI Server](#42-backend--fastapi-server)
   - [Offline STT Engine — Rts.py](#43-offline-stt-engine--rtspy)
   - [AI Copilot Pipeline](#44-ai-copilot-pipeline)
   - [AI Agent — Groq LLM](#45-ai-agent--groq-llm)
   - [Policy Grounding Engine](#46-policy-grounding-engine)
   - [Customer Intelligence Layer](#47-customer-intelligence-layer)
   - [Database Layer — Prisma + SQLite](#48-database-layer--prisma--sqlite)
5. [STT Models — Dual-Model Pipeline](#5-stt-models--dual-model-pipeline)
   - [Online STT — Deepgram nova-2](#51-online-stt--deepgram-nova-2)
   - [Offline STT — Faster-Whisper large-v3](#52-offline-stt--faster-whisper-large-v3)
6. [Data Flow & Workflows](#6-data-flow--workflows)
   - [Full Live Call Pipeline](#61-full-live-call-pipeline)
   - [STT Selection Pipeline](#62-stt-selection-pipeline)
   - [Copilot Analysis Pipeline](#63-copilot-analysis-pipeline)
   - [Agent Response Pipeline](#64-agent-response-pipeline)
7. [API Reference](#7-api-reference)
8. [Simulation & Supervisor Mode](#8-simulation--supervisor-mode)
9. [Database Schema](#9-database-schema)
10. [Configuration & Setup](#10-configuration--setup)

---

## 1. Project Overview

**Telco Copilot v2.0 PRO** is an end-to-end, real-time AI support platform for telecom companies. It acts as an **intelligent co-pilot** for human support agents during live customer calls.

**Key Capabilities:**

| Capability | Description |
|---|---|
| 🎙️ Dual-STT | Switch between Cloud (Deepgram) and Local (Whisper) transcription live |
| 🤖 AI Agent | LLM-powered auto-responses grounded in customer data and company policy |
| 🧠 AI Copilot | Real-time sentiment, intent, risk, and escalation analysis on every turn |
| 📜 Policy Grounding | Every agent response is checked against 100+ company policy rules (JSON) |
| 👤 Customer Intelligence | Customer profile, history, memories pulled from SQLite per call |
| 🔒 Escalation Engine | Automatic escalation triggers based on sentiment + policy violations |
| 📊 Supervisor View | Live session monitoring, risk flags, audit logs |
| 🧪 Simulation Mode | Load pre-built call scenarios to test the system without a real call |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND (Next.js)                        │
│  ┌──────────────┐ ┌────────────────┐ ┌───────────────────────┐  │
│  │  Live Call   │ │  Supervisor    │ │     Audit Logs        │  │
│  │    Hub       │ │    View        │ │       Panel           │  │
│  └──────┬───────┘ └───────┬────────┘ └───────────────────────┘  │
│         │                 │                                      │
│  ┌──────▼───────────────────────────────────────────────────┐   │
│  │          STT Provider Toggle (Online / Offline)           │   │
│  │   ┌────────────────────┐   ┌──────────────────────────┐  │   │
│  │   │  useDeepgramStream │   │     useSTTPipeline        │  │   │
│  │   │  (WebSocket Cloud) │   │  (WebSocket → FastAPI)   │  │   │
│  │   └────────────────────┘   └──────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
              ┌────────────▼──────────────────────┐
              │      Next.js API Routes            │
              │  /api/chat/turn  (Orchestrator)    │
              │  /api/copilot/analyze              │
              │  /api/sessions/start | /end        │
              │  /api/deepgram/token               │
              │  /api/supervisor/sessions          │
              └────────────┬──────────────────────┘
                           │
              ┌────────────▼──────────────────────┐
              │      FastAPI Backend               │
              │  POST /chat   (Groq LLM Agent)     │
              │  POST /speak  (TTS — pyttsx3)      │
              │  WS   /ws/stt (Offline STT bridge) │
              │  GET  /stt/status                  │
              └────────────┬──────────────────────┘
                           │ subprocess
              ┌────────────▼──────────────────────┐
              │   Rts.py — Local Whisper Engine    │
              │   faster-whisper large-v3 (GPU)    │
              │   sounddevice → stdout >> text     │
              └───────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.2.0 | App framework, SSR, API routes |
| **React** | 19.2.4 | UI rendering |
| **TypeScript** | ^5 | Type safety across frontend + API |
| **Prisma Client** | ^6.0.0 | ORM for SQLite queries |
| **Vanilla CSS** | — | Custom design system, glassmorphism |

### Backend
| Technology | Version | Role |
|---|---|---|
| **FastAPI** | 0.135.1 | Python API server |
| **Uvicorn** | 0.42.0 | ASGI server for FastAPI |
| **websockets** | 16.0 | Real-time WebSocket support |
| **Groq SDK** | 1.1.1 | API client for LLaMA 3 model |
| **pyttsx3** | 2.99 | Text-to-speech for agent voice |
| **python-dotenv** | 1.2.2 | Environment variable loading |

### Local STT Engine
| Technology | Version | Role |
|---|---|---|
| **faster-whisper** | latest | Quantized Whisper inference engine |
| **torch** | 2.10.0 | CUDA GPU backend for acceleration |
| **sounddevice** | latest | Microphone audio capture |
| **numpy** | latest | Audio buffer manipulation |

### Database & Storage
| Technology | Role |
|---|---|
| **Prisma ORM** | Schema, migrations, typed queries |
| **SQLite** | Local embedded database |
| **policies.json** | 258KB company policy knowledge base |

### AI / ML Models
| Model | Provider | Role |
|---|---|---|
| **LLaMA 3.1 8B Instant** | Groq Cloud | AI Agent reply generation |
| **Deepgram nova-2** | Deepgram Cloud | Online real-time transcription |
| **Whisper large-v3** | OpenAI (local) | Offline GPU transcription |
| **distil-large-v3** | Hugging Face (fallback) | Offline fallback if VRAM OOM |

---

## 4. Core Components

### 4.1 Frontend — Next.js Dashboard

**File:** `src/app/page.tsx`

The single-page application acts as the agent's primary workstation. Key sections:

- **Live Call Hub** — Main interface showing:
  - Active customer session info (name, plan, churn risk)
  - Live transcript feed with `[ONLINE]` / `[OFFLINE]` provider badges
  - Real-time Copilot Intelligence panel (emotion, intent, risk, suggestions)
  - Voice controls — START VOICE / STOP LISTENING
  - STT Provider Toggle (Online ↔ Offline)

- **Supervisor View** — Session list with risk flags and escalation status

- **Audit Logs** — Full turn-by-turn intelligence trail with policy boundary status

---

### 4.2 Backend — FastAPI Server

**File:** `shared1/shared1/backend/app.py`

A lightweight Python server that handles three responsibilities:

#### 1. AI Agent Chat (`POST /chat`)
Receives the customer's utterance + grounding context and calls the Groq LLaMA 3 API. Maintains per-session conversation history to provide coherent, multi-turn responses.

#### 2. Text-to-Speech (`POST /speak`)
Uses `pyttsx3` with a dedicated background queue-worker thread to read AI Agent replies aloud via Windows SAPI (system voices). A queue prevents blocking the API during speech synthesis.

```python
# TTS Worker prevents I/O blocking
class TTSWorker:
    queue = queue.Queue()
    thread = threading.Thread(target=_worker, daemon=True)
```

#### 3. Offline STT WebSocket Bridge (`WS /ws/stt`)
Accepts WebSocket connections from the frontend and manages the lifecycle of the local Whisper engine (`Rts.py`) as a subprocess. Broadcasts transcribed text in real time.

---

### 4.3 Offline STT Engine — Rts.py

**File:** `Trans Scripting/Rts.py`

A standalone Python script that handles local microphone audio capture and real-time transcription. Designed to run as a managed subprocess.

**Key settings:**

| Parameter | Value | Purpose |
|---|---|---|
| `samplerate` | 16,000 Hz | Optimal for Whisper models |
| `block_duration` | 0.5s | Microphone audio chunk size |
| `chunk_duration` | 5.0s | Whisper analysis window |
| `overlap_duration` | 1.5s | Sliding window overlap for context continuity |
| `ENERGY_THRESHOLD` | 0.002 | Pre-filter silence to reduce hallucinations |
| `beam_size` | 5 | Whisper decoding beam width (accuracy vs speed) |
| `vad_threshold` | 0.4 | Voice Activity Detection sensitivity |
| `min_silence_ms` | 1,000ms | Minimum pause before segment boundary |
| `initial_prompt` | Telecom domain | Domain-grounding prompt to improve accuracy |

**DLL Fix:** Auto-detects and adds NVIDIA CUDA DLL paths on Windows to fix common `cublas64_12.dll not found` errors.

**Output Protocol:** Transcribed text is printed to stdout with a `>> ` prefix:
```
>> Customer wants to cancel their plan.
```
The FastAPI backend listens to this prefix and broadcasts the text to all connected WebSocket clients.

---

### 4.4 AI Copilot Pipeline

**File:** `src/lib/transcriptManager.ts`

The Copilot is a **deterministic, rule-based intelligence engine** that runs on every customer turn. It is composed of 6 sub-modules:

```
Customer Utterance
       │
       ├──► detectSentiment()   → Neutral / Mildly Frustrated / Frustrated / Angry
       ├──► detectIntent()      → Churn Risk / Billing Complaint / Network Issue / ...
       ├──► shouldEscalate()    → { needed: boolean, reason: string }
       ├──► detectRisk()        → { level: Low/Medium/High, tags: string[] }
       ├──► extractMemory()     → ["Customer already restarted device", ...]
       └──► generateSuggestions() → ranked action list with confidence scores
                │
                ▼
         CopilotOutput (typed)
```

#### Sentiment Detection (`detectSentiment.ts`)
- Keyword intensity scoring system with 30+ weighted telecom-specific terms
- ALL-CAPS detection adds +2 to anger score
- 3-turn sliding window for trend analysis
- Escalates sentiment if recent average score ≥ threshold

#### Intent Detection (`detectIntent.ts`)
- Keyword matching across 5 intent classes with priority precedence
- Priority order: Churn Risk > Billing > Network > Follow-up > General
- Sticky intent — high-priority intents persist across the conversation

#### Risk Detection (`detectRisk.ts`)
- Tags: `Churn Risk`, `Repeat Caller`, `Escalation Risk`
- Level: Automatically elevated to `High` if escalation needed or churn intent present

#### Memory Extraction (`extractMemory.ts`)
- Pattern matching for actionable customer facts:
  - "already called before"
  - "customer restarted device"
  - "duplicate billing"
  - "customer is traveling"

#### Suggestion Generation (`generateSuggestions.ts`)
- Produces up to 3 ranked action suggestions based on intent/sentiment/risk combination
- Types: `Empathy`, `Resolution`, `Clarification`, `Retention`, `Escalation`
- Each suggestion includes a `confidence` score (0.0–1.0)

---

### 4.5 AI Agent — Groq LLM

**Model:** `llama-3.1-8b-instant` via Groq API

The AI Agent generates human-readable replies to customers. It is **grounded** by a rich context string constructed by the Orchestrator:

```
[Grounded Intelligence]
Customer Name: Sabarish Kumar
Last Call Intent: Network Issue
Last Call Summary: Customer complained about slow 4G...
Memories: Customer already restarted router. Customer is on Premium plan.

[Policy Guidance]
Boundary: safe
Relevance: Network Support Policy
Allowed Actions: Run remote diagnostic; Offer callback in 2 hours
FORBIDDEN COMMITMENTS: Do not promise refunds; Do not guarantee resolution time
```

**Configuration:**
- Max output tokens: `150` (concise, call-center appropriate)
- Temperature: `0.7` (controlled creativity)
- Session history window: Last 10 turns (prevents context overflow)

---

### 4.6 Policy Grounding Engine

**Files:** `src/lib/company/`  
**Data:** `policies.json` (258KB, 100+ policy rules)

A 3-layer content safety and guidance system:

#### Layer 1 — Policy Matching (`findRelevantPolicies.ts`)
Keyword-based matching maps the customer utterance to one or more `PolicyCategory` objects, each containing:
- `supportedIssues` — what the agent CAN help with
- `unsupportedRequests` — what the agent CANNOT do
- `allowedActions` — safe response actions
- `forbiddenPromises` — commitments the agent must never make
- `escalationTriggers` — phrases that force escalation
- `safeResponseGuidance` — recommended phrasing

#### Layer 2 — Boundary Check (`checkPolicyBoundaries.ts`)
Classifies the utterance into one of three states:

| Status | Meaning | Action |
|---|---|---|
| `safe` | Within standard support boundaries | Normal reply |
| `caution` | Financial/legal language detected | Careful response required |
| `crossed` | Escalation trigger matched | Immediate escalation recommended |

#### Layer 3 — Agent Injection
The boundary status, safe guidance, and forbidden promises are injected directly into the LLM prompt context, ensuring the AI Agent never makes policy-violating promises.

---

### 4.7 Customer Intelligence Layer

**Files:** `src/lib/db.ts`, `src/lib/customer/buildFactualAnswerContext.ts`

On every call start:
1. Customer is resolved by phone number (auto-created if new)
2. Recent session summaries are retrieved
3. Memory items are fetched (facts from past calls)
4. A `CustomerContext` object is built with:

```typescript
{
  customerSnapshot: { name, plan, region, churnRisk, vipStatus, ... },
  supportHistory: { billingIssues, networkIssues, escalations, ... },
  relevantMemories: ["restarted router before", "VIP customer"],
  personalizationHints: ["prefer Tamil", "repeat caller"],
  retentionSignals: ["churn mentioned", "competitor mentioned"],
  recommendedTone: "empathetic",
  lastSessionSummary: "Customer complained about 5G speeds in Madurai."
}
```

**Factual Answer Detection (`buildFactualAnswerContext.ts`):**  
If the customer asks "what's my plan?" or "what did we talk about?", the system injects **deterministic data** (not LLM-hallucinated) directly into the prompt:

```
[DETERMINISTIC PROFILE DATA]: The customer's name is Sabarish. 
Their phone number is 555-0101. Their current plan is Premium 5G. 
They are located in Madurai. Preferred language is Tamil.
```

---

### 4.8 Database Layer — Prisma + SQLite

**File:** `prisma/schema.prisma`

A relational schema with 8 models:

| Model | Purpose |
|---|---|
| `Customer` | Customer profile, churn risk, VIP status, complaint counts |
| `Session` | Call session with timestamps, status, escalation/risk flags |
| `ConversationTurn` | Each individual utterance (customer text + agent reply) |
| `CopilotInsight` | AI analysis output stored per turn (intent, sentiment, risk, policy) |
| `ExtractedFact` | Named facts extracted from conversation (memory items) |
| `MemoryItem` | Long-term memories associated with a customer across sessions |
| `CallSummary` | Structured end-of-call summary (JSON) with resolution status |
| `SimulationScenario` | Pre-built demo call scripts (JSON) for simulation mode |

---

## 5. STT Models — Dual-Model Pipeline

### 5.1 Online STT — Deepgram nova-2

**Hook:** `src/hooks/useDeepgramStream.ts`

| Specification | Value |
|---|---|
| **Provider** | Deepgram Cloud API |
| **Model** | `nova-2` |
| **Protocol** | WebSocket (wss://) |
| **Encoding** | `linear16` (PCM 16-bit) |
| **Sample Rate** | 16,000 Hz |
| **Channels** | Mono (1) |
| **Interim Results** | Yes (real-time streaming) |
| **Smart Format** | Yes (punctuation, capitalization) |
| **Endpointing** | 500ms (auto-segment detection) |
| **Latency** | ~200-400ms (network dependent) |
| **Languages** | 100+ (auto-detected) |
| **Auth** | Short-lived token fetched from `/api/deepgram/token` |

**Audio pipeline:**  
`Microphone → getUserMedia() → AudioContext (16kHz) → ScriptProcessor → PCM buffer → Deepgram WebSocket`

**End-of-speech detection:**  
A 2-second debounce timer fires after the last final transcript, combining all interim turns into one complete `MessageTurn` before sending to the Orchestrator.

---

### 5.2 Offline STT — Faster-Whisper large-v3

**Script:** `Trans Scripting/Rts.py`  
**Bridge:** `shared1/shared1/backend/app.py → WS /ws/stt`

| Specification | Value |
|---|---|
| **Provider** | Local GPU (on-device) |
| **Model** | `whisper large-v3` (primary) |
| **Fallback Model** | `distil-large-v3` → `medium.en` (CPU) |
| **Backend** | `faster-whisper` (CTranslate2 quantized) |
| **Acceleration** | CUDA (NVIDIA GPU), `compute_type=float16` |
| **Sample Rate** | 16,000 Hz |
| **Chunk Size** | 5.0s sliding window |
| **Overlap** | 1.5s for cross-boundary word continuity |
| **VAD** | Built-in Silero VAD (threshold 0.4) |
| **Language** | Forced to `en` (handles Tamil→English translation) |
| **Domain Prompt** | Telecom-specific initial prompt |
| **Beam Size** | 5 (high accuracy) |
| **Latency** | 2-5s (GPU inference + 5s window) |
| **Privacy** | 100% on-device, no data leaves the machine |

**Communication flow:**
```
Microphone
    │ sounddevice InputStream
    │ 0.5s blocks → audio_queue
    │
Transcriber Thread
    │ accumulates until 5s chunk ready
    │ faster-whisper model.transcribe()
    │ hallucination filtering
    │ prints ">> <text>" to stdout (flush=True)
    │
FastAPI Backend (app.py)
    │ reads stdout line by line in background thread
    │ loop.call_soon_threadsafe() → creates asyncio task
    │
broadcast_stt(text)
    │ sends JSON to all WebSocket clients
    │ { text, isFinal: true, provider: "offline" }
    │
Frontend (useSTTPipeline.ts)
    │ receives message → calls onTranscriptReceived()
    └─► Orchestrator Pipeline
```

---

## 6. Data Flow & Workflows

### 6.1 Full Live Call Pipeline

```
1. Agent opens dashboard → loads customer by phone number
2. Prisma queries Customer, Sessions, Memories from SQLite
3. CustomerContext built (profile + history + signals + tone)
4. Agent selects STT provider (Online/Offline)
5. Agent clicks START VOICE → microphone access granted
6. Customer speaks
7. STT engine transcribes in real-time
8. On final transcript:
   a. POST /api/chat/turn (Orchestrator)
   b. Orchestrator resolves policy context
   c. Copilot runs 6-module analysis pipeline
   d. Policy boundaries checked (safe/caution/crossed)
   e. Factual context detected and injected
   f. AI Agent called via Groq API with full grounded context
   g. Agent reply returned
   h. TTS triggered (agent voice reads reply)
   i. Turn + Copilot insight saved to SQLite
9. Frontend updates:
   - Transcript feed (with provider badge)
   - Copilot Intelligence panels
   - Risk / escalation indicators
   - Audit trail
10. On END SESSION: CallSummary generated and saved
```

### 6.2 STT Selection Pipeline

```
                useSTTPipeline hook
                       │
            ┌──────────┴──────────┐
            │                     │
       provider='online'     provider='offline'
            │                     │
   useDeepgramStream         WebSocket to :8000/ws/stt
   (WebSocket to cloud)      (Local FastAPI bridge)
            │                     │
   PCM audio → Deepgram    Rts.py subprocess reads mic
            │                     │
   Final transcript         Whisper transcribes 5s window
            │                     │
   onTranscriptReceived()   broadcast_stt() → WS message
            │                     │
            └──────────┬──────────┘
                       │
              handleVoiceTranscript(text, isFinal, provider)
                       │
              MessageTurn { text, provider: 'online'|'offline' }
                       │
                  UI + Orchestrator
```

### 6.3 Copilot Analysis Pipeline

```
[Customer Utterance]
        │
        ▼
transcriptManager.analyzeConversation()
        │
        ├──► detectSentiment(history + latest)
        │    └─ keyword score → trend analysis → SentimentType
        │
        ├──► detectIntent(history + latest)
        │    └─ keyword match → priority precedence → IntentType
        │
        ├──► shouldEscalate(sentiment, intent, history)
        │    └─ anger check + churn check + repeat caller → boolean
        │
        ├──► detectRisk(text, history, intent, escalation)
        │    └─ tag extraction → Low/Medium/High level
        │
        ├──► extractMemory(full history)
        │    └─ pattern match → deduped fact list
        │
        └──► generateSuggestions(intent, sentiment, risk)
             └─ ranked list of 3 typed suggestions with confidence
```

### 6.4 Agent Response Pipeline

```
[Orchestrator: /api/chat/turn]
        │
        ├──► findRelevantPolicies(utterance)
        │    └─ keyword match against policies.json categories
        │
        ├──► checkPolicyBoundaries(utterance, matchedCategories)
        │    └─ 3-layer check → safe/caution/crossed
        │
        ├──► buildFactualAnswerContext(utterance, customerContext)
        │    └─ deterministic profile/history data injection
        │
        ├──► Build groundingContext string (policy + customer + memory)
        │
        ├──► POST http://localhost:8000/chat
        │    └─ Groq LLaMA 3.1 8B with grounding context
        │    └─ 5s timeout for resilience
        │
        ├──► POST http://localhost:8000/speak (fire-and-forget)
        │    └─ pyttsx3 TTS reads reply aloud
        │
        └──► saveConversationTurn() + saveCopilotInsight() → SQLite
```

---

## 7. API Reference

### Next.js API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/chat/turn` | POST | Main Orchestrator — processes one customer turn end-to-end |
| `/api/copilot/analyze` | POST | Standalone Copilot analysis (no DB write) |
| `/api/sessions/start` | POST | Start a new call session for a customer |
| `/api/sessions/end` | POST | End session, generate summary |
| `/api/customer/start-session` | POST | Resolve customer and create session |
| `/api/deepgram/token` | GET | Retrieve temporary Deepgram API token |
| `/api/simulation/scenarios` | GET/POST | Manage pre-built call scenarios |
| `/api/supervisor/sessions` | GET | Supervisor session list with risk data |

### FastAPI Routes

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Server health check |
| `/chat` | POST | LLaMA 3 agent response with session history |
| `/speak` | POST | TTS — reads text aloud via pyttsx3 |
| `/reset` | POST | Clear all session histories |
| `/stt/status` | GET | Offline STT engine status (idle/active) |
| `/ws/stt` | WebSocket | Real-time offline transcription bridge |

---

## 8. Simulation & Supervisor Mode

### Simulation Mode
Pre-built call scenarios are stored in `SimulationScenario` (SQLite) with:
- `title`, `category`, `description`, `difficulty`
- `scriptJson` — array of `{ speaker, text, delay? }` turns

Agents can load a scenario to auto-play a scripted call, testing all AI pipelines without a real customer.

### Supervisor Mode
Provides a read-only view of active/recent sessions:
- Customer name, phone, plan
- Current sentiment, risk level, escalation status
- Session start time and last turn
- Supervisor notes field

---

## 9. Database Schema

```
Customer ──── Session ──── ConversationTurn ──── CopilotInsight
               │                │
               │                └── ExtractedFact
               │
               ├── MemoryItem
               └── CallSummary

SimulationScenario (standalone)
```

Key relationships:
- One `Customer` → Many `Session`
- One `Session` → Many `ConversationTurn`
- One `ConversationTurn` → One `CopilotInsight`
- One `Session` → One `CallSummary`

---

## 10. Configuration & Setup

### Environment Variables

**`copilot/.env.local`** (Next.js):
```env
DEEPGRAM_API_KEY=your_deepgram_key_here
DATABASE_URL=file:./dev.db
```

**`shared1/shared1/backend/.env`** (FastAPI):
```env
GROQ_API_KEY=your_groq_key_here
```

### Running the Application

**1. Start the FastAPI Backend:**
```bash
cd shared1/shared1/backend
./venv/Scripts/python.exe app.py
# Server starts at http://localhost:8000
```

**2. Start the Next.js Frontend:**
```bash
cd copilot
npm run dev
# Dashboard at http://localhost:3000
```

**3. Database Setup (first time):**
```bash
npm run db:push   # Apply schema
npm run db:seed   # Load sample data
```

### Python Dependencies (Backend venv)
```
fastapi, uvicorn, websockets, groq, pyttsx3, python-dotenv,
faster-whisper, torch, sounddevice, numpy
```

### GPU Requirements (Offline STT)
- **Recommended:** NVIDIA GPU with ≥ 6GB VRAM for `large-v3`
- **Fallback:** Automatically tries `distil-large-v3` then `medium.en` (CPU)
- CUDA toolkit must be installed and NVIDIA drivers up to date

---

## Judge-Friendly Demo Notes

For demo/evaluation purposes, the dashboard clearly shows:

- **Provider badge** on every transcript bubble: `[ONLINE]` (blue) or `[OFFLINE]` (amber)
- **Health indicator** in navbar: `OFFLINE ENGINE: ENGINE READY / IDLE / UNAVAILABLE`
- **Toggle control:** Disabled while actively recording to prevent mid-call switching
- **Persistent selection:** Provider choice survives page refresh (localStorage)
- **Real-time comparison:** Switch providers between turns to visually compare transcript quality and latency

---

*Telco Copilot v2.0 PRO — Built for real-time AI-augmented telecom support.*

# ContractSync

> **Autonomous API Contract Governance and Frontend Synchronization via Switch, Google Antigravity, and Mattermost.**

[![Flip the Switch 2026](https://img.shields.io/badge/Hackathon-Flip%20the%20Switch%202026-blue)](https://www.wemakedevs.org/hackathons/switch)
[![Track](https://img.shields.io/badge/Track-Best%20Business%20Workflow-green)](https://www.wemakedevs.org/hackathons/switch)
[![Tests](https://img.shields.io/badge/Tests-11%2F11%20Passing-brightgreen)](tests/run-all-tests.ts)
[![Antigravity](https://img.shields.io/badge/Provider-Google%20Antigravity%20CLI%20(agy%20acp)-blue)](https://antigravity.google/)
[![Switch Template](https://img.shields.io/badge/Switch-v0.31%20%2F%20v0.40%20Console-purple)](https://docs.switchagents.ai/)
[![Chat Platform](https://img.shields.io/badge/Chat-Mattermost-blue)](https://mattermost.com/)
[![Web Simulator](https://img.shields.io/badge/Showcase-GitHub%20Pages-purple)](https://manishr075.github.io/contractsync/)

**Live Interactive Simulator & Showcase:** [https://manishr075.github.io/contractsync/](https://manishr075.github.io/contractsync/)

---

## 1. Verified System State: Tested vs Unverified Setup

To maintain strict technical honesty and hackathon compliance, here is the exact verification boundary of the project:

### ✅ Tested and Programmatically Verified on Host System
- **Google Antigravity CLI Installation**: `agy` v1.5.2 installed on `PATH` and authenticated with Google credentials.
- **Agent Client Protocol (ACP) Engine**: Verified JSON-RPC 2.0 handshake (`protocolVersion: 1`), session lifecycle (`session/new`), prompt turns (`session/prompt`), and token streaming using `agy acp --stdio`. Permission bypass flags (`--dangerously-skip-permissions`) have been completely removed.
- **Two Independent Agent Sessions**: `SpecArchitect` and `FrontendSync` initialized with separate ACP sessions, separate configurations, and separate identities.
- **Semantic Breaking-Change Analyzer**: OpenAPI 3.x schema parser accurately identifying field renames, type mutations, and enum additions.
- **Strict Human Approval Gate**: Verified that `demo-workspace/openapi.yaml` remains byte-for-byte identical before human approval; verified rejection of non-conforming (`"Looks good"`) and incomplete approval candidates.
- **TypeScript Codegen & Compiler Check**: TypeScript interface regeneration, `@deprecated` JSDoc annotation preservation, mock fixture synchronization, and live `npx tsc --noEmit` compiler validation (exit code 0, 0 errors).
- **Automated Test Suite (11/11 Passing)**: Full test suite in `tests/` verifying all business logic and isolated ACP turns.
- **Interactive Web Simulator**: Static client-side simulator on GitHub Pages representing the 7-step Switch protocol flow.

### ⏳ Unverified Desktop Setup (Awaiting User Desktop Action)
- **Switch Console Desktop App**: Switch Console is an Electron GUI application (`switch-console-x64.exe`). It must be launched interactively on the Windows desktop.
- **Docker Desktop & Bundled Mattermost**: Switch Console bundles a local Mattermost container via Docker. Because Docker is not installed on this host, running the bundled Mattermost requires manually starting Docker Desktop or connecting an external Mattermost URL.
- **End-to-End Chat in Mattermost UI**: The live Mattermost bot account interactions require manual user login and room creation inside the Switch Console UI.

---

## 2. Architecture & Coordination Substrate

In modern software development, backend and frontend teams frequently suffer from **API contract drift**:
- A backend developer updates an endpoint or renames a field in an OpenAPI specification.
- Frontend TypeScript interfaces, mock handlers, and UI components remain out of sync.
- Applications break silently at runtime in staging or production.

### The ContractSync Solution

ContractSync coordinates backend and frontend evolution inside a shared **Mattermost channel (`#api-contract-room`)** governed by **Switch** and powered by **Google Antigravity CLI (`agy acp`)**:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Human Developer (@developer)
    participant MM as Mattermost (#api-contract-room)
    participant Switch as Switch Console (Session Host & Watcher)
    participant SA as SpecArchitect (@spec-architect / agy acp)
    participant OAS as demo-workspace/openapi.yaml
    participant FS as FrontendSync (@frontend-sync / agy acp)
    participant TS as TypeScript Compiler (tsc --noEmit)

    Dev->>MM: Post API change request: "Update GET /api/spots: rename spot_status to availability_state..."
    MM->>Switch: Mattermost WebSocket event
    Switch->>SA: Dispatch turn to SpecArchitect Antigravity session
    SA->>OAS: Read and analyze diff against openapi.yaml
    Note over SA: Detects CRITICAL breaking change.<br/>Preserves openapi.yaml (Human Approval Gate)
    SA->>Switch: Post breaking change assessment & migration proposal
    Switch->>MM: Relay SpecArchitect response to Mattermost
    
    alt Non-conforming or incomplete approval
        Dev->>MM: "Looks good, proceed!" or missing deprecation terms
        Switch->>SA: Dispatch candidate to SpecArchitect
        SA->>Switch: Post [APPROVAL REJECTED]: Missing mandatory migration terms
        Switch->>MM: Relay rejection; openapi.yaml remains completely unmodified
    end

    Dev->>MM: "APPROVE: rename spot_status to availability_state retaining spot_status as optional deprecated..."
    Switch->>SA: Dispatch approval to SpecArchitect
    SA->>OAS: Apply approved changes (Bump to v1.1.0, add new field, retain deprecated field)
    SA->>Switch: Post [CONTRACT APPROVED] with mention of @frontend-sync
    Switch->>MM: Relay approval notice
    Switch->>FS: Dispatch handoff turn to FrontendSync Antigravity session
    FS->>FS: Regenerate src/api.types.ts with @deprecated tags & union types
    FS->>FS: Synchronize src/mocks.ts with valid payload fixtures
    FS->>TS: Execute 'npx tsc --noEmit' in workspace
    TS-->>FS: Compiler output (Exit code 0, 0 errors)
    FS->>Switch: Post [FRONTEND SYNCHRONIZATION COMPLETE] & [TYPE CHECK PASSED]
    Switch->>MM: Relay FrontendSync report to Mattermost
```

---

## 3. Two Independent Antigravity Agents

Both agents run in separate Antigravity ACP sessions with distinct identities and configurations:

### 1. SpecArchitect (`@spec-architect`)
- **Role**: Backend API Guardian.
- **Provider**: Google Antigravity CLI (`agy acp --stdio`).
- **Instructions**: Embedded in [`switch/template.yaml`](switch/template.yaml) and [`agents/spec-architect/instructions.md`](agents/spec-architect/instructions.md).
- **Responsibilities**:
  1. Inspects `demo-workspace/openapi.yaml` when an API change request is received.
  2. Identifies breaking changes (field renames, removed fields, restricted enums).
  3. Explains consumer impact and drafts backward-compatible migrations (retaining previous field as optional and deprecated).
  4. **Strictly enforces the Human Approval Gate**: guarantees that `openapi.yaml` is NOT touched until an explicit `APPROVE:` message is posted by an authorized human.
  5. Rejects vague, non-prefix, or incomplete approvals.
  6. Upon valid approval, updates `openapi.yaml` and hands off to `@frontend-sync` through the Switch room.

### 2. FrontendSync (`@frontend-sync`)
- **Role**: Frontend Integration Engineer.
- **Provider**: Google Antigravity CLI (`agy acp --stdio`).
- **Instructions**: Embedded in [`switch/template.yaml`](switch/template.yaml) and [`agents/frontend-sync/instructions.md`](agents/frontend-sync/instructions.md).
- **Responsibilities**:
  1. Listens for approved contract notifications from `@spec-architect` in `#api-contract-room`.
  2. Regenerates TypeScript definitions in `demo-workspace/src/api.types.ts`, preserving JSDoc `@deprecated` annotations and mapping enums to union types.
  3. Synchronizes mock data fixtures in `demo-workspace/src/mocks.ts` with valid enum values and dual-field backwards compatibility.
  4. Executes the real TypeScript compiler (`npx tsc --noEmit`) to verify zero type errors across the entire codebase.
  5. Posts the verified compiler report to `#api-contract-room`.

---

## 4. Official Switch Template (`switch/template.yaml`)

The template strictly adheres to the official Switch template specification (`version: 1`, `bridge`, `agents`, `room`, `kickoff`):

```yaml
version: 1

params:
  room_name:
    type: string
    label: Channel Name
    default: api-contract-room
  bridge:
    type: bridge
    label: Messaging App
    default: [Mattermost, $first]
  workspace:
    type: directory
    label: Workspace Directory
    default: ./demo-workspace

agents:
  - name: spec-architect
    display_name: SpecArchitect
    provider: antigravity
    location: local
    directory: "{workspace}"
    addressing: anyone
    auto_mode: true
    instructions: |
      ... (Full SpecArchitect instructions)

  - name: frontend-sync
    display_name: FrontendSync
    provider: antigravity
    location: local
    directory: "{workspace}"
    addressing: anyone
    auto_mode: true
    instructions: |
      ... (Full FrontendSync instructions)

room:
  name: "{room_name}"
  bridge: "{bridge}"
  channel_type: channel_public
  description: Coordination room for API contract updates and frontend synchronization
  agents:
    - spec-architect
    - frontend-sync
  users:
    - "{$creator}"

kickoff: |
  ContractSync system online. @spec-architect and @frontend-sync are connected via Switch with Google Antigravity provider.
```

---

## 5. Automated Verification & Testing

### 1. Run the Full Automated Test Suite (11/11 Passing)

```bash
npm test
```

Expected output:
```text
======================================================================
  CONTRACTSYNC TEST SUITE — FLIP THE SWITCH 2026
======================================================================
  [✓ PASS] Test 01: OpenAPI Specification Validity
  [✓ PASS] Test 02: Detection of Renamed Field as Breaking Change
  [✓ PASS] Test 03: Detection of Newly Introduced Enum
  [✓ PASS] Test 04: Preservation of Deprecated Compatibility Field
  [✓ PASS] Test 05: Deterministic TypeScript Type Generation
  [✓ PASS] Test 06: Mock Data Consistency
  [✓ PASS] Test 07: TypeScript Compilation Verification (tsc --noEmit)
  [✓ PASS] Test 08: Rejection of Unapproved Contract Modifications
  [✓ PASS] Test 09: Handling Invalid or Incomplete Approval Instructions
  [✓ PASS] Test 10: Switch Simulator Wire Protocol & Operations (Test Mock)
  [✓ PASS] Test 11: Genuine Antigravity ACP Integration & Human-in-the-Loop Gate
----------------------------------------------------------------------
  Total: 11 | Passed: 11 | Failed: 0
======================================================================
```

### 2. Run the Isolated Antigravity ACP Test Workflow

```bash
npm run workflow:antigravity
```

This executable test script (`scripts/run-antigravity-workflow.ts`) spins up two isolated Google Antigravity ACP stdio sessions (`agy acp --stdio`) to verify LLM reasoning, schema analysis, and TypeScript compilation directly against the installed Google `agy` runtime.

---

## 6. Precise End-to-End Verification Checklist for Switch Console & Mattermost

Follow these exact steps to run the complete desktop Switch Console + Mattermost workflow:

### Step 1: Start Docker Desktop (For Bundled Mattermost)
1. Install and start **Docker Desktop for Windows**.
2. Verify Docker is running in your terminal:
   ```powershell
   docker ps
   ```

### Step 2: Download & Launch Switch Console Desktop
1. Download the official Switch Console desktop release (v0.40.1):
   - [switch-console-x64.exe](https://github.com/sandbox-quantum/switch/releases/latest/download/switch-console-x64.exe)
2. Run `switch-console-x64.exe` to launch the Switch Console desktop application.

### Step 3: Verify Agent Provider Detection
1. In Switch Console, click **Settings** (gear icon in sidebar) > **Agent Providers**.
2. Locate **Antigravity**. It must display:
   - Status: **Signed in**
   - Details: **CLI installed** (`agy` 1.5.2 detected from PATH).
   *(If not detected, click the Refresh icon)*.

### Step 4: Initialize Server & Bundled Mattermost
1. On the Switch Console Home screen, select **Add a server on this computer**.
2. Switch Console will initialize the local server and start the bundled Mattermost container via Docker.
3. Under **Messaging Apps**, Mattermost will appear with a green status indicator.
4. Click **Sign-in details…** on the Mattermost row to note the admin credentials.
5. In Switch Console, select **Link your Mattermost account** and choose your user.

### Step 5: Import & Run the Template
1. In Switch Console, click **Templates** in the sidebar.
2. Click **Import template** (or **Upload template**).
3. Select `switch/template.yaml` from this repository.
4. Review the inputs:
   - **Channel Name**: `api-contract-room`
   - **Messaging App**: `Mattermost`
   - **Workspace Directory**: Full path to `demo-workspace` (e.g. `C:\Users\manis\Downloads\flowguard\demo-workspace`).
5. Click **Create room**. Switch Console creates the channel on Mattermost, creates `@spec-architect` and `@frontend-sync` bot accounts, and launches their Antigravity sessions.

### Step 6: Interactive Workflow in Mattermost
1. Open Mattermost in your browser or desktop client and navigate to `#api-contract-room`.
2. Observe the automated kickoff message from Switch.
3. Post the API change request:
   ```text
   @spec-architect Update GET /api/spots: rename spot_status to availability_state and add a role field with the values admin, user and guest.
   ```
4. Verify `@spec-architect` responds with the breaking change evaluation, explains the risk to consumers, and requests approval.
5. Check `demo-workspace/openapi.yaml` in your editor — verify it is **unmodified**.
6. (Optional Negative Test) Post:
   ```text
   Looks great, go ahead!
   ```
   Verify `@spec-architect` rejects it because it does not start with `APPROVE:`.
7. Post the compliant approval:
   ```text
   APPROVE: rename spot_status to availability_state retaining spot_status as optional deprecated and adding role enum
   ```
8. Verify `@spec-architect` updates `openapi.yaml` to v1.1.0, posts confirmation, and hands off to `@frontend-sync`.
9. Verify `@frontend-sync` updates `src/api.types.ts` and `src/mocks.ts`, runs `tsc --noEmit`, and posts `[TYPE CHECK PASSED]` with 0 errors in the channel.

---

## 7. Repository Layout

```
contractsync/
├── agents/
│   ├── spec-architect/              # SpecArchitect Agent
│   │   ├── antigravity-agent.ts     # Antigravity ACP Session Agent
│   │   ├── analyzer.ts              # Deterministic OpenAPI Schema & Diff Analyzer
│   │   └── instructions.md          # Agent System Prompt & Human Gate Policy
│   └── frontend-sync/               # FrontendSync Agent
│       ├── antigravity-agent.ts     # Antigravity ACP Session Agent
│       ├── sync-engine.ts           # Type Generator, Mock Synchronizer & Compiler Runner
│       └── instructions.md          # Agent System Prompt & Verification Policy
├── demo-workspace/                  # Target Application Workspace
│   ├── openapi.yaml                 # Spot Service API Specification (v1.0.0 -> v1.1.0)
│   ├── tsconfig.json                # TypeScript Strict Configuration
│   └── src/
│       ├── api.types.ts             # Auto-generated TypeScript interfaces
│       ├── mocks.ts                 # Synchronized mock responses
│       └── index.ts                 # Sample consumer application code
├── public/                          # GitHub Pages Interactive Simulator
│   └── index.html                   # Web Showcase & Protocol Visualizer
├── scripts/
│   ├── generate-types.ts            # Standalone type generation utility
│   ├── verify-contract.ts           # Standalone compiler verification utility
│   ├── run-antigravity-workflow.ts  # Isolated ACP Dual-Agent Test Runner
│   ├── run-switch-server.ts         # Offline Test Mock Server Runner
│   └── run-demo.ts                  # Offline Simulator Workflow Runner
├── switch/
│   ├── template.yaml                # Official Switch Room & Agent Template (v1 spec)
│   ├── room-instructions.md         # Channel Governance Rules
│   ├── approval-protocol.md         # Human-in-the-Loop Protocol Specification
│   └── simulator/                   # Local Mock Server & Client for Offline CI/CD
│       ├── switch-server.ts         # In-memory WebSocket/HTTP Mock Server
│       ├── switch-client.ts         # Test Client Adapter
│       └── types.ts                 # Wire Protocol Frame Types
└── tests/                           # 11 Automated Test Suites (100% Pass)
    ├── 1-openapi-validity.test.ts
    ├── 2-field-rename-detection.test.ts
    ├── 3-enum-detection.test.ts
    ├── 4-backward-compatibility.test.ts
    ├── 5-type-generation.test.ts
    ├── 6-mock-data-consistency.test.ts
    ├── 7-typescript-compiler.test.ts
    ├── 8-unapproved-modification-rejection.test.ts
    ├── 9-invalid-approval-handling.test.ts
    ├── 10-switch-wire-protocol.test.ts
    ├── 11-antigravity-acp-workflow.test.ts
    └── run-all-tests.ts             # Test Suite Runner
```

---

## 8. License

Apache 2.0. Built for the **Flip the Switch 2026 Hackathon**.

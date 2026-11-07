# ContractSync Architecture & System Design

**Project**: ContractSync  
**Hackathon**: Flip the Switch 2026  
**Track**: Best Business Workflow  
**Primary Messaging App**: Mattermost (`#api-contract-room`)  
**Agent Provider**: Google Antigravity CLI (`agy acp --stdio`)  

---

## 1. Architectural Tiers & Separation of Concerns

ContractSync is designed with rigorous separation between production deployment infrastructure, automated test harnesses, and the public web showcase:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       TIER 1: OFFICIAL SWITCH & ANTIGRAVITY                     │
│  • Messaging Platform: Mattermost (#api-contract-room)                          │
│  • Room Manager: Official Switch Console (v0.40.1) using switch/template.yaml   │
│  • Agent Provider: Google Antigravity CLI ('agy acp --stdio')                  │
│  • Protocol: Agent Client Protocol (ACP) v1 JSON-RPC over stdio                │
│  • Independent Sessions: SpecArchitect (Session A), FrontendSync (Session B)   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         ▲
                                         │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TIER 2: AUTOMATED TEST & VERIFICATION HARNESS                │
│  • 11 Deterministic Automated Test Suites ('npm test')                          │
│  • Offline Simulator Harness: 'switch/simulator/' (in-memory WS/HTTP mock)      │
│  • Integration Test 11: Real end-to-end execution with 'agy acp --stdio'        │
│  • Compiler Verification: Live 'npx tsc --noEmit' in workspace                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         ▲
                                         │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 TIER 3: INTERACTIVE WEB SIMULATOR (GITHUB PAGES)                │
│  • Client-side browser demonstration at https://manishr075.github.io/contractsync│
│  • Provides judges with an immediate interactive preview of the 7-step flow     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Coordination Flow

All interactions occur through the shared Mattermost channel `#api-contract-room` bridged by Switch:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (@developer)
    participant MM as Mattermost (#api-contract-room)
    participant Switch as Switch Console Bridge
    participant SA as SpecArchitect (agy acp)
    participant FS as FrontendSync (agy acp)
    participant Disk as Workspace Files & TSC

    Dev->>MM: Post API change request: "Update GET /api/spots. Rename spot_status to availability_state..."
    MM->>Switch: Mattermost webhook / WebSocket push
    Switch->>SA: Dispatch turn to SpecArchitect Antigravity ACP session
    SA->>Disk: Read demo-workspace/openapi.yaml
    Note over SA: Evaluates schema diff.<br/>Identifies breaking rename.<br/>BLOCKS contract modification.
    SA->>Switch: Post structured proposal & [HUMAN APPROVAL REQUIRED]
    Switch->>MM: SpecArchitect bot posts assessment to Mattermost
    
    opt Rejection of unapproved or incomplete input
        Dev->>MM: "Looks good, proceed!" or missing deprecation terms
        Switch->>SA: Forward candidate
        SA->>Switch: Reject: "Missing mandatory backward compatibility terms"
        Switch->>MM: SpecArchitect bot warns developer; openapi.yaml remains untouched
    end

    Dev->>MM: Post compliant approval: "APPROVE: rename spot_status to availability_state retaining..."
    Switch->>SA: Forward approval
    SA->>Disk: Update demo-workspace/openapi.yaml (Bump to v1.1.0, add new field, deprecate old)
    SA->>Switch: Post [CONTRACT APPROVED] with handoff to @frontend-sync
    Switch->>MM: SpecArchitect bot posts approval confirmation
    Switch->>FS: Dispatch turn to FrontendSync Antigravity ACP session
    FS->>Disk: Regenerate demo-workspace/src/api.types.ts
    FS->>Disk: Synchronize demo-workspace/src/mocks.ts
    FS->>Disk: Execute 'npx tsc --noEmit'
    Disk-->>FS: Compiler output (Exit code 0, 0 errors)
    FS->>Switch: Post [FRONTEND SYNCHRONIZATION COMPLETE] & [TYPE CHECK PASSED]
    Switch->>MM: FrontendSync bot posts compiler results to Mattermost
```

---

## 3. Google Antigravity CLI & ACP Integration

Switch integrates with AI coding agents using the **Agent Client Protocol (ACP)**. When an agent is configured with `provider: antigravity`, Switch launches Google's official `agy` binary:

```bash
agy acp --stdio --dangerously-skip-permissions
```

### Protocol Mechanics
1. **Transport**: JSON-RPC 2.0 over standard input and output (`stdio`).
2. **Handshake**: The client initializes with `protocolVersion: 1`:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "initialize",
     "params": {
       "protocolVersion": 1,
       "clientInfo": { "name": "switch-console", "version": "0.40.1" }
     }
   }
   ```
3. **Session Creation**: Switch creates an isolated session per agent:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 2,
     "method": "session/new",
     "params": {
       "cwd": "C:/.../demo-workspace",
       "systemPrompt": "<Agent role instructions>"
     }
   }
   ```
4. **Prompt Dispatch**: When a message arrives from Mattermost, Switch dispatches a turn:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 3,
     "method": "session/prompt",
     "params": {
       "sessionId": "<session-uuid>",
       "prompt": [{ "type": "text", "text": "<message content>" }]
     }
   }
   ```
5. **Streaming Updates**: The Antigravity engine streams updates via `session/update` notifications (`agent_message_chunk`) and concludes with `stopReason: "end_turn"`.

Both **SpecArchitect** and **FrontendSync** run as completely separate processes and sessions. They do not share memory, variables, or direct process calls; all handoffs occur as messages routed through the Switch room.

---

## 4. The Human Approval Gate

A fundamental design requirement is that **AI agents must never unilaterally deploy breaking contract changes**:

1. **State Machine**:
   - `IDLE`: Listening for change requests.
   - `AWAITING_APPROVAL`: Breaking change detected; contract modification locked.
   - `COMMITTED`: Human approval validated; contract updated and handed off.
2. **Strict File Locking**:
   - Before human approval is recorded, `demo-workspace/openapi.yaml` is mathematically verified to be unmodified (verified via SHA-256 content hashing in `isSpecUnmodified()`).
3. **Validation Rules**:
   - Approvals must start with `APPROVE:` or `APPROVED:`.
   - Approvals must explicitly specify the mitigation terms (`availability_state`, `deprecated` retention for `spot_status`, and `role` enum).
   - Vague instructions like *"Looks good"* or *"Proceed"* are immediately rejected, and the contract remains locked.

---

## 5. Frontend Synchronization & Compiler Verification

FrontendSync deterministically bridges the OpenAPI contract into TypeScript:

1. **Type Generation (`src/api.types.ts`)**:
   - Extracts OpenAPI schemas.
   - Preserves `@deprecated` JSDoc annotations so frontend developers see deprecation warnings in their IDEs.
   - Converts OpenAPI enum arrays (e.g. `['admin', 'user', 'guest']`) into strict TypeScript union types (`'admin' | 'user' | 'guest'`).
2. **Mock Response Synchronization (`src/mocks.ts`)**:
   - Populates mock response objects with valid enum values and dual-field data (both new and deprecated fields) to maintain legacy consumer compatibility.
3. **Real Compiler Verification**:
   - Runs `npx tsc --noEmit` using the active Node.js and TypeScript environment.
   - Zero-tolerance policy: if `tsc` exits with any code other than `0`, the sync is flagged as failed (`[TYPE CHECK FAILED]`) and reported to the room.

---

## 6. Offline Test Harness (`switch/simulator/`)

For environments without an active Switch Console desktop installation or Docker daemon (such as CI/CD runners), `switch/simulator/` provides a local in-memory mock WebSocket and HTTP server:
- Implements the Switch wire protocol endpoints:
  - `POST /agents` (registration)
  - `GET /agents/{id}/connection/ws` (WebSocket connection with `welcome`, `event`, and `gap` frames)
  - `POST /agents/{id}/ops/{operation}` (`post_message`, `send_targeted_message`, `read_context`)
- Used by unit tests 1–10 to verify protocol handling and schema logic deterministically without external dependencies.

# ContractSync Architecture & System Design

**Project**: ContractSync  
**Hackathon**: Flip the Switch 2026  
**Track**: Best Business Workflow  
**Tagline**: *One API contract. Two agents. Zero synchronization chaos.*

---

## 1. High-Level System Architecture

ContractSync orchestrates API contract governance and cross-stack synchronization between backend and frontend engineering domains. The coordination substrate is **Switch**, an open-source platform that enables autonomous AI agents to collaborate with human developers in shared communication rooms.

```mermaid
flowchart TB
    subgraph HumanLayer ["Human Engineering Team"]
        Dev["👤 Developer (@developer)"]
    end

    subgraph SwitchInfra ["Switch Room: #api-contract-room"]
        direction TB
        Log[("Append-Only Message Bus<br/>(Monotonic seq ordering)")]
        WsHub["Agent Bridge & WebSocket Hub<br/>(/agents/{agent_id}/connection/ws)"]
        OpsRouter["Operations API Router<br/>(post_message, send_targeted_message, read_context)"]
    end

    subgraph AgentLayer ["Autonomous Specialized Agents"]
        direction TB
        subgraph SpecArch ["Agent 1: SpecArchitect"]
            SA_Core["Backend API Guardian"]
            SA_Diff["Semantic Diff Engine"]
            SA_Gate["Human Approval Gate"]
            SA_Writer["OpenAPI 3.x Mutator"]
        end

        subgraph FESync ["Agent 2: FrontendSync"]
            FE_Core["Frontend Integration Engineer"]
            FE_Gen["TypeScript Codegen Engine"]
            FE_Mock["Mock Response Synchronizer"]
            FE_Compiler["Real tsc --noEmit Verifier"]
        end
    end

    subgraph WorkspaceLayer ["Project Workspace (demo-workspace)"]
        OAS["openapi.yaml (OpenAPI 3.0.3)"]
        TS_Types["src/api.types.ts"]
        TS_Mocks["src/mocks.ts"]
        TS_App["src/index.ts (Consumer)"]
    end

    %% Human interactions
    Dev -->|"1. Propose API change"| OpsRouter
    Dev -->|"3. Post explicit approval"| OpsRouter

    %% Switch Routing
    OpsRouter --> Log
    Log --> WsHub
    WsHub -->|"WebSocket Events"| SA_Core
    WsHub -->|"WebSocket Events"| FE_Core

    %% SpecArchitect actions
    SA_Core --> SA_Diff
    SA_Diff -->|"Read Current Spec"| OAS
    SA_Core -->|"2. Post Breaking Proposal"| OpsRouter
    SA_Gate -->|"Verify Approval"| SA_Core
    SA_Core -->|"4. Update Contract"| OAS
    SA_Core -->|"5. Hand off to @frontend-sync"| OpsRouter

    %% FrontendSync actions
    FE_Core -->|"6. Read Approved Spec"| OAS
    FE_Core -->|"Generate Types"| TS_Types
    FE_Core -->|"Update Fixtures"| TS_Mocks
    FE_Core -->|"Execute Compiler"| TS_App
    FE_Core -->|"7. Report Status & tsc Output"| OpsRouter
```

---

## 2. Agent Communication & Coordination Flow

In standard chatbot setups, agents are invoked via direct function calls or private API scripts. In ContractSync, **Switch is the mandatory communication infrastructure**:
- Every action, proposal, audit log, and handoff passes through the Switch Room log.
- Hand-offs between agents occur exclusively via mentions (`@frontend-sync`) or targeted Switch operations (`send_targeted_message`).
- The log is append-only, preserving an immutable trace of decisions.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (@developer)
    participant Switch as Switch Room (#api-contract-room)
    participant SA as SpecArchitect (@spec-architect)
    participant FS as FrontendSync (@frontend-sync)
    participant FSys as File System / Compiler

    Dev->>Switch: Post change request: "Update GET /api/spots. Rename spot_status..."
    Switch-->>SA: WebSocket event (msg #1, addressed)
    Note over SA: Analyzes openapi.yaml.<br/>Flags breaking change.<br/>Locks contract modification.
    SA->>Switch: Post proposal + [HUMAN APPROVAL REQUIRED] (msg #2)
    Switch-->>Dev: Broadcast proposal to developer
    
    Note over Dev: Developer reviews migration impact
    Dev->>Switch: Post approval: "APPROVE: Introduce availability_state, retain spot_status..." (msg #3)
    Switch-->>SA: WebSocket event (msg #3)
    
    Note over SA: Validates approval syntax & terms.<br/>Audits message seq.<br/>Updates openapi.yaml to v1.1.0.
    SA->>FSys: Write updated demo-workspace/openapi.yaml
    SA->>Switch: Post [CONTRACT APPROVED] + Hand off to @frontend-sync (msg #4)
    Switch-->>FS: WebSocket event (msg #4, addressed)
    
    Note over FS: Ingests approved schema v1.1.0.<br/>Generates TypeScript types.<br/>Synchronizes mock fixtures.
    FS->>FSys: Write demo-workspace/src/api.types.ts
    FS->>FSys: Write demo-workspace/src/mocks.ts
    FS->>FSys: Execute `npx tsc --noEmit`
    FSys-->>FS: Compiler result: 0 errors (Exit code 0)
    
    FS->>Switch: Post [FRONTEND SYNCHRONIZATION COMPLETE] + [TYPE CHECK PASSED] (msg #5)
    Switch-->>Dev: Final verification visible in room
```

---

## 3. Human Approval Gate State Machine

ContractSync enforces strict human governance over API breaking changes. No agent can unilaterally alter contract files without validated human consent.

```mermaid
stateDiagram-v2
    [*] --> Idle: Room Initialized

    state Idle {
        [*] --> Listening
        Listening --> ChangeDetected: Message matches "update GET /..."
    }

    state ChangeDetected {
        [*] --> ReadCurrentSpec
        ReadCurrentSpec --> DiffAnalysis
        DiffAnalysis --> ClassifyRisk
        ClassifyRisk --> EmitProposal
    }

    ChangeDetected --> AwaitingHumanApproval: Post [HUMAN APPROVAL REQUIRED]
    
    state AwaitingHumanApproval {
        [*] --> BlockModifications: Spec file write lock active
        BlockModifications --> ReviewMessage: Incoming message in room
        ReviewMessage --> ValidateSyntax: Starts with "APPROVE:"?
        ValidateSyntax --> CheckMitigation: Validates backward compat terms
        CheckMitigation --> ApprovalGranted: Syntax & mitigation valid
        CheckMitigation --> RequestClarification: Missing mitigation parameters
        ReviewMessage --> ProposalRejected: Starts with "REJECT:"
    }

    RequestClarification --> AwaitingHumanApproval: Post warning in room
    ProposalRejected --> Idle: Contract remains untouched
    ApprovalGranted --> ContractCommitted: Update openapi.yaml to v1.1.0

    state ContractCommitted {
        [*] --> RecordAuditTrail
        RecordAuditTrail --> DispatchHandoff: Send targeted msg to @frontend-sync
    }

    ContractCommitted --> FrontendSyncing: Handoff delivered

    state FrontendSyncing {
        [*] --> GenerateTypes
        GenerateTypes --> UpdateMocks
        UpdateMocks --> RunCompiler
        RunCompiler --> VerifyExitCode
    }

    FrontendSyncing --> VerificationComplete: Compiler exit code 0
    FrontendSyncing --> VerificationFailed: Compiler exit code != 0

    VerificationComplete --> Idle: Post [TYPE CHECK PASSED]
    VerificationFailed --> Idle: Post [TYPE CHECK FAILED]
```

---

## 4. Data Flow & Artifact Lifecycle

```mermaid
flowchart LR
    subgraph Inputs ["Input API Definition"]
        OAS_Orig["openapi.yaml (v1.0.0)<br/>spot_status: string (required)"]
    end

    subgraph DiffTransform ["Semantic Diff & Migration"]
        Analyzer["SpecArchitect Diff Engine"]
        ApprovedOAS["openapi.yaml (v1.1.0)<br/>availability_state: string (req)<br/>role: enum (admin|user|guest)<br/>spot_status: string (deprecated, opt)"]
    end

    subgraph SyncedArtifacts ["Generated Frontend Artifacts"]
        Types["src/api.types.ts<br/>Spot interface<br/>SpotRole union type<br/>@deprecated JSDoc"]
        Mocks["src/mocks.ts<br/>mockSpotResponse<br/>getMockSpots()"]
    end

    subgraph QualityGate ["Verification"]
        TSC["TypeScript Compiler<br/>(tsc --noEmit)"]
        Result["Exit Code: 0<br/>Zero Type Errors"]
    end

    OAS_Orig --> Analyzer
    Analyzer --> ApprovedOAS
    ApprovedOAS --> Types
    ApprovedOAS --> Mocks
    Types --> TSC
    Mocks --> TSC
    TSC --> Result
```

---

## 5. Security & Isolation Boundaries

1. **Agent Identity Isolation**:
   - Each agent registers independently and receives a unique bearer token (`api_key`).
   - Requests to the Switch bridge must present `Authorization: Bearer <token>`.
   - Agents cannot impersonate each other in the room log.

2. **File System Sandboxing**:
   - `SpecArchitect` has write permissions exclusively on OpenAPI specification files in the target directory (`demo-workspace/openapi.yaml`).
   - `FrontendSync` has write permissions exclusively on generated TypeScript artifacts (`demo-workspace/src/api.types.ts` and `demo-workspace/src/mocks.ts`).
   - Neither agent modifies files outside the designated workspace.

3. **No Credential Exposure**:
   - Secrets and environment variables (`SWITCH_SERVER_URL`, `SWITCH_API_KEY`) are managed strictly through environment variables.
   - No hardcoded keys or tokens are stored in source code or Git history.

4. **Immutable Audit Trail**:
   - Switch's append-only room log records every modification request, proposal, human approval token, and verification result with monotonic sequence numbering and ISO timestamps.

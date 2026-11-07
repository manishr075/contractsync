# Switch Room Instructions: #api-contract-room

## Purpose
`#api-contract-room` is the dedicated Switch coordination channel for API contract governance, breaking change analysis, human authorization gates, and automated frontend synchronization.

## Channel Participants
- **Human Developer (`@developer`)**: Initiates API change requests, reviews impact analysis, authorizes or modifies migration strategies.
- **SpecArchitect (`@spec-architect`)**: Backend API Guardian. Maintains `demo-workspace/openapi.yaml`, performs contract diff analysis, flags breaking changes, designs backward-compatibility migration strategies, and enforces the human approval gate.
- **FrontendSync (`@frontend-sync`)**: Frontend Integration Engineer. Consumes approved contract events, synchronizes TypeScript definitions (`src/api.types.ts`) and mock data (`src/mocks.ts`), executes compiler verification (`tsc --noEmit`), and reports status.

## Workflow Rules & Guidelines

1. **Human Request Ingestion**:
   - Any API schema change request posted by the developer triggers an immediate review by `@spec-architect`.
   - `@spec-architect` must NOT edit `openapi.yaml` at this stage.

2. **Impact & Risk Analysis**:
   - `@spec-architect` reads the active OpenAPI specification.
   - Detects all additions, modifications, renames, and deletions.
   - Evaluates whether changes break existing consumers.
   - Formulates a migration proposal preserving backward compatibility where possible.
   - Emits a structured `[BREAKING CHANGE]` and `[HUMAN APPROVAL REQUIRED]` notice.

3. **Human Approval Gate**:
   - Contract modification is strictly forbidden until the developer posts an explicit `APPROVE:` message in this room.
   - If the developer rejects or amends the proposal, `@spec-architect` adjusts the proposal and waits for updated approval.

4. **Contract Commit & Switch Handoff**:
   - Upon receiving valid approval, `@spec-architect` updates `openapi.yaml`.
   - `@spec-architect` posts `[CONTRACT APPROVED]` and explicitly hands off the workflow to `@frontend-sync` via a Switch mention or targeted message.

5. **Frontend Synchronization & Verification**:
   - `@frontend-sync` reads the approved OpenAPI schema.
   - Regenerates TypeScript types (`src/api.types.ts`) ensuring deprecated fields and new enums are preserved.
   - Synchronizes mock data (`src/mocks.ts`) with realistic sample payloads satisfying the new types.
   - Executes `npx tsc --noEmit` and captures compiler output.
   - Posts `[TYPE CHECK PASSED]` or `[TYPE CHECK FAILED]` with a comprehensive status report in the room.

## Communication Labels
All room participants must use clear operational labels:
- `API CHANGE DETECTED`
- `BREAKING CHANGE`
- `HUMAN APPROVAL REQUIRED`
- `CONTRACT APPROVED`
- `FRONTEND SYNCHRONIZATION`
- `TYPE CHECK PASSED`
- `TYPE CHECK FAILED`

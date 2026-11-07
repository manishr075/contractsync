# ContractSync Live Demonstration Script

**Hackathon**: Flip the Switch 2026 — Track: Best Business Workflow  
**Scenario**: Safe OpenAPI Contract Evolution with Human-in-the-Loop Governance & Frontend Synchronization  
**Room**: `#api-contract-room`

---

## 1. Demonstration Overview

This script walks through the complete demonstration of **ContractSync**. You will witness:
1. A developer proposing a breaking change to an existing API endpoint (`GET /api/spots`).
2. **SpecArchitect** detecting the breaking change, protecting existing consumers, and proposing an backward-compatible migration strategy.
3. The **Human Approval Gate** halting any spec changes until explicitly authorized.
4. The developer authorizing the migration via an `APPROVE:` message in the Switch room.
5. **SpecArchitect** committing the changes to `openapi.yaml` and handing off to **FrontendSync** through Switch.
6. **FrontendSync** generating TypeScript types, synchronizing mock fixtures, and validating the frontend with `tsc --noEmit`.
7. Real-time compiler verification output displayed directly in the Switch room.

---

## 2. Step-by-Step Execution Sequence

### Prerequisites
Ensure dependencies are installed and you are in the workspace root:
```bash
# Terminal 1: Run the automated demo workflow
npm run demo
```
*(Or run individual components manually as described below)*

---

### Step 1: Initial State Inspection

#### File: `demo-workspace/openapi.yaml`
```yaml
openapi: 3.0.3
info:
  title: Spot Service API
  version: 1.0.0
paths:
  /api/spots:
    get:
      summary: Retrieve spots
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Spot'
components:
  schemas:
    Spot:
      type: object
      required:
        - id
        - name
        - spot_status
      properties:
        id:
          type: integer
          example: 101
        name:
          type: string
          example: Library
        spot_status:
          type: string
          example: available
```

---

### Step 2: Developer Initiates API Change Request

**Sender**: `@developer`  
**Message posted in `#api-contract-room`**:
```text
Update GET /api/spots. Rename spot_status to availability_state and add a role field with the values admin, user and guest.
```

---

### Step 3: SpecArchitect Analyzes & Demands Approval

**Sender**: `@spec-architect`  
**Expected Response in `#api-contract-room`**:
```markdown
### [API CHANGE DETECTED]
- **Target Endpoint**: `GET /api/spots`
- **Field Renames**: `spot_status` -> `availability_state`
- **Field Additions**: `role` (enum: [admin, user, guest])

### [BREAKING CHANGE DETECTED]
- **spot_status** (CRITICAL): Renaming 'spot_status' to 'availability_state' will immediately break frontend consumers expecting response.spot_status.

### [RECOMMENDED MIGRATION STRATEGY]
- Introduce `availability_state`, retain `spot_status` as an optional deprecated field for backward compatibility, and add the `role` enum with allowed values [admin, user, guest].

### [HUMAN APPROVAL REQUIRED]
SpecArchitect has paused contract modification. Awaiting explicit authorization from @developer in this Switch room.
Please reply with: `APPROVE: ...` to authorize or provide revised instructions.
```

> **Verification Point**: Inspect `demo-workspace/openapi.yaml`. Notice it is **UNMODIFIED**. SpecArchitect strictly enforces the human gate.

---

### Step 4: Developer Grants Human Approval

**Sender**: `@developer`  
**Message posted in `#api-contract-room`**:
```text
APPROVE: Introduce availability_state, retain spot_status as an optional deprecated field for backward compatibility, and add the role enum.
```

---

### Step 5: SpecArchitect Commits Contract & Hands Off

**Sender**: `@spec-architect`  
**Expected Response in `#api-contract-room`**:
```markdown
### [CONTRACT APPROVED]
- **Approved By**: @developer:switch-local
- **Sequence Recorded**: Message #3 at 2026-11-07T06:11:05.859Z
- **Updated File**: `demo-workspace/openapi.yaml` (v1.1.0)
- **Backward Compatibility**: Preserved. `spot_status` retained as optional deprecated string.
- **New Additions**: `availability_state` (string), `role` (enum: [admin, user, guest]).

**Handoff to @frontend-sync**: Official API contract v1.1.0 committed to Switch room. Please synchronize TypeScript types and mock data, then run compiler verification.
```

#### Updated File Check: `demo-workspace/openapi.yaml`
```yaml
    Spot:
      type: object
      required:
        - id
        - name
        - availability_state
      properties:
        id:
          type: integer
          example: 101
        name:
          type: string
          example: Library
        spot_status:
          type: string
          description: DEPRECATED: Use availability_state instead. Retained for backward compatibility.
          deprecated: true
          example: available
        availability_state:
          type: string
          description: Current operational availability state of the resource spot
          example: available
        role:
          type: string
          description: Access role associated with the spot
          enum:
            - admin
            - user
            - guest
          example: admin
```

---

### Step 6: FrontendSync Synchronizes & Runs Real Compiler

**Sender**: `@frontend-sync`  
**Intermediate Notification in `#api-contract-room`**:
```markdown
### [FRONTEND SYNCHRONIZATION STARTED]
- Triggered by: @spec-architect:switch-local
- Synchronizing TypeScript interfaces from `openapi.yaml`...
- Updating mock response fixtures...
```

**Final Report in `#api-contract-room`**:
```markdown
### [FRONTEND SYNCHRONIZATION COMPLETE]
### [TYPE CHECK PASSED]

#### 1. Contract Summary
- **API Specification**: `demo-workspace/openapi.yaml` (v1.1.0)
- **Approved Migration**: Introduced `availability_state`, preserved `spot_status` as deprecated, added `role` enum.

#### 2. Synchronized Artifacts
- `demo-workspace/src/api.types.ts`:
  * `availability_state: string` (required)
  * `role?: 'admin' | 'user' | 'guest'` (enum union)
  * `spot_status?: string` (marked `@deprecated` for backward compatibility)
- `demo-workspace/src/mocks.ts`:
  * Updated mock fixture with valid enum value `role: 'admin'`
  * Populated both `availability_state: 'available'` and `spot_status: 'available'`

#### 3. TypeScript Compiler Verification
- **Command**: `npx tsc --noEmit`
- **Result**: SUCCESS (Exit Code 0)
- **Compiler Output**:
```
TypeScript compilation passed with 0 errors.
```

#### 4. Operational Health & Compatibility
- **Existing Consumers**: Safe (legacy consumers of `spot_status` remain non-broken).
- **New Consumers**: Can immediately adopt `availability_state` and `role`.
- **Remaining Issues**: None. Contract and frontend code are 100% synchronized.
```

---

## 3. Suggested Screen Recording Sequence (For Hackathon Video)

1. **Title Card (0:00 - 0:15)**
   - Show project title: **ContractSync**
   - Tagline: *One API contract. Two agents. Zero synchronization chaos.*
   - Track: *Flip the Switch 2026 — Best Business Workflow*

2. **The Problem (0:15 - 0:45)**
   - Briefly show backend changing an API response in `openapi.yaml`.
   - Show the resulting broken frontend with TypeScript red squiggles and runtime errors.
   - Explain why this costs engineering teams hours of painful meetings and debugging.

3. **Switch as the Collaboration Medium (0:45 - 1:15)**
   - Introduce `#api-contract-room` on Switch.
   - Introduce `@spec-architect` (Backend API Guardian) and `@frontend-sync` (Frontend Integration Engineer).
   - Explain how Switch acts as the central event bus and human-in-the-loop governance infrastructure.

4. **Live Execution (1:15 - 2:30)**
   - Run `npm run demo` in the terminal.
   - Show the developer's message proposing the change.
   - Highlight **SpecArchitect's** detection of the breaking change and the explicit `[HUMAN APPROVAL REQUIRED]` gate.
   - Show that `openapi.yaml` remains protected and untouched.
   - Show the developer's `APPROVE:` reply.
   - Show **SpecArchitect** committing the contract and handing off to **FrontendSync** via Switch.
   - Show **FrontendSync** automatically generating TypeScript types, mock fixtures, and running `tsc --noEmit`.
   - Point out `[TYPE CHECK PASSED]` with real exit code 0.

5. **Test Suite Verification (2:30 - 2:50)**
   - Run `npm test`.
   - Show all 10 automated test suites passing (OpenAPI validity, field rename detection, enum detection, backward compatibility, type generation, mock data consistency, compiler verification, unapproved modification rejection, invalid approval handling, Switch wire protocol).

6. **Conclusion & Impact (2:50 - 3:00)**
   - Summary: Zero synchronization chaos, complete backward compatibility, 100% verified by TypeScript compiler, orchestrated end-to-end through Switch.

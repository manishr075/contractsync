# ContractSync Demonstration Script

**Hackathon**: Flip the Switch 2026 — Track: Best Business Workflow  
**Scenario**: Autonomous API Contract Governance with Human-in-the-Loop Gate & Frontend Synchronization  
**Messaging Channel**: `#api-contract-room` (Mattermost)  
**Agent Provider**: Google Antigravity CLI (`agy acp --stdio`)  

---

## 1. Demonstration Options

You can reproduce and observe the ContractSync workflow through two verified paths:

1. **Option 1: Genuine Google Antigravity ACP Workflow (CLI)**:
   Runs live Google Antigravity sessions (`agy acp --stdio`) for both `@spec-architect` and `@frontend-sync`, executing real LLM reasoning, human gate enforcement, negative testing, contract update, type generation, mock sync, and real TypeScript compiler verification (`npx tsc --noEmit`).
   ```bash
   npm run workflow:antigravity
   ```

2. **Option 2: Official Switch Console Desktop + Mattermost**:
   Runs inside the desktop Switch Console UI connected to Mattermost using `switch/template.yaml`.

3. **Option 3: Interactive Web Simulator (GitHub Pages)**:
   Judges can explore the interactive browser visualizer at [https://manishr075.github.io/contractsync/](https://manishr075.github.io/contractsync/).

---

## 2. End-to-End Walkthrough Sequence

### Step 1: Initial Contract State

The baseline contract `demo-workspace/openapi.yaml` defines the Spot resource at v1.0.0:

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

### Step 2: Developer Submits API Modification Request

In Mattermost `#api-contract-room`, a developer posts:

```text
Update GET /api/spots: rename spot_status to availability_state and add a role field with the values admin, user and guest.
```

---

### Step 3: SpecArchitect Analyzes & Enforces Human Approval Gate

Switch dispatches the request to the `@spec-architect` Antigravity ACP session. SpecArchitect detects the breaking rename, produces an impact analysis, and locks the contract:

```markdown
### [API CHANGE DETECTED — SPEARCHITECT ASSESSMENT]
- **Target Endpoint**: `GET /api/spots`
- **Field Renames**: `spot_status` -> `availability_state`
- **Field Additions**: `role` (enum: [admin, user, guest])

### [BREAKING CHANGE DETECTED]
- **spot_status** (CRITICAL): Renaming 'spot_status' to 'availability_state' will immediately break frontend consumers expecting response.spot_status.

### [ANTIGRAVITY ACP REASONING & CONSUMER IMPACT]
Renaming 'spot_status' to 'availability_state' is a hard-breaking contract violation. Any frontend, mobile, or third-party client currently parsing response.spot_status will receive undefined/null upon deployment. This will immediately cause client-side rendering exceptions or broken UI states for unmigrated consumers.

### [RECOMMENDED MIGRATION STRATEGY]
- Introduce `availability_state`, retain `spot_status` as an optional deprecated field for backward compatibility, and add the `role` enum with allowed values [admin, user, guest].

### [HUMAN APPROVAL REQUIRED]
SpecArchitect has locked the contract. No file modifications will occur until explicit human approval is granted in this Switch room.
To approve, reply with: `APPROVE: rename <old> to <new> retaining <old> as optional deprecated and adding role enum`
```

**Verification Check**: At this moment, `demo-workspace/openapi.yaml` remains completely untouched.

---

### Step 4: Negative Testing — Rejection of Invalid & Incomplete Approvals

#### Scenario A: Vague Approval
Developer posts:
```text
Looks great, proceed with the update!
```
SpecArchitect responds in Mattermost:
```markdown
### [APPROVAL REJECTED / INCOMPLETE]
- **Reason**: Message does not start with APPROVE: or APPROVED:
Contract update aborted. File `demo-workspace/openapi.yaml` remains completely unchanged.
```

#### Scenario B: Incomplete Approval Lacking Deprecation Terms
Developer posts:
```text
APPROVE: rename spot_status to availability_state
```
SpecArchitect responds in Mattermost:
```markdown
### [APPROVAL REJECTED / INCOMPLETE]
- **Reason**: Approval message missing explicit mitigation parameters (availability_state, deprecated spot_status, or role enum).
Contract update aborted. File `demo-workspace/openapi.yaml` remains completely unchanged.
```

---

### Step 5: Compliant Human Approval & Contract Commit

Developer posts the compliant approval command:
```text
APPROVE: rename spot_status to availability_state retaining spot_status as optional deprecated and adding role enum
```

SpecArchitect validates the mitigation terms, updates `demo-workspace/openapi.yaml` to v1.1.0, and posts:

```markdown
### [CONTRACT APPROVED & COMMITTED]
- **Approved By**: @developer
- **Updated Specification**: `demo-workspace/openapi.yaml` (v1.1.0)
- **Backward Compatibility**: Preserved. `spot_status` retained as optional deprecated string.
- **New Additions**: `availability_state` (string), `role` (enum: [admin, user, guest]).

**Handoff to @frontend-sync**: Official API contract v1.1.0 is committed in Switch room. Please synchronize TypeScript types and mock data, then run compiler verification.
```

---

### Step 6: FrontendSync Synchronizes Types & Mocks

FrontendSync receives the handoff notification through Switch, inspects the updated contract, and executes:

1. **Regenerates `demo-workspace/src/api.types.ts`**:
   - Maps `availability_state: string` (required).
   - Generates union type `export type SpotRole = 'admin' | 'user' | 'guest';`.
   - Retains `spot_status?: string` annotated with `@deprecated`.
2. **Synchronizes `demo-workspace/src/mocks.ts`**:
   - Updates mock fixture with valid enum value `role: 'admin'`.
   - Populates both `availability_state: 'available'` and `spot_status: 'available'`.

---

### Step 7: Real Compiler Verification & Report

FrontendSync executes `npx tsc --noEmit` inside `demo-workspace` and posts the live compiler verification report to `#api-contract-room`:

```markdown
### [FRONTEND SYNCHRONIZATION COMPLETE]
### [TYPE CHECK PASSED]

#### 1. Contract Summary
- **API Specification**: `demo-workspace/openapi.yaml` (v1.1.0)
- **Migration Applied**: Added `availability_state`, preserved `spot_status` (deprecated), added `role` enum.

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

#### 4. Antigravity ACP Agent Summary
Frontend synchronization verified successfully with real TypeScript compiler (tsc --noEmit).
```

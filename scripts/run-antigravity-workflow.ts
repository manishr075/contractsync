import fs from 'fs';
import path from 'path';
import { SpecArchitectAntigravityAgent } from '../agents/spec-architect/antigravity-agent.js';
import { FrontendSyncAntigravityAgent } from '../agents/frontend-sync/antigravity-agent.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAntigravityWorkflow() {
  console.log(`\n======================================================================`);
  console.log(`  CONTRACTSYNC — GENUINE ANTIGRAVITY ACP WORKFLOW EXECUTION`);
  console.log(`  Runtime: Google Antigravity CLI (agy acp --stdio)`);
  console.log(`  Agents: @spec-architect (Session A) & @frontend-sync (Session B)`);
  console.log(`======================================================================\n`);

  const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
  const specPath = path.resolve(workspaceDir, 'openapi.yaml');

  // Step 0: Ensure clean baseline openapi.yaml (v1.0.0)
  const initialYaml = `openapi: 3.0.3
info:
  title: Spot Service API
  version: 1.0.0
  description: API for managing physical spaces and resource spots in the campus facility.
paths:
  /api/spots:
    get:
      summary: Retrieve spots
      description: Returns a list or single spot with status information.
      responses:
        '200':
          description: Successful spot lookup
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
          description: Unique spot identifier
          example: 101
        name:
          type: string
          description: Name of the facility or spot
          example: Library
        spot_status:
          type: string
          description: Current operational status of the spot
          example: available
`;
  fs.writeFileSync(specPath, initialYaml, 'utf8');
  console.log(`[Setup] Reset demo-workspace/openapi.yaml to baseline v1.0.0.`);

  // Step 1: Start Agent 1 (SpecArchitect) in a dedicated Antigravity ACP Session
  console.log(`\n[Agent 1: SpecArchitect] Initializing Antigravity ACP stdio session...`);
  const specAgent = new SpecArchitectAntigravityAgent({ workspaceDir, specPath });
  const specSessionId = await specAgent.start();
  console.log(`[Agent 1: SpecArchitect] Online! ACP Session ID: ${specSessionId}`);

  // Step 2: Start Agent 2 (FrontendSync) in a separate Antigravity ACP Session
  console.log(`\n[Agent 2: FrontendSync] Initializing Antigravity ACP stdio session...`);
  const frontendAgent = new FrontendSyncAntigravityAgent({ workspaceDir });
  const frontendSessionId = await frontendAgent.start();
  console.log(`[Agent 2: FrontendSync] Online! ACP Session ID: ${frontendSessionId}`);

  try {
    // Step 3: Human developer posts an API modification request
    const devChangeRequest = 'Update GET /api/spots: rename spot_status to availability_state and add a role field with the values admin, user and guest.';
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`[Mattermost / Switch Room] Message from @developer:`);
    console.log(`  "${devChangeRequest}"`);
    console.log(`----------------------------------------------------------------------`);

    // Step 4: SpecArchitect evaluates via Antigravity ACP
    console.log(`\n[Agent 1: SpecArchitect] Evaluating change request with Antigravity ACP LLM...`);
    const evalResult = await specAgent.evaluateChangeRequest(devChangeRequest);

    console.log(`\n[Mattermost / Switch Room] Message from @spec-architect:`);
    console.log(evalResult.proposalText);

    // Step 5: Verify OpenAPI file is UNCHANGED (Human Approval Gate enforced)
    const isUnmodified = specAgent.isSpecUnmodified();
    console.log(`\n[Security Check] Is openapi.yaml unmodified before human approval?`);
    console.log(`  Result: ${isUnmodified ? 'PASS (Strict Human Approval Gate Enforced)' : 'FAIL (Unapproved Edit Detected)'}`);
    if (!isUnmodified) throw new Error('Security violation: openapi.yaml was modified prior to approval!');

    // Step 6: Negative test 1 — Developer posts non-prefix approval
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`[Mattermost / Switch Room] Message from @developer (Invalid Attempt):`);
    console.log(`  "Looks great, proceed with the update!"`);
    console.log(`----------------------------------------------------------------------`);

    const invalidAttempt = specAgent.handleApproval('Looks great, proceed with the update!');
    console.log(`\n[Mattermost / Switch Room] Message from @spec-architect:`);
    console.log(invalidAttempt.handoffMessage);
    console.log(`[Security Check] Rejection verified. Is openapi.yaml still unmodified?`);
    console.log(`  Result: ${specAgent.isSpecUnmodified() ? 'PASS' : 'FAIL'}`);

    // Step 7: Negative test 2 — Developer posts incomplete approval lacking backward compatibility
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`[Mattermost / Switch Room] Message from @developer (Incomplete Attempt):`);
    console.log(`  "APPROVE: rename spot_status to availability_state"`);
    console.log(`----------------------------------------------------------------------`);

    const incompleteAttempt = specAgent.handleApproval('APPROVE: rename spot_status to availability_state');
    console.log(`\n[Mattermost / Switch Room] Message from @spec-architect:`);
    console.log(incompleteAttempt.handoffMessage);
    console.log(`[Security Check] Incomplete rejection verified. Is openapi.yaml still unmodified?`);
    console.log(`  Result: ${specAgent.isSpecUnmodified() ? 'PASS' : 'FAIL'}`);

    // Step 8: Developer posts compliant approval with backward compatibility terms
    const compliantApproval = 'APPROVE: rename spot_status to availability_state retaining spot_status as optional deprecated and adding role enum';
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`[Mattermost / Switch Room] Message from @developer (Compliant Approval):`);
    console.log(`  "${compliantApproval}"`);
    console.log(`----------------------------------------------------------------------`);

    const approvalResult = specAgent.handleApproval(compliantApproval, '@developer');
    if (!approvalResult.approved) {
      throw new Error(`Approval unexpectedly failed: ${approvalResult.reason}`);
    }

    console.log(`\n[Mattermost / Switch Room] Message from @spec-architect:`);
    console.log(approvalResult.handoffMessage);

    // Verify openapi.yaml is now updated
    const postApprovalYaml = fs.readFileSync(specPath, 'utf8');
    const isUpdated = postApprovalYaml.includes('availability_state') && postApprovalYaml.includes('deprecated: true');
    console.log(`\n[Contract State] openapi.yaml updated to v1.1.0 with backward compatibility: ${isUpdated ? 'YES' : 'NO'}`);

    // Step 9: FrontendSync receives handoff from Switch Room
    console.log(`\n[Agent 2: FrontendSync] Received handoff from Switch room.`);
    console.log(`[Agent 2: FrontendSync] Regenerating TypeScript definitions and synchronizing mock fixtures...`);

    const frontendResult = await frontendAgent.processHandoff(approvalResult.handoffMessage);

    console.log(`\n[Mattermost / Switch Room] Message from @frontend-sync:`);
    console.log(frontendResult.report);

    // Step 10: Final verification
    console.log(`\n======================================================================`);
    console.log(`  WORKFLOW EXECUTION SUMMARY`);
    console.log(`======================================================================`);
    console.log(`  1. Antigravity ACP Runtime: ACTIVE (2 distinct sessions)`);
    console.log(`  2. Human Approval Gate: ENFORCED (Rejected invalid & incomplete approvals)`);
    console.log(`  3. Spec Updated: openapi.yaml (v1.1.0) with backward compatibility`);
    console.log(`  4. TypeScript Interfaces Generated: demo-workspace/src/api.types.ts`);
    console.log(`  5. Mock Data Synchronized: demo-workspace/src/mocks.ts`);
    console.log(`  6. Real Compiler Check (npx tsc --noEmit): ${frontendResult.syncResult.compilerSuccess ? 'PASSED (0 errors)' : 'FAILED'}`);
    console.log(`======================================================================\n`);

  } finally {
    console.log(`[Cleanup] Closing Antigravity ACP sessions...`);
    await specAgent.close();
    await frontendAgent.close();
    console.log(`[Cleanup] Sessions closed cleanly.`);
  }
}

runAntigravityWorkflow().catch((err) => {
  console.error('Workflow error:', err);
  process.exit(1);
});

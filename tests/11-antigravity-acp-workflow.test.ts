import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { SpecArchitectAntigravityAgent } from '../agents/spec-architect/antigravity-agent.js';
import { FrontendSyncAntigravityAgent } from '../agents/frontend-sync/antigravity-agent.js';

export async function testAntigravityAcpWorkflow() {
  console.log(`\n▶ [Test 11] Genuine Antigravity ACP Integration & Human-in-the-Loop Gate`);

  const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
  const specPath = path.resolve(workspaceDir, 'openapi.yaml');

  // Reset spec to baseline v1.0.0
  const baselineYaml = `openapi: 3.0.3
info:
  title: Spot Service API
  version: 1.0.0
paths:
  /api/spots:
    get:
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
        name:
          type: string
        spot_status:
          type: string
`;
  fs.writeFileSync(specPath, baselineYaml, 'utf8');

  // 1. Initialize two independent Antigravity ACP sessions
  const specAgent = new SpecArchitectAntigravityAgent({ workspaceDir, specPath });
  const frontendAgent = new FrontendSyncAntigravityAgent({ workspaceDir });

  const specSessionId = await specAgent.start();
  const frontendSessionId = await frontendAgent.start();

  assert.ok(specSessionId, 'SpecArchitect must establish a valid ACP session');
  assert.ok(frontendSessionId, 'FrontendSync must establish a valid ACP session');
  assert.notStrictEqual(specSessionId, frontendSessionId, 'Agents must run in separate Antigravity sessions');

  try {
    // 2. Evaluate API modification request
    const changeReq = 'Update GET /api/spots: rename spot_status to availability_state and add a role field with the values admin, user and guest.';
    const evalRes = await specAgent.evaluateChangeRequest(changeReq);

    assert.strictEqual(evalRes.analysis.breakingChanges.length, 1);
    assert.strictEqual(evalRes.analysis.breakingChanges[0].field, 'spot_status');
    assert.ok(evalRes.proposalText.includes('[BREAKING CHANGE DETECTED]'));

    // 3. Verify openapi.yaml is untouched
    assert.strictEqual(specAgent.isSpecUnmodified(), true, 'openapi.yaml MUST NOT be modified before approval');

    // 4. Test invalid and incomplete approvals
    const invalidAttempt = specAgent.handleApproval('LGTM proceed!');
    assert.strictEqual(invalidAttempt.approved, false, 'Non-prefix approval must be rejected');
    assert.strictEqual(specAgent.isSpecUnmodified(), true);

    const incompleteAttempt = specAgent.handleApproval('APPROVE: rename spot_status to availability_state');
    assert.strictEqual(incompleteAttempt.approved, false, 'Approval missing backward compatibility must be rejected');
    assert.strictEqual(specAgent.isSpecUnmodified(), true);

    // 5. Test compliant approval
    const compliantApproval = 'APPROVE: rename spot_status to availability_state retaining spot_status as optional deprecated and adding role enum';
    const approved = specAgent.handleApproval(compliantApproval, '@developer');
    assert.strictEqual(approved.approved, true);

    // Verify openapi.yaml was updated
    const updatedYaml = fs.readFileSync(specPath, 'utf8');
    assert.ok(updatedYaml.includes('availability_state'), 'openapi.yaml must contain availability_state');
    assert.ok(updatedYaml.includes('deprecated: true'), 'openapi.yaml must preserve deprecated spot_status');

    // 6. Test FrontendSync handoff processing & compiler verification
    const frontendResult = await frontendAgent.processHandoff(approved.handoffMessage);
    assert.strictEqual(frontendResult.syncResult.compilerSuccess, true, 'TypeScript compiler must exit 0');
    assert.ok(fs.existsSync(frontendResult.syncResult.typesPath));
    assert.ok(fs.existsSync(frontendResult.syncResult.mocksPath));

    console.log(`  ✓ Genuine Antigravity ACP sessions verified (agy acp stdio).`);
    console.log(`  ✓ Human Approval Gate verified (rejection of unapproved & incomplete modifications).`);
    console.log(`  ✓ Contract migration & handoff successfully processed.`);
    console.log(`  ✓ Frontend synchronization & compiler verification (tsc --noEmit) passed with 0 errors.`);
  } finally {
    await specAgent.close();
    await frontendAgent.close();
  }
}

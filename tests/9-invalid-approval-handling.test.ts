import assert from 'assert';
import path from 'path';
import { ContractAnalyzer } from '../agents/spec-architect/analyzer.js';

export async function testInvalidApprovalHandling() {
  console.log(`\n▶ [Test 9] Handling Invalid or Incomplete Approval Instructions`);

  const specPath = path.resolve(process.cwd(), 'demo-workspace/openapi.yaml');
  const analyzer = new ContractAnalyzer(specPath);

  // 1. Missing APPROVE: prefix
  const res1 = analyzer.validateApproval('Sure, go ahead and make the changes');
  assert.strictEqual(res1.valid, false, 'Should reject message lacking APPROVE: prefix');
  assert.ok(res1.reason?.includes('APPROVE:'), 'Reason must mention missing prefix');

  // 2. Incomplete approval missing backward compatibility instruction
  const res2 = analyzer.validateApproval('APPROVE: rename spot_status to availability_state');
  assert.strictEqual(res2.valid, false, 'Should reject approval missing backward compatibility mitigation');
  assert.ok(res2.reason?.includes('missing explicit mitigation'), 'Reason must note missing mitigation parameters');

  // 3. Valid full approval
  const res3 = analyzer.validateApproval(
    'APPROVE: Introduce availability_state, retain spot_status as an optional deprecated field for backward compatibility, and add the role enum.'
  );
  assert.strictEqual(res3.valid, true, 'Should accept complete, well-formed approval');

  console.log(`  ✓ Successfully rejected non-prefix approvals.`);
  console.log(`  ✓ Successfully rejected incomplete approvals lacking backward compatibility.`);
  console.log(`  ✓ Successfully accepted compliant approval command.`);
}

import assert from 'assert';
import path from 'path';
import { ContractAnalyzer } from '../agents/spec-architect/analyzer.js';

export async function testFieldRenameDetection() {
  console.log(`\n▶ [Test 2] Detection of Renamed Field as Breaking Change`);

  const specPath = path.resolve(process.cwd(), 'demo-workspace/openapi.yaml');
  const analyzer = new ContractAnalyzer(specPath);

  const request =
    'Update GET /api/spots. Rename spot_status to availability_state and add a role field with the values admin, user and guest.';

  const analysis = analyzer.analyzeChangeRequest(request);

  // Assert renamed field detected
  assert.strictEqual(analysis.proposedChanges.renamedFields.length, 1, 'Should detect exactly 1 field rename');
  assert.strictEqual(analysis.proposedChanges.renamedFields[0].from, 'spot_status');
  assert.strictEqual(analysis.proposedChanges.renamedFields[0].to, 'availability_state');

  // Assert classified as breaking change
  const breaking = analysis.breakingChanges.find((b) => b.field === 'spot_status');
  assert.ok(breaking, 'Renaming spot_status must be flagged in breakingChanges list');
  assert.strictEqual(breaking.severity, 'CRITICAL', 'Renaming required field must have CRITICAL severity');
  assert.ok(breaking.reason.includes('break frontend consumers'), 'Must explain client consumer impact');

  console.log(`  ✓ Field rename 'spot_status' -> 'availability_state' correctly identified.`);
  console.log(`  ✓ Flagged as CRITICAL breaking change with consumer impact explanation.`);
}

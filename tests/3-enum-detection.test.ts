import assert from 'assert';
import path from 'path';
import { ContractAnalyzer } from '../agents/spec-architect/analyzer.js';

export async function testEnumDetection() {
  console.log(`\n▶ [Test 3] Detection of Newly Introduced Enum`);

  const specPath = path.resolve(process.cwd(), 'demo-workspace/openapi.yaml');
  const analyzer = new ContractAnalyzer(specPath);

  const request =
    'Update GET /api/spots. Rename spot_status to availability_state and add a role field with the values admin, user and guest.';

  const analysis = analyzer.analyzeChangeRequest(request);

  // Assert added fields contains role with enum
  const roleField = analysis.proposedChanges.addedFields.find((f) => f.name === 'role');
  assert.ok(roleField, "Added fields must include 'role'");
  assert.strictEqual(roleField.type, 'string');
  assert.deepStrictEqual(roleField.enum, ['admin', 'user', 'guest'], "Enum values must match ['admin', 'user', 'guest']");

  console.log(`  ✓ New field 'role' detected.`);
  console.log(`  ✓ Allowed enum values correctly extracted: [${roleField.enum.join(', ')}].`);
}

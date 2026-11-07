import assert from 'assert';
import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import { ContractAnalyzer } from '../agents/spec-architect/analyzer.js';

export async function testBackwardCompatibility() {
  console.log(`\n▶ [Test 4] Preservation of Deprecated Compatibility Field`);

  const specPath = path.resolve(process.cwd(), 'demo-workspace/openapi.yaml');
  const analyzer = new ContractAnalyzer(specPath);

  // Apply approved changes
  const updatedSpec = analyzer.applyApprovedChanges();
  const spotSchema = updatedSpec.components.schemas.Spot;

  // 1. spot_status must remain in properties
  assert.ok(spotSchema.properties.spot_status, 'spot_status must remain in schema properties');

  // 2. spot_status must be flagged deprecated
  assert.strictEqual(spotSchema.properties.spot_status.deprecated, true, 'spot_status must have deprecated: true');

  // 3. spot_status must NOT be in required list (optional for new callers)
  assert.ok(!spotSchema.required.includes('spot_status'), 'spot_status must be optional (not in required array)');

  // 4. availability_state must be in required list
  assert.ok(spotSchema.required.includes('availability_state'), 'availability_state must be required');

  console.log(`  ✓ 'spot_status' is preserved with deprecated: true.`);
  console.log(`  ✓ 'spot_status' is optional while 'availability_state' is required.`);
  console.log(`  ✓ Backward compatibility maintained for legacy clients.`);
}

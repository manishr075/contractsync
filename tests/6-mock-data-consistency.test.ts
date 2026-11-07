import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { FrontendSyncEngine } from '../agents/frontend-sync/sync-engine.js';

export async function testMockDataConsistency() {
  console.log(`\n▶ [Test 6] Mock Data Consistency`);

  const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
  const engine = new FrontendSyncEngine(workspaceDir);

  const mockCode = engine.updateMocks();

  assert.ok(fs.existsSync(engine.mocksPath), 'Mocks file must exist');

  // Verify mock fixture has new fields
  assert.ok(mockCode.includes("availability_state: 'available'"), "Must populate availability_state in mock");
  assert.ok(mockCode.includes("role: 'admin'"), "Must populate valid enum value 'admin' for role in mock");
  assert.ok(mockCode.includes("spot_status: 'available'"), "Must retain spot_status in mock for legacy consumers");

  console.log(`  ✓ Mock fixtures synchronized with valid contract values.`);
  console.log(`  ✓ Both new 'availability_state' and legacy 'spot_status' present in mock data.`);
}

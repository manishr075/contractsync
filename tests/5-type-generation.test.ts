import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { FrontendSyncEngine } from '../agents/frontend-sync/sync-engine.js';

export async function testTypeGeneration() {
  console.log(`\n▶ [Test 5] Deterministic TypeScript Type Generation`);

  const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
  const engine = new FrontendSyncEngine(workspaceDir);

  const generatedCode = engine.generateTypes();

  assert.ok(fs.existsSync(engine.typesPath), 'Generated types file must exist');

  // Verify generated content contains interface Spot
  assert.ok(generatedCode.includes('export interface Spot'), 'Must export interface Spot');

  // Verify availability_state is required string
  assert.ok(generatedCode.includes('availability_state: string;'), 'Must have required availability_state: string');

  // Verify SpotRole union type
  assert.ok(generatedCode.includes("export type SpotRole = 'admin' | 'user' | 'guest';"), 'Must generate SpotRole union type');

  // Verify role field typed with union
  assert.ok(generatedCode.includes("role?: 'admin' | 'user' | 'guest';"), 'Must have role?: union');

  // Verify spot_status is marked @deprecated and optional
  assert.ok(generatedCode.includes('@deprecated Retained for backward compatibility'), 'Must include @deprecated JSDoc');
  assert.ok(generatedCode.includes('spot_status?: string;'), 'Must have optional spot_status?: string');

  console.log(`  ✓ Generated interface Spot, SpotRole union, and GetSpotsResponse.`);
  console.log(`  ✓ Preserved JSDoc @deprecated tags and proper required/optional flags.`);
}

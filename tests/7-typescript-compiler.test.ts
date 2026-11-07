import assert from 'assert';
import path from 'path';
import { FrontendSyncEngine } from '../agents/frontend-sync/sync-engine.js';

export async function testTypeScriptCompilation() {
  console.log(`\n▶ [Test 7] TypeScript Compilation Verification (npx tsc --noEmit)`);

  const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
  const engine = new FrontendSyncEngine(workspaceDir);

  // Synchronize first
  engine.generateTypes();
  engine.updateMocks();

  // Run real compiler
  const res = engine.runCompiler();

  console.log(`  Compiler execution output:`);
  console.log(`  ${res.output}`);

  assert.strictEqual(res.success, true, `TypeScript compilation failed: ${res.output}`);

  console.log(`  ✓ Real TypeScript compiler (tsc --noEmit) exited with code 0.`);
  console.log(`  ✓ Zero type errors detected across generated types, mocks, and consumer code.`);
}

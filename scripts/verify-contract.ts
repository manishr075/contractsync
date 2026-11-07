import path from 'path';
import { FrontendSyncEngine } from '../agents/frontend-sync/sync-engine.js';

const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
const engine = new FrontendSyncEngine(workspaceDir);

console.log(`[ContractSync] Running TypeScript compiler verification on ${workspaceDir}...`);
const res = engine.runCompiler();

if (res.success) {
  console.log(`[TYPE CHECK PASSED] Real compiler exit code: 0`);
  console.log(`Compiler Output: ${res.output}`);
  process.exit(0);
} else {
  console.error(`[TYPE CHECK FAILED] Compiler errors detected:`);
  console.error(res.output);
  process.exit(1);
}

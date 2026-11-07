import path from 'path';
import { FrontendSyncEngine } from '../agents/frontend-sync/sync-engine.js';

const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
const engine = new FrontendSyncEngine(workspaceDir);

console.log(`[ContractSync] Generating TypeScript types from ${engine.specPath}...`);
const generated = engine.generateTypes();
console.log(`[ContractSync] Generated ${generated.split('\n').length} lines in ${engine.typesPath}`);
console.log(`[ContractSync] Synchronizing mock data in ${engine.mocksPath}...`);
engine.updateMocks();
console.log(`[ContractSync] Generation complete.`);

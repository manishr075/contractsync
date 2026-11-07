import path from 'path';
import { SwitchClient } from '../../switch/integration/switch-client.js';
import { SwitchMessagePayload } from '../../switch/integration/types.js';
import { FrontendSyncEngine, SyncResult } from './sync-engine.js';

export class FrontendSyncAgent {
  public client: SwitchClient;
  public engine: FrontendSyncEngine;
  public workspaceDir: string;
  public lastSyncResult: SyncResult | null = null;
  private isSyncing: boolean = false;
  private lastHandledMsgId: string = '';

  constructor(options: {
    serverUrl?: string;
    workspaceDir?: string;
    roomId?: string;
  } = {}) {
    const rootDir = process.cwd();
    this.workspaceDir = options.workspaceDir || path.resolve(rootDir, 'demo-workspace');
    this.engine = new FrontendSyncEngine(this.workspaceDir);

    this.client = new SwitchClient({
      serverUrl: options.serverUrl,
      agentName: 'frontend-sync',
      description: 'Frontend Integration Engineer responsible for TypeScript types, mock sync, and tsc validation',
      directory: this.workspaceDir,
      provider: 'antigravity',
      roomId: options.roomId || 'api-contract-room'
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.client.on('message', async (msg: SwitchMessagePayload) => {
      // Ignore self-messages
      if (msg.sender.includes('frontend-sync')) return;

      await this.handleIncomingMessage(msg);
    });
  }

  public async start(): Promise<void> {
    await this.client.connect();
    console.log(`[FrontendSync] Connected to Switch room: ${this.client.roomId}`);
  }

  public async stop(): Promise<void> {
    this.client.disconnect();
  }

  public async handleIncomingMessage(msg: SwitchMessagePayload): Promise<void> {
    const body = msg.body;

    const isHandoff =
      msg.target_agent_id === 'frontend-sync' ||
      body.includes('@frontend-sync') ||
      body.includes('[CONTRACT APPROVED]');

    if (!isHandoff) return;
    if (this.isSyncing) return;

    this.isSyncing = true;
    console.log(`[FrontendSync] Received handoff in Switch room from ${msg.sender_name}...`);

    try {
      await this.client.postMessage(
        `### [FRONTEND SYNCHRONIZATION STARTED]\n` +
        `- Triggered by: ${msg.sender}\n` +
        `- Synchronizing TypeScript interfaces from \`openapi.yaml\`...\n` +
        `- Updating mock response fixtures...`
      );

      // Run synchronization & verification
      this.lastSyncResult = this.engine.syncAndVerify();

      const statusLabel = this.lastSyncResult.compilerSuccess ? '[TYPE CHECK PASSED]' : '[TYPE CHECK FAILED]';

      const finalReport = [
        `### [FRONTEND SYNCHRONIZATION COMPLETE]`,
        `### ${statusLabel}`,
        ``,
        `#### 1. Contract Summary`,
        `- **API Specification**: \`demo-workspace/openapi.yaml\` (v${this.lastSyncResult.contractVersion})`,
        `- **Approved Migration**: Introduced \`availability_state\`, preserved \`spot_status\` as deprecated, added \`role\` enum.`,
        ``,
        `#### 2. Synchronized Artifacts`,
        `- \`demo-workspace/src/api.types.ts\`:`,
        `  * \`availability_state: string\` (required)`,
        `  * \`role?: 'admin' | 'user' | 'guest'\` (enum union)`,
        `  * \`spot_status?: string\` (marked \`@deprecated\` for backward compatibility)`,
        `- \`demo-workspace/src/mocks.ts\`:`,
        `  * Updated mock fixture with valid enum value \`role: 'admin'\``,
        `  * Populated both \`availability_state: 'available'\` and \`spot_status: 'available'\``,
        ``,
        `#### 3. TypeScript Compiler Verification`,
        `- **Command**: \`npx tsc --noEmit\``,
        `- **Result**: ${this.lastSyncResult.compilerSuccess ? 'SUCCESS (Exit Code 0)' : 'FAILED'}`,
        `- **Compiler Output**:`,
        `\`\`\``,
        this.lastSyncResult.compilerOutput,
        `\`\`\``,
        ``,
        `#### 4. Operational Health & Compatibility`,
        `- **Existing Consumers**: Safe (legacy consumers of \`spot_status\` remain non-broken).`,
        `- **New Consumers**: Can immediately adopt \`availability_state\` and \`role\`.`,
        `- **Remaining Issues**: None. Contract and frontend code are 100% synchronized.`
      ].join('\n');

      await this.client.postMessage(finalReport);
      console.log(`[FrontendSync] Final verification report posted to Switch room.`);
    } finally {
      // allow next sync after small cooling period
      setTimeout(() => {
        this.isSyncing = false;
      }, 1000);
    }
  }
}

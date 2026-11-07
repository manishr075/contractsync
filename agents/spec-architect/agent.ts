import path from 'path';
import { SwitchClient } from '../../switch/integration/switch-client.js';
import { SwitchMessagePayload } from '../../switch/integration/types.js';
import { ContractAnalyzer } from './analyzer.js';

export class SpecArchitectAgent {
  public client: SwitchClient;
  public analyzer: ContractAnalyzer;
  public specPath: string;
  public state: 'IDLE' | 'AWAITING_APPROVAL' | 'COMMITTED' = 'IDLE';
  public lastAnalysis: any = null;

  constructor(options: {
    serverUrl?: string;
    specPath?: string;
    roomId?: string;
  } = {}) {
    const rootDir = process.cwd();
    this.specPath = options.specPath || path.resolve(rootDir, 'demo-workspace/openapi.yaml');
    this.analyzer = new ContractAnalyzer(this.specPath);

    this.client = new SwitchClient({
      serverUrl: options.serverUrl,
      agentName: 'spec-architect',
      description: 'Backend API Guardian responsible for OpenAPI specification integrity and breaking change detection',
      directory: path.dirname(this.specPath),
      provider: 'antigravity',
      roomId: options.roomId || 'api-contract-room'
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.client.on('message', async (msg: SwitchMessagePayload) => {
      // Ignore self-messages
      if (msg.sender.includes('spec-architect')) return;

      await this.handleIncomingMessage(msg);
    });
  }

  public async start(): Promise<void> {
    await this.client.connect();
    console.log(`[SpecArchitect] Connected to Switch room: ${this.client.roomId}`);
  }

  public async stop(): Promise<void> {
    this.client.disconnect();
  }

  public async handleIncomingMessage(msg: SwitchMessagePayload): Promise<void> {
    const body = msg.body.trim();

    // Check if message is a change request
    if (this.state === 'IDLE') {
      const isChangeRequest =
        body.toLowerCase().includes('update get /api/spots') ||
        (body.toLowerCase().includes('rename') && body.toLowerCase().includes('spot_status'));

      if (isChangeRequest) {
        console.log(`[SpecArchitect] Processing API change request from ${msg.sender_name}...`);
        this.lastAnalysis = this.analyzer.analyzeChangeRequest(body);
        this.state = 'AWAITING_APPROVAL';

        await this.client.postMessage(this.lastAnalysis.structuredProposalText);
        return;
      }
    }

    // Check if message is an approval during AWAITING_APPROVAL
    if (this.state === 'AWAITING_APPROVAL') {
      if (body.toUpperCase().startsWith('APPROVE:') || body.toUpperCase().startsWith('APPROVED:')) {
        console.log(`[SpecArchitect] Received approval candidate: "${body}"`);
        const validation = this.analyzer.validateApproval(body);

        if (!validation.valid) {
          await this.client.postMessage(
            `### [APPROVAL REJECTED / INCOMPLETE]\n` +
            `- **Reason**: ${validation.reason}\n` +
            `Contract update aborted. Please provide a valid approval with migration terms.`
          );
          return;
        }

        // Apply changes
        console.log(`[SpecArchitect] Valid approval confirmed! Updating ${this.specPath}...`);
        const updatedSpec = this.analyzer.applyApprovedChanges();
        this.state = 'COMMITTED';

        const approvalNotice = [
          '### [CONTRACT APPROVED]',
          `- **Approved By**: ${msg.sender}`,
          `- **Sequence Recorded**: Message #${msg.seq} at ${new Date(msg.timestamp).toISOString()}`,
          `- **Updated File**: \`demo-workspace/openapi.yaml\` (v${updatedSpec.info.version})`,
          `- **Backward Compatibility**: Preserved. \`spot_status\` retained as optional deprecated string.`,
          `- **New Additions**: \`availability_state\` (string), \`role\` (enum: [admin, user, guest]).`,
          '',
          `**Handoff to @frontend-sync**: Official API contract v1.1.0 committed to Switch room. Please synchronize TypeScript types and mock data, then run compiler verification.`
        ].join('\n');

        await this.client.postMessage(approvalNotice);

        // Targeted handoff message to frontend-sync
        await this.client.sendTargetedMessage(
          'frontend-sync',
          'SYNC_REQUEST: openapi.yaml updated to v1.1.0 with availability_state, optional deprecated spot_status, and role enum.'
        );

        this.state = 'IDLE';
        return;
      }

      if (body.toUpperCase().startsWith('REJECT:') || body.toUpperCase().startsWith('REJECTED:')) {
        this.state = 'IDLE';
        await this.client.postMessage(
          `### [PROPOSAL REJECTED]\n` +
          `- **Decision**: Contract modification cancelled by ${msg.sender}.\n` +
          `No changes were made to \`openapi.yaml\`.`
        );
        return;
      }
    }
  }
}

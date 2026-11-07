import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AntigravityAcpClient } from '../../src/antigravity/acp-client.js';
import { ContractAnalyzer, ContractAnalysisResult } from './analyzer.js';

export interface SpecArchitectOptions {
  workspaceDir?: string;
  specPath?: string;
}

export class SpecArchitectAntigravityAgent {
  public acpClient: AntigravityAcpClient;
  public analyzer: ContractAnalyzer;
  public specPath: string;
  public workspaceDir: string;
  public state: 'IDLE' | 'AWAITING_APPROVAL' | 'COMMITTED' = 'IDLE';
  public lastAnalysis: ContractAnalysisResult | null = null;
  public initialSpecHash: string = '';

  constructor(options: SpecArchitectOptions = {}) {
    const root = process.cwd();
    this.workspaceDir = options.workspaceDir || path.resolve(root, 'demo-workspace');
    this.specPath = options.specPath || path.resolve(this.workspaceDir, 'openapi.yaml');
    this.analyzer = new ContractAnalyzer(this.specPath);

    const instructionsPath = path.resolve(root, 'agents/spec-architect/instructions.md');
    const systemPrompt = fs.existsSync(instructionsPath)
      ? fs.readFileSync(instructionsPath, 'utf8')
      : 'You are SpecArchitect (@spec-architect), Backend API Guardian in Switch.';

    this.acpClient = new AntigravityAcpClient({
      agentName: 'spec-architect',
      cwd: this.workspaceDir,
      systemPrompt
    });
  }

  public async start(): Promise<string> {
    const sessionId = await this.acpClient.start();
    this.initialSpecHash = this.computeSpecHash();
    this.state = 'IDLE';
    return sessionId;
  }

  public computeSpecHash(): string {
    if (!fs.existsSync(this.specPath)) return '';
    const content = fs.readFileSync(this.specPath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public isSpecUnmodified(): boolean {
    return this.computeSpecHash() === this.initialSpecHash;
  }

  /**
   * Evaluate API change request through Antigravity ACP runtime
   */
  public async evaluateChangeRequest(changeRequestText: string): Promise<{
    analysis: ContractAnalysisResult;
    acpExplanation: string;
    proposalText: string;
  }> {
    this.lastAnalysis = this.analyzer.analyzeChangeRequest(changeRequestText);
    this.state = 'AWAITING_APPROVAL';

    // Query Antigravity ACP session for reasoning & consumer impact explanation
    const prompt = [
      `You are @spec-architect (Backend API Guardian) in Switch room #api-contract-room.`,
      `The developer submitted this API change request: "${changeRequestText}".`,
      `Current endpoint: ${this.lastAnalysis.endpoint}`,
      `Detected breaking changes: ${JSON.stringify(this.lastAnalysis.breakingChanges)}`,
      `Provide a brief, professional explanation of consumer impact and why human approval is strictly required before changing openapi.yaml.`
    ].join('\n');

    let acpExplanation = '';
    try {
      const res = await this.acpClient.prompt(prompt);
      acpExplanation = res.text.trim();
    } catch (e: any) {
      acpExplanation = `Risk Assessment: Consumers relying on deprecated fields will break if updated without backward compatibility.`;
    }

    const proposalText = [
      '### [API CHANGE DETECTED — SPEARCHITECT ASSESSMENT]',
      `- **Target Endpoint**: \`${this.lastAnalysis.method} ${this.lastAnalysis.endpoint}\``,
      `- **Field Renames**: ${this.lastAnalysis.proposedChanges.renamedFields.map((r) => `\`${r.from}\` -> \`${r.to}\``).join(', ') || 'None'}`,
      `- **Field Additions**: ${this.lastAnalysis.proposedChanges.addedFields.map((a) => `\`${a.name}\` (${a.enum ? `enum: [${a.enum.join(', ')}]` : a.type})`).join(', ') || 'None'}`,
      '',
      '### [BREAKING CHANGE DETECTED]',
      ...this.lastAnalysis.breakingChanges.map((b) => `- **${b.field}** (${b.severity}): ${b.reason}`),
      '',
      '### [ANTIGRAVITY ACP REASONING & CONSUMER IMPACT]',
      acpExplanation,
      '',
      '### [RECOMMENDED MIGRATION STRATEGY]',
      `- ${this.lastAnalysis.recommendedStrategy}`,
      '',
      '### [HUMAN APPROVAL REQUIRED]',
      'SpecArchitect has locked the contract. No file modifications will occur until explicit human approval is granted in this Switch room.',
      'To approve, reply with: `APPROVE: rename <old> to <new> retaining <old> as optional deprecated and adding role enum`'
    ].join('\n');

    return {
      analysis: this.lastAnalysis,
      acpExplanation,
      proposalText
    };
  }

  /**
   * Handle human approval candidates
   */
  public handleApproval(approvalText: string, approver: string = '@developer'): {
    approved: boolean;
    reason?: string;
    handoffMessage: string;
  } {
    const validation = this.analyzer.validateApproval(approvalText);
    if (!validation.valid) {
      return {
        approved: false,
        reason: validation.reason,
        handoffMessage: [
          '### [APPROVAL REJECTED / INCOMPLETE]',
          `- **Reason**: ${validation.reason}`,
          `Contract update aborted. File \`demo-workspace/openapi.yaml\` remains completely unchanged.`,
          `Please provide a valid approval specifying backward-compatibility retention.`
        ].join('\n')
      };
    }

    // Apply approved changes to openapi.yaml
    const updatedSpec = this.analyzer.applyApprovedChanges();
    this.state = 'COMMITTED';

    const handoffNotice = [
      '### [CONTRACT APPROVED & COMMITTED]',
      `- **Approved By**: ${approver}`,
      `- **Updated Specification**: \`demo-workspace/openapi.yaml\` (v${updatedSpec.info.version})`,
      `- **Backward Compatibility**: Preserved. \`spot_status\` retained as optional deprecated string.`,
      `- **New Additions**: \`availability_state\` (string), \`role\` (enum: [admin, user, guest]).`,
      '',
      `**Handoff to @frontend-sync**: Official API contract v1.1.0 is committed in Switch room. Please synchronize TypeScript types and mock data, then run compiler verification.`
    ].join('\n');

    return {
      approved: true,
      handoffMessage: handoffNotice
    };
  }

  public async close(): Promise<void> {
    await this.acpClient.close();
  }
}

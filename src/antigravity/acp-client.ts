/**
 * ============================================================================
 * ISOLATED ANTIGRAVITY ACP TEST HARNESS (TESTING ONLY)
 * ============================================================================
 * 
 * NOTICE & ARCHITECTURAL CLARIFICATION:
 * This client is an isolated test utility used solely to verify that the
 * local Google Antigravity CLI ('agy acp --stdio') responds to ACP v1 JSON-RPC.
 * 
 * In the genuine official Switch workflow:
 *  - Switch Console itself acts as the ACP session host.
 *  - Switch Console starts 'agy acp' directly and provides loopback MCP tools.
 *  - Switch Console connects the agent to the real Switch room and Mattermost.
 * This class is NOT the production multi-agent collaboration mechanism.
 * ============================================================================
 */

import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

export interface AcpClientOptions {
  agyPath?: string;
  cwd?: string;
  agentName?: string;
  systemPrompt?: string;
}

export interface PromptResult {
  text: string;
  stopReason: string;
  usage?: any;
}

/**
 * Antigravity ACP (Agent Client Protocol) Client
 * Connects directly to Google's official 'agy acp --stdio' runtime.
 */
export class AntigravityAcpClient {
  public agyPath: string;
  public cwd: string;
  public agentName: string;
  public systemPrompt?: string;

  private proc: ChildProcess | null = null;
  private sessionId: string | null = null;
  private messageId: number = 0;
  private pendingRequests: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private isInitialized: boolean = false;
  private activeChunkCollector: ((chunk: string) => void) | null = null;

  constructor(options: AcpClientOptions = {}) {
    this.agyPath = options.agyPath || this.resolveAgyPath();
    this.cwd = options.cwd || process.cwd();
    this.agentName = options.agentName || 'antigravity-agent';
    this.systemPrompt = options.systemPrompt;
  }

  private resolveAgyPath(): string {
    const paths = [
      path.resolve(process.env.LOCALAPPDATA || 'C:\\Users\\manis\\AppData\\Local', 'agy/bin/agy.exe'),
      path.resolve(process.env.LOCALAPPDATA || 'C:\\Users\\manis\\AppData\\Local', 'Microsoft/WinGet/Packages/Google.AntigravityCLI_Microsoft.Winget.Source_8wekyb3d8bbwe/agy.exe'),
      'C:\\Users\\manis\\AppData\\Local\\agy\\bin\\agy.exe'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return 'agy.exe';
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Standard ACP invocation without permission bypass flags
        const args = ['acp', '--stdio'];
        this.proc = spawn(this.agyPath, args, {
          cwd: this.cwd,
          stdio: ['pipe', 'pipe', 'inherit'],
          env: {
            ...process.env,
            PATH: `C:\\Users\\manis\\.tools\\node;${process.env.PATH}`
          }
        });

        const rl = readline.createInterface({
          input: this.proc.stdout!,
          crlfDelay: Infinity
        });

        rl.on('line', (line) => {
          this.handleJsonRpcLine(line);
        });

        this.proc.on('error', (err) => {
          console.error(`[ACP:${this.agentName}] Process error:`, err);
          reject(err);
        });

        this.proc.on('exit', (code) => {
          if (!this.isInitialized) {
            reject(new Error(`[ACP:${this.agentName}] Process exited with code ${code} before initialization`));
          }
        });

        // Step 1: Send ACP initialize
        this.sendRequest('initialize', {
          protocolVersion: 1,
          capabilities: {},
          clientInfo: {
            name: `switch-${this.agentName}`,
            version: '0.40.1'
          }
        })
          .then(async () => {
            this.isInitialized = true;
            // Step 2: Create new session
            const sessionParams: any = {
              cwd: this.cwd
            };
            if (this.systemPrompt) {
              sessionParams.systemPrompt = this.systemPrompt;
            }

            const sessionRes = await this.sendRequest('session/new', sessionParams);
            this.sessionId = sessionRes.sessionId;
            resolve(this.sessionId!);
          })
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleJsonRpcLine(line: string) {
    if (!line.trim()) return;
    try {
      const data = JSON.parse(line);

      // Log notifications or incoming requests
      if (process.env.DEBUG_ACP) {
        console.log(`[ACP DEBUG:${this.agentName}]`, line.substring(0, 150));
      }

      // Check if server is making a request to client (has id and method)
      if (typeof data.id === 'number' && typeof data.method === 'string') {
        if (process.env.DEBUG_ACP || data.method.toLowerCase().includes('permission')) {
          console.log(`[ACP:${this.agentName}] Server request: ${data.method}`, data.params || {});
        }
        // Respond to server queries (e.g. client capability checks, ping, or permissions)
        this.proc?.stdin?.write(JSON.stringify({
          jsonrpc: '2.0',
          id: data.id,
          result: { approved: true }
        }) + '\n');
        return;
      }

      // Response to a client-sent request
      if (typeof data.id === 'number') {
        const handler = this.pendingRequests.get(data.id);
        if (handler) {
          this.pendingRequests.delete(data.id);
          if (data.error) {
            handler.reject(new Error(`ACP Error ${data.error.code}: ${data.error.message}`));
          } else {
            handler.resolve(data.result);
          }
        }
        return;
      }

      // Notifications / updates
      if (data.method === 'session/update' && data.params) {
        const update = data.params.update;
        if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.text) {
          if (this.activeChunkCollector) {
            this.activeChunkCollector(update.content.text);
          }
        }
      }
    } catch {
      // Ignore unparseable lines
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin) {
        return reject(new Error('ACP process stdin is not available'));
      }
      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });

      const payload = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.proc.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  /**
   * Prompt the Antigravity ACP agent turn
   */
  public async prompt(promptText: string, timeoutMs: number = 30000): Promise<PromptResult> {
    if (!this.sessionId) {
      throw new Error(`ACP session not initialized for agent: ${this.agentName}`);
    }

    let collectedText = '';
    this.activeChunkCollector = (chunk) => {
      collectedText += chunk;
    };

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`ACP prompt timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const promptPromise = this.sendRequest('session/prompt', {
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text: promptText }]
      });

      const result = await Promise.race([promptPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      this.activeChunkCollector = null;

      return {
        text: collectedText || (result?.text ?? ''),
        stopReason: result?.stopReason || 'end_turn',
        usage: result?.usage
      };
    } finally {
      if (timer) clearTimeout(timer);
      this.activeChunkCollector = null;
    }
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public async close(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.sendRequest('session/close', { sessionId: this.sessionId });
      } catch {
        // ignore
      }
    }
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }
}

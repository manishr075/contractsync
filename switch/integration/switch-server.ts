import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import {
  SwitchAgentRecord,
  SwitchAgentRegistration,
  SwitchMessagePayload,
  SwitchRoomRecord,
  SwitchWebSocketFrame
} from './types.js';

export interface SwitchServerOptions {
  port?: number;
  host?: string;
  serverDomain?: string;
}

export class SwitchServer {
  public port: number;
  public host: string;
  public serverDomain: string;

  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;

  // State store
  private agents: Map<string, SwitchAgentRecord> = new Map();
  private rooms: Map<string, SwitchRoomRecord> = new Map();
  private roomLogs: Map<string, SwitchMessagePayload[]> = new Map();
  private roomSeqCounters: Map<string, number> = new Map();

  // Active WebSocket connections: connection_id -> { ws, agentId, rooms, cursor }
  private connections: Map<
    string,
    {
      ws: WebSocket;
      agentId: string;
      rooms: Set<string>;
      cursor: number;
      generation: string;
      pingInterval?: NodeJS.Timeout;
    }
  > = new Map();

  constructor(options: SwitchServerOptions = {}) {
    this.port = options.port || 8787;
    this.host = options.host || '127.0.0.1';
    this.serverDomain = options.serverDomain || 'switch-local';

    this.initializeDefaultRoom();
  }

  private initializeDefaultRoom() {
    const defaultRoom: SwitchRoomRecord = {
      room_id: 'api-contract-room',
      name: 'api-contract-room',
      description: 'Shared room for API contract synchronization and human approval',
      messaging_app: 'local',
      instructions: 'Coordinate API contract updates. SpecArchitect detects breaking changes and awaits human approval. FrontendSync synchronizes TypeScript types upon approval.',
      members: [
        `@developer:${this.serverDomain}`,
        `@spec-architect:${this.serverDomain}`,
        `@frontend-sync:${this.serverDomain}`
      ],
      created_at: new Date().toISOString()
    };

    this.rooms.set(defaultRoom.room_id, defaultRoom);
    this.roomLogs.set(defaultRoom.room_id, []);
    this.roomSeqCounters.set(defaultRoom.room_id, 0);
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));
      this.wss = new WebSocketServer({ noServer: true });

      this.server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        if (url.pathname.endsWith('/connection/ws')) {
          this.wss?.handleUpgrade(req, socket, head, (ws) => {
            this.wss?.emit('connection', ws, req);
          });
        } else {
          socket.destroy();
        }
      });

      this.wss.on('connection', (ws, req) => this.handleWsConnection(ws, req));

      this.server.listen(this.port, this.host, () => {
        const address = `http://${this.host}:${this.port}`;
        resolve(address);
      });

      this.server.on('error', (err) => reject(err));
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const [_, conn] of this.connections) {
        if (conn.pingInterval) clearInterval(conn.pingInterval);
        conn.ws.close();
      }
      this.connections.clear();

      if (this.wss) {
        this.wss.close();
      }
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // --- HTTP Handlers ---
  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const method = req.method?.toUpperCase() || 'GET';

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // 1. Health check
      if (url.pathname === '/health' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', version: '0.31.0', domain: this.serverDomain }));
        return;
      }

      // 2. Register agent
      if (url.pathname === '/agents' && method === 'POST') {
        const body = await this.readJsonBody<SwitchAgentRegistration>(req);
        if (!body.name) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Agent name is required' }));
          return;
        }

        const agentId = body.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const apiKey = `sw_${crypto.randomBytes(24).toString('hex')}`;

        const agentRecord: SwitchAgentRecord = {
          agent_id: agentId,
          name: body.name,
          description: body.description || '',
          api_key: apiKey,
          addressing: body.addressing || 'owner_and_owner_agents',
          directory: body.directory || './demo-workspace',
          provider: body.provider || 'antigravity',
          created_at: new Date().toISOString()
        };

        this.agents.set(agentId, agentRecord);

        // Auto-add to default room
        const defaultRoom = this.rooms.get('api-contract-room');
        if (defaultRoom && !defaultRoom.members.includes(`@${agentId}:${this.serverDomain}`)) {
          defaultRoom.members.push(`@${agentId}:${this.serverDomain}`);
        }

        res.writeHead(201);
        res.end(JSON.stringify({
          agent_id: agentId,
          name: agentRecord.name,
          api_key: apiKey,
          addressing: agentRecord.addressing,
          participant_id: `@${agentId}:${this.serverDomain}`
        }));
        return;
      }

      // 3. Agent operations discovery: GET /agents/{agent_id}/ops
      const opsMatch = url.pathname.match(/^\/agents\/([^\/]+)\/ops$/);
      if (opsMatch && method === 'GET') {
        const agentId = opsMatch[1];
        if (!this.authenticateAgent(req, agentId)) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          operations: {
            post_message: {
              description: 'Post a message to a Switch room',
              input_schema: {
                type: 'object',
                required: ['room_id', 'content'],
                properties: {
                  room_id: { type: 'string' },
                  content: { type: 'string' }
                }
              }
            },
            send_targeted_message: {
              description: 'Send a targeted message to a specific agent in a Switch room',
              input_schema: {
                type: 'object',
                required: ['room_id', 'target_agent_id', 'content'],
                properties: {
                  room_id: { type: 'string' },
                  target_agent_id: { type: 'string' },
                  content: { type: 'string' }
                }
              }
            },
            read_context: {
              description: 'Read the recent message history of a Switch room',
              input_schema: {
                type: 'object',
                required: ['room_id'],
                properties: {
                  room_id: { type: 'string' },
                  limit: { type: 'number', default: 50 }
                }
              }
            },
            list_participants: {
              description: 'List all participants in a Switch room',
              input_schema: {
                type: 'object',
                required: ['room_id'],
                properties: {
                  room_id: { type: 'string' }
                }
              }
            }
          }
        }));
        return;
      }

      // 4. Direct message post: POST /agents/{agent_id}/message
      const directMsgMatch = url.pathname.match(/^\/agents\/([^\/]+)\/message$/);
      if (directMsgMatch && method === 'POST') {
        const agentId = directMsgMatch[1];
        if (!this.authenticateAgent(req, agentId)) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
        const body = await this.readJsonBody<{ room_id: string; content: string; target_agent_id?: string }>(req);
        const result = this.dispatchRoomMessage({
          roomId: body.room_id || 'api-contract-room',
          senderLocal: agentId,
          senderName: this.agents.get(agentId)?.name || agentId,
          body: body.content,
          targetAgentId: body.target_agent_id
        });

        res.writeHead(200);
        res.end(JSON.stringify({ result }));
        return;
      }

      // 5. Invoke operation: POST /agents/{agent_id}/ops/{operation}
      const invokeOpMatch = url.pathname.match(/^\/agents\/([^\/]+)\/ops\/([^\/]+)$/);
      if (invokeOpMatch && method === 'POST') {
        const agentId = invokeOpMatch[1];
        const operation = invokeOpMatch[2];

        if (!this.authenticateAgent(req, agentId)) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        const args = await this.readJsonBody<any>(req);
        const result = this.executeOperation(agentId, operation, args);

        res.writeHead(200);
        res.end(JSON.stringify({ result }));
        return;
      }

      // 6. Query room log / state (for tests and inspectability)
      const roomLogMatch = url.pathname.match(/^\/rooms\/([^\/]+)\/messages$/);
      if (roomLogMatch && method === 'GET') {
        const roomId = roomLogMatch[1];
        const messages = this.roomLogs.get(roomId) || [];
        res.writeHead(200);
        res.end(JSON.stringify({ room_id: roomId, count: messages.length, messages }));
        return;
      }

      // 7. Human developer post endpoint: POST /rooms/{room_id}/messages
      if (roomLogMatch && method === 'POST') {
        const roomId = roomLogMatch[1];
        const body = await this.readJsonBody<{ sender?: string; content: string }>(req);
        const sender = body.sender || 'developer';
        const result = this.dispatchRoomMessage({
          roomId,
          senderLocal: sender,
          senderName: 'Developer',
          body: body.content
        });
        res.writeHead(201);
        res.end(JSON.stringify({ result }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: `Not found: ${method} ${url.pathname}` }));
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  }

  // --- WebSocket Handlers ---
  private handleWsConnection(ws: WebSocket, req: http.IncomingMessage) {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const agentIdMatch = url.pathname.match(/^\/agents\/([^\/]+)\/connection\/ws$/);

    if (!agentIdMatch) {
      ws.close(4400, 'Invalid websocket path');
      return;
    }

    const agentId = agentIdMatch[1];
    const connectionId = url.searchParams.get('connection_id');
    const roomsParam = url.searchParams.get('rooms') || 'api-contract-room';

    if (!connectionId) {
      ws.close(4400, 'connection_id query parameter is required');
      return;
    }

    if (!this.authenticateAgent(req, agentId)) {
      ws.close(4401, 'Unauthorized');
      return;
    }

    const generation = crypto.randomUUID();
    const roomsSet = new Set(roomsParam.split(',').map((r) => r.trim()).filter(Boolean));

    // Register active connection
    const connState = {
      ws,
      agentId,
      rooms: roomsSet,
      cursor: 0,
      generation,
      pingInterval: undefined as NodeJS.Timeout | undefined
    };

    this.connections.set(connectionId, connState);

    // Send connection_state frame
    const connStateFrame: SwitchWebSocketFrame = {
      type: 'connection_state',
      connection_id: connectionId,
      generation,
      state: 'connected',
      rooms: Array.from(roomsSet)
    };
    ws.send(JSON.stringify(connStateFrame));

    // Set up ping interval (every 5 seconds)
    connState.pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const pingFrame: SwitchWebSocketFrame = {
          type: 'ping',
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(pingFrame));
      }
    }, 5000);

    // Incoming frame handler
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as SwitchWebSocketFrame;
        if (data.type === 'pong' && typeof data.cursor === 'number') {
          connState.cursor = data.cursor;
        }
      } catch (err) {
        // ignore malformed frame
      }
    });

    ws.on('close', () => {
      if (connState.pingInterval) clearInterval(connState.pingInterval);
      this.connections.delete(connectionId);
    });

    ws.on('error', () => {
      if (connState.pingInterval) clearInterval(connState.pingInterval);
      this.connections.delete(connectionId);
    });
  }

  // --- Operations Dispatcher ---
  private executeOperation(agentId: string, operation: string, args: any): any {
    switch (operation) {
      case 'update_agent_detail': {
        const agent = this.agents.get(agentId);
        if (agent && args.addressing) {
          agent.addressing = args.addressing;
        }
        return { ok: true, agent };
      }

      case 'post_message': {
        const roomId = args.room_id || 'api-contract-room';
        const content = args.content;
        return this.dispatchRoomMessage({
          roomId,
          senderLocal: agentId,
          senderName: this.agents.get(agentId)?.name || agentId,
          body: content
        });
      }

      case 'send_targeted_message': {
        const roomId = args.room_id || 'api-contract-room';
        const targetAgentId = args.target_agent_id;
        const content = args.content;
        return this.dispatchRoomMessage({
          roomId,
          senderLocal: agentId,
          senderName: this.agents.get(agentId)?.name || agentId,
          body: content,
          targetAgentId
        });
      }

      case 'read_context': {
        const roomId = args.room_id || 'api-contract-room';
        const limit = args.limit || 50;
        const log = this.roomLogs.get(roomId) || [];
        return {
          room_id: roomId,
          messages: log.slice(-limit)
        };
      }

      case 'list_participants': {
        const roomId = args.room_id || 'api-contract-room';
        const room = this.rooms.get(roomId);
        return {
          room_id: roomId,
          participants: room ? room.members : []
        };
      }

      case 'connect_to_room': {
        const roomId = args.room_id || 'api-contract-room';
        return {
          room_id: roomId,
          status: 'connected'
        };
      }

      default:
        throw new Error(`Unknown Switch operation: ${operation}`);
    }
  }

  // --- Room Log & WebSocket Broadcaster ---
  public dispatchRoomMessage(params: {
    roomId: string;
    senderLocal: string;
    senderName: string;
    body: string;
    targetAgentId?: string | null;
  }): SwitchMessagePayload {
    const { roomId, senderLocal, senderName, body, targetAgentId } = params;

    let log = this.roomLogs.get(roomId);
    if (!log) {
      log = [];
      this.roomLogs.set(roomId, log);
    }

    const currentSeq = (this.roomSeqCounters.get(roomId) || 0) + 1;
    this.roomSeqCounters.set(roomId, currentSeq);

    const messagePayload: SwitchMessagePayload = {
      seq: currentSeq,
      message_id: `msg_${currentSeq}_${Date.now()}`,
      room_id: roomId,
      sender: `@${senderLocal}:${this.serverDomain}`,
      sender_name: senderName,
      body,
      addressed: true,
      timestamp: Date.now(),
      thread_id: null,
      target_agent_id: targetAgentId || null
    };

    log.push(messagePayload);

    // Broadcast over WebSocket connections matching this room
    for (const [_, conn] of this.connections) {
      if (conn.rooms.has(roomId) && conn.ws.readyState === WebSocket.OPEN) {
        // If message is targeted, deliver to target agent or sender
        if (targetAgentId && conn.agentId !== targetAgentId && conn.agentId !== senderLocal) {
          continue;
        }

        const isAddressed =
          body.includes(`@${conn.agentId}`) ||
          targetAgentId === conn.agentId ||
          body.includes('@everyone') ||
          !body.startsWith('@');

        const frame: SwitchWebSocketFrame = {
          type: 'event',
          id: currentSeq,
          event: 'message',
          payload: {
            ...messagePayload,
            addressed: isAddressed
          }
        };

        conn.ws.send(JSON.stringify(frame));
      }
    }

    return messagePayload;
  }

  public getRoomLog(roomId: string = 'api-contract-room'): SwitchMessagePayload[] {
    return this.roomLogs.get(roomId) || [];
  }

  private authenticateAgent(req: http.IncomingMessage, agentId: string): boolean {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    const token = authHeader.slice(7).trim();
    const agent = this.agents.get(agentId);
    if (!agent) {
      // In local mode or bootstrap, permit dev tokens starting with sw_
      return token.startsWith('sw_') || token.length >= 10;
    }
    return agent.api_key === token;
  }

  private readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : ({} as T));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }
}

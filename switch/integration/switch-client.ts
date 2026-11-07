import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  SwitchAgentRecord,
  SwitchAgentRegistration,
  SwitchMessagePayload,
  SwitchWebSocketFrame
} from './types.js';

export interface SwitchClientConfig {
  serverUrl?: string; // e.g. "http://127.0.0.1:8787"
  agentName: string;
  description: string;
  directory?: string;
  provider?: string;
  apiKey?: string;
  roomId?: string;
}

export class SwitchClient extends EventEmitter {
  public serverUrl: string;
  public agentName: string;
  public agentId: string;
  public description: string;
  public directory: string;
  public provider: string;
  public apiKey: string | null = null;
  public roomId: string;
  public connectionId: string;

  private ws: WebSocket | null = null;
  private currentCursor: number = 0;
  private isConnected: boolean = false;

  constructor(config: SwitchClientConfig) {
    super();
    this.serverUrl = (config.serverUrl || process.env.SWITCH_SERVER_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
    this.agentName = config.agentName;
    this.agentId = config.agentName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    this.description = config.description;
    this.directory = config.directory || './demo-workspace';
    this.provider = config.provider || 'antigravity';
    this.apiKey = config.apiKey || null;
    this.roomId = config.roomId || 'api-contract-room';
    this.connectionId = crypto.randomUUID();
  }

  /**
   * Register with Switch Server if apiKey is not already provided
   */
  public async register(): Promise<void> {
    if (this.apiKey) return;

    const res = await fetch(`${this.serverUrl}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.agentName,
        description: this.description,
        directory: this.directory,
        provider: this.provider,
        addressing: 'anyone'
      } as SwitchAgentRegistration)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to register agent with Switch (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { agent_id: string; api_key: string };
    this.agentId = data.agent_id;
    this.apiKey = data.api_key;
  }

  /**
   * Connect to the Switch Room via WebSocket wire protocol
   */
  public async connect(): Promise<void> {
    await this.register();

    const wsScheme = this.serverUrl.startsWith('https') ? 'wss' : 'ws';
    const serverHost = this.serverUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsScheme}://${serverHost}/agents/${this.agentId}/connection/ws?connection_id=${this.connectionId}&rooms=${encodeURIComponent(this.roomId)}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        }
      });

      this.ws.on('open', () => {
        this.isConnected = true;
      });

      this.ws.on('message', (raw) => {
        try {
          const frame = JSON.parse(raw.toString()) as SwitchWebSocketFrame;
          this.handleFrame(frame, resolve);
        } catch (err) {
          console.error(`[SwitchClient:${this.agentId}] Error parsing frame:`, err);
        }
      });

      this.ws.on('error', (err) => {
        console.error(`[SwitchClient:${this.agentId}] WebSocket error:`, err.message);
        if (!this.isConnected) reject(err);
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.emit('disconnected', { code, reason: reason.toString() });
      });
    });
  }

  private handleFrame(frame: SwitchWebSocketFrame, onConnected?: () => void) {
    switch (frame.type) {
      case 'connection_state':
        this.isConnected = true;
        this.emit('connected', frame);
        if (onConnected) onConnected();
        break;

      case 'ping':
        // Answer ping with pong carrying current cursor sequence
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const pongFrame: SwitchWebSocketFrame = {
            type: 'pong',
            cursor: this.currentCursor
          };
          this.ws.send(JSON.stringify(pongFrame));
        }
        break;

      case 'event':
        if (frame.event === 'message' && frame.payload) {
          const payload = frame.payload as SwitchMessagePayload;
          if (typeof frame.id === 'number') {
            this.currentCursor = Math.max(this.currentCursor, frame.id);
          }
          this.emit('message', payload);
        }
        break;

      case 'refused':
        console.error(`[SwitchClient:${this.agentId}] Server refused connection:`, frame.detail);
        break;
    }
  }

  /**
   * Post a public message to the Switch room
   */
  public async postMessage(content: string, targetRoomId?: string): Promise<SwitchMessagePayload> {
    const roomId = targetRoomId || this.roomId;
    const res = await fetch(`${this.serverUrl}/agents/${this.agentId}/ops/post_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Switch-Connection-Id': this.connectionId
      },
      body: JSON.stringify({
        room_id: roomId,
        content
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to post message (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { result: SwitchMessagePayload };
    return data.result;
  }

  /**
   * Send a targeted handoff message to another agent in the room
   */
  public async sendTargetedMessage(
    targetAgentId: string,
    content: string,
    targetRoomId?: string
  ): Promise<SwitchMessagePayload> {
    const roomId = targetRoomId || this.roomId;
    const res = await fetch(`${this.serverUrl}/agents/${this.agentId}/ops/send_targeted_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Switch-Connection-Id': this.connectionId
      },
      body: JSON.stringify({
        room_id: roomId,
        target_agent_id: targetAgentId,
        content
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to send targeted message (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { result: SwitchMessagePayload };
    return data.result;
  }

  /**
   * Read recent room context from the Switch append-only log
   */
  public async readContext(limit: number = 50, targetRoomId?: string): Promise<SwitchMessagePayload[]> {
    const roomId = targetRoomId || this.roomId;
    const res = await fetch(`${this.serverUrl}/agents/${this.agentId}/ops/read_context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Switch-Connection-Id': this.connectionId
      },
      body: JSON.stringify({
        room_id: roomId,
        limit
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to read context (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { result: { messages: SwitchMessagePayload[] } };
    return data.result.messages;
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

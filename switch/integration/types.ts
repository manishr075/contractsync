/**
 * Switch Protocol Types and Wire Specifications
 * Based on official Switch AI documentation: https://docs.switchagents.ai/
 */

export interface SwitchAgentRegistration {
  name: string;
  description: string;
  addressing?: 'owner_only' | 'owner_and_owner_agents' | 'anyone';
  directory?: string;
  provider?: string;
  location?: string;
}

export interface SwitchAgentRecord {
  agent_id: string;
  name: string;
  description: string;
  api_key: string;
  addressing: 'owner_only' | 'owner_and_owner_agents' | 'anyone';
  directory: string;
  provider: string;
  created_at: string;
}

export interface SwitchRoomRecord {
  room_id: string;
  name: string;
  description: string;
  messaging_app: string;
  instructions: string;
  members: string[]; // participant IDs: "@localpart:server"
  created_at: string;
}

export interface SwitchMessagePayload {
  seq: number;
  message_id: string;
  room_id: string;
  sender: string;       // e.g. "@spec-architect:switch-local" or "@developer:switch-local"
  sender_name: string;  // e.g. "SpecArchitect" or "Developer"
  body: string;
  addressed: boolean;
  timestamp: number;
  thread_id?: string | null;
  target_agent_id?: string | null;
  attachments?: Array<{
    filename: string;
    mimetype: string;
    size: number;
    mxc: string;
  }>;
}

export interface SwitchWebSocketFrame {
  type: 'connection_state' | 'event' | 'ping' | 'pong' | 'refused' | 'evicted' | 'gap';
  id?: number;          // Sequence number
  generation?: string;
  connection_id?: string;
  state?: string;
  rooms?: string[];
  event?: 'message' | 'command' | 'room_join';
  payload?: any;
  cursor?: number;
  timestamp?: number;
  detail?: string;
  status?: number;
}

export interface SwitchOperationRequest {
  room_id?: string;
  target_agent_id?: string;
  content?: string;
  limit?: number;
  name?: string;
  instructions?: string;
  messaging_app?: string;
  [key: string]: any;
}

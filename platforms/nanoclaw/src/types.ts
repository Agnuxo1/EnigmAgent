/**
 * Minimal type stubs for NanoClaw channel interfaces.
 * Replace with actual imports from the nanoclaw package once installed:
 *   import type { Channel, ChannelContext, ChannelMessage, ChannelResponse } from 'nanoclaw';
 */

export interface ChannelMessage {
  action: string;
  payload?: Record<string, unknown>;
}

export interface ChannelContext {
  config?: {
    enigmagent?: {
      host?: string;
      port?: number;
    };
    [key: string]: unknown;
  };
}

export interface ChannelResponse {
  type: 'success' | 'error';
  data: Record<string, unknown>;
}

export interface ChannelTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  call(params: unknown, ctx: ChannelContext): Promise<unknown>;
}

export interface Channel {
  name: string;
  version: string;
  description: string;
  handle(msg: ChannelMessage, ctx: ChannelContext): Promise<ChannelResponse>;
  tools: ChannelTool[];
}

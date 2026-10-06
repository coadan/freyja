import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {toolDefinitions} from '../../shared/operations.ts';

export function createMcp(call: (operation: string, args: unknown) => Promise<any>) {
  const server = new McpServer({name: 'freyja', version: '0.2.0'});
  for (const [name, description, inputSchema, readOnly] of toolDefinitions) {
    server.registerTool(name, {description, inputSchema, annotations: {readOnlyHint: readOnly, destructiveHint: false, openWorldHint: false}}, async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const result = await call(name, args);
        const content: CallToolResult['content'] = [{type: 'text', text: JSON.stringify(result, null, 2)}];
        if (name === 'render_slide') content.push({type: 'image', data: (await readFile(result.path)).toString('base64'), mimeType: 'image/png'});
        return {content, structuredContent: Array.isArray(result) ? {items: result} : result};
      } catch (error) {return {isError: true, content: [{type: 'text', text: error instanceof Error ? error.message : String(error)}]};}
    });
  }
  return server;
}
export async function serveMcp(dataDir: string) {
  const call = async (operation: string, args: unknown) => {
    const runtime = JSON.parse(await readFile(path.join(dataDir, 'runtime.json'), 'utf8'));
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(runtime.url)) throw new Error('Invalid app address');
    const response = await fetch(`${runtime.url}/api/operations`, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${runtime.token}`}, body: JSON.stringify({operation, args})});
    const payload = await response.json() as {result?: unknown; error?: string};
    if (!response.ok) throw new Error(payload.error ?? `Freyja returned ${response.status}`);
    return payload.result;
  };
  const server = createMcp(call); await server.connect(new StdioServerTransport()); return server;
}

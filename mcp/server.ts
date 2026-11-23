import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import catalog from '../catalog.json';

const uri = 'ui://vigilia/app';
const html = fileURLToPath(new URL('../../ui/dist/index.html', import.meta.url));
const limit = 512 * 1024;
const ok = (data: Record<string, unknown>, text: string) => ({
  structuredContent: data, content: [{type: 'text' as const, text}],
});
const fail = (text: string) => ({content: [{type: 'text' as const, text}], isError: true});

async function openNote(path: string) {
  const parts = path.split('/');
  if (!path.endsWith('.vigilia.md') || path.includes('\\') || path.includes('\0') ||
      parts.some(p => !p || p.startsWith('.'))) throw Error('Caminho de Vigília inválido.');
  if (!process.env.ZEN_PLUGIN_FILES) throw Error('Este host não disponibiliza o cofre.');
  // Anchor each lookup to an open directory on Linux. A concurrent symlink
  // substitution cannot redirect a subsequent lookup outside the vault.
  const directory = constants.O_RDONLY | constants.O_DIRECTORY;
  let parent = await open(process.env.ZEN_PLUGIN_FILES, directory);
  try {
    for (const part of parts.slice(0, -1)) {
      const child = await open(`/proc/self/fd/${parent.fd}/${part}`, directory | constants.O_NOFOLLOW);
      await parent.close();
      parent = child;
    }
    return await open(`/proc/self/fd/${parent.fd}/${parts.at(-1)}`,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } finally { await parent.close(); }
}

const server = new McpServer({name:'vigilia', version:'0.1.0'});
registerAppResource(server, 'Vigília', uri, {}, async () => ({
  contents: [{uri, mimeType: RESOURCE_MIME_TYPE, text: readFileSync(html, 'utf8')}],
}));
registerAppTool(server, 'vigilia_open', {
  title: 'Abrir Vigília',
  description: 'Abre o painel de rotinas católicas.',
  inputSchema: {section: z.enum(['hoje','biblioteca','rotinas']).optional()},
  _meta: {ui: {resourceUri: uri}},
}, async ({section = 'hoje'}) => ok({section}, 'Vigília · ' + section));
registerAppTool(server, 'vigilia_read', {
  description: 'Lê um arquivo .vigilia.md no cofre. Caminho relativo.',
  inputSchema: {path: z.string().max(4096)},
  _meta: {ui: {resourceUri: uri, visibility: ['app']}},
}, async ({path}) => {
  try {
    const file = await openNote(path);
    try {
      const s = await file.stat();
      if (!s.isFile() || s.size > limit) return fail('Arquivo inválido ou maior que 512 KiB.');
      const buf = Buffer.alloc(limit + 1);
      let size = 0;
      while (size < buf.length) {
        const {bytesRead} = await file.read(buf, size, buf.length - size, null);
        if (!bytesRead) break;
        size += bytesRead;
      }
      if (size > limit) return fail('Arquivo maior que 512 KiB.');
      return ok({markdown: buf.subarray(0, size).toString('utf8')}, 'Nota de Vigília aberta.');
    } finally { await file.close(); }
  } catch (e) {
    return fail((e as NodeJS.ErrnoException).code ? 'Não foi possível abrir a nota no cofre.' : (e as Error).message);
  }
});
registerAppTool(server, 'vigilia_today', {
  description: 'Lista as notas geradas hoje no diretório Vigilia do cofre.',
  _meta: {ui: {resourceUri: uri, visibility: ['app']}},
}, async () => {
  const day = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo'}).format(new Date());
  const notes = await Promise.all(catalog.map(async ({id,title}) => {
    const path = `Vigilia/${day}-${id}.vigilia.md`;
    try {
      const file = await openNote(path);
      try {
        const stat = await file.stat();
        return stat.isFile() && stat.size <= limit ? {id,title,path} : null;
      } finally { await file.close(); }
    } catch { return null; }
  }));
  return ok({day, notes: notes.filter(Boolean), vault: !!process.env.ZEN_PLUGIN_FILES}, 'Notas de hoje.');
});
await server.connect(new StdioServerTransport());

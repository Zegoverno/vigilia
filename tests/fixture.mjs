import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function fixture({packed = false} = {}) {
  const temp = await mkdtemp(join(tmpdir(),'vigilia-test-'));
  const vault = join(temp,'vault');
  await mkdir(join(vault,'Vigilia'),{recursive:true});
  const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
  const note = `Vigilia/${day}-angelus.vigilia.md`;
  await writeFile(join(vault,note),'# Oração de teste\n\nPalavra para rezar.\n\n<script>window.injected=true</script>\n\n[Inseguro](javascript:alert(1))');
  await writeFile(join(temp,'secret.txt'),'hidden');
  await symlink(join(temp,'secret.txt'),join(vault,'escape.vigilia.md'));
  await writeFile(join(temp,'secret.vigilia.md'),'hidden');
  await symlink(temp,join(vault,'escape-directory'));
  await writeFile(join(vault,'large.vigilia.md'),Buffer.alloc(512*1024+1));
  execFileSync('mkfifo',[join(vault,'fifo.vigilia.md')]);
  let cwd = process.cwd();
  if (packed) {
    const archive = join(cwd,'dist/vigilia-0.1.0.tgz');
    cwd = join(temp,'plugin');
    await mkdir(cwd);
    execFileSync('tar',['-xzf',archive,'-C',cwd]);
  }
  const mcp = new Client({name:'vigilia-test',version:'0.1.0'});
  try {
    await mcp.connect(new StdioClientTransport({command:process.execPath,args:['mcp/dist/server.js'],cwd,env:{ZEN_PLUGIN_FILES:vault}}));
  } catch (err) {
    await rm(temp,{recursive:true,force:true});
    throw err;
  }
  return {note,mcp, async close(){ await mcp.close(); await rm(temp,{recursive:true,force:true}); }};
}

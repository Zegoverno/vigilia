import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
const f = await fixture({packed:true});
try {
  const call = (name,args={}) => f.mcp.callTool({name,arguments:args});
  const open = await call('vigilia_open',{section:'rotinas'});
  assert.equal(open.structuredContent.section,'rotinas');
  assert.equal((await f.mcp.listTools()).tools.find(t=>t.name==='vigilia_open')._meta.ui.resourceUri,'ui://vigilia/app');
  const {contents} = await f.mcp.readResource({uri:'ui://vigilia/app'});
  assert.match(contents[0].text,/<title>Vigília<\/title>/);
  assert.deepEqual((await call('vigilia_today')).structuredContent.notes.map(x=>x.path),[f.note]);
  assert.match((await call('vigilia_read',{path:f.note})).structuredContent.markdown,/Palavra para rezar/);
  for (const path of ['../x.vigilia.md','/tmp/x.vigilia.md','escape.vigilia.md','escape-directory/secret.vigilia.md','large.vigilia.md','fifo.vigilia.md','Vigilia/note.md','.x/note.vigilia.md']) {
    assert.equal((await call('vigilia_read',{path})).isError,true,path);
  }
  console.log('Packed MCP: widget, HTML resource, today, file opener and rejected paths OK');
} finally { await f.close(); }

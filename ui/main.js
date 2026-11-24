import { App } from '@modelcontextprotocol/ext-apps';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import catalog from '../catalog.json';
import data from '../content.json';
import angelusText from '../routines/data/texts/angelus.md?raw';
import reginaText from '../routines/data/texts/regina-caeli.md?raw';
import joseText from '../routines/data/texts/sao-jose-trabalho.md?raw';
import exameQuestions from '../routines/data/texts/exame.json';
import opusSources from '../routines/data/exame/sources/opusdei-faus.json';
import ricardoSources from '../routines/data/exame/sources/padre-paulo-ricardo.json';
import ramalhoSources from '../routines/data/exame/sources/ramalho-cnbb.json';
import './style.css';

const app = new App({name:'Vigília',version:'0.1.0'});
const root = document.querySelector('#app');
const sections = {hoje:'Hoje', biblioteca:'Biblioteca', rotinas:'Rotinas'};
const day = () => new Intl.DateTimeFormat('pt-BR', {
  timeZone:'America/Sao_Paulo',weekday:'long',day:'numeric',month:'long',
}).format(new Date());
let section = 'hoje', selected, connection = window.parent === window ? 'standalone' : 'connecting';
let notePath, today, notice, target, startDate, todayError;
// The Home card (zen host context `slot: "widget"`): the routines zenbot runs for Vigília, given as
// `zen.routines` (only this plugin's jobs), and the text of the one opened.
let widget = false, routines = [], zone = 'America/Sao_Paulo', opened = null;
const top = () => root.querySelector('h1')?.focus();

function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,v);
  return node;
}
const button = (text, action, attrs) => {
  const node = el('button',text,{type:'button',...attrs});
  node.onclick = action;
  return node;
};
function link(node, url) {
  node.href = url;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  if (connection === 'ready') node.onclick = e => {
    e.preventDefault();
    app.openLink({url}).then(r=>{if (r.isError) throw Error();}).catch(() => {notice = 'Não foi possível abrir o link.'; render();});
  };
}
function source(label,url) {
  const a = el('a',label);
  link(a,url);
  return a;
}
function markdown(value) {
  const node = el('article',null,{class:'prose'});
  node.innerHTML = DOMPurify.sanitize(marked.parse(value), {
    ALLOWED_TAGS:['p','h1','h2','h3','h4','ul','ol','li','b','strong','i','em','hr','br','a','blockquote','code','pre'],
    ALLOWED_ATTR:['href'],
  });
  for (const a of node.querySelectorAll('a')) {
    const url = a.getAttribute('href');
    if (url && /^https?:\/\//i.test(url)) link(a,url);
    else a.replaceWith(a.textContent);
  }
  return node;
}
function go(id) {
  section = id;
  selected = null;
  notice = null;
  render();
  top();
}
async function ask(item, start) {
  const startPart = start ? ` Data de início: ${start}.` : '';
  const request = `Quero configurar a rotina Vigília ${item.id}.${startPart} Use a skill plugin-vigilia-vigilia/agendar. Mostre o plano e confirme horário, destino e se eu quero aplicar antes de alterar qualquer job.`;
  try {
    const reply = await app.sendMessage({role:'user',content:[{type:'text',text:request}]});
    if (reply.isError) throw Error();
    notice = 'Pedido colocado no chat. Revise e envie para continuar.';
  } catch { notice = 'Este host não aceitou o pedido. Abra o chat e peça a rotina manualmente.'; }
  render();
  root.querySelector('[role=status]')?.focus();
}
function card(item, action) {
  const n = el('article',null,{class:'card'});
  n.append(el('small',item.group),el('h2',item.title),el('p',item.summary));
  if (action) n.append(action);
  return n;
}
function library(item) {
  selected = item;
  render();
  top();
}
function prayer(item) {
  const n = el('div',null,{class:'stack'});
  const text = {
    'sao-jose':joseText,
    angelus:angelusText + '\n\n---\n\n## No Tempo Pascal\n\n' + reginaText,
    confissao:data.confissao,novena:data.novena.map((p,i)=>`**Dia ${i+1}** · ${p}`).join('\n\n'),
    exame:Object.entries(exameQuestions).filter(([area])=>!area.startsWith('_')).map(([area,questions])=>'## '+area.replaceAll('_',' ')+'\n\n'+questions.map(q=>'- '+q.q+' — **'+q.fonte+'**').join('\n')).join('\n\n'),
    biblia:data.biblia.map(([ref,chapter])=>`- [${ref}](https://bible.usccb.org/bible/${chapter})`).join('\n'),
    salmo:data.salmo.map(([ref,chapter])=>`- [${ref}](https://bible.usccb.org/bible/${chapter})`).join('\n'),
    santos:Object.entries(data.santos).map(([date,name])=>`- ${date.slice(3)}/${date.slice(0,2)} · ${name}`).join('\n'),
  }[item.id];
  if (text) n.append(markdown(text));
  if (item.id === 'exame') for (const s of [...opusSources.sources,...ricardoSources.sources,...ramalhoSources.sources]) n.append(source(s.author+' · '+s.title,s.url));
  if (item.id === 'confissao') n.append(source('Manual de Confissão · Padre Paulo Ricardo',ricardoSources.sources[0].url));
  if (item.source) n.append(source('Consultar fonte',item.source));
  return n;
}
/** The catalog entry a job runs: `vigilia-ID` (the skill's names), `ID-…`, or a known older name. */
const older = {'daily-readings':'leituras', readings:'leituras'};
function routineItem(name) {
  const n = String(name).replace(/^vigilia-/,'');
  const id = older[n] ?? [...catalog].sort((a,b)=>b.id.length-a.id.length).find(i=>n===i.id||n.startsWith(i.id+'-'))?.id;
  return catalog.find(i=>i.id===id) ?? null;
}
const dayKey = d => new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(d);
function when(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(+d)) return null;
  const hm = new Intl.DateTimeFormat('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(d);
  const k = dayKey(d), now = Date.now();
  if (k === dayKey(new Date(now))) return 'hoje, ' + hm;
  if (k === dayKey(new Date(now + 864e5))) return 'amanhã, ' + hm;
  if (k === dayKey(new Date(now - 864e5))) return 'ontem, ' + hm;
  return new Intl.DateTimeFormat('pt-BR',{timeZone:zone,day:'numeric',month:'short'}).format(d) + ', ' + hm;
}
async function openRoutine(r) {
  const item = routineItem(r.name);
  const note = item && today?.notes?.find(n=>n.id===item.id);
  opened = {r, item, note, text:null, error:null};
  render();
  if (!note) return;
  try { opened.text = result(await app.callServerTool({name:'vigilia_read',arguments:{path:note.path}})).markdown; }
  catch (e) { opened.error = e.message; }
  if (opened?.r === r) render();
}
function renderWidget() {
  root.classList.add('widget');
  if (opened) {
    const {r, item, note, text, error} = opened;
    const head = el('div',null,{class:'whead'});
    head.append(button('← Rotinas',()=>{opened=null;render();root.querySelector('.wrow')?.focus();},{class:'quiet'}));
    if (note) head.append(button('Abrir nota',()=>app.openLink({url:'zen://open?path='+encodeURIComponent(note.path)}).catch(()=>{}),{class:'quiet'}));
    root.append(head, el('h2',item?.title || r.name,{tabindex:'-1'}));
    if (note && typeof text === 'string') root.append(markdown(text));
    else if (note) root.append(el('p',error || 'Abrindo a nota de hoje…',{role:'status'}));
    else {
      const last = when(r.last_run_at);
      root.append(el('p',(r.next ? 'A nota de hoje chega ' + when(r.next) + '.' : 'Ainda não há nota de hoje.') + (last ? ' Última: ' + last + '.' : ''),{class:'wmeta'}));
      if (item) root.append(prayer(item));
    }
    root.querySelector('h2')?.focus();
    return;
  }
  const active = routines.filter(r=>r.state==='active');
  if (!active.length) {
    root.append(el('p',connection==='ready' ? 'Nenhuma rotina ativa. Peça no chat para agendar uma.' : 'Abrindo…',{class:'wmeta'}));
    return;
  }
  const list = el('ul',null,{class:'wlist','aria-label':'Rotinas ativas'});
  for (const r of active.sort((a,b)=>String(a.next).localeCompare(String(b.next)))) {
    const item = routineItem(r.name);
    const hasNote = item && today?.notes?.some(n=>n.id===item.id);
    const row = button('',()=>openRoutine(r),{class:'wrow'});
    const next = when(r.next);
    const state = r.last==='error' ? ' · falhou' : hasNote ? ' · nota de hoje' : '';
    row.append(el('span',item?.title || r.name,{class:'wt'}),el('span',(next ? 'próxima ' + next : r.when || '') + state,{class:'wd' + (r.last==='error' ? ' bad' : '')}));
    const li = el('li'); li.append(row); list.append(li);
  }
  root.append(list);
}
function render() {
  root.replaceChildren();
  if (widget) return renderWidget();
  const header = el('header',null,{class:'mast'});
  header.append(el('span','VIGÍLIA',{class:'brand'}), el('span',day(),{class:'date'}));
  root.append(header);
  if (notePath) {
    root.append(el('h1','Nota de Vigília',{tabindex:'-1'}));
    if (typeof target?.markdown === 'string') root.append(markdown(target.markdown));
    else root.append(el('p',target?.error || 'Abrindo nota…',{role:'status'}));
    return;
  }
  const nav = el('nav',null,{'aria-label':'Seções'});
  for (const [id,label] of Object.entries(sections)) nav.append(button(label,()=>go(id),{'aria-current':id===section?'page':'false'}));
  root.append(nav);
  const h = el('div',null,{class:'intro'});
  const title = selected?.title || {hoje:'Para hoje',biblioteca:'Biblioteca',rotinas:'Suas rotinas'}[section];
  h.append(el('h1',title,{tabindex:'-1'}),el('p',selected?.summary || {
    hoje:'Um tempo para a oração no meio do dia.',
    biblioteca:'Orações, Escritura e preparações para rezar no seu ritmo.',
    rotinas:'Escolha o que deseja receber. O agendamento é combinado no chat.',
  }[section]));
  root.append(h);
  const status = el('p',notice,{role:'status',tabindex:'-1',class:'notice'});
  status.hidden = !notice;
  root.append(status);
  if (selected) {
    root.append(button('← Biblioteca',()=>go('biblioteca'),{class:'quiet'}),prayer(selected));
    return;
  }
  const grid = el('div',null,{class:'grid'});
  if (section === 'hoje') {
    const records = today?.notes ?? [];
    if (records.length) for (const n of records) {
      grid.append(card(catalog.find(i=>i.id===n.id),button('Ler nota',async ()=>{
        try { const r = await app.openLink({url:'zen://open?path='+encodeURIComponent(n.path)}); if (r.isError) throw Error(); }
        catch {notice='Este host não abriu a nota.';render();}
      })));
    } else {
      const empty = el('div',null,{class:'empty'});
      empty.append(el('small','NO COFRE'),el('h2', connection==='connecting'||(connection==='ready'&&!today&&!todayError) ?
        'Buscando as notas de hoje…' : todayError ? 'Não foi possível consultar o cofre' : 'Nenhuma nota de hoje por aqui'),
        el('p','Você pode rezar agora pela biblioteca ou preparar uma rotina.'));
      empty.append(button('Abrir biblioteca',()=>go('biblioteca'),{class:'quiet'}));
      root.append(empty);
    }
    for (const id of ['sao-jose','angelus','confissao']) if (!records.some(r=>r.id===id)) {
      const item = catalog.find(x=>x.id===id);
      grid.append(card(item,button('Consultar',()=>{section='biblioteca';library(item);})));
    }
  }
  if (section === 'biblioteca') for (const item of catalog) grid.append(card(item,button('Consultar',()=>library(item))));
  if (section === 'rotinas') {
    if (connection !== 'ready') root.append(el('p','Abra o painel no zenbot para pedir agendamentos.',{class:'empty'}));
    for (const item of catalog.filter(x=>x.time)) {
      const form = el('div',null,{class:'schedule'});
      form.append(el('span',item.time+' · horário sugerido (São Paulo)'));
      const b = button('Pedir agendamento',()=>ask(item,item.id==='novena'?startDate:null));
      b.disabled = connection !== 'ready' || (item.id==='novena' && !startDate);
      if (item.id==='novena') {
        const label = el('label','Início da novena');
        const input = el('input',null,{type:'date'});
        input.value = startDate ?? '';
        input.oninput = () => {startDate = input.value; b.disabled = !startDate || connection!=='ready';};
        label.append(input);
        form.append(label);
      }
      form.append(b);
      grid.append(card(item,form));
    }
  }
  root.append(grid);
}

function result(r) {
  if (r.isError) throw Error(r.content?.[0]?.text || 'A ferramenta não respondeu.');
  return r.structuredContent;
}
function context(ctx) {
  if (ctx?.theme) document.documentElement.dataset.theme = ctx.theme;
  const was = widget, before = JSON.stringify(routines);
  widget = ctx?.zen?.slot === 'widget';
  if (Array.isArray(ctx?.zen?.routines)) routines = ctx.zen.routines.filter(r=>r && typeof r.name === 'string');
  if (typeof ctx?.timeZone === 'string') zone = ctx.timeZone;
  // Size and theme changes come often: redraw the card only when it or its routines change.
  if (widget) { if (!was || before !== JSON.stringify(routines)) render(); return; }
  const path = ctx?.zen?.slot === 'opener' ? ctx.zen.path : null;
  if (path !== notePath) {
    notePath = path;
    target = null;
    render();
  }
}
async function read(path) {
  let value;
  try { value = result(await app.callServerTool({name:'vigilia_read',arguments:{path}})); }
  catch (e) {value = {error:e.message};}
  if (path === notePath) {target=value; render();}
}
app.onhostcontextchanged = changed => {
  const previous = notePath;
  context({...app.getHostContext(),...changed});
  if (connection === 'ready' && notePath && previous !== notePath) read(notePath);
};
app.ontoolresult = r => {
  if (Object.hasOwn(sections, r.structuredContent?.section)) go(r.structuredContent.section);
};
const send = (method,params) => app.notification({method,params}).catch(()=>{});
app.fallbackNotificationHandler = async ({method,params}) => {
  if (method==='zen/command' && Object.hasOwn(sections,params?.id) && !notePath) go(params.id);
  if (method==='zen/focus' && params?.focused) top();
};
document.addEventListener('keydown',e=>{
  const typing = e.target.matches?.('input, textarea, [contenteditable]');
  if (connection==='ready' && !e.defaultPrevented && (!typing || e.ctrlKey || e.metaKey)) {
    send('zen/key',{key:e.key,code:e.code,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey,alt:e.altKey,typing:!!typing});
  }
});
render();
if (connection === 'connecting') {
  app.connect().then(async ()=>{
    connection = 'ready';
    context(app.getHostContext());
    render();
    if (notePath) read(notePath);
    else {
      if (!widget) send('zen/commands',{commands:Object.entries(sections).map(([id,title])=>({id,title,ring:true}))});
      try {today = result(await app.callServerTool({name:'vigilia_today',arguments:{}}));}
      catch {todayError = true;}
      render();
    }
  }).catch(()=>{connection='standalone';render();});
}

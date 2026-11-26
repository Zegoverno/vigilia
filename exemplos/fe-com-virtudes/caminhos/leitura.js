(() => {
 const config=document.currentScript.dataset, root=config.root, key='fcv:leitura:'+root, path=location.pathname;
 const get=(key)=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
 const set=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true}catch{return false}};
 const shelf=document.querySelector('.shelf');
 if(shelf){
  for(const card of shelf.querySelectorAll('article')){
   const a=card.querySelector('a'),k='fcv:leitura:'+new URL(a.href).pathname,saved=get(k+':marcado')||get(k);
   if(saved&&saved.url&&saved.url.startsWith(new URL(a.href).pathname)){
    const resume=document.createElement('a');resume.className='fcv-resume';resume.textContent='Continuar leitura →';resume.href=saved.url;resume.addEventListener('click',()=>{try{sessionStorage.setItem('fcv:resume',saved.url)}catch{}});card.append(resume);
   }
  }return;
 }
 const library=document.createElement('a');library.href='/vigilia/exemplos/fe-com-virtudes/caminhos/biblioteca/';library.className='fcv-library';library.textContent='← Biblioteca';library.setAttribute('aria-label','Voltar à biblioteca');document.body.append(library);
 const bar=document.createElement('div');bar.className='fcv-tools';
 const status=document.createElement('span');status.setAttribute('role','status');status.className='fcv-status';
 const resume=document.createElement('a');resume.textContent='Continuar leitura →';resume.hidden=true;
 const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;return b};
 const url=()=>location.pathname+location.hash;
 const active=()=>!!document.querySelector('.reader-page,.leaf:not([hidden])');
 const save=()=>{if(!active())return false;return set(key,{url:url(),y:Math.round(scrollY)})};
 const explicit=key+':marcado', marks=[];
 const savedPoint=()=>get(explicit)||get(key);
 function marker(point){
  const b=button('',()=>{
   const dest=point(),old=get(explicit),same=old?.url===dest.url&&Math.abs((old.y||0)-dest.y)<5&&JSON.stringify(old.point)===JSON.stringify(dest.point);
   if(set(explicit,same?null:dest)){status.textContent=same?'Marcador removido.':'Ponto marcado neste navegador.';refresh();}
   else status.textContent='Não foi possível guardar o marcador.';
  });
  b.className='fcv-mark';
  b.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  marks.push([b,point]);return b;
 }
 const pin=document.createElement('span');pin.className='fcv-pin';pin.hidden=true;pin.setAttribute('aria-hidden','true');
 const reader=()=>document.querySelector('.reader-page,.leaf:not([hidden])');
 const blocks=()=>[...(reader()?.querySelectorAll('p,li,h2,h3,h4,blockquote')||[])];
 const guide=()=>Math.round(innerHeight*.43);
 function textPoint(){
  const r=reader()?.getBoundingClientRect(),y=guide();
  if(!r)return null;
  const sel=getSelection(),selected=sel?.rangeCount&&!sel.isCollapsed?sel.getRangeAt(0):null;
  let node=selected?.startContainer,offset=selected?.startOffset;
  if(!reader().contains(node)){
   for(const dy of [0,8,-8,18,-18,32,-32]){
    const hit=document.caretRangeFromPoint?.(Math.max(1,r.left+Math.min(75,r.width*.24)),y+dy);
    if(hit?.startContainer.nodeType===3&&reader().contains(hit.startContainer)){node=hit.startContainer;offset=hit.startOffset;break;}
   }
  }
  const block=node?.parentElement?.closest('p,li,h2,h3,h4,blockquote'), index=blocks().indexOf(block);
  if(index<0||node.nodeType!==3)return null;
  const range=document.createRange();range.selectNodeContents(block);range.setEnd(node,offset);
  return {index,offset:range.toString().length};
 }
 function line(point){
  const block=blocks()[point?.index];if(!block)return null;
  const walk=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let n,offset=point.offset;
  while((n=walk.nextNode())){
   if(offset>n.length){offset-=n.length;continue;}
   if(!n.length)continue;
   const range=document.createRange(),i=Math.min(offset,n.length-1);
   range.setStart(n,i);range.setEnd(n,i+1);
   return range.getBoundingClientRect();
  }return null;
 }
 const bookmark=marker(()=>({url:url(),y:Math.round(scrollY),point:textPoint()}));
 pin.append(bookmark.querySelector('svg').cloneNode(true));
 bookmark.addEventListener('pointerdown',e=>e.preventDefault());
 bar.append(bookmark,resume,status);
 const main=document.querySelector('main');if(!main)return;
 (document.querySelector('.reader-layout')||main).before(bar);
 document.body.append(pin);
 function placePin(){
  const saved=get(explicit),r=reader()?.getBoundingClientRect();
  const rect=saved?.url===url()&&saved.point?line(saved.point):null;
  pin.hidden=!saved||saved.url!==url()||!r;
  if(!pin.hidden){pin.style.top=(rect?scrollY+rect.top+rect.height/2:saved.y+guide())+'px';pin.style.left=Math.min(document.documentElement.clientWidth-20,scrollX+r.right+4)+'px';}
 }
 addEventListener('resize',placePin);
 function refresh(){
  const saved=savedPoint();
  for(const [b,point] of marks){
   const savedUrl=get(explicit)?.url;const pressed=!!savedUrl&&decodeURI(savedUrl)===decodeURI(point().url);
   const label="Marcar linha de leitura";
   b.setAttribute("aria-pressed",String(pressed));b.setAttribute("aria-label",label);b.title=label;
  }
  resume.hidden=active()||!saved?.url||!saved.url.startsWith(root);
  if(!resume.hidden){resume.href=saved.url;resume.onclick=()=>{try{sessionStorage.setItem('fcv:resume',saved.url)}catch{}}}
  bookmark.hidden=!active();placePin();
 }
 let timer,dirty=false;
 function automatic(){if(dirty){save();dirty=false}}
 function restore(auto=false){
  const marked=get(explicit), saved=auto?marked:savedPoint();let requested='';try{requested=sessionStorage.getItem('fcv:resume')}catch{}
  if(!saved?.url?.startsWith(root)){refresh();return;}
  if(auto||requested===saved.url){
   if(requested===saved.url){try{sessionStorage.removeItem('fcv:resume')}catch{}}
   if(decodeURI(saved.url)!==decodeURI(url())){
    try{sessionStorage.setItem('fcv:resume',saved.url)}catch{}
    location.replace(saved.url);return;
   }
   requestAnimationFrame(()=>{
    const id=location.hash.slice(1);
    const anchor=saved.anchor&&id&&document.getElementById(decodeURIComponent(id));
    const rect=saved.point&&line(saved.point);
    if(rect)scrollTo({top:scrollY+rect.top+rect.height/2-guide(),behavior:'instant'});
    else if(anchor)anchor.scrollIntoView({block:'start',behavior:'instant'});
    else scrollTo({top:saved.y||0,behavior:'instant'});
    placePin();
   });
  }
  refresh();
 }
 const navigation=performance.getEntriesByType('navigation')[0]?.type;
 if(get(explicit))history.scrollRestoration='manual';
 if(navigation==='reload')addEventListener('load',()=>restore(true),{once:true});
 restore(!location.hash&&(path===root||navigation==='reload')||navigation==='reload');
 addEventListener('pageshow',e=>{if(e.persisted)restore(true)});
 addEventListener('scroll',()=>{if(!active())return;dirty=true;clearTimeout(timer);timer=setTimeout(automatic,200)},{passive:true});
 addEventListener('hashchange',()=>{dirty=false;clearTimeout(timer);restore()});
 addEventListener('pagehide',automatic);
})();

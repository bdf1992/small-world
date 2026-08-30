'use strict';

const COLORS = ['#35234f','#e75b38','#b64396','#b88a53','#67ddcf','#3577bc','#d7a52c','#82c6e9'];
const DEPTH_NAMES = ['World','Biome','POI','Encounter','Detail'];
let state = null;
let running = false;
let timer = null;

const $ = (id) => document.getElementById(id);
const sum = (values) => values.reduce((a,b) => a + Number(b || 0), 0);
const entries = (vector) => state.elements.map((name, index) => [name, Number(vector?.[name] ?? 0), index]);
const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

async function request(action = '', params = {}) {
  const query = new URLSearchParams(params);
  const suffix = action ? `/${action}` : '';
  const response = await fetch(`/api/simulation${suffix}${query.size ? `?${query}` : ''}`, { method: action ? 'POST' : 'GET' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `simulation request failed: ${response.status}`);
  state = payload;
  render();
  return payload;
}

function vectorArray(vector) { return state.elements.map((name) => Number(vector?.[name] ?? 0)); }
function argmax(values) { let best = 0; for (let i=1;i<values.length;i++) if (values[i] > values[best]) best = i; return best; }
function rootColor(root) { let h = 0; for (const ch of String(root ?? 'none')) h = ((h << 5) - h + ch.charCodeAt(0)) | 0; return `hsl(${Math.abs(h)%360} 58% 58%)`; }
function mixHex(hex, k) { const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255,q=v=>Math.round(v*k+10*(1-k));return `rgb(${q(r)},${q(g)},${q(b)})`; }
function pointInPoly(p, poly) { let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-30)+a.x))inside=!inside;}return inside; }
function cellBy(field, id) { return field.cells.find((cell) => cell.id === id); }
function selectedCell() { return state?.selected?.cell ?? null; }

function frontierIds(field) {
  const resolved = new Set(field.cells.filter((c)=>c.resolved).map((c)=>c.id));
  return new Set(field.cells.filter((c)=>!c.resolved && c.neighbors.some((id)=>resolved.has(id))).map((c)=>c.id));
}

function w2c(canvas, point) {
  const s = canvas.width * .445;
  return { x: canvas.width/2 + point.x*s, y: canvas.height/2 + point.y*s };
}

function pathPoly(ctx, canvas, poly) {
  if (!poly.length) return;
  ctx.beginPath();
  let p=w2c(canvas,poly[0]);ctx.moveTo(p.x,p.y);
  for(let i=1;i<poly.length;i++){p=w2c(canvas,poly[i]);ctx.lineTo(p.x,p.y);}ctx.closePath();
}

function ringClip(ctx, canvas, field) {
  const c=w2c(canvas,{x:0,y:0}),s=canvas.width*.445;
  ctx.beginPath();ctx.arc(c.x,c.y,field.outerR*s,0,Math.PI*2);
  if(field.innerR>0)ctx.arc(c.x,c.y,field.innerR*s,0,Math.PI*2,true);
  ctx.clip('evenodd');
}

function cellFill(cell, mode) {
  const probability = vectorArray(cell.probability);
  if (mode === 'roots') return cell.resolved ? rootColor(cell.root) : '#0b0910';
  if (mode === 'entropy') {
    const certainty = 1 - Math.min(1, Number(cell.entropy || 0) / Math.log(8));
    const v=Math.round(18+certainty*180);return `rgb(${v},${Math.round(v*.86)},${Math.round(v*1.05)})`;
  }
  if (mode === 'pressure') {
    const p = vectorArray(cell.externalPressure), e=argmax(p); return mixHex(COLORS[e], .28 + .62*Math.min(1,p[e]));
  }
  if (mode === 'time') {
    const p = vectorArray(cell.temporalPressure), total=sum(p);if(!total)return '#0c0a0f';const e=argmax(p);return mixHex(COLORS[e],.25+.70*Math.min(1,total/3));
  }
  if (cell.resolved) return mixHex(COLORS[cell.elementIndex], .76);
  const dom=argmax(probability), certainty=1-Math.min(1,Number(cell.entropy||0)/Math.log(8));return mixHex(COLORS[dom],.12+.35*certainty);
}

function drawWorld() {
  if (!state) return;
  const canvas=$('world'),ctx=canvas.getContext('2d'),mode=$('viewMode').value,selected=selectedCell();
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#050507';ctx.fillRect(0,0,canvas.width,canvas.height);
  const frontiers=state.active.fields.map(frontierIds);
  for(const [fieldIndex,field] of state.active.fields.entries()){
    ctx.save();ringClip(ctx,canvas,field);const frontier=frontiers[fieldIndex];
    for(const cell of field.cells){
      pathPoly(ctx,canvas,cell.polygon);ctx.fillStyle=cellFill(cell,mode);ctx.fill();
      ctx.save();pathPoly(ctx,canvas,cell.polygon);ctx.clip();ctx.globalAlpha=.38;
      for(const dot of cell.preview){const p=w2c(canvas,dot.point);ctx.beginPath();ctx.arc(p.x,p.y,2.4,0,Math.PI*2);ctx.fillStyle=COLORS[dot.elementIndex];ctx.fill();}
      ctx.restore();
      pathPoly(ctx,canvas,cell.polygon);ctx.lineWidth=selected&&selected.zone===cell.zone&&selected.id===cell.id?4:cell.nucleus?2.7:frontier.has(cell.id)?1.5:.75;
      ctx.strokeStyle=selected&&selected.zone===cell.zone&&selected.id===cell.id?'#fff0bd':cell.nucleus?'#e5bd6f':frontier.has(cell.id)?'#76657f':'#251e2b';ctx.stroke();
      if(cell.collision){const p=w2c(canvas,cell.point);ctx.strokeStyle='#c3b1ef';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(p.x-4,p.y-4);ctx.lineTo(p.x+4,p.y+4);ctx.moveTo(p.x+4,p.y-4);ctx.lineTo(p.x-4,p.y+4);ctx.stroke();}
      if(cell.spawns.length){const p=w2c(canvas,cell.point);ctx.beginPath();ctx.arc(p.x,p.y,4+Math.min(4,cell.spawns.length),0,Math.PI*2);ctx.fillStyle='#f4e2b3';ctx.fill();}
    }
    for(const id of field.nuclei){const cell=cellBy(field,id);if(!cell)continue;const p=w2c(canvas,cell.point);ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.strokeStyle='#f1cc7e';ctx.lineWidth=2;ctx.stroke();}
    ctx.restore();
  }
  for(const event of state.active.lastEvents){const field=state.active.fields.find((f)=>f.zone===event.zone);const a=field&&cellBy(field,event.fromCellId),b=field&&cellBy(field,event.toCellId);if(!a||!b)continue;const pa=w2c(canvas,a.point),pb=w2c(canvas,b.point);ctx.strokeStyle=event.collision?'#c7b5f1':rootColor(event.root);ctx.globalAlpha=.42;ctx.lineWidth=event.collision?2.3:1.3;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();ctx.globalAlpha=1;}
  const c=w2c(canvas,{x:0,y:0}),s=canvas.width*.445;
  if(state.active.depth===0){for(const rr of[.34,.68,1]){ctx.beginPath();ctx.arc(c.x,c.y,rr*s,0,Math.PI*2);ctx.strokeStyle=rr===1?'#67506d':'#46384d';ctx.lineWidth=2;ctx.stroke();}ctx.font='600 11px ui-monospace';ctx.textAlign='center';ctx.fillStyle='#bfb2c7';ctx.fillText('CENTER FIELD',c.x,c.y-90);ctx.fillText('BARRIER FIELD',c.x,c.y-235);ctx.fillText('EDGE FIELD',c.x,c.y-365);}else{ctx.beginPath();ctx.arc(c.x,c.y,s,0,Math.PI*2);ctx.strokeStyle='#67506d';ctx.lineWidth=2;ctx.stroke();ctx.font='600 12px ui-monospace';ctx.textAlign='center';ctx.fillStyle='#bfb2c7';ctx.fillText(`${DEPTH_NAMES[Math.min(state.active.depth,DEPTH_NAMES.length-1)].toUpperCase()} FIELD`,c.x,c.y-390);}
}

function drawClock() {
  const canvas=$('clock'),ctx=canvas.getContext('2d'),clock=state.clock,w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=w*.39;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b090e';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#46384d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<60;i++){const a=-Math.PI/2+i*Math.PI*2/60,major=i%5===0,ri=r-(major?15:8);ctx.strokeStyle=major?'#9d91aa':'#3a303f';ctx.lineWidth=major?2:1;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*ri,cy+Math.sin(a)*ri);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}
  for(let i=0;i<12;i++){const a=-Math.PI/2+i*Math.PI*2/12;ctx.fillStyle='#95889e';ctx.font='10px ui-monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i),cx+Math.cos(a)*(r-28),cy+Math.sin(a)*(r-28));}
  const handAngle=-Math.PI/2+clock.tick*Math.PI*2/60;ctx.strokeStyle=clock.side==='Day'?'#e5bd6f':'#c3b1ef';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(handAngle)*(r-36),cy+Math.sin(handAngle)*(r-36));ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill();
  ctx.fillStyle='#ece8f2';ctx.font='600 12px ui-monospace';ctx.textAlign='center';ctx.fillText(`${clock.side} / ${clock.orientation}`,cx,cy+34);
  $('clockReadout').textContent=`cycle ${clock.cycle} · tick ${clock.tick}/60 · position ${clock.position}:${clock.tickInPosition} · address ${clock.address} · phase ${clock.phase.toFixed(2)}`;
}

function renderLegend(){ $('legend').innerHTML=state.elements.map((e,i)=>`<span><i class="sw" style="background:${COLORS[i]}"></i>${e}</span>`).join('')+'<span>·</span><span style="color:#e5bd6f">○ nucleus</span><span style="color:#7a6a85">□ frontier</span><span style="color:#c3b1ef">× collision</span><span>· ✦ spawn</span>'; }

function renderCrumb(){const bits=['World',...state.stack.map((entry)=>`#${entry.selected.id}`)];if(state.active.depth)bits.push(`#${state.active.parentCellId}`);$('crumb').innerHTML=`<b>${DEPTH_NAMES[Math.min(state.active.depth,DEPTH_NAMES.length-1)]}</b> · ${bits.join(' › ')} · active seed <span class="mono">${state.active.seed}</span>`;}

function renderZones(){
  $('zoneSummary').innerHTML=state.active.fields.map((field)=>{const counts=Array(8).fill(0);for(const c of field.cells)if(c.resolved)counts[c.elementIndex]++;const total=Math.max(1,sum(counts));const bars=counts.map((n,e)=>n?`<i style="width:${n/total*100}%;background:${COLORS[e]}"></i>`:'').join('');const collisions=field.cells.filter((c)=>c.collision).length,unique=counts.filter(Boolean).length,dom=Math.max(...counts)/total;return `<div class="zone-summary"><b>${field.zoneName}</b><div class="mini-bar">${bars}</div><span>${field.resolved}/${field.total}</span></div><div class="small" style="margin:-2px 0 5px 79px">${field.nuclei.length} nuclei · ${collisions} collisions · ${unique} elements · max ${(dom*100).toFixed(0)}%</div>`;}).join('')+`<div class="metric-grid"><div class="metric">fingerprint<b>${state.active.digest.slice(0,8)}</b></div><div class="metric">wave<b>${state.active.wave}</b></div><div class="metric">separate graphs<b>${state.root.invariants.separateGraphs?'PASS':'FAIL'}</b></div><div class="metric">edge Δ4<b>${state.root.invariants.edgeOpposition?'PASS':'FAIL'}</b></div></div><div class="small"><span class="tag nucleus">Center</span>${state.root.centerElement}<br><span class="tag depth">Barrier</span>${state.root.barrierElement}<br><span class="tag conflict">Edge</span>${state.root.edgeElement} · ${state.root.rotation}</div>`;
}

function vectorBars(vector){return entries(vector).map(([name,value,index])=>`<div class="grid8"><span>${name}</span><span class="bar"><i style="width:${Math.max(0,Math.min(100,value*100)).toFixed(1)}%;background:${COLORS[index]}"></i></span><span>${(value*100).toFixed(0)}%</span></div>`).join('');}

function topVector(vector,count=3){return entries(vector).sort((a,b)=>b[1]-a[1]).slice(0,count).map(([n,v])=>`${n} ${(v*100).toFixed(0)}%`).join(' · ');}

function renderSelected(){const selected=state.selected;if(!selected){$('selected').innerHTML='Select a visible cell.';return;}const c=selected.cell;$('selected').innerHTML=`<div class="selected-title">${c.zoneName} · cell #${c.id}</div><div class="small">${c.nucleus?'<span class="tag nucleus">nucleus</span>':''}${c.collision?'<span class="tag collision">front collision</span>':''}${c.resolved?`resolved ${c.element}`:`unresolved · H ${c.entropy.toFixed(3)}`} · neighbors ${c.neighbors.length}<br>root ${escapeHtml(c.root??'—')} · collapse wave ${c.collapseWave??'—'}</div><div class="metric-grid"><div class="metric">initial entropy<b>${Number(c.initialEntropy).toFixed(3)}</b></div><div class="metric">current entropy<b>${Number(c.entropy).toFixed(3)}</b></div></div>${vectorBars(c.probability)}<div class="small" style="margin-top:7px"><b>Cyclic seat</b> ${Number(c.cyclicSeat??0).toFixed(2)}<br><b>Static pressure</b> ${topVector(c.externalPressure)}<br><b>Temporal pressure</b> ${c.temporalPressureTotal?topVector(c.temporalPressure):'none'}<br><b>Support updates</b> ${c.supportHits}<br><b>Roots touched</b> ${c.rootsTouched.length?c.rootsTouched.map(escapeHtml).join(' · '):'none yet'}<br><b>Visible recursion</b> ${c.preview.length} deterministic child samples; Dive materializes the conditioned graph.</div>`;}

function renderSpawn(){const selected=state.selected;if(!selected?.cell.resolved){$('spawnExplain').innerHTML='Resolve and select a cell to inspect deterministic spawn scores.';return;}const scores=selected.spawnCandidates,lo=Math.min(...scores.map((s)=>s.score)),hi=Math.max(...scores.map((s)=>s.score));$('spawnExplain').innerHTML=`<div class="small">Clock <span class="mono">${state.clock.address}</span> · ${state.clock.orientation} · current spawn cycle is re-read from world field + temporal phase.</div>${scores.map((s)=>{const width=hi===lo?100:(s.score-lo)/(hi-lo)*85+15;return `<div class="candidate"><span>${s.type}</span><span class="bar"><i style="width:${width}%;background:#8e779d"></i></span><b>${s.score.toFixed(2)}</b></div><div class="small" style="margin:-2px 0 4px 67px">cycle ${s.cycleFit.toFixed(2)} · phase ${s.phaseFit.toFixed(2)} · field ${s.fieldFit.toFixed(2)} · relation ${s.relationFit.toFixed(2)} · seed ${s.random.toFixed(2)}</div>`;}).join('')}`;}

function temporalCard(subject,title){if(!subject)return '';const top=sum(Object.values(subject.glass.top)),bottom=sum(Object.values(subject.glass.bottom)),rate=sum(Object.values(subject.lastRate));const primary=entries(subject.profile).sort((a,b)=>b[1]-a[1])[0]?.[0]??'—';return `<div class="temporal-card"><strong>${title}</strong> ${subject.completed?'<span class="tag good">resolved</span>':''}<div class="small">wants <b>${primary}</b> · Top ${top} → Bottom ${bottom}/${subject.threshold} · rate Σ ${rate.toFixed(2)} · cycles ${subject.cycles}</div>${state.elements.map((e,i)=>{const r=subject.lastRate[e]||0,p=subject.profile[e]||0,t=subject.glass.top[e]||0,b=subject.glass.bottom[e]||0;return(t||b||p>.16)?`<div class="temporal-row"><span style="color:${COLORS[i]}">${e}</span><span class="bar"><i style="width:${Math.min(100,r*55)}%;background:${COLORS[i]}"></i></span><span>${Number(r).toFixed(2)}</span></div>`:'';}).join('')}${subject.lastPulse?`<div class="small pulse">last threshold: ${escapeHtml(subject.lastPulse.type)} @ ${escapeHtml(subject.lastPulse.at)}</div>`:''}</div>`;}

function renderTime(){const selected=state.selected;if(!selected?.cell.resolved){$('timeTransfer').innerHTML='Resolve and select a cell to inspect temporal demand.';return;}const c=selected.cell;$('timeTransfer').innerHTML=`<div class="small"><b>${state.clock.side} / ${state.clock.orientation}</b> · crossed ticks are the invariant time unit.<br><b>Elemental time supply</b> ${topVector(selected.temporalSupply)}<br>Blocked or weakly satisfied demand remains typed by element and diffuses as temporal pressure.</div>${temporalCard(c.biomeTime,'Biome hourglass')}${c.entities.slice(-4).map((e)=>temporalCard(e,`${e.kind} #${e.id}`)).join('')}${c.entities.length>4?`<div class="small">+ ${c.entities.length-4} older temporal entities in this cell</div>`:''}`;}

function renderHourglass(){const h=state.hourglass,top=sum(Object.values(h.top)),bottom=sum(Object.values(h.bottom)),out=sum(Object.values(h.out));$('hourglass').innerHTML=`<div class="small">${h.capacity} grain capacity · ${h.bulb}/${h.bulb} bulbs · Top / Bottom / Out</div><div class="small">Top ${top}/${h.bulb}</div><div class="gauge"><i style="width:${top/h.bulb*100}%"></i></div><div class="small">Bottom ${bottom}/${h.bulb}${bottom>=h.bulb?' · SPEND BLOCKED':''}</div><div class="gauge"><i style="width:${bottom/h.bulb*100}%"></i></div><div class="small">Out ${out} · uncontained</div><div class="hourglass-grid"><div></div><div>Top</div><div>Bottom</div><div>Out</div>${state.elements.map((e,i)=>`<div style="color:${COLORS[i]}">${e}</div><div>${h.top[e]}</div><div>${h.bottom[e]}</div><div>${h.out[e]}</div>`).join('')}</div>`;}

function renderGenerative(){const g=state.generative;$('generativeStatus').textContent=g.status;$('generativeStatus').className=`tag ${g.status==='resolved'?'good':''}`;const objects=g.objects;$('generative').innerHTML=`<div class="small">The RFC field remains the live world surface. This overlay exposes the M0.6 Definition→Template→Reference→Virtual→Instance construction without replacing that surface.</div><div class="generative-grid">${g.map.regions.map((region)=>{const regionObject=objects[region.key],field=region.field,dom=Object.entries(field).sort((a,b)=>b[1]-a[1])[0],child=regionObject.children[0],situation=child?objects[child.key]:null;return `<div class="generative-region"><strong>${escapeHtml(region.label)}</strong><div class="field">${dom?`${escapeHtml(dom[0])} ${(dom[1]*100).toFixed(0)}%`:''}</div>${situation?`<span class="generative-child"><b>${escapeHtml(situation.label)}</b><br>${situation.children.map((m)=>`<span class="generative-member">${escapeHtml(m.role)} → ${escapeHtml(m.label)}</span>`).join('<br>')}</span>`:'<span class="generative-child">unresolved</span>'}</div>`;}).join('')}</div>${g.stops.length?`<div class="frontier">Generative frontier: ${g.stops.map((s)=>escapeHtml(s.reason)).join(' · ')}</div>`:''}`;}

function renderLedger(){$('ledger').innerHTML=state.ledger.slice().reverse().slice(0,80).map((x)=>`<div class="log"><span class="tag">${escapeHtml(x.zoneName??'RFC')}</span><strong>${escapeHtml(x.type)}</strong>${x.cellId!=null?` → cell ${x.cellId}`:''}<div class="small">${escapeHtml(x.at??'')}${x.score!=null?` · score ${x.score.toFixed(3)}`:''}${x.relationFit!=null?` · relation ${x.relationFit.toFixed(2)}`:''}${x.transfer!=null?` · grains moved ${x.transfer}`:''}${x.blocked?` · blocked ${x.blocked}`:''}</div></div>`).join('')||'<div class="small">Generation resolves spatially first. Every clock crossing then progresses biome / Persona / Event hourglasses, diffuses resulting pressure, evaluates cyclic spawn propositions, and advances exactly one tick.</div>';}

function updateStatus(){const done=state.active.fields.reduce((s,f)=>s+f.resolved,0),all=state.active.fields.reduce((s,f)=>s+f.total,0),el=$('status');$('back').disabled=!state.stack.length;$('dive').disabled=!state.selected?.cell.resolved;$('spend').disabled=!state.selected?.cell.resolved;if(state.active.finished){el.className=state.active.depth?'status child':'status ready';el.textContent=`${state.active.depth?'Recursive':'Root'} RFC resolved · ${done}/${all} cells · ${state.active.wave} wave steps · fingerprint ${state.active.digest.slice(0,12)}`;}else{el.className='status running';el.textContent=`RFC wave ${state.active.wave} · ${done}/${all} cells · ${state.active.fields.reduce((s,f)=>s+f.nuclei.length,0)} nuclei · ${state.active.lastEvents.filter((e)=>e.collision).length} collision edges this wave`;} $('toggle').textContent=running?'Pause':state.active.finished?'Replay + Play':'Play';}

function render(){if(!state)return;drawWorld();drawClock();renderLegend();renderCrumb();renderZones();renderSelected();renderSpawn();renderTime();renderHourglass();renderGenerative();renderLedger();updateStatus();}

function stop(){running=false;if(timer){clearTimeout(timer);timer=null;}updateStatus();}
async function playLoop(){if(!running)return;if(state.active.finished){await request('replay');}else{await request('step');}if(state.active.finished){stop();return;}timer=setTimeout(playLoop,Number($('speed').value));}
function start(){if(running){stop();return;}running=true;updateStatus();playLoop().catch((error)=>{stop();showError(error);});}
function showError(error){$('status').className='status';$('status').textContent=error.message;console.error(error);}
async function act(name,params){stop();try{return await request(name,params);}catch(error){showError(error);}}

$('world-controls').addEventListener('submit',(event)=>{event.preventDefault();act('reset',{seed:$('seed').value});});
$('toggle').onclick=start;$('step').onclick=()=>act('step');$('finish').onclick=()=>act('finish');$('dive').onclick=()=>act('dive');$('back').onclick=()=>act('back');$('tick').onclick=()=>act('advance');$('flipClock').onclick=()=>act('flip-clock');$('spend').onclick=()=>act('spend');$('flipGlass').onclick=()=>act('flip-hourglass');$('viewMode').onchange=drawWorld;

const canvas=$('world');
canvas.addEventListener('click',(event)=>{if(!state)return;const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height,s=canvas.width*.445,p={x:(x-canvas.width/2)/s,y:(y-canvas.height/2)/s},rr=Math.hypot(p.x,p.y);let field;if(state.active.depth===0){const zi=rr<.34?0:rr<.68?1:rr<=1?2:-1;if(zi<0)return;field=state.active.fields[zi];}else{if(rr>1)return;field=state.active.fields[0];}const hit=field.cells.find((cell)=>pointInPoly(p,cell.polygon));if(hit)act('select',{zone:hit.zone,id:hit.id});});
canvas.addEventListener('dblclick',()=>{if(state?.selected?.cell.resolved)act('dive');});
document.addEventListener('keydown',(event)=>{if(event.key===' '){event.preventDefault();start();}if(event.key==='ArrowRight')act('step');if(event.key==='Enter'&&state?.selected?.cell.resolved)act('dive');if(event.key==='Escape'&&state?.stack.length)act('back');});

request().catch(showError);

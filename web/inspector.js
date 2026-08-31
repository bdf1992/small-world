'use strict';

(() => {
  let target = { type: 'cell' };
  let tab = 'surface';

  const style = document.createElement('style');
  style.textContent = `
    .inspect-link{font-size:8px;padding:3px 6px;text-transform:uppercase;letter-spacing:.09em;background:transparent;color:#8e8496}
    .inspector-tabs{display:flex;gap:5px;margin:8px 0 10px}.inspector-tabs button{font-size:9px;padding:5px 8px}.inspector-tabs button.active{border-color:#956a36;color:#e7c88c}
    .object-title{font-family:Georgia,"Times New Roman",serif;font-size:16px;color:#ece8f2;margin-bottom:3px}.object-meta{font:9px ui-monospace,SFMono-Regular,Menlo,monospace;color:#807587;margin-bottom:10px;word-break:break-all}
    .object-record{display:grid;gap:5px}.object-row{display:grid;grid-template-columns:100px 1fr;gap:8px;padding:5px 0;border-bottom:1px solid #241e29}.object-row>span:first-child{color:#827688}.object-value{color:#c8becf;word-break:break-word}
    .inspect-vector{display:grid;gap:4px;margin:5px 0 10px}.inspect-vector-row{display:grid;grid-template-columns:60px 1fr 38px;gap:5px;align-items:center}.inspect-vector-row i{height:4px;display:block}.inspect-track{height:4px;background:#29212e;border-radius:3px;overflow:hidden}
    .lineage-list{list-style:none;padding:0;margin:0}.lineage-list li{position:relative;padding:2px 0 13px 18px}.lineage-list li:before{content:'◇';position:absolute;left:0;color:#e5bd6f}.lineage-list li:not(:last-child):after{content:'';position:absolute;left:5px;top:14px;bottom:0;border-left:1px solid #43344b}.lineage-list small{display:block;color:#827688;text-transform:uppercase;letter-spacing:.09em}.lineage-list code{font-size:9px;color:#c8becf}
    .neighbor-list{display:flex;gap:4px;flex-wrap:wrap}.neighbor-link,.inspect-object{font-size:9px;padding:4px 6px;background:#151019}.temporal-card,.generative-region,.generative-child,.generative-member{cursor:pointer}.temporal-card:hover,.generative-region:hover{border-color:#55435f}
    .next-wave-evidence,.topology-evidence{margin-top:8px;padding:7px;border:1px dashed #665472;border-radius:5px;background:#0c0910}.next-wave-evidence strong,.topology-evidence strong{color:#e8d6a7}.next-wave-evidence code,.topology-evidence code{font-size:9px;color:#c8becf}.next-wave-evidence .wave-row,.topology-evidence .wave-row{padding:3px 0;border-bottom:1px solid #241e29}.next-wave-evidence .wave-row:last-child,.topology-evidence .wave-row:last-child{border-bottom:0}
  `;
  document.head.appendChild(style);

  function safeState() {
    try { return state; } catch { return null; }
  }

  function esc(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  }

  function vectorHtml(vector) {
    const s = safeState();
    if (!s || !vector) return '<span class="muted">none</span>';
    return `<div class="inspect-vector">${s.elements.map((name,index)=>{
      const value=Number(vector[name]??0);return `<div class="inspect-vector-row"><span>${esc(name)}</span><span class="inspect-track"><i style="width:${Math.max(0,Math.min(100,value*100))}%;background:${COLORS[index]}"></i></span><span>${(value*100).toFixed(0)}%</span></div>`;
    }).join('')}</div>`;
  }

  function simpleValue(value) {
    if (value === null || value === undefined) return '<span class="muted">none</span>';
    if (Array.isArray(value)) return value.length ? value.map((v)=>esc(typeof v==='object'?JSON.stringify(v):v)).join(' · ') : '<span class="muted">none</span>';
    if (typeof value === 'object') return recordHtml(value);
    return esc(value);
  }

  function recordHtml(record) {
    if (!record || typeof record !== 'object') return simpleValue(record);
    return `<div class="object-record">${Object.entries(record).map(([key,value])=>`<div class="object-row"><span>${esc(key)}</span><span class="object-value">${simpleValue(value)}</span></div>`).join('')}</div>`;
  }

  function lineageHtml(lineage) {
    if (!lineage?.length) return '<span class="muted">No lineage exposed.</span>';
    return `<ol class="lineage-list">${lineage.map((step)=>`<li><small>${esc(step.stage)}</small><code>${esc(step.id)}</code></li>`).join('')}</ol>`;
  }

  function cellObject() {
    const s=safeState(),c=s?.selected?.cell;if(!c)return null;
    const next=s.selected?.mapField?.nextWave ?? null;
    const topology=s.selected?.mapField?.topologyProvenance ?? null;
    return {
      kind:'Field/Cell',label:`${c.zoneName} · cell #${c.id}`,id:`${s.active.path}:${c.zone}:${c.id}`,
      surface:{resolved:c.resolved,element:c.element,entropy:c.entropy,nucleus:c.nucleus,collision:c.collision,root:c.root,collapseWave:c.collapseWave,cyclicSeat:c.cyclicSeat,staticPressure:c.externalPressure,temporalPressure:c.temporalPressure,spawns:c.spawns,entities:c.entities.map((e)=>`${e.kind} #${e.id}`)},
      possibility:{probability:c.probability,fieldVector:c.fieldVector,topology,nextWave:next?{predictedWave:next.predictedWave,frontier:next.frontier,proposals:next.proposals,collapse:next.collapse,fallback:next.fallback}:null,childPreview:c.preview.map((p)=>`${p.element} @ ${p.point.x.toFixed(2)},${p.point.y.toFixed(2)}`)},
      lineage:[{stage:'world',id:s.active.path},{stage:'field',id:`${c.zoneName}/${c.zone}`},{stage:c.nucleus?'nucleus':'cell',id:String(c.id)},...(c.rootsTouched||[]).map((id)=>({stage:'root touched',id})),...(c.collapseWave!=null?[{stage:'collapse wave',id:String(c.collapseWave)}]:[])],
      neighbors:c.neighbors,
      zone:c.zone,
    };
  }

  function clockObject(){const s=safeState();if(!s)return null;return {kind:'Instrument/Clock',label:'World Clock',id:s.clock.address,surface:s.clock,possibility:{relationshipFrame:`${s.clock.side} / ${s.clock.orientation}`,relationField:s.relationField.slice(0,16).map((r)=>`${r.from}→${r.to}: ${r.relation} ${r.weight.toFixed(2)}`)},lineage:[{stage:'definition',id:'instrument.clock'},{stage:'template',id:'clock.standard'},{stage:'runtime address',id:s.clock.address}]};}
  function hourglassObject(){const s=safeState();if(!s)return null;return {kind:'Instrument/Hourglass',label:'Player Hourglass',id:'player.hourglass',surface:s.hourglass,possibility:{spendable:Object.fromEntries(s.elements.map((e)=>[e,(s.hourglass.top[e]??0)>0]))},lineage:[{stage:'instrument',id:'hourglass'},{stage:'owner',id:'player'},{stage:'runtime',id:s.clock.address}]};}

  function temporalObject(subject,label){const s=safeState();if(!subject||!s)return null;return {kind:`Temporal/${subject.kind}`,label,id:`${subject.kind}:${subject.id??'biome'}`,surface:{completed:subject.completed,threshold:subject.threshold,cycles:subject.cycles,activations:subject.activations,lastPulse:subject.lastPulse,glass:subject.glass},possibility:{wantedTime:subject.profile,currentTransferRate:subject.lastRate},lineage:[{stage:'world',id:s.active.path},{stage:'cell',id:String(s.selected?.cell?.id??'—')},{stage:'temporal subject',id:`${subject.kind}:${subject.id??'biome'}`}]};}

  function generativeObject(key){const s=safeState(),o=s?.generative?.objects?.[key];if(!o)return null;return {kind:o.kind,label:o.label,id:o.id,surface:o.facts,possibility:o.possibilities,lineage:o.lineage};}

  function resolveObject(){const s=safeState();if(!s)return null;if(target.type==='cell')return cellObject();if(target.type==='clock')return clockObject();if(target.type==='hourglass')return hourglassObject();if(target.type==='biome-time')return temporalObject(s.selected?.cell?.biomeTime,'Biome Hourglass');if(target.type==='entity')return temporalObject(s.selected?.cell?.entities?.[target.index],`${s.selected?.cell?.entities?.[target.index]?.kind??'Entity'} #${s.selected?.cell?.entities?.[target.index]?.id??'—'}`);if(target.type==='generative')return generativeObject(target.key);return null;}

  function renderInspector(){const s=safeState(),panel=document.getElementById('objectInspector'),kind=document.getElementById('inspectorKind');if(!panel||!kind)return;const object=resolveObject();if(!object){kind.textContent='none';panel.innerHTML='<span class="muted">Select an object to inspect.</span>';return;}kind.textContent=object.kind;let content=tab==='surface'?recordHtml(object.surface):tab==='possibility'?(object.kind==='Field/Cell'?`<h3>Probability</h3>${vectorHtml(object.possibility.probability)}<h3>Contextual field</h3>${vectorHtml(object.possibility.fieldVector)}${recordHtml({topology:object.possibility.topology,nextWave:object.possibility.nextWave,childPreview:object.possibility.childPreview})}`:recordHtml(object.possibility)):lineageHtml(object.lineage);const neighbors=object.neighbors?.length?`<div class="object-row"><span>adjacent graph</span><span class="neighbor-list">${object.neighbors.map((id)=>`<button class="neighbor-link" data-neighbor="${id}" data-zone="${object.zone}">#${id}</button>`).join('')}</span></div>`:'';panel.innerHTML=`<div class="object-title">${esc(object.label)}</div><div class="object-meta">${esc(object.id)}</div>${neighbors}${content}`;panel.querySelectorAll('.neighbor-link').forEach((button)=>button.onclick=()=>act('select',{zone:button.dataset.zone,id:button.dataset.neighbor}));document.querySelectorAll('[data-inspector-tab]').forEach((button)=>button.classList.toggle('active',button.dataset.inspectorTab===tab));}

  function selectedTopologyHtml(){
    const s=safeState(),topology=s?.selected?.mapField?.topologyProvenance;if(!topology)return '';
    const p=topology.point,n=topology.nucleus;
    const seeded=p.u==null?'canonical':`u ${Number(p.u).toFixed(4)} · v ${Number(p.v).toFixed(4)}`;
    const nucleus=n?`<div class="wave-row"><strong>Nucleus origin</strong> #${n.ordinal} · root <code>${esc(n.root)}</code><br>target ${esc(n.targetElement)} → selected <b>${esc(n.selectedElement)}</b></div>`:'';
    return `<div class="topology-evidence"><div class="eyebrow">map topology provenance</div><div class="wave-row"><strong>Point</strong> ${esc(p.mode)} · ${seeded}<br><code>${Number(p.point.x).toFixed(5)}, ${Number(p.point.y).toFixed(5)}</code></div><div class="wave-row"><strong>Shape</strong> ${topology.polygonVertexCount} Voronoi vertices · ${topology.neighbors.length} admitted neighbors<br>128-vertex outer boundary · nearest-site half-plane clipping · annulus crossing guard 0.985</div>${nucleus}<div class="small"><code>${esc(topology.source)}</code></div></div>`;
  }

  function selectedWaveHtml() {
    const s=safeState(), next=s?.selected?.mapField?.nextWave;
    if(!next)return '';
    const rows=[];
    if(next.frontier)rows.push(`<div class="wave-row"><strong>Frontier</strong> · H ${Number(next.frontier.entropy).toFixed(3)} · roots ${next.frontier.rootsTouched.map(esc).join(' + ')}</div>`);
    for(const proposal of next.proposals)rows.push(`<div class="wave-row"><strong>Root proposal</strong> <code>${esc(proposal.root)}</code> · pick ${Number(proposal.pickScore).toFixed(6)}</div>`);
    if(next.collapse){const c=next.collapse;rows.push(`<div class="wave-row"><strong>Predicted collapse</strong> → <b>${esc(c.predictedElement)}</b>${c.collision?' · collision':''} · wave ${c.predictedCollapseWave}<br>selected by <code>${esc(c.selectedByRoot)}</code> · roots ${c.rootsTouched.map(esc).join(' + ')}<br>${c.propagation.length} unresolved neighbor${c.propagation.length===1?'':'s'} receive relation support after this collapse.</div>`);}
    if(next.fallback)rows.push(`<div class="wave-row"><strong>Fallback nucleus</strong> → ${esc(next.fallback.predictedElement)} · wave ${next.fallback.predictedCollapseWave}</div>`);
    return `<div class="next-wave-evidence"><div class="eyebrow">read-only next-wave evidence</div>${rows.join('')}<div class="small">Current wave ${next.currentWave} → predicted ${next.predictedWave}. Step Wave remains the only mutation.</div></div>`;
  }

  function renderEvidenceDisclosure(){const selected=document.getElementById('selected');if(!selected)return;selected.querySelectorAll('.topology-evidence,.next-wave-evidence').forEach((node)=>node.remove());const topology=selectedTopologyHtml(),wave=selectedWaveHtml();if(topology)selected.insertAdjacentHTML('beforeend',topology);if(wave)selected.insertAdjacentHTML('beforeend',wave);}

  function mapPoint(canvas, point) {
    const scale=canvas.width*.445;
    return {x:canvas.width/2+point.x*scale,y:canvas.height/2+point.y*scale};
  }

  function projectedCell(field, id){return field?.cells?.find((cell)=>cell.id===id)??null;}

  function drawWaveOverlay(){
    const s=safeState(),canvas=document.getElementById('world'),mode=document.getElementById('viewMode')?.value;
    if(!s||!canvas||mode!=='roots'||!s.active?.nextWave)return;
    const ctx=canvas.getContext('2d');ctx.save();
    for(const waveField of s.active.nextWave.fields){
      const field=s.active.fields.find((candidate)=>candidate.zone===waveField.zone);if(!field)continue;
      for(const item of waveField.frontier){const cell=projectedCell(field,item.cellId);if(!cell)continue;const p=mapPoint(canvas,cell.point);ctx.strokeStyle='#75647f';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(p.x-5,p.y-5,10,10);}
      for(const item of waveField.selectedCollapses){const cell=projectedCell(field,item.cellId);if(!cell)continue;const p=mapPoint(canvas,cell.point),color=COLORS[item.predictedElementIndex]??'#e8d6a7';ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash([6,4]);ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.stroke();if(item.collision){ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(p.x-7,p.y-7);ctx.lineTo(p.x+7,p.y+7);ctx.moveTo(p.x+7,p.y-7);ctx.lineTo(p.x-7,p.y+7);ctx.stroke();}}
      if(waveField.fallback){const cell=projectedCell(field,waveField.fallback.cellId);if(cell){const p=mapPoint(canvas,cell.point);ctx.strokeStyle='#e5bd6f';ctx.lineWidth=2;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(p.x,p.y-10);ctx.lineTo(p.x+10,p.y);ctx.lineTo(p.x,p.y+10);ctx.lineTo(p.x-10,p.y);ctx.closePath();ctx.stroke();}}
    }
    ctx.restore();
  }

  function bindInspectableChildren(){const s=safeState();if(!s)return;document.querySelectorAll('[data-inspect]').forEach((button)=>button.onclick=()=>{target={type:button.dataset.inspect};tab='surface';renderInspector();});const cards=[...document.querySelectorAll('#timeTransfer .temporal-card')];cards.forEach((card,index)=>{card.onclick=()=>{target=index===0?{type:'biome-time'}:{type:'entity',index:index-1};tab='surface';renderInspector();};});const regions=[...document.querySelectorAll('#generative .generative-region')];regions.forEach((element,index)=>{const region=s.generative.map.regions[index];if(!region)return;element.onclick=(event)=>{event.stopPropagation();target={type:'generative',key:region.key};tab='surface';renderInspector();};const child=region.children?.[0];const situation=child&&s.generative.objects[child.key];const childElement=element.querySelector('.generative-child');if(childElement&&situation){childElement.onclick=(event)=>{event.stopPropagation();target={type:'generative',key:child.key};tab='surface';renderInspector();};const members=[...childElement.querySelectorAll('.generative-member')];members.forEach((member,memberIndex)=>{const ref=situation.children?.[memberIndex];if(ref)member.onclick=(event)=>{event.stopPropagation();target={type:'generative',key:ref.key};tab='surface';renderInspector();};});}});}

  function refreshInspectorLayer(){bindInspectableChildren();renderEvidenceDisclosure();renderInspector();drawWaveOverlay();}

  document.querySelectorAll('[data-inspector-tab]').forEach((button)=>button.onclick=()=>{tab=button.dataset.inspectorTab;renderInspector();});
  const observer=new MutationObserver(refreshInspectorLayer);
  const status=document.getElementById('status');if(status)observer.observe(status,{childList:true,subtree:true,characterData:true});
  const viewMode=document.getElementById('viewMode');if(viewMode)viewMode.addEventListener('change',()=>setTimeout(drawWaveOverlay,0));
  setTimeout(refreshInspectorLayer,0);
})();

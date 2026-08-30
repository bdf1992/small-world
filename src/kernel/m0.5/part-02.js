  return field;
}
function createWorld(seed){
  const centerElement=Math.floor(rand(seed,'center-element')*8);
  const rotation=rand(seed,'world-rotation')<.5?-1:1;
  const centerProfile=profileAround(seed,centerElement,'center-profile');
  const barrierElement=wrap8(centerElement+rotation*2);
  const oppositeElement=wrap8(centerElement+4);
  const barrierProfile=mixVec(rotate(centerProfile,rotation*2),profileAround(seed,barrierElement,'barrier-profile'),.28);
  const edgeProfile=mixVec(rotate(centerProfile,4),profileAround(seed,oppositeElement,'edge-profile'),.24);
  const edgeAngle=-Math.PI/2+rand(seed,'edge-canonical-angle')*Math.PI*2;
  const context={centerProfile,edgeProfile,barrierProfile,edgeAngle,rotation};
  const fields=[
    makeField(seed,{zone:0,innerR:0,outerR:.34,count:13,baseProfile:centerProfile,canonicalElement:centerElement,context,depth:0,path:'root',rotation,nucleusCount:3}),
    makeField(seed,{zone:1,innerR:.34,outerR:.68,count:25,baseProfile:barrierProfile,canonicalElement:barrierElement,context,depth:0,path:'root',rotation,nucleusCount:4}),
    makeField(seed,{zone:2,innerR:.68,outerR:1,count:34,baseProfile:edgeProfile,canonicalElement:oppositeElement,context,depth:0,path:'root',edgeAngle,rotation,nucleusCount:3})
  ];
  return{seed,rootSeed:seed,depth:0,path:'root',parent:null,rotation,centerElement,barrierElement,oppositeElement,centerProfile,edgeProfile,barrierProfile,edgeAngle,context,fields,finished:false,wave:0,lastEvents:[]};
}
function fieldVector(c){
  const one=Array(8).fill(0);if(c.resolved)one[c.element]=1;
  const spawnSum=sum(c.spawnField),spawn=spawnSum?norm(c.spawnField):Array(8).fill(1/8);
  const timeSum=sum(c.temporalPressure||[]),time=timeSum?norm(c.temporalPressure):Array(8).fill(1/8);
  if(c.resolved)return norm(c.prior.map((p,e)=>.30*p+.36*one[e]+.14*c.external[e]+.08*spawn[e]+.12*time[e]));
  return c.prob;
}
function diversifyInheritedProfile(seed,base,canonical,rotation,label){
  const a=rotate(base,rotation),b=rotate(base,-rotation),j=profileAround(seed,canonical,label);
  return norm(base.map((x,e)=>.52*x+.16*a[e]+.14*b[e]+.18*j[e]));
}
function createChildWorld(parent,sourceWorld){
  const depth=sourceWorld.depth+1,path=`${sourceWorld.path}/${parent.id}`,seed=Number(hash64(sourceWorld.rootSeed,'child',path,depth)&0xffffffffn);
  const inherited=fieldVector(parent),canonical=parent.resolved?parent.element:argmax(parent.prob),rotation=sourceWorld.rotation??1;
  const base=diversifyInheritedProfile(seed,inherited,canonical,rotation,'child-profile');
  const context={centerProfile:base,barrierProfile:rotateFrac(base,rotation*1.4),edgeProfile:rotate(base,4),edgeAngle:0,rotation};
  const count=Math.min(38,18+depth*4),field=makeField(seed,{zone:parent.zone,innerR:0,outerR:1,count,baseProfile:base,canonicalElement:canonical,context,depth,path,local:true,nucleusCount:Math.min(5,3+Math.floor(depth/2)),rotation});
  return{seed,rootSeed:sourceWorld.rootSeed,depth,path,parent,rotation,centerElement:canonical,barrierElement:wrap8(canonical+rotation*2),oppositeElement:wrap8(canonical+4),centerProfile:base,edgeProfile:rotate(base,4),barrierProfile:rotateFrac(base,rotation*2),context,fields:[field],finished:false,wave:0,lastEvents:[]};
}
function propagateElement(field,c){for(const ni of c.neighbors){const n=field.cells[ni];if(n.resolved)continue;const w=n.prob.map((p,b)=>p*SUPPORT[rel(c.element,b)]);n.prob=norm(w);n.supportHits++}}
function frontierCells(field){const out=[];for(const c of field.cells)if(!c.resolved){const sources=[];for(const ni of c.neighbors){const n=field.cells[ni];if(n.resolved&&n.root)sources.push(n)}if(sources.length)out.push({cell:c,sources,roots:[...new Set(sources.map(s=>s.root))]})}return out}
function collapseOne(world,field,item){const c=item.cell;const neighborElements=c.neighbors.map(i=>field.cells[i]).filter(n=>n.resolved).map(n=>n.element);const score=c.prob.map((p,e)=>{const same=neighborElements.filter(x=>x===e).length;const crowd=Math.max(0,same-1)*.34;return Math.log(Math.max(1e-12,p))-crowd+.17*gumbel(world.rootSeed,'collapse',world.path,field.zone,world.wave,c.id,e)});const e=argmax(score);const roots=item.roots.slice().sort();c.resolved=true;c.element=e;c.rootsTouched=roots;c.collision=roots.length>1;c.root=roots.length===1?roots[0]:roots.join('+');c.last=true;c.collapseWave=world.wave+1;field.resolved++;field.step++;propagateElement(field,c);for(const s of item.sources)world.lastEvents.push({zone:field.zone,from:s,to:c,root:s.root,element:e,collision:c.collision});return c}
function generationWave(world){for(const f of world.fields)for(const c of f.cells)c.last=false;world.lastEvents=[];let any=false;for(const field of world.fields){if(field.done)continue;const frontier=frontierCells(field);const byRoot=new Map();for(const item of frontier)for(const root of item.roots){if(!byRoot.has(root))byRoot.set(root,[]);byRoot.get(root).push(item)}const proposals=[];for(const[root,items]of byRoot){let pick=null,best=Infinity;for(const item of items){const h=entropy(item.cell.prob)+rand(world.rootSeed,'frontier-tie',world.path,world.wave,item.cell.id,root)*1e-5;if(h<best){best=h;pick=item}}if(pick)proposals.push({root,item:pick,h:best})}proposals.sort((a,b)=>a.h-b.h||String(a.root).localeCompare(String(b.root)));const used=new Set();let collapsed=0;for(const p of proposals){if(used.has(p.item.cell.id)||p.item.cell.resolved)continue;used.add(p.item.cell.id);collapseOne(world,field,p.item);collapsed++;any=true}if(collapsed===0&&field.resolved<field.cells.length){const u=field.cells.filter(c=>!c.resolved);const c=u[Math.floor(rand(world.rootSeed,'fallback-nucleus',world.path,field.zone,field.step)*u.length)],e=argmax(c.prob);c.resolved=true;c.element=e;c.nucleus=true;c.root=`${world.path}:${field.zone}:f${field.step}`;c.rootsTouched=[c.root];c.collapseWave=world.wave+1;c.prob=Array(8).fill(0);c.prob[e]=1;field.nuclei.push(c);field.resolved++;any=true}field.done=field.resolved===field.cells.length}world.wave++;world.finished=world.fields.every(f=>f.done);return any}
function finishWorld(world){let guard=0;while(!world.finished&&guard++<2000)generationWave(world);return world}
class Clock{constructor(){this.cycle=0;this.tick=0;this.side=0}get position(){return Math.floor(this.tick/5)}get tickInPosition(){return this.tick%5}advance(){this.tick++;if(this.tick>=60){this.tick=0;this.cycle++}}flip(){this.side=1-this.side}phase(rotation=1){return clockPhase(this,rotation)}address(){return`${this.cycle}:${this.side}:${this.position}:${this.tickInPosition}`}}
class Hourglass{constructor(){this.cap=20;this.top=[2,1,1,2,1,1,1,1];this.bottom=Array(8).fill(0);this.out=Array(8).fill(0)}get bulb(){return this.cap/2}spend(e){if(this.top[e]<1)return{ok:false,reason:'no grain'};if(sum(this.bottom)>=this.bulb)return{ok:false,reason:'bottom full'};this.top[e]--;this.bottom[e]++;return{ok:true}}flip(){[this.top,this.bottom]=[this.bottom,this.top]}}
class TemporalGlass{constructor(cap=12,top=null){this.cap=cap;this.top=top?top.slice():Array(8).fill(0);this.bottom=Array(8).fill(0);this.out=Array(8).fill(0)}get bulb(){return this.cap/2}transfer(e){if(this.top[e]<=0)return false;if(sum(this.bottom)>=this.bulb)return false;this.top[e]--;this.bottom[e]++;return true}flip(){[this.top,this.bottom]=[this.bottom,this.top]}releaseBottom(){const released=this.bottom.slice();for(let e=0;e<8;e++){this.out[e]+=this.bottom[e];this.bottom[e]=0}return released}}
function seededGrains(seed,profile,total,...label){const out=Array(8).fill(0);for(let n=0;n<total;n++){const score=profile.map((p,e)=>Math.log(Math.max(1e-8,p))+.11*gumbel(seed,...label,n,e));out[argmax(score)]++}return out}
function makeTemporalSubject(seed,kind,profile,total,baseRate,...label){const cap=Math.max(12,total*2),top=seededGrains(seed,profile,total,...label);return{kind,profile:norm(profile),glass:new TemporalGlass(cap,top),baseRate,threshold:total,carry:Array(8).fill(0),lastRate:Array(8).fill(0),cycles:0,activations:0,completed:false,lastPulse:null}}
function ensureBiomeTime(world,c){if(c.biomeTime)return c.biomeTime;const p=fieldVector(c),total=4+(Number(hash64(world.rootSeed,'biome-total',c.id)%2n));c.biomeTime=makeTemporalSubject(world.rootSeed,'Biome',p,total,.24,'biome-time',c.id);return c.biomeTime}
function temporalSupply(world,clock,c){const orientation=clockOrientation(clock),seat=wrap8(orientation*(clock.tick/60)*8+orientation*ZONE_SEAT[c.zone]),clockProfile=rotateFrac(world.centerProfile,seat),local=fieldVector(c),ps=sum(c.temporalPressure||[]),pressure=ps?norm(c.temporalPressure):Array(8).fill(1/8);return norm(local.map((x,e)=>.36*x+.46*clockProfile[e]+.18*pressure[e]))}
function transferRate(subject,supply,e,clock){let compat=0;for(let a=0;a<8;a++)compat+=supply[a]*relationCompatibility(a,e,clock);const desire=clamp(subject.profile[e]*8,.18,2.2);return subject.baseRate*desire*(.16+1.15*supply[e]+.72*compat)}
function pulseIntoCell(cell,released,scale){for(let e=0;e<8;e++)cell.temporalPressure[e]+=released[e]*scale}
function progressTemporalSubject(world,clock,cell,subject,at,events){if(subject.completed)return;const supply=temporalSupply(world,clock,cell);let moved=0,blocked=0;for(let e=0;e<8;e++){if(subject.glass.top[e]<=0){subject.lastRate[e]=0;continue}const rate=transferRate(subject,supply,e,clock);subject.lastRate[e]=rate;subject.carry[e]+=rate;const unmet=Math.max(0,1-relationCompatibility(argmax(supply),e,clock))*subject.profile[e];cell.temporalPressure[e]+=.008*unmet;while(subject.carry[e]>=1&&subject.glass.top[e]>0){if(!subject.glass.transfer(e)){blocked++;cell.temporalPressure[e]+=.08*rate;subject.carry[e]=Math.min(subject.carry[e],1.25);break}subject.carry[e]-=1;moved++}}
  if(sum(subject.glass.bottom)>=subject.threshold){subject.activations++;if(subject.kind==='Event'){const released=subject.glass.releaseBottom();pulseIntoCell(cell,released,.34);subject.completed=true;subject.lastPulse={at,type:'resolved'};events.push({zone:cell.zone,type:`Event threshold resolved`,cell,at,transfer:moved})}else{const released=subject.glass.bottom.slice();pulseIntoCell(cell,released,subject.kind==='Biome'?.16:.20);subject.glass.flip();subject.cycles++;subject.lastPulse={at,type:'cycle'};if(subject.kind==='Biome')subject.profile=mixVec(subject.profile,rotate(subject.profile,clockOrientation(clock)),.12);events.push({zone:cell.zone,type:`${subject.kind} hourglass cycle`,cell,at,transfer:moved})}}
  if(blocked)events.push({zone:cell.zone,type:`${subject.kind} transfer blocked`,cell,at,transfer:moved,blocked});

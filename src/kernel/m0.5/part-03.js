}
function diffuseTemporalPressure(world,clock,field){const next=field.cells.map(c=>(c.temporalPressure||Array(8).fill(0)).map(x=>x*.90));for(const c of field.cells){if(!c.neighbors.length)continue;for(const ni of c.neighbors){const n=field.cells[ni];for(let e=0;e<8;e++){const target=n.resolved?n.element:e,compat=relationCompatibility(e,target,clock),flow=c.temporalPressure[e]*(.018+.030*compat)/c.neighbors.length;next[ni][e]+=flow}}}for(let i=0;i<field.cells.length;i++)field.cells[i].temporalPressure=next[i].map(x=>Math.min(12,x))}
function processTemporalTick(world,clock){const at=clock.address(),events=[];for(const field of world.fields){for(const c of field.cells){if(!c.resolved)continue;progressTemporalSubject(world,clock,c,ensureBiomeTime(world,c),at,events);for(const entity of c.entities)progressTemporalSubject(world,clock,c,entity,at,events)}diffuseTemporalPressure(world,clock,field)}return events}
function makeSpawnEntity(world,clock,best){if(best.type!=='Persona'&&best.type!=='Event')return null;const local=fieldVector(best.cell),cyclic=rotateFrac(SIG[best.type],best.cycle.zoneSeat),profile=mixVec(local,cyclic,.58),total=best.type==='Event'?5:4,rate=best.type==='Event'?.46:.32,id=Number(hash64(world.rootSeed,'temporal-entity',clock.address(),best.zone,best.cell.id,best.type,best.cell.entities.length)&0xffffffffn),subject=makeTemporalSubject(world.rootSeed,best.type,profile,total,rate,'spawn-entity',id);subject.id=id;subject.spawnAt=clock.address();subject.primary=argmax(profile);return subject}
function advanceSimulationTick(world,clock){const at=clock.address(),temporal=processTemporalTick(world,clock),spawns=spawnTick(world,clock);clock.advance();return{at,temporal,spawns}}
const SPAWNS=['Persona','Artifact','Event','POI'];
const SIG={Persona:norm([.1,.16,.1,.2,.1,.14,.1,.1]),Artifact:norm([.12,.12,.1,.2,.18,.08,.14,.06]),Event:norm([.14,.16,.2,.08,.14,.1,.06,.12]),POI:norm([.06,.08,.08,.24,.1,.14,.24,.06])};
const RP={Persona:[.2,.8,.4,-.1,-.5,-.2,.7,.6],Artifact:[.2,.45,.75,.35,-.15,.05,.2,.3],Event:[0,.15,0,.5,.8,.65,.05,.25],POI:[.25,.55,.85,-.05,-.4,-.15,.2,.15]};
const SPAWN_SEAT={POI:0,Persona:1,Artifact:2,Event:3};
const ZONE_SEAT=[0,2,4];
function cycleAffinity(type,seat){const t=SPAWN_SEAT[type],d=Math.min(cyclicDistance(seat,t),cyclicDistance(seat,wrap8(t+4)));return .5+.5*Math.cos(Math.PI*clamp(d/2,0,1))}
function spawnCycle(world,clock,zone){const rotation=clockOrientation(clock),globalSeat=clockPhase(clock,rotation),zoneSeat=wrap8(globalSeat+rotation*ZONE_SEAT[zone]);return{rotation,globalSeat,zoneSeat,elementSeat:Math.round(zoneSeat)%8,position:clock.position}}
function scoreSpawn(world,clock,field,c,type){
  const fv=fieldVector(c),cycle=spawnCycle(world,clock,field.zone),phaseProfile=rotateFrac(world.centerProfile,cycle.zoneSeat),sig=rotateFrac(SIG[type],cycle.zoneSeat),q=dynamicRelationTuple(phaseProfile,fv,clock);
  const fieldFit=dot(fv,sig)*1.65,relationFit=dot(q,RP[type])*.62+dynamicSignedScore(phaseProfile,fv,clock)*.18,cycleFit=cycleAffinity(type,cycle.zoneSeat)*1.18,phaseFit=dot(fv,phaseProfile)*1.10;
  const zoneBase=type==='POI'?[.28,.12,-.06][field.zone]:type==='Event'?[-.08,.10,.28][field.zone]:0;
  const side=(clock.side?(type==='Event'?.08:.01):(type==='POI'?.06:0)),rnd=.18*gumbel(world.rootSeed,'spawn',clock.address(),field.zone,c.id,type);
  const score=fieldFit+relationFit+cycleFit+phaseFit+zoneBase+side+rnd;
  return{type,score,fieldFit,relationFit,cycleFit,phaseFit,zoneBase,side,rnd,q,cycle};
}
function candidateScores(world,clock,c){const f=world.fields[c.zone];return SPAWNS.map(t=>scoreSpawn(world,clock,f,c,t)).sort((a,b)=>b.score-a.score)}
function spawnTick(world,clock){
  const out=[];
  for(const field of world.fields){
    let best=null;
    for(const c of field.cells){if(!c.resolved)continue;for(const type of SPAWNS){const s=scoreSpawn(world,clock,field,c,type);if(!best||s.score>best.score)best={...s,zone:field.zone,cell:c}}}
    if(best){
      best.cell.spawns.push({type:best.type,at:clock.address(),wave:world.wave,cycleSeat:best.cycle.zoneSeat});
      const phaseSig=rotateFrac(SIG[best.type],best.cycle.zoneSeat);
      for(let e=0;e<8;e++)best.cell.spawnField[e]+=phaseSig[e]*(.14+.045*best.score);
      const entity=makeSpawnEntity(world,clock,best);if(entity){best.cell.entities.push(entity);best.entity=entity}
      out.push(best);
    }
  }
  return out;
}
function digestWorld(w){const parts=[w.rootSeed,w.path,w.wave];for(const f of w.fields){parts.push(f.zone,f.cells.length);for(const c of f.cells){parts.push(c.id,c.resolved?c.element:'x',c.root??'-',c.collision?1:0,c.spawns.length,c.entities?.length??0,(c.temporalPressure||[]).map(x=>x.toFixed(3)).join(','));if(c.biomeTime)parts.push(c.biomeTime.glass.top.join(','),c.biomeTime.glass.bottom.join(','),c.biomeTime.cycles)}}return hash64(...parts).toString(16).padStart(16,'0')}
function invariants(w){const root=w.path==='root',r={fieldCount:w.fields.length,edgeOpposition:true,separateGraphs:true,allResolved:w.finished,digest:digestWorld(w)};if(root){r.fieldCount=w.fields.length===3;r.edgeOpposition=rel(w.centerElement,w.oppositeElement)===4;r.separateGraphs=w.fields.every((f,i)=>f.cells.every(c=>c.zone===i&&c.neighbors.every(n=>Number.isInteger(n)&&n>=0&&n<f.cells.length)))}return r}

function childPreviewFor(world,field,c,count=6){const base=fieldVector(c),canonical=c.resolved?c.element:argmax(base),rotation=world.rotation??1,childBase=diversifyInheritedProfile(Number(hash64(world.rootSeed,'preview-base',world.path,c.id)&0xffffffffn),base,canonical,rotation,'preview'),out=[];for(let i=0;i<count;i++){const vi=Math.floor(rand(world.rootSeed,'preview-v',world.path,c.id,i)*c.poly.length),q=c.poly[vi]||c.point,t=.18+.68*rand(world.rootSeed,'preview-t',world.path,c.id,i),point={x:c.point.x*(1-t)+q.x*t,y:c.point.y*(1-t)+q.y*t},score=childBase.map((p,e)=>Math.log(Math.max(1e-8,p))+.22*gumbel(world.rootSeed,'preview-e',world.path,c.id,i,e));out.push({point,element:argmax(score)})}return out}

module.exports={
  E,R,Z,DEPTH_NAMES,SIGNED,SUPPORT,ELEMENT_TENSOR,
  hash64,rand,norm,entropy,rel,dynamicRelationWeight,dynamicRelationTuple,dynamicSignedScore,
  createWorld,createChildWorld,generationWave,finishWorld,fieldVector,
  Clock,Hourglass,TemporalGlass,ensureBiomeTime,temporalSupply,transferRate,
  advanceSimulationTick,candidateScores,spawnCycle,digestWorld,invariants,childPreviewFor
};

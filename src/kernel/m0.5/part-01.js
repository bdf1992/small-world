function initialProb(seed,field,cell){const zp=zonePrior(field.zone),pressure=pressureFor(field,cell.point),logits=[],noise=[];cell.cyclicSeat=wrap8(fieldSeat(field,cell.point));for(let e=0;e<8;e++){const n=coherentNoise(seed,field.zone,cell.point,e,field.depth);noise.push(n);logits.push(zp[e]*.58+Math.log(Math.max(1e-5,pressure[e]))*.72+n*.88)}cell.noise=noise;cell.external=pressure;cell.prior=softmax(logits);cell.initialEntropy=entropy(cell.prior);return cell.prior.slice()}
function smoothNoiseField(field,passes=2,alpha=.24){
  let values=field.cells.map(c=>c.noise.slice());
  for(let pass=0;pass<passes;pass++){
    const next=values.map(v=>v.slice());
    for(let i=0;i<field.cells.length;i++){const ns=field.cells[i].neighbors;if(!ns.length)continue;for(let e=0;e<8;e++){let avg=0;for(const j of ns)avg+=values[j][e];avg/=ns.length;next[i][e]=values[i][e]*(1-alpha)+avg*alpha}}
    values=next;
  }
  for(let i=0;i<field.cells.length;i++){const c=field.cells[i];c.noise=values[i];const zp=zonePrior(field.zone),logits=[];for(let e=0;e<8;e++)logits.push(zp[e]*.58+Math.log(Math.max(1e-5,c.external[e]))*.72+c.noise[e]*.88);c.prior=softmax(logits);c.prob=c.prior.slice();c.initialEntropy=entropy(c.prior)}
}
function makeField(seed,opts){
  const {zone,innerR,outerR,count,baseProfile,canonicalElement,context,depth=0,path='root',local=false,nucleusCount=(zone===1?3:2),edgeAngle=context?.edgeAngle??0,rotation=context?.rotation??1}=opts;
  const points=[];
  for(let i=0;i<count;i++)points.push(ringPoint(seed,zone,i,innerR,outerR,i===0,local));
  if(!local&&zone===2){const rr=innerR+(outerR-innerR)*.82;points[0]={x:Math.cos(edgeAngle)*rr,y:Math.sin(edgeAngle)*rr}}
  const polys=voronoi(points,outerR),adj=ringAdjacency(points,innerR,local?5:(zone===0?5:6));
  const field={zone,innerR,outerR,baseProfile,context,depth,path,local,rotation,cells:[],nuclei:[],resolved:0,step:0,done:false};
  field.cells=points.map((p,i)=>{const id=Number(hash64(seed,'cell',path,zone,i)&0xffffffffn);return{id,index:i,zone,point:p,poly:polys[i],neighbors:adj[i],prior:null,prob:null,noise:null,external:null,element:null,resolved:false,nucleus:false,root:null,rootsTouched:[],collapseWave:null,collision:false,last:false,supportHits:0,spawns:[],spawnField:Array(8).fill(0),entities:[],temporalPressure:Array(8).fill(0),biomeTime:null}});
  for(const c of field.cells)c.prob=initialProb(seed,field,c);
  smoothNoiseField(field,2,.24);
  const nucleusIndices=[0];
  for(let n=1;n<nucleusCount;n++){let idx=1+Math.floor(rand(seed,'nucleus-index',path,zone,n)*(count-1));while(nucleusIndices.includes(idx))idx=1+(idx%(count-1));nucleusIndices.push(idx)}
  const anchor=canonicalElement!=null?canonicalElement:argmax(baseProfile);
  const offsets=[0,rotation,-rotation,2*rotation,-2*rotation,3*rotation,-3*rotation,4];
  for(let n=0;n<nucleusIndices.length;n++){
    const idx=nucleusIndices[n],c=field.cells[idx];
    let e;
    if(n===0)e=anchor;
    else{
      const target=wrap8(anchor+offsets[n%offsets.length]);
      const score=c.prob.map((p,k)=>Math.log(Math.max(1e-9,p))+.58*(1-cyclicDistance(k,target)/4)+.12*gumbel(seed,'nucleus-element',path,zone,n,k));
      e=argmax(score);
      // Preserve distinct nucleation wherever a viable nearby cyclic seat exists.
      if(field.nuclei.some(x=>x.element===e)){
        const candidates=Array.from({length:8},(_,k)=>k).filter(k=>!field.nuclei.some(x=>x.element===k));
        if(candidates.length)e=candidates.sort((a,b)=>cyclicDistance(a,target)-cyclicDistance(b,target)||c.prob[b]-c.prob[a])[0];
      }
    }
    c.nucleus=true;c.resolved=true;c.element=e;c.root=`${path}:${zone}:${n}`;c.rootsTouched=[c.root];c.collapseWave=0;c.prob=Array(8).fill(0);c.prob[e]=1;field.nuclei.push(c);field.resolved++;
  }
  for(const n of field.nuclei)propagateElement(field,n);
  field.done=field.resolved===field.cells.length;

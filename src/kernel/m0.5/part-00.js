'use strict';

// Transitional M0.5 core extraction. Behavior-preserving baseline; not target M0.6 architecture.
const E=['Void','Fire','Chaos','Ground','Aether','Water','Order','Sky'];
const R=['Is','Affinity','Anchor','Vice','Nemesis','Conflict','Need','Wants'];
const Z=['Center','Barrier','Edge'];
const DEPTH_NAMES=['World','Biome','POI','Encounter','Detail'];
const COLORS=['#35234f','#e75b38','#b64396','#b88a53','#67ddcf','#3577bc','#d7a52c','#82c6e9'];
const SUPPORT=[1.16,1.34,1.20,.98,.62,.80,1.05,1.18];
const SIGNED=[1,.75,.55,-.25,-1,-.65,.40,.60];
const MASK=(1n<<64n)-1n,OFF=1469598103934665603n,PRIME=1099511628211n;
function hash64(...parts){let h=OFF;for(const part of parts){for(const c of String(part)){h^=BigInt(c.charCodeAt(0));h=(h*PRIME)&MASK}h^=255n;h=(h*PRIME)&MASK}h^=h>>33n;h=(h*0xff51afd7ed558ccdn)&MASK;h^=h>>33n;h=(h*0xc4ceb9fe1a85ec53n)&MASK;h^=h>>33n;return h&MASK}
function rand(seed,...a){const h=hash64(seed,...a);return Number((h>>11n)&((1n<<53n)-1n))/9007199254740992}
function gumbel(seed,...a){const u=Math.max(1e-12,Math.min(1-1e-12,rand(seed,...a)));return-Math.log(-Math.log(u))}
const sum=a=>a.reduce((x,y)=>x+y,0);function norm(a){const s=sum(a);return s>0?a.map(x=>x/s):a.map(()=>1/a.length)}
function softmax(a){const m=Math.max(...a);return norm(a.map(x=>Math.exp(x-m)))}function entropy(p){let h=0;for(const x of p)if(x>0)h-=x*Math.log(x);return h}function dot(a,b){let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s}
const rel=(a,b)=>((b-a)%8+8)%8;const rotate=(v,k)=>v.map((_,i)=>v[((i-k)%8+8)%8]);
function argmax(v){let m=-Infinity,ii=0;for(let i=0;i<v.length;i++)if(v[i]>m){m=v[i];ii=i}return ii}function clamp(x,a,b){return Math.max(a,Math.min(b,x))}function mixVec(a,b,t){return norm(a.map((x,i)=>x*(1-t)+b[i]*t))}
function profileAround(seed,element,label){const raw=Array(8).fill(0).map((_,e)=>.035+.055*rand(seed,label,e));raw[element]+=.42;raw[(element+1)%8]+=.15;raw[(element+7)%8]+=.13;raw[(element+2)%8]+=.075;raw[(element+6)%8]+=.06;return norm(raw)}
function wrap8(x){return((x%8)+8)%8}
function rotateFrac(v,k){const f=Math.floor(k),t=k-f,a=rotate(v,f),b=rotate(v,f+1);return norm(a.map((x,i)=>x*(1-t)+b[i]*t))}
function clockPhase(clock,rotation=1){return wrap8(rotation*(clock.tick/60)*8)}
function cyclicDistance(a,b){const d=Math.abs(wrap8(a-b));return Math.min(d,8-d)}
function relationTuple(x,y){const q=Array(8).fill(0);for(let a=0;a<8;a++)for(let b=0;b<8;b++)q[rel(a,b)]+=x[a]*y[b];return q}
function clockOrientation(clock){return clock.side?-1:1}
function orientedRel(a,b,clock){return clock.side?rel(b,a):rel(a,b)}
function dynamicRelationWeight(a,b,clock){
  const r=orientedRel(a,b,clock),base=SIGNED[r],orientation=clockOrientation(clock);
  const phase=wrap8(orientation*(clock.tick/60)*8);
  const wa=Math.sin((phase-a)*Math.PI/4),wb=Math.sin((phase-b)*Math.PI/4);
  const modulation=clamp(1+.28*orientation*(wa-wb),.55,1.45);
  return{r,base,modulation,weight:base*modulation};
}
function dynamicRelationTuple(x,y,clock){const q=Array(8).fill(0);for(let a=0;a<8;a++)for(let b=0;b<8;b++)q[orientedRel(a,b,clock)]+=x[a]*y[b];return q}
function dynamicSignedScore(x,y,clock){let s=0;for(let a=0;a<8;a++)for(let b=0;b<8;b++)s+=x[a]*y[b]*dynamicRelationWeight(a,b,clock).weight;return s}
function relationCompatibility(a,b,clock){const w=dynamicRelationWeight(a,b,clock).weight;return clamp(.50+.46*w,.04,1.32)}
function cyclicRelationTensor(n=8,weights=SIGNED){const T=Array.from({length:n},()=>Array.from({length:n},()=>Array(n).fill(0)));for(let a=0;a<n;a++)for(let b=0;b<n;b++){const r=((b-a)%n+n)%n;T[a][r][b]=weights[r]??0}return T}
const ELEMENT_TENSOR=cyclicRelationTensor(8,SIGNED);
function regularPoly(r,n=128){const p=[];for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/n;p.push({x:Math.cos(a)*r,y:Math.sin(a)*r})}return p}
function clipNearest(poly,a,b){if(!poly.length)return[];const nx=2*(b.x-a.x),ny=2*(b.y-a.y),c=b.x*b.x+b.y*b.y-a.x*a.x-a.y*a.y;const inside=p=>nx*p.x+ny*p.y<=c+1e-9;const inter=(p,q)=>{const dx=q.x-p.x,dy=q.y-p.y,den=nx*dx+ny*dy;if(Math.abs(den)<1e-12)return{x:p.x,y:p.y};const t=(c-nx*p.x-ny*p.y)/den;return{x:p.x+t*dx,y:p.y+t*dy}};const o=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],ip=inside(p),iq=inside(q);if(ip&&iq)o.push(q);else if(ip&&!iq)o.push(inter(p,q));else if(!ip&&iq){o.push(inter(p,q));o.push(q)}}return o}
function voronoi(points,outerR){const bound=regularPoly(outerR);return points.map((p,i)=>{let poly=bound.map(q=>({...q}));for(let j=0;j<points.length&&poly.length;j++)if(i!==j)poly=clipNearest(poly,p,points[j]);return poly})}
function pointInPoly(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-30)+a.x))inside=!inside}return inside}
function minRadiusOnSegment(a,b){const vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy;if(den<1e-12)return Math.hypot(a.x,a.y);let t=-(a.x*vx+a.y*vy)/den;t=Math.max(0,Math.min(1,t));return Math.hypot(a.x+t*vx,a.y+t*vy)}
function ringAdjacency(points,innerR,k=5){const ns=points.map(()=>new Set());for(let i=0;i<points.length;i++){const cand=[];for(let j=0;j<points.length;j++)if(i!==j){const dx=points[i].x-points[j].x,dy=points[i].y-points[j].y;cand.push([dx*dx+dy*dy,j])}cand.sort((a,b)=>a[0]-b[0]);let n=0;for(const[,j]of cand){if(innerR>0&&minRadiusOnSegment(points[i],points[j])<innerR*.985)continue;ns[i].add(j);ns[j].add(i);if(++n>=k)break}}if(innerR>0){const order=points.map((p,i)=>[Math.atan2(p.y,p.x),i]).sort((a,b)=>a[0]-b[0]);for(let q=0;q<order.length;q++){const i=order[q][1],j=order[(q+1)%order.length][1];ns[i].add(j);ns[j].add(i)}}return ns.map(s=>[...s])}
function zonePrior(z){return[[-.45,-.15,-.35,.35,-.05,.12,.55,.18],[-.12,.08,.08,.38,-.08,.35,.08,.35],[.30,.15,.45,-.12,.50,.02,-.35,.18]][z]}
function angleDelta(a,b){let d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d}
function coherentNoise(seed,zone,p,e,depth){let v=0,w=0,amp=1;for(let o=0;o<4;o++){const f=Math.pow(2,o)*(1.15+.18*rand(seed,'nf',zone,e,o,depth));const th=rand(seed,'nth',zone,e,o,depth)*Math.PI*2,ph=rand(seed,'nph',zone,e,o,depth)*Math.PI*2;const u=(p.x*Math.cos(th)+p.y*Math.sin(th))*f*Math.PI*2;v+=amp*Math.sin(u+ph);w+=amp;amp*=.52}return v/w}
function ringPoint(seed,z,i,innerR,outerR,canonical=false,local=false){if(canonical&&(z===0||local))return{x:0,y:0};const pad=.018;const lo=Math.max(0,innerR+pad),hi=Math.max(lo+.001,outerR-pad);const u=rand(seed,'zone-point',z,i,'r'),v=rand(seed,'zone-point',z,i,'a');const rr=Math.sqrt(lo*lo+u*(hi*hi-lo*lo));const a=-Math.PI/2+v*Math.PI*2;return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}
function fieldSeat(field,p){const rr=clamp(Math.hypot(p.x,p.y)/Math.max(1e-9,field.outerR),0,1);return field.local?field.rotation*1.35*rr:field.rotation*4*clamp(Math.hypot(p.x,p.y),0,1)}
function pressureFor(field,p){
  if(field.local){
    const seat=fieldSeat(field,p);
    return mixVec(field.baseProfile,rotateFrac(field.baseProfile,seat),.34);
  }
  const r=clamp(Math.hypot(p.x,p.y),0,1);
  // The root world is a cyclic radial field: Center=seat 0, Edge=seat 4.
  // CW takes 0→1→2→3→4; CCW takes 0→7→6→5→4.
  const radialSeat=fieldSeat(field,p);
  const cyclic=rotateFrac(field.context.centerProfile,radialSeat);
  const zoneAnchor=field.baseProfile;
  let pressure=mixVec(cyclic,zoneAnchor,.34);
  if(field.zone===1){
    // Barrier is the explicit interaction medium, not a fake shared graph.
    const towardEdge=rotateFrac(field.context.centerProfile,field.rotation*4*clamp((r-field.innerR)/(field.outerR-field.innerR),0,1));
    pressure=mixVec(pressure,towardEdge,.22);
  }
  return pressure;
}

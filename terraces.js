/* The terrace roof section groups its posts, independent deck footprint, stairs and rail runs. All heights
   are relative to the finished ground-floor surface, including in saved sketches. */
window.PentiiTerraces=(()=>{
  'use strict';
  const names=['Передняя','Правая','Задняя','Левая'];
  const facadeNames=['Главный фасад','Правый фасад','Задний фасад','Левый фасад'];
  const styles={wood:'Точёные балясины',steel:'Металлические стойки',glass:'Стекло с поручнем'};
  const id=()=>globalThis.crypto?.randomUUID?.()||'t'+Math.random().toString(36).slice(2);
  const clamp=(n,lo,hi)=>Math.min(Math.max(n,lo),Math.max(lo,hi));
  const round=n=>Math.round(n*100)/100;
  const snap=n=>Math.round(n*20)/20;
  const number=n=>round(n).toLocaleString('ru-RU');
  const sections=p=>(p.roofSections||[]).filter(s=>s.terrace);
  const edgeNormal=[[0,1],[1,0],[0,-1],[-1,0]];
  const clone=p=>structuredClone(p);
  const wallOverlap=.08;
  const overhang=s=>Number.isFinite(s.terrace?.overhang)?clamp(s.terrace.overhang,0,1.5):.06;
  const stateByProject=new Map();
  const local=p=>{
    if(!stateByProject.has(p.id))stateByProject.set(p.id,{section:'',post:'',entry:'',mode:''});
    return stateByProject.get(p.id);
  };
  function sideOf(p,s){
    const distances=[Math.abs(s.z-p.d),Math.abs(s.x-p.w),Math.abs(s.z+s.d),Math.abs(s.x+s.w)];
    return distances.indexOf(Math.min(...distances));
  }
  function defaults(side){
    return {side,rail:'wood',edges:[0,1,2,3].filter(e=>e!==(side+2)%4),
      stairs:[{id:id(),edge:side,at:.45,width:1.45,run:1.12,rails:true}]};
  }
  function attach(p,s){
    if(!s.terrace)return s;
    const side=s.terrace.side,span=side%2?'d':'w',depth=side%2?'w':'d',axis=side%2?'z':'x';
    s.terrace.deck??=dimensions(p,s);
    const deck=rect(p,s),minCover=.02;
    // Roof-edge grips adjust eaves independently. Clamp an inward drag before
    // it uncovers the fixed deck; never quietly change the deck's dimensions.
    const low=Math.min(s[axis],deck[axis]-minCover);
    const high=Math.max(s[axis]+s[span],deck[axis]+deck[span]+minCover);
    s[axis]=round(low);s[span]=round(high-low);
    s[depth]=Math.max(s[depth],deck[depth]+wallOverlap+minCover);
    if(side===0)s.z=round(p.d-wallOverlap);
    if(side===1)s.x=round(p.w-wallOverlap);
    if(side===2)s.z=round(wallOverlap-s.d);
    if(side===3)s.x=round(wallOverlap-s.w);
    s.ridge=side%2;s.reverse=side>=2;
    for(const post of s.posts||[]){
      const mx=Math.min(post.size/2+.015,deck.w/2),mz=Math.min(post.size/2+.015,deck.d/2);
      const x=clamp(s.x+post.u*s.w,deck.x+mx,deck.x+deck.w-mx);
      const z=clamp(s.z+post.v*s.d,deck.z+mz,deck.z+deck.d-mz);
      post.u=(x-s.x)/s.w;post.v=(z-s.z)/s.d;
    }
    return s;
  }
  function initialize(p){
    const decode=(v,size)=>v<0?v:v>1?size+v-1:v*size;
    for(const s of p.roofSections||[]){
      if(!s.canopy||s.terrace)continue;
      const index=(p.yard||[]).findIndex(o=>{
        if(o.type!=='terrace'||Math.abs(o.angle%360)>.01)return false;
        const x=decode(o.u,p.w),z=decode(o.v,p.d);
        return Math.abs(x-(s.x+s.w/2))<.2&&Math.abs(z-(s.z+s.d/2))<.22&&Math.abs(s.w-o.w)<.3&&Math.abs(s.d-o.d)<.32;
      });
      if(index>=0){s.terrace=defaults(sideOf(p,s));p.yard.splice(index,1);}
    }
    return p;
  }
  function rect(p,s){
    const deck=s.terrace.deck,side=s.terrace.side;
    if(deck&&[deck.span,deck.depth,deck.center].every(Number.isFinite)&&deck.span>0&&deck.depth>0){
      const start=deck.center-deck.span/2;
      return side%2?{x:side===1?p.w:-deck.depth,z:start,w:deck.depth,d:deck.span}:
        {x:start,z:side===0?p.d:-deck.depth,w:deck.span,d:deck.depth};
    }
    const e=overhang(s),r={x:s.x+e,z:s.z+e,w:s.w-2*e,d:s.d-2*e};
    // The deck always meets its wall. A roof-edge edit cannot create an open
    // strip between the house and its attached terrace.
    if(side===0){r.z=p.d;r.d=s.z+s.d-e-p.d;}
    if(side===1){r.x=p.w;r.w=s.x+s.w-e-p.w;}
    if(side===2)r.d=-r.z;
    if(side===3)r.w=-r.x;
    r.w=Math.max(.05,r.w);r.d=Math.max(.05,r.d);return r;
  }
  function dimensions(p,s){
    const r=rect(p,s),side=s.terrace.side;
    return {span:side%2?r.d:r.w,depth:side%2?r.w:r.d,center:side%2?r.z+r.d/2:r.x+r.w/2};
  }
  function eaves(p,s){
    const e=overhang(s);
    if(!Number.isFinite(s.w)||!Number.isFinite(s.d))return {small:e,large:e,out:e};
    const r=rect(p,s),side=s.terrace.side;
    return {small:Math.max(.02,side%2?r.z-s.z:r.x-s.x),
      large:Math.max(.02,side%2?s.z+s.d-r.z-r.d:s.x+s.w-r.x-r.w),
      out:Math.max(.02,[s.z+s.d-r.z-r.d,s.x+s.w-r.x-r.w,r.z-s.z,r.x-s.x][side])};
  }
  const wallRoofHeight=s=>s.roof===2&&Number.isFinite(s.w)&&Number.isFinite(s.d)
    ?s.base+Math.tan(s.pitch*Math.PI/180)*((s.terrace.side%2?s.w:s.d)-wallOverlap):null;
  function keepWallHeight(s,height){
    if(s.roof===2&&Number.isFinite(height))s.base=round(Math.max(.4,height-
      Math.tan(s.pitch*Math.PI/180)*((s.terrace.side%2?s.w:s.d)-wallOverlap)));
  }
  const length=(r,e)=>e%2?r.d:r.w;
  function point(r,e,along,out=0){
    const n=edgeNormal[e];
    const x=e%2?(e===1?r.x+r.w:r.x):r.x+along;
    const z=e%2?r.z+along:(e===0?r.z+r.d:r.z);
    return {x:x+n[0]*out,z:z+n[1]*out};
  }
  function stairDims(r,st){
    const len=length(r,st.edge),width=clamp(st.width,.45,len-.04);
    const center=clamp(st.at*len,width/2+.02,len-width/2-.02);
    return {center,width,a:center-width/2,b:center+width/2};
  }
  function segments(r,s,edge){
    const len=length(r,edge),gaps=s.terrace.stairs.filter(st=>st.edge===edge).map(st=>stairDims(r,st)).sort((a,b)=>a.a-b.a);
    let start=.055;const runs=[];
    for(const gap of gaps){if(gap.a-start>.16)runs.push([start,gap.a-.025]);start=Math.max(start,gap.b+.025);}
    if(len-.055-start>.16)runs.push([start,len-.055]);return runs;
  }
  function nearest(r,x,z,skip=-1){
    let best;
    for(let e=0;e<4;e++){
      if(e===skip)continue;
      const along=clamp(e%2?z-r.z:x-r.x,0,length(r,e)),q=point(r,e,along),dist=Math.hypot(x-q.x,z-q.z);
      if(!best||dist<best.dist)best={edge:e,at:along/length(r,e),dist};
    }
    return best;
  }
  function fitToSide(p,s,side,span,depth,center,margins=eaves(p,s)){
    const along=side%2?p.d:p.w,wallHeight=wallRoofHeight(s);
    span=clamp(span,1,along+.5);depth=clamp(depth,1,15);
    const start=clamp(center-span/2,Math.min(0,along-span),Math.max(0,along-span));
    center=start+span/2;
    const a=round(start-margins.small),roofSpan=round(span+margins.small+margins.large),roofDepth=round(depth+margins.out+wallOverlap);
    s.terrace.side=side;
    s.terrace.deck={span:round(span),depth:round(depth),center:round(center)};
    Object.assign(s, side%2?{z:a,w:roofDepth,d:roofSpan}:{x:a,w:roofSpan,d:roofDepth});
    attach(p,s);
    keepWallHeight(s,wallHeight);
  }
  function add(p,side){
    const n=sections(p).length,span=Math.min(5,(side%2?p.d:p.w)*.75);
    const s={id:id(),name:'Терраса '+(n+1),canopy:true,base:2.53,roof:2,pitch:3,terrace:{...defaults(side),overhang:.3},posts:[]};
    fitToSide(p,s,side,span,2.9,(side%2?p.d:p.w)/2);
    const r=rect(p,s),rise=Math.tan(s.pitch*Math.PI/180)*((side%2?s.w:s.d)-wallOverlap);
    s.base=round(Math.max(.6,p.h-.18-rise));
    for(const t of [.12,length(r,side)-.12]){
      const pt=point(r,side,t,-.1);
      s.posts.push({id:id(),u:(pt.x-s.x)/s.w,v:(pt.z-s.z)/s.d,size:.15});
    }
    p.roofSections.push(s);return s;
  }
  function followHouse(before,after){
    const dw=after.w-before.w,dd=after.d-before.d;
    if(!dw&&!dd)return;
    for(const s of sections(after)){
      const old=sections(before).find(item=>item.id===s.id);
      if(!old)continue;
      // Recompute from the original wall anchor, not from a previously adjusted
      // preview. Repeated validation during dragging therefore cannot drift.
      const face=s.terrace.side,{span,depth,center}=dimensions(before,old);
      const size=face%2?'d':'w';
      fitToSide(after,s,face,span,depth,center/before[size]*after[size],eaves(before,old));
      keepWallHeight(s,wallRoofHeight(old));
    }
  }
  function followEdits(before,after){
    for(const s of sections(after)){
      const old=sections(before).find(item=>item.id===s.id);
      if(!old||['x','z','w','d','ridge','reverse','pitch'].some(key=>s[key]!==old[key])){
        const height=old&&s.base===old.base?wallRoofHeight(old):null;
        s.terrace.deck??=old?dimensions(before,old):dimensions(after,s);
        const oldDeck=old&&dimensions(before,old);
        const sameDeck=old&&before.w===after.w&&before.d===after.d&&old.terrace.side===s.terrace.side&&
          ['span','depth','center'].every(key=>Math.abs(s.terrace.deck[key]-oldDeck[key])<1e-7);
        attach(after,s);keepWallHeight(s,height);
        if(sameDeck){
          const r=rect(after,s);
          for(const post of s.posts){
            const prior=old.posts.find(item=>item.id===post.id);if(!prior)continue;
            const mx=Math.min(post.size/2+.015,r.w/2),mz=Math.min(post.size/2+.015,r.d/2);
            const x=clamp(old.x+prior.u*old.w,r.x+mx,r.x+r.w-mx),z=clamp(old.z+prior.v*old.d,r.z+mz,r.z+r.d-mz);
            post.u=(x-s.x)/s.w;post.v=(z-s.z)/s.d;
          }
        }
      }
    }
  }
  function rotateSide(p,s,face){
    const side=s.terrace.side,{span,depth}=dimensions(p,s),wallHeight=wallRoofHeight(s),margins=eaves(p,s);
    const turns=(face-side+4)%4;
    // Turning the terrace as one assembly also turns user-placed posts and stairs.
    const rotate=(u,v)=>{for(let i=0;i<turns;i++)[u,v]=[v,1-u];return [u,v];};
    for(const item of [...s.posts,...(s.liftPoints||[]),...(s.dormers||[])])[item.u,item.v]=rotate(item.u,item.v);
    for(const dormer of s.dormers||[])dormer.direction=(dormer.direction+turns)%4;
    for(const st of s.terrace.stairs){
      const pos=point({x:0,z:0,w:1,d:1},st.edge,st.at),[x,z]=rotate(pos.x,pos.z);
      st.edge=(st.edge+turns)%4;st.at=st.edge%2?z:x;
    }
    s.terrace.edges=s.terrace.edges.map(e=>(e+turns)%4);s.terrace.side=face;
    fitToSide(p,s,face,span,depth,(face%2?p.d:p.w)/2,margins);
    keepWallHeight(s,wallHeight);
  }
  function resizeDeck(p,sectionId,key,change){
    const s=sections(p).find(item=>item.id===sectionId);if(!s)return p;
    const side=s.terrace.side,{span,depth,center}=dimensions(p,s);
    const axis=['roofLeft','roofRight'].includes(key)?'w':'d';
    const lower=['roofLeft','roofBack'].includes(key);
    const normal=side%2?'w':'d';
    if(axis===normal){
      if(lower!==(side>=2))return p;
      fitToSide(p,s,side,span,depth+change*(lower?-1:1),center);
    }else fitToSide(p,s,side,span+change*(lower?-1:1),depth,center+change/2);
    return p;
  }
  function validate(p){
    const limitX=(p.plotWidth??p.w+16)-p.w,limitZ=(p.plotDepth??p.d+16)-p.d;
    for(const s of sections(p)){
      const r=rect(p,s),t=s.terrace;
      const validPt=q=>q.x>=-limitX/2-.02&&q.z>=-limitZ/2-.02&&q.x<=p.w+limitX/2+.02&&q.z<=p.d+limitZ/2+.02;
      const bounds=[{x:r.x,z:r.z},{x:r.x+r.w,z:r.z+r.d}];
      for(const st of t.stairs){const a=stairDims(r,st);bounds.push(point(r,st.edge,a.a,st.run),point(r,st.edge,a.b,st.run));}
      if(!bounds.every(validPt))return 'Терраса или лестница выходит за границы участка.';
      for(let i=0;i<t.stairs.length;i++)for(let j=0;j<i;j++){
        const a=t.stairs[i],b=t.stairs[j];if(a.edge!==b.edge)continue;
        const x=stairDims(r,a),y=stairDims(r,b);if(x.a<y.b-.01&&x.b>y.a+.01)return 'Входы на террасу пересекаются. Сдвиньте ступени вдоль края.';
      }
    }
    return '';
  }
  function byDoor(p,o){
    const center=o.x+o.w/2,pt=xyz(p,o.f,center,0,.15);
    if(sections(p).some(s=>{const r=rect(p,s);return pt[0]>=r.x-.04&&pt[0]<=r.x+r.w+.04&&pt[2]>=r.z-.04&&pt[2]<=r.z+r.d+.04;}))return true;
    const decode=(v,n)=>v<0?v:v>1?n+v-1:v*n;
    return (p.yard||[]).some(t=>{
      if(t.type!=='terrace'&&t.type!=='coveredTerrace')return false;
      const dx=pt[0]-decode(t.u,p.w),dz=pt[2]-decode(t.v,p.d),a=t.angle*Math.PI/180;
      return Math.abs(dx*Math.cos(a)+dz*Math.sin(a))<=t.w/2+.01&&Math.abs(-dx*Math.sin(a)+dz*Math.cos(a))<=t.d/2+.01;
    });
  }
  function exitDoor(p,s,raw){
    const r=rect(p,s),f=s.terrace.side,len=f%2?p.d:p.w;
    const a=f%2?r.z:r.x,l=length(r,f);
    const localX=u=>f===1||f===2?len-u:u;
    const existing=p.ops.find(o=>o.k>=2&&o.floor===0&&o.f===f&&localX(o.x+o.w/2)>=a&&localX(o.x+o.w/2)<=a+l);
    const width=existing?.w||1,where=clamp(raw??a+l*.5,a+width/2,a+l-width/2);
    const starts=[where];if(raw==null)for(let n=1;n<Math.ceil(l/.05);n++)starts.push(where-n*.05,where+n*.05);
    for(const val of starts){
      if(val<a+width/2||val>a+l-width/2)continue;
      const x=round(localX(val)-width/2);
      if(x<0||x+width>len)continue;
      if(p.ops.some(o=>o.id!==existing?.id&&o.f===f&&o.floor===0&&o.sill<2.16&&o.x<x+width&&x<o.x+o.w))continue;
      if(existing)existing.x=x;else p.ops.push({id:id(),f,x,w:width,h:Math.min(2.16,p.h-.1),k:3,sill:0,floor:0});
      return true;
    }
    return false;
  }
  const ground=p=>window.PentiiStructure?.get(p).groundY??-.24;
  function mesh(T,parent,p,woodMap=null){
    for(const s of sections(p)){
      const t=s.terrace,r=rect(p,s),level=ground(p),group=new T.Group();
      group.name='Терраса · '+s.name;parent.add(group);
      const mats=new Map(),geometries=new Map(),batch=new Map(),obj=new T.Object3D();
      const target={type:'terrace',sectionId:s.id};
      function emit(shape,mat,x,y,z,w,h,d,rotation,selection=target){
        if(Math.min(w,h,d)<.001)return;
        const key=[shape,mat,selection.entryId||''].join(':');
        if(!batch.has(key))batch.set(key,{shape,mat,selection,transforms:[]});
        obj.position.set(x,y,z);obj.scale.set(w,h,d);obj.quaternion.identity();
        if(rotation)obj.quaternion.copy(rotation);obj.updateMatrix();batch.get(key).transforms.push(obj.matrix.clone());
      }
      const timber='#bfa88a',fascia=p.top||'#465357',steel='#526369',bracket='#657175';
      const boardTones=['#c1ac91','#bca68b','#b9a289','#c4b197'];
      function railBetween(a,b,h1,h2,wide,deep,color,selection){
        const start=new T.Vector3(a.x,h1,a.z),end=new T.Vector3(b.x,h2,b.z),v=end.clone().sub(start);
        const length=v.length(),c=start.lerp(end,.5),rot=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());
        emit('box',color,c.x,c.y,c.z,wide,length,deep,rot,selection);
      }
      const rows=Math.max(1,Math.ceil(r.d/.14));
      for(let row=0;row<rows;row++){
        const color=boardTones[row%4],z=r.z+(row+.5)*r.d/rows;
        for(let start=r.x-(row%3)*.75;start<r.x+r.w;start+=2.25){
          const left=Math.max(r.x,start),right=Math.min(start+2.25,r.x+r.w);
          emit('box',color,(left+right)/2,-.018,z,right-left-.005,.036,r.d/rows-.004);
        }
      }
      const wallEdge=(t.side+2)%4,wallLength=length(r,wallEdge),wallJoin=point(r,wallEdge,wallLength/2);
      // A continuous edge board seals the tiny plank-end gap at the facade.
      emit('box',boardTones[0],wallJoin.x,-.018,wallJoin.z,t.side%2?.024:wallLength,.036,t.side%2?wallLength:.024);
      // The wall flashing bridges the roof-to-facade joint; its vertical leg
      // tucks under the main eave and the apron lies over the terrace covering.
      const wallStart=t.side%2?Math.max(0,s.z):Math.max(0,s.x);
      const wallEnd=t.side%2?Math.min(p.d,s.z+s.d):Math.min(p.w,s.x+s.w);
      if(wallEnd>wallStart){
        const mid=(wallStart+wallEnd)/2,n=edgeNormal[t.side];
        const x=t.side===1?p.w:t.side===3?0:mid,z=t.side===0?p.d:t.side===2?0:mid;
        const high=window.RoofStudio?.positionHeight(s,x,z);
        if(Number.isFinite(high)){
          const len=wallEnd-wallStart;
          emit('box',fascia,x+n[0]*.008,high+.084,z+n[1]*.008,t.side%2?.016:len,.15,t.side%2?len:.016);
          emit('box',fascia,x+n[0]*.075,high+.014,z+n[1]*.075,t.side%2?.17:len,.018,t.side%2?len:.17);
        }
      }
      emit('box','#675749',r.x+r.w/2,-.096,r.z+r.d/2,r.w-.01,.14,r.d-.01);
      for(const e of [0,1,2,3]){
        const len=length(r,e),center=point(r,e,len/2,-.016);
        emit('box',fascia,center.x,-.096,center.z,e%2?.035:len,.145,e%2?len:.035);
        const n=Math.max(1,Math.ceil(len/2.25));
        for(let i=0;i<=n;i++){const q=point(r,e,clamp(len*i/n,.1,len-.1),-.1);emit('box',bracket,q.x,(level-.13)/2,q.z,.14,-level-.13,.14);}
      }
      function handrail(e,a,b,za,zb,selection,forceSteel=false){
        const len=Math.hypot(a.x-b.x,a.z-b.z);if(len<.08)return;
        const style=t.rail,color=style==='wood'?timber:steel,height=.96;
        const P=v=>({x:a.x+(b.x-a.x)*v,z:a.z+(b.z-a.z)*v}),Y=v=>za+(zb-za)*v;
        const bays=Math.max(1,Math.ceil(len/1.35));
        for(let i=0;i<=bays;i++){
          const n=i/bays,c=P(n),y=Y(n);
          emit('box',color,c.x,y+height/2,c.z,.075,height,.075,null,selection);
          emit('box',bracket,c.x,y+.02,c.z,.108,.035,.108,null,selection);
        }
        railBetween(a,b,za+height,zb+height,.076,.076,color,selection);
        if(style==='glass'&&!forceSteel){
          for(let i=0;i<bays;i++){
            const q=P((i+.5)/bays);emit('box','glass',q.x,Y((i+.5)/bays)+.51,q.z,e%2?.014:len/bays-.09,.79,e%2?len/bays-.09:.014,null,selection);
          }
        }else{
          railBetween(a,b,za+.13,zb+.13,.045,.045,color,selection);
          const n=Math.max(1,Math.ceil(len/.13));
          for(let i=1;i<n;i++){
            const u=i/n,q=P(u),y=Y(u);
            if(style==='wood'&&!forceSteel){
              emit('turned',timber,q.x,y+.52,q.z,.072,.77,.072,null,selection);
            }else emit('box',color,q.x,y+.52,q.z,.027,.77,.027,null,selection);
          }
        }
      }
      if(t.rail!=='none'){
        for(const e of t.edges.filter(e=>e!==(t.side+2)%4))for(const [a,b] of segments(r,s,e))handrail(e,point(r,e,a,-.043),point(r,e,b,-.043),0,0);
      }
      for(const entry of t.stairs){
        const {center,width}=stairDims(r,entry),e=entry.edge,n=Math.max(1,Math.ceil(-level/.178));
        const rise=-level/n,target={type:'terrace',sectionId:s.id,entryId:entry.id};
        for(let i=0;i<n;i++){
          const top=-(n-1-i)*rise,c=point(r,e,center,entry.run*(n-i-.5)/n);
          emit('box',fascia,c.x,(top+level)/2-.006,c.z,e%2?entry.run/n:width,top-level-.014,e%2?width:entry.run/n,null,target);
          emit('box',timber,c.x,top-.017,c.z,e%2?entry.run/n+.016:width+.025,.034,e%2?width+.025:entry.run/n+.016,null,target);
        }
        if(entry.rails){
          for(const sign of [-1,1]){
            const along=center+sign*(width/2-.04);
            handrail(e,point(r,e,along,.035),point(r,e,along,entry.run-.06),0,level+rise,target,t.rail==='glass');
          }
        }
      }
      for(const {shape,mat,selection,transforms} of batch.values()){
        if(!geometries.has(shape)){
          const profile=[[.36,-.5],[.40,-.43],[.26,-.36],[.22,-.28],[.38,-.17],[.44,-.10],[.35,-.02],[.24,.10],[.22,.25],[.32,.34],[.41,.42],[.36,.5]];
          geometries.set(shape,shape==='box'?new T.BoxGeometry(1,1,1):new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),10));
        }
        if(!mats.has(mat))mats.set(mat,new T.MeshStandardMaterial(mat==='glass'?{color:'#c6e3e7',transparent:true,opacity:.31,roughness:.14,metalness:.2,depthWrite:false}:{color:mat,map:mat===timber||boardTones.includes(mat)?woodMap:null,roughness:mat===steel?.42:.76,metalness:mat===steel?.39:.04}));
        const item=new T.InstancedMesh(geometries.get(shape),mats.get(mat),transforms.length);
        transforms.forEach((m,i)=>item.setMatrixAt(i,m));item.receiveShadow=true;item.castShadow=mat!=='glass';item.userData.target=selection;group.add(item);
      }
    }
  }
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function geometry(p){
    const bounds=[{x:0,z:0},{x:p.w,z:p.d}];
    for(const s of sections(p)){
      const r=rect(p,s);bounds.push({x:r.x-.2,z:r.z-.2},{x:r.x+r.w+.2,z:r.z+r.d+.2});
      for(const st of s.terrace.stairs){const {a,b}=stairDims(r,st);bounds.push(point(r,st.edge,a,st.run),point(r,st.edge,b,st.run));}
    }
    const xs=bounds.map(a=>a.x),zs=bounds.map(a=>a.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    const scale=Math.min(730/(maxX-minX),363/(maxZ-minZ));
    return {x:450-(minX+maxX)*.5*scale,y:269-(minZ+maxZ)*.5*scale,scale};
  }
  function overlay(p,g,selected='',editing=false){
    const X=x=>g.x+x*g.scale,Z=z=>g.y+z*g.scale,S=g.scale;
    const line=(a,b,stroke,weight,data='')=>'<path d="M'+X(a.x)+' '+Z(a.z)+'L'+X(b.x)+' '+Z(b.z)+'" fill="none" stroke="'+stroke+'" stroke-width="'+weight+'" '+data+'/>';
    const handle=(a,act,title='',form='rect')=>'<g data-terr-action="'+act+'" style="cursor:grab"><title>'+esc(title)+'</title><circle cx="'+X(a.x)+'" cy="'+Z(a.z)+'" r="12" fill="transparent"/>'+(form==='rect'?'<rect x="'+(X(a.x)-4.5)+'" y="'+(Z(a.z)-4.5)+'" width="9" height="9" rx="2"':'<circle cx="'+X(a.x)+'" cy="'+Z(a.z)+'" r="5"')+' fill="white" stroke="#086db9" stroke-width="2"/></g>';
    let svg='';
    for(const s of sections(p)){
      const r=rect(p,s),sel=editing&&selected===s.id,st=local(p);let art='';
      const tag=sel?' stroke="#1485c5" stroke-width="2"':' stroke="#95836c" stroke-width="1"';
      art+='<rect x="'+X(r.x)+'" y="'+Z(r.z)+'" width="'+r.w*S+'" height="'+r.d*S+'" fill="#e4d4bc" '+tag+' data-terr-action="move" style="cursor:grab"/>';
      for(let z=r.z+.16;z<r.z+r.d;z+=.16)art+=line({x:r.x,z},{x:r.x+r.w,z},'#c9bba6',.7,'pointer-events="none"');
      if(s.terrace.rail!=='none')for(const e of s.terrace.edges.filter(e=>e!==(s.terrace.side+2)%4))for(const [a,b] of segments(r,s,e))art+=line(point(r,e,a,-.04),point(r,e,b,-.04),'#68655e',2.7,'pointer-events="none"');
      const face=s.terrace.side;
      if(sel){
        const along=face%2?'d':'w',middle=point(r,face,length(r,face)/2);
        art+=handle(middle,'depth','Вылет террасы');
        for(const [e,which] of (along==='w'?[[3,'small'],[1,'large']]:[[2,'small'],[0,'large']]))art+=handle(point(r,e,length(r,e)/2),'span-'+which,'Растянуть край террасы');
      }
      for(const entry of s.terrace.stairs){
        const e=entry.edge,{center,width,a,b}=stairDims(r,entry),corners=[point(r,e,a),point(r,e,b),point(r,e,b,entry.run),point(r,e,a,entry.run)];
        let step='<polygon points="'+corners.map(c=>X(c.x)+','+Z(c.z)).join(' ')+'" fill="#d4bea1" stroke="#716659" stroke-width="1.25" data-terr-action="stair" style="cursor:grab"/>';
        const n=Math.max(1,Math.ceil(-ground(p)/.178));
        for(let i=1;i<n;i++)step+=line(point(r,e,a,entry.run*i/n),point(r,e,b,entry.run*i/n),'#8b7b68',1,'pointer-events="none"');
        if(entry.rails)for(const at of [a+.025,b-.025])step+=line(point(r,e,at),point(r,e,at,entry.run),'#64685e',1.8,'pointer-events="none"');
        if(sel&&st.entry===entry.id){
          step+=handle(point(r,e,center,entry.run),'run','Длина марша','circle')+handle(point(r,e,b,entry.run*.5),'width','Ширина лестницы');
        }
        art+='<g data-terr-entry="'+esc(entry.id)+'">'+step+'</g>';
      }
      for(const post of s.posts){
        const x=X(s.x+post.u*s.w),z=Z(s.z+post.v*s.d),active=sel&&st.post===post.id,half=Math.max(3,post.size*S/2);
        art+='<g data-terr-post="'+esc(post.id)+'" data-terr-action="post" style="cursor:grab"><title>Опора '+number(post.size*1000)+' мм</title><circle cx="'+x+'" cy="'+z+'" r="10" fill="transparent"/><rect x="'+(x-half)+'" y="'+(z-half)+'" width="'+(2*half)+'" height="'+(2*half)+'" fill="'+(active?'#f3aa4f':'#675b4c')+'" stroke="white"/></g>';
      }
      svg+='<g data-terr-id="'+esc(s.id)+'">'+art+'</g>';
    }
    return svg;
  }
  function svgPlan(p,selected='',editing=false,g=geometry(p)){
    const x=g.x,y=g.y,S=g.scale;
    let body='<rect width="900" height="530" fill="#f4f9fb"/><rect x="'+x+'" y="'+y+'" width="'+p.w*S+'" height="'+p.d*S+'" fill="#e1e9ed" stroke="#63839a" stroke-width="2"/>';
    for(const o of p.ops.filter(o=>o.floor===0)){
      const a=xyz(p,o.f,o.x,0),b=xyz(p,o.f,o.x+o.w,0);
      body+='<path d="M'+(x+a[0]*S)+' '+(y+a[2]*S)+'L'+(x+b[0]*S)+' '+(y+b[2]*S)+'" stroke="'+(o.k>=2?'#338573':'#92bdcf')+'" stroke-width="'+(o.k>=2?6:4)+'"/>';
    }
    body+='<text x="'+(x+p.w*S/2)+'" y="'+(y+p.d*S/2)+'" text-anchor="middle" fill="#34576c" font-size="17">Дом · '+number(p.w)+' × '+number(p.d)+' м</text>';
    for(const [fax,station] of [[0,p.d-.4],[2,.45]]){
      body+='<text x="'+(x+p.w*S/2)+'" y="'+(y+station*S)+'" text-anchor="middle" fill="#526c82" font-size="12">'+facadeNames[fax]+'</text>';
    }
    body+=overlay(p,g,selected,editing);
    return '<svg xmlns="http://www.w3.org/2000/svg" style="height:100%;width:100%;display:block;touch-action:none" viewBox="0 0 900 530" role="img" aria-label="План террас" font-family="Arial,sans-serif">'+body+'</svg>';
  }
  function svgElevationLayers(p,f,g){
    const proj=(q,y)=>({x:g.x0+([q.x,p.d-q.z,p.w-q.x,q.z][f])*g.scale,y:g.base-y*g.scale});
    const depth=q=>[q.z,q.x,-q.z,-q.x][f],parts=[];
    const beam=(a,b,ay,by,color,width)=>{
      const start=proj(a,ay),end=proj(b,by);
      parts.push({depth:(depth(a)+depth(b))/2+.005,markup:'<path d="M'+start.x+','+start.y+' L'+end.x+','+end.y+'" stroke="'+color+'" stroke-width="'+Math.max(.6,width*g.scale)+'" fill="none"/>'});
    };
    for(const s of sections(p)){
      const r=rect(p,s),floor=ground(p),railY=.96;
      for(let e=0;e<4;e++){
        const len=length(r,e),a=point(r,e,0),b=point(r,e,len);
        beam(a,b,-.082,-.082,p.top,.164);beam(a,b,0,0,'#ac9270',.036);
        for(const u of [.08,len-.08]){const at=point(r,e,u,-.08);beam(at,at,floor,-.14,'#6f746b',.14);}
        if(s.terrace.rail==='none'||!s.terrace.edges.includes(e)||e===(s.terrace.side+2)%4)continue;
        for(const [i,j] of segments(r,s,e)){
          beam(point(r,e,i),point(r,e,j),railY,railY,'#756f63',.07);
          const n=Math.max(1,Math.ceil((j-i)/(s.terrace.rail==='glass'?1.2:.15)));
          for(let k=0;k<=n;k++){const pt=point(r,e,i+(j-i)*k/n);beam(pt,pt,.06,railY,'#77766e',.038);}
        }
      }
      for(const st of s.terrace.stairs){
        const {a,b}=stairDims(r,st),n=Math.max(1,Math.ceil(-floor/.178));
        for(let i=0;i<n;i++){
          const y=floor+(-floor)*(i+1)/n,out=st.run*(n-i)/n;
          const A=point(r,st.edge,a,out),B=point(r,st.edge,b,out);beam(A,B,y-.028,y-.028,'#a69174',.055);
          for(const side of [a,b])beam(point(r,st.edge,side,out-st.run/n),point(r,st.edge,side,out),y,y,'#7a776e',.045);
        }
        if(st.rails)for(const side of [a,b])beam(point(r,st.edge,side),point(r,st.edge,side,st.run),railY,floor+(-floor)/n+railY,'#796f61',.066);
      }
    }
    return parts;
  }

  function node(tag,label,parent){
    const e=document.createElement(tag);if(label!=null)e.textContent=label;if(parent)parent.append(e);return e;
  }
  function selectedSection(p,opts,st){
    const all=sections(p);return all.find(s=>s.id===opts.sectionId)||all.find(s=>s.id===st.section)||all[0];
  }
  function selectPart(p,obj){
    const st=local(p);st.section=obj.sectionId;st.post=obj.postId||'';st.entry=obj.entryId||'';st.mode='';
  }
  function defaultPart(st,s){
    if(!s)return;
    if(st.section!==s.id){st.section=s.id;st.post='';st.entry='';st.mode='';}
    if(!s.terrace.stairs.some(i=>i.id===st.entry))st.entry=s.terrace.stairs[0]?.id||'';
    if(!s.posts.some(i=>i.id===st.post))st.post=s.posts[0]?.id||'';
  }
  function commit(ctx,q,selectId){
    const error=validate(q);if(error){ctx.opts.onMessage?.(error);return false;}
    if(selectId&&ctx.host)ctx.opts.onSelect?.(selectId);
    if(ctx.opts.onCommit(q)===false){if(selectId&&ctx.host&&ctx.s)ctx.opts.onSelect?.(ctx.s.id);return false;}
    if(selectId&&!ctx.host)ctx.opts.onSelect?.(selectId);
    return true;
  }
  function modify(ctx,fn){
    const q=clone(ctx.p),s=q.roofSections.find(a=>a.id===ctx.s?.id);
    if(fn(q,s)===false)return;commit(ctx,q,ctx.st.section);
  }
  function inspector(ctx){
    const {p,s,st,opts,el}=ctx;el.replaceChildren();node('h2','Терраса и вход',el);
    const btn=(par,title,fn)=>{const b=node('button',title,par);b.type='button';b.onclick=fn;return b;};
    const pick=(par,title,items,current,fn)=>{
      const l=node('label',title,par),sel=node('select',null,l);sel.setAttribute('aria-label',title);
      for(const [key,value] of items)sel.add(new Option(value,String(key),false,String(key)===String(current)));sel.onchange=()=>fn(sel.value);return sel;
    };
    const numeric=(par,title,value,min,max,fn)=>{
      const l=node('label',title,par),i=node('input',null,l);i.type='number';i.value=round(value);i.step='any';i.min=min;i.max=max;
      i.onchange=()=>{if(i.reportValidity()&&Number.isFinite(i.valueAsNumber))fn(i.valueAsNumber);else i.value=value;};return i;
    };
    const row=par=>{const div=node('div',null,par);div.className='row';return div;};
    const fold=(title,init=false)=>{
      st.open??={};const group=node('details',null,el),label=node('summary',title,group);group.open=st.open[title]??init;label.onclick=()=>st.open[title]=!group.open;return group;
    };
    const rerender=()=>{if(ctx.host)ctx.redraw();else inspector(ctx);};
    function activate(mode){
      st.mode=st.mode===mode?'':mode;
      if(!ctx.host){opts.onPlan?.(s.id);return;}rerender();
    }
    const all=sections(p);
    if(all.length)pick(el,'Терраса',all.map(a=>[a.id,a.name]),s.id,value=>{
      st.section=value;st.entry='';st.post='';st.mode='';opts.onSelect?.(value);
      if(ctx.host){ctx.s=all.find(t=>t.id===value);defaultPart(st,ctx.s);ctx.redraw();}
    });
    if(!s){
      node('p','Выберите фасад и пристройте террасу к дому. Настил будет на отметке пола первого этажа.',el).className='muted';
      const side=pick(el,'К какому фасаду пристроить',facadeNames.map((v,i)=>[i,v]),0,()=>{});
      btn(el,'+ Пристроить террасу',()=>modify(ctx,q=>{st.section=add(q,+side.value).id;}));return;
    }
    if(!ctx.host)btn(el,'Править террасу на плане',()=>opts.onPlan?.(s.id));
    else{
      btn(el,'Посмотреть террасу в 3D',()=>opts.onModel?.(s.id));
      node('p',({post:'Нажмите на настил, чтобы поставить опору.',stair:'Нажмите на наружный край для установки лестницы.',door:'Нажмите вдоль стены дома у настила, чтобы поставить дверь.'})[st.mode]||'Потяните настил вдоль фасада, маркер края — для изменения размера. Ступени и опоры можно перемещать.',el).className='muted';
    }
    const t=s.terrace,side=t.side,r=rect(p,s),{span,depth,center}=dimensions(p,s);
    pick(el,'Сторона дома',facadeNames.map((v,i)=>[i,v]),side,v=>modify(ctx,(q,a)=>rotateSide(q,a,+v)));
    const dims=row(el),setDims=(w,d)=>modify(ctx,(q,a)=>fitToSide(q,a,side,w,d,center));
    numeric(dims,'Ширина террасы, м',span,1,(side%2?p.d:p.w)+.5,a=>setDims(a,depth));
    numeric(dims,'Вылет от стены, м',depth,1,15,a=>setDims(span,a));
    node('p','Уровень настила ±0,000 · вровень с полом дома',el).className='small';
    const finish=fold('Цвет навеса и подшивки');
    for(const [key,title,fallback] of [['top','Кровля дома и навеса','#465357'],['soffitColor','Подшивка снизу','#ded7c9']]){
      const label=node('label',title,finish),input=node('input',null,label);input.type='color';input.value=p[key]||fallback;
      input.onchange=()=>modify(ctx,q=>{q[key]=input.value;});
    }
    const entries=fold('Вход и ступени',true);
    const stair=t.stairs.find(a=>a.id===st.entry);
    if(t.stairs.length)pick(entries,'Лестница',t.stairs.map((a,i)=>[a.id,'Вход '+(i+1)+' · '+names[a.edge].toLowerCase()+' сторона']),st.entry,v=>{st.entry=v;rerender();});
    if(stair){
      const editSt=fn=>modify(ctx,(q,a)=>fn(a.terrace.stairs.find(i=>i.id===stair.id)));
      const pos=row(entries);
      pick(pos,'Край настила',names.map((v,i)=>[i,v]).filter(([i])=>i!==(side+2)%4),stair.edge,v=>editSt(a=>{a.edge=+v;a.at=.5;}));
      numeric(pos,'Центр от края, м',stairDims(r,stair).center,0,length(r,stair.edge),n=>editSt(a=>a.at=clamp(n/length(r,a.edge),0,1)));
      const dims=row(entries);numeric(dims,'Ширина марша, м',stairDims(r,stair).width,.45,length(r,stair.edge),v=>editSt(a=>a.width=v));
      numeric(dims,'Длина марша, м',stair.run,.3,6,v=>editSt(a=>a.run=v));
      const l=node('label',null,entries);l.className='terr-check';const cb=node('input',null,l);cb.type='checkbox';cb.checked=stair.rails;l.append('Поручни на лестнице');cb.onchange=()=>editSt(a=>a.rails=cb.checked);
      btn(entries,'Снять лестницу',()=>modify(ctx,(q,a)=>a.terrace.stairs=a.terrace.stairs.filter(i=>i.id!==stair.id)));
    }
    btn(entries,st.mode==='stair'?'Отмена установки входа':'+ Вход со ступенями',()=>activate('stair'));
    btn(entries,st.mode==='door'?'Отмена установки двери':'Дверь из дома на террасу',()=>activate('door'));
    const rails=fold('Перила и балясины');
    pick(rails,'Заполнение ограждения',[['none','Открытый край'],...Object.entries(styles)],t.rail,v=>modify(ctx,(q,a)=>a.terrace.rail=v));
    if(t.rail!=='none')for(const e of [0,1,2,3].filter(k=>k!==(side+2)%4)){
      const l=node('label',null,rails);l.className='terr-check';const cb=node('input',null,l);cb.type='checkbox';cb.checked=t.edges.includes(e);l.append(names[e]+' сторона');
      cb.onchange=()=>modify(ctx,(q,a)=>a.terrace.edges=cb.checked?[...a.terrace.edges,e]:a.terrace.edges.filter(k=>k!==e));
    }
    const posts=fold('Опоры крыши'),post=s.posts.find(a=>a.id===st.post);
    if(s.posts.length)pick(posts,'Опора',s.posts.map((a,i)=>[a.id,'Столб '+(i+1)]),st.post,v=>{st.post=v;rerender();});
    if(post){
      numeric(posts,'Сечение опоры, мм',post.size*1000,80,600,v=>modify(ctx,(q,a)=>a.posts.find(i=>i.id===post.id).size=v/1000));
      btn(posts,'Копировать столб',()=>modify(ctx,(q,a)=>{
        const candidate=clone(post);candidate.id=id();
        // Place the copy on free space under the same span, keeping its cross-section.
        const shift=Math.max(.30,post.size+.09),width=r.w,depth=r.d;let found=false;
        for(let n=1;n<=Math.ceil(Math.max(width,depth)/shift)&&!found;n++)for(const [dx,dz] of [[shift,0],[-shift,0],[0,shift],[0,-shift]]){
          const u=post.u+n*dx/s.w,v=post.v+n*dz/s.d;
          if(u<.03||v<.03||u>.97||v>.97||a.posts.some(o=>Math.hypot((o.u-u)*s.w,(o.v-v)*s.d)<(o.size+post.size)/2+.04))continue;
          candidate.u=u;candidate.v=v;found=true;break;
        }
        if(!found){opts.onMessage?.('Под крышей нет свободного места для копии.');return false;}a.posts.push(candidate);st.post=candidate.id;
      }));
      btn(posts,'Удалить столб',()=>modify(ctx,(q,a)=>a.posts=a.posts.filter(i=>i.id!==post.id)));
    }
    btn(posts,st.mode==='post'?'Отмена установки столба':'+ Поставить столб',()=>activate('post'));
    const actions=fold('Добавить или удалить террасу');
    const sidePick=pick(actions,'Новая терраса',facadeNames.map((v,i)=>[i,v]),(side+1)%4,()=>{});
    btn(actions,'+ Пристроить террасу',()=>modify(ctx,q=>{st.section=add(q,+sidePick.value).id;st.post='';st.entry='';}));
    btn(actions,'Удалить террасу целиком',()=>modify(ctx,(q,a)=>{
      q.roofSections=q.roofSections.filter(i=>i.id!==a.id);st.section=sections(q)[0]?.id||'';st.post='';st.entry='';st.mode='';
    }));
  }
  function editor(el,p,opts){
    const st=local(p),s=selectedSection(p,opts,st);defaultPart(st,s);inspector({el,p,s,st,opts});
  }
  function draw(host,p,opts){
    const st=local(p),s=selectedSection(p,opts,st);defaultPart(st,s);
    const surface=node('div');surface.style.cssText='position:absolute;inset:0;touch-action:none;user-select:none';
    host.replaceChildren(surface);let drag=null;
    const ctx={el:opts.controls,host,p,s,st,opts};const g=geometry(p);
    function paint(q=p){surface.innerHTML=svgPlan(q,st.section,true,g);}
    ctx.redraw=()=>{paint();inspector(ctx);};ctx.redraw();
    function groundAt(e){
      const svg=surface.firstElementChild,matrix=svg?.getScreenCTM();if(!matrix)return null;
      const a=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return {x:(a.x-g.x)/g.scale,z:(a.y-g.y)/g.scale};
    }
    surface.onpointerdown=e=>{
      if(e.button!==0)return;const pt=groundAt(e);if(!pt)return;
      const part=e.target.closest('[data-terr-id]'),selected=sections(p).find(i=>i.id===part?.dataset.terrId);
      if(st.mode&&ctx.s){
        const r=rect(p,ctx.s);e.preventDefault();
        if(st.mode==='post'){
          if(pt.x<r.x||pt.x>r.x+r.w||pt.z<r.z||pt.z>r.z+r.d){opts.onMessage?.('Нажмите в пределах настила.');return;}
          modify(ctx,(q,s)=>{
            const post={id:id(),u:clamp((pt.x-s.x)/s.w,.018,.982),v:clamp((pt.z-s.z)/s.d,.018,.982),size:.15};
            if(s.posts.some(i=>Math.hypot((i.u-post.u)*s.w,(i.v-post.v)*s.d)<(i.size+post.size)/2+.02)){opts.onMessage?.('Здесь уже стоит опора.');return false;}
            s.posts.push(post);st.post=post.id;st.mode='';
          });
        }else if(st.mode==='door'){
          const near=nearest(r,pt.x,pt.z);if(near.dist>.65||near.edge!==(ctx.s.terrace.side+2)%4){opts.onMessage?.('Укажите стену, примыкающую к настилу.');return;}
          modify(ctx,(q,s)=>{if(!exitDoor(q,s,s.terrace.side%2?pt.z:pt.x)){opts.onMessage?.('Здесь уже есть проём. Выберите свободное место вдоль стены.');return false;}st.mode='';});
        }else{
          const near=nearest(r,pt.x,pt.z,(ctx.s.terrace.side+2)%4);
          if(near.dist>.8){opts.onMessage?.('Укажите наружный край настила.');return;}
          modify(ctx,(q,s)=>{const stair={id:id(),edge:near.edge,at:near.at,width:Math.min(1.3,length(r,near.edge)-.1),run:1.12,rails:true};s.terrace.stairs.push(stair);st.entry=stair.id;st.mode='';});
        }
        return;
      }
      if(!selected)return;e.preventDefault();e.stopPropagation();
      if(st.section!==selected.id){
        ctx.s=selected;defaultPart(st,selected);
      }
      const post=e.target.closest('[data-terr-post]')?.dataset.terrPost,entry=e.target.closest('[data-terr-entry]')?.dataset.terrEntry;
      if(post)st.post=post;if(entry)st.entry=entry;
      const act=e.target.closest('[data-terr-action]')?.dataset.terrAction||'move';
      drag={id:selected.id,act,start:pt,pid:e.pointerId,post,entry,moved:false};
      surface.setPointerCapture(e.pointerId);ctx.redraw();
    };
    function adjusted(pt){
      const q=clone(p),s=q.roofSections.find(i=>i.id===drag.id),r=rect(p,s),t=s.terrace,face=t.side;
      const dx=pt.x-drag.start.x,dz=pt.z-drag.start.z,{span:len,depth,center}=dimensions(p,s);
      const axis=snap(face%2?dz:dx),out=snap(dx*edgeNormal[face][0]+dz*edgeNormal[face][1]);
      if(drag.act==='post'){
        const post=s.posts.find(i=>i.id===drag.post);post.u=clamp(post.u+dx/s.w,.025,.975);post.v=clamp(post.v+dz/s.d,.025,.975);
      }else if(['stair','run','width'].includes(drag.act)){
        const a=t.stairs.find(i=>i.id===drag.entry),e=a.edge,sd=stairDims(r,a),d=e%2?dz:dx;
        if(drag.act==='stair'){const near=nearest(r,pt.x,pt.z,(face+2)%4);a.edge=near.edge;a.at=near.at;}
        else if(drag.act==='run')a.run=clamp(snap(a.run+dx*edgeNormal[e][0]+dz*edgeNormal[e][1]),.3,6);
        else a.width=clamp(snap(sd.width+2*d),.45,length(r,e)-.04);
      }else if(drag.act==='move')fitToSide(q,s,face,len,depth,center+axis);
      else if(drag.act==='depth')fitToSide(q,s,face,len,depth+out,center);
      else if(drag.act==='span-small')fitToSide(q,s,face,len-axis,depth,center+axis/2);
      else if(drag.act==='span-large')fitToSide(q,s,face,len+axis,depth,center+axis/2);
      return q;
    }
    surface.onpointermove=e=>{
      if(!drag||e.pointerId!==drag.pid)return;const pt=groundAt(e);if(!pt)return;
      if(!drag.moved&&Math.hypot(pt.x-drag.start.x,pt.z-drag.start.z)<.04)return;
      drag.moved=true;drag.next=adjusted(pt);paint(drag.next);
    };
    surface.onpointerup=e=>{
      if(!drag||e.pointerId!==drag.pid)return;
      const end=drag;drag=null;
      if(end.moved){if(!commit(ctx,end.next,end.id))ctx.redraw();}
      else{opts.onSelect?.(end.id);if(surface.isConnected)ctx.redraw();}
    };
    surface.onpointercancel=()=>{drag=null;ctx.redraw();};
  }
  return {initialize,sections,rect,add,attach,resizeDeck,followHouse,followEdits,validate,selectPart,byDoor,mesh,svgPlan,svgElevationLayers,overlay,editor,draw};
})();

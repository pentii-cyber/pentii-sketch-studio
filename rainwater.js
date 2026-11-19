/* Eaves and downpipes share one world-space layout for the live model,
   orthographic elevations and the client album. Lengths are in metres. */
window.PentiiRainwater=(()=>{
  'use strict';
  const T=THREE,V=(x,y,z)=>new T.Vector3(x,y,z),up=V(0,1,0);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const memo=new WeakMap(),precision=.00002;
  const key=v=>[v.x,v.y,v.z].map(n=>Math.round(n*10000)).join(',');
  const projectedDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const metadata=f=>f.dormerId||'';
  function planeInfo(f){
    const points=f.q.map(a=>V(...a)),a=points[0];
    if(!a)return null;
    let n=V(0,0,0);
    for(let i=1;i<points.length-1;i++){
      n=points[i].clone().sub(a).cross(points[i+1].clone().sub(a));if(Math.abs(n.y)>1e-7)break;
    }
    if(Math.abs(n.y)<1e-7)return null;
    const mx=-n.x/n.y,mz=-n.z/n.y,c=a.y-mx*a.x-mz*a.z;
    const centroid=points.reduce((s,b)=>s.add(b),V(0,0,0)).multiplyScalar(1/points.length);
    const lines=points.map((v,i)=>{
      const w=points[(i+1)%points.length];let x=-(w.z-v.z),z=w.x-v.x,d=-x*v.x-z*v.z;
      if(x*centroid.x+z*centroid.z+d<0){x=-x;z=-z;d=-d}
      return {x,z,d};
    });
    return {mx,mz,c,points,centroid,lines,sectionId:f.sectionId,element:metadata(f)};
  }
  const height=(s,pt)=>s.mx*pt.x+s.mz*pt.z+s.c;
  const contains=(s,pt)=>s.lines.every(l=>l.x*pt.x+l.z*pt.z+l.d>=-precision);
  function roofEdges(section,raw){
    const mapped=new Map();
    for(const f of raw){
      if(!f.roof)continue;
      const face=planeInfo(f);if(!face)continue;
      const q=face.points;
      for(let i=0;i<q.length;i++){
        const a=q[i],b=q[(i+1)%q.length];
        if(projectedDistance(a,b)<precision)continue;
        const name=face.element+'/'+[key(a),key(b)].sort().join('|');
        if(!mapped.has(name))mapped.set(name,{a,b,adj:[],sectionId:section.id,element:face.element});
        mapped.get(name).adj.push(face);
      }
    }
    return [...mapped.values()];
  }
  function describe(edge,section){
    const {a,b,adj}=edge,mid=a.clone().lerp(b,.5);
    const normal=V(-(b.z-a.z),0,b.x-a.x).normalize();
    function away(face){
      const outward=normal.clone();
      if(outward.dot(mid.clone().sub(face.centroid))<0)outward.negate();
      let inwardRise=-(face.mx*outward.x+face.mz*outward.z);
      if(section.liftPoints?.length&&!edge.element&&RoofStudio.positionHeight){
        const dist=.014,inner=mid.clone().addScaledVector(outward,-dist);
        inwardRise=(RoofStudio.positionHeight(section,inner.x,inner.z)-mid.y)/dist;
      }
      return {outward,inwardRise};
    }
    const {outward,inwardRise}=away(adj[0]);
    if(adj.length>1){
      const other=away(adj[1]),angle=Math.abs(adj[0].mx-adj[1].mx)+Math.abs(adj[0].mz-adj[1].mz);
      if(angle<.018)return null;
      return {type:inwardRise>.01&&other.inwardRise>.01?'valley':'ridge',out:outward,drains:false};
    }
    const flat=section.roof===3&&Math.abs(adj[0].mx)+Math.abs(adj[0].mz)<.01;
    return {type:'outer',out:outward,drains:inwardRise>.012||(flat&&Math.abs(outward.z)>.9)};
  }
  // Intersect an edge parameter interval with each half-space of a covering face.
  function hiddenBy(edge,s,maxGap=Infinity){
    const a=edge.a,b=edge.b;let lo=0,hi=1;
    function clip(av,bv){
      if(av<0&&bv<0)return false;
      if(av<0)lo=Math.max(lo,av/(av-bv));else if(bv<0)hi=Math.min(hi,av/(av-bv));
      return hi>lo+1e-6;
    }
    for(const l of s.lines)if(!clip(l.x*a.x+l.z*a.z+l.d+precision,l.x*b.x+l.z*b.z+l.d+precision))return null;
    if(!clip(height(s,a)-a.y-.004,height(s,b)-b.y-.004))return null;
    if(Number.isFinite(maxGap)&&!clip(maxGap-height(s,a)+a.y,maxGap-height(s,b)+b.y))return null;
    return [lo,hi];
  }
  function exposed(edge,surfaces,layered){
    const covered=[];
    for(const s of surfaces){
      if(s.sectionId===edge.sectionId&&s.element===edge.element)continue;
      const gap=layered?.has(edge.sectionId)||layered?.has(s.sectionId)?RoofStudio.soffitDrop+.02:Infinity;
      const range=hiddenBy(edge,s,gap);if(range)covered.push(range);
    }
    covered.sort((a,b)=>a[0]-b[0]);const spans=[];let start=0;
    for(const [lo,hi] of covered){if(lo>start+1e-5)spans.push([start,lo]);start=Math.max(start,hi);}
    if(start<1-1e-5)spans.push([start,1]);
    return spans;
  }
  function wallSeat(p,at,side,radius,section){
    // Every roof drains against its own envelope, in world coordinates. An
    // annex must never send its outlet across the yard to the original house.
    const e=(p.extensions||[]).find(e=>e.id===section?.extensionId);
    const body=e||p,ox=e?.x||0,oz=e?.z||0,w=body.w,d=body.d;
    const len=side%2?d:w,inset=Math.min(.22,len*.2),distance=.048+radius;
    const localX=at.x-ox,localZ=at.z-oz;
    const dim=side===0?localX:side===1?d-localZ:side===2?w-localX:localZ;
    const ops=(body.ops||[]).filter(o=>o.f===side);
    const neighbors=[{id:'main',x:0,z:0,w:p.w,d:p.d,h:p.h*p.n,walls:true},...(p.extensions||[]).filter(e=>e.walls).map(e=>({...e,h:e.h*(e.n||1)}))].filter(b=>b.id!==(e?.id||'main'));
    const pointAt=x=>[V(ox+x,at.y,oz+d+distance),V(ox+w+distance,at.y,oz+d-x),V(ox+w-x,at.y,oz-distance),V(ox-distance,at.y,oz+x)][side];
    function clear(x){
      if(!ops.every(o=>x<o.x-radius-.08||x>o.x+o.w+radius+.08))return false;
      const pt=pointAt(x);
      return !neighbors.some(b=>pt.x>b.x-.001&&pt.x<b.x+b.w+.001&&pt.z>b.z-.001&&pt.z<b.z+b.d+.001&&at.y<b.h+.16);
    }
    const search=[dim,...ops.flatMap(o=>[o.x-radius-.09,o.x+o.w+radius+.09]),inset,len-inset]
      .map(x=>clamp(x,inset,len-inset)).filter(clear).sort((a,b)=>Math.abs(a-dim)-Math.abs(b-dim));
    if(!search.length)return null;
    const point=pointAt(search[0]),out=[V(0,0,1),V(1,0,0),V(0,0,-1),V(-1,0,0)][side];
    return {point,out,side,extensionId:e?.id,anchor:point.clone().addScaledVector(out,-distance)};
  }
  function pipeOn(run,target,p,section,systems,used){
    const delta=run.b.clone().sub(run.a),horizontal=delta.x**2+delta.z**2;
    const tangent=V(delta.x,0,delta.z).normalize(),span=Math.sqrt(horizontal),{out}=run;
    const rr=systems.pipeRadius,channel=systems.width/2;
    function station(t){return run.a.clone().lerp(run.b,t).addScaledVector(out,channel+.029)}
    const candidates=[];
    // Put the drop at a corner, but keep it on the same wall as the eave,
    // facing the viewer. A small setback leaves the corner flashing visible.
    let first=station(target);
    for(let side=0;side<4;side++){
      let seat=wallSeat(p,first,side,rr,section);if(!seat)continue;
      if(out.dot(seat.out)<.5)continue;
      const t=clamp(((seat.point.x-run.a.x)*tangent.x+(seat.point.z-run.a.z)*tangent.z)/span,.055,.945);
      seat=wallSeat(p,station(t),side,rr,section);
      if(seat)candidates.push({...seat,t});
    }
    for(const col of systems.columns.filter(c=>c.sectionId===section.id)){
      const pos=V(col.x,0,col.z).addScaledVector(out,col.size/2+.033+rr);
      const t=clamp(((pos.x-run.a.x)*tangent.x+(pos.z-run.a.z)*tangent.z)/span,.045,.955);
      candidates.push({t,point:pos,out,anchor:pos.clone().addScaledVector(out,-rr-.033),side:-1});
    }
    function lowerAt(pt,ceiling){
      let level=-Infinity;
      for(const surf of systems.surfaces){
        if(surf.sectionId===section.id&&surf.element===run.element)continue;
        if(!contains(surf,pt))continue;
        const h=height(surf,pt);if(h<ceiling-.065)level=Math.max(level,h);
      }
      return level;
    }
    let best;
    for(const seat of candidates){
      const head=station(seat.t),gap=projectedDistance(head,seat.point);
      if(gap>Math.max(.9,Math.min(2,p.e+.8)))continue;
      if(used.some(v=>projectedDistance(seat.point,v)<.57))continue;
      const score=Math.abs(seat.t-target)*span+gap*1.5+(seat.side>=0&&section.canopy?1.3:0);
      if(!best||score<best.score)best={seat,head,score};
    }
    function roofShoe(head,receiver){
      if(!Number.isFinite(receiver))return null;
      const neck=head.clone().addScaledVector(up,-.115),foot=neck.clone();
      foot.y=Math.max(receiver+.16,Math.min(neck.y-.075,receiver+.34));
      if(foot.y>neck.y-.025)return null;
      const toe=foot.clone().addScaledVector(out,.165).addScaledVector(up,-.06);
      const seat={point:foot.clone(),out,side:-2};
      return {head,path:[neck,foot,toe],bands:[],seat,run,radius:rr,ground:systems.ground,stopsOnRoof:true};
    }
    if(!best||run.element){
      // A dormer/secondary eave over another slope spills onto that slope.
      // Without an underlying roof or an attachment, do not invent a free pipe.
      const head=station(target);head.y-=.067+channel;
      const shelf=lowerAt(head,head.y);
      return Number.isFinite(shelf)?roofShoe(head,shelf):null;
    }
    const {seat,head}=best;head.y-=.067+channel-.008;
    const neck=head.clone().addScaledVector(up,-.145),gap=projectedDistance(head,seat.point);
    const landing=seat.point.clone();landing.y=neck.y-Math.max(.14,gap*.67);
    const ground=systems.ground,shelf=lowerAt(landing,head.y),stopsOnRoof=shelf>ground+.08;
    const bottom=Math.max(ground+.22,Number.isFinite(shelf)?shelf+.20:ground);
    if(landing.y<bottom+.12)return roofShoe(head,lowerAt(head,head.y));
    const foot=landing.clone();foot.y=bottom;
    const toe=foot.clone().addScaledVector(seat.out,.225).addScaledVector(up,-.11);
    let path=[neck,landing,foot,toe],sleeve=null;
    if(!stopsOnRoof&&window.PentiiTerraces&&bottom<0){
      // Clear the deck edge when the drop is on an exterior post. A long
      // wall-side downpipe passes through a flashed penetration at floor level.
      const r=PentiiTerraces.sections(p).map(s=>PentiiTerraces.rect(p,s)).find(r=>
        foot.x>=r.x-rr&&foot.x<=r.x+r.w+rr&&foot.z>=r.z-rr&&foot.z<=r.z+r.d+rr);
      if(r){
        const shift=seat.out.x>.5?r.x+r.w-foot.x:seat.out.x<-.5?foot.x-r.x:seat.out.z>.5?r.z+r.d-foot.z:foot.z-r.z;
        if(shift<.34&&landing.y>.45){
          const step=Math.max(.045,shift+rr+.055);
          const bend=landing.clone();bend.y=.21+step*.56;
          const outer=bend.clone().addScaledVector(seat.out,step);outer.y=.21;
          foot.addScaledVector(seat.out,step);toe.addScaledVector(seat.out,step);
          path=[neck,landing,bend,outer,foot,toe];
        }else{sleeve=landing.clone();sleeve.y=.012;}
      }
    }
    const bands=[];
    const bandEnd=path.length>4?path[2]:foot;
    const count=Math.max(1,Math.ceil((landing.y-bandEnd.y)/1.45));
    for(let i=0;i<count;i++){
      const c=landing.clone().lerp(bandEnd,(i+.40)/count);
      const mount=seat.anchor.clone();mount.y=c.y;
      bands.push({c,mount});
    }
    used.push(seat.point);
    return {head,path,bands,seat,run,radius:rr,ground,stopsOnRoof,sleeve};
  }
  function layout(p,provided={}){
    const sections=RoofStudio.sections(p);
    const layered=new Set(sections.filter(s=>s.canopy).map(s=>s.id));
    const sig=JSON.stringify([p.w,p.d,p.h,p.n,p.e,p.ops,p.extensions,p.structure?.foundation,p.structure?.floorSkin,sections,p.gutterSystem,p.outletSide,p.gutters]);
    const saved=memo.get(p);if(saved?.sig===sig)return saved.value;
    const surfaces=(provided.visible||RoofStudio.faces(p)).filter(f=>f.roof).map(planeInfo).filter(Boolean);
    const raw=provided.raw||(!RoofStudio.trimFaces?RoofStudio.rawFaces(p):[]);
    const wide=p.gutterSystem==='125/90'?false:true;
    const systems={surfaces,width:wide?.150:.125,pipeRadius:wide?.050:.045,columns:RoofStudio.columns(p),ground:window.PentiiStructure?.get(p).groundY??-.24};
    const parts=[],pipes=[],runnels=[],used=[];
    for(const section of sections){
      const input=RoofStudio.trimFaces?RoofStudio.trimFaces(section):raw.filter(r=>r.sectionId===section.id);
      for(const edge of roofEdges(section,input)){
        const desc=describe(edge,section);if(!desc)continue;
        for(const [t,u] of exposed(edge,surfaces,layered)){
          const a=edge.a.clone().lerp(edge.b,t),b=edge.a.clone().lerp(edge.b,u);
          if(a.distanceTo(b)<.045)continue;
          const part={a,b,...desc,sectionId:section.id,element:edge.element};parts.push(part);
          if(!desc.drains||p.gutters===false||(section.parapet&&!edge.element))continue;
          // Canonical ordering keeps left/right choices stable on all four faces.
          const alongX=Math.abs(b.x-a.x)>Math.abs(b.z-a.z);
          if(alongX?a.x>b.x:a.z>b.z){part.a=b;part.b=a}
          runnels.push(part);
        }
      }
    }
    // Long real eaves may be split along one roof edge by the triangular mesh
    // or other roofs. Only genuine continuous segments can share an outlet.
    const grouped=[];
    for(const run of runnels){
      const direction=run.b.clone().sub(run.a).normalize();
      const group=grouped.find(list=>{
        const first=list[0],dir=first.b.clone().sub(first.a).normalize();
        return first.sectionId===run.sectionId&&first.out.dot(run.out)>.9999&&Math.abs(dir.dot(direction)-1)<.00001
          &&first.a.clone().sub(run.a).cross(direction).length()<.002;
      });
      if(group)group.push(run);else grouped.push([run]);
    }
    const gutters=[];
    for(const list of grouped){
      const dir=list[0].b.clone().sub(list[0].a).normalize();
      list.sort((r,s)=>r.a.dot(dir)-s.a.dot(dir));let last=null;
      for(const r of list){
        if(last&&last.b.distanceTo(r.a)<.003)last.b=r.b;
        else{last={...r};gutters.push(last)}
      }
    }
    for(const run of gutters){
      const length=projectedDistance(run.a,run.b);if(length<1.05)continue;
      const section=sections.find(s=>s.id===run.sectionId);
      const drop=run.b.y-run.a.y,auto=p.outletSide||'auto';
      const target=auto==='start'?[.05]:auto==='end'?[.95]:Math.abs(drop)>.075?[drop>0?.05:.95]:length>6?[.05,.95]:[.95];
      for(const t of target){const pipe=pipeOn(run,t,p,section,systems,used);if(pipe)pipes.push(pipe);}
    }
    // A parapet retains the roof edge. Drain through a low-side scupper and
    // collector instead of drawing an eaves gutter through the solid wall.
    if(p.gutters!==false)for(const section of sections.filter(s=>s.parapet&&[2,3].includes(s.roof))){
      const low=parts.filter(e=>e.sectionId===section.id&&!e.element&&e.type==='outer'&&e.drains)
        .sort((a,b)=>(a.a.y+a.b.y)-(b.a.y+b.b.y)||b.out.z-a.out.z)[0];
      if(!low)continue;
      const center=low.a.clone().lerp(low.b,.78),along=low.b.clone().sub(low.a).normalize();
      const run={a:center.clone().addScaledVector(along,-.17),b:center.clone().addScaledVector(along,.17),
        out:low.out.clone(),sectionId:section.id,element:'',collector:true,scupper:true};
      const pipe=pipeOn(run,.5,p,section,systems,used);if(pipe)pipes.push(pipe);
    }
    // An inverted roof drains down its valley, past the end fascia into a
    // collector box. Its two high eaves never acquire a fictitious gutter.
    if(p.gutters!==false)for(const section of sections.filter(s=>s.roof===6)){
      const valleys=parts.filter(e=>e.sectionId===section.id&&e.type==='valley');
      for(const valley of valleys){
        const axis=valley.b.clone().sub(valley.a);axis.y=0;axis.normalize();
        for(const [pt,direction] of [[valley.a,-1],[valley.b,1]]){
          const tol=.008,terminal=Math.min(Math.abs(pt.x-section.x),Math.abs(pt.x-section.x-section.w),
            Math.abs(pt.z-section.z),Math.abs(pt.z-section.z-section.d))<tol;
          if(!terminal)continue;
          const out=axis.clone().multiplyScalar(direction),across=V(-out.z,0,out.x);
          const run={a:pt.clone().addScaledVector(across,-.17),b:pt.clone().addScaledVector(across,.17),
            out,sectionId:section.id,element:valley.element,collector:true};
          const pipe=pipeOn(run,.5,p,section,systems,used);if(pipe)pipes.push(pipe);
        }
      }
    }
    const value={parts,gutters,pipes,width:systems.width,radius:systems.pipeRadius};
    memo.set(p,{sig,value});return value;
  }
  function controls(host,p,commit){
    function picker(label,items,key,current){
      const wrap=document.createElement('label');wrap.textContent=label;
      const input=document.createElement('select');input.setAttribute('aria-label',label);
      for(const [value,text] of items)input.add(new Option(text,value,false,value===current));
      input.onchange=()=>commit({...p,[key]:input.value});
      wrap.append(input);host.append(wrap);
    }
    picker('Желоб и труба',[['150/100','150 / 100 мм'],['125/90','125 / 90 мм']],'gutterSystem',p.gutterSystem||'150/100');
    picker('Расположение выпусков',[['auto','По уклону и длине желоба'],['start','У начала желоба'],['end','У конца желоба']],'outletSide',p.outletSide||'auto');
  }
  function elevationLayers(p,face,g){
    if(p.gutters===false)return [];
    const {gutters,pipes,width,radius}=layout(p),scale=g.scale;
    const along=pt=>[pt.x,p.d-pt.z,p.w-pt.x,pt.z][face];
    const depth=pt=>[pt.z,pt.x,-pt.z,-pt.x][face];
    const coord=pt=>(g.x0+along(pt)*scale).toFixed(2)+','+(g.base-pt.y*scale).toFixed(2);
    const paint=/^#[a-f0-9]{6}$/i.test(p.gutterColor||'')?p.gutterColor:'#454e55';
    const layers=[];
    const stroke=(pts,color,w)=>'<path d="M'+pts.map(coord).join(' L')+'" fill="none" stroke="'+color+'" stroke-width="'+w.toFixed(2)+'" stroke-linejoin="round" stroke-linecap="round"/>';
    for(const run of gutters){
      const pts=[run.a,run.b].map(v=>v.clone().addScaledVector(run.out,width*.56).addScaledVector(up,-.08));
      const markup=stroke(pts,paint,Math.max(1.15,width*.67*scale))+stroke(pts.map(v=>v.clone().addScaledVector(up,.027)),'#b0b7b8',Math.max(.4,scale*.009));
      layers.push({depth:Math.min(...pts.map(depth))+.004,markup});
    }
    for(const pipe of pipes){
      const route=[pipe.head,...pipe.path];
      for(let i=1;i<route.length;i++){
        const pts=[route[i-1],route[i]];
        const markup=stroke(pts,paint,Math.max(1.05,radius*2*scale));
        layers.push({depth:(depth(pts[0])+depth(pts[1]))/2+.002,markup});
      }
      for(const {c} of pipe.bands){
        const x=g.x0+along(c)*scale,y=g.base-c.y*scale,w=2.22*radius*scale;
        layers.push({depth:depth(c)+.014,markup:'<rect x="'+(x-w/2).toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+w.toFixed(2)+'" height="'+Math.max(.7,.031*scale).toFixed(2)+'" fill="#9faaaa"/>'});
      }
    }
    return layers;
  }
  return {layout,controls,elevationLayers};
})();

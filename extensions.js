/* Independent building parts. Geometry is stored in global X/Z metres; each
   part has its own local openings and partitions. Floors stay at level 0.000. */
window.PentiiExtensions=(()=>{
  'use strict';
  const eps=1e-7;
  const uid=()=>globalThis.crypto?.randomUUID?.()||'e'+Math.random().toString(36).slice(2);
  const copy=o=>JSON.parse(JSON.stringify(o));
  const round=v=>Math.round(v*1000)/1000;
  const list=p=>Array.isArray(p.extensions)?p.extensions:[];
  const get=(p,id)=>list(p).find(e=>e.id===id);
  function uniqueName(p,base='Пристройка',numbered=true){
    const used=new Set(list(p).map(e=>e.name));
    if(!numbered&&!used.has(base))return base;
    let i=numbered?1:2;while(used.has(base+' '+i))i++;
    return base+' '+i;
  }
  const roofSections=p=>window.RoofStudio?.sections(p)||(p.roofSections||[]);
  const roofs=(p,e)=>roofSections(p).filter(s=>s.extensionId===(typeof e==='string'?e:e.id));
  const rectangle=(p,e)=>e?{id:e.id,x:e.x,z:e.z,w:e.w,d:e.d,height:e.h*(e.n||1),walls:e.walls!==false}:
    {id:'main',x:0,z:0,w:p.w,d:p.d,height:p.h*p.n,walls:true};
  function initialize(p){
    if(!Array.isArray(p.extensions))return p;
    for(const e of p.extensions){
      e.name ||= 'Пристройка';e.n ??=1;e.walls=e.walls===true;
      if(!Array.isArray(e.ops))e.ops=[];if(!Array.isArray(e.partitions))e.partitions=[];if(!Array.isArray(e.interior))e.interior=[];
    }
    return p;
  }
  function overlaps(a,b){return Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>eps&&Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)>eps;}
  function placement(p,w,d,side=1,skipId){
    const blocks=[rectangle(p),...list(p).filter(e=>e.id!==skipId).map(e=>rectangle(p,e))];
    const order=[side,...[0,1,2,3].filter(value=>value!==side)];
    for(const edge of order)for(const b of blocks){
      const candidates=edge%2?[b.z+(b.d-d)/2,b.z,b.z+b.d-d]:[b.x+(b.w-w)/2,b.x,b.x+b.w-w];
      for(const along of candidates){
        const at={x:edge===1?b.x+b.w:edge===3?b.x-w:along,z:edge===0?b.z+b.d:edge===2?b.z-d:along,w,d};
        if(Math.abs(at.x)>60||Math.abs(at.z)>60||blocks.some(other=>overlaps(at,other)))continue;
        return {x:round(at.x),z:round(at.z)};
      }
    }
    return {x:round(p.w+.5),z:round(p.d+.5)};
  }
  function add(p,options={}){
    p.extensions ||= [];
    const w=options.w??4,d=options.d??3;
    const position=Number.isFinite(options.x)&&Number.isFinite(options.z)?{x:options.x,z:options.z}:placement(p,w,d,options.side??1);
    const e={id:uid(),name:options.name||uniqueName(p),...position,w,d,h:options.h??p.h,n:options.n??1,
      walls:options.walls===true,ops:copy(options.ops||[]),partitions:copy(options.partitions||[]),interior:copy(options.interior||[])};
    if(options.structure)e.structure=copy(options.structure);
    p.extensions.push(e);return e;
  }
  function followRoof(before,after,s){
    const map=(v,start,oldSize,nextStart,newSize)=>v<start?nextStart+v-start:v>start+oldSize?nextStart+newSize+v-start-oldSize:nextStart+(v-start)*newSize/oldSize;
    const x=map(s.x,before.x,before.w,after.x,after.w),right=map(s.x+s.w,before.x,before.w,after.x,after.w);
    const z=map(s.z,before.z,before.d,after.z,after.d),front=map(s.z+s.d,before.z,before.d,after.z,after.d);
    return {x:round(x),z:round(z),w:round(right-x),d:round(front-z),base:round(s.base+after.h*(after.n||1)-before.h*(before.n||1))};
  }
  function update(p,id,patch){
    const e=get(p,id);if(!e)return null;
    const before=copy(e);Object.assign(e,copy(patch));
    if(e.walls===false&&before.walls!==false)p.roofSections=roofSections(p).filter(s=>s.extensionId!==id);
    else if(['x','z','w','d','h','n'].some(key=>before[key]!==e[key])){
      for(const s of roofs(p,e))if(s.followExtension!==false)Object.assign(s,followRoof(before,e,s));
    }
    return e;
  }
  function followEdits(before,after){
    for(const old of list(before)){
      const next=get(after,old.id);if(!next)continue;
      if(!['x','z','w','d','h','n'].some(key=>old[key]!==next[key]))continue;
      for(const previous of roofs(before,old)){
        const current=roofs(after,next).find(s=>s.id===previous.id);
        if(current&&current.followExtension!==false)Object.assign(current,followRoof(old,next,previous));
      }
    }
    return after;
  }
  function shapePatch(type){
    if(type==='parapet')return {roof:3,pitch:3,parapet:{height:.45,thickness:.18}};
    const roof=Number(type);
    return {roof,pitch:[2,3].includes(roof)?3:30,parapet:undefined};
  }
  function addRoof(p,id,type=0){
    const e=get(p,id);if(!e||!e.walls)return null;
    window.RoofStudio?.initialize(p);p.roofSections ||= [];
    const existing=roofs(p,e)[0];
    if(existing){Object.assign(existing,shapePatch(type));return existing;}
    const roof={id:uid(),extensionId:e.id,followExtension:true,name:'Крыша · '+e.name,x:round(e.x-.3),z:round(e.z-.3),
      w:round(e.w+.6),d:round(e.d+.6),base:round(e.h*e.n),...shapePatch(type),ridge:0,canopy:false,posts:[]};
    p.roofSections.push(roof);return roof;
  }
  function removeRoof(p,id){p.roofSections=roofSections(p).filter(s=>s.extensionId!==id);return p;}
  function remove(p,id){p.extensions=list(p).filter(e=>e.id!==id);removeRoof(p,id);return p;}
  function duplicate(p,id){
    const old=get(p,id);if(!old)return null;
    const originals=copy(roofs(p,old)),position=placement(p,old.w,old.d,1);
    const e=add(p,{...copy(old),...position,name:uniqueName(p,old.name+' · копия',false)});
    for(const o of e.ops)o.id=uid();for(const w of e.partitions)w.id=uid();for(const item of e.interior)item.id=uid();
    for(const s of originals){
      s.id=uid();s.extensionId=e.id;s.name='Крыша · '+e.name;s.x=round(s.x+e.x-old.x);s.z=round(s.z+e.z-old.z);
      for(const array of ['posts','dormers','liftPoints'])for(const item of s[array]||[])item.id=uid();
      p.roofSections.push(s);
    }
    return e;
  }
  function contacts(p,e){
    if(!e.walls)return [];
    // The main house (then earlier parts) retains the common wall. The new
    // part omits only the coincident interval, not its whole facade.
    const index=list(p).findIndex(item=>item.id===e.id),blocks=[rectangle(p),...list(p).slice(0,Math.max(0,index)).filter(item=>item.walls).map(item=>rectangle(p,item))];
    const cuts=[];
    for(const b of blocks){
      const x0=Math.max(e.x,b.x),x1=Math.min(e.x+e.w,b.x+b.w),z0=Math.max(e.z,b.z),z1=Math.min(e.z+e.d,b.z+b.d);
      const top=Math.min(e.h*e.n,b.height);if(top<=0)continue;
      const add=(face,from,to)=>{if(to-from>eps)cuts.push({face,from:round(from),to:round(to),bottom:0,top,neighborId:b.id})};
      if(Math.abs(e.z+e.d-b.z)<eps&&x1-x0>eps)add(0,x0-e.x,x1-e.x);
      if(Math.abs(e.x+e.w-b.x)<eps&&z1-z0>eps)add(1,e.z+e.d-z1,e.z+e.d-z0);
      if(Math.abs(e.z-b.z-b.d)<eps&&x1-x0>eps)add(2,e.x+e.w-x1,e.x+e.w-x0);
      if(Math.abs(e.x-b.x-b.w)<eps&&z1-z0>eps)add(3,z0-e.z,z1-e.z);
    }
    return cuts;
  }
  function model(p,e){
    if(typeof e==='string')e=get(p,e);if(!e)return null;
    return {...p,id:e.id,name:e.name,w:e.w,d:e.d,h:e.h,n:e.n||1,ops:copy(e.ops||[]),walls:copy(e.partitions||[]),interior:copy(e.interior||[]),yard:[],extensions:[],
      roofSections:[],structure:{...p.structure,...e.structure,foundation:'piles',pileType:'bored'},
      _extensionId:e.id,_extensionHasWalls:e.walls===true,_wallCuts:contacts(p,e)};
  }
  function bounds(p){
    const blocks=[rectangle(p),...list(p).map(e=>rectangle(p,e))],minX=Math.min(...blocks.map(r=>r.x)),maxX=Math.max(...blocks.map(r=>r.x+r.w)),minZ=Math.min(...blocks.map(r=>r.z)),maxZ=Math.max(...blocks.map(r=>r.z+r.d));
    return {minX,maxX,minZ,maxZ,x:minX,z:minZ,w:maxX-minX,d:maxZ-minZ,centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,height:Math.max(...blocks.map(r=>r.walls?r.height:0))};
  }
  function snap(p,e,patch,key='move',tolerance=.1){
    if(typeof e==='string')e=get(p,e);if(!e)return {...patch};
    const result={...patch},blocks=[rectangle(p),...list(p).filter(item=>item.id!==e.id).map(item=>rectangle(p,item))];
    const xs=blocks.flatMap(b=>[b.x,b.x+b.w]),zs=blocks.flatMap(b=>[b.z,b.z+b.d]);
    const near=(v,candidates,valid=()=>true)=>{const found=candidates.filter(valid).sort((a,b)=>Math.abs(a-v)-Math.abs(b-v))[0];return Number.isFinite(found)&&Math.abs(found-v)<=tolerance?round(found):v};
    if(key==='move'){
      result.x=near(result.x??e.x,xs.flatMap(x=>[x,x-e.w]));result.z=near(result.z??e.z,zs.flatMap(z=>[z,z-e.d]));
    }else if(key==='left'){
      result.x=near(result.x??e.x,xs,x=>e.x+e.w-x>=.6);result.w=round(e.x+e.w-result.x);
    }else if(key==='right')result.w=round(near(e.x+(result.w??e.w),xs,x=>x-e.x>=.6)-e.x);
    else if(key==='back'){
      result.z=near(result.z??e.z,zs,z=>e.z+e.d-z>=.6);result.d=round(e.z+e.d-result.z);
    }else if(key==='front')result.d=round(near(e.z+(result.d??e.d),zs,z=>z-e.z>=.6)-e.z);
    return result;
  }
  function validate(p){
    if(p.extensions!==undefined&&!Array.isArray(p.extensions))return 'Проверьте список пристроек.';
    if(list(p).length>12)return 'В одном эскизе может быть до 12 пристроек.';
    const ids=new Set();
    for(const e of list(p)){
      if(!e?.id||ids.has(e.id))return 'У пристроек должны быть разные идентификаторы.';ids.add(e.id);
      if(![e.x,e.z,e.w,e.d,e.h].every(Number.isFinite)||Math.abs(e.x)>60||Math.abs(e.z)>60||e.w<.6||e.w>35||e.d<.6||e.d>35||e.h<2.2||e.h>6||!Number.isInteger(e.n)||e.n<1||e.n>3)return 'Проверьте размеры пристройки: стороны 0,6–35 м, этаж 2,2–6 м, до трёх этажей.';
      if(typeof e.walls!=='boolean'||!Array.isArray(e.ops)||!Array.isArray(e.partitions)||(e.interior!==undefined&&!Array.isArray(e.interior)))return 'Проверьте состав пристройки.';
      if(overlaps(e,rectangle(p))||list(p).some(other=>other.id!==e.id&&overlaps(e,other)))return 'Пристройки могут примыкать к дому и друг к другу, но не должны перекрывать пол другой части.';
      const openingIds=new Set();
      for(const o of e.ops){
        if(!o)return 'Проверьте проёмы пристройки.';
        const L=o.f%2?e.d:e.w;
        if(!o?.id||openingIds.has(o.id)||![0,1,2,3].includes(o.f)||![0,1,2,3].includes(o.k)||!Number.isInteger(o.floor)||o.floor<0||o.floor>=e.n||![o.x,o.sill,o.w,o.h].every(Number.isFinite)||o.w<.2||o.h<.2||o.x<0||o.sill<0||o.x+o.w>L+eps||o.sill+o.h>e.h+eps)return 'Проём выходит за стену пристройки.';
        openingIds.add(o.id);
        for(const other of e.ops)if(other.id!==o.id&&other.f===o.f&&other.floor===o.floor&&Math.min(o.x+o.w,other.x+other.w)-Math.max(o.x,other.x)>eps&&Math.min(o.sill+o.h,other.sill+other.h)-Math.max(o.sill,other.sill)>eps)return 'Проёмы пристройки пересекаются.';
        if(contacts(p,e).some(c=>c.face===o.f&&Math.min(c.to,o.x+o.w)-Math.max(c.from,o.x)>eps&&o.floor*e.h+o.sill<c.top-eps))return 'На примыкании используется стена соседней части. Добавьте проём в ней.';
      }
      for(const wall of e.partitions){
        if(!wall||![wall.a,wall.b,wall.c,wall.d].every(Number.isFinite)||Math.min(wall.a,wall.c)<0||Math.min(wall.b,wall.d)<0||Math.max(wall.a,wall.c)>e.w+eps||Math.max(wall.b,wall.d)>e.d+eps||!Number.isInteger(wall.floor)||wall.floor<0||wall.floor>=e.n)return 'Перегородка выходит за границы пристройки.';
      }
      for(const item of e.interior||[])if(!item||![item.x,item.y,item.r].every(Number.isFinite)||!Number.isInteger(item.floor)||item.floor<0||item.floor>=e.n)return 'Проверьте положение предметов в пристройке.';
      const interiorError=window.Interior?.validate?.(model(p,e));if(interiorError)return interiorError;
      if(!e.walls&&roofs(p,e).length)return 'Сначала добавьте стены пристройки, затем её крышу.';
    }
    for(const s of roofSections(p))if(s.extensionId&&!ids.has(s.extensionId))return 'Крыша ссылается на удалённую пристройку.';
    return '';
  }
  return {list,get,initialize,add,update,followEdits,remove,duplicate,addRoof,removeRoof,roofs,model,contacts,bounds,snap,validate,overlaps};
})();

/* Alignment is scoped to one facade and storey. This module changes only a
   drag draft; validation and the single undoable commit remain with the editor. */
window.PentiiAlign=(()=>{
  'use strict';
  const near=(a,b)=>Math.abs(a-b)<1e-7;
  const rounded=n=>Math.round(n*1000)/1000;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const refs=(p,o)=>(p.ops||[]).filter(other=>other.id!==o.id&&other.f===o.f&&other.floor===o.floor);
  function snapOpening(p,input,key,tolerance=.08){
    const o={...input},hits=[],neighbors=refs(p,o),length=o.f%2?p.d:p.w;
    const candidates=(axis)=>{
      const v=axis==='v',out=[{value:0,label:v?'Уровень пола':'Край стены',kind:'boundary'},
        {value:v?p.h:length,label:v?'Верх этажа':'Край стены',kind:'boundary'}];
      for(const other of neighbors){
        out.push({value:v?other.sill:other.x,source:other.id,label:v?'Низ по соседнему проёму':'Край по соседнему проёму',kind:'edge'},
          {value:v?other.sill+other.h:other.x+other.w,source:other.id,label:v?'Верх по соседнему проёму':'Край по соседнему проёму',kind:'edge'});
      }
      return out;
    };
    function nearest(choices,current,allowed){
      return choices.map(c=>({...c,distance:Math.abs(c.value-current)})).filter(c=>c.distance<=tolerance&&allowed(c.value))
        .sort((a,b)=>a.distance-b.distance||(a.kind==='size'?1:0)-(b.kind==='size'?1:0))[0];
    }
    function resize(axis,low){
      const coord=axis==='v'?'sill':'x',size=axis==='v'?'h':'w',limit=axis==='v'?p.h:length;
      const anchored=low?o[coord]+o[size]:o[coord],current=low?o[coord]:o[coord]+o[size];
      const choices=candidates(axis);
      for(const other of neighbors)choices.push({value:anchored+(low?-1:1)*other[size],source:other.id,kind:'size',
        label:(axis==='v'?'Высота':'Ширина')+' как у соседнего проёма'});
      const found=nearest(choices,current,value=>value>=0&&value<=limit&&(low?anchored-value:value-anchored)>=.2);
      if(!found)return;
      if(low)o[coord]=rounded(found.value);
      o[size]=rounded(low?anchored-found.value:found.value-anchored);
      hits.push({...found,axis,value:rounded(found.value)});
    }
    function move(axis){
      const coord=axis==='v'?'sill':'x',size=axis==='v'?'h':'w',limit=axis==='v'?p.h:length;
      const choices=candidates(axis).flatMap(c=>[{...c,edge:c.value,value:c.value},{...c,edge:c.value,value:c.value-o[size]}]);
      const found=nearest(choices,o[coord],value=>value>=0&&value+o[size]<=limit+1e-7);
      if(!found)return;o[coord]=rounded(found.value);
      hits.push({...found,axis,value:rounded(found.edge)});
    }
    if(key==='move'){move('u');move('v')}
    if(key==='left')resize('u',true);
    if(key==='right'||key==='corner')resize('u',false);
    if(key==='bottom')resize('v',true);
    if(key==='top'||key==='corner')resize('v',false);
    // Numerical round-off cannot push a valid edge outside its wall.
    o.x=clamp(o.x,0,Math.max(0,length-o.w));o.sill=clamp(o.sill,0,Math.max(0,p.h-o.h));
    return {opening:o,hits};
  }
  function snapRoof(p,s,input,key,tolerance=.08){
    const patch={...input},hits=[],all=window.RoofStudio?.sections(p)||[];
    const bodies=[{id:'main',x:0,z:0,w:p.w,d:p.d,h:p.h,n:p.n},...(p.extensions||[]).filter(e=>e.walls)];
    bodies.sort((a,b)=>Number(b.id===s.extensionId)-Number(a.id===s.extensionId));
    const xs=bodies.flatMap(b=>[b.x-.3,b.x,b.x+b.w,b.x+b.w+.3]),zs=bodies.flatMap(b=>[b.z-.3,b.z,b.z+b.d,b.z+b.d+.3]);
    const ys=bodies.flatMap(b=>Array.from({length:b.n||1},(_,i)=>(i+1)*b.h));
    for(const other of all.filter(item=>item.id!==s.id)){xs.push(other.x,other.x+other.w);zs.push(other.z,other.z+other.d);ys.push(other.base);}
    function closest(v,values,axis,valid=()=>true){
      const candidates=values.filter(valid).sort((a,b)=>Math.abs(a-v)-Math.abs(b-v));
      if(candidates.length&&Math.abs(candidates[0]-v)<=tolerance){hits.push({axis,value:candidates[0],kind:'edge',label:'Совпадение с опорной линией'});return candidates[0]}
      return v;
    }
    if(key==='move'){
      for(const [axis,values,size] of [['x',xs,s.w],['z',zs,s.d]]){
        const current=patch[axis]??s[axis];
        const choices=values.flatMap(edge=>[{edge,value:edge},{edge,value:edge-size}]).sort((a,b)=>Math.abs(a.value-current)-Math.abs(b.value-current));
        const match=choices[0];
        if(match&&Math.abs(match.value-current)<=tolerance){patch[axis]=rounded(match.value);hits.push({axis,value:match.edge,kind:'edge',label:'Совпадение с опорной линией'})}
      }
    }else if(key==='base')patch.base=rounded(closest(patch.base??s.base,ys,'y',v=>v>=.45&&v<=20));
    else if(key==='left'){
      patch.x=closest(patch.x??s.x,xs,'x',v=>s.x+s.w-v>=.6&&s.x+s.w-v<=65);patch.w=s.x+s.w-patch.x;
    }else if(key==='right')patch.w=closest(s.x+(patch.w??s.w),xs,'x',v=>v-s.x>=.6&&v-s.x<=65)-s.x;
    else if(key==='back'){
      patch.z=closest(patch.z??s.z,zs,'z',v=>s.z+s.d-v>=.6&&s.z+s.d-v<=65);patch.d=s.z+s.d-patch.z;
    }else if(key==='front')patch.d=closest(s.z+(patch.d??s.d),zs,'z',v=>v-s.z>=.6&&v-s.z<=65)-s.z;
    for(const key of ['x','z','w','d','base'])if(typeof patch[key]==='number')patch[key]=rounded(patch[key]);
    return {patch,hits};
  }
  return {snapOpening,snapRoof,references:refs};
})();

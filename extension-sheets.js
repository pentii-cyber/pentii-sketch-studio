/* Independent parts remain independent in drawings: the overall plan locates
   them, and each part has its own dimensions, construction and opening marks. */
window.ExtensionSheets=(()=>{
  'use strict';
  const ink='#193c56',blue='#1374a3',muted='#547084',rule='#bfd0db';
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const mm=v=>String(Math.round(v*1000)),r=v=>Math.round(v*100)/100;
  const text=(x,y,t,size=18,color=ink,anchor='start',extra='')=>`<text x="${r(x)}" y="${r(y)}" font-size="${size}" fill="${color}" text-anchor="${anchor}" ${extra}>${esc(t)}</text>`;
  const line=(x,y,a,b,color=rule,width=1,extra='')=>`<path d="M${r(x)} ${r(y)}L${r(a)} ${r(b)}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
  const rect=(x,y,w,h,fill='none',stroke=ink,width=1,extra='')=>`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
  const poly=(points,fill,stroke=ink,width=1)=>`<polygon points="${points.map(([x,y])=>r(x)+','+r(y)).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const paint='paint-order="stroke" stroke="white" stroke-width="5" stroke-linejoin="round"';
  function dim(a,b,ref,at,label,vertical=false){
    if(b-a<.5)return '';
    return vertical?line(ref,a,at-7,a)+line(ref,b,at-7,b)+line(at,a,at,b,blue)+line(at-4,a+5,at+4,a-5,blue)+line(at-4,b+5,at+4,b-5,blue)+text(at-10,(a+b)/2,label,18,blue,'middle',paint+` transform="rotate(-90 ${r(at-10)} ${r((a+b)/2)})"`)
      :line(a,ref,a,at+7)+line(b,ref,b,at+7)+line(a,at,b,at,blue)+line(a-4,at+5,a+4,at-5,blue)+line(b-4,at+5,b+4,at-5,blue)+text((a+b)/2,at-10,label,18,blue,'middle',paint);
  }
  function sheet(title,body,sub='',note='Размеры — мм. Состав и положение частей соответствуют текущему эскизу.'){
    return {title,sub,section:'Дом и пристройки',art:`<svg xmlns="http://www.w3.org/2000/svg" width="1530" height="900" viewBox="0 0 1530 900" font-family="Arial,sans-serif">${rect(0,0,1530,900,'white','none')}${text(25,36,title.toUpperCase(),22,ink,'start','font-weight="bold"')}${body}${line(25,849,1505,849)}${text(25,880,note,16,muted)}</svg>`};
  }
  function localModel(p,e,index){
    const q=PentiiExtensions.model(p,e);q.markPrefix='ПР'+(index+1)+'-';
    q.roofSections=PentiiExtensions.roofs(p,e).map(s=>({...JSON.parse(JSON.stringify(s)),x:s.x-e.x,z:s.z-e.z}));
    return q;
  }
  function parts(p){
    const main={...p,extensions:[],roofSections:RoofStudio.sections(p).filter(s=>!s.extensionId),markPrefix:''};
    return [{id:'main',tag:'ДОМ',name:'Основной дом',x:0,z:0,w:p.w,d:p.d,h:p.h,n:p.n,walls:true,q:main},
      ...PentiiExtensions.list(p).map((e,i)=>({...e,tag:'ПР'+(i+1),q:localModel(p,e,i)}))];
  }
  function frame(bounds){
    const scale=Math.min(950/(bounds.maxX-bounds.minX),570/(bounds.maxZ-bounds.minZ));
    const x=570-(bounds.minX+bounds.maxX)*scale/2,z=430-(bounds.minZ+bounds.maxZ)*scale/2;
    return {scale,X:v=>x+v*scale,Z:v=>z+v*scale};
  }
  function boundsOf(p,site=false,roof=false){
    const b={...PentiiExtensions.bounds(p)};
    if(roof)for(const s of RoofStudio.sections(p)){
      b.minX=Math.min(b.minX,s.x);b.maxX=Math.max(b.maxX,s.x+s.w);b.minZ=Math.min(b.minZ,s.z);b.maxZ=Math.max(b.maxZ,s.z+s.d);
    }
    if(site){
      const measured=Number.isFinite(p.plotWidth)&&Number.isFinite(p.plotDepth),w=measured?p.plotWidth:p.w+16,d=measured?p.plotDepth:p.d+16;
      b.plot={x:(p.w-w)/2,z:(p.d-d)/2,w,d,measured};
      b.minX=Math.min(b.minX,b.plot.x);b.maxX=Math.max(b.maxX,b.plot.x+w);b.minZ=Math.min(b.minZ,b.plot.z);b.maxZ=Math.max(b.maxZ,b.plot.z+d);
      for(const o of p.yard||[]){const at=StudioYard.position(p,o),angle=o.angle*Math.PI/180,rx=Math.abs(Math.cos(angle))*o.w/2+Math.abs(Math.sin(angle))*o.d/2,rz=Math.abs(Math.sin(angle))*o.w/2+Math.abs(Math.cos(angle))*o.d/2;
        b.minX=Math.min(b.minX,at.x-rx);b.maxX=Math.max(b.maxX,at.x+rx);b.minZ=Math.min(b.minZ,at.z-rz);b.maxZ=Math.max(b.maxZ,at.z+rz);}
      for(const t of window.PentiiTerraces?.sections(p)||[]){const at=PentiiTerraces.rect(p,t);b.minX=Math.min(b.minX,at.x);b.maxX=Math.max(b.maxX,at.x+at.w);b.minZ=Math.min(b.minZ,at.z);b.maxZ=Math.max(b.maxZ,at.z+at.d);}
    }
    return b;
  }
  function planPart(part,f,openings=true){
    const {q}=part,{X,Z,scale}=f,thick=PentiiStructure.get(q).wallThickness;
    const point=(face,u,v=0)=>{const a=xyz(q,face,u,0,v);return [X(part.x+a[0]),Z(part.z+a[2])];};
    let out=`<g data-part-id="${esc(part.id)}" data-has-walls="${part.walls}">`+rect(X(part.x),Z(part.z),part.w*scale,part.d*scale,part.walls?'#f8fbfd':'#edf1e5',muted,1.5);
    if(part.walls){
      out+=rect(X(part.x),Z(part.z),part.w*scale,part.d*scale,'#dce6ed',ink,2)+rect(X(part.x+thick),Z(part.z+thick),(part.w-2*thick)*scale,(part.d-2*thick)*scale,'#f8fbfd',ink);
      for(const c of q._wallCuts||[]){out+=poly([point(c.face,c.from,.025),point(c.face,c.to,.025),point(c.face,c.to,-thick-.025),point(c.face,c.from,-thick-.025)],'#f8fbfd','none');}
      for(const w of q.walls||[])if(w.floor===0)out+=line(X(part.x+w.a),Z(part.z+w.b),X(part.x+w.c),Z(part.z+w.d),ink,Math.max(2,.10*scale));
      if(openings)for(const o of ArchitecturalSheets.facts(q).openings.filter(o=>o.floor===0)){
        const a=point(o.f,o.x),b=point(o.f,o.x+o.w);
        out+=`<g data-opening="${esc(o.tag)}">`+poly([point(o.f,o.x,.025),point(o.f,o.x+o.w,.025),point(o.f,o.x+o.w,-thick-.025),point(o.f,o.x,-thick-.025)],'white','none');
        out+=line(...a,...b,o.k<2?'#1888bb':'#996f46',o.k<2?3:2);
        if(o.k>=2){const end=point(o.f,o.x,-Math.min(o.w,1.2));out+=line(...a,...end,'#996f46',1.5);}
        const at=point(o.f,o.x+o.w/2,-thick-.18);out+=text(at[0],at[1]+5,o.tag,Math.max(11,Math.min(16,scale*.5)),blue,'middle',paint)+'</g>';
      }
    }else{
      const floor=PentiiStructure.panelLayout(q);for(const p of floor)out+=rect(X(part.x+p.x),Z(part.z+p.z),p.w*scale,p.d*scale,'none','#a4b49d',.6);
    }
    out+=text(X(part.x+part.w/2),Z(part.z+part.d/2)-8,part.tag,20,ink,'middle',paint)+text(X(part.x+part.w/2),Z(part.z+part.d/2)+17,mm(part.w)+' × '+mm(part.d),15,muted,'middle',paint);
    return out+'</g>';
  }
  function legend(list){
    let body=text(1125,106,'ЧАСТИ ПРОЕКТА',21,ink,'start','font-weight="bold"');
    list.forEach((part,i)=>{
      const y=146+i*49,name=String(part.name||part.tag),short=name.length>28?name.slice(0,27)+'…':name;
      body+=text(1125,y,part.tag+' · '+short,17,ink)+text(1125,y+22,part.walls?'Стены '+mm(part.h)+' мм × '+part.n+' эт. · '+(part.q.roofSections.length?'с крышей':'без крыши'):'Пол на сваях · без стен и крыши',15,muted);
    });
    return body;
  }
  function overallPlan(p,site=false){
    const list=parts(p),bounds=boundsOf(p,site),f=frame(bounds),{X,Z,scale}=f;let body='';
    if(site){const b=bounds.plot;body+=rect(X(b.x),Z(b.z),b.w*scale,b.d*scale,'#f0f5ec','#7e9b84',1.5,'stroke-dasharray="9 5"');
      body+=window.PentiiTerraces?.overlay(p,{x:X(0),y:Z(0),scale})||'';
      for(const o of p.yard||[]){if(!StudioYard.catalog[o.type])continue;const at=StudioYard.position(p,o);body+=`<g data-yard-id="${esc(o.id)}" transform="translate(${r(X(at.x))} ${r(Z(at.z))}) rotate(${o.angle}) scale(${scale})"><title>${esc(StudioYard.catalog[o.type].title)}</title>${StudioYard.symbol(o)}</g>`;}
      body+=text(25,818,b.measured?'Участок '+mm(b.w)+' × '+mm(b.d)+' мм · границы показаны по эскизу.':'Границы участка условные: размеры участка не заданы.',17,muted);
    }
    // Draw newer parts first so the retained wall and its openings remain visible at a shared edge.
    for(const part of list.slice().reverse())body+=planPart(part,f);
    const b=PentiiExtensions.bounds(p);body+=dim(X(b.minX),X(b.maxX),Z(b.minZ),Z(bounds.minZ)-45,mm(b.maxX-b.minX)+' · общий габарит')+dim(Z(b.minZ),Z(b.maxZ),X(b.minX),X(bounds.minX)-42,mm(b.maxZ-b.minZ),true);
    body+=legend(list)+text(1125,808,'X → · Z ↓ · пол ±0,000',17,muted);
    return sheet(site?'План участка · дом и пристройки':'Общий план · дом и пристройки',body,'Положение всех частей, проёмы первого этажа и общие габариты',site?'Объекты участка показаны в их текущих размерах и положении. Размеры — мм.':'О/Д — проёмы основного дома; ПР… — марки пристроек. Размеры каждой части — на её отдельных листах.');
  }
  function combinedRoof(p){
    const list=parts(p),sections=RoofStudio.sections(p);if(!sections.length)return null;
    const b=boundsOf(p,false,true),f=frame(b),{X,Z,scale}=f;let body='';
    for(const face of RoofStudio.faces(p).filter(face=>face.roof))body+=poly(face.q.map(v=>[X(v[0]),Z(v[2])]),'#e1ebf1',muted,1);
    for(const part of list)body+=rect(X(part.x),Z(part.z),part.w*scale,part.d*scale,'none',ink,1.8,'stroke-dasharray="9 5"');
    for(const part of list)for(const roof of ArchitecturalSheets.facts(part.q).roofs){
      const x=roof.x+part.x,z=roof.z+part.z;
      body+=`<g data-roof-id="${esc(roof.id)}">`+rect(X(x),Z(z),roof.w*scale,roof.d*scale,'none',blue,1.2)+text(X(x+roof.w/2),Z(z+roof.d/2)-7,roof.tag,18,blue,'middle',paint)+text(X(x+roof.w/2),Z(z+roof.d/2)+17,mm(roof.w)+' × '+mm(roof.d),15,muted,'middle',paint)+'</g>';
    }
    body+=dim(X(b.minX),X(b.maxX),Z(b.minZ),Z(b.minZ)-45,mm(b.maxX-b.minX))+dim(Z(b.minZ),Z(b.maxZ),X(b.minX),X(b.minX)-42,mm(b.maxZ-b.minZ),true)+legend(list);
    body+=text(25,808,'Пунктир — контуры пола и стен. К… — крыши дома; ПР…-К… — самостоятельные крыши пристроек.',17,muted);
    return sheet('Общий план кровли · все части',body,'Положение всех независимых секций · размерные планы и высоты — на листах соответствующей части');
  }
  function floorOnly(part){
    const q=part.q,b={minX:0,maxX:q.w,minZ:0,maxZ:q.d},f=frame(b),local={...part,x:0,z:0};
    let body=planPart(local,f)+dim(f.X(0),f.X(q.w),f.Z(0),f.Z(0)-45,mm(q.w))+dim(f.Z(0),f.Z(q.d),f.X(0),f.X(0)-42,mm(q.d),true);
    body+=text(1125,116,'ТЕКУЩИЙ СОСТАВ',20,ink,'start','font-weight="bold"')+text(1125,158,'Пол СИП · ±0,000',19)+text(1125,194,'Сваи ПЕНТИИ',19)+text(1125,228,'Ростверк',19)+text(1125,290,'Стены ещё не добавлены.',17,muted)+text(1125,324,'Крыша ещё не добавлена.',17,muted)+text(1125,382,'Положение относительно дома:',17)+text(1125,416,'X = '+mm(part.x)+' мм',18)+text(1125,448,'Z = '+mm(part.z)+' мм',18);
    return sheet('План пола · без стен',body,'Состав пристройки на текущем этапе · отметка пола совпадает с основным домом');
  }
  function pages(p){
    if(!PentiiExtensions.list(p).length)return [];
    const out=[overallPlan(p)],roof=combinedRoof(p);if(roof)out.push(roof);
    for(const part of parts(p).slice(1)){
      const q=part.q,own=part.walls?ArchitecturalSheets.pages(q):[floorOnly(part)];
      const hasRoof=q.roofSections.length>0;
      const structural=StructuralSheets.pages(q).filter(s=>s.title==='Схема фундамента'||s.title==='План наборного ростверка'||s.title==='Раскладка СИП · пол первого этажа'||s.title.startsWith('Ведомость деталей СИП · цоколь')||(hasRoof&&/чердачное|чердачного|Чердачное|чердак/.test(s.title)));
      for(const s of [...own,...structural])out.push({...s,title:part.tag+' · '+s.title,sub:part.name+' · '+s.sub,extensionId:part.id});
    }
    return out;
  }
  return {pages,sitePlan:p=>overallPlan(p,true),overallPlan,combinedRoof,localModel,parts};
})();

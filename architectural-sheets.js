/* Dimensioned concept drawings. All measures come from the editable model;
   foundation and structural calculations are deliberately not inferred. */
window.ArchitecturalSheets=(()=>{
  'use strict';
  const W=1530,H=900,ink='#193c56',blue='#1374a3',muted='#547084',rule='#bfd0db';
  const epsilon=1e-7;
  const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const round=n=>Math.round(n*1000)/1000;
  const mm=n=>String(Math.round(n*1000));
  const metres=n=>round(n).toLocaleString('ru-RU',{maximumFractionDigits:3});
  const level=n=>(Math.abs(n)<.0005?'±':n>0?'+':'−')+Math.abs(n).toFixed(3).replace('.',',');
  const fmtPoint=points=>points.map(([x,y])=>round(x)+','+round(y)).join(' ');
  const text=(x,y,t,size=20,anchor='start',color=ink,attrs='')=>'<text x="'+round(x)+'" y="'+round(y)+'" text-anchor="'+anchor+'" fill="'+color+'" font-size="'+size+'" '+attrs+'>'+xml(t)+'</text>';
  const line=(x,y,a,b,color=ink,width=1.5,attrs='')=>'<path d="M'+[x,y].map(round).join(' ')+'L'+[a,b].map(round).join(' ')+'" stroke="'+color+'" stroke-width="'+width+'" fill="none" '+attrs+'/>';
  const rect=(x,y,w,h,fill='none',stroke=ink,width=1.5)=>'<rect x="'+round(x)+'" y="'+round(y)+'" width="'+round(Math.max(0,w))+'" height="'+round(Math.max(0,h))+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'"/>';
  const poly=(pts,fill,stroke=ink,width=1.5)=>'<polygon points="'+fmtPoint(pts)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linejoin="round"/>';
  const dimText=(x,y,t,anchor='middle',extra='')=>text(x,y,t,18,anchor,blue,'paint-order="stroke" stroke="white" stroke-width="6" stroke-linejoin="round" '+extra);
  function tick(x,y){return line(x-4,y+6,x+4,y-6,blue,1.5)}
  function hDim(a,b,ref,y,value){
    if(b-a<epsilon)return '';
    return line(a,ref,a,y+(y>ref?7:-7),rule)+line(b,ref,b,y+(y>ref?7:-7),rule)+line(a,y,b,y,blue)+tick(a,y)+tick(b,y)+dimText((a+b)/2,y-9,value);
  }
  function vDim(a,b,ref,x,value){
    if(b-a<epsilon)return '';
    return line(ref,a,x+(x>ref?7:-7),a,rule)+line(ref,b,x+(x>ref?7:-7),b,rule)+line(x,a,x,b,blue)+tick(x,a)+tick(x,b)+dimText(x-9,(a+b)/2,value,'middle','transform="rotate(-90 '+round(x-9)+' '+round((a+b)/2)+')"');
  }
  function values(items){return [...new Set(items.map(round))].sort((a,b)=>a-b)}
  function chain(points,scale,origin,ref,at,vertical=false){
    const positions=values(points),result=[];
    for(let i=1;i<positions.length;i++){
      const a=origin+positions[i-1]*scale,b=origin+positions[i]*scale;
      if(b-a<.5)continue;
      const label=mm(positions[i]-positions[i-1]);
      if(vertical)result.push(vDim(a,b,ref,at,label));
      else if(b-a>=42)result.push(hDim(a,b,ref,at,label));
      else{
        // Short jamb returns keep their exact value, angled away from neighbours.
        result.push(line(a,ref,a,at+7,rule)+line(b,ref,b,at+7,rule)+line(a,at,b,at,blue)+tick(a,at)+tick(b,at)
          +dimText((a+b)/2,at-11,label,'start','transform="rotate(-58 '+round((a+b)/2)+' '+round(at-11)+')"'));
      }
    }
    return result.join('');
  }
  function svg(body,note='Размеры — мм. Высотные отметки — м. Размеры относятся к геометрии эскиза.'){
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1530" height="900" viewBox="0 0 1530 900" font-family="Arial,sans-serif">'
      +'<defs><pattern id="sectionHatch" patternUnits="userSpaceOnUse" width="9" height="9"><path d="M-2 2L2-2M0 9L9 0M7 11L11 7" stroke="#8ba2b1" stroke-width="1"/></pattern></defs>'
      +rect(0,0,W,H,'white','none')+body+line(25,849,1505,849,rule)+text(25,880,note,17,'start',muted)+'</svg>';
  }
  const faceNames=['Главный','Правый','Задний','Левый'];
  const openingKinds=['Окно','Витраж','Входная дверь','Балконная дверь'];
  function facts(q){
    const sections=RoofStudio.sections(q);
    const rendered=RoofStudio.faces(q);
    const topOf=s=>Math.max((RoofStudio.overallHeight||RoofStudio.ridgeHeight)(s),
      ...rendered.filter(face=>face.sectionId===s.id).flatMap(face=>face.q.map(v=>v[1])));
    let windows=0,doors=0;const prefix=q.markPrefix||'';
    return {
      width:q.w,depth:q.d,storeys:q.n,storeyHeight:q.h,
      top:Math.max(q.h*q.n,...sections.map(topOf)),
      openings:(q.ops||[]).map(o=>{const index=o.k<2?++windows:++doors,product=o.product||{};
        const dimension=value=>Number.isFinite(Number(value))&&Number(value)>0?Math.round(Number(value)):null;
        const unitWidthMm=dimension(product.widthMm),unitHeightMm=dimension(product.heightMm);
        return {...o,tag:prefix+(o.k<2?'О':'Д')+index,unitTag:prefix+(o.k<2?'ОК':'ДВ')+index,
        unitWidthMm,unitHeightMm,unitFits:unitWidthMm!==null&&unitHeightMm!==null
          ?unitWidthMm<Math.round(o.w*1000)&&unitHeightMm<Math.round(o.h*1000):null,
        invalidProduct:(unitWidthMm!==null&&unitWidthMm>=Math.round(o.w*1000))||(unitHeightMm!==null&&unitHeightMm>=Math.round(o.h*1000)),
        widthMm:mm(o.w),heightMm:mm(o.h),leftMm:mm(o.x),rightMm:mm((o.f%2?q.d:q.w)-o.x-o.w),
        sillMm:mm(o.sill),headLevel:o.floor*q.h+o.sill+o.h,sillLevel:o.floor*q.h+o.sill};}),
      partitions:(q.walls||[]).map((w,i)=>({...w,tag:prefix+'П'+(i+1),length:Math.hypot(w.c-w.a,w.d-w.b)})),
      roofs:sections.map((s,i)=>({...s,tag:prefix+'К'+(i+1),top:topOf(s),
        offsets:{left:-s.x,right:s.x+s.w-q.w,rear:-s.z,front:s.z+s.d-q.d}}))
    };
  }
  function plan(q,floor,data){
    const scale=Math.min(790/q.w,470/q.d),x=570-q.w*scale/2,y=414-q.d*scale/2;
    const X=v=>x+v*scale,Y=v=>y+v*scale;
    const wallThickness=PentiiStructure.get(q).wallThickness;
    let body=text(25,36,'ПЛАН ЭТАЖА '+(floor+1)+' · отметка пола '+level(floor*q.h),22,'start',ink,'font-weight="bold"');
    body+=rect(x,y,q.w*scale,q.d*scale,'#dce6ed',ink,2)
      +rect(X(wallThickness),Y(wallThickness),(q.w-2*wallThickness)*scale,(q.d-2*wallThickness)*scale,'#f8fbfd',ink,1.2);
    for(const cut of (q._wallCuts||[]).filter(c=>c.bottom<=floor*q.h&&c.top>floor*q.h)){
      const corners=[xyz(q,cut.face,cut.from,0,.02),xyz(q,cut.face,cut.to,0,.02),xyz(q,cut.face,cut.to,0,-wallThickness-.02),xyz(q,cut.face,cut.from,0,-wallThickness-.02)];
      body+='<g data-shared-wall="'+xml(cut.neighborId)+'">'+poly(corners.map(v=>[X(v[0]),Y(v[2])]),'#f8fbfd','none');
      const a=corners[0],b=corners[1];body+=line(X(a[0]),Y(a[2]),X(b[0]),Y(b[2]),blue,1.5,'stroke-dasharray="9 5"')+'</g>';
    }
    for(const wall of data.partitions.filter(w=>w.floor===floor)){
      body+=line(X(wall.a),Y(wall.b),X(wall.c),Y(wall.d),ink,6);
      const dx=wall.c-wall.a,dy=wall.d-wall.b,len=wall.length||1;
      body+=dimText(X((wall.a+wall.c)/2)-dy/len*19,Y((wall.b+wall.d)/2)+dx/len*19,wall.tag+' · '+mm(wall.length));
    }
    for(const o of data.openings.filter(o=>o.floor===floor)){
      const a=xyz(q,o.f,o.x,0),b=xyz(q,o.f,o.x+o.w,0),middle=xyz(q,o.f,o.x+o.w/2,0,-.48);
      body+=poly([xyz(q,o.f,o.x,0,.02),xyz(q,o.f,o.x+o.w,0,.02),
        xyz(q,o.f,o.x+o.w,0,-wallThickness-.02),xyz(q,o.f,o.x,0,-wallThickness-.02)].map(v=>[X(v[0]),Y(v[2])]),'white','none');
      if(o.k<2){body+=line(X(a[0]),Y(a[2]),X(b[0]),Y(b[2]),blue,3)}
      else{
        const end=xyz(q,o.f,o.x,0,-Math.min(o.w,1.2)),hinge=xyz(q,o.f,o.x+Math.min(o.w,1.2),0);
        body+=line(X(a[0]),Y(a[2]),X(end[0]),Y(end[2]),blue,2)
          +'<path d="M'+X(hinge[0])+','+Y(hinge[2])+'A'+Math.min(o.w,1.2)*scale+','+Math.min(o.w,1.2)*scale+' 0 0 0 '+X(end[0])+','+Y(end[2])+'" stroke="'+rule+'" fill="none"/>';
      }
      body+=dimText(X(middle[0]),Y(middle[2])+6,o.tag);
    }
    const byFace=f=>{
      const len=f%2?q.d:q.w,points=[0,len];
      for(const o of data.openings.filter(o=>o.floor===floor&&o.f===f)){
        points.push(...[o.x,o.x+o.w].map(v=>f===1||f===2?len-v:v));
      }
      return points;
    };
    body+=chain(byFace(2),scale,x,y,y-45)+hDim(x,X(q.w),y,y-112,mm(q.w));
    body+=chain(byFace(0),scale,x,Y(q.d),Y(q.d)+55)+hDim(x,X(q.w),Y(q.d),Y(q.d)+105,mm(q.w));
    body+=chain(byFace(3),scale,y,x,x-50,true)+vDim(y,Y(q.d),x,x-110,mm(q.d));
    body+=chain(byFace(1),scale,y,X(q.w),X(q.w)+50,true)+vDim(y,Y(q.d),X(q.w),X(q.w)+110,mm(q.d));
    // Section stations refer to the exact cut positions used on the two section sheets.
    const midX=X(q.w/2),midY=Y(q.d/2);
    body+=line(midX,y-17,midX,Y(q.d)+20,blue,1,'stroke-dasharray="15 6 3 6"')+text(midX+10,y-20,'А',19,'start',blue)+text(midX+25,Y(q.d)+27,'А',19,'start',blue);
    body+=line(x-20,midY,X(q.w)+20,midY,blue,1,'stroke-dasharray="15 6 3 6"')+text(x-38,midY-8,'Б',19,'start',blue)+text(X(q.w)+5,midY-8,'Б',19,'start',blue);
    body+=text(1180,100,'ОБОЗНАЧЕНИЯ',20,'start',ink,'font-weight="bold"')+text(1180,139,'О — оконный проём',18)+text(1180,171,'Д — дверной проём',18)+text(1180,203,'П — перегородка',18)+text(1180,235,'А–А / Б–Б — разрезы',18);
    body+=text(1180,294,'Габариты коробки',19,'start',muted)+text(1180,328,mm(q.w)+' × '+mm(q.d),24,'start',ink,'font-weight="bold"');
    body+=text(1180,378,'Высота этажа',19,'start',muted)+text(1180,412,mm(q.h),24,'start',ink,'font-weight="bold"');
    body+=text(1180,465,'Стены · '+mm(wallThickness)+' мм',18)+text(1180,496,'Проёмы и перегородки:',18)+text(1180,526,'размеры в ведомостях',18);
    body+=text(1180,600,'Начало координат:',18)+text(1180,631,'левый задний угол.',18)+text(1180,663,'X — вправо, Z — вниз.',18);
    body+=text(570,814,'Главный фасад',20,'middle',muted);
    return {title:'Размерный план · этаж '+(floor+1),sub:'Проёмы, перегородки и габариты · размеры в миллиметрах',art:svg(body,(q._wallCuts||[]).length?'Пунктир по периметру — примыкание к стене соседней части. Проёмы в общей стене указаны на её листах. Размеры — мм.':undefined)};
  }
  function roofParts(q){
    const parts=RoofStudio.faces(q).map(part=>({...part}));
    for(const section of RoofStudio.sections(q)){
      for(const box of RoofStudio.parapetParts?.(q,section)||[]){
        const x=box.x-box.w/2,z=box.z-box.d/2,b=box.y-box.h/2,t=box.y+box.h/2;
        const a=[x,b,z],bb=[x+box.w,b,z],c=[x+box.w,b,z+box.d],d=[x,b,z+box.d];
        const at=[x,t,z],bt=[x+box.w,t,z],ct=[x+box.w,t,z+box.d],dt=[x,t,z+box.d];
        for(const points of [[a,bb,bt,at],[bb,c,ct,bt],[c,d,dt,ct],[d,a,at,dt],[at,bt,ct,dt]]){
          parts.push({q:points,roof:box.kind==='coping',parapet:true,sectionId:section.id});
        }
      }
    }
    return parts;
  }
  function elevation(q,face,data){
    const len=face%2?q.d:q.w,structure=PentiiStructure.get(q),ground=structure.groundY,parts=roofParts(q);
    const along=v=>[v[0],q.d-v[2],q.w-v[0],v[2]][face];
    const depth=v=>[v[2],v[0],-v[2],-v[0]][face];
    const vertices=parts.flatMap(part=>part.q),left=Math.min(0,...vertices.map(along)),right=Math.max(len,...vertices.map(along));
    const top=Math.max(q.h*q.n,...vertices.map(v=>v[1])),scale=Math.min(900/(right-left),505/(top-ground));
    const x=630-(left+right)*scale/2,base=680+ground*scale,X=v=>x+v*scale,Y=v=>base-v*scale;
    let body=text(25,36,faceNames[face].toUpperCase()+' ФАСАД · РАЗМЕРЫ И ОТМЕТКИ',22,'start',ink,'font-weight="bold"');
    body+=line(X(left)-30,Y(ground),X(right)+35,Y(ground),muted,1.5);
    let wall=rect(X(0),Y(q.h*q.n),len*scale,q.h*q.n*scale,'#f2f5f6',ink,2)+rect(X(0),Y(0),len*scale,-ground*scale,'#dde6ec',ink);
    for(let floor=0;floor<q.n;floor++)wall+=line(X(0),Y(floor*q.h),X(len),Y(floor*q.h),rule,1,'stroke-dasharray="8 6"');
    for(const cut of (q._wallCuts||[]).filter(c=>c.face===face)){
      wall+='<g data-shared-wall="'+xml(cut.neighborId)+'">'+rect(X(cut.from),Y(cut.top),(cut.to-cut.from)*scale,(cut.top-cut.bottom)*scale,'white',blue,1).replace('/>',' stroke-dasharray="9 5"/>')+'</g>';
    }
    for(const o of data.openings.filter(o=>o.f===face)){
      const y=o.floor*q.h+o.sill;
      wall+=rect(X(o.x),Y(y+o.h),o.w*scale,o.h*scale,o.k<2?'#d8eaf1':'#e2d6c5',ink,2);
      if(o.k<2)wall+=line(X(o.x+o.w/2),Y(y),X(o.x+o.w/2),Y(y+o.h),muted);
      wall+=dimText(X(o.x+o.w/2),Y(y+o.h/2)+6,o.tag);
    }
    const layers=[{depth:depth(xyz(q,face,len/2,0)),markup:wall}];
    for(const part of parts){layers.push({depth:part.q.reduce((sum,v)=>sum+depth(v),0)/part.q.length+.001,
      markup:poly(part.q.map(v=>[X(along(v)),Y(v[1])]),part.detail==='glass'?'#d8eaf1':part.roof?'#b6c6d1':part.parapet?'#e2e8ec':'#f2f5f6',ink,1.5)});}
    for(const c of RoofStudio.columns(q)){
      const center=along([c.x,0,c.z]);layers.push({depth:depth([c.x,0,c.z])+.002,markup:rect(X(center-c.size/2),Y(c.top),c.size*scale,(c.top-ground)*scale,'#dce3e8',ink)});
    }
    layers.push(...(window.PentiiTerraces?.svgElevationLayers?.(q,face,{x0:x,base,scale})||[]));
    body+=layers.sort((a,b)=>a.depth-b.depth).map(part=>part.markup).join('');
    body+=hDim(X(0),X(len),Y(ground),Y(ground)+60,mm(len));
    if(data.roofs.length)body+=hDim(X(left),X(right),Y(ground),Y(ground)+118,mm(right-left)+' · кровля');
    for(let floor=0;floor<q.n;floor++)body+=vDim(Y((floor+1)*q.h),Y(floor*q.h),X(0),X(left)-63,mm(q.h));
    body+=vDim(Y(top),Y(0),X(left),X(left)-120,mm(top));
    const heights=[{y:ground,label:'земля'},{y:0,label:'пол 1-го этажа'},{y:q.h*q.n,label:'верх стен'},
      ...Array.from({length:q.n-1},(_,i)=>({y:(i+1)*q.h,label:'пол '+(i+2)+'-го этажа'})),
      ...data.roofs.map(s=>({y:s.top,label:s.parapet?'верх парапета '+s.tag:'верх кровли '+s.tag}))];
    body+=levelMarks(heights,Y,Math.min(1150,X(right)+20),1202,160,720);
    body+=text(25,832,(q._wallCuts||[]).some(c=>c.face===face)?'Пунктир — примыкание: стену соседней части не дублируем. Проёмы соседней части — на её листах.':'Размеры проёмов, подоконников и перемычек — в ведомости проёмов.',17,'start',muted);
    return {title:faceNames[face]+' фасад · отметки',sub:'Высота стен, этажей, кровли и проёмов',art:svg(body)};
  }
  function levelMarks(items,Y,from,labelX,min,max){
    const grouped=new Map();
    for(const item of items){const key=round(item.y);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(item.label)}
    const sorted=[...grouped.entries()].sort((a,b)=>b[0]-a[0]);
    const gap=Math.min(44,(max-min)/Math.max(1,sorted.length-1)),ys=sorted.map(([h])=>Math.max(min,Math.min(max,Y(h))));
    for(let i=1;i<ys.length;i++)ys[i]=Math.max(ys[i],ys[i-1]+gap);
    const excess=ys.at(-1)-max;if(excess>0)for(let i=0;i<ys.length;i++)ys[i]-=excess;
    return sorted.map(([height,names],i)=>{
      const y=Y(height),labelY=ys[i],end=Math.max(from+12,labelX-20);
      return poly([[from,y],[from+10,y-7],[from+10,y+7]],blue,'none')+line(from+10,y,end-15,y,blue)+line(end-15,y,end,labelY,blue)+line(end,labelY,labelX+275,labelY,blue)
        +text(labelX,labelY-7,level(height),20,'start',ink,'font-weight="bold"')+text(labelX+104,labelY-7,names[0],16,'start',muted);
    }).join('');
  }
  function cutPolygon(points,axis,station,across){
    const hits=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],da=a[axis]-station,db=b[axis]-station;
      if(Math.abs(da)<epsilon)hits.push(a);
      if(da*db<0){const t=da/(da-db);hits.push(a.map((v,j)=>v+(b[j]-v)*t));}
    }
    hits.sort((a,b)=>a[across]-b[across]||a[1]-b[1]);
    return hits.length>1&&Math.hypot(hits.at(-1)[across]-hits[0][across],hits.at(-1)[1]-hits[0][1])>epsilon?[hits[0],hits.at(-1)]:null;
  }
  function foundationSection(q,axis,station,X,Y,scale){
    const s=PentiiStructure.get(q),layout=PentiiStructure.pileLayout(q),under=-s.floorThickness;
    let body='',pileCount=0;
    function box(x,y,z,w,h,d,fill=muted,stroke=ink,attrs=''){
      const position=axis===0?x:z,extent=axis===0?w:d;
      if(Math.abs(position-station)>extent/2+epsilon)return;
      const center=axis===0?z:x,width=axis===0?d:w;
      body+=rect(X(center-width/2),Y(y+h/2),width*scale,h*scale,fill,stroke,1).replace('/>',' '+attrs+'/>');
    }
    if(s.foundation==='slab'){
      box(q.w/2,under-.11,q.d/2,q.w+.22,.22,q.d+.22,'url(#sectionHatch)');
    }else if(s.foundation==='strip'){
      for(const z of [.12,q.d-.12])box(q.w/2,under-.26,z,q.w+.12,.52,.36,'url(#sectionHatch)');
      for(const x of [.12,q.w-.12])box(x,under-.26,q.d/2,.36,.52,q.d-.60,'url(#sectionHatch)');
      for(const z of layout.zs.slice(1,-1))box(q.w/2,under-.26,z,q.w-.6,.52,.36,'url(#sectionHatch)');
    }else{
      const headTop=under-.156,shaftTop=headTop-.005,foot=s.groundY-.18;
      for(const pile of layout.piles){
        const position=axis===0?pile.x:pile.z,offset=Math.abs(position-station);
          // As in 3D, this short below-grade fragment is illustrative only.
          // It does not specify the design diameter or embedment depth.
          if(offset<.125){
            const chord=2*Math.sqrt(.125**2-offset**2),at=axis===0?pile.z:pile.x;
            body+=rect(X(at-chord/2),Y(s.groundY+.008),chord*scale,.15*scale,'#d9e0e4',muted,1);
          }
          if(offset<=.05+epsilon){
            pileCount++;
            box(pile.x,(foot+shaftTop)/2,pile.z,.1,shaftTop-foot,.1,'#53636c',ink,'data-pile-section="'+xml(pile.tag)+'"');
            if(offset<.046)box(pile.x,(foot+shaftTop)/2,pile.z,.092,shaftTop-foot-.004,.092,'white','none');
          }
          box(pile.x,headTop-.0025,pile.z-.025,.15,.005,.05,'#53636c');
          box(pile.x,headTop-.025,pile.z-.048,.15,.05,.004,'#53636c');
          box(pile.x+.025,headTop-.0025,pile.z,.05,.005,.1,'#53636c');
          box(pile.x+.048,headTop-.025,pile.z,.004,.05,.1,'#53636c');
        box(pile.x,headTop+.003,pile.z,.15,.006,.15,'#324550');
      }
      for(const b of PentiiStructure.grillageLayout(q).boards)box(b.x,under-.075,b.z,b.w,.15,b.d,'#d4ba91',ink,'data-grillage-section="true"');
    }
    return '<g data-foundation-section="'+s.foundation+'" data-pile-count="'+pileCount+'">'+body+'</g>';
  }
  function section(q,axis,data){
    const across=axis===0?2:0,station=(axis===0?q.w:q.d)/2,len=axis===0?q.d:q.w,title=axis===0?'А–А':'Б–Б';
    const structure=PentiiStructure.get(q),parts=roofParts(q),cuts=parts.map(p=>cutPolygon(p.q,axis,station,across)).filter(Boolean);
    const roofCuts=parts.filter(p=>p.roof&&!p.parapet).map(p=>cutPolygon(p.q,axis,station,across)).filter(Boolean);
    const xs=cuts.flatMap(s=>s.map(p=>p[across])),left=Math.min(0,...xs),right=Math.max(len,...xs);
    const ground=structure.groundY,top=Math.max(q.h*q.n,...cuts.flatMap(s=>s.map(v=>v[1]))),scale=Math.min(900/(right-left),500/(top-ground));
    const x=620-(left+right)*scale/2,base=680+ground*scale,X=v=>x+v*scale,Y=v=>base-v*scale;
    let body=text(25,36,'РАЗРЕЗ '+title+' · ПО СЕРЕДИНЕ КОРОБКИ',22,'start',ink,'font-weight="bold"');
    body+=line(X(left)-20,Y(ground),X(right)+25,Y(ground),muted,1.5,'stroke-dasharray="12 6"');
    body+=foundationSection(q,axis,station,X,Y,scale);
    const thick=structure.wallThickness;
    const wallTop=at=>Math.max(q.h*q.n,...roofCuts.flatMap(([a,b])=>{
      const span=b[across]-a[across];
      if(span<epsilon||at<a[across]-epsilon||at>b[across]+epsilon)return [];
      return [a[1]+(b[1]-a[1])*(at-a[across])/span-(RoofStudio.soffitDrop||.125)];
    }));
    const endCuts=axis===0?[{face:2,u:q.w-station},{face:0,u:station}]:[{face:3,u:station},{face:1,u:q.d-station}];
    for(const [index,end] of endCuts.entries()){
      const start=index?len-thick:0,finish=start+thick;
      const cut=(q._wallCuts||[]).find(c=>c.face===end.face&&end.u>=c.from-epsilon&&end.u<=c.to+epsilon);
      const bottom=cut?cut.top:0;
      if(bottom<Math.max(wallTop(start),wallTop(finish))-epsilon)body+=poly([[X(start),Y(bottom)],[X(finish),Y(bottom)],[X(finish),Y(wallTop(finish))],[X(start),Y(wallTop(start))]],'url(#sectionHatch)',ink,2);
      if(cut)body+='<g data-shared-wall="'+xml(cut.neighborId)+'">'+line(X((start+finish)/2),Y(0),X((start+finish)/2),Y(cut.top),blue,1.5,'stroke-dasharray="9 5"')+'</g>';
    }
    body+=rect(X(0),Y(0),len*scale,structure.floorThickness*scale,'url(#sectionHatch)',ink,2);
    const attic=(!q._extensionId||data.roofs.length)?PentiiStructure.attic?.(q):null;
    if(attic){
      const ceilingTop=q.h*q.n,ceilingBottom=ceilingTop-attic.thickness;
      let layerBottom=ceilingBottom;
      body+='<g data-attic-type="'+xml(attic.type)+'" data-attic-thickness-mm="'+mm(attic.thickness)+'">';
      for(const layer of attic.layers){
        const height=(Number(layer.mm)||0)/1000;
        if(height>0){
          const fill=/ват/i.test(layer.label)?'#eddfab':/ЦСП/.test(layer.label)?'#b9c3c8':/OSB|обреш/i.test(layer.label)?'#d3bd95':'#e6ece8';
          body+=rect(X(thick),Y(layerBottom+height),(len-2*thick)*scale,height*scale,fill,muted,.9);
          layerBottom+=height;
        }else if(/паро/i.test(layer.label))body+=line(X(thick),Y(layerBottom),X(len-thick),Y(layerBottom),blue,2,'stroke-dasharray="10 4"');
      }
      body+=text(X(len/2),Y(ceilingBottom)+28,'Чердачное: '+(attic.type==='sip'?'СИП-панели':'каркасное')+' · '+mm(attic.thickness)+' мм',18,'middle',blue);
      if(attic.type==='frame')body+=text(X(len/2),Y(ceilingBottom)+52,'Пароизоляция со стороны помещения · вата 3 × 50 мм',16,'middle',muted);
      body+='</g>';
    }
    // Draw only terraces and supports actually intersected by the section plane.
    // Deck coordinates come from the same independent footprint as the 3D mesh.
    for(const [index,terrace] of (window.PentiiTerraces?.sections(q)||[]).entries()){
      const r=PentiiTerraces.rect(q,terrace),low=axis===0?r.x:r.z,span=axis===0?r.w:r.d;
      if(station<low-epsilon||station>low+span+epsilon)continue;
      const start=axis===0?r.z:r.x,end=start+(axis===0?r.d:r.w),depth=.1685;
      body+='<g data-terrace-section="'+xml(terrace.id)+'">'
        +rect(X(start),Y(0),(end-start)*scale,depth*scale,'url(#sectionHatch)',ink,1.5)
        +line(X(start),Y(0),X(end),Y(0),ink,2.2)
        +dimText(X((start+end)/2),Y(0)-18,'Т'+(index+1)+' · '+mm(end-start)+' · ±0,000');
      const edgePoint=(edge,along)=>({
        x:edge%2?(edge===1?r.x+r.w-.1:r.x+.1):r.x+along,
        z:edge%2?r.z+along:(edge===0?r.z+r.d-.1:r.z+.1)
      });
      const seen=new Set();
      for(let edge=0;edge<4;edge++){
        const distance=edge%2?r.d:r.w,count=Math.max(1,Math.ceil(distance/2.25));
        for(let i=0;i<=count;i++){
          const point=edgePoint(edge,Math.min(distance-.1,Math.max(.1,distance*i/count)));
          const position=axis===0?point.x:point.z,projected=axis===0?point.z:point.x,key=round(projected);
          if(Math.abs(position-station)>.07+epsilon||seen.has(key))continue;
          seen.add(key);body+=rect(X(projected-.07),Y(-.13),.14*scale,(-ground-.13)*scale,'url(#sectionHatch)',ink,1.3);
        }
      }
      for(const post of RoofStudio.columns(q).filter(c=>c.sectionId===terrace.id)){
        const position=axis===0?post.x:post.z,projected=axis===0?post.z:post.x;
        if(Math.abs(position-station)>post.size/2+epsilon)continue;
        body+=rect(X(projected-post.size/2),Y(post.top),post.size*scale,(post.top-ground)*scale,'url(#sectionHatch)',ink,1.3);
      }
      body+='</g>';
    }
    for(let floor=0;floor<=q.n;floor++){
      body+=line(X(0),Y(floor*q.h),X(len),Y(floor*q.h),ink,floor===0?3:2);
      if(floor<q.n){body+=text(X(len/2),Y((floor+.5)*q.h),floor+1+' этаж · '+mm(q.h)+' мм',21,'middle');
        body+=vDim(Y((floor+1)*q.h),Y(floor*q.h),X(0),X(left)-55,mm(q.h));}
    }
    for(const [a,b] of roofCuts){
      const depth=RoofStudio.soffitDrop||.125;
      body+=poly([[X(a[across]),Y(a[1])],[X(b[across]),Y(b[1])],
        [X(b[across]),Y(b[1]-depth)],[X(a[across]),Y(a[1]-depth)]],'#dce6ed',ink,1.3);
    }
    for(const [a,b] of cuts)body+=line(X(a[across]),Y(a[1]),X(b[across]),Y(b[1]),ink,2);
    body+=hDim(X(0),X(len),Y(ground),Y(ground)+65,mm(len));
    if(data.roofs.length)body+=hDim(X(left),X(right),Y(ground),Y(ground)+120,mm(right-left)+' · кровля в сечении');
    body+=vDim(Y(top),Y(0),X(left),X(left)-115,mm(top));
    body+=levelMarks([{y:ground,label:'земля'},{y:0,label:'пол 1-го этажа'},
      ...Array.from({length:q.n},(_,i)=>({y:(i+1)*q.h,label:i+1===q.n?'верх стен':'пол '+(i+2)+'-го этажа'})),{y:top,label:'верх в сечении'}],Y,Math.min(X(right)+15,1140),1200,170,715);
    body+=text(25,832,'Сечение: '+(axis===0?'X':'Z')+' = '+mm(station)+' мм. Толщина наружной стены — '+mm(thick)+' мм. Цокольное перекрытие — '+mm(structure.floorThickness)+' мм.',17,'start',muted);
    return {title:'Разрез '+title+' · высоты',sub:'Геометрический разрез модели · узлы и несущие конструкции показаны условно',art:svg(body,(q._wallCuts||[]).length?'Пунктир — примыкание к соседней части. Показаны опоры в сечении; заглубление условное. Размеры — мм, отметки — м.':'Размеры — мм; отметки — м. Показаны опоры, пересечённые плоскостью разреза. Заглубление основания условное.')};
  }
  function roofPlan(q,data){
    if(!data.roofs.length)return null;
    const left=Math.min(0,...data.roofs.map(s=>s.x)),right=Math.max(q.w,...data.roofs.map(s=>s.x+s.w));
    const back=Math.min(0,...data.roofs.map(s=>s.z)),front=Math.max(q.d,...data.roofs.map(s=>s.z+s.d));
    const scale=Math.min(970/(right-left),490/(front-back)),x=710-(left+right)*scale/2,y=400-(back+front)*scale/2,X=v=>x+v*scale,Y=v=>y+v*scale;
    let body=text(25,36,'ПЛАН КРОВЛИ · РАЗМЕРЫ СЕКЦИЙ И СВЕСОВ',22,'start',ink,'font-weight="bold"');
    for(const part of RoofStudio.faces(q).filter(f=>f.roof))body+=poly(part.q.map(v=>[X(v[0]),Y(v[2])]),'#e1ebf1',muted);
    body+=rect(X(0),Y(0),q.w*scale,q.d*scale,'none',ink,2).replace('/>',' stroke-dasharray="12 5"/>');
    for(const s of data.roofs){
      body+=rect(X(s.x),Y(s.z),s.w*scale,s.d*scale,'none',s.parapet?ink:blue,s.parapet?5:1.5);
      const cx=X(s.x+s.w/2),cy=Y(s.z+s.d/2);
      body+=dimText(cx,cy-8,s.tag+' · '+mm(s.w)+' × '+mm(s.d));
      body+=text(cx,cy+20,s.roof===3?'Плоская'+(s.parapet?' · парапет':''):metres(s.pitch)+'°'+(s.parapet?' · парапет':''),18,'middle',muted);
    }
    body+=hDim(X(left),X(right),Y(back),Y(back)-58,mm(right-left));
    body+=vDim(Y(back),Y(front),X(left),X(left)-62,mm(front-back));
    body+=chain([left,0,q.w,right],scale,x,Y(front),Y(front)+55);
    body+=chain([back,0,q.d,front],scale,y,X(right),X(right)+55,true);
    body+=text(25,758,'Пунктир — наружные стены. К1, К2… — секции в ведомости кровли. Размеры секций включают свесы.',19,'start',muted);
    body+=text(25,799,'Размеры нижней и правой цепочки показывают фактические отступы краёв кровли от коробки.',19,'start',muted);
    return {title:'Размерный план кровли',sub:'Контур стен, покрытие, секции и фактические свесы',art:svg(body)};
  }
  let textMeasure;
  function wrapped(value,width,size=19){
    if(!textMeasure&&typeof document!=='undefined')textMeasure=document.createElement('canvas').getContext('2d');
    if(textMeasure)textMeasure.font=size+'px Arial';
    const length=s=>textMeasure?textMeasure.measureText(s).width:s.length*size*.62;
    const output=[];
    for(const paragraph of String(value).split('\n')){
      let current='';
      for(const word of paragraph.split(/\s+/)){
        if(length(current+(current?' ':'')+word)<=width){current+=(current?' ':'')+word;continue;}
        if(current){output.push(current);current='';}
        for(const char of word){if(current&&length(current+char)>width){output.push(current);current='';}current+=char;}
      }
      output.push(current);
    }
    return output;
  }
  function tablePages(title,sub,columns,rows,note,limit=15,emptyMessage=''){
    if(!rows.length&&!emptyMessage)return [];
    const pages=[],prepared=rows.map(row=>{
      const cells=row.map((value,j)=>wrapped(value,columns[j].width-24));
      return {cells,height:Math.max(42,Math.max(...cells.map(cell=>cell.length))*23+18)};
    });
    for(let at=0;at<prepared.length||(!prepared.length&&!pages.length);){
      const batch=[];let end=at,space=0;
      while(end<prepared.length&&end-at<limit&&space+prepared[end].height<=655){batch.push(prepared[end]);space+=prepared[end++].height;}
      // Input labels in the editor are bounded; retain a readable fallback for imported data.
      if(end===at&&end<prepared.length){const row=prepared[end++];batch.push({cells:row.cells.map(cell=>cell.slice(0,26)),height:616});}
      let body=text(25,36,title.toUpperCase()+(at||end<prepared.length?' · '+(at+1)+'–'+end:''),22,'start',ink,'font-weight="bold"');
      let x=25;const starts=[];
      for(const column of columns){starts.push(x);body+=rect(x,73,column.width,65,'#eaf2f7',rule);for(const [i,label] of column.title.split('|').entries())body+=text(x+12,100+i*23,label,18,'start',ink,'font-weight="bold"');x+=column.width;}
      let y=138;
      for(const [i,row] of batch.entries()){
        body+=rect(25,y,1480,row.height,i%2?'#f5f9fc':'white',rule,1);
        row.cells.forEach((cell,j)=>{for(const [lineNo,value] of cell.entries())body+=text(starts[j]+12,y+27+23*lineNo,value,19,'start',ink);});
        for(const x of starts.slice(1))body+=line(x,y,x,y+row.height,rule,1);
        y+=row.height;
      }
      if(!prepared.length)body+=rect(25,138,1480,80,'#f5f9fc',rule)+text(45,184,emptyMessage,21,'start',muted);
      pages.push({title,sub,art:svg(body,note)});at=end;
    }
    return pages;
  }
  function windowDescription(o,products){
    const unitSize=(o.unitWidthMm??'уточнить')+' × '+(o.unitHeightMm??'уточнить');
    const rows=products?[
      faceNames[o.f]+' фасад · этаж '+(o.floor+1)+' · 1 шт. · проём '+o.tag,
      'Блок: '+unitSize+' мм · проём: '+mm(o.w)+' × '+mm(o.h)+' мм',
      'Материал: '+(String(o.product?.material||'').trim()||'уточнить'),
      'Цвет: '+(String(o.product?.color||'').trim()||'уточнить'),
      o.invalidProduct?'Проверить зазоры: блок не помещается в проём.':'Открывание и комплектация: уточнить'
    ]:[
      faceNames[o.f]+' фасад · этаж '+(o.floor+1)+' · 1 шт. · изделие '+o.unitTag,
      'Проём: '+mm(o.w)+' × '+mm(o.h)+' мм · низ от пола: '+mm(o.sill)+' мм',
      'От левого края фасада: '+mm(o.x)+' мм',
      'Отметки низа / верха: '+level(o.sillLevel)+' / '+level(o.headLevel)+' м',
      o.invalidProduct?'Проверить зазоры: блок не помещается в проём.':'Блок: '+unitSize+' мм'
    ];
    return rows.flatMap(row=>wrapped(row,677,18));
  }
  function windowDiagram(o,kind,x,y,scale){
    const product=kind==='product',width=product?(o.unitWidthMm??o.w*1000):o.w*1000,height=product?(o.unitHeightMm??o.h*1000):o.h*1000;
    const w=width*scale,h=height*scale,left=x-w/2,top=y+150-h/2;
    let body='<g data-window-diagram="'+kind+'">'+text(x,y+66,product?o.unitTag+' · '+openingKinds[o.k]:o.tag+' · Проём в стене',18,'middle',muted);
    if(!product)body+=rect(left-8,top-8,w+16,h+16,'url(#sectionHatch)',rule,1);
    const shape=rect(left,top,w,h,product?'url(#specGlass)':'white',product?'#344f61':ink,product?2:1.8);
    body+=shape.replace('/>',' data-shape="'+kind+'" data-known-width="'+(!product||o.unitWidthMm!==null)+'" data-known-height="'+(!product||o.unitHeightMm!==null)+'"/>');
    if(product){
      const frame=Math.min(7,Math.max(2.5,57*scale),w*.18,h*.18),count=Math.max(1,Math.round(width/(o.k===1?1050:1200)));
      body+=rect(left+frame,top+frame,w-frame*2,h-frame*2,'none','#667d8b',1);
      for(let i=1;i<count;i++)body+=rect(left+w*i/count-frame/2,top+frame,frame,h-frame*2,'#d9e4e9','#6a8190',.7);
      for(let i=0;i<count;i++){
        const cx=left+w*(i+.5)/count,span=Math.min(w/count*.18,h*.2);
        body+=line(cx-span,top+h*.48,cx+span,top+h*.24,'white',1.6);
      }
    }
    body+=hDim(left,left+w,top+h,y+239,product?(o.unitWidthMm??'уточнить'):mm(o.w));
    body+=vDim(top,top+h,left,left-27,product?(o.unitHeightMm??'уточнить'):mm(o.h));
    return body+'</g>';
  }
  function windowCard(o,products,x,y,height,description){
    const width=725,tag=products?o.unitTag:o.tag;
    const scale=Math.min(225/Math.max(o.w*1000,o.unitWidthMm||0),130/Math.max(o.h*1000,o.unitHeightMm||0));
    let body='<g data-window-card="'+tag+'" data-x="'+x+'" data-y="'+y+'" data-width="'+width+'" data-height="'+height+'">';
    body+=rect(x,y,width,height,'white',rule,1.2)+rect(x,y,width,43,'#eef5fa',rule,1);
    body+=text(x+19,y+28,tag+' · '+(products?openingKinds[o.k]:'Оконный проём')+' / '+(products?o.tag:o.unitTag),20,'start',ink,'font-weight="bold"');
    body+=windowDiagram(o,'opening',x+175,y,scale)+windowDiagram(o,'product',x+540,y,scale);
    body+=line(x+18,y+252,x+width-18,y+252,rule,1);
    body+='<g data-description="'+tag+'">';
    description.forEach((value,i)=>body+=text(x+20,y+275+i*21,value,18,'start',value.startsWith('Проверить')?'#a04529':ink));
    return body+'</g></g>';
  }
  function visualWindowPages(items,products){
    const title=products?'Спецификация окон':'Спецификация оконных проёмов';
    const note='Масштаб карточек различается. Размеры — мм; переплёт условный. Открывание и зазоры уточняются при заказе.';
    if(!items.length)return [{title,sub:'Визуальная ведомость · вид спереди',art:svg(text(25,36,title.toUpperCase(),22,'start',ink,'font-weight="bold"')+rect(25,80,1480,110,'#f5f9fc',rule)+text(50,143,products?'Окна в эскизе не заданы.':'Оконные проёмы в эскизе не заданы.',22,'start',muted),note)}];
    const prepared=items.map(o=>{const description=windowDescription(o,products);return {o,description,height:Math.max(380,291+(description.length-1)*21)}}),pages=[];
    for(let at=0;at<prepared.length;){
      let body='<defs><linearGradient id="specGlass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c3dce9"/><stop offset=".55" stop-color="#edf5f9"/><stop offset="1" stop-color="#dceaf1"/></linearGradient></defs>',y=62,end=at;
      while(end<prepared.length&&end-at<4){
        const row=prepared.slice(end,end+2),height=Math.max(...row.map(c=>c.height));
        if(y+height>838&&end>at)break;
        for(const [i,c] of row.entries())body+=windowCard(c.o,products,25+i*755,y,height,c.description);
        y+=height+16;end+=row.length;
      }
      body=text(25,36,title.toUpperCase()+' · '+(at+1)+'–'+end,22,'start',ink,'font-weight="bold"')+body;
      pages.push({title,sub:'Вид спереди · проём и изделие · позиции '+(at+1)+'–'+end+' из '+items.length,art:svg(body,note)});at=end;
    }
    return pages;
  }

  function openingSchedules(data){
    const result=[];
    for(const doors of [false,true]){
      const items=data.openings.filter(o=>(o.k>=2)===doors);
      if(!doors){result.push(...visualWindowPages(items,false),...visualWindowPages(items,true));continue;}
      result.push(...tablePages(doors?'Спецификация дверных проёмов':'Спецификация оконных проёмов',
        'Проёмы в стенах · марки соответствуют планам и фасадам',[
        {title:'Проём / блок|Тип',width:260},{title:'Фасад|Этаж',width:190},{title:'Ширина × высота|мм',width:230},
        {title:'От левого края|фасада, мм',width:195},{title:'Низ от пола|мм',width:175},{title:'Низ / верх|отметки, м',width:310},{title:'Кол-во|шт.',width:120}
      ],items.map(o=>[o.tag+' / '+o.unitTag+'\n'+openingKinds[o.k],faceNames[o.f]+' / '+(o.floor+1),mm(o.w)+' × '+mm(o.h),mm(o.x),mm(o.sill),level(o.sillLevel)+' / '+level(o.headLevel),1]),
      'Размеры относятся к проёмам в стенах, а не к изделиям. Отступ слева — при взгляде на соответствующий фасад.',12,
      doors?'Дверные проёмы в эскизе не заданы.':'Оконные проёмы в эскизе не заданы.'));
      result.push(...tablePages(doors?'Спецификация дверей':'Спецификация окон',
        'Изделия и связь с проёмами · каждый блок имеет собственную марку',[
        {title:'Блок / проём|Тип',width:250},{title:'Ширина × высота|блока, мм',width:245},{title:'Проём|Ш × В, мм',width:210},
        {title:'Материал|по выбору',width:285},{title:'Цвет|по выбору',width:270},{title:'Фасад / этаж|Кол-во, шт.',width:220}
      ],items.map(o=>[o.unitTag+' / '+o.tag+'\n'+openingKinds[o.k],
        (o.unitWidthMm??'уточнить')+' × '+(o.unitHeightMm??'уточнить')+(o.invalidProduct?'\nПроверить зазоры':''),
        mm(o.w)+' × '+mm(o.h),String(o.product?.material||'').trim()||'уточнить',String(o.product?.color||'').trim()||'уточнить',
        faceNames[o.f]+' / '+(o.floor+1)+'\n1 шт.']),
      'Размер блока задаётся отдельно от проёма. Монтажные зазоры, комплектацию и открывание согласовать перед заказом.',10,
      doors?'Двери в эскизе не заданы.':'Окна в эскизе не заданы.'));
    }
    return result;
  }
  function pages(q){
    const data=facts(q),result=[];
    for(let floor=0;floor<q.n;floor++)result.push(plan(q,floor,data));
    result.push(...faceNames.map((_,f)=>elevation(q,f,data)),section(q,0,data),section(q,2,data));
    const roof=roofPlan(q,data);if(roof)result.push(roof);
    result.push(...openingSchedules(data));
    result.push(...tablePages('Положение перегородок','Координаты концов и длины · марки П на планах',[
      {title:'Марка|Этаж',width:180},{title:'Начало X|мм',width:250},{title:'Начало Z|мм',width:250},
      {title:'Конец X|мм',width:250},{title:'Конец Z|мм',width:250},{title:'Длина|мм',width:300}
    ],data.partitions.map(p=>[p.tag+' / '+(p.floor+1),mm(p.a),mm(p.b),mm(p.c),mm(p.d),mm(p.length)]),
    'Начало координат — левый задний угол коробки на плане. X направлена вправо, Z вниз. Координаты относятся к линии перегородки.'));
    result.push(...tablePages('Геометрия секций кровли','Размеры, высоты и уклоны · марки К на плане',[
      {title:'Секция|Тип',width:330},{title:'Габариты|мм',width:260},{title:'Низ / верх|отметки, м',width:300},
      {title:'Уклон|градусы',width:180},{title:'Парапет|высота × толщина, мм',width:410}
    ],data.roofs.map(s=>[s.tag+' · '+(RoofStudio.shapeLabel?.(s)||roofs[s.roof]),mm(s.w)+' × '+mm(s.d),level(s.base)+' / '+level(s.top),s.roof===3?'—':metres(s.pitch),s.parapet?mm(s.parapet.height||.45)+' × '+mm(s.parapet.thickness||.18):'—']),
    'Габариты кровли включают свесы. Отметка верха учитывает кукушки и парапет. Высота парапета отсчитывается от покрытия.'));
    return result;
  }
  return {pages,facts,plan,elevation,section,roofPlan,openingSchedules,tablePages};
})();

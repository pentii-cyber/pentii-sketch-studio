/* Independent roof sections in metres. Relative post coordinates stay under
   the selected section as its footprint is moved or resized. */
window.RoofStudio = (() => {
  'use strict';
  const id = () => globalThis.crypto?.randomUUID?.() || ('s'+Math.random().toString(36).slice(2));
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
  const round = v => Math.round(v*100)/100;
  const snap = v => Math.round(v*20)/20;
  const m = v => round(v).toLocaleString('ru-RU')+' м';
  const eps = 1e-7;
  const soffitDrop=.125;
  const ceilingDepth=.215;
  const limits = {x:[-60,60],z:[-60,60],w:[.6,65],d:[.6,65],base:[.4,30],pitch:[2,65]};
  const materialList=[
    ['Металлочерепица','Металлочерепица','Волнистый профиль с поперечными ступенями рядов.'],
    ['Профнастил','Профлист (профнастил)','Продольные трапециевидные рёбра металлического листа.'],
    ['Мягкая черепица','Мягкая черепица','Битумное покрытие с шестигранной нарезкой и каменной посыпкой.'],
    ['ТЕХНОНИКОЛЬ SHINGLAS','ТЕХНОНИКОЛЬ SHINGLAS · гибкая','Гибкая черепица с рисунком многослойных гонтов.'],
    ['Рулонная черепица','Рулонная черепица','Битумное рулонное покрытие с декоративным рисунком.'],
    ['Фальц','Фальцевая кровля','Гладкие металлические картины со стоячими фальцами.']
  ];
  const materialLabel=value=>materialList.find(item=>item[0]===value)?.[1]||value||materialList[0][1];
  const colors={'#293b47':'Графит','#607989':'Серо-голубой','#77534a':'Шоколад','#914c40':'Терракота','#e7edf1':'Светлый','#516958':'Зелёный'};
  const sessions = new WeakMap();
  const expandedGroups=new Set();

  function legacy(p) {
    const e=Number.isFinite(p.e)?p.e:.3;
    return {id:'main',name:'Основная крыша',x:-e,z:-e,w:p.w+2*e,d:p.d+2*e,base:p.h*p.n,
      roof:p.roof,ridge:p.ridge,pitch:p.pitch,canopy:false,posts:[]};
  }
  function sections(p) {return Array.isArray(p.roofSections)?p.roofSections:[legacy(p)];}
  function initialize(p) {if(!Array.isArray(p.roofSections))p.roofSections=[legacy(p)];return p;}
  function canopyAt(main,p){
    const edge=main.z+main.d;
    const attached=main.id==='main' && main.z<=p.d && edge>=p.d
      && main.x<p.w && main.x+main.w>0;
    const left=attached?Math.max(0,main.x):main.x;
    const right=attached?Math.min(p.w,main.x+main.w):main.x+main.w;
    const width=Math.max(.6,Math.min(clamp(main.w*.48,2,6.2),right-left-.12));
    const depth=3,base=round(Math.max(.6,main.base-.48));
    // The high end bears against the wall, underneath the main overhang.
    // A detached section instead provides its own joining edge.
    return {id:id(),name:'Навес',x:round(Math.max(left,right-width-.12)),z:round(attached?p.d-.08:edge-.24),
      w:width,d:depth,base,roof:2,ridge:0,pitch:3,canopy:true,
      posts:[{id:id(),u:.3/width,v:1-.3/depth,size:.15},{id:id(),u:1-.3/width,v:1-.3/depth,size:.15}]};
  }
  function turnCanopyToPoint(s,anchor,point){
    // A side canopy runs along its supporting wall and drains towards its
    // outer posts. Rotate the footprint and posts together before placement.
    const cx=anchor.x+anchor.w/2,cz=anchor.z+anchor.d/2;
    const dx=(point.x-cx)/anchor.w,dz=(point.z-cz)/anchor.d;
    const side=Math.abs(dx)>Math.abs(dz)?(dx>0?1:3):(dz>=0?0:2);
    if(side%2)[s.w,s.d]=[s.d,s.w];
    s.ridge=side%2;s.reverse=side>=2;
    for(const post of s.posts){
      for(let turn=0;turn<side;turn++)[post.u,post.v]=[post.v,1-post.u];
    }
  }
  function sample(p){initialize(p);if(p.roofSections.length===1)p.roofSections.push(canopyAt(p.roofSections[0],p));return p;}
  function editSection(p,sectionId,patch) {
    const next=initialize(clone(p)),s=next.roofSections.find(s=>s.id===sectionId);
    if(s)Object.assign(s,patch);
    return next;
  }
  function followHouse(before,after){
    if(before.w===after.w&&before.d===after.d)return;
    const map=(value,oldSize,newSize)=>value<0?value:value>oldSize?newSize+value-oldSize:value*newSize/oldSize;
    for(const s of sections(before)){
      if(s.canopy||s.terrace||s.extensionId||s.x>=before.w||s.z>=before.d||s.x+s.w<=0||s.z+s.d<=0)continue;
      const next=sections(after).find(t=>t.id===s.id);if(!next)continue;
      const x=map(s.x,before.w,after.w),z=map(s.z,before.d,after.d);
      Object.assign(next,{x:round(x),z:round(z),w:round(map(s.x+s.w,before.w,after.w)-x),d:round(map(s.z+s.d,before.d,after.d)-z)});
    }
  }
  function shapePatch(s,value){
    if(value==='parapet')return {roof:3,pitch:3,parapet:s.parapet||{height:.45,thickness:.18}};
    const roof=Number(value),next={roof};
    if(roof===3)next.parapet=undefined;
    if(roof===2&&s.roof!==2)next.pitch=3;
    if(![2,3].includes(roof)&&[2,3].includes(s.roof))next.pitch=30;
    if(![2,3].includes(roof))next.parapet=undefined;
    return next;
  }
  function parapetParts(p,s){
    if(!s.parapet||![2,3].includes(s.roof))return [];
    const t=s.parapet.thickness||.18,top=ridgeHeight(s)+s.parapet.height,bottom=s.base-soffitDrop;
    const x=s.x,z=s.z,w=s.w,d=s.d,h=top-bottom,out=[];
    const add=(x,z,w,d,kind,y,height)=>out.push({x,z,w,d,kind,y,h:height,sectionId:s.id});
    add(x+w/2,z+t/2,w,t,'wall',bottom+h/2,h);
    add(x+w/2,z+d-t/2,w,t,'wall',bottom+h/2,h);
    add(x+t/2,z+d/2,t,d-2*t,'wall',bottom+h/2,h);
    add(x+w-t/2,z+d/2,t,d-2*t,'wall',bottom+h/2,h);
    const lip=.035,cap=.045;
    add(x+w/2,z+t/2,w+2*lip,t+2*lip,'coping',top+cap/2,cap);
    add(x+w/2,z+d-t/2,w+2*lip,t+2*lip,'coping',top+cap/2,cap);
    add(x+t/2,z+d/2,t+2*lip,d-2*t-2*lip,'coping',top+cap/2,cap);
    add(x+w-t/2,z+d/2,t+2*lip,d-2*t-2*lip,'coping',top+cap/2,cap);
    return out;
  }
  const overallHeight=s=>ridgeHeight(s)+(s.parapet&&[2,3].includes(s.roof)?s.parapet.height+.045:0);
  const shapeLabel=s=>(roofs[s.roof]||'Крыша')+(s.parapet&&[2,3].includes(s.roof)?' с парапетом':'');
  function validate(p) {
    if(!p.roofSections)return '';
    if(!Array.isArray(p.roofSections)||p.roofSections.length>16)return 'В эскизе может быть до 16 секций крыши.';
    const ids=new Set();
    for(const section of p.roofSections){
      if(!section?.id||ids.has(section.id))return 'Проверьте идентификаторы секций крыши.';
      ids.add(section.id);
      for(const [field,[min,max]] of Object.entries(limits)){
        if(!Number.isFinite(section[field])||section[field]<min-eps||section[field]>max+eps)return 'Размер или положение секции вне диапазона.';
      }
      if(!Number.isInteger(section.roof)||section.roof<0||section.roof>7||![0,1].includes(section.ridge))return 'Неверная форма или направление крыши.';
      if(!Array.isArray(section.posts)||section.posts.length>64)return 'Допустимо до 64 опор на секцию.';
      if(section.parapet&&(![2,3].includes(section.roof)||!Number.isFinite(section.parapet.height)||section.parapet.height<.15||section.parapet.height>1.5||
        !Number.isFinite(section.parapet.thickness)||section.parapet.thickness<.12||section.parapet.thickness>Math.min(.35,section.w/3,section.d/3)))return 'Проверьте высоту и толщину парапета.';
      const modelError=RoofSculpt.validate(section,()=>shapeData(section));if(modelError)return modelError;
      for(const post of section.posts){
        if(!post?.id||![post.u,post.v,post.size].every(Number.isFinite)||post.u<0||post.v<0||post.u>1||post.v>1||post.size<.08||post.size>.6)return 'Опора должна находиться под секцией крыши.';
      }
    }
    return '';
  }
  function polygonArea(poly){
    let area=0;poly.forEach((v,i)=>{let n=poly[(i+1)%poly.length];area+=v[0]*n[2]-n[0]*v[2]});
    return area*.5;
  }
  function heightFn(poly){
    const a=poly[0];
    for(let i=1;i<poly.length-1;i++){
      const b=poly[i],c=poly[i+1];
      const dx=b[0]-a[0],dz=b[2]-a[2],ex=c[0]-a[0],ez=c[2]-a[2],det=dx*ez-dz*ex;
      if(Math.abs(det)<eps)continue;
      const h=b[1]-a[1],k=c[1]-a[1],mx=(h*ez-dz*k)/det,mz=(dx*k-h*ex)/det;
      return (x,z)=>a[1]+mx*(x-a[0])+mz*(z-a[2]);
    }
    return null;
  }
  function insideEdges(poly){
    const sign=Math.sign(polygonArea(poly));
    return poly.map((a,i)=>{
      const b=poly[(i+1)%poly.length];
      return q=>sign*((b[0]-a[0])*(q[2]-a[2])-(b[2]-a[2])*(q[0]-a[0]));
    });
  }
  function interpolate(a,b,t){return a.map((v,j)=>v+(b[j]-v)*t);}
  function cut(poly,test){
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],av=test(a),bv=test(b);
      if(av>=0)out.push(a);
      if((av<0)!==(bv<0))out.push(interpolate(a,b,av/(av-bv)));
    }
    return out;
  }
  function subtract(poly,tests){
    let intersection=poly;
    for(const test of tests){
      intersection=cut(intersection,test);
      if(intersection.length<3||Math.abs(polygonArea(intersection))<eps)return [poly];
    }
    const keep=[];let remaining=poly;
    for(const test of tests){
      const outside=cut(remaining,q=>-test(q));
      if(Math.abs(polygonArea(outside))>eps)keep.push(outside);
      remaining=cut(remaining,test);
    }
    return keep;
  }
  function primitivePatches(s){
    return legacyRoofFaces({w:s.w,d:s.d,n:1,h:s.base,e:0,roof:s.roof,ridge:s.ridge,pitch:s.pitch})
      .map(face=>({...face,q:face.q.map(([x,y,z])=>[s.x+(s.reverse&&s.ridge?s.w-x:x),y,s.z+(s.reverse&&!s.ridge?s.d-z:z)]),sectionId:s.id}));
  }
  const shapeCache=new WeakMap();
  function shapeData(s){
    const key=JSON.stringify([s.w,s.d,s.x,s.z,s.base,s.roof,s.ridge,s.pitch,s.reverse,s.liftPoints,s.dormers]);
    const old=shapeCache.get(s);if(old?.key===key)return old.data;
    const data=RoofSculpt.build(s,primitivePatches(s));shapeCache.set(s,{key,data});return data;
  }
  const sectionPatches=s=>shapeData(s).roof;
  const trimFaces=s=>RoofSculpt.trimFaces(s,shapeData(s));
  const positionHeight=(s,x,z)=>RoofSculpt.sample(shapeData(s).host,x,z).height;
  const dormerParts=s=>shapeData(s).dormers.flatMap(d=>d.cheeks.concat(d.windows));
  const toolState={project:'',section:'',mode:'',node:'',dormer:''};
  function toolsFor(p,s){
    if(toolState.project!==p.id||toolState.section!==s.id)
      Object.assign(toolState,{project:p.id,section:s.id,mode:'',node:'',dormer:''});
    return toolState;
  }
  function actionFor(p,s){return toolState.project===p.id&&toolState.section===s.id?toolState.mode:''}
  function liftPoint(s,x,z){return RoofSculpt.pointAt(s,x,z)}
  function setLift(s,point,value){
    const points=(s.liftPoints||[]).filter(k=>k.id!==point.id);
    return {liftPoints:[...points,{...point,lift:round(clamp(value,-6,6))}]};
  }
  function addDormer(s,x,z){
    const previous=s.dormers?.find(d=>d.id===toolState.dormer);
    const d=RoofSculpt.dormerAt(s,x,z,shapeData(s));d.shape=previous?.shape||'house';toolState.dormer=d.id;
    return {dormers:[...(s.dormers||[]),d]};
  }
  function atLocation(s,x,z){
    if(toolState.mode==='moveDormer'){
      const [u,v]=RoofSculpt.uv(s,x,z);
      return {dormers:s.dormers.map(d=>d.id===toolState.dormer?{...d,u,v}:d)};
    }
    return addDormer(s,x,z);
  }
  function roofOwner(p,s){
    const e=(p.extensions||[]).find(e=>e.id===s.extensionId);
    return e?{x:e.x,z:e.z,w:e.w,d:e.d,H:e.h*(e.n||1)}:{x:0,z:0,w:p.w,d:p.d,H:p.h*p.n};
  }
  function gables(p,s,patches){
    if(s.canopy)return [];
    // Only close the actual house envelope. A broad overhang must stay open.
    const box=roofOwner(p,s),{x,z,w,d}=box;
    const result=[],corners=[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
    const H=box.H;
    for(const face of patches){
      const height=heightFn(face.q);
      if(!face.roof||!height)continue;
      const edges=insideEdges(face.q);
      corners.forEach(([x,z],j)=>{
        const [bx,bz]=corners[(j+1)%4],a=[x,0,z],b=[bx,0,bz];
        let lo=0,hi=1;
        for(const test of [...edges,q=>height(q[0],q[2])-soffitDrop-H]){
          const av=test(a),bv=test(b);
          if(av<-eps&&bv<-eps)return;
          if(av<-eps)lo=Math.max(lo,av/(av-bv));
          if(bv<-eps)hi=Math.min(hi,av/(av-bv));
        }
        if(hi-lo<eps)return;
        const c=interpolate(a,b,lo),d=interpolate(a,b,hi);
        const ch=Math.max(H,height(c[0],c[2])-soffitDrop),dh=Math.max(H,height(d[0],d[2])-soffitDrop);
        if(Math.max(ch,dh)<H+.015)return;
        result.push({q:[[c[0],H,c[2]],[d[0],H,d[2]],[d[0],dh,d[2]],[c[0],ch,c[2]]],roof:false,sectionId:s.id});
      });
    }
    return result;
  }
  function rawFaces(p){
    const out=[];
    for(const s of sections(p)){
      const patches=sectionPatches(s);
      out.push(...patches.filter(r=>r.roof),...gables(p,s,shapeData(s).host),...dormerParts(s));
    }
    return out;
  }
  function upperEnvelope(all,layered=new Set()){
    const planes=all.map(r=>heightFn(r.q));
    const edges=all.map((r,i)=>planes[i]?insideEdges(r.q):null);
    return all.flatMap((part,i)=>{
      if(!planes[i])return [part];
      let pieces=[part.q];
      all.forEach((other,j)=>{
        if(!planes[j]||other.sectionId===part.sectionId||!pieces.length)return;
        const tests=[...edges[j],q=>planes[j](q[0],q[2])-q[1]+(j>i?eps:-eps)];
        // A low porch is a separate roof below the house eaves, not a piece
        // of its top envelope. Trim only their actual lining intersection;
        // a roof several metres above must not erase the porch's wall joint.
        if(layered.has(part.sectionId)||layered.has(other.sectionId))
          tests.push(q=>soffitDrop+.02-(planes[j](q[0],q[2])-q[1]));
        pieces=pieces.flatMap(poly=>subtract(poly,tests));
      });
      return pieces.map(q=>({...part,q}));
    });
  }
  function faces(p){
    const ss=sections(p),panes=ss.flatMap(s=>sectionPatches(s).filter(f=>f.roof));
    const skins=upperEnvelope(panes,new Set(ss.filter(s=>s.canopy||s.extensionId).map(s=>s.id)));
    // Exterior shading is continuous at roof junctions: one gable sheet per
    // interval of the outer wall, reaching the highest attached roof there.
    const enclosed=new Set(ss.filter(s=>!s.canopy).map(s=>s.id));
    const hasDormers=ss.some(s=>s.dormers?.length);
    const cover=hasDormers?upperEnvelope(ss.filter(s=>enclosed.has(s.id)).flatMap(s=>shapeData(s).host)):
      enclosed.size===ss.length?skins:upperEnvelope(panes.filter(f=>enclosed.has(f.sectionId)));
    return skins.concat(ss.flatMap(s=>gables(p,s,cover.filter(f=>f.sectionId===s.id))),ss.flatMap(dormerParts));
  }
  function lining(p,face,section){
    if(face.dormerId)return {ceiling:face.q,soffit:[]};
    if(section.canopy)return {ceiling:[],soffit:[face.q]};
    const box=roofOwner(p,section);
    const sides=[q=>q[0]-box.x,q=>box.x+box.w-q[0],q=>q[2]-box.z,q=>box.z+box.d-q[2]];
    let inside=face.q;
    for(const side of sides)inside=cut(inside,side);
    if(Math.abs(polygonArea(inside))<eps)return {ceiling:[],soffit:[face.q]};
    return {ceiling:inside,soffit:subtract(face.q,sides)};
  }
  function ridgeHeight(s){
    return Math.max(...shapeData(s).host.flatMap(f=>f.q.map(q=>q[1])));
  }
  function ridgeEdges(s,panes){
    if(s.roof===3)return [];
    const high=ridgeHeight(s),segments=[];
    const equal=(a,b)=>a.every((n,i)=>Math.abs(n-b[i])<.001);
    // Work on visible surfaces. A valley or a clipping edge below the true
    // crest must never become a drag handle for this section.
    for(const face of panes){
      if(!face.roof||face.dormerId||face.sectionId!==s.id)continue;
      const highPoints=face.q.filter(q=>Math.abs(q[1]-high)<.001);
      if(!highPoints.length)continue;
      let a=highPoints[0],b=a,longest=0;
      for(const i of highPoints)for(const j of highPoints){
        const len=Math.hypot(i[0]-j[0],i[2]-j[2]);
        if(len>longest){longest=len;a=i;b=j;}
      }
      if(!segments.some(([c,d])=>equal(c,a)&&equal(d,b)||equal(c,b)&&equal(d,a)))segments.push([a,b]);
    }
    return segments;
  }
  function pitchForLift(s,delta){
    const rise=Math.max(...primitivePatches(s).flatMap(f=>f.q.map(q=>q[1])))-s.base,halfSpan=rise/Math.tan(s.pitch*Math.PI/180);
    return Math.round(clamp(Math.atan2(rise+delta,halfSpan)*180/Math.PI,...limits.pitch)*10)/10;
  }
  function crestName(s){return s.roof===2||s.roof===6?'Верх ската':s.roof===5?'Вершина':'Конёк';}
  function topAt(s,x,z){
    const heights=[];
    for(const part of sectionPatches(s)){
      const height=part.roof&&heightFn(part.q);
      if(height&&insideEdges(part.q).every(test=>test([x,0,z])>=-eps))heights.push(height(x,z));
    }
    return (heights.length?Math.max(...heights):s.base)-.10;
  }
  function columns(p){return sections(p).flatMap(s=>s.posts.map(post=>{
    const x=s.x+post.u*s.w,z=s.z+post.v*s.d;
    return {id:post.id,sectionId:s.id,x,z,size:post.size,top:topAt(s,x,z)};
  }))}

  function layout(p){
    const ss=sections(p),parts=p.extensions||[],x=Math.min(0,...ss.map(s=>s.x),...parts.map(e=>e.x)),z=Math.min(0,...ss.map(s=>s.z),...parts.map(e=>e.z));
    const right=Math.max(p.w,...ss.map(s=>s.x+s.w),...parts.map(e=>e.x+e.w)),front=Math.max(p.d,...ss.map(s=>s.z+s.d),...parts.map(e=>e.z+e.d));
    const scale=Math.min(695/(right-x),342/(front-z));
    return {scale,x:450-(x+right)*scale/2,z:265-(z+front)*scale/2};
  }
  function topDrawing(p,ctx,geometry){
    const g=geometry||layout(p),X=x=>g.x+x*g.scale,Z=z=>g.z+z*g.scale;
    const ss=sections(p),sel=ss.find(s=>s.id===ctx?.sectionId);
    const svgPoint=q=>X(q[0])+','+Z(q[2]);
    const text=(x,y,t,size=12,fill='#315572')=>'<text x="'+x+'" y="'+y+'" text-anchor="middle" fill="'+fill+'" font-size="'+size+'" pointer-events="none">'+esc(t)+'</text>';
    const rect=(x,z,w,d,attrs)=>'<rect x="'+X(x)+'" y="'+Z(z)+'" width="'+w*g.scale+'" height="'+d*g.scale+'" '+attrs+'/>';
    let out='';
    const fills=['#cfdfeb','#c2d9dc','#d9d5c8','#bdcddf'];
    for(const poly of faces(p).filter(r=>r.roof&&Math.abs(polygonArea(r.q))>eps)){
      const i=ss.findIndex(s=>s.id===poly.sectionId);
      const fill=poly.sectionId===sel?.id?'#b2dafa':fills[i%fills.length];
      out+='<polygon points="'+poly.q.map(svgPoint).join(' ')+'" data-section="'+esc(poly.sectionId)+'" fill="'+fill+'" stroke="#5f798e" stroke-linejoin="round" stroke-width="1.2"/>';
    }
    out+=rect(0,0,p.w,p.d,'fill="none" pointer-events="none" stroke="#182d41" stroke-width="2.8" stroke-dasharray="9 5"');
    for(const e of p.extensions||[])out+=rect(e.x,e.z,e.w,e.d,'fill="none" pointer-events="none" stroke="#182d41" stroke-width="2" stroke-dasharray="9 5"');
    for(const s of ss){
      if(s.parapet&&[2,3].includes(s.roof)){
        const t=s.parapet.thickness;
        out+=rect(s.x+t/2,s.z+t/2,s.w-t,s.d-t,'fill="none" pointer-events="none" stroke="#536878" stroke-width="'+t*g.scale+'"');
      }
      const sectionText=s.name+(ctx?'':' · '+m(s.w)+' × '+m(s.d));
      out+=text(X(s.x+s.w/2),Z(s.z+s.d*.39),sectionText,14);
      if(sel===s){
        const w=s.w*g.scale,d=s.d*g.scale,x=X(s.x),z=Z(s.z);
        out+=rect(s.x,s.z,s.w,s.d,'fill="none" stroke="#0878c1" stroke-width="2.2" pointer-events="none"');
        out+=text(x+w/2,z-17,'↔ '+m(s.w),15)+text(x+w+44,z+d/2,'↕ '+m(s.d),15);
        const grips=[['left',x,z+d/2],['right',x+w,z+d/2],['back',x+w/2,z],['front',x+w/2,z+d],['corner',x+w,z+d]];
        for(const [edge,cx,cy] of grips){
          const cursor=edge==='left'||edge==='right'?'ew-resize':edge==='corner'?'nwse-resize':'ns-resize';
          out+='<g data-grip="'+edge+'" style="cursor:'+cursor+'"><circle cx="'+cx+'" cy="'+cy+'" r="14" fill="transparent"/><rect x="'+(cx-5)+'" y="'+(cy-5)+'" width="10" height="10" rx="2" fill="white" stroke="#147bbb" stroke-width="2"/></g>';
        }
      }
    }
    for(const post of columns(p)){
      const x=X(post.x),y=Z(post.z);
      const active=post.id===ctx?.postId;
      out+='<g data-post="'+esc(post.id)+'" data-owner="'+esc(post.sectionId)+'" style="cursor:move"><title>Стойка · '+m(post.size)+' × '+m(post.size)+'</title><circle cx="'+x+'" cy="'+y+'" r="12" fill="transparent"/><rect x="'+(x-4.5)+'" y="'+(y-4.5)+'" width="9" height="9" fill="'+(active?'#ffb54d':'#705844')+'" stroke="#fff" stroke-width="1.5"/></g>';
    }
    if(ctx&&sel){
      const state=toolsFor(p,sel);
      for(const node of sel.liftPoints||[]){
        const [x,z]=RoofSculpt.xz(sel,node.u,node.v);
        out+='<circle data-node="'+esc(node.id)+'" data-section="'+esc(sel.id)+'" cx="'+X(x)+'" cy="'+Z(z)+'" r="6" fill="#e5a546" stroke="white" stroke-width="2"/>';
      }
      if(state.mode==='lift')for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
        const [x,z]=RoofSculpt.xz(sel,u,v);
        out+='<circle data-section="'+esc(sel.id)+'" cx="'+X(x)+'" cy="'+Z(z)+'" r="7" fill="#fff2cf" stroke="#a86f10" stroke-width="2"/>';
      }
    }
    if(ctx?.drag&&sel){
      const guide=(x,z,a,b,color='#1688c9')=>'<path d="M'+X(x)+' '+Z(z)+'L'+X(a)+' '+Z(b)+'" fill="none" stroke="'+color+'" stroke-width="1.3" stroke-dasharray="7 5"/>';
      const box=roofOwner(p,sel);
      const left=Math.min(box.x,sel.x)-.35,right=Math.max(box.x+box.w,sel.x+sel.w)+.35;
      const back=Math.min(box.z,sel.z)-.35,front=Math.max(box.z+box.d,sel.z+sel.d)+.35;
      out+='<g data-drag-guides="roof" pointer-events="none">';
      for(const x of [box.x,box.x+box.w])out+=guide(x,back,x,front,'#00896988');
      for(const z of [box.z,box.z+box.d])out+=guide(left,z,right,z,'#00896988');
      for(const x of [sel.x,sel.x+sel.w])out+=guide(x,back,x,front);
      for(const z of [sel.z,sel.z+sel.d])out+=guide(left,z,right,z);
      let caption='Кровля '+Math.round(sel.w*1000)+' × '+Math.round(sel.d*1000)+' мм · карниз '+Math.round(sel.base*1000)+' мм от пола';
      if(ctx.drag.action==='post'){
        const post=sel.posts.find(p=>p.id===ctx.postId);
        if(post){const x=sel.x+post.u*sel.w,z=sel.z+post.v*sel.d;out+=guide(x,back,x,front)+guide(left,z,right,z);caption='Стойка: X '+Math.round(x*1000)+' мм · Z '+Math.round(z*1000)+' мм';}
      }else if(ctx.drag.action==='lift'){
        const node=ctx.drag.node,[x,z]=RoofSculpt.xz(sel,node.u,node.v);out+=guide(x,back,x,front)+guide(left,z,right,z);
        caption='Точка кровли '+Math.round(positionHeight(sel,x,z)*1000)+' мм от пола · X '+Math.round(x*1000)+' · Z '+Math.round(z*1000)+' мм';
      }
      out+='<rect x="135" y="494" width="630" height="26" rx="7" fill="#f4fbff" stroke="#9bc7df"/>'+text(450,512,caption,13,'#07547d')+'</g>';
    }
    out+=text(450,27,'Задний фасад ↑',13)+text(450,487,'↓ Главный фасад',13);
    if(!ctx)out+=text(450,515,'Пунктир — контур стен     ■ — опорные стойки',13);
    return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="План кровли" font-family="Arial,sans-serif" viewBox="0 0 900 530" width="100%" height="100%">'+out+'</svg>';
  }
  function plan(p){return topDrawing(p,null);}
  function selectedSection(ctx){return sections(ctx.project).find(s=>s.id===ctx.sectionId)||sections(ctx.project)[0];}
  function save(ctx,next,selectedId){
    const msg=validate(next);
    if(msg){ctx.opts.onMessage?.(msg);return false;}
    for(const group of ctx.controls?.querySelectorAll('details')||[]){
      const title=group.querySelector('summary')?.textContent;
      if(group.open)expandedGroups.add(title);else expandedGroups.delete(title);
    }
    const previous=ctx.sectionId;
    if(selectedId!==undefined)ctx.sectionId=selectedId;
    if(selectedId!==undefined&&ctx.host)ctx.opts.onSelect?.(selectedId);
    if(ctx.opts.onCommit(next)===false){ctx.sectionId=previous;ctx.opts.onSelect?.(previous);return false;}
    ctx.project=next;
    if(selectedId!==undefined&&!ctx.host)ctx.opts.onSelect?.(selectedId);
    return true;
  }
  function patch(ctx,delta){return save(ctx,editSection(ctx.project,ctx.sectionId,delta));}
  function choose(ctx,sectionId){
    ctx.sectionId=sectionId;ctx.postId='';ctx.addPost=false;ctx.opts.onSelect?.(sectionId);
    repaint(ctx);
  }
  function element(tag,text){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function btn(label,action){
    const b=element('button',label);b.type='button';b.onclick=action;return b;
  }
  function picker(el,label,values,current,change){
    const wrap=element('label',label),select=element('select');
    select.setAttribute('aria-label',label);
    values.forEach(([key,name])=>select.add(new Option(name,key,false,key===current)));
    select.onchange=()=>change(select.value);wrap.append(select);el.append(wrap);
  }
  function num(el,label,value,lo,hi,step,change){
    const wrap=element('label',label),input=element('input');
    input.type='number';input.min=lo;input.max=hi;input.step=step;input.value=round(value);
    input.onchange=()=>{if(input.value!==''&&input.reportValidity())change(input.valueAsNumber);else input.value=round(value);};
    wrap.append(input);el.append(wrap);
  }
  function details(el,title){
    const d=element('details'),summary=element('summary',title);
    d.open=expandedGroups.has(title);d.append(summary);
    summary.addEventListener('click',()=>{
      if(d.open)expandedGroups.delete(title);else expandedGroups.add(title);
    });
    el.append(d);return d;
  }
  function colorsInput(el,label,key,ctx,defaultValue){
    const wrap=element('label',label),input=element('input');
    input.type='color';input.value=ctx.project[key]||defaultValue;input.style.height='34px';
    input.onchange=()=>save(ctx,{...clone(ctx.project),[key]:input.value});wrap.append(input);el.append(wrap);
  }
  function uniqueName(list,base,first=0){
    let number=first;
    while(true){
      const name=number?base+' '+number:base;
      if(!list.some(s=>s.name===name))return name;
      number=number?number+1:2;
    }
  }
  function copySection(source,list){
    const s=clone(source);
    s.id=id();s.name=uniqueName(list,source.name+' · копия');
    for(const parts of [s.posts,s.liftPoints,s.dormers,s.disabledDormers,s.terrace?.stairs]){
      for(const part of parts||[])part.id=id();
    }
    return s;
  }
  function changeSections(p,action,sectionId,point){
    const project=initialize(clone(p)),list=project.roofSections;
    const source=list.find(s=>s.id===sectionId);
    if(action==='delete'||action==='duplicate'){
      if(!source)return {error:'Выберите секцию крыши.'};
      if(action==='delete'){
        const index=list.indexOf(source);list.splice(index,1);
        return {project,sectionId:(list[index]||list[index-1])?.id||''};
      }
    }
    if(!['add','canopy','duplicate'].includes(action))return {error:'Неизвестное действие с крышей.'};
    if(list.length>=16)return {error:'В эскизе уже 16 секций крыши.'};
    if(point&&(!Number.isFinite(point.x)||!Number.isFinite(point.z)))return {error:'Укажите место для секции на модели.'};
    const houseRoof=list.find(s=>!s.canopy),main=source||houseRoof||legacy(project);
    const restoreMain=action==='add'&&!houseRoof;
    let s;
    if(action==='duplicate')s=copySection(source,list);
    else if(action==='canopy'){
      s=canopyAt(main,project);
      s.name=uniqueName(list,'Навес');
      if(point)turnCanopyToPoint(s,main,point);
    }else if(restoreMain){
      s=legacy(project);
      if(list.some(item=>item.id===s.id))s.id=id();
      s.name=uniqueName(list,s.name);
    }else{
      s={id:id(),name:uniqueName(list,'Секция',list.length+1),roof:0,ridge:1,
        w:round(Math.max(2,main.w*.48)),d:round(Math.max(2,main.d*.63)),
        x:round(main.x+main.w*.42),z:round(main.z+main.d*.63),base:main.base,pitch:30,posts:[],canopy:false};
    }
    if(action==='add'&&source?.extensionId){s.extensionId=source.extensionId;s.followExtension=true;}
    const sameFootprint=()=>list.some(item=>Math.abs(item.x-s.x)<.01&&Math.abs(item.z-s.z)<.01
      &&Math.abs(item.w-s.w)<.01&&Math.abs(item.d-s.d)<.01);
    // An explicit click locates the centre of the new section. For a copy the
    // default position is alongside its source, first trying the terrace's facade.
    const shifts=[[s.w+.12,0],[-s.w-.12,0],[0,s.d+.12],[0,-s.d-.12]];
    if(s.terrace?.side%2)shifts.push(...shifts.splice(0,2));
    const positions=point?[[point.x-s.w/2,point.z-s.d/2]]:[[s.x,s.z]];
    if(!point)for(let step=1;step<=list.length;step++){
      for(const [dx,dz] of shifts)positions.push([s.x+step*dx,s.z+step*dz]);
    }
    let error='';
    for(const [x,z] of positions){
      s.x=round(x);s.z=round(z);
      if(sameFootprint())continue;
      const index=restoreMain?0:list.length;
      list.splice(index,0,s);
      error=validate(project)||window.PentiiTerraces?.validate?.(project)||'';
      if(!error)return {project,sectionId:s.id};
      list.splice(index,1);
    }
    return {error:error||'В этом месте уже есть секция. Выберите свободное место для новой секции.'};
  }
  function changeFromInspector(ctx,action){
    const result=changeSections(ctx.project,action,ctx.sectionId);
    if(result.error){ctx.opts.onMessage?.(result.error);return;}
    ctx.addPost=false;ctx.postId='';save(ctx,result.project,result.sectionId);
  }
  function repaint(ctx){
    if(ctx.host&&ctx.surface?.isConnected)ctx.surface.innerHTML=topDrawing(ctx.project,ctx);
    inspector(ctx);
  }
  function shapeThumbnail(roof){
    const patches=legacyRoofFaces({w:4.8,d:3.6,n:1,h:1,e:.3,roof,ridge:0,pitch:roof===2?3:32});
    const project=([x,y,z])=>[37+7.8*x-6*z,28+2.7*x+3.3*z-9.5*y];
    const depth=part=>part.q.reduce((sum,[x,,z])=>sum+x*.68+z*.86,0)/part.q.length;
    const roofColors=['#477a9f','#75a3bd','#527f9c','#91b5c9'];
    const walls=[[[0,0,3.6],[4.8,0,3.6],[4.8,1,3.6],[0,1,3.6]],
                 [[4.8,0,0],[4.8,0,3.6],[4.8,1,3.6],[4.8,1,0]]];
    const polygon=(q,color)=>'<polygon points="'+q.map(project).join(' ')+'" fill="'+color+'" stroke="#365a70" stroke-width=".8" stroke-linejoin="round"/>';
    let body=walls.map(q=>polygon(q,'#e7edf0')).join('');
    patches.sort((a,b)=>depth(a)-depth(b)).forEach((part,i)=>{
      body+=polygon(part.q,part.roof?roofColors[i%4]:'#dae6ec');
    });
    return '<svg viewBox="6 0 78 55" width="78" height="48" aria-hidden="true">'+body+'</svg>';
  }
  function visualPicker(parent,ctx,s){
    const drawer=details(parent,'Выбрать форму по рисунку');
    const grid=element('div');
    grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:9px 0';
    for(let i=0;i<roofs.length;i++){
      const card=btn('',()=>patch(ctx,shapePatch(s,i)));card.type='button';
      card.setAttribute('aria-pressed',String(s.roof===i));
      card.setAttribute('aria-label','Форма: '+roofs[i]);
      card.style.cssText='display:flex;align-items:center;flex-direction:column;justify-content:center;gap:2px;padding:5px 2px;border-radius:8px;font-size:12px;min-height:72px';
      if(s.roof===i){card.style.background='#def1ff';card.style.borderColor='#3590c4';}
      card.innerHTML=shapeThumbnail(i);card.append(document.createTextNode(roofs[i]));grid.append(card);
    }
    const parapet=btn('Плоская с парапетом',()=>patch(ctx,shapePatch(s,'parapet')));
    parapet.setAttribute('aria-label','Форма: Плоская с парапетом');parapet.style.gridColumn='1 / -1';grid.append(parapet);
    drawer.append(grid);
  }
  function crossSection(p,s){
    // Cut through the centre, perpendicular to the direction of the ridge.
    const along=s.ridge?2:0,across=s.ridge?0:2;
    const station=s.ridge?s.z+s.d/2:s.x+s.w/2;
    const cutLine=poly=>{
      const hits=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],da=a[along]-station,db=b[along]-station;
        if(Math.abs(da)<eps)hits.push(a);
        if(da*db<0)hits.push(interpolate(a,b,da/(da-db)));
      }
      hits.sort((a,b)=>a[across]-b[across]);
      return hits.length>1&&hits.at(-1)[across]-hits[0][across]>eps?[hits[0],hits.at(-1)]:null;
    };
    const spans=faces(p).filter(f=>f.roof&&f.sectionId===s.id).map(f=>({roof:cutLine(f.q),ceiling:cutLine(lining(p,f,s).ceiling)}));
    const box=roofOwner(p,s),start=s.ridge?box.x:box.z,limit=start+(s.ridge?box.w:box.d),stationStart=s.ridge?box.z:box.x;
    const hasShell=!s.canopy&&station>=stationStart&&station<=stationStart+(s.ridge?box.d:box.w);
    const x0=(s.ridge?s.x:s.z),x1=x0+(s.ridge?s.w:s.d);
    const lo=hasShell?Math.min(start,x0):x0,hi=hasShell?Math.max(limit,x1):x1;
    const top=Math.max(overallHeight(s),hasShell?box.H:0);
    const scale=Math.min(228/(hi-lo),80/top);
    const X=x=>128+(x-(lo+hi)/2)*scale,Y=y=>96-y*scale;
    const path=(a,b,yOff,col,width)=>'<path d="M'+X(a[across])+','+Y(a[1]-yOff)+' L'+X(b[across])+','+Y(b[1]-yOff)+'" fill="none" stroke="'+col+'" stroke-width="'+width+'"/>';
    let art='<path d="M8 96h240" fill="none" stroke="#bfced7"/>';
    if(hasShell){
      art+='<path d="M'+X(start)+' 96V'+Y(box.H)+' M'+X(limit)+' 96V'+Y(box.H)+'" fill="none" stroke="#576f81" stroke-width="3"/>';
    }
    for(const span of spans){
      if(span.roof)art+=path(...span.roof,0,'#263e51',2.6);
      if(span.ceiling)art+=path(...span.ceiling,ceilingDepth,'#1789aa',1.8);
    }
    if(s.parapet&&[2,3].includes(s.roof)){
      const t=s.parapet.thickness,base=s.base-soffitDrop,top=overallHeight(s);
      for(const x of [x0,x1-t])art+='<rect x="'+X(x)+'" y="'+Y(top)+'" width="'+Math.max(1.5,t*scale)+'" height="'+(top-base)*scale+'" fill="#637782"/>';
    }
    return '<svg viewBox="0 0 256 106" role="img" aria-label="Поперечный разрез секции" style="width:100%;height:auto;display:block">'+art+'</svg>';
  }
  function refreshSection(p,s){
    const box=document.querySelector('[data-roof-profile]');
    if(!box||box.dataset.roofProfile!==s.id)return;
    const h=overallHeight(s);
    box.querySelector('strong').textContent=(s.parapet?'Верх парапета':s.roof===3?'Верх кровли':crestName(s))+' '+m(h)+(s.roof===3?'':' · '+s.pitch+'°');
    box.querySelector('[data-cross-section]').innerHTML=crossSection(p,s);
    const input=box.closest('#controls')?.querySelector('input[data-slope]');
    if(input&&input!==document.activeElement)input.value=s.pitch;
  }
  function activateTool(ctx,s,mode){
    const state=toolsFor(ctx.project,s);
    state.mode=state.mode===mode?'':mode;ctx.addPost=false;
    repaint(ctx);window.StudioVolume?.refreshGrips?.();
  }
  function dormerControls(ctx,s){
    const state=toolsFor(ctx.project,s),enabled=Boolean(s.dormers?.length);
    const el=element('div');el.className='dormerControls';
    const label=element('label');label.className='terr-check';
    const toggle=element('input');toggle.type='checkbox';toggle.checked=enabled;
    toggle.setAttribute('aria-label','Кукушка на крыше');
    label.append(toggle,document.createTextNode('Кукушка на крыше'));el.append(label);
    toggle.onchange=()=>{
      state.mode='';
      let delta;
      if(toggle.checked){
        const u=s.ridge ? .78 : .5,v=s.ridge ? .5 : .78;
        const restored=s.disabledDormers?.length?clone(s.disabledDormers):
          [RoofSculpt.dormerAt(s,s.x+s.w*u,s.z+s.d*v,shapeData(s))];
        state.dormer=restored[0].id;
        delta={dormers:restored,disabledDormers:[]};
      }else delta={dormers:[],disabledDormers:clone(s.dormers||[])};
      if(!patch(ctx,delta))toggle.checked=enabled;
    };
    if(enabled){
      const d=s.dormers.find(k=>k.id===state.dormer)||s.dormers.at(-1);state.dormer=d.id;
      const change=delta=>patch(ctx,{dormers:s.dormers.map(k=>k.id===d.id?{...k,...delta}:k)});
      if(s.dormers.length>1)picker(el,'Выбранная кукушка',s.dormers.map((v,i)=>[v.id,'Кукушка '+(i+1)]),d.id,v=>{state.dormer=v;repaint(ctx)});
      picker(el,'Форма кукушки',[['house','Домиком'],['triangle','Треугольная']],d.shape||'house',v=>change({shape:v}));
      const hint=element('p','Перетяните маркер «Кукушка» по крыше. Снимите галочку, чтобы убрать её.');hint.className='muted';el.append(hint);
      const box=details(el,'Размеры и расположение кукушки');
      if(state.mode==='dormer'||state.mode==='moveDormer')box.open=true;
      picker(box,'Куда выходит окно',[['0','Главный фасад'],['1','Правый фасад'],['2','Задний фасад'],['3','Левый фасад']],String(d.direction),v=>change({direction:+v}));
      const side=d.direction%2?s.d:s.w,deep=d.direction%2?s.w:s.d;
      num(box,'Ширина кукушки, м',Math.min(d.width,side*.9),.45,Math.min(8,side*.9),.01,v=>change({width:v}));
      num(box,'Глубина кукушки, м',Math.min(d.depth,deep*.9),.45,Math.min(8,deep*.9),.01,v=>change({depth:v}));
      num(box,d.shape==='triangle'?'Высота треугольника, м':'Высота стенки, м',d.rise,.5,4,.05,v=>change({rise:v}));
      if(d.shape!=='triangle')num(box,'Уклон кукушки, °',d.pitch,10,65,1,v=>change({pitch:v}));
      box.append(btn('Переставить кукушку',()=>activateTool(ctx,s,'moveDormer')),btn('+ Ещё кукушка',()=>activateTool(ctx,s,'dormer')));
      box.append(btn('Удалить выбранную кукушку',()=>{state.mode='';patch(ctx,{dormers:s.dormers.filter(k=>k.id!==d.id),disabledDormers:[]})}));
      if(state.mode==='dormer'||state.mode==='moveDormer'){
        const tip=element('p','Нажмите на нужное место ската.');tip.className='muted';box.append(tip);
        box.append(btn('Отменить размещение',()=>activateTool(ctx,s,state.mode)));
      }
    }
    ctx.controls.append(el);
  }
  function sculptControls(ctx,s){
    const state=toolsFor(ctx.project,s);
    const el=details(ctx.controls,'Свободная форма скатов');
    if(state.mode==='lift')el.open=true;
    const lift=btn(state.mode==='lift'?'Закончить изменение формы':'Поднять точку',()=>activateTool(ctx,s,'lift'));
    lift.classList.toggle('on',state.mode==='lift');lift.setAttribute('aria-pressed',state.mode==='lift');el.append(lift);
    if(state.mode==='lift'){
      const text=element('p','Тяните выбранное место ската или любой угол вверх и вниз.');
      text.className='muted';el.append(text);
    }
    if(s.liftPoints?.length){
      const box=details(el,'Точки ската ('+s.liftPoints.length+')');
      const point=s.liftPoints.find(k=>k.id===state.node)||s.liftPoints.at(-1);
      picker(box,'Точка',s.liftPoints.map((k,i)=>[k.id,'Точка '+(i+1)]),point.id,v=>{state.node=v;repaint(ctx)});
      num(box,'Подъём точки, м',point.lift,-6,6,.05,v=>patch(ctx,setLift(s,point,v)));
      box.append(btn('Убрать точку',()=>patch(ctx,{liftPoints:s.liftPoints.filter(k=>k.id!==point.id)})));
    }
  }
  function materialControls(ctx){
    const el=element('div');el.className='roofMaterialPicker';
    const selected=ctx.project.roofFinish||materialList[0][0];
    picker(el,'Кровельный материал',materialList.map(([key,label])=>[key,label]),selected,v=>save(ctx,{...clone(ctx.project),roofFinish:v}));
    const data=materialList.find(item=>item[0]===selected);
    const swatch=window.RoofFinishes?.swatch?.(selected);
    if(swatch){const image=element('img');image.src=swatch;image.alt='Фактура: '+materialLabel(selected);el.append(image);}
    const hint=element('p',data?.[2]||'');hint.className='muted';el.append(hint);
    ctx.controls.append(el);
  }
  function inspector(ctx){
    const el=ctx.controls;if(!el)return;el.replaceChildren();
    const s=selectedSection(ctx);
    ctx.sectionId=s?.id||'';
    el.append(element('h2','Конструкция кровли'));
    if(s)picker(el,'Часть крыши',sections(ctx.project).map(r=>[r.id,r.name]),s.id,v=>choose(ctx,v));
    const row=element('div');row.className='row';
    row.append(btn('+ Секция',()=>changeFromInspector(ctx,'add')),btn('+ Навес',()=>changeFromInspector(ctx,'canopy')));el.append(row);
    if(!s)return;
    const actions=element('div');actions.className='row';
    const removal=s.terrace?'Удалить террасу целиком':s.canopy?'Удалить навес':'Удалить секцию';
    actions.append(btn('Копировать секцию',()=>changeFromInspector(ctx,'duplicate')),btn(removal,()=>changeFromInspector(ctx,'delete')));el.append(actions);
    if(s.terrace&&ctx.opts.onTerrace)el.append(btn('Настил, вход и стойки террасы',()=>ctx.opts.onTerrace(s.id)));
    if(!ctx.host&&ctx.opts.onPlan)el.append(btn('Изменить контур и расставить стойки',()=>ctx.opts.onPlan(ctx.sectionId)));
    if(s.liftPoints?.length){
      const reset=btn('Вернуть ровные скаты',()=>{
        toolsFor(ctx.project,s).mode='';
        patch(ctx,{liftPoints:[]});
      });
      reset.className='wide';
      reset.title='Убрать локальные изгибы, сохранить секцию и слуховые окна. Действие можно отменить.';
      el.append(reset);
    }
    picker(el,'Форма',[...roofs.map((r,i)=>[String(i),r]),['parapet','Плоская с парапетом']],s.roof===3&&s.parapet?'parapet':String(s.roof),v=>patch(ctx,shapePatch(s,v)));
    if([2,3].includes(s.roof)){
      const wrap=element('label');wrap.style.cssText='display:flex;align-items:center;flex-direction:row;gap:8px';
      const check=element('input');check.type='checkbox';check.checked=!!s.parapet;check.style.width='auto';
      check.onchange=()=>patch(ctx,{parapet:check.checked?{height:.45,thickness:.18}:undefined});
      wrap.append(check,document.createTextNode('Парапет по периметру'));el.append(wrap);
      if(s.parapet)num(el,'Высота парапета, м',s.parapet.height,.15,1.5,.05,v=>patch(ctx,{parapet:{...s.parapet,height:v}}));
    }
    materialControls(ctx);
    visualPicker(el,ctx,s);
    dormerControls(ctx,s);
    picker(el,'Ориентация',[['0','Вдоль ширины'],['1','Вдоль глубины']],String(s.ridge),v=>patch(ctx,{ridge:+v}));
    if(!s.canopy&&(s.extensionId||s.id==='main'||(s.x<=0&&s.z<=0&&s.x+s.w>=ctx.project.w&&s.z+s.d>=ctx.project.d))){
      const eaves=btn('Свесы по 30 см',()=>{
        const box=roofOwner(ctx.project,s);
        const next=editSection(ctx.project,s.id,{x:round(box.x-.3),z:round(box.z-.3),w:round(box.w+.6),d:round(box.d+.6)});
        if(s.id==='main')next.e=.3;
        save(ctx,next);
      });
      eaves.className='wide';eaves.title='Подогнать контур выбранной крыши к коробке дома. Форма, уклон и высота сохраняются.';el.append(eaves);
    }
    if([2,7].includes(s.roof)){
      const reverse=btn(s.reverse?'Развернуть скат обратно':'Развернуть скат на 180°',()=>patch(ctx,{reverse:!s.reverse}));
      el.append(reverse);
    }
    const heightRow=element('div');heightRow.className='row';el.append(heightRow);
    num(heightRow,'Карниз от нуля дома, м',s.base,.4,30,.01,v=>patch(ctx,{base:v}));
    if(s.roof!==3){
      num(heightRow,'Уклон, °',s.pitch,2,65,.1,v=>patch(ctx,{pitch:v}));
      heightRow.querySelector('label:last-child input').dataset.slope='';
    }
    const profile=element('div');profile.dataset.roofProfile=s.id;
    profile.style.cssText='border:1px solid #cfdee8;border-radius:9px;padding:8px 10px;background:#f3f8fa;font-size:12px;margin:8px 0';
    const sectionFigure=element('div');sectionFigure.dataset.crossSection='';
    const caption=element('span',s.canopy?'Поперечный разрез навеса':'Разрез · голубая линия — потолок');
    caption.style.color='#456175';profile.append(element('strong'),sectionFigure,caption);el.append(profile);
    refreshSection(ctx.project,s);
    if(!ctx.host){
      const actionHelp={size:'Потяните голубой маркер края для изменения размера.',pitch:'Потяните конёк вверх или вниз. Оба ската изменятся вместе.',move:'Потяните скат, чтобы перенести всю секцию. Вертикальный маркер меняет высоту.'};
      const hint=element('p',actionHelp[ctx.opts.roofAction||'size']);hint.className='muted';el.append(hint);
    }
    sculptControls(ctx,s);
    const dim=details(el,'Размеры и смещение');
    const fields=[['x','Смещение по X, м'],['z','Смещение по Z, м'],['w','Ширина, м'],['d','Глубина, м']];
    for(const [field,title] of fields)num(dim,title,s[field],...limits[field],.01,v=>patch(ctx,{[field]:v}));
    if(ctx.host){
      const text=element('p',ctx.addPost?'Щёлкните в пределах выбранного ската.':'Потяните за край, чтобы изменить вынос, или за скат, чтобы передвинуть его целиком.');
      text.className='muted';el.append(text,btn(ctx.addPost?'Отменить установку':'＋ Стойка под крышей',()=>{toolsFor(ctx.project,s).mode='';ctx.addPost=!ctx.addPost;ctx.postId='';repaint(ctx);}));
      const post=s.posts.find(p=>p.id===ctx.postId);
      if(post){
        const field=element('div');
        num(field,'Сечение квадратной стойки, мм',post.size*1000,80,600,10,v=>patch(ctx,{posts:s.posts.map(j=>j.id===post.id?{...j,size:v/1000}:j)}));
        field.append(btn('Копировать стойку',()=>{
          const other={...post,id:id(),u:clamp(post.u+(post.u>.7?-.5:.5)/s.w,.01,.99),v:clamp(post.v+.15/s.d,.01,.99)};
          ctx.postId=other.id;patch(ctx,{posts:[...s.posts,other]});
        }));
        field.append(btn('Удалить стойку',()=>{ctx.postId='';patch(ctx,{posts:s.posts.filter(j=>j.id!==post.id)});}));
        el.append(field);
      }
    }
    const finishes=details(el,'Цвета, свесы и водостоки');
    colorsInput(finishes,'Цвет покрытия','top',ctx,'#465357');
    colorsInput(finishes,'Цвет лобовых планок','fasciaColor',ctx,ctx.project.top||'#465357');
    for(const [key,name,colorKey,defaultColor] of [['soffits','Подшивка свесов','soffitColor','#ded7c9'],['gutters','Водосточная система','gutterColor','#52626d']]){
      const wrap=element('label');wrap.style.cssText='display:flex;flex-direction:row;align-items:center;gap:8px';
      const input=element('input');input.type='checkbox';input.style.width='auto';input.checked=ctx.project[key]!==false;
      input.onchange=()=>save(ctx,{...clone(ctx.project),[key]:input.checked});wrap.append(input,document.createTextNode(name));finishes.append(wrap);
      if(input.checked)colorsInput(finishes,'Цвет — '+name.toLowerCase(),colorKey,ctx,defaultColor);
    }
    if(ctx.project.gutters!==false)window.RoofFinishes?.drainControls?.(finishes,ctx.project,next=>save(ctx,next));
  }
  function fromEvent(surface,e,g){
    const matrix=surface.querySelector('svg')?.getScreenCTM();
    if(!matrix)return null;
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
    return {x:(p.x-g.x)/g.scale,z:(p.y-g.z)/g.scale};
  }
  function dragPatch(ctx,now,withoutSnap=false){
    const {s,start,action}=ctx.drag,dx=snap(now.x-start.x),dz=snap(now.z-start.z);
    const p=ctx.project,tolerance=clamp(7/ctx.drag.g.scale,.025,.12);
    const boxes=[{x:0,z:0,w:p.w,d:p.d},...(p.extensions||[])];
    const xs=boxes.flatMap(b=>[b.x-.3,b.x,b.x+b.w,b.x+b.w+.3]),zs=boxes.flatMap(b=>[b.z-.3,b.z,b.z+b.d,b.z+b.d+.3]);
    for(const other of sections(p).filter(item=>item.id!==s.id)){xs.push(other.x,other.x+other.w);zs.push(other.z,other.z+other.d);}
    const nearby=(v,values)=>{
      if(withoutSnap)return v;
      const closest=values.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a,Infinity);
      return Math.abs(closest-v)<=tolerance?closest:v;
    };
    if(action==='post'){
      for(const other of s.posts.filter(item=>item.id!==ctx.postId)){xs.push(s.x+other.u*s.w);zs.push(s.z+other.v*s.d);}
      return {posts:s.posts.map(post=>post.id===ctx.postId?{...post,u:clamp((nearby(s.x+post.u*s.w+dx,xs)-s.x)/s.w,.01,.99),v:clamp((nearby(s.z+post.v*s.d+dz,zs)-s.z)/s.d,.01,.99)}:post)};
    }
    if(action==='move')return {x:round(clamp(nearby(snap(s.x+dx),xs.flatMap(x=>[x,x-s.w])),-60,60)),z:round(clamp(nearby(snap(s.z+dz),zs.flatMap(z=>[z,z-s.d])),-60,60))};
    let x=s.x,z=s.z,w=s.w,d=s.d;
    if(action==='left'){w=clamp(s.x+s.w-nearby(s.x+dx,xs),.6,65);x=s.x+s.w-w;}
    if(action==='back'){d=clamp(s.z+s.d-nearby(s.z+dz,zs),.6,65);z=s.z+s.d-d;}
    if(action==='right'||action==='corner')w=clamp(nearby(s.x+s.w+dx,xs)-s.x,.6,65);
    if(action==='front'||action==='corner')d=clamp(nearby(s.z+s.d+dz,zs)-s.z,.6,65);
    return {x:round(x),z:round(z),w:round(w),d:round(d)};
  }
  function draw(host,p,opts){
    const prior=sessions.get(host);
    const ctx={host,controls:opts.controls,project:p,opts,
      sectionId:opts.sectionId||(prior?.project.id===p.id&&prior.sectionId)||sections(p)[0]?.id||'',
      postId:prior?.project.id===p.id?prior.postId:'',addPost:prior?.project.id===p.id&&prior.addPost};
    const surface=element('div');
    surface.style.cssText='position:absolute;inset:0;touch-action:none;user-select:none';
    host.replaceChildren(surface);ctx.surface=surface;sessions.set(host,ctx);repaint(ctx);
    surface.onpointerdown=e=>{
      if(e.button!==0)return;
      const g=layout(p),pt=fromEvent(surface,e,g);
      if(!pt)return;
      const current=selectedSection(ctx);if(!current)return;
      const state=toolsFor(ctx.project,current);
      const clickedNode=e.target.closest('[data-node]')?.dataset.node;
      if(state.mode||clickedNode){
        const within=pt.x>=current.x-.12&&pt.x<=current.x+current.w+.12&&pt.z>=current.z-.12&&pt.z<=current.z+current.d+.12;
        if(!within){opts.onMessage?.('Выберите место внутри контура секции.');return}
        if(state.mode==='dormer'||state.mode==='moveDormer'){
          const delta=atLocation(current,pt.x,pt.z);state.mode='';patch(ctx,delta);return;
        }
        const node=current.liftPoints?.find(k=>k.id===clickedNode)||liftPoint(current,pt.x,pt.z);
        state.node=node.id;ctx.drag={action:'lift',node,s:clone(current),g,start:pt,screenY:e.clientY,pid:e.pointerId,moved:false};
        surface.setPointerCapture(e.pointerId);e.preventDefault();return;
      }
      if(ctx.addPost){
        const s=selectedSection(ctx);
        if(pt.x<s.x||pt.x>s.x+s.w||pt.z<s.z||pt.z>s.z+s.d){opts.onMessage?.('Поставьте стойку в пределах выбранной секции.');return;}
        const post={id:id(),u:clamp((pt.x-s.x)/s.w,.01,.99),v:clamp((pt.z-s.z)/s.d,.01,.99),size:.15};
        ctx.addPost=false;ctx.postId=post.id;patch(ctx,{posts:[...s.posts,post]});return;
      }
      const grip=e.target.closest('[data-grip]'),post=e.target.closest('[data-post]'),part=e.target.closest('[data-section]');
      if(!grip&&!post&&!part){ctx.postId='';repaint(ctx);return;}
      const sectionId=post?.dataset.owner||part?.dataset.section||ctx.sectionId;
      ctx.sectionId=sectionId;ctx.postId=post?.dataset.post||'';
      const s=selectedSection(ctx);
      ctx.drag={g,start:pt,s:clone(s),action:post?'post':grip?.dataset.grip||'move',pid:e.pointerId,moved:false};
      surface.setPointerCapture(e.pointerId);e.preventDefault();
      // Parent callbacks can repopulate the host. Notify selection after pointerup.
      surface.innerHTML=topDrawing(ctx.project,ctx,g);inspector(ctx);
    };
    surface.onpointermove=e=>{
      const drag=ctx.drag;if(!drag||e.pointerId!==drag.pid)return;
      const pt=fromEvent(surface,e,drag.g);if(!pt)return;
      if(Math.hypot(pt.x-drag.start.x,pt.z-drag.start.z)<.025&&!drag.moved)return;
      drag.moved=true;drag.patch=drag.action==='lift'?setLift(drag.s,drag.node,drag.node.lift+(drag.start.z-pt.z)):dragPatch(ctx,pt,e.altKey);
      const preview=editSection(ctx.project,ctx.sectionId,drag.patch);
      surface.innerHTML=topDrawing(preview,ctx,drag.g);if(drag.action==='lift')refreshSection(preview,sections(preview).find(s=>s.id===ctx.sectionId));
    };
    surface.onpointerup=e=>{
      if(!ctx.drag||e.pointerId!==ctx.drag.pid)return;
      const drag=ctx.drag;ctx.drag=null;
      if(drag.moved&&drag.patch)save(ctx,editSection(ctx.project,ctx.sectionId,drag.patch),ctx.sectionId);
      else if(drag.action==='lift'&&!drag.s.liftPoints?.some(n=>n.id===drag.node.id))patch(ctx,setLift(drag.s,drag.node,0));
      else{opts.onSelect?.(ctx.sectionId);repaint(ctx);}
    };
    surface.onpointercancel=()=>{ctx.drag=null;repaint(ctx);};
  }
  function drawControls(el,p,opts){
    const ctx={controls:el,project:p,opts,sectionId:opts.sectionId||sections(p)[0]?.id||''};
    inspector(ctx);
  }
  return {sections,initialize,sample,followHouse,parapetParts,overallHeight,shapeLabel,validate,editSection,changeSections,materialLabel,rawFaces,shapeData,trimFaces,positionHeight,toolsFor,actionFor,liftPoint,setLift,atLocation,faces,lining,soffitDrop,ceilingDepth,ridgeHeight,ridgeEdges,pitchForLift,crestName,refreshSection,crossSection,columns,plan,draw,drawControls};
})();

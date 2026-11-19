'use strict';
const faces=['Главный','Правый','Задний','Левый'];
const roofs=['Двускатная','Вальмовая','Односкатная','Плоская','Мансардная','Шатровая','Бабочка','Асимметричная'];
const kinds=['Окно','Витраж','Входная дверь','Балконная дверь'];
const fmt=n=>Number(n.toFixed(2)).toLocaleString('ru-RU');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wallLen=(p,f)=>f%2?p.d:p.w;
function xyz(p,f,u,y,v=0){return [[u,y,p.d+v],[p.w+v,y,p.d-u],[p.w-u,y,-v],[-v,y,u]][f]}
const rgb=(c,k)=>'#'+c.slice(1).match(/../g).map(a=>Math.min(255,Math.round(parseInt(a,16)*k)).toString(16).padStart(2,'0')).join('');
const defs='<defs><linearGradient id="glass" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#6f95aa"/><stop offset=".49" stop-color="#c4dfeb"/><stop offset=".53" stop-color="#b2cad0"/><stop offset="1" stop-color="#6c8b92"/></linearGradient><pattern id="wood" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6H6" stroke="#263e38" opacity=".18"/></pattern></defs>';
function svg(body){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 530" font-family="Arial,sans-serif">'+defs+body+'</svg>'}
function label(x,y,s,size=14){return '<text x="'+x+'" y="'+y+'" fill="#355347" font-size="'+size+'" text-anchor="middle">'+esc(s)+'</text>'}
function roofFaces(p){return RoofStudio.faces(p)}
function legacyRoofFaces(p){let W=p.ridge?p.d:p.w,D=p.ridge?p.w:p.d,H=p.h*p.n,e=p.e,r=p.roof===3?.16:Math.tan(p.pitch*Math.PI/180)*(D+2*e)*(p.roof===2?1:.5);
 const pt=(a,b,h)=>p.ridge?[b,H+h,a]:[a,H+h,b];
 const A=pt(-e,-e,0),B=pt(W+e,-e,0),C=pt(W+e,D+e,0),E=pt(-e,D+e,0),L=pt(-e,D/2,r),R=pt(W+e,D/2,r);
 const roof=(...q)=>({q,roof:true}),wall=(...q)=>({q,roof:false});
 if(p.roof===5){
   const peak=pt(W/2,D/2,r);
   return [roof(A,B,peak),roof(B,C,peak),roof(C,E,peak),roof(E,A,peak)];
 }
 if(p.roof===6){
   const a=pt(-e,-e,r),b=pt(W+e,-e,r),c=pt(W+e,D+e,r),d=pt(-e,D+e,r);
   const l=pt(-e,D/2,0),rr=pt(W+e,D/2,0);
   return [wall(A,B,b,a),wall(E,C,c,d),wall(A,l,a),wall(l,E,d),wall(B,rr,b),wall(rr,C,c),roof(a,b,rr,l),roof(l,rr,c,d)];
 }
 if(p.roof===7){
   const l=pt(-e,D*.32,r),rr=pt(W+e,D*.32,r);
   return [wall(A,E,l),wall(B,C,rr),roof(A,B,rr,l),roof(E,C,rr,l)];
 }
 if(p.roof===1){let m=Math.min(W*.42,D/2);let l=pt(m,D/2,r),r2=pt(W-m,D/2,r);return [roof(A,B,r2,l),roof(E,C,r2,l),roof(A,E,l),roof(B,C,r2)]}
 if(p.roof===3){const a=pt(-e,-e,r),b=pt(W+e,-e,r),c=pt(W+e,D+e,r),d=pt(-e,D+e,r);return [roof(A,B,b,a),roof(B,C,c,b),roof(C,E,d,c),roof(E,A,a,d),roof(a,b,c,d)]}
 if(p.roof===2){let ul=pt(-e,-e,r),ur=pt(W+e,-e,r);return [wall(A,B,ur,ul),wall(A,E,ul),wall(B,C,ur),roof(ul,ur,C,E)]}
 if(p.roof===4){let a=pt(-e,D*.2,r*.8),b=pt(W+e,D*.2,r*.8),c=pt(-e,D*.8,r*.8),d=pt(W+e,D*.8,r*.8);return [wall(A,a,L,c,E),wall(B,b,R,d,C),roof(A,B,b,a),roof(a,b,R,L),roof(L,R,d,c),roof(c,d,C,E)]}
 return [wall(A,E,L),wall(B,C,R),roof(A,B,R,L),roof(E,C,R,L)]}
function opening(p,o,proj){const y=o.floor*p.h+o.sill;const rect=(x,b,w,h)=>[[x,b],[x+w,b],[x+w,b+h],[x,b+h]].map(([u,v])=>proj(xyz(p,o.f,u,v)));
 const poly=(q,fill)=>'<polygon points="'+q.join(' ')+'" fill="'+fill+'" stroke="#394943" stroke-width="1"/>';
 let s=poly(rect(o.x,y,o.w,o.h),'#414f4c');let pad=Math.min(.075,o.w*.08,o.h*.08),count=o.k===2?1:Math.max(1,Math.ceil(o.w/(o.k===1?1.1:1.35)));
 for(let i=0;i<count;i++){let w=(o.w-2*pad)/count;s+=poly(rect(o.x+pad+i*w,y+pad,w-.025,o.h-2*pad),o.k===2?'#90745a':'url(#glass)')}
 if(o.k===2){
   s+=poly(rect(o.x+o.w*.77,y+o.h*.46,o.w*.13,.035),'#d5dbde');
   s+=poly(rect(o.x+.1,y+o.h*.60,Math.min(o.w*.46,.5),o.h*.30),'url(#glass)');
 }else if(o.sill>.05){
   s+=poly(rect(o.x-.035,y-.035,o.w+.07,.045),'#a4b2b7');
 }
 return '<g data-op="'+esc(o.id)+'">'+s+'</g>'}
function axon(p,angle=.58){let co=Math.cos(angle),si=Math.sin(angle);let depth=q=>q[0]*si+q[2]*co;
 let raw=q=>[q[0]*co-q[2]*si,depth(q)*.39-q[1]*.94];let H=p.h*p.n;
 let floor=[[-.8,-.12,-.8],[p.w+.8,-.12,-.8],[p.w+.8,-.12,p.d+.8],[-.8,-.12,p.d+.8]];
 let roof=roofFaces(p),bounds=[...floor,...roof.flatMap(a=>a.q)].map(raw);let xs=bounds.map(q=>q[0]),ys=bounds.map(q=>q[1]),min=Math.min(...xs),max=Math.max(...xs),lo=Math.min(...ys),hi=Math.max(...ys);
 let sc=Math.min(730/(max-min),398/(hi-lo));let P=q=>{let [x,y]=raw(q);return [450+(x-(min+max)/2)*sc,259+(y-(lo+hi)/2)*sc]};
 let poly=(pts,fill,stroke='#516256',sw=.8)=>'<polygon points="'+pts.map(P).join(' ')+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linejoin="round"/>';
 let s='<ellipse cx="450" cy="'+(275+(hi-lo)*sc/2)+'" rx="'+((max-min)*sc*.5)+'" ry="17" fill="#b9c1ae" opacity=".38"/>'+poly(floor,'#cfcdc0');
 for(let f=0;f<4;f++){let facing=[co,si,-co,-si][f];if(facing<=.0001)continue;let len=wallLen(p,f);
 let face=(y,h)=>[xyz(p,f,0,y),xyz(p,f,len,y),xyz(p,f,len,h),xyz(p,f,0,h)];
 s+=poly(face(0,H),rgb(p.wall,f===0||f===2?1:.85))+poly(face(0,.23),'#8d9186');
 if(!['Штукатурка','Короед'].includes(p.skin)){let step=p.skin==='Планкен'?.16:.30;for(let v=.3;v<H;v+=step){let a=P(xyz(p,f,0,v)),b=P(xyz(p,f,len,v));s+='<path d="M'+a+'L'+b+'" stroke="#594c40" stroke-width=".65" opacity=".42"/>'}}
 for(let o of p.ops.filter(o=>o.f===f))s+=opening(p,o,P)}
 const avg=q=>q.reduce((a,v)=>a+depth(v),0)/q.length;
 for(let r of roof.sort((a,b)=>avg(a.q)-avg(b.q))){let shade=.83+.15*(avg(r.q)-Math.min(...floor.map(depth)))/(Math.max(...floor.map(depth))-Math.min(...floor.map(depth)));s+=poly(r.q,r.roof?rgb(p.top,shade):p.wall);
 if(r.roof&&r.q.length===4){let [a,b,c,d]=r.q;let n=Math.min(45,Math.ceil(Math.hypot(a[0]-b[0],a[2]-b[2])/.45));let lerp=(u,v,t)=>u.map((e,i)=>e+(v[i]-e)*t);for(let i=1;i<n;i++)s+='<path d="M'+P(lerp(a,b,i/n))+'L'+P(lerp(d,c,i/n))+'" stroke="#fff" opacity=".14" fill="none"/>'}}
 return svg(s)}
// Side vegetation is shown at the position and size selected on the site plan.
function elevationTrees(p,f,x0,base,scale){
 let out='';
 const world=(u,n)=>u<0?u:u>1?n+u-1:u*n;
 for(const obj of p.yard||[]){
   if(!['tree','birch','spruce','pine','bush'].includes(obj.type))continue;
   const x=world(obj.u,p.w),z=world(obj.v,p.d),u=[x,p.d-z,p.w-x,z][f];
   const k=obj.w*scale/4,origin=x0+u*scale;
   const conifer=['pine','spruce'].includes(obj.type),shrub=obj.type==='bush';
   let branches='';
   function branch(a,b,length,angle,depth,seed){
     const c=a+length*Math.cos(angle),d=b+length*Math.sin(angle);
     branches+='<path d="M'+a+' '+b+'Q'+(a*.63+c*.37+.035)+' '+((b+d)/2)+' '+c+' '+d+'" stroke="#748681" stroke-width="'+(.014+depth*.011)+'" fill="none"/>';
     if(depth>0){
       branch(c,d,length*(.64+.04*Math.sin(seed)),angle-.43-.22*Math.sin(seed),depth-1,seed*1.7+3);
       branch(c,d,length*.71,angle+.39+.13*Math.cos(seed),depth-1,seed*2.1+7);
     }else{
       const color=['#9cb8a5','#b4cabb','#89ab9d'][Math.abs(Math.floor(seed))%3];
       branches+='<ellipse cx="'+c+'" cy="'+d+'" rx=".25" ry=".32" fill="'+color+'" opacity=".68"/>';
     }
   }
   if(conifer){branches='<path d="M0 0V-4.7" stroke="#72887e" stroke-width=".1"/>';for(let j=0;j<7;j++){const r=(1-j*.115)*1.32,y=-.65-j*.54;branches+='<path d="M0 '+(y-1.4)+'L'+r+' '+y+'Q0 '+(y+.37)+' '+(-r)+' '+y+'Z" fill="'+(j%2?'#96b5aa':'#819f93')+'"/>'}}
   else{for(let j=0;j<4;j++)branch(0,0,shrub?.32:1.4,-Math.PI/2+(j-1.5)*.24,5,j+2)}
   out+='<g transform="translate('+origin+' '+base+') scale('+k+')" opacity=".82" pointer-events="none">'+branches+'</g>';
 }
 return out;
}
function facade(p,f){
 const len=wallLen(p,f),height=p.h*p.n;
 const polys=roofFaces(p), cols=RoofStudio.columns(p);
 const structure=PentiiStructure.get(p);
 const ground=structure.groundY;
 const along=q=>[q[0],p.d-q[2],p.w-q[0],q[2]][f];
 const depth=q=>[q[2],q[0],-q[2],-q[0]][f];
 const vertices=polys.flatMap(face=>face.q);
 const left=Math.min(0,...vertices.map(along)),right=Math.max(len,...vertices.map(along));
 const top=Math.max(height,...vertices.map(q=>q[1]));
 const scale=Math.min(735/(right-left),357/(top-ground));
 const base=265+(top+ground)*scale/2-8;
 const x0=450-(left+right)*scale/2;
 const project=q=>[x0+along(q)*scale,base-q[1]*scale];
 const groundLine=base-ground*scale;
 const line=(x,y,x2,y2,color,w=1)=>'<path d="M'+x+','+y+'L'+x2+','+y2+'" fill="none" stroke="'+color+'" stroke-width="'+w+'"/>';
 const box=(x,y,w,h,color)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+color+'"/>';
 const wallTop=base-height*scale,wallWidth=len*scale;
 const plaster=['Короед','Штукатурка'].includes(p.skin);
 let wall='<rect x="'+x0+'" y="'+wallTop+'" width="'+wallWidth+'" height="'+height*scale+'" fill="'+p.wall+'" stroke="'+(plaster?'none':'#6f7674')+'"/>';
 if(p.skin==='Вертикальные рейки'){
   for(let x=.10;x<len;x+=.14)wall+=line(x0+x*scale,wallTop,x0+x*scale,base,'#776a574f',1.4);
 }else if(p.skin==='Кирпич'){
   for(let y=0,n=0;y<height;y+=.095,n++){
     const yy=base-y*scale;wall+=line(x0,yy,x0+wallWidth,yy,'#f1e7dc',.65);
     for(let x=n%2?.14:.28;x<len;x+=.28)wall+=line(x0+x*scale,yy,x0+x*scale,Math.max(wallTop,yy-.095*scale),'#e6ded4',.65);
   }
 }else if(!['Штукатурка','Короед'].includes(p.skin)){
   const spacing=p.skin==='Планкен'?.155:.36;
   for(let y=spacing;y<height;y+=spacing)wall+=line(x0,base-y*scale,x0+wallWidth,base-y*scale,'#72644d65',.9);
 }
 wall+=box(x0,base,wallWidth,groundLine-base,'#888a85');
 wall+=box(x0,base-.055*scale,wallWidth,.055*scale,'#78878d');
 for(const o of p.ops.filter(o=>o.f===f))wall+=opening(p,o,project);
 const layers=[{depth:depth(xyz(p,f,len/2,0)),markup:wall}];
 const sections=RoofStudio.sections(p);
 for(const part of polys){
   const pts=part.q.map(project),sec=sections.find(sec=>sec.id===part.sectionId);
   const col=p.top;
   let mesh='<polygon points="'+pts.join(' ')+'" fill="'+(part.detail==='glass'?'url(#glass)':part.detail==='frame'?'#414c53':part.roof?col:p.wall)+'" stroke="'+(part.roof?col:plaster?'none':'#75818a')+'" stroke-width="'+(part.roof?2.4:1)+'" stroke-linejoin="round"/>';
   if(part.roof&&pts.length===4){
     const [a,b,c,d]=pts;const lerp=(u,v,t)=>u.map((n,i)=>n+(v[i]-n)*t);
     const lines=Math.min(64,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/12));
     for(let i=1;i<lines;i++)mesh+=line(...lerp(a,b,i/lines),...lerp(d,c,i/lines),'#ffffff36',1);
   }
   layers.push({depth:part.q.reduce((n,q)=>n+depth(q),0)/part.q.length+.001,markup:mesh});
 }
 for(const col of cols){
   const xx=x0+along([col.x,0,col.z])*scale,w=col.size*scale,yy=base-col.top*scale;
   const mesh=box(xx-w/2,yy,w,groundLine-yy,'#aaa499')+box(xx+w*.12,yy,w*.38,groundLine-yy,'#777b74')+box(xx-w*.64,groundLine-.06*scale,w*1.28,.06*scale,'#545e68');
   layers.push({depth:depth([col.x,0,col.z])+.002,markup:mesh});
 }
 const back=elevationTrees(p,f,x0,groundLine,scale)+line(25,groundLine+1,875,groundLine+1,'#9bb0bf')+PentiiStructure.elevation(p,f,{x0,base,scale});
 const geometry={x0,base,scale};
 layers.push(...(window.PentiiTerraces?.svgElevationLayers?.(p,f,geometry)||[]),...(window.RoofFinishes?.elevationLayers?.(p,f,geometry)||[]));
 const shape=layers.sort((a,b)=>a.depth-b.depth).map(s=>s.markup).join('');
 return {html:svg(back+shape+label(450,groundLine+26,faces[f]+' фасад · коробка '+fmt(len)+' м')),x0,base,scale};
}
function plan(p,floor){let scale=Math.min(670/p.w,360/p.d),x=(900-p.w*scale)/2,y=(530-p.d*scale)/2;let P=(a,b)=>[x+a*scale,y+b*scale];let line=(a,b,c,d,color,width)=>'<path d="M'+P(a,b)+'L'+P(c,d)+'" fill="none" stroke="'+color+'" stroke-width="'+width+'"/>';
 let s='<rect x="'+x+'" y="'+y+'" width="'+p.w*scale+'" height="'+p.d*scale+'" fill="#f6faff" stroke="#2c4761" stroke-width="7"/>';
 for(let w of p.walls.filter(v=>v.floor===floor))s+=line(w.a,w.b,w.c,w.d,'#527794',4);
 for(const o of p.ops.filter(v=>v.floor===floor)){
   const a=xyz(p,o.f,o.x,0),b=xyz(p,o.f,o.x+o.w,0);
   s+=line(a[0],a[2],b[0],b[2],'#f6faff',8);
   if(o.k>=2){
     const swing=Math.min(o.w,1.2),hinge=xyz(p,o.f,o.x+swing,0),open=xyz(p,o.f,o.x,0,-swing);
     const radius=swing*scale;
     s+=line(a[0],a[2],open[0],open[2],'#536c7f',1.8)
       +'<path d="M'+P(hinge[0],hinge[2])+' A'+radius+' '+radius+' 0 0 0 '+P(open[0],open[2])+'" fill="none" stroke="#8b9eac" stroke-width="1"/>';
   }else{
     s+=line(a[0],a[2],b[0],b[2],'#5685a1',5)+line(a[0],a[2],b[0],b[2],'#e2f6fc',2);
   }
 }
 s+=window.Interior?.layer(p,floor,{x,y,scale})||'';
 return {html:svg(s+label(450,y-17,fmt(p.w)+' м')+label(x+p.w*scale+38,265,fmt(p.d)+' м')+label(450,y+p.d*scale+33,'Главный фасад')),x,y,scale}}


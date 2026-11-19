/* Site plan and its drafting symbols share dimensions and orientation with the exterior view. */
window.StudioYard = (() => {
  'use strict';
  const definitions = {
    'Растения': [
      ['tree','Лиственное дерево',3.4,3.4], ['birch','Берёза',2.8,2.8], ['pine','Сосна',3.2,3.2],
      ['spruce','Ель',2.4,2.4], ['bush','Кустарник',1.6,1.4], ['hedge','Живая изгородь',4,1],
      ['flowers','Смешанная клумба',2.4,1.1], ['roses','Розы',1.8,1], ['lavender','Лаванда',2,1], ['daisies','Ромашки',2,1], ['tulips','Тюльпаны',2,1]
    ],
    'Авто и парковка': [
      ['car','Автомобиль',1.9,4.4], ['parking','Парковка',3.2,5.4], ['canopy','Автонавес',3.8,5.8]
    ],
    'Двор и постройки': [
      ['path','Дорожка',1.2,4], ['paving','Брусчатка',3,3], ['terrace','Терраса',4,2.5],
      ['coveredTerrace','Крытая терраса',4,2.8], ['steps','Крыльцо',1.7,1.2], ['gazebo','Беседка',3.6,3.1],
      ['bbq','Мангальная зона',3.4,3.1], ['shed','Хозблок',3,2.4], ['bath','Баня',4,3], ['barrel','Баня-бочка',2.2,3.7]
    ],
    'Заборы': [
      ['railing','Ограждение террасы',3,.14], ['baluster','Балясины',2,.17],
      ['brick','Кирпичный забор',5,.36], ['picket','Штакетник',4,.18], ['profile','Профлист',5,.16],
      ['concrete','Еврозабор',4,.22], ['woodFence','Деревянный забор',4,.20], ['gate','Ворота',3.8,.2]
    ],
    'Вода и канализация': [
      ['pool','Бетонный бассейн',4.6,3.2], ['framePool','Каркасный бассейн',3.8,3.8], ['overflowPool','Переливной бассейн',5,3],
      ['septic','Биосептик',2.1,1.5], ['well','Колодец / кольца',1.3,1.3], ['drain','Линейный водоотвод',.35,3.4],
      ['sewer','Трасса канализации',4,.22]
    ]
  };
  const catalog = Object.fromEntries(Object.entries(definitions).flatMap(([group,items])=>items.map(([type,title,w,d])=>[type,{type,title,w,d,group}])));
  const fence = type => catalog[type]?.group==='Заборы';
  const flower = type => ['flowers','daisies','tulips','roses','lavender'].includes(type);
  const evergreen = type => ['pine','spruce'].includes(type);
  const tree = type => ['tree','birch','pine','spruce','bush','hedge'].includes(type);
  const water = type => ['pool','framePool','overflowPool'].includes(type);
  const paved = type => ['parking','path','paving','terrace','steps'].includes(type);
  const pipe = type => ['drain','sewer'].includes(type);
  const fixed = n => Math.round(n*100)/100;
  const metric = n => fixed(n).toLocaleString('ru-RU');
  const xesc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid = () => globalThis.crypto?.randomUUID?.() || 'site'+Math.random().toString(36).slice(2);
  // Inside the house's span, store a fraction. Outside the span, store distance from that edge.
  const encode = (v,span) => v<0?v:v>span?1+v-span:v/span;
  const decode = (u,span) => u<0?u:u>1?span+u-1:u*span;
  const position = (p,o) => ({x:decode(o.u,p.w),z:decode(o.v,p.d)});
  const anchored = (p,o,x,z) => ({...o,u:encode(x,p.w),v:encode(z,p.d)});
  function make(p,type,x,z,angle=0){
    const {w,d} = catalog[type];
    return anchored(p,{id:uuid(),type,w,d,angle},x,z);
  }
  function example(p){
    return [make(p,'parking',-3.1,p.d*.63),make(p,'car',-3.1,p.d*.63),
      make(p,'path',p.w*.52,p.d+2.15),make(p,'tree',-2.9,-2.1),
      make(p,'birch',p.w+2.5,-2.5),make(p,'lavender',p.w*.79,p.d+1.25)];
  }
  function plot(p){
    const measured=Number.isFinite(p.plotWidth)&&Number.isFinite(p.plotDepth);
    const width=measured?p.plotWidth:p.w+16,height=measured?p.plotDepth:p.d+16;
    return {width,height,measured,mx:(width-p.w)/2,mz:(height-p.d)/2};
  }
  function placementError(p,o){
    const spec = catalog[o.type];
    if(!spec || ![o.u,o.v,o.w,o.d,o.angle].every(Number.isFinite) || o.w<.1 || o.d<.1)return 'Некорректные размеры объекта.';
    const {x,z}=position(p,o),rad=o.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
    const hx=o.w/2,hz=o.d/2,wx=hx*Math.abs(c)+hz*Math.abs(s),wz=hx*Math.abs(s)+hz*Math.abs(c);
    const {mx,mz}=plot(p);
    if(x-wx< -mx-.001 || x+wx>p.w+mx+.001 || z-wz< -mz-.001 || z+wz>p.d+mz+.001)return 'Весь объект должен помещаться в границы участка.';
    const a=p.w/2,b=p.d/2,dx=x-a,dz=z-b,tol=.015;
    const collision=Math.abs(dx)<a+wx-tol && Math.abs(dz)<b+wz-tol &&
      Math.abs(dx*c+dz*s)<hx+Math.abs(c)*a+Math.abs(s)*b-tol &&
      Math.abs(-dx*s+dz*c)<hz+Math.abs(s)*a+Math.abs(c)*b-tol;
    return collision?'Объект пересекает дом. Выберите свободное место во дворе.':'';
  }
  function validate(p){
    const {width,height}=plot(p);
    if(width<p.w||height<p.d||width>200||height>200)return 'Границы должны вмещать дом. Максимальная сторона участка — 200 м.';
    for(const o of p.yard||[]){const error=placementError(p,o);if(error)return (catalog[o.type]?.title||'Объект')+'. '+error;}
    return '';
  }
  const colors={railing:'#a8bec8',baluster:'#bdac97',tree:'#5a9971',birch:'#94b678',pine:'#537e70',spruce:'#527e79',bush:'#80a674',hedge:'#6c9766',lavender:'#9a86c7',tulips:'#df706d',roses:'#cc7589',daisies:'#faf5d9',flowers:'#db997d',brick:'#ad7156',woodFence:'#b2936b',picket:'#bba380',profile:'#788ea0',concrete:'#b1b9bc',gate:'#667e8d'};
  // All symbols use local metres (x along width, y along depth).
  function symbol(o) {
    const {type,w,d}=o,ink='#526b70',half=w/2,depth=d/2;
    const rect=(x,y,a,b,fill,r=0,stroke=ink)=>'<rect x="'+x+'" y="'+y+'" width="'+a+'" height="'+b+'" rx="'+r+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width=".055"/>';
    const circle=(x,y,r,col)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+col+'" stroke="'+ink+'" stroke-width=".025"/>';
    const line=(x,y,a,b,col=ink,sw=.05)=>'<path d="M'+x+' '+y+'L'+a+' '+b+'" stroke="'+col+'" stroke-width="'+sw+'"/>';
    const box=(c,r=0)=>rect(-half,-depth,w,d,c,r);
    if(tree(type)){
      if(type==='hedge')return box('#719669',Math.min(.35,d/3))+Array.from({length:Math.ceil(w/.65)},(_,i)=>circle(-half+.3+i*.6,0,d*.38,'#92af80')).join('');
      const lobes=evergreen(type)?25:48;
      let points=[];for(let j=0;j<lobes;j++){const a=j*2*Math.PI/lobes,rr=evergreen(type)?(.68+.31*(j%2)):(.9+.075*Math.sin(a*8)+.035*Math.cos(a*5));
        points.push([Math.cos(a)*half*rr,Math.sin(a)*depth*rr].join(','))}
      const crown='<polygon points="'+points.join(' ')+'" fill="'+colors[type]+'" stroke="#557567" stroke-width=".06"/>';
      let veins='';for(let i=0;i<7;i++){const a=i*.8976+.22;veins+=line(0,0,Math.cos(a)*w*.31,Math.sin(a)*d*.30,'#d6e5bb',.045)}
      return crown+veins+circle(0,0,Math.min(w,d)*.048,'#697968');
    }
    if(flower(type)){let flowers=box('#9aae77',Math.min(w,d)*.23);for(let i=0;i<12;i++)flowers+=circle(((i%6+.5)/6-.5)*w,((Math.floor(i/6)+.42+(i%2)*.12)/2-.5)*d,Math.min(w/16,d/6),colors[type]);return flowers}
    if(type==='car'){let body=box('#eaf1f5',Math.min(w,d)*.20);body+=rect(-w*.40,-d*.25,w*.80,d*.43,'#657c8a',w*.09)+rect(-w*.37,-d*.12,w*.74,d*.19,'#adc2d1',w*.05);
      return body+line(-w*.33,d*.31,w*.33,d*.31,'#8fa5b4')+rect(-w*.41,d*.39,w*.16,d*.045,'#fcf4cc')+rect(w*.25,d*.39,w*.16,d*.045,'#fcf4cc')}
    if(fence(type)){let s=box(colors[type]);let n=Math.max(1,Math.ceil(w/2));for(let i=0;i<=n;i++)s+=rect(-half+(w-.12)*i/n,-depth,.12,d,'#455a64');return s}
    if(water(type)){let r=type==='framePool'?Math.min(half,depth):.16;return box('#d6e1e3',r)+rect(-half+w*.05,-depth+d*.07,w*.9,d*.86,'#82cbdc',Math.max(0,r-.12))+line(-w*.30,-d*.18,w*.3,-d*.18,'#c1edf3',.07)+line(0,-d*.1,w*.3,-d*.1,'#c1edf3',.06)}
    if(type==='well'||type==='septic'){let r=Math.min(w,d)*.29;return box('#9cb9a4',Math.min(w,d)*.30)+(type==='well'?circle(0,0,r,'#d9dbd3'):circle(-w*.23,0,r*.8,'#56846f')+circle(w*.23,0,r*.8,'#56846f'))}
    if(pipe(type))return box(type==='sewer'?'#b38b6a':'#70868e')+line(-w*.46,0,w*.46,0,'#fff',.03);
    if(type==='parking')return box('#c6ccce')+line(-w*.43,-d*.43,-w*.43,d*.43,'#fff',.09)+line(w*.43,-d*.43,w*.43,d*.43,'#fff',.09);
    if(paved(type)){let s=box(type==='terrace'?'#b89c76':'#d6d5ca');
      for(let n=1;n<Math.min(42,d/.30);n++)s+=line(-half,-depth+n*.30,half,-depth+n*.30,'#9eaba7',.035);return s}
    if(type==='barrel')return box('#c1a487',Math.min(half,depth)*.65)+line(-half,d*.28,half,d*.28)+line(-half,-d*.28,half,-d*.28);
    return box(type==='canopy'?'#a2b7c4':'#b3bec0')+line(-half,-depth,0,0)+line(half,-depth,0,0)+line(-half,depth,0,0)+line(half,depth,0,0);
  }
  function layer(type){return paved(type)||pipe(type)?0:type==='canopy'?2:1}
  function layout(p){
    const {width,height,mx,mz}=plot(p),parts=window.PentiiExtensions?.bounds(p);
    const minX=Math.min(-mx,parts?.minX??0),maxX=Math.max(p.w+mx,parts?.maxX??p.w);
    const minZ=Math.min(-mz,parts?.minZ??0),maxZ=Math.max(p.d+mz,parts?.maxZ??p.d);
    const scale=Math.min(798/(maxX-minX),422/(maxZ-minZ));
    const x=450-(minX+maxX)*scale/2,y=265-(minZ+maxZ)*scale/2;
    return {scale,left:x-mx*scale,top:y-mz*scale,x,y,width,height};
  }
  function extensionPlans(p,q){
    const s=q.scale,X=v=>q.x+v*s,Z=v=>q.y+v*s;
    return (window.PentiiExtensions?.list(p)||[]).slice().reverse().map(e=>{
      const x=X(e.x),z=Z(e.z),w=e.w*s,d=e.d*s,thick=(e.structure?.wallThickness||PentiiStructure.get(PentiiExtensions.model(p,e)).wallThickness)*s;
      const shape=(xx,yy,ww,hh,fill,stroke='#617e91',extra='')=>`<rect x="${xx}" y="${yy}" width="${ww}" height="${hh}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" ${extra}/>`;
      let body=shape(x,z,w,d,e.walls?'#cbd7df':'#d9dfcd');
      if(e.walls){
        body+=shape(x+thick,z+thick,Math.max(0,w-2*thick),Math.max(0,d-2*thick),'#f5f8fa');
        const local=PentiiExtensions.model(p,e),point=(face,u,v=0)=>{const a=xyz(local,face,u,0,v);return [X(e.x+a[0]),Z(e.z+a[2])];};
        const strip=(face,from,to)=>[point(face,from,.02),point(face,to,.02),point(face,to,-thick/s-.02),point(face,from,-thick/s-.02)].map(a=>a.join(',')).join(' ');
        for(const c of local._wallCuts)body+=`<polygon points="${strip(c.face,c.from,c.to)}" fill="#f5f8fa"/>`;
        for(const opening of e.ops.filter(o=>o.floor===0)){
          const a=point(opening.f,opening.x),b=point(opening.f,opening.x+opening.w);
          body+=`<polygon points="${strip(opening.f,opening.x,opening.x+opening.w)}" fill="white"/><path d="M${a.join(' ')}L${b.join(' ')}" stroke="${opening.k<2?'#168bc1':'#a07a51'}" stroke-width="2"/>`;
        }
        for(const a of e.partitions.filter(a=>a.floor===0))body+=`<path d="M${X(e.x+a.a)} ${Z(e.z+a.b)}L${X(e.x+a.c)} ${Z(e.z+a.d)}" stroke="#617e91" stroke-width="2"/>`;
      }
      const tag='ПР'+(PentiiExtensions.list(p).findIndex(a=>a.id===e.id)+1);
      body+=`<text x="${x+w/2}" y="${z+d/2-3}" text-anchor="middle" fill="#355b75" font-size="12" paint-order="stroke" stroke="white" stroke-width="3">${tag} · ${metric(e.w)} × ${metric(e.d)} м</text>`;
      body+=`<text x="${x+w/2}" y="${z+d/2+13}" text-anchor="middle" fill="#547084" font-size="10" paint-order="stroke" stroke="white" stroke-width="2">${e.walls?'Стены':'Пол на сваях'}</text>`;
      return `<g data-yard-extension="${xesc(e.id)}" pointer-events="none"><title>${xesc(e.name)}</title>${body}</g>`;
    }).join('');
  }
  function svgPlan(p,selectedId='',draft=null,editing=false,fixedLayout=null){
    const original=fixedLayout||layout(p),dim=plot(p),q={...original,width:dim.width,height:dim.height,left:original.x-dim.mx*original.scale,top:original.y-dim.mz*original.scale},s=q.scale,objects=(p.yard||[]).filter(o=>catalog[o.type]).map(o=>draft?.id===o.id?draft:o);
    const sorted=objects.slice().sort((a,b)=>layer(a.type)-layer(b.type));
    const drawObject=o=>{let {x,z}=position(p,o);const hit='<rect x="'+(-o.w/2)+'" y="'+(-o.d/2)+'" width="'+o.w+'" height="'+o.d+'" fill="transparent"/>';
      return '<g data-yard-id="'+xesc(o.id)+'" transform="translate('+(q.x+x*s)+' '+(q.y+z*s)+') rotate('+o.angle+') scale('+s+')" style="cursor:grab"><title>'+catalog[o.type].title+'</title>'+hit+symbol(o)+'</g>'};
    const x=q.x,y=q.y,w=p.w*s,d=p.d*s;
    const title=(xx,yy,text,size=13)=>'<text x="'+xx+'" y="'+yy+'" text-anchor="middle" fill="#355b75" font-family="Arial, sans-serif" font-size="'+size+'">'+text+'</text>';
    let drawing='<rect x="'+q.left+'" y="'+q.top+'" width="'+q.width*s+'" height="'+q.height*s+'" rx="4" fill="#e6eee0" stroke="#91a895" stroke-dasharray="7 4"/>';
    drawing+=extensionPlans(p,q);
    drawing+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+d+'" fill="#a9bac6" stroke="#617e91" stroke-width="2"/>'+('<path d="M'+x+' '+y+'L'+(x+w/2)+' '+(y+d*.47)+'L'+(x+w)+' '+y+'" fill="none" stroke="#839bab"/>')+title(x+w/2,y+d*.55,'Дом · '+metric(p.w)+' × '+metric(p.d)+' м');
    const hasExtensions=window.PentiiExtensions?.list(p).length>0;
    drawing+=title(hasExtensions?450:q.left+q.width*s/2,hasExtensions?25:q.top-14,metric(q.width)+' × '+metric(q.height)+' м')+title(hasExtensions?450:q.left+q.width*s/2,hasExtensions?515:q.top+q.height*s+25,dim.measured?'Участок · '+metric(q.width*q.height)+' м²':'Условные границы · размеры участка не заданы');
    if(editing){
      const hx=q.left+q.width*s,hy=q.top+q.height*s;
      drawing+='<g data-yard-plot="resize" style="cursor:nwse-resize"><title>Изменить границы участка</title><circle cx="'+hx+'" cy="'+hy+'" r="12" fill="transparent"/><rect x="'+(hx-5)+'" y="'+(hy-5)+'" width="10" height="10" rx="2" fill="#fff" stroke="#087dc0" stroke-width="2"/></g>';
    }
    const selected=objects.find(o=>o.id===selectedId);
    drawing+='<g pointer-events="none">'+(window.PentiiTerraces?.overlay(p,q)||'')+'</g>';
    drawing+=sorted.map(drawObject).join('');
    if(selected){const o=selected,{x,z}=position(p,o),xx=q.x+x*s,yy=q.y+z*s,hw=o.w*s/2,hd=o.d*s/2;
      drawing+='<g transform="translate('+xx+' '+yy+') rotate('+o.angle+')"><rect pointer-events="none" x="'+(-hw-1)+'" y="'+(-hd-1)+'" width="'+(hw*2+2)+'" height="'+(hd*2+2)+'" fill="none" stroke="#087dc0" stroke-width="2"/>';
      const handle=(kind,cx,cy)=>'<g data-yard-handle="'+kind+'" style="cursor:'+(kind==='rotate'?'crosshair':'nwse-resize')+'"><circle cx="'+cx+'" cy="'+cy+'" r="12" fill="transparent"/><circle cx="'+cx+'" cy="'+cy+'" r="5" fill="white" stroke="#087dc0" stroke-width="2"/></g>';
      drawing+='<path d="M0 '+(-hd)+'v-19" stroke="#087dc0"/>'+handle('rotate',0,-hd-19)+handle('size',hw,hd)+'</g>';
      drawing+=title(xx,Math.max(17,yy-Math.hypot(hw,hd)-26),xesc(catalog[o.type].title)+' · '+metric(o.w)+' × '+metric(o.d)+' м');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 530" role="img" aria-label="Схема участка" style="width:100%;height:100%;touch-action:none">'+drawing+'</svg>';
  }
  function mount({project:p,scene,controls,onBeforeChange=()=>{},onChange=()=>{},onHint=()=>{}}){
    let group=Object.keys(definitions)[0],chosen='',selected='',drag=null;
    const drawing=document.createElement('div');
    drawing.style.cssText='width:100%;height:100%;position:absolute;inset:0;touch-action:none';
    drawing.tabIndex=0;
    scene.replaceChildren(drawing);
    const current=()=> (p.yard||[]).find(o=>o.id===selected);
    const renderScene=(draft=null)=>{drawing.innerHTML=svgPlan(p,selected,draft,true)};
    const hint=()=>chosen?'Укажите место для объекта «'+catalog[chosen].title+'».':selected?'Тяните объект, круг над ним — для поворота, угловую точку — для размера.':'Выберите объект в каталоге и укажите его место на участке.';
    const emptyMessage=(message)=>{onHint(message);const note=controls.querySelector('[data-site-note]');if(note)note.textContent=message};
    function renderTools(){
      const picked=current();
      let html='<h2>Объекты участка</h2><div aria-label="Разделы каталога" style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 12px">';
      for(const name of Object.keys(definitions))html+='<button type="button" data-site-group="'+name+'" aria-pressed="'+(name===group)+'" class="'+(name===group?'on':'')+'" style="font-size:.8rem;padding:5px 8px">'+name+'</button>';
      html+='</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:6px">';
      for(const [type,title,w,d] of definitions[group]){
        const size=Math.max(w,d)*1.12;
        const icon='<svg viewBox="'+[-size/2,-size/2,size,size].join(' ')+'" width="35" height="35" aria-hidden="true">'+symbol({type,w,d})+'</svg>';
        html+='<button type="button" aria-pressed="'+(chosen===type)+'" class="'+(chosen===type?'on':'')+'" data-choice="'+type+'" style="display:flex;align-items:center;gap:4px;text-align:left;line-height:1.12;font-size:.78rem;padding:4px 5px">'+icon+title+'</button>';
      }
      html+='</div>';
      if(picked)html+='<div class="block"><strong>'+catalog[picked.type].title+'</strong><div>'+metric(picked.w)+' × '+metric(picked.d)+' м · '+Math.round(picked.angle)+'°</div><button data-turn>Повернуть на 90°</button> <button data-erase>Удалить</button></div>';
      const dim=plot(p);
      html+='<details><summary>'+ (dim.measured?'Размеры участка':'Задать границы участка')+'</summary><form data-plot-form><div class="row"><label>Ширина участка, м<input name="width" type="number" min="'+p.w+'" max="200" step="any" required value="'+dim.width+'"></label><label>Глубина участка, м<input name="depth" type="number" min="'+p.d+'" max="200" step="any" required value="'+dim.height+'"></label></div><button>Применить границы</button></form></details>';
      html+='<p data-site-note role="status" class="muted"></p>';controls.innerHTML=html;emptyMessage(hint());
      controls.querySelector('[data-plot-form]').onsubmit=e=>{e.preventDefault();const form=e.target;savePlot({plotWidth:form.elements.width.valueAsNumber,plotDepth:form.elements.depth.valueAsNumber})};
      controls.querySelectorAll('[data-site-group]').forEach(b=>b.onclick=()=>{group=b.dataset.siteGroup;chosen='';renderTools()});
      controls.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{chosen=chosen===b.dataset.choice?'':b.dataset.choice;selected='';renderScene();renderTools()});
      if(picked){controls.querySelector('[data-turn]').onclick=()=>save({...picked,angle:(picked.angle+90)%360});controls.querySelector('[data-erase]').onclick=erase}
    }
    function savePlot(dimensions){
      if(!Number.isFinite(dimensions.plotWidth)||!Number.isFinite(dimensions.plotDepth))return;
      const error=validate({...p,...dimensions});
      if(error){renderScene();emptyMessage(error);return}
      onBeforeChange();Object.assign(p,dimensions);onChange();renderScene();renderTools();
    }
    function resizedPlot(pt){
      const dim=plot(p);
      return {plotWidth:Math.max(.5,fixed(dim.width+2*(pt.x-drag.start.x))),plotDepth:Math.max(.5,fixed(dim.height+2*(pt.z-drag.start.z)))};
    }
    function save(o){
      const message=placementError(p,o);
      if(message){renderScene();emptyMessage(message);return false}
      onBeforeChange();if(!p.yard)p.yard=[];const at=p.yard.findIndex(e=>e.id===o.id);if(at<0)p.yard.push(o);else p.yard[at]=o;
      selected=o.id;chosen='';onChange();renderScene();renderTools();return true;
    }
    function erase(){if(!current())return;onBeforeChange();p.yard=p.yard.filter(o=>o.id!==selected);selected='';onChange();renderScene();renderTools()}
    function ground(e){const svg=drawing.firstElementChild,pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()),q=layout(p);return {x:(pt.x-q.x)/q.scale,z:(pt.y-q.y)/q.scale}}
    function adjust(at){
      let {o,kind,start}=drag,{x,z}=position(p,o),dx=at.x-x,dz=at.z-z;
      if(kind==='move')return anchored(p,o,fixed(x+at.x-start.x),fixed(z+at.z-start.z));
      if(kind==='rotate')return {...o,angle:(Math.round((Math.atan2(dx,-dz)*180/Math.PI)/5)*5+360)%360};
      const a=o.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
      return {...o,w:Math.max(.15,fixed(2*(dx*c+dz*s))),d:Math.max(.15,fixed(2*(-dx*s+dz*c)))};
    }
    drawing.onpointerdown=e=>{
      if(e.button!==0)return;e.stopPropagation();const pt=ground(e);drawing.focus({preventScroll:true});
      const handle=e.target.closest('[data-yard-handle]'),id=e.target.closest('[data-yard-id]')?.dataset.yardId;
      if(e.target.closest('[data-yard-plot]')){drag={kind:'plot',start:pt};chosen='';selected='';drawing.setPointerCapture(e.pointerId);e.preventDefault();return}
      if(chosen){save(make(p,chosen,pt.x,pt.z));return}
      if(!id&&!handle){selected='';renderScene();renderTools();return}
      if(!handle)selected=id;const o=current();if(!o)return;drag={kind:handle?.dataset.yardHandle||'move',start:pt,o};
      drawing.setPointerCapture(e.pointerId);renderScene();renderTools();e.preventDefault();
    };
    drawing.onpointermove=e=>{if(!drag)return;e.stopPropagation();
      if(drag.kind==='plot'){const preview={...p,...resizedPlot(ground(e))};drawing.innerHTML=svgPlan(preview,'',null,true,layout(p));emptyMessage(validate(preview)||'Участок · '+metric(preview.plotWidth)+' × '+metric(preview.plotDepth)+' м');return}
      const o=adjust(ground(e));renderScene(o);emptyMessage(placementError(p,o)||catalog[o.type].title+' · '+metric(o.w)+' × '+metric(o.d)+' м · '+Math.round(o.angle)+'°')};
    drawing.onpointerup=e=>{if(!drag)return;e.stopPropagation();const end=ground(e),start=drag.start,changed=Math.hypot(end.x-start.x,end.z-start.z)>.025;if(drag.kind==='plot'){const dimensions=resizedPlot(end);drag=null;if(changed)savePlot(dimensions);else renderScene();return}
      const o=adjust(end);drag=null;if(changed)save(o);else renderScene()};
    drawing.onpointercancel=()=>{drag=null;renderScene();emptyMessage(hint())};
    drawing.onkeydown=e=>{if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();erase()}if(e.key==='Escape'){chosen='';selected='';drag=null;renderScene();renderTools()}};
    drawing.oncontextmenu=e=>{e.preventDefault();const id=e.target.closest('[data-yard-id]')?.dataset.yardId;if(id){selected=id;chosen='';renderScene();renderTools()}};
    renderScene();renderTools();
  }

  // Static details are merged by material. Hundreds of tread blocks, trim strips
  // and tiles can therefore be inspected close up without hundreds of draw calls.
  function detailBatch(T,parent,materials,prefix){
    const batches=new Map(),transform=new T.Object3D();
    function add(geometry,key,at=[0,0,0],rotate=[0,0,0],scale=[1,1,1],tileUV=false){
      transform.position.set(...at);transform.rotation.set(...rotate);transform.scale.set(...scale);transform.updateMatrix();
      geometry.applyMatrix4(transform.matrix);
      const source=geometry.index?geometry.toNonIndexed():geometry;
      if(source!==geometry)geometry.dispose();
      const list=batches.get(key)||[];
      const a=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv;
      const pos=Array.from(a.array),norm=n?Array.from(n.array):[],tex=[];
      for(let i=0;i<a.count;i++){
        if(tileUV){
          const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
          tex.push((ny>.5||nx<.5?a.getX(i):a.getZ(i))/2.56,(ny>.5?a.getZ(i):a.getY(i))/2.56);
        }else tex.push(uv?.getX(i)||0,uv?.getY(i)||0);
      }
      list.push({pos,norm,tex});batches.set(key,list);source.dispose();
    }
    const box=(w,h,d,key,x=0,y=0,z=0,rotation=[0,0,0])=>add(new T.BoxGeometry(w,h,d),key,[x,y,z],rotation,[1,1,1],key==='tile');
    function poly(points,key){
      const positions=[];for(let i=1;i<points.length-1;i++)positions.push(...points[0],...points[i],...points[i+1]);
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();add(geo,key);
    }
    function tube(points,radius,key,segments=32){
      const curve=new T.CatmullRomCurve3(points.map(q=>new T.Vector3(...q)));add(new T.TubeGeometry(curve,segments,radius,6,false),key);
    }
    function finish(){
      for(const [key,chunks] of batches){
        const geo=new T.BufferGeometry(),pos=[],norm=[],uv=[];
        for(const chunk of chunks){pos.push(...chunk.pos);norm.push(...chunk.norm);uv.push(...chunk.tex)}
        geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
        const mesh=new T.Mesh(geo,materials[key]);mesh.name=prefix+' · '+key;
        mesh.castShadow=!['glass','water','caustics'].includes(key);mesh.receiveShadow=key!=='water';
        mesh.userData.ownedTexture=materials[key].map||materials[key].normalMap;parent.add(mesh);
      }
      for(const [key,material] of Object.entries(materials))if(!batches.has(key))material.dispose();
    }
    return {add,box,poly,tube,finish};
  }
  function detailedCar(T,group,w,d,hScale){
    const physical=(color,opts={})=>new T.MeshPhysicalMaterial({color,roughness:.48,side:T.DoubleSide,...opts});
    const materials={
      paint:physical('#587580',{metalness:.62,roughness:.26,clearcoat:1,clearcoatRoughness:.15}),
      rubber:physical('#202426',{roughness:.94}),trim:physical('#242c30',{roughness:.54}),
      chrome:physical('#bac5c9',{metalness:.94,roughness:.22}),interior:physical('#363b3a',{roughness:.94}),
      seat:physical('#30383b',{roughness:.91}),glass:physical('#223c45',{metalness:.24,roughness:.14,transparent:true,opacity:.76,depthWrite:false,clearcoat:1,envMapIntensity:1.05}),
      light:physical('#e0edf0',{metalness:.25,roughness:.16}),led:physical('#e8f1e8',{emissive:'#c3dbdf',emissiveIntensity:.4,roughness:.22}),
      rear:physical('#8c1921',{roughness:.22,clearcoat:1}),redLed:physical('#e4403d',{emissive:'#a52b22',emissiveIntensity:.28}),
      plate:physical('#e2e4dd',{roughness:.43}),badge:physical('#354850',{metalness:.7,roughness:.27})
    };
    const B=detailBatch(T,group,materials,'Автомобиль'),{add,box,poly,tube}=B;
    function roundedBox(w,h,d,r,key,x,y,z){
      const geo=new T.BoxGeometry(w,h,d,32,16,6),pos=geo.attributes.position,norm=geo.attributes.normal;
      for(let i=0;i<pos.count;i++){
        const px=pos.getX(i),py=pos.getY(i),pz=pos.getZ(i);
        const cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));
        const nx=px-cx,ny=py-cy,nz=pz-cz,len=Math.hypot(nx,ny,nz);
        pos.setXYZ(i,cx+nx/len*r,cy+ny/len*r,cz+nz/len*r);norm.setXYZ(i,nx/len,ny/len,nz/len);
      }
      add(geo,key,[x,y,z]);
    }
    // A lofted upper body and cut-out wheel arches replace the old box shell.
    const rings=[[-2.18,.73,.81],[-2.05,.86,.97],[-1.75,.92,1.055],[-1.12,.94,1.09],[.45,.94,1.09],[1.18,.92,1.055],[1.91,.88,.99],[2.16,.80,.98]];
    function bodyHalf(z){
      if(z<=rings[0][0])return rings[0][1];
      for(let i=1;i<rings.length;i++)if(z<=rings[i][0]){const a=rings[i-1],b=rings[i],t=(z-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t}
      return rings.at(-1)[1];
    }
    function loft(values,key){
      const N=20,vertices=[],indices=[];
      for(const [z,half,y] of values)for(let j=0;j<=N;j++){const a=(j/N-.5)*2;vertices.push(a*half,y+.045*(1-a*a),z)}
      for(let i=0;i<values.length-1;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;indices.push(a,b,a+1,a+1,b,b+1)}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();add(geo,key);
    }
    loft(rings.filter(q=>q[0]<=-1.12),'paint');loft(rings.filter(q=>q[0]>=.45),'paint');
    box(1.65,.12,3.75,'trim',0,.37,0);box(1.60,.10,2.5,'interior',0,.73,-.15);
    const wheelZ=[-1.36,1.36],wheelY=.35,archR=.405;
    for(const side of [-1,1]){
      const shape=new T.Shape();shape.moveTo(-2.16,.46);shape.lineTo(-2.18,.81);
      for(const [z,half,y] of rings)shape.lineTo(z,y);
      shape.lineTo(2.16,.46);
      for(const cz of [1.36,-1.36]){
        const start=Math.asin((.46-wheelY)/archR),edge=archR*Math.cos(start);
        shape.lineTo(cz+edge,.46);
        for(let i=0;i<=24;i++){const a=start+(Math.PI-2*start)*i/24;shape.lineTo(cz+archR*Math.cos(a),wheelY+archR*Math.sin(a))}
      }
      shape.lineTo(-2.16,.46);shape.closePath();
      const panel=new T.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:true,bevelSegments:3,bevelSize:.018,bevelThickness:.012,curveSegments:24});
      // The fender follows the narrowing nose and tail rather than leaving a
      // flat slab protruding beyond the hood. Bevels catch light along its edge.
      const pos=panel.attributes.position;
      for(let i=0;i<pos.count;i++){const z=pos.getX(i),y=pos.getY(i),depth=pos.getZ(i);pos.setXYZ(i,side*(bodyHalf(z)+depth-.015),y,z)}
      panel.computeVertexNormals();add(panel,'paint');
      for(const z of wheelZ){
        const points=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24,zz=z+archR*Math.cos(a);points.push([side*(bodyHalf(zz)+.021),wheelY+archR*Math.sin(a),zz])}
        tube(points,.034,'trim');
      }
      tube([[side*.95,.48,-.91],[side*.95,.45,0],[side*.95,.48,.91]],.026,'trim');
      // Door breaks, flush handles and upper beltline.
      for(const z of [-1.03,.05,.84])tube([[side*.952,.52,z],[side*.952,.82,z-.01],[side*.924,1.06,z-.03]],.0045,'trim',8);
      for(const z of [-.73,.48]){box(.025,.034,.17,'chrome',side*.962,.985,z);box(.03,.018,.045,'trim',side*.967,.975,z+.04)}
      tube([[side*.90,1.075,1.0],[side*.915,1.10,-.8],[side*.86,1.06,-1.50]],.011,'chrome');
    }
    // The cabin is hollow, with glazing at the correct rake and visible seats.
    loft([[-1.01,.69,1.59],[-.78,.73,1.645],[-.1,.73,1.65],[.25,.695,1.59]],'paint');
    function curvedGlass(topZ,topY,topW,bottomZ,bottomY,bottomW){
      const rows=8,cols=18,position=[],indices=[];
      for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
        const v=row/rows,u=col/cols*2-1,half=topW+(bottomW-topW)*v;
        position.push(u*half,topY+(bottomY-topY)*v+.014*(1-u*u),topZ+(bottomZ-topZ)*v+.025*(1-u*u));
      }
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,a+1,b,b,a+1,b+1)}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(position,3));geo.setIndex(indices);geo.computeVertexNormals();add(geo,'glass');
    }
    curvedGlass(.25,1.58,.68,.92,1.08,.84);curvedGlass(-1.02,1.58,.68,-1.65,1.07,.84);
    for(const z of [.25,-1.02]){
      const seam=[];for(let i=0;i<=16;i++){const u=i/8-1;seam.push([u*.685,1.594+.021*(1-u*u),z])}tube(seam,.024,'trim',24);
    }
    for(const side of [-1,1]){
      const X=y=>side*(.895-(y-1.06)*.36);
      const front=[[X(1.08),1.08,.82],[X(1.56),1.56,.22],[X(1.59),1.59,-.30],[X(1.08),1.08,-.30]];
      const rear=[[X(1.08),1.08,-.40],[X(1.59),1.59,-.40],[X(1.56),1.56,-.98],[X(1.08),1.08,-1.53]];
      for(const q of [front,rear]){poly(q,'glass');tube([...q,q[0]],.014,'trim',18)}
      tube([[side*.86,1.07,.93],[side*.70,1.59,.25]],.032,'paint',10);
      tube([[side*.86,1.06,-1.65],[side*.70,1.59,-1.01]],.047,'paint',10);
      tube([[side*.89,1.07,-.35],[side*.71,1.59,-.35]],.034,'trim',10);
      tube([[side*.72,1.66,-.92],[side*.76,1.70,-.68],[side*.76,1.70,.12]],.019,'chrome',16);
      for(const z of [-.68,.08])box(.045,.055,.095,'trim',side*.745,1.655,z);
      add(new T.SphereGeometry(1,18,12),'paint',[side*1.015,1.16,.62],[0,0,0],[.13,.064,.096]);
      box(.15,.025,.045,'trim',side*.94,1.125,.60);
      box(.016,.073,.12,'chrome',side*1.126,1.16,.60);
    }
    for(const x of [-.42,.42])for(const z of [.12,-.85]){
      box(.47,.12,.49,'seat',x,.86,z);
      box(.47,.47,.115,'seat',x,1.08,z-.24,[-.12,0,0]);
      add(new T.SphereGeometry(1,12,8),'seat',[x,1.36,z-.26],[0,0,0],[.15,.095,.065]);
    }
    box(1.40,.18,.30,'interior',0,1.0,.66);box(.27,.08,.16,'trim',0,1.12,.59);
    add(new T.TorusGeometry(.15,.017,8,28),'trim',[-.42,1.16,.45],[-.30,0,0]);
    for(let i=0;i<3;i++)tube([[-.42,1.16,.45],[-.42+Math.cos(i*2.094)*.14,1.16+Math.sin(i*2.094)*.14,.45]],.012,'chrome',3);
    tube([[-.55,1.09,.94],[-.19,1.17,.82]],.009,'trim',3);tube([[.07,1.095,.95],[.42,1.16,.83]],.009,'trim',3);
    // Front and rear bumper, grilles, projector lamps and horizontal LED strips.
    for(const sign of [-1,1]){
      if(sign===1)roundedBox(1.62,.56,.22,.065,'paint',0,.75,2.075);
      else roundedBox(1.58,.22,.16,.04,'paint',0,.69,-2.09);
      roundedBox(1.45,.095,.13,.03,'trim',0,.47,sign*2.11);
      box(.40,.095,.022,'plate',0,.69,sign*2.198);
    }
    box(.77,.19,.035,'trim',0,.90,2.184);
    for(let i=0;i<9;i++)box(.017,.16,.018,'chrome',(i-4)*.075,.90,2.206);
    add(new T.SphereGeometry(1,12,8),'badge',[0,.90,2.219],[0,0,0],[.059,.041,.012]);
    for(const side of [-1,1]){
      box(.35,.085,.025,'trim',side*.59,.953,2.183,[0,-side*.05,0]);
      box(.32,.060,.012,'light',side*.59,.954,2.199,[0,-side*.05,0]);
      for(const k of [-1,1])add(new T.SphereGeometry(1,12,8),'chrome',[side*.59+k*.06,.954,2.208],[0,0,0],[.029,.026,.010]);
      tube([[side*.43,.989,2.215],[side*.74,.989,2.198]],.009,'led',5);
      box(.29,.105,.045,'rear',side*.63,1.00,-2.06);box(.26,.016,.015,'redLed',side*.63,1.023,-2.087);
      add(new T.CylinderGeometry(.035,.035,.12,12),'chrome',[side*.58,.44,-2.16],[Math.PI/2,0,0]);
    }
    // Four tyres with tread blocks and sidewalls; rims include brakes and paired spokes.
    for(const side of [-1,1])for(const z of wheelZ){
      const x=side*.94;
      add(new T.CylinderGeometry(.326,.326,.22,48),'rubber',[x,wheelY,z],[0,0,Math.PI/2]);
      for(const edge of [-1,1])add(new T.TorusGeometry(.252,.078,10,48),'rubber',[x+edge*.073,wheelY,z],[0,Math.PI/2,0],[1,1,.55]);
      for(let i=0;i<48;i++)for(let lane=0;lane<3;lane++){
        const a=(i+(lane%2)*.5)*Math.PI*2/48;
        box(.065,.012,.029,'rubber',x+(lane-1)*.067,wheelY+Math.cos(a)*.330,z+Math.sin(a)*.330,[a,0,0]);
      }
      add(new T.CylinderGeometry(.211,.211,.018,40),'trim',[side*1.058,wheelY,z],[0,0,Math.PI/2]);
      add(new T.CylinderGeometry(.157,.157,.015,36),'chrome',[side*1.069,wheelY,z],[0,0,Math.PI/2]);
      add(new T.TorusGeometry(.200,.015,8,40),'chrome',[side*1.078,wheelY,z],[0,Math.PI/2,0]);
      for(let i=0;i<5;i++)for(let j of [-1,1]){
        const a=i*Math.PI*2/5+j*.075;
        box(.025,.16,.016,'chrome',side*1.083,wheelY+Math.cos(a)*.105,z+Math.sin(a)*.105,[a,0,0]);
      }
      add(new T.CylinderGeometry(.046,.046,.025,16),'badge',[side*1.097,wheelY,z],[0,0,Math.PI/2]);
      box(.025,.085,.045,'rear',side*1.073,wheelY+.08,z+.12);
    }
    B.finish();group.scale.set(w/2.2,hScale,d/4.4);
  }
  function poolTextures(T){
    const tile=document.createElement('canvas');tile.width=tile.height=512;
    const c=tile.getContext('2d');c.fillStyle='#b9d4d2';c.fillRect(0,0,512,512);
    let seed=324;const rng=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
    for(let x=0;x<16;x++)for(let y=0;y<16;y++){
      const v=145+Math.floor(rng()*24);c.fillStyle='rgb('+[Math.floor(v*.60),v,Math.min(225,v+34)].join(',')+')';c.fillRect(x*32+1,y*32+1,30,30);
      c.fillStyle='#c6e5dd55';c.fillRect(x*32+2,y*32+2,28,1);
    }
    const tileMap=new T.CanvasTexture(tile);tileMap.colorSpace=T.SRGBColorSpace;tileMap.wrapS=tileMap.wrapT=T.RepeatWrapping;tileMap.anisotropy=4;
    const n=256,normal=document.createElement('canvas');normal.width=normal.height=n;
    const ctx=normal.getContext('2d'),image=ctx.createImageData(n,n);
    const glow=document.createElement('canvas');glow.width=glow.height=n;const gc=glow.getContext('2d'),caustic=gc.createImageData(n,n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const u=x/n*2*Math.PI,v=y/n*2*Math.PI;
      const nx=.18*Math.cos(7*u+3*v)+.09*Math.cos(3*u-9*v),ny=.12*Math.cos(7*u+3*v)-.13*Math.cos(3*u-9*v);
      const length=Math.hypot(nx,ny,1),index=(y*n+x)*4;
      image.data.set([128+127*nx/length,128+127*ny/length,128+127/length,255],index);
      const a=Math.sin(6*u+Math.sin(4*v)*.8)+Math.cos(7*v+Math.sin(3*u)*.6);
      const b=Math.sin(5*v+Math.cos(3*u)*.9)+Math.cos(8*u+Math.sin(5*v)*.6);
      const light=Math.max(Math.exp(-Math.abs(a)*17),Math.exp(-Math.abs(b)*22));
      caustic.data.set([165,226,221,Math.round(light*100)],index);
    }
    ctx.putImageData(image,0,0);gc.putImageData(caustic,0,0);
    const waterNormal=new T.CanvasTexture(normal),causticMap=new T.CanvasTexture(glow);causticMap.colorSpace=T.SRGBColorSpace;
    for(const t of [waterNormal,causticMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4}
    return {tileMap,waterNormal,causticMap};
  }
  function detailedPool(T,group,type,w,d){
    const maps=poolTextures(T),frame=type==='framePool',waterY=frame?.84:.085,bottom=frame?.06:-1.10;
    maps.waterNormal.repeat.set(w/2,d/2);maps.causticMap.repeat.set(w/2.3,d/2.3);
    const standard=(color,opts={})=>new T.MeshStandardMaterial({color,roughness:.73,side:T.DoubleSide,...opts});
    const materials={
      tile:standard('#e1f1e5',{map:maps.tileMap,roughness:.43}),rim:standard('#d7d2c3',{roughness:.88}),
      steel:standard('#b6c4c6',{metalness:.91,roughness:.21}),shell:standard('#839eac',{roughness:.79}),dark:standard('#344b53',{roughness:.85}),
      water:new T.MeshPhysicalMaterial({color:'#4faabc',roughness:.10,metalness:.02,transparent:true,opacity:.78,transmission:.16,thickness:.8,ior:1.333,normalMap:maps.waterNormal,normalScale:new T.Vector2(.48,.48),clearcoat:.7,clearcoatRoughness:.16,envMapIntensity:1.1,depthWrite:false,side:T.DoubleSide}),
      caustics:new T.MeshBasicMaterial({map:maps.causticMap,transparent:true,opacity:.30,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide})
    };
    const B=detailBatch(T,group,materials,'Бассейн'),{add,box,tube}=B;
    const clearW=frame?w*.92:w-.30,clearD=frame?d*.92:d-.30;
    if(frame){
      add(new T.CylinderGeometry(1,1,.87,64,1,true),'shell',[0,.475,0],[0,0,0],[w*.49,1,d*.49]);
      add(new T.CylinderGeometry(1,1,.80,64,1,true),'tile',[0,.47,0],[0,0,0],[w*.46,1,d*.46],true);
      for(let i=0;i<18;i++){
        const a=i*Math.PI*2/18,x=Math.cos(a)*w*.50,z=Math.sin(a)*d*.50;
        add(new T.CylinderGeometry(.022,.025,.85,10),'steel',[x,.45,z]);box(.10,.025,.10,'dark',x,.025,z);
      }
      for(const y of [.06,.93])add(new T.TorusGeometry(1,.021,8,64),'steel',[0,y,0],[Math.PI/2,0,0],[w*.495,d*.495,1]);
      add(new T.CircleGeometry(1,64),'tile',[0,bottom,0],[-Math.PI/2,0,0],[clearW/2,clearD/2,1],true);
    }else{
      box(w,.12,d,'rim',0,bottom-.065,0);
      const sideH=1.27;
      for(const sign of [-1,1]){
        box(.13,sideH,d,'tile',sign*(w-.13)/2,(bottom+.17)/2,0);
        box(w-.26,sideH,.13,'tile',0,(bottom+.17)/2,sign*(d-.13)/2);
        box(.15,.10,d,'rim',sign*(w-.15)/2,.17,0);box(w-.30,.10,.15,'rim',0,.17,sign*(d-.15)/2);
      }
      box(clearW,.025,clearD,'tile',0,bottom+.012,0);
      // Joints in coping stones and a fine overflow grate are geometry, not a flat sticker.
      for(const side of [-1,1]){
        for(let x=-w/2+.50;x<w/2-.18;x+=.60)box(.004,.002,.15,'dark',x,.221,side*(d-.15)/2);
        for(let z=-d/2+.50;z<d/2-.18;z+=.60)box(.15,.002,.004,'dark',side*(w-.15)/2,.221,z);
      }
      if(type==='overflowPool'){
        box(w-.12,.012,.06,'dark',0,.225,d/2-.055);
        for(let x=-w/2+.1;x<w/2-.1;x+=.035)box(.012,.016,.065,'rim',x,.232,d/2-.055);
      }
    }
    const surface=frame?new T.CircleGeometry(1,64):new T.PlaneGeometry(clearW,clearD);
    add(surface,'water',[0,waterY,0],[-Math.PI/2,0,0],frame?[clearW/2,clearD/2,1]:[1,1,1]);
    const shimmer=frame?new T.CircleGeometry(1,64):new T.PlaneGeometry(clearW-.02,clearD-.02);
    add(shimmer,'caustics',[0,bottom+.03,0],[-Math.PI/2,0,0],frame?[clearW/2,clearD/2,1]:[1,1,1]);
    const x=frame?0:w*.28,z=d/2-.24,top=frame?1.42:.67;
    for(const side of [-1,1]){
      tube([[x+side*.24,frame?.25:-.72,z],[x+side*.24,top-.18,z],[x+side*.24,top,z+.13],[x+side*.24,top-.06,z+.36],[x+side*.24,.11,z+.52]],.022,'steel');
    }
    for(let i=0;i<4;i++){
      const y=frame?.22+i*.21:-.67+i*.25;
      box(.46,.035,.09,'steel',x,y,z);box(.39,.009,.075,'dark',x,y+.022,z);
      if(frame){box(.46,.035,.09,'steel',x,y,z+.48);box(.39,.009,.075,'dark',x,y+.022,z+.48)}
    }
    B.finish();
  }

  function addMeshes(T,parent,p){
    const cache=new Map();
    function mat(color){if(!cache.has(color))cache.set(color,new T.MeshStandardMaterial({color,roughness:.78}));return cache.get(color)}
    const land=plot(p);
    if(land.measured){
      const edges=[[-land.mx,-land.mz],[p.w+land.mx,-land.mz],[p.w+land.mx,p.d+land.mz],[-land.mx,p.d+land.mz]].map(([x,z])=>new T.Vector3(x,-.21,z));
      parent.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(edges),new T.LineBasicMaterial({color:'#94aa92'})));
    }
    for(const o of p.yard||[]){
      if(!catalog[o.type])continue;const {x,z}=position(p,o),group=new T.Group();group.name=catalog[o.type].title;
      group.position.set(x,-.24,z);group.rotation.y=-o.angle*Math.PI/180;parent.add(group);
      const {type,w,d}=o;
      // Site children start at ground level. Deck boards finish at world floor zero.
      if(type==='terrace'||type==='coveredTerrace')group.position.y-=((window.PentiiStructure?.get(p).groundY??-.24)+.173);
      const hScale=Math.min(1.8,Math.max(.52,Math.sqrt(w*d/(catalog[type].w*catalog[type].d))));
      function mesh(geo,color,px=0,py=0,pz=0){const item=new T.Mesh(geo,mat(color));item.position.set(px,py,pz);item.castShadow=item.receiveShadow=true;group.add(item);return item}
      const box=(width,height,depth,color,xx=0,yy=height/2,zz=0)=>mesh(new T.BoxGeometry(width,height,depth),color,xx,yy,zz);
      const cyl=(r1,r2,h,c,xx=0,yy=h/2,zz=0,k=18)=>mesh(new T.CylinderGeometry(r1,r2,h,k),c,xx,yy,zz);
      const ell=(xx,y,zz,rx,ry,rz,col)=>{const m=mesh(new T.IcosahedronGeometry(1,2),col,xx,y,zz);m.scale.set(rx,ry,rz);return m};
      function paving(){
        const deck=type==='terrace'||type==='coveredTerrace',height=deck?.17:.041;
        if(deck){
          const pier=-((window.PentiiStructure?.get(p).groundY??-.24)+.173);
          if(pier>.005){
            const nx=Math.max(1,Math.ceil(w/2.2)),nz=Math.max(1,Math.ceil(d/2.2));
            for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++)box(.14,pier,.14,'#687376',(i/nx-.5)*(w-.15),-pier/2,(j/nz-.5)*(d-.15));
          }
        }
        box(w,height-.012,d,deck?'#7e705c':'#9a9b91');
        const tiles=[],rowCount=Math.min(160,Math.ceil(d/(deck?.14:.32))),step=d/rowCount;
        let seed=6155;const rng=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
        for(let j=0;j<rowCount;j++){
          const pitch=deck?2.15:.63;
          for(let x=-w/2-(j%2)*pitch*.5;x<w/2;x+=pitch){
            const left=Math.max(x,-w/2),right=Math.min(w/2,x+pitch);
            if(right-left>.016)tiles.push({x:(left+right)/2,z:-d/2+(j+.5)*step,w:right-left-.008,tone:rng()});
          }
        }
        const stones=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xffffff,roughness:deck?.79:.91}),tiles.length);
        const obj=new T.Object3D(),color=new T.Color();
        tiles.forEach((slab,i)=>{
          obj.position.set(slab.x,height-.003,slab.z);obj.scale.set(slab.w,.012,step-.006);obj.updateMatrix();stones.setMatrixAt(i,obj.matrix);
          color.set(deck?'#a99072':'#aea99d').multiplyScalar(.85+.20*slab.tone);stones.setColorAt(i,color);
        });
        stones.castShadow=stones.receiveShadow=true;group.add(stones);
      }
      if(type==='car'){
        detailedCar(T,group,w,d,hScale);continue;
      }
      if(tree(type)){
        if(type==='hedge'){box(w,.8*hScale,d,'#618566');for(let i=0;i<Math.max(2,Math.ceil(w/.8));i++){const n=Math.max(2,Math.ceil(w/.8));ell(((i+.5)/n-.5)*w,.8*hScale,0,w/n*.57,.36*hScale,d*.50,'#779969')}continue}
        const conifer=evergreen(type),shrub=type==='bush',birch=type==='birch';
        const h=(conifer?4.7:shrub?1.3:birch?4.8:4.25)*hScale;
        const bark=birch?'#bcb9a6':conifer?'#786944':'#756650';
        cyl(.028*hScale,(shrub?.065:.125)*hScale,h*.82,bark);
        function branch(from,to,r1,r2){
          const end=new T.Vector3(...to),start=new T.Vector3(...from),delta=end.clone().sub(start);
          const m=mesh(new T.CylinderGeometry(r2,r1,delta.length(),7),bark,...start.addScaledVector(delta,.5).toArray());
          m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
        }
        // Folded sprays render individual leaves across all crown silhouettes in one draw call.
        const geometry=new T.BufferGeometry();
        const leaves=[];
        for(let blade=0;blade<5;blade++){
          const a=blade*2.40,rx=Math.cos(a),rz=Math.sin(a),tx=-rz*.29,tz=rx*.29;
          leaves.push(0,-.1,0, rx*.5+tx,.15,rz*.5+tz,rx,.32,rz, 0,-.1,0,rx,.32,rz,rx*.5-tx,.09,rz*.5-tz);
        }
        geometry.setAttribute('position',new T.Float32BufferAttribute(leaves,3));geometry.computeVertexNormals();
        const count=conifer?2800:birch?2600:shrub?950:3000;
        const inst=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.95}),count),dummy=new T.Object3D();
        let seed=137;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
        const crowns=[],branches=conifer?48:shrub?22:32;
        for(let j=0;j<branches;j++){
          const a=j*2.39996,frac=(j+.5)/branches;
          const y=h*(conifer?.16+.78*frac:.30+.64*frac);
          const r=conifer?(.52*(1-frac)+.018):(.13+.24*Math.sin(frac*Math.PI))*(.82+random()*.18);
          const xx=Math.cos(a)*w*r,zz=Math.sin(a)*d*r;
          const ty=y+(conifer?-.13:shrub?.06:.17)*h*(1-frac);
          branch([0,y-.075*h,0],[xx*.63,ty-.035*h,zz*.63],Math.max(.015,.048*(1-frac))*hScale,.015*hScale);
          branch([xx*.63,ty-.035*h,zz*.63],[xx,ty,zz],.022*hScale,.006*hScale);
          for(let side of [-1,1]){
            const tx=xx*.76+Math.sin(a)*w*.095*side,tz=zz*.76-Math.cos(a)*d*.095*side;
            branch([xx*.48,ty-.045*h,zz*.48],[tx,ty+.055*h,tz],.017*hScale,.005*hScale);
            crowns.push({x:tx,y:ty+.06*h,z:tz,r:conifer?.09:.19});
          }
          crowns.push({x:xx,y:ty,z:zz,r:conifer?.09:.14});
        }
        const tint=new T.Color(),palette=conifer?['#416a53','#3c6553','#597951','#5b8160']:birch?['#84a263','#99b572','#6d8d54','#849a54']:['#608d57','#608656','#86a568','#72995f'];
        for(let i=0;i<count;i++){
          const c=crowns[i%crowns.length],a=random()*Math.PI*2,sy=random()*2-1,rr=Math.cbrt(random()),out=Math.sqrt(1-sy*sy)*rr;
          dummy.position.set(c.x+Math.cos(a)*out*w*c.r,c.y+sy*rr*h*(conifer?.063:birch?.10:.12),c.z+Math.sin(a)*out*d*c.r);
          const size=(conifer?.085:birch?.092:shrub?.068:.116)*hScale*(.65+random()*.48);
          dummy.scale.set(size,conifer?size*1.55:size,size);dummy.rotation.set((random()-.5)*1.8,random()*6.28,(random()-.5)*1.8);
          dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
          tint.set(palette[i%palette.length]).multiplyScalar(.77+random()*.32);inst.setColorAt(i,tint);
        }
        inst.castShadow=inst.receiveShadow=true;group.add(inst);continue
      }
      if(flower(type)){
        box(w,.027,d,'#5a513c');
        let seed=611;const rng=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
        const leaves=[],colorsLeaf=[],petals=[],colorsPetal=[];
        const tri=(list,paint,a,b,c,tint)=>{list.push(...a,...b,...c);for(let q=0;q<3;q++)paint.push(tint.r,tint.g,tint.b)};
        const addBlade=(list,paint,x,y,z,angle,length,span,h,tint)=>{
          const dx=Math.cos(angle)*length,dz=Math.sin(angle)*length,sx=-Math.sin(angle)*span,sz=Math.cos(angle)*span;
          const a=[x,y,z],e=[x+dx,y+h,z+dz],m=[x+dx*.55,y+h*.68+.008,z+dz*.55];
          const l=[m[0]+sx,m[1]-.006,m[2]+sz],r=[m[0]-sx,m[1]-.006,m[2]-sz];
          tri(list,paint,a,l,m,tint);tri(list,paint,m,l,e,tint);tri(list,paint,a,m,r,tint);tri(list,paint,m,e,r,tint);
        };
        const stems=Math.min(1600,Math.ceil(w*d*(type==='lavender'?105:33))),tint=new T.Color(),blossom=new T.Color();
        for(let i=0;i<stems;i++){
          const x=(rng()-.5)*w*.965,z=(rng()-.5)*d*.93,phi=rng()*6.28,h=.17+rng()*.19;
          const sway=.028+rng()*.07,tx=x+sway*Math.cos(phi),tz=z+sway*Math.sin(phi);
          tint.set(type==='lavender'?'#88967a':'#52744b').multiplyScalar(.60+rng()*.46);
          addBlade(leaves,colorsLeaf,x,.023,z,phi,sway,.006,h,tint);
          for(let j=0;j<7;j++)addBlade(leaves,colorsLeaf,x,.028+h*j*.047,z,phi+j*2.4,.053+rng()*.076,type==='lavender'?.008:.023,.02+rng()*.054,tint);
          if(type==='lavender'){
            blossom.set(rng()>.54?'#977eab':'#806894').multiplyScalar(.83+rng()*.23);
            for(let whorl=0;whorl<5;whorl++)for(let k=0;k<3;k++)addBlade(petals,colorsPetal,tx,h+.008+whorl*.013,tz,phi+k*2.095+whorl,.014-whorl*.0015,.006,.013,blossom);
          }else{
            blossom.set(type==='daisies'?'#eee8d9':type==='tulips'?'#bd685a':type==='roses'?'#a75166':rng()>.5?'#e4c988':'#b27d95');
            const n=type==='daisies'?12:7;
            for(let k=0;k<n;k++)addBlade(petals,colorsPetal,tx,h+.015,tz,phi+k*6.28/n,.037,type==='daisies'?.008:.014,type==='tulips'?.044:.012,blossom);
          }
        }
        function foliage(vertices,paint){
          const geo=new T.BufferGeometry();
          geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(paint,3));geo.computeVertexNormals();
          const plant=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide,roughness:.91}));
          plant.castShadow=plant.receiveShadow=true;group.add(plant);
        }
        foliage(leaves,colorsLeaf);foliage(petals,colorsPetal);continue;
      }
      if(fence(type)){
        const h=(type==='railing'||type==='baluster'?1.0:type==='gate'?1.65:1.55)*hScale,n=Math.max(1,Math.ceil(w/2.5)),post=Math.min(w*.14,.21);
        for(let i=0;i<=n;i++){let xx=-w/2+post/2+(w-post)*i/n;box(post,h+.10,d,colors[type],xx);box(post+.03,.055,d+.04,'#84878a',xx,h+.10)}
        if(type==='baluster'||type==='railing'){
          box(w,.075,d,colors[type],0,h);box(w,.055,d*.85,colors[type],0,.13);const n=Math.ceil(w/(type==='baluster'?.23:.14));
          for(let j=0;j<n;j++){let xx=-w/2+(j+.5)*w/n;if(type==='railing'){box(.038,h-.16,.04,colors[type],xx,h*.54)}else{cyl(.042,.07,h*.54,colors[type],xx,h*.49);cyl(.042,.059,h*.25,colors[type],xx,h*.80);box(.11,.12,.11,colors[type],xx,.18)}}
        }else if(['brick','profile','concrete','gate'].includes(type)){
          box(w-.06,h*.89,d*.55,colors[type],0,h*.49,0);
          if(type==='brick'){for(let j=1;j<h/.13;j++)box(w-.06,.008,d*.56,'#bfa38c',0,.065+j*.13,0)}
          else{let count=Math.max(1,Math.ceil(w/(type==='profile'?.14:.79)));for(let j=1;j<count;j++)box(.025,h*.88,d*.61,'#798a8f',-w/2+j*w/count,h*.49)}
        }else{for(const y of [.32,.71])box(w,.075,d*.38,'#715f53',0,h*y);let count=Math.max(2,Math.ceil(w/.16));for(let j=0;j<count;j++)box(w/count*.71,h*.92,d*.42,colors[type],-w/2+(j+.5)*w/count,h*.5,d*.28)}continue
      }
      if(water(type)){
        detailedPool(T,group,type,w,d);continue;
      }
      if(type==='septic'||type==='well'){const h=type==='well'?.44:.14;
        if(type==='septic')box(w,.05,d,'#95ad92');const count=type==='well'?1:2;
        for(let j=0;j<count;j++){const x=(j-(count-1)/2)*w*.43,r=Math.min(w/count,d)*.39;cyl(r,r,h,type==='well'?'#bcc1b4':'#60816b',x);cyl(r*.94,r*.94,.05,'#71877b',x,h+.02);box(r*.68,.03,.035,'#364e48',x,h+.061)}continue
      }
      if(pipe(type)){box(w,.045,d,type==='sewer'?'#ab8064':'#798c96');const n=Math.ceil((type==='drain'?d:w)/.17);
        for(let i=0;i<n;i++){if(type==='drain')box(w*.84,.009,.025,'#384f5d',0,.054,-d/2+(i+.5)*d/n);else if(i%4===0)box(.07,.02,d*1.04,'#c6a18b',-w/2+(i+.5)*w/n,.055,0)}continue}
      if(paved(type)){if(type==='steps'){for(let j=0;j<3;j++)box(w,.13*(j+1),d/3,'#c4c0b4',0,.065*(j+1),d*(1-j)/3)}else paving();continue}
      if(type==='barrel'){let body=cyl(w*.49,w*.49,d,'#b19576',0,w*.52);body.rotation.x=Math.PI/2;
        for(let j of [-1,1]){const band=cyl(w*.50,w*.50,.075,'#66717a',0,w*.52,j*d*.34);band.rotation.x=Math.PI/2}box(w*.33,w*.67,.04,'#776759',0,w*.40,d*.505);continue}
      const open=['canopy','coveredTerrace','gazebo','bbq'].includes(type),h=2.42*hScale;
      if(open){if(type!=='canopy')paving();for(const xx of [-.45,.45])for(const zz of [-.43,.43])box(.12,h,.12,'#7b7466',xx*w,h/2,zz*d)}
      else{box(w*.94,h,d*.95,'#bda78a');box(w*.23,h*.77,.055,'#756c5f',-w*.20,h*.385,d*.48);box(w*.27,h*.34,.06,'#839fad',w*.19,h*.60,d*.49)}
      if(type==='canopy'||type==='coveredTerrace'){box(w,.14,d,p.top||'#637482',0,h+.05)}
      else{for(const side of [-1,1]){const roof=box(w+.13,.105,d*.53,p.top||'#637482',0,h+d*.065,side*d*.25);roof.rotation.x=side*.25}}
      if(type==='bbq'){box(w*.48,.7,d*.22,'#9b8877',0,.54,-d*.28);box(w*.52,.095,d*.25,'#505b60',0,.94,-d*.28)}
    }
  }
  return {mount,plan:p=>svgPlan(p),example,validate,addMeshes,catalog,position,symbol};
})();

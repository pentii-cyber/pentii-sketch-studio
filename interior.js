'use strict';
window.Interior = (() => {
  // Dimensions in metres. Icons are top views, drawn in a normalized 100 × 100 box.
  const furniture=[
    ['sofa','Диван',2.2,.92],['bed','Кровать',1.65,2.1],
    ['table','Обеденный стол',1.55,.9],['chair','Стул',.48,.5],
    ['wardrobe','Шкаф',1.6,.62],['kitchen','Кухонный гарнитур',2.7,.63]
  ];
  const equipment=[
    ['toilet','Унитаз',.46,.72],['bath','Ванна',.75,1.7],['sink','Раковина',.65,.49],
    ['washer','Стиральная машина',.6,.62],['boiler','Бойлер',.46,.46],['ac','Кондиционер',.86,.27],
    ['fridge','Холодильник',.65,.7],['lamp','Светильник',.35,.35],['socket','Розетка',.16,.09],
    ['stairs','Открытая лестница',.95,3.3],['closedStairs','Закрытая лестница',1,3.5],
    ['metalStairs','Металлическая лестница',.95,3.2],['glassStairs','Стеклянная лестница',1.05,3.4]
  ];
  const catalog=Object.fromEntries([...furniture,...equipment].map(([key,name,w,d])=>[key,{key,name,w,d}]));
  const rect=(x,y,w,h,r=0,fill='white')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
  const ellipse=(x,y,rx,ry,fill='white')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const path=d=>`<path d="${d}" fill="none"/>`;
  const timber='#e3d5bd',linen='#cee2f1',metal='#c6d1d6';
  const drawers=rect(3,3,94,94,3,timber);
  const appliance=rect(3,3,94,94,7,'#f3f6f6');
  const icons={
    sofa:rect(2,5,96,90,9,linen)+rect(10,30,40,58,6,'#e5f0f8')+rect(50,30,40,58,6,'#e5f0f8')+rect(3,26,8,64,4,linen)+rect(89,26,8,64,4,linen),
    bed:rect(2,2,96,96,4,timber)+rect(7,7,86,85,5,'#f7f4ec')+rect(12,10,34,16,5)+rect(53,10,34,16,5)+rect(7,35,86,57,3,linen)+path('M8 43H92'),
    table:rect(3,4,94,92,14,timber)+path('M14 19H86M14 84H86'),
    chair:rect(10,14,80,77,13,linen)+rect(7,3,86,16,7,timber)+path('M17 83H83'),
    wardrobe:drawers+path('M50 4V96M9 12L43 86M57 86L91 12M45 40V55M55 40V55'),
    kitchen:drawers+rect(7,13,22,69,7,'#f1f4ef')+rect(10,22,15,49,5,metal)+path('M34 4V95M66 4V95')+rect(70,12,24,70,3,'#e8eae7')+ellipse(77,32,4,10)+ellipse(86,60,4,10),
    toilet:rect(15,2,70,22,5,metal)+ellipse(50,58,33,39)+ellipse(50,56,21,26,'#d6e8eb'),
    bath:rect(2,2,96,96,12)+rect(10,10,80,79,29,'#dcecf2')+ellipse(50,25,3,2,metal),
    sink:rect(3,4,94,93,14)+ellipse(50,57,35,28,'#dfedf0')+path('M50 12V35'),
    washer:appliance+rect(8,8,84,13,2,metal)+ellipse(50,59,30,30,'#a5bdc9')+ellipse(50,59,21,21,'#d9e8ee'),
    boiler:ellipse(50,50,46,46,'#f7f9f9')+ellipse(50,50,30,30,metal)+path('M39 77V91M62 77V91'),
    ac:appliance+path('M15 57H85M15 68H85M15 78H85'),
    fridge:appliance+path('M8 37H92M18 15V28M18 48V69'),
    lamp:ellipse(50,50,45,45,'#fff2b7')+path('M20 20L80 80M80 20L20 80'),
    socket:rect(2,3,96,94,9)+ellipse(50,50,32,39,'#e7edf4')+ellipse(40,50,4,6,metal)+ellipse(60,50,4,6,metal)
  };
  for(const [key,fill] of [['stairs','#ddc9a7'],['closedStairs','#dfd6c4'],['metalStairs','#bfd0db'],['glassStairs','#d2edf6']]){
    let icon=rect(3,1,94,98,1,fill);
    for(let y=9;y<99;y+=9)icon+=path('M4 '+y+'H96');
    icons[key]=icon+path('M50 90V11M40 21L50 11L60 21');
  }
  const state=new WeakMap();
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const snap=n=>Math.round(n*20)/20;
  function bounds(item){const {w,d}=catalog[item.key];return item.r%180?{w:d,d:w}:{w,d}}
  function validate(q) {
    for(const item of q.interior||[]){
      const spec=catalog[item.key];if(!spec)continue;
      const {w,d}=bounds(item);
      if(item.x-w/2<-.001||item.y-d/2<-.001||item.x+w/2>q.w+.001||item.y+d/2>q.d+.001||item.floor>=q.n)
        return 'Предмет «'+spec.name+'» выходит за контур этажа.';
    }
    return '';
  }
  function layer(q,floor,g){
    return (q.interior||[]).filter(i=>i.floor===floor&&catalog[i.key]).map(item=>{
      const {name,w,d}=catalog[item.key],width=w*g.scale,depth=d*g.scale;
      return `<g data-fit="${esc(item.id)}" transform="translate(${g.x+g.scale*item.x} ${g.y+g.scale*item.y}) rotate(${item.r})"><title>${esc(name)}</title><rect x="${-width/2}" y="${-depth/2}" width="${width}" height="${depth}" fill="transparent"/><svg x="${-width/2}" y="${-depth/2}" width="${width}" height="${depth}" viewBox="0 0 100 100" preserveAspectRatio="none"><g stroke="#536979" stroke-width="2" stroke-linejoin="round">${icons[item.key]}</g></svg></g>`;
    }).join('');
  }
  function fits(item,q,center){
    const {w,d}=bounds(item);if(w>q.w||d>q.d)return false;
    item.x=clamp(snap(center.x),w/2,q.w-w/2);item.y=clamp(snap(center.y),d/2,q.d-d/2);return true;
  }
  function save(s,edit){
    const q=JSON.parse(JSON.stringify(s.project));q.interior ||= [];edit(q);
    const warning=validate(q);if(warning){s.opts.onMessage?.(warning);return false}
    if(s.opts.onCommit(q)===false)return false;
    s.project=q;s.opts.onMessage?.('');return true;
  }
  function actionButton(label,fn,active){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;
    if(active)b.classList.add('on');return b;
  }
  function catalogPanel(s){
    const el=s.opts.controls;el.replaceChildren();
    const title=document.createElement('h2');title.textContent='Расстановка на плане';el.append(title);
    const desc=document.createElement('p');desc.className='muted';
    const current=(s.project.interior||[]).find(i=>i.id===s.selected);
    if(s.key)desc.textContent=catalog[s.key].name+' · щёлкните в комнате для установки.';
    else if(current)desc.textContent=catalog[current.key].name+' · '+fmt(catalog[current.key].w)+' × '+fmt(catalog[current.key].d)+' м';
    else desc.textContent='Выберите предмет, затем укажите место на плане. Установленный предмет можно перетащить.';
    el.append(desc);
    if(current){const tools=document.createElement('div');tools.className='choiceGrid';
      tools.append(actionButton('Повернуть на 90°',()=>{save(s,q=>{const item=q.interior.find(i=>i.id===s.selected);item.r=(item.r+90)%360;fits(item,q,item)});show(s)}),
        actionButton('Удалить',()=>{const id=s.selected;s.selected='';save(s,q=>q.interior=q.interior.filter(i=>i.id!==id));show(s)}));el.append(tools);
    }
    const tabs=document.createElement('div');tabs.className='choiceGrid';for(const group of ['Мебель','Оборудование'])tabs.append(actionButton(group,()=>{s.group=group;s.key='';catalogPanel(s)},s.group===group));el.append(tabs);
    const grid=document.createElement('div');grid.className='choiceGrid';grid.style.marginTop='12px';
    for(const [key,name,w,d] of s.group==='Мебель'?furniture:equipment){
      const b=actionButton('',()=>{s.key=key;s.selected='';show(s)},s.key===key);
      b.style.cssText='display:flex;align-items:center;gap:7px;text-align:left;line-height:1.2;min-height:43px';b.setAttribute('aria-label',name);
      b.innerHTML='<svg aria-hidden="true" width="24" height="24" viewBox="0 0 100 100" style="flex:none"><g stroke="#4a6276" stroke-width="4">'+icons[key]+'</g></svg><span>'+name+'</span>';
      b.title=name+' · '+fmt(w)+' × '+fmt(d)+' м';grid.append(b);
    }
    el.append(grid);
  }
  function board(s,q){
    const g=plan(q,s.opts.level);let html=g.html;
    const item=q.interior?.find(i=>i.id===s.selected&&i.floor===s.opts.level);
    if(item&&catalog[item.key]){const b=bounds(item);
      const width=b.w*g.scale,height=b.d*g.scale,x=g.x+item.x*g.scale-width/2,y=g.y+item.y*g.scale-height/2;
      const pos=html.lastIndexOf('</svg>');
      html=html.slice(0,pos)+`<rect x="${x-3}" y="${y-3}" width="${width+6}" height="${height+6}" rx="4" fill="none" stroke="#197db6" stroke-width="2" stroke-dasharray="5 3" pointer-events="none"/>`+html.slice(pos);
    }
    s.wrapper.innerHTML=html;
    const art=s.wrapper.firstElementChild;art.style.cssText='width:100%;height:100%;display:block;touch-action:none;user-select:none;cursor:'+(s.key?'crosshair':'default');
    art.querySelectorAll('[data-fit]').forEach(g=>g.style.cursor='grab');
  }
  function show(s){board(s,s.project);catalogPanel(s)}
  function paperPoint(s,e){
    const svg=s.wrapper.firstElementChild,m=svg.getScreenCTM();if(!m)return null;
    const g=plan(s.project,s.opts.level),pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());
    return {x:(pt.x-g.x)/g.scale,y:(pt.y-g.y)/g.scale};
  }
  function setup(s){
    const shell=document.createElement('div');shell.style.cssText='width:100%;height:100%;position:absolute;inset:0;touch-action:none';s.wrapper=shell;
    shell.onpointerdown=e=>{
      if(e.button!==0||s.drag)return;
      const point=paperPoint(s,e);if(!point)return;
      const inside=point.x>=0&&point.y>=0&&point.x<=s.project.w&&point.y<=s.project.d;
      if(s.key&&inside){
        const item={key:s.key,id:uid(),floor:s.opts.level,r:0,...point};if(!fits(item,s.project,point)){s.opts.onMessage?.('Предмет не помещается на этом этаже.');return}
        s.selected=item.id;s.key='';save(s,q=>q.interior.push(item));show(s);return;
      }
      const id=e.target.closest('[data-fit]')?.dataset.fit;
      if(!id){s.selected='';show(s);return}
      const item=s.project.interior.find(i=>i.id===id);if(!item)return;
      s.selected=id;s.key='';s.drag={id,pid:e.pointerId,point,item:{...item},next:null};
      shell.setPointerCapture(e.pointerId);show(s);
    };
    function move(e){const drag=s.drag;if(!drag||drag.pid!==e.pointerId)return;
      const pt=paperPoint(s,e);if(!pt)return;
      const q=JSON.parse(JSON.stringify(s.project)),i=q.interior.find(i=>i.id===drag.id);
      fits(i,q,{x:drag.item.x+pt.x-drag.point.x,y:drag.item.y+pt.y-drag.point.y});
      drag.next={x:i.x,y:i.y};board(s,q);
    }
    shell.onpointermove=move;
    shell.onpointerup=e=>{const drag=s.drag;if(!drag||drag.pid!==e.pointerId)return;
      s.drag=null;if(shell.hasPointerCapture(e.pointerId))shell.releasePointerCapture(e.pointerId);
      if(drag.next)save(s,q=>Object.assign(q.interior.find(i=>i.id===drag.id),drag.next));show(s);
    };
    shell.onpointercancel=()=>{s.drag=null;show(s)};
  }
  function draw(host,project,opts){
    let s=state.get(host);if(!s){s={group:'Мебель',key:'',selected:''};state.set(host,s);setup(s)}
    if(s.project?.id!==project.id||s.opts?.level!==opts.level||host.firstElementChild!==s.wrapper){s.selected='';s.key='';s.drag=null}
    s.project=project;s.opts=opts;if(host.firstElementChild!==s.wrapper)host.replaceChildren(s.wrapper);
    show(s);
  }
  return {draw,layer,validate};
})();

'use strict';
const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 12);
const storageKey = 'pentii.sketch.studio.v1';
const skins = ['Короед','Штукатурка','Планкен','Панели','Вертикальные рейки','Кирпич'];
const palette = {
  wall: ['#f0e9da','#e5ddcb','#f6f4ec','#b88762','#a9b8c0','#748998','#4a555c'],
  top: ['#485057','#465357','#687581','#805447','#53634c','#537895','#303c4a']
};
function standardHouse(withCanopy=false){
  const house={id:uid(),name:'Стандартный дом 8 × 6',w:8,d:6,n:1,h:3,
    roof:0,ridge:0,pitch:30,e:.3,roofFinish:'Металлочерепица',
    wall:'#f0e9da',top:'#485057',skin:'Короед',ops:[],walls:[],interior:[],yard:[]};
  for(const [f,x,w,k] of [[0,1,1.4,0],[0,3.5,1,2],[0,5.6,1.4,0],
    [1,2.3,1.4,0],[2,3.3,1.4,0],[3,2.3,1.4,0]]){
    house.ops.push({id:uid(),f,x,w,k,h:k===2?2.1:1.4,sill:k===2?0:.9,floor:0});
  }
  if(withCanopy)RoofStudio.sample(house);
  else RoofStudio.initialize(house);
  return house;
}
// Ignore generated identifiers when deciding whether a repeated reset is a no-op.
function standardSignature(value){
  const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'
    ?Object.fromEntries(Object.keys(v).filter(k=>k!=='id').sort().map(k=>[k,normalize(v[k])])):v;
  return JSON.stringify(normalize(value));
}
function sample(withCanopy=true) {
  const house = {id:uid(), name:'Дом с фасадной штукатуркой', w:11,d:8,n:1,h:3,roof:0,ridge:1,pitch:30,e:.3,roofFinish:'Металлочерепица',wall:'#f0e9da',top:'#485057',skin:'Короед',ops:[],walls:[]};
  for(const [f,x,w,k] of [[0,.8,3.2,1],[0,5,1.1,2],[0,7.2,2.8,0],[1,1.3,2.3,0],[1,4.6,1.9,0],[2,1.6,2.3,0],[3,2,1.7,0]]){
    house.ops.push({id:uid(), f,x,w,k,h:k===0?1.6:2.35,sill:k===0?.8:0,floor:0});
  }
  for(const [a,b,c,d] of [[6.8,0,6.8,4.7],[6.8,5.6,6.8,8],[6.8,3.8,8.7,3.8],[9.6,3.8,11,3.8]]){
    house.walls.push({id:uid(),a,b,c,d,floor:0});
  }
  const layout=[
    ['kitchen',2.1,.45,0],['fridge',.4,.45,0],['table',3.2,2.55,0],
    ['chair',3.15,1.78,0],['chair',3.15,3.30,180],['sofa',2.0,5.6,90],
    ['bed',8.9,5.8,0],['wardrobe',10.5,6.9,90],['bath',10.43,1.4,0],
    ['toilet',7.4,.65,0],['sink',8.55,.42,0]
  ];
  house.interior=layout.map(([key,x,y,r])=>({key,x,y,r,floor:0,id:uid()}));
  house.yard=window.StudioYard?.example?.(house) || [];
  if(withCanopy)RoofStudio.sample(house);
  else RoofStudio.initialize(house);
  const canopy=RoofStudio.sections(house).find(s=>s.canopy);
  if(canopy){
    const depth=canopy.z+canopy.d-house.d;
    const centerX=canopy.x+canopy.w/2;
    house.yard.push({id:uid(),type:'terrace',u:centerX/house.w,v:1+depth/2,w:canopy.w,d:depth,angle:0});
    for(const item of house.yard){
      if(item.type==='lavender')item.v=1+depth+1;
      if(item.type==='path')item.u=.39;
    }
  }
  return house;
}
function facadeExample(){
  const house=sample();
  house.example='facade-v4';house.roofFinish='Металлочерепица';
  const roof=house.roofSections[0];roof.ridge=0;roof.pitch=30;
  const cross={...roof,id:uid(),name:'Фронтон гостиной',x:-.36,z:4.52,w:5.64,d:4.35,
    base:roof.base+.05,ridge:1,pitch:36,posts:[],canopy:false};
  house.roofSections.push(cross);
  return house;
}
function terraceExample(){
  if(!window.PentiiManagerExample)return facadeExample();
  const house=structuredClone(window.PentiiManagerExample);
  house.id=uid();return house;
}
let db;
try { db=JSON.parse(localStorage.getItem(storageKey)); } catch {}
if(!db?.items?.length)db={items:[]};
let startedStandard=false;
// Introduce the simpler starting point once, retaining all earlier sketches.
if(db.standardStartVersion!==1){
  const house=standardHouse();db.items.push(house);db.active=house.id;
  db.standardStartVersion=1;startedStandard=true;
}
const requestedExample=new URLSearchParams(location.search).get('example');
if(requestedExample==='facade'||requestedExample==='terrace'){
  const key=requestedExample==='terrace'?'terrace-v5':'facade-v4';
  let example=db.items.find(h=>h.example===key);
  if(!example){example=requestedExample==='terrace'?terraceExample():facadeExample();db.items.push(example);}
  db.active=example.id;
  try{const url=new URL(location.href);url.searchParams.delete('example');history.replaceState(null,'',url)}catch{}
}
let p=db.items.find(h=>h.id===db.active)||db.items[0];
for(const saved of db.items){PentiiStructure.normalize(saved);PentiiExtensions.initialize(saved);RoofStudio.initialize(saved);window.PentiiTerraces?.initialize(saved);}
let sectionId=RoofStudio.sections(p)[0]?.id;
let extensionId='';
let view='Объём', tool='Дом', face=0, level=0, selected='', mode='', kind=0;
let previousView='', warning='';
let workspaceMode='inspect';
let editingView='Объём', editingTool='Дом';
let sectionToAdd='add', sectionAnchor='', sectionFeedback=null;
let roofAction='size';
const undoStack=[],redoStack=[];
const clone=o=>JSON.parse(JSON.stringify(o));
function persist(){
  db.items.forEach(PentiiStructure.normalize);
  db.active=p.id;
  try{localStorage.setItem(storageKey,JSON.stringify(db));$('status').textContent='Сохранено на этом устройстве';}
  catch{$('status').textContent='Браузер не сохранил эскиз';}
}
function remember(){undoStack.push(clone(p));if(undoStack.length>50)undoStack.shift();redoStack.length=0;}
function travel(from,to){
  if(!from.length)return;
  to.push(clone(p));const item=from.pop();
  if(tool==='Крыша'||(sectionFeedback&&sectionFeedback.undoItem===item)){
    const oldIds=new Set(RoofStudio.sections(p).map(s=>s.id));
    const restored=RoofStudio.sections(item);
    sectionId=(restored.find(s=>!oldIds.has(s.id))||restored.find(s=>s.id===sectionId)||restored[0])?.id;
    if(workspaceMode==='edit'&&view==='Объём')tool='Крыша';
  }
  sectionFeedback=null;
  db.items[db.items.findIndex(h=>h.id===item.id)]=item;p=item;
  level=Math.min(level,p.n-1);selected='';mode='';warning='';persist();render();
}
function issue(msg){warning=msg||'';$('notice').textContent=warning;$('notice').hidden=!warning;}
function valid(q){
  if(q.id===p.id){
    if(q.w!==p.w||q.d!==p.d){
      window.PentiiTerraces?.followHouse?.(p,q);
      window.RoofStudio?.followHouse?.(p,q);
    }
    window.PentiiTerraces?.followEdits?.(p,q);
    window.PentiiExtensions?.followEdits?.(p,q);
  }
  for(const a of q.ops){
    if(a.floor>=q.n||a.x<-.001||a.sill<-.001||a.x+a.w>wallLen(q,a.f)+.001||a.sill+a.h>q.h+.001)return 'Проём выходит за стену. Уменьшите его или передвиньте.';
    for(const b of q.ops){
      if(a.id===b.id||a.f!==b.f||a.floor!==b.floor)continue;
      if(a.x<b.x+b.w-.001&&b.x<a.x+a.w-.001&&a.sill<b.sill+b.h-.001&&b.sill<a.sill+a.h-.001)return 'Проёмы пересекаются. Подвиньте проём на свободное место.';
    }
  }
  if(q.walls.some(w=>w.floor>=q.n||Math.max(w.a,w.c)>q.w+.001||Math.max(w.b,w.d)>q.d+.001))return 'Перегородка выходит за границы этажа.';
  return window.PentiiExtensions?.validate?.(q)||RoofStudio.validate?.(q)||window.PentiiTerraces?.validate?.(q)||window.Interior?.validate?.(q)||window.StudioYard?.validate?.(q)||'';
}
function applyProject(next,afterChange){
  const message=valid(next);if(message){issue(message);return false;}
  if(JSON.stringify(next)!==JSON.stringify(p)){
    $('resetNotice').hidden=true;
    remember();Object.assign(p,next);persist();
    if(typeof afterChange==='function')afterChange();
  }
  level=Math.min(level,p.n-1);warning='';render();return true;
}
function update(fn){const q=clone(p);fn(q);return applyProject(q);}
function activeExtension(project=p){return window.PentiiExtensions?.list(project).find(e=>e.id===extensionId);}
function openingOwner(project=p){return activeExtension(project)||project;}
function editingModel(project=p){
  const e=activeExtension(project);if(!e)return project;
  const local=PentiiExtensions.model(project,e);
  // Local drawing coordinates; the 3D model keeps the same roofs in world coordinates.
  local.roofSections=RoofStudio.sections(project).filter(s=>s.extensionId===e.id).map(s=>({...clone(s),x:s.x-e.x,z:s.z-e.z}));
  return local;
}
function mergeLocal(local){
  if(!activeExtension())return local;
  const q=clone(p);
  PentiiExtensions.update(q,extensionId,{w:local.w,d:local.d,h:local.h,n:local.n,ops:local.ops,partitions:local.walls,interior:local.interior||[]});
  return q;
}
function validateLocal(local){return valid(mergeLocal(local));}
function commitLocal(local){return applyProject(mergeLocal(local));}
function activeRoof(){
  const sections=RoofStudio.sections(p);
  return sections.find(section=>section.id===sectionId)||sections[0];
}
function runSectionCommand(action,id,point){
  if(workspaceMode!=='edit'||view!=='Объём')return;
  const source=RoofStudio.sections(p).find(s=>s.id===id);
  const result=RoofStudio.changeSections(p,action,id,point);
  if(result.error){issue(result.error);return false;}
  return applyProject(result.project,()=>{
    sectionId=result.sectionId;tool=action==='delete'?'Дом':'Крыша';selected='';mode='';
    const name=RoofStudio.sections(p).find(s=>s.id===sectionId)?.name;
    let message='Добавлена секция «'+name+'».';
    if(action==='delete')message='Секция «'+source.name+'» удалена.';
    if(action==='duplicate')message='Создана копия «'+name+'».';
    sectionFeedback={message,undoItem:undoStack.at(-1)};
  });
}
function startSectionAction(action,id){
  if(workspaceMode!=='edit'||view!=='Объём')return;
  if(action==='add'){
    sectionAnchor=id||'';mode='chooseSection';warning='';sectionFeedback=null;render();
    $('sectionKinds').querySelector('button').focus({preventScroll:true});
  }else if(action==='delete'||action==='copy'){
    return runSectionCommand(action==='copy'?'duplicate':'delete',id);
  }
}
function placeSection(point){
  if(mode==='placeSection')return runSectionCommand(sectionToAdd,sectionAnchor,point);
}
function editRoofInModel(id){
  if(!RoofStudio.sections(p).some(s=>s.id===id))return;
  extensionId=RoofStudio.sections(p).find(s=>s.id===id)?.extensionId||'';
  workspaceMode='edit';view='Объём';tool='Крыша';sectionId=id;mode='';selected='';warning='';render();
}
function sectionCommands(){
  const editable=workspaceMode==='edit'&&view==='Объём';
  const choosing=mode==='chooseSection',placing=mode==='placeSection';
  $('sectionChooser').hidden=!(editable&&(choosing||placing));
  $('sectionKinds').hidden=!choosing;$('sectionAutoPlace').hidden=!placing;
  $('sectionPrompt').textContent=placing?(sectionToAdd==='canopy'?'Нажмите там, где будет навес.':'Нажмите там, где будет секция крыши.'):'Что добавить?';
  const show=editable&&!placing&&!choosing&&sectionFeedback&&sectionFeedback.undoItem===undoStack.at(-1);
  $('sectionFeedback').hidden=!show;
  $('sectionResult').textContent=show?sectionFeedback.message:'';
}
function setView(v){
  if(['План','Фасады'].includes(v)&&activeExtension()?.walls===false){
    tool='Пристройки';view='Объём';mode='';warning='Сначала поставьте стены пристройки, затем добавляйте окна, перегородки и интерьер.';render();return;
  }
  const fromRoof=view==='Кровля'&&v==='Объём';
  const fromTerrace=view==='Террасы'&&v==='Объём';
  view=v;selected='';mode='';warning='';
  tool=fromTerrace?'Террасы':fromRoof?'Крыша':(activeExtension()?(v==='Фасады'?'Проёмы':v==='Объём'?'Пристройки':null):null)||({Террасы:'Террасы',План:'План',Участок:'Участок',Кровля:'Крыша'})[v]||'Дом';
  render();
}
function switchWorkspace(next){
  if(next===workspaceMode)return;
  if(next==='inspect'){
    editingView=view;editingTool=tool;view='Объём';tool='Дом';
  }else{
    view=editingView;tool=editingTool;
  }
  workspaceMode=next;mode='';selected='';warning='';render();
}
function chooseTool(t){
  if(['Проёмы','План','Интерьер','Крыша'].includes(t)&&activeExtension()?.walls===false){
    tool='Пристройки';view='Объём';mode='';warning='Сначала поставьте стены пристройки. Пол и сваи уже готовы.';render();return;
  }
  if(t==='Крыша'&&activeExtension()&&!RoofStudio.sections(p).some(s=>s.extensionId===extensionId)){
    tool='Пристройки';view='Объём';mode='';warning='Выберите форму собственной крыши в разделе пристройки.';render();return;
  }
  tool=t;mode='';warning='';selected='';
  if(['Дом','Конструкции','Террасы','Участок'].includes(t))extensionId='';
  if(t==='Интерьер'||t==='План')view='План';
  else if(t==='Участок')view=t;
  else if(t==='Террасы')view='Террасы';
  else if(t==='Пристройки')view='Объём';
  else if(t==='Крыша'){const own=RoofStudio.sections(p).find(s=>s.extensionId===extensionId);if(extensionId&&own)sectionId=own.id;if(view!=='Кровля')view='Объём';}
  else if(t==='Конструкции'||!['Объём','Фасады'].includes(view))view='Объём';
  render();
}
function button(text,active,fn){
  const b=document.createElement('button');b.textContent=text;b.classList.toggle('on',!!active);b.setAttribute('aria-pressed',String(!!active));b.onclick=fn;return b;
}
const viewNames={Объём:'3D-модель',Фасады:'Чертёж фасада',План:'План этажа',Кровля:'План кровли',Террасы:'План террас',Участок:'План участка'};
function setupSheetSwitcher(){
  const host=$('views');
  if(!host.firstElementChild){
    const label=document.createElement('label');label.textContent='Рабочий лист';
    const select=document.createElement('select');
    for(const [key,text] of Object.entries(viewNames))select.add(new Option(text,key));
    select.onchange=()=>setView(select.value);
    label.append(select);host.append(label);
  }
  host.querySelector('select').value=view;
  host.hidden=workspaceMode==='inspect';
}
function updateCameraUI(camera=window.StudioVolume?.getCamera?.()){
  if(!camera)return;
  if(yardToggle&&typeof camera.yardVisible==='boolean')yardToggle.checked=camera.yardVisible;
  const status=$('cameraStatus');if(status.textContent!==camera.label)status.textContent=camera.label;
  for(const b of $('cameraAngles').querySelectorAll('[data-camera]')){
    const active=b.dataset.camera===camera.preset;
    b.setAttribute('aria-pressed',String(active));b.classList.toggle('on',active);
  }
}
function radios(el,items,active,fn,titles={}){
  el.replaceChildren(...items.map(v=>button(titles[v]||v,active===v,()=>fn(v))));
}
function selectBox(parent,label,values,value,cb){
  const wrap=document.createElement('label');wrap.textContent=label;
  const sel=document.createElement('select');sel.setAttribute('aria-label',label);
  values.forEach((v,i)=>sel.add(new Option(v,String(i),false,i===value)));
  sel.onchange=()=>cb(+sel.value);wrap.append(sel);parent.append(wrap);
}
function setupFields(){
  const area=$('sheetSelect');area.replaceChildren();
  if(view==='Фасады'||view==='План'){
    const parts=PentiiExtensions.list(p).filter(e=>e.walls);
    if(parts.length)selectBox(area,'Часть дома',['Основной дом',...parts.map(e=>e.name)],Math.max(0,parts.findIndex(e=>e.id===extensionId)+1),i=>{extensionId=i?parts[i-1].id:'';level=0;selected='';render();});
  }
  const model=editingModel();
  if(view==='Фасады')selectBox(area,'Сторона дома',faces,face,i=>{face=i;selected='';render();});
  if(view==='План'||(view==='Фасады'&&model.n>1))selectBox(area,'Этаж',Array.from({length:model.n},(_,i)=>String(i+1)),level,i=>{level=i;selected='';render();});
}
function heading(el,title,desc){
  const h=document.createElement('h2');h.textContent=title;el.append(h);
  if(desc){const t=document.createElement('p');t.className='muted';t.textContent=desc;el.append(t);}
}
function choices(el,items,active,fn){
  const grid=document.createElement('div');grid.className='choiceGrid';
  items.forEach((v,i)=>grid.append(button(v,i===active,()=>fn(i))));el.append(grid);
}
function numeric(el,label,key,min,max){
  const wrap=document.createElement('label');wrap.textContent=label;
  const field=document.createElement('input');field.type='number';field.step='any';field.min=min;field.max=max;field.value=p[key];
  field.onchange=()=>{const n=field.valueAsNumber;if(Number.isFinite(n)&&field.reportValidity()&&!update(q=>q[key]=n))field.value=p[key];};
  wrap.append(field);el.append(wrap);
}
function colors(el,k,label){
  const title=document.createElement('label');title.textContent=label;el.append(title);
  const row=document.createElement('div');row.className='swatches';palette[k].forEach(c=>{
    const b=button('',false,()=>update(q=>q[k]=c));b.setAttribute('aria-label',label+' '+c);b.style.background=c;b.className=c===p[k]?'active':'';row.append(b);
  });el.append(row);
}
let houseDimensionsOpen=false;
function dimensions(el){
  const det=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Точные размеры';det.append(summary);
  det.open=houseDimensionsOpen;det.ontoggle=()=>{if(det.isConnected)houseDimensionsOpen=det.open};
  numeric(det,'Ширина, м','w',3,35);numeric(det,'Глубина, м','d',3,35);numeric(det,'Высота этажа, м','h',2.2,6);el.append(det);
}
function extensionControls(el){
  heading(el,'Пристройки','Сначала пол со сваями, затем стены и отдельная крыша. Тяните маркеры прямо на модели.');
  const all=PentiiExtensions.list(p),e=activeExtension();
  if(all.length)selectBox(el,'Выбранная пристройка',all.map(e=>e.name),Math.max(0,all.findIndex(v=>v.id===extensionId)),i=>{extensionId=all[i].id;selected='';render();});
  const add=document.createElement('details');add.className='extensionAdd';add.open=!all.length;
  const summary=document.createElement('summary');summary.textContent='Добавить пол со сваями';add.append(summary);
  const buttons=document.createElement('div');buttons.className='choiceGrid';
  ['Спереди','Справа','Сзади','Слева'].forEach((name,side)=>buttons.append(button(name,false,()=>{
    const q=clone(p),next=PentiiExtensions.add(q,{side,w:4,d:3,h:p.h,walls:false});
    applyProject(q,()=>{extensionId=next.id;selected='';mode='';});
  })));add.append(buttons);el.append(add);
  if(!e){if(all.length){extensionId=all[0].id;return extensionControlsAfter(el,all[0]);}return;}
  extensionControlsAfter(el,e);
}
function extensionControlsAfter(el,e){
  const steps=document.createElement('p');steps.className='extensionSteps';
  const roofs=RoofStudio.sections(p).filter(s=>s.extensionId===e.id);
  steps.textContent='1. Пол и сваи ✓  →  2. Стены '+(e.walls?'✓':'')+'  →  3. Крыша '+(roofs.length?'✓':'');el.append(steps);
  const size=document.createElement('p');size.className='wallSpec';size.textContent=e.name+' · '+fmt(e.w)+' × '+fmt(e.d)+' м · пол в уровне дома';el.append(size);
  const obstacles=(p.yard||[]).filter(o=>{
    if(['path','paving','lawn','flowerbed'].includes(o.type))return false;
    const at=StudioYard.position(p,o),angle=(o.angle||0)*Math.PI/180;
    const rx=(Math.abs(Math.cos(angle))*o.w+Math.abs(Math.sin(angle))*o.d)/2,rz=(Math.abs(Math.sin(angle))*o.w+Math.abs(Math.cos(angle))*o.d)/2;
    return at.x+rx>e.x&&at.x-rx<e.x+e.w&&at.z+rz>e.z&&at.z-rz<e.z+e.d;
  });
  if(obstacles.length){
    const note=document.createElement('p');note.className='small';note.textContent='На месте пристройки есть объекты участка: '+[...new Set(obstacles.map(o=>StudioYard.catalog[o.type]?.title||o.type))].join(', ')+'. Их можно передвинуть в разделе «Участок».';el.append(note);
  }
  if(!e.walls)el.append(button('Поставить стены',false,()=>update(q=>PentiiExtensions.update(q,e.id,{walls:true}))));
  else{
    const walls=document.createElement('div');walls.className='choiceGrid';
    walls.append(button('Окна и двери',false,()=>{tool='Проёмы';mode='';render();}),button('Перегородки',false,()=>{tool='План';view='План';level=0;render();}));el.append(walls);
    const join=PentiiExtensions.contacts(p,e).find(c=>c.neighborId==='main');
    if(join){
      const link=button('Проход в основной дом',false,()=>{extensionId='';face=(join.face+2)%4;view='Фасады';tool='Проёмы';kind=2;mode='';selected='';warning='Поставьте дверь в месте примыкания. Существующее окно можно выбрать и удалить.';render();});
      link.title='Поставьте дверь в общей стене между домом и пристройкой';el.append(link);
    }
    const roofGroup=document.createElement('details');roofGroup.className='extensionRoof';roofGroup.open=!roofs.length;
    const summary=document.createElement('summary');summary.textContent=roofs.length?'Изменить форму крыши':'Выбрать крышу пристройки';roofGroup.append(summary);
    const choices=document.createElement('div');choices.className='choiceGrid';
    [['Двускатная',0],['Вальмовая',1],['Односкатная',2],['Плоская',3],['С парапетом','parapet']].forEach(([label,type])=>choices.append(button(label,false,()=>{
      const q=clone(p),roof=PentiiExtensions.addRoof(q,e.id,type);
      applyProject(q,()=>{sectionId=roof.id;tool='Крыша';mode='';view='Объём';});
    })));roofGroup.append(choices);el.append(roofGroup);
  }
  for(const roof of roofs)el.append(button('Изменить '+roof.name,false,()=>editRoofInModel(roof.id)));
  const detail=document.createElement('details');detail.className='extensionDimensions';
  const summary=document.createElement('summary');summary.textContent='Размеры и положение';detail.append(summary);
  for(const [key,label,min,max] of [['w','Ширина пристройки, м',1,35],['d','Глубина пристройки, м',1,35],['h','Высота стен пристройки, м',2.2,6],['x','Положение X, м',-50,50],['z','Положение Z, м',-50,50]]){
    if(key==='h'&&!e.walls)continue;
    const labelEl=document.createElement('label');labelEl.textContent=label;
    const input=document.createElement('input');input.type='number';input.step='.05';input.min=min;input.max=max;input.value=e[key];input.setAttribute('aria-label',label);
    input.onchange=()=>{if(input.reportValidity()&&Number.isFinite(input.valueAsNumber))update(q=>PentiiExtensions.update(q,e.id,{[key]:input.valueAsNumber}));};labelEl.append(input);detail.append(labelEl);
  }
  el.append(detail);
  const actions=document.createElement('div');actions.className='choiceGrid';
  actions.append(button('Копировать пристройку',false,()=>{const q=clone(p),next=PentiiExtensions.duplicate(q,e.id);applyProject(q,()=>extensionId=next.id);}),
    button('Удалить пристройку',false,()=>{const q=clone(p);PentiiExtensions.remove(q,e.id);applyProject(q,()=>extensionId=PentiiExtensions.list(q)[0]?.id||'');}));
  el.append(actions);
  if(e.walls)el.append(button('Убрать стены и крышу',false,()=>update(q=>{PentiiExtensions.update(q,e.id,{walls:false});q.roofSections=q.roofSections.filter(s=>s.extensionId!==e.id);})));
}
function controls(){
  const el=$('controls');el.replaceChildren();
  if(tool==='Дом'){
    heading(el,'Коробка дома',view==='Объём'?'Нажмите на стену и тяните маркер размера.':'Потяните голубой маркер на краю стены.');
    const parts=PentiiStructure.get(p);
    const spec=document.createElement('p');spec.className='wallSpec';
    spec.textContent='СИП '+parts.wallMm+' мм · '+({mixed:'ЦСП / OSB',cement:'ЦСП / ЦСП',osb:'OSB / OSB'})[parts.wallSkin];el.append(spec);
    selectBox(el,'Этажность',['Один этаж','Два этажа','Три этажа'],p.n-1,i=>{if(!update(q=>q.n=i+1))render()});
    const main=RoofStudio.sections(p).find(s=>!s.canopy);
    const shift=main?p.h*p.n-main.base:0;
    if(Math.abs(shift)>.01){
      const wrap=document.createElement('div');wrap.className='alignRoof';
      const info=document.createElement('p');
      info.textContent='Верх стен '+fmt(p.h*p.n)+' м. Карниз основной крыши '+fmt(main.base)+' м.';
      wrap.append(info,button('Совместить кровлю с верхом стен',false,()=>update(q=>{
        for(const section of q.roofSections)if(!section.extensionId)section.base=+(section.base+shift).toFixed(2);
      })));el.append(wrap);
    }
    selectBox(el,'Материал фасада',skins,skins.indexOf(p.skin),i=>update(q=>q.skin=skins[i]));
    if(p.skin==='Короед'&&window.PentiiPlasterSwatch){
      const figure=document.createElement('figure');figure.className='finishDetail';
      const image=document.createElement('img');image.src=PentiiPlasterSwatch(p.wall);image.alt='Фактура фасадной штукатурки крупным планом';
      const text=document.createElement('figcaption');text.textContent='Короед · фрагмент 225 × 75 мм';
      figure.append(image,text);el.append(figure);
    }
    colors(el,'wall','Цвет стен');dimensions(el);
  }else if(tool==='Пристройки'){
    extensionControls(el);
  }else if(tool==='Крыша'){
    if(view!=='Кровля'){
      const roof=activeRoof();
      RoofStudio.drawControls(el,p,roofEditorOptions());
      const owner=PentiiExtensions.list(p).find(e=>e.id===roof?.extensionId)||p;
      if(roof&&!roof.canopy&&Math.abs(roof.base-owner.h*owner.n)>.005){
        const align=button('Совместить низ крыши с верхом стен',false,()=>applyProject(RoofStudio.editSection(p,roof.id,{base:owner.h*owner.n})));
        align.classList.add('wide');el.append(align);
      }
    }
  }else if(tool==='Террасы'){
    if(view!=='Террасы')PentiiTerraces.editor(el,p,terraceOptions());
  }else if(tool==='Конструкции'){
    PentiiStructure.inspector(el,p,{onCommit:applyProject});
  }else if(tool==='Проёмы'){
    heading(el,'Окна и двери','Выберите тип и щёлкните по стене. Чтобы изменить установленное окно, потяните его за край.');
    choices(el,kinds,mode==='add'?kind:-1,i=>{kind=i;mode='add';selected='';render();});
    const o=openingOwner().ops.find(o=>o.id===selected);
    if(o){
      heading(el,kinds[o.k],fmt(o.w)+' × '+fmt(o.h)+' м · от пола '+fmt(o.sill)+' м');
      productFields(el,o);
      el.append(button('Удалить проём',false,()=>{const id=o.id;selected='';update(q=>{const owner=openingOwner(q);owner.ops=owner.ops.filter(v=>v.id!==id);});}));
    }
    if(mode==='add')el.append(button('Отменить установку',false,()=>{mode='';render();}));
  }else if(tool==='План'){
    heading(el,'Перегородки','Зажмите правую кнопку внутри плана и протяните линию. За конец можно изменить длину, за середину — перенести стену.');
    el.append(button(mode==='wall'?'Завершить рисование':'Карандаш перегородок',mode==='wall',()=>{mode=mode==='wall'?'':'wall';render();}));
    if(editingModel().walls.some(w=>w.id===selected))el.append(button('Удалить перегородку',false,()=>{const id=selected;selected='';const q=clone(editingModel());q.walls=q.walls.filter(w=>w.id!==id);commitLocal(q);}));
  }
}
// Product dimensions are independent of the wall opening. They are kept when
// an opening is resized and flagged in the schedule if they no longer fit.
function productFields(host,o){
  const detail=document.createElement('details');detail.className='productSpec';detail.open=true;
  const title=document.createElement('summary');title.textContent='Изделие для спецификации PDF';detail.append(title);
  const note=document.createElement('p');note.className='small';
  note.textContent='Проём: '+Math.round(o.w*1000)+' × '+Math.round(o.h*1000)+' мм. Размер блока указывается отдельно; незаполненные данные в PDF — «уточнить».';detail.append(note);
  const form=document.createElement('form'),controls={};form.className='productSpecForm';
  for(const [key,label,type] of [['widthMm','Ширина блока, мм','number'],['heightMm','Высота блока, мм','number'],['material','Материал изделия','text'],['color','Цвет изделия','text']]){
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement('input');input.type=type;input.name=key;input.setAttribute('aria-label',label);
    input.value=o.product?.[key]??'';input.placeholder='Уточнить';
    if(type==='number'){input.min='1';input.step='1';input.max=String(Math.round((key==='widthMm'?o.w:o.h)*1000));}
    else input.maxLength=48;
    controls[key]=input;wrap.append(input);form.append(wrap);
  }
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Записать в спецификацию';form.append(submit);
  form.onsubmit=event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const product={};
    for(const [key,input] of Object.entries(controls)){
      const value=input.value.trim();if(value)product[key]=input.type==='number'?Number(value):value;
    }
    update(q=>{const opening=openingOwner(q).ops.find(item=>item.id===o.id);if(opening)opening.product=product;});
  };
  detail.append(form);host.append(detail);
}
function selected2d(id,floor){selected=id||'';if(Number.isInteger(floor))level=floor;if(openingOwner().ops.some(o=>o.id===id))tool='Проёмы';controls();toolTabs();}
function toolTabs(){radios($('tools'),['Дом','Пристройки','Крыша','Террасы','Конструкции','Проёмы','План','Интерьер','Участок'],tool,chooseTool,{Проёмы:'Окна и двери',План:'Перегородки'});}
function terraceOptions(){
  return {
    controls:$('controls'),sectionId,selection:selected,onMessage:issue,
    onCommit:applyProject,
    onPlan:()=>setView('Террасы'),
    onModel:()=>{tool='Террасы';view='Объём';render();},
    onSelect:id=>{
      const changed=sectionId!==id;sectionId=id;
      if(view==='Объём'||(changed&&view==='Террасы')){controls();scene();}
    }
  };
}
function roofEditorOptions(){
  return {
    controls:$('controls'),sectionId:activeRoof()?.id,
    roofAction,onRoofAction:chooseRoofAction,
    onCommit:applyProject,onMessage:issue,
    onPlan:()=>setView('Кровля'),
    onTerrace:id=>{sectionId=id;setView('Террасы');},
    onSelect:id=>{sectionId=id;mode='';if(view==='Объём'){sectionCommands();controls();scene();}}
  };
}
function chooseRoofAction(action){
  roofAction=action;
  const roof=activeRoof();
  if(roof)RoofStudio.toolsFor(p,roof).mode='';
  controls();scene();
}
function volumeSelection(obj){
  if(workspaceMode==='inspect'||tool==='Конструкции')return;
  selected='';mode='';extensionId=obj?.extensionId||'';
  if(obj?.type==='extension'||(obj?.type==='wall'&&extensionId)){tool='Пристройки';}
  else if(obj?.type==='terrace'||(obj?.type==='column'&&RoofStudio.sections(p).some(s=>s.id===obj.sectionId&&s.terrace))){
    sectionId=obj.sectionId;selected=obj.postId||obj.entryId||obj.part||'';PentiiTerraces.selectPart?.(p,obj);tool='Террасы';
  }else if(obj?.type==='roof'||obj?.type==='column'){sectionId=obj.sectionId;extensionId=RoofStudio.sections(p).find(s=>s.id===sectionId)?.extensionId||'';tool='Крыша';}
  else if(obj?.type==='opening'){selected=obj.id;face=obj.face;tool='Проёмы';}
  else tool='Дом';
  controls();toolTabs();sectionCommands();
}
function scene(){
  const host=$('scene');if(previousView==='Объём'&&view!=='Объём')window.StudioVolume?.hide();
  const inspect=workspaceMode==='inspect';
  previousView=view;$('photoRender').hidden=view!=='Объём'||tool==='Конструкции';
  $('cameraAngles').hidden=view!=='Объём';$('cameraStatus').hidden=view!=='Объём';
  const help=$('hint');const captions={Террасы:'Выберите террасу. Тяните край настила, стойку или вход на плане.',Фасады:'Щёлкните по стене, чтобы поставить окно. Тяните голубые маркеры, чтобы менять размеры.',План:'Правой кнопкой протяните перегородку. На сенсорном экране используйте карандаш.',Объём:'Для изменения ската выберите «Крыша». Для осмотра другой стороны дома потяните фон.',Кровля:'Выберите секцию. Потяните её за край, чтобы изменить вынос кровли.',Участок:'Выберите объект в каталоге и поставьте его на участок.'};
  if(inspect)help.textContent='Тяните для поворота. Чтобы изменить секцию крыши, дважды нажмите на неё.';
  else if(mode==='add')help.textContent='Щёлкните по свободному участку стены для установки.';
  else if(view==='Объём'&&tool==='Пристройки')help.textContent='Тяните маркеры ширины и глубины, чтобы изменить пристройку. За маркер перемещения подведите её к дому.';
  else if(view==='Объём')help.textContent='Нажмите на скат или навес, чтобы выбрать секцию. Потяните фон, чтобы повернуть дом.';
  else help.textContent=captions[view];
  if(view==='Террасы'){
    PentiiTerraces.draw(host,p,terraceOptions());
  }else if(view==='Кровля'){
    RoofStudio.draw(host,p,roofEditorOptions());
  }else if(view==='План'&&tool==='Интерьер'){
    help.textContent='Выберите предмет и поставьте его в комнате. Потяните установленный предмет, чтобы передвинуть.';
    window.Interior.draw(host,editingModel(),{level,onCommit:commitLocal,controls:$('controls'),onMessage:issue});
  }else if(view==='Участок'){
    window.StudioYard.mount({project:p,scene:host,controls:$('controls'),onBeforeChange:remember,onChange:()=>{persist();historyButtons();},onHint:t=>help.textContent=t});
  }else if(view==='Объём'){
    const model=tool==='Конструкции'?p:{...p,structure:{...p.structure,view:'finish'}};
    const ok=window.StudioVolume.show(host,model,{
      inspect,validate:valid,change:applyProject,notice:issue,mode,kind,
      editRoof:tool==='Крыша',editExtension:tool==='Пристройки',extensionId,editTerrace:tool==='Террасы',sectionId:tool==='Террасы'?(p.roofSections.find(s=>s.id===sectionId&&s.terrace)||p.roofSections.find(s=>s.terrace))?.id:activeRoof()?.id,exposeStructure:tool==='Конструкции',
      onMode:m=>mode=m,select:volumeSelection,
      onSectionAction:startSectionAction,onPlaceSection:placeSection,onEditSection:editRoofInModel,
      roofAction,onRoofAction:chooseRoofAction
    });
    if(ok===false){workspaceMode='edit';setView('Фасады');issue('Браузер не открыл 3D-модель. Можно работать с чертежами или открыть студию в браузере с WebGL.');}
    else updateCameraUI();
  }else{
    window.Direct2D.draw(host,editingModel(),{view,face,level,selected,mode,kind,validate:validateLocal,onCommit:commitLocal,onMessage:issue,onSelect:selected2d,onMode:m=>{mode=m;controls();}});
  }
}
function historyButtons(){$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;}
function render(){
  const inspect=workspaceMode==='inspect';
  document.body.dataset.mode=workspaceMode;
  for(const b of $('workspaceModes').querySelectorAll('[data-mode]')){
    const active=b.dataset.mode===workspaceMode;
    b.setAttribute('aria-pressed',String(active));b.classList.toggle('on',active);
  }
  const extent=PentiiExtensions.bounds(p);
  $('title').textContent=p.name;$('stats').textContent=fmt(extent.w)+' × '+fmt(extent.d)+' м   ·   '+fmt(p.w*p.d*p.n+PentiiExtensions.list(p).reduce((a,e)=>a+e.w*e.d*e.n,0))+' м² по внешнему контуру'+(PentiiExtensions.list(p).length?' · пристроек '+PentiiExtensions.list(p).length:'');
  $('sheetTitle').textContent=({Фасады:'Фасад дома',План:'План этажа',Объём:'3D-модель',Кровля:'Кровля и опоры',Террасы:'Террасы и входы',Участок:'Генеральный план'})[view];
  setupSheetSwitcher();setupFields();sectionCommands();
  if(!inspect){toolTabs();controls();}
  historyButtons();issue(warning);scene();
}
for(const b of $('sectionKinds').querySelectorAll('[data-section-kind]')){
  b.onclick=()=>{
    if(mode!=='chooseSection')return;
    sectionToAdd=b.dataset.sectionKind;mode='placeSection';render();
    $('scene').querySelector('canvas')?.focus({preventScroll:true});
  };
}
function cancelSectionPlacement(){
  if(mode!=='chooseSection'&&mode!=='placeSection')return;
  mode='';warning='';render();$('scene').querySelector('canvas')?.focus({preventScroll:true});
}
$('cancelSection').onclick=cancelSectionPlacement;
$('sectionAutoPlace').onclick=()=>placeSection();
$('undoSection').onclick=()=>{if(sectionFeedback?.undoItem===undoStack.at(-1))travel(undoStack,redoStack)};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&(mode==='chooseSection'||mode==='placeSection')&&!document.querySelector('dialog[open]')){
    e.preventDefault();cancelSectionPlacement();
  }
});
for(const b of $('workspaceModes').querySelectorAll('[data-mode]'))b.onclick=()=>switchWorkspace(b.dataset.mode);
for(const b of $('cameraAngles').querySelectorAll('[data-camera]'))b.onclick=()=>window.StudioVolume?.setCamera(b.dataset.camera);
const yardToggle=$('showYard');
if(yardToggle)yardToggle.onchange=()=>window.StudioVolume.setYardVisible(yardToggle.checked);
window.addEventListener('pentii-camera-change',e=>updateCameraUI(e.detail));
const panel=document.querySelector('.canvasPanel');
$('fullScene').onclick=async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else if(panel.requestFullscreen)await panel.requestFullscreen();
    else panel.classList.toggle('expanded');
  }catch{panel.classList.toggle('expanded');}
  fullSceneLabel();
};
function fullSceneLabel(){
  const label=document.fullscreenElement||panel.classList.contains('expanded')?'Выйти из полного экрана':'На весь экран';
  $('fullScene').setAttribute('aria-label',label);$('fullScene').title=label;
}
document.addEventListener('fullscreenchange',fullSceneLabel);
$('rotate').onclick=()=>window.StudioVolume.rotate();
$('undo').onclick=()=>travel(undoStack,redoStack);$('redo').onclick=()=>travel(redoStack,undoStack);
document.addEventListener('keydown',e=>{if(workspaceMode==='edit'&&(e.ctrlKey||e.metaKey)&&e.code==='KeyZ'&&!e.target.closest('input,select,textarea,dialog')){e.preventDefault();if(e.shiftKey)$('redo').click();else $('undo').click();}});
function openProject(h,nextMode='inspect'){
  $('resetNotice').hidden=true;
  p=h;extensionId='';RoofStudio.initialize(p);window.PentiiTerraces?.initialize(p);sectionId=RoofStudio.sections(p)[0]?.id;sectionFeedback=null;
  level=0;face=0;workspaceMode=nextMode;editingView='Объём';editingTool='Дом';view='Объём';
  undoStack.length=redoStack.length=0;$('library').close();persist();setView('Объём');
  if(view==='Объём')window.StudioVolume.setCamera('front');
}
// Recognition always creates a separate editable sketch after the manager's review.
window.PentiiImportApply=project=>{
  const next=clone(project);next.id=uid();
  const error=valid(next);if(error)throw new Error(error);
  persist();db.items.push(next);openProject(next,'edit');
  window.StudioVolume?.setCamera('corner');
  $('resetNotice').textContent='Создан отдельный эскиз по загруженному материалу. Прежний проект сохранён в «Моих эскизах».';
  $('resetNotice').hidden=false;return true;
};
// Portable sketch files open as independent copies; the current sketch is retained.
window.PentiiProjectFiles={
  getCurrent:()=>clone(p),
  applyClone(project){
    window.PentiiProjectTransfer.validateProject(project);
    const next=clone(project);next.id=uid();delete next.example;
    PentiiStructure.normalize(next);PentiiExtensions.initialize(next);RoofStudio.initialize(next);window.PentiiTerraces?.initialize(next);
    const error=valid(next);if(error)throw new Error(error);
    persist();db.items.push(next);openProject(next,'edit');window.StudioVolume?.setCamera('corner');
    $('resetNotice').textContent='Открыта отдельная копия эскиза из файла. Предыдущие проекты остались в «Моих эскизах».';
    $('resetNotice').hidden=false;return true;
  }
};
$('projects').onclick=()=>{$('list').replaceChildren(...db.items.map(h=>button(h.name+' · '+fmt(h.w)+' × '+fmt(h.d)+' м',h===p,()=>openProject(h))));$('library').showModal();};
$('resetHouse').onclick=()=>{
  const house=standardHouse();
  const unchanged=standardSignature(p)===standardSignature(house);
  if(!unchanged)db.items.push(house);
  openProject(unchanged?p:house);
  window.StudioVolume?.setYardVisible(true);
  window.StudioVolume?.setCamera('corner');
  const notice=$('resetNotice');
  notice.textContent=unchanged?'Открыт стандартный дом 8 × 6 м с двускатной крышей.':
    'Дом сброшен к стандартному 8 × 6 м. Предыдущий эскиз сохранён в «Моих эскизах».';
  notice.hidden=false;
};
function createProject(withCanopy){
  const h=standardHouse(withCanopy);h.name=(withCanopy?'Дом с навесом':'Дом')+' '+(db.items.length+1);db.items.push(h);openProject(h,'edit');$('rename').click();
}
$('variant').onclick=()=>{
  const next=clone(p);delete next.example;next.id=uid();
  const base=p.name.replace(/ · вариант \d+$/,'');
  let n=2;while(db.items.some(h=>h.name===base+' · вариант '+n))n++;
  next.name=base+' · вариант '+n;db.items.push(next);openProject(next,'edit');
};
$('new').onclick=()=>createProject(false);
$('newCanopy').onclick=()=>createProject(true);
$('close').onclick=()=>$('library').close();$('rename').onclick=()=>{$('nameInput').value=p.name;$('titleBox').showModal();$('nameInput').select();};
$('cancelName').onclick=()=>$('titleBox').close();
for(const dialog of [$('library'),$('titleBox')]){
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
}
$('titleBox').querySelector('form').onsubmit=e=>{const name=$('nameInput').value.trim();if(!name){e.preventDefault();return}update(q=>q.name=name);};
if(new URLSearchParams(location.search).get('edit')==='roof'){
  workspaceMode='edit';tool='Крыша';
}
persist();render();
if(startedStandard)window.StudioVolume?.setCamera('corner');

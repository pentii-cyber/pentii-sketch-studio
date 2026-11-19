/* A portable editable sketch contains project data only, never browser storage
   or connection settings. Opening it always creates a separate local copy. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.PentiiProjectTransfer=api;api.mount();}
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const FORMAT='pentii-sketch',VERSION=1,MAX_BYTES=1024*1024;
  const numeric=new Set('w d h n x y z a b c base pitch e ridge roof f k sill floor u v angle r width height depth run at side edge size lift span center thickness direction plotWidth plotDepth wallMm panelLengthMm atticPanelLengthMm overhang'.split(' '));
  const projectKeys=new Set('id name w d n h roof ridge pitch e roofFinish wall top skin ops walls interior yard roofSections extensions structure plotWidth plotDepth fasciaColor gutterColor gutterSystem gutters outletSide soffitColor soffits importedFrom example parapet'.split(' '));
  const dangerous=new Set(['__proto__','prototype','constructor']);
  const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
  const fail=text=>{throw new Error(text);};
  function inspect(value,depth=0,state={nodes:0},key=''){
    if(++state.nodes>25000||depth>18)fail('Файл эскиза слишком сложный.');
    if(numeric.has(key)&&typeof value!=='number')fail('Размеры и координаты должны быть числами.');
    if(value===null)return;
    if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>10000)fail('В эскизе есть недопустимое числовое значение.');return;}
    if(typeof value==='boolean')return;
    if(typeof value==='string'){
      if(value.length>12000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail('В эскизе есть недопустимый текст.');
      if(numeric.has(key))fail('Размеры и координаты должны быть числами.');
      if((key==='id'||key==='extensionId')&&!/^[A-Za-z0-9_.:-]{1,100}$/.test(value))fail('Некорректный идентификатор элемента.');
      if(/Color$/.test(key)&&!/^#[\da-f]{6}$/i.test(value))fail('Некорректный цвет элемента.');
      return;
    }
    if(Array.isArray(value)){if(value.length>1000)fail('В эскизе слишком много элементов.');for(const item of value)inspect(item,depth+1,state);return;}
    if(!plain(value))fail('Файл содержит неподдерживаемые данные.');
    for(const [name,item] of Object.entries(value)){if(dangerous.has(name))fail('Файл содержит недопустимое поле.');inspect(item,depth+1,state,name);}
  }
  function number(v,min,max,label,integer=false){if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))fail('Проверьте '+label+'.');}
  function list(v,label,max=300){if(!Array.isArray(v)||v.length>max)fail('Проверьте '+label+'.');return v;}
  function identifiers(items,label){const seen=new Set();for(const item of items){if(!plain(item)||typeof item.id!=='string'||!item.id||seen.has(item.id))fail('Проверьте идентификаторы: '+label+'.');seen.add(item.id);}}
  function localPart(p,annex=false){
    number(p.w,annex?.6:3,35,'ширину дома');number(p.d,annex?.6:3,35,'глубину дома');number(p.h,2.2,6,'высоту этажа');number(p.n,1,3,'количество этажей',true);
    const openings=list(p.ops,'проёмы');identifiers(openings,'проёмы');
    for(const o of openings){
      number(o.f,0,3,'сторону проёма',true);number(o.k,0,3,'вид проёма',true);number(o.floor,0,p.n-1,'этаж проёма',true);
      number(o.w,.2,35,'ширину проёма');number(o.h,.2,6,'высоту проёма');number(o.x,0,35,'положение проёма');number(o.sill,0,6,'высоту подоконника');
    }
    const walls=list(annex?p.partitions:p.walls,'перегородки');identifiers(walls,'перегородки');
    for(const w of walls){for(const key of ['a','c'])number(w[key],0,p.w,'координаты перегородки');for(const key of ['b','d'])number(w[key],0,p.d,'координаты перегородки');number(w.floor,0,p.n-1,'этаж перегородки',true);}
    const interior=list(p.interior??[],'предметы интерьера');identifiers(interior,'интерьер');
    for(const i of interior){if(typeof i.key!=='string'||!/^[a-zA-Z]{1,40}$/.test(i.key))fail('Неизвестный предмет интерьера.');number(i.x,0,p.w,'положение предмета');number(i.y,0,p.d,'положение предмета');number(i.r,-3600,3600,'поворот предмета');number(i.floor,0,p.n-1,'этаж предмета',true);}
  }
  function validateProject(project){
    inspect(project);if(!plain(project))fail('Выберите файл эскиза ПЕНТИИ.');
    for(const key of Object.keys(project))if(!projectKeys.has(key))fail('Неподдерживаемое поле эскиза: '+key+'.');
    if(typeof project.name!=='string'||!project.name.trim()||project.name.length>64)fail('Название эскиза должно содержать от 1 до 64 символов.');
    for(const key of ['wall','top'])if(typeof project[key]!=='string'||!/^#[\da-f]{6}$/i.test(project[key]))fail('Проверьте цвета дома.');
    for(const key of ['skin','roofFinish'])if(project[key]!==undefined&&(typeof project[key]!=='string'||project[key].length>100||/[<>"']/.test(project[key])))fail('Проверьте материалы дома.');
    localPart(project);number(project.roof,0,7,'форму крыши',true);number(project.ridge,0,1,'направление конька',true);number(project.pitch,2,65,'уклон кровли');number(project.e,0,6,'свес кровли');
    for(const key of ['plotWidth','plotDepth'])if(project[key]!==undefined)number(project[key],3,200,'размер участка');
    if(project.structure!==undefined&&!plain(project.structure))fail('Проверьте конструкцию дома.');
    const annexes=list(project.extensions??[],'пристройки',12);identifiers(annexes,'пристройки');
    for(const e of annexes){number(e.x,-60,60,'положение пристройки');number(e.z,-60,60,'положение пристройки');if(typeof e.walls!=='boolean')fail('Проверьте стены пристройки.');localPart(e,true);}
    const roofs=list(project.roofSections??[],'секции кровли',16);identifiers(roofs,'кровля');
    for(const r of roofs){for(const key of ['posts','dormers','disabledDormers','liftPoints'])if(r[key]!==undefined)list(r[key],'элементы кровли',64);if(r.terrace){if(!plain(r.terrace))fail('Проверьте террасу.');list(r.terrace.stairs,'ступени террасы',64);list(r.terrace.edges,'ограждения террасы',4);}}
    const yard=list(project.yard??[],'объекты участка');identifiers(yard,'участок');
    for(const y of yard){if(typeof y.type!=='string'||!/^[a-zA-Z]{1,40}$/.test(y.type))fail('Неизвестный объект участка.');for(const key of ['u','v'])number(y[key],-200,200,'положение объекта участка');for(const key of ['w','d'])number(y[key],.1,200,'размер объекта участка');number(y.angle,-3600,3600,'поворот объекта участка');}
    return project;
  }
  function encode(project){
    validateProject(project);
    const text=JSON.stringify({format:FORMAT,version:VERSION,exportedAt:new Date().toISOString(),project},null,2);
    if(new TextEncoder().encode(text).length>MAX_BYTES)fail('Эскиз больше 1 МБ. Уменьшите количество элементов.');
    return text;
  }
  function decode(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)fail('Выберите файл эскиза размером до 1 МБ.');
    let data;try{data=JSON.parse(text);}catch{fail('Файл не удалось прочитать. Нужен эскиз ПЕНТИИ в формате JSON.');}
    inspect(data);
    if(!plain(data)||data.format!==FORMAT||data.version!==VERSION||!plain(data.project))fail('Это не файл эскиза ПЕНТИИ поддерживаемой версии.');
    if(Object.keys(data).some(key=>!['format','version','exportedAt','project'].includes(key)))fail('Файл содержит неподдерживаемые поля.');
    return validateProject(data.project);
  }
  function mount(){
    const library=document.getElementById('library');if(!library||document.getElementById('projectTransfer'))return;
    const element=(tag,attrs={},text='')=>{const el=document.createElement(tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);el.textContent=text;return el;};
    const box=element('section',{id:'projectTransfer','aria-label':'Перенос эскиза'});
    box.append(element('h3',{},'Сохранить и передать эскиз'),element('p',{class:'muted'},'Автосохранение работает только в этом браузере. Скачайте эскиз, чтобы хранить копию или открыть её на другом компьютере. PDF отправляйте клиенту, а JSON используйте для продолжения работы.'));
    const actions=element('div',{class:'row'}),save=element('button',{type:'button',id:'downloadProject'},'Скачать эскиз'),open=element('button',{type:'button',id:'openProjectFile'},'Открыть эскиз');
    const input=element('input',{id:'projectFile',type:'file',accept:'.json,application/json',hidden:'','aria-label':'Файл эскиза ПЕНТИИ'});
    const status=element('p',{id:'projectTransferStatus',role:'status','aria-live':'polite'}),link=element('a',{id:'projectDownloadLink',hidden:'',download:''},'Скачать файл ещё раз');
    actions.append(save,open);box.append(actions,input,status,link);library.append(box);
    let lastURL='';
    save.onclick=()=>{try{
      const project=window.PentiiProjectFiles.getCurrent(),text=encode(project);if(lastURL)URL.revokeObjectURL(lastURL);
      lastURL=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));link.href=lastURL;link.download=(project.name.replace(/[\\/?:*|"<>]/g,'_').slice(0,64)||'Эскиз ПЕНТИИ')+'.pentii.json';link.hidden=false;link.click();
      status.textContent='Файл эскиза подготовлен. Если скачивание не началось, нажмите ссылку ниже.';
    }catch(error){status.textContent=error.message||'Не удалось сохранить эскиз.';}};
    open.onclick=()=>{input.value='';input.click();};
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;open.disabled=true;status.textContent='Открываю копию эскиза…';try{
      if(file.size>MAX_BYTES)fail('Файл эскиза должен быть не больше 1 МБ.');
      const project=decode(await file.text());window.PentiiProjectFiles.applyClone(project);status.textContent='Эскиз открыт отдельной копией. Предыдущие эскизы сохранены.';
    }catch(error){status.textContent=error.message||'Не удалось открыть эскиз.';}finally{open.disabled=false;input.value='';}};
  }
  return {FORMAT,VERSION,MAX_BYTES,validateProject,encode,decode,mount};
});

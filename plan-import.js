/* Uploads are sent only after an explicit recognition action. The API key never
   enters this module; the local server owns the OpenAI request. */
window.PentiiPlanImport=(()=>{
  'use strict';
  const MAX_FILE=10*1024*1024,MAX_TOTAL=20*1024*1024,LOCAL_URL='http://127.0.0.1:8792/?import=1';
  const supported=['image/jpeg','image/png','image/webp','application/pdf'];
  const roofNames=['Двускатная','Вальмовая','Односкатная','Плоская','Мансардная','Шатровая','Бабочка','Асимметричная'];
  let files=[],draft=null,converted=null,serverWarnings=[],configured=false,csrf='',busy=false;
  let request=null,statusRequest=null,generation=0,openedBefore=false;
  const make=(tag,attrs={},text='')=>{const n=document.createElement(tag);for(const [key,value] of Object.entries(attrs)){if(key==='class')n.className=value;else n.setAttribute(key,value);}if(text)n.textContent=text;return n;};
  const byId=id=>document.getElementById(id);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const dialog=make('dialog',{id:'planImportBox','aria-labelledby':'planImportHeading'});
  const top=make('div',{class:'importHeader'}),heading=make('div');
  heading.append(make('p',{class:'importEyebrow'},'Новый эскиз из изображения'),make('h2',{id:'planImportHeading'},'Дом по планировке или фото'));
  const closeButton=make('button',{id:'closePlanImport',type:'button'},'Закрыть');top.append(heading,closeButton);dialog.append(top);
  const intro=make('p',{class:'importIntro'},'Загрузите план, фасад или визуализацию. Студия соберёт редактируемый эскиз, а вы уточните размеры перед созданием дома.');dialog.append(intro);
  const portable=make('div',{id:'importPortable',class:'importConnection',hidden:''});
  portable.append(make('h3',{},'Откройте студию с распознаванием'),make('p',{},'Распознавание работает в версии по локальной ссылке. Сначала запустите «ПЕНТИИ — открыть студию.command» на этом Mac.'));
  const localLink=make('a',{href:LOCAL_URL,target:'_blank',rel:'noopener',class:'primary importLink'},'Открыть студию с распознаванием');portable.append(localLink,make('p',{class:'importFine'},'Эскизы из открытого HTML-файла остаются в нём. Загруженный дом будет создан отдельно в версии по ссылке.'));dialog.append(portable);
  const source=make('form',{id:'importSourceForm'});
  const fileLabel=make('label',{class:'importDrop',id:'importDrop'});
  fileLabel.append(make('strong',{},'Выбрать планировку или фото'),make('span',{},'PDF, JPG, PNG или WEBP · до 4 файлов'),make('span',{class:'importFine'},'Не более 10 МБ на файл и 20 МБ вместе'));
  const fileInput=make('input',{id:'importFiles',type:'file',accept:'.pdf,.jpg,.jpeg,.png,.webp',multiple:'','aria-label':'Планировки или изображения дома'});fileLabel.append(fileInput);source.append(fileLabel);
  const fileList=make('div',{id:'importFileList',class:'importFileList'});source.append(fileList);
  const options=make('div',{class:'importOptions'});
  const kindLabel=make('label',{},'Что загружено'),kind=make('select',{id:'importKind'});
  for(const [value,label] of [['auto','Определить автоматически'],['plan','Планировка / чертёж'],['visualization','Фото / визуализация дома']])kind.append(make('option',{value},label));kindLabel.append(kind);options.append(kindLabel);
  const widthLabel=make('label',{},'Ширина основной части дома, м'),mainWidth=make('input',{id:'importKnownWidth',type:'number',min:'3',max:'35',step:'0.01',placeholder:'Если известна',inputmode:'decimal'});widthLabel.append(mainWidth);options.append(widthLabel);source.append(options);
  const noteLabel=make('label',{class:'importNotes'},'Что учесть'),notes=make('textarea',{id:'importNotes',rows:'2',maxlength:'1500',placeholder:'Например: вход со стороны дороги, 2 этажа, пристройка справа.'});noteLabel.append(notes);source.append(noteLabel);
  const disclosure=make('p',{class:'importFine'},'После нажатия «Распознать» выбранные файлы будут отправлены в OpenAI. По фотографии размеры и невидимые части дома могут потребовать уточнения.');source.append(disclosure);
  const connection=make('div',{id:'importConnection',class:'importConnection',role:'status'}),connectionText=make('span');
  const retryStatus=make('button',{type:'button',id:'retryImportConnection'},'Повторить подключение');connection.append(connectionText,retryStatus);source.append(connection);
  const error=make('p',{id:'importError',class:'importError',role:'alert',hidden:''});dialog.append(error);
  const sourceActions=make('div',{class:'importActions'}),recognize=make('button',{id:'recognizePlan',type:'submit',class:'primary',disabled:''},'Распознать');sourceActions.append(recognize);source.append(sourceActions);dialog.append(source);
  const progress=make('section',{id:'importProgress',class:'importProgress',hidden:'','aria-live':'polite'});
  progress.append(make('h3',{},'Распознаю дом'),make('p',{},'Читаю размеры, расположение стен и проёмов. Для нескольких страниц PDF это может занять пару минут.'));
  const progressBar=make('progress',{'aria-label':'Распознавание планировки'}),cancel=make('button',{id:'cancelPlanRecognition',type:'button'},'Отменить распознавание');progress.append(progressBar,cancel);dialog.append(progress);
  const review=make('section',{id:'importReview',hidden:''});
  const reviewTop=make('div',{class:'importReviewTop'}),scaleBadge=make('span',{id:'importScale',class:'importScale'});reviewTop.append(make('h3',{},'Проверьте распознанный эскиз'),scaleBadge);review.append(reviewTop);
  const summary=make('p',{id:'importSummary'});review.append(summary);
  const reviewGrid=make('div',{class:'importReviewGrid'}),drawing=make('div',{id:'importPreview',class:'importPreview','aria-label':'Контуры распознанного дома'}),detail=make('div',{class:'importReviewDetails'});reviewGrid.append(drawing,detail);
  const reviewForm=make('form',{id:'importReviewForm'}),fieldMap={};
  const nameLabel=make('label',{},'Название эскиза'),nameInput=make('input',{id:'importHouseName',type:'text',maxlength:'64',required:''});nameLabel.append(nameInput);reviewForm.append(nameLabel);
  const dimensions=make('div',{class:'importDimensions'});
  for(const [key,label,min,max,step] of [['w','Ширина, м',3,35,.01],['d','Глубина, м',3,35,.01],['h','Высота этажа, м',2.2,6,.01],['n','Этажей',1,3,1]]){
    const wrap=make('label',{},label),input=make('input',{type:'number',id:'importDimension-'+key,min,max,step,required:'','aria-label':label});fieldMap[key]=input;wrap.append(input);dimensions.append(wrap);
  }reviewForm.append(dimensions);
  const roofLabel=make('label',{},'Крыша основной части'),roofSelect=make('select',{id:'importRoof'});roofSelect.append(make('option',{value:''},'Не определена — выбрать позже'));roofNames.forEach((label,i)=>roofSelect.append(make('option',{value:String(i)},label)));roofSelect.append(make('option',{value:'parapet'},'Плоская с парапетом'));roofLabel.append(roofSelect);reviewForm.append(roofLabel);detail.append(reviewForm);
  detail.append(make('p',{class:'importFine'},'Ширина и глубина меняют масштаб плана с проёмами и пристройками. Отдельные элементы можно будет доработать прямо на 3D-модели.'));
  const counts=make('p',{id:'importCounts',class:'importCounts'});detail.append(counts);review.append(reviewGrid);
  const warningsBox=make('div',{id:'importWarnings',class:'importWarnings'});review.append(warningsBox);
  const reviewActions=make('div',{class:'importActions'}),back=make('button',{id:'backToImport',type:'button'},'Изменить исходные файлы'),create=make('button',{id:'createImportedHouse',type:'button',class:'primary'},'Создать редактируемый дом');reviewActions.append(back,create);review.append(reviewActions);dialog.append(review);
  document.body.append(dialog);
  function problem(message){error.textContent=String(message||'').slice(0,800);error.hidden=!message;}
  function sourceButtons(){recognize.disabled=busy||!configured||!files.length;}
  function sourceAvailable(value){
    for(const node of [fileLabel,fileList,options,noteLabel,disclosure,sourceActions])node.hidden=!value;
    intro.textContent=value?'Загрузите план, фасад или визуализацию. Студия соберёт редактируемый эскиз, а вы уточните размеры перед созданием дома.':'Автоматическое распознавание в этой версии пока недоступно. Создайте дом в редакторе или откройте готовый файл эскиза через «Мои эскизы».';
  }
  function setBusy(value){intro.hidden=!!draft;busy=value;progress.hidden=!value;source.hidden=value||!!draft;review.hidden=value||!draft;closeButton.textContent=value?'Отменить и закрыть':'Закрыть';sourceButtons();}
  const errorLabels={billing_inactive:'В проекте OpenAI не активирована оплата API. Владелец студии должен активировать её в настройках OpenAI Platform.',not_recognized:'На файле не удалось уверенно распознать дом или планировку. Загрузите более чёткий план, фасад или другое изображение дома.',quota:'На счёте API закончились средства или достигнут лимит. Обратитесь к владельцу студии.',auth:'Подключение распознавания недоступно: ключ истёк или не действует. Обратитесь к владельцу студии.',model_access:'Для подключённого проекта недоступна модель распознавания.',network:'Не удалось связаться с сервисом распознавания. Попробуйте ещё раз.',timeout:'Сервис не успел закончить распознавание. Попробуйте загрузить меньше страниц.',busy:'Сейчас уже распознаётся другой файл. Дождитесь завершения и повторите.',invalid_file:'Не удалось прочитать файл. Используйте PDF, JPG, PNG или WEBP.',too_large:'Файлы слишком большие. До 10 МБ на файл и 20 МБ вместе.'};
  function errorMessage(value,fallback){const e=value?.error||value;return errorLabels[e?.code]||String(e?.message||((typeof e==='string')?e:fallback)||'Не удалось распознать дом.');}
  async function connect(){
    if(location.protocol==='file:')return;
    statusRequest?.abort();statusRequest=new AbortController();const current=statusRequest;
    configured=false;sourceButtons();sourceAvailable(false);connection.hidden=false;connectionText.textContent='Проверяю доступность распознавания…';retryStatus.hidden=true;
    const timer=setTimeout(()=>current.abort(),10000);
    try{
      const response=await fetch('api/status',{signal:current.signal,cache:'no-store'}),data=await response.json();
      if(current!==statusRequest)return;
      if(!response.ok)throw new Error(errorMessage(data,'Не удалось подключить распознавание.'));
      configured=!!data.configured&&typeof data.csrf==='string'&&data.csrf.length>8;csrf=configured?data.csrf:'';
      sourceAvailable(configured);
      connection.hidden=configured;
      if(!configured){connectionText.textContent='Редактор дома, рендер и PDF доступны. Подключение распознавания выполняет владелец студии.';retryStatus.hidden=data.mode==='manual';}
    }catch(e){if(current!==statusRequest)return;sourceAvailable(false);connectionText.textContent='Распознавание сейчас недоступно. Можно продолжить работу с домом в редакторе, сохранить эскиз и скачать PDF.';retryStatus.hidden=false;}
    finally{clearTimeout(timer);sourceButtons();}
  }
  function mime(file){if(supported.includes(file.type))return file.type;const ext=file.name.split('.').pop().toLowerCase();return ({pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'})[ext]||'';}
  function clearFiles(){for(const item of files)if(item.url)URL.revokeObjectURL(item.url);files=[];fileInput.value='';renderFiles();}
  function addFiles(list){
    problem('');const added=[];
    if(files.length+list.length>4){problem('Можно загрузить до 4 файлов. Удалите лишний файл и повторите.');return;}
    let total=files.reduce((sum,item)=>sum+item.file.size,0);
    for(const file of list){const type=mime(file);if(!type){problem('Файл «'+file.name+'» не поддерживается. Выберите PDF, JPG, PNG или WEBP.');return;}if(!file.size||file.size>MAX_FILE){problem('Файл «'+file.name+'» должен быть непустым и не больше 10 МБ.');return;}total+=file.size;if(total>MAX_TOTAL){problem('Общий размер файлов не должен превышать 20 МБ.');return;}added.push({file,type});}
    for(const item of added){if(item.type!=='application/pdf')item.url=URL.createObjectURL(item.file);files.push(item);}fileInput.value='';renderFiles();sourceButtons();
  }
  function renderFiles(){
    fileList.replaceChildren();for(const item of files){const card=make('div',{class:'importFile'});if(item.url)card.append(make('img',{src:item.url,alt:'Предпросмотр '+item.file.name}));else card.append(make('span',{class:'importPdfIcon','aria-hidden':'true'},'PDF'));const info=make('span',{class:'importFileInfo'});info.append(make('strong',{},item.file.name),make('span',{},(item.file.size/1024/1024).toLocaleString('ru-RU',{maximumFractionDigits:1})+' МБ'));const remove=make('button',{type:'button','aria-label':'Удалить '+item.file.name},'Убрать');remove.onclick=()=>{if(item.url)URL.revokeObjectURL(item.url);files=files.filter(v=>v!==item);renderFiles();sourceButtons();};card.append(info,remove);fileList.append(card);}
  }
  const readFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Не удалось прочитать выбранный файл.'));reader.readAsDataURL(file);});
  async function recognizeFiles(event){
    event.preventDefault();if(busy||!configured||!files.length||!source.reportValidity())return;
    problem('');draft=null;converted=null;request?.abort();request=new AbortController();const id=++generation,controller=request;setBusy(true);
    const timer=setTimeout(()=>controller.abort('timeout'),160000);
    try{
      const payload={files:await Promise.all(files.map(async item=>({name:item.file.name,type:item.type,data:await readFile(item.file)}))),kind:kind.value,mainWidth:mainWidth.value?mainWidth.valueAsNumber:null,notes:notes.value.trim()};
      if(id!==generation)return;
      const response=await fetch('api/import',{method:'POST',headers:{'Content-Type':'application/json','X-Pentii-Token':csrf},body:JSON.stringify(payload),signal:controller.signal});
      let data;try{data=await response.json();}catch{throw new Error('Сервис вернул неполный ответ. Попробуйте ещё раз.');}
      if(!response.ok)throw new Error(errorMessage(data,'Не удалось распознать дом.'));
      if(id!==generation)return;
      const description=data.description,reason=PentiiImportModel.validate(description);if(reason)throw new Error('Нужно уточнить исходный чертёж: '+reason);
      const result=PentiiImportModel.convert(description);draft=clone(description);converted=result;serverWarnings=Array.isArray(data.warnings)?data.warnings.filter(v=>typeof v==='string'):[];
      loadReview();setBusy(false);review.scrollIntoView({block:'nearest'});
    }catch(e){if(id!==generation)return;setBusy(false);problem(controller.signal.aborted?(controller.signal.reason==='timeout'?errorLabels.timeout:'Распознавание отменено. Можно выбрать другой файл или повторить.'):e.message);}
    finally{clearTimeout(timer);if(id===generation){request=null;sourceButtons();}}
  }
  function cancelRecognition(){generation++;request?.abort();request=null;draft=null;converted=null;setBusy(false);problem('Распознавание отменено.');}
  function loadReview(){
    nameInput.value=draft.title;for(const key of Object.keys(fieldMap))fieldMap[key].value=draft.main[key];
    roofSelect.value=draft.main.roof?(draft.main.roof.parapet_height>0?'parapet':String(draft.main.roof.type)):'';
    refreshReview();
  }
  function applyReviewFields(){
    if(!draft)return false;
    if(!reviewForm.reportValidity()){create.disabled=true;return false;}
    try{
      let candidate=PentiiImportModel.rescale(draft,fieldMap.w.valueAsNumber,fieldMap.d.valueAsNumber);
      candidate.title=nameInput.value.trim();candidate.main.h=fieldMap.h.valueAsNumber;candidate.main.n=fieldMap.n.valueAsNumber;
      const type=roofSelect.value;
      if(type==='')candidate.main.roof=null;
      else if(type==='parapet')candidate.main.roof={...(candidate.main.roof||{ridge:0,e:.3}),type:3,pitch:3,parapet_height:candidate.main.roof?.parapet_height||.45};
      else if(!candidate.main.roof||candidate.main.roof.type!==Number(type)||candidate.main.roof.parapet_height>0)candidate.main.roof={type:Number(type),ridge:candidate.main.roof?.ridge||0,pitch:[2,3].includes(Number(type))?3:30,e:candidate.main.roof?.e??.3,parapet_height:0};
      const reason=PentiiImportModel.validate(candidate);if(reason)throw new Error(reason);
      const next=PentiiImportModel.convert(candidate);draft=candidate;converted=next;problem('');refreshReview();return true;
    }catch(e){create.disabled=true;problem(e.message);return false;}
  }
  function refreshReview(){
    create.disabled=false;summary.textContent=draft.summary;
    scaleBadge.textContent=({dimensioned:'Размеры прочитаны с чертежа',estimated:'Размеры оценены — уточните',unknown:'Масштаб не указан — уточните'})[draft.scale_status]||'Проверьте размеры';
    scaleBadge.dataset.estimated=String(draft.scale_status!=='dimensioned');
    const parts=[converted.project,...(converted.project.extensions||[])];
    const windows=parts.reduce((sum,p)=>sum+(p.ops||[]).filter(o=>o.k<2).length,0),doors=parts.reduce((sum,p)=>sum+(p.ops||[]).filter(o=>o.k>=2).length,0),walls=parts.reduce((sum,p)=>sum+(Array.isArray(p.walls)?p.walls:p.partitions||[]).length,0);
    counts.textContent='Частей дома: '+parts.length+' · окон: '+windows+' · дверей: '+doors+' · перегородок: '+walls;
    warningsBox.replaceChildren();const warnings=[...new Set([...(draft.assumptions||[]),...(draft.warnings||[]),...(converted.warnings||[]),...serverWarnings])].filter(v=>typeof v==='string'&&v.trim());
    if(warnings.length){warningsBox.append(make('h4',{},'Что уточнить'),make('p',{class:'importFine'},'Это предположения распознавания. Их можно исправить сейчас или после создания дома.'));const list=make('ul');for(const warning of warnings.slice(0,20))list.append(make('li',{},warning));warningsBox.append(list);}warningsBox.hidden=!warnings.length;
    renderPlan(converted.project);
  }
  function renderPlan(project){
    const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 600 430');svg.setAttribute('role','img');svg.setAttribute('aria-label','План распознанного дома: стены, проёмы и перегородки');
    const parts=[{...project,x:0,z:0,name:'Основной дом'},...(project.extensions||[])],xmin=Math.min(...parts.map(p=>p.x)),xmax=Math.max(...parts.map(p=>p.x+p.w)),zmin=Math.min(...parts.map(p=>p.z)),zmax=Math.max(...parts.map(p=>p.z+p.d));
    const scale=Math.min(510/(xmax-xmin),320/(zmax-zmin)),X=x=>300+(x-(xmin+xmax)/2)*scale,Z=z=>205+(z-(zmin+zmax)/2)*scale;
    function shape(tag,attrs,text){const n=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));if(text)n.textContent=text;svg.append(n);return n;}
    for(const part of parts){
      shape('rect',{x:X(part.x),y:Z(part.z),width:part.w*scale,height:part.d*scale,fill:part.walls===false?'#edf5e8':'#f9fcff',stroke:'#1e5679','stroke-width':3});
      const model=part===parts[0]?project:part,openingPoint=(face,u)=>face===0?[part.x+u,part.z+part.d]:face===1?[part.x+part.w,part.z+part.d-u]:face===2?[part.x+part.w-u,part.z]:[part.x,part.z+u];
      for(const wall of (Array.isArray(model.walls)?model.walls:model.partitions||[]).filter(w=>w.floor===0))shape('path',{d:'M'+X(part.x+wall.a)+' '+Z(part.z+wall.b)+'L'+X(part.x+wall.c)+' '+Z(part.z+wall.d),stroke:'#365a73','stroke-width':3,fill:'none'});
      for(const o of (model.ops||[]).filter(o=>o.floor===0)){const a=openingPoint(o.f,o.x),b=openingPoint(o.f,o.x+o.w);shape('path',{d:'M'+X(a[0])+' '+Z(a[1])+'L'+X(b[0])+' '+Z(b[1]),stroke:o.k<2?'#31a2d0':'#b68a56','stroke-width':6,fill:'none'});}
      shape('text',{x:X(part.x+part.w/2),y:Z(part.z+part.d/2)-5,'text-anchor':'middle',fill:'#173e58','font-size':13,'paint-order':'stroke',stroke:'#fff','stroke-width':4},part.name||'Пристройка');
      shape('text',{x:X(part.x+part.w/2),y:Z(part.z+part.d/2)+15,'text-anchor':'middle',fill:'#315d76','font-size':12,'paint-order':'stroke',stroke:'#fff','stroke-width':4},part.w.toLocaleString('ru-RU')+' × '+part.d.toLocaleString('ru-RU')+' м');
    }
    shape('text',{x:300,y:28,'text-anchor':'middle',fill:'#466a82','font-size':15},'План первого этажа');shape('text',{x:300,y:404,'text-anchor':'middle',fill:'#466a82','font-size':13},'Синие проёмы — окна · коричневые — двери');drawing.replaceChildren(svg);
  }
  async function createProject(){
    if(!applyReviewFields())return;
    if(typeof window.PentiiImportApply!=='function'){problem('Не удалось открыть редактор. Обновите страницу студии и повторите.');return;}
    create.disabled=true;
    if(converted.project.importedFrom)converted.project.importedFrom.reviewedAt=new Date().toISOString();
    try{const accepted=await window.PentiiImportApply(converted.project);if(accepted===false){create.disabled=false;problem('Проверьте геометрию распознанного дома.');return;}clearFiles();draft=null;converted=null;close();}
    catch(e){create.disabled=false;problem(e.message||'Не удалось создать эскиз.');}
  }
  function open(){
    if(!dialog.open)dialog.showModal();problem('');intro.hidden=!!draft;portable.hidden=location.protocol!=='file:';
    source.hidden=location.protocol==='file:'||busy||!!draft;review.hidden=location.protocol==='file:'||!draft;progress.hidden=!busy;
    if(location.protocol!=='file:')connect();
    if(!openedBefore){openedBefore=true;if(!portable.hidden)localLink.focus();else fileInput.focus();}
  }
  function close(){generation++;request?.abort();statusRequest?.abort();request=null;busy=false;progress.hidden=true;closeButton.textContent='Закрыть';dialog.close();sourceButtons();}
  fileInput.onchange=()=>addFiles([...fileInput.files]);source.onsubmit=recognizeFiles;retryStatus.onclick=connect;closeButton.onclick=close;cancel.onclick=cancelRecognition;
  reviewForm.onsubmit=e=>{e.preventDefault();applyReviewFields();};reviewForm.onchange=applyReviewFields;
  back.onclick=()=>{draft=null;converted=null;intro.hidden=false;problem('');source.hidden=false;review.hidden=true;sourceButtons();};create.onclick=createProject;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
  for(const event of ['dragenter','dragover'])fileLabel.addEventListener(event,e=>{e.preventDefault();fileLabel.classList.add('isDragging');});
  for(const event of ['dragleave','drop'])fileLabel.addEventListener(event,e=>{e.preventDefault();fileLabel.classList.remove('isDragging');if(event==='drop')addFiles([...e.dataTransfer.files]);});
  byId('importPlanButton')?.addEventListener('click',open);
  if(new URLSearchParams(location.search).get('import')==='1')open();
  window.addEventListener('beforeunload',()=>{for(const item of files)if(item.url)URL.revokeObjectURL(item.url);});
  return {open,close};
})();

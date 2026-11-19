'use strict';
function imageOf(url){return new Promise((resolve,reject)=>{let i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url})}
function wallSection(ctx,s,x,y,w){
 const layers=[[s.outside,s.outside==='osb'?12:10],['core',s.coreMm],[s.inside,s.inside==='osb'?12:10]];
 const colors={cement:'#a6b1b5',osb:'#c5a57d',core:'#eff2ec'};
 ctx.fillStyle='#234862';ctx.font='bold 23px Arial';ctx.fillText('Разрез стены · '+s.wallMm+' мм',x,y);
 let left=x;
 for(const [kind,thickness] of layers){
   const span=w*thickness/s.wallMm;
   ctx.save();ctx.beginPath();ctx.rect(left,y+24,span,64);ctx.clip();ctx.fillStyle=colors[kind];ctx.fillRect(left,y+24,span,64);
   ctx.strokeStyle=kind==='osb'?'#977955':'#c4cec8';ctx.lineWidth=1.3;
   for(let n=0;n<Math.ceil(span*1.25);n++){
     const a=left+(n*19.37)%span,b=y+24+(n*31.27)%64;
     ctx.beginPath();if(kind==='core')ctx.arc(a,b,2.5,0,2*Math.PI);else{ctx.moveTo(a,b);ctx.lineTo(a+(n%2?5:-4),b+3);}
     ctx.stroke();
   }
   ctx.restore();ctx.strokeStyle='#93a9b2';ctx.strokeRect(left,y+24,span,64);left+=span;
 }
 ctx.fillStyle='#34536b';ctx.font='19px Arial';ctx.fillText('Снаружи',x,y+118);
 ctx.textAlign='right';ctx.fillText('Изнутри',x+w,y+118);ctx.textAlign='left';
}
const pdfViews=[
  {key:'overview',tab:'Общий вид',title:'Общий вид'},
  {key:'front',tab:'Спереди',title:'Главный фасад'},
  {key:'side',tab:'Справа',title:'Правый фасад'},
  {key:'rear',tab:'Сзади',title:'Задний фасад'},
  {key:'left',tab:'Слева',title:'Левый фасад'},
  {key:'top',tab:'Сверху',title:'Дом и кровля сверху'}
];
const pdfPalette={ink:'#112e43',muted:'#456174',rule:'#c7d5dd',blue:'#066b9c',paper:'#ffffff'};
const pdfPageWidth=1684,pdfPageHeight=1190;
function pdfSheets(q){
  const sectionList=RoofStudio.sections(q),terraces=sectionList.filter(s=>s.terrace);
  const hasExtensions=!!window.PentiiExtensions?.list(q).length;
  const main=hasExtensions?{...q,extensions:[],roofSections:sectionList.filter(s=>!s.extensionId)}:q;
  const bounds=hasExtensions?PentiiExtensions.bounds(q):{w:q.w,d:q.d};
  const coverCamera=['garden','photoRight','gardenRear','photoLeft'][terraces[0]?.terrace.side]||'corner';
  const pages=pdfViews.map((v,i)=>({
    ...v,section:'3D-визуализация',preset:i===0?coverCamera:v.key,facadeScale:i>0&&i<5,
    title:i===0?q.name:!sectionList.length&&v.key==='top'?'Дом сверху':v.title,
    sub:i===0?'Эскизный проект  ·  '+fmt(bounds.w)+' × '+fmt(bounds.d)+' м'+(hasExtensions?'  ·  дом с пристройками':'  ·  '+q.n+' эт.'):q.name
  }));
  const mainPages=[...ArchitecturalSheets.pages(main),...StructuralSheets.pages(main)];
  if(hasExtensions)for(const page of mainPages){page.title='Основной дом · '+page.title;page.sub=[page.sub,'Размеры и марки относятся к основному дому'].filter(Boolean).join(' · ');}
  pages.push(hasExtensions?ExtensionSheets.sitePlan(q):{title:'План участка',art:StudioYard.plan(q)},...mainPages);
  if(hasExtensions)pages.push(...ExtensionSheets.pages(q));
  if(terraces.length&&PentiiTerraces.svgPlan)pages.push({title:'План террас и входов',sub:'Отметка настила 0,000  ·  в уровень с полом дома',art:PentiiTerraces.svgPlan(q)});
  pages.push({title:hasExtensions?'Конструкции дома и пристроек':'Конструкции дома',section:'Состав дома',details:[['Фундамент','foundation'],['Перекрытие','floor'],['СИП-панели','panels']],lines:PentiiStructure.summary(q)});
  const roofList=['Покрытие: '+RoofStudio.materialLabel(q.roofFinish)+'   ·   Подшивка свесов: '+(q.soffits===false?'отключена':'предусмотрена')+'   ·   Водосток: '+(q.gutters===false?'отключён':'предусмотрен'),
    ...sectionList.map((s,i)=>(i+1)+'. '+s.name+' · '+RoofStudio.shapeLabel(s)+' · '+fmt(s.w)+' × '+fmt(s.d)+' м · основание '+fmt(s.base)+' м · '+(s.parapet?'парапет ':'верх кровли ')+fmt(RoofStudio.overallHeight(s))+' м · '+(s.roof===3?'плоская':s.pitch+'°')+' · опор '+s.posts.length)];
  for(const s of sectionList){
    for(const [i,d] of (s.dormers||[]).entries())roofList.push(s.name+' · кукушка '+(i+1)+' · '+fmt(d.width)+' × '+fmt(d.depth)+' м');
    if(s.liftPoints?.length)roofList.push(s.name+' · изменение высот: '+s.liftPoints.map(pt=>(pt.lift>0?'+':'')+fmt(pt.lift)+' м').join(', '));
  }
  function appendSchedule(title,sub,lines){
    for(let i=0;i<lines.length;i+=14)pages.push({title,sub,section:'Ведомости',lines:lines.slice(i,i+14)});
  }
  if(sectionList.length)appendSchedule('Секции кровли','Размеры, отметки и уклоны',roofList);
  if(q.importedFrom){
    const origin=q.importedFrom,wrap=value=>String(value||'').match(/.{1,95}(?:\s|$)|.{1,95}/g)?.map(line=>line.trim())||[];
    const records=[origin.kind==='plan'?'Эскиз создан по загруженной планировке.':'Эскиз создан по загруженному изображению дома.',
      origin.scaleStatus==='dimensioned'?'Размеры прочитаны с исходного материала; проверьте их перед согласованием.':'Масштаб и часть размеров определены приблизительно и требуют уточнения.',
      origin.reviewedAt?'Параметры подтверждены пользователем при создании эскиза.':'Параметры требуют подтверждения в редакторе.',
      origin.summary,...(origin.assumptions||[]).map(text=>'Принято: '+text),...(origin.warnings||[]).map(text=>'Уточнить: '+text)].filter(Boolean);
    appendSchedule('Исходные данные эскиза','Распознавание изображения · принятые параметры и неопределённости',records.flatMap(wrap));
  }

  return pages;
}
function pdfText(ctx,message,x,y,size,{color=pdfPalette.ink,bold=false,align='left',width}={}){
  ctx.fillStyle=color;ctx.font=(bold?'600 ':'')+size+'px Onest, Arial, sans-serif';
  ctx.textAlign=align;
  if(width)ctx.fillText(message,x,y,width);else ctx.fillText(message,x,y);
  ctx.textAlign='left';
}
function pdfRule(ctx,x,y,end){
  ctx.strokeStyle=pdfPalette.rule;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(end,y);ctx.stroke();
}
function pdfHeader(ctx,logo,q,page,index,total){
  const {ink,muted,blue,paper}=pdfPalette;
  ctx.fillStyle=paper;ctx.fillRect(0,0,pdfPageWidth,pdfPageHeight);
  ctx.drawImage(logo,65,27,68,48);
  pdfText(ctx,'ПЕНТИИ   /   СТУДИЯ ЭСКИЗОВ',156,59,19,{color:muted,bold:true});
  pdfText(ctx,page.section||'Архитектурные чертежи',1619,59,20,{color:blue,align:'right'});
  pdfRule(ctx,65,90,1619);
  pdfText(ctx,page.title,64,153,51,{bold:true,color:ink,width:1554});
  pdfText(ctx,page.sub||q.name,66,190,24,{color:muted,width:1550});
  pdfRule(ctx,65,1104,1619);
  pdfText(ctx,'Предварительный эскиз для обсуждения. Для строительства требуется рабочий проект.',65,1151,19,{color:muted,width:1350});
  pdfText(ctx,(index+1)+'  /  '+total,1619,1151,20,{color:ink,align:'right',bold:true});
}
function pdfNavigator(ctx,index){
  const targets=[...pdfViews.map(v=>v.tab),'Чертежи'];
  const links=[];let x=65;
  for(const [j,label] of targets.entries()){
    ctx.font='600 19px Onest, Arial, sans-serif';
    const w=Math.ceil(ctx.measureText(label).width)+42,y=1036,h=45,active=index===j;
    ctx.fillStyle=active?pdfPalette.ink:'#eff5f8';ctx.beginPath();ctx.roundRect(x,y,w,h,9);ctx.fill();
    pdfText(ctx,label,x+w/2,y+29,19,{bold:true,align:'center',color:active?'#ffffff':pdfPalette.blue});
    if(!active)links.push({x,y,w,h,to:j});
    x+=w+11;
  }
  return links;
}
async function pdfImage(q,view,capture={}){
  const src=await StudioVolume.snapshot({...q,structure:{...q.structure,view}},capture);
  if(!src)throw new Error('Для 3D-видов требуется WebGL. Включите аппаратное ускорение в браузере и откройте эскиз заново.');
  return imageOf(src);
}
async function album(q,onProgress=()=>{},signal){
  const logo=await imageOf(PentiiBrand.logo);
  await document.fonts?.ready;
  const pages=pdfSheets(q),structure=PentiiStructure.get(q),result=[];
  const verify=()=>{if(signal?.aborted)throw new DOMException('Подготовка PDF отменена','AbortError')};
  for(const [index,page] of pages.entries()){
    verify();
    const report=(fraction=0)=>onProgress({page:index+1,total:pages.length,title:page.title,percent:Math.floor(100*(index+fraction)/pages.length)});
    report();
    const canvas=document.createElement('canvas');canvas.width=pdfPageWidth;canvas.height=pdfPageHeight;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Браузеру не хватило памяти для страницы PDF. Закройте другие вкладки с 3D и повторите.');
    try{
    pdfHeader(ctx,logo,q,page,index,pages.length);
    let links;
    if(page.preset){
      const im=await pdfImage(q,'finish',{preset:page.preset,facadeScale:page.facadeScale,yardVisible:!page.facadeScale,width:1472,height:768,final:true,samples:4,signal,onProgress:(i,n)=>report(.85*i/n)});
      ctx.drawImage(im,65,209,1554,811);
      im.src='';
      links=pdfNavigator(ctx,index);
    }else if(page.art){
      const sized=page.art.replace(/<svg[^>]*>/,tag=>tag.replace(/ (?:width|height|style)="[^"]*"/g,'').replace('<svg ','<svg width="1530" height="901" '));
      const im=await imageOf('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sized));
      const scale=Math.min(1554/im.width,860/im.height),w=im.width*scale,h=im.height*scale;
      ctx.drawImage(im,(pdfPageWidth-w)/2,209+(860-h)/2,w,h);
      im.src='';
    }else if(page.details){
      for(const [j,[name,view]] of page.details.entries()){
        verify();const x=65+j*522;
        const im=await pdfImage(q,view,{preset:'top',width:650,height:360});
        ctx.drawImage(im,x,242,510,282);
        im.src='';
        pdfText(ctx,name,x,562,24,{bold:true});report((j+1)/4);
      }
      page.lines.forEach((line,j)=>pdfText(ctx,line,65,653+j*47,23,{width:1050}));
      wallSection(ctx,structure,1170,652,418);
    }else{
      page.lines.forEach((line,j)=>{const y=252+j*54;pdfText(ctx,line,66,y,23,{width:1550});pdfRule(ctx,65,y+18,1619)});
    }
    verify();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
    if(!blob)throw new Error('Браузеру не удалось записать страницу альбома.');
    result.push({title:index===0?'Общий вид':page.title,bytes:new Uint8Array(await blob.arrayBuffer()),links:links||[]});
    }finally{canvas.width=canvas.height=1;}
  }
  verify();return buildPdf(result,q.name);
}
function pdfUnicode(text){
  let hex='feff';
  for(let i=0;i<text.length;i++)hex+=text.charCodeAt(i).toString(16).padStart(4,'0');
  return '<'+hex+'>';
}
function buildPdf(pages,title){
  const parts=[],offset=[0],ascii=new TextEncoder();
  let length=0,next=3+pages.length*3;
  const outlines=next++,bookmarks=pages.map(()=>next++),info=next++;
  function put(value){const b=typeof value==='string'?ascii.encode(value):value;parts.push(b);length+=b.length}
  function obj(i,...sections){offset[i]=length;put(i+' 0 obj\n');sections.forEach(put);put('\nendobj\n')}
  const pageId=i=>3+i*3,ref=id=>id+' 0 R';
  put('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R /Outlines '+ref(outlines)+' /PageLayout /SinglePage /ViewerPreferences << /DisplayDocTitle true >> >>');
  obj(2,'<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>ref(pageId(i))).join(' ')+'] >>');
  pages.forEach(({bytes,links},i)=>{
    const id=pageId(i),annotations=links.map(link=>{
      const a=next++,r=[link.x/2,(pdfPageHeight-link.y-link.h)/2,(link.x+link.w)/2,(pdfPageHeight-link.y)/2];
      obj(a,'<< /Type /Annot /Subtype /Link /Rect ['+r.join(' ')+'] /Border [0 0 0] /Dest ['+ref(pageId(link.to))+' /Fit] >>');return ref(a);
    });
    obj(id,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im '+ref(id+1)+' >> >> /Contents '+ref(id+2)+(annotations.length?' /Annots ['+annotations.join(' ')+']':'')+' >>');
    obj(id+1,'<< /Type /XObject /Subtype /Image /Width '+pdfPageWidth+' /Height '+pdfPageHeight+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n',bytes,'\nendstream');
    const stream='q 842 0 0 595 0 0 cm /Im Do Q';obj(id+2,'<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');
  });
  obj(outlines,'<< /Type /Outlines /First '+ref(bookmarks[0])+' /Last '+ref(bookmarks.at(-1))+' /Count '+pages.length+' >>');
  bookmarks.forEach((id,i)=>obj(id,'<< /Parent '+ref(outlines)+' /Title '+pdfUnicode(pages[i].title)+' /Dest ['+ref(pageId(i))+' /Fit]'+(i?' /Prev '+ref(bookmarks[i-1]):'')+(i+1<pages.length?' /Next '+ref(bookmarks[i+1]):'')+' >>'));
  obj(info,'<< /Title '+pdfUnicode(title+' — Эскизный проект')+' /Author '+pdfUnicode('ПЕНТИИ')+' >>');
  const start=length;put('xref\n0 '+offset.length+'\n0000000000 65535 f \n');offset.slice(1).forEach(v=>put(String(v).padStart(10,'0')+' 00000 n \n'));
  put('trailer\n<< /Size '+offset.length+' /Root 1 0 R /Info '+ref(info)+' >>\nstartxref\n'+start+'\n%%EOF\n');return new Blob(parts,{type:'application/pdf'});
}
let pdfController=null,pdfReady=null;
const pdfBox=$('pdfBox');
function closePdf(){
  if(pdfController){pdfController.abort();$('pdfProgressText').textContent='Отменяем подготовку…';}
  else pdfBox.close();
}
$('closePdf').onclick=closePdf;
pdfBox.addEventListener('cancel',event=>{event.preventDefault();closePdf()});
pdfBox.addEventListener('click',event=>{
  if(event.target!==pdfBox)return;
  const r=pdfBox.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closePdf();
});
function showReadyPdf(){
  $('pdfProgress').hidden=true;
  $('pdfProgressText').textContent='Эскизный проект готов';
  $('pdfSummary').textContent=pdfReady.name+' · '+pdfReady.pages+' листов · '+(pdfReady.size/1048576).toFixed(1)+' МБ. Скачайте файл или откройте его для просмотра и сохранения.';
  $('savePdf').href=$('openPdf').href=pdfReady.url;
  $('savePdf').download='ПЕНТИИ — '+pdfReady.name.replace(/[\/:*?"<>|]/g,'-')+'.pdf';
  $('pdfActions').hidden=false;$('closePdf').textContent='Закрыть';
}
$('export').onclick=async()=>{
  if(pdfController)return;
  const q=JSON.parse(JSON.stringify(p)),signature=JSON.stringify(q);
  if(!pdfBox.open)pdfBox.showModal();
  if(pdfReady?.signature===signature){showReadyPdf();return;}
  const controller=new AbortController();pdfController=controller;
  const b=$('export'),status=$('status'),main=document.querySelector('main'),projects=$('projects');
  const original={inert:main.inert,disabled:projects.disabled};
  main.inert=true;projects.disabled=true;b.disabled=true;
  $('pdfProgress').hidden=false;$('pdfProgress').value=0;
  $('pdfProgressText').textContent='Подготавливаем эскизный проект…';
  $('pdfSummary').textContent='3D-виды, размерные планы, фасады, разрезы и ведомости. Это может занять некоторое время.';
  $('pdfActions').hidden=true;$('closePdf').textContent='Отменить';
  try{
    // Save links are activated by a real click after rendering, also in Safari.
    // Keep the Blob alive so a delayed or repeated save is still available.
    const blob=await album(q,({title,percent,page,total})=>{
      $('pdfProgress').value=percent;
      $('pdfProgressText').textContent=percent+'% · Лист '+page+' из '+total+' · '+title;
      status.textContent='PDF · '+title;
    },controller.signal);
    if(controller.signal.aborted)throw new DOMException('Подготовка отменена','AbortError');
    if(pdfReady)URL.revokeObjectURL(pdfReady.url);
    pdfReady={signature,url:URL.createObjectURL(blob),name:q.name,size:blob.size,pages:pdfSheets(q).length};
    showReadyPdf();status.textContent='PDF готов · '+q.name;
  }catch(error){
    if(controller.signal.aborted){pdfBox.close();status.textContent='Подготовка PDF отменена.';}
    else{
      $('pdfProgress').hidden=true;$('pdfProgressText').textContent='Не удалось подготовить PDF';
      $('pdfSummary').textContent=error?.message||'Проверьте, открывается ли 3D-модель, и повторите.';
      $('closePdf').textContent='Закрыть';status.textContent='PDF не создан.';
    }
  }finally{
    pdfController=null;main.inert=original.inert;projects.disabled=original.disabled;b.disabled=false;
  }
};

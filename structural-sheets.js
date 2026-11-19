/* The layout is generated from the same parts as the 3D model. Original PENTII
   details are clearly distinguished from the dimensions of the current sketch. */
window.StructuralSheets=(()=>{
  'use strict';
  const ink='#193c56',blue='#1374a3',muted='#547084',rule='#bfd0db',wood=['#e7ceaa','#d9b889','#c79f70'];
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const mm=v=>String(Math.round(v*1000));
  const r=v=>Math.round(v*100)/100;
  const line=(x,y,a,b,c=rule,w=1,extra='')=>`<line x1="${r(x)}" y1="${r(y)}" x2="${r(a)}" y2="${r(b)}" stroke="${c}" stroke-width="${w}" ${extra}/>`;
  const rect=(x,y,w,h,c='white',stroke=ink,sw=1)=>`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${c}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const text=(x,y,value,size=19,color=ink,anchor='start',extra='')=>`<text x="${r(x)}" y="${r(y)}" font-size="${size}" fill="${color}" text-anchor="${anchor}" ${extra}>${esc(value)}</text>`;
  function wrap(value,length=43){const words=String(value).split(/\s+/),out=[''];for(const word of words){const i=out.length-1;if((out[i]+' '+word).trim().length>length&&out[i])out.push(word);else out[i]=(out[i]+' '+word).trim()}return out;}
  function notes(lines,x=1020,y=125,width=40){
    let out='';for(const value of lines){for(const row of wrap(value,width)){out+=text(x,y,row,19);y+=27}y+=17}return out;
  }
  function page(title,body,sub='',note='Эскизная раскладка. Размеры — мм. Сечения и шаг опор требуют проверки в рабочем проекте.'){
    return {title,sub,section:'Конструктивные схемы',art:`<svg xmlns="http://www.w3.org/2000/svg" width="1530" height="900" viewBox="0 0 1530 900" font-family="Arial,sans-serif">${rect(0,0,1530,900,'white','none')}${text(25,36,title.toUpperCase(),23,ink,'start','font-weight="bold"')}${body}${line(25,845,1505,845)}${text(25,877,note,16,muted)}</svg>`};
  }
  function frame(q){
    const scale=Math.min(750/q.w,510/q.d),x=520-q.w*scale/2,y=405-q.d*scale/2;
    return {scale,x,y,X:v=>x+v*scale,Z:v=>y+v*scale};
  }
  function dim(a,b,c,y,label,vertical=false){
    if(b-a<1)return '';
    if(vertical)return line(c,a,y-8,a)+line(c,b,y-8,b)+line(y,a,y,b,blue)+line(y-5,a+5,y+5,a-5,blue)+line(y-5,b+5,y+5,b-5,blue)+text(y-11,(a+b)/2,label,18,blue,'middle',`transform="rotate(-90 ${r(y-11)} ${r((a+b)/2)})"`);
    return line(a,c,a,y+8)+line(b,c,b,y+8)+line(a,y,b,y,blue)+line(a-5,y+5,a+5,y-5,blue)+line(b-5,y+5,b+5,y-5,blue)+text((a+b)/2,y-10,label,18,blue,'middle');
  }
  function bounds(q,f){return rect(f.x,f.y,q.w*f.scale,q.d*f.scale,'none',muted,1.5)+dim(f.x,f.X(q.w),f.y,f.y-75,mm(q.w))+dim(f.y,f.Z(q.d),f.x,f.x-80,mm(q.d),true)+text(520,785,'Главный фасад',18,muted,'middle');}
  function pilePlan(q){
    const s=PentiiStructure.get(q),layout=PentiiStructure.pileLayout(q),f=frame(q);let body=bounds(q,f);
    if(s.foundation==='piles'){
      for(const x of layout.xs)body+=line(f.X(x),f.y-12,f.X(x),f.Z(q.d)+20,rule,1,'stroke-dasharray="8 5"');
      for(const z of layout.zs)body+=line(f.x-12,f.Z(z),f.X(q.w)+20,f.Z(z),rule,1,'stroke-dasharray="8 5"');
      for(const pile of layout.piles){const size=Math.max(6,f.scale*.1);body+=rect(f.X(pile.x)-size/2,f.Z(pile.z)-size/2,size,size,ink,ink)+text(f.X(pile.x)+8,f.Z(pile.z)-8,pile.tag,Math.min(17,Math.max(10,f.scale*.2)),blue);}
      for(let i=1;i<layout.xs.length;i++)body+=dim(f.X(layout.xs[i-1]),f.X(layout.xs[i]),f.y,f.y-30,mm(layout.xs[i]-layout.xs[i-1]));
      for(let i=1;i<layout.zs.length;i++)body+=dim(f.Z(layout.zs[i-1]),f.Z(layout.zs[i]),f.x,f.x-35,mm(layout.zs[i]-layout.zs[i-1]),true);
      body+=notes([layout.label,'Опор в эскизе: '+layout.piles.length+'.','Профиль 100 × 100 мм. Бетон заполнения скважин и основания сваи — М250.',
        'Оси ростверка совпадают с рядами свай.','Схема автоматически следует габаритам дома. Это предварительная сетка опор, а не расчёт несущей способности.','Диаметр скважины, глубина, толщина трубы и армирование назначаются рабочим проектом.']);
    }else{
      if(s.foundation==='slab')body+=rect(f.X(-.11),f.Z(-.11),(q.w+.22)*f.scale,(q.d+.22)*f.scale,'#d9e0e4',ink,2);
      else{
        for(const z of [.12,q.d-.12])body+=rect(f.X(-.06),f.Z(z-.18),(q.w+.12)*f.scale,.36*f.scale,'#d9e0e4',ink);
        for(const x of [.12,q.w-.12])body+=rect(f.X(x-.18),f.Z(.3),.36*f.scale,(q.d-.6)*f.scale,'#d9e0e4',ink);
        for(const z of layout.zs.slice(1,-1))body+=rect(f.X(.3),f.Z(z-.18),(q.w-.6)*f.scale,.36*f.scale,'#d9e0e4',ink);
      }
      body+=notes([s.foundation==='slab'?'Плитный фундамент':'Ленточный фундамент','Бетон — М250.','Показана форма основания. Геометрия, армирование и подготовка уточняются в рабочем проекте.']);
    }
    return page('Схема фундамента',body,'Габариты дома, сетка опор и выбранный тип основания');
  }
  function refImage(key,x,y,w,h){const src=window.PentiiTechnicalReferences?.[key];return src?`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${src}"/>`:'';}
  function pileExample(){
    let body=text(30,87,'ОГОЛОВОК ИЗ ИНСТРУКЦИИ ПЕНТИИ',20,blue)+refImage('pileHead',25,110,760,540);
    body+=text(820,87,'РАЗРЕЗ ИЗ РАБОЧЕГО ПРОЕКТА',20,blue)+refImage('pileSection',840,104,480,535);
    body+=notes(['Бурение → установка и раскрепление профиля → бетонирование М250 с вибрацией → обрезка по уровню → приварка уголков 50 × 50 → защита сварных швов.'],35,687,66);
    body+=notes(['Пример: РП «Отрадное», лист А.01.3. Размеры исходного узла требуют сверки; глубину из этого примера в новый эскиз не переносим.'],855,687,50);
    return page('Свая ПЕНТИИ · примеры узлов',body,'Оригинальные иллюстрации из ваших материалов','Источники: инструкция сборки ПЕНТИИ, раздел «Примеры оголовков свай»; РП «Отрадное», А.01.3.');
  }
  function grillage(q){
    const layout=PentiiStructure.grillageLayout(q),piles=PentiiStructure.pileLayout(q),f=frame(q);let body=bounds(q,f);
    for(const b of layout.boards)body+=rect(f.X(b.x-b.w/2),f.Z(b.z-b.d/2),b.w*f.scale,b.d*f.scale,wood[b.layer%3],ink,.6);
    for(const pile of piles.piles)body+=`<circle cx="${r(f.X(pile.x))}" cy="${r(f.Z(pile.z))}" r="4" fill="white" stroke="${blue}"/>`;
    for(const joint of layout.joints){const x=f.X(joint.x),z=f.Z(joint.z);body+=`<circle cx="${r(x)}" cy="${r(z)}" r="13" fill="none" stroke="${blue}" stroke-dasharray="3 2"/>`;}
    body+=notes(['Наборный ростверк: 3 доски 50 × 150 мм. Пакет 150 × 150 мм.','Г-узел: угловое соединение «ёлочкой».','Т-узел: центральная доска входит «пальчиком», наружные доски примыкают к продольному пакету.','Продольные стыки располагаются на свае; балки идут по одной линии опор.','Между оголовком и деревом — рулонная гидроизоляция. Доски обработаны огнебиозащитой.','Подробные примеры соединений — на следующем листе.']);
    return page('План наборного ростверка',body,'Три ламели, углы и примыкания на опорах');
  }
  function jointExamples(){
    let body=text(30,89,'Г-ОБРАЗНЫЙ УГОЛ · «ЁЛОЧКОЙ»',22,blue)+text(800,89,'Т-ОБРАЗНОЕ ПРИМЫКАНИЕ',22,blue);
    body+=refImage('corner',20,115,745,560)+refImage('tee',790,115,720,560);
    body+=notes(['Три доски 50 × 150 мм. Стыки пакета и усиление угла показаны в исходной инструкции.'],35,710,64)
      +notes(['Пальцевое примыкание средней доски. Стыки по длине — только на свае.'],800,710,62);
    return page('Ростверк · соединения из инструкции',body,'Оригинальные узлы ПЕНТИИ','Источник: инструкция сборки ПЕНТИИ, раздел «Монтаж обвязки свай — наборной ростверк».');
  }
  function panelPlan(q,attic=false){
    const s=PentiiStructure.get(q),a=PentiiStructure.attic(q),length=attic?a.panelLength:s.panelLength;
    const panels=PentiiStructure.panelLayout(q,{length}),f=frame(q);let body=bounds(q,f);
    for(const p of panels){
      body+=rect(f.X(p.x)+1,f.Z(p.z)+1,Math.max(.5,p.w*f.scale-2),Math.max(.5,p.d*f.scale-2),p.reusedFrom?'#cce6df':p.cut?'#f2dec1':'#e4edf3',ink,.7);
      if(p.d*f.scale>25&&p.w*f.scale>12)body+=text(f.X(p.x+p.w/2),f.Z(p.z+p.d/2)+4,p.tag,Math.min(15,Math.max(9,p.w*f.scale*.36)),ink,'middle');
    }
    body+=notes([attic?'СИП-панельное чердачное перекрытие':'СИП-пол цокольного перекрытия',
      'Исходная полоса: 620 × '+mm(length)+' мм. Фактические детали и остатки — в ведомости раскладки.',
      'Поперечные швы соседних рядов смещены. Доборная деталь переносится в начало соседнего ряда. Подходящие остатки используются повторно.',
      'Зелёный — деталь из остатка. Песочный — подрезанная деталь. Серо-голубой — целая полоса. Источник остатка указан в ведомости.',
      'Швы 3–4 мм, соединительная доска и монтажная пена. Торцевая доска по периметру; у цоколя защита торцов полосой ЦСП.']);
    return page(attic?'Раскладка СИП · чердачное перекрытие':'Раскладка СИП · пол первого этажа',body,'Разбежка поперечных швов и доборные детали','Раскладка с зазором 4 мм. Опирание и карта раскроя исходных плит проверяются в рабочем проекте.');
  }
  function panelSchedule(q,attic=false){
    const a=PentiiStructure.attic(q),s=PentiiStructure.get(q),panels=PentiiStructure.panelLayout(q,{length:attic?a.panelLength:s.panelLength}),pages=[];
    const columns=[25,145,265,485,715,1045],widths=[120,120,220,230,330,460],head=['Марка','Ряд','Ширина × длина, мм','Положение X / Z, мм','Деталь','Остаток от детали'];
    for(let start=0;start<panels.length;start+=16){
      let body='';head.forEach((h,i)=>{body+=rect(columns[i],80,widths[i],48,'#eaf2f7',rule)+text(columns[i]+10,110,h,17)});
      panels.slice(start,start+16).forEach((p,i)=>{const y=128+i*43;body+=rect(25,y,1480,43,i%2?'#f5f9fc':'white',rule);
        const cells=[p.tag,String(p.row+1),mm(p.w)+' × '+mm(p.d),mm(p.x)+' / '+mm(p.z),p.reusedFrom?'Остаток':p.cut?'Подрезка':'Целая полоса',p.reusedFrom||'—'];
        cells.forEach((value,c)=>body+=text(columns[c]+10,y+28,value,18));
      });
      pages.push(page('Ведомость деталей СИП · '+(attic?'чердак':'цоколь')+(panels.length>16?' · '+(Math.floor(start/16)+1):''),body,'Марки соответствуют раскладке панелей','Раскрой предварительный: резерв пропила 3 мм; фактический пропил уточняется перед изготовлением.'));
    }
    return pages;
  }
  function atticFrame(q){
    const a=PentiiStructure.attic(q),f=frame(q);let body=bounds(q,f);
    for(const x of PentiiStructure.atticLayout(q).beamXs)body+=rect(f.X(x-.025),f.y,.05*f.scale,q.d*f.scale,'#d9b889',ink,.7);
    body+=notes(['Каркасное чердачное перекрытие.','Балки 50 × 150 мм. Расположение на схеме предварительное; пролёты и опирание проверяются в рабочем проекте.','Утеплитель: минеральная вата, 3 слоя по 50 мм, всего 150 мм. Стыки слоёв перекрываются.','Со стороны помещения — сплошная пароизоляция, стыки и примыкания герметизируются.','Снизу рейка 25 × 50 мм. Отделка потолка выбирается отдельно.'],1020,112,41);
    body+=refImage('attic',1020,560,460,226)+text(1020,818,'Пример каркаса из инструкции ПЕНТИИ',16,muted);
    return page('План чердачного перекрытия · каркас',body,'Каркас, утепление и пароизоляция');
  }
  function floorExamples(){
    let body=text(30,89,'СИП-ПОЛ НА РОСТВЕРКЕ',22,blue)+text(800,89,'РАЗБЕЖКА В РАБОЧЕМ ПРОЕКТЕ',22,blue);
    body+=refImage('floor',25,110,735,550)+refImage('floorPlan',800,110,690,550);
    body+=notes(['Источник: инструкция сборки ПЕНТИИ, «Монтаж панелей пола». Торцевая доска и защита торцов полосой ЦСП.'],35,700,63)
      +notes(['Источник: РП «Орлиное», лист А.08. Полосы 620 × 3000 мм; швы 4 мм; добор 988 мм в соседнем ряду.'],800,700,60);
    return page('СИП-пол · примеры из ваших материалов',body,'Устройство пола и пример разбежки стыков','Размеры исходного примера не подменяют раскладку текущего дома на предыдущих листах.');
  }
  function atticLayers(q){
    const a=PentiiStructure.attic(q);let body=text(35,90,'СОСТАВ СВЕРХУ ВНИЗ',23,blue);
    let y=142;
    for(const [i,layer] of [...a.layers].reverse().entries()){
      const height=layer.mm?Math.max(24,Math.min(110,layer.mm*1.3)):14;
      const color=/вата/i.test(layer.label)?'#e9dca9':/паро/i.test(layer.label)?'#3f788b':/ППС/i.test(layer.label)?'#edf1e6':/OSB/i.test(layer.label)?'#ccb58d':/ЦСП/i.test(layer.label)?'#a8b6b9':'#c9a779';
      body+=rect(40,y,600,height,color,ink)+line(640,y+height/2,690,y+height/2,blue)+text(710,y+height/2+6,layer.label+(layer.mm?' · '+layer.mm+' мм':''),20);y+=height+12;
    }
    body+=text(40,y+35,'Помещение ↓',21,muted);
    body+=notes([a.type==='sip'?'Выбрано СИП-панельное перекрытие: материал обшивок задаётся в разделе «Конструкции».':'Три слоя утеплителя по 50 мм показаны отдельно. Пароизоляция расположена со стороны помещения.',
      'Вариант перекрытия сохранён в проекте и отражён на общих разрезах А–А / Б–Б.'],40,677,106);
    return page('Чердачное перекрытие · состав',body,a.label,'Схема слоёв без масштаба. Отделка потолка и конструктивные расчёты в состав этого листа не входят.');
  }
  function pages(q){
    const out=[pilePlan(q)],s=PentiiStructure.get(q);
    if(s.foundation==='piles'){
      out.push(pileExample());
      out.push(grillage(q),jointExamples());
    }
    out.push(panelPlan(q),...panelSchedule(q),floorExamples());
    if(PentiiStructure.attic(q).type==='sip')out.push(panelPlan(q,true),...panelSchedule(q,true));
    else out.push(atticFrame(q));
    out.push(atticLayers(q));return out;
  }
  return {pages};
})();

/* Presentation geometry based on the PENTII SIP assembly examples. Model units: metres.
   The top face of the ground floor is zero. The foundation layout is schematic. */
window.PentiiStructure = (() => {
  'use strict';

  const wallSystems = {
    mixed: ['Симбиоз · ЦСП снаружи, OSB внутри', 'cement', 'osb'],
    cement: ['ЦСП с обеих сторон', 'cement', 'cement'],
    osb: ['OSB с обеих сторон', 'osb', 'osb']
  };
  const floorSystems = {
    cement: ['СИП ЦСП / ЦСП', 'cement', 'cement'],
    mixed: ['СИП · ЦСП снизу, OSB сверху', 'cement', 'osb'],
    osb: ['СИП OSB / OSB', 'osb', 'osb']
  };
  const names = {cement:'ЦСП', osb:'OSB', core:'ППС'};
  const foundations = {piles:'Свайный', strip:'Ленточный', slab:'Плитный'};
  const pileLabel='Бурозаливные ПЕНТИИ · профиль 100 × 100';
  const atticTypes={frame:'Каркасное · пароизоляция + 3 слоя ваты',sip:'СИП-панельное'};
  const stages = {finish:'С отделкой', panels:'СИП-коробка', floor:'СИП-пол', attic:'Чердачное перекрытие', foundation:'Основание'};
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const skinMm = kind => kind === 'osb' ? 12 : 10;
  const mm = m => Math.round(m*1000);
  const choose = (dict, key, fallback) => own(dict,key) ? key : fallback;

  function get(p){
    const s = p.structure || {};
    const wallSkin = choose(wallSystems,s.wallSkin,'mixed');
    const floorSkin = choose(floorSystems,s.floorSkin,'cement');
    const foundation = choose(foundations,s.foundation,'piles');
    const pileType='bored',atticType=choose(atticTypes,s.atticType,'frame');
    const atticSkin=choose(floorSystems,s.atticSkin,'osb');
    const panelLength=Number(s.panelLengthMm)===2800?2.8:3,atticPanelLength=Number(s.atticPanelLengthMm)===2800?2.8:3;
    const wallMm = [117,167,170].includes(Number(s.wallMm)) ? Number(s.wallMm) : 167;
    const [,outside,inside] = wallSystems[wallSkin], [,bottom,top] = floorSystems[floorSkin];
    const coreMm = wallMm - skinMm(outside) - skinMm(inside);
    const floorCore = .145, floorThickness = (145+skinMm(bottom)+skinMm(top))/1000;
    const groundY = -floorThickness - (foundation==='piles'?.65:foundation==='strip'?.32:.16);
    return {foundation,pileType,concrete:'М250',atticType,atticSkin,panelLength,atticPanelLength,wallSkin,floorSkin,wallMm,outside,inside,bottom,top,coreMm,
      floorCore,floorThickness,groundY,wallThickness:wallMm/1000,
      starterWidth:wallMm===117?.095:.145, view:choose(stages,s.view,'finish')};
  }

  // The customer confirmed one pile technology. Repair saved experimental
  // alternatives without replacing the sketch or changing its other settings.
  function normalize(p){
    if(p.structure&&own(p.structure,'pileType'))p.structure.pileType='bored';
    return p;
  }

  function attic(p){
    const s=get(p),[,bottom,top]=floorSystems[s.atticSkin];
    return s.atticType==='sip'?{type:'sip',label:'СИП-панельное чердачное перекрытие',
      thickness:(145+skinMm(bottom)+skinMm(top))/1000,bottom,top,panelLength:s.atticPanelLength,
      layers:[{label:names[bottom],mm:skinMm(bottom)},{label:'ППС',mm:145},{label:names[top],mm:skinMm(top)}]}:
      {type:'frame',label:'Каркасное чердачное перекрытие',thickness:.175,beamWidth:.05,beamHeight:.15,
      layers:[{label:'Поддерживающая обрешётка 25 × 50',mm:25},{label:'Пароизоляция со стороны помещения'},
        {label:'Минеральная вата · слой 1',mm:50},{label:'Минеральная вата · слой 2',mm:50},{label:'Минеральная вата · слой 3',mm:50}]};
  }

  function atticLayout(p){
    const data=attic(p),beamXs=[.025];
    for(let x=.625;x<p.w-.05;x+=.6)beamXs.push(x);beamXs.push(p.w-.025);
    return {...data,beamXs,top:p.n*p.h,panels:data.type==='sip'?panelLayout(p,{length:data.panelLength}):[]};
  }

  function pileLayout(p){
    const s=get(p),grid=w=>Array.from({length:Math.ceil(w/2.5)+1},(_,i)=>.2+(w-.4)*i/Math.ceil(w/2.5));
    const xs=grid(p.w),zs=grid(p.d),piles=[];
    for(const z of zs)for(const x of xs)piles.push({tag:'С'+(piles.length+1),x,z});
    return {xs,zs,piles,type:s.pileType,label:pileLabel,concrete:s.concrete,
      profileMm:100,schematic:true,
      note:'Расстановка условная. Глубина, диаметр скважины и несущая способность назначаются рабочим проектом.'};
  }

  // Three side-by-side boards, not three stacked layers. Every bearing line
  // passes through pile centres. T-joint middle tongues enter the edge beam.
  function grillageLayout(p){
    const {xs,zs}=pileLayout(p),boards=[],joints=[],width=.15,height=.15;
    const west=xs[0],east=xs.at(-1),north=zs[0],south=zs.at(-1);
    const add=(axis,layer,lo,hi,line)=>{if(hi-lo>.001)boards.push(axis==='x'?
      {axis,layer,x:(lo+hi)/2,z:line,w:hi-lo,d:.05}:{axis,layer,x:line,z:(lo+hi)/2,w:.05,d:hi-lo})};
    for(const z of zs){
      const edge=z===north||z===south;
      for(let j=0;j<3;j++){
        const shift=(j-1)*.05;
        const a=edge?west-.075+(z===north?j:2-j)*.05:west+(j===1?-.025:.075);
        const b=edge?east+.075-(z===north?j:2-j)*.05:east-(j===1?-.025:.075);
        // Stepped longitudinal butt joints remain over the same pile head.
        const cuts=[a,...xs.slice(1,-1).map(x=>x+(j===1?.025:-.025)),b];
        for(let i=1;i<cuts.length;i++)add('x',j,cuts[i-1],cuts[i],z+shift);
      }
      if(!edge)for(const x of [west,east])joints.push({x,z,kind:'finger'});
      for(const x of xs.slice(1,-1))joints.push({x,z,kind:'splice'});
    }
    for(const x of [west,east])for(let j=0;j<3;j++){
      const shift=(j-1)*.05,slot=x===west?j:2-j;
      const a=north-.025+slot*.05,b=south-(.075-(2-slot)*.05);
      // A notch for the centre tongue is cut in the two inner laminations.
      const inner=x===west?j>=1:j<=1;
      let from=a;
      for(const z of zs.slice(1,-1)){
        if(inner){add('z',j,from,z-.025,x+shift);from=z+.025}
        else{add('z',j,from,z,x+shift);from=z}
      }
      add('z',j,from,b,x+shift);
    }
    for(const x of [west,east])for(const z of [north,south])joints.push({x,z,kind:'corner'});
    return {boards,joints,width,height};
  }

  // Match the alternating 3000 + 4 + ... + infill layout in the supplied
  // Orlinoe floor drawing. The next strip starts with the previous strip's
  // infill length. Suitable remaining stock is allocated to later infills;
  // saw kerf and a workshop cutting plan remain outside this concept model.
  function panelLayout(p,{width=p.w,depth=p.d,length=get(p).panelLength}={}){
    const result=[],stock=length,strip=.62,joint=.004,offcuts=[];let number=0;
    const sequence=first=>{
      const pieces=[];for(let z=0,col=0;z<depth-.0001;col++){const d=Math.min(col===0?first:stock,depth-z);pieces.push(d);z+=d+joint}
      // Redistribute a tiny final strip across the last two pieces.
      if(pieces.length>1&&pieces.at(-1)<.30){const last=pieces.pop(),before=pieces.pop();pieces.push((before+last)/2,(before+last)/2)}
      return pieces;
    };
    const lengths=sequence(stock);let previous=[];
    const seams=pieces=>{let z=0;return pieces.slice(0,-1).map(d=>{z+=d+joint;return z})};
    const distance=pieces=>{const cuts=seams(pieces);return cuts.length&&previous.length?Math.min(...cuts.flatMap(c=>previous.map(v=>Math.abs(c-v)))):stock};
    for(let x=0,row=0;x<width-.0001;x+=strip+joint,row++){
      const w=Math.min(strip,width-x);
      let pieces=row%2?[...lengths].reverse():[...lengths];
      if(row&&distance(pieces)<.30){
        const candidates=[.5,.333,.667,.25,.75,.4,.6].map(r=>sequence(stock*r));
        candidates.sort((a,b)=>distance(b)-distance(a));pieces=candidates[0];
      }
      previous=seams(pieces);
      let z=0;
      for(const d of pieces){
        const tag='СП'+(++number),found=offcuts.findIndex(c=>Math.abs(c.w-w)<.001&&c.d>=d+.003);
        const from=found>=0?offcuts.splice(found,1)[0]:null,available=from?from.d:stock;
        result.push({tag,row,x,z,w,d,cut:d<stock-.001||w<strip-.001,infill:d<stock-.001,joint,...(from?{reusedFrom:from.tag}:{})});
        if(available-d>.004)offcuts.push({w,d:available-d-.003,tag});
        z+=d+joint;
      }
    }
    return result;
  }

  function summary(p){
    const s=get(p),w=mm(s.starterWidth),a=attic(p);
    const base=s.foundation==='piles'?'Бурозаливные сваи: профиль 100 × 100 мм, бетон М250':foundations[s.foundation]+' фундамент';
    return [base,
      ...(s.foundation==='piles'?['Ростверк 3 × 50 × 150 мм; углы ёлочкой, Т-стык средним пальцем над сваей']:[]),
      'Наружные стены: '+wallSystems[s.wallSkin][0]+' · '+s.wallMm+' мм',
      'Панель стены снаружи внутрь: '+names[s.outside]+' '+skinMm(s.outside)+' / ППС '+s.coreMm+' / '+names[s.inside]+' '+skinMm(s.inside)+' мм',
      'Стартовый и межпанельный брус: 45 × '+w+' мм',
      'СИП-пол: '+floorSystems[s.floorSkin][0]+' · '+mm(s.floorThickness)+' мм; полосы 620 × '+mm(s.panelLength)+' мм вразбежку',
      a.type==='frame'?'Чердачное перекрытие: каркас 50 × 150, пароизоляция, вата 3 × 50 мм':a.label+': '+floorSystems[s.atticSkin][0]+' · '+mm(a.thickness)+' мм',
      'Торцевая доска и полоса ЦСП по периметру перекрытия'];
  }

  function inspector(host,p,{onCommit}){
    const s=get(p);host.replaceChildren();
    function element(tag,text,parent=host){
      const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;
    }
    function change(key,value){
      const next=JSON.parse(JSON.stringify(p));
      next.structure={...next.structure,[key]:value};
      onCommit(next);
    }
    element('h2','Конструкции дома');
    const buttons=element('div','');buttons.className='choiceGrid';
    for(const [value,text] of Object.entries(stages)){
      const b=element('button',text,buttons);b.type='button';b.classList.toggle('on',s.view===value);
      b.setAttribute('aria-pressed',String(s.view===value));b.onclick=()=>change('view',value);
    }
    function select(text,key,choices,selected){
      const label=element('label',text),control=element('select','',label);
      control.setAttribute('aria-label',text);
      for(const [value,title] of Object.entries(choices)){
        const option=new Option(title,value);option.selected=String(selected)===value;control.add(option);
      }
      control.onchange=()=>change(key,['wallMm','panelLengthMm','atticPanelLengthMm'].includes(key)?Number(control.value):control.value);
    }
    select('Тип фундамента','foundation',foundations,s.foundation);
    if(s.foundation==='piles'){
      element('strong',pileLabel);
      element('p','Бетон М250. Бурение → профиль 100 × 100 → бетонирование с вибрацией → опорные уголки 50 × 50.').className='muted';
    }
    select('Наружные стены','wallSkin',Object.fromEntries(Object.entries(wallSystems).map(([k,v])=>[k,v[0]])),s.wallSkin);
    select('Толщина стены','wallMm',{117:'117 мм',167:'167 мм',170:'170 мм'},s.wallMm);
    select('Панели пола','floorSkin',Object.fromEntries(Object.entries(floorSystems).map(([k,v])=>[k,v[0]])),s.floorSkin);
    select('Длина панели пола','panelLengthMm',{3000:'3000 мм · из проекта Орлиное',2800:'2800 мм'},mm(s.panelLength));
    select('Чердачное перекрытие','atticType',atticTypes,s.atticType);
    if(s.atticType==='sip'){
      select('Панели чердачного перекрытия','atticSkin',Object.fromEntries(Object.entries(floorSystems).map(([k,v])=>[k,v[0]])),s.atticSkin);
      select('Длина панели чердачного перекрытия','atticPanelLengthMm',{3000:'3000 мм',2800:'2800 мм'},mm(s.atticPanelLength));
    }else element('p','Балки 50 × 150 мм; утепление 3 × 50 мм с перекрытием стыков. Пароизоляция снизу, поддерживающая обрешётка 25 × 50 мм.').className='muted';
    const section=element('div','');section.className='block';
    const descriptions = {
      finish:'Выберите слой выше, чтобы посмотреть, из чего собран дом.',
      foundation:s.foundation==='piles'?'Сваи, опорные уголки, рулонная гидроизоляция и три доски 50 × 150 мм. Расстановка опор на эскизе условная.':'Показана эскизная форма бетонного основания.',
      floor:'Полосы 620 мм уложены вразбежку, доборная панель перенесена в начало соседнего ряда. В переднем углу открыт фрагмент слоёв пола.',
      attic:s.atticType==='frame'?'Кровля снята. Три слоя ваты по 50 мм между балками; в открытом углу видны пароизоляция и обрешётка.':'Кровля снята. Чердачные СИП-панели уложены вразбежку; открытый угол показывает слои.',
      panels:'Сняты отделка и кровля. В проёмах видны слои СИП, на плоскости стен — стыки панелей.'
    };
    element('p',descriptions[s.view],section).className='muted';
    element('strong','Разрез наружной стены',section);
    const parts=[[s.outside,skinMm(s.outside)],['core',s.coreMm],[s.inside,skinMm(s.inside)]];
    const bar=element('div','',section);bar.setAttribute('aria-hidden','true');
    bar.style.cssText='display:flex;height:24px;margin:8px 0;border-radius:4px;overflow:hidden;border:1px solid #8da4b2';
    for(const [kind,width] of parts){
      const shape=element('span','',bar);shape.style.flex=String(width);
      shape.style.background=kind==='cement'?'#a7afb1':kind==='osb'?'repeating-linear-gradient(32deg,#c3a77b,#c3a77b 3px,#dbc79e 4px,#bba378 7px)':'radial-gradient(circle,#d1d7dc .9px,#f5f6ee 1.3px) 0 0/4px 4px';
    }
    element('p','Снаружи → '+parts.map(([k,n])=>names[k]+' '+n).join(' / ')+' мм → внутри',section).className='small';
  }

  const textureCache=new WeakMap();
  function sheetMap(T,kind){
    let maps=textureCache.get(T);if(!maps){maps={};textureCache.set(T,maps)}
    if(maps[kind])return maps[kind];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');
    if(!ctx)return null;
    let seed=823;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    const osb=kind==='osb',wood=kind==='timber',foam=kind==='core',wool=kind==='wool';
    ctx.fillStyle=osb?'#c6a77d':wood?'#c69c66':foam?'#f0efe5':wool?'#f1eadc':'#b1b5b3';ctx.fillRect(0,0,256,256);
    if(osb){
      const colors=['#b59b76','#c8ab82','#dfc7a3','#aa8968','#cfb28a','#d9c39b','#c5a980'];
      for(let i=0;i<4200;i++){
        ctx.save();ctx.translate(rng()*272-8,rng()*272-8);ctx.rotate((rng()-.5)*(i%4===0?6.2:2.4));
        const L=2+rng()*17,W=.8+rng()*3.2;
        ctx.fillStyle=colors[Math.floor(rng()*colors.length)];ctx.beginPath();
        ctx.moveTo(-L*.55,W*.25);ctx.lineTo(-L*.29,-W*.53);ctx.lineTo(L*.5,-W*.22);ctx.lineTo(L*.31,W*.47);ctx.closePath();ctx.fill();ctx.restore();
      }
    }else if(wool){
      for(let i=0;i<5200;i++){
        const x=rng()*256,y=rng()*256,L=2+rng()*8,angle=rng()*Math.PI*2;
        ctx.strokeStyle=i%2?'#cfc8b9':'#fff9ec';ctx.lineWidth=.35+rng()*.35;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle)*L,y+Math.sin(angle)*L);ctx.stroke();
      }
    }else if(wood){
      for(let i=0;i<170;i++){
        const y=rng()*256;ctx.strokeStyle=i%2?'#be935f':'#d6b58b';ctx.lineWidth=.3+rng()*.6;ctx.beginPath();ctx.moveTo(0,y);
        ctx.bezierCurveTo(65,y+3*rng(),164,y-2*rng(),256,y);ctx.stroke();
      }
    }else{
      for(let i=0;i<9000;i++){
        const t=Math.round((foam?216:155)+rng()*(foam?33:38));
        ctx.fillStyle='rgb('+t+','+(t+1)+','+t+')';ctx.fillRect(rng()*256,rng()*256,foam?1.8:.8,foam?1.8:.8);
      }
    }
    const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;
    map.colorSpace=T.SRGBColorSpace;maps[kind]=map;return map;
  }

  // Pack repeated parts by finish. Map UVs to local metres so chip size stays
  // consistent across long timbers, narrow panel reveals and full sheets.
  function batches(T,group){
    const bins=new Map();
    const style={
      osb:'#ffffff',cement:'#fafbfa',core:'#ffffff',timber:'#ffffff',
      steel:'#303a41',galv:'#89959d',bitumen:'#2f3436',concrete:'#b8bebd',mortar:'#959797',
      wool1:'#c8b995',wool2:'#d7c8a4',wool3:'#e0d2b0',membrane:'#90a5ac'
    };
    function part(shape,k,x,y,z,w,h,d,target){
      if(Math.min(w,h,d)<.0004)return;
      const key=[shape,k,target?.type,target?.face].join(':');
      if(!bins.has(key))bins.set(key,{shape,k,target,list:[]});
      bins.get(key).list.push([x,y,z,w,h,d]);
    }
    function flush(){
      const geometry={},transform=new T.Object3D();
      for(const {shape,k,target,list} of bins.values()){
        geometry[shape] ||= shape==='round'?new T.CylinderGeometry(.5,.5,1,18):new T.BoxGeometry(1,1,1);
        const map=k.startsWith('wool')?sheetMap(T,'wool'):['osb','cement','timber','core','concrete'].includes(k)?sheetMap(T,k):null;
        const mat=new T.MeshStandardMaterial({color:style[k]||k,map,roughness:k==='galv'?.45:.91,metalness:k==='galv'?.6:k==='steel'?.4:0});
        if(map){
          mat.onBeforeCompile=shader=>{
            shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
#ifdef USE_INSTANCING
  vec3 partPoint=(instanceMatrix*vec4(position,1.)).xyz;
  vMapUv=(abs(normal.y)>.5?partPoint.xz:abs(normal.x)>.5?partPoint.zy:partPoint.xy)*1.55;
#endif`);
          };
        }
        const batch=new T.InstancedMesh(geometry[shape],mat,list.length);
        batch.name='ПЕНТИИ · '+k;if(target)batch.userData.target=target;
        list.forEach(([x,y,z,w,h,d],i)=>{transform.position.set(x,y,z);transform.scale.set(w,h,d);transform.updateMatrix();batch.setMatrixAt(i,transform.matrix)});
        batch.castShadow=batch.receiveShadow=true;group.add(batch);
      }
    }
    return {box:(...args)=>part('box',...args),round:(...args)=>part('round',...args),flush};
  }

  function foundation(p,s,{box,round}){
    const under=-s.floorThickness,target={type:'foundation'};
    const {xs,zs,piles}=pileLayout(p);
    const cap=.028,water=.006,board=.15;
    if(s.foundation==='slab'){
      box('concrete',p.w/2,under-.11,p.d/2,p.w+.22,.22,p.d+.22,target);
      box('bitumen',p.w/2,under-.002,p.d/2,p.w,.004,p.d,target);return;
    }
    if(s.foundation==='strip'){
      const h=.52,w=.36;
      for(const z of [.12,p.d-.12])box('concrete',p.w/2,under-h/2,z,p.w+.12,h,w,target);
      for(const x of [.12,p.w-.12])box('concrete',x,under-h/2,p.d/2,w,h,p.d-.60,target);
      for(const z of zs.slice(1,-1))box('concrete',p.w/2,under-h/2,z,p.w-.6,h,w,target);
      return;
    }
    const headTop=under-board-water,foot=s.groundY-.18;
    for(const {x,z} of piles){
      const shaftTop=headTop-.005;
        // Below-grade form is illustrative; no depth/diameter is assigned in the model.
        round('concrete',x,s.groundY-.067,z,.25,.15,.25,target);
        const h=shaftTop-foot;
        for(const sign of [-1,1]){
          box('steel',x+sign*.048,(foot+shaftTop)/2,z,.004,h,.1,target);
          box('steel',x,(foot+shaftTop)/2,z+sign*.048,.092,h,.004,target);
          for(const sz of [-1,1])round('steel',x+sign*.057,foot+.09,z+sz*.057,.016,.35,.016,target);
        }
        // Two L50×50 supports from the assembly instruction, lengths 150 and100 mm.
        box('steel',x,headTop-.0025,z-.025,.15,.005,.05,target);
        box('steel',x,headTop-.025,z-.048,.15,.05,.004,target);
        box('steel',x+.025,headTop-.0025,z,.05,.005,.1,target);
        box('steel',x+.048,headTop-.025,z,.004,.05,.1,target);
      box('bitumen',x,headTop+water/2,z,.15,water,.15,target);
      for(const dx of [-.06,.06])box('galv',x+dx,headTop+.004,z,.012,.011,.012,target);
    }
    for(const b of grillageLayout(p).boards)box('timber',b.x,under-board/2,b.z,Math.max(.001,b.w-.001),board,Math.max(.001,b.d-.001),target);
    for(const joint of grillageLayout(p).joints.filter(j=>j.kind==='corner'||j.kind==='finger')){
      const inward=joint.x===xs[0]?1:-1;
      const sz=joint.z===zs.at(-1)?-1:1;
      const bx=joint.x+inward*.078,bz=joint.z+sz*.078;
      box('galv',bx,under-.058,bz+sz*.052,.003,.095,.105,target);
      box('galv',bx+inward*.052,under-.058,bz,.105,.095,.003,target);
      box('galv',bx+inward*.05,under-.06,bz,.016,.016,.008,target);
    }
    for(const z of zs)for(let x=.37,i=0;x<p.w-.15;x+=.7,i++)
      box('galv',x,under-.075+(i%2?.023:-.023),z+.077,.025,.025,.008,target);
  }

  function makeFloor(p,s,box,topY=0,expose=false,starter=expose){
    const thickness=s.floorThickness,t=skinMm(s.top)/1000,b=skinMm(s.bottom)/1000,target={type:'floor'};
    const under=topY-thickness,gap=.0005,edge=.045;
    for(const panel of panelLayout(p,{length:s.panelLength})){
      const {x,z,w:width,d}=panel;
      const open=expose&&x>p.w-2.05&&z+d>p.d-1.25;
      box(s.bottom,x+width/2,under+b/2,z+d/2,width-gap,b,d-gap,target);
      const board=Math.min(edge,width*.35);
      box('timber',x+board/2,under+b+s.floorCore/2,z+d/2,board,s.floorCore,d-gap,target);
      // End boards and joining spline follow every panel joint.
      box('timber',x+width/2,under+b+s.floorCore/2,z+board/2,width-gap,s.floorCore,board,target);
      box('core',x+(width+board)/2,under+b+s.floorCore/2,z+(d+board)/2,width-board-gap,s.floorCore,d-board-gap,target);
      if(!open)box(s.top,x+width/2,topY-t/2,z+d/2,width-gap,t,d-gap,target);
    }
    for(const z of [.027,p.d-.027])box('timber',p.w/2,topY-thickness/2,z,p.w,thickness-.02,.05,target);
    for(const x of [.027,p.w-.027])box('timber',x,topY-thickness/2,p.d/2,.05,thickness-.02,p.d-.1,target);
    for(const z of [-.004,p.d+.004])box('cement',p.w/2,topY-thickness/2,z,p.w+.012,thickness,.008,target);
    for(const x of [-.004,p.w+.004])box('cement',x,topY-thickness/2,p.d/2,.008,thickness,p.d,target);
    if(starter){
      const w=s.starterWidth,h=.045,g=s.outside==='cement'?.01:.012;
      for(const z of [w/2,p.d-w/2])box('timber',p.w/2,topY+h/2,z,p.w,h,w,target);
      for(const x of [w/2,p.w-w/2])box('timber',x,topY+h/2,p.d/2,w,h,p.d-2*(w+g),target);
    }
  }

  function addAttic(T,group,p){
    const s=get(p),a=attic(p),parts=batches(T,group),box=parts.box,Y=p.n*p.h,target={type:'floor'};
    if(a.type==='sip'){
      makeFloor(p,{...s,bottom:a.bottom,top:a.top,floorThickness:a.thickness,panelLength:a.panelLength},box,Y,true,false);
    }else{
      const under=Y-a.thickness,beamBottom=Y-.15;
      for(let z=.025;z<p.d;z+=.4)box('timber',p.w/2,under+.0125,z,p.w,.025,.05,target);
      box('membrane',p.w/2,beamBottom-.001,p.d/2,p.w,.001,p.d,target);
      const xs=atticLayout(p).beamXs;
      for(const x of xs)box('timber',x,Y-.075,p.d/2,.05,.15,p.d,target);
      for(const z of [.025,p.d-.025])box('timber',p.w/2,Y-.075,z,p.w-.1,.15,.05,target);
      for(let i=1;i<xs.length;i++){
        const lo=xs[i-1]+.025,hi=xs[i]-.025;
        for(let layer=0;layer<3;layer++){
          for(let z=.05,col=0;z<p.d-.05;col++){
            const length=Math.min(col===0&&layer%2?.6:1.2,p.d-.05-z);
            // A progressive cut-away lets the three insulation layers be read.
            const open=lo>p.w-2.1&&z+length>p.d-(1.2+layer*.42);
            if(!open)box(['wool1','wool2','wool3'][layer],(lo+hi)/2,beamBottom+.025+layer*.05,z+length/2,hi-lo-.002,.049,length-.003,target);
            z+=length;
          }
        }
      }
    }
    parts.flush();return group;
  }

  function onFace(p,f,fn){
    const target={type:'wall',face:f};
    return (kind,u,y,inward,w,h,d)=>{
      if(f===0)fn(kind,u,y,p.d-inward,w,h,d,target);
      if(f===1)fn(kind,p.w-inward,y,p.d-u,d,h,w,target);
      if(f===2)fn(kind,p.w-u,y,inward,w,h,d,target);
      if(f===3)fn(kind,inward,y,u,d,h,w,target);
    };
  }

  function clipGrid(ops,lo,hi,low,high,draw){
    const overlaps=ops.filter(o=>o.x<hi&&o.x+o.w>lo&&o.sill<high&&o.sill+o.h>low);
    const cuts=(arr,min,max)=>[...new Set([min,max,...arr.filter(n=>n>min&&n<max)])].sort((a,b)=>a-b);
    const xs=cuts(overlaps.flatMap(o=>[o.x,o.x+o.w]),lo,hi),ys=cuts(overlaps.flatMap(o=>[o.sill,o.sill+o.h]),low,high);
    for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
      const x=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2;
      if(!overlaps.some(o=>o.x<x&&x<o.x+o.w&&o.sill<y&&y<o.sill+o.h))draw(x,y,xs[i]-xs[i-1],ys[j]-ys[j-1],xs[i-1],ys[j-1]);
    }
  }
  function wallVoids(p,face,floor=null){
    const base=floor===null?0:floor*p.h;
    const openings=p.ops.filter(o=>o.f===face&&(floor===null||o.floor===floor))
      .map(o=>({...o,sill:o.sill+o.floor*p.h-base}));
    for(const cut of p._wallCuts||[])if(cut.face===face)
      openings.push({x:cut.from,w:cut.to-cut.from,sill:cut.bottom-base,h:cut.top-cut.bottom});
    return openings;
  }
  function dressWalls(p,box){
    const vertical=p.skin==='Вертикальные рейки';
    if(!vertical&&p.skin!=='Кирпич')return;
    const dark='#'+p.wall.slice(1).match(/../g).map(v=>Math.round(Number.parseInt(v,16)*.70).toString(16).padStart(2,'0')).join('');
    for(let f=0;f<4;f++){
      const W=f%2?p.d:p.w,wall=onFace(p,f,box),ops=wallVoids(p,f);
      const height=p.h*p.n;
      if(vertical){
        for(let x=.045;x<W;x+=.13){
          clipGrid(ops,Math.max(0,x-.025),Math.min(W,x+.025),0,height,(u,y,w,h)=>wall(dark,u,y,-.014,w,h,.027));
        }
      }else{
        // Bed and perp joints only; the coloured wall material remains the brick face.
        for(let y=.09,row=0;y<height;y+=.09,row++){
          clipGrid(ops,0,W,y-.003,y+.003,(u,v,w,h)=>wall(dark,u,v,-.003,w,h,.004));
          for(let x=row%2?.13:.26;x<W;x+=.26){
            clipGrid(ops,x-.003,x+.003,y-.09,y,(u,v,w,h)=>wall(dark,u,v,-.003,w,h,.004));
          }
        }
      }
    }
  }
  function addBase(T,group,p){
    const s=get(p),parts=batches(T,group);
    // The closed exterior plinth conceals below-grade elements in finished views.
    if(s.view!=='finish')foundation(p,s,parts);
    if(s.view!=='foundation')makeFloor(p,s,parts.box,0,s.view==='floor');
    if(s.view==='finish')dressWalls(p,parts.box);
    parts.flush();return group;
  }
  function addShell(T,group,p){
    const s=get(p),parts=batches(T,group),outer=skinMm(s.outside)/1000,inner=skinMm(s.inside)/1000;
    const depth=s.wallThickness,core=s.coreMm/1000;
    for(let f=0;f<4;f++){
      const length=f%2?p.d:p.w,wall=onFace(p,f,parts.box);
      // Side runs terminate at the rear face of end walls; avoid solid overlap at corners.
      const from=f%2?depth:0,to=f%2?length-depth:length;
      for(let floor=0;floor<p.n;floor++){
        const ops=wallVoids(p,f,floor);
        for(let lo=from;lo<to-.001;lo+=.62){
          const hi=Math.min(lo+.62,to),clear=Math.min(.0015,(hi-lo)*.05);
          clipGrid(ops,lo+clear,hi-clear,0,p.h,(x,y,w,h,cellLo,cellBottom)=>{
            const Y=floor*p.h+y;
            wall(s.outside,x,Y,outer/2,w,h,outer);
            wall(s.inside,x,Y,depth-inner/2,w,h,inner);
            const edge=Math.min(cellLo+w,lo+.045),joint=Math.max(0,edge-cellLo);
            if(joint>0)wall('timber',cellLo+joint/2,Y,outer+core/2,joint,h,Math.min(core,s.starterWidth));
            const clearWidth=w-joint;
            if(clearWidth<=.0004)return;
            const coreX=cellLo+joint+clearWidth/2;
            // Timber bindings at top and bottom; foam is visible in the cut openings.
            for(const [a,b,kind] of [[0,.045,'timber'],[.045,p.h-.045,'core'],[p.h-.045,p.h,'timber']]){
              const start=Math.max(cellBottom,a),end=Math.min(cellBottom+h,b);
              if(end>start)wall(kind,coreX,floor*p.h+(start+end)/2,outer+core/2,clearWidth,end-start,core);
            }
          });
        }
      }
    }
    for(let level=1;level<p.n;level++)makeFloor(p,s,parts.box,level*p.h);
    parts.flush();return group;
  }

  // Elevation insert shares the drawing's wall origin and one-metre scale.
  function elevation(p,face,g){
    const s=get(p),length=face%2?p.d:p.w,X=m=>g.x0+m*g.scale,Y=m=>g.base-m*g.scale;
    const rect=(x,y,w,h,c)=>'<rect x="'+X(x)+'" y="'+Y(y+h)+'" width="'+(w*g.scale)+'" height="'+(h*g.scale)+'" fill="'+c+'"/>';
    const under=-s.floorThickness;
    let out=rect(0,under,length,s.floorThickness,'#9ea7aa');
    if(s.foundation==='piles'){
      const n=Math.ceil(length/2.5),head=under-.156;
      for(let i=0;i<=n;i++){
        const x=.2+(length-.4)*i/n;
        out+=rect(x-.05,s.groundY,.1,head-s.groundY,'#3b4348')+rect(x-.11,head-.025,.22,.025,'#89939a');
      }
      out+=rect(.125,under-.15,length-.25,.15,'#b69974')+rect(.125,under-.156,length-.25,.006,'#394550');
    }else{
      const depth=s.foundation==='slab'?.16:.32;
      out+=rect(-.05,under-depth,length+.1,depth,'#b4babd');
    }
    return '<g pointer-events="none">'+out+'</g>';
  }
  return {get,normalize,attic,atticLayout,pileLayout,grillageLayout,panelLayout,summary,inspector,addBase,addShell,addAttic,elevation,groundDepth:p=>-get(p).groundY};
})();

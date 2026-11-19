'use strict';

// Drawing geometry is shared with the PDF sheets. Handles and menus exist only on screen.
const Direct2D = (() => {
  const sessions = new WeakMap();
  const blue = '#267bad';
  let gripScale = 1;
  const step = n => Math.round(n * 20) / 20;
  const bound = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const copy = p => JSON.parse(JSON.stringify(p));
  const meter = n => fmt(n) + ' м';
  const len = wall => Math.hypot(wall.c - wall.a, wall.d - wall.b);
  const mid = (a, b) => (a + b) / 2;
  const within = (x, y, w, h) => x >= -.02 && x <= w+.02 && y >= -.02 && y <= h+.02;
  const millimetres = n => Math.round(n*1000)+' мм';
  const aligned = (value,refs) => refs.some(ref=>Math.abs(value-ref)<.001);
  function nearby(value,refs,tolerance=.09){
    const candidate=refs.reduce((best,ref)=>Math.abs(ref-value)<Math.abs(best-value)?ref:best,Infinity);
    return Math.abs(candidate-value)<=tolerance?candidate:value;
  }

  function grip(x, y, action, title, cursor) {
    return `<g transform="translate(${x} ${y}) scale(${gripScale}) translate(${-x} ${-y})" data-action="${action}" aria-label="${esc(title)}" style="cursor:${cursor}"><title>${esc(title)}</title><circle cx="${x}" cy="${y}" r="13" fill="transparent"/><rect x="${x-5}" y="${y-5}" width="10" height="10" rx="3" fill="white" stroke="${blue}" stroke-width="2"/></g>`;
  }
  function pill(x, y, text, action = '', anchor='middle', uiScale=gripScale) {
    const w = Math.max(34, text.length * 7.8 + 20);
    const left = anchor === 'middle' ? x-w/2 : x;
    const attr = action ? `data-action="${action}" role="button" tabindex="0" aria-label="${esc(text)}" style="cursor:pointer"` : 'pointer-events="none"';
    return `<g transform="translate(${x} ${y}) scale(${uiScale}) translate(${-x} ${-y})" ${attr}><rect x="${left}" y="${y-13}" width="${w}" height="26" rx="8" fill="${action?'#fff':blue}" stroke="${blue}" stroke-width="1.25"/><text x="${left+w/2}" y="${y+4.5}" fill="${action?'#16466a':'white'}" font-size="13" font-weight="600" text-anchor="middle">${esc(text)}</text></g>`;
  }
  function line(x,y,a,b,color,width,dash='') {
    return `<path d="M${x} ${y}L${a} ${b}" stroke="${color}" stroke-width="${width}" ${dash?'stroke-dasharray="'+dash+'"':''} fill="none" pointer-events="none"/>`;
  }
  function actionHit(action,id,path,width) {
    return `<path data-action="${action}" data-key="${esc(id)}" d="${path}" stroke="transparent" stroke-width="${width}" fill="none" style="cursor:grab"/> `;
  }
  function facadeGuides(s,q,g){
    if(!s.gesture)return '';
    const o=q.ops.find(item=>item.id===s.gesture.id),L=wallLen(q,s.opts.face);
    const X=u=>g.x0+u*g.scale,Y=v=>g.base-v*g.scale;
    const isOpening=o&&(s.gesture.action==='move-opening'||s.gesture.action.startsWith('op-'));
    const floor=isOpening?o.floor:0,base=floor*q.h;
    let out='<g data-drag-guides="'+(isOpening?'opening':'house')+'" pointer-events="none">';
    const ruler=g.x0-26;
    out+=line(ruler,Y(base),ruler,Y(base+q.h),blue,1);
    for(let y=0;y<=q.h+.0001;y+=.5){
      out+=line(ruler-5,Y(base+y),ruler+5,Y(base+y),blue,1);
      out+=`<text x="${ruler-9}" y="${Y(base+y)+4}" text-anchor="end" fill="${blue}" font-size="10">${Math.round(y*1000)}</text>`;
    }
    out+=line(X(0),Y(base),X(L),Y(base),blue,1.6,'7 5');
    if(isOpening){
      const others=q.ops.filter(item=>item.id!==o.id&&item.f===o.f&&item.floor===o.floor),ys=others.flatMap(item=>[item.sill,item.sill+item.h]),xs=others.flatMap(item=>[item.x,item.x+item.w]);
      for(const y of [...new Set(ys)])out+=line(X(0),Y(base+y),X(L),Y(base+y),'#15947766',1,'4 7');
      for(const x of [o.x,o.x+o.w])out+=line(X(x),Y(base),X(x),Y(base+q.h),aligned(x,xs)?'#008969':blue,1.5,'7 5');
      for(const y of [o.sill,o.sill+o.h])out+=line(X(0),Y(base+y),X(L),Y(base+y),aligned(y,ys)?'#008969':blue,1.5,'7 5');
      const markX=X(o.x)-15;
      out+=line(markX,Y(base),markX,Y(base+o.sill),blue,1.2,'3 3');
      out+=pill(bound(X(o.x+o.w/2),110,790),bound(Y(base)+25*gripScale,28,505),'От пола '+millimetres(o.sill));
      if([...ys].some(y=>Math.abs(y-o.sill)<.001||Math.abs(y-o.sill-o.h)<.001))out+=pill(450,505,'По линии соседнего проёма');
    }else{
      for(const x of [0,L])out+=line(X(x),Y(0),X(x),Y(q.h*q.n),blue,1.5,'7 5');
      out+=line(X(0),Y(q.h*q.n),X(L),Y(q.h*q.n),blue,1.5,'7 5');
    }
    return out+'</g>';
  }
  function planGuides(s,q,g){
    if(!s.gesture)return '';
    const X=x=>g.x+x*g.scale,Y=y=>g.y+y*g.scale,t=s.gesture;
    let out='<g data-drag-guides="'+(t.action.startsWith('house-')?'house':'partition')+'" pointer-events="none">';
    if(t.action.startsWith('house-')){
      for(const x of [0,q.w])out+=line(X(x),Y(0)-18,X(x),Y(q.d)+18,blue,1.5,'7 5');
      for(const y of [0,q.d])out+=line(X(0)-18,Y(y),X(q.w)+18,Y(y),blue,1.5,'7 5');
      out+=pill(450,505,'Дом '+millimetres(q.w)+' × '+millimetres(q.d));
    }else{
      const wall=q.walls.find(item=>item.id===t.id);
      if(wall){
        const others=q.walls.filter(item=>item.id!==wall.id&&item.floor===wall.floor),xs=others.flatMap(item=>[item.a,item.c]),ys=others.flatMap(item=>[item.b,item.d]);
        for(const x of [wall.a,wall.c])out+=line(X(x),Y(0),X(x),Y(q.d),aligned(x,xs)?'#008969':blue,1.2,'7 5');
        for(const y of [wall.b,wall.d])out+=line(X(0),Y(y),X(q.w),Y(y),aligned(y,ys)?'#008969':blue,1.2,'7 5');
        const start=t.action==='wall-start',x=start?wall.a:wall.c,y=start?wall.b:wall.d;
        out+=pill(450,505,'От левого края '+millimetres(x)+' · от заднего '+millimetres(y)+' · длина '+millimetres(len(wall)));
      }
    }
    return out+'</g>';
  }
  function planHandles(s,q,g) {
    const X = u => g.x + g.scale*u, Y = v => g.y+g.scale*v;
    let out='', active='';
    // A fine grid makes the plan readable while drawing, without obscuring the openings.
    for (let i=1;i<q.w;i++) out+=line(X(i),Y(0)+4,X(i),Y(q.d)-4,'#9eb3c036',.65,'2 4');
    for (let i=1;i<q.d;i++) out+=line(X(0)+4,Y(i),X(q.w)-4,Y(i),'#9eb3c036',.65,'2 4');
    for (const wall of q.walls.filter(w=>w.floor===s.opts.level)) {
      const x=X(wall.a), y=Y(wall.b), a=X(wall.c), b=Y(wall.d);
      out+=actionHit('move-wall',wall.id,`M${x} ${y}L${a} ${b}`,18);
      if (wall.id !== s.wallId) continue;
      active=line(x,y,a,b,blue,4)+actionHit('move-wall',wall.id,`M${x} ${y}L${a} ${b}`,18)
        +grip(x,y,'wall-start','Начало перегородки','grab')+grip(a,b,'wall-end','Конец перегородки','grab')
        +pill(mid(x,a),mid(y,b)-20*gripScale,meter(len(wall)));
      if (!s.gesture) active+=pill(bound(mid(x,a),72,828),bound(mid(y,b)+24*gripScale,22,509),'Удалить','remove-wall');
    }
    const cornerX=X(q.w), cornerY=Y(q.d);
    out+=grip(cornerX,mid(Y(0),cornerY),'house-width','Ширина дома','ew-resize')
      +grip(mid(X(0),cornerX),cornerY,'house-depth','Глубина дома','ns-resize')
      +grip(cornerX,cornerY,'house-corner','Размеры дома','nwse-resize');
    if (s.gesture?.action.startsWith('house-')) out+=pill(mid(X(0),cornerX),Y(0)+24,meter(q.w)+' × '+meter(q.d));
    return out+active;
  }
  function facadeHandles(s,q,g) {
    const L=wallLen(q,s.opts.face), H=q.h*q.n, base=g.base, top=base-g.scale*H;
    const x0=g.x0, x1=x0+L*g.scale;
    let out=grip(x1,mid(top,base),'house-width','Ширина стены','ew-resize')
      +grip(mid(x0,x1),top,'house-height','Высота стен','ns-resize');
    const o=q.ops.find(v=>v.id===s.openId && v.f===s.opts.face);
    if (o) {
      const left=x0+o.x*g.scale, right=left+o.w*g.scale;
      const bottom=base-(o.floor*q.h+o.sill)*g.scale, high=bottom-o.h*g.scale;
      out+=`<rect x="${left}" y="${high}" width="${right-left}" height="${bottom-high}" fill="none" stroke="${blue}" stroke-width="2.5" pointer-events="none"/>`;
      out+=grip(left,mid(high,bottom),'op-left','Левый край','ew-resize')
        +grip(right,mid(high,bottom),'op-right','Правый край','ew-resize')
        +grip(mid(left,right),high,'op-top','Верх проёма','ns-resize')
        +grip(mid(left,right),bottom,'op-bottom','Низ проёма','ns-resize')
        +grip(right,high,'op-corner','Ширина и высота проёма','nesw-resize');
      out+=pill(bound(mid(left,right),115,785),bound(high-21*gripScale,17*gripScale,530-20*gripScale),'Ш '+millimetres(o.w)+' × В '+millimetres(o.h));
      if(!s.gesture && !s.menu) out+=pill(bound(mid(left,right),55,845),bound(bottom+22*gripScale,17*gripScale,530-20*gripScale),'Удалить','remove-opening');
    }
    if(s.gesture?.action.startsWith('house-')) out+=pill(mid(x0,x1),top+23,meter(L)+' × '+meter(H));
    if(s.menu){
      const m=s.menu, x=bound(x0+m.x*g.scale,106*gripScale,900-106*gripScale),y=bound(base-(q.h*m.floor+m.localY)*g.scale-24*gripScale,22*gripScale,530-52*gripScale);
      out+=`<g transform="translate(${x} ${y}) scale(${gripScale}) translate(${-x} ${-y})"><rect x="${x-102}" y="${y-18}" width="204" height="65" rx="10" fill="white" stroke="#b1ccdc"/>`
        +pill(x-55,y,'Окно','insert-0','middle',1)+pill(x+41,y,'Витраж','insert-1','middle',1)+pill(x-52,y+30,'Дверь','insert-2','middle',1)+pill(x+43,y+30,'Балконная','insert-3','middle',1)+'</g>';
    }
    return out;
  }

  function paint(s) {
    const q=s.preview||s.project, isPlan=s.opts.view==='План';
    const g=isPlan?plan(q,s.opts.level):facade(q,s.opts.face);
    const bounds=s.host.getBoundingClientRect?.();
    const viewScale=bounds?Math.min(bounds.width/900,bounds.height/530):1;
    gripScale=bound(1/Math.max(.1,viewScale),.88,2.4);
    const overlay=isPlan?planGuides(s,q,g)+planHandles(s,q,g):facadeGuides(s,q,g)+facadeHandles(s,q,g);
    let html=g.html.replace(/<\/svg>\s*$/,overlay+'</svg>');
    // Lock drawing coordinates for the duration of a drag even as the fitted house size changes.
    const ref=s.gesture?.geometry;
    if(ref) {
      const scale=ref.scale/g.scale;
      const dx=isPlan?ref.x-scale*g.x:ref.x0-scale*g.x0;
      const dy=isPlan?ref.y-scale*g.y:ref.base-scale*g.base;
      html=html.replace(/(<svg\b[^>]*>)/,'$1<g transform="translate('+dx+' '+dy+') scale('+scale+')">').replace(/<\/svg>\s*$/,'</g></svg>');
    }
    s.host.innerHTML=html;
    const svgNode=s.host.querySelector('svg');
    svgNode.setAttribute('data-direct','yes');
    svgNode.style.touchAction='none';
    svgNode.style.userSelect='none';
    svgNode.setAttribute('aria-label',isPlan?'Редактируемый план этажа':'Редактируемый фасад');
  }

  function resize(q,axis,raw) {
    const next=bound(step(raw),3,35),old=q[axis];
    if(next===old)return;
    const ratio=next/old;
    for(const o of q.ops.filter(v=>(v.f%2?'d':'w')===axis)){
      // Preserve the opening size. Distribute the facade's remaining width proportionally.
      o.x=old>o.w?Math.max(0,(next-o.w)*o.x/(old-o.w)):0;
    }
    for(const w of q.walls){
      for(const k of axis==='w'?['a','c']:['b','d'])w[k]=Math.round(w[k]*ratio*1000)/1000;
    }
    q[axis]=next;
  }
  function svgPoint(s,e) {
    const m=s.host.querySelector('svg')?.getScreenCTM();
    return m?new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()):null;
  }
  function onDown(s,e) {
    if(!enabled(s)||s.gesture||e.button>2||e.button===1)return false;
    const pt=svgPoint(s,e);
    if(!pt)return false;
    s.host.focus({preventScroll:true});
    const q=s.project, opts=s.opts, isPlan=opts.view==='План';
    const g=isPlan?plan(q,opts.level):facade(q,opts.face);
    const node=e.target.closest('[data-action]'),opening=e.target.closest('[data-op]');
    let action=node?.dataset.action||'', id=node?.dataset.key||'';
    if (e.button===2 && isPlan && !['move-wall','wall-start','wall-end'].includes(action)) action='';
    if (action==='remove-opening'||action==='remove-wall'||action.startsWith('insert-')) {
      button(s,action);return true;
    }
    if(action==='move-wall')s.wallId=id;
    if(action==='wall-start'||action==='wall-end')id=s.wallId;
    if(action.startsWith('op-'))id=s.openId;
    s.menu=null;
    if (isPlan && !action) {
      const a=(pt.x-g.x)/g.scale,b=(pt.y-g.y)/g.scale;
      if(!within(a,b,q.w,q.d)){s.wallId='';paint(s);return true}
      action='draw-wall';id=uid();s.wallId=id;
    } else if (!isPlan && !action){
      if(opening && opts.mode!=='add'){action='move-opening';id=opening.dataset.op;s.openId=id}
      else {
        const x=(pt.x-g.x0)/g.scale, totalY=(g.base-pt.y)/g.scale;
        if(!within(x,totalY,wallLen(q,opts.face),q.n*q.h)){s.openId='';notifySelection(s);paint(s);return true}
        const floor=bound(Math.floor(totalY/q.h),0,q.n-1);
        s.menu={x,localY:totalY-floor*q.h,floor};s.openId='';
        if(opts.mode==='add')button(s,'insert-'+(opts.kind??0));else paint(s);return true;
      }
    }
    s.host.setPointerCapture(e.pointerId);
    s.gesture={action,id,pt,geometry:g,start:copy(q),pid:e.pointerId,moved:false,lastGood:null};
    paint(s);
    return true;
  }

  function preview(s,pt,e) {
    const t=s.gesture, orig=t.start, g=t.geometry, q=copy(orig);
    const dx=(pt.x-t.pt.x)/g.scale,dy=(pt.y-t.pt.y)/g.scale;
    let reason='',action=t.action;
    if(action.startsWith('house-')){
      if(action==='house-width'||action==='house-corner') {
        const axis=s.opts.view==='Фасады'&&s.opts.face%2?'d':'w';resize(q,axis,orig[axis]+dx);
      }
      if(action==='house-depth'||action==='house-corner')resize(q,'d',orig.d+dy);
      if(action==='house-height')q.h=bound(step(orig.h-dy/q.n),2.2,6);
    } else if(action==='move-opening'||action.startsWith('op-')) {
      const o=q.ops.find(ob=>ob.id===t.id);if(!o)return;
      const right=o.x+o.w,top=o.sill+o.h,L=wallLen(q,o.f);
      if(action==='move-opening'){
        o.x=bound(step(o.x+dx),0,L-o.w);o.sill=bound(step(o.sill-dy),0,q.h-o.h);
      }
      if(action==='op-left'){o.x=bound(step(o.x+dx),0,right-.2);o.w=right-o.x}
      if(action==='op-right'||action==='op-corner')o.w=bound(step(o.w+dx),.2,L-o.x);
      if(action==='op-bottom'){o.sill=bound(step(o.sill-dy),0,top-.2);o.h=top-o.sill}
      if(action==='op-top'||action==='op-corner')o.h=bound(step(o.h-dy),.2,q.h-o.sill);
      if(!e.altKey&&window.PentiiAlign?.snapOpening){
        const key=action==='move-opening'?'move':action.slice(3),tolerance=bound(7/g.scale,.025,.12);
        Object.assign(o,PentiiAlign.snapOpening(q,o,key,tolerance).opening);
      }
    } else {
      const snapX=n=>bound(step(n),0,q.w),snapY=n=>bound(step(n),0,q.d);
      let x=snapX((pt.x-g.x)/g.scale),y=snapY((pt.y-g.y)/g.scale);
      const others=q.walls.filter(w=>w.id!==t.id&&w.floor===s.opts.level),xs=[0,q.w,...others.flatMap(w=>[w.a,w.c])],ys=[0,q.d,...others.flatMap(w=>[w.b,w.d])];
      const tolerance=bound(7/g.scale,.025,.12);
      if(!e.altKey){x=nearby(x,xs,tolerance);y=nearby(y,ys,tolerance);}
      let wall=q.walls.find(w=>w.id===t.id);
      if(action==='draw-wall'){
        wall={id:t.id,floor:s.opts.level,a:snapX((t.pt.x-g.x)/g.scale),b:snapY((t.pt.y-g.y)/g.scale),c:x,d:y};q.walls.push(wall);
      }
      if(!wall)return;
      if(action==='move-wall'){
        let deltaX=bound(step(dx),-Math.min(wall.a,wall.c),q.w-Math.max(wall.a,wall.c));
        let deltaY=bound(step(dy),-Math.min(wall.b,wall.d),q.d-Math.max(wall.b,wall.d));
        if(!e.altKey){
          deltaX=nearby(deltaX,xs.flatMap(x=>[x-wall.a,x-wall.c]),tolerance);
          deltaY=nearby(deltaY,ys.flatMap(y=>[y-wall.b,y-wall.d]),tolerance);
          deltaX=bound(deltaX,-Math.min(wall.a,wall.c),q.w-Math.max(wall.a,wall.c));
          deltaY=bound(deltaY,-Math.min(wall.b,wall.d),q.d-Math.max(wall.b,wall.d));
        }
        wall.a+=deltaX;wall.c+=deltaX;wall.b+=deltaY;wall.d+=deltaY;
      }else{
        const end=action==='wall-start'?['a','b','c','d']:['c','d','a','b'];
        const bx=wall[end[2]],by=wall[end[3]];
        if(e.shiftKey || Math.min(Math.abs(x-bx),Math.abs(y-by))<.10){
          if(Math.abs(x-bx)<Math.abs(y-by))x=bx;else y=by;
        }
        wall[end[0]]=x;wall[end[1]]=y;
      }
      if(len(wall)<.25)reason='Минимальная длина перегородки — 25 см.';
    }
    reason=reason||s.opts.validate?.(q)||'';
    if(reason){s.opts.onMessage?.(reason);return}
    t.lastGood=q;s.preview=q;s.opts.onMessage?.('');paint(s);
  }
  function notifySelection(s) {
    const o=s.project.ops.find(v=>v.id===s.openId);
    s.opts.onSelect?.(s.openId,o?.floor??s.opts.level);
  }
  function onEnd(s,e,cancel) {
    const t=s.gesture;
    if(!t||t.pid!==e.pointerId)return false;
    if(!cancel){
      const pt=svgPoint(s,e);
      if(pt&&Math.hypot(pt.x-t.pt.x,pt.y-t.pt.y)>2){t.moved=true;preview(s,pt,e)}
    }
    s.gesture=null;s.preview=null;
    if(s.host.hasPointerCapture(e.pointerId))s.host.releasePointerCapture(e.pointerId);
    if(!cancel && t.lastGood){if(s.opts.onCommit?.(t.lastGood)!==false)s.project=t.lastGood}
    if(t.action==='draw-wall'&&(!t.lastGood||cancel))s.wallId='';
    if(!cancel&&(t.action==='move-opening'||t.action.startsWith('op-'))){s.openId=t.id;notifySelection(s)}
    if(!cancel&&['draw-wall','move-wall','wall-start','wall-end'].includes(t.action))s.opts.onSelect?.(s.wallId,s.opts.level);
    if(enabled(s))paint(s);return true;
  }
  function button(s,action) {
    const q=copy(s.project);let id='',floor=s.opts.level;
    if(action==='remove-wall'){q.walls=q.walls.filter(w=>w.id!==s.wallId);s.wallId=''}
    else if(action==='remove-opening'){q.ops=q.ops.filter(o=>o.id!==s.openId);s.openId=''}
    else if(action.startsWith('insert-')&&s.menu){
      const m=s.menu,k=Number(action.slice(7));if(![0,1,2,3].includes(k))return;
      floor=m.floor;const L=wallLen(q,s.opts.face);
      const width=Math.min([1.25,2.8,1,1.5][k],L),height=Math.min(q.h,k===0?1.4:2.15);
      const sill=k===0?bound(step(m.localY-height/2),0,q.h-height):0;
      // Find the free interval around the click, so a standard opening fits between neighbours.
      let left=0,right=L;
      for(const o of q.ops.filter(o=>o.f===s.opts.face&&o.floor===floor&&o.sill<height+sill&&sill<o.h+o.sill)){
        if(o.x+o.w<=m.x)left=Math.max(left,o.x+o.w+.05);
        else if(o.x>=m.x)right=Math.min(right,o.x-.05);
        else {s.opts.onMessage?.('Здесь уже есть проём. Выберите свободную часть стены.');s.menu=null;paint(s);return}
      }
      if(right-left<.2){s.opts.onMessage?.('На этом участке недостаточно места для проёма.');s.menu=null;paint(s);return}
      const w=Math.min(width,right-left),x=bound(step(m.x-w/2),left,right-w);
      id=uid();q.ops.push({id,f:s.opts.face,x,w,k,h:height,sill,floor});
    }else return;
    const warning=s.opts.validate?.(q);if(warning){s.opts.onMessage?.(warning);return}
    s.menu=null;
    if(s.opts.onCommit?.(q)!==false){s.project=q;s.openId=id;s.opts.onMode?.('');s.opts.onSelect?.(id,floor)}
    if(enabled(s))paint(s);
  }
  function enabled(s){return s.host.isConnected&&s.host.querySelector('svg[data-direct="yes"]')!==null}
  function install(s){
    for(const event of ['pointerdown','pointermove','pointerup','pointercancel','contextmenu','keydown']){
      s.host.addEventListener(event,e=>{
        if(!enabled(s))return;
        if(event==='contextmenu'){e.preventDefault();e.stopImmediatePropagation();return}
        if(event==='keydown'){
          const action=e.target.closest('[data-action]')?.dataset.action;
          if(e.key==='Escape'){s.menu=null;s.wallId='';s.openId='';s.gesture=null;s.preview=null;notifySelection(s);paint(s)}
          else if((e.key==='Delete'||e.key==='Backspace')&&(s.wallId||s.openId)){button(s,s.opts.view==='План'?'remove-wall':'remove-opening')}
          else if((e.key==='Enter'||e.key===' ')&&action)button(s,action);else return;
        } else if(event==='pointerdown')onDown(s,e);
        else if(event==='pointermove'){
          if(s.gesture?.pid===e.pointerId){
            const pt=svgPoint(s,e);if(pt&&Math.hypot(pt.x-s.gesture.pt.x,pt.y-s.gesture.pt.y)>2){s.gesture.moved=true;preview(s,pt,e)}
          }
        }else onEnd(s,e,event==='pointercancel');
        e.preventDefault();e.stopImmediatePropagation();
      },{capture:true,passive:false});
    }
  }
  function draw(host,project,opts) {
    let s=sessions.get(host);
    if(!s){host.tabIndex=0;s={host};sessions.set(host,s);install(s)}
    const changed=s.project?.id!==project.id||s.opts?.view!==opts.view||s.opts?.face!==opts.face||s.opts?.level!==opts.level||s.opts?.mode!==opts.mode;
    if(changed){s.preview=null;s.gesture=null;s.menu=null;s.wallId='';s.openId=''}
    s.opts=opts;s.project=project;s.openId=opts.selected??s.openId;
    paint(s);
  }
  return {draw};
})();

window.Direct2D = Direct2D;

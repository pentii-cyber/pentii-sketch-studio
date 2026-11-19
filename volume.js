/* Pentii dimensional model. All scene units are metres; every facade uses the same
   local horizontal axis as the plan, elevation drawing and opening schedule. */
window.StudioVolume = (() => {
  'use strict';
  const T = window.THREE;
  const V = (x,y,z) => new T.Vector3(x,y,z);
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const quant = n => Math.round(n*20)/20;
  const metres = n => n.toLocaleString('ru-RU',{maximumFractionDigits:2})+' м';
  const blue = '#1688c9';
  const stage = document.createElement('div');
  stage.className = 'pentii-model-stage';
  stage.style.cssText='position:absolute;inset:0;overflow:hidden;touch-action:none;color:#203e54;user-select:none';
  const overlays = document.createElement('div');
  overlays.style.cssText='pointer-events:none;position:absolute;inset:0;overflow:hidden';
  const status = document.createElement('output');
  status.style.cssText='position:absolute;bottom:55px;left:50%;transform:translateX(-50%);max-width:90%;text-align:center;background:#173e58ed;color:white;padding:6px 11px;border-radius:7px;font:500 12px Onest,Arial;pointer-events:none';
  status.hidden=true;
  const menu = document.createElement('div');
  menu.style.cssText='position:absolute;z-index:3;background:white;box-shadow:0 4px 22px #294b603b;border:1px solid #bbd6e4;border-radius:10px;padding:5px;min-width:135px;max-width:240px';
  menu.hidden=true;
  const sectionBar=document.createElement('div');
  sectionBar.className='volume-section-actions';sectionBar.setAttribute('role','group');
  sectionBar.setAttribute('aria-label','Секции кровли в 3D');sectionBar.hidden=true;
  sectionBar.style.cssText='position:absolute;z-index:2;left:7px;top:7px;max-width:calc(100% - 14px);display:flex;align-items:center;flex-wrap:wrap;gap:4px;border:1px solid #a9cbdf;border-radius:9px;padding:4px;background:#f9fcfffa;box-shadow:0 2px 9px #23435a29;font:600 12px Onest,Arial';
  for(const name of ['pointerdown','pointerup','pointermove','contextmenu','wheel'])sectionBar.addEventListener(name,e=>e.stopPropagation());
  let barKey='',placementCamera=null,inspectTap=null;
  const cameras={
    corner:['Общий вид',29,16],front:['Главный фасад',0,0],side:['Правый фасад',90,0],
    rear:['Задний фасад',180,0],left:['Левый фасад',270,0],top:['Вид сверху',15,70],
    exact:['Главный фасад',0,0],garden:['Спереди и справа',29,16],
    photoRight:['Справа и сзади',119,16],gardenRear:['Сзади и слева',209,16],photoLeft:['Слева и спереди',299,16]
  };
  const radians=degrees=>degrees*Math.PI/180;
  let scene,cam,renderer,group,light,observer,container,project,options={},selected=null,gesture=null;
  let activePreset='front',cameraSignature='';
  let azimuth=0,elevation=0,zoom=1,fit=1,width=800,height=500,drawn=false,lastStatus=0;
  let offset,modelBounds,viewTarget,yardVisible=true,applyingGesture=false;
  let previousLayer='',exteriorCamera=null,renderBusy=false;
  const pointerMap = new Map();
  let pinch=null;
  const textures = {}, imageReady = {};
  function requestFrame(){if(!drawn||renderBusy)return;render()}
  function texture(name) {
    if(textures[name])return textures[name];
    let resolve;imageReady[name]=new Promise(r=>resolve=r);
    let loaded=()=>{resolve();requestFrame()};
    let t=new T.TextureLoader().load(window.PentiiSurfaces[name],loaded,undefined,loaded);
    t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;
    return textures[name]=t;
  }
  function init(){
    if(renderer)return true;
    try{
      renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
      renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
      renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none';
      renderer.domElement.tabIndex=0;
      renderer.domElement.setAttribute('aria-label','3D-модель дома. Стрелки поворачивают дом, плюс и минус меняют масштаб, Home возвращает дом в кадр.');
      const toolbar=document.createElement('div');toolbar.className='volume-zoom-toolbar';
      toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Масштаб модели');
      toolbar.style.cssText='position:absolute;right:10px;bottom:9px;display:flex;gap:4px';
      for(const [symbol,label,fn] of [['−','Отдалить',()=>scale(1/1.23)],['+','Приблизить',()=>scale(1.23)],['⌖','Дом целиком',fitView]]){
        const b=document.createElement('button');b.type='button';b.textContent=symbol;b.setAttribute('aria-label',label);b.title=label;b.style.cssText='width:36px;height:36px;padding:0;line-height:1;font-size:20px;background:#f6fbffef';b.onclick=fn;toolbar.append(b);
      }
      for(const event of ['pointerdown','pointermove','pointerup','contextmenu','wheel'])toolbar.addEventListener(event,e=>e.stopPropagation());
      stage.replaceChildren(renderer.domElement,overlays,sectionBar,status,menu,toolbar);
      scene=new T.Scene();scene.background=new T.Color(0xe5e9e7);installDaylight();
      cam=new T.OrthographicCamera(-1,1,1,-1,.1,400);offset=V(0,0,0);viewTarget=V(0,0,0);
      renderer.domElement.addEventListener('keydown',keyboardCamera);
      scene.add(new T.HemisphereLight(0xeaf2ff,0xe2cba9,.32));
      light=new T.DirectionalLight(0xfff4e6,2.03);
      light.castShadow=true;light.shadow.bias=-.00013;light.shadow.normalBias=.013;
      light.shadow.mapSize.set(2048,2048);light.shadow.radius=2.65;scene.add(light,light.target);
      observer=new ResizeObserver(()=>{if(container&&stage.isConnected&&project&&!gesture&&!renderBusy)resize()});
      observer.observe(stage);return true;
    }catch(err){console.warn('3D preview:',err.message);return false}
  }
  function disposeGroup(g) {
    if(!g)return;
    const geometries=new Set(),materials=new Set();
    g.traverse(o=>{o.userData.ownedTexture?.dispose();if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material){for(let m of [].concat(o.material))materials.add(m)}});
    geometries.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());g.removeFromParent();
  }
  function surface(color,extra={}){return new T.MeshStandardMaterial({color,roughness:.82,side:T.DoubleSide,...extra})}
  function mesh(geo,mat,parent,hit) {
    let m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;m.userData.target=hit;parent.add(m);return m;
  }
  function box(parent,x,y,z,w,h,d,mat,hit){if(Math.min(w,h,d)<.001)return;let m=mesh(new T.BoxGeometry(w,h,d),mat,parent,hit);m.position.set(x,y,z);return m}
  const finishMaps=new Map();
  function mappedCanvas(canvas,colorData=true){
    const map=new T.CanvasTexture(canvas);
    if(colorData)map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
    return map;
  }
  function makePlaster(){
    // A 450 mm square sample. Trowelling drags separate mineral grains inside
    // short broken grooves. Store real relief and colour separately.
    const n=512,mask=n-1,heights=new Float32Array(n*n),grain=new Float32Array(n*n);
    let seed=71821;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    for(let i=0;i<heights.length;i++){grain[i]=random();heights[i]=.18+grain[i]*.22;}
    for(let i=0;i<1480;i++){
      let x=random()*n,y=random()*n,shear=(random()-.5)*.42,phase=random()*6.28;
      const len=4+random()*18,radius=.75+random()*1.15,depth=.42+random()*.44;
      for(let step=0;step<len;step++){
        const yy=Math.floor(y+step),xx=x+step*shear+.8*Math.sin(phase+step*.19);
        const taper=Math.min(1,(step+1)*.38,(len-step)*.38);
        for(let k=-3;k<=3;k++){
          const ix=Math.floor(xx)+k,dist=Math.abs(ix-xx)/radius,at=(yy&mask)*n+(ix&mask);
          if(dist<1)heights[at]=Math.min(heights[at],.22-depth*(1-dist*.68)*taper);
          else if(dist<1.6)heights[at]=Math.max(heights[at],.35+.09*taper*grain[at]);
        }
      }
    }
    const make=()=>{const c=document.createElement('canvas');c.width=c.height=n;return c};
    const color=make(),normal=make(),c=color.getContext('2d'),nc=normal.getContext('2d');
    const pixels=c.createImageData(n,n),normals=nc.createImageData(n,n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const i=y*n+x,o=i*4,h=heights[i];
      const tint=241+grain[i]*11+Math.min(0,h-.13)*35+1.7*Math.sin(x*2*Math.PI/n)*Math.cos(y*4*Math.PI/n);
      pixels.data.set([tint,tint,tint,255],o);
      const dx=(heights[y*n+((x-1)&mask)]-heights[y*n+((x+1)&mask)])*.85;
      const dy=(heights[((y+1)&mask)*n+x]-heights[((y-1)&mask)*n+x])*.85;
      const length=Math.hypot(dx,dy,1);
      normals.data.set([128+127*dx/length,128+127*dy/length,128+127/length,255],o);
    }
    c.putImageData(pixels,0,0);nc.putImageData(normals,0,0);
    return {width:.45,height:.45,map:mappedCanvas(color),normalMap:mappedCanvas(normal,false)};
  }
  function facadeSurface(kind){
    if(finishMaps.has(kind))return finishMaps.get(kind);
    let finish;
    if(kind==='Короед')finish=makePlaster();
    else{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const ctx=canvas.getContext('2d');let seed=30231;
      const r=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
      ctx.fillStyle='#fafafa';ctx.fillRect(0,0,512,512);
      if(kind==='Планкен'){
        for(let j=0;j<8;j++){
          const shade=Math.floor(230+r()*22);ctx.fillStyle='rgb('+[shade,shade,shade].join(',')+')';ctx.fillRect(0,j*64,512,64);
          for(let i=0;i<36;i++){
            const y=j*64+r()*60,x=r()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+18,y-1,x+34,y+2,x+50+r()*125,y);
            ctx.strokeStyle=r()>.5?'#ffffff85':'#58545130';ctx.lineWidth=.5+r();ctx.stroke();
          }
          ctx.fillStyle='#686869';ctx.fillRect(0,j*64+62,512,2);ctx.fillStyle='#b5b2af';ctx.fillRect(0,j*64,512,2);
        }
      }else{
        for(let j=0;j<55000;j++){ctx.fillStyle=r()>.6?'#5a5a5a10':'#cccccc42';ctx.fillRect(r()*512,r()*512,1+r()*2,1+r()*1.5)}
        if(kind==='Панели'){
          ctx.fillStyle='#a9aba7';ctx.fillRect(0,0,512,3);ctx.fillRect(0,0,3,512);
          for(let x of [11,501])for(let y of [12,171,341,500]){ctx.fillStyle='#a6aaa8';ctx.beginPath();ctx.arc(x,y,1.5,0,2*Math.PI);ctx.fill()}
        }
      }
      finish={width:kind==='Панели'?1.2:2.55,height:kind==='Планкен'?1.44:kind==='Панели'?.62:1.1,map:mappedCanvas(canvas),normalMap:null};
    }
    finishMaps.set(kind,finish);return finish;
  }
  const plasterChips=new Map();
  window.PentiiPlasterSwatch=function(color='#e5ddcb'){
    if(plasterChips.has(color))return plasterChips.get(color);
    const mat=facadeSurface('Короед');
    const tile=mat.map.image,n=tile.width;
    const diffuse=tile.getContext('2d').getImageData(0,0,n,n).data;
    const normal=mat.normalMap.image.getContext('2d').getImageData(0,0,n,n).data;
    // This crop corresponds to a 225 × 75 mm horizontal piece of the tiled
    // finish, lit from the left for a legible close-up of the actual relief.
    const chip=document.createElement('canvas');chip.width=n/2;chip.height=Math.round(chip.width/3);
    const ctx=chip.getContext('2d'),out=ctx.createImageData(chip.width,chip.height);
    const base=new T.Color(color);
    const srgb=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
    for(let y=0;y<chip.height;y++)for(let x=0;x<chip.width;x++){
      const i=4*(n*(y+83)+x+51),j=4*(y*chip.width+x);
      const nx=normal[i]/127.5-1,ny=normal[i+1]/127.5-1,nz=normal[i+2]/127.5-1;
      const light=.40+Math.max(0,-nx*.76+ny*.35+nz*.48)*1.1;
      const grain=Math.pow(diffuse[i]/255,2.2)*light;
      out.data.set([srgb(grain*base.r),srgb(grain*base.g),srgb(grain*base.b),255],j);
    }
    ctx.putImageData(out,0,0);const url=chip.toDataURL('image/png');plasterChips.set(color,url);return url;
  };
  function stoneFinish(){
    if(textures.plinth)return textures.plinth;
    const c=document.createElement('canvas');c.width=1024;c.height=256;
    const ctx=c.getContext('2d');let seed=71253;const r=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    const pixels=ctx.createImageData(c.width,c.height);
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const row=y>>6,k=x+(row%2?128:0),tile=(k>>8)%4,within=k%256;
      const cloud=Math.sin(x*Math.PI/128+Math.sin(y*Math.PI/32))*.9;
      const tone=161+4*Math.sin(tile*147+row*95)+8*cloud+(r()-.5)*29+(r()>.987?20:0);
      const joint=(y%64<1||within<1),edge=(y%64===1||within===1);
      const d=joint?-58:edge?11:0;pixels.data.set([tone+d+6,tone+d+3,tone+d-1,255],4*(y*c.width+x));
    }
    ctx.putImageData(pixels,0,0);return textures.plinth=mappedCanvas(c);
  }
  function reliefGlass(){
    // A reflected panorama moves with the view direction. If the lighting rig
    // supplies a site environment, Three takes its reflections directly.
    if(scene.environment)return null;
    if(textures.glassSky)return textures.glassSky;
    const c=document.createElement('canvas');c.width=1024;c.height=512;
    const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,512);
    for(const [stop,col] of [[0,'#6ca2c3'],[.4,'#c8dbe1'],[.5,'#f3ead8'],[.55,'#8b927b'],[.7,'#677364'],[1,'#404e48']])g.addColorStop(stop,col);
    ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
    let seed=98113;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    for(let row=0;row<3;row++){
      ctx.fillStyle=['#959f92','#818b7b','#657362'][row];ctx.beginPath();ctx.moveTo(0,340);
      const count=1024;for(let x=0;x<=count;x+=2){
        const h=Math.sin(2*Math.PI*x/count*3+row*.9)*9+Math.sin(2*Math.PI*x/count*23)*1.4;
        ctx.lineTo(x,250+row*7+h+Math.cos(x*.19)*2+rng()*3);
      }
      ctx.lineTo(count,355);ctx.closePath();ctx.fill();
    }
    const env=new T.CanvasTexture(c);env.colorSpace=T.SRGBColorSpace;env.mapping=T.EquirectangularReflectionMapping;
    textures.glassSky=env;return env;
  }
  function windowGlass(p){
    if(!window.PentiiEnvironmentAssets?.panorama){
      return new T.MeshPhysicalMaterial({color:'#91a8b2',roughness:.08,metalness:.38,transparent:true,opacity:.44,envMap:reliefGlass(),envMapIntensity:1.2,depthWrite:false});
    }
    // Reflect the site's panorama from each point of the pane. A local probe
    // gives nearby trees parallax across wide windows even in parallel projection.
    return new T.ShaderMaterial({
      uniforms:{sky:{value:environmentImage('panorama')},center:{value:V(p.w/2,1.25,p.d/2)},radius:{value:Math.max(12,p.w,p.d)+2}},
      transparent:true,depthWrite:false,side:T.FrontSide,
      vertexShader:`
        varying vec3 point;
        varying vec3 outward;
        void main(){
          vec4 world=modelMatrix*vec4(position,1.);
          point=world.xyz;outward=normalize(mat3(modelMatrix)*normal);
          gl_Position=projectionMatrix*viewMatrix*world;
        }`,
      fragmentShader:`
        uniform sampler2D sky;
        uniform vec3 center;
        uniform float radius;
        varying vec3 point;
        varying vec3 outward;
        void main(){
          vec3 N=normalize(outward),V=normalize(cameraPosition-point);
          vec3 ray=reflect(-V,N),scale=vec3(radius,radius*.36,radius);
          vec3 origin=(point-center)/scale,d=ray/scale;
          float b=dot(d,origin),a=dot(d,d);
          float hit=(-b+sqrt(max(0.,b*b-a*(dot(origin,origin)-1.))))/a;
          vec3 sphere=normalize(origin+max(0.,hit)*d);
          vec2 uv=vec2(fract(1.06+atan(sphere.z,sphere.x)*.15915494),.5+asin(clamp(sphere.y,-1.,1.))*.31830989);
          vec3 photo=texture2D(sky,uv).rgb;
          float grey=dot(photo,vec3(.21,.72,.07));
          vec3 reflected=mix(vec3(grey),photo,.49)*vec3(.73,.93,1.11);
          reflected+=vec3(.027,.065,.089)*(.82+.18*sphere.y);
          float angle=pow(1.-clamp(dot(V,N),0.,1.),3.);
          gl_FragColor=vec4(reflected,.53+.37*angle);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
  }
  function faceUV(block,x,y,width,height){
    if(!block)return;
    const {position:pos,uv,normal}=block.geometry.attributes;
    for(let i=0;i<pos.count;i++){
      const a=Math.abs(normal.getX(i))>.5?pos.getZ(i):x+pos.getX(i);
      const b=Math.abs(normal.getY(i))>.5?pos.getZ(i):y+pos.getY(i);
      uv.setXY(i,a/width,b/height);
    }
  }
  function drape(side,left,y,w,h,target,mat){
    const width=Math.min(.48,w*.23),strips=Math.max(6,Math.round(width/.019));
    const geo=new T.PlaneGeometry(width,h,strips,2),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const u=(pos.getX(i)+width/2)/width,v=(pos.getY(i)+h/2)/h;
      pos.setX(i,pos.getX(i)*(1-.13*v));
      pos.setZ(i,Math.sin(u*width*2*Math.PI/.073)*.023*(1-.18*v));
    }
    geo.computeVertexNormals();const fabric=mesh(geo,mat,side,target);
    fabric.position.set(left+width/2,y,-.24);
  }
  function roomsBehindGlass(group,p){
    // The geometry seen through the glazing uses the same floor, coordinates,
    // orientation and items as the manager's plan. Batch the small fittings.
    const finishes={
      plaster:surface('#bbb2a2'), oak:surface('#bea887',{map:texture('wood')}),
      boards:surface('#8e775d',{map:texture('wood')}),ivory:surface('#c1b8a8'),linen:surface('#a59d90'),
      dark:surface('#494543'),metal:surface('#8f9290',{metalness:.36,roughness:.42})
    };
    const bins=new Map(),tmp=new T.Object3D();
    let x=0,y=0,z=0,angle=0;
    function part(key,cx,cy,cz,w,h,d){
      if(Math.min(w,h,d)<=.001)return;
      if(!bins.has(key))bins.set(key,[]);
      const cos=Math.cos(angle),sin=Math.sin(angle);
      tmp.position.set(x+cx*cos+cz*sin,y+cy,z-cx*sin+cz*cos);
      tmp.rotation.set(0,angle,0);tmp.scale.set(w,h,d);tmp.updateMatrix();
      bins.get(key).push(tmp.matrix.clone());
    }
    for(let i=0;i<p.n;i++){
      y=i*p.h;part('oak',p.w/2,.008,p.d/2,p.w,.017,p.d);
      if(i>0)part('plaster',p.w/2,-.035,p.d/2,p.w,.068,p.d);
    }
    for(const wall of p.walls||[]){
      x=(wall.a+wall.c)/2;z=(wall.b+wall.d)/2;y=wall.floor*p.h;
      angle=-Math.atan2(wall.d-wall.b,wall.c-wall.a);
      const length=Math.hypot(wall.d-wall.b,wall.c-wall.a);
      part('plaster',0,p.h/2,0,length,p.h,.10);
    }
    function feet(w,d,h){
      for(const a of [-1,1])for(const b of [-1,1])part('boards',a*w/2,h/2,b*d/2,.048,h,.048);
    }
    for(const item of p.interior||[]){
      x=item.x;z=item.y;y=item.floor*p.h;angle=-item.r*Math.PI/180;
      switch(item.key){
        case 'sofa':
          part('linen',0,.27,0,2.15,.39,.86);part('linen',0,.61,-.36,2.15,.42,.16);
          for(const s of [-1,1]){
            part('linen',s*1.01,.47,0,.13,.32,.88);
            part('ivory',s*.48,.49,.04,.89,.13,.66);part('ivory',s*.48,.69,-.24,.89,.35,.15);
          }break;
        case 'table':
          part('oak',0,.755,0,1.55,.055,.90);feet(1.32,.67,.73);break;
        case 'chair':
          part('oak',0,.445,0,.48,.055,.46);part('linen',0,.485,.01,.44,.045,.41);
          part('boards',0,.71,-.22,.45,.41,.043);feet(.38,.34,.43);break;
        case 'bed':
          part('boards',0,.22,0,1.64,.29,2.08);part('ivory',0,.46,0,1.62,.19,2.04);
          part('linen',0,.58,.31,1.64,.08,1.38);part('boards',0,.59,-1,1.67,.63,.085);
          for(const s of [-1,1])part('ivory',s*.39,.59,-.69,.68,.09,.38);
          break;
        case 'wardrobe':
          part('boards',0,1.1,0,1.60,2.18,.61);
          for(const s of [-1,1])part('ivory',s*.40,1.1,.312,.79,2.17,.016);break;
        case 'kitchen':
          part('ivory',0,.46,0,2.7,.82,.59);part('oak',0,.89,0,2.73,.054,.64);
          for(let k=-2;k<=2;k++)part('ivory',k*.53,.48,.306,.515,.74,.025);
          part('metal',-.72,.924,0,.53,.012,.34);part('dark',.72,.924,0,.54,.013,.40);break;
        case 'fridge':
          part('metal',0,.94,0,.63,1.85,.68);part('dark',0,.57,.345,.62,.019,.017);break;
        case 'bath':
          part('ivory',0,.25,0,.74,.48,1.68);part('metal',0,.496,0,.60,.012,1.47);break;
        case 'sink':
          part('oak',0,.43,0,.63,.80,.46);part('ivory',0,.87,0,.65,.09,.49);break;
        case 'washer':
          part('ivory',0,.43,0,.60,.85,.62);part('metal',0,.43,.315,.38,.38,.013);break;
      }
    }
    const geometry=new T.BoxGeometry(1,1,1);
    for(const [key,matrices] of bins){
      const instanced=new T.InstancedMesh(geometry,finishes[key],matrices.length);
      matrices.forEach((matrix,i)=>instanced.setMatrixAt(i,matrix));
      instanced.castShadow=true;instanced.receiveShadow=true;group.add(instanced);
    }
    for(const [key,mat] of Object.entries(finishes))if(!bins.has(key))mat.dispose();
  }
  function openingDetails(side,o,p,m,ground,wallDepth){
    const t={type:'opening',id:o.id,face:o.f},bottom=o.floor*p.h+o.sill,mid=bottom+o.h/2,cx=o.x+o.w/2;
    const frame=Math.min(.057,o.w*.105,o.h*.105),z=-Math.min(.105,wallDepth*.56);
    const door=o.k===2, count=door?1:Math.max(1,Math.round(o.w/(o.k===1?1.05:1.2)));
    const outerWidth=o.w-2*frame,clearH=o.h-2*frame;
    const upright=(x,y,depth,w,h,thick,material)=>box(side,x,y,depth,w,h,thick,material,t);
    const frameAt=(x,y,width,height)=>{
      for(const edge of [-1,1]){
        upright(x+edge*(width-frame)/2,y,z,frame,height,.07,m.trim);
        upright(x,y+edge*(height-frame)/2,z,width-2*frame,frame,.07,m.trim);
      }
    };
    frameAt(cx,mid,o.w,o.h);
    if(door){
      const liteWidth=Math.min(.21,outerWidth*.22),leafWidth=outerWidth-liteWidth-.038;
      const left=cx-outerWidth/2,liteX=left+liteWidth/2+.007,leafX=left+liteWidth+.038+leafWidth/2;
      upright(leafX,mid,z-.002,leafWidth-.007,clearH-.009,.047,m.door);
      upright(left+liteWidth+.024,mid,z,.036,clearH,.066,m.trim);
      const sidelight=mesh(new T.PlaneGeometry(liteWidth,clearH-.02),m.glass,side,t);
      sidelight.position.set(liteX,mid,z-.012);sidelight.castShadow=false;
      // Narrow boards read as a solid timber door. The pull and backplate sit on the leaf.
      for(let xx=left+liteWidth+.153;xx<o.x+o.w-frame-.04;xx+=.115)upright(xx,mid,z+.024,.005,clearH,.003,m.darkWood);
      const handleX=o.x+o.w-frame-.09,handleY=bottom+Math.min(1.06,o.h*.52);
      upright(handleX,handleY,z+.047,.054,.23,.018,m.gasket);
      upright(handleX,handleY,z+.08,.024,.25,.032,m.silver);
      for(const off of [-.09,.09])upright(handleX,handleY+off,z+.06,.024,.024,.045,m.silver);
    }else{
      if(o.w>.7&&o.h>.62){
        const curtainWidth=Math.min(.48,outerWidth*.23);
        drape(side,o.x+frame,mid,outerWidth,clearH,t,m.fabric);
        drape(side,o.x+o.w-frame-curtainWidth,mid,outerWidth,clearH,t,m.fabric);
      }
      for(let k=0;k<count;k++){
        const cell=outerWidth/count,px=o.x+frame+cell*(k+.5);
        const gasket=.01,gz=z-.004;
        for(const edge of [-1,1]){
          upright(px+edge*(cell-gasket)/2,mid,gz,gasket,clearH,.021,m.gasket);
          upright(px,mid+edge*(clearH-gasket)/2,gz,cell,gasket,.021,m.gasket);
        }
        const pane=mesh(new T.PlaneGeometry(Math.max(.012,cell-2*gasket),Math.max(.012,clearH-2*gasket)),m.glass,side,t);
        pane.position.set(px,mid,gz-.006);pane.castShadow=false;
        if(k+1<count)upright(px+cell/2,mid,z,.057,clearH,.072,m.trim);
        if(o.h>1.95&&o.k===0)upright(px,mid+o.h*.21,z,.985*cell,.034,.054,m.trim);
      }
      if(o.h>.5&&o.w>.4){
        const hx=o.x+frame+.022,hy=bottom+Math.min(1.15,o.h*.5);
        upright(hx,hy,z+.045,.028,.071,.028,m.silver);upright(hx+.023,hy+.026,z+.065,.071,.016,.018,m.silver);
      }
    }
    if(o.k>=2){
      upright(cx,bottom-.009,.012,o.w+.05,.024,.21,m.sill);
      if(o.floor===0&&o.sill<.15&&!window.PentiiTerraces?.byDoor(p,o)){
        const steps=Math.max(1,Math.round(-ground/.175)),rise=-ground/steps;
        for(let k=0;k<steps;k++){
          const top=-k*rise-.015,h=Math.max(.04,top-ground),d=k===0?.53:.28,z=k===0?.245:.5+.28*(k-.5);
          faceUV(upright(cx,ground+h/2,z,o.w+.3,h,d,m.stone),cx,ground+h/2,3.2,.8);
          upright(cx,top+.006,z+.008,o.w+.34,.025,d+.026,m.tread);
        }
      }
    }else{
      const sill=upright(cx,bottom-.025,.035,o.w+.09,.022,.248,m.sill);if(sill)sill.rotation.x=.08;
      upright(cx,bottom-.052,.155,o.w+.09,.033,.014,m.sill);
      for(const edge of [-1,1])upright(cx+edge*(o.w/2+.039),bottom-.008,.035,.011,.035,.239,m.sill);
    }
  }
  function drawHouse(g,p){
    const structure=window.PentiiStructure?.get(p);
    if(structure){
      window.PentiiStructure.addBase(T,g,p);
      if(structure.view==='panels'){window.PentiiStructure.addShell(T,g,p);return}
      if(structure.view==='attic'){window.PentiiStructure.addShell(T,g,p);window.PentiiStructure.addAttic(T,g,p);return}
      if(structure.view==='floor'||structure.view==='foundation')return;
    }
    const H=p.n*p.h,finish=facadeSurface(p.skin),wallDepth=structure?.wallThickness||.17;
    const wallMat=surface(p.wall,{map:finish.map,normalMap:finish.normalMap,roughness:.93});
    const trim=surface('#353938',{metalness:.36,roughness:.38}),cream=surface('#e4ded2');
    const ground=structure?.groundY??-.24;
    const glass=windowGlass(p);
    const m={glass,trim,fabric:surface('#c5bca9',{roughness:1}),
      door:surface('#cabb9d',{map:texture('wood')}),darkWood:surface('#584435'),sill:surface('#747b78',{metalness:.46,roughness:.36}),
      silver:surface('#b3b7b6',{metalness:.65,roughness:.29}),gasket:surface('#252d2e'),stone:surface('#aea9a2',{map:stoneFinish(),roughness:.84}),
      tread:surface('#9c998e',{roughness:.81})};
    for(let f=0;f<4;f++){
      let side=new T.Group();side.position.fromArray(xyz(p,f,0,0));side.rotation.y=f*Math.PI/2;g.add(side);
      let target={type:'wall',face:f},w=wallLen(p,f),cuts=(p._wallCuts||[]).filter(c=>c.face===f);
      const ops=p.ops.filter(o=>o.f===f&&!cuts.some(c=>o.x<c.to&&o.x+o.w>c.from&&o.sill<c.top));
      const xs=[...new Set([0,w,...ops.flatMap(o=>[o.x,o.x+o.w]),...cuts.flatMap(c=>[c.from,c.to])])].sort((a,b)=>a-b);
      const ys=[...new Set([0,H,...ops.flatMap(o=>[o.floor*p.h+o.sill,o.floor*p.h+o.sill+o.h]),...cuts.flatMap(c=>[c.bottom,c.top])])].sort((a,b)=>a-b);
      for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
        let x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
        if(cuts.some(c=>x>c.from&&x<c.to&&y>c.bottom&&y<c.top))continue;
        if(ops.some(o=>x>o.x&&x<o.x+o.w&&y>o.floor*p.h+o.sill&&y<o.floor*p.h+o.sill+o.h))continue;
        let ww=xs[i+1]-xs[i],hh=ys[j+1]-ys[j];
        const block=box(side,x,y,-wallDepth/2,ww,hh,wallDepth,wallMat,target);
        faceUV(block,x,y,finish.width,finish.height);
      }
      if(!cuts.length&&p.skin!=='Короед'&&p.skin!=='Штукатурка'){
        box(side,w/2,H-.045,.006,w,.09,.028,cream,target);
        box(side,.037,H/2,.008,.074,H,.029,cream,target);
      }
      // A stone-faced skirt closes the finished perimeter down to grade;
      // the construction view still exposes every pile head and grillage board.
      for(let i=0;i<xs.length-1;i++){
        const a=xs[i],b=xs[i+1],x=(a+b)/2;
        if(cuts.some(c=>x>c.from&&x<c.to))continue;
        const plinth=box(side,x,ground/2,-.022,b-a,-ground,.072,m.stone,target);
        faceUV(plinth,x,ground/2,3.2,.8);
        box(side,x,-.014,.014,b-a,.031,.051,m.sill,target);
      }
      for(const o of ops)openingDetails(side,o,p,m,ground,wallDepth);
    }
    window.PentiiTerraces?.mesh(T,g,p,texture('wood'));
    roomsBehindGlass(g,p);
  }
  function drawRoofs(g,p){
    const structure=window.PentiiStructure?.get(p);
    if(structure&&structure.view!=='finish')return;
    const ground=structure?.groundY??-.24,finish=facadeSurface(p.skin),glass=windowGlass(p);
    const wallMat=surface(p.wall,{map:finish.map,normalMap:finish.normalMap,roughness:.93});
    const faces=window.RoofStudio.faces(p), sections=window.RoofStudio.sections(p);
    const allRaw=window.RoofStudio.rawFaces?.(p)||faces,columns=window.RoofStudio.columns(p);
    for(const section of sections){
      const own=list=>list.filter(item=>item.sectionId===section.id);
      window.RoofFinishes.build(g,p,section,own(faces),own(allRaw),columns.filter(c=>c.sectionId===section.id),faces,ground,finish,glass);
      const parapet=RoofStudio.parapetParts(p,section);
      const coping=parapet.length?surface(p.fasciaColor||p.top||'#485057',{metalness:.5,roughness:.38}):null;
      for(const part of parapet){
        const item=box(g,part.x,part.y,part.z,part.w,part.h,part.d,part.kind==='coping'?coping:wallMat,{type:'roof',sectionId:section.id});
        if(item)item.name='parapet • '+part.kind+' • '+section.id;
      }
    }
    const postMat=surface('#9d8c75',{map:texture('wood'),roughness:.76});
    const plated=surface('#51595a',{metalness:.44}),bolt=surface('#96a5ab',{metalness:.55}),footing=surface('#b4b2a8');
    for(const col of columns){
      const t={type:'column',sectionId:col.sectionId,postId:col.id},s=col.size,h=col.top-ground-.14;
      if(h<=0)continue;
      box(g,col.x,ground+.058,col.z,s+.20,.115,s+.20,footing,t);
      box(g,col.x,ground+.133,col.z,s+.11,.035,s+.11,plated,t);
      box(g,col.x,ground+.15+h/2,col.z,s,h,s,postMat,t);
      box(g,col.x,col.top-.08,col.z,s+.10,.10,s+.10,postMat,t);
      for(const dx of [-1,1])for(const dz of [-1,1])box(g,col.x+dx*(s/2+.024),ground+.16,col.z+dz*(s/2+.024),.025,.022,.025,bolt,t);
    }
    // A header spans aligned supports beneath each canopy.
    for(const section of sections){const posts=columns.filter(c=>c.sectionId===section.id);
      if(posts.length<2)continue;
      for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++){
        const a=posts[i],b=posts[j],alongX=Math.abs(a.z-b.z)<.09,alongZ=Math.abs(a.x-b.x)<.09;
        if(!alongX&&!alongZ)continue;
        if(Math.abs(a.top-b.top)>.25)continue;
        const coord=alongX?'x':'z',fixed=alongX?'z':'x';
        if(posts.some(c=>c!==a&&c!==b&&Math.abs(c[fixed]-a[fixed])<.09&&(c[coord]-a[coord])*(c[coord]-b[coord])<0))continue;
        const len=Math.abs(a[coord]-b[coord]),beamWidth=Math.max(a.size,b.size);
        box(g,(a.x+b.x)/2,Math.min(a.top,b.top)-.14,(a.z+b.z)/2,alongX?len+beamWidth:beamWidth,.23,alongZ?len+beamWidth:beamWidth,postMat,{type:'roof',sectionId:section.id});
      }
    }
  }
  function environmentImage(name,color=true){
    const key='photography-'+name;
    if(textures[key])return textures[key];
    let ready;
    imageReady[key]=new Promise(resolve=>{ready=resolve});
    const loaded=()=>{ready();requestFrame()};
    const texture=new T.TextureLoader().load(window.PentiiEnvironmentAssets[name],loaded,undefined,loaded);
    texture.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
    texture.wrapS=T.RepeatWrapping;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return textures[key]=texture;
  }
  function installDaylight(){
    // Unclipped linear radiance of the same meadow shown around the model.
    const packed=atob(window.PentiiEnvironmentAssets.probe),linear=new Float32Array(256*128*4);
    for(let i=0;i<linear.length;i+=4){
      const scale=2**(packed.charCodeAt(i+3)-128)/255;
      for(let k=0;k<3;k++)linear[i+k]=packed.charCodeAt(i+k)*scale;
      linear[i+3]=1;
    }
    const probe=new T.DataTexture(linear,256,128,T.RGBAFormat,T.FloatType);
    probe.flipY=true;probe.colorSpace=T.LinearSRGBColorSpace;
    probe.mapping=T.EquirectangularReflectionMapping;probe.needsUpdate=true;
    const generator=new T.PMREMGenerator(renderer),target=generator.fromEquirectangular(probe);
    scene.environment=target.texture;scene.environmentRotation.y=-.56*Math.PI*2;
    scene.environmentIntensity=.70;
    probe.dispose();generator.dispose();
  }
  function softContact(g,p,y){
    // A shallow, metric contact shadow around the footprint complements the sun shadow.
    const spread=.90,W=p.w+spread*2,D=p.d+spread*2;
    const c=document.createElement('canvas');c.width=c.height=128;
    const ctx=c.getContext('2d'),img=ctx.createImageData(128,128);
    for(let row=0;row<128;row++)for(let col=0;col<128;col++){
      const dx=Math.max(0,Math.abs((col+.5)/128-.5)*W-p.w/2);
      const dz=Math.max(0,Math.abs((row+.5)/128-.5)*D-p.d/2);
      const d=Math.hypot(dx,dz);
      img.data[(row*128+col)*4+3]=Math.round(88*Math.exp(-d*4.7));
    }
    ctx.putImageData(img,0,0);const map=new T.CanvasTexture(c);
    const shadow=new T.Mesh(new T.PlaneGeometry(W,D),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    shadow.rotation.x=-Math.PI/2;shadow.position.set(p.w/2,y+.008,p.d/2);shadow.userData.ownedTexture=map;g.add(shadow);
  }
  function sitePosition(p,o){
    const decode=(u,span)=>u<0?u:u>1?span+u-1:u*span;
    return window.StudioYard?.position?.(p,o)||{x:decode(o.u,p.w),z:decode(o.v,p.d)};
  }
  function lawnBlades(g,p,y){
    // Crossed leaf clusters give a dense lawn without a separate draw call for
    // every blade. Each card carries curved tapered leaves, at metric lawn height.
    const plot={width:Number.isFinite(p.plotWidth)?p.plotWidth:p.w+16,height:Number.isFinite(p.plotDepth)?p.plotDepth:p.d+16};
    const spanX=Math.min(plot.width,p.w+20,64),spanZ=Math.min(plot.height,p.d+20,64);
    const left=(p.w-spanX)/2,back=(p.d-spanZ)/2;
    const blocks=[{x:p.w/2,z:p.d/2,w:p.w,d:p.d,c:1,s:0},...(p.extensions||[]).map(e=>({x:e.x+e.w/2,z:e.z+e.d/2,w:e.w,d:e.d,c:1,s:0}))];
    for(const object of p.yard||[]){
      const {x,z}=sitePosition(p,object),angle=(object.angle||0)*Math.PI/180;
      const trunk=['tree','birch','pine','spruce'].includes(object.type);
      blocks.push({x,z,w:trunk?.34:object.w,d:trunk?.34:object.d,c:Math.cos(angle),s:Math.sin(angle)});
    }
    for(const section of window.PentiiTerraces?.sections(p)||[]){
      const r=PentiiTerraces.rect(p,section);
      blocks.push({x:r.x+r.w/2,z:r.z+r.d/2,w:r.w,d:r.d,c:1,s:0});
      for(const stair of section.terrace.stairs||[]){
        const edge=stair.edge,len=edge%2?r.d:r.w,w=clamp(stair.width,.45,Math.max(.45,len-.04));
        const centre=clamp(stair.at*len,w/2+.02,len-w/2-.02),run=stair.run;
        const x=edge%2?r.x+(edge===1?r.w+run/2:-run/2):r.x+centre;
        const z=edge%2?r.z+centre:r.z+(edge===0?r.d+run/2:-run/2);
        blocks.push({x,z,w:edge%2?run:w,d:edge%2?w:run,c:1,s:0});
      }
    }
    for(const column of window.RoofStudio?.columns(p)||[])blocks.push({x:column.x,z:column.z,w:column.size+.20,d:column.size+.20,c:1,s:0});
    const blocked=(x,z)=>blocks.some(b=>{
      const dx=x-b.x,dz=z-b.z;
      return Math.abs(dx*b.c+dz*b.s)<b.w/2+.17&&Math.abs(-dx*b.s+dz*b.c)<b.d/2+.17;
    });
    let seed=834791;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    const wanted=Math.min(18000,Math.round(spanX*spanZ*32));
    const leafImage=document.createElement('canvas');leafImage.width=512;leafImage.height=256;
    const paint=leafImage.getContext('2d');
    for(let i=0;i<38;i++){
      const x=14+random()*484,h=92+random()*151,bend=(random()-.5)*64,w=3+random()*6;
      const gradient=paint.createLinearGradient(0,256,0,256-h);
      gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.23,'rgba(255,255,255,.72)');gradient.addColorStop(1,'#ffffff');
      paint.fillStyle=gradient;paint.beginPath();paint.moveTo(x-w/2,256);
      paint.quadraticCurveTo(x-w/2+bend*.22,256-h*.61,x+bend,256-h);
      paint.quadraticCurveTo(x+w/2+bend*.33,256-h*.44,x+w/2,256);paint.closePath();paint.fill();
    }
    const leafMap=new T.CanvasTexture(leafImage);leafMap.colorSpace=T.SRGBColorSpace;leafMap.anisotropy=4;
    const blade=new T.BufferGeometry();
    blade.setAttribute('position',new T.Float32BufferAttribute([-.5,0,0,.5,0,0,-.5,1,0,.5,1,0,0,0,-.5,0,0,.5,0,1,-.5,0,1,.5],3));
    blade.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1],2));
    blade.setIndex([0,1,2,1,3,2,4,5,6,5,7,6]);blade.computeVertexNormals();
    const material=new T.MeshStandardMaterial({color:'#ffffff',map:leafMap,alphaTest:.06,transparent:true,opacity:.64,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,roughness:1,metalness:0});
    // Bent canopy normals keep both sides of the paper-thin leaves naturally
    // lit; the meadow texture remains responsible for the roots' soft contact.
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n normal=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz+normal*.20);');};
    const blades=new T.InstancedMesh(blade,material,wanted),matrix=new T.Object3D();
    blades.name='Lawn blades';blades.receiveShadow=true;blades.castShadow=false;blades.raycast=()=>{};blades.userData.ownedTexture=leafMap;blades.renderOrder=2;
    const colors=['#8e9b5a','#959f5f','#8f9b56','#9ea565','#919b59'].map(v=>new T.Color(v));
    let count=0,attempts=0;
    while(count<wanted&&attempts++<wanted*2){
      const cx=left+random()*spanX,cz=back+random()*spanZ;
      const edge=Math.min(cx-left,left+spanX-cx,cz-back,back+spanZ-cz);
      if(random()>Math.min(1,edge/1.4)||blocked(cx,cz))continue;
      const patch=.5+.5*Math.sin(cx*.83+Math.sin(cz*.71))*Math.cos(cz*.49);
      if(random()>.52+patch*.47)continue;
      const shade=colors[Math.floor(random()*colors.length)];
      const height=.025+random()*.030,width=.18+random()*.06;
      matrix.position.set(cx,y+.001,cz);matrix.rotation.set(0,random()*Math.PI*2,0);
      matrix.scale.set(width,height,width);matrix.updateMatrix();
      blades.setMatrixAt(count,matrix.matrix);blades.setColorAt(count,shade);count++;
    }
    blades.count=count;blades.userData.fullCount=count;blades.userData.exclusionCount=blocks.length;
    blades.instanceMatrix.needsUpdate=true;if(blades.instanceColor)blades.instanceColor.needsUpdate=true;
    blades.computeBoundingSphere();g.add(blades);return blades;
  }
  function syncSiteVisibility(terrain){
    if(!terrain)return;
    const objects=terrain.getObjectByName('Yard objects');if(objects)objects.visible=yardVisible;
    const lawn=terrain.getObjectByName('Ground surface');
    if(lawn?.userData.poolVisibility)lawn.userData.poolVisibility.value=yardVisible?1:0;
  }
  function grounds(g,p){
    const half=Math.max(17,Math.max(p.w,p.d)*.68+8,...(p.extensions||[]).flatMap(e=>[Math.abs(e.x-p.w/2)+e.w+4,Math.abs(e.z-p.d/2)+e.d+4]));
    const map=environmentImage('panorama');
    // A cylindrical panorama keeps vertical trunks straight across an orthographic image.
    // Map the measured horizon to a point just above the garden, independent of camera height.
    const tall=Math.max(85,Math.max(p.w,p.d)*2),radius=half+5;
    const domeGeometry=new T.CylinderGeometry(radius,radius,tall,128,32,true);
    const uv=domeGeometry.attributes.uv,pos=domeGeometry.attributes.position;
    for(let i=0;i<uv.count;i++){
      const y=pos.getY(i);
      const sourceU=1.31-uv.getX(i);
      const sourceV=.5+Math.atan2(y,6.8)/Math.PI;
      uv.setXY(i,sourceU,sourceV);
    }
    const grass=environmentImage('grass'),normal=environmentImage('grassNormal',false);
    const backdrop=new T.MeshBasicMaterial({map,side:T.BackSide,toneMapped:false,depthWrite:false});
    // A level orthographic camera sees the ground plane edge-on. The panoramic
    // photograph ends at the nadir; extend that foreground with the site's
    // actual grass texture so tall screens have continuous ground below grade.
    backdrop.onBeforeCompile=shader=>{
      shader.uniforms.meadowGrass={value:grass};
      shader.vertexShader='varying vec2 meadowUV;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n meadowUV=vec2(uv.x*72.0,position.y*.53);');
      shader.fragmentShader='uniform sampler2D meadowGrass; varying vec2 meadowUV;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec3 grassNear=texture2D(meadowGrass,meadowUV).rgb;
        vec3 grassFar=texture2D(meadowGrass,meadowUV*.29+vec2(.37,.74)).rgb;
        float tufts=dot(mix(grassNear,grassFar,.22),vec3(.3,.6,.1))/.134;
        vec3 foreground=vec3(.168,.163,.103)*clamp(tufts,.52,1.58);
        diffuseColor.rgb=mix(foreground,diffuseColor.rgb,smoothstep(.359,.414,vMapUv.y));`);
    };
    const dome=new T.Mesh(domeGeometry,backdrop);
    dome.position.set(p.w/2,.83,p.d/2);dome.renderOrder=-10;dome.raycast=()=>{};g.add(dome);
    const size=Math.max(310,half*7),groundY=-.25;
    for(const t of [grass,normal]){t.wrapT=T.RepeatWrapping;t.repeat.set(size/2.1,size/2.1)}
    const geo=new T.PlaneGeometry(size,size,1,1);
    const soil=new T.MeshStandardMaterial({color:'#cfdfa9',map:grass,normalMap:normal,normalScale:new T.Vector2(.39,.39),transparent:true,alphaTest:.005,roughness:1});
    const pools=(p.yard||[]).filter(o=>o.type==='pool'||o.type==='overflowPool').map(o=>{
      const at=sitePosition(p,o),angle=(o.angle||0)*Math.PI/180;
      return {rect:new T.Vector4(at.x,at.z,Math.max(.01,o.w-.24)/2,Math.max(.01,o.d-.24)/2),rotation:new T.Vector2(Math.cos(angle),Math.sin(angle))};
    });
    const poolVisibility={value:yardVisible?1:0};
    soil.onBeforeCompile=shader=>{
      shader.uniforms.measuredGround={value:new T.Vector3(p.w/2,p.d/2,half)};
      if(pools.length){
        shader.uniforms.lawnPools={value:pools.map(v=>v.rect)};
        shader.uniforms.lawnPoolRotation={value:pools.map(v=>v.rotation)};
        shader.uniforms.lawnPoolVisible=poolVisibility;
        shader.fragmentShader=`uniform vec4 lawnPools[${pools.length}]; uniform vec2 lawnPoolRotation[${pools.length}]; uniform float lawnPoolVisible;\n`+shader.fragmentShader;
      }
      shader.vertexShader='varying vec2 lawnXZ;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n lawnXZ=(modelMatrix*vec4(position,1.)).xz;');
      shader.fragmentShader='uniform vec3 measuredGround; varying vec2 lawnXZ;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        ${pools.length?`if(lawnPoolVisible>.5){for(int i=0;i<${pools.length};i++){
          vec2 delta=lawnXZ-lawnPools[i].xy,rotation=lawnPoolRotation[i];
          vec2 localPool=vec2(dot(delta,rotation),dot(delta,vec2(-rotation.y,rotation.x)));
          if(all(lessThan(abs(localPool),lawnPools[i].zw)))discard;
        }}`:''}
        vec2 local=lawnXZ-measuredGround.xy;
        vec2 forward=normalize(cameraPosition.xz-measuredGround.xy+vec2(.00001));
        float fade=smoothstep(-measuredGround.z*1.12,-measuredGround.z*.62,dot(local,forward));
        float fine=.5+.5*sin(lawnXZ.x*2.3+sin(lawnXZ.y*1.6)) * cos(lawnXZ.y*.72);
        diffuseColor.rgb*=mix(.90,1.03,fine);
        diffuseColor.a*=fade;`);
    };
    soil.customProgramCacheKey=()=>'pentii-ground-pools-'+pools.length;
    const lawn=new T.Mesh(geo,soil);
    lawn.name='Ground surface';lawn.userData.poolVisibility=poolVisibility;
    lawn.rotation.x=-Math.PI/2;lawn.position.set(p.w/2,groundY,p.d/2);
    lawn.receiveShadow=true;lawn.raycast=()=>{};g.add(lawn);
    softContact(g,p,groundY);
  }
  function rebuild(p){
    if(!group){group=new T.Group();scene.add(group)}
    const old=group.getObjectByName('Building');if(old)disposeGroup(old);
    const building=new T.Group();building.name='Building';group.add(building);drawHouse(building,p);
    for(const e of window.PentiiExtensions?.list(p)||[]){
      const local=PentiiExtensions.model(p,e),part=new T.Group();
      part.name='Extension • '+e.id;part.position.set(e.x,0,e.z);building.add(part);
      if(!e.walls){
        local.structure={...PentiiStructure.get(local),view:PentiiStructure.get(p).view==='foundation'?'foundation':'floor'};
        PentiiStructure.addBase(T,part,local);
      }else drawHouse(part,local);
      part.traverse(item=>{
        if(!item.isMesh)return;
        const target=item.userData.target;
        item.userData.target={...(['wall','opening'].includes(target?.type)?target:{type:'extension'}),extensionId:e.id};
      });
    }
    drawRoofs(building,p);
    const ground=window.PentiiStructure?.get(p).groundY??-.24;
    const signature=JSON.stringify([p.w,p.d,p.top,ground,p.yard,p.plotWidth,p.plotDepth,(p.extensions||[]).map(e=>[e.x,e.z,e.w,e.d])]);
    let terrain=group.getObjectByName('Site');
    if(terrain?.userData.signature!==signature){
      if(terrain)disposeGroup(terrain);terrain=new T.Group();terrain.name='Site';terrain.userData.signature=signature;
      terrain.position.y=ground+.24;group.add(terrain);grounds(terrain,p);
      const objects=new T.Group();objects.name='Yard objects';terrain.add(objects);
      window.StudioYard?.addMeshes?.(T,objects,p);
      terrain.traverse(item=>{if(item.isMesh)item.raycast=()=>{};});
    }
    const grassSignature=JSON.stringify([p.w,p.d,p.plotWidth,p.plotDepth,p.yard,(p.extensions||[]).map(e=>[e.x,e.z,e.w,e.d]),
      (p.roofSections||[]).map(s=>[s.x,s.z,s.w,s.d,s.posts,s.terrace])]);
    let blades=terrain.getObjectByName('Lawn blades');
    if(p.previewInteraction){if(blades)blades.visible=false;}
    else if(blades?.userData.signature!==grassSignature){
      if(blades)disposeGroup(blades);
      blades=lawnBlades(terrain,p,-.25);blades.userData.signature=grassSignature;
    }else blades.visible=true;
    syncSiteVisibility(terrain);
    // Only the built model contributes to framing. Building contains the actual
    // roof sections, supports, deck stairs and rainwater (including custom edits).
    modelBounds=new T.Box3().setFromObject(building);
    const center=modelBounds.getCenter(V(0,0,0)),extent=modelBounds.getSize(V(0,0,0));
    let size=Math.max(extent.x,extent.y,extent.z),r=Math.max(16,size*1.13);
    light.position.copy(center).add(V(-.86,1.00,.87).multiplyScalar(Math.max(18,size*1.35)));
    light.target.position.copy(center);
    Object.assign(light.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:.5,far:size*5+70});light.shadow.camera.updateProjectionMatrix();
  }
  function getCamera(){
    return {preset:activePreset,label:cameras[activePreset]?.[0]||'Свободный ракурс',projection:'orthographic',zoom,yardVisible};
  }
  function announceCamera(){
    if(renderBusy||!drawn)return;
    const state=getCamera(),signature=[state.preset,state.zoom.toFixed(3),state.yardVisible].join(' ');
    if(signature===cameraSignature)return;
    cameraSignature=signature;
    window.dispatchEvent(new CustomEvent('pentii-camera-change',{detail:state}));
  }
  function usePreset(key){
    const preset=cameras[key];if(!preset)return false;
    activePreset=key;azimuth=radians(preset[1]);elevation=radians(preset[2]);
    zoom=1;offset.set(0,0,0);return true;
  }
  function setCamera(key){
    if(!project||!drawn||renderBusy||!usePreset(key))return;
    positionCamera(project);render();
  }
  function setYardVisible(visible){
    if(renderBusy)return;
    yardVisible=!!visible;
    syncSiteVisibility(group?.getObjectByName('Site'));
    if(drawn){announceCamera();render()}
  }
  function positionCamera(p,refit=true,commonScale=false){
    if(!modelBounds)return;
    const aspect=width/height,center=modelBounds.getCenter(V(0,0,0)),size=modelBounds.getSize(V(0,0,0));
    const cosA=Math.cos(azimuth),sinA=Math.sin(azimuth),cosE=Math.cos(elevation),sinE=Math.sin(elevation);
    const radius=Math.max(90,size.length()*2);
    const target=center.clone().add(offset);
    viewTarget.copy(target);
    cam.position.copy(target).add(V(sinA*cosE,sinE,cosA*cosE).multiplyScalar(radius));
    cam.lookAt(target);
    if(refit){
      // The four PDF facades share a crop measured in metres. Orbiting in the
      // viewer instead fits the bounding box projected onto both screen axes.
      const across=commonScale?Math.max(size.x,size.z):Math.abs(cosA)*size.x+Math.abs(sinA)*size.z;
      const rise=Math.abs(sinE*sinA)*size.x+cosE*size.y+Math.abs(sinE*cosA)*size.z;
      fit=Math.max(rise*.59,across*.57/aspect,.85);
    }
    const half=fit/zoom;
    Object.assign(cam,{left:-half*aspect,right:half*aspect,top:half,bottom:-half,far:Math.max(400,radius+size.length()*2)});
    cam.updateProjectionMatrix();cam.updateMatrixWorld();announceCamera();
  }
  function panFrom(start,x,y){
    const metresPerPixel=2*fit/(zoom*height),basis=cam.matrixWorld.elements;
    offset.copy(start).addScaledVector(V(basis[0],basis[1],basis[2]),-x*metresPerPixel)
      .addScaledVector(V(basis[4],basis[5],basis[6]),y*metresPerPixel);
  }
  function orbitTo(a,e){
    activePreset='orbit';azimuth=a;elevation=clamp(e,0,radians(88));
    positionCamera(project);render();
  }
  function keyboardCamera(e){
    const rotations={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
    if(renderBusy||!drawn||e.ctrlKey||e.metaKey||e.altKey)return;
    if((e.key==='Delete'||e.key==='Backspace')&&options.onSectionAction&&!options.inspect&&!options.exposeStructure&&!options.mode){
      const section=selectedSection();
      if(section&&!e.repeat){e.preventDefault();e.stopPropagation();options.onSectionAction('delete',section.id)}
      return;
    }
    const d=rotations[e.key];
    if(d)orbitTo(azimuth+radians(10)*d[0],elevation+radians(8)*d[1]);
    else if(e.key==='+'||e.key==='=')scale(1.23);
    else if(e.key==='-')scale(1/1.23);
    else if(e.key==='Home')fitView();
    else return;
    e.preventDefault();e.stopPropagation();
  }
  function resize(refit=true){
    width=Math.max(240,Math.round(stage.clientWidth||800));height=Math.max(160,Math.round(stage.clientHeight||500));
    renderer.setSize(width,height,false);positionCamera(project,refit);render();
  }
  const projected=(v)=>{let q=v.clone().project(cam);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2}};
  const ptr=e=>{let rect=stage.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top}};
  function cast(x,y){let ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(2*x/width-1,1-2*y/height),cam);return ray}
  function owner(p,id){return (p.extensions||[]).find(e=>e.id===id)||p}
  function envelope(p,id){const e=owner(p,id);return e===p?{x:0,z:0,w:p.w,d:p.d}:e}
  function ownerModel(p,id){const e=owner(p,id);return e===p?p:PentiiExtensions.model(p,e)}
  function ownerPoint(p,id,f,u,y,off=0){
    const e=owner(p,id),v=V(...xyz(ownerModel(p,id),f,u,y,off));
    return e===p?v:v.add(V(e.x,0,e.z));
  }
  function localAt(f,pt,p,id){
    const e=owner(p,id),local=ownerModel(p,id);
    let normal=[V(0,0,1),V(1,0,0),V(0,0,-1),V(-1,0,0)][f],plane=new T.Plane().setFromNormalAndCoplanarPoint(normal,ownerPoint(p,id,f,0,0));
    let v=cast(pt.x,pt.y).ray.intersectPlane(plane,V(0,0,0));if(!v)return null;
    if(e!==p)v.sub(V(e.x,0,e.z));
    return {u:[v.x,local.d-v.z,local.w-v.x,v.z][f],v:v.y}
  }
  function at(pt){let hits=cast(pt.x,pt.y).intersectObject(group,true);return hits.find(h=>h.object.userData.target)?.object.userData.target}
  function selectedSection(){
    if(!selected?.sectionId||!project)return null;
    return RoofStudio.sections(project).find(s=>s.id===selected.sectionId);
  }
  function sectionCommands(s){
    return s?[['add','Добавить секцию'],['copy','Копировать'],['delete',s.terrace?'Удалить террасу целиком':'Удалить']]:[['add','Добавить секцию']];
  }
  function roofEditAction(section){
    const action=options.roofAction||'size';
    return section.roof===3&&action==='pitch'?'size':action;
  }
  function updateSectionBar(){
    sectionBar.hidden=!options.onSectionAction||options.inspect||options.exposeStructure||!!options.mode||gesture?.kind==='edit';
    if(sectionBar.hidden)return;
    const s=selectedSection(),key=s?JSON.stringify([s.id,s.name,!!s.terrace,options.roofAction,RoofStudio.actionFor(project,s)]):'new';
    if(key===barKey)return;
    barKey=key;sectionBar.replaceChildren();
    if(s){
      const label=document.createElement('strong');label.textContent=s.name;label.dataset.selectedSection=s.id;
      label.style.cssText='padding:2px 5px;color:#164e72;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      sectionBar.append(label);
      if(selected.type==='roof'&&options.onRoofAction){
        const action=document.createElement('select');
        action.dataset.roofAction='';action.setAttribute('aria-label','Действие с крышей');
        action.style.cssText='width:auto;min-height:32px;margin:0;padding:5px 7px;font:600 12px Onest,Arial;border:1px solid #bdd4e2;border-radius:6px;background:white';
        for(const [value,text] of [['size','Размеры'],['pitch','Уклон'],['move','Переместить']]){
          const choice=new Option(text,value,false,value===roofEditAction(s));
          choice.disabled=value==='pitch'&&s.roof===3;
          action.add(choice);
        }
        const advanced=RoofStudio.actionFor(project,s);
        if(['lift','dormer','moveDormer'].includes(advanced)){
          const choice=new Option(advanced==='lift'?'Свободная форма':'Кукушка','advanced',false,true);
          choice.disabled=true;action.add(choice);
        }
        action.onchange=()=>options.onRoofAction(action.value);
        sectionBar.append(action);
      }
    }
    for(const [action,name] of sectionCommands(s)){
      const b=document.createElement('button');b.type='button';b.dataset.sectionAction=action;b.textContent=name;
      b.style.cssText='padding:6px 8px;min-height:32px;font:600 12px Onest,Arial;border-radius:6px;'+(action==='delete'?'color:#95392f;':'');
      b.onclick=()=>{if(!renderBusy&&!options.inspect)options.onSectionAction(action,s?.id||null)};
      sectionBar.append(b);
    }
  }
  function highlightSection(){
    const building=group?.getObjectByName('Building');if(!building)return;
    const id=options.inspect||options.exposeStructure||options.mode?null:selected?.sectionId||null;
    if((building.userData.highlightId||null)===id)return;
    const old=building.getObjectByName('Selected section edges');
    if(old)disposeGroup(old);
    const edges=new T.Group();edges.name='Selected section edges';
    for(const part of building.children){
      if(part.userData.target?.type!=='roof'||!['roof','gable','fascia'].includes(part.name.split(' • ')[0]))continue;
      const active=!!id&&part.userData.target.sectionId===id;
      part.material.emissive.setHex(active?0x145f89:0);
      if(active&&part.name.startsWith('roof • ')){
        const line=new T.LineSegments(new T.EdgesGeometry(part.geometry,12),new T.LineBasicMaterial({color:0x61c9ff}));
        line.raycast=()=>{};line.renderOrder=1;edges.add(line);
      }
    }
    if(edges.children.length)building.add(edges);
    building.userData.highlightId=id;
  }
  function pointForSection(pt){
    const ray=cast(pt.x,pt.y),building=group.getObjectByName('Building');
    const hit=ray.intersectObject(building,true).find(h=>h.object.userData.target);
    const height=window.PentiiStructure?.get(project).groundY??0;
    const v=hit?.point||ray.ray.intersectPlane(new T.Plane(V(0,1,0),-height),V(0,0,0));
    if(!v)return null;
    const target=hit?.object.userData.target;
    return {x:quant(v.x),z:quant(v.z),sectionId:target?.sectionId||null,face:target?.face??null};
  }
  function report(message){status.textContent=message;status.hidden=!message;let mark=++lastStatus;if(message)setTimeout(()=>{if(mark===lastStatus&&!gesture)status.hidden=true},3600)}
  let screenRidges;
  function visibleRidges(){
    if(screenRidges)return screenRidges;
    const roofs=window.RoofStudio,skin=roofs.faces(project);
    screenRidges=[];
    for(const section of roofs.sections(project)){
      for(const [a,b] of roofs.ridgeEdges(section,skin)){
        const worldA=V(...a),worldB=V(...b);
        screenRidges.push({section,worldA,worldB,a:projected(worldA),b:projected(worldB)});
      }
    }
    return screenRidges;
  }
  function nearRidge(pt,verify=false){
    if(!project||options.mode==='add'||options.exposeStructure)return null;
    const matches=[];
    for(const line of visibleRidges()){
      const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,n=dx*dx+dy*dy;
      const t=n<.01?Number(cam.position.distanceTo(line.worldA)>cam.position.distanceTo(line.worldB)):clamp(((pt.x-line.a.x)*dx+(pt.y-line.a.y)*dy)/n,0,1);
      const x=line.a.x+dx*t,y=line.a.y+dy*t,distance=Math.hypot(pt.x-x,pt.y-y);
      if(distance<=9)matches.push({distance,line,x,y,t});
    }
    for(const c of matches.sort((a,b)=>a.distance-b.distance)){
      if(verify){
        const ray=cast(c.x,c.y),surfaceHit=ray.intersectObject(group,true).find(h=>h.object.userData.target);
        const world=c.line.worldA.clone().lerp(c.line.worldB,c.t);
        if(surfaceHit&&surfaceHit.object.userData.target.sectionId!==c.line.section.id&&surfaceHit.distance+.23<ray.ray.origin.distanceTo(world))continue;
      }
      return c.line.section;
    }
    return null;
  }
  function handle(q,key,title,big=false){
    let pxy=projected(q);if(pxy.x<0||pxy.x>width||pxy.y<0||pxy.y>height)return;
    let b=document.createElement('button');b.type='button';b.dataset.grip=key;b.title=title;b.setAttribute('aria-label',title);
    b.textContent=big?title:'';
    b.style.cssText='pointer-events:auto;position:absolute;touch-action:none;transform:translate(-50%,-50%);box-sizing:border-box;display:block;line-height:1;white-space:nowrap;color:#07547d;background:'+ (big?'#f3fbff':'#148fce')+';border:2px solid '+(big?'#67b4dd':'white')+';border-radius:'+(big?'15px':'4px')+';box-shadow:0 1px 5px #1739536b;font:600 12px Onest,Arial;'+(big?'padding:5px 8px;':'width:15px;height:15px;padding:0;')+'cursor:'+(['top','bottom','h','pitch'].includes(key)?'ns-resize':'ew-resize')+';left:'+pxy.x+'px;top:'+pxy.y+'px';
    if(key==='pitch'){
      b.style.padding='7px 10px';b.style.borderColor='#317ba7';b.style.zIndex='2';
      b.style.transform=pxy.y>42?'translate(-50%,calc(-100% - 5px))':'translate(-50%,5px)';
      b.title='Потяните вверх или вниз. Стрелки на клавиатуре меняют уклон на 1°.';
      b.onkeydown=e=>{
        const dir=e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0;if(!dir)return;
        e.preventDefault();
        const sec=RoofStudio.sections(project).find(s=>s.id===selected?.sectionId);if(!sec)return;
        apply(RoofStudio.editSection(project,sec.id,{pitch:clamp(sec.pitch+dir,2,65)}));
        overlays.querySelector('[data-grip="pitch"]')?.focus({preventScroll:true});
      };
    }
    overlays.append(b);
  }
  function roofPointGrips(sec){
    const state=RoofStudio.toolsFor(project,sec);
    const nodes=(sec.liftPoints||[]).map(n=>({...n,label:'Точка ската'}));
    for(const [i,[u,v]] of [[0,0],[1,0],[1,1],[0,1]].entries()){
      if(!nodes.some(n=>Math.abs(n.u-u)+Math.abs(n.v-v)<.002))nodes.push({u,v,label:['Задний левый угол','Задний правый угол','Передний правый угол','Передний левый угол'][i]});
    }
    const positions=nodes.map(n=>{
      const [x,z]=RoofSculpt.xz(sec,n.u,n.v),v=V(x,RoofStudio.positionHeight(sec,x,z),z);
      return {n,v,screen:projected(v),distance:cam.position.distanceTo(v)};
    }).sort((a,b)=>a.distance-b.distance);
    const placed=[];
    for(const item of positions){
      const {v,n,screen}=item;
      if(placed.some(p=>Math.hypot(p.x-screen.x,p.y-screen.y)<18))continue;
      placed.push(screen);
      if(screen.x<0||screen.x>width||screen.y<0||screen.y>height)continue;
      handle(v,'roofPoint',n.label,false);
      const b=overlays.lastElementChild;
      b.dataset.u=n.u;b.dataset.v=n.v;b.title=n.label+' · тяните вверх или вниз';
      b.style.cssText+=';border-radius:50%;height:17px;width:17px;background:'+(n.id&&n.id===state.node?'#a35d11':'#edaa40')+';cursor:ns-resize;';
    }
  }
  function startRoofPoint(sec,pt,x,z){
    const node=RoofStudio.liftPoint(sec,x,z);
    RoofStudio.toolsFor(project,sec).node=node.id;
    const roof={type:'roof',sectionId:sec.id};select(roof);
    startEdit('roofPoint',roof,pt);gesture.node=node;
    const vv=V(x,RoofStudio.positionHeight(sec,x,z),z),a=projected(vv),b=projected(vv.clone().add(V(0,1,0)));
    gesture.axis={x:b.x-a.x,y:b.y-a.y};
  }
  function dormerGrips(sec){
    const parts=RoofStudio.shapeData(sec).dormers;
    (sec.dormers||[]).forEach((d,i)=>{
      const part=parts[i];if(!part)return;
      const top=Math.max(...part.roof.flatMap(face=>face.q.map(point=>point[1])));
      const before=overlays.childElementCount;
      handle(V(part.cx,top+.15,part.cz),'dormerMove','↔ Кукушка'+(parts.length>1?' '+(i+1):''),true);
      if(overlays.childElementCount===before)return;
      const button=overlays.lastElementChild;
      button.dataset.dormerId=d.id;
      button.style.cursor='move';button.style.zIndex='3';
      button.title='Потяните кукушку по крыше. Для перемещения в глубину выберите вид сверху или под углом.';
    });
  }
  function addGrips(){
    screenRidges=null;
    overlays.replaceChildren();if(options.inspect||options.exposeStructure||!selected||!project||options.mode)return;
    let p=project;
    if(selected.type==='opening'){
      const model=ownerModel(p,selected.extensionId);
      let o=model.ops.find(v=>v.id===selected.id);if(!o)return;
      let facing=[Math.cos(azimuth),Math.sin(azimuth),-Math.cos(azimuth),-Math.sin(azimuth)][o.f];if(facing<.04)return;
      let bottom=o.floor*model.h+o.sill;
      [[0,.5,'left','Левый край'],[1,.5,'right','Правый край'],[.5,1,'top','Верх проёма'],[.5,0,'bottom','Низ проёма']].forEach(([u,v,k,t])=>handle(ownerPoint(p,selected.extensionId,o.f,o.x+o.w*u,bottom+o.h*v,.08),k,t));
      return;
    }
    if(selected.type==='terrace'){
      const s=PentiiTerraces.sections(p).find(t=>t.id===selected.sectionId);
      if(!s)return;
      const r=PentiiTerraces.rect(p,s),mx=r.x+r.w/2,mz=r.z+r.d/2;
      const edges=[['roofFront',mx,r.z+r.d],['roofRight',r.x+r.w,mz],['roofBack',mx,r.z],['roofLeft',r.x,mz]];
      for(let e=0;e<4;e++){
        if(e===(s.terrace.side+2)%4)continue;
        const [key,x,z]=edges[e],v=V(x,.04,z);
        const start=projected(v),unit=projected(v.clone().add(e%2?V(1,0,0):V(0,0,1)));
        // A head-on orthographic facade collapses the depth axis. Its plan view
        // provides that handle without placing it over another grip on the wall.
        if(Math.hypot(unit.x-start.x,unit.y-start.y)<3)continue;
        handle(v,key,e===s.terrace.side?'Вылет':e===1||e===0?'→':'←',true);
      }
      return;
    }
    if(selected.type==='column')return;
    if(selected.type==='roof'){
      const sec=window.RoofStudio.sections(p).find(s=>s.id===selected.sectionId);
      if(!sec)return;
      const action=RoofStudio.actionFor(p,sec);
      if(action==='lift'){roofPointGrips(sec);return}
      dormerGrips(sec);
      if(action==='dormer'||action==='moveDormer')return;
      const x=sec.x,z=sec.z,mx=x+sec.w/2,mz=z+sec.d/2,y=sec.base;
      const roofAction=roofEditAction(sec);
      if(roofAction==='move'){
        handle(V(mx,RoofStudio.positionHeight(sec,mx,mz),mz),'roofMove','↔ Переместить крышу',true);
        handle(V(x+sec.w,y,z+sec.d),'base','↕ Карниз '+metres(y),true);return;
      }
      const ridge=visibleRidges().filter(r=>r.section.id===sec.id)
        .sort((a,b)=>Math.min(cam.position.distanceTo(a.worldA),cam.position.distanceTo(a.worldB))-Math.min(cam.position.distanceTo(b.worldA),cam.position.distanceTo(b.worldB)))[0];
      if(roofAction==='pitch'&&ridge){
        const frontFirst=cam.position.distanceTo(ridge.worldA)<cam.position.distanceTo(ridge.worldB);
        const anchor=ridge.worldA.clone().lerp(ridge.worldB,frontFirst?.24:.76);
        handle(anchor,'pitch','↕ '+RoofStudio.crestName(sec)+' '+metres(anchor.y)+' · '+sec.pitch+'°',true);
      }
      if(roofAction==='pitch')return;
      const body=envelope(p,sec.extensionId);
      const overHouse=!sec.canopy&&x<=body.x&&z<=body.z&&x+sec.w>=body.x+body.w&&z+sec.d>=body.z+body.d;
      const left=projected(V(x,y,mz)),right=projected(V(x+sec.w,y,mz));
      if(Math.hypot(left.x-right.x,left.y-right.y)>32){
        handle(V(x,y,mz),'roofLeft','←',true);handle(V(x+sec.w,y,mz),'roofRight',(overHouse?'Свес '+metres(x+sec.w-body.x-body.w):'Ширина '+metres(sec.w))+' →',true);
      }
      const a=projected(V(mx,y,z)),b=projected(V(mx,y,z+sec.d));
      if(Math.hypot(a.x-b.x,a.y-b.y)>32){
        handle(V(mx,y,z),'roofBack','↗',true);handle(V(mx,y,z+sec.d),'roofFront',(overHouse?'Свес '+metres(z+sec.d-body.z-body.d):'Глубина '+metres(sec.d))+' ↙',true);
      }
      return;
    }
    if(selected.extensionId){
      const e=owner(p,selected.extensionId);if(e===p)return;
      const nx=e.x+(Math.sin(azimuth)>=0?e.w:0),nz=e.z+(Math.cos(azimuth)>=0?e.d:0);
      handle(V(e.x+e.w,.12,nz),'extensionW','↔ '+metres(e.w),true);
      if(Math.abs(Math.sin(azimuth))>.08||elevation>.1)handle(V(nx,.12,e.z+e.d*.53),'extensionD','↔ '+metres(e.d),true);
      if(e.walls)handle(V(nx,e.h,nz),'extensionH','↕ '+metres(e.h),true);
      handle(V(e.x+e.w/2,e.walls?e.h*.5:.1,e.z+e.d/2),'extensionMove','✥ Переместить',true);return;
    }
    const nearX=Math.sin(azimuth)>=0?p.w:0,nearZ=Math.cos(azimuth)>=0?p.d:0;
    handle(V(p.w,.2,nearZ),'w','↔ '+metres(p.w),true);
    handle(V(nearX,.2,p.d*.57),'d','↔ '+metres(p.d),true);
    handle(V(nearX,p.n*p.h,nearZ),'h','↕ '+metres(p.h)+' / этаж',true);
  }
  function dragGuides(){
    if(gesture?.kind!=='edit'||options.inspect||options.exposeStructure||!project)return;
    const g=gesture,p=project,NS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(NS,'svg');svg.dataset.dragGuides='';svg.dataset.target=g.target?.type||'house';
    svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox','0 0 '+width+' '+height);
    svg.setAttribute('aria-label','Направляющие и размеры при перетаскивании');
    svg.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
    const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const mm=v=>Math.round(v*1000)+' мм';
    const labels=[],stageBox=stage.getBoundingClientRect();let markup='';
    const occupied=[...overlays.querySelectorAll('[data-grip]')].map(b=>{
      const r=b.getBoundingClientRect();return {x:r.left-stageBox.left,y:r.top-stageBox.top,w:r.width,h:r.height};
    });
    function segment(a,b,{color='#1887bd',dash='6 5',weight=1.35,opacity=1,kind='edge'}={}){
      const aa=projected(a),bb=projected(b);if(!Number.isFinite(aa.x+aa.y+bb.x+bb.y))return;
      const path='M'+aa.x.toFixed(2)+' '+aa.y.toFixed(2)+'L'+bb.x.toFixed(2)+' '+bb.y.toFixed(2);
      markup+='<path data-guide-kind="'+kind+'" d="'+path+'" fill="none" stroke="white" opacity="'+(opacity*.7)+'" stroke-width="'+(weight+2.2)+'" stroke-dasharray="'+dash+'"/>'
        +'<path d="'+path+'" fill="none" stroke="'+color+'" opacity="'+opacity+'" stroke-width="'+weight+'" stroke-dasharray="'+dash+'"/>';
    }
    function label(v,value,dx=0,dy=0,color='#125375'){
      const q=projected(v);if(q.x<0||q.x>width||q.y<0||q.y>height)return;
      value=String(value);
      const w=Math.min(width-10,value.length*6.7+16),h=23;
      const home={x:clamp(q.x+dx-w/2,5,Math.max(5,width-w-5)),y:clamp(q.y+dy-h/2,5,height-h-5)};
      const overlap=box=>[...occupied,...labels].reduce((sum,b)=>sum+Math.max(0,Math.min(box.x+w,b.x+b.w+4)-Math.max(box.x,b.x-4))*Math.max(0,Math.min(box.y+h,b.y+b.h+3)-Math.max(box.y,b.y-3)),0);
      const candidates=[];
      for(const [cx,cy] of [[0,0],[0,-28],[0,28],[0,-56],[0,56],[-55,0],[55,0],[-55,-28],[55,28],[0,-84],[0,84],[-90,0],[90,0]]){
        const box={x:clamp(home.x+cx,5,Math.max(5,width-w-5)),y:clamp(home.y+cy,5,height-h-5)};
        candidates.push({...box,score:overlap(box)*100+Math.hypot(cx,cy)});
      }
      const best=candidates.sort((a,b)=>a.score-b.score)[0];
      labels.push({x:best.x,y:best.y,w,h,value,color});
    }
    function loop(points,color='#1688c9'){for(let i=0;i<points.length;i++)segment(points[i],points[(i+1)%points.length],{color})}
    function measure(a,b,value,dx=0,dy=0){segment(a,b,{dash:'3 3',weight:1.6,kind:'dimension'});label(a.clone().add(b).multiplyScalar(.5),value,dx,dy)}
    if(g.target?.type==='opening'){
      const p=ownerModel(project,g.target.extensionId),o=p.ops.find(o=>o.id===g.target.id);if(!o)return;
      const L=wallLen(p,o.f),base=o.floor*p.h;
      const point=(u,v)=>ownerPoint(project,g.target.extensionId,o.f,u,base+v,.095);
      const neighbors=window.PentiiAlign?.references(p,o)||[];
      const refs=new Map();
      for(const other of neighbors)for(const [axis,value] of [['v',other.sill],['v',other.sill+other.h],['u',other.x],['u',other.x+other.w]])refs.set(axis+value,{axis,value});
      for(const {axis,value} of refs.values())segment(axis==='v'?point(0,value):point(value,0),axis==='v'?point(L,value):point(value,p.h),{color:'#708a99',opacity:.55,dash:'3 6',weight:1,kind:'neighbor'});
      for(const y of [o.sill,o.sill+o.h])segment(point(0,y),point(L,y),{kind:'opening-edge'});
      for(const x of [o.x,o.x+o.w])segment(point(x,0),point(x,p.h),{kind:'opening-edge'});
      segment(point(0,0),point(L,0),{color:'#14536d',weight:1.8,dash:'9 4',kind:'floor'});
      // A half-metre ruler on the current storey remains readable in any facade view.
      for(let value=0;value<=p.h+.0001;value+=.5){
        segment(point(0,value),point(.09,value),{color:'#14536d',dash:'',weight:1.5,kind:'ruler'});
        label(point(.02,value),Math.round(value*1000),-20,0,'#3e5a69');
      }
      loop([point(o.x,o.sill),point(o.x+o.w,o.sill),point(o.x+o.w,o.sill+o.h),point(o.x,o.sill+o.h)]);
      measure(point(o.x,o.sill+o.h),point(o.x+o.w,o.sill+o.h),'Ш '+mm(o.w),0,-23);
      measure(point(o.x+o.w,o.sill),point(o.x+o.w,o.sill+o.h),'В '+mm(o.h),62,0);
      if(o.sill>.005)measure(point(o.x+.11,0),point(o.x+.11,o.sill),'От пола '+mm(o.sill),0,0);
      else label(point(o.x+o.w/2,0),'От пола 0 мм',0,28);
      if(o.x>.02)measure(point(0,.12),point(o.x,.12),'От края '+mm(o.x),0,25);
      for(const hit of g.hits||[]){
        segment(hit.axis==='v'?point(0,hit.value):point(hit.value,0),hit.axis==='v'?point(L,hit.value):point(hit.value,p.h),{color:'#16845a',weight:2,dash:'8 4',kind:'aligned'});
      }
    }else if(g.target?.type==='roof'){
      const s=RoofStudio.sections(p).find(s=>s.id===g.target.sectionId);if(!s)return;
      const y=s.base,top=RoofStudio.overallHeight?.(s)??RoofStudio.ridgeHeight(s);
      loop([V(s.x,y,s.z),V(s.x+s.w,y,s.z),V(s.x+s.w,y,s.z+s.d),V(s.x,y,s.z+s.d)]);
      const body=envelope(p,s.extensionId);
      loop([V(body.x,y,body.z),V(body.x+body.w,y,body.z),V(body.x+body.w,y,body.z+body.d),V(body.x,y,body.z+body.d)],'#7c919d');
      measure(V(s.x,y,s.z+s.d),V(s.x+s.w,y,s.z+s.d),'Кровля '+mm(s.w),0,23);
      measure(V(s.x+s.w,y,s.z),V(s.x+s.w,y,s.z+s.d),'Глубина '+mm(s.d),46,0);
      measure(V(s.x,0,s.z+s.d),V(s.x,y,s.z+s.d),'Карниз '+mm(y),-55,0);
      measure(V(s.x+s.w,0,s.z),V(s.x+s.w,top,s.z),'Верх '+mm(top),50,0);
      for(const hit of g.hits||[]){
        if(hit.axis==='x')segment(V(hit.value,y,s.z-.5),V(hit.value,y,s.z+s.d+.5),{color:'#16845a',weight:2,kind:'aligned'});
        if(hit.axis==='z')segment(V(s.x-.5,y,hit.value),V(s.x+s.w+.5,y,hit.value),{color:'#16845a',weight:2,kind:'aligned'});
        if(hit.axis==='y')segment(V(s.x,hit.value,s.z+s.d),V(s.x+s.w,hit.value,s.z+s.d),{color:'#16845a',weight:2,kind:'aligned'});
      }
      if(!s.canopy){
        const right=body.x+body.w,front=body.z+body.d;
        const offsets=[[body.x-s.x,V((body.x+s.x)/2,y,s.z+s.d/2)],[s.x+s.w-right,V((s.x+s.w+right)/2,y,s.z+s.d/2)],[body.z-s.z,V(s.x+s.w/2,y,(s.z+body.z)/2)],[s.z+s.d-front,V(s.x+s.w/2,y,(s.z+s.d+front)/2)]];
        for(const [value,point] of offsets)if(value>=0)label(point,'Свес '+mm(value),0,-22);
      }
    }else if(g.target?.type==='terrace'){
      const s=PentiiTerraces.sections(p).find(s=>s.id===g.target.sectionId);if(!s)return;
      const r=PentiiTerraces.rect(p,s),y=.025;
      loop([V(r.x,y,r.z),V(r.x+r.w,y,r.z),V(r.x+r.w,y,r.z+r.d),V(r.x,y,r.z+r.d)]);
      measure(V(r.x,y,r.z+r.d),V(r.x+r.w,y,r.z+r.d),'Настил '+mm(r.w),0,22);
      measure(V(r.x+r.w,y,r.z),V(r.x+r.w,y,r.z+r.d),'Глубина '+mm(r.d),35,0);
      label(V(r.x+r.w/2,y,r.z+r.d/2),'Уровень пола 0 мм',0,-20);
    }else if(g.target?.extensionId){
      const e=owner(p,g.target.extensionId),H=e.walls?e.h:0;
      const nx=e.x+(Math.sin(azimuth)>=0?e.w:0),nz=e.z+(Math.cos(azimuth)>=0?e.d:0);
      for(const y of [0,H])loop([V(e.x,y,e.z),V(e.x+e.w,y,e.z),V(e.x+e.w,y,e.z+e.d),V(e.x,y,e.z+e.d)]);
      for(const x of [e.x,e.x+e.w])for(const z of [e.z,e.z+e.d])segment(V(x,0,z),V(x,H,z));
      measure(V(e.x,0,nz),V(e.x+e.w,0,nz),'Пристройка '+mm(e.w),0,25);
      measure(V(nx,0,e.z),V(nx,0,e.z+e.d),'Глубина '+mm(e.d),45,0);
      if(H)measure(V(nx,0,nz),V(nx,H,nz),'Высота '+mm(H),-55,0);
    }else{
      const H=p.n*p.h,nearX=Math.sin(azimuth)>=0?p.w:0,nearZ=Math.cos(azimuth)>=0?p.d:0;
      for(const y of [0,H])loop([V(0,y,0),V(p.w,y,0),V(p.w,y,p.d),V(0,y,p.d)]);
      for(const x of [0,p.w])for(const z of [0,p.d])segment(V(x,0,z),V(x,H,z));
      measure(V(0,0,nearZ),V(p.w,0,nearZ),'Ширина '+mm(p.w),0,25);
      measure(V(nearX,0,0),V(nearX,0,p.d),'Глубина '+mm(p.d),45,0);
      measure(V(nearX,0,nearZ),V(nearX,H,nearZ),'Высота '+mm(H),-55,0);
      for(let floor=1;floor<p.n;floor++)segment(V(0,floor*p.h,nearZ),V(p.w,floor*p.h,nearZ),{kind:'floor',color:'#7c919d'});
    }
    for(const b of labels)markup+='<g data-guide-value="'+xml(b.value)+'"><rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="5" fill="#fffffff2" stroke="#b6d5e3"/><text x="'+(b.x+b.w/2)+'" y="'+(b.y+15.5)+'" text-anchor="middle" fill="'+b.color+'" font-family="Arial,sans-serif" font-size="12" font-weight="600">'+xml(b.value)+'</text></g>';
    svg.innerHTML=markup;overlays.prepend(svg);
  }
  function render(){if(!renderer||renderBusy)return;highlightSection();renderer.render(scene,cam);addGrips();dragGuides();updateSectionBar()}
  function select(target){selected=target||null;options.select?.(selected||{type:'none'});render()}
  function apply(next,keepFrame=false){
    const error=options.validate?.(next);if(error){report(error);return false}
    let result;
    applyingGesture=keepFrame;
    try{result=options.change?.(next)}finally{applyingGesture=false}
    if(result===false){report('Проверьте размеры на фасаде.');return false}
    return true;
  }
  function menuAt(pt,entries){menu.replaceChildren();for(let [label,fn] of entries){let b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='margin:0;width:100%;display:block;padding:8px 10px;text-align:left;font:500 13px Onest,Arial;border:0;background:white;color:#1a4661';b.onpointerdown=e=>e.stopPropagation();b.onclick=e=>{e.stopPropagation();menu.hidden=true;fn()};menu.append(b)}
    menu.hidden=false;menu.style.left=clamp(pt.x,4,width-menu.offsetWidth-4)+'px';menu.style.top=clamp(pt.y,4,height-menu.offsetHeight-4)+'px';
  }
  function placeOpening(f,point,kind,extensionId){
    if(!point)return;
    let p=ownerModel(project,extensionId);let floor=clamp(Math.floor(Math.max(0,point.v)/p.h),0,p.n-1),w=Math.min(wallLen(p,f),[1.4,2.6,1,1.45][kind]),h=Math.min([1.4,2.28,2.16,2.2][kind],p.h-.05);
    let sill=kind===0?quant(clamp(point.v-floor*p.h-h/2,0,p.h-h)):0;
    const o={id:window.crypto?.randomUUID?.()||String(Math.random()).slice(2),f,floor,k:kind,w,h,sill,x:quant(clamp(point.u-w/2,0,wallLen(p,f)-w))};
    const next=structuredClone(project);owner(next,extensionId).ops.push(o);
    if(options.validate?.(next)){report('Здесь уже есть проём. Нажмите на свободную часть стены.');return}
    options.onMode?.('');selected={type:'opening',id:o.id,face:f,...(extensionId?{extensionId}:{})};options.select?.(selected);apply(next);addGrips()
  }
  function contextual(hit,pt){
    if(options.mode==='placeSection'||options.mode==='chooseSection')return;
    if(hit?.sectionId&&options.onSectionAction){
      select(hit);
      const s=selectedSection();if(s)menuAt(pt,sectionCommands(s).map(([action,label])=>[label,()=>options.onSectionAction(action,s.id)]));
      return;
    }
    if(!hit){if(options.onSectionAction)menuAt(pt,[['Добавить секцию',()=>options.onSectionAction('add',null)]]);return}
    if(hit.type==='opening'){
      select(hit);menuAt(pt,[['Изменить размер',()=>report('Тяните голубые маркеры по краям проёма.')],['Удалить проём',()=>{let next=structuredClone(project);const body=owner(next,hit.extensionId);body.ops=body.ops.filter(o=>o.id!==hit.id);selected=null;apply(next)}]]);return
    }
    if(hit.type==='wall'){let local=localAt(hit.face,pt,project,hit.extensionId);
      select(hit);menuAt(pt,[...kinds.map((k,i)=>['+ '+k,()=>placeOpening(hit.face,local,i,hit.extensionId)]),['Размеры дома',()=>report('Потяните голубую подпись размера.')]]);return}
    select(hit);
  }
  function startEdit(key,target,start){
    let orig=structuredClone(project),f=target?.face??0,local=localAt(f,start,orig,target?.extensionId);
    gesture={kind:'edit',key,target,start,orig,local,valid:orig,moved:false};
    if(key==='roofMove'||key==='dormerMove'||key==='extensionMove'){
      const section=key==='extensionMove'?owner(orig,target.extensionId):RoofStudio.sections(orig).find(s=>s.id===target.sectionId);
      const center=V(section.x+section.w/2,section.base||0,section.z+section.d/2);
      const screen=projected(center),x=projected(center.clone().add(V(1,0,0))),z=projected(center.clone().add(V(0,0,1)));
      gesture.groundAxes={x:{x:x.x-screen.x,y:x.y-screen.y},z:{x:z.x-screen.x,y:z.y-screen.y}};
    }
    if(['w','d','h','extensionW','extensionD','extensionH','pitch','roofLeft','roofRight','roofBack','roofFront','base'].includes(key)){
      let axis=['w','extensionW','roofLeft','roofRight'].includes(key)?V(1,0,0):['d','extensionD','roofBack','roofFront'].includes(key)?V(0,0,1):V(0,1,0);
      let a=projected(V(0,0,0)),b=projected(axis);
      gesture.axis={x:b.x-a.x,y:b.y-a.y};
    }
    render();
  }
  function editing(pt,free=false){
    let g=gesture,next=structuredClone(g.orig),dx=pt.x-g.start.x,dy=pt.y-g.start.y;
    if(Math.hypot(dx,dy)<3&&!g.moved)return;g.moved=true;
    let msg;g.hits=[];
    function alignRoof(section,patch,key){
      if(free||!window.PentiiAlign)return patch;
      const at=projected(V(section.x,section.base,section.z)),unit=projected(V(section.x+1,section.base,section.z));
      const tolerance=clamp(7/Math.max(20,Math.hypot(unit.x-at.x,unit.y-at.y)),.025,.14);
      const result=PentiiAlign.snapRoof(next,section,patch,key,tolerance);g.hits=result.hits;return result.patch;
    }
    if(g.key==='roofMove'||g.key==='dormerMove'||g.key==='extensionMove'){
      const section=g.key==='extensionMove'?owner(next,g.target.extensionId):RoofStudio.sections(next).find(s=>s.id===g.target.sectionId);
      const {x,z}=g.groundAxes,det=x.x*z.y-x.y*z.x;
      let xMove=0,zMove=0;
      if(Math.sin(elevation)>.12&&Math.abs(det)>.2){
        xMove=(dx*z.y-dy*z.x)/det;zMove=(x.x*dy-x.y*dx)/det;
      }else{
        // In a level facade view only the horizontal ground direction is visible.
        const length=x.x*x.x+z.x*z.x;
        if(length>1){xMove=dx*x.x/length;zMove=dx*z.x/length}
      }
      if(g.key==='extensionMove'){
        const patch={x:quant(section.x+xMove),z:quant(section.z+zMove)};
        if(!free)Object.assign(patch,PentiiExtensions.snap(next,section,patch,'move',.13));
        PentiiExtensions.update(next,section.id,patch);
        msg='Пристройка · X '+metres(patch.x)+' · Z '+metres(patch.z)+' · Alt — без привязки';
      }else if(g.key==='dormerMove'){
        const d=section.dormers.find(item=>item.id===g.dormerId);if(!d)return;
        const alongX=d.direction%2===1;
        const halfX=Math.min(alongX?d.depth:d.width,section.w*.9)/2;
        const halfZ=Math.min(alongX?d.width:d.depth,section.d*.9)/2;
        const [originalX,originalZ]=RoofSculpt.xz(section,d.u,d.v);
        const x=clamp(originalX+xMove,section.x+halfX,section.x+section.w-halfX);
        const z=clamp(originalZ+zMove,section.z+halfZ,section.z+section.d-halfZ);
        const [u,v]=RoofSculpt.uv(section,x,z);
        next=RoofStudio.editSection(next,section.id,{dormers:section.dormers.map(item=>item.id===d.id?{...item,u,v}:item)});
        msg='Кукушка · положение на крыше';
      }else{
        const patch={x:quant(section.x+xMove),z:quant(section.z+zMove)};
        next=RoofStudio.editSection(next,section.id,alignRoof(section,patch,'move'));
        msg='Положение крыши · X '+metres(patch.x)+' · Z '+metres(patch.z);
      }
    }else if(g.axis){
      let change=(dx*g.axis.x+dy*g.axis.y)/Math.max(3,g.axis.x*g.axis.x+g.axis.y*g.axis.y);
      if(g.key.startsWith('extension')){
        const e=owner(next,g.target.extensionId),key={extensionW:'w',extensionD:'d',extensionH:'h'}[g.key];
        PentiiExtensions.update(next,e.id,{[key]:quant(clamp(e[key]+change,key==='h'?2.2:.8,key==='h'?6:35))});
        msg='Пристройка · '+metres(e.w)+' × '+metres(e.d)+' · высота '+metres(e.h);
      }else if(g.target?.type==='terrace'&&['roofLeft','roofRight','roofFront','roofBack'].includes(g.key)){
        next=window.PentiiTerraces.resizeDeck(next,g.target.sectionId,g.key,change);
        const section=RoofStudio.sections(next).find(s=>s.id===g.target.sectionId);
        const deck=PentiiTerraces.rect(next,section);
        msg='Настил террасы · '+metres(deck.w)+' × '+metres(deck.d);
      }else if(g.target?.type==='roof'){
        const sec=window.RoofStudio.sections(next).find(s=>s.id===g.target.sectionId);if(!sec)return;
        const patch={};
        if(g.key==='roofPoint'){
          Object.assign(patch,RoofStudio.setLift(sec,g.node,g.node.lift+change));
          const [x,z]=RoofSculpt.xz(sec,g.node.u,g.node.v);
          msg='Высота точки '+metres(RoofStudio.positionHeight({...sec,...patch},x,z));
        }else if(g.key==='pitch'){
          patch.pitch=RoofStudio.pitchForLift(sec,change);
          const h=RoofStudio.ridgeHeight({...sec,...patch});
          msg=RoofStudio.crestName(sec)+' '+metres(h)+' · уклон '+patch.pitch+'° · карниз '+metres(sec.base);
        }else if(g.key==='base'){
          patch.base=quant(clamp(sec.base+change,.45,20));msg='Высота опоры кровли '+metres(patch.base);
        }else{
          const dim=['roofLeft','roofRight'].includes(g.key)?'w':'d',coord=dim==='w'?'x':'z';
          const lower=['roofLeft','roofBack'].includes(g.key);
          patch[dim]=quant(clamp(sec[dim]+change*(lower?-1:1),.6,65));
          if(lower)patch[coord]=sec[coord]+sec[dim]-patch[dim];
          msg=sec.name+' · '+metres(patch[dim]);
          if(!sec.canopy){
            const body=envelope(next,sec.extensionId);
            const edge=lower?body[coord]-(patch[coord]??sec[coord]):sec[coord]+patch[dim]-body[coord]-body[dim];
            if(edge>=0)msg+=' · свес '+metres(edge);
          }
        }
        next=window.RoofStudio.editSection(next,sec.id,alignRoof(sec,patch,g.key==='base'?'base':g.key.replace('roof','').toLowerCase()));
      }else{
        let floor=g.key==='h';next[g.key]=quant(clamp(next[g.key]+change/(floor?next.n:1),floor?2.2:3,floor?6:35));
        if(!floor){
          const scale=next[g.key]/g.orig[g.key];
          for(let wall of next.walls){for(let k of (g.key==='w'?['a','c']:['b','d']))wall[k]=Math.round(wall[k]*scale*100)/100}
          for(let o of next.ops){if((o.f%2===0)===(g.key==='w'))o.x=clamp(Math.round((o.x+o.w/2)*scale*100)/100-o.w/2,0,Math.max(0,next[g.key]-o.w))}
        }
        msg=(floor?'Высота этажа ':g.key==='w'?'Ширина ':'Глубина ')+metres(next[g.key]);
      }
    }else{
      const model=ownerModel(next,g.target.extensionId),body=owner(next,g.target.extensionId);
      let o=body.ops.find(o=>o.id===g.target.id);if(!o)return;
      const c=localAt(o.f,pt,next,g.target.extensionId);if(!c||!g.local)return;
      let du=c.u-g.local.u,dv=c.v-g.local.v;
      if(g.key==='move'){o.x=quant(clamp(o.x+du,0,wallLen(model,o.f)-o.w));o.sill=quant(clamp(o.sill+dv,0,model.h-o.h))}
      if(g.key==='left'){let end=o.x+o.w;o.x=quant(clamp(o.x+du,0,end-.2));o.w=quant(end-o.x)}
      if(g.key==='right')o.w=quant(clamp(o.w+du,.2,wallLen(model,o.f)-o.x));
      if(g.key==='bottom'){let end=o.h+o.sill;o.sill=quant(clamp(o.sill+dv,0,end-.2));o.h=quant(end-o.sill)}
      if(g.key==='top')o.h=quant(clamp(o.h+dv,.2,model.h-o.sill));
      g.hits=[];
      if(!free&&window.PentiiAlign){
        const one=projected(ownerPoint(next,g.target.extensionId,o.f,o.x,o.floor*model.h+o.sill)),unit=projected(ownerPoint(next,g.target.extensionId,o.f,o.x+1,o.floor*model.h+o.sill));
        const tolerance=clamp(7/Math.max(20,Math.hypot(unit.x-one.x,unit.y-one.y)),.025,.14);
        const aligned=PentiiAlign.snapOpening({...model,ops:body.ops},o,g.key,tolerance);Object.assign(o,aligned.opening);g.hits=aligned.hits;
      }
      msg=metres(o.w)+' × '+metres(o.h)+' · от пола '+metres(o.sill)+(g.hits.length?' · '+g.hits.map(h=>h.label).join('; '):'')+' · Alt — без привязки';
    }
    if(g.target?.type==='roof'&&['roofMove','roofLeft','roofRight','roofFront','roofBack','base'].includes(g.key)){
      const current=RoofStudio.sections(next).find(s=>s.id===g.target.sectionId);
      msg='Кровля '+metres(current.w)+' × '+metres(current.d)+' · карниз '+metres(current.base)+(g.hits.length?' · по опорной линии':'')+' · Alt — без привязки';
    }
    let error=options.validate?.(next);if(error){report(error);return}
    g.valid=next;project=next;
    // Keep construction data unchanged while using a lighter surface during a drag.
    rebuild({...next,previewInteraction:true});render();report(msg);
    if(g.target?.type==='roof'){
      const section=RoofStudio.sections(next).find(s=>s.id===g.target.sectionId);
      if(section)RoofStudio.refreshSection(next,section);
    }
  }
  function cancelEdit(){
    if(gesture?.kind!=='edit')return;
    project=gesture.orig;rebuild(project);render();
    if(gesture.target?.type==='roof'){
      const s=RoofStudio.sections(project).find(s=>s.id===gesture.target.sectionId);
      if(s)RoofStudio.refreshSection(project,s);
    }
  }
  stage.onpointerdown=e=>{
    if(renderBusy||menu.contains(e.target))return;
    e.stopPropagation();e.preventDefault();menu.hidden=true;
    renderer.domElement.focus({preventScroll:true});
    let pt=ptr(e);pointerMap.set(e.pointerId,pt);stage.setPointerCapture(e.pointerId);
    if(pointerMap.size===2){
      inspectTap=null;
      let [a,b]=pointerMap.values();
      pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,offset:offset.clone(),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
      cancelEdit();gesture=null;render();return;
    }
    if(e.button===2){inspectTap=null;return}
    if(e.shiftKey||e.button===1){gesture={kind:'pan',start:pt,offset:offset.clone(),moved:false};return}
    if(options.inspect||options.mode==='placeSection'||options.mode==='chooseSection'){gesture={kind:'orbit',start:pt,azimuth,elevation,moved:false};return}
    let key=e.target.dataset.grip,hit=at(pt);
    const roofSection=id=>RoofStudio.sections(project).find(s=>s.id===id);
    if(key==='dormerMove'){
      const section=roofSection(selected?.sectionId),id=e.target.dataset.dormerId;
      if(!section?.dormers?.some(d=>d.id===id))return;
      const state=RoofStudio.toolsFor(project,section);state.dormer=id;state.mode='';
      startEdit('dormerMove',selected,pt);gesture.dormerId=id;return;
    }
    if(key==='roofPoint'){
      const section=roofSection(selected?.sectionId);if(!section)return;
      const [x,z]=RoofSculpt.xz(section,Number(e.target.dataset.u),Number(e.target.dataset.v));
      startRoofPoint(section,pt,x,z);return;
    }
    if(key){startEdit(key,selected,pt);return}
    const active=selected?.type==='roof'&&roofSection(selected.sectionId);
    const action=active&&RoofStudio.actionFor(project,active);
    if(action==='lift'||action==='dormer'||action==='moveDormer'){
      const rayHit=cast(pt.x,pt.y).intersectObject(group,true).find(h=>h.object.userData.target);
      if(rayHit?.object.userData.target.sectionId===active.id){
        const {x,z}=rayHit.point;
        if(action==='lift'){startRoofPoint(active,pt,x,z);return}
        const delta=RoofStudio.atLocation(active,x,z);
        const state=RoofStudio.toolsFor(project,active);state.mode='';
        if(!apply(RoofStudio.editSection(project,active.id,delta))){state.mode=action;addGrips();}
        return;
      }
    }
    const roofAction=active?roofEditAction(active):'size';
    const ridge=active&&roofAction==='pitch'&&nearRidge(pt,true);
    if(ridge&&ridge.id===active.id){
      const roof={type:'roof',sectionId:ridge.id};select(roof);
      startEdit('pitch',roof,pt);return
    }
    if(active&&hit?.type==='roof'&&active.id===hit.sectionId&&!options.exposeStructure&&['pitch','move'].includes(roofAction)){
      startEdit(roofAction==='pitch'?'pitch':'roofMove',selected,pt);return;
    }
    if(options.mode!=='add'&&hit?.type==='opening'){
      select(hit);startEdit('move',hit,pt);return
    }
    gesture={kind:'orbit',start:pt,hit,azimuth,elevation,moved:false}
  };
  stage.onpointermove=e=>{
    if(renderBusy)return;
    let pt=ptr(e);if(pointerMap.has(e.pointerId))pointerMap.set(e.pointerId,pt);
    if(pinch&&pointerMap.size===2){
      let [a,b]=pointerMap.values(),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(4,pinch.distance),.42,4);
      const ratio=zoom/pinch.zoom;
      panFrom(pinch.offset,center.x-width/2-(pinch.center.x-width/2)*ratio,center.y-height/2-(pinch.center.y-height/2)*ratio);
      positionCamera(project,false);render();return;
    }
    if(!gesture){stage.style.cursor=options.inspect?'grab':e.target.dataset.grip?'':options.mode==='add'||options.mode==='placeSection'?'crosshair':options.roofAction==='pitch'&&nearRidge(pt)?'ns-resize':'grab';return}
    e.stopPropagation();if(gesture.kind==='edit'){editing(pt,e.altKey);return}
    const dx=pt.x-gesture.start.x,dy=pt.y-gesture.start.y;
    if(Math.hypot(dx,dy)>4||gesture.moved){
      gesture.moved=true;stage.style.cursor='grabbing';
      if(gesture.kind==='pan'){panFrom(gesture.offset,dx,dy);positionCamera(project,false);render()}
      else orbitTo(gesture.azimuth-dx*.008,gesture.elevation+dy*.006);
    }
  };
  stage.onpointerup=e=>{
    e.stopPropagation();pointerMap.delete(e.pointerId);if(pinch){if(pointerMap.size===0)pinch=null;return}
    let g=gesture;gesture=null;if(!g)return;let pt=ptr(e);
    if(g.kind==='edit'){
      if(g.moved){apply(g.valid,true);report(g.key==='pitch'?'Уклон, фронтон и потолок обновлены':g.key==='dormerMove'?'Положение кукушки сохранено':'Размеры сохранены')}else if(g.key==='roofPoint'&&RoofStudio.actionFor(project,RoofStudio.sections(project).find(s=>s.id===g.target.sectionId))==='lift'){const sec=RoofStudio.sections(project).find(s=>s.id===g.target.sectionId);if(!sec.liftPoints?.some(n=>n.id===g.node.id))apply(RoofStudio.editSection(project,sec.id,RoofStudio.setLift(sec,g.node,0)));}
      else if(g.target?.type==='opening'){select(g.target);report('Тяните проём за середину или за голубой маркер.')}
      render();updateSectionBar();return;
    }
    if(g.moved||g.kind==='pan'){inspectTap=null;return}
    if(options.mode==='chooseSection')return;
    if(options.inspect){
      const id=options.onEditSection&&at(pt)?.sectionId,now=performance.now();
      if(id&&inspectTap?.id===id&&inspectTap.pointer===e.pointerType&&now-inspectTap.time<=460&&Math.hypot(pt.x-inspectTap.x,pt.y-inspectTap.y)<17){
        inspectTap=null;options.onEditSection(id);
      }else inspectTap=id?{id,time:now,pointer:e.pointerType,...pt}:null;
      return;
    }
    if(options.mode==='placeSection'){
      const point=pointForSection(pt);
      if(point)options.onPlaceSection?.(point);else report('Выберите точку на доме или участке. Для размещения на земле удобно смотреть сверху.');
      return;
    }
    if(options.mode==='add'){
      let f=g.hit?.face;
      if(f===undefined){report('Выберите наружную стену дома.');return}
      placeOpening(f,localAt(f,pt,project,g.hit?.extensionId),Number(options.kind)||0,g.hit?.extensionId);return
    }
    if(g.hit?.type==='wall'){select(g.hit);report((g.hit.extensionId?'Тяните размеры пристройки.':'Тяните размер дома.')+' Правый щелчок по стене — добавить окно или дверь.')}
    else select(g.hit);
  };
  stage.onpointercancel=e=>{pointerMap.delete(e.pointerId);pinch=null;inspectTap=null;cancelEdit();gesture=null;render()};
  stage.oncontextmenu=e=>{
    e.preventDefault();e.stopPropagation();cancelEdit();gesture=null;render();if(renderBusy||options.exposeStructure)return;
    const pt=ptr(e),hit=at(pt);
    if(options.inspect){
      if(hit?.sectionId&&options.onEditSection)menuAt(pt,[['Редактировать секцию',()=>options.onEditSection(hit.sectionId)]]);
      return;
    }
    contextual(hit,pt);
  };
  stage.onwheel=e=>{e.preventDefault();scale(Math.exp(-e.deltaY*(e.deltaMode===1?.024:.0014)),ptr(e))};
  function show(el,p,opts={}){
    if(!init())return false;const switched=project?.id!==p.id;
    if(switched){selected=null;usePreset('front');previousLayer='';exteriorCamera=null;menu.hidden=true}
    const layer=window.PentiiStructure?.get(p).view||'finish';
    if(layer!=='finish'&&(!previousLayer||previousLayer==='finish')){
      exteriorCamera={azimuth,elevation,zoom,activePreset,offset:offset.clone()};usePreset('top');
    }else if(layer==='finish'&&previousLayer&&previousLayer!=='finish'&&exteriorCamera){
      ({azimuth,elevation,zoom,activePreset}=exteriorCamera);offset.copy(exteriorCamera.offset);
    }
    previousLayer=layer;
    if(switched||opts.inspect!==options.inspect)inspectTap=null;
    if(switched)placementCamera=null;
    if(opts.mode==='placeSection'&&options.mode!=='placeSection'&&elevation<radians(8)){
      placementCamera={azimuth,elevation,zoom,activePreset,offset:offset.clone()};usePreset('top');
    }else if(opts.mode!=='placeSection'&&placementCamera){
      if(activePreset==='top'){
        ({azimuth,elevation,zoom,activePreset}=placementCamera);offset.copy(placementCamera.offset);
      }
      placementCamera=null;
    }
    container=el;project=p;options=opts;
    const clearSection=selected?.sectionId&&(!RoofStudio.sections(p).some(s=>s.id===selected.sectionId)||!opts.editRoof&&!opts.editTerrace);
    if(opts.inspect||opts.exposeStructure||opts.mode==='placeSection'||clearSection){selected=null;menu.hidden=true}
    if(!opts.inspect&&!opts.mode&&opts.editRoof&&opts.sectionId&&!(selected?.type==='column'&&selected.sectionId===opts.sectionId))selected={type:'roof',sectionId:opts.sectionId};
    if(!opts.inspect&&!opts.mode&&opts.editTerrace){
      const list=PentiiTerraces.sections(p);
      const deck=list.find(s=>s.id===opts.sectionId)||list[0];
      if(deck)selected={type:'terrace',sectionId:deck.id};
    }
    if(selected?.extensionId&&(!p.extensions?.some(e=>e.id===selected.extensionId)||selected.extensionId!==opts.extensionId))selected=null;
    if(!opts.inspect&&!opts.exposeStructure&&!opts.mode&&opts.editExtension&&opts.extensionId&&!(selected?.type==='opening'&&selected.extensionId===opts.extensionId))selected={type:'extension',extensionId:opts.extensionId};
    if(stage.parentNode!==el)el.replaceChildren(stage);
    drawn=true;rebuild(project);
    if(applyingGesture&&!switched)offset.copy(viewTarget).sub(modelBounds.getCenter(V(0,0,0)));
    resize(!applyingGesture||switched);return true
  }
  function hide(){container=null;gesture=null;pinch=null;pointerMap.clear();menu.hidden=true;stage.remove();drawn=false}
  function rotate(){if(!project||!drawn||renderBusy)return;menu.hidden=true;orbitTo(azimuth+Math.PI/2,elevation)}
  async function snapshot(p,opts={}){
    if(!init())return null;
    if(renderBusy)throw Error('Уже идёт рендер');
    renderBusy=true;
    const old={project,azimuth,elevation,zoom,width,height,fit,drawn,activePreset,yardVisible,offset:offset.clone()};
    const finished=PentiiStructure.get(p).view==='finish';
    const high=finished&&!!opts.final;
    try{
      const keep=opts.current&&drawn&&project?.id===p.id;
      project=p;
      yardVisible=opts.yardVisible??(keep?old.yardVisible:true);
      if(!keep)usePreset(cameras[opts.preset]?opts.preset:finished?'front':'top');
      width=opts.width||1300;height=opts.height||760;
      rebuild(p);await Promise.all(Object.values(imageReady));positionCamera(p,true,!!opts.facadeScale);
      if(high){
        const blob=await StudioFilm.capture(renderer,scene,cam,light,{width,height,samples:opts.samples||12,signal:opts.signal,onProgress:opts.onProgress});
        if(opts.blob)return blob;
        return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
      }
      renderer.setSize(width,height,false);renderer.render(scene,cam);
      return renderer.domElement.toDataURL('image/jpeg',.94)
    }finally{
      ({project,azimuth,elevation,zoom,width,height,fit,drawn,activePreset,yardVisible}=old);offset.copy(old.offset);
      renderBusy=false;
      if(project&&drawn){renderer.setSize(width,height,false);rebuild(project);positionCamera(project,false);render()}
    }
  }
  function scale(multiplier,anchor){
    if(!project||!drawn||renderBusy)return;
    const oldZoom=zoom;zoom=clamp(zoom*multiplier,.42,4);
    if(anchor){const shift=1-zoom/oldZoom;panFrom(offset,(anchor.x-width/2)*shift,(anchor.y-height/2)*shift)}
    positionCamera(project,false);render();
  }
  function fitView(){if(!project||!drawn||renderBusy)return;zoom=1;offset.set(0,0,0);positionCamera(project);render()}
  return {show,hide,rotate,snapshot,refreshGrips(){addGrips();updateSectionBar()},setCamera,getCamera,setYardVisible,zoomIn:()=>scale(1.23),zoomOut:()=>scale(1/1.23),fit:fitView};
})();

/* Sheet metalwork is measured in metres. Batches are per material and roof section
   so ridge caps, soffits and drainage remain cheap to draw on a phone. */
window.RoofFinishes = (() => {
  const T = window.THREE;
  const v = a => new T.Vector3(...a);
  const up = new T.Vector3(0,1,0);
  const cache = new Map();
  const bituminous=kind=>['Мягкая черепица','ТЕХНОНИКОЛЬ SHINGLAS','Рулонная черепица'].includes(kind);
  function tileProfile(u,v){
    // 175 mm rounded pans and a 350 mm course. The stamped transverse step
    // has its own height: it must read as tiles, rather than corrugated sheet.
    const t=v*4-Math.floor(v*4),wave=(.5+.5*Math.cos(2*Math.PI*u*6))**2.1;
    const blend=Math.min(1,t/.09),rise=blend*blend*(3-2*blend);
    const course=rise*Math.pow(1-t,1.28);
    const curl=Math.exp(-Math.pow((t-.115)/.07,2));
    return .025*wave+.031*course*(1-.18*wave)+.006*curl*(1-wave);
  }
  function texture(type) {
    if(cache.has(type))return cache.get(type);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const c=canvas.getContext('2d');
    let n=18747;function rand(){return ((n=Math.imul(1664525,n)+1013904223|0)>>>0)/4294967296}
    const grey=(n)=>'rgb('+[n,n,n].join(',')+')';
    c.fillStyle='#efefef';c.fillRect(0,0,512,512);
    if(type==='ТЕХНОНИКОЛЬ SHINGLAS'){
      // Laminated staggered tabs: variation is confined to the granulate,
      // while the stepped lower edges make this distinct from hexagonal tabs.
      const rowHeight=512/6,tab=512/4;
      for(let row=7;row>=-1;row--)for(let i=-1;i<5;i++){
        const x=(i+(row%2)*.5)*tab,y=row*rowHeight;
        const shade=184+Math.floor(rand()*48),drop=rowHeight*(1.1+rand()*.25);
        c.fillStyle=grey(shade);c.fillRect(x,y,tab+1,drop+2);
        c.fillStyle='#383838';c.fillRect(x,y+drop-3,tab,3);
        c.fillStyle='#ffffff28';c.fillRect(x+2,y+drop-5,tab-4,1);
        c.fillStyle='#39393980';c.fillRect(x,y+rowHeight*.43,1.7,drop-rowHeight*.43);
        const tone=c.createLinearGradient(0,y,0,y+drop);tone.addColorStop(0,'#ffffff18');tone.addColorStop(1,'#00000020');
        c.fillStyle=tone;c.fillRect(x,y,tab,drop);
      }
      for(let i=0;i<48000;i++){c.fillStyle=rand()>.48?'#fff4':'#0005';const a=rand()*.9+.3;c.fillRect(rand()*512,rand()*512,a,a)}
    }else if(type==='Рулонная черепица'){
      // Flat decorative mineral-granule print, with a longitudinal roll lap.
      // It has no standing rib or projecting metal/shingle edges.
      const rowHeight=512/8,tab=512/4;
      for(let row=-1;row<9;row++)for(let i=-1;i<5;i++){
        const x=(i+(row%2)*.5)*tab,y=row*rowHeight;
        c.fillStyle=grey(177+Math.floor(rand()*38));c.fillRect(x,y,tab,rowHeight);
        c.fillStyle='#777';c.fillRect(x,y+rowHeight-2,tab,2);c.fillRect(x,y,2,rowHeight);
      }
      for(let i=0;i<46000;i++){c.fillStyle=rand()>.5?'#fff4':'#0004';c.fillRect(rand()*512,rand()*512,.9,.9)}
      c.fillStyle='#3333334d';c.fillRect(0,0,3,512);c.fillStyle='#ffffff28';c.fillRect(3,0,1,512);
    }else if(type==='Мягкая черепица'){
      for(let row=-1;row<8;row++)for(let i=-1;i<8;i++){
        const x=(i+(row%2)*.5)*80,y=row*70;
        c.fillStyle=grey(170+Math.floor(rand()*50));
        c.strokeStyle='#777';c.lineWidth=2;
        c.beginPath();c.moveTo(x,y);c.lineTo(x+80,y);c.lineTo(x+80,y+49);c.lineTo(x+57,y+68);c.lineTo(x+22,y+68);c.lineTo(x,y+49);c.closePath();c.fill();c.stroke();
      }
      for(let i=0;i<40000;i++){let s=rand()>.5?'#fff':'#000';c.fillStyle=s+'45';c.fillRect(rand()*512,rand()*512,1,1)}
    }else if(type==='Металлочерепица'){
      // Painted steel has a largely uniform base colour. Lighting over the
      // relief defines the ribs. Restrict cavity darkening to the crest's return.
      const image=c.createImageData(512,512);
      for(let y=0;y<512;y++)for(let x=0;x<512;x++){
        const phase=x/512*6*Math.PI*2,row=y/512*4;
        const t=row-Math.floor(row),trough=(.5-.5*Math.cos(phase))**1.5;
        // Narrow cavity at the transverse overlap remains readable at facade
        // scale; the broad pan gets its shading from its actual curved surface.
        const cavity=Math.exp(-Math.pow(t/.052,2)),lip=Math.exp(-Math.pow((t-.115)/.05,2));
        const value=239-51*cavity*(.60+.40*trough)+9*lip+1.8*(rand()-.5);
        image.data.set([value,value,value,255],(y*512+x)*4);
      }
      c.putImageData(image,0,0);
    }else if(type==='Софит'){
      for(let x=0;x<512;x+=64){
        c.fillStyle='#989898';c.fillRect(x,0,3,512);c.fillStyle='#fcfcfc';c.fillRect(x+4,0,3,512);
        for(let y=4;y<512;y+=16)for(let a=15;a<=45;a+=10){c.fillStyle='#8f8f8f';c.fillRect(x+a,y,2,6)}
      }
    }else{
      const interval=type==='Фальц'?256:64;
      for(let x=0;x<512;x+=interval){
        let gr=c.createLinearGradient(x,0,x+interval,0);
        let shades;
        if(type==='Фальц')shades=[[0,148],[.015,228],[.03,247],[.05,188],[.09,225],[1,226]];
        else if(type==='Профнастил')shades=[[0,220],[.46,220],[.49,197],[.64,182],[.66,245],[.83,245],[.85,236],[.98,227],[1,220]];
        else shades=[[0,224],[.16,224],[.25,210],[.4,243],[.52,248],[.63,213],[.75,208],[.91,226],[1,224]];
        shades.forEach(([at,val])=>gr.addColorStop(at,grey(val)));c.fillStyle=gr;c.fillRect(x,0,interval,512);
      }

    }
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;cache.set(type,map);return map;
  }
  function sheetRelief(kind){
    const key='relief:'+kind;if(cache.has(key))return cache.get(key);
    const n=256,h=new Float32Array(n*n),c=document.createElement('canvas');c.width=c.height=n;
    const ctx=c.getContext('2d'),p=ctx.createImageData(n,n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const phase=(x%(kind==='Фальц'?128:32))/(kind==='Фальц'?128:32),row=(y%64)/64;
      if(kind==='Металлочерепица')h[y*n+x]=tileProfile(x/n,y/n);
      else if(kind==='Профнастил')h[y*n+x]=.021*Math.min(1,Math.max(0,(phase-.45)*6),Math.max(0,(1-phase)*8));
      else if(kind==='Фальц')h[y*n+x]=.022*Math.max(0,1-Math.min(phase,1-phase)*26);
      else if(bituminous(kind)){
        const stone=(Math.sin(x*61+y*91)+Math.sin(x*127-y*37))*.00038;
        const courses=kind==='ТЕХНОНИКОЛЬ SHINGLAS'?6:kind==='Рулонная черепица'?8:512/70;
        const t=(y/n*courses)%1;
        h[y*n+x]=stone+(kind==='Рулонная черепица'?.00025:.0035)*(1-t);
      }else {
        const stone=Math.sin(x*61+y*91)*.00055;
        h[y*n+x]=stone+.002*(1-row);
      }
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const idx=y*n+x;
      const dx=(h[y*n+(x+n-1)%n]-h[y*n+(x+1)%n])*n/(2*1.05);
      const dy=(h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x])*n/(2*1.4);
      const len=Math.hypot(dx,dy,1);p.data.set([128+127*dx/len,128+127*dy/len,128+127/len,255],idx*4);
    }
    ctx.putImageData(p,0,0);const map=new T.CanvasTexture(c);
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;cache.set(key,map);return map;
  }
  function build(group,p,section,faces,raw,columns,allFaces,ground,facade,windowGlass){
    const target={type:'roof',sectionId:section.id};
    const envelope=RoofStudio.roofOwner?.(p,section)||(()=>{const e=(p.extensions||[]).find(e=>e.id===section.extensionId);return e?{x:e.x,z:e.z,w:e.w,d:e.d}:{x:0,z:0,w:p.w,d:p.d}})();
    const finish=p.roofFinish||'Металлочерепица';
    const soft=bituminous(finish);
    const sheet=p.top||'#405467';
    const reliefStrength=finish==='Металлочерепица'?(p.previewInteraction ? .75 : .18):.55;
    const make=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.7,side:T.DoubleSide,...extra});
    const mats={
      roof:make(sheet,{map:texture(finish),normalMap:finish==='Металлочерепица'&&!p.previewInteraction?null:sheetRelief(finish),normalScale:new T.Vector2(reliefStrength,reliefStrength),metalness:soft?.005:.28,roughness:soft?.94:.44}),
      cap:make(sheet,{metalness:soft?.005:.28,roughness:soft?.94:.43,...(soft?{map:texture(finish)}:{})}),
      fascia:make(p.fasciaColor||sheet,{metalness:.17}),
      gutter:make(p.gutterColor||'#454e55',{metalness:.36,roughness:.46}),
      cuff:make(new T.Color(p.gutterColor||'#454e55').lerp(new T.Color('#a4afb4'),.19),{metalness:.38,roughness:.4}),
      soffit:make(p.soffitColor||'#e8dfd0',{map:texture('Софит')}),
      gable:make(p.wall,{map:facade.map,normalMap:facade.normalMap,roughness:.93}),trim:make('#f3efeb'),shadow:make('#34434a')
    };
    const bags=new Map();
    mats.seams=mats.cap;
    function tri(name,a,b,c,uv){
      if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-16)return false;
      if(!bags.has(name))bags.set(name,{pos:[],uv:[]});
      const bag=bags.get(name);for(let x of [a,b,c])bag.pos.push(x.x,x.y,x.z);
      bag.uv.push(...(uv||[0,0,1,0,1,1]));
      return true;
    }
    function quad(k,a,b,c,d){tri(k,a,b,c);tri(k,a,c,d)}
    function cylinder(k,from,to,r,r2=r,segments=10){
      let axis=to.clone().sub(from);if(axis.lengthSq()<.000001)return;
      axis.normalize();const x=axis.clone().cross(Math.abs(axis.y)>.95?new T.Vector3(1,0,0):up).normalize(),z=axis.clone().cross(x).normalize();
      function ring(center,rad,i){let a=i*2*Math.PI/segments;return center.clone().addScaledVector(x,Math.cos(a)*rad).addScaledVector(z,Math.sin(a)*rad)}
      for(let i=0;i<segments;i++)quad(k,ring(from,r,i),ring(from,r,i+1),ring(to,r2,i+1),ring(to,r2,i));
    }
    function ribbon(k,a,b,offsets){
      const cross=new T.Vector3(-(b.z-a.z),0,b.x-a.x).normalize();
      const station=(q,[x,y])=>q.clone().addScaledVector(cross,x).addScaledVector(up,y);
      for(let i=1;i<offsets.length;i++)quad(k,station(a,offsets[i-1]),station(b,offsets[i-1]),station(b,offsets[i]),station(a,offsets[i]));
    }
    function clipFlat(poly,axis,limit,sign){
      const result=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(a[axis]-limit),db=sign*(b[axis]-limit);
        if(da>=-1e-8)result.push(a);
        if((da<0)!==(db<0))result.push(a.clone().lerp(b,da/(da-db)));
      }
      return result;
    }
    function raisedRoof(pts,flat,triangles,x,y,normal){
      if(p.previewInteraction)return false;
      const plane=normal.dot(pts[0]);
      const world=(a,h=0)=>x.clone().multiplyScalar(a.x).addScaledVector(y,a.y).addScaledVector(normal,plane+h);
      const bounds={minX:Math.min(...flat.map(a=>a.x)),maxX:Math.max(...flat.map(a=>a.x)),minY:Math.min(...flat.map(a=>a.y)),maxY:Math.max(...flat.map(a=>a.y))};
      if(finish==='Фальц'||finish==='Профнастил'){
        const spacing=finish==='Фальц'?.525:.13125;
        const profile=finish==='Фальц'?[[-.012,0],[-.006,.024],[-.0055,.029],[.004,.029],[.009,.024],[.012,0]]:[[-.01,0],[.017,.022],[.043,.022],[.065,0]];
        for(let at=Math.ceil(bounds.minX/spacing)*spacing;at<bounds.maxX;at+=spacing){
          for(const ids of triangles){
            const triangle=ids.map(i=>flat[i]);
            for(let j=1;j<profile.length;j++){
              const [left,h0]=profile[j-1],[right,h1]=profile[j];
              if(right-left<1e-7)continue;
              let piece=clipFlat(triangle,'x',at+left,1);piece=clipFlat(piece,'x',at+right,-1);
              if(piece.length<3)continue;
              const raised=piece.map(a=>world(a,h0+(h1-h0)*(a.x-at-left)/(right-left)+.001));
              for(let k=1;k<raised.length-1;k++)tri('seams',raised[0],raised[k],raised[k+1]);
            }
          }
        }
        return false;
      }
      if(finish!=='Металлочерепица')return false;
      mats.roofShadow??=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide});
      // A smooth backing casts the roof's shadow. The pressed relief receives
      // that shadow and keeps its own lighting normals; a 2 cm shadow texel
      // cannot resolve sub-centimetre steel folds without surface acne.
      for(const ids of triangles)tri('roofShadow',...ids.map(i=>pts[i]));
      // Actual pressed steel relief gives grazing light and the eave a physical
      // silhouette. The cell budget bounds work for exceptionally large roofs.
      const area=(bounds.maxX-bounds.minX)*(bounds.maxY-bounds.minY);
      const factor=Math.max(1,Math.ceil(area/(32000*.04375*.07)));
      // Sampling an integral number of stations per pressed pan avoids long
      // dark beating bands when interpolated vertex normals repeat over rows.
      const dx=.04375*factor;
      // Concentrate vertices around each transverse stamp. Uniform coarse
      // stations entirely missed the step and made the roof look like profiled sheet.
      const course=.35,steps=[0,.025,.05,.10,.20,.35];
      const relief=a=>tileProfile(a.x/1.05,a.y/1.4);
      const turns=flat.map((a,i)=>{const b=flat[(i+1)%flat.length],c=flat[(i+2)%flat.length];return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)}).filter(n=>Math.abs(n)>1e-8);
      // Mesh a convex roof patch as one surface. Artificial diagonal splits
      // would introduce extra interpolation stations and tiny specular seams.
      const regions=turns.every(n=>n*turns[0]>=0)?[turns[0]<0?flat.slice().reverse():flat]:triangles.map(ids=>ids.map(i=>flat[i]));
      for(const triangle of regions){
        const minX=Math.floor(Math.min(...triangle.map(a=>a.x))/dx),maxX=Math.ceil(Math.max(...triangle.map(a=>a.x))/dx);
        const minY=Math.floor(Math.min(...triangle.map(a=>a.y))/course),maxY=Math.ceil(Math.max(...triangle.map(a=>a.y))/course);
        for(let ix=minX;ix<maxX;ix++)for(let iy=minY;iy<maxY;iy++)for(let band=1;band<steps.length;band++){
          let piece=clipFlat(triangle,'x',ix*dx,1);piece=clipFlat(piece,'x',(ix+1)*dx,-1);
          piece=clipFlat(piece,'y',iy*course+steps[band-1],1);piece=clipFlat(piece,'y',iy*course+steps[band],-1);
          if(piece.length<3)continue;
          const positions=piece.map(a=>world(a,relief(a)));
          const normals=piece.map(a=>{
            const ex=.001,tx=(relief(new T.Vector2(a.x+ex,a.y))-relief(new T.Vector2(a.x-ex,a.y)))/(2*ex);
            const ty=(relief(new T.Vector2(a.x,a.y+ex))-relief(new T.Vector2(a.x,a.y-ex)))/(2*ex);
            return normal.clone().addScaledVector(x,-tx).addScaledVector(y,-ty).normalize();
          });
          for(let k=1;k<piece.length-1;k++){
            const indices=[0,k,k+1];if(!tri('roof',...indices.map(i=>positions[i]),indices.flatMap(i=>[piece[i].x/1.05,piece[i].y/1.4])))continue;
            const bag=bags.get('roof');bag.normals??=[];
            for(const i of indices)bag.normals.push(normals[i].x,normals[i].y,normals[i].z);
          }
        }
      }
      return true;
    }
    function skin(points,k,drop=0){
      const pts=points.map(a=>v(a).addScaledVector(up,-drop));
      let normal=new T.Vector3();
      for(let i=1;i<pts.length-1;i++){normal.copy(pts[i]).sub(pts[0]).cross(pts[i+1].clone().sub(pts[0]));if(normal.lengthSq()>1e-12)break}
      if(normal.lengthSq()<1e-12)return;normal.normalize();
      if(k==='roof'&&normal.y<0)normal.negate();
      const x=up.clone().cross(normal);if(x.lengthSq()<.0001)x.set(1,0,0);x.normalize();
      const y=normal.clone().cross(x).normalize();
      // Triangulate concave gables correctly using a local coordinate frame.
      const flat=pts.map(a=>new T.Vector2(a.dot(x),a.dot(y)));
      const triangles=T.ShapeUtils.triangulateShape(flat,[]);
      if(k==='roof'&&raisedRoof(pts,flat,triangles,x,y,normal))return;
      for(const ids of triangles){
        const dims=k==='soffit'?[.9,1.4]:[1.05,1.4];
        let uv=k==='gable'?ids.flatMap(i=>{const x=pts[i].x-envelope.x,z=pts[i].z-envelope.z;return [(Math.abs(normal.z)>.5?(Math.abs(z)<.001?envelope.w-x:x):(Math.abs(x-envelope.w)<.001?envelope.d-z:z))/facade.width,pts[i].y/facade.height]}):ids.flatMap(i=>[flat[i].x/dims[0],flat[i].y/dims[1]]);
        if(k==='gable'){
          const a=pts[ids[0]],b=pts[ids[1]],c=pts[ids[2]];
          const triNormal=b.clone().sub(a).cross(c.clone().sub(a));
          const radial=new T.Vector3(a.x-envelope.x-envelope.w/2,0,a.z-envelope.z-envelope.d/2);
          if(triNormal.dot(radial)<0){
            tri(k,a,c,b,[uv[0],uv[1],uv[4],uv[5],uv[2],uv[3]]);continue;
          }
        }
        tri(k,pts[ids[0]],pts[ids[1]],pts[ids[2]],uv);
      }
    }
    mats.dormerGlass=windowGlass;
    mats.dormerBacking=make('#484a48',{roughness:.97});
    mats.dormerReveal=make('#b3b3a9',{roughness:.89});
    mats.dormerMetal=make('#a0a6ab',{roughness:.40,metalness:.50});
    mats.dormerFrame=make('#30383a',{metalness:.33,roughness:.45});
    mats.ceiling=make('#eee9df',{roughness:.93});
    const dormerMaterial={glass:'dormerGlass',frame:'dormerFrame',backing:'dormerBacking',reveal:'dormerReveal',metal:'dormerMetal'};
    for(let face of faces){
      if(face.q.length<3)continue;
      skin(face.q,face.roof?'roof':dormerMaterial[face.detail]||'gable');
      if(face.roof){
        const liner=RoofStudio.lining(p,face,section);
        if(liner.ceiling.length)skin(liner.ceiling,'ceiling',RoofStudio.ceilingDepth);
        if(p.soffits!==false)for(const edge of liner.soffit)skin(edge,'soffit',RoofStudio.soffitDrop);
      }
    }
    const layout=PentiiRainwater.layout(p,{visible:allFaces});
    const fromHere=item=>item.sectionId===section.id;
    function edgeTrim(edge){
      const {a,b,out,type}=edge;
      if(type==='ridge'){
        const profile=[[-.14,-.022],[-.12,.007],[0,.065],[.12,.007],[.14,-.022]];
        ribbon('cap',a,b,profile);
        const span=a.distanceTo(b),axis=b.clone().sub(a).normalize();
        for(let distance=1.9;distance<span-.1;distance+=1.9){
          const start=a.clone().addScaledVector(axis,distance),end=start.clone().addScaledVector(axis,.04);
          ribbon('cap',start,end,profile.map(([x,y])=>[x,y+.003]));
        }
        return;
      }
      if(type==='valley'){ribbon('cap',a,b,[[-.13,.028],[-.035,.02],[0,.009],[.035,.02],[.13,.028]]);return}
      if(finish==='Металлочерепица'&&edge.drains){
        const span=a.distanceTo(b),alongX=Math.abs(a.x-b.x)>Math.abs(b.z-a.z),n=Math.ceil(span/.021);
        let oldTop,oldBottom;
        for(let i=0;i<=n;i++){
          const pt=a.clone().lerp(b,i/n),phase=(alongX?pt.x:pt.z)/1.05*12*Math.PI;
          const low=pt.clone().addScaledVector(out,.023).addScaledVector(up,-.012+(.5+.5*Math.cos(phase))**2.8*.016);
          const high=low.clone().addScaledVector(up,.014).addScaledVector(out,-.028);
          if(i)quad('cap',oldBottom,low,high,oldTop);
          oldTop=high;oldBottom=low;
        }
      }
      const fa=a.clone().addScaledVector(out,.018),fb=b.clone().addScaledVector(out,.018);
      const bottomA=fa.clone().addScaledVector(up,-.145),bottomB=fb.clone().addScaledVector(up,-.145);
      quad('fascia',fa,fb,bottomB,bottomA);
      quad('fascia',bottomA,bottomB,bottomB.clone().addScaledVector(out,-.021).addScaledVector(up,.008),bottomA.clone().addScaledVector(out,-.021).addScaledVector(up,.008));
      cylinder('cap',fa,fb,.016,.016,8);
    }
    for(const edge of layout.parts.filter(fromHere))edgeTrim(edge);
    const radius=layout.width/2;
    function trough(run){
      const {a,b,out}=run,axis=b.clone().sub(a),length=axis.length(),tangent=axis.clone().normalize();
      function ring(pt,angle,extra=0){
        return pt.clone().addScaledVector(out,radius+.029+(radius+extra)*Math.cos(angle)).addScaledVector(up,-.067-(radius+extra)*Math.sin(angle));
      }
      const pipeEnds=layout.pipes.filter(item=>item.run===run);
      function at(t){
        const pt=a.clone().lerp(b,t);
        const distance=pipeEnds.length?Math.min(...pipeEnds.map(item=>Math.hypot(pt.x-item.head.x,pt.z-item.head.z))):0;
        pt.y+=Math.min(.022,distance*.0025);return pt;
      }
      const stations=[0,1,...pipeEnds.map(pipe=>Math.max(0,Math.min(1,pipe.head.clone().sub(a).dot(tangent)/length)))];
      if(pipeEnds.length===2)stations.push((stations[2]+stations[3])*.5);
      stations.sort((x,y)=>x-y);
      for(let j=1;j<stations.length;j++){
        const start=at(stations[j-1]),end=at(stations[j]);
        if(start.distanceTo(end)<.002)continue;
        for(let i=0;i<14;i++){
          const u=Math.PI*i/14,w=Math.PI*(i+1)/14;
          quad('gutter',ring(start,u),ring(end,u),ring(end,w),ring(start,w));
        }
        for(const a of [0,Math.PI])cylinder('gutter',ring(start,a),ring(end,a),a===0?.009:.005);
      }
      // End caps and mounting hooks are actual meshes visible in a close view.
      for(const [which,sign] of [[0,-1],[1,1]]){
        const p=at(which),ctr=p.clone().addScaledVector(out,radius+.029).addScaledVector(up,-.067);
        for(let i=0;i<14;i++){
          let u=Math.PI*i/14,w=Math.PI*(i+1)/14;
          tri('cuff',ctr,ring(p,u),ring(p,w));
          const offset=tangent.clone().multiplyScalar(sign*.004);
          quad('cuff',ring(p,u),ring(p,w),ring(p,w,.005).add(offset),ring(p,u,.005).add(offset));
        }
      }
      for(let distance=.19;distance<length-.09;distance+=.66){
        const st=at(distance/length),end=st.clone().addScaledVector(tangent,.027);
        for(let i=0;i<10;i++){
          const u=Math.PI*i/10,w=Math.PI*(i+1)/10;
          quad('cuff',ring(st,u,.005),ring(end,u,.005),ring(end,w,.005),ring(st,w,.005));
        }
      }
    }
    for(const g of layout.gutters.filter(fromHere))trough(g);
    function downpipe(pipe){
      const {head,path,bands,seat}=pipe,r=pipe.radius;
      const center=path[0].clone().addScaledVector(up,.018),mouth=head.clone().addScaledVector(up,.014);
      if(pipe.run.collector){
        const out=pipe.run.out,tangent=out.clone().cross(up).normalize(),corners=[];
        for(const [dx,dz] of [[-1,-1],[-1,1],[1,1],[1,-1]])corners.push(
          mouth.clone().addScaledVector(tangent,dx*.16).addScaledVector(out,dz*.08).addScaledVector(up,.105));
        for(let i=0;i<4;i++){
          const a=corners[i],b=corners[(i+1)%4],A=a.clone().addScaledVector(up,-.105),B=b.clone().addScaledVector(up,-.105);
          quad('gutter',a,b,B,A);tri('gutter',A,B,center);cylinder('cuff',a,b,.008,.008,8);
        }
      }else cylinder('gutter',mouth,center,r*1.52,r*.99,20);
      cylinder('cuff',mouth,mouth.clone().addScaledVector(up,-.022),r*1.56,r*1.55,20);
      // Tangent elbows are swept through the offset bends with a consistently
      // oriented seam. Joining straight cylinders would leave gaps at each mitre.
      const pts=[path[0]];
      for(let j=1;j<path.length-1;j++){
        const prior=path[j-1],corner=path[j],next=path[j+1];
        const reach=Math.min(r*2.2,corner.distanceTo(prior)*.32,corner.distanceTo(next)*.35);
        const i=corner.clone().addScaledVector(prior.clone().sub(corner).normalize(),reach);
        const o=corner.clone().addScaledVector(next.clone().sub(corner).normalize(),reach);
        pts.push(i);const bend=new T.QuadraticBezierCurve3(i,corner,o);
        for(let k=1;k<=5;k++)pts.push(bend.getPoint(k/5));
      }
      pts.push(path.at(-1));
      const rings=[],reference=seat.out.clone().cross(up).normalize();
      for(let i=0;i<pts.length;i++){
        const t=pts[Math.min(pts.length-1,i+1)].clone().sub(pts[Math.max(0,i-1)]).normalize();
        let xx=reference.clone().addScaledVector(t,-reference.dot(t));
        if(xx.lengthSq()<.005)xx=up.clone().cross(t);
        xx.normalize();const zz=t.clone().cross(xx);
        const ring=[];
        for(let j=0;j<18;j++){const alpha=j*Math.PI/9;ring.push(pts[i].clone().addScaledVector(xx,r*Math.cos(alpha)).addScaledVector(zz,r*Math.sin(alpha)))}
        rings.push(ring);
      }
      for(let i=1;i<rings.length;i++)for(let j=0;j<18;j++)quad('gutter',rings[i-1][j],rings[i][j],rings[i][(j+1)%18],rings[i-1][(j+1)%18]);
      const toe=path.at(-1),toeAxis=toe.clone().sub(pts.at(-2)).normalize();
      cylinder('cuff',toe.clone().addScaledVector(toeAxis,-.018),toe,r*1.07,r*1.07,18);
      const inset=toe.clone().addScaledVector(toeAxis,-.035);
      const last=rings.at(-1);
      for(let j=0;j<18;j++)tri('shadow',inset,last[j].clone().addScaledVector(toeAxis,-.014),last[(j+1)%18].clone().addScaledVector(toeAxis,-.014));
      cylinder('cuff',center,center.clone().addScaledVector(up,-.028),r*1.07,r*1.07,18);
      if(pipe.sleeve){
        const c=pipe.sleeve;cylinder('cuff',c,c.clone().addScaledVector(up,.012),r*1.8,r*1.6,20);
        cylinder('gutter',c.clone().addScaledVector(up,.009),c.clone().addScaledVector(up,.042),r*1.48,r*1.02,20);
      }
      for(const {c,mount} of bands){
        const bottom=c.clone().addScaledVector(up,-.016),top=c.clone().addScaledVector(up,.016);
        cylinder('cuff',bottom,top,r*1.09,r*1.09,18);
        cylinder('cuff',mount,c,.012,.012,8);
        cylinder('cuff',mount,mount.clone().addScaledVector(seat.out,.014),r*.49,r*.49,12);
      }
    }
    for(const pipe of layout.pipes.filter(item=>fromHere(item.run)))downpipe(pipe);
    for(let [name,bag] of bags){
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(bag.pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(bag.uv,2));
      if(bag.normals?.length===bag.pos.length)geometry.setAttribute('normal',new T.Float32BufferAttribute(bag.normals,3));else geometry.computeVertexNormals();
      const m=new T.Mesh(geometry,mats[name]);m.castShadow=name!=='dormerGlass'&&!(name==='roof'&&finish==='Металлочерепица'&&!p.previewInteraction);m.receiveShadow=true;m.userData.target=target;m.name=name+' • '+section.name;
      if(name==='roofShadow'){m.receiveShadow=false;m.raycast=()=>{};}
      group.add(m);
    }
  }
  return {build,swatch:kind=>texture(kind).image.toDataURL('image/jpeg',.9),drainage:PentiiRainwater.layout,drainControls:PentiiRainwater.controls,elevationLayers:PentiiRainwater.elevationLayers};
})();

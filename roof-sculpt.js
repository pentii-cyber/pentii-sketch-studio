/* All dimensions in metres. Roof-attached details are stored in section-local
   coordinates, so translating or resizing a roof carries its details with it. */
window.RoofSculpt=(()=>{
  'use strict';
  const E=1e-8,clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  const id=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
  const lerp=(a,b,t)=>a.map((v,k)=>v+t*(b[k]-v));
  function cut(poly,d){
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=d(a),db=d(b);
      if(da>=-E)out.push(a);
      if((da>E&&db< -E)||(da< -E&&db>E))out.push(lerp(a,b,da/(da-db)));
    }
    return out;
  }
  const area=p=>Math.abs(p.reduce((a,v,i)=>{const n=p[(i+1)%p.length];return a+v[0]*n[2]-n[0]*v[2]},0))/2;
  function splitFootprint(poly,tests){
    let inside=poly;
    for(const test of tests){inside=cut(inside,test);if(area(inside)<E)return {inside:[],outside:[poly]}}
    const outside=[];let rest=poly;
    for(const test of tests){const part=cut(rest,q=>-test(q));if(area(part)>E)outside.push(part);rest=cut(rest,test);}
    return {outside,inside};
  }
  const boxTests=(l,r,b,f)=>[q=>q[0]-l,q=>r-q[0],q=>q[2]-b,q=>f-q[2]];
  const xz=(s,u,v)=>[s.x+s.w*u,s.z+s.d*v];
  const uv=(s,x,z)=>[clamp((x-s.x)/s.w,0,1),clamp((z-s.z)/s.d,0,1)];
  function localNodes(s){
    const pts=s.liftPoints||[];
    return pts.map(p=>{
      const [x,z]=xz(s,p.u,p.v);
      let radius=clamp(Math.min(s.w,s.d)*.44,.35,3.2);
      for(const o of pts)if(o.id!==p.id)radius=Math.min(radius,Math.max(.025,Math.max(Math.abs(p.u-o.u)*s.w,Math.abs(p.v-o.v)*s.d)*.96));
      return {...p,x,z,r:radius};
    });
  }
  function liftAt(nodes,x,z){
    return nodes.reduce((h,n)=>h+n.lift*Math.max(0,1-Math.max(Math.abs(x-n.x),Math.abs(z-n.z))/n.r),0);
  }
  function subdivide(faces,nodes){
    let pieces=faces;
    for(const n of nodes){
      const tests=boxTests(n.x-n.r,n.x+n.r,n.z-n.r,n.z+n.r);
      pieces=pieces.flatMap(old=>{
        const {inside,outside}=splitFootprint(old.q,tests);
        if(!inside.length)return [old];
        const parts=outside.slice();
        let cells=[inside];
        for(const fn of [q=>q[0]-n.x-(q[2]-n.z),q=>q[0]-n.x+(q[2]-n.z)]){
          cells=cells.flatMap(poly=>[cut(poly,fn),cut(poly,q=>-fn(q))].filter(q=>area(q)>E));
        }
        return parts.concat(cells).map(poly=>({...old,q:poly.map(([x,y,z])=>[x,y+n.lift*Math.max(0,1-Math.max(Math.abs(x-n.x),Math.abs(z-n.z))/n.r),z])}));
      });
    }
    return pieces;
  }
  function plane(face){
    const a=face.q[0];
    for(let i=1;i<face.q.length-1;i++){
      const b=face.q[i],c=face.q[i+1],x=b[0]-a[0],z=b[2]-a[2],xx=c[0]-a[0],zz=c[2]-a[2],det=x*zz-z*xx;
      if(Math.abs(det)<E)continue;
      const h=b[1]-a[1],hh=c[1]-a[1],gx=(h*zz-hh*z)/det,gz=(x*hh-xx*h)/det;
      return {gx,gz,y:(x,z)=>a[1]+(x-a[0])*gx+(z-a[2])*gz};
    }
  }
  function sample(faces,x,z){
    for(const face of faces){
      let pos=false,neg=false;
      for(let i=0;i<face.q.length;i++){
        const a=face.q[i],b=face.q[(i+1)%face.q.length],k=(b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]);
        pos||=k>E;neg||=k< -E;
      }
      if(!pos||!neg){const fn=plane(face);if(fn)return {...fn,height:fn.y(x,z)};}
    }
    return {gx:0,gz:0,height:0};
  }
  const dirs=[[0,1],[1,0],[0,-1],[-1,0]];
  function footprintTests(poly){
    const sign=Math.sign(poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a[0]*b[2]-b[0]*a[2]},0))||1;
    return poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return q=>sign*((b[0]-a[0])*(q[2]-a[2])-(b[2]-a[2])*(q[0]-a[0]))});
  }
  function triangleDormer(s,d,host,point,height,w,dep,cx,cz,bounds){
    const B=dep/2,frontFloor=Math.max(...[-.5,0,.5].map(k=>height(k*w,B)));
    const front=[point(-w/2,frontFloor,B),point(w/2,frontFloor,B),point(0,frontFloor+d.rise,B)];
    const rear=point(0,height(0,-B),-B);
    const face=(q,roof,detail)=>({q,roof,sectionId:s.id,dormerId:d.id,...(detail?{detail}:{})});
    const original=[face([front[0],rear,front[2]],true),face([rear,front[1],front[2]],true)];
    const roof=[],cutRegions=[];
    // A triangular lucarne joins the main roof along two valleys. Clip each
    // roof plane at the actual host surface, including when moved over a ridge.
    // Only the area covered by the new roof is removed from the host.
    for(const panel of original){
      const roofPlane=plane(panel),panelTests=footprintTests(panel.q);
      if(!roofPlane)continue;
      for(const part of host){
        const hostPlane=plane(part);if(!hostPlane)continue;
        const tests=[...panelTests,...footprintTests(part.q),q=>roofPlane.y(q[0],q[2])-hostPlane.y(q[0],q[2])];
        const inside=splitFootprint(part.q,tests).inside;
        if(area(inside)<E)continue;
        roof.push(face(inside.map(q=>[q[0],roofPlane.y(q[0],q[2]),q[2]]),true));
        cutRegions.push(tests);
      }
    }
    const cheeks=[],windows=[];
    const centre=front.reduce((c,q)=>c.map((v,i)=>v+q[i]/3),[0,0,0]);
    const opening=front.map(q=>lerp(centre,q,.68));
    const dx=dirs[d.direction][0],dz=dirs[d.direction][1];
    const shift=(q,offset)=>[q[0]+dx*offset,q[1],q[2]+dz*offset];
    for(let i=0;i<3;i++){
      const j=(i+1)%3;
      cheeks.push(face([front[i],front[j],opening[j],opening[i]],false));
      windows.push(face([opening[i],opening[j],shift(opening[j],-.20),shift(opening[i],-.20)],false,'reveal'));
    }
    windows.push(face(opening.map(q=>shift(q,-.20)),false,'backing'));
    windows.push(face(opening.map(q=>shift(q,-.075)),false,'glass'));
    const paneCentre=opening.reduce((c,q)=>c.map((v,i)=>v+q[i]/3),[0,0,0]);
    const inner=opening.map(q=>lerp(paneCentre,q,.90));
    for(let i=0;i<3;i++){
      const j=(i+1)%3;
      windows.push(face([opening[i],opening[j],inner[j],inner[i]].map(q=>shift(q,-.055)),false,'frame'));
    }
    // The sill follows the triangular opening's lower edge; the glass and
    // frame remain triangles rather than an opaque rectangular window patch.
    windows.push(face([shift(opening[0],.075),shift(opening[1],.075),shift(opening[1],-.045),shift(opening[0],-.045)],false,'metal'));
    const tests=footprintTests([front[0],front[1],rear]);
    return {tests,cutRegions,bounds,cx,cz,roof,cheeks,windows};
  }
  function dormerShape(s,d,host){
    const [dx,dz]=dirs[d.direction],tx=dz,tz=-dx;
    const w=Math.min(d.width,(dx?s.d:s.w)*.90),dep=Math.min(d.depth,(dx?s.w:s.d)*.90);
    const halfX=(dx?dep:w)/2,halfZ=(dx?w:dep)/2;
    let [cx,cz]=xz(s,d.u,d.v);
    cx=clamp(cx,s.x+halfX,s.x+s.w-halfX);cz=clamp(cz,s.z+halfZ,s.z+s.d-halfZ);
    const point=(a,y,b)=>[cx+tx*a+dx*b,y,cz+tz*a+dz*b];
    const height=(a,b)=>{const q=point(a,0,b);return sample(host,q[0],q[2]).height};
    const bounds={l:cx-halfX,r:cx+halfX,b:cz-halfZ,f:cz+halfZ};
    if(d.shape==='triangle')return triangleDormer(s,d,host,point,height,w,dep,cx,cz,bounds);
    const tests=boxTests(bounds.l,bounds.r,bounds.b,bounds.f);
    const footprint=host.map(f=>splitFootprint(f.q,tests).inside).filter(poly=>poly.length);
    const frontFloor=Math.max(...[-.5,0,.5].map(k=>height(k*w,dep/2)));
    const eave=Math.max(frontFloor+d.rise,...footprint.flatMap(poly=>poly.map(q=>q[1]+.10)));
    const top=a=>eave+(.5*w-Math.abs(a))*Math.tan(d.pitch*Math.PI/180);
    const face=(q,roof)=>({q,roof,sectionId:s.id,dormerId:d.id});
    const roof=[
      face([point(-w/2,eave,-dep/2),point(0,top(0),-dep/2),point(0,top(0),dep/2),point(-w/2,eave,dep/2)],true),
      face([point(0,top(0),-dep/2),point(w/2,eave,-dep/2),point(w/2,eave,dep/2),point(0,top(0),dep/2)],true)
    ];
    const cheeks=[];
    const corners=[[-w/2,-dep/2],[0,-dep/2],[w/2,-dep/2],[w/2,dep/2],[0,dep/2],[-w/2,dep/2]];
    const paneBottom=frontFloor+.12,paneTop=eave-.16,paneHalf=w*.32;
    const windows=[];
    // Trace the true intersection with every roof plane along each cheek.
    for(let i=0;i<corners.length;i++){
      const [a,b]=corners[i],[aa,bb]=corners[(i+1)%corners.length];
      const q0=point(a,0,b),q1=point(aa,0,bb),vx=q1[0]-q0[0],vz=q1[2]-q0[2],len=vx*vx+vz*vz;
      const splits=[0,1];
      for(const poly of footprint)for(const v of poly){
        if(Math.abs(vx*(v[2]-q0[2])-vz*(v[0]-q0[0]))>1e-5)continue;
        const t=((v[0]-q0[0])*vx+(v[2]-q0[2])*vz)/len;
        if(t>E&&t<1-E)splits.push(t);
      }
      const front=b===dep/2&&bb===b;
      if(front){for(const k of [-paneHalf,paneHalf]){const t=(k-a)/(aa-a);if(t>E&&t<1-E)splits.push(t)}}
      splits.sort((a,b)=>a-b);
      for(let j=1;j<splits.length;j++){
        const t=splits[j-1],tt=splits[j];if(tt-t<E)continue;
        const l=a+(aa-a)*t,r=a+(aa-a)*tt,k=b+(bb-b)*t,kk=b+(bb-b)*tt;
        const quad=(lo,hi,ll,hh)=>face([point(l,lo,k),point(r,ll,kk),point(r,hh,kk),point(l,hi,k)],false);
        if(front&&Math.abs((l+r)/2)<paneHalf-E){
          cheeks.push(quad(height(l,k)-.03,paneBottom,height(r,kk)-.03,paneBottom),quad(paneTop,top(l),paneTop,top(r)));
        }else cheeks.push(quad(height(l,k)-.03,top(l),height(r,kk)-.03,top(r)));
      }
    }
    function rect(left,bottom,right,upper,offset,kind){
      const b=dep/2+offset;
      windows.push({...face([point(left,bottom,b),point(right,bottom,b),point(right,upper,b),point(left,upper,b)],false),detail:kind});
    }
    // Tuck the glazing behind the plaster face. The reveal closes the cut
    // edge and the set-back attic wall gives transmitted light depth.
    const recess=-.075,back=-Math.min(.32,dep*.33),B=dep/2;
    rect(-paneHalf,paneBottom,paneHalf,paneTop,back,'backing');
    const rim=[[-paneHalf,paneBottom],[paneHalf,paneBottom],[paneHalf,paneTop],[-paneHalf,paneTop]];
    rim.forEach(([a,y],i)=>{
      const [aa,yy]=rim[(i+1)%rim.length];
      windows.push({...face([point(a,y,B),point(aa,yy,B),point(aa,yy,B+back),point(a,y,B+back)],false),detail:'reveal'});
    });
    rect(-paneHalf,paneBottom,paneHalf,paneTop,recess,'glass');
    const frame=Math.min(.055,w*.045);
    rect(-paneHalf,paneBottom,-paneHalf+frame,paneTop,recess+.019,'frame');rect(paneHalf-frame,paneBottom,paneHalf,paneTop,recess+.019,'frame');
    rect(-paneHalf,paneBottom,paneHalf,paneBottom+frame,recess+.019,'frame');rect(-paneHalf,paneTop-frame,paneHalf,paneTop,recess+.019,'frame');
    rect(-frame*.4,paneBottom,frame*.4,paneTop,recess+.02,'frame');rect(-paneHalf-.025,paneBottom-.018,paneHalf+.025,paneBottom+.014,.045,'frame');
    const grip=Math.min(.16,(paneTop-paneBottom)*.2),mid=(paneTop+paneBottom)/2;
    rect(.016,mid-grip/2,.043,mid+grip/2,recess+.031,'metal');
    rect(.028,mid+.012,.108,mid+.035,recess+.037,'metal');
    windows.push({...face([point(-paneHalf-.045,paneBottom-.018,B+.105),point(paneHalf+.045,paneBottom-.018,B+.105),
      point(paneHalf+.045,paneBottom+.002,B-.025),point(-paneHalf-.045,paneBottom+.002,B-.025)],false),detail:'metal'});
    return {tests,bounds,cx,cz,roof,cheeks,windows};
  }
  function build(s,primitives){
    const base=primitives.filter(f=>f.roof),nodes=localNodes(s),host=subdivide(base,nodes);
    const dormers=(s.dormers||[]).map(d=>dormerShape(s,d,host));
    let remaining=host;
    for(const d of dormers)for(const tests of d.cutRegions||[d.tests])remaining=remaining.flatMap(f=>splitFootprint(f.q,tests).outside.map(q=>({...f,q})));
    const roof=remaining.concat(dormers.flatMap(d=>d.roof));
    return {host,roof,dormers,nodes,base};
  }
  function boundsOverlap(a,b){
    return a.l<b.r+.035&&b.l<a.r+.035&&a.b<b.f+.035&&b.b<a.f+.035;
  }
  function validate(s,data){
    const points=s.liftPoints||[],ds=s.dormers||[];
    if(!Array.isArray(points)||!Array.isArray(ds)||points.length>24||ds.length>12)return 'На секции помещаются до 24 точек и 12 кукушек.';
    const ids=new Set();
    for(const point of points.concat(ds)){
      if(!point.id||ids.has(point.id)||![point.u,point.v].every(n=>Number.isFinite(n)&&n>=0&&n<=1))return 'Деталь должна находиться на выбранном скате.';
      ids.add(point.id);
    }
    if(points.some(k=>!Number.isFinite(k.lift)||Math.abs(k.lift)>6))return 'Подъём точки допускается в пределах 6 м.';
    if(ds.some(d=>d.shape!==undefined&&!['house','triangle'].includes(d.shape)))return 'Выберите форму кукушки: треугольная или домиком.';
    if(ds.some(d=>!Number.isInteger(d.direction)||d.direction<0||d.direction>3||![[d.width,.45,8],[d.depth,.45,8],[d.rise,.50,4],[d.pitch,10,65]].every(([n,l,h])=>Number.isFinite(n)&&n>=l&&n<=h)))return 'Проверьте размеры и уклон кукушки.';
    if(!points.length&&!ds.length)return '';
    const model=data();
    if(model.host.some(f=>f.q.some(q=>q[1]<.22)))return 'Точка кровли опускается ниже основания.';
    if(model.dormers.some((d,i)=>model.dormers.slice(i+1).some(k=>boundsOverlap(k.bounds,d.bounds))))return 'Кукушки пересекаются. Укажите свободное место.';
    return '';
  }
  function pointAt(s,x,z){
    const [u,v]=uv(s,x,z),near=s.liftPoints?.find(k=>Math.hypot((k.u-u)*s.w,(k.v-v)*s.d)<.14);
    return near||{u,v,id:id(),lift:0};
  }
  function dormerAt(s,x,z,data){
    const {gx,gz}=sample(data.host,x,z);
    const direction=Math.abs(gx)>Math.abs(gz)?gx>0?3:1:gz>0?2:0;
    const [u,v]=uv(s,x,z);
    return {id:id(),u,v,direction,shape:'house',width:Math.min(1.8,(direction%2?s.d:s.w)*.88),depth:Math.min(1.6,(direction%2?s.w:s.d)*.88),rise:1.2,pitch:35};
  }
  function trimFaces(s,data){
    const nodes=data.nodes;
    const out=data.base.map(f=>{
      if(!nodes.length)return f;
      const q=[];
      for(let i=0;i<f.q.length;i++){
        const a=f.q[i],b=f.q[(i+1)%f.q.length],ts=[0];
        for(const n of nodes){
          const l=(q)=>q[0]-n.x,k=q=>q[2]-n.z;
          for(const fn of [q=>l(q)-n.r,q=>l(q)+n.r,q=>k(q)-n.r,q=>k(q)+n.r,q=>l(q)-k(q),q=>l(q)+k(q)]){
            const aa=fn(a),bb=fn(b);if(aa*bb>=0)continue;const t=aa/(aa-bb),v=lerp(a,b,t);
            if(Math.max(Math.abs(l(v)),Math.abs(k(v)))<=n.r+E)ts.push(t);
          }
        }
        ts.sort((a,b)=>a-b);
        ts.forEach((t,j)=>{if(j&&t-ts[j-1]<E)return;const v=lerp(a,b,t);v[1]+=liftAt(nodes,v[0],v[2]);q.push(v);});
      }
      return {...f,q};
    });
    return out.concat(data.dormers.flatMap(d=>d.roof));
  }
  return {build,sample,validate,pointAt,dormerAt,trimFaces,xz,uv};
})();

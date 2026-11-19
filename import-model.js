/* Recognition output is a bounded geometric description, never executable code.
   Both the local API and the browser validate it before creating a new sketch. */
(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PentiiImportModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const eps=1e-6,round=n=>Math.round(n*1000)/1000,copy=o=>JSON.parse(JSON.stringify(o));
  const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
  const number=(minimum,maximum)=>({type:'number',minimum,maximum});
  const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
  const string=maxLength=>({type:'string',maxLength});
  const array=(items,maxItems)=>({type:'array',items,maxItems});
  const roof=object({type:integer(0,7),ridge:integer(0,1),pitch:number(2,65),e:number(0,2),parapet_height:number(0,1.5)});
  const opening=object({face:integer(0,3),x:number(0,35),w:number(.2,35),h:number(.2,6),sill:number(0,6),floor:integer(0,2),kind:integer(0,3)});
  const partition=object({a:number(0,35),b:number(0,35),c:number(0,35),d:number(0,35),floor:integer(0,2)});
  const part=object({name:string(64),x:number(-50,50),z:number(-50,50),w:number(.6,35),d:number(.6,35),h:number(2.2,6),n:integer(1,3),walls:{type:'boolean'},
    openings:array(opening,100),partitions:array(partition,100),roof:{anyOf:[roof,{type:'null'}]}});
  const schema=object({source_usable:{type:'boolean'},title:string(80),source_kind:{type:'string',enum:['plan','visualization']},scale_status:{type:'string',enum:['dimensioned','estimated','unknown']},
    summary:string(1600),assumptions:array(string(500),20),warnings:array(string(500),20),main:{anyOf:[part,{type:'null'}]},extensions:array(part,12),
    wall_color:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},roof_color:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'}});
  function schemaError(value,s,path='Результат'){
    if(s.anyOf)return s.anyOf.some(rule=>!schemaError(value,rule,path))?'':path+': неверный состав данных.';
    if(s.type==='null')return value===null?'':path+': ожидалось пустое значение.';
    if(s.type==='object'){
      if(!value||typeof value!=='object'||Array.isArray(value))return path+': ожидался объект.';
      for(const key of Object.keys(value))if(!Object.prototype.hasOwnProperty.call(s.properties,key))return path+': неизвестное поле '+key+'.';
      for(const key of s.required){if(!Object.prototype.hasOwnProperty.call(value,key))return path+': отсутствует поле '+key+'.';const error=schemaError(value[key],s.properties[key],path+'.'+key);if(error)return error;}
    }else if(s.type==='array'){
      if(!Array.isArray(value)||value.length>s.maxItems)return path+': слишком много элементов или неверный список.';
      for(let i=0;i<value.length;i++){const error=schemaError(value[i],s.items,path+'['+(i+1)+']');if(error)return error;}
    }else if(s.type==='number'||s.type==='integer'){
      if(!Number.isFinite(value)||(s.type==='integer'&&!Number.isInteger(value))||value<s.minimum||value>s.maximum)return path+': размер вне допустимого диапазона.';
    }else if(s.type==='string'){
      if(typeof value!=='string'||(s.maxLength!==undefined&&value.length>s.maxLength)||(s.enum&&!s.enum.includes(value))||(s.pattern&&!new RegExp(s.pattern).test(value)))return path+': неверный текст или значение.';
    }else if(s.type==='boolean'&&typeof value!=='boolean')return path+': ожидалось да или нет.';
    return '';
  }
  const partName=(p,i)=>p.name.trim()||(!i?'Основной дом':'Пристройка '+i);
  const parts=d=>[d.main,...d.extensions];
  const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>eps&&Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)>eps;
  const opOverlap=(a,b)=>a.face===b.face&&a.floor===b.floor&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>eps&&Math.min(a.sill+a.h,b.sill+b.h)-Math.max(a.sill,b.sill)>eps;
  function validate(d){
    const error=schemaError(d,schema);if(error)return error;
    if(!d.source_usable||d.main===null)return 'На изображении не удалось определить дом или планировку. Загрузите другой материал.';
    if(Math.abs(d.main.x)>eps||Math.abs(d.main.z)>eps||!d.main.walls)return 'Основная часть должна начинаться в X=0, Z=0 и иметь стены.';
    if(d.main.w<3||d.main.d<3)return 'Основная часть дома должна быть не меньше 3 × 3 м.';
    const all=parts(d);
    for(const [i,p] of all.entries()){
      const name=partName(p,i);
      if(!p.walls&&(p.openings.length||p.partitions.length||p.roof))return name+': для части только с полом нельзя создавать стены, проёмы или крышу.';
      if(p.roof&&p.roof.parapet_height>0&&(![2,3].includes(p.roof.type)||p.roof.parapet_height<.15))return name+': парапет высотой 0,15–1,5 м допустим на плоской или односкатной крыше.';
      for(const [j,o] of p.openings.entries()){
        const length=o.face%2?p.d:p.w;
        if(o.floor>=p.n||o.x+o.w>length+eps||o.sill+o.h>p.h+eps)return name+': проём '+(j+1)+' выходит за стену или этаж.';
        if(p.openings.slice(0,j).some(other=>opOverlap(o,other)))return name+': проёмы пересекаются. Уточните расположение окон и дверей.';
      }
      for(const w of p.partitions){
        if(w.floor>=p.n||Math.max(w.a,w.c)>p.w+eps||Math.max(w.b,w.d)>p.d+eps||Math.hypot(w.c-w.a,w.d-w.b)<.05)return name+': перегородка выходит за план или слишком короткая.';
      }
      if(all.slice(0,i).some(other=>overlap(p,other)))return name+': части дома перекрываются. Контур нужно разделить на непересекающиеся прямоугольники.';
    }
    return '';
  }
  function assertValid(d){const message=validate(d);if(message)throw new Error(message);}
  function rescale(description,width,depth){
    assertValid(description);
    const d=copy(description),w=width===undefined?d.main.w:Number(width),z=depth===undefined?d.main.d:Number(depth);
    if(!Number.isFinite(w)||!Number.isFinite(z)||w<3||w>35||z<3||z>35)throw new Error('Укажите ширину и глубину основной части от 3 до 35 м.');
    const sx=w/d.main.w,sz=z/d.main.d;
    for(const p of parts(d)){
      const old={x:p.x,z:p.z,w:p.w,d:p.d};
      p.x=round(old.x*sx);p.z=round(old.z*sz);
      p.w=round(round((old.x+old.w)*sx)-p.x);p.d=round(round((old.z+old.d)*sz)-p.z);
      const localX=p.w/old.w,localZ=p.d/old.d;
      for(const o of p.openings){const scale=o.face%2?localZ:localX,end=round((o.x+o.w)*scale);o.x=round(o.x*scale);o.w=round(end-o.x);}
      for(const wall of p.partitions){wall.a=round(wall.a*localX);wall.c=round(wall.c*localX);wall.b=round(wall.b*localZ);wall.d=round(wall.d*localZ);}
    }
    if(Math.abs(sx-1)>eps||Math.abs(sz-1)>eps){
      const note='Габариты плана уточнены вручную: основная часть '+w+' × '+z+' м. Высоты и свесы сохранены.';
      if(d.assumptions.length<20)d.assumptions.push(note);else d.assumptions[19]=note;
    }
    assertValid(d);return d;
  }
  function contacts(p,b,face){
    if(!b.walls)return null;
    const equal=(x,y)=>Math.abs(x-y)<eps;
    if(face===0&&equal(p.z+p.d,b.z))return {face:2,lo:Math.max(p.x,b.x),hi:Math.min(p.x+p.w,b.x+b.w)};
    if(face===1&&equal(p.x+p.w,b.x))return {face:3,lo:Math.max(p.z,b.z),hi:Math.min(p.z+p.d,b.z+b.d)};
    if(face===2&&equal(p.z,b.z+b.d))return {face:0,lo:Math.max(p.x,b.x),hi:Math.min(p.x+p.w,b.x+b.w)};
    if(face===3&&equal(p.x,b.x+b.w))return {face:1,lo:Math.max(p.z,b.z),hi:Math.min(p.z+p.d,b.z+b.d)};
    return null;
  }
  function openingInterval(p,o){
    return o.face===0?[p.x+o.x,p.x+o.x+o.w]:o.face===1?[p.z+p.d-o.x-o.w,p.z+p.d-o.x]:o.face===2?[p.x+p.w-o.x-o.w,p.x+p.w-o.x]:[p.z+o.x,p.z+o.x+o.w];
  }
  function placeSharedOpenings(d,notes){
    const all=parts(d);
    for(let i=1;i<all.length;i++){
      const p=all[i],keep=[];
      for(const o of p.openings){
        const [lo,hi]=openingInterval(p,o),bottom=o.floor*p.h+o.sill,top=bottom+o.h;
        let owner=null,mapped;
        for(let j=0;j<i;j++){
          const b=all[j],c=contacts(p,b,o.face);if(!c||c.hi-c.lo<eps||Math.min(hi,c.hi)-Math.max(lo,c.lo)<eps||bottom>=Math.min(p.h*p.n,b.h*b.n)-eps)continue;
          if(lo<c.lo-eps||hi>c.hi+eps||top>b.h*b.n+eps)throw new Error(partName(p,i)+': проём пересекает границу общей стены. Уточните его положение.');
          const floor=Math.floor((bottom+eps)/b.h),sill=round(bottom-floor*b.h);
          if(floor>=b.n||sill+o.h>b.h+eps)throw new Error(partName(p,i)+': проём в общей стене пересекает перекрытие соседней части.');
          const x=c.face===0?lo-b.x:c.face===1?b.z+b.d-hi:c.face===2?b.x+b.w-hi:lo-b.z;
          owner=b;mapped={...o,face:c.face,x:round(x),floor,sill};break;
        }
        if(!owner){keep.push(o);continue;}
        const duplicate=owner.openings.find(other=>opOverlap(other,mapped));
        if(duplicate){
          const same=['face','x','w','h','sill','floor','kind'].every(k=>Math.abs(duplicate[k]-mapped[k])<.002);
          if(!same)throw new Error('На общей стене распознаны пересекающиеся проёмы. Уточните планировку или положение двери.');
          notes.push('Совпадающий проём на общей стене «'+partName(p,i)+'» учтён один раз.');
        }else{
          owner.openings.push(mapped);
          notes.push('Проём между «'+partName(p,i)+'» и «'+partName(owner,all.indexOf(owner))+'» размещён в общей стене.');
        }
      }
      p.openings=keep;
    }
  }
  function summary(d){
    if(!d?.main)return '';
    const all=parts(d),openings=all.flatMap(p=>p.openings||[]),area=all.reduce((n,p)=>n+p.w*p.d*p.n,0);
    const fmt=n=>Number(n.toFixed(2)).toLocaleString('ru-RU');
    return fmt(d.main.w)+' × '+fmt(d.main.d)+' м · '+d.main.n+' эт. · '+fmt(area)+' м² · '+openings.filter(o=>o.kind<2).length+' окон · '+openings.filter(o=>o.kind>=2).length+' дверей'+(d.extensions.length?' · пристроек '+d.extensions.length:'');
  }
  let serial=0;
  const id=()=>root.crypto?.randomUUID?.()||'import-'+Date.now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2,8);
  function convert(description,options={}){
    assertValid(description);
    const d=(options.width!==undefined||options.depth!==undefined)?rescale(description,options.width,options.depth):copy(description);
    assertValid(d);
    const notes=[...d.warnings];
    if(d.scale_status!=='dimensioned')notes.push('Размеры '+(d.scale_status==='unknown'?'не удалось прочитать':'оценены по изображению')+'. Проверьте ширину, глубину и высоты перед использованием эскиза.');
    if(d.source_kind==='visualization')notes.push('Один внешний вид не показывает скрытые фасады и внутреннюю планировку. Проверьте не видимые на изображении стороны дома.');
    placeSharedOpenings(d,notes);assertValid(d);
    const main=d.main;
    const p={id:id(),name:d.title.trim()||'Дом по загруженному изображению',w:round(main.w),d:round(main.d),n:main.n,h:round(main.h),
      roof:main.roof?.type??0,ridge:main.roof?.ridge??0,pitch:main.roof?.pitch??30,e:main.roof?.e??.3,
      roofFinish:'Металлочерепица',wall:d.wall_color.toLowerCase(),top:d.roof_color.toLowerCase(),skin:'Короед',
      ops:[],walls:[],roofSections:[],extensions:[],interior:[],yard:[],
      structure:{foundation:'piles',pileType:'bored',wallSkin:'mixed',wallMm:167,floorSkin:'cement',atticType:'frame',view:'finish'}};
    const fill=(source,target)=>{
      target.ops=source.openings.map(o=>({id:id(),f:o.face,x:round(o.x),w:round(o.w),h:round(o.h),sill:round(o.sill),floor:o.floor,k:o.kind}));
      const walls=source.partitions.map(w=>({id:id(),floor:w.floor,a:round(w.a),b:round(w.b),c:round(w.c),d:round(w.d)}));
      if(target===p)target.walls=walls;else target.partitions=walls;
    };
    fill(main,p);
    const roofFor=(source,target,index)=>{
      if(!source.roof){if(source.walls)notes.push(partName(source,index)+': кровля на исходном изображении не определена. Добавьте её в редакторе.');return;}
      const r=source.roof,e=r.e,section={id:target===p?'main':id(),name:target===p?'Основная крыша':'Крыша · '+target.name,
        x:round(source.x-e),z:round(source.z-e),w:round(source.w+e*2),d:round(source.d+e*2),base:round(source.h*source.n),roof:r.type,ridge:r.ridge,pitch:r.pitch,canopy:false,posts:[]};
      if(target!==p){section.extensionId=target.id;section.followExtension=true;}
      if(r.parapet_height>0)section.parapet={height:round(r.parapet_height),thickness:.18};
      p.roofSections.push(section);
    };
    roofFor(main,p,0);
    for(const [index,source] of d.extensions.entries()){
      const e={id:id(),name:partName(source,index+1),x:round(source.x),z:round(source.z),w:round(source.w),d:round(source.d),h:round(source.h),n:source.n,walls:source.walls,ops:[],partitions:[],interior:[]};
      fill(source,e);p.extensions.push(e);roofFor(source,e,index+1);
    }
    const error=root.PentiiExtensions?.validate?.(p)||root.RoofStudio?.validate?.(p)||'';
    if(error)throw new Error(error);
    const warnings=[...new Set(notes)];
    p.importedFrom={kind:d.source_kind,scaleStatus:d.scale_status,summary:d.summary,assumptions:copy(d.assumptions),warnings:copy(warnings)};
    return {project:p,warnings,summary:summary(d)};
  }
  return {schema,validate,convert,rescale,summary};
});

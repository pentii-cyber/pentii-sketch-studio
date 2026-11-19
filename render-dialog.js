(()=>{
  'use strict';
  const dialog=$('renderBox'),img=$('renderPreview'),save=$('saveRender'),status=$('renderStatus'),views=$('renderViews');
  const width=1920,height=1200;
  let job=null,frames=[],active=0;
  function release(){
    for(const frame of frames)if(frame.url)URL.revokeObjectURL(frame.url);
    frames=[];views.replaceChildren();save.hidden=true;save.removeAttribute('href');img.removeAttribute('src');
  }
  function selectFrame(index){
    const frame=frames[index];
    if(!frame?.url)return;
    active=index;img.src=frame.url;img.alt=frame.label+' · '+frame.projectName;
    $('renderHeading').textContent=frame.label;
    save.href=frame.url;save.download=frame.projectName+' — '+frame.label+'.jpg';save.hidden=false;
    for(const [i,item] of frames.entries())item.button.setAttribute('aria-pressed',String(i===index));
  }
  function close(){
    if(!job){dialog.close();return}
    job.abort();status.textContent='Завершаем рендер…';
  }
  $('closeRender').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
  });
  dialog.addEventListener('close',()=>{job?.abort();release()});
  $('photoRender').onclick=async()=>{
    if(job)return;
    const ctl=new AbortController();job=ctl;
    const button=$('photoRender');button.disabled=true;release();active=0;
    const project=structuredClone(p);project.structure={...project.structure,view:'finish'};
    const angles=[
      [null,'Текущий ракурс'],['front','Главный фасад'],['side','Правый фасад'],
      ['rear','Задний фасад'],['left','Левый фасад'],['corner','Общий вид'],['top','Дом сверху']
    ];
    frames=angles.map(([preset,label],index)=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=true;
      b.dataset.renderView=preset||'current';b.setAttribute('aria-pressed','false');
      b.onclick=()=>selectFrame(index);views.append(b);
      return {preset,label,projectName:project.name,button:b,url:''};
    });
    $('renderHeading').textContent='Рендер дома';status.textContent='Подготавливаем все стороны дома…';dialog.showModal();
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      for(const [index,frame] of frames.entries()){
        if(ctl.signal.aborted)break;
        const blob=await StudioVolume.snapshot(project,{
          width,height,samples:8,final:true,current:!frame.preset,preset:frame.preset,blob:true,signal:ctl.signal,
          ...(frame.preset?{yardVisible:frame.preset==='corner'||frame.preset==='top'}:{}),
          onProgress:(step,total)=>{
            if(!ctl.signal.aborted)status.textContent='Вид '+(index+1)+' из '+frames.length+' · '+frame.label+' · '+Math.round(step/total*100)+' %';
          }
        });
        if(ctl.signal.aborted)break;
        if(!blob)throw Error('3D-модель недоступна.');
        frame.url=URL.createObjectURL(blob);frame.button.disabled=false;
        if(index===0)selectFrame(0);
      }
      if(!ctl.signal.aborted)status.textContent='Готово · 7 видов · '+width+' × '+height+' пикселей каждый';
    }catch(error){
      if(!ctl.signal.aborted)status.textContent='Рендер остановлен. '+(error.message||'Закройте окно и повторите.');
    }finally{
      job=null;button.disabled=false;
      if(ctl.signal.aborted&&dialog.open)dialog.close();
    }
  };
})();

/* Final-frame rendering. The editable Three.js meshes are the only source of house
   geometry. Each pass samples a different part of the sun and subpixel footprint. */
window.StudioFilm=(()=>{
  'use strict';
  const T=window.THREE;
  const vertex='varying vec2 uvFrame; void main(){uvFrame=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const accumulate=`
    varying vec2 uvFrame;
    uniform sampler2D frameColor, frameDepth, previous;
    uniform vec2 planeSize;
    uniform float weight,clipRange,angle,nearClip,farClip,perspectiveFrame;
    float eyeDepth(float z){
      if(perspectiveFrame>.5)return nearClip*farClip/(farClip-z*clipRange);
      return nearClip+z*clipRange;
    }
    void main(){
      vec3 linearLight=texture2D(frameColor,uvFrame).rgb;
      float z=texture2D(frameDepth,uvFrame).r;
      // Depth differences are linear for an orthographic camera. Sample neighbours
      // in model metres and fade across silhouettes to avoid dark outlines in sky.
      float occlusion=0.0;
      if(z<0.99999){
        for(int i=0;i<20;i++){
          float u=(float(i)+0.5)/20.0;
          float a=2.3999632*float(i)+angle;
          float r=0.032+0.55*u;
          vec2 metreSpan=planeSize*(perspectiveFrame>.5?eyeDepth(z):1.0);
          vec2 ofs=vec2(cos(a),sin(a))*r/metreSpan;
          float nearZ=texture2D(frameDepth,uvFrame+ofs).r;
          float farZ=texture2D(frameDepth,uvFrame-ofs).r;
          float d=eyeDepth(z)-eyeDepth(nearZ);
          float back=eyeDepth(farZ)-eyeDepth(z);
          float crease=d-clamp(back,0.0,d>0.0?d:0.0);
          float capture=smoothstep(.018,.08,crease)*(1.0-smoothstep(.30,.92,d));
          occlusion+=capture*(1.0-.44*u);
        }
      }
      linearLight*=1.0-0.42*occlusion/20.0;
      gl_FragColor=vec4(mix(texture2D(previous,uvFrame).rgb,linearLight,weight),1.0);
    }`;
  const develop=`
    varying vec2 uvFrame;uniform sampler2D film;
    uniform float exposure;
    vec3 rrt(vec3 x){vec3 a=x*(x+.0245786)-.000090537;vec3 b=x*(.983729*x+.432951)+.238081;return a/b;}
    void main(){
      mat3 im=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
      mat3 om=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
      vec3 rgb=clamp(om*rrt(im*(texture2D(film,uvFrame).rgb*exposure/.6)),0.,1.);
      rgb=mix(rgb*12.92,1.055*pow(rgb,vec3(1./2.4))-.055,step(vec3(.0031308),rgb));
      gl_FragColor=vec4(rgb,1.);
    }`;
  function halton(n,base){
    let f=1,value=0;
    while(n){f/=base;value+=f*(n%base);n=Math.floor(n/base);}
    return value;
  }
  function nextFrame(){return new Promise(resolve=>setTimeout(resolve,0))}
  async function capture(renderer,scene,source,sun,opts){
    const {width,height,samples,signal,onProgress}=opts;
    const fp=renderer.extensions.has('EXT_color_buffer_float');
    const orig=renderer.getRenderTarget(),type=fp?T.HalfFloatType:T.UnsignedByteType;
    const rt=(depth=false,byte=false)=>new T.WebGLRenderTarget(width,height,{
      type:byte?T.UnsignedByteType:type,depthBuffer:depth,stencilBuffer:false,
      minFilter:T.NearestFilter,magFilter:T.NearestFilter,generateMipmaps:false
    });
    const camera=source.clone(),main=rt(true),a=rt(),b=rt(),out=rt(false,true);
    const originalShadow={map:sun.shadow.map,size:sun.shadow.mapSize.clone(),bias:sun.shadow.bias};
    const shadowResolution=Math.min(4096,renderer.capabilities.maxTextureSize);
    const refineShadows=width>=1200&&shadowResolution>sun.shadow.mapSize.x;
    if(refineShadows){
      sun.shadow.map=null;sun.shadow.mapSize.set(shadowResolution,shadowResolution);sun.shadow.bias=-.00006;
    }
    main.depthTexture=new T.DepthTexture(width,height,T.UnsignedIntType);
    const screen=new T.Scene(),flat=new T.OrthographicCamera(-1,1,1,-1,0,1);
    const sunPos=sun.position.clone(),toward=sunPos.clone().sub(sun.target.position);
    const right=toward.clone().cross(new T.Vector3(0,1,0)).normalize();
    const up=right.clone().cross(toward).normalize();
    const radius=toward.length()*0.022;
    const isPhoto=!!source.isPerspectiveCamera;
    const filmHeight=isPhoto?2*Math.tan(source.fov*Math.PI/360)/source.zoom:(source.top-source.bottom);
    const originalView=source.view?.enabled?source.view:null;
    const blend=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:accumulate,depthTest:false,depthWrite:false,
      uniforms:{frameColor:{value:main.texture},frameDepth:{value:main.depthTexture},previous:{value:a.texture},
        weight:{value:1},clipRange:{value:camera.far-camera.near},planeSize:{value:new T.Vector2(filmHeight*width/height,filmHeight)},perspectiveFrame:{value:+isPhoto},nearClip:{value:camera.near},farClip:{value:camera.far},angle:{value:0}}});
    const output=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:develop,depthTest:false,depthWrite:false,
      uniforms:{film:{value:a.texture},exposure:{value:renderer.toneMappingExposure}}});
    const quad=new T.Mesh(new T.PlaneGeometry(2,2),blend);quad.frustumCulled=false;screen.add(quad);
    let read=a,write=b;
    try{
      renderer.setRenderTarget(read);renderer.clear();
      for(let i=0;i<samples;i++){
        if(signal?.aborted)throw new DOMException('Рендер закрыт','AbortError');
        const r=radius*Math.sqrt((i+.5)/samples),theta=i*2.3999632;
        sun.position.copy(sunPos).addScaledVector(right,r*Math.cos(theta)).addScaledVector(up,r*Math.sin(theta));
        camera.setViewOffset(width,height,(originalView?.offsetX||0)+halton(i+1,2)-.5,(originalView?.offsetY||0)+halton(i+1,3)-.5,width,height);
        renderer.setRenderTarget(main);renderer.render(scene,camera);
        sun.position.copy(sunPos);
        blend.uniforms.previous.value=read.texture;blend.uniforms.weight.value=1/(i+1);blend.uniforms.angle.value=theta;
        renderer.setRenderTarget(write);renderer.render(screen,flat);[read,write]=[write,read];
        renderer.setRenderTarget(orig);onProgress?.(i+1,samples);
        await nextFrame();
      }
      quad.material=output;output.uniforms.film.value=read.texture;
      renderer.setRenderTarget(out);renderer.render(screen,flat);
      const bytes=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(out,0,0,width,height,bytes);
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height),stride=width*4;
      for(let i=0;i<height;i++)data.data.set(bytes.subarray((height-i-1)*stride,(height-i)*stride),i*stride);
      ctx.putImageData(data,0,0);
      try{
        return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Браузеру не хватило памяти для изображения.')),'image/jpeg',.96));
      }finally{canvas.width=canvas.height=1;}
    }finally{
      sun.position.copy(sunPos);renderer.setRenderTarget(orig);
      if(refineShadows){
        sun.shadow.map?.dispose();sun.shadow.map=originalShadow.map;
        sun.shadow.mapSize.copy(originalShadow.size);sun.shadow.bias=originalShadow.bias;
      }
      for(const target of [main,a,b,out])target.dispose();
      quad.geometry.dispose();blend.dispose();output.dispose();
    }
  }
  return {capture};
})();

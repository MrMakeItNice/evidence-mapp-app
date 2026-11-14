import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped event handlers and animation, without requiring a GPU.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf(' globe.rotation.y=.35;globe.rotation.x=.13;');
const end=html.indexOf('\n}catch(e){',begin);
assert.ok(begin>0&&end>begin,'Globe controls must be present');
function setup({width=358,height=351,compact=true,reduced=false}={}){
 const handlers=new Map(),windowHandlers=new Map(),buttons=new Map();let inspections=0,rendered=0;
 const document={activeElement:null,getElementById(id){if(!buttons.has(id))buttons.set(id,{addEventListener(type,fn){this[type]=fn}});return buttons.get(id)}};
 const canvas={dataset:{},clientWidth:width,clientHeight:height,
  getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight}},
  addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn)},
  setPointerCapture(){},focus(options){assert.equal(options.preventScroll,true);document.activeElement=this}
 };
 const camera={fov:37,aspect:width/height,position:{z:8.5},updateProjectionMatrix(){}};
 const globe={rotation:{x:0,y:0}};
 const context={canvas,camera,globe,document,Math,Map,
  window:{addEventListener(type,fn){windowHandlers.set(type,fn)}},
  matchMedia:query=>({matches:query.includes('max-width')?compact:reduced}),
  ResizeObserver:class{observe(){}},requestAnimationFrame(){},scene:{},
  renderer:{setSize(){},render(){rendered++}},mouse:{set(){}},markerMeshes:[],earth:{},geoPanel:{},
  raycaster:{setFromCamera(){inspections++},intersectObjects(){return []},intersectObject(){return []}}
 };
 const api=vm.runInNewContext(html.slice(begin,end)+`;({
  read:()=>({zoom,targetX,targetY,minZoom,maxZoom,userInteracted,active:gestures.isInteracting()}),
  frame:animate,resize
 })`,context);
 const emit=(type,id,x,y,extra={})=>{
  const event={type,pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0,cancelable:true,preventDefault(){},...extra};
  for(const fn of handlers.get(type)||[])fn(event);
 };
 const release=(id,x,y)=>{emit('pointerup',id,x,y);emit('lostpointercapture',id,x,y)};
 return {...api,canvas,camera,globe,emit,release,click:id=>buttons.get(id).click(),
  blur:()=>windowHandlers.get('blur')(),inspections:()=>inspections,renders:()=>rendered};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} should equal ${b}`);

// A tap tolerates finger jitter and inspects exactly once; a drag never inspects.
let app=setup(),before=app.read();
app.emit('pointerdown',1,100,100);app.emit('pointermove',1,102,101);
close(app.read().targetY,before.targetY);app.release(1,102,101);
assert.equal(app.inspections(),1);assert.equal(app.read().active,false);
app.emit('pointerdown',2,100,100);app.emit('pointermove',2,220,150);
assert.ok(app.read().targetY-before.targetY>1,'A finger swipe must rotate visibly');
app.frame();close(app.globe.rotation.y,app.read().targetY);
app.release(2,220,150);assert.equal(app.inspections(),1);
before=app.read();for(let i=0;i<10;i++)app.frame();
close(app.read().targetY,before.targetY);assert.ok(app.renders()>10);

// Pinch outward zooms in; lifting either finger resumes drag without a jump or tap.
for(const lifted of [1,2]){
 app=setup();before=app.read();
 app.emit('pointerdown',1,100,100);app.emit('pointerdown',2,200,100);
 app.emit('pointermove',2,240,100);assert.ok(app.read().zoom<before.zoom);
 app.release(lifted,lifted===1?100:240,100);
 close(app.read().targetY,before.targetY);
 const remaining=lifted===1?2:1,x=remaining===1?100:240;
 app.emit('pointermove',remaining,x+20,110);
 const delta=20*Math.PI/Math.min(app.canvas.clientWidth,app.canvas.clientHeight);
 close(app.read().targetY-before.targetY,delta);
 app.release(remaining,x+20,110);assert.equal(app.inspections(),0);
 assert.equal(app.read().active,false);
}

// Extra fingers, lost capture, cancellation and app switching cannot strand input.
app=setup();app.emit('pointerdown',1,50,50);app.emit('pointerdown',2,150,50);
app.emit('pointerdown',3,250,50);before=app.read();
app.emit('pointermove',1,70,80);close(app.read().targetY,before.targetY);
app.emit('pointercancel',3,250,50);app.emit('pointermove',2,170,50);
assert.notEqual(app.read().zoom,before.zoom);
app.emit('lostpointercapture',1,70,80);before=app.read();
app.emit('pointermove',2,180,60);assert.notEqual(app.read().targetY,before.targetY);
app.blur();assert.equal(app.read().active,false);app.release(2,180,60);
assert.equal(app.inspections(),0);
app.emit('pointerdown',4,100,100);app.emit('pointercancel',4,100,100);
assert.equal(app.read().active,false);assert.equal(app.inspections(),0);
app.emit('pointerdown',5,100,100);app.release(5,100,100);assert.equal(app.inspections(),1);
app.emit('pointerdown',6,100,100,{pointerType:'mouse',button:2});
assert.equal(app.read().active,false);
app.emit('pointerdown',7,100,100);app.release(7,180,100);
assert.equal(app.inspections(),1,'A quick swipe without an intermediate move must not inspect');

// Zoom limits, pole access, keyboard controls, resize and reset remain usable.
app=setup();for(let i=0;i<80;i++)app.click('globe-in');close(app.read().zoom,app.read().minZoom);
for(let i=0;i<80;i++)app.click('globe-out');close(app.read().zoom,app.read().maxZoom);
app.emit('pointerdown',1,100,100);app.emit('pointermove',1,100,10000);
close(app.read().targetX,Math.PI/2);app.release(1,100,10000);
app.emit('keydown',0,0,0,{key:'ArrowLeft'});before=app.read();
app.emit('keydown',0,0,0,{key:'ArrowRight'});close(app.read().targetY,before.targetY+.18);
app.canvas.clientWidth=600;app.canvas.clientHeight=400;app.resize();
assert.ok(app.read().zoom>=app.read().minZoom&&app.read().zoom<=app.read().maxZoom);
app.emit('keydown',0,0,0,{key:'Home'});close(app.read().targetX,.13);close(app.read().targetY,.35);
assert.equal(app.read().userInteracted,false);before=app.read();app.frame();
assert.ok(app.read().targetY>before.targetY);
app.click('globe-reset');assert.equal(app.canvas.dataset.userZoom,undefined);

// Default mobile size fills 72% of the smaller dimension, without clipping.
for(const [width,height] of [[288,288],[358,351],[736,480]]){
 app=setup({width,height});const radius=1.595*.72;
 const tangent=Math.tan(app.camera.fov*Math.PI/360)*Math.min(1,app.camera.aspect);
 const projected=radius/Math.sqrt(app.camera.position.z**2-radius**2)/tangent;
 close(projected,.72);assert.ok(app.read().zoom>app.read().minZoom);
}
app=setup({compact:false,width:1440,height:690});close(app.read().zoom,8.5);
app=setup({reduced:true});before=app.read();app.frame();close(app.read().targetY,before.targetY);
console.log('PASS: taps, responsive dragging, pinch-to-drag for either finger, extra fingers, lost capture, cancellation, blur, zoom bounds, keyboard, reset, responsive fit and reduced motion.');

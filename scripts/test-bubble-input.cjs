const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const page=fs.readFileSync(require('node:path').join(__dirname,'../cloud.html'),'utf8');
const code=page.slice(page.indexOf('  function releaseAllPointers'),page.indexOf('  function openModal'));
const events={},classes=new Set(['dragging']);let frames=0,steps=0,modal=false,fail=false;
const node={dragging:true,pointerId:1,hover:true,moved:true,holdUntil:9999999999999,el:{classList:{remove:c=>classes.delete(c)},style:{}}};
const context={nodes:[node],clearTimeout(){},setTimeout(){},window:{addEventListener:(k,f)=>events[k]=f},document:{hidden:false,addEventListener:(k,f)=>events[k]=f,querySelector:()=>modal?{}:null},stage:{dataset:{},clientWidth:900,clientHeight:642,addEventListener:(k,f)=>events[k]=f},running:false,lastTime:0,gravityX:0,gravityY:95,requestAnimationFrame(){frames++},console:{error(){}},BubblePhysics:{step(){steps++;if(fail)throw Error('test')}}};vm.createContext(context);vm.runInContext(code,context);
for(const event of ['pointerup','pointercancel','blur','lostpointercapture']){node.dragging=node.hover=true;node.pointerId=1;classes.add('dragging');events[event]({});assert.equal(node.dragging,false);assert.equal(node.hover,false);assert.equal(node.pointerId,null);assert.equal(node.holdUntil,0);assert(!classes.has('dragging'))}
node.dragging=node.hover=true;events.pointermove({pointerType:'mouse',buttons:0});assert.equal(node.hover,false);
node.dragging=node.hover=true;context.document.hidden=true;events.visibilitychange();assert.equal(node.dragging,false);
context.tick(16);assert.equal(steps,1,'stale running=false must recover without a visible modal');assert.equal(frames,1);
modal=true;context.tick(32);assert.equal(steps,1);assert.equal(frames,2);
modal=false;fail=true;context.tick(48);assert.equal(frames,3,'a failing frame must still schedule its successor');fail=false;context.tick(64);assert.equal(steps,3);
console.log('PASS lost capture/up, cancel, blur, mouse button release, visibility, modal recovery and RAF error continuation');

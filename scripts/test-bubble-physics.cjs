const assert=require('node:assert/strict'),P=require('../bubble-physics.js');
const world={width:900,ground:500,gravityX:0,gravityY:95};
const ball=(x,y,vx=0,vy=0)=>({x,y,vx,vy,hover:false});
function simulate(nodes,seconds,w=world,hz=60){for(let i=0;i<seconds*hz;i++)P.step(nodes,1/hz,w)}
for(const hz of [30,60,120]){
 const n=ball(300,40,5);simulate([n],40,world,hz);assert.equal(n.sleeping,true);assert.equal(n.vy,0);assert.equal(n.y,500);
 const before=[n.x,n.y];simulate([n],10,world,hz);assert.deepEqual([n.x,n.y],before);
 n.vy=-150;P.step([n],1/hz,world);assert.equal(n.sleeping,false);assert(n.y<500);
}
const stack=[ball(300,500),ball(300,400),ball(300,300)];simulate(stack,40);
assert(stack.every(n=>n.sleeping));const still=stack.map(n=>[n.x,n.y]);simulate(stack,10);assert.deepEqual(stack.map(n=>[n.x,n.y]),still);
stack[0].hover=true;stack[0].x=650;P.step(stack,1/60,world);assert.equal(stack[1].sleeping,false);
const n=ball(300,500);simulate([n],2);P.step([n],1/60,{...world,gravityX:100});assert.equal(n.sleeping,false);assert(n.x>300);
const pair=[ball(300,500),ball(300,200,0,220)];simulate(pair,15);assert(pair.every(n=>n.sleeping));assert(pair[1].y<pair[0].y);
const denseWorld={...world,width:1400,ground:850},dense=Array.from({length:52},(_,i)=>ball(10+(i%8)*95,10+Math.floor(i/8)*90));simulate(dense,90,denseWorld);
assert(dense.every(n=>n.sleeping));const snapshot=dense.map(n=>[n.x,n.y]);simulate(dense,10,denseWorld);assert.deepEqual(dense.map(n=>[n.x,n.y]),snapshot);
assert(dense.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.y<=denseWorld.ground));
console.log('PASS floor rest at 30/60/120Hz, stack rest, support removal, impulse and tilt wake, dense 52 bubble rest');
// A circle on one side of another must roll away, not sleep on the slope.
for(const side of [-1,1]){
 const base=ball(400,500),upper=ball(400+side*40,500-Math.sqrt(10000-1600));
 simulate([base,upper],12);assert(Math.abs(upper.x-base.x)>98,'sloping contact should roll to the side');assert(upper.y>498);
}
const dragged=ball(400,500);simulate([dragged],2);dragged.hover=true;dragged.x=500;dragged.y=150;P.step([dragged],1/60,world);assert.equal(dragged.sleeping,false);dragged.hover=false;P.step([dragged],1/60,world);assert(dragged.y>150,'released drag must resume falling');
const fs=require('node:fs'),page=fs.readFileSync(require('node:path').join(__dirname,'../cloud.html'),'utf8');
assert(!page.includes("mouseenter',()=>n.hover=true"),'mouse hover must not freeze physics');
assert(!page.includes("n.hover=e.pointerType==='mouse'"),'mouse release must not leave drag locked');
console.log('PASS left/right rolling, sleeping drag release and non-freezing mouse handlers');
const orphan=ball(300,100);Object.assign(orphan,{pointerId:null,hover:true,dragging:false});simulate([orphan],1);assert.equal(orphan.hover,false);assert(orphan.y>100);
const expired=ball(300,100);Object.assign(expired,{pointerId:null,hover:true,dragging:false,holdUntil:Date.now()-1});simulate([expired],1);assert(expired.y>100);
console.log('PASS orphan drag hover and expired search hold recovery');

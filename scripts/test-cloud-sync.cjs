const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../d1-cloud.js'), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const initial = {version:2,activeClass:'测试班',classes:{'测试班':{className:'测试班',students:[{id:'s1',studentNo:'01',name:'测试学生',score:0}],logs:[],attendance:[],settings:{},updatedAt:1}}};
function element(){const classes = new Set();return {value:'',style:{},textContent:'',className:'',disabled:false,classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),toggle:()=>{},contains:v=>classes.has(v)},addEventListener(){},setAttribute(){}};}
async function settle(){for(let i=0;i<35;i++)await Promise.resolve();}
function boot(server, storage = new Map(), teacherId='teacher-a') {
  const elements=new Map(), timers=new Map(), events=new Map();let timerId=0;
  let current=copy(initial.classes['测试班']);
  const context={window:null,document:{querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},addEventListener(name,fn){events.set(name,fn)}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},location:{hostname:'localhost'},navigator:{},setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),Date,Blob,URL,alert(){},toast(){},console,addEventListener(name,fn){events.set(name,fn)},classroomCloudBridge:{getData:()=>current,setData:value=>{current=copy(value)}}};
  context.window=context;
  context.fetch=async (url,options)=>{
    if(url==='/api/auth/session')return {ok:true,json:async()=>({teacher:{id:teacherId,employeeNo:teacherId}})};
    if(url==='/api/workspace'&&options.method==='PUT'){
      const body=JSON.parse(options.body);server.attempts++;
      if(server.fail)throw new Error('模拟断网');
      if(server.defer){await server.defer;server.defer=null;}
      if(body.expectedUpdatedAt!==server.revision)return {ok:false,status:409,json:async()=>({error:'云端已变化'})};
      server.payload=copy(body.payload);server.revision='revision-'+(++server.writes);
      return {ok:true,json:async()=>({ok:true,updatedAt:server.revision})};
    }
    if(url==='/api/workspace')return {ok:true,json:async()=>({payload:copy(server.payload),updatedAt:server.revision})};
    throw Error('Unexpected URL: '+url);
  };
  vm.runInNewContext(source,context);
  return {context,storage,elements,events,get data(){return current},async ready(){await settle()},async timer(ms){const entry=[...timers.entries()].find(([,v])=>v.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);await entry[1].fn();await settle()},change(){current=copy(current);current.students[0].score++;current.logs.unshift({id:'log-'+current.students[0].score,studentId:'s1',delta:1});current.updatedAt=Date.now();context.cloudDataChanged(current);return copy(current)}};
}
function server(){return {payload:copy(initial),revision:'revision-0',writes:0,attempts:0,fail:false};}
(async()=>{
  // Refresh before the debounce: the outbox is written synchronously.
  let s=server(),a=boot(s);await a.ready();a.change();
  assert.ok(a.storage.has('teacherCloudPending:teacher-a'));
  let b=boot(s,a.storage);await b.ready();assert.equal(b.data.logs.length,1);await b.timer(0);
  assert.equal(s.payload.classes['测试班'].students[0].score,1);assert.equal(s.payload.classes['测试班'].logs.length,1);assert.equal(b.storage.size,0);
  // Failed saves retain score + history across a reload, then retry on reconnect.
  s=server();a=boot(s);await a.ready();s.fail=true;a.change();await a.timer(180);
  b=boot(s,a.storage);await b.ready();assert.equal(b.data.logs.length,1);s.fail=false;await b.timer(0);assert.equal(s.writes,1);
  // Another edit during an in-flight request keeps the newest outbox until both ACKs.
  s=server();a=boot(s);await a.ready();a.change();let resolve;s.defer=new Promise(r=>resolve=r);
  const inFlight=a.timer(180);await settle();a.change();resolve();await inFlight;
  assert.equal(s.payload.classes['测试班'].logs.length,2);assert.equal(s.writes,2);assert.equal(a.storage.size,0);
  // A different device's newer revision is never silently overwritten.
  s=server();a=boot(s);await a.ready();a.change();s.revision='other-device';
  b=boot(s,a.storage);await b.ready();assert.equal(s.writes,0);assert.equal(b.data.logs.length,1);assert.ok(b.storage.has('teacherCloudPending:teacher-a'));
  assert.match(b.elements.get('#cloudState').textContent,/冲突/);
  b.change();await b.timer(180);assert.equal(s.writes,0);
  // A different teacher cannot replay another teacher's outbox.
  const other=boot(s,a.storage,'teacher-b');await other.ready();assert.equal(other.data.logs.length,0);assert.equal(s.writes,0);
  console.log('PASS refresh before save, offline reload/retry, in-flight edits, cloud conflict protection and teacher isolation');
})().catch(error=>{console.error(error);process.exitCode=1});

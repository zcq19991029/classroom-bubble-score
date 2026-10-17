const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/25466/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const server=http.createServer((req,res)=>{let p=path.join(process.cwd(),decodeURIComponent(req.url.split('?')[0]));try{res.setHeader('content-type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html;charset=utf-8');res.end(fs.readFileSync(p))}catch{res.statusCode=404;res.end()}}).listen(4178,'127.0.0.1');
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 let payload={version:2,activeClass:'虚构达标测试班',classes:{虚构达标测试班:{className:'虚构达标测试班',students:[{id:'a',studentNo:'01',name:'虚构甲',emoji:'😊',score:7},{id:'b',studentNo:'02',name:'虚构乙',emoji:'😊',score:9}],logs:[{id:'l1',studentId:'a',delta:7},{id:'l2',studentId:'b',delta:9}],attendance:[],homework:[],examScores:{},settings:{attendanceTotalLessons:2,passScore:60},lessonSchedule:[],courseProgress:{},lessonTaskCounts:{}}}};
 payload.classes.虚构达标测试班.logs.forEach(l=>Object.assign(l,{name:'',no:'',time:'2026-10-01T00:00:00Z'}));
 payload.classes.虚构达标测试班.courseProgress={preset:[{week:1,content:'虚构课程'}],actual:{},sourceName:'隔离测试'};
 const original=JSON.stringify(payload.classes.虚构达标测试班);
 payload.classes['虚构第二班']=structuredClone(payload.classes.虚构达标测试班);payload.classes['虚构第二班'].className='虚构第二班';
 const context=await browser.newContext({viewport:{width:1600,height:1000}});let writes=0;
 await context.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/api/auth/session')return route.fulfill({json:{teacher:{id:'isolated',displayName:'虚构教师'}}});if(p==='/api/workspace'){if(route.request().method()==='PUT'){payload=route.request().postDataJSON().payload;writes++;}return route.fulfill({json:{payload,updatedAt:'r'+writes,ok:true}})}return route.fulfill({json:{ok:true}})});
 const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4178/cloud.html');await page.waitForFunction(()=>document.querySelector('#classTitle').textContent==='虚构达标测试班');
 await page.click('#databaseBtn');assert.match(await page.locator('#page-assessment').innerText(),/任务满分待设置/);
 await page.locator('[data-criterion-target]').fill('10');await page.locator('[data-criterion-target]').press('Tab');
 await page.locator('[data-criterion-field="earned"]').first().fill('0');await page.locator('[data-criterion-field="earned"]').first().press('Tab');
 await page.locator('[data-criterion-field="status"]').first().selectOption('graded');
 assert.match(await page.locator('#page-assessment').innerText(),/基础待确认/);
 // Use stable ID because ranking may reorder after grading.
 const a='[data-criterion-key="id:a"]';await page.locator(a+'[data-criterion-field="foundation"]').selectOption('makeup');
 await page.waitForTimeout(500);assert.equal(payload.classes.虚构达标测试班.criterionAssessment.students['id:a'].earned,0);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#classTitle').textContent==='虚构达标测试班');await page.click('#databaseBtn');
 assert.equal(await page.locator(a+'[data-criterion-field="foundation"]').inputValue(),'makeup');
 assert.equal(await page.locator(a+'[data-criterion-field="earned"]').inputValue(),'0');
 await page.locator('#databaseModal .close-btn').count().then(async n=>{if(n)await page.locator('#databaseModal .close-btn').click();else await page.locator('#databaseModal button').filter({hasText:'×'}).click()});
 await page.selectOption('#classSwitcher',{label:'虚构第二班'});await page.click('#databaseBtn');assert.equal(await page.locator('[data-criterion-target]').inputValue(),'');
 await page.locator('#databaseModal button').filter({hasText:'×'}).click();await page.selectOption('#classSwitcher',{label:'虚构达标测试班'});await page.click('#databaseBtn');assert.equal(await page.locator('[data-criterion-target]').inputValue(),'10');
 const current=structuredClone(payload.classes.虚构达标测试班);delete current.criterionAssessment;const old=JSON.parse(original);delete current.updatedAt;delete old.updatedAt;
 for(const k of ['students','logs','attendance','homework','examScores','lessonSchedule','courseProgress','lessonTaskCounts'])assert.deepEqual(current[k],old[k],k);
 fs.mkdirSync('docs/screenshots',{recursive:true});fs.mkdirSync('tmp/criterion-20261017',{recursive:true});
 const download=page.waitForEvent('download');await page.click('[data-criterion-export]');const dl=await download;await dl.saveAs('tmp/criterion-20261017/isolated.csv');assert.match(fs.readFileSync('tmp/criterion-20261017/isolated.csv','utf8'),/预估\/待复核/);
 const popup=page.waitForEvent('popup');await page.click('[data-criterion-print]');const print=await popup;await print.waitForLoadState();assert.match(await print.locator('body').innerText(),/预估\/待复核/);await print.pdf({path:'tmp/criterion-20261017/isolated.pdf',format:'A3',landscape:true});await print.close();
 await page.setViewportSize({width:2400,height:1000});await page.locator('#page-assessment summary').click();await page.screenshot({path:'docs/screenshots/criterion-assessment.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});assert(await page.locator('.assessment-scroll').evaluate(el=>el.scrollWidth>el.clientWidth));
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS isolated browser settings/zero/foundation API snapshot/reload, raw data preservation, mobile scroll, screenshot');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

/* Raw assessment entry shares the class workspace and immutable classified logs. */
(function(){
 'use strict';const M=CriterionAssessment,U=CriterionAssessmentUI,base={...U},copy=x=>JSON.parse(JSON.stringify(x)),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const config=ctx=>ctx.data.criterionAssessment||{};
 function write(ctx,c,effects,label){M.commit(ctx.data,c,effects,label,ctx.lesson?.());ctx.save();ctx.render();}
 function options(ctx){return ctx.data.students.map(s=>`<option value="${esc(M.key(s))}">${esc(s.name)} ${esc(s.studentNo)}</option>`).join('');}
 function groups(ctx){return [...(ctx.dutyIds?.().length?[{id:'rotation',name:'本课轮值名单',studentIds:ctx.dutyIds()}]:[]),...(ctx.groups?.()||[])];}
 U.render=ctx=>{const c=config(ctx),gs=groups(ctx);let html=base.render(ctx);
 const entry=`<details class="assessment-note" data-entry-panel><summary>课堂积分、值日人数 · 撤销/重做</summary><div class="assessment-settings"><button class="btn" data-entry-undo ${!ctx.data.criterionHistory?.undo?.length?'disabled':''}>撤销新评分</button><button class="btn" data-entry-redo ${!ctx.data.criterionHistory?.redo?.length?'disabled':''}>重做新评分</button></div>
 <div class="assessment-settings"><select aria-label="奖惩学生" data-reward-student>${options(ctx)}</select><select aria-label="奖惩来源" data-reward-kind><option value="reward">课堂净奖励（含已净扣处罚）</option><option value="discipline">个人纪律扣分</option></select><input data-reward-value aria-label="本次原始奖惩分" type="number" step="0.01" placeholder="本次原始分"><button class="btn" data-reward-add>记入本课</button></div><p>奖励可正可负，纪律填非负扣分；同一处罚不能同时记入净奖励和纪律。新气泡、按组加分和值日直接改变原始累计；已有历史积分一起参与换算，不按来源再次加减。</p>
 <div class="assessment-settings"><label>值日对象<select data-duty-group aria-label="值日对象">${gs.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}（${g.studentIds.length}人）</option>`).join('')}</select></label><label>参与<input data-duty-participants aria-label="值日参与人数" type="number" min="0" step="1"></label><label>应到<input data-duty-expected aria-label="值日应到人数" type="number" min="1" step="1" value="${gs[0]?.studentIds.length||''}"></label><button class="btn" data-duty-save>计算并记录值日</button></div><p>值日＝5×参与/应到，保留两位；应到默认对象实际人数，可修正。人数/成员快照/分数按本课保存；修改只记差额，撤销/重做一起恢复。旧手填分保留，不倒推人数。</p>${Object.entries(c.duties||{}).map(([k,d])=>`<p>${esc(k)}：${d.participants}/${d.expected}人＝${d.score}分</p>`).join('')}</details>`;
 html=html.replace('<div class="assessment-settings">',entry+'<div class="assessment-settings">');
 return html;
 };
 U.change=(ctx,e)=>{const el=e.target,c=copy(config(ctx));
 if(el.matches('[data-duty-group]')){el.closest('.assessment-settings').querySelector('[data-duty-expected]').value=groups(ctx).find(g=>g.id===el.value)?.studentIds.length||'';return true;}
 if(el.matches('[data-criterion-field="foundation"]')){let saved=false;const before=copy(c),proxy={...ctx,save:()=>{saved=true},render:()=>{}};const used=base.change(proxy,e);if(saved){const next=copy(config(ctx));ctx.data.criterionAssessment=before;write(ctx,next,[],'基础确认')}else ctx.render();return used;}
 return base.change(ctx,e);
 };
 U.action=(ctx,e)=>{const b=e.target,root=b.closest('#page-assessment'),c=copy(config(ctx));
 if(b.closest('[data-reward-add]')){const k=root.querySelector('[data-reward-student]').value,category=root.querySelector('[data-reward-kind]').value,v=root.querySelector('[data-reward-value]').value,d=Number(v);if(!M.numeric(v)||d===0||(category==='discipline'&&d<0)){ctx.message('填有效原始分，纪律填非负扣分');return true}write(ctx,c,[{key:k,category,delta:category==='discipline'?-d:d}],'明确分类课堂奖惩');return true;}
 if(b.closest('[data-duty-save]')){try{const g=groups(ctx).find(g=>g.id===root.querySelector('[data-duty-group]').value);if(!g?.studentIds.length)throw Error('对象没有学生');const p=root.querySelector('[data-duty-participants]').value,n=root.querySelector('[data-duty-expected]').value;if(p===''||n==='')throw Error('填写参与和应到人数');const effects=M.duty(c,(ctx.lessonKey?.()||ctx.lesson?.()||'未选课')+'｜'+g.id,g.studentIds.map(id=>M.key(ctx.data.students.find(s=>s.id===id))),Number(p),Number(n));write(ctx,c,effects,'值日人数自动评分');}catch(err){ctx.message(err.message)}return true;}
 if(b.closest('[data-entry-undo],[data-entry-redo]')){if(M.travel(ctx.data,!!b.closest('[data-entry-redo]'))){ctx.save();ctx.render()}return true;}
 return base.action(ctx,e);
 };
})();

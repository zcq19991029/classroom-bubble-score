/* Recoverable removal from the active class list; never erases a class. */
(function(root){
 'use strict';const copy=x=>JSON.parse(JSON.stringify(x));
 function plan(payload,names,stamp){const next=copy(payload),unique=[...new Set(names)];if(!unique.length)throw Error('请选择班级');if(unique.some(n=>!next.classes?.[n]))throw Error('班级已变化，请重新打开');if(unique.length>=Object.keys(next.classes).length)throw Error('至少保留一个当前班级');next.archivedClasses=next.archivedClasses||[];for(const name of unique){next.archivedClasses.push({id:name+'|'+stamp,className:name,archivedAt:stamp,data:next.classes[name]});delete next.classes[name];}if(!next.classes[next.activeClass])next.activeClass=Object.keys(next.classes)[0];return next;}
 function restore(payload,id){const next=copy(payload),record=next.archivedClasses?.find(a=>a.id===id);if(!record)throw Error('归档不存在');if(next.classes[record.className])throw Error('已有同名班级，请先处理同名班级');next.classes[record.className]=record.data;next.archivedClasses=next.archivedClasses.filter(a=>a.id!==id);return next;}
 const api={plan,restore};if(typeof module!=='undefined')module.exports=api;root.ClassArchive=api;
 if(typeof document==='undefined')return;
 const button=document.querySelector('#classArchiveBtn'),modal=document.querySelector('#classArchiveModal');if(!button||!modal)return;
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(){const p=root.classroomClassManager.snapshot(),body=modal.querySelector('[data-class-list]');body.innerHTML=Object.keys(p.classes).map(n=>`<label style="display:block;padding:8px"><input type="checkbox" data-archive-class value="${esc(n)}"> ${esc(n)}</label>`).join('')+'<h3>已移出的可恢复班级</h3>'+(p.archivedClasses||[]).map(a=>`<p>${esc(a.className)} <button class="btn" data-restore-class="${esc(a.id)}">恢复</button></p>`).join('');}
 button.addEventListener('click',()=>{try{render();modal.classList.add('show')}catch(e){alert(e.message)}});
 modal.querySelector('[data-export-classes]').onclick=()=>root.classroomClassManager.backupAll();
 modal.querySelector('[data-close-classes]').onclick=()=>modal.classList.remove('show');
 modal.addEventListener('click',async e=>{const restore=e.target.closest('[data-restore-class]'),remove=e.target.closest('[data-archive-selected]');if(!restore&&!remove)return;const names=[...modal.querySelectorAll('[data-archive-class]:checked')].map(x=>x.value);if(remove&&!names.length){alert('请选择班级');return}try{e.target.disabled=true;await root.classroomClassManager.change(restore?{restoreId:restore.dataset.restoreClass}:{names});render();modal.querySelector('[data-class-message]').textContent=restore?'班级已恢复并同步':'已从当前列表移出并同步，可在下方恢复';}catch(err){modal.querySelector('[data-class-message]').textContent=err.message}finally{e.target.disabled=false}});
})(typeof window==='undefined'?globalThis:window);

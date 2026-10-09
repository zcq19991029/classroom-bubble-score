(function(){
  const ROLES=['班长','学委','纪委','课代表'];
  function uid(){return 'g'+Math.random().toString(36).slice(2,9)}
  function studentsOf(data){return Array.isArray(data&&data.students)?data.students:[]}
  function create(students,count,max){
    count=Math.max(1,Math.min(30,Number(count)||Math.ceil(students.length/4)||1)); max=Math.max(1,Number(max)||4);
    return {version:1,groupCount:count,groups:Array.from({length:count},(_,i)=>({id:'group-'+(i+1),name:'第'+(i+1)+'组',max,studentIds:[],leaderId:null})),unassignedIds:students.map(s=>String(s.id)),committee:Object.fromEntries(ROLES.map(r=>[r,null]))};
  }
  function normalize(raw,students){
    const ids=new Set(students.map(s=>String(s.id))); const base=raw&&Array.isArray(raw.groups)?raw:create(students,raw&&raw.groupCount,4);
    const used=new Set(); const groups=base.groups.map((g,i)=>{const members=[];(Array.isArray(g.studentIds)?g.studentIds:[]).forEach(id=>{id=String(id);if(ids.has(id)&&!used.has(id)){used.add(id);members.push(id)}}); const max=Math.max(members.length,Math.max(1,Number(g.max)||4)); return {id:g.id||'group-'+(i+1),name:g.name||('第'+(i+1)+'组'),max,studentIds:members,leaderId:members.includes(String(g.leaderId))?String(g.leaderId):null};});
    const assigned=new Set([...used]); const unassigned=students.map(s=>String(s.id)).filter(id=>!assigned.has(id)); const committee={}; ROLES.forEach(r=>{const id=base.committee&&base.committee[r]; committee[r]=ids.has(String(id))?String(id):null});
    return {version:1,groupCount:groups.length,groups,unassignedIds:unassigned,committee};
  }
  function add(state,id,gid){id=String(id);const g=state.groups.find(x=>x.id===gid);if(!g||g.studentIds.includes(id))return state;if(g.studentIds.length>=g.max)throw new Error('该组已达到人数上限');state.groups.forEach(x=>x.studentIds=x.studentIds.filter(x=>x!==id));state.unassignedIds=state.unassignedIds.filter(x=>x!==id);g.studentIds.push(id);return state}
  function remove(state,id){id=String(id);state.groups.forEach(g=>{g.studentIds=g.studentIds.filter(x=>x!==id);if(g.leaderId===id)g.leaderId=null});if(!state.unassignedIds.includes(id))state.unassignedIds.push(id);return state}
  function max(state,gid,n){const g=state.groups.find(x=>x.id===gid);n=Math.max(1,Number(n)||1);if(!g)return state;if(n<g.studentIds.length)throw new Error('人数上限不能小于当前人数');g.max=n;return state}
  function leader(state,gid,id){const g=state.groups.find(x=>x.id===gid);if(!g||!g.studentIds.includes(String(id)))throw new Error('组长必须是本组成员');state.groups.forEach(x=>{if(x!==g&&x.leaderId===String(id))x.leaderId=null});g.leaderId=String(id);return state}
  function role(state,roleName,id){if(!ROLES.includes(roleName))throw new Error('职位无效');id=id?String(id):null;Object.keys(state.committee).forEach(r=>{if(r!==roleName&&state.committee[r]===id&&id)state.committee[r]=null});state.committee[roleName]=id;return state}
  window.GroupingModel={ROLES,create,normalize,add,remove,max,leader,role,studentsOf};
})();

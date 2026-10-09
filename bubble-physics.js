/* Dissipative contacts and sleeping; no periodic/random force at rest. */
(function(root){
  const wake=n=>{n.sleeping=false;n.quietTime=0};
  function step(nodes,dt,{width,ground,gravityX=0,gravityY=95,nodeWidth=112,diameter=100}){
    dt=Math.max(0,Math.min(.025,dt));if(!dt)return;
    const right=Math.max(4,width-nodeWidth),g=Math.hypot(gravityX,gravityY)||1;
    const supportCache=new Map();
    const supported=(n,seen=new Set())=>{
      if(supportCache.has(n))return supportCache.get(n);
      if(seen.has(n))return false;
      if(gravityY>0&&n.y>=ground-.5||gravityY<0&&n.y<=5.5||gravityX<0&&n.x<=4.5||gravityX>0&&n.x>=right-.5)return true;
      // One sloping contact is not a stable resting place: gravity must roll
      // the circle down it. Sleep only with balanced, grounded supports.
      const branch=new Set(seen);branch.add(n);let left=Infinity,rightSide=-Infinity;
      for(const o of nodes){if(o===n)continue;const dx=o.x-n.x,dy=o.y-n.y,d=Math.hypot(dx,dy);
        if(d>=diameter+.8||!d||(dx*gravityX+dy*gravityY)/(d*g)<=.3)continue;
        if(!o.hover&&!supported(o,branch))continue;
        const side=(dx*gravityY-dy*gravityX)/(d*g);left=Math.min(left,side);rightSide=Math.max(rightSide,side);
      }
      const stable=left<=.02&&rightSide>=-.02;supportCache.set(n,stable);return stable;
    };
    for(const n of nodes){
      // UI nodes must not remain fixed after a lost pointerup/capture. Search
      // positioning is a separately timed hold, never an indefinite hover.
      if(n.pointerId!==undefined&&n.hover&&!n.dragging&&!(n.holdUntil>Date.now()))n.hover=false;
      n._startX=n.x;n._startY=n.y;
      if(n.hover){wake(n);continue}
      if(n.sleeping&&(Math.hypot(n.vx,n.vy)>.01||Math.hypot(n.x-n.sleepX,n.y-n.sleepY)>.2||Math.hypot(gravityX-n.sleepGX,gravityY-n.sleepGY)>8||!supported(n)||n.x>right||n.y>ground))wake(n);
      if(n.sleeping)continue;
      n.vx=(n.vx+gravityX*dt)*Math.pow(.995,dt*60);
      n.vy=Math.max(-900,Math.min(900,(n.vy+gravityY*dt)*Math.pow(.995,dt*60)));
      n.x+=n.vx*dt;n.y+=n.vy*dt;
    }
    const bounds=n=>{
      if(n.hover||n.sleeping)return;
      if(n.x<4){n.x=4;if(n.vx<0)n.vx=Math.abs(n.vx)>20?-n.vx*.35:0}
      if(n.x>right){n.x=right;if(n.vx>0)n.vx=n.vx>20?-n.vx*.35:0}
      if(n.y<5){n.y=5;if(n.vy<0)n.vy=Math.abs(n.vy)>20?-n.vy*.35:0}
      if(n.y>ground){n.y=ground;if(n.vy>0)n.vy=n.vy>20?-n.vy*.35:0}
    };
    // Repeated constraint passes stop stacking corrections from pushing through the floor.
    for(let pass=0;pass<8;pass++){
      nodes.forEach(bounds);
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d>=diameter)continue;
        const nx=d?dx/d:1,ny=d?dy/d:0,along=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(along < -20){if(a.sleeping&&!a.hover)wake(a);if(b.sleeping&&!b.hover)wake(b)}
        const ma=a.hover||a.sleeping?0:1,mb=b.hover||b.sleeping?0:1,total=ma+mb;if(!total)continue;
        const correction=Math.max(0,diameter-d-.02)/total;
        a.x-=nx*correction*ma;a.y-=ny*correction*ma;b.x+=nx*correction*mb;b.y+=ny*correction*mb;
        if(along<0){const impulse=-along*(Math.abs(along)>20?1.35:1)/total;a.vx-=impulse*nx*ma;a.vy-=impulse*ny*ma;b.vx+=impulse*nx*mb;b.vy+=impulse*ny*mb}
      }
    }
    nodes.forEach(bounds);
    supportCache.clear();
    for(const n of nodes){
      if(n.hover||n.sleeping)continue;
      const support=supported(n);
      if(support&&Math.hypot(n.vx,n.vy)<8){n.vx*=Math.pow(.8,dt*60);n.vy*=Math.pow(.8,dt*60)}
      if(support&&Math.hypot(n.vx,n.vy)<8&&Math.hypot(n.x-n._startX,n.y-n._startY)<.2)n.quietTime=(n.quietTime||0)+dt;else n.quietTime=0;
      if(n.quietTime>=.8){n.sleeping=true;n.vx=n.vy=0;n.sleepX=n.x;n.sleepY=n.y;n.sleepGX=gravityX;n.sleepGY=gravityY}
    }
  }
  root.BubblePhysics={step,wake};if(typeof module!=='undefined')module.exports=root.BubblePhysics;
})(typeof window==='undefined'?globalThis:window);

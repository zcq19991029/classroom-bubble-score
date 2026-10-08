(function(root){
  const timers=new WeakMap();
  function play(wrapper,delta){
    if(!delta)return;
    clearTimeout(timers.get(wrapper));
    wrapper.querySelector('.bubble-feedback')?.remove();
    wrapper.classList.remove('feedback-plus','feedback-minus');
    const layer=wrapper.ownerDocument.createElement('span');
    layer.className='bubble-feedback';layer.setAttribute('aria-hidden','true');
    const face=wrapper.ownerDocument.createElement('span');face.className='feedback-face';face.textContent=delta>0?'😎':'😞';layer.appendChild(face);
    if(delta>0)for(let i=0;i<8;i++){const star=wrapper.ownerDocument.createElement('span');star.className='feedback-star';star.textContent=i%2?'✦':'✧';star.style.setProperty('--angle',`${i*45}deg`);layer.appendChild(star)}
    wrapper.querySelector('.bubble').appendChild(layer);
    void wrapper.offsetWidth;wrapper.classList.add(delta>0?'feedback-plus':'feedback-minus');
    timers.set(wrapper,setTimeout(()=>{layer.remove();wrapper.classList.remove('feedback-plus','feedback-minus');timers.delete(wrapper)},1000));
  }
  root.BubbleFeedback={play};
})(typeof window==='undefined'?globalThis:window);

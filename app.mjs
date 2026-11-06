import {makeRun,advance,hit,HOLD_TIME,defaultProfile,cleanProfile,mergeProfile} from './core.mjs';
import {bridge} from './sdk.mjs';

const key='blink-burst-v1';
const el=id=>document.getElementById(id);
const targetLayer=el('targets'), effectLayer=el('effects');
const controls=new Map(), held=new Map();
const names={pop:'Pop target',hold:'Hold target',trap:'Decoy, avoid'};
const icons={pop:'◉',hold:'◎',trap:'×'};
let profile=defaultProfile();
try {
  const stored=JSON.parse(localStorage.getItem(key));
  if(stored?.game==='blink-burst'&&stored.v===1) profile=cleanProfile(stored.profile);
} catch {}
let playing=false, sdk, audio, lastFrame=0, lastSave=0;

function save(sync=false) {
  try {localStorage.setItem(key,JSON.stringify({game:'blink-burst',v:1,profile}));}catch {}
  if(sync) sdk?.save();
}

function openAudio() {
  if(!profile.sound) return;
  try {
    audio??=new (window.AudioContext||window.webkitAudioContext)();
    audio.resume().catch(()=>{});
  } catch {}
}

function playSound(notes) {
  if(!profile.sound||!audio||document.hidden) return;
  for(let i=0;i<notes.length;i++) {
    const time=audio.currentTime+i*.07, tone=audio.createOscillator(), gain=audio.createGain();
    tone.type=i===0?'triangle':'sine';
    tone.frequency.setValueAtTime(notes[i],time);
    gain.gain.setValueAtTime(.055,time);
    gain.gain.exponentialRampToValueAtTime(.001,time+.17);
    tone.connect(gain);gain.connect(audio.destination);
    tone.start(time);tone.stop(time+.18);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
  }
}

function mountSDK() {
  sdk=bridge({
    read:()=>({...profile}),
    write:(data,remote)=>{
      profile=remote?mergeProfile(profile,data):cleanProfile(data);
      save();
      draw();
    },
    changed:event=>{
      if(event.type==='reward') {
        el('status').textContent=event.kind==='like'?'Golden arcade badge unlocked.':'Mint burst confetti unlocked.';
        playSound([494,659,880]);
      }
      if(['reward','support','connected','cloud'].includes(event.type)) draw();
    },
  });
}

function draw() {
  const r=profile.run, live=r?.lives??5;
  el('score').textContent=r?.score??0;
  el('best').textContent=profile.best;
  el('lives').setAttribute('aria-label',live+' lives');
  for(const [i,tooth] of [...el('lives').children].entries()) tooth.classList.toggle('lost',i>=live);
  el('sound').textContent=profile.sound?'♫':'×';
  el('sound').setAttribute('aria-label',profile.sound?'Mute sound':'Enable sound');
  el('pause').disabled=!playing;
  el('overlay').hidden=playing;
  el('restart').hidden=!r||r.finished;
  if(!playing) {
    const tag=el('tag'), title=el('title'), description=el('description'), action=el('action');
    if(r?.finished) {
      tag.textContent='ROUND COMPLETE';
      title.innerHTML='<span>ALL EYES</span> CLOSED';
      description.textContent=r.score+' goo · '+r.streak+' best combo';
      action.textContent='POP AGAIN';
    } else if(r) {
      tag.textContent='CHECKPOINT SAVED';
      title.innerHTML='<span>TAKE A</span> BREATH';
      description.textContent='The eyes will wait.';
      action.textContent='CONTINUE';
    } else {
      tag.textContent='AFTER HOURS ARCADE';
      title.innerHTML='<span>BLINK</span> BURST';
      description.textContent='Pop. Charge. Dodge.';
      action.textContent='TAP TO PLAY';
    }
  }
  const support=sdk?.support(), bonus=[];
  if(profile.rewards.like||support?.like) bonus.push(profile.rewards.like?'Gold badge equipped.':'Like in GameWave for a gold badge.');
  if(profile.rewards.comment||support?.comment) bonus.push(profile.rewards.comment?'Mint burst equipped.':'Comment in GameWave for mint bursts.');
  el('bonus').hidden=!bonus.length;
  el('bonus').textContent=bonus.join(' ');
  document.querySelector('.mini-eye').classList.toggle('gold',profile.rewards.like);
  drawTargets();
}

function position(slot) {
  return [17+33*(slot%3),17+33*Math.floor(slot/3)];
}

function createTarget(t) {
  const button=document.createElement('button');
  button.type='button';
  button.className='target '+t.kind;
  button.setAttribute('aria-label',names[t.kind]);
  button.innerHTML='<span class="eye" aria-hidden="true">'+icons[t.kind]+'</span><span class="charge" aria-hidden="true"></span>';
  const [x,y]=position(t.slot);
  button.style.left=x+'%';
  button.style.top=y+'%';
  button.addEventListener('pointerdown',event=>{
    if(event.button!==0||!playing) return;
    event.preventDefault();
    if(t.kind==='hold') {
      button.setPointerCapture(event.pointerId);
      held.set(event.pointerId,{id:t.id,since:profile.run.clock});
    } else activate(t.id);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']) {
    button.addEventListener(name,event=>held.delete(event.pointerId));
  }
  button.addEventListener('click',event=>{
    if(event.detail===0&&t.kind!=='hold') activate(t.id);
  });
  button.addEventListener('keydown',event=>{
    if(t.kind!=='hold'||![' ','Enter'].includes(event.key)||!playing) return;
    event.preventDefault();
    if(!event.repeat) held.set('keyboard',{id:t.id,since:profile.run.clock});
  });
  button.addEventListener('keyup',()=>held.delete('keyboard'));
  button.addEventListener('blur',()=>held.delete('keyboard'));
  targetLayer.append(button);
  return button;
}

function drawTargets() {
  const live=playing?profile.run.targets:[];
  for(const [id,button] of controls) {
    if(live.some(t=>t.id===id)) continue;
    button.remove();
    controls.delete(id);
  }
  for(const t of live) {
    let button=controls.get(t.id);
    if(!button) {
      button=createTarget(t);
      controls.set(t.id,button);
    }
    button.style.setProperty('--life',100*t.remaining/t.duration+'%');
    const charge=[...held.values()].find(h=>h.id===t.id);
    button.style.setProperty('--charge',charge?Math.min(1,(profile.run.clock-charge.since)/HOLD_TIME):0);
  }
}

function burst(target,caption,color) {
  const [x,y]=position(target.slot), text=document.createElement('b');
  text.className='burst';text.textContent=caption;text.style.color=color;
  text.style.left=x+'%';text.style.top=y+'%';
  effectLayer.append(text);
  text.addEventListener('animationend',()=>text.remove(),{once:true});
  for(let i=0;i<9;i++) {
    const chip=document.createElement('i'), angle=i*Math.PI*2/9;
    chip.className='particle';chip.style.left=x+'%';chip.style.top=y+'%';
    chip.style.setProperty('--paint',color);
    chip.style.setProperty('--x',Math.cos(angle)*48+'px');
    chip.style.setProperty('--y',Math.sin(angle)*48+'px');
    effectLayer.append(chip);
    chip.addEventListener('animationend',()=>chip.remove(),{once:true});
    setTimeout(()=>chip.remove(),700);
  }
}

function process(events) {
  if(!events.length) return;
  for(const event of events) {
    if(event.kind==='score') {
      burst(event.target,'+'+event.points,profile.rewards.comment?'#8bf6cc':'#ffdd79');
      el('status').textContent=profile.run.combo>=3?profile.run.combo+' in a row!':event.target.kind==='hold'?'Charged burst!':'Nice pop!';
      playSound(event.target.kind==='hold'?[392,523,784]:[510,740]);
    }
    if(event.kind==='miss'||event.kind==='trap') {
      burst(event.target,event.kind==='trap'?'DECOY!':'MISSED!','#ff82b3');
      el('status').textContent=event.kind==='trap'?'Skip the crossed eyes.':'Watch the shrinking rings.';
      playSound([168,100]);
    }
    if(event.kind==='finish') {
      playing=false;
      held.clear();
      profile.best=Math.max(profile.best,profile.run.score);
      sdk.end();
      playSound([392,330,262]);
    }
  }
  save(true);
  draw();
}

function activate(id,charge=0) {
  if(!playing) return;
  openAudio();
  process(hit(profile.run,id,charge));
}

function resume(forceNew=false) {
  openAudio();
  if(forceNew||!profile.run||profile.run.finished) {
    if(playing||profile.run&&!profile.run.finished) sdk.end();
    sdk.prepare();
    profile.run=makeRun();
    effectLayer.replaceChildren();
  }
  held.clear();
  playing=true;
  lastFrame=performance.now();
  sdk.start();
  save(true);
  draw();
}

function pause() {
  if(!playing) return;
  playing=false;
  held.clear();
  save(true);
  draw();
}

function tick(now) {
  if(playing) {
    const dt=Math.max(0,(now-lastFrame)/1000);
    process(advance(profile.run,dt));
    if(playing) {
      for(const [pointer,hold] of held) {
        if(!profile.run.targets.some(t=>t.id===hold.id)) held.delete(pointer);
        else if(profile.run.clock-hold.since>=HOLD_TIME) {
          held.delete(pointer);
          activate(hold.id,HOLD_TIME);
        }
      }
      drawTargets();
      if(now-lastSave>650) {
        lastSave=now;
        save();
      }
    }
  }
  lastFrame=now;
  requestAnimationFrame(tick);
}

el('action').addEventListener('click',()=>resume());
el('restart').addEventListener('click',()=>resume(true));
el('pause').addEventListener('click',pause);
el('sound').addEventListener('click',()=>{
  profile.sound=!profile.sound;
  if(profile.sound) openAudio();
  save(true);
  draw();
});
window.addEventListener('keydown',event=>{if(event.key==='Escape') pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden) pause();});
window.addEventListener('pagehide',()=>{pause();save();sdk.stop();});
window.addEventListener('pageshow',event=>{if(event.persisted) mountSDK();});
mountSDK();
draw();
requestAnimationFrame(tick);

export const HOLD_TIME = 0.58;
export const MAX_LIVES = 5;
export const slots = 9;
const kinds = ['pop', 'hold', 'trap'];
const limit = (n,min,max) => Math.min(max,Math.max(min,n));

export function makeRun(seed = Date.now() >>> 0) {
  return {seed:seed>>>0, score:0, lives:MAX_LIVES, combo:0, streak:0, hits:0,
    clock:0, next:0.35, serial:0, targets:[], finished:false};
}

function random(run) {
  run.seed = (Math.imul(1664525,run.seed)+1013904223)>>>0;
  return run.seed / 4294967296;
}

function spawn(run) {
  const free = Array.from({length:slots},(_,i)=>i).filter(i=>!run.targets.some(t=>t.slot===i));
  if(!free.length) return;
  const serial = ++run.serial;
  const chance = random(run);
  const kind = serial < 3 ? 'pop' : serial === 3 ? 'hold' : serial === 5 ? 'trap'
    : chance < .19 ? 'trap' : chance < .43 ? 'hold' : 'pop';
  const duration = Math.max(kind==='hold'?1.7:1.25,3.1-run.clock*.024)+(kind==='hold'?.68:0);
  const slot = serial===1 ? 4 : free[Math.floor(random(run)*free.length)];
  run.targets.push({id:serial,kind,slot,remaining:duration,duration});
}

function damage(run,reason,events,target) {
  run.lives = Math.max(0,run.lives-1);
  run.combo = 0;
  events.push({kind:reason,target});
  if(!run.lives) {
    run.finished=true;
    run.targets=[];
    events.push({kind:'finish'});
  }
}

export function advance(run,dt) {
  const events=[];
  if(run.finished||!Number.isFinite(dt)||dt<=0) return events;
  dt=Math.min(dt,.1);
  run.clock+=dt;
  for(const target of [...run.targets]) {
    target.remaining-=dt;
    if(target.remaining>0) continue;
    run.targets=run.targets.filter(t=>t.id!==target.id);
    if(target.kind!=='trap') damage(run,'miss',events,target);
    if(run.finished) return events;
  }
  run.next-=dt;
  if(run.next<=0) {
    spawn(run);
    run.next=Math.max(.58,1.55-run.clock*.018);
  }
  return events;
}

export function hit(run,id,held=0) {
  const events=[];
  const target=run.targets.find(t=>t.id===id);
  if(run.finished||!target||target.remaining<=0||target.kind==='hold'&&held<HOLD_TIME) return events;
  run.targets=run.targets.filter(t=>t.id!==id);
  if(target.kind==='trap') {
    damage(run,'trap',events,target);
    return events;
  }
  run.combo++;
  run.streak=Math.max(run.streak,run.combo);
  run.hits++;
  const points=(target.kind==='hold'?25:10)+Math.min(30,Math.floor((run.combo-1)/3)*5);
  run.score+=points;
  events.push({kind:'score',target,points});
  return events;
}

export const defaultProfile = () => ({best:0,sound:true,rewards:{like:false,comment:false},run:null});

export function cleanProfile(data) {
  const profile=defaultProfile();
  if(!data||typeof data!=='object') return profile;
  const number=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max;
  if(Number.isInteger(data.best)&&number(data.best,1e9)) profile.best=data.best;
  profile.sound=data.sound!==false;
  profile.rewards={like:data.rewards?.like===true,comment:data.rewards?.comment===true};
  const r=data.run;
  if(!r||!['seed','score','lives','combo','streak','hits','serial'].every(k=>Number.isInteger(r[k])&&number(r[k],k==='seed'?4294967295:1e9))||
    r.lives>MAX_LIVES||r.combo>r.streak||r.streak>r.hits||r.hits>r.serial||
    !number(r.clock,1e7)||!number(r.next,4)||typeof r.finished!=='boolean'||r.finished!==(r.lives===0)||
    !Array.isArray(r.targets)||r.targets.length>slots||r.finished&&r.targets.length) return profile;
  const occupied=new Set(), ids=new Set(), targets=[];
  for(const t of r.targets) {
    if(!t||!Number.isInteger(t.id)||t.id<1||t.id>r.serial||ids.has(t.id)||
      !Number.isInteger(t.slot)||!number(t.slot,slots-1)||occupied.has(t.slot)||!kinds.includes(t.kind)||
      !number(t.duration,8)||!number(t.remaining,t.duration)||t.remaining===0) return profile;
    occupied.add(t.slot);ids.add(t.id);
    targets.push({id:t.id,kind:t.kind,slot:t.slot,duration:t.duration,remaining:t.remaining});
  }
  profile.run={seed:r.seed,score:r.score,lives:r.lives,combo:r.combo,streak:r.streak,hits:r.hits,
    clock:r.clock,next:limit(r.next,0,4),serial:r.serial,targets,finished:r.finished};
  if(r.finished) profile.best=Math.max(profile.best,r.score);
  return profile;
}

export function mergeProfile(local,remote) {
  const incoming=cleanProfile(remote);
  return {...local,best:Math.max(local.best,incoming.best),run:local.run||incoming.run,
    rewards:{like:local.rewards.like||incoming.rewards.like,comment:local.rewards.comment||incoming.rewards.comment}};
}

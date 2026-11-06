import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRun,advance,hit,HOLD_TIME,cleanProfile,defaultProfile,mergeProfile} from './core.mjs';
import {bridge} from './sdk.mjs';

const run=makeRun(1234);
let first, hold, trap;
for(let frame=0;frame<350;frame++) {
  advance(run,.025);
  for(const t of [...run.targets]) {
    if(t.kind==='pop') {
      const events=hit(run,t.id);
      first??=events[0];
      assert(!hit(run,t.id).length);
    }
    if(t.kind==='hold') {
      assert(!hit(run,t.id,HOLD_TIME-.01).length);
      hold??=hit(run,t.id,HOLD_TIME)[0];
      if(run.targets.includes(t)) hit(run,t.id,HOLD_TIME);
    }
    if(t.kind==='trap'&&!trap) trap=hit(run,t.id)[0];
  }
  assert.equal(new Set(run.targets.map(t=>t.slot)).size,run.targets.length);
}
assert.equal(first.points,10);
assert.equal(hold.points,25);
assert.equal(trap.kind,'trap');
assert.equal(run.lives,4);
const snapshot=cleanProfile({...defaultProfile(),run});
assert.deepEqual(snapshot.run,run);
const remote=mergeProfile(snapshot,{best:100,rewards:{like:true}});
assert.equal(remote.run,snapshot.run);
assert(remote.rewards.like);
assert.equal(remote.best,100);
let finished=0;
for(let frame=0;frame<2000;frame++) {
  finished+=advance(run,.05).filter(e=>e.kind==='finish').length;
}
assert(run.finished);
assert.equal(run.lives,0);
assert.equal(finished,1);
assert.equal(cleanProfile({run}).best,run.score);
assert.equal(cleanProfile({run:{...run,lives:5}}).run,null);

let host, starts=0, ends=0, off=0, saved=[], like, comment, profile=snapshot;
let serial=0;
const timers=new Map(), schedule=(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;};
const flush=async()=>{for(let i=0;i<8;i++) await Promise.resolve();};
function adapter() {
  return bridge({host:()=>host,read:()=>({...profile}),write:(raw,isRemote)=>{
    profile=isRemote?mergeProfile(profile,raw):cleanProfile(raw);
  },schedule,cancel:id=>timers.delete(id),timeout:80});
}
let sdk=adapter();
sdk.start();sdk.save();
host={gameStart:()=>starts++};
sdk.connect();sdk.connect();assert.equal(starts,1);
Object.assign(host,{
  gameOver:()=>ends++,
  loadUserGameState:async()=>({}),
  saveUserGameState:async value=>{saved.push(value);return {code:0};},
  onLike:async fn=>{like=fn;return {code:0,data:{unsubscribe:()=>off++}};},
  onComment:async fn=>{comment=fn;return {code:0,data:{unsubscribe:()=>off++}};},
});
sdk.connect();await flush();
assert.equal(saved[0].game,'blink-burst');
assert.deepEqual(saved[0].profile.run,snapshot.run);
like({project_id:'101',status:false});
like({project_id:101,status:true});
comment({project_id:'101'});
assert.deepEqual(profile.rewards,{like:false,comment:false});
like({project_id:'1000000000000000001',status:true,count:0});
comment({project_id:'1000000000000000001',content:'',count:0});
await flush();
const writes=saved.length;
like({project_id:'1000000000000000001',status:true,count:2});
comment({project_id:'1000000000000000001',content:'again'});
await flush();
assert.equal(saved.length,writes);
assert.deepEqual(profile.rewards,{like:true,comment:true});
sdk.stop();assert.equal(off,2);
sdk=adapter();await flush();assert.equal(starts,1);
sdk.start();sdk.start();assert.equal(starts,2);
sdk.end();sdk.end();assert.equal(ends,1);
sdk.stop();assert.equal(off,4);

let resolveLate, lateOff=0;
host={onLike:()=>new Promise(resolve=>{resolveLate=resolve;}),onComment:()=>Promise.reject(Error('offline'))};
sdk=adapter();
for(const [id,task] of [...timers]) if(task.ms===80&&timers.delete(id)) task.fn();
await flush();
assert.deepEqual(sdk.support(),{like:false,comment:false});
sdk.stop();resolveLate({code:0,data:{unsubscribe:()=>lateOff++}});await flush();
assert.equal(lateOff,1);
let invalidWrites=0;
host={loadUserGameState:()=>Promise.reject(Error('offline')),saveUserGameState:()=>invalidWrites++};
sdk=adapter();sdk.save();await flush();assert.equal(invalidWrites,0);sdk.stop();

const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
assert.equal(html,readFileSync(new URL('./standalone.html',import.meta.url),'utf8'));
new Function(html.split('<script>')[1].split('</script>')[0]);
console.log('Rules, checkpoint, full result, standalone, and SDK tests passed.');

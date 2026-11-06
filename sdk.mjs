// Optional host integration. Gameplay never awaits SDK discovery or registration.
export function bridge({host=()=>globalThis.neonlib,read,write,changed=()=>{},schedule=setTimeout,cancel=clearTimeout,timeout=5000}){
 const game='blink-burst';let alive=true,epoch=0,sdk=null,started=false,ended=false,startHost=null,loadStarted=false,cloudReady=false,dirty=false,saving=false,timers=new Set(),entries=new Map(),support={like:false,comment:false};
 const later=(fn,ms)=>{let id=schedule(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
 const safeStop=fn=>{try{fn?.();}catch{}};
 const getHost=()=>{try{let h=host();return h&&typeof h==='object'?h:null;}catch{return null;}};
 const emit=e=>{if(alive)try{changed(e);}catch{}};
 function call(h,name){try{if(typeof h?.[name]!=='function')return false;Promise.resolve(h[name]()).catch(()=>{});return true;}catch{return false;}}
 function notifyStart(){if(started&&!ended&&sdk&&startHost!==sdk&&call(sdk,'gameStart'))startHost=sdk;}
 function save(){dirty=true;flush();}
 function flush(){if(!alive||saving||!dirty||!cloudReady||typeof sdk?.saveUserGameState!=='function')return;let snapshot;try{snapshot={game,v:1,profile:JSON.parse(JSON.stringify(read()))};}catch{return;}dirty=false;saving=true;let destination=sdk,gen=epoch,settled=false;
  const finish=ok=>{if(settled||!alive||gen!==epoch)return;settled=true;cancel(timer);timers.delete(timer);saving=false;if(!ok)dirty=true;else{emit({type:'saved'});if(dirty)flush();}};
  let timer=later(()=>finish(false),timeout);
  try{Promise.resolve(destination.saveUserGameState(snapshot)).then(r=>finish(r?.code===0),()=>finish(false));}catch{finish(false);}
 }
 function reward(kind,e){if(!alive||!e||typeof e!=='object'||typeof e.project_id!=='string'||!e.project_id.trim()||kind==='like'&&e.status!==true||kind==='comment'&&typeof e.content!=='string')return;let p=read();if(p.rewards?.[kind])return;p.rewards={...p.rewards,[kind]:true};write(p,false);emit({type:'reward',kind});save();}
 function reg(kind,name,attempt=0){if(!alive||entries.has(kind)||typeof sdk?.[name]!=='function')return;let gen=epoch,entry={live:false,expired:false,stop:null};entries.set(kind,entry);
  let timer=later(()=>{if(!alive||gen!==epoch)return;entry.expired=true;if(attempt<1&&entries.get(kind)===entry)entries.delete(kind);support[kind]=false;emit({type:'support',...support});if(attempt<1)later(()=>reg(kind,name,attempt+1),1000);},timeout);
  const callback=e=>{if(alive&&gen===epoch&&entry.live&&!entry.expired)reward(kind,e);};
  const done=r=>{cancel(timer);timers.delete(timer);let stop=r?.code===0&&typeof r?.data?.unsubscribe==='function'?r.data.unsubscribe:null;if(!alive||gen!==epoch||entry.expired){safeStop(stop);return;}if(r?.code!==0){entry.expired=true;if(r?.code===-2&&attempt<1){entries.delete(kind);later(()=>reg(kind,name,attempt+1),1000);}return;}entry.live=true;entry.stop=stop;support[kind]=true;emit({type:'support',...support});};
  try{Promise.resolve(sdk[name](callback)).then(done,()=>done(null));}catch{done(null);}
 }
 function recognized(raw){return !!raw&&typeof raw==='object'&&!Array.isArray(raw)&&raw.game===game&&raw.v===1&&raw.profile&&typeof raw.profile==='object'&&!Array.isArray(raw.profile);}
 function connect(){if(!alive)return;let h=getHost();if(!h)return;if(sdk!==h){epoch++;for(let e of entries.values()){e.expired=true;safeStop(e.stop);}entries.clear();support={like:false,comment:false};cloudReady=false;loadStarted=false;saving=false;sdk=h;emit({type:'connected'});}
  if(!loadStarted&&typeof sdk.loadUserGameState==='function'){loadStarted=true;let gen=epoch,resolved=false;later(()=>{if(alive&&gen===epoch&&!resolved){resolved=true;cloudReady=false;emit({type:'cloudUnavailable'});}},timeout);
   try{Promise.resolve(sdk.loadUserGameState()).then(raw=>{if(!alive||gen!==epoch||resolved)return;resolved=true;if(recognized(raw)){write(raw.profile,true);emit({type:'cloud'});}cloudReady=recognized(raw)||!!raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length===0;if(dirty)flush();},()=>{if(gen===epoch){resolved=true;cloudReady=false;}});}catch{resolved=true;cloudReady=false;}}
  notifyStart();reg('like','onLike');reg('comment','onComment');if(dirty)flush();
 }
 function probe(n=0){connect();if(alive&&n<8)later(()=>probe(n+1),1500);}
 function nudge(){connect();}const external=typeof globalThis.addEventListener==='function';if(external)for(let name of ['pointerdown','focus','resize'])globalThis.addEventListener(name,nudge,{passive:true});probe();
 return{save,connect,support:()=>({...support}),prepare(){started=false;ended=false;startHost=null;},start(){connect();if(started&&!ended){notifyStart();return;}started=true;ended=false;notifyStart();},end(){if(!started||ended)return;ended=true;let destination=startHost||getHost();if(destination)call(destination,'gameOver');},
  viewport(){let h=getHost();try{let v=h?.getGameViewport?.();if(v&&typeof v.then==='function'){Promise.resolve(v).catch(()=>{});return null;}if(v&&Number.isFinite(v.width)&&Number.isFinite(v.height)&&v.width>0&&v.height>0)return{width:v.width,height:v.height,density:Number.isFinite(v.density)&&v.density>0?v.density:1};}catch{}return null;},
  stop(){if(!alive)return;alive=false;epoch++;if(external)for(let name of ['pointerdown','focus','resize'])globalThis.removeEventListener(name,nudge);for(let t of timers)cancel(t);timers.clear();for(let e of entries.values()){e.expired=true;safeStop(e.stop);}entries.clear();support={like:false,comment:false};}
 };
}



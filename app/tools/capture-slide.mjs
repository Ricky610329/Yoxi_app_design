/* 從目前 app 重拍提案的五張手機圖；原生 3x、透明圓角，不改 app CSS。
   node app/tools/capture-slide.mjs [--only 02,03]
   Chrome、Node 22+；輸出 output/原型畫面_手機圓角PNG。 */
import {spawn} from 'node:child_process';
import {access, readFile, writeFile, mkdir, mkdtemp, realpath, rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'output/原型畫面_手機圓角PNG');
const TMP = path.join(ROOT, 'tmp');
const delay = ms => new Promise(r => setTimeout(r, ms));
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg < 0 ? null : new Set((process.argv[onlyArg + 1] || '').split(','));
const shots = [
  {name:'01_探索', route:'/ride?mode=explore&area=glass-kiln'},
  {name:'02_前往', route:'/ride', run:"APP.ride.trip.start('glass-kiln','e');APP.ride.trip.toRiding();APP.nav.go('/trip',{replace:true,dir:'none'});"},
  {name:'03_抵達收卡', route:'/ride', run:"APP.ride.trip.arriveAt('glass-kiln');APP.nav.go('/unlock/glass-kiln?ride=1',{replace:true,dir:'none'});"},
  {name:'04_收藏', route:'/album'},
  {name:'05_回憶卡', route:'/lookback'},
];
if (only && [...only].some(x => !shots.some(s => s.name.startsWith(x + '_')))) throw new Error('Unknown --only number');
let chrome;
for (const candidate of [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) {
  if (!candidate) continue;
  try {await access(candidate); chrome=candidate; break;} catch {}
}
if (!chrome) throw new Error('Set CHROME_PATH to Chrome/Edge executable');
await mkdir(OUT, {recursive:true});
await mkdir(TMP, {recursive:true});
const profile = await mkdtemp(path.join(TMP, 'slide-chrome-'));
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--allow-file-access-from-files', '--remote-debugging-port=0', '--no-first-run',
  '--disable-background-networking', '--disable-background-timer-throttling',
  '--force-device-scale-factor=1', '--user-data-dir=' + profile, 'about:blank'],
  {windowsHide:true, stdio:'ignore'});
const exited = new Promise(resolve => proc.once('exit', resolve));
let ws;
try {
  let port;
  for(let i=0;i<100;i++) {
    try {port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;} catch {}
    await delay(100);
  }
  if(!port) throw new Error('Chrome debug endpoint missing');
  const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let id=0;
  const pending=new Map(), exceptions=[];
  ws.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.id) {
      const p=pending.get(m.id);
      if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
    }
    if(m.method==='Runtime.exceptionThrown') exceptions.push(m.params);
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const key=++id, timer=setTimeout(()=>{pending.delete(key);reject(new Error('Timeout '+method));},20000);
    pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
  });
  const evaluate=async expression=>{
    const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:600,height:900,deviceScaleFactor:3,mobile:false});
  await call('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
  for(const shot of shots.filter(s=>!only||only.has(s.name.slice(0,2)))) {
    exceptions.length=0;
    const uri=pathToFileURL(path.join(ROOT,'app/tests/fixtures/shot-frame.html'));
    uri.searchParams.set('r',shot.route);
    if(shot.run) uri.searchParams.set('run',shot.run);
    await call('Page.navigate',{url:uri.href});
    let ready=false;
    for(let i=0;i<120;i++) {
      ready=await evaluate("document.documentElement.dataset.shotReady==='1' && document.querySelector('iframe')?.contentDocument?.documentElement.dataset.viewReady==='1'");
      if(ready) break; await delay(100);
    }
    if(!ready) throw new Error('Not ready: '+shot.name);
    await evaluate(`(async()=>{
      const f=document.querySelector('iframe'),d=f.contentDocument;
      document.documentElement.style.background='transparent';document.body.style.background='transparent';
      f.style.borderRadius='44px';f.style.overflow='hidden';
      await d.fonts.ready;await Promise.all([...d.images].map(im=>im.decode().catch(()=>{})));
      await new Promise(r=>setTimeout(r,1200));
    })()`);
    const state=await evaluate(`(()=>{
      const f=document.querySelector('iframe'),d=f.contentDocument,w=f.contentWindow;
      return {route:w.location.hash,version:w.APP_VERSION,error:document.querySelector('#shot-err').textContent+(d.querySelector('#app-errors')?.textContent||''),
        brokenImages:[...d.images].filter(im=>!im.complete||!im.naturalWidth).map(im=>im.src),text:d.querySelector('#view').innerText};
    })()`);
    if(state.error||state.brokenImages.length||exceptions.length) throw new Error(JSON.stringify({state,exceptions}));
    if(/走路前往|步行|走路約|不是拿來滑|為車上的這/.test(state.text)) throw new Error('Legacy travel copy: '+shot.name);
    const png=await call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,clip:{x:0,y:0,width:390,height:844,scale:1}});
    await writeFile(path.join(OUT,shot.name+'.png'),Buffer.from(png.data,'base64'));
    console.log(shot.name+' '+state.route+' '+state.version);
  }
  await call('Browser.close').catch(()=>{});
} finally {
  ws?.close();proc.kill();await Promise.race([exited,delay(3000)]);
  const resolved=await realpath(profile), base=await realpath(TMP);
  if(!resolved.startsWith(base+path.sep)||!path.basename(resolved).startsWith('slide-chrome-')) throw new Error('Unsafe temporary profile path');
  await rm(resolved,{recursive:true,force:true,maxRetries:3,retryDelay:200});
}

/* 遊喜樂：到訪模板＋自己的照片＋心情，一個動作收下本機合成的回憶卡。 */
(function () {
'use strict';
const esc = APP.esc, K = APP.album._;
const moods = [
  { key:'good', icon:'moodGood', label:'開心', direction:'明亮暖光、鮮明色彩，畫面輕快開闊。', caption:'把喜歡的風景，留在這裡。' },
  { key:'ok', icon:'moodOk', label:'平靜', direction:'自然日光、清爽色調，構圖平衡而安靜。', caption:'平凡的一天，也值得留下。' },
  { key:'low', icon:'moodLow', label:'放鬆', direction:'柔和暮光、低彩度暖色，留白多一些。', caption:'在熟悉的城市裡，慢一點。' }
];
function moodOf(k) { return moods.find(m => m.key === k) || moods[0]; }
function places() { return APP.album.recentCards(MOCK.POSTCARDS.length); }
function templates() {
  const ids = APP.explore.recentVisits().filter(v => v.md === APP.fmt.todayMMDD()).map(v => v.card);
  const list = ids.filter((id,i) => ids.indexOf(id) === i).map(K.cardById).filter(Boolean);
  return { today: !!list.length, places: list.length ? list : places() };
}
function cards() {
  const list = (STATE.all.today || {}).memoryCards;
  return Array.isArray(list) ? list.filter(c => c && STATE.has(c.cardId) && K.cardById(c.cardId)) : [];
}
function draft(cardId, mood, photo) {
  const p = places().find(x => x.id === cardId); if (!p) return null;
  const m = moodOf(mood);
  const d = {cardId:p.id, mood:m.key, date:APP.fmt.todayMMDD(), prompt:'以我去過的「'+p.name+'」模板製作城市回憶卡。心情是「'+m.label+'」：'+m.direction+'保留地點特色，不加入未到訪的地標。'};
  if (typeof photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(photo)) { d.photo = photo; d.prompt += '融入使用者照片，保留照片主體。'; }
  return d;
}
function artHTML(d) {
  const p = K.cardById(d.cardId);
  return d.photo ? '<img class="memory-own-photo" src="'+esc(d.photo)+'" alt="自己的照片">' : '<span class="memory-template-art" data-art="'+esc(p.art)+'" data-seed="'+K.cardIdx(p)+'" data-card-art="'+esc(p.id)+'"></span>';
}
function faceHTML(d) {
  return '<div class="memory-art">'+artHTML(d)+'</div><span class="memory-stamp">遊喜樂<span>'+esc(d.date)+'</span></span><span class="memory-face-caption"><strong>'+esc(K.cardById(d.cardId).name)+'</strong><span>'+esc(moodOf(d.mood).caption)+'</span></span><span class="memory-demo-mark">構圖示意</span>';
}
/* STATE.save 會吞配額錯誤，讀回確認後才算收下。寫入仍只走 APP.state。 */
function saveCard(d) {
  if (!d) return null;
  const before = cards(), item = Object.assign({},d,{id:'memory-'+Date.now()+'-'+before.length});
  APP.state.setToday({memoryCards:before.concat([item])});
  try {
    const stored = JSON.parse(localStorage.getItem('yoxi-chengshi-v1-2') || '{}');
    if (!((stored.today || {}).memoryCards || []).some(c => c.id === item.id)) throw new Error('not persisted');
  } catch(e) { APP.state.setToday({memoryCards:before}); return null; }
  return item;
}
APP.album.memory = {places:places, templates:templates, cards:cards, draft:draft, moods:moods, save:saveCard};
APP.view('lookback', {
  path:'/lookback', tab:null, status:'light', title:'回憶卡',
  render:function () {
    const T = templates();
    return '<div class="memory-room" data-memory-page><header class="memory-top"><a href="#" data-back="/album?tab=journal" aria-label="返回收藏"><span class="ic-ondark" data-icon="close"></span></a><span>遊喜樂</span><span>'+esc(APP.fmt.todayMMDD())+'</span></header><div class="scroll memory-scroll"><div class="memory-heading"><h1>把這一刻，留成卡。</h1><p data-memory-period>'+(T.today?'今天去過的地方，已經替你準備好了。':'今天還沒有新的足跡，先看看最近去過的地方。')+'</p></div>'+
    (T.places.length ? '<div class="memory-templates" data-memory-templates data-gallery role="region" aria-label="地點模板，左右滑動選擇">'+T.places.map(function(p,i){
      return '<button type="button" class="memory-face'+(!i?' is-selected':'')+'" data-act="pick-memory-template" data-card="'+esc(p.id)+'" data-memory-mood="good" aria-pressed="'+!i+'" aria-label="'+esc(p.name)+'模板">'+faceHTML(draft(p.id,'good'))+'</button>';
    }).join('')+'</div><p class="memory-swipe">'+(T.places.length>1?'左右滑，換一個地方':'這是你到訪的地方')+'</p><div class="memory-additions"><label class="memory-photo" data-act="add-memory-photo" tabindex="0"><span data-icon="camera"></span><span data-photo-label>放一張自己的照片</span><input type="file" accept="image/jpeg,image/png,image/webp" data-memory-upload hidden></label><button type="button" class="memory-remove-photo" data-act="remove-memory-photo" hidden>移除照片</button><div class="memory-moods" aria-label="這張卡的心情">'+moods.map((m,i)=>'<button type="button" data-act="memory-mood" data-mood="'+m.key+'" aria-pressed="'+!i+'"'+(!i?' class="is-on"':'')+'><span data-icon="'+m.icon+'"></span>'+esc(m.label)+'</button>').join('')+'</div></div><div class="memory-bottom"><button class="btn-primary" type="button" data-act="make-memory">做成我的卡</button><p class="memory-status" data-memory-status role="status">照片只留在這台裝置，不會上傳。</p><p class="memory-honesty">模板合成示意，尚未連接 AI 生圖。</p><p class="memory-credit" data-memory-credit></p></div><section class="memory-keeps" data-memory-keeps hidden><h2>留住的回憶</h2><div data-memory-saved data-gallery></div></section>' : '<div class="memory-empty"><p>抵達一個地方、收下明信片，這裡就會有你的模板。</p><a class="btn-primary" href="#/ride?mode=explore" data-act="go-ride">去看看附近</a></div>')+'</div></div>';
  },
  mount:function(root) {
    root.querySelector('a[data-back]').setAttribute('data-up','');
    const track = root.querySelector('[data-memory-templates]'); if (!track) return;
    const faces = Array.from(track.querySelectorAll('[data-act="pick-memory-template"]'));
    const make = root.querySelector('[data-act="make-memory"]'), upload = root.querySelector('[data-memory-upload]'), status = root.querySelector('[data-memory-status]');
    let selected=faces[0], mood='good', photo='', saved=false, savedDraft=null, busy=false, alive=true, readToken=0, scrollTimer;
    function update() {
      const d=savedDraft || draft(selected.getAttribute('data-card'),mood,photo);
      selected.innerHTML=faceHTML(d); selected.setAttribute('data-memory-mood',mood); SHELL.injectArt(selected);
      faces.forEach(f=>{f.classList.toggle('is-selected',f===selected);f.setAttribute('aria-pressed',String(f===selected));});
      root.querySelectorAll('[data-act="memory-mood"]').forEach(b=>{const on=b.getAttribute('data-mood')===mood;b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));});
      root.querySelector('[data-photo-label]').textContent=photo?'換一張自己的照片':'放一張自己的照片';
      root.querySelector('[data-act="remove-memory-photo"]').hidden=!photo;
      make.disabled=saved||busy; make.textContent=busy?'照片準備中…':saved?'已收進回憶卡':'做成我的卡';
      const ph=!photo && APP.explore.cardPhoto ? APP.explore.cardPhoto(d.cardId) : null;
      root.querySelector('[data-memory-credit]').textContent=ph?'底圖照片 © '+ph.author+' · '+ph.licence:'';
    }
    function resetResult(){saved=false;savedDraft=null;status.textContent='照片只留在這台裝置，不會上傳。';}
    function choose(f,scroll){if(f!==selected){selected=f;resetResult();update();}if(scroll)track.scrollTo({left:f.offsetLeft-faces[0].offsetLeft,behavior:APP.reduceMotion()?'auto':'smooth'});}
    faces.forEach(f=>{f.onclick=()=>choose(f,true);});
    track.onscroll=function(){clearTimeout(scrollTimer);scrollTimer=setTimeout(function(){const x=track.getBoundingClientRect().left;choose(faces.reduce((best,f)=>Math.abs(f.getBoundingClientRect().left-x)<Math.abs(best.getBoundingClientRect().left-x)?f:best,faces[0]),false);},100);};
    root.querySelectorAll('[data-act="memory-mood"]').forEach(b=>{b.onclick=function(){mood=b.getAttribute('data-mood');resetResult();update();};});
    root.querySelector('[data-act="add-memory-photo"]').onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();upload.click();}};
    upload.onchange=function(){
      const file=upload.files&&upload.files[0];upload.value='';if(!file)return;
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)){status.textContent='請選擇 JPG、PNG 或 WebP 照片。';return;}
      const token=++readToken;busy=true;update();const reader=new FileReader();
      function fail(){if(alive&&token===readToken){busy=false;update();status.textContent='照片讀取不到，換一張試試。';}}
      reader.onerror=fail;reader.onload=function(){const img=new Image();img.onerror=fail;img.onload=function(){
        if(!alive||token!==readToken)return;
        try{const scale=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);photo=canvas.toDataURL('image/jpeg',.78);busy=false;resetResult();update();}catch(e){fail();}
      };img.src=reader.result;};reader.readAsDataURL(file);
    };
    root.querySelector('[data-act="remove-memory-photo"]').onclick=function(){++readToken;busy=false;photo='';resetResult();update();};
    function paintSaved(){
      const list=cards();root.querySelector('[data-memory-keeps]').hidden=!list.length;
      const host=root.querySelector('[data-memory-saved]');
      host.innerHTML=list.slice().reverse().map(d=>'<button type="button" data-act="open-memory" data-memory-id="'+esc(d.id)+'" aria-label="'+esc(K.cardById(d.cardId).name+'，'+moodOf(d.mood).label+'，'+d.date)+'">'+artHTML(d)+'<span>'+esc(K.cardById(d.cardId).name)+'</span></button>').join('');SHELL.injectArt(host);
      host.querySelectorAll('[data-act="open-memory"]').forEach(b=>{b.onclick=function(){
        const d=cards().find(c=>c.id===b.getAttribute('data-memory-id'));if(!d)return;
        let f=faces.find(f=>f.getAttribute('data-card')===d.cardId);
        if(!f){f=document.createElement('button');f.type='button';f.className='memory-face';f.setAttribute('data-act','pick-memory-template');f.setAttribute('data-card',d.cardId);f.setAttribute('aria-label',K.cardById(d.cardId).name+'模板');track.appendChild(f);faces.push(f);f.onclick=()=>choose(f,true);}
        ++readToken;busy=false;selected=f;mood=d.mood;photo=d.photo||'';saved=true;savedDraft=d;update();choose(f,true);status.textContent='這張回憶卡已留在這裡。';selected.scrollIntoView({block:'nearest',behavior:APP.reduceMotion()?'auto':'smooth'});
      };});
    }
    make.onclick=function(){if(saved||busy)return;const item=saveCard(draft(selected.getAttribute('data-card'),mood,photo));if(!item){status.textContent='這台裝置暫時存不下，請換張較小的照片再試。';return;}saved=true;savedDraft=item;selected.classList.remove('is-made');void selected.offsetWidth;selected.classList.add('is-made');update();status.textContent='收下了，這一張是你的回憶。';paintSaved();};
    update();paintSaved();return function(){alive=false;++readToken;clearTimeout(scrollTimer);};
  }
});
})();

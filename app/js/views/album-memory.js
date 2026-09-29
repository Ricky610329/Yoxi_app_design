/* 遊喜樂：到訪模板＋自己的照片＋光線，一個動作收下本機合成的回憶卡。
   光線三選一（晴光／柔光／暮色）只改卡面色調與短句，不問使用者的心情；
   內部 key 與保存欄位仍叫 mood（good/ok/low），舊卡照常讀得回來。
   整頁不捲：卡片吃掉剩下的高度，其他列固定高。 */
(function () {
'use strict';
const esc = APP.esc, K = APP.album._;
const tic = body => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+body+'</svg>';
const moods = [
  { key:'good', label:'晴光', direction:'明亮晴光、鮮明暖色，畫面輕快開闊。', caption:'把喜歡的風景，留在這裡。',
    svg:tic('<circle cx="12" cy="12" r="4.8" fill="currentColor"/><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>') },
  { key:'ok', label:'柔光', direction:'雲層下的柔和日光、清爽低對比，構圖平衡安靜。', caption:'平凡的一天，也值得留下。',
    svg:tic('<g opacity=".6"><circle cx="16.6" cy="7.6" r="3.8" fill="currentColor"/><path d="M16.6 1.6v1.2M22.4 7.6h-1.2M20.8 3.4l-.9.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></g><circle cx="7" cy="15.2" r="4.2" fill="currentColor"/><circle cx="12.4" cy="11.6" r="5.2" fill="currentColor"/><circle cx="17.6" cy="15.4" r="4" fill="currentColor"/><rect x="7" y="15" width="10.6" height="4.4" fill="currentColor"/>') },
  { key:'low', label:'暮色', direction:'傍晚暮光、低彩度暖色，留白多一些。', caption:'在熟悉的城市裡，慢一點。',
    svg:tic('<path d="M6.4 15.6a5.6 5.6 0 0 1 11.2 0z" fill="currentColor"/><path d="M2.8 15.6h18.4M7 19.4h10M12 4.6v2.2M5 7.8l1.5 1.5M19 7.8l-1.5 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') }
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
  const d = {cardId:p.id, mood:m.key, date:APP.fmt.todayMMDD(), prompt:'以我去過的「'+p.name+'」模板製作城市回憶卡。光線是「'+m.label+'」：'+m.direction+'保留地點特色，不加入未到訪的地標。'};
  if (typeof photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(photo)) { d.photo = photo; d.prompt += '融入使用者照片，保留照片主體。'; }
  return d;
}
function artHTML(d) {
  const p = K.cardById(d.cardId);
  return d.photo ? '<img class="memory-own-photo" src="'+esc(d.photo)+'" alt="自己的照片">' : '<span class="memory-template-art" data-art="'+esc(p.art)+'" data-seed="'+K.cardIdx(p)+'" data-card-art="'+esc(p.id)+'"></span>';
}
/* 底圖署名印在卡面上（跟 /elder 一樣）：每張模板各自帶自己的出處；換成自己的照片就沒有 */
function faceHTML(d) {
  const ph = !d.photo && APP.explore.cardPhoto ? APP.explore.cardPhoto(d.cardId) : null;
  return '<div class="memory-art">'+artHTML(d)+'</div><span class="memory-stamp">遊喜樂<span>'+esc(d.date)+'</span></span><span class="memory-face-caption"><strong>'+esc(K.cardById(d.cardId).name)+'</strong><span class="memory-face-line">'+esc(moodOf(d.mood).caption)+'</span>'+(ph?'<small class="memory-face-credit" data-memory-credit>底圖照片 © '+esc(ph.author||'')+' · '+esc(ph.licence||'')+'</small>':'')+'</span><span class="memory-demo-mark">構圖示意</span>';
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
    return '<div class="memory-room" data-memory-page><header class="memory-top"><a href="#" data-back="/album?tab=journal" aria-label="返回收藏"><span class="ic-ondark" data-icon="close"></span></a><span>遊喜樂</span><span>'+esc(APP.fmt.todayMMDD())+'</span></header><div class="memory-body"><div class="memory-heading"><h1>把這一刻，留成卡。</h1><p data-memory-period>'+(T.today?'今天去過的地方，已經替你準備好了。':'今天還沒有新的足跡，先看看最近去過的地方。')+'</p></div>'+
    (T.places.length ? '<div class="memory-stage"><div class="memory-templates" data-memory-templates data-gallery role="region" aria-label="地點模板，左右滑動選擇">'+T.places.map(function(p,i){
      return '<button type="button" class="memory-face'+(!i?' is-selected':'')+'" data-act="pick-memory-template" data-card="'+esc(p.id)+'" data-memory-mood="good" aria-pressed="'+!i+'" aria-label="'+esc(p.name)+'模板">'+faceHTML(draft(p.id,'good'))+'</button>';
    }).join('')+'</div></div><p class="memory-meta">'+(T.places.length>1?'左右滑，換一個地方':'這是你到訪的地方')+'</p>'+
    '<div class="memory-tones" role="group" aria-label="這張卡的光線">'+moods.map((m,i)=>'<button type="button" data-act="memory-mood" data-mood="'+m.key+'" aria-pressed="'+!i+'"'+(!i?' class="is-on"':'')+'><span class="memory-tone-ic">'+m.svg+'</span>'+esc(m.label)+'</button>').join('')+'</div>'+
    '<div class="memory-photo-row"><label class="memory-photo" data-act="add-memory-photo" tabindex="0"><span data-icon="camera"></span><span data-photo-label>放一張自己的照片</span><input type="file" accept="image/jpeg,image/png,image/webp" data-memory-upload hidden></label><button type="button" class="memory-remove-photo" data-act="remove-memory-photo" hidden>移除照片</button></div>'+
    '<div class="memory-bottom"><button class="btn-primary" type="button" data-act="make-memory">做成我的卡</button><p class="memory-status" data-memory-status role="status">照片只留在這台裝置，不會上傳。</p><p class="memory-honesty">模板合成示意，尚未連接 AI 生圖。</p></div>'+
    '<section class="memory-keeps" data-memory-keeps><h2>留住的回憶</h2><p class="memory-keeps-empty" data-memory-keeps-empty>做好的卡會收在這裡</p><div data-memory-saved data-gallery></div></section>' : '<div class="memory-empty"><p>抵達一個地方、收下明信片，這裡就會有你的模板。</p><a class="btn-primary" href="#/ride?mode=explore" data-act="go-ride">去看看附近</a></div>')+'</div></div>';
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
    }
    function resetResult(){saved=false;savedDraft=null;status.textContent='照片只留在這台裝置，不會上傳。';}
    function choose(f,scroll){if(f!==selected){selected=f;resetResult();update();}if(scroll)track.scrollTo({left:f.offsetLeft-faces[0].offsetLeft,behavior:APP.reduceMotion()?'auto':'smooth'});}
    faces.forEach(f=>{f.onclick=()=>choose(f,true);});
    /* 卡片置中對齊：第一張在 scrollLeft 0 就置中，所以 choose() 的位移照舊；停下來時挑中心最近的那張 */
    const mid=el=>{const r=el.getBoundingClientRect();return r.left+r.width/2;};
    track.onscroll=function(){clearTimeout(scrollTimer);scrollTimer=setTimeout(function(){const x=mid(track);choose(faces.reduce((best,f)=>Math.abs(mid(f)-x)<Math.abs(mid(best)-x)?f:best,faces[0]),false);},100);};
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
      /* 收納列一直在（沒有卡時是一句說明），收下第一張時卡片不會突然變小 */
      const list=cards();root.querySelector('[data-memory-keeps-empty]').hidden=!!list.length;
      const host=root.querySelector('[data-memory-saved]');
      host.innerHTML=list.slice().reverse().map(d=>'<button type="button" data-act="open-memory" data-memory-id="'+esc(d.id)+'" aria-label="'+esc(K.cardById(d.cardId).name+'，'+moodOf(d.mood).label+'，'+d.date)+'">'+artHTML(d)+'</button>').join('');SHELL.injectArt(host);
      host.querySelectorAll('[data-act="open-memory"]').forEach(b=>{b.onclick=function(){
        const d=cards().find(c=>c.id===b.getAttribute('data-memory-id'));if(!d)return;
        let f=faces.find(f=>f.getAttribute('data-card')===d.cardId);
        if(!f){f=document.createElement('button');f.type='button';f.className='memory-face';f.setAttribute('data-act','pick-memory-template');f.setAttribute('data-card',d.cardId);f.setAttribute('aria-label',K.cardById(d.cardId).name+'模板');track.appendChild(f);faces.push(f);f.onclick=()=>choose(f,true);}
        ++readToken;busy=false;selected=f;mood=d.mood;photo=d.photo||'';saved=true;savedDraft=d;update();choose(f,true);status.textContent='這張回憶卡已留在這裡。';
      };});
    }
    make.onclick=function(){if(saved||busy)return;const item=saveCard(draft(selected.getAttribute('data-card'),mood,photo));if(!item){status.textContent='這台裝置暫時存不下，請換張較小的照片再試。';return;}saved=true;savedDraft=item;selected.classList.remove('is-made');void selected.offsetWidth;selected.classList.add('is-made');update();status.textContent='收下了，這一張是你的回憶。';paintSaved();};
    update();paintSaved();return function(){alive=false;++readToken;clearTimeout(scrollTimer);};
  }
});
})();

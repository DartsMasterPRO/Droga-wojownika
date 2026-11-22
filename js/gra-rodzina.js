/* Pojedynek rodzinny – gra dla dwojga na jednym telefonie („Droga wojownika”).
   Zwykły skrypt. Publiczne API: window.Games.rodzina.open() / .close().
   Telefon leży płasko na stole: dolna połowa = gracz 1 (AKA), górna (obrócona o 180°) = gracz 2 (AO).
   Korzysta z mostka window.DW (index.html). */
(function(){
'use strict';

/* ---------- stałe ---------- */
const FONT="'Barlow Condensed','Arial Narrow',sans-serif";
const WIN=3;
const GOLD='#f2c14e',GOLD2='#ffe08a';
const PC=[{c:'#e2452b',l:'#ff8a75',d:'#7d1a0e',rgb:'226,69,43',tag:'AKA'},{c:'#3b82f6',l:'#8cb8ff',d:'#143a80',rgb:'59,130,246',tag:'AO'}];
const JP=['ICHI','NI','SAN','YON','GO','ROKU','NANA','HACHI','KYŪ','JŪ'];
const ARW={up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2};
const DIRS=['up','right','down','left'];
const FAKES=[['HA… HA… HAPSIK!','Sensei kichnął!'],['HAMBURGER!','To nie było hajime!'],['HAJI… MAKI!','Sushi? Nie ruszaj się!'],['HAI!','„Hai” znaczy „tak”'],['HA… HALO?','Sensei odbiera telefon'],['HAJI… JAJKO!','Nie daj się nabrać!']];

const DW=()=>window.DW||{};
const S_=()=>{try{return DW().getS()||{}}catch(e){return {}}};
const muted=()=>!!S_().mute;
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=n=>Math.floor(Math.random()*n);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const easeOutBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const call_=(f,...a)=>{try{const fn=DW()[f];return fn&&fn(...a)}catch(e){}};

/* ---------- dźwięk ---------- */
let noiseBuf=null;
function ac(){if(muted())return null;try{return DW().actx()}catch(e){return null}}
function noise(a){if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate)return noiseBuf;const n=a.sampleRate*.5,b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return noiseBuf=b}
function nz(a,t,dur,type,f0,f1,vol){const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noise(a);f.type=type;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);f.connect(g);g.connect(a.destination);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t,Math.random()*.3);s.stop(t+dur+.02)}
function tone(a,t,type,f0,f1,dur,vol){const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.02)}
const SFX={
 hit(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',170,55,.16,.7);nz(a,t,.07,'lowpass',1800,400,.5)},
 knock(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',rnd(280,340),170,.07,.45);nz(a,t,.04,'bandpass',1400,0,.3)},
 crack(){const a=ac();if(!a)return;const t=a.currentTime;nz(a,t,.25,'highpass',900,0,.7);tone(a,t,'square',220,60,.12,.22);tone(a,t,'sine',120,40,.3,.8)},
 wrong(){const a=ac();if(!a)return;tone(a,a.currentTime,'sawtooth',220,140,.18,.09)},
 whoosh(){const a=ac();if(!a)return;nz(a,a.currentTime,.14,'bandpass',600,2200,.2)},
 good(n){const a=ac();if(!a)return;const P=[523,587,659,784,880,1047,1175,1319,1568,1760];tone(a,a.currentTime,'triangle',P[clamp(n,0,9)],0,.16,.18)},
 drum(acc){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',acc?150:120,45,.28,acc?.9:.6);nz(a,t,.05,'lowpass',900,200,acc?.4:.25)},
 hajime(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'square',880,0,.22,.16);tone(a,t,'square',1320,0,.22,.1);tone(a,t,'sine',180,60,.25,.8);nz(a,t,.1,'highpass',2000,0,.3)},
 fake(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',660,520,.15,.12);tone(a,t+.12,'triangle',520,390,.2,.1)},
 point(){const a=ac();if(!a)return;const t=a.currentTime;[784,988,1175,1568].forEach((f,i)=>tone(a,t+i*.07,'triangle',f,0,.22,.18))},
 tick(){const a=ac();if(!a)return;tone(a,a.currentTime,'square',1200,0,.04,.05)},
 foul(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sawtooth',300,120,.4,.12)}
};
const buzz=p=>{if(muted())return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};

/* ---------- grafiki (cache) ---------- */
const CACHE=new Map();
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c}
function spr(key,w,h,fn){const k=key+'|'+Math.round(w)+'|'+Math.round(h)+'|'+DPR;let c=CACHE.get(k);if(c)return c;
 if(CACHE.size>60)CACHE.clear();c=mk(w*DPR,h*DPR);const x=c.getContext('2d');x.scale(DPR,DPR);fn(x,w,h);CACHE.set(k,c);return c}
function rr(x,a,b,w,h,r){r=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
function padSpr(r,on){return spr(on?'pad':'padoff',r*2.3,r*2.3,(x,s)=>{const m=s/2;
 x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(m,m+r*.12,r*1.02,r*1.02,0,0,7);x.fill();
 const g=x.createRadialGradient(m-r*.35,m-r*.4,r*.1,m,m,r);
 if(on){g.addColorStop(0,'#ff6b5a');g.addColorStop(.7,'#d42a1e');g.addColorStop(1,'#8e140d')}else{g.addColorStop(0,'#6b7280');g.addColorStop(.7,'#3d434f');g.addColorStop(1,'#22262e')}
 x.fillStyle=g;x.beginPath();x.arc(m,m,r,0,7);x.fill();
 x.strokeStyle=on?'#fff':'rgba(255,255,255,.35)';x.lineWidth=r*.12;x.beginPath();x.arc(m,m,r*.62,0,7);x.stroke();
 x.fillStyle=on?'#fff':'rgba(255,255,255,.35)';x.beginPath();x.arc(m,m,r*.26,0,7);x.fill();
 x.fillStyle=on?GOLD:'rgba(255,255,255,.2)';x.beginPath();x.arc(m,m,r*.15,0,7);x.fill();
 x.fillStyle='rgba(255,255,255,.25)';x.beginPath();x.ellipse(m-r*.38,m-r*.45,r*.32,r*.16,-.6,0,7);x.fill()})}
function boardSpr(w,h){return spr('board',w,h,(x)=>{
 const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f3cf93');g.addColorStop(.5,'#dba862');g.addColorStop(1,'#a8743a');
 x.fillStyle=g;rr(x,0,0,w,h,h*.18);x.fill();
 x.strokeStyle='rgba(110,60,20,.4)';x.lineWidth=Math.max(1,h*.06);
 for(let i=0;i<3;i++){x.beginPath();const y=h*(.25+i*.25);x.moveTo(w*.04,y);x.bezierCurveTo(w*.3,y+h*.12*Math.sin(i*2+1),w*.65,y-h*.12,w*.96,y+h*.04);x.stroke()}
 x.beginPath();x.ellipse(w*.72,h*.5,h*.28,h*.13,0,0,7);x.stroke();
 x.strokeStyle='rgba(255,240,210,.55)';x.lineWidth=Math.max(1,h*.06);rr(x,1,1,w-2,h-2,h*.16);x.stroke()})}
function blockSpr(w,h){return spr('block',w,h,(x)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#9aa0a8');g.addColorStop(1,'#5d636c');x.fillStyle=g;rr(x,0,0,w,h,4);x.fill();
 x.fillStyle='rgba(30,34,40,.55)';rr(x,w*.15,h*.25,w*.28,h*.5,3);x.fill();rr(x,w*.57,h*.25,w*.28,h*.5,3);x.fill()})}
function drumSpr(r){return spr('drum',r*2.4,r*2.4,(x,s)=>{const m=s/2;
 x.fillStyle='rgba(0,0,0,.4)';x.beginPath();x.arc(m,m+r*.1,r*1.12,0,7);x.fill();
 let g=x.createRadialGradient(m,m,r*.8,m,m,r*1.1);g.addColorStop(0,'#7a3414');g.addColorStop(1,'#3f1a08');x.fillStyle=g;x.beginPath();x.arc(m,m,r*1.1,0,7);x.fill();
 x.fillStyle='#d8b24a';for(let i=0;i<16;i++){const a=i/16*Math.PI*2;x.beginPath();x.arc(m+Math.cos(a)*r*1.0,m+Math.sin(a)*r*1.0,r*.045,0,7);x.fill()}
 g=x.createRadialGradient(m-r*.3,m-r*.3,r*.1,m,m,r*.9);g.addColorStop(0,'#fff6e3');g.addColorStop(1,'#d9c39b');x.fillStyle=g;x.beginPath();x.arc(m,m,r*.88,0,7);x.fill();
 // tomoe
 x.fillStyle='#c0392b';for(let i=0;i<3;i++){x.save();x.translate(m,m);x.rotate(i*Math.PI*2/3);x.beginPath();x.arc(0,-r*.22,r*.17,0,7);x.fill();
  x.beginPath();x.moveTo(r*.17,-r*.22);x.quadraticCurveTo(r*.35,r*.12,r*.02,r*.34);x.quadraticCurveTo(r*.18,r*.05,-r*.0,-r*.06);x.fill();x.restore()}
 x.strokeStyle='rgba(120,80,30,.35)';x.lineWidth=r*.04;x.beginPath();x.arc(m,m,r*.7,0,7);x.stroke()})}
function trophySpr(s){return spr('trophy',s,s*1.15,(x,w,h)=>{const c=w/2;
 const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'#b8860b');g.addColorStop(.45,'#ffe08a');g.addColorStop(.6,'#f2c14e');g.addColorStop(1,'#a8740a');
 x.fillStyle=g;x.strokeStyle=g;x.lineWidth=w*.07;
 x.beginPath();x.arc(w*.2,h*.27,w*.14,Math.PI*.5,Math.PI*1.5);x.stroke();x.beginPath();x.arc(w*.8,h*.27,w*.14,-Math.PI*.5,Math.PI*.5);x.stroke();
 x.beginPath();x.moveTo(w*.18,h*.1);x.lineTo(w*.82,h*.1);x.bezierCurveTo(w*.82,h*.48,w*.66,h*.58,c,h*.6);x.bezierCurveTo(w*.34,h*.58,w*.18,h*.48,w*.18,h*.1);x.fill();
 x.fillRect(c-w*.06,h*.58,w*.12,h*.16);rr(x,w*.28,h*.72,w*.44,h*.1,4);x.fill();
 x.fillStyle='#3a2a10';rr(x,w*.22,h*.82,w*.56,h*.14,5);x.fill();x.fillStyle=GOLD;x.fillRect(w*.34,h*.86,w*.32,h*.05);
 x.fillStyle='rgba(255,255,255,.45)';x.beginPath();x.ellipse(w*.36,h*.25,w*.06,h*.12,.2,0,7);x.fill();
 x.fillStyle='#fff';x.font=`italic 800 ${Math.round(w*.2)}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillText('1',c,h*.32)})}
function medalSpr(s){return spr('medal',s,s*1.3,(x,w,h)=>{const c=w/2;
 x.fillStyle='#2f6fe0';x.beginPath();x.moveTo(w*.25,0);x.lineTo(w*.45,0);x.lineTo(c+w*.05,h*.5);x.lineTo(c-w*.12,h*.5);x.fill();
 x.fillStyle='#e2452b';x.beginPath();x.moveTo(w*.75,0);x.lineTo(w*.55,0);x.lineTo(c-w*.05,h*.5);x.lineTo(c+w*.12,h*.5);x.fill();
 const g=x.createRadialGradient(c-w*.1,h*.62,w*.05,c,h*.68,w*.34);g.addColorStop(0,'#ffffff');g.addColorStop(.6,'#c3cad3');g.addColorStop(1,'#7d8794');
 x.fillStyle=g;x.beginPath();x.arc(c,h*.68,w*.32,0,7);x.fill();x.strokeStyle='#e6ebf0';x.lineWidth=w*.04;x.beginPath();x.arc(c,h*.68,w*.24,0,7);x.stroke();
 x.fillStyle='#4b5563';x.font=`italic 800 ${Math.round(w*.26)}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillText('OSU',c,h*.69)})}

const IMG={};
function loadImg(src){if(IMG[src])return IMG[src];const i=new Image();i.decoding='async';i.src=src;IMG[src]=i;return i}
function scaled(img,h){if(!img||!img.complete||!img.naturalWidth)return null;const k=img._k||(img._k={});if(k[h])return k[h];const c=mk(h*img.naturalWidth/img.naturalHeight,h);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return k[h]=c}

/* ---------- CSS ---------- */
const CSS=`
#g-rodzina{position:fixed;inset:0;z-index:9000;background:#07090d;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;color:#f1f2f4;font-family:Barlow,system-ui,sans-serif}
#g-rodzina .gr-bg{position:absolute;left:0;right:0;height:50%;background-size:cover;background-position:center 60%;overflow:hidden}
#g-rodzina .gr-bg.gr-b{bottom:0}
#g-rodzina .gr-bg.gr-t{top:0;transform:rotate(180deg)}
#g-rodzina .gr-bg::after{content:'';position:absolute;inset:0}
#g-rodzina .gr-bg.gr-b::after{background:linear-gradient(180deg,rgba(226,69,43,.35),rgba(7,9,13,.78) 30%,rgba(7,9,13,.82))}
#g-rodzina .gr-bg.gr-t::after{background:linear-gradient(180deg,rgba(59,130,246,.38),rgba(7,9,13,.78) 30%,rgba(7,9,13,.82))}
#g-rodzina canvas.gr-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#g-rodzina .gr-pz{position:absolute;left:8px;top:calc(50% - 21px);width:42px;height:42px;min-height:0;padding:0;border-radius:50%;background:rgba(17,20,27,.85);border:1px solid rgba(242,193,78,.5);display:grid;place-items:center;color:#f1f2f4;z-index:2}
#g-rodzina.gr-menu .gr-pz,#g-rodzina.gr-fin .gr-pz{display:none}
#g-rodzina .gr-scr{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:rgba(7,9,13,.86);backdrop-filter:blur(3px);z-index:3}
#g-rodzina .gr-scr[hidden]{display:none}
#g-rodzina .gr-in{max-width:460px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) 18px calc(20px + env(safe-area-inset-bottom));min-height:100%;display:flex;flex-direction:column}
#g-rodzina .gr-ib{width:44px;height:44px;min-height:0;padding:0;border-radius:50%;background:rgba(17,20,27,.75);border:1px solid rgba(255,255,255,.14);display:grid;place-items:center;color:#f1f2f4;align-self:flex-end}
#g-rodzina .gr-kick{color:${GOLD};font-weight:600;font-size:14px;margin:0 0 2px;letter-spacing:.4px;text-transform:uppercase}
#g-rodzina h2.gr-t{font:italic 800 44px/.95 ${FONT};margin:0;color:${GOLD2};text-shadow:0 3px 0 rgba(0,0,0,.5);letter-spacing:.5px}
#g-rodzina .gr-hero{position:relative;height:132px;margin:4px 0 6px;display:flex;justify-content:center;align-items:flex-end;gap:4px}
#g-rodzina .gr-hero::before{content:'';position:absolute;left:50%;bottom:2px;width:260px;height:24px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(242,193,78,.4),transparent)}
#g-rodzina .gr-hero img{position:relative;height:128px;width:auto;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6))}
#g-rodzina .gr-hero img.gr-p2{height:104px;transform:scaleX(-1)}
#g-rodzina .gr-vs{position:relative;align-self:center;font:italic 800 38px/1 ${FONT};color:${GOLD2};text-shadow:0 3px 0 rgba(0,0,0,.6);margin:0 2px}
#g-rodzina .gr-card{background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:16px;padding:10px 12px;margin:0 0 10px}
#g-rodzina .gr-pl{display:flex;align-items:center;gap:10px}
#g-rodzina .gr-pl+.gr-pl{margin-top:8px}
#g-rodzina .gr-dot{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font:italic 800 15px/1 ${FONT};color:#fff;letter-spacing:.4px}
#g-rodzina .gr-pl label{flex:1;display:block;font-size:12.5px;color:#9aa2af}
#g-rodzina .gr-pl input{display:block;width:100%;box-sizing:border-box;margin-top:2px;height:42px;border-radius:10px;border:1px solid #2c3240;background:#0d1016;color:#f1f2f4;font:600 17px Barlow,system-ui,sans-serif;padding:0 10px}
#g-rodzina .gr-pl input:focus{outline:none;border-color:${GOLD}}
#g-rodzina .gr-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0 54px}
#g-rodzina .gr-chips button{min-height:34px;padding:0 12px;border-radius:99px;font-size:14px}
#g-rodzina .gr-chips button.on{border-color:${GOLD};background:rgba(242,193,78,.16);color:${GOLD2}}
#g-rodzina .gr-h3{font:700 19px/1.1 ${FONT};margin:2px 0 6px}
#g-rodzina .gr-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#g-rodzina .gr-seg button{min-height:42px;padding:0 6px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#g-rodzina .gr-seg button.on{border-color:${GOLD};background:rgba(242,193,78,.18);color:${GOLD2};font-weight:700}
#g-rodzina .gr-note{font-size:13px;color:#9aa2af;margin:6px 0 0;line-height:1.3}
#g-rodzina details.gr-card summary{cursor:pointer;font:700 19px/1.1 ${FONT};list-style:none;display:flex;justify-content:space-between;align-items:center;min-height:30px}
#g-rodzina details.gr-card summary::-webkit-details-marker{display:none}
#g-rodzina details.gr-card summary::after{content:'+';color:${GOLD};font-size:24px}
#g-rodzina details[open].gr-card summary::after{content:'–'}
#g-rodzina .gr-row{display:flex;gap:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06);font-size:14.5px;line-height:1.3}
#g-rodzina .gr-row b.gr-n{flex:none;width:24px;height:24px;border-radius:50%;background:rgba(242,193,78,.18);color:${GOLD2};display:grid;place-items:center;font:800 15px/1 ${FONT}}
#g-rodzina .gr-row small{display:block;color:#9aa2af;font-size:13px}
#g-rodzina .gr-stats{display:flex;gap:8px;margin:0 0 10px}
#g-rodzina .gr-stats>div{flex:1;background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:14px;padding:7px 6px;text-align:center;min-width:0}
#g-rodzina .gr-stats b{display:block;font:800 24px/1.1 ${FONT};color:${GOLD}}
#g-rodzina .gr-stats span{font-size:12px;color:#9aa2af;line-height:1.2;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#g-rodzina .gr-btns{display:grid;gap:10px;margin-top:auto;padding-top:6px}
#g-rodzina .gr-stick{position:sticky;bottom:0;padding:10px 0 calc(4px + env(safe-area-inset-bottom));margin-bottom:calc(-20px - env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(7,9,13,0),rgba(7,9,13,.95) 30%)}
#g-rodzina .gr-pause{display:flex;flex-direction:column;justify-content:center;gap:12px;min-height:100%;max-width:340px;margin:0 auto;padding:24px}
#g-rodzina .gr-pause h2{text-align:center;font:italic 800 48px/1 ${FONT};color:${GOLD2};margin:0 0 6px}
#g-rodzina .gr-sheet{position:absolute;left:0;right:0;bottom:0;height:50%;z-index:3;background:linear-gradient(180deg,#0d1016,#07090d);border-top:2px solid rgba(242,193,78,.55);box-shadow:0 -10px 40px rgba(0,0,0,.6);transform:translateY(105%);transition:transform .45s cubic-bezier(.2,1.1,.3,1);touch-action:pan-y;overflow-y:auto}
#g-rodzina .gr-sheet.on{transform:none}
#g-rodzina .gr-sheet[hidden]{display:none}
#g-rodzina .gr-sh{max-width:460px;margin:0 auto;min-height:100%;box-sizing:border-box;padding:10px 16px calc(12px + env(safe-area-inset-bottom));display:flex;flex-direction:column;justify-content:space-between;gap:6px;text-align:center}
#g-rodzina .gr-sh h2{font:italic 800 34px/1 ${FONT};color:${GOLD2};margin:0;text-shadow:0 3px 0 rgba(0,0,0,.5)}
#g-rodzina .gr-vsr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px}
#g-rodzina .gr-vsr>div{min-width:0}
#g-rodzina .gr-vsr b{display:block;font:italic 800 46px/1 ${FONT}}
#g-rodzina .gr-vsr span{display:block;font:700 18px/1.1 ${FONT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#g-rodzina .gr-vsr svg{display:block;margin:0 auto}
#g-rodzina .gr-coins{margin:0;font-size:14.5px;color:#c9ced6}
#g-rodzina .gr-coins b{color:${GOLD}}
#g-rodzina .gr-b3{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#g-rodzina .gr-b3 .btn-p{grid-column:1/-1}
#g-rodzina .gr-b3 button{min-height:50px;padding:0 6px;font-size:17px}
`;

/* ---------- stan ---------- */
let root=null,cv=null,cx=null,els={},raf=0,lastT=0,W=0,H=0,Hh=0,DPR=1,listeners=[],G=null,INS={t:0,b:0};
let imgP=[null,null];
function on(t,ev,fn,opt){t.addEventListener(ev,fn,opt);listeners.push([t,ev,fn,opt])}

function stats(){const S=S_();S.games=S.games||{};const r=S.games.rodzina=S.games.rodzina||{played:0,wins:{}};r.wins=r.wins||{};return r}
function coinsLeft(){const S=S_(),p=S.paid||{};let d='';try{d=DW().today()}catch(e){}let n=0;['0','1'].forEach(k=>{if(!p['gr'+d+'-'+k])n+=5});return n}

/* ---------- geometria połówek ----------
   Każda połowa ma lokalny układ: x 0..W, y 0..Hh; y=0 to linia środkowa, y=Hh to krawędź gracza. */
function lay(p){const e=p?INS.t:INS.b,h=Hh,sm=h<350;
 const y0=sm?104:124,y1=h-e-12;
 return {w:W,h,e,hudY:sm?24:28,callY:sm?58:68,subY:sm?84:98,y0,y1,cx:W/2,cy:(y0+y1)/2,ah:y1-y0}}
function toLocal(sx,sy){const p=sy<H/2?1:0;return p?{p,x:W-sx,y:H/2-sy}:{p,x:sx,y:sy-H/2}}

function resize(){
 if(!root)return;
 DPR=Math.min(2,window.devicePixelRatio||1);W=root.clientWidth;H=root.clientHeight;Hh=H/2;
 cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
 try{const cs=getComputedStyle(els.probe);INS.t=parseFloat(cs.paddingTop)||0;INS.b=parseFloat(cs.paddingBottom)||0}catch(e){}
 if(G&&!raf)draw();
}

/* ---------- efekty (per połowa) ---------- */
function fx(p){return G.fx[p]}
function burst(p,x,y,col,n,sp){const P=fx(p).parts;if(P.length>240)P.splice(0,P.length-240);
 for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rnd(.3,1)*sp;P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*.25,life:rnd(.35,.7),age:0,s:rnd(3,7),c:col,g:600})}}
function chips(p,x,y,n,col){const P=fx(p).parts;for(let i=0;i<n;i++){const a=rnd(-Math.PI*.95,-Math.PI*.05),v=rnd(150,380);P.push({x:x+rnd(-20,20),y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.6,1),age:0,s:rnd(4,9),c:col,g:900,rect:1,rot:rnd(0,6),vr:rnd(-12,12)})}}
const CONF=['#f2c14e','#ffe08a','#e2452b','#3b82f6','#3aa655','#ffffff','#ff7ab8'];
function confetti(p,n){const P=fx(p).parts;if(P.length>260)return;for(let i=0;i<n;i++)P.push({x:rnd(0,W),y:rnd(-30,10),vx:rnd(-60,60),vy:rnd(60,220),life:rnd(1.6,2.6),age:0,s:rnd(4,8),c:CONF[ri(CONF.length)],g:90,rect:1,rot:rnd(0,6),vr:rnd(-9,9),sway:rnd(0,6)})}
function ftext(p,x,y,txt,col,size,sub){const T=fx(p).texts;T.push({x,y,txt,col,size,sub,age:0,life:.9});if(T.length>6)T.shift()}
function ring(p,x,y,r0,col){fx(p).rings.push({x,y,r0,age:0,life:.4,col})}
function shake(p,a){if(!G.calm)fx(p).shake=Math.max(fx(p).shake,a)}
function flash(p,a,c){const f=fx(p);f.flash=Math.max(f.flash,a);f.flashC=c||'255,255,255'}
function setCall(jp,pl,col){G.call={jp,pl,col:col||GOLD2,age:0}}

/* ---------- mini-gry ---------- */
const GAMES={
/* 1. Refleks sensei */
refleks:{t:'Refleks sensei',jp:'HAJIME!',
 how:['Czekaj na „HAJIME!” i stuknij pierwszy.','Za wcześnie = falstart!'],
 hhow:['Po „HAJIME!” trafiaj w tarczę.','Fory: tarcza jest mała.'],
 init(R){R.phase='wait';R.hT=rnd(2.2,4.8);R.fakes=[];const n=Math.random()<.8?(Math.random()<.45?2:1):0,pool=shuffle(FAKES.slice());
  for(let i=0;i<n;i++){const t=rnd(.9,R.hT-.9);if(R.fakes.every(f=>Math.abs(f.t-t)>1.1)&&t>.8)R.fakes.push({t,txt:pool[i]})}R.fakes.sort((a,b)=>a.t-b.t);R.miss=[0,0]},
 start(){setCall('MATE…','Czekaj na sygnał sensei','#c9ced6')},
 upd(R){for(const f of R.fakes){if(!f.on&&R.t>=f.t){f.on=1;setCall(f.txt[0],f.txt[1],'#ffb04e');SFX.fake();shake(0,3);shake(1,3)}
   if(f.on===1&&R.t>=f.t+.85){f.on=2;if(R.phase==='wait')setCall('MATE…','Jeszcze nie!','#c9ced6')}}
  if(R.phase==='wait'&&R.t>=R.hT){R.phase='go';R.goT=R.t;setCall('HAJIME!','Stukaj!',GOLD2);SFX.hajime();buzz(30);flash(0,.35,'255,224,138');flash(1,.35,'255,224,138')}
  if(R.phase==='go'&&R.t-R.goT>3)endRound(-1,{why:'slow'})},
 padR(L,p){const r=clamp(Math.min(L.ah*.36,W*.28),38,110);return G.pl[p].hand?r*.58:r},
 down(R,p,x,y,L,tn){
  if(R.phase==='wait'){endRound(1-p,{foul:p});return}
  const r=this.padR(L,p);
  if(G.pl[p].hand&&Math.hypot(x-L.cx,y-L.cy)>r+10){R.miss[p]++;SFX.wrong();ftext(p,x,y-20,'Pudło! Trafiaj w tarczę','#ffffff',22);return}
  const ms=Math.max(1,Math.round((tn-R.goT)*1000));SFX.hit();burst(p,L.cx,L.cy,GOLD2,24,420);ring(p,L.cx,L.cy,r,'255,255,255');
  endRound(p,{ms,info:'Czas reakcji: '+(ms/1000).toFixed(3).replace('.',',')+' s'})},
 draw(x,p,R,L){const r=this.padR(L,p),go=R.phase==='go',pul=go?1+.06*Math.sin((R.t-R.goT)*18):1;
  if(go){const k=((R.t-R.goT)*1.6)%1;x.globalAlpha=1-k;x.strokeStyle=GOLD2;x.lineWidth=4;x.beginPath();x.arc(L.cx,L.cy,r*(1+k*.8),0,7);x.stroke();x.globalAlpha=1}
  const s=padSpr(r,go),w=s.width/DPR*pul;x.drawImage(s,L.cx-w/2,L.cy-w/2,w,w);
  textC(x,go?'TERAZ!':'czekaj…',L.cx,Math.min(L.y1-10,L.cy+r*1.15+16),go?24:19,go?GOLD2:'#9aa2af')}
},
/* 2. Tameshiwari */
wari:{t:'Tameshiwari',jp:'TAMESHIWARI!',
 how:['Stukaj w swoją połowę jak najszybciej!','Rozbij 5 desek przed rywalem.'],
 hhow:['Stukaj w swoją połowę jak najszybciej!','Fory: twoje deski są twardsze.'],
 init(R){R.need=[0,1].map(p=>G.pl[p].hand?30:20);R.hits=[0,0];R.last=[0,0];R.wob=[0,0];R.bk=[[],[]];R.limit=12},
 start(){setCall('TAMESHIWARI!','Rozbij deski – stukaj!',GOLD2)},
 boards(R,p){return Math.floor(R.hits[p]*5/R.need[p]+1e-9)},
 down(R,p,x,y,L){const now=performance.now();if(now-R.last[p]<55)return;R.last[p]=now;
  const b0=this.boards(R,p);R.hits[p]++;R.wob[p]=1;SFX.knock();buzz(8);burst(p,x,y,'#f0c98a',5,200);
  const g=this.geo(L);const b1=this.boards(R,p);
  if(b1>b0){SFX.crack();buzz([15,20,30]);const by=g.top+(b0)*(g.bh+g.gap)+g.bh/2;chips(p,L.cx,by,12,'#d9a45c');shake(p,7);R.bk[p].push({age:0,y:by});ftext(p,L.cx+g.bw*.5,by-10,'KRAK!',GOLD2,26)}
  if(R.hits[p]>=R.need[p])endRound(p,{info:'Rozbite 5 desek!'})},
 anim(R,dt){for(const p of [0,1]){R.wob[p]=Math.max(0,R.wob[p]-dt*6);for(const b of R.bk[p])b.age+=dt;R.bk[p]=R.bk[p].filter(b=>b.age<.6)}},
 geo(L){const bw=Math.min(W*.56,210),bh=clamp(Math.min(bw*.17,(L.ah-46)/7.2),12,32),gap=3,blk=bh*1.5,base=L.y1-6-blk,top=base-5*(bh+gap);return {bw,bh,gap,blk,base,top}},
 upd(R,dt){if(R.t>=R.limit){const a=R.hits[0]/R.need[0],b=R.hits[1]/R.need[1];endRound(Math.abs(a-b)<.001?-1:a>b?0:1,{why:'time'})}},
 draw(x,p,R,L){const g=this.geo(L),left=5-this.boards(R,p),wob=R.wob[p];
  // bloczki
  const bs=blockSpr(g.bw*.24,g.blk);x.drawImage(bs,L.cx-g.bw*.5,g.base,g.bw*.24,g.blk);x.drawImage(bs,L.cx+g.bw*.26,g.base,g.bw*.24,g.blk);
  const bsp=boardSpr(g.bw,g.bh);
  for(let i=0;i<left;i++){const y=g.base-(i+1)*(g.bh+g.gap)+g.gap,isTop=i===left-1,dx=isTop?Math.sin(wob*30)*4*wob:0;
   x.drawImage(bsp,L.cx-g.bw/2+dx,y,g.bw,g.bh);
   if(isTop){const per=R.need[p]/5,fr=(R.hits[p]-(5-left)*per)/per;if(fr>0){x.strokeStyle='rgba(60,30,10,.9)';x.lineWidth=2;x.beginPath();x.moveTo(L.cx+dx,y);
     const n=Math.ceil(fr*4);for(let k=1;k<=n;k++)x.lineTo(L.cx+dx+(k%2?6:-6)*(1+k*.2),y+g.bh*k/4);x.stroke()}}}
  for(const b of R.bk[p]){const k=b.age/.6;x.globalAlpha=1-k;const sw=bsp.width/2;
   x.save();x.translate(L.cx-g.bw/4-k*60,b.y+k*k*50);x.rotate(-k*1.2);x.drawImage(bsp,0,0,sw,bsp.height,-g.bw/4,-g.bh/2,g.bw/2,g.bh);x.restore();
   x.save();x.translate(L.cx+g.bw/4+k*60,b.y+k*k*50);x.rotate(k*1.2);x.drawImage(bsp,sw,0,sw,bsp.height,-g.bw/4,-g.bh/2,g.bw/2,g.bh);x.restore();x.globalAlpha=1}
  // paski postępu: własny + rywal
  const bx=24,bw=W-48,by=L.y0-2,o=1-p;
  bar(x,bx,by,bw,10,R.hits[p]/R.need[p],PC[p].c);
  x.font=`600 13px ${FONT}`;x.textAlign='left';x.textBaseline='middle';x.fillStyle='#9aa2af';x.fillText('Rywal',bx,by+20);
  bar(x,bx+40,by+16,bw-40,6,R.hits[o]/R.need[o],PC[o].c);
  textC(x,left?`Deski: ${left}`:'',L.cx,g.top-14,20,'#ffffff')}
},
/* 3. Kiai – rytm */
kiai:{t:'Kiai!',jp:'KIAI!',
 how:['Stukaj, gdy krąg dotknie bębna.','Uderzenia w rytm ładują KIAI!'],
 hhow:['Stukaj w bęben, gdy krąg go dotknie.','Fory: mały bęben, więcej uderzeń.'],
 init(R){R.per=.62;R.t0=.9;R.next=0;R.pow=[0,0];R.need=[0,1].map(p=>G.pl[p].hand?9:6);R.used=[-9,-9];R.limit=16;R.glow=[0,0];R.lastBeat=-1},
 start(){setCall('KIAI!','Stukaj w rytm bębna',GOLD2)},
 drumR(L,p){const r=clamp(Math.min(L.ah*.26,W*.22),32,78);return G.pl[p].hand?r*.66:r},
 anim(R,dt){for(const p of [0,1])R.glow[p]=Math.max(0,R.glow[p]-dt*3)},
 upd(R,dt){const bt=R.t0+R.next*R.per;if(R.t>=bt){SFX.drum(R.next%4===0);R.lastBeat=R.next;R.next++}
  if(R.t>=R.limit){const a=R.pow[0]/R.need[0],b=R.pow[1]/R.need[1];endRound(Math.abs(a-b)<.001?-1:a>b?0:1,{why:'time'})}},
 down(R,p,x,y,L,tn){const r=this.drumR(L,p);
  if(G.pl[p].hand&&Math.hypot(x-L.cx,y-L.cy)>r*1.15+8){SFX.wrong();ftext(p,x,y-20,'Trafiaj w bęben!','#ffffff',22);return}
  const k=Math.round((tn-R.t0)/R.per),err=tn-(R.t0+k*R.per),win=G.pl[p].hand?.09:.14;
  if(k>=0&&Math.abs(err)<=win&&R.used[p]!==k){R.used[p]=k;R.pow[p]++;R.glow[p]=1;const perf=Math.abs(err)<.05;
   SFX.good(R.pow[p]+2);buzz(12);burst(p,L.cx,L.cy,perf?GOLD2:PC[p].l,perf?18:12,360);ring(p,L.cx,L.cy,r,'255,224,138');ftext(p,L.cx,Math.max(L.y0+30,L.cy-r-20),perf?'IDEALNIE!':'DOBRZE!',perf?GOLD2:'#ffffff',26);
   if(R.pow[p]>=R.need[p]){shake(p,10);endRound(p,{info:'Potężne KIAI!'})}}
  else{R.pow[p]=Math.max(0,R.pow[p]-1);SFX.wrong();buzz(30);shake(p,3);ftext(p,L.cx,Math.max(L.y0+30,L.cy-r-20),R.used[p]===k?'Już było!':err<0?'Za wcześnie!':'Za późno!','#ff9c8c',24)}},
 draw(x,p,R,L){const r=this.drumR(L,p),cyy=L.cy-8;
  // krąg nadlatujący
  if(G.state==='play'){const nb=Math.max(0,Math.ceil((R.t-R.t0)/R.per)),rem=(R.t0+nb*R.per-R.t)/R.per;if(rem>=0&&rem<=1){x.globalAlpha=.35+.65*(1-rem);x.strokeStyle=PC[p].l;x.lineWidth=5;x.beginPath();x.arc(L.cx,cyy,r*(1+rem*1.1),0,7);x.stroke();x.globalAlpha=1}}
  const gl=R.glow[p];if(gl>0){x.globalAlpha=gl*.6;x.fillStyle=GOLD2;x.beginPath();x.arc(L.cx,cyy,r*1.3,0,7);x.fill();x.globalAlpha=1}
  const s=drumSpr(r),w=s.width/DPR,sc=1+gl*.06;x.drawImage(s,L.cx-w*sc/2,cyy-w*sc/2,w*sc,w*sc);
  x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=2;x.setLineDash([5,5]);x.beginPath();x.arc(L.cx,cyy,r,0,7);x.stroke();x.setLineDash([]);
  // licznik kiai
  const n=R.need[p],d=clamp((W-60)/n,14,30),sx=L.cx-(n-1)*d/2,yy=Math.min(L.y1-10,cyy+r*1.25+14);
  for(let i=0;i<n;i++){const f=i<R.pow[p];x.fillStyle=f?GOLD:'rgba(255,255,255,.15)';x.beginPath();x.arc(sx+i*d,yy,d*.32,0,7);x.fill();if(f){x.strokeStyle=GOLD2;x.lineWidth=2;x.stroke()}}
  const o=1-p;x.font=`600 13px ${FONT}`;x.textAlign='left';x.textBaseline='middle';x.fillStyle='#9aa2af';x.fillText('Rywal',24,L.y0);bar(x,64,L.y0-3,W-88,6,R.pow[o]/R.need[o],PC[o].c)}
},
/* 4. Lustro */
lustro:{t:'Lustro',jp:'KAGAMI!',
 how:['Przesuwaj palcem tak jak strzałki.','Pomyłka = od początku!'],
 hhow:['Przesuwaj palcem tak jak strzałki.','Fory: twoja seria jest dłuższa.'],
 init(R){const base=[];for(let i=0;i<6;i++){let d;do{d=DIRS[ri(4)]}while(i>0&&d===base[i-1]);base.push(d)}
  R.seq=[0,1].map(p=>base.slice(0,G.pl[p].hand?6:4));R.i=[0,0];R.stun=[0,0];R.pop=[0,0];R.limit=15},
 start(){setCall('KAGAMI!','Lustro – powtórz strzałki palcem',GOLD2)},
 anim(R,dt){for(const p of [0,1]){R.stun[p]=Math.max(0,R.stun[p]-dt);R.pop[p]=Math.max(0,R.pop[p]-dt*4)}},
 upd(R,dt){if(R.t>=R.limit){const a=R.i[0]/R.seq[0].length,b=R.i[1]/R.seq[1].length;endRound(Math.abs(a-b)<.001?-1:a>b?0:1,{why:'time'})}},
 tap(R,p,x,y){ftext(p,x,y-24,'Przesuń palcem!','#ffffff',22)},
 swipe(R,p,dir,L){if(R.stun[p]>0)return;const s=R.seq[p];
  if(s[R.i[p]]===dir){R.i[p]++;R.pop[p]=1;SFX.whoosh();SFX.good(R.i[p]+1);buzz(10);burst(p,L.cx,L.cy+16,PC[p].l,10,300);
   if(R.i[p]>=s.length)endRound(p,{info:'Seria '+s.length+' strzałek!'})}
  else{R.i[p]=0;R.stun[p]=.6;SFX.wrong();buzz(50);shake(p,6);ftext(p,L.cx,L.cy+10,'Od początku!','#ff9c8c',30)}},
 draw(x,p,R,L){const s=R.seq[p],n=s.length,cs=clamp((W-40)/n-8,30,56),tw=n*(cs+8)-8,sx=L.cx-tw/2+cs/2,ty=L.y0+cs/2;
  for(let i=0;i<n;i++){const done=i<R.i[p],cur=i===R.i[p];x.save();x.translate(sx+i*(cs+8),ty);const k=cur?1.1:1;x.scale(k,k);
   x.fillStyle=done?GOLD:cur?'#ffffff':'rgba(17,20,27,.85)';x.strokeStyle=cur?GOLD:'rgba(255,255,255,.25)';x.lineWidth=cur?3:1.5;rr(x,-cs/2,-cs/2,cs,cs,9);x.fill();x.stroke();
   x.rotate(ARW[s[i]]);arrowPath(x,cs*.3);x.fillStyle=done?'#1a1405':cur?'#11141b':'#f1f2f4';x.fill();x.restore()}
  const cur=s[R.i[p]];if(!cur)return;
  const big=clamp(Math.min(L.ah-cs-30,W*.4)*.42,26,80),cyy=(ty+cs/2+L.y1)/2,st=R.stun[p]>0,bob=Math.sin(R.t*8)*5;
  x.save();x.translate(L.cx,cyy);x.rotate(ARW[cur]);x.translate(0,-bob);const pk=1+R.pop[p]*.2;x.scale(pk,pk);
  arrowPath(x,big);x.fillStyle=st?'#6b7280':PC[p].c;x.strokeStyle=st?'#9aa2af':'#ffffff';x.lineWidth=4;x.lineJoin='round';x.fill();x.stroke();x.restore()}
},
/* 5. Liczenie po japońsku */
liczenie:{t:'Liczenie po japońsku',jp:'ICHI, NI, SAN!',
 how:['Sensei pyta o liczbę po japońsku.','Stuknij dobrą odpowiedź jako pierwszy!'],
 hhow:['Stuknij dobrą odpowiedź jako pierwszy!','Fory: małe przyciski, dłuższa kara.'],
 init(R){let n;do{n=1+ri(10)}while(n===G.lastNum);G.lastNum=n;R.n=n;R.mode=Math.random()<.55?'jp':'num';
  const o=[n];while(o.length<4){const k=1+ri(10);if(!o.includes(k))o.push(k)}R.opt=[shuffle(o.slice()),shuffle(o.slice())];R.frz=[0,0];R.bad=[[],[]];R.limit=10},
 start(R){setCall('ICHI, NI, SAN!',R.mode==='jp'?'Jaka to liczba?':'Jak to powiedzieć po japońsku?',GOLD2)},
 lab(R,k){return R.mode==='jp'?String(k):JP[k-1]},
 geo(L){const qh=clamp(L.ah*.3,48,86),gy=L.y0+qh,gh=L.y1-gy,cw=(W-40)/2,ch=Math.min(84,(gh-10)/2);return {qh,gy,cw,ch,gh}},
 cells(L,p){const g=this.geo(L),sc=G.pl[p].hand?.6:1,res=[];const top=g.gy+(g.gh-(g.ch*2+10))/2;
  for(let i=0;i<4;i++){const cx0=14+(i%2)*(g.cw+12),cy0=top+Math.floor(i/2)*(g.ch+10),w=g.cw*sc,h=g.ch*sc;res.push({x:cx0+(g.cw-w)/2,y:cy0+(g.ch-h)/2,w,h})}return res},
 upd(R,dt){for(const p of [0,1])R.frz[p]=Math.max(0,R.frz[p]-dt);if(R.t>=R.limit)endRound(-1,{why:'time'})},
 down(R,p,x,y,L){if(R.frz[p]>0)return;const c=this.cells(L,p);
  for(let i=0;i<4;i++){const b=c[i];if(x>=b.x-4&&x<=b.x+b.w+4&&y>=b.y-4&&y<=b.y+b.h+4){
   if(R.bad[p].includes(i))return;
   if(R.opt[p][i]===R.n){SFX.hit();burst(p,b.x+b.w/2,b.y+b.h/2,GOLD2,20,380);endRound(p,{info:`${R.n} = ${JP[R.n-1]}`})}
   else{R.bad[p].push(i);R.frz[p]=G.pl[p].hand?1.8:1.2;SFX.wrong();buzz(60);shake(p,5);ftext(p,b.x+b.w/2,b.y-6,'Pomyłka!','#ff9c8c',26)}return}}},
 draw(x,p,R,L){const g=this.geo(L),q=R.mode==='jp'?JP[R.n-1]:String(R.n);
  textC(x,q,L.cx,L.y0+g.qh*.45,fitSize(x,q,Math.round(Math.min(64,g.qh*.85)),W-60,'italic 800'),GOLD2);
  const c=this.cells(L,p),fz=R.frz[p]>0;
  for(let i=0;i<4;i++){const b=c[i],bad=R.bad[p].includes(i);
   const gr=x.createLinearGradient(0,b.y,0,b.y+b.h);gr.addColorStop(0,bad?'#4b2626':fz?'#3a3f4b':PC[p].l);gr.addColorStop(1,bad?'#2a1414':fz?'#22262e':PC[p].d);
   x.fillStyle=gr;rr(x,b.x,b.y,b.w,b.h,12);x.fill();x.strokeStyle=bad?'rgba(255,120,100,.6)':'rgba(255,255,255,.35)';x.lineWidth=2;x.stroke();
   const t=this.lab(R,R.opt[p][i]);textC(x,t,b.x+b.w/2,b.y+b.h/2+1,fitSize(x,t,Math.round(Math.min(b.h*.55,40)),b.w-12,'italic 800'),bad?'#9aa2af':'#ffffff')}
  if(fz){textC(x,'Blokada…',L.cx,g.gy+g.gh/2,26,'#ff9c8c')}}
}
};
const ORDER=['refleks','wari','kiai','lustro','liczenie'];

/* ---------- rysunek: pomocnicze ---------- */
function arrowPath(x,a){x.beginPath();x.moveTo(0,-a);x.lineTo(a*.85,-a*.05);x.lineTo(a*.32,-a*.05);x.lineTo(a*.32,a);x.lineTo(-a*.32,a);x.lineTo(-a*.32,-a*.05);x.lineTo(-a*.85,-a*.05);x.closePath()}
function bar(x,bx,by,bw,bh,f,col){x.fillStyle='rgba(255,255,255,.12)';rr(x,bx,by,bw,bh,bh/2);x.fill();f=clamp(f,0,1);if(f>0){x.fillStyle=col;rr(x,bx,by,Math.max(bh,bw*f),bh,bh/2);x.fill()}}
function fitSize(x,t,size,maxW,style){x.font=`${style} ${size}px ${FONT}`;const w=x.measureText(t).width;return w>maxW?Math.max(10,Math.floor(size*maxW/w)):size}
function textC(x,t,px,py,size,col,stroke){if(!t)return;x.font=`italic 800 ${size}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=Math.max(4,size*.1);x.strokeStyle=stroke||'rgba(0,0,0,.7)';x.strokeText(t,px,py);x.fillStyle=col;x.fillText(t,px,py)}
function textP(x,t,px,py,size,col,w){if(!t)return;x.font=`600 ${size}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.7)';x.strokeText(t,px,py);x.fillStyle=col;x.fillText(t,px,py)}
function fitP(x,t,size,maxW){x.font=`600 ${size}px ${FONT}`;const w=x.measureText(t).width;return w>maxW?Math.max(10,Math.floor(size*maxW/w)):size}

/* ---------- logika meczu ---------- */
function newMatch(names,hand){
 return {state:'count',t:0,pl:[0,1].map(p=>({name:names[p],hand:hand===p+1,score:0})),bag:[],last:null,roundNo:0,R:null,
  call:null,fx:[0,1].map(()=>({parts:[],texts:[],rings:[],shake:0,flash:0,flashC:'255,255,255'})),ptr:new Map(),res:null,scorePop:[0,0],
  calm:(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})(),countN:-1,fast:null,rounds:[]};
}
function pickGame(){if(!G.bag.length){G.bag=shuffle(ORDER.slice());if(G.bag[G.bag.length-1]===G.last)G.bag.unshift(G.bag.pop())}const id=G.bag.pop();G.last=id;return id}
function nextRound(){
 const id=pickGame(),R={id,t:0};GAMES[id].init(R);G.R=R;G.roundNo++;G.state='intro';G.t=0;G.call=null;
 G.ptr.clear();
}
function startPlay(){G.state='play';G.t=0;const g=GAMES[G.R.id];g.start&&g.start(G.R)}
function endRound(w,info){
 if(G.state!=='play')return;
 const R=G.R;G.state='point';G.t=0;G.res={w,info:info||{},id:R.id};G.ptr.clear();
 if(w>=0){G.pl[w].score++;G.scorePop[w]=1;SFX.point();buzz([20,30,40]);confetti(w,50);flash(w,.3,'255,224,138');
  if(info&&info.foul!=null){SFX.foul();setCall('HANSOKU!','Falstart: '+G.pl[info.foul].name,'#ff9c8c')}
  else setCall('IPPON!','Punkt: '+G.pl[w].name,GOLD2);
  if(info&&info.ms&&(!G.fast||info.ms<G.fast.ms))G.fast={ms:info.ms,n:G.pl[w].name};
 }else{setCall('HIKIWAKE','Remis – nikt nie zdobywa punktu','#c9ced6');call_('beep',440,.15,1)}
 G.rounds.push([R.id,w]);
}
function finishMatch(){
 G.state='final';G.t=0;G.call=null;root.classList.add('gr-fin');const w=G.pl[0].score>=WIN?0:1;G.winner=w;
 const st=stats(),S=S_();st.played=(st.played||0)+1;const wn=G.pl[w].name;st.wins[wn]=(st.wins[wn]||0)+1;
 st.p1=G.pl[0].name;st.p2=G.pl[1].name;st.hand=G.pl[0].hand?1:G.pl[1].hand?2:0;try{st.last=DW().today()}catch(e){}
 if(G.fast&&(!st.fast||G.fast.ms<st.fast.ms))st.fast=G.fast;
 // monety tylko dla właścicielki aplikacji (S.name), maks. 10 dziennie
 let coins=0;const me=G.pl.findIndex(pl=>pl.name.trim().toLowerCase()===String(S.name||'').trim().toLowerCase());
 let d='';try{d=DW().today()}catch(e){}
 if(me>=0&&d){if(call_('payOnce','gr'+d+'-0',5,'Pojedynek rodzinny'))coins+=5;if(me===w&&call_('payOnce','gr'+d+'-1',5,'Pojedynek rodzinny'))coins+=5;if(coins)call_('addXP',coins===10?10:5)}
 G.coins=coins;G.me=me;call_('save');
 call_('fanfare');confetti(w,90);
 setTimeout(()=>{if(G&&G.state==='final')call_('say',`Zwycięża ${wn}! ${G.pl[w].score} do ${G.pl[1-w].score}. Osu!`)},500);
 G.sheetT=setTimeout(showSheet,1700);
}

/* ---------- pętla ---------- */
function loop(now){raf=requestAnimationFrame(loop);let dt=(now-lastT)/1000;lastT=now;if(!(dt>0))dt=0;if(dt>.05)dt=.05;
 const p0=window.__grPerf?performance.now():0;update(dt);draw();if(p0)window.__grPerf.push(performance.now()-p0)}
function update(dt){
 const g=G;g.t+=dt;
 if(g.state==='count'){const n=Math.floor(g.t/.7);if(n!==g.countN){g.countN=n;if(n<3)call_('taiko',1);}if(g.t>2.1)nextRound()}
 else if(g.state==='intro'){if(g.t>=1.95&&!g.yoi){g.yoi=1;call_('taiko',1)}if(g.t>2.7){g.yoi=0;startPlay()}}
 else if(g.state==='play'){const R=g.R,gm=GAMES[R.id];R.t+=dt;
  if(R.limit){const left=R.limit-R.t,s=Math.ceil(left);if(s<=3&&s>0&&s!==R.lastS){R.lastS=s;SFX.tick()}}
  gm.anim&&gm.anim(R,dt);gm.upd&&gm.upd(R,dt)}
 else if(g.state==='point'){const gm=GAMES[g.R.id];gm.anim&&gm.anim(g.R,dt);
  if(g.t>2.1){if(g.pl[0].score>=WIN||g.pl[1].score>=WIN)finishMatch();else nextRound()}}
 else if(g.state==='final'){if(Math.random()<dt*6)confetti(g.winner,6)}
 if(g.call)g.call.age+=dt;
 for(const p of [0,1]){const f=g.fx[p];
  for(const q of f.parts){q.age+=dt;q.vy+=q.g*dt;q.x+=q.vx*dt+(q.sway?Math.sin(q.age*4+q.sway)*30*dt:0);q.y+=q.vy*dt;if(q.rot!=null)q.rot+=q.vr*dt}
  f.parts=f.parts.filter(q=>q.age<q.life);for(const t of f.texts)t.age+=dt;f.texts=f.texts.filter(t=>t.age<t.life);
  for(const r of f.rings)r.age+=dt;f.rings=f.rings.filter(r=>r.age<r.life);
  f.shake=Math.max(0,f.shake-dt*40);f.flash=Math.max(0,f.flash-dt*1.6);g.scorePop[p]=Math.max(0,g.scorePop[p]-dt*2)}
}

/* ---------- rysowanie ---------- */
function draw(){
 const g=G,x=cx;if(!g||!x)return;
 x.setTransform(DPR,0,0,DPR,0,0);x.clearRect(0,0,W,H);if(g.state==='menu')return;
 for(const p of [0,1]){
  if(p===0)x.setTransform(DPR,0,0,DPR,0,Hh*DPR);else x.setTransform(-DPR,0,0,-DPR,W*DPR,Hh*DPR);
  x.save();x.beginPath();x.rect(0,0,W,Hh);x.clip();
  const f=g.fx[p];if(f.shake>0)x.translate(rnd(-f.shake,f.shake),rnd(-f.shake,f.shake));
  drawHalf(x,p);
  x.restore();
 }
 // linia środkowa
 x.setTransform(DPR,0,0,DPR,0,0);
 const gr=x.createLinearGradient(0,0,W,0);gr.addColorStop(0,'rgba(242,193,78,0)');gr.addColorStop(.5,'rgba(255,224,138,.95)');gr.addColorStop(1,'rgba(242,193,78,0)');
 x.fillStyle=gr;x.fillRect(0,Hh-1.5,W,3);x.fillStyle='rgba(242,193,78,.18)';x.fillRect(0,Hh-6,W,12);
}
function drawHalf(x,p){
 const g=G,L=lay(p),f=g.fx[p],R=g.R,o=1-p;
 // HUD przy linii środkowej
 if(g.state!=='final'){
  const sc=`${g.pl[p].score} : ${g.pl[o].score}`,pop=1+g.scorePop[p]*.35;
  textC(x,sc,L.cx,L.hudY,Math.round(26*pop),'#ffffff');
  const nw=W/2-36-58;
  let s=fitSize(x,g.pl[p].name.toUpperCase(),19,nw,'italic 800');x.font=`italic 800 ${s}px ${FONT}`;x.textBaseline='middle';x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.7)';
  x.textAlign='right';x.strokeText(g.pl[p].name.toUpperCase(),L.cx-36,L.hudY);x.fillStyle=PC[p].l;x.fillText(g.pl[p].name.toUpperCase(),L.cx-36,L.hudY);
  s=fitSize(x,g.pl[o].name.toUpperCase(),19,nw,'italic 800');x.font=`italic 800 ${s}px ${FONT}`;
  x.textAlign='left';x.strokeText(g.pl[o].name.toUpperCase(),L.cx+36,L.hudY);x.fillStyle=PC[o].l;x.fillText(g.pl[o].name.toUpperCase(),L.cx+36,L.hudY);
  // kropki do 3
  for(let i=0;i<WIN;i++){const on=i<g.pl[p].score;x.fillStyle=on?PC[p].c:'rgba(255,255,255,.15)';x.beginPath();x.arc(L.cx-36-((WIN-1-i)*12)-6,L.hudY+16,4,0,7);x.fill();
   const on2=i<g.pl[o].score;x.fillStyle=on2?PC[o].c:'rgba(255,255,255,.15)';x.beginPath();x.arc(L.cx+36+i*12+6,L.hudY+16,4,0,7);x.fill()}
  if(g.pl[p].hand){x.font=`700 11px ${FONT}`;x.textAlign='right';x.fillStyle=GOLD;x.fillText('FORY',L.cx-36-WIN*12-8,L.hudY+16)}
 }
 if(g.state==='count'){const n=g.countN,k=(g.t%.7)/.7;if(n>=0&&n<3){const w=['SAN','NI','ICHI'][n],s=easeOutBack(Math.min(1,k/.35));
   textC(x,w,L.cx,L.cy,Math.round(84*s),'#ffffff');textP(x,['3','2','1'][n],L.cx,L.cy+56,22,'#c9ced6')}
  textP(x,'Pojedynek do '+WIN+' punktów',L.cx,L.callY,18,GOLD2);}
 else if(g.state==='intro'&&R){const gm=GAMES[R.id];
  x.globalAlpha=.25;gm.draw(x,p,R,L);x.globalAlpha=1;
  const k=Math.min(1,g.t/.35),s=easeOutBack(k);
  textP(x,'RUNDA '+g.roundNo,L.cx,L.callY-8,16,GOLD);
  const tt=gm.t.toUpperCase();textC(x,tt,L.cx,L.callY+22,Math.round(fitSize(x,tt,40,W-40,'italic 800')*s),GOLD2);
  const how=g.pl[p].hand?gm.hhow:gm.how;
  const y0=L.cy-10;x.fillStyle='rgba(7,9,13,.7)';rr(x,16,y0-30,W-32,74,14);x.fill();
  how.forEach((l,i)=>textP(x,l,L.cx,y0-10+i*28,fitP(x,l,20,W-56),i?'#ffe08a':'#ffffff'));
  if(g.t>1.95){const kk=(g.t-1.95)/.75,s2=easeOutBack(Math.min(1,kk/.3));x.globalAlpha=kk>.7?1-(kk-.7)/.3:1;textC(x,'YOI!',L.cx,L.y1-30,Math.round(44*s2),'#ffffff');x.globalAlpha=1}
 }
 else if((g.state==='play'||g.state==='point'||g.state==='pause')&&R){
  const gm=GAMES[R.id];
  gm.draw(x,p,R,L);
  if(g.state==='play'&&R.limit&&R.limit-R.t<=5){const s=Math.max(0,Math.ceil(R.limit-R.t));textP(x,'Zostało '+s+' s',W-44,L.callY,15,'#ff8a7a')}
  if(g.call){const c=g.call,s=c.age<.2?easeOutBack(c.age/.2):1;textC(x,c.jp,L.cx,L.callY,Math.round(fitSize(x,c.jp,38,W-70,'italic 800')*s),c.col);textP(x,c.pl,L.cx,L.subY,fitP(x,c.pl,17,W-70),'#e6e8ec')}
  if(g.state==='point')drawPoint(x,p,L);
 }
 else if(g.state==='final')drawFinal(x,p,L);
 // efekty
 for(const r of f.rings){const k=r.age/r.life;x.globalAlpha=1-k;x.strokeStyle=`rgba(${r.col},1)`;x.lineWidth=6*(1-k)+1;x.beginPath();x.arc(r.x,r.y,r.r0*(1+k*.9),0,7);x.stroke()}
 x.globalAlpha=1;
 for(const q of f.parts){const k=1-q.age/q.life;x.globalAlpha=Math.min(1,k*1.5);
  if(q.rect){x.save();x.translate(q.x,q.y);x.rotate(q.rot);x.fillStyle=q.c;x.fillRect(-q.s,-q.s*.35,q.s*2,q.s*.7);x.restore()}
  else{x.fillStyle=q.c;x.beginPath();x.arc(q.x,q.y,q.s*k+.5,0,7);x.fill()}}
 x.globalAlpha=1;
 for(const t of f.texts){const k=t.age/t.life,pop=k<.15?easeOutBack(k/.15):1,y=t.y-k*36;x.globalAlpha=k>.7?1-(k-.7)/.3:1;
  textC(x,t.txt,t.x,y,Math.round(fitSize(x,t.txt,t.size,W-30,'italic 800')*pop),t.col)}
 x.globalAlpha=1;
 if(f.flash>0){x.fillStyle=`rgba(${f.flashC},${f.flash})`;x.fillRect(0,0,W,Hh)}
}
function drawPoint(x,p,L){
 const g=G,r=g.res,k=Math.min(1,g.t/.3),s=easeOutBack(k);
 x.fillStyle=`rgba(7,9,13,${.74*k})`;x.fillRect(0,L.subY+18,W,Hh);
 let big,sub,col,info=r.info.info||'';
 if(r.w<0){big='REMIS';sub=r.info.why==='time'?'Czas minął – gramy dalej!':'Nikt nie stuknął – gramy dalej!';col='#c9ced6';info=''}
 else if(r.info.foul===p){big='FALSTART!';sub='Za wcześnie – punkt dla rywala';col='#ff8a7a';info=''}
 else if(r.w===p){const sc=g.pl[p].score;big='PUNKT!';sub=r.info.foul!=null?'Rywal ruszył za wcześnie!':sc>=WIN?'Wygrywasz pojedynek!':`Masz już ${sc} z ${WIN}`;if(r.info.why==='time')info='Czas minął – zrobiłeś więcej!';col=GOLD2}
 else{big='Ojej!';sub='Punkt zdobywa: '+g.pl[r.w].name;col='#ffffff'}
 const y=L.cy;
 textC(x,big,L.cx,y-14,Math.round(fitSize(x,big,64,W-40,'italic 800')*s),col);
 textP(x,sub,L.cx,y+30,fitP(x,sub,20,W-40),'#ffffff');
 if(info)textP(x,info,L.cx,y+56,fitP(x,info,18,W-40),GOLD2);
}
function drawFinal(x,p,L){
 const g=G,w=g.winner===p,k=Math.min(1,g.t/.5),s=easeOutBack(k),me=g.pl[p],o=g.pl[1-p];
 const top=L.hudY,bot=L.y1;const mid=(top+bot)/2;
 // awatar
 const ah=clamp((bot-top)*.55,90,220),img=imgP[p];const c=scaled(img,Math.round(ah*DPR));
 const glow=x.createRadialGradient(W*.27,mid+ah*.15,4,W*.27,mid+ah*.15,ah*.7);glow.addColorStop(0,w?'rgba(255,224,138,.5)':'rgba(140,184,255,.25)');glow.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=glow;x.fillRect(0,top,W,bot-top);
 if(c){const iw=c.width/DPR,ih=c.height/DPR;x.drawImage(c,W*.27-iw/2,Math.min(bot,mid+ah*.5)-ih+ (1-k)*40,iw,ih)}
 const tx=W*.68;
 const sp=w?trophySpr(clamp(ah*.42,44,96)):medalSpr(clamp(ah*.34,36,74));const sw=sp.width/DPR*s,sh=sp.height/DPR*s;
 x.drawImage(sp,tx-sw/2,top+22+(w?0:6),sw,sh);
 const ty=top+30+sp.height/DPR+22;
 const big=w?'ZWYCIĘSTWO!':'BRAWO!';textC(x,big,tx,ty,Math.round(fitSize(x,big,40,W*.6,'italic 800')*s),w?GOLD2:'#ffffff');
 textC(x,`${me.score} : ${o.score}`,tx,ty+36,30,'#ffffff');
 const l1=w?'Mistrz rodziny: '+me.name:'Dzielna walka, '+me.name+'!';textP(x,l1,tx,ty+66,fitP(x,l1,17,W*.6),w?GOLD2:'#e6e8ec');
 const l2=w?'Osu! Rywal: '+o.name:'Rewanż? Osu!';textP(x,l2,tx,ty+88,fitP(x,l2,15,W*.6),'#9aa2af');
}

/* ---------- wejście ---------- */
function onDown(e){
 if(!G)return;e.preventDefault();
 try{cv.setPointerCapture(e.pointerId)}catch(_){}
 const b=cv.getBoundingClientRect(),q=toLocal(e.clientX-b.left,e.clientY-b.top);
 G.ptr.set(e.pointerId,{p:q.p,x0:q.x,y0:q.y,done:false});
 if(G.state!=='play')return;
 const R=G.R,gm=GAMES[R.id],L=lay(q.p),tn=R.t+Math.max(0,Math.min(.05,(performance.now()-lastT)/1000));
 if(gm.down){gm.down(R,q.p,q.x,q.y,L,tn);const s=G.ptr.get(e.pointerId);if(s&&!gm.swipe)s.done=true}
}
function onMove(e){
 if(!G)return;const s=G.ptr.get(e.pointerId);if(!s||s.done)return;
 const b=cv.getBoundingClientRect(),q=toLocal(e.clientX-b.left,e.clientY-b.top);
 if(q.p!==s.p){// palec przejechał na drugą połowę – liczymy w układzie gracza, który zaczął
  q.x=s.p?W-(e.clientX-b.left):(e.clientX-b.left);q.y=s.p?H/2-(e.clientY-b.top):(e.clientY-b.top)-H/2}
 const dx=q.x-s.x0,dy=q.y-s.y0;if(Math.hypot(dx,dy)<30)return;
 s.done=true;if(G.state!=='play')return;const gm=GAMES[G.R.id];
 if(gm.swipe)gm.swipe(G.R,s.p,Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'),lay(s.p));
}
function onUp(e){if(!G)return;const s=G.ptr.get(e.pointerId);G.ptr.delete(e.pointerId);if(!s||s.done||G.state!=='play')return;const gm=GAMES[G.R.id];if(gm.tap)gm.tap(G.R,s.p,s.x0,s.y0)}

/* ---------- ekrany DOM ---------- */
const XSVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const TSVG=(c,s)=>`<svg width="${s}" height="${s}" viewBox="0 0 64 64"><path d="M14 8h36v10c0 14-8 22-18 22S14 32 14 18z" fill="${c}"/><path d="M14 12H6c0 10 6 15 10 15M50 12h8c0 10-6 15-10 15" fill="none" stroke="${c}" stroke-width="4"/><rect x="28" y="40" width="8" height="8" fill="${c}"/><rect x="20" y="48" width="24" height="8" rx="2" fill="${c}"/><ellipse cx="25" cy="17" rx="3" ry="6" fill="rgba(255,255,255,.45)"/></svg>`;
let setup={p1:'',p2:'',hand:2};
function famNames(){const S=S_(),F=S.fam,out=[];if(F&&Array.isArray(F.people))F.people.forEach(x=>{if(x&&x.n)out.push(String(x.n).trim())});return out}
function picks(p1){const seen=new Set([p1.toLowerCase()]),r=[];[...famNames(),'Mama','Tata','Wujek','Ciocia','Babcia','Dziadek'].forEach(n=>{n=n.trim().slice(0,14);if(n&&!seen.has(n.toLowerCase())){seen.add(n.toLowerCase());r.push(n)}});return r.slice(0,6)}
function clean(n,def){n=String(n||'').replace(/\s+/g,' ').trim().slice(0,14);return n||def}
function screenMenu(){
 root.classList.add('gr-menu');hideSheet();
 const S=S_(),st=stats();
 if(!setup.p1)setup.p1=clean(st.p1&&st.p1.toLowerCase()===String(S.name||'').toLowerCase()?st.p1:S.name,'Blanka');
 if(!setup.p2)setup.p2=clean(st.p2||picks(setup.p1)[0],'Wujek');
 if(st.hand!=null&&!setup.touched)setup.hand=st.hand;
 const wins=Object.entries(st.wins||{}).sort((a,b)=>b[1]-a[1]).slice(0,2);
 const sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="gr-in">
  <button class="gr-ib" data-g="exit" aria-label="Wyjdź">${XSVG}</button>
  <p class="gr-kick">Gra dla dwojga · jeden telefon</p><h2 class="gr-t">Pojedynek rodzinny</h2>
  <div class="gr-hero"><img src="${esc(imgP[0].src)}" alt=""><span class="gr-vs">VS</span><img class="gr-p2" src="media/sklep/shop-tygrys.webp" alt=""></div>
  <div class="gr-stats"><div><b>${st.played||0}</b><span>rozegranych</span></div>${wins.length?wins.map(w=>`<div><b>${w[1]}</b><span>wygrane: ${esc(w[0])}</span></div>`).join(''):'<div><b>–</b><span>brak mistrza</span></div>'}<div><b>${coinsLeft()}</b><span>monet dziś</span></div></div>
  <div class="gr-card">
   <div class="gr-pl"><div class="gr-dot" style="background:${PC[0].c}">AKA</div><label>Gracz 1 · dół ekranu<input id="gr-p1" maxlength="14" value="${esc(setup.p1)}" autocomplete="off"></label></div>
   <div class="gr-pl"><div class="gr-dot" style="background:${PC[1].c}">AO</div><label>Gracz 2 · góra ekranu (naprzeciwko)<input id="gr-p2" maxlength="14" value="${esc(setup.p2)}" autocomplete="off"></label></div>
   <div class="gr-chips">${picks(setup.p1).map(n=>`<button data-g="pick" data-n="${esc(n)}" class="${n===setup.p2?'on':''}">${esc(n)}</button>`).join('')}</div>
  </div>
  <div class="gr-card"><div class="gr-h3">Fory dla dorosłego</div>
   <div class="gr-seg"><button data-g="hand" data-h="0">Bez for</button><button data-g="hand" data-h="2" class="gr-h2"></button><button data-g="hand" data-h="1" class="gr-h1"></button></div>
   <p class="gr-note">Gracz z forami ma mniejsze cele, twardsze deski i dłuższe serie – dzięki temu walka jest uczciwa.</p></div>
  <details class="gr-card"><summary>Jak grać?</summary>
   <p class="gr-note" style="margin:4px 0 8px;color:#c9ced6">Połóżcie telefon płasko na stole i usiądźcie naprzeciwko siebie. Każdy gra tylko na <b>swojej połowie</b> – górna jest odwrócona dla gracza naprzeciwko. Sensei losuje krótkie rundy. Kto pierwszy zdobędzie <b>${WIN} punkty</b>, wygrywa!</p>
   <div class="gr-row"><b class="gr-n">1</b><div><b>Refleks sensei</b><small>Czekaj na „HAJIME!” i stuknij pierwszy. Sensei lubi podpuszczać – „Ha… hapsik!” to nie sygnał! Za wcześnie = falstart.</small></div></div>
   <div class="gr-row"><b class="gr-n">2</b><div><b>Tameshiwari</b><small>Stukaj jak najszybciej i rozbij 5 desek przed rywalem.</small></div></div>
   <div class="gr-row"><b class="gr-n">3</b><div><b>Kiai!</b><small>Stukaj w bęben dokładnie w rytm, gdy krąg go dotknie. Każde dobre uderzenie ładuje KIAI.</small></div></div>
   <div class="gr-row"><b class="gr-n">4</b><div><b>Lustro (kagami)</b><small>Przesuwaj palcem tak, jak pokazują strzałki. Pomyłka = od początku.</small></div></div>
   <div class="gr-row"><b class="gr-n">5</b><div><b>Liczenie po japońsku</b><small>ICHI, NI, SAN… Wybierz dobrą odpowiedź pierwszy. Pomyłka blokuje na chwilę.</small></div></div>
  </details>
  <div class="gr-btns gr-stick"><button class="btn-p full bigbtn" data-g="go">Hajime! Zaczynamy</button></div></div>`;
 syncMenu();sc.scrollTop=0;
}
function syncMenu(){const sc=els.scr,i1=sc.querySelector('#gr-p1'),i2=sc.querySelector('#gr-p2');if(!i1)return;
 setup.p1=i1.value;setup.p2=i2.value;
 sc.querySelector('.gr-h1').textContent=clean(setup.p1,'Gracz 1');sc.querySelector('.gr-h2').textContent=clean(setup.p2,'Gracz 2');
 sc.querySelectorAll('[data-g="hand"]').forEach(b=>b.classList.toggle('on',+b.dataset.h===setup.hand));
 sc.querySelectorAll('[data-g="pick"]').forEach(b=>b.classList.toggle('on',b.dataset.n===clean(setup.p2,'')))}
function screenPause(){const sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="gr-pause"><h2>Pauza</h2><p style="text-align:center;color:#c9ced6;margin:0 0 8px">Złapcie oddech. Gotowi?</p>
  <button class="btn-p full bigbtn" data-g="resume">Wracamy do walki</button><button class="full bigbtn" data-g="again">Zacznij od nowa</button><button class="full bigbtn" data-g="menu">Zmień graczy</button><button class="full bigbtn" data-g="exit">Wyjdź</button></div>`}
function showSheet(){
 if(!G||G.state!=='final')return;const g=G,w=g.winner,a=g.pl[0],b=g.pl[1],S=S_(),sh=els.sheet;
 const coinTxt=g.coins?`${esc(g.pl[g.me].name)} zdobywa <b>+${g.coins} monet</b>!`:g.me<0?`Monety zdobywa ${esc(S.name||'Blanka')} – wpisz jej imię jako gracza.`:coinsLeft()?`Wygraj, aby zdobyć jeszcze ${coinsLeft()} monet dziś.`:'Dzisiejsze monety z pojedynków już zebrane – wróć jutro!';
 sh.innerHTML=`<div class="gr-sh"><div><p class="gr-kick" style="margin:0">Koniec pojedynku</p><h2>Wygrywa ${esc(g.pl[w].name)}!</h2></div>
  <div class="gr-vsr"><div><b style="color:${PC[0].l}">${a.score}</b><span>${esc(a.name)}</span></div><div>${TSVG(w===0?PC[0].l:PC[1].l,54)}</div><div><b style="color:${PC[1].l}">${b.score}</b><span>${esc(b.name)}</span></div></div>
  <p class="gr-coins">${coinTxt}</p>
  <div class="gr-b3"><button class="btn-p bigbtn" data-g="again">Zagraj jeszcze raz</button><button class="bigbtn" data-g="menu">Gracze</button><button class="bigbtn" data-g="exit">Wyjdź</button></div></div>`;
 sh.hidden=false;requestAnimationFrame(()=>sh.classList.add('on'));
}
function hideSheet(){if(G)clearTimeout(G.sheetT);if(els.sheet){els.sheet.classList.remove('on');els.sheet.hidden=true;els.sheet.innerHTML=''}}

/* ---------- sterowanie ---------- */
function startLoop(){if(raf)return;lastT=performance.now();raf=requestAnimationFrame(loop)}
function stopLoop(){if(raf)cancelAnimationFrame(raf);raf=0}
function play(){
 const names=[clean(setup.p1,'Gracz 1'),clean(setup.p2,'Gracz 2')];if(names[0].toLowerCase()===names[1].toLowerCase())names[1]=names[1].slice(0,12)+' 2';
 hideSheet();G=newMatch(names,setup.hand);root.classList.remove('gr-menu','gr-fin');els.scr.hidden=true;els.scr.innerHTML='';
 call_('taiko',1);startLoop();
}
function pause(){if(!G||!['play','count','intro','point'].includes(G.state))return;G.prev=G.state;G.state='pause';stopLoop();G.ptr.clear();screenPause()}
function resume(){if(!G||G.state!=='pause')return;G.state=G.prev;els.scr.hidden=true;els.scr.innerHTML='';startLoop()}
function toMenu(){stopLoop();hideSheet();root.classList.remove('gr-fin');G=newMatch(['',''],0);G.state='menu';draw();screenMenu()}
function onClick(e){const b=e.target.closest('[data-g]');if(!b||!root.contains(b))return;const a=b.dataset.g;
 if(a==='go'){syncMenu();setup.p1=clean(setup.p1,'Gracz 1');setup.p2=clean(setup.p2,'Gracz 2');play()}
 else if(a==='again')play();else if(a==='exit')close();else if(a==='pause')pause();else if(a==='resume')resume();else if(a==='menu')toMenu();
 else if(a==='pick'){const i=els.scr.querySelector('#gr-p2');if(i){i.value=b.dataset.n;syncMenu()}}
 else if(a==='hand'){setup.hand=+b.dataset.h;setup.touched=1;syncMenu()}}
function onInput(e){if(e.target&&(e.target.id==='gr-p1'||e.target.id==='gr-p2'))syncMenu()}
function onVis(){if(document.hidden)pause()}
function onKey(e){if(e.key==='Escape'){if(G&&G.state==='pause')resume();else pause()}}

function open(){
 if(root)return;
 if(!document.getElementById('gr-css')){const st=document.createElement('style');st.id='gr-css';st.textContent=CSS;document.head.appendChild(st)}
 const S=S_();
 imgP=[loadImg(S.look?`media/sklep/shop-${S.look}.webp`:'media/gra-postac.webp'),loadImg('media/sklep/shop-tygrys.webp')];
 const bg=S.bg?`media/sklep/shop-${S.bg}.webp`:'media/gra/tlo-mata.webp';
 root=document.createElement('div');root.id='g-rodzina';root.className='gr-menu';
 root.innerHTML=`<div class="gr-bg gr-t" style="background-image:url('${bg}')"></div><div class="gr-bg gr-b" style="background-image:url('${bg}')"></div>
  <canvas class="gr-cv"></canvas><button class="gr-pz" data-g="pause" aria-label="Pauza">${PSVG}</button>
  <div class="gr-sheet" hidden></div><div class="gr-scr" hidden></div>
  <div class="gr-probe" style="position:absolute;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)"></div>`;
 document.body.appendChild(root);
 cv=root.querySelector('canvas');cx=cv.getContext('2d');
 els={scr:root.querySelector('.gr-scr'),sheet:root.querySelector('.gr-sheet'),probe:root.querySelector('.gr-probe')};
 document.documentElement.style.overflow='hidden';
 G=newMatch(['',''],0);G.state='menu';
 resize();
 on(cv,'pointerdown',onDown);on(cv,'pointermove',onMove);on(cv,'pointerup',onUp);on(cv,'pointercancel',onUp);
 on(root,'click',onClick);on(root,'input',onInput);on(root,'contextmenu',e=>e.preventDefault());
 on(window,'resize',resize);on(document,'visibilitychange',onVis);on(document,'keydown',onKey);
 setup={p1:'',p2:'',hand:2};
 screenMenu();
 call_('music',true);
}
function close(){
 stopLoop();if(G)clearTimeout(G.sheetT);
 listeners.forEach(([t,ev,fn,opt])=>t.removeEventListener(ev,fn,opt));listeners=[];
 if(root)root.remove();root=null;
 document.documentElement.style.overflow='';
 G=null;cv=null;cx=null;els={};CACHE.clear();
 try{speechSynthesis&&speechSynthesis.cancel()}catch(e){}
 call_('music',false);
}
window.Games=window.Games||{};
window.Games.rodzina={open,close,get running(){return !!raf},_state:()=>G,_g:GAMES,_lay:lay};
})();

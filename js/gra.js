/* Dojo Refleks – mini-gra dla „Droga wojownika”.
   Zwykły skrypt. Publiczne API: window.Gra.open(), window.Gra.close().
   Korzysta z mostka window.DW (definiowanego w index.html). */
(function(){
'use strict';

/* ---------- stałe ---------- */
const ROUND=60, BOSS_T=15;
const BLACK='linear-gradient(#151515 38%,#f2c14e 38% 62%,#151515 62%)';
const BELTS=[
 {n:'Biały pas',c:'#f4f4f4',at:0},
 {n:'Pomarańczowy pas',c:'#f08a24',at:300},
 {n:'Niebieski pas',c:'#2f6fe0',at:900},
 {n:'Żółty pas',c:'#f2d02e',at:1800},
 {n:'Zielony pas',c:'#3aa655',at:3000},
 {n:'Brązowy pas',c:'#8a5a2b',at:4600},
 {n:'Czarny pas',c:'#151515',at:6500}
];
const TECH={
 tsuki:['Seiken tsuki','cios pięścią'],
 mae:['Mae geri','kopnięcie przednie'],
 mawashi:['Mawashi geri','kopnięcie okrężne'],
 kakato:['Kakato otoshi','kopnięcie z góry piętą'],
 wari:['Tameshiwari','rozbijanie deski'],
 kiai:['Kiai','okrzyk wojownika']
};
const JP=['ICHI','NI','SAN','YON','GO','ROKU','NANA','HACHI','KYŪ','JŪ'];
const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const ARROW={up:'↑',down:'↓',left:'←',right:'→',tap:'●'};
const COIN_TIERS=[[1,5],[1500,5],[3500,5]]; // [minimalny wynik, monety] – każdy próg raz dziennie
const FONT="'Barlow Condensed','Arial Narrow',sans-serif";

const DW=()=>window.DW||{};
const S_=()=>{try{return DW().getS()}catch(e){return {}}};
const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const easeOutBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const fmt=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');

/* ---------- dźwięk (WebAudio, własne efekty) ---------- */
let noiseBuf=null;
function ac(){if(S_().mute)return null;try{return DW().actx()}catch(e){return null}}
function noise(a){if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate)return noiseBuf;const n=a.sampleRate*.5,b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return noiseBuf=b}
function nz(a,t,dur,type,f0,f1,vol){const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noise(a);f.type=type;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);f.connect(g);g.connect(a.destination);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t,Math.random()*.3);s.stop(t+dur+.02)}
function tone(a,t,type,f0,f1,dur,vol){const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.02)}
const PENTA=[523,587,659,784,880,1047,1175,1319,1568,1760];
const SFX={
 hit(perf,combo){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',170,55,.16,.7);nz(a,t,.07,'lowpass',1800,400,.5);
  tone(a,t+.01,'triangle',PENTA[Math.min(combo,PENTA.length)-1]||523,0,.14,.12);if(perf)tone(a,t+.04,'sine',1760,0,.25,.12)},
 kick(perf,combo){const a=ac();if(!a)return;const t=a.currentTime;nz(a,t,.13,'bandpass',500,2600,.35);tone(a,t+.06,'sine',140,50,.18,.7);nz(a,t+.06,.06,'lowpass',1500,300,.4);
  tone(a,t+.07,'triangle',PENTA[Math.min(combo,PENTA.length)-1]||523,0,.14,.12);if(perf)tone(a,t+.1,'sine',1760,0,.25,.12)},
 whoosh(){const a=ac();if(!a)return;nz(a,a.currentTime,.14,'bandpass',600,2200,.18)},
 knock(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',320,180,.08,.5);nz(a,t,.05,'bandpass',1400,0,.35)},
 crack(){const a=ac();if(!a)return;const t=a.currentTime;nz(a,t,.25,'highpass',900,0,.7);tone(a,t,'square',220,60,.12,.25);tone(a,t,'sine',120,40,.3,.8)},
 shatter(){const a=ac();if(!a)return;const t=a.currentTime;for(let i=0;i<6;i++)tone(a,t+i*.03,'sine',rnd(2200,4200),0,.18,.12);nz(a,t,.2,'highpass',3000,0,.3)},
 miss(){const a=ac();if(!a)return;tone(a,a.currentTime,'square',150,110,.12,.08)},
 escape(){const a=ac();if(!a)return;tone(a,a.currentTime,'triangle',420,200,.2,.12)},
 tiger(){const a=ac();if(!a)return;const t=a.currentTime;[659,784,988,1319].forEach((f,i)=>tone(a,t+i*.06,'triangle',f,0,.2,.18))},
 wrong(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sawtooth',220,140,.18,.08)},
 tick(){const a=ac();if(!a)return;tone(a,a.currentTime,'square',1200,0,.04,.05)}
};
const buzz=p=>{if(S_().mute)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};

/* ---------- grafiki rysowane w kodzie (cache) ---------- */
const SPR={};let SPR_DPR=0,SPR_R=0;
function mk(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c}
function buildSprites(r,dpr){
 if(SPR_DPR===dpr&&SPR_R===r)return;SPR_DPR=dpr;SPR_R=r;
 const R=r*dpr;
 // tarcza do ciosu (czerwona łapa)
 {const s=R*2.3,c=mk(s,s),x=c.getContext('2d'),m=s/2;
  x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(m,m+R*.12,R*1.02,R*1.02,0,0,7);x.fill();
  let g=x.createRadialGradient(m-R*.35,m-R*.4,R*.1,m,m,R);g.addColorStop(0,'#ff6b5a');g.addColorStop(.7,'#d42a1e');g.addColorStop(1,'#8e140d');
  x.fillStyle=g;x.beginPath();x.arc(m,m,R,0,7);x.fill();
  x.strokeStyle='#fff';x.lineWidth=R*.12;x.beginPath();x.arc(m,m,R*.62,0,7);x.stroke();
  x.fillStyle='#fff';x.beginPath();x.arc(m,m,R*.26,0,7);x.fill();
  x.fillStyle='#f2c14e';x.beginPath();x.arc(m,m,R*.15,0,7);x.fill();
  x.setLineDash([R*.08,R*.07]);x.strokeStyle='rgba(255,220,200,.55)';x.lineWidth=R*.03;x.beginPath();x.arc(m,m,R*.88,0,7);x.stroke();x.setLineDash([]);
  x.fillStyle='rgba(255,255,255,.28)';x.beginPath();x.ellipse(m-R*.38,m-R*.45,R*.32,R*.16,-.6,0,7);x.fill();
  SPR.pad=c}
 // tarcza do kopnięć (niebieska) – bez strzałki, strzałkę rysujemy osobno
 {const w=R*1.9,h=R*2.3,c=mk(w+R*.3,h+R*.3),x=c.getContext('2d'),ox=R*.15,oy=R*.1;
  x.fillStyle='rgba(0,0,0,.35)';rr(x,ox+R*.06,oy+R*.16,w,h,R*.35);x.fill();
  let g=x.createLinearGradient(ox,oy,ox+w,oy+h);g.addColorStop(0,'#5d9bff');g.addColorStop(.55,'#2457c9');g.addColorStop(1,'#16357d');
  x.fillStyle=g;rr(x,ox,oy,w,h,R*.35);x.fill();
  x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=R*.07;rr(x,ox+R*.14,oy+R*.14,w-R*.28,h-R*.28,R*.24);x.stroke();
  x.fillStyle='rgba(255,255,255,.18)';rr(x,ox+R*.2,oy+R*.2,w*.35,h-R*.4,R*.18);x.fill();
  SPR.shield=c}
 // strzałka
 {const s=R*1.3,c=mk(s,s),x=c.getContext('2d'),m=s/2;
  x.translate(m,m);x.fillStyle='#fff';x.strokeStyle='rgba(10,20,50,.55)';x.lineWidth=R*.06;x.lineJoin='round';
  x.beginPath();x.moveTo(0,-s*.44);x.lineTo(s*.36,-s*.02);x.lineTo(s*.14,-s*.02);x.lineTo(s*.14,s*.42);x.lineTo(-s*.14,s*.42);x.lineTo(-s*.14,-s*.02);x.lineTo(-s*.36,-s*.02);x.closePath();x.stroke();x.fill();
  SPR.arrow=c}
 // deska do tameshiwari
 {const w=R*2.4,h=R*1.25,c=mk(w+R*.2,h+R*.3),x=c.getContext('2d'),ox=R*.1,oy=R*.08;
  x.fillStyle='rgba(0,0,0,.35)';rr(x,ox+R*.05,oy+R*.14,w,h,R*.12);x.fill();
  let g=x.createLinearGradient(0,oy,0,oy+h);g.addColorStop(0,'#f0c98a');g.addColorStop(.5,'#d9a45c');g.addColorStop(1,'#a8743a');
  x.fillStyle=g;rr(x,ox,oy,w,h,R*.12);x.fill();
  x.strokeStyle='rgba(110,60,20,.45)';x.lineWidth=R*.035;
  for(let i=0;i<6;i++){x.beginPath();const y=oy+h*(.15+i*.14);x.moveTo(ox+R*.1,y);x.bezierCurveTo(ox+w*.3,y+R*.08*Math.sin(i*2),ox+w*.65,y-R*.08,ox+w-R*.1,y+R*.03);x.stroke()}
  x.beginPath();x.ellipse(ox+w*.7,oy+h*.45,R*.16,R*.08,0,0,7);x.stroke();
  x.strokeStyle='rgba(255,240,210,.5)';x.lineWidth=R*.04;rr(x,ox+R*.05,oy+R*.05,w-R*.1,h-R*.1,R*.1);x.stroke();
  SPR.board=c}
 // czarka herbaty sensei
 {const s=R*2.2,c=mk(s,s),x=c.getContext('2d'),m=s/2;
  x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(m,m+R*.72,R*.8,R*.18,0,0,7);x.fill();
  // para
  x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=R*.07;x.lineCap='round';
  for(let i=-1;i<=1;i++){x.beginPath();x.moveTo(m+i*R*.28,m-R*.38);x.bezierCurveTo(m+i*R*.28-R*.16,m-R*.62,m+i*R*.28+R*.16,m-R*.78,m+i*R*.28,m-R*.98);x.stroke()}
  let g=x.createLinearGradient(m-R*.8,0,m+R*.8,0);g.addColorStop(0,'#cfd6dd');g.addColorStop(.4,'#ffffff');g.addColorStop(1,'#aeb7c1');
  x.fillStyle=g;x.beginPath();x.moveTo(m-R*.82,m-R*.25);x.lineTo(m+R*.82,m-R*.25);x.bezierCurveTo(m+R*.8,m+R*.45,m+R*.5,m+R*.72,m,m+R*.72);x.bezierCurveTo(m-R*.5,m+R*.72,m-R*.8,m+R*.45,m-R*.82,m-R*.25);x.fill();
  x.fillStyle='#2f6b3a';x.beginPath();x.ellipse(m,m-R*.25,R*.82,R*.2,0,0,7);x.fill();
  x.fillStyle='#7fbf5f';x.beginPath();x.ellipse(m,m-R*.23,R*.7,R*.14,0,0,7);x.fill();
  x.strokeStyle='#2a3a6a';x.lineWidth=R*.07;x.beginPath();x.moveTo(m-R*.74,m+R*.1);x.bezierCurveTo(m-R*.3,m+R*.2,m+R*.3,m+R*.2,m+R*.74,m+R*.1);x.stroke();
  // znak zakazu
  x.lineWidth=R*.12;x.strokeStyle='#e2452b';x.beginPath();x.arc(m+R*.72,m-R*.7,R*.3,0,7);x.stroke();x.beginPath();x.moveTo(m+R*.51,m-R*.49);x.lineTo(m+R*.93,m-R*.91);x.stroke();
  SPR.cup=c}
 // poświata złota (dla tygrysa / bossa)
 {const s=R*3,c=mk(s,s),x=c.getContext('2d'),m=s/2,g=x.createRadialGradient(m,m,0,m,m,m);g.addColorStop(0,'rgba(255,224,138,.85)');g.addColorStop(.45,'rgba(242,193,78,.35)');g.addColorStop(1,'rgba(242,193,78,0)');x.fillStyle=g;x.fillRect(0,0,s,s);SPR.glow=c}
 // iskra (cząsteczka)
 {const s=32*dpr,c=mk(s,s),x=c.getContext('2d'),m=s/2,g=x.createRadialGradient(m,m,0,m,m,m);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,230,160,.9)');g.addColorStop(1,'rgba(255,180,60,0)');x.fillStyle=g;x.fillRect(0,0,s,s);SPR.spark=c}
}
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}

/* obraz postaci przeskalowany raz do potrzebnej wielkości */
const IMG={};
function loadImg(src){if(IMG[src])return IMG[src];const i=new Image();i.decoding='async';i.src=src;IMG[src]=i;return i}
function scaled(img,h){if(!img.complete||!img.naturalWidth)return null;const k=img._k||(img._k={});if(k[h])return k[h];const c=mk(h*img.naturalWidth/img.naturalHeight,h);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return k[h]=c}

/* ---------- CSS ---------- */
const CSS=`
#gra{position:fixed;inset:0;z-index:58;background:#07090d;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;color:#f1f2f4}
#gra[hidden]{display:none}
#gra .g-bg{position:absolute;inset:0;background-size:cover;background-position:center 60%;transform:scale(1.04)}
#gra .g-bg::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 45%,rgba(7,9,13,.25),rgba(7,9,13,.85) 75%),linear-gradient(180deg,rgba(7,9,13,.75),rgba(7,9,13,.2) 30%,rgba(7,9,13,.35) 70%,rgba(7,9,13,.9))}
#gra.boss .g-tech{visibility:hidden}
#gra.boss .g-bg::after{background:radial-gradient(120% 80% at 50% 45%,rgba(80,10,10,.35),rgba(10,3,3,.9) 75%)}
#gra canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#gra .g-hud{position:absolute;left:0;right:0;top:0;padding:calc(10px + env(safe-area-inset-top)) 12px 0;display:grid;grid-template-columns:44px 1fr 56px;align-items:center;gap:8px;pointer-events:none}
#gra .g-hud>*{pointer-events:auto}
#gra.menu .g-hud,#gra.menu .g-belt,#gra.menu .g-tech{visibility:hidden}
#gra .g-ib{width:44px;height:44px;min-height:0;padding:0;border-radius:50%;background:rgba(17,20,27,.75);border:1px solid rgba(255,255,255,.14);display:grid;place-items:center;color:#f1f2f4}
#gra .g-sc{text-align:center;line-height:1;pointer-events:none}
#gra .g-sc b{display:block;font:italic 800 38px/1 ${FONT};color:#ffe08a;text-shadow:0 2px 0 rgba(0,0,0,.5),0 0 18px rgba(242,193,78,.35);letter-spacing:.5px}
#gra .g-mul{display:inline-block;margin-top:3px;font:700 14px/1 ${FONT};letter-spacing:.6px;padding:3px 8px;border-radius:99px;background:rgba(242,193,78,.18);color:#ffe08a;border:1px solid rgba(242,193,78,.45);visibility:hidden}
#gra .g-mul.on{visibility:visible}
#gra .g-tm{position:relative;width:56px;height:56px;pointer-events:none}
#gra .g-tm svg{position:absolute;inset:0;transform:rotate(-90deg)}
#gra .g-tm span{position:absolute;inset:0;display:grid;place-items:center;font:800 22px/1 ${FONT}}
#gra .g-tm.low span{color:#ff8a7a}
#gra .g-belt{position:absolute;left:12px;right:12px;top:calc(72px + env(safe-area-inset-top));display:flex;align-items:center;gap:8px;pointer-events:none}
#gra .g-belt i{flex:none;width:26px;height:10px;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.35) inset}
#gra .g-belt em{font:600 14px/1 ${FONT};font-style:normal;letter-spacing:.3px;color:#e6e8ec;white-space:nowrap}
#gra .g-belt div{flex:1;height:6px;border-radius:9px;background:rgba(255,255,255,.12);overflow:hidden}
#gra .g-belt div b{display:block;height:100%;width:0;border-radius:9px;transition:width .25s}
#gra .g-tech{position:absolute;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);max-width:calc(100% - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 14px;border-radius:99px;background:rgba(17,20,27,.72);border:1px solid rgba(255,255,255,.1);font-size:14px;pointer-events:none;opacity:0;transition:opacity .25s}
#gra .g-tech.on{opacity:1}
#gra .g-tech b{font:700 17px/1 ${FONT};color:#ffe08a;letter-spacing:.3px;margin-right:6px}
#gra .g-scr{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:rgba(7,9,13,.82);backdrop-filter:blur(3px)}
#gra .g-scr[hidden]{display:none}
#gra .g-in{max-width:460px;margin:0 auto;padding:calc(16px + env(safe-area-inset-top)) 18px calc(22px + env(safe-area-inset-bottom));min-height:100%;display:flex;flex-direction:column}
#gra .g-x{align-self:flex-end}
#gra h2.g-t{font:italic 800 44px/.95 ${FONT};margin:0;color:#ffe08a;text-shadow:0 3px 0 rgba(0,0,0,.5);letter-spacing:.5px}
#gra .g-kick{color:#f2c14e;font-weight:600;font-size:14px;margin:0 0 2px;letter-spacing:.4px;text-transform:uppercase}
#gra .g-hero{position:relative;height:150px;margin:4px 0 8px;display:flex;justify-content:center;align-items:flex-end}
#gra .g-hero::before{content:'';position:absolute;left:50%;bottom:4px;width:200px;height:26px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(242,193,78,.45),transparent);}
#gra .g-hero img{position:relative;height:150px;width:auto;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6))}
#gra .g-hero .g-tg{position:absolute;right:8%;bottom:0;height:80px}
#gra .g-best{display:flex;gap:8px;margin:0 0 12px}
#gra .g-best>div{flex:1;background:rgba(17,20,27,.85);border:1px solid #252a36;border-radius:14px;padding:8px 10px;text-align:center}
#gra .g-best b{display:block;font:800 26px/1.1 ${FONT};color:#f2c14e}
#gra .g-best span{font-size:12.5px;color:#9aa2af;line-height:1.2;display:block}
#gra .g-how{background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:16px;padding:10px 12px;margin:0 0 14px}
#gra .g-how h3{font:700 20px/1.1 ${FONT};margin:2px 0 6px}
#gra .g-row{display:flex;align-items:center;gap:12px;padding:5px 0;border-top:1px solid rgba(255,255,255,.06)}
#gra .g-row:first-of-type{border-top:0}
#gra .g-row canvas{position:static;flex:none;width:40px;height:40px}
#gra .g-row p{margin:0;font-size:15px;line-height:1.3}
#gra .g-row p small{display:block;color:#9aa2af;font-size:13px}
#gra .g-btns{display:grid;gap:10px;margin-top:auto}
#gra .g-stick{position:static;padding-top:14px}
#gra .g-res{text-align:center;padding-top:calc(58px + env(safe-area-inset-top))}
#gra .g-big{font:italic 800 72px/1 ${FONT};color:#ffe08a;text-shadow:0 4px 0 rgba(0,0,0,.45),0 0 30px rgba(242,193,78,.35);margin:6px 0 2px}
#gra .g-rec{display:inline-block;background:linear-gradient(180deg,#ffe08a,#f2c14e);color:#1a1405;font:800 18px/1 ${FONT};padding:6px 14px;border-radius:99px;letter-spacing:.5px}
#gra .g-beltbig{display:flex;align-items:center;justify-content:center;gap:10px;margin:12px 0 4px;font:700 22px/1 ${FONT}}
#gra .g-beltbig i{width:54px;height:16px;border-radius:4px;box-shadow:0 0 0 1px rgba(255,255,255,.4) inset}
#gra .g-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
#gra .g-grid>div{background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:14px;padding:8px 4px}
#gra .g-grid b{display:block;font:800 26px/1.1 ${FONT};color:#f1f2f4}
#gra .g-grid span{font-size:12.5px;color:#9aa2af;line-height:1.2;display:block}
#gra .g-tl{text-align:left;background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:14px;padding:8px 12px;margin:0 0 12px}
#gra .g-tl div{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:15px}
#gra .g-tl div+div{border-top:1px solid rgba(255,255,255,.06)}
#gra .g-tl b{font-family:${FONT};font-size:18px;color:#ffe08a;font-weight:700}
#gra .g-coins{margin:0 0 14px;font-size:15px;color:#c9ced6}
#gra .g-coins b{color:#f2c14e}
#gra .g-pause{display:flex;flex-direction:column;justify-content:center;gap:12px;min-height:100%;max-width:340px;margin:0 auto;padding:24px}
#gra .g-pause h2{text-align:center;font:italic 800 48px/1 ${FONT};color:#ffe08a;margin:0 0 10px}
`;

/* ---------- stan gry ---------- */
let root=null,cv=null,cx=null,els={},raf=0,lastT=0,W=0,H=0,DPR=1,timers=[],listeners=[],G=null,hudCache={};
let playerImg=null,tigerImg=null,shakeOK=true;

function on(t,ev,fn,opt){t.addEventListener(ev,fn,opt);listeners.push([t,ev,fn,opt])}
function later(fn,ms){const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);fn()},ms);timers.push(id);return id}

function newGame(){
 return {state:'count',t:0,left:ROUND,score:0,combo:0,maxCombo:0,lvl:0,targets:[],parts:[],texts:[],rings:[],
  spawnT:.6,tigerT:rnd(14,22),hits:0,perf:0,misses:0,tech:{tsuki:0,mae:0,mawashi:0,kakato:0,wari:0,kiai:0},
  shake:0,flash:0,flashC:'255,255,255',countT:0,countN:-1,ptr:new Map(),pl:{lx:0,ly:0,face:1,k:0},boss:null,bossDone:0,lastSec:99,banner:null};
}

/* ---------- geometria ---------- */
function radius(){return clamp(Math.min(W,H*0.62)*0.105,32,48)}
function area(){
 const top=(els.tech?els.tech.getBoundingClientRect().bottom:120)+8;
 const ph=playerH();
 return {x0:12,x1:W-12,y0:top,y1:H-ph*0.78}
}
function playerH(){return clamp(H*0.25,140,230)}

function resize(){
 DPR=Math.min(2,window.devicePixelRatio||1);
 W=root.clientWidth;H=root.clientHeight;
 cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
 buildSprites(radius(),DPR);
 if(G)for(const t of G.targets){const A=area();t.x=clamp(t.x,A.x0+t.r,A.x1-t.r);t.y=clamp(t.y,A.y0+t.r,A.y1-t.r)}
 if(G&&G.state!=='play'&&G.state!=='boss'&&G.state!=='count')draw();
}

/* ---------- poziomy trudności ---------- */
function diff(){
 const L=G.lvl,e=Math.min(1,G.t/ROUND);
 return {every:Math.max(.42,1.0-L*.085-e*.12),life:Math.max(1.15,2.35-L*.17-e*.15),max:Math.min(6,2+Math.floor(L*.7+e)),
  w:{pad:1,shield:L>=1?.55+L*.06:.0,board:L>=2?.16:0,cup:L>=1?.1+L*.03:0},down:L>=4}
}
function pickType(d){
 if(G.t<6)return G.t<3.2?'pad':(Math.random()<.5?'pad':'shield'); // łagodny start: najpierw ciosy, potem kopnięcia
 let w=d.w,s=w.pad+w.shield+w.board+w.cup,r=Math.random()*s;
 if((r-=w.pad)<0)return'pad';if((r-=w.shield)<0)return'shield';if((r-=w.board)<0)return G.targets.some(t=>t.type==='board')?'pad':'board';return G.targets.some(t=>t.type==='cup')?'pad':'cup';
}
function spawn(type){
 const d=diff(),A=area();let r=radius()*(1-G.lvl*.025);
 type=type||pickType(d);
 let hw=r,hh=r;
 if(type==='shield'){hw=r*.95;hh=r*1.15}else if(type==='board'){hw=r*1.2;hh=r*.63}else if(type==='cup'){hw=r*.85;hh=r*.9}else if(type==='tiger'){hw=hh=r*1.05}
 let best=null,bd=-1;
 for(let i=0;i<14;i++){
  const x=rnd(A.x0+hw,A.x1-hw),y=rnd(A.y0+hh,A.y1-hh);let md=1e9;
  for(const t of G.targets)md=Math.min(md,Math.hypot(t.x-x,t.y-y)-t.r-r);
  if(md>bd){bd=md;best={x,y}}if(md>24)break;
 }
 if(!best)return;
 const t={type,x:best.x,y:best.y,r,hw,hh,age:0,life:d.life,hp:1,dead:0,hitT:0,wob:0,seed:Math.random()*6};
 if(type==='shield'){const opts=['up','left','right'];if(d.down)opts.push('down');t.dir=opts[Math.floor(Math.random()*opts.length)];t.life*=1.12}
 if(type==='board'){t.hp=3;t.life*=1.5}
 if(type==='cup'){t.life*=1.1}
 if(type==='tiger'){t.life=2.2;t.vx=(Math.random()<.5?-1:1)*rnd(40,70)}
 G.targets.push(t);
}

/* ---------- efekty ---------- */
function burst(x,y,col,n,sp){
 if(G.parts.length>220)G.parts.splice(0,G.parts.length-220);
 for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rnd(.3,1)*sp;G.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*.25,life:rnd(.35,.7),age:0,s:rnd(3,7),c:col,g:600,spark:Math.random()<.45})}
}
function chips(x,y,n,col){for(let i=0;i<n;i++){const a=rnd(-Math.PI*.95,-Math.PI*.05),v=rnd(150,380);G.parts.push({x:x+rnd(-20,20),y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.6,1),age:0,s:rnd(4,9),c:col,g:900,rect:1,rot:rnd(0,6),vr:rnd(-12,12)})}}
function ftext(x,y,txt,col,size,sub){G.texts.push({x,y,txt,col,size,sub,age:0,life:.9});if(G.texts.length>8)G.texts.shift()}
function ring(x,y,r0,col){G.rings.push({x,y,r0,age:0,life:.35,col})}
function shake(a){if(shakeOK)G.shake=Math.max(G.shake,a)}
function flash(a,c){G.flash=Math.max(G.flash,a);G.flashC=c||'255,255,255'}
function showTech(k){const t=TECH[k];if(!t)return;els.tech.innerHTML=`<b>${t[0]}</b>${t[1]}`;els.tech.classList.add('on');clearTimeout(hudCache.techT);hudCache.techT=setTimeout(()=>els.tech&&els.tech.classList.remove('on'),1800)}
function lunge(tx,ty,k){const pl=G.pl;pl.face=tx<W/2?-1:1;pl.k=1;pl.kind=k;pl.tx=tx;pl.ty=ty;const ph=playerH();G.rings.push({ki:1,x0:W/2+pl.face*ph*.12,y0:H-ph*(k==='geri'?.35:.62),x1:tx,y1:ty,age:0,life:.18})}

/* ---------- punktacja ---------- */
function mult(){return Math.min(5,1+Math.floor(G.combo/5))}
function addScore(base,x,y,perf){
 G.combo++;G.maxCombo=Math.max(G.maxCombo,G.combo);G.hits++;if(perf)G.perf++;
 const m=mult(),pts=base*(perf?2:1)*m;G.score+=pts;
 const c=G.combo;let call=c<=10?JP[c-1]+'!':c%10===0?'OSU!':null;
 if(c===15||c===25)call='SUGOI!';
 ftext(x,y-28,call||('+'+pts),perf?'#ffe08a':'#ffffff',call?34:26,(perf?'Doskonale! ':'')+(call?'+'+pts:''));
 if(c>=10&&c%10===0){shake(6);flash(.18,'255,224,138');try{DW().taiko(1)}catch(e){}}
 checkBelt();
}
function breakCombo(x,y,txt){
 if(G.combo>=3)ftext(x,y,txt||'Combo stracone','#ff9c8c',22);else if(txt)ftext(x,y,txt,'#c9ced6',20);
 G.combo=0;
}
function checkBelt(){
 let L=G.lvl;while(L<BELTS.length-1&&G.score>=BELTS[L+1].at)L++;
 if(L>G.lvl){G.lvl=L;G.banner={t:0,b:BELTS[L]};flash(.25,'255,224,138');try{DW().taiko(2)}catch(e){}buzz([30,40,30])}
}
function perfectOf(t){const p=t.age/t.life;return p>.5&&p<.8}

/* ---------- trafienia ---------- */
function hitTarget(t,kind,px,py){
 if(t.dead)return;
 if(t.type==='pad'){
  const perf=perfectOf(t);t.dead=1;t.hitT=0;G.tech.tsuki++;
  SFX.hit(perf,G.combo+1);buzz(14);burst(t.x,t.y,perf?'#ffe08a':'#ff7a5c',perf?22:14,perf?420:320);ring(t.x,t.y,t.r,'255,255,255');shake(perf?5:3);
  lunge(t.x,t.y,'tsuki');showTech('tsuki');addScore(10,t.x,t.y,perf);
 }else if(t.type==='shield'){
  const perf=perfectOf(t);t.dead=1;t.hitT=0;const k=t.dir==='up'?'mae':t.dir==='down'?'kakato':'mawashi';G.tech[k]++;
  t.fly=DIRS[t.dir];SFX.kick(perf,G.combo+1);buzz(18);burst(t.x,t.y,perf?'#ffe08a':'#7fb2ff',perf?24:16,perf?460:360);ring(t.x,t.y,t.r*1.1,'170,205,255');shake(perf?6:4);
  lunge(t.x,t.y,'geri');showTech(k);addScore(15,t.x,t.y,perf);
 }else if(t.type==='board'){
  t.hp--;t.wob=1;SFX.knock();buzz(10);burst(px,py,'#f0c98a',6,220);
  if(t.hp<=0){t.dead=1;t.hitT=0;G.tech.wari++;SFX.crack();buzz([20,30,40]);chips(t.x,t.y,16,'#d9a45c');ring(t.x,t.y,t.r*1.4,'255,224,138');shake(9);flash(.22,'255,240,210');lunge(t.x,t.y,'tsuki');showTech('wari');addScore(40,t.x,t.y,perfectOf(t))}
  else{ftext(px,py-20,t.hp===2?'Jeszcze 2!':'Jeszcze raz!','#ffffff',20);lunge(t.x,t.y,'tsuki')}
 }else if(t.type==='cup'){
  t.dead=1;t.hitT=0;t.broken=1;SFX.shatter();buzz(90);chips(t.x,t.y,14,'#e8edf2');burst(t.x,t.y,'#7fbf5f',10,260);shake(10);flash(.3,'226,69,43');
  G.left=Math.max(0,G.left-3);G.misses++;breakCombo(t.x,t.y-30);ftext(t.x,t.y-62,'Herbatka sensei! −3 s','#ff9c8c',24);
 }else if(t.type==='tiger'){
  t.dead=1;t.hitT=0;SFX.tiger();buzz([15,30,15]);burst(t.x,t.y,'#ffe08a',26,420);ring(t.x,t.y,t.r*1.3,'255,224,138');
  G.left+=5;G.score+=50;ftext(t.x,t.y-30,'+5 s','#ffe08a',36,'Tygrys pomaga! +50');checkBelt();
 }
}

/* ---------- wejście dotykowe ---------- */
function pos(e){const b=cv.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top}}
function targetAt(x,y){
 for(let i=G.targets.length-1;i>=0;i--){const t=G.targets[i];if(t.dead)continue;const pad=14;
  if(Math.abs(x-t.x)<=t.hw+pad&&Math.abs(y-t.y)<=t.hh+pad){if(t.type==='pad'||t.type==='tiger'){if(Math.hypot(x-t.x,y-t.y)<=t.r+pad)return t}else return t}}
 return null
}
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy||1;let k=((px-ax)*dx+(py-ay)*dy)/l;k=clamp(k,0,1);return Math.hypot(px-(ax+k*dx),py-(ay+k*dy))}
function dirOf(dx,dy){return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')}

function onDown(e){
 if(!G)return;e.preventDefault();
 try{cv.setPointerCapture(e.pointerId)}catch(_){}
 const p=pos(e);
 if(G.state==='boss'){G.ptr.set(e.pointerId,{x0:p.x,y0:p.y,x:p.x,y:p.y,t0:performance.now(),done:false,boss:1});return}
 if(G.state!=='play')return;
 const t=targetAt(p.x,p.y);
 if(t&&t.type!=='shield'){hitTarget(t,'tap',p.x,p.y);G.ptr.set(e.pointerId,{done:true});return}
 G.ptr.set(e.pointerId,{x0:p.x,y0:p.y,x:p.x,y:p.y,t0:performance.now(),done:false,on:t});
}
function onMove(e){
 if(!G)return;const s=G.ptr.get(e.pointerId);if(!s||s.done)return;
 const p=pos(e),dx=p.x-s.x0,dy=p.y-s.y0,L=Math.hypot(dx,dy);
 const px=s.x,py=s.y;s.x=p.x;s.y=p.y;
 if(L<26)return;
 const dir=dirOf(dx,dy);
 if(s.boss){s.done=true;bossInput(dir,p.x,p.y);return}
 // szukamy tarczy, przez którą przeszedł palec
 let hit=null,bd=1e9;
 for(const t of G.targets){if(t.dead||t.type!=='shield')continue;const d=Math.min(segDist(t.x,t.y,s.x0,s.y0,p.x,p.y),segDist(t.x,t.y,px,py,p.x,p.y));if(d<t.r*1.25&&d<bd){bd=d;hit=t}}
 if(hit){
  s.done=true;
  if(hit.dir===dir){hitTarget(hit,'swipe',p.x,p.y)}
  else{hit.wob=1;SFX.wrong();buzz(40);G.misses++;breakCombo(hit.x,hit.y-30,null);ftext(hit.x,hit.y-hit.r-16,'Kopnij w stronę strzałki '+ARROW[hit.dir],'#ffffff',20)}
  return;
 }
 if(L>90){s.done=true;SFX.whoosh();trail(s.x0,s.y0,p.x,p.y)}
}
function onUp(e){
 if(!G)return;const s=G.ptr.get(e.pointerId);G.ptr.delete(e.pointerId);if(!s||s.done)return;
 if(s.boss){bossInput('tap',s.x,s.y);return}
 if(G.state!=='play')return;
 const L=Math.hypot(s.x-s.x0,s.y-s.y0);
 if(L<26){
  if(s.on&&!s.on.dead){s.on.wob=1;SFX.miss();ftext(s.on.x,s.on.y-s.on.r-16,'To kopnięcie – przesuń palcem '+ARROW[s.on.dir],'#ffffff',20)}
  else{SFX.miss();G.misses++;burst(s.x0,s.y0,'#9aa2af',5,140);breakCombo(s.x0,s.y0-20,G.combo>=3?null:'Pudło')}
 }else{SFX.whoosh();trail(s.x0,s.y0,s.x,s.y)}
}
function trail(x0,y0,x1,y1){G.rings.push({trail:1,x0,y0,x1,y1,age:0,life:.22})}

/* ---------- Wyzwanie Sensei ---------- */
function startBoss(){
 G.state='bossIntro';G.bossIntroT=0;G.targets.forEach(t=>{if(!t.dead){t.dead=1;t.hitT=0;t.poof=1}});
 root.classList.add('boss');
 try{DW().gong()}catch(e){}buzz([40,60,40]);
 G.boss={len:3,seq:null,i:0,hp:0,shakeT:0,hitT:0,left:BOSS_T,done:0,errT:0};newSeq();
}
function newSeq(){const b=G.boss,opts=['tap','tap','up','left','right','down'];b.seq=[];for(let i=0;i<b.len;i++){let o;do{o=opts[Math.floor(Math.random()*opts.length)]}while(i>0&&o===b.seq[i-1]&&Math.random()<.6);b.seq.push(o)}b.i=0;b.newT=0}
function bossGeom(){const r=clamp(Math.min(W,H*.5)*.27,80,130),cs=clamp((W-24)/8-6,34,52),A=area();return {x:W/2,y:Math.max(A.y0+r+cs+46,Math.min(H*.5,H-playerH()*.5-r)),r}}
function bossInput(inp,x,y){
 const b=G.boss;if(!b||G.state!=='boss')return;const g=bossGeom();
 if(inp==='tap'&&Math.hypot(x-g.x,y-g.y)>g.r*1.35){SFX.miss();return}
 const need=b.seq[b.i];
 if(inp===need){
  b.i++;b.hitT=1;const k=inp==='tap'?'tsuki':inp==='up'?'mae':inp==='down'?'kakato':'mawashi';G.tech[k]++;
  (inp==='tap'?SFX.hit:SFX.kick)(false,Math.min(10,b.i+2));buzz(16);burst(g.x+rnd(-30,30),g.y+rnd(-30,30),'#ffe08a',14,380);shake(4);lunge(g.x,g.y,inp==='tap'?'tsuki':'geri');showTech(k);
  G.combo++;G.maxCombo=Math.max(G.maxCombo,G.combo);G.hits++;const pts=25*mult();G.score+=pts;ftext(g.x+(Math.random()<.5?-1:1)*(g.r*.75),g.y+g.r*.55,'+'+pts,'#ffffff',26);
  if(b.i>=b.seq.length){
   const bonus=60*b.len*mult();G.score+=bonus;b.done++;G.tech.kiai++;
   ftext(g.x,g.y-20,'KIAI!','#ffe08a',56,'Seria zaliczona! +'+bonus);flash(.35,'255,224,138');shake(10);burst(g.x,g.y,'#ffe08a',40,560);ring(g.x,g.y,g.r,'255,224,138');
   try{DW().taiko(2)}catch(e){}showTech('kiai');
   b.len=Math.min(8,b.len+1);newSeq();
  }
  checkBelt();
 }else{
  SFX.wrong();buzz(60);b.i=0;b.errT=1;G.misses++;breakCombo(g.x,g.y+g.r+26,'Od początku!');shake(5);
 }
}

/* ---------- pętla ---------- */
function loop(now){
 raf=requestAnimationFrame(loop);
 let dt=(now-lastT)/1000;lastT=now;if(!(dt>0))dt=0;if(dt>.05)dt=.05;
 const p0=window.__graPerf?performance.now():0;
 update(dt);draw();
 if(p0)window.__graPerf.push(performance.now()-p0);
}
function update(dt){
 const g=G;
 // odliczanie
 if(g.state==='count'){g.countT+=dt;const n=Math.floor(g.countT/.75);if(n!==g.countN){g.countN=n;if(n<3){try{DW().taiko(1)}catch(e){}}else if(n===3){try{DW().beep(1046,.25,1)}catch(e){}}}if(g.countT>3.3){g.state='play'}}
 else if(g.state==='play'){
  g.t+=dt;g.left-=dt;
  const sec=Math.ceil(g.left);if(sec<=5&&sec!==g.lastSec&&sec>0)SFX.tick();g.lastSec=sec;
  g.spawnT-=dt;const d=diff();const alive=g.targets.filter(t=>!t.dead).length;
  if(g.spawnT<=0){if(alive<d.max)spawn();g.spawnT=d.every*rnd(.8,1.2);if(alive===0)g.spawnT*=.5}
  g.tigerT-=dt;if(g.tigerT<=0){spawn('tiger');g.tigerT=rnd(16,24)}
  if(g.left<=0){g.left=0;startBoss()}
 }else if(g.state==='bossIntro'){g.bossIntroT+=dt;if(g.bossIntroT>2.2){g.state='boss'}}
 else if(g.state==='boss'){
  const b=g.boss;b.left-=dt;const sec=Math.ceil(b.left);if(sec<=5&&sec!==g.lastSec&&sec>0)SFX.tick();g.lastSec=sec;
  if(b.left<=0){b.left=0;finish();return}
 }
 if(g.boss){g.boss.hitT=Math.max(0,g.boss.hitT-dt*5);g.boss.errT=Math.max(0,g.boss.errT-dt*3);g.boss.newT+=dt}
 // cele
 for(const t of g.targets){
  if(t.dead){t.hitT+=dt;continue}
  t.age+=dt;t.wob=Math.max(0,t.wob-dt*4);
  if(t.type==='tiger'){t.x+=t.vx*dt;const A=area();if(t.x<A.x0+t.hw||t.x>A.x1-t.hw)t.vx*=-1}
  if(t.age>=t.life){t.dead=1;t.hitT=0;t.escaped=1;
   if(t.type!=='cup'&&t.type!=='tiger'){g.misses++;SFX.escape();breakCombo(t.x,t.y-t.r-10,'Uciekła!')}}
 }
 g.targets=g.targets.filter(t=>!t.dead||t.hitT<.45);
 // cząsteczki
 for(const p of g.parts){p.age+=dt;p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.rot!=null)p.rot+=p.vr*dt}
 g.parts=g.parts.filter(p=>p.age<p.life);
 for(const t of g.texts)t.age+=dt;g.texts=g.texts.filter(t=>t.age<t.life);
 for(const r of g.rings)r.age+=dt;g.rings=g.rings.filter(r=>r.age<r.life);
 g.shake=Math.max(0,g.shake-dt*40);g.flash=Math.max(0,g.flash-dt*1.6);
 g.pl.k=Math.max(0,g.pl.k-dt*6);
 if(g.banner){g.banner.t+=dt;if(g.banner.t>1.6)g.banner=null}
 hud();
}

/* ---------- HUD (DOM, aktualizowany tylko przy zmianie) ---------- */
function hud(){
 const g=G,c=hudCache;
 const sc=Math.round(g.score);if(c.sc!==sc){c.sc=sc;els.score.textContent=fmt(sc)}
 const m=mult();if(c.m!==m){c.m=m;els.mul.textContent='COMBO ×'+m;els.mul.classList.toggle('on',m>1)}
 const left=g.state==='boss'||g.state==='bossIntro'?g.boss.left:g.left,tot=g.boss?BOSS_T:ROUND;
 const s=Math.ceil(left);if(c.s!==s){c.s=s;els.tmS.textContent=s;els.tm.classList.toggle('low',s<=10)}
 const fr=Math.round(clamp(left/tot,0,1)*100);if(c.fr!==fr){c.fr=fr;els.tmC.style.strokeDashoffset=String(150.8*(1-fr/100))}
 const col=g.boss?'#e2452b':'#f2c14e';if(c.col!==col){c.col=col;els.tmC.style.stroke=col}
 if(c.lvl!==g.lvl){c.lvl=g.lvl;const b=BELTS[g.lvl],nb=BELTS[g.lvl+1];els.beltI.style.background=b.c;els.beltN.textContent=b.n;els.beltB.style.background=nb?nb.c:'#f2c14e';if(g.lvl===6)els.beltI.style.background=BLACK}
 const b=BELTS[g.lvl],nb=BELTS[g.lvl+1],pr=nb?Math.round(clamp((g.score-b.at)/(nb.at-b.at),0,1)*100):100;if(c.pr!==pr){c.pr=pr;els.beltB.style.width=pr+'%'}
}

/* ---------- rysowanie ---------- */
function draw(){
 const g=G,x=cx;if(!g)return;
 x.setTransform(DPR,0,0,DPR,0,0);x.clearRect(0,0,W,H);
 if(g.shake>0){const s=g.shake;x.translate(rnd(-s,s),rnd(-s,s))}
 drawPlayer(x);
 if(g.boss&&(g.state==='boss'||g.state==='bossIntro'))drawBoss(x);
 for(const t of g.targets)drawTarget(x,t);
 // smugi i fale
 for(const r of g.rings){const k=r.age/r.life;
  if(r.ki){const a=1-k,dx=r.x1-r.x0,dy=r.y1-r.y0,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,w=7*a;x.globalAlpha=a*.85;x.fillStyle='#ffe08a';x.beginPath();x.moveTo(r.x0+dx*k*.7,r.y0+dy*k*.7);x.lineTo(r.x1+nx*w,r.y1+ny*w);x.lineTo(r.x1-nx*w,r.y1-ny*w);x.closePath();x.fill()}
  else if(r.trail){x.globalAlpha=(1-k)*.8;x.strokeStyle='#fff';x.lineCap='round';x.lineWidth=10*(1-k)+1;x.beginPath();x.moveTo(r.x0+(r.x1-r.x0)*k*.6,r.y0+(r.y1-r.y0)*k*.6);x.lineTo(r.x1,r.y1);x.stroke()}
  else{x.globalAlpha=1-k;x.strokeStyle=`rgba(${r.col},1)`;x.lineWidth=6*(1-k)+1;x.beginPath();x.arc(r.x,r.y,r.r0*(1+k*.9),0,7);x.stroke()}}
 x.globalAlpha=1;
 // cząsteczki
 const sp=SPR.spark;
 for(const p of g.parts){const k=1-p.age/p.life;x.globalAlpha=k;
  if(p.rect){x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.fillStyle=p.c;x.fillRect(-p.s,-p.s*.35,p.s*2,p.s*.7);x.restore()}
  else if(p.spark&&sp){const s=p.s*3.2*k+4;x.drawImage(sp,p.x-s/2,p.y-s/2,s,s)}
  else{x.fillStyle=p.c;x.beginPath();x.arc(p.x,p.y,p.s*k+.5,0,7);x.fill()}}
 x.globalAlpha=1;
 // teksty
 x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
 for(const t of g.texts){const k=t.age/t.life,pop=k<.15?easeOutBack(k/.15):1,y=t.y-k*40;x.globalAlpha=k>.7?1-(k-.7)/.3:1;
  x.font=`italic 800 ${Math.round(t.size*pop)}px ${FONT}`;x.lineWidth=5;x.strokeStyle='rgba(0,0,0,.65)';x.strokeText(t.txt,t.x,y);x.fillStyle=t.col;x.fillText(t.txt,t.x,y);
  if(t.sub){x.font=`700 16px ${FONT}`;x.lineWidth=4;x.strokeText(t.sub,t.x,y+t.size*.62);x.fillStyle='#ffe08a';x.fillText(t.sub,t.x,y+t.size*.62)}}
 x.globalAlpha=1;
 x.setTransform(DPR,0,0,DPR,0,0);
 if(g.flash>0){x.fillStyle=`rgba(${g.flashC},${g.flash})`;x.fillRect(0,0,W,H)}
 if(g.banner)drawBanner(x,g.banner);
 if(g.state==='count')drawCount(x);
 if(g.state==='bossIntro')drawBossIntro(x);
}
function textC(x,t,px,py,size,col,stroke){x.font=`italic 800 ${size}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=Math.max(4,size*.09);x.strokeStyle=stroke||'rgba(0,0,0,.7)';x.strokeText(t,px,py);x.fillStyle=col;x.fillText(t,px,py)}
function drawCount(x){
 const g=G,n=g.countN,k=(g.countT%.75)/.75;
 const words=['SAN','NI','ICHI','HAJIME!'],sub=['3','2','1','Zaczynamy!'];if(n>3)return;
 const s=easeOutBack(Math.min(1,k/.35));x.globalAlpha=n===3?Math.max(0,1-Math.max(0,k-.6)/.4):1;
 textC(x,words[n],W/2,H*.42,Math.round((n===3?72:96)*s),n===3?'#ffe08a':'#ffffff');
 x.font=`700 22px ${FONT}`;x.fillStyle='#c9ced6';x.fillText(sub[n],W/2,H*.42+64);x.globalAlpha=1;
}
function drawBanner(x,b){
 const k=b.t/1.6,a=k<.15?k/.15:k>.8?(1-k)/.2:1,y=H*.4;x.globalAlpha=a;
 x.fillStyle='rgba(7,9,13,.78)';x.fillRect(0,y-46,W,92);
 x.fillStyle=b.b.c;const off=(1-Math.min(1,k/.2))*W;x.fillRect(-off,y-8,W,16);if(b.b.c==='#151515'){x.fillStyle='#f2c14e';x.fillRect(-off,y-1,W,2)}
 const bt=b.b.n.toUpperCase()+'!';textC(x,bt,W/2,y-24,fitSize(x,bt,34,W-36,'italic 800'),'#ffe08a');x.font=`600 17px ${FONT}`;x.fillStyle='#e6e8ec';x.fillText('Nowy poziom – będzie szybciej!',W/2,y+28);x.globalAlpha=1;
}
function fitSize(x,t,size,maxW,style){x.font=`${style} ${size}px ${FONT}`;const w=x.measureText(t).width;return w>maxW?Math.floor(size*maxW/w):size}
function drawBossIntro(x){
 const k=G.bossIntroT/2.2,a=k<.1?k/.1:k>.85?(1-k)/.15:1,y=H*.3;x.globalAlpha=a;
 x.fillStyle='rgba(7,9,13,.72)';x.fillRect(0,0,W,H);
 const t='WYZWANIE SENSEI!';textC(x,t,W/2,y,fitSize(x,t,52,W-40,'italic 800'),'#ffe08a');
 x.textAlign='center';x.fillStyle='#fff';
 const L=['Sensei pokaże serię technik.','Powtórz ją po kolei:','● – stuknij tarczę (cios)','strzałka – przesuń palcem (kopnięcie)'];
 L.forEach((l,i)=>{x.font=`600 ${fitSize(x,l,20,W-40,'600')}px ${FONT}`;x.fillStyle=i>1?'#ffe08a':'#fff';x.fillText(l,W/2,y+48+i*28)});x.globalAlpha=1;
}
function drawPlayer(x){
 const g=G,pl=g.pl,ph=playerH();
 const c=playerImg&&scaled(playerImg,Math.round(ph*DPR));
 const bx=W/2,by=H-8-ph*0.02;
 // poświata podłogi
 x.fillStyle='rgba(0,0,0,.45)';x.beginPath();x.ellipse(bx,by-6,ph*.26,ph*.05,0,0,7);x.fill();
 if(!c)return;
 const k=pl.k,ease=k*k;let dx=0,rot=0,sx=1,sy=1;
 if(k>0){const tx=pl.tx-bx;dx=clamp(tx*.08,-22,22)*ease;rot=clamp(tx/W,-.5,.5)*.22*ease;if(pl.kind==='geri'){sy=1+.04*ease;rot*=1.6}else{sx=1+.05*ease;sy=1-.04*ease}}
 const idle=Math.sin(performance.now()/420)*1.5;
 x.save();x.translate(bx+dx,by);x.rotate(rot);x.scale(pl.face*sx,sy);
 const w=c.width/DPR,h=c.height/DPR;x.drawImage(c,-w/2,-h+idle*.5,w,h);x.restore();
}
function drawTarget(x,t){
 const r=t.r;let sc=1,al=1;
 if(!t.dead){const a=t.age;sc=a<.2?easeOutBack(a/.2):1;
  const p=a/t.life;if(p>.8)sc*=1-(p-.8)*.6;
  if(t.wob>0)x.save(),x.translate(Math.sin(t.wob*40)*6*t.wob,0)}
 else{const k=t.hitT/.45;
  if(t.escaped||t.poof){sc=1-k;al=1-k}
  else if(t.type==='shield'&&t.fly){al=1-k;sc=1+k*.2}
  else{sc=1+k*.35;al=1-k}
  if(al<=0)return}
 x.globalAlpha=al;
 let ox=t.x,oy=t.y;
 if(t.dead&&t.fly){const k=t.hitT/.45;ox+=t.fly[0]*k*120;oy+=t.fly[1]*k*120}
 // pierścień czasu
 if(!t.dead&&t.type!=='cup'&&t.type!=='tiger'){
  const p=t.age/t.life,ap=.65,rr2=t.type==='board'?t.hw*1.05:t.type==='shield'?t.hh*1.0:r;
  const R=p<ap?rr2*(1+1.1*(1-p/ap)):rr2*(1+.08*Math.sin((p-ap)*40));
  const perf=p>.5&&p<.8;
  x.lineWidth=perf?5:3;x.strokeStyle=perf?'rgba(255,224,138,.95)':p>.8?'rgba(255,120,100,.8)':'rgba(255,255,255,.55)';
  x.beginPath();x.arc(t.x,t.y,R,0,7);x.stroke();
 }
 const s=SPR[t.type==='pad'?'pad':t.type==='shield'?'shield':t.type==='board'?'board':t.type==='cup'?'cup':null];
 x.save();x.translate(ox,oy);
 if(t.dead&&t.type==='shield'&&t.fly)x.rotate(t.fly[0]*t.hitT*3);
 x.scale(sc,sc);
 if(t.type==='tiger'){
  if(SPR.glow){const gs=r*3*(1+.06*Math.sin(t.age*8));x.drawImage(SPR.glow,-gs/2,-gs/2,gs,gs)}
  const ti=tigerImg&&scaled(tigerImg,Math.round(r*2.3*DPR));if(ti){const w=ti.width/DPR,h=ti.height/DPR;x.drawImage(ti,-w/2,-h/2,w,h)}
  x.font=`italic 800 20px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.7)';x.strokeText('+5 s',0,r*1.05);x.fillStyle='#ffe08a';x.fillText('+5 s',0,r*1.05);
 }else if(t.type==='board'&&t.dead&&!t.escaped&&!t.poof){
  // pęknięta deska – dwie połówki
  const k=t.hitT/.45,w=s.width/DPR,h=s.height/DPR,sw=s.width/2;
  x.save();x.translate(-k*40,k*30);x.rotate(-k*.6);x.drawImage(s,0,0,sw,s.height,-w/2,-h/2,w/2,h);x.restore();
  x.save();x.translate(k*40,k*30);x.rotate(k*.6);x.drawImage(s,sw,0,sw,s.height,0,-h/2,w/2,h);x.restore();
 }else if(s){
  const w=s.width/DPR,h=s.height/DPR;x.drawImage(s,-w/2,-h/2,w,h);
  if(t.type==='shield'&&SPR.arrow){const a=SPR.arrow,aw=a.width/DPR;x.save();x.rotate({up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2}[t.dir]);
   if(!t.dead){const bob=Math.sin(t.age*10)*3;x.translate(0,-bob)}x.drawImage(a,-aw/2,-aw/2,aw,aw);x.restore()}
  if(t.type==='board'&&!t.dead){
   // pęknięcia i kropki „ile jeszcze”
   x.strokeStyle='rgba(60,30,10,.85)';x.lineWidth=2.5;const dmg=3-t.hp;
   if(dmg>=1){x.beginPath();x.moveTo(-2,-h*.38);x.lineTo(6,-h*.1);x.lineTo(-4,h*.05);x.stroke()}
   if(dmg>=2){x.beginPath();x.moveTo(-4,h*.05);x.lineTo(5,h*.22);x.lineTo(-1,h*.38);x.moveTo(6,-h*.1);x.lineTo(20,-h*.02);x.stroke()}
   for(let i=0;i<3;i++){x.fillStyle=i<t.hp?'#fff':'rgba(255,255,255,.25)';x.beginPath();x.arc((i-1)*16,h*.5+10,5,0,7);x.fill()}
  }
 }
 x.restore();
 if(!t.dead&&t.wob>0)x.restore();
 x.globalAlpha=1;
}
function drawBoss(x){
 const b=G.boss,g=bossGeom(),intro=G.state==='bossIntro'?Math.min(1,G.bossIntroT/.6):1;
 const r=Math.max(1,g.r*easeOutBack(intro)),hk=b.hitT;
 x.save();x.translate(g.x+(b.errT>0?Math.sin(b.errT*50)*8*b.errT:0),g.y);x.scale(1-hk*.06,1-hk*.06);
 if(SPR.glow){const gs=r*2.6;x.globalAlpha=.55+.15*Math.sin(performance.now()/300);x.drawImage(SPR.glow,-gs/2,-gs/2,gs,gs);x.globalAlpha=1}
 // duża tarcza sensei
 let gr=x.createRadialGradient(-r*.3,-r*.35,r*.1,0,0,r);gr.addColorStop(0,'#3a3f4b');gr.addColorStop(.75,'#16191f');gr.addColorStop(1,'#07080a');
 x.fillStyle=gr;x.beginPath();x.arc(0,0,r,0,7);x.fill();
 x.lineWidth=r*.07;x.strokeStyle='#f2c14e';x.beginPath();x.arc(0,0,r*.92,0,7);x.stroke();
 x.lineWidth=r*.04;x.strokeStyle='rgba(242,193,78,.55)';x.beginPath();x.arc(0,0,r*.62,0,7);x.stroke();
 x.fillStyle='#e2452b';x.beginPath();x.arc(0,0,r*.3,0,7);x.fill();
 x.fillStyle='rgba(255,255,255,.1)';x.beginPath();x.ellipse(-r*.35,-r*.45,r*.35,r*.15,-.6,0,7);x.fill();
 textC(x,'SENSEI',0,r*.62+r*.0,Math.round(r*.2),'#ffe08a');
 x.restore();
 if(G.state!=='boss')return;
 // seria technik
 const n=b.seq.length,cs=clamp((W-24)/n-6,34,52),tw=n*(cs+6)-6,sx=W/2-tw/2+cs/2,sy=g.y-g.r-cs*.5-22;
 for(let i=0;i<n;i++){const cxp=sx+i*(cs+6),done=i<b.i,cur=i===b.i,pop=b.newT<.4?easeOutBack(clamp((b.newT-i*.06)/.25,0,1)):1;
  x.save();x.translate(cxp,sy);x.scale(pop*(cur?1.12:1),pop*(cur?1.12:1));
  x.fillStyle=done?'rgba(242,193,78,.9)':cur?'#ffffff':'rgba(17,20,27,.85)';x.strokeStyle=cur?'#f2c14e':'rgba(255,255,255,.25)';x.lineWidth=cur?3:1.5;rr(x,-cs/2,-cs/2,cs,cs,10);x.fill();x.stroke();
  const s=b.seq[i],col=done?'#1a1405':cur?'#11141b':'#f1f2f4';
  if(s==='tap'){x.fillStyle=done?'#1a1405':'#e2452b';x.beginPath();x.arc(0,0,cs*.24,0,7);x.fill()}
  else{x.fillStyle=col;x.rotate({up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2}[s]);const a=cs*.3;x.beginPath();x.moveTo(0,-a);x.lineTo(a*.85,0);x.lineTo(a*.32,0);x.lineTo(a*.32,a);x.lineTo(-a*.32,a);x.lineTo(-a*.32,0);x.lineTo(-a*.85,0);x.closePath();x.fill()}
  x.restore()}
 const need=b.seq[b.i],hint=need==='tap'?'Stuknij tarczę – cios!':need==='up'?'Przesuń palcem w górę – mae geri':need==='down'?'Przesuń palcem w dół – kakato':'Przesuń palcem '+(need==='left'?'w lewo':'w prawo')+' – mawashi geri';
 x.font=`600 17px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.7)';x.strokeText(hint,W/2,sy-cs*.5-16);x.fillStyle='#fff';x.fillText(hint,W/2,sy-cs*.5-16);
}

/* ---------- ekrany ---------- */
function iconCanvas(kind){
 const c=document.createElement('canvas'),s=46,d=DPR;c.width=s*d;c.height=s*d;const x=c.getContext('2d');x.scale(d,d);
 const spr=kind==='arrow'?SPR.shield:SPR[kind];
 if(kind==='tiger'&&tigerImg){const draw_=()=>{const ti=scaled(tigerImg,Math.round(44*d));if(ti)x.drawImage(ti,1,1,44,44)};if(tigerImg.complete)draw_();else tigerImg.addEventListener('load',draw_,{once:true});return c}
 if(spr){const k=Math.min(s/(spr.width/d),s/(spr.height/d))*.95,w=spr.width/d*k,h=spr.height/d*k;x.drawImage(spr,(s-w)/2,(s-h)/2,w,h);
  if(kind==='arrow'&&SPR.arrow){const a=SPR.arrow,aw=a.width/d*k;x.drawImage(a,(s-aw)/2,(s-aw)/2,aw,aw)}}
 if(kind==='ring'){x.drawImage(SPR.pad,8,8,30,30);x.strokeStyle='#ffe08a';x.lineWidth=3;x.beginPath();x.arc(23,23,19,0,7);x.stroke()}
 return c
}
function gameData(){const S=S_();S.game=S.game||{best:0,plays:0,lvl:0,combo:0};return S.game}
function coinsToday(){const S=S_(),d=DW().today(),p=S.paid||{};let got=0,max=0;COIN_TIERS.forEach((t,i)=>{max+=t[1];if(p['gra'+d+'-'+i])got+=t[1]});return {got,max}}
function screenStart(){
 root.classList.add('menu');
 const gd=gameData(),ct=coinsToday(),S=S_();
 const sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="g-in">
  <button class="g-ib g-x" data-g="exit" aria-label="Wyjdź">${XSVG}</button>
  <p class="g-kick">Mini-gra · Kumite</p><h2 class="g-t">Dojo Refleks</h2>
  <div class="g-hero"><img src="media/sklep/shop-${esc(S.look||'baza')}.webp" alt=""><img class="g-tg" src="media/sklep/shop-tygrys.webp" alt=""></div>
  <div class="g-best"><div><b>${fmt(gd.best||0)}</b><span>Twój rekord</span></div><div><b>${gd.best?esc(BELTS[gd.lvl||0].n.replace(' pas','')):'–'}</b><span>najwyższy pas w grze</span></div><div><b>${ct.max-ct.got}</b><span>monet do zdobycia dziś</span></div></div>
  <div class="g-how"><h3>Jak grać?</h3>
   <div class="g-row" data-ic="pad"><p><b>Czerwona tarcza – stuknij!</b><small>To cios pięścią: seiken tsuki.</small></p></div>
   <div class="g-row" data-ic="arrow"><p><b>Niebieska tarcza – przesuń palcem</b><small>w stronę strzałki. To kopnięcie: mae geri, mawashi geri.</small></p></div>
   <div class="g-row" data-ic="board"><p><b>Deska – stuknij 3 razy</b><small>Rozbij ją jak na tameshiwari!</small></p></div>
   <div class="g-row" data-ic="cup"><p><b>Herbatki sensei nie ruszaj!</b><small>Stłuczona czarka zabiera 3 sekundy.</small></p></div>
   <div class="g-row" data-ic="ring"><p><b>Złoty krąg = Doskonale!</b><small>Uderz, gdy krąg dotknie tarczy – punkty ×2.</small></p></div>
   <div class="g-row" data-ic="tiger"><p><b>Tygrys daje +5 sekund</b><small>Na końcu czeka Wyzwanie Sensei!</small></p></div>
  </div>
  <div class="g-btns g-stick"><button class="btn-p full bigbtn" data-g="go">Zaczynamy! Osu!</button></div></div>`;
 sc.querySelectorAll('[data-ic]').forEach(r=>r.prepend(iconCanvas(r.dataset.ic)));
 sc.scrollTop=0;
}
function screenPause(){
 const sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="g-pause"><h2>Pauza</h2><p style="text-align:center;color:#c9ced6;margin:0 0 8px">Złap oddech. Gotowa?</p>
  <button class="btn-p full bigbtn" data-g="resume">Wracam do gry</button><button class="full bigbtn" data-g="go">Zacznij od nowa</button><button class="full bigbtn" data-g="exit">Wyjdź</button></div>`;
}
const XSVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function finish(){
 const g=G;g.state='over';stopLoop();root.classList.remove('boss');
 const gd=gameData(),S=S_(),score=Math.round(g.score),rec=score>(gd.best||0)&&score>0;
 gd.plays=(gd.plays||0)+1;if(rec)gd.best=score;gd.lvl=Math.max(gd.lvl||0,g.lvl);gd.combo=Math.max(gd.combo||0,g.maxCombo);gd.last=DW().today();
 // monety: progi raz dziennie (max 15/dzień), XP przy pierwszej nagrodzie dnia
 let coins=0,first=false;const d=DW().today();S.paid=S.paid||{};
 if(g.hits>0)COIN_TIERS.forEach((t,i)=>{const k='gra'+d+'-'+i;if(score>=t[0]&&!S.paid[k]){S.paid[k]=1;coins+=t[1];if(i===0)first=true}});
 try{DW().save()}catch(e){}
 if(coins)try{DW().addCoins(coins,'Dojo Refleks')}catch(e){}
 if(first)try{DW().addXP(10)}catch(e){}
 try{DW().save()}catch(e){}
 const ct=coinsToday(),acc=g.hits+g.misses?Math.round(g.hits/(g.hits+g.misses)*100):0;
 const T=g.tech,rows=[['tsuki',T.tsuki],['mae',T.mae],['mawashi',T.mawashi],['kakato',T.kakato],['wari',T.wari],['kiai',T.kiai]].filter(r=>r[1]>0);
 const b=BELTS[g.lvl];
 const praise=score>=3700?'Mistrzowski refleks!':score>=1400?'Świetna walka!':score>=500?'Dobra robota!':'Każdy mistrz kiedyś zaczynał!';
 root.classList.add('menu');const sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="g-in g-res">
  <p class="g-kick" style="margin-top:6px">Koniec rundy</p><h2 class="g-t" style="font-size:38px">${praise}</h2>
  <div class="g-big">${fmt(score)}</div>
  ${rec?'<span class="g-rec">NOWY REKORD!</span>':`<p style="margin:0;color:#9aa2af">Rekord: <b style="color:#f2c14e">${fmt(gd.best||0)}</b></p>`}
  <div class="g-beltbig"><i style="background:${g.lvl===6?BLACK:b.c}"></i>${b.n}</div>
  <div class="g-grid"><div><b>${g.hits}</b><span>trafień</span></div><div><b>${g.maxCombo}</b><span>najdłuższe combo</span></div><div><b>${acc}%</b><span>celność</span></div></div>
  ${rows.length?`<div class="g-tl"><p class="g-kick" style="margin:2px 0 4px">Twoje techniki</p>${rows.map(r=>`<div><span><b>${TECH[r[0]][0]}</b> · ${TECH[r[0]][1]}</span><span>×${r[1]}</span></div>`).join('')}</div>`:''}
  <p class="g-coins">${coins?`Zdobywasz <b>+${coins} monet</b>${first?' i <b>+10 XP</b>':''}!`:ct.got>=ct.max?'Dzisiejsze monety z gry już zebrane – wróć jutro!':`Zdobądź ${ct.got?'kolejny próg':'pierwsze trafienie'}, a dostaniesz monety (dziś jeszcze ${ct.max-ct.got}).`}</p>
  <div class="g-btns g-stick"><button class="btn-p full bigbtn" data-g="go">Zagraj jeszcze raz</button><button class="full bigbtn" data-g="exit">Wyjdź</button></div></div>`;
 sc.scrollTop=0;
 if(rec){try{DW().fanfare()}catch(e){}try{DW().say('Nowy rekord! '+score+' punktów. Osu!')}catch(e){}}
 else{try{DW().gong()}catch(e){}}
 hudCache={};
}

/* ---------- sterowanie ---------- */
function startLoop(){if(raf)return;lastT=performance.now();raf=requestAnimationFrame(loop)}
function stopLoop(){if(raf)cancelAnimationFrame(raf);raf=0}
function play(){
 G=newGame();hudCache={};root.classList.remove('menu');els.scr.hidden=true;els.scr.innerHTML='';root.classList.remove('boss');
 els.tech.classList.remove('on');shakeOK=!reducedMotion();
 hud();startLoop();
}
function pause(){if(!G||!['play','count','boss','bossIntro'].includes(G.state))return;G.prev=G.state;G.state='pause';stopLoop();G.ptr.clear();screenPause()}
function resume(){if(!G||G.state!=='pause')return;G.state=G.prev;els.scr.hidden=true;els.scr.innerHTML='';startLoop()}
function onClick(e){const b=e.target.closest('[data-g]');if(!b)return;const a=b.dataset.g;
 if(a==='go')play();else if(a==='exit')close();else if(a==='pause')pause();else if(a==='resume')resume()}
function onVis(){if(document.hidden)pause()}
function onKey(e){if(e.key==='Escape'){if(G&&G.state==='pause')resume();else pause()}}

function open(){
 if(root&&!root.hidden)return;
 root=document.getElementById('gra');if(!root){root=document.createElement('div');root.id='gra';document.body.appendChild(root)}
 if(!document.getElementById('gra-css')){const st=document.createElement('style');st.id='gra-css';st.textContent=CSS;document.head.appendChild(st)}
 const S=S_();
 playerImg=loadImg(`media/sklep/shop-${S.look||'baza'}.webp`);tigerImg=loadImg('media/sklep/shop-tygrys.webp');
 const bg=S.bg?`media/sklep/shop-${S.bg}.webp`:'media/sklep/shop-tlo-dojo.webp';
 root.innerHTML=`<div class="g-bg" style="background-image:url('${bg}')"></div><canvas></canvas>
  <div class="g-hud"><button class="g-ib" data-g="pause" aria-label="Pauza">${PSVG}</button>
   <div class="g-sc"><b>0</b><span class="g-mul">COMBO ×1</span></div>
   <div class="g-tm"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="rgba(17,20,27,.75)" stroke="rgba(255,255,255,.12)" stroke-width="4"/><circle cx="28" cy="28" r="24" fill="none" stroke="#f2c14e" stroke-width="4" stroke-linecap="round" stroke-dasharray="150.8" stroke-dashoffset="0"/></svg><span>60</span></div></div>
  <div class="g-belt"><i></i><em></em><div><b></b></div></div>
  <div class="g-tech"></div><div class="g-scr" hidden></div>`;
 cv=root.querySelector('canvas');cx=cv.getContext('2d');
 els={score:root.querySelector('.g-sc b'),mul:root.querySelector('.g-mul'),tm:root.querySelector('.g-tm'),tmS:root.querySelector('.g-tm span'),tmC:root.querySelectorAll('.g-tm circle')[1],
  beltI:root.querySelector('.g-belt i'),beltN:root.querySelector('.g-belt em'),beltB:root.querySelector('.g-belt b'),tech:root.querySelector('.g-tech'),scr:root.querySelector('.g-scr')};
 root.hidden=false;document.documentElement.style.overflow='hidden';
 resize();
 on(cv,'pointerdown',onDown);on(cv,'pointermove',onMove);on(cv,'pointerup',onUp);on(cv,'pointercancel',onUp);
 on(root,'click',onClick);on(root,'contextmenu',e=>e.preventDefault());
 on(window,'resize',resize);on(document,'visibilitychange',onVis);on(document,'keydown',onKey);
 G=newGame();G.state='menu';hudCache={};hud();
 screenStart();
 try{DW().music(true)}catch(e){}
}
function close(){
 stopLoop();timers.forEach(clearTimeout);timers=[];clearTimeout(hudCache.techT);
 listeners.forEach(([t,ev,fn,opt])=>t.removeEventListener(ev,fn,opt));listeners=[];
 if(root){root.hidden=true;root.innerHTML='';root.classList.remove('boss')}
 document.documentElement.style.overflow='';
 G=null;cv=null;cx=null;els={};hudCache={};
 try{DW().music(false)}catch(e){}
}
window.Gra={open,close,get running(){return !!raf},_state:()=>G};
})();

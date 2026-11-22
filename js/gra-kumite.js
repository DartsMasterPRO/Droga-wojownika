/* Turniej Kumite – mini-gra dla „Droga wojownika”.
   Zwykły skrypt (IIFE). Publiczne API: window.Games.kumite.open() / .close().
   Korzysta z mostka window.DW (definiowanego w index.html). */
(function(){
'use strict';

/* ---------- stałe ---------- */
const ID='g-kumite';
const FONT="'Barlow Condensed','Arial Narrow',sans-serif";
const FIGHT_T=45,ENCHO_T=20,PERF=.45,GRACE=.12;
const STAGES=['1/8 finału','Ćwierćfinał','Półfinał','FINAŁ'];
const LV={
 jodan:{c:'#ff5a4a',rgb:'255,90,74',jp:'JODAN',pl:'wysoko',def:'up',y:.84},
 chudan:{c:'#ffd23f',rgb:'255,210,63',jp:'CHUDAN',pl:'w brzuch',def:'left',y:.55},
 gedan:{c:'#4aa8ff',rgb:'74,168,255',jp:'GEDAN',pl:'nisko',def:'down',y:.2}
};
const ARROW={up:'↑',down:'↓',left:'←',right:'→',tap:'●'};
const TECH={
 tsuki:['Seiken tsuki','cios pięścią'],mae:['Mae geri','kopnięcie przednie'],mawashi:['Mawashi geri','kopnięcie okrężne'],
 gedan:['Gedan mawashi','niskie kopnięcie'],uke:['Jodan uke','blok górny'],barai:['Gedan barai','blok dolny'],sabaki:['Tai sabaki','unik']
};
const ATK={tsuki:{d:3.2,cd:.26,imp:.08,lv:'chudan'},mae:{d:4.2,cd:.42,imp:.13,lv:'chudan'},mawashi:{d:5,cd:.5,imp:.16,lv:'jodan'},gedan:{d:4.2,cd:.42,imp:.13,lv:'gedan'}};
const TERMS={
 'OSU!':['Pozdrowienie karateków – szacunek i siła','Osu!'],
 HAJIME:['Zaczynajcie walkę!','Hadżime!'],
 YAME:['Stop! Sędzia przerywa walkę.','Jame!'],
 'WAZA-ARI':['Pół punktu – za mocne, czyste trafienia','Łaza ari!'],
 IPPON:['Cały punkt: dwa waza-ari = wygrana!','Ippon!'],
 HANTEI:['Decyzja sędziów: czerwona chorągiewka = Ty','Hantej!'],
 ENCHO:['Dogrywka – remis, walczymy dalej!','Enczo!']
};
const OPP=[
 {n:'Silna Ola',img:'ochraniacze',belt:'#f08a24',bn:'pomarańczowy',style:'Wolne, ale mocne kopnięcia',
  tip:'Ola kopie wolno, ale bardzo mocno. Czekaj spokojnie na błysk! Ciosy pięścią często blokuje – lepiej kopnij.',
  wu:1.2,gap:[1.9,2.7],dmg:22,lv:{jodan:3,chudan:1,gedan:3},g:{tsuki:.45,kick:.08},dbl:0,tri:0,feint:0,tough:1.05},
 {n:'Szybka Zosia',img:'rekawice',belt:'#f2d02e',bn:'żółty',style:'Szybkie ciosy, często dwa naraz',
  tip:'Zosia bije szybko i często dwa razy pod rząd. Żółty błysk? Przesuń w lewo ← – nawet dwa razy!',
  wu:.88,gap:[1.3,1.9],dmg:16,lv:{jodan:1,chudan:4,gedan:1},g:{tsuki:.15,kick:.15},dbl:.45,tri:0,feint:0,tough:1},
 {n:'Podstępna Kasia',img:'hachimaki',belt:'#3aa655',bn:'zielony',style:'Zwody i podstępy',
  tip:'Kasia udaje atak, a potem go zmienia! Gdy błysk zmieni kolor – zmień obronę.',
  wu:.92,gap:[1.4,2.1],dmg:21,lv:{jodan:2,chudan:2,gedan:2},g:{tsuki:.2,kick:.2},dbl:.15,tri:0,feint:.45,tough:.92},
 {n:'Mistrzyni Aiko',img:'gi-czarne-wyk',belt:'#8a5a2b',bn:'brązowy',style:'Serie, zwody i mocne kopnięcia',
  tip:'Wielki finał! Aiko łączy wszystko: serie, zwody i mocne kopnięcia. Idealny blok daje KONTRĘ – wykorzystaj ją!',
  wu:.8,gap:[1.2,1.8],dmg:22,lv:{jodan:2,chudan:2,gedan:2},g:{tsuki:.25,kick:.22},dbl:.35,tri:.15,feint:.25,tough:.82}
];
const ALT=['kask','zestaw','baza'];
const COIN_TIER={0:0,2:1,3:2}; // wygrana walka (etap) -> próg monet

const DW=()=>window.DW||{};
const S_=()=>{try{return DW().getS()||{}}catch(e){return {}}};
const dw=(fn,...a)=>{try{const f=DW()[fn];return typeof f==='function'?f(...a):undefined}catch(e){}};
const today=()=>dw('today')||new Date().toISOString().slice(0,10);
const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const easeOutBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const fmt=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=w=>{let s=0;for(const k in w)s+=w[k];let r=Math.random()*s;for(const k in w){if((r-=w[k])<0)return k}return Object.keys(w)[0]};

/* ---------- dźwięk ---------- */
let noiseBuf=null;
function ac(){if(S_().mute)return null;try{return DW().actx()}catch(e){return null}}
function noise(a){if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate)return noiseBuf;const n=a.sampleRate*.5,b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return noiseBuf=b}
function nz(a,t,dur,type,f0,f1,vol,loop){const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noise(a);s.loop=!!loop;f.type=type;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);f.connect(g);g.connect(a.destination);
 if(loop){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur*.3);g.gain.exponentialRampToValueAtTime(.0001,t+dur)}else{g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur)}
 s.start(t,loop?0:Math.random()*.3);s.stop(t+dur+.02)}
function tone(a,t,type,f0,f1,dur,vol){const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.02)}
const SFX={
 punch(c){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',170,55,.16,.7);nz(a,t,.07,'lowpass',1800,400,.5);if(c)tone(a,t+.03,'triangle',1320,0,.18,.12)},
 kick(c){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',140,48,.2,.8);nz(a,t,.08,'lowpass',1500,300,.45);if(c)tone(a,t+.03,'triangle',1568,0,.2,.12)},
 swish(){const a=ac();if(!a)return;nz(a,a.currentTime,.13,'bandpass',600,2400,.2)},
 block(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',520,300,.07,.4);nz(a,t,.05,'bandpass',2200,0,.3)},
 perfect(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',520,300,.07,.4);nz(a,t,.05,'bandpass',2200,0,.3);[1568,2093,2637].forEach((f,i)=>tone(a,t+.04+i*.05,'sine',f,0,.3,.13))},
 hurt(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',120,42,.28,.85);nz(a,t,.12,'lowpass',900,200,.5);tone(a,t,'square',90,60,.1,.08)},
 tell(lv){const a=ac();if(!a)return;const t=a.currentTime,f=lv==='jodan'?990:lv==='chudan'?740:520;tone(a,t,'triangle',f,0,.09,.16);tone(a,t+.08,'triangle',f*1.26,0,.1,.12)},
 feint(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',660,440,.15,.14)},
 wrong(){const a=ac();if(!a)return;tone(a,a.currentTime,'sawtooth',220,140,.18,.08)},
 crowd(v){const a=ac();if(!a)return;nz(a,a.currentTime,1.4,'bandpass',900,700,v||.22,true)},
 whistle(){const a=ac();if(!a)return;const t=a.currentTime,o=a.createOscillator(),l=a.createOscillator(),lg=a.createGain(),g=a.createGain();o.type='sine';o.frequency.value=2900;l.frequency.value=32;lg.gain.value=180;l.connect(lg);lg.connect(o.frequency);o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.setValueAtTime(.12,t+.3);g.gain.exponentialRampToValueAtTime(.0001,t+.42);o.start(t);l.start(t);o.stop(t+.45);l.stop(t+.45)},
 tick(){const a=ac();if(!a)return;tone(a,a.currentTime,'square',1200,0,.04,.05)}
};
const buzz=p=>{if(S_().mute)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
const taiko=n=>dw('taiko',n);
function voice(t){dw('say',t)}

/* ---------- grafiki ---------- */
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c}
const SPR={};let SPR_DPR=0;
function buildSprites(dpr){
 if(SPR_DPR===dpr)return;SPR_DPR=dpr;
 {const s=32*dpr,c=mk(s,s),x=c.getContext('2d'),m=s/2,g=x.createRadialGradient(m,m,0,m,m,m);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,230,160,.9)');g.addColorStop(1,'rgba(255,180,60,0)');x.fillStyle=g;x.fillRect(0,0,s,s);SPR.spark=c}
 {const s=128*dpr,c=mk(s,s),x=c.getContext('2d'),m=s/2,g=x.createRadialGradient(m,m,0,m,m,m);g.addColorStop(0,'rgba(255,224,138,.8)');g.addColorStop(.45,'rgba(242,193,78,.3)');g.addColorStop(1,'rgba(242,193,78,0)');x.fillStyle=g;x.fillRect(0,0,s,s);SPR.glow=c}
}
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}

const IMG={};
function loadImg(src){if(IMG[src])return IMG[src];const i=new Image();i.decoding='async';i.src=src;IMG[src]=i;return i}
const ready=i=>i&&i.complete&&i.naturalWidth>0;
function whenReady(i,fn){if(ready(i))fn();else i.addEventListener('load',()=>{if(root)fn()},{once:true})}
/* obrys postaci (bez przezroczystych marginesów) + środek głowy */
function bbox(img){
 if(img._bb)return img._bb;
 const k=200/img.naturalHeight,w=Math.round(img.naturalWidth*k),h=200,c=mk(w,h),x=c.getContext('2d');x.drawImage(img,0,0,w,h);
 const d=x.getImageData(0,0,w,h).data;let x0=w,x1=0,y0=h,y1=0;
 for(let y=0;y<h;y++)for(let i=0;i<w;i++)if(d[(y*w+i)*4+3]>40){if(i<x0)x0=i;if(i>x1)x1=i;if(y<y0)y0=y;if(y>y1)y1=y}
 if(x1<=x0){x0=0;x1=w-1;y0=0;y1=h-1}
 let sx=0,n=0;const hy=y0+Math.round((y1-y0)*.12);for(let y=y0;y<=hy;y++)for(let i=x0;i<=x1;i++)if(d[(y*w+i)*4+3]>40){sx+=i;n++}
 const hx=n?sx/n:(x0+x1)/2;
 return img._bb={x:x0/k,y:y0/k,w:(x1-x0+1)/k,h:(y1-y0+1)/k,hx:hx/k}
}
/* gotowy duszek walczącej: przycięty, w danej wysokości, opcjonalnie z przemalowanym pasem */
function makeFighter(img,h,dpr,belt){
 const bb=bbox(img),k=h*dpr/bb.h,w=Math.round(bb.w*k),H=Math.round(h*dpr);
 const c=mk(w,H),x=c.getContext('2d');x.drawImage(img,bb.x,bb.y,bb.w,bb.h,0,0,w,H);
 if(belt){
  const id=x.getImageData(0,0,c.width,c.height),d=id.data;
  const tr=parseInt(belt.slice(1,3),16),tg=parseInt(belt.slice(3,5),16),tb=parseInt(belt.slice(5,7),16);
  for(let i=0;i<d.length;i+=4){if(d[i+3]<20)continue;const r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);
   if(mx===b&&mx>45&&(mx-mn)/mx>.38&&b>r+30&&b>g+8){const v=mx/235;d[i]=Math.min(255,tr*v);d[i+1]=Math.min(255,tg*v);d[i+2]=Math.min(255,tb*v)}}
  x.putImageData(id,0,0);
 }
 const sil=col=>{const s=mk(c.width,c.height),y=s.getContext('2d');y.drawImage(c,0,0);y.globalCompositeOperation='source-in';y.fillStyle=col;y.fillRect(0,0,s.width,s.height);return s};
 return {spr:c,white:sil('#ffffff'),red:sil('#ff3b2f'),gold:sil('#ffe08a'),w:w/dpr,h,ax:(bb.hx-bb.x)*k/dpr}
}
function drawPortrait(cv,img,flip){
 const go=()=>{const bb=bbox(img),s=bb.h*.3,cx0=bb.hx-s/2,cy0=bb.y+bb.h*.01,x=cv.getContext('2d'),W_=cv.width;
  x.clearRect(0,0,W_,W_);x.save();if(flip){x.translate(W_,0);x.scale(-1,1)}x.drawImage(img,cx0,cy0,s,s,0,0,W_,W_);x.restore()};
 whenReady(img,go);
}

/* ---------- CSS ---------- */
const CSS=`
#${ID}{position:fixed;inset:0;z-index:9000;background:#07090d;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;color:#f1f2f4;font-family:Barlow,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
#${ID} *{box-sizing:border-box}
#${ID} .gk-bg{position:absolute;inset:0;background:#07090d url('media/gra/tlo-hala.webp') center 38%/cover no-repeat}
#${ID} .gk-bg::after{content:'';position:absolute;inset:0;background:radial-gradient(130% 70% at 50% 55%,rgba(7,9,13,.05),rgba(7,9,13,.75) 80%),linear-gradient(180deg,rgba(7,9,13,.8),rgba(7,9,13,.15) 26%,rgba(7,9,13,.1) 60%,rgba(7,9,13,.92) 82%)}
#${ID} canvas.gk-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#${ID} .gk-hud{position:absolute;left:0;right:0;top:0;padding:calc(10px + env(safe-area-inset-top)) 12px 0;pointer-events:none}
#${ID} .gk-r1{display:grid;grid-template-columns:44px 1fr 64px;align-items:center;gap:8px}
#${ID} .gk-r1>button{pointer-events:auto}
#${ID}.gk-menu .gk-hud,#${ID}.gk-menu .gk-leg,#${ID}.gk-menu .gk-tech{visibility:hidden}
#${ID} .gk-ib{width:44px;height:44px;min-height:0;padding:0;margin:0;border-radius:50%;background:rgba(17,20,27,.78);border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;color:#f1f2f4;cursor:pointer}
#${ID} .gk-st{text-align:center;line-height:1}
#${ID} .gk-st small{display:block;font:600 12px/1 ${FONT};letter-spacing:1.5px;color:#9aa2af;text-transform:uppercase}
#${ID} .gk-st b{display:block;font:italic 800 25px/1 ${FONT};color:#ffe08a;letter-spacing:.6px;text-shadow:0 2px 0 rgba(0,0,0,.5);margin-top:2px}
#${ID} .gk-tm{height:44px;border-radius:12px;background:rgba(17,20,27,.8);border:1px solid rgba(242,193,78,.45);display:grid;place-items:center;line-height:1}
#${ID} .gk-tm span{font:800 24px/1 ${FONT};font-variant-numeric:tabular-nums}
#${ID} .gk-tm small{font:700 10px/1 ${FONT};letter-spacing:1px;color:#ffe08a;margin-top:-2px}
#${ID} .gk-tm.low{border-color:#ff7a6a}#${ID} .gk-tm.low span{color:#ff9c8c}
#${ID} .gk-r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
#${ID} .gk-f{display:flex;align-items:center;gap:7px;background:rgba(17,20,27,.8);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:6px 8px;min-width:0}
#${ID} .gk-f.me{border-left:4px solid #e2452b}
#${ID} .gk-f.op{flex-direction:row-reverse;border-right:4px solid #f1f2f4;text-align:right}
#${ID} .gk-f canvas{flex:none;width:34px;height:34px;border-radius:50%;background:#252a36;box-shadow:0 0 0 2px rgba(255,255,255,.18)}
#${ID} .gk-fi{flex:1;min-width:0}
#${ID} .gk-nm{font:700 16px/1.05 ${FONT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.2px}
#${ID} .gk-bar{height:9px;border-radius:9px;background:rgba(255,255,255,.12);margin-top:5px;overflow:hidden;position:relative}
#${ID} .gk-bar b{position:absolute;top:0;bottom:0;left:0;width:0;border-radius:9px;background:linear-gradient(90deg,#f2c14e,#ffe08a);transition:width .2s}
#${ID} .gk-f.op .gk-bar b{left:auto;right:0;background:linear-gradient(270deg,#e2452b,#ff8a6a)}
#${ID} .gk-pips{display:flex;gap:4px;margin-top:5px}
#${ID} .gk-f.op .gk-pips{justify-content:flex-end}
#${ID} .gk-pips i{display:block;height:7px;flex:0 0 22px;border-radius:4px;background:rgba(255,255,255,.14)}
#${ID} .gk-pips i.on{background:#ffe08a;box-shadow:0 0 8px rgba(242,193,78,.8)}
#${ID} .gk-f.op .gk-pips i.on{background:#ff8a6a;box-shadow:0 0 8px rgba(226,69,43,.8)}
#${ID} .gk-pips span{font:700 11px/7px ${FONT};color:#9aa2af;letter-spacing:.5px;margin:0 2px}
#${ID} .gk-leg{position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));display:grid;gap:6px;pointer-events:none}
#${ID} .gk-lr{display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:7px;background:rgba(17,20,27,.72);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:6px 8px}
#${ID} .gk-lr>em{font:700 12px/1 ${FONT};font-style:normal;letter-spacing:1.2px;color:#9aa2af;margin-right:2px}
#${ID} .gk-lr span{display:inline-flex;align-items:center;gap:3px;font:600 15px/1 ${FONT};white-space:nowrap}
#${ID} .gk-lr span b{display:inline-grid;place-items:center;min-width:21px;height:21px;border-radius:7px;background:rgba(255,255,255,.12);font:800 15px/1 system-ui,sans-serif;color:#fff}
#${ID} .gk-tech{position:absolute;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 14px;border-radius:99px;background:rgba(17,20,27,.82);border:1px solid rgba(242,193,78,.3);font-size:14px;pointer-events:none;opacity:0;transition:opacity .25s}
#${ID} .gk-tech.on{opacity:1}
#${ID} .gk-tech b{font:700 17px/1 ${FONT};color:#ffe08a;letter-spacing:.3px;margin-right:6px}
#${ID} .gk-scr{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:rgba(7,9,13,.84);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#${ID} .gk-scr[hidden]{display:none}
#${ID} .gk-in{position:relative;max-width:460px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) 18px calc(20px + env(safe-area-inset-bottom));min-height:100%;display:flex;flex-direction:column}
#${ID} .gk-x{align-self:flex-end;margin-bottom:2px}
#${ID} .gk-kick{color:#f2c14e;font-weight:600;font-size:14px;margin:0 0 2px;letter-spacing:.4px;text-transform:uppercase}
#${ID} h2.gk-t{font:italic 800 44px/.95 ${FONT};margin:0;color:#ffe08a;text-shadow:0 3px 0 rgba(0,0,0,.5);letter-spacing:.5px}
#${ID} .gk-hero{position:relative;height:160px;margin:6px 0 10px;display:flex;justify-content:center;align-items:flex-end;gap:0}
#${ID} .gk-hero::before{content:'';position:absolute;left:50%;bottom:2px;width:280px;height:28px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(242,193,78,.45),transparent)}
#${ID} .gk-hero img{position:relative;height:160px;width:auto;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6))}
#${ID} .gk-hero img.gk-boss{transform:scaleX(-1);filter:brightness(0) drop-shadow(0 0 10px rgba(242,193,78,.75));height:150px;margin-left:-26px}
#${ID} .gk-hero .gk-vs{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) rotate(-8deg);font:italic 800 46px/1 ${FONT};color:#ffe08a;text-shadow:0 3px 0 rgba(0,0,0,.6),0 0 18px rgba(242,193,78,.5);z-index:2}
#${ID} .gk-best{display:flex;gap:8px;margin:0 0 12px}
#${ID} .gk-best>div{flex:1;background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:14px;padding:8px 6px;text-align:center}
#${ID} .gk-best b{display:block;font:800 24px/1.1 ${FONT};color:#f2c14e}
#${ID} .gk-best span{font-size:12.5px;color:#9aa2af;line-height:1.2;display:block}
#${ID} .gk-how{background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:16px;padding:10px 12px;margin:0 0 14px}
#${ID} .gk-how h3{font:700 21px/1.1 ${FONT};margin:2px 0 6px}
#${ID} .gk-row{display:flex;align-items:center;gap:12px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)}
#${ID} .gk-row:first-of-type{border-top:0}
#${ID} .gk-ico{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font:800 22px/1 system-ui,sans-serif;background:rgba(255,255,255,.08);color:#fff}
#${ID} .gk-row p{margin:0;font-size:15px;line-height:1.3}
#${ID} .gk-row p small{display:block;color:#9aa2af;font-size:13px}
#${ID} .gk-row p i{font-style:normal;font-weight:700}
#${ID} .gk-btns{display:grid;gap:10px;margin-top:auto;padding-top:14px}
#${ID} .gk-btn{display:block;width:100%;min-height:56px;margin:0;padding:0 14px;border-radius:14px;border:1px solid #303644;background:#1b1f29;color:#f1f2f4;font:700 19px/1.1 Barlow,system-ui,sans-serif;cursor:pointer}
#${ID} .gk-btn.p{background:linear-gradient(180deg,#ffe08a,#f2c14e);border-color:#f2c14e;color:#1a1405;box-shadow:0 6px 22px rgba(242,193,78,.28),inset 0 1px 0 rgba(255,255,255,.55)}
#${ID} .gk-btn.m{display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,#2a2412,#1b1708);border-color:#f2c14e;color:#ffe08a}
#${ID} .gk-btn.m:disabled{opacity:1;border-color:#3aa655;color:#9fe0ae;background:#12201a}
#${ID} .gk-btn.m svg{flex:none}
#${ID} .gk-ladder{position:relative;display:grid;gap:8px;margin:8px 0 10px}
#${ID} .gk-ladder::before{content:'';position:absolute;left:39px;top:20px;bottom:20px;width:3px;background:linear-gradient(#f2c14e,rgba(242,193,78,.15));border-radius:3px}
#${ID} .gk-rung{position:relative;display:flex;align-items:center;gap:10px;background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:16px;padding:8px 10px}
#${ID} .gk-rung canvas{flex:none;width:60px;height:60px;border-radius:50%;background:#252a36;box-shadow:0 0 0 2px rgba(255,255,255,.15);position:relative}
#${ID} .gk-rung.lock canvas{filter:brightness(.25) grayscale(1)}
#${ID} .gk-rung.lock .gk-ri{opacity:.55}
#${ID} .gk-rung.now{border-color:#f2c14e;box-shadow:0 0 0 1px #f2c14e,0 6px 26px rgba(242,193,78,.25)}
#${ID} .gk-rung.now canvas{box-shadow:0 0 0 3px #f2c14e}
#${ID} .gk-rung.done canvas{box-shadow:0 0 0 3px #3aa655}
#${ID} .gk-ri{flex:1;min-width:0}
#${ID} .gk-ri small{display:block;font:700 13px/1 ${FONT};letter-spacing:1.2px;color:#f2c14e;text-transform:uppercase}
#${ID} .gk-ri b{display:block;font:700 21px/1.1 ${FONT};margin:2px 0 1px}
#${ID} .gk-ri span{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#9aa2af;line-height:1.2}
#${ID} .gk-ri span i{flex:none;width:18px;height:7px;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.35) inset}
#${ID} .gk-rung em{flex:none;font:700 15px/1 ${FONT};font-style:normal;padding:6px 9px;border-radius:99px;background:rgba(255,255,255,.08);color:#c9ced6;text-align:center}
#${ID} .gk-rung.done em{background:rgba(58,166,85,.2);color:#9fe0ae}
#${ID} .gk-rung.now em{background:#f2c14e;color:#1a1405;animation:gkPulse 1.4s infinite}
@media (max-width:374px){#${ID} .gk-lr{gap:5px;padding:6px 6px}#${ID} .gk-lr span{font-size:14px}#${ID} .gk-lr>em{letter-spacing:.4px;font-size:11px}}
@keyframes gkPulse{50%{transform:scale(1.08)}}
#${ID} .gk-tip{background:rgba(242,193,78,.1);border:1px solid rgba(242,193,78,.35);border-radius:14px;padding:9px 12px;font-size:15px;line-height:1.35;margin:0}
#${ID} .gk-tip b{color:#ffe08a}
#${ID} .gk-won{text-align:center;margin:0 0 6px;padding:8px 10px;border-radius:14px;background:rgba(58,166,85,.16);border:1px solid rgba(58,166,85,.5);font-size:15px}
#${ID} .gk-won b{font:italic 800 22px/1.1 ${FONT};color:#9fe0ae;display:block}
#${ID} .gk-res{text-align:center}
#${ID} .gk-big{font:italic 800 64px/1 ${FONT};color:#ffe08a;text-shadow:0 4px 0 rgba(0,0,0,.45),0 0 30px rgba(242,193,78,.35);margin:6px 0 2px}
#${ID} .gk-rec{display:inline-block;background:linear-gradient(180deg,#ffe08a,#f2c14e);color:#1a1405;font:800 18px/1 ${FONT};padding:6px 14px;border-radius:99px;letter-spacing:.5px}
#${ID} .gk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
#${ID} .gk-grid>div{background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:14px;padding:8px 4px}
#${ID} .gk-grid b{display:block;font:800 26px/1.1 ${FONT};color:#f1f2f4}
#${ID} .gk-grid span{font-size:12.5px;color:#9aa2af;line-height:1.2;display:block}
#${ID} .gk-coins{margin:0 0 6px;font-size:15px;color:#c9ced6}
#${ID} .gk-coins b{color:#f2c14e}
#${ID} .gk-pod{position:relative;margin:8px auto 4px;width:min(100%,300px);aspect-ratio:1;border-radius:22px;overflow:hidden;box-shadow:0 0 0 2px rgba(242,193,78,.6),0 12px 40px rgba(242,193,78,.25)}
#${ID} .gk-pod img{width:100%;height:100%;object-fit:cover;display:block}
#${ID} canvas.gk-conf{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#${ID} .gk-pause{display:flex;flex-direction:column;justify-content:center;gap:12px;min-height:100%;max-width:340px;margin:0 auto;padding:24px}
#${ID} .gk-pause h2{text-align:center;font:italic 800 48px/1 ${FONT};color:#ffe08a;margin:0 0 6px}
#${ID} .gk-pause p{text-align:center;color:#c9ced6;margin:0 0 8px}
`;

/* ---------- stan ---------- */
let root=null,cv=null,cx=null,els={},raf=0,lastT=0,W=0,H=0,DPR=1,listeners=[],G=null,hc={},shakeOK=true,techT=0;
let HB=120,GY=600,FH=300,BX=0,OX=0;
let playerImg=null,oppImgs=[],podImg=null;
function on(t,ev,fn,opt){t.addEventListener(ev,fn,opt);listeners.push([t,ev,fn,opt])}

function gd(){const S=S_();S.games=S.games||{};const g=S.games.kumite=S.games.kumite||{};
 if(!g.seen||typeof g.seen!=='object')g.seen={};['best','stage','champ','plays','fights','wins','ippons','perfect','xpN'].forEach(k=>{g[k]=+g[k]||0});return g}
function save(){dw('save')}
function coinsLeft(){const S=S_(),d=today(),p=S.paid||{};let left=15;for(let i=0;i<3;i++)if(p['gk'+d+'-'+i])left-=5;return left}
function xp(n){const g=gd(),d=today();if(g.xpD!==d){g.xpD=d;g.xpN=0}const a=Math.min(n,25-g.xpN);if(a>0){g.xpN+=a;dw('addXP',a)}return Math.max(0,a)}

function oppList(){const S=S_();return OPP.map((o,i)=>{let img=o.img;if(S.look===img)img=ALT[i%ALT.length]===S.look?ALT[(i+1)%ALT.length]:ALT[i%ALT.length];return Object.assign({},o,{img,i})})}

/* ---------- geometria ---------- */
function layout(){
 DPR=Math.min(2,window.devicePixelRatio||1);
 W=root.clientWidth;H=root.clientHeight;
 cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
 buildSprites(DPR);
 HB=els.hud.getBoundingClientRect().bottom;
 const lt=els.leg.getBoundingClientRect().top;
 GY=Math.min(lt-40,HB+(lt-HB)*.86);
 FH=clamp(Math.min(GY-HB-90,W*.76),170,330);
 BX=W*.28;OX=W*.72;
 els.tech.style.top=(GY+8)+'px';
 if(G&&G.F)buildFighters();
 if(G&&G.F&&!raf)draw();
}
function buildFighters(){
 const F=G.F;if(!F)return;const k=Math.round(FH)+'@'+DPR;
 if(ready(playerImg)&&F.pk!==k){F.pf=makeFighter(playerImg,FH,DPR,null);F.pk=k}
 const oi=oppImgs[F.op.i];if(ready(oi)&&F.ok!==k){F.of=makeFighter(oi,FH*.97,DPR,F.op.belt);F.ok=k}
}

/* ---------- gra / turniej ---------- */
function newTour(){return {stage:0,score:0,hits:0,perfect:0,blocks:0,taken:0,waza:0,ippons:0,res:[],coins:0,xp:0}}
function newFight(){
 const T=G.T,op=G.ops[T.stage];
 return {op,phase:'count',ct:0,left:FIGHT_T,encho:0,pW:0,oW:0,pBar:0,oBar:0,pPts:0,oPts:0,streak:0,counter:0,pend:[],buf:null,tut:T.stage===0?4:0,
  perfect:0,hits:0,pf_w:120,of_w:120,
  o:{st:'idle',t:0,next:1.7,atk:null,chain:0,hurt:0,guard:0,sway:Math.random()*6},
  pl:{act:null,at:0,dur:0,cd:0,hurt:0,ghost:0},lastSec:99,hj:null}
}
function newG(){return {T:newTour(),F:null,ops:oppList(),ev:[],clock:0,parts:[],texts:[],fx:[],ban:null,shake:0,flash:0,flashC:'255,255,255',hitstop:0,slow:0,ptr:new Map(),conf:null,paused:false}}
function later(s,fn){G.ev.push({t:G.clock+s,fn})}

function banner(term,ctx,dur){
 const g=gd(),tm=TERMS[term];let exp='';
 if(tm&&!g.seen[term]){g.seen[term]=1;exp=tm[0];dur=(dur||1.6)+.8}
 G.ban={term,exp,ctx:ctx||'',t:0,dur:dur||1.6};
 if(tm)voice(tm[1]);
}
function ftext(x,y,txt,col,size,sub){G.texts.push({x,y,txt,col,size,sub,age:0,life:.95});if(G.texts.length>8)G.texts.shift()}
function burst(x,y,col,n,sp){if(reducedMotion())n=Math.ceil(n/2);if(G.parts.length>200)G.parts.splice(0,G.parts.length-200);
 for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rnd(.3,1)*sp;G.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*.25,life:rnd(.35,.7),age:0,s:rnd(3,7),c:col,g:600,spark:Math.random()<.5})}}
function shake(a){if(shakeOK)G.shake=Math.max(G.shake,a)}
function flash(a,c){G.flash=Math.max(G.flash,a);G.flashC=c||'255,255,255'}
function showTech(k){const t=TECH[k];if(!t||!els.tech)return;els.tech.innerHTML=`<b>${t[0]}</b>${t[1]}`;els.tech.classList.add('on');clearTimeout(techT);techT=setTimeout(()=>els.tech&&els.tech.classList.remove('on'),1600)}
function lvY(lv){return GY-FH*LV[lv].y}
function plAct(k,dur){const p=G.F.pl;p.act=k;p.at=0;p.dur=dur||({tsuki:.22,mae:.3,mawashi:.34,gedan:.3,uke:.32,barai:.32,sabaki:.5,miss:.3}[k]||.3);if(k==='sabaki')p.ghost=.35}

/* --- przeciwniczka --- */
function startAttack(){
 const F=G.F,o=F.o,op=F.op;
 if(!o.chain){o.chain=1+(Math.random()<op.dbl?1:0)+(Math.random()<op.tri?1:0)}
 const second=o.atk&&o.chainLeft>0;
 if(!second)o.chainLeft=o.chain-1;else o.chainLeft--;
 let lv=pick(op.lv);
 const wu=second?Math.max(.6,op.wu*.78):op.wu;
 o.atk={lv,wu,t:0,def:null,feintAt:(!second&&Math.random()<op.feint)?wu*rnd(.4,.55):0,wrong:0,tut:F.tut>0};
 if(F.tut>0)o.atk.wu=wu*1.25,F.tut--;
 o.st='windup';o.t=0;F.streak=0;SFX.tell(lv);
}
function feintSwitch(a){
 const F=G.F,old=a.lv;let lv;do{lv=pick(F.op.lv)}while(lv===old);
 a.lv=lv;a.t=0;a.wu=Math.max(.62,F.op.wu*.8);a.def=null;a.feintAt=0;a.feinted=1;
 SFX.feint();ftext(OX,lvY(old)-30,'ZWÓD!','#d9a6ff',30,'Zmień obronę!');
 later(.06,()=>{if(G.F&&G.F.o.atk===a)SFX.tell(lv)});
}
function resolveAttack(a){
 const F=G.F,o=F.o,T=G.T,y=lvY(a.lv),bx=BX+F.pf_w*.18;
 o.st='strike';o.t=0;
 if(a.def==='perfect'){
  SFX.perfect();buzz([15,30,15]);F.perfect++;T.perfect++;T.blocks++;T.score+=15;
  burst(bx,y,'#ffe08a',26,460);G.fx.push({shield:1,x:bx+10,y,col:'255,224,138',age:0,life:.45,big:1});
  ftext(BX,y-48,'IDEALNIE!','#ffe08a',36,'KONTRA! Teraz uderz 2 razy!');flash(.25,'255,224,138');shake(4);G.slow=.28;
  o.chainLeft=0;o.chain=0;o.st='stun';o.t=0;F.counter=1.5;F.ctrHits=0;taiko(1);
 }else if(a.def){
  SFX.block();buzz(12);T.blocks++;T.score+=5;
  if(a.def==='dodge'){ftext(BX-20,y-40,'Unik!','#ffffff',26)}
  else{G.fx.push({shield:1,x:bx+6,y,col:'170,205,255',age:0,life:.35});burst(bx+10,y,'#cfe2ff',10,260);ftext(BX,y-40,'Blok!','#ffffff',28)}
 }else{
  const p=F.pl;p.hurt=.4;p.act=null;SFX.hurt();buzz(70);shake(9);flash(.22,'226,69,43');
  F.oBar+=F.op.dmg;F.oPts+=F.op.dmg;T.taken++;burst(BX+F.pf_w*.1,y,'#ff7a5c',16,360);
  G.fx.push({ring:1,x:BX+F.pf_w*.1,y,r:18,col:'255,120,100',age:0,life:.35});
  ftext(BX,y-34,a.wrong?'Zła strona!':'Au! Trafiona','#ff9c8c',24,a.wrong?'Patrz na kolor błysku':'');
  if(F.oBar>=100){F.oBar=100;later(.25,()=>award('o'));o.chainLeft=0;o.chain=0}
 }
}
function updOpp(dt){
 const F=G.F,o=F.o;o.t+=dt;
 if(o.st==='idle'){o.next-=dt;if(o.next<=0)startAttack()}
 else if(o.st==='windup'){const a=o.atk;a.t+=dt;
  if(a.feintAt&&a.t>=a.feintAt)feintSwitch(a);
  else if(a.t>=a.wu&&(a.def||a.t>=a.wu+GRACE))resolveAttack(a)}
 else if(o.st==='strike'){if(o.t>=.24){if(o.chainLeft>0&&F.phase==='fight'){startAttack()}else{o.st='idle';o.chain=0;o.atk=null;o.next=rnd(F.op.gap[0],F.op.gap[1])}}}
 else if(o.st==='stun'){if(o.t>=1.6||(F.counter<=0&&o.t>.35)){o.st='idle';o.atk=null;o.next=rnd(.8,1.2)}}
}

/* --- gracz --- */
function input(kind,x,y){
 const F=G&&G.F;if(!F||F.phase!=='fight'||G.paused)return;
 const o=F.o;
 if(o.st==='windup'&&!o.atk.def&&(kind==='up'||kind==='down'||kind==='left')){
  const a=o.atk,need=LV[a.lv].def;
  if(kind===need){a.def=a.t>=a.wu*PERF?'perfect':'ok';plAct(kind==='up'?'uke':kind==='down'?'barai':'sabaki');showTech(kind==='up'?'uke':kind==='down'?'barai':'sabaki')}
  else if(kind==='left'){a.def='dodge';plAct('sabaki');showTech('sabaki')}
  else{a.wrong++;plAct(kind==='up'?'uke':'barai');SFX.wrong();ftext(W/2,lvY(a.lv)+52,'Nie tędy! '+ARROW[need],'#ffffff',24)}
  return;
 }
 if(kind==='left'){if(F.pl.cd<=0){plAct('sabaki');F.pl.cd=.3;SFX.swish()}return}
 const k={tap:'tsuki',up:'mae',right:'mawashi',down:'gedan'}[kind];if(!k)return;
 if(F.pl.cd>0){F.buf=k;return}
 attack(k);
}
function attack(k){
 const F=G.F,A=ATK[k];F.pl.cd=A.cd;plAct(k);F.pend.push({t:A.imp,k});if(k!=='tsuki')SFX.swish();
 if(k!=='tsuki'){const y=lvY(A.lv);G.fx.push({arc:1,x:BX+F.pf_w*.15,y,r:FH*.28,age:0,life:.24,lv:A.lv})}
}
function landHit(k){
 const F=G.F,o=F.o,op=F.op,A=ATK[k],T=G.T,ctr=F.counter>0;
 const hx=OX-F.of_w*.12,hy=lvY(A.lv)+rnd(-8,8);
 let guard=false;
 if(!ctr&&o.st!=='windup'&&o.st!=='stun'){const g=(k==='tsuki'?op.g.tsuki:op.g.kick)+F.streak*.15;guard=Math.random()<Math.min(.8,g)}
 F.streak++;
 if(guard){
  o.guard=.35;SFX.block();buzz(8);burst(hx,hy,'#cfd6dd',6,200);ftext(OX,hy-36,'Zablokowała!','#c9ced6',22,F.streak>2?'Zrób przerwę i broń się':'');
  if(o.st==='idle')o.next=Math.min(o.next,.5);return;
 }
 if(ctr){F.ctrHits++;if(F.ctrHits>=2)F.counter=0}
 const d=A.d*(ctr?1.7:1)*op.tough;F.pBar+=d;F.pPts+=d;F.hits++;T.hits++;T.score+=Math.round(d);
 o.hurt=.28;if(o.st==='idle')o.next+=.15;
 (k==='tsuki'?SFX.punch:SFX.kick)(ctr);buzz(ctr?[12,20,12]:14);
 burst(hx,hy,ctr?'#ffe08a':'#ffffff',ctr?20:12,ctr?440:320);G.fx.push({ring:1,x:hx,y:hy,r:14,col:ctr?'255,224,138':'255,255,255',age:0,life:.3});
 shake(ctr?6:3);if(ctr)G.hitstop=.06;else if(k!=='tsuki')G.hitstop=.035;
 ftext(hx,hy-30,ctr?'MOCNO!':'+'+Math.round(d),ctr?'#ffe08a':'#ffffff',ctr?30:22);
 showTech(k);
 if(F.pBar>=100){F.pBar=100;F.pend=[];later(.15,()=>award('p'))}
}

/* --- sędzia --- */
function stopAction(){const F=G.F;F.phase='yame';F.pend=[];F.buf=null;F.counter=0;F.o.st='idle';F.o.atk=null;F.o.chain=0;F.o.chainLeft=0}
function award(side){
 const F=G.F;if(!F||F.phase!=='fight')return;
 stopAction();SFX.whistle();banner('YAME','',1);
 later(1.0,()=>{
  const me=side==='p';if(me){F.pW++;G.T.waza++;G.T.score+=100}else F.oW++;
  F.pBar=0;F.oBar=0;SFX.crowd(me?.25:.12);if(me){taiko(2);flash(.3,'255,224,138')}
  banner('WAZA-ARI',me?'dla Blanki!':'dla rywalki: '+F.op.n,2);
  const w=me?F.pW:F.oW;
  if(w>=2)later(2.1,()=>ippon(side));
  else later(2.3,()=>resume1());
 });
}
function resume1(){const F=G.F;F.phase='fight';F.o.st='idle';F.o.next=1.4;F.pl.act=null;banner('HAJIME','',1.1);taiko(1)}
function ippon(side){
 const F=G.F,me=side==='p';F.phase='end';
 banner('IPPON',me?'Wygrywa Blanka!':'Wygrywa '+F.op.n,2.6);
 if(me){SFX.crowd(.32);dw('fanfare');flash(.4,'255,224,138');G.T.ippons++;G.T.score+=150+Math.ceil(F.left)*3}
 else dw('gong');
 later(2.8,()=>endFight(me,'ippon'));
}
function timeUp(){
 const F=G.F;stopAction();SFX.whistle();banner('YAME','Koniec czasu!',1.1);
 later(1.2,()=>{
  F.phase='hantei';F.ht=0;
  const ps=F.pW*100+F.pPts,os=F.oW*100+F.oPts,diff=ps-os;
  let res=diff>0?'p':'o';if(Math.abs(diff)<6&&!F.encho)res='draw';if(F.encho&&diff===0)res='p';
  F.hres=res;F.flags=res==='draw'?['x','x','x']:res==='p'?(diff>30?['p','p','p']:['p','p','o']):(diff<-30?['o','o','o']:['o','o','p']);
  banner('HANTEI',res==='draw'?'Remis!':res==='p'?'Sędziowie wybierają Ciebie!':'Sędziowie wybierają: '+F.op.n,2.6);dw('taiko',3);
  later(2.8,()=>{
   if(res==='draw'){banner('ENCHO','20 sekund dogrywki',1.6);dw('gong');later(1.8,()=>{F.encho=1;F.left=ENCHO_T;F.pBar=Math.min(F.pBar,60);F.oBar=Math.min(F.oBar,60);resume1()})}
   else{if(res==='p'){SFX.crowd(.28);dw('fanfare')}else dw('gong');endFight(res==='p','hantei')}
  });
 });
}
function endFight(win,how){
 const F=G.F;F.phase='end';F.win=win;F.how=how;
 later(.6,()=>{banner('OSU!',win?'Ukłon i szacunek dla rywalki':'Ukłon – następnym razem się uda!',1.6);F.bow=1});
 later(2.4,()=>afterFight(win,how));
}

/* ---------- wejście dotykowe ---------- */
function pos(e){const b=cv.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top}}
function dirOf(dx,dy){return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')}
function onDown(e){if(!G||!G.F)return;e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}const p=pos(e);G.ptr.set(e.pointerId,{x0:p.x,y0:p.y,x:p.x,y:p.y,t0:performance.now(),done:false})}
function onMove(e){if(!G)return;const s=G.ptr.get(e.pointerId);if(!s||s.done)return;const p=pos(e);s.x=p.x;s.y=p.y;const dx=p.x-s.x0,dy=p.y-s.y0;
 if(Math.hypot(dx,dy)>=34){s.done=true;input(dirOf(dx,dy),p.x,p.y);G.fx.push({trail:1,x0:s.x0,y0:s.y0,x1:p.x,y1:p.y,age:0,life:.2})}}
function onUp(e){if(!G)return;const s=G.ptr.get(e.pointerId);G.ptr.delete(e.pointerId);if(!s||s.done||e.type==='pointercancel')return;
 const dx=s.x-s.x0,dy=s.y-s.y0;if(Math.hypot(dx,dy)<34)input('tap',s.x0,s.y0);else input(dirOf(dx,dy),s.x,s.y)}

/* ---------- pętla ---------- */
function loop(now){
 raf=requestAnimationFrame(loop);
 let dt=(now-lastT)/1000;lastT=now;if(!(dt>0))dt=0;if(dt>.05)dt=.05;
 update(dt);
 if(G&&G.F)draw();
 if(G&&G.conf)drawConf(dt);
}
function update(dt){
 const g=G;if(!g)return;
 g.clock+=dt;
 if(g.ev.length){const due=g.ev.filter(e=>e.t<=g.clock);if(due.length){g.ev=g.ev.filter(e=>e.t>g.clock);due.forEach(e=>{if(G===g)e.fn()})}}
 if(!G||!g.F){return}
 const F=g.F;
 let gdt=dt;
 if(g.hitstop>0){g.hitstop-=dt;gdt=dt*.08}else if(g.slow>0){g.slow-=dt;gdt=dt*.4}
 if(F.phase==='count'){
  const c0=F.ct;F.ct+=dt;
  const at=s=>c0<s&&F.ct>=s;
  if(at(.05)){banner('OSU!',F.op.n+' – '+STAGES[G.T.stage],1.3);F.bow=1}
  if(at(1.45)){F.bow=0;taiko(1);F.cnum='SAN'}if(at(2.05)){taiko(1);F.cnum='NI'}if(at(2.65)){taiko(1);F.cnum='ICHI'}
  if(at(3.25)){F.cnum=null;F.phase='fight';banner('HAJIME','',1.1);dw('beep',1046,.25,1);SFX.crowd(.15)}
 }else if(F.phase==='fight'){
  F.left-=gdt;const sec=Math.ceil(F.left);if(sec<=5&&sec!==F.lastSec&&sec>0)SFX.tick();F.lastSec=sec;
  updOpp(gdt);
  if(F.phase==='fight'&&F.left<=0){F.left=0;timeUp()}
 }else if(F.phase==='hantei'){F.ht+=dt}
 // gracz
 const p=F.pl;p.cd=Math.max(0,p.cd-gdt);p.hurt=Math.max(0,p.hurt-gdt);p.ghost=Math.max(0,p.ghost-gdt);
 if(p.act){p.at+=gdt;if(p.at>=p.dur)p.act=null}
 if(F.buf&&p.cd<=0&&F.phase==='fight'){const k=F.buf;F.buf=null;attack(k)}
 for(const h of F.pend)h.t-=gdt;
 if(F.pend.length){const d=F.pend.filter(h=>h.t<=0);F.pend=F.pend.filter(h=>h.t>0);d.forEach(h=>{if(F.phase==='fight')landHit(h.k)})}
 F.counter=Math.max(0,F.counter-gdt);
 const o=F.o;o.hurt=Math.max(0,o.hurt-gdt);o.guard=Math.max(0,o.guard-gdt);
 if(F.phase!=='fight'&&F.phase!=='count'&&o.st!=='idle'){o.t+=gdt;if(o.t>.3){o.st='idle';o.atk=null}}
 // efekty
 for(const q of g.parts){q.age+=gdt;q.vy+=q.g*gdt;q.x+=q.vx*gdt;q.y+=q.vy*gdt}
 g.parts=g.parts.filter(q=>q.age<q.life);
 for(const t of g.texts)t.age+=dt;g.texts=g.texts.filter(t=>t.age<t.life);
 for(const r of g.fx)r.age+=gdt;g.fx=g.fx.filter(r=>r.age<r.life);
 g.shake=Math.max(0,g.shake-dt*40);g.flash=Math.max(0,g.flash-dt*1.6);
 if(g.ban){g.ban.t+=dt;if(g.ban.t>g.ban.dur)g.ban=null}
 hud();
}

/* ---------- HUD ---------- */
function hud(){
 const F=G.F,c=hc;if(!F)return;
 const s=Math.ceil(F.left),ts=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
 if(c.ts!==ts){c.ts=ts;els.tmS.textContent=ts;els.tm.classList.toggle('low',s<=10&&F.phase==='fight')}
 if(c.en!==F.encho){c.en=F.encho;els.tmE.textContent=F.encho?'ENCHO':'CZAS'}
 const pb=Math.round(F.pBar),ob=Math.round(F.oBar);
 if(c.pb!==pb){c.pb=pb;els.pBar.style.width=pb+'%'}
 if(c.ob!==ob){c.ob=ob;els.oBar.style.width=ob+'%'}
 if(c.pw!==F.pW){c.pw=F.pW;els.pPips.forEach((e,i)=>e.classList.toggle('on',i<F.pW))}
 if(c.ow!==F.oW){c.ow=F.oW;els.oPips.forEach((e,i)=>e.classList.toggle('on',i<F.oW))}
}
function setupHud(){
 const F=G.F,T=G.T;
 els.stS.textContent='Walka '+(T.stage+1)+' z 4';els.stB.textContent=STAGES[T.stage].toUpperCase();
 els.oNm.textContent=F.op.n;
 drawPortrait(els.pPor,playerImg,false);drawPortrait(els.oPor,oppImgs[F.op.i],true);
 hc={};hud();
}

/* ---------- rysowanie ---------- */
function textC(x,t,px,py,size,col,stroke){x.font=`italic 800 ${size}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=Math.max(4,size*.1);x.strokeStyle=stroke||'rgba(0,0,0,.75)';x.strokeText(t,px,py);x.fillStyle=col;x.fillText(t,px,py)}
function fitSize(x,t,size,maxW,style){x.font=`${style} ${size}px ${FONT}`;const w=x.measureText(t).width;return w>maxW?Math.floor(size*maxW/w):size}
function draw(){
 const g=G,F=g.F,x=cx;if(!F||!x)return;
 buildFighters();
 x.setTransform(DPR,0,0,DPR,0,0);x.clearRect(0,0,W,H);
 if(g.shake>0){const s=g.shake;x.translate(rnd(-s,s),rnd(-s,s))}
 const now=performance.now()/1000;
 // podłoga: okrąg pola walki
 x.save();x.translate(W/2,GY);x.scale(1,.16);x.strokeStyle='rgba(242,193,78,.35)';x.lineWidth=3;x.beginPath();x.arc(0,0,W*.46,0,7);x.stroke();x.restore();
 for(const [px,w] of [[BX,F.pf_w||120],[OX,F.of_w||120]]){x.fillStyle='rgba(0,0,0,.5)';x.beginPath();x.ellipse(px,GY-2,w*.34,FH*.035,0,0,7);x.fill()}
 // poświata kontry
 if(F.counter>0&&SPR.glow){const gs=FH*1.3;x.globalAlpha=Math.min(1,F.counter*2)*(.7+.2*Math.sin(now*12));x.drawImage(SPR.glow,BX-gs/2,GY-FH*.55-gs/2,gs,gs);x.globalAlpha=1}
 drawOpp(x,now);drawPlayer(x,now);
 // efekty
 for(const r of g.fx){const k=r.age/r.life;
  if(r.arc){const lv=LV[r.lv];x.globalAlpha=1-k;x.strokeStyle='#fff';x.lineCap='round';const a0=r.lv==='gedan'?.25:-.9,sw=1.3*Math.min(1,k*3);
   x.lineWidth=12*(1-k)+2;x.beginPath();x.arc(r.x,r.y+(r.lv==='gedan'?-r.r*.6:r.r*.5),r.r,a0,a0+sw);x.stroke();
   x.strokeStyle=lv.c;x.lineWidth=4*(1-k)+1;x.beginPath();x.arc(r.x,r.y+(r.lv==='gedan'?-r.r*.6:r.r*.5),r.r*1.08,a0,a0+sw);x.stroke()}
  else if(r.shield){const R=FH*(r.big?.2:.15)*(1+k*.3);x.globalAlpha=(1-k);x.strokeStyle=`rgba(${r.col},1)`;x.lineCap='round';x.lineWidth=(r.big?12:8)*(1-k)+2;x.beginPath();x.arc(r.x,r.y,R,-1.1,1.1);x.stroke();
   x.lineWidth=2;x.beginPath();x.arc(r.x,r.y,R*1.25,-.9,.9);x.stroke()}
  else if(r.ring){x.globalAlpha=1-k;x.strokeStyle=`rgba(${r.col},1)`;x.lineWidth=6*(1-k)+1;x.beginPath();x.arc(r.x,r.y,r.r*(1+k*2.2),0,7);x.stroke()}
  else if(r.trail){x.globalAlpha=(1-k)*.7;x.strokeStyle='#fff';x.lineCap='round';x.lineWidth=9*(1-k)+1;x.beginPath();x.moveTo(r.x0+(r.x1-r.x0)*k*.6,r.y0+(r.y1-r.y0)*k*.6);x.lineTo(r.x1,r.y1);x.stroke()}}
 x.globalAlpha=1;
 const sp=SPR.spark;
 for(const q of g.parts){const k=1-q.age/q.life;x.globalAlpha=k;
  if(q.spark&&sp){const s=q.s*3.2*k+4;x.drawImage(sp,q.x-s/2,q.y-s/2,s,s)}else{x.fillStyle=q.c;x.beginPath();x.arc(q.x,q.y,q.s*k+.5,0,7);x.fill()}}
 x.globalAlpha=1;
 if(F.phase==='fight'&&F.o.st==='windup')drawCue(x,F.o.atk,now);
 if(F.counter>0){const w=90,y=GY-FH-16;x.fillStyle='rgba(17,20,27,.8)';rr(x,BX-w/2,y-12,w,24,12);x.fill();x.fillStyle='#f2c14e';rr(x,BX-w/2+3,y+5,(w-6)*F.counter/1.5,4,2);x.fill();textC(x,'KONTRA!',BX,y-2,16,'#ffe08a')}
 for(const t of g.texts){const k=t.age/t.life,pop=k<.15?easeOutBack(k/.15):1,y=t.y-k*36;x.globalAlpha=k>.7?1-(k-.7)/.3:1;
  if(t.hw==null){x.font=`italic 800 ${t.size}px ${FONT}`;let w=x.measureText(t.txt).width;if(t.sub){x.font=`700 16px ${FONT}`;w=Math.max(w,x.measureText(t.sub).width)}t.hw=Math.min(W/2-4,w/2+8)}
  const tx=clamp(t.x,t.hw,W-t.hw);
  textC(x,t.txt,tx,y,Math.round(t.size*pop),t.col);
  if(t.sub){x.font=`700 16px ${FONT}`;x.lineWidth=4;x.strokeText(t.sub,tx,y+t.size*.66);x.fillStyle='#ffe08a';x.fillText(t.sub,tx,y+t.size*.66)}}
 x.globalAlpha=1;
 x.setTransform(DPR,0,0,DPR,0,0);
 if(g.flash>0){x.fillStyle=`rgba(${g.flashC},${g.flash})`;x.fillRect(0,0,W,H)}
 if(F.phase==='hantei')drawJudges(x);
 if(F.cnum)drawCount(x);
 if(g.ban)drawBanner(x,g.ban);
}
function fighterOffsets(isP,now){
 const F=G.F;let dx=0,dy=0,rot=0,sx=1,sy=1;
 const sway=Math.sin(now*2.2+(isP?0:1.7))*4;dx+=sway*(isP?1:-1);
 if(F.bow){sy=.95;rot=.07}
 if(isP){const p=F.pl;
  if(p.act){const k=p.at/p.dur,s=Math.sin(Math.PI*Math.min(1,k));
   if(p.act==='tsuki'){dx+=26*s;sx=1+.04*s;sy=1-.03*s}
   else if(p.act==='mae'){dx+=20*s;rot=-.07*s;sy=1+.02*s}
   else if(p.act==='mawashi'){dx+=30*s;rot=-.12*s}
   else if(p.act==='gedan'){dx+=22*s;rot=.06*s;sy=1-.03*s}
   else if(p.act==='uke'){dx-=6*s;sy=1-.02*s}
   else if(p.act==='barai'){sy=1-.06*s;dx-=4*s}
   else if(p.act==='sabaki'){dx-=52*s;rot=.05*s}}
  if(p.hurt>0){const k=p.hurt/.4;dx-=20*k;rot+=.09*k}
 }else{const o=F.o;
  if(o.st==='windup'){const a=o.atk,k=clamp(a.t/a.wu,0,1);dx+=14*k;rot=.06*k;if(k>.6)dx+=Math.sin(now*60)*1.5}
  else if(o.st==='strike'){const k=o.t/.24,s=Math.sin(Math.PI*Math.min(1,k));dx-=44*s;rot=-.06*s}
  else if(o.st==='stun'){rot=Math.sin(now*9)*.05;dy=2}
  if(o.hurt>0){const k=o.hurt/.28;dx+=18*k;rot+=.08*k}
  if(o.guard>0){dx+=8*(o.guard/.35)}
 }
 return {dx,dy,rot,sx,sy};
}
function drawFig(x,f,px,face,off,flashSpr,fa,ghost){
 if(!f)return;
 x.save();x.translate(px+off.dx,GY+off.dy);x.rotate(off.rot*face);x.scale(face*off.sx,off.sy);
 const idle=Math.sin(performance.now()/420+(face>0?0:2))*1.2;
 x.drawImage(f.spr,-f.ax,-f.h+idle,f.w,f.h);
 if(flashSpr&&fa>0){x.globalAlpha=fa;x.drawImage(flashSpr,-f.ax,-f.h+idle,f.w,f.h);x.globalAlpha=1}
 x.restore();
}
function drawPlayer(x,now){
 const F=G.F,f=F.pf;if(!f)return;F.pf_w=f.w;
 const off=fighterOffsets(true,now),p=F.pl;
 if(p.ghost>0){x.globalAlpha=p.ghost*.9;drawFig(x,f,BX,1,{dx:off.dx*.4,dy:0,rot:0,sx:1,sy:1},f.white,.6);x.globalAlpha=1}
 let fs=null,fa=0;if(p.hurt>0){fs=f.red;fa=p.hurt/.4*.5}else if(F.counter>0){fs=f.gold;fa=.18+.12*Math.sin(now*14)}
 drawFig(x,f,BX,1,off,fs,fa);
}
function drawOpp(x,now){
 const F=G.F,f=F.of;if(!f)return;F.of_w=f.w;
 const off=fighterOffsets(false,now),o=F.o;
 let fs=null,fa=0;if(o.hurt>0){fs=f.white;fa=o.hurt/.28*.75}else if(o.st==='windup'&&F.phase==='fight'){const a=o.atk;fs=f.red;fa=.12+.1*Math.sin(now*20)*(a.t/a.wu)}
 drawFig(x,f,OX,-1,off,fs,fa);
 if(o.guard>0){const k=o.guard/.35;x.globalAlpha=k;x.strokeStyle='rgba(220,230,240,.9)';x.lineWidth=5;x.beginPath();x.arc(OX-f.w*.2+off.dx,GY-FH*.6,FH*.17,Math.PI-1,Math.PI+1);x.stroke();x.globalAlpha=1}
 if(o.st==='stun'){const hy=GY-FH*1.02,hx=OX-8+off.dx;for(let i=0;i<3;i++){const a=now*4+i*2.1;textC(x,'★',hx+Math.cos(a)*26,hy+Math.sin(a)*8,18,'#ffe08a')}}
}
function drawCue(x,a,now){
 const lv=LV[a.lv],y=lvY(a.lv),px=W/2,r=Math.max(26,Math.min(34,W*.08)),p=clamp(a.t/a.wu,0,1.2),perf=p>=PERF;
 // błysk na rywalce
 const gx=OX-(G.F.of_w||120)*.22,gs=(16+10*Math.sin(now*22))*(.6+p*.6);
 if(SPR.spark){x.globalAlpha=.95;x.drawImage(SPR.spark,gx-gs,y-gs,gs*2,gs*2);x.globalAlpha=1}
 x.fillStyle=lv.c;x.globalAlpha=.9;x.beginPath();for(let i=0;i<8;i++){const ang=i*Math.PI/4+now*3,rad=i%2?gs*.25:gs*.9;x.lineTo(gx+Math.cos(ang)*rad,y+Math.sin(ang)*rad)}x.closePath();x.fill();x.globalAlpha=1;
 // pierścień czasu
 const R=r*(1+1.5*Math.max(0,1-p));
 x.lineWidth=perf?6:3;x.strokeStyle=perf?'rgba(255,224,138,1)':'rgba(255,255,255,.7)';x.beginPath();x.arc(px,y,R,0,7);x.stroke();
 if(a.def){x.fillStyle='rgba(58,166,85,.92)';x.beginPath();x.arc(px,y,r,0,7);x.fill();textC(x,'✓',px,y+1,30,'#fff','rgba(0,0,0,.3)');return}
 x.fillStyle=`rgba(${lv.rgb},.92)`;x.beginPath();x.arc(px,y,r,0,7);x.fill();
 x.lineWidth=3;x.strokeStyle='#fff';x.stroke();
 x.save();x.translate(px,y);x.rotate({up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2}[lv.def]);
 const s=r*.62;x.fillStyle='#fff';x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;x.beginPath();x.moveTo(0,-s);x.lineTo(s*.8,0);x.lineTo(s*.3,0);x.lineTo(s*.3,s*.85);x.lineTo(-s*.3,s*.85);x.lineTo(-s*.3,0);x.lineTo(-s*.8,0);x.closePath();x.stroke();x.fill();x.restore();
 const lab=lv.jp,ly=a.lv==='gedan'?y-r-18:y-r-16;
 textC(x,lab,px,ly,20,lv.c);
 if(a.tut){const t=a.lv==='jodan'?'Blok! Przesuń w górę':a.lv==='chudan'?'Unik! Przesuń w lewo':'Blok! Przesuń w dół';x.font=`700 17px ${FONT}`;x.textAlign='center';x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.8)';x.strokeText(t,px,y+r+18);x.fillStyle='#fff';x.fillText(t,px,y+r+18)}
}
function drawCount(x){
 const F=G.F,k=((F.ct-1.45)%.6)/.6,s=easeOutBack(Math.min(1,k/.35)),y=GY-FH-30;
 textC(x,F.cnum,W/2,Math.max(HB+60,y),Math.round(84*s),'#ffffff');
}
function drawBanner(x,b){
 const k=b.t/b.dur,a=k<.08?k/.08:k>.85?(1-k)/.15:1,y=Math.max(HB+50,GY-FH-100);x.globalAlpha=clamp(a,0,1);
 const hgt=b.exp?118:b.ctx?96:76;
 const gr=x.createLinearGradient(0,0,W,0);gr.addColorStop(0,'rgba(7,9,13,0)');gr.addColorStop(.15,'rgba(7,9,13,.82)');gr.addColorStop(.85,'rgba(7,9,13,.82)');gr.addColorStop(1,'rgba(7,9,13,0)');
 x.fillStyle=gr;x.fillRect(0,y-38,W,hgt);
 x.fillStyle='#f2c14e';const wv=W*Math.min(1,k*6);x.fillRect(W/2-wv/2,y-38,wv,2);x.fillRect(W/2-wv/2,y-38+hgt-2,wv,2);
 const pop=easeOutBack(Math.min(1,b.t/.25)),col=b.term==='IPPON'||b.term==='WAZA-ARI'?'#ffe08a':'#ffffff';
 textC(x,b.term,W/2,y,Math.round(fitSize(x,b.term,54,W-40,'italic 800')*pop),col);
 let ly=y+38;x.textAlign='center';x.textBaseline='middle';
 if(b.ctx){x.font=`700 ${fitSize(x,b.ctx,20,W-30,'700')}px ${FONT}`;x.fillStyle='#ffe08a';x.fillText(b.ctx,W/2,ly);ly+=24}
 if(b.exp){x.font=`600 ${fitSize(x,b.exp,17,W-30,'600')}px ${FONT}`;x.fillStyle='#dfe3ea';x.fillText(b.exp,W/2,ly)}
 x.globalAlpha=1;
}
function drawJudges(x){
 const F=G.F,y=GY-FH*.42,sp=Math.min(80,W*.22);
 for(let i=0;i<3;i++){const jx=W/2+(i-1)*sp,k=clamp((F.ht-.5-i*.3)/.3,0,1),fl=F.flags[i];
  x.fillStyle='rgba(17,20,27,.85)';rr(x,jx-26,y-34,52,64,12);x.fill();
  x.fillStyle='#e6e8ec';x.beginPath();x.arc(jx,y-16,8,0,7);x.fill();x.fillStyle='#2a2f3b';rr(x,jx-11,y-7,22,26,6);x.fill();
  const flag=(side,ang,col)=>{x.save();x.translate(jx+side*10,y);x.rotate(ang);x.strokeStyle='#c9ced6';x.lineWidth=2;x.beginPath();x.moveTo(0,0);x.lineTo(0,-30);x.stroke();x.fillStyle=col;x.fillRect(side>0?0:-16,-30,16,12);x.restore()};
  if(fl==='x'){flag(-1,-.9*k+.0,'#e2452b');flag(1,.9*k,'#f4f4f4')}
  else if(fl==='p')flag(-1,-(1-k)*2.2+(-.25)*k,'#e2452b');
  else flag(1,(1-k)*2.2+.25*k,'#f4f4f4');
 }
}

/* ---------- ekrany ---------- */
const XSVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const MSVG='<svg width="30" height="36" viewBox="0 0 30 36"><path d="M8 0h5l3 9h-5zM17 0h5l-3 9h-5z" fill="#e2452b"/><circle cx="15" cy="22" r="12" fill="#f2c14e" stroke="#ffe08a" stroke-width="2"/><circle cx="15" cy="22" r="7.5" fill="none" stroke="#b8862a" stroke-width="1.6"/><text x="15" y="26" text-anchor="middle" font-size="11" font-weight="800" fill="#7a5512" font-family="sans-serif">1</text></svg>';
function stageWon(){return G?G.T.stage:0}
function showScr(html){root.classList.add('gk-menu');els.scr.hidden=false;els.scr.innerHTML=html;els.scr.scrollTop=0}
function hideScr(){root.classList.remove('gk-menu');els.scr.hidden=true;els.scr.innerHTML=''}
function screenMenu(){
 const g=gd(),S=S_(),boss=oppImgs[3]?oppImgs[3].src:'';
 showScr(`<div class="gk-in">
  <button class="gk-ib gk-x" data-a="exit" aria-label="Wyjdź">${XSVG}</button>
  <p class="gk-kick">Mini-gra · Zawody</p><h2 class="gk-t">Turniej Kumite</h2>
  <div class="gk-hero"><img src="${esc(playerImg.src)}" alt=""><span class="gk-vs">VS</span><img class="gk-boss" src="${esc(boss)}" alt=""></div>
  <div class="gk-best"><div><b>${g.champ?g.champ+'×':g.stage?esc(['–','1/8','1/4','1/2','Finał'][g.stage]):'–'}</b><span>${g.champ?'złoty medal':'najdalej doszłaś'}</span></div><div><b>${fmt(g.best||0)}</b><span>rekord punktów</span></div><div><b>${coinsLeft()}</b><span>monet do zdobycia dziś</span></div></div>
  <div class="gk-how"><h3>Jak grać?</h3>
   <div class="gk-row"><span class="gk-ico">●</span><p><b>Stuknij – cios pięścią</b><small>Seiken tsuki. Szybki, ale rywalki czasem go blokują.</small></p></div>
   <div class="gk-row"><span class="gk-ico">→</span><p><b>Przesuń palcem: kopnięcia</b><small>→ mawashi geri, ↑ mae geri, ↓ niskie kopnięcie.</small></p></div>
   <div class="gk-row"><span class="gk-ico" style="background:rgba(255,90,74,.25)">✦</span><p><b>Błysk = atak rywalki! Broń się:</b><small><i style="color:#ff7a6a">czerwony</i> wysoko → przesuń ↑ · <i style="color:#ffd23f">żółty</i> w brzuch → przesuń ← · <i style="color:#4aa8ff">niebieski</i> nisko → przesuń ↓</small></p></div>
   <div class="gk-row"><span class="gk-ico" style="background:rgba(242,193,78,.25);color:#ffe08a">◎</span><p><b>Złoty krąg = idealny blok</b><small>Broń się, gdy krąg zrobi się złoty – dostaniesz KONTRĘ: dwa mocne ciosy!</small></p></div>
   <div class="gk-row"><span class="gk-ico" style="font-size:15px;color:#ffe08a">½</span><p><b>Pełny pasek = waza-ari</b><small>Dwa waza-ari = IPPON i wygrana. Koniec czasu? Decydują sędziowie (hantei).</small></p></div>
   <div class="gk-row"><span class="gk-ico" style="font-size:15px;color:#ffe08a">4</span><p><b>4 walki do złotego medalu</b><small>1/8 finału, ćwierćfinał, półfinał i wielki FINAŁ.</small></p></div>
  </div>
  <div class="gk-btns"><button class="gk-btn p" data-a="tour">Zaczynamy turniej! Osu!</button></div></div>`);
}
function screenBracket(msg){
 const T=G.T,cur=T.stage,op=G.ops[cur];
 const rows=[3,2,1,0].map(i=>{const o=G.ops[i],done=i<cur,now=i===cur,r=T.res[i];
  return `<div class="gk-rung ${done?'done':now?'now':'lock'}"><canvas width="120" height="120" data-o="${i}"></canvas>
   <div class="gk-ri"><small>${STAGES[i]}</small><b>${done||now?esc(o.n):'???'}</b><span><i style="background:${o.belt}"></i>${done||now?esc(o.style):'Rywalka czeka…'}</span></div>
   <em>${done?'✓ '+(r&&r.how==='ippon'?'Ippon':'Hantei'):now?'Teraz!':'?'}</em></div>`}).join('');
 showScr(`<div class="gk-in">
  <button class="gk-ib gk-x" data-a="exit" aria-label="Wyjdź">${XSVG}</button>
  ${msg||''}
  <p class="gk-kick">Drabinka turnieju · ${fmt(T.score)} pkt</p><h2 class="gk-t">${STAGES[cur]}</h2>
  <div class="gk-ladder">${rows}</div>
  <p class="gk-tip"><b>${esc(op.n)}:</b> ${esc(op.tip)}</p>
  <div class="gk-btns"><button class="gk-btn p" data-a="fight">Do walki! Osu!</button></div></div>`);
 els.scr.querySelectorAll('canvas[data-o]').forEach(c=>{const i=+c.dataset.o;if(i<=cur)drawPortrait(c,oppImgs[i],true);else{drawPortrait(c,oppImgs[i],true)}});
}
function screenPause(){
 showScr(`<div class="gk-pause"><h2>Pauza</h2><p>Złap oddech. Gotowa?</p>
  <button class="gk-btn p" data-a="resume">Wracam do walki</button><button class="gk-btn" data-a="restart">Nowy turniej</button><button class="gk-btn" data-a="exit">Wyjdź</button></div>`);
}
function recordEnd(champ){
 const g=gd(),T=G.T,rec=T.score>(g.best||0);
 if(rec)g.best=T.score;g.stage=Math.max(g.stage||0,T.stage+(champ?1:0));if(champ)g.champ=(g.champ||0)+1;g.last=today();save();
 return rec;
}
function payTier(stage){
 const tier=COIN_TIER[stage];if(tier==null)return 0;
 const paid=dw('payOnce','gk'+today()+'-'+tier,5,'Turniej Kumite');if(paid){G.T.coins+=5;return 5}return 0;
}
function afterFight(win,how){
 const F=G.F,T=G.T,g=gd();stopLoop();
 g.fights++;g.perfect+=F.perfect;if(win){g.wins++;if(how==='ippon')g.ippons++}
 G.F=null;G.ban=null;G.parts=[];G.texts=[];G.fx=[];G.ev=[];
 if(win){
  T.res[T.stage]={how};const coins=payTier(T.stage);const x=xp(T.stage===3?10:3);T.xp+=x;
  save();
  if(T.stage===3){screenPodium(coins);return}
  const st=T.stage;T.stage++;
  screenBracket(`<div class="gk-won"><b>Wygrana przez ${how==='ippon'?'IPPON':'HANTEI'}!</b>${STAGES[st]} za Tobą${coins?` · <span style="color:#f2c14e">+${coins} monet</span>`:''}</div>`);
  voice('Brawo! Przechodzisz dalej. Osu!');
 }else{save();screenLose(F)}
}
function statGrid(){const T=G.T;return `<div class="gk-grid"><div><b>${T.hits}</b><span>trafień</span></div><div><b>${T.perfect}</b><span>idealnych bloków</span></div><div><b>${T.waza}</b><span>waza-ari</span></div></div>`}
function coinLine(){const T=G.T,l=coinsLeft();return `<p class="gk-coins">${T.coins?`W tym turnieju: <b>+${T.coins} monet</b>${T.xp?` i <b>+${T.xp} XP</b>`:''}.`:l<=0?'Dzisiejsze monety z turnieju już zebrane – wróć jutro!':`Wygrywaj walki, a dostaniesz monety (dziś jeszcze ${l}).`}</p>`}
function screenLose(F){
 const T=G.T,rec=recordEnd(false),op=F.op;
 showScr(`<div class="gk-in gk-res">
  <button class="gk-ib gk-x" data-a="exit" aria-label="Wyjdź">${XSVG}</button>
  <p class="gk-kick">${STAGES[T.stage]} · koniec walki</p><h2 class="gk-t" style="font-size:40px">Nie poddawaj się!</h2>
  <p style="margin:8px 0 0;color:#c9ced6;font-size:16px">Tym razem wygrała <b style="color:#fff">${esc(op.n)}</b>. Prawdziwa karateczka wstaje i walczy dalej. Osu!</p>
  <div class="gk-big">${fmt(T.score)}</div>
  ${rec?'<span class="gk-rec">NOWY REKORD!</span>':`<p style="margin:0;color:#9aa2af">Rekord: <b style="color:#f2c14e">${fmt(gd().best||0)}</b></p>`}
  ${statGrid()}
  <p class="gk-tip" style="text-align:left"><b>Rada sensei:</b> ${T.perfect<2?'Czekaj, aż krąg zrobi się złoty – wtedy blok daje kontrę!':'Nie bij bez przerwy – po kilku ciosach rywalka blokuje. Uderz, obroń się, kontruj!'}</p>
  ${coinLine()}
  <div class="gk-btns"><button class="gk-btn p" data-a="fight">Rewanż z ${esc(op.n.split(' ').pop())}!</button><button class="gk-btn" data-a="restart">Nowy turniej</button><button class="gk-btn" data-a="exit">Wyjdź</button></div></div>`);
 dw('gong');
}
function medalToday(){const S=S_(),d=today();return Array.isArray(S.comps)&&S.comps.some(c=>c&&c.c==='Turniej Kumite (gra)'&&c.d===d)}
function addMedal(btn){
 const S=S_();if(!Array.isArray(S.comps))S.comps=[];
 if(!medalToday()){S.comps.push({d:today(),c:'Turniej Kumite (gra)',n:'Turniej Kumite – gra',p:1,o:'',good:'',fix:''});gd().medalD=today();save();dw('beep',1318,.12,2);voice('Złoty medal na Twojej karcie! Osu!')}
 if(btn){btn.disabled=true;btn.innerHTML=MSVG+'Medal dodany do karty! ✓'}
}
function screenPodium(coins){
 const T=G.T,rec=recordEnd(true),has=medalToday();
 showScr(`<div class="gk-in gk-res">
  <canvas class="gk-conf"></canvas>
  <button class="gk-ib gk-x" data-a="exit" aria-label="Wyjdź" style="position:relative">${XSVG}</button>
  <p class="gk-kick">Turniej Kumite · złoty medal</p><h2 class="gk-t" style="font-size:52px">MISTRZYNI!</h2>
  <div class="gk-pod"><img src="media/podium.webp" alt="Podium"></div>
  <div class="gk-big" style="font-size:56px">${fmt(T.score)} pkt</div>
  ${rec?'<span class="gk-rec">NOWY REKORD!</span>':`<p style="margin:0;color:#9aa2af">Rekord: <b style="color:#f2c14e">${fmt(gd().best||0)}</b></p>`}
  ${statGrid()}
  ${coinLine()}
  <div class="gk-btns" style="position:relative">
   <button class="gk-btn m" data-a="medal" ${has?'disabled':''}>${MSVG}${has?'Medal z dziś już jest na karcie ✓':'Dodaj medal do karty postaci'}</button>
   <button class="gk-btn p" data-a="restart">Zagraj jeszcze raz</button><button class="gk-btn" data-a="exit">Wyjdź</button></div></div>`);
 dw('fanfare');voice('Złoty medal! Jesteś mistrzynią turnieju! Osu!');
 startConf();
}
/* konfetti na podium */
function startConf(){
 const c=els.scr.querySelector('.gk-conf');if(!c)return;
 const rm=reducedMotion(),n=rm?40:130,cols=['#f2c14e','#ffe08a','#e2452b','#4aa8ff','#3aa655','#ffffff'];
 const w=c.clientWidth,h=c.clientHeight;c.width=Math.round(w*DPR);c.height=Math.round(h*DPR);
 const P=[];for(let i=0;i<n;i++)P.push({x:Math.random()*w,y:rm?Math.random()*h*.6:-Math.random()*h*.8,vx:rnd(-30,30),vy:rnd(60,160),r:rnd(0,6),vr:rnd(-6,6),s:rnd(5,10),c:cols[i%cols.length]});
 G.conf={c,x:c.getContext('2d'),P,t:0,w,h,rm};
 if(rm){drawConf(0);G.conf=null;return}
 startLoop();
}
function drawConf(dt){
 const C=G.conf;if(!C)return;C.t+=dt;const x=C.x;x.setTransform(DPR,0,0,DPR,0,0);x.clearRect(0,0,C.w,C.h);
 for(const p of C.P){p.x+=p.vx*dt+Math.sin(C.t*3+p.r)*.6;p.y+=p.vy*dt;p.r+=p.vr*dt;if(p.y>C.h+10&&C.t<4){p.y=-10;p.x=Math.random()*C.w}
  x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s*.3,p.s,p.s*.6);x.restore()}
 if(C.t>7){G.conf=null;x.clearRect(0,0,C.w,C.h);stopLoop()}
}

/* ---------- sterowanie ---------- */
function startLoop(){if(raf)return;lastT=performance.now();raf=requestAnimationFrame(loop)}
function stopLoop(){if(raf)cancelAnimationFrame(raf);raf=0}
function startFight(){
 G.conf=null;G.F=newFight();G.ev=[];G.ban=null;G.parts=[];G.texts=[];G.fx=[];G.paused=false;G.ptr.clear();
 shakeOK=!reducedMotion();hideScr();els.tech.classList.remove('on');
 buildFighters();setupHud();startLoop();
}
function newTournament(){const g=gd();g.plays++;save();G=newG();screenBracket()}
function pause(){if(!G||!G.F||G.paused)return;G.paused=true;stopLoop();G.ptr.clear();screenPause()}
function resume(){if(!G||!G.paused)return;G.paused=false;hideScr();startLoop()}
function onClick(e){const b=e.target.closest('[data-a]');if(!b||!root.contains(b))return;const a=b.dataset.a;
 if(a==='exit')close();else if(a==='tour'||a==='restart')newTournament();else if(a==='fight')startFight();else if(a==='pause')pause();else if(a==='resume')resume();else if(a==='medal')addMedal(b)}
function onVis(){if(document.hidden)pause()}
function onKey(e){if(e.key==='Escape'){if(G&&G.paused)resume();else pause()}}

function open(){
 if(root)return;
 const S=S_();
 if(!document.getElementById(ID+'-css')){const st=document.createElement('style');st.id=ID+'-css';st.textContent=CSS;document.head.appendChild(st)}
 root=document.createElement('div');root.id=ID;root.className='gk-menu';document.body.appendChild(root);
 playerImg=loadImg(S.look?`media/sklep/shop-${S.look}.webp`:'media/gra-postac.webp');
 const ops=oppList();oppImgs=ops.map(o=>loadImg(`media/sklep/shop-${o.img}.webp`));podImg=loadImg('media/podium.webp');
 root.innerHTML=`<div class="gk-bg"></div><canvas class="gk-cv"></canvas>
  <div class="gk-hud">
   <div class="gk-r1"><button class="gk-ib" data-a="pause" aria-label="Pauza">${PSVG}</button><div class="gk-st"><small></small><b></b></div><div class="gk-tm"><span>0:45</span><small>CZAS</small></div></div>
   <div class="gk-r2">
    <div class="gk-f me"><canvas width="68" height="68"></canvas><div class="gk-fi"><div class="gk-nm">Blanka</div><div class="gk-bar"><b></b></div><div class="gk-pips"><i></i><i></i></div></div></div>
    <div class="gk-f op"><canvas width="68" height="68"></canvas><div class="gk-fi"><div class="gk-nm"></div><div class="gk-bar"><b></b></div><div class="gk-pips"><i></i><i></i></div></div></div>
   </div></div>
  <div class="gk-tech"></div>
  <div class="gk-leg">
   <div class="gk-lr"><em>ATAK</em><span><b>●</b>cios</span><span><b>→</b>mawashi</span><span><b>↑</b>mae geri</span><span><b>↓</b>gedan</span></div>
   <div class="gk-lr"><em>OBRONA</em><span><b style="background:#e2452b">↑</b>wysoko</span><span><b style="background:#c9a21a">←</b>brzuch</span><span><b style="background:#2f7fd0">↓</b>nisko</span></div>
  </div>
  <div class="gk-scr" hidden></div>`;
 cv=root.querySelector('.gk-cv');cx=cv.getContext('2d');
 const q=s=>root.querySelector(s);
 els={hud:q('.gk-hud'),leg:q('.gk-leg'),tech:q('.gk-tech'),scr:q('.gk-scr'),stS:q('.gk-st small'),stB:q('.gk-st b'),tm:q('.gk-tm'),tmS:q('.gk-tm span'),tmE:q('.gk-tm small'),
  pBar:q('.gk-f.me .gk-bar b'),oBar:q('.gk-f.op .gk-bar b'),pPips:[...root.querySelectorAll('.gk-f.me .gk-pips i')],oPips:[...root.querySelectorAll('.gk-f.op .gk-pips i')],
  oNm:q('.gk-f.op .gk-nm'),pPor:q('.gk-f.me canvas'),oPor:q('.gk-f.op canvas')};
 document.documentElement.style.overflow='hidden';
 on(cv,'pointerdown',onDown);on(cv,'pointermove',onMove);on(cv,'pointerup',onUp);on(cv,'pointercancel',onUp);
 on(root,'click',onClick);on(root,'contextmenu',e=>e.preventDefault());
 on(window,'resize',layout);on(document,'visibilitychange',onVis);on(document,'keydown',onKey);
 G=newG();
 layout();
 screenMenu();
 dw('music',true);
}
function close(){
 stopLoop();clearTimeout(techT);techT=0;
 listeners.forEach(([t,ev,fn,opt])=>t.removeEventListener(ev,fn,opt));listeners=[];
 if(root){root.remove();root=null}
 const st=document.getElementById(ID+'-css');if(st)st.remove();
 document.documentElement.style.overflow='';
 G=null;cv=null;cx=null;els={};hc={};
 try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}
 dw('music',false);
}
window.Games=window.Games||{};
window.Games.kumite={open,close,get running(){return !!raf}};
})();

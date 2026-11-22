/* Tameshiwari – mini-gra rozbijania dla „Droga wojownika”.
   Zwykły skrypt. Publiczne API: window.Games.deski.open(), .close().
   Korzysta z mostka window.DW (definiowanego w index.html). */
(function(){
'use strict';

/* ---------- stałe ---------- */
const FONT="'Barlow Condensed','Arial Narrow',sans-serif";
const GOLD='#f2c14e';
const MAT={
 deska:{f:['deska','deski','desek'],h:15,tech:'seiken',dust:'232,205,160',chip:['#f0cf98','#d9a45c','#b77b3c'],str:'drewno sosnowe'},
 dach:{f:['dachówka','dachówki','dachówek'],h:13,tech:'shuto',dust:'214,130,96',chip:['#d8693d','#b9512b','#8f3a1d'],str:'wypalana glina'},
 cegla:{f:['cegła','cegły','cegieł'],h:24,tech:'kakato',dust:'205,120,90',chip:['#c2593a','#a5452a','#e08a64'],str:'twarda cegła'},
 lod:{f:['blok lodu','bloki lodu','bloków lodu'],h:26,tech:'hiza',dust:'225,245,255',chip:['#e6f7ff','#bfe6fb','#ffffff'],str:'zmrożony lód'}
};
const TECH={
 seiken:{n:'Seiken',jp:'Seiken tsuki',pl:'cios pięścią',sh:'pięść'},
 shuto:{n:'Shuto',jp:'Shuto uchi',pl:'cios kantem dłoni',sh:'kant dłoni'},
 hiza:{n:'Hiza',jp:'Hiza geri',pl:'uderzenie kolanem',sh:'kolano'},
 kakato:{n:'Kakato',jp:'Kakato otoshi',pl:'kopnięcie piętą z góry',sh:'pięta'}
};
const TK=['seiken','shuto','hiza','kakato'];
// drabina wyzwań: materiał(y), liczba, wymagana siła
const CH=[
 ['deska',1,.40],['deska',2,.48],['deska',3,.55],['dach',3,.60],['deska',4,.64],['dach',5,.68],
 ['cegla',2,.72],['deska',5,.76],['lod',3,.79],['cegla',4,.82],['lod',5,.85],
 [['deska','deska','dach','dach','cegla','cegla','lod','lod'],8,.88]
].map((c,i)=>{const mats=Array.isArray(c[0])?c[0]:Array(c[1]).fill(c[0]);
 return {i,mats,n:c[1],req:c[2],legend:Array.isArray(c[0]),mat:Array.isArray(c[0])?'mix':c[0],
  zone:.13-i*.0075,mp:1.55-i*.06,fp:2.6-i*.08,ft:.26-i*.014,bg:i<3?'dojo':i<6?'mata':i<9?'gory':'swiatynia'}});
const COIN_N=5;

const DW=()=>window.DW||{};
const S_=()=>{try{return DW().getS()||{}}catch(e){return {}}};
const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const easeOutBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const easeOut=t=>1-Math.pow(1-t,3);
const pick=a=>a[Math.floor(Math.random()*a.length)];
function plForm(f,n){if(n===1)return f[0];const d=n%10,dd=n%100;return d>=2&&d<=4&&(dd<12||dd>14)?f[1]:f[2]}
function chName(c){if(c.legend)return 'Legendarny stos';return c.n+' '+plForm(MAT[c.mat].f,c.n)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ---------- dźwięk (WebAudio, własna szyna – łatwe sprzątanie) ---------- */
let noiseBuf=null,bus=null,live=[];
function ac(){if(S_().mute)return null;let a;try{a=DW().actx()}catch(e){return null}if(!a)return null;
 if(!bus||bus.context!==a){bus=a.createGain();bus.gain.value=.9;bus.connect(a.destination)}return a}
function noise(a){if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate)return noiseBuf;const n=a.sampleRate*.6|0,b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return noiseBuf=b}
function nz(a,t,dur,type,f0,f1,vol,q){const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noise(a);f.type=type;f.frequency.setValueAtTime(f0,t);if(q)f.Q.value=q;if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);f.connect(g);g.connect(bus);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t,Math.random()*.2);s.stop(t+dur+.02)}
function tone(a,t,type,f0,f1,dur,vol){const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);o.connect(g);g.connect(bus);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.02)}
const SFX={
 crack(m,i){const a=ac();if(!a)return;const t=a.currentTime+.005,k=Math.max(.55,1-i*.06);
  if(m==='deska'){nz(a,t,.2,'highpass',1400,0,.7*k);nz(a,t,.04,'bandpass',3200,0,.6*k,2);tone(a,t,'square',320,70,.09,.18*k);tone(a,t,'sine',120,38,.38,.95*k);nz(a,t+.03,.25,'lowpass',900,180,.35*k)}
  else if(m==='dach'){nz(a,t,.16,'bandpass',2600,900,.6*k,1.5);for(let j=0;j<3;j++)tone(a,t+j*.02,'sine',rnd(1600,2800),0,.09,.12*k);tone(a,t,'sine',150,50,.28,.7*k);nz(a,t+.04,.3,'lowpass',1500,250,.4*k)}
  else if(m==='cegla'){nz(a,t,.5,'lowpass',1600,160,.9*k);tone(a,t,'sine',95,32,.55,1*k);nz(a,t+.03,.28,'bandpass',700,0,.45*k,1);tone(a,t,'square',180,60,.1,.15*k)}
  else{for(let j=0;j<7;j++)tone(a,t+j*.025,'sine',rnd(2400,5200),0,.22,.09*k);nz(a,t,.32,'highpass',3800,0,.45*k);tone(a,t,'sine',130,45,.3,.6*k);nz(a,t+.02,.2,'bandpass',1800,600,.3*k)}},
 thud(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',92,40,.35,.9);nz(a,t,.14,'lowpass',500,0,.5)},
 whoosh(){const a=ac();if(!a)return;nz(a,a.currentTime,.28,'bandpass',380,2600,.38,1.2)},
 lock(good){const a=ac();if(!a)return;const t=a.currentTime;if(good){tone(a,t,'triangle',784,0,.12,.2);tone(a,t+.07,'triangle',1175,0,.18,.18)}else tone(a,t,'triangle',330,250,.16,.16)},
 breath(){const a=ac();if(!a)return;nz(a,a.currentTime,1,'bandpass',500,900,.07,.8)},
 kiai(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sawtooth',520,880,.22,.08);tone(a,t,'triangle',1046,1568,.25,.14);nz(a,t,.2,'bandpass',1500,3000,.18)},
 star(i){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',[880,1109,1319][i]||880,0,.35,.2);tone(a,t+.02,'sine',([880,1109,1319][i]||880)*2,0,.25,.06)},
 tap(){const a=ac();if(!a)return;tone(a,a.currentTime,'triangle',660,0,.06,.1)}
};
// ciągły ton ładowania siły
let chg=null;
function chargeOn(){const a=ac();if(!a||chg)return;const o=a.createOscillator(),o2=a.createOscillator(),g=a.createGain();o.type='triangle';o2.type='sine';o.frequency.value=180;o2.frequency.value=90;o.connect(g);o2.connect(g);g.connect(bus);g.gain.setValueAtTime(.0001,a.currentTime);g.gain.exponentialRampToValueAtTime(.07,a.currentTime+.08);o.start();o2.start();chg={o,o2,g,a};live.push(chg)}
function chargeSet(v){if(!chg)return;const t=chg.a.currentTime;chg.o.frequency.setTargetAtTime(170+v*560,t,.02);chg.o2.frequency.setTargetAtTime(85+v*280,t,.02)}
function chargeOff(){if(!chg)return;const c=chg;chg=null;try{const t=c.a.currentTime;c.g.gain.cancelScheduledValues(t);c.g.gain.setValueAtTime(Math.max(.0001,c.g.gain.value),t);c.g.gain.exponentialRampToValueAtTime(.0001,t+.06);c.o.stop(t+.08);c.o2.stop(t+.08)}catch(e){}live=live.filter(x=>x!==c)}
const buzz=p=>{if(S_().mute)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};

/* ---------- grafiki rysowane w kodzie ---------- */
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c}
function rr(x,a,b,w,h,r){r=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
// pojedynczy element stosu (w px CSS * dpr)
function pieceSprite(m,w,h,d){
 const c=mk(w*d,h*d),x=c.getContext('2d');x.scale(d,d);
 if(m==='deska'){
  let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f6d9a4');g.addColorStop(.45,'#e2b06c');g.addColorStop(1,'#b47a3d');
  x.fillStyle=g;rr(x,0,0,w,h,2);x.fill();
  x.lineWidth=.8;
  for(let i=0;i<7;i++){const y=h*(.12+i*.13)+rnd(-1,1);x.strokeStyle=`rgba(${110+rnd(-20,20)|0},60,20,${rnd(.22,.45)})`;x.beginPath();x.moveTo(0,y);
   for(let s=1;s<=6;s++)x.quadraticCurveTo(w*(s-.5)/6,y+rnd(-1.8,1.8),w*s/6,y+rnd(-1,1));x.stroke()}
  // sęk
  const kx=rnd(.15,.85)*w,ky=h*rnd(.35,.65);x.fillStyle='rgba(120,62,22,.55)';x.beginPath();x.ellipse(kx,ky,h*.45,h*.22,0,0,7);x.fill();
  x.strokeStyle='rgba(120,62,22,.4)';x.beginPath();x.ellipse(kx,ky,h*.75,h*.34,0,0,7);x.stroke();
  // końce (słoje)
  x.fillStyle='rgba(150,95,45,.45)';x.fillRect(0,0,3,h);x.fillRect(w-3,0,3,h);
  x.fillStyle='rgba(255,245,220,.6)';x.fillRect(2,1,w-4,1.2);
  x.fillStyle='rgba(70,35,10,.35)';x.fillRect(1,h-1.5,w-2,1.5);
 }else if(m==='dach'){
  let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#ec8a5c');g.addColorStop(.5,'#c9572c');g.addColorStop(1,'#8b3415');
  x.fillStyle=g;x.beginPath();x.moveTo(0,h*.35);x.quadraticCurveTo(w/2,-h*.25,w,h*.35);x.lineTo(w,h);x.quadraticCurveTo(w/2,h*.45,0,h);x.closePath();x.fill();
  x.fillStyle='rgba(255,220,190,.18)';for(let i=0;i<60;i++)x.fillRect(rnd(0,w),rnd(h*.2,h*.9),1.2,1.2);
  x.fillStyle='rgba(60,15,5,.25)';for(let i=0;i<40;i++)x.fillRect(rnd(0,w),rnd(h*.2,h*.9),1.4,1.4);
  x.strokeStyle='rgba(255,210,170,.55)';x.lineWidth=1;x.beginPath();x.moveTo(1,h*.36);x.quadraticCurveTo(w/2,-h*.2,w-1,h*.36);x.stroke();
 }else if(m==='cegla'){
  let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#d9734d');g.addColorStop(.55,'#b44a2b');g.addColorStop(1,'#7f2e18');
  x.fillStyle=g;rr(x,0,0,w,h,2.5);x.fill();
  for(let i=0;i<180;i++){x.fillStyle=Math.random()<.5?'rgba(60,15,5,.28)':'rgba(255,200,160,.18)';const s=rnd(.8,2.2);x.fillRect(rnd(1,w-2),rnd(1,h-2),s,s)}
  x.fillStyle='rgba(40,10,0,.3)';for(let i=0;i<3;i++){x.beginPath();x.ellipse(w*(.25+i*.25),h*.55,h*.18,h*.11,0,0,7);x.fill()}
  x.fillStyle='rgba(255,215,180,.45)';x.fillRect(2,1,w-4,1.5);
  x.strokeStyle='rgba(40,10,0,.35)';x.lineWidth=1;rr(x,.5,.5,w-1,h-1,2.5);x.stroke();
 }else{
  let g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(235,250,255,.95)');g.addColorStop(.4,'rgba(170,220,248,.88)');g.addColorStop(1,'rgba(110,175,225,.9)');
  x.fillStyle=g;rr(x,0,0,w,h,4);x.fill();
  x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=1.4;rr(x,1,1,w-2,h-2,3.5);x.stroke();
  x.fillStyle='rgba(255,255,255,.45)';x.beginPath();x.moveTo(6,3);x.lineTo(w*.45,3);x.lineTo(w*.4,h*.4);x.lineTo(6,h*.55);x.closePath();x.fill();
  x.strokeStyle='rgba(255,255,255,.6)';x.lineWidth=.8;for(let i=0;i<5;i++){const a=rnd(.1,.9)*w,b=rnd(.2,.8)*h;x.beginPath();x.moveTo(a,b);x.lineTo(a+rnd(-14,14),b+rnd(-6,6));x.lineTo(a+rnd(-20,20),b+rnd(-8,8));x.stroke()}
  x.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<14;i++){x.beginPath();x.arc(rnd(4,w-4),rnd(4,h-4),rnd(.6,1.6),0,7);x.fill()}
 }
 return c;
}
// linia pęknięcia (od góry do dołu) wokół środka
function cutLine(m,w,h){
 const pts=[],cx0=w*(.5+rnd(-.05,.05)),n=m==='lod'?4:m==='deska'?7:5,amp=m==='deska'?w*.06:m==='lod'?w*.08:w*.035;
 for(let i=0;i<=n;i++){const t=i/n;let dx=(i===0||i===n)?rnd(-amp,amp)*.5:rnd(-amp,amp);if(m==='deska'&&i%2)dx*=1.6;pts.push([cx0+dx+(m==='lod'?(t-.5)*w*.12:0),t*h])}
 return pts;
}
function halfSprite(src,pts,left,w,h,d){
 const c=mk(w*d,h*d),x=c.getContext('2d');x.scale(d,d);x.beginPath();
 if(left){x.moveTo(-2,-2);for(const p of pts)x.lineTo(p[0],p[1]);x.lineTo(pts[pts.length-1][0],h+2);x.lineTo(-2,h+2)}
 else{x.moveTo(w+2,-2);for(const p of pts)x.lineTo(p[0],p[1]);x.lineTo(pts[pts.length-1][0],h+2);x.lineTo(w+2,h+2)}
 x.closePath();x.save();x.clip();x.drawImage(src,0,0,w,h);x.restore();
 // jasna krawędź przełomu
 x.strokeStyle='rgba(255,240,210,.55)';x.lineWidth=1.2;x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke();
 let sx=0;for(const p of pts)sx+=p[0];sx/=pts.length;
 return {c,cx:left?sx/2:(sx+w)/2};
}
const SPR={};
function softSprite(rgb){const k='d'+rgb;if(SPR[k])return SPR[k];const s=64,c=mk(s,s),x=c.getContext('2d'),g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,`rgba(${rgb},.9)`);g.addColorStop(.5,`rgba(${rgb},.35)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,s,s);return SPR[k]=c}
function blockSprite(w,h,d){
 const c=mk(w*d,h*d),x=c.getContext('2d');x.scale(d,d);
 let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#a9adb3');g.addColorStop(1,'#5d6168');x.fillStyle=g;rr(x,0,0,w,h,3);x.fill();
 for(let i=0;i<90;i++){x.fillStyle=Math.random()<.5?'rgba(0,0,0,.18)':'rgba(255,255,255,.14)';x.fillRect(rnd(1,w-2),rnd(1,h-2),1.3,1.3)}
 x.fillStyle='rgba(30,32,36,.55)';rr(x,w*.18,h*.28,w*.25,h*.44,2);x.fill();rr(x,w*.57,h*.28,w*.25,h*.44,2);x.fill();
 x.fillStyle='rgba(255,255,255,.35)';x.fillRect(2,1,w-4,1.5);return c}

const IMG={};
function loadImg(src){if(IMG[src])return IMG[src];const i=new Image();i.decoding='async';i.src=src;IMG[src]=i;return i}
function scaled(img,h){if(!img||!img.complete||!img.naturalWidth)return null;const k=img._k||(img._k={});if(k[h])return k[h];const c=mk(h*img.naturalWidth/img.naturalHeight,h);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return k[h]=c}

/* ---------- CSS ---------- */
const CSS=`
#g-deski{position:fixed;inset:0;z-index:9000;background:#07090d;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;color:#f1f2f4;font-family:Barlow,system-ui,sans-serif}
#g-deski .gt-bg{position:absolute;inset:0;background-size:cover;background-position:center 60%;transform:scale(1.04)}
#g-deski .gt-bgn{opacity:0;transition:opacity .8s ease}#g-deski .gt-bgn.on{opacity:1}
#g-deski .gt-bg::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 75% at 55% 70%,rgba(7,9,13,.15),rgba(7,9,13,.82) 78%),linear-gradient(180deg,rgba(7,9,13,.8),rgba(7,9,13,.25) 30%,rgba(7,9,13,.2) 70%,rgba(7,9,13,.75))}
#g-deski canvas.gt-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#g-deski .gt-hud{position:absolute;left:0;right:0;top:0;padding:calc(10px + env(safe-area-inset-top)) 12px 0;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:8px;pointer-events:none}
#g-deski .gt-hud>*{pointer-events:auto}
#g-deski.menu .gt-hud,#g-deski.menu .gt-tech{visibility:hidden}
#g-deski .gt-ib{width:44px;height:44px;min-height:0;padding:0;border-radius:50%;background:rgba(17,20,27,.75);border:1px solid rgba(255,255,255,.14);display:grid;place-items:center;color:#f1f2f4}
#g-deski .gt-ttl{text-align:center;line-height:1;pointer-events:none;min-width:0}
#g-deski .gt-ttl small{display:block;font:700 13px/1 ${FONT};letter-spacing:.8px;color:${GOLD};text-transform:uppercase;margin-bottom:3px}
#g-deski .gt-ttl b{display:block;font:italic 800 26px/1 ${FONT};color:#ffe08a;text-shadow:0 2px 0 rgba(0,0,0,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#g-deski .gt-hst{font:800 15px/1 ${FONT};text-align:center;color:#ffe08a;pointer-events:none;letter-spacing:-1px}
#g-deski .gt-hst i{font-style:normal;color:rgba(255,255,255,.22)}
#g-deski .gt-tech{position:absolute;left:0;right:0;top:calc(66px + env(safe-area-inset-top));padding:0 10px;transition:opacity .25s}
#g-deski .gt-tech.off{opacity:0;pointer-events:none}
#g-deski .gt-tr{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-width:440px;margin:0 auto}
#g-deski .gt-tb{position:relative;overflow:visible;min-height:0;height:50px;padding:4px 2px;border-radius:12px;background:rgba(17,20,27,.8);border:1px solid rgba(255,255,255,.14);color:#e6e8ec;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:auto}
#g-deski .gt-tb b{font:italic 800 19px/1 ${FONT};letter-spacing:.3px}
#g-deski .gt-tb span{font-size:11.5px;line-height:1;color:#9aa2af}
#g-deski .gt-tb.on{background:linear-gradient(180deg,rgba(255,224,138,.28),rgba(242,193,78,.14));border-color:${GOLD};color:#ffe08a;box-shadow:0 0 14px rgba(242,193,78,.3)}
#g-deski .gt-tb.on span{color:#f3dca0}
#g-deski .gt-tb em{position:absolute;top:-6px;right:-3px;font:800 10px/1 ${FONT};font-style:normal;background:${GOLD};color:#1a1405;border-radius:99px;padding:2px 5px;letter-spacing:.3px}
#g-deski .gt-tinfo{max-width:440px;margin:6px auto 0;text-align:center;font-size:13.5px;line-height:1.25;color:#c9ced6;min-height:34px}
#g-deski .gt-tinfo b{color:#ffe08a;font-family:${FONT};font-size:16px}
#g-deski .gt-scr{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:rgba(7,9,13,.84);backdrop-filter:blur(3px)}
#g-deski .gt-scr[hidden]{display:none}
#g-deski .gt-in{max-width:460px;margin:0 auto;padding:calc(16px + env(safe-area-inset-top)) 18px calc(22px + env(safe-area-inset-bottom));min-height:100%;display:flex;flex-direction:column;box-sizing:border-box}
#g-deski .gt-x{align-self:flex-end}
#g-deski .gt-top{display:flex;justify-content:space-between;align-items:center}
#g-deski h2.gt-t{font:italic 800 46px/.95 ${FONT};margin:0;color:#ffe08a;text-shadow:0 3px 0 rgba(0,0,0,.5);letter-spacing:.5px}
#g-deski .gt-kick{color:${GOLD};font-weight:600;font-size:14px;margin:0 0 2px;letter-spacing:.4px;text-transform:uppercase}
#g-deski .gt-hero{position:relative;height:160px;margin:4px 0 8px;display:flex;justify-content:center;align-items:flex-end}
#g-deski .gt-hero::before{content:'';position:absolute;left:50%;bottom:2px;width:230px;height:26px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(242,193,78,.45),transparent)}
#g-deski .gt-hero img{position:relative;height:160px;width:auto;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6));margin-right:-18px}
#g-deski .gt-hero canvas{position:relative;width:120px;height:100px}
#g-deski .gt-best{display:flex;gap:8px;margin:0 0 12px}
#g-deski .gt-best>div{flex:1;background:rgba(17,20,27,.85);border:1px solid #252a36;border-radius:14px;padding:8px 6px;text-align:center}
#g-deski .gt-best b{display:block;font:800 26px/1.1 ${FONT};color:${GOLD}}
#g-deski .gt-best span{font-size:12.5px;color:#9aa2af;line-height:1.2;display:block}
#g-deski .gt-safe{display:flex;gap:10px;align-items:flex-start;background:linear-gradient(180deg,rgba(47,111,224,.22),rgba(47,111,224,.1));border:1px solid rgba(110,160,255,.45);border-radius:14px;padding:10px 12px;margin:0 0 12px;font-size:14.5px;line-height:1.35}
#g-deski .gt-safe i{flex:none;font-style:normal;font:800 18px/1 ${FONT};width:26px;height:26px;border-radius:50%;background:#2f6fe0;display:grid;place-items:center;color:#fff}
#g-deski .gt-safe.sm{font-size:12.5px;color:#9aa2af;background:none;border:0;padding:4px 2px 0;margin:6px 0 0}
#g-deski .gt-safe.sm i{display:none}
#g-deski .gt-how{background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:16px;padding:10px 12px;margin:0 0 14px}
#g-deski .gt-how h3{font:700 21px/1.1 ${FONT};margin:2px 0 6px}
#g-deski .gt-row{display:flex;align-items:center;gap:12px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)}
#g-deski .gt-row:first-of-type{border-top:0}
#g-deski .gt-row canvas{flex:none;width:42px;height:42px}
#g-deski .gt-row p{margin:0;font-size:15px;line-height:1.3}
#g-deski .gt-row p small{display:block;color:#9aa2af;font-size:13px}
#g-deski .gt-btns{display:grid;gap:10px;margin-top:auto;padding-top:12px}
#g-deski .gt-res{text-align:center}
#g-deski .gt-big{font:italic 800 76px/1 ${FONT};color:#ffe08a;text-shadow:0 4px 0 rgba(0,0,0,.45),0 0 30px rgba(242,193,78,.35);margin:4px 0 0}
#g-deski .gt-big small{font-size:40px;color:#c9ced6}
#g-deski .gt-sub{margin:0 0 6px;color:#c9ced6;font-size:15px}
#g-deski .gt-stars{display:flex;justify-content:center;gap:10px;margin:4px 0 10px}
#g-deski .gt-stars svg{width:50px;height:50px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
#g-deski .gt-stars svg.on{animation:gtpop .45s cubic-bezier(.3,1.6,.5,1) both}
#g-deski .gt-stars svg:nth-child(2).on{animation-delay:.18s}#g-deski .gt-stars svg:nth-child(3).on{animation-delay:.36s}
@keyframes gtpop{from{transform:scale(0) rotate(-40deg)}to{transform:none}}
#g-deski .gt-rec{display:inline-block;background:linear-gradient(180deg,#ffe08a,${GOLD});color:#1a1405;font:800 18px/1 ${FONT};padding:6px 14px;border-radius:99px;letter-spacing:.5px;margin:0 auto 8px}
#g-deski .gt-bars{background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:14px;padding:8px 12px;margin:0 0 10px;text-align:left}
#g-deski .gt-bar{display:grid;grid-template-columns:96px 1fr 44px;align-items:center;gap:8px;padding:4px 0;font-size:14.5px}
#g-deski .gt-bar>div{height:9px;border-radius:9px;background:rgba(255,255,255,.1);overflow:hidden}
#g-deski .gt-bar>div i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#c99a2e,#ffe08a)}
#g-deski .gt-bar b{font:700 18px/1 ${FONT};color:#ffe08a;text-align:right}
#g-deski .gt-bar span{font-weight:600}
#g-deski .gt-note{font-size:14.5px;color:#c9ced6;margin:0 0 6px}
#g-deski .gt-note b{color:${GOLD}}
#g-deski .gt-unl{background:rgba(242,193,78,.14);border:1px solid rgba(242,193,78,.5);border-radius:12px;padding:8px;margin:0 0 8px;font:700 18px/1.2 ${FONT};color:#ffe08a}
#g-deski .gt-lad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 4px}
#g-deski .gt-lc{position:relative;min-height:0;height:auto;width:auto;padding:8px 4px 7px;border-radius:14px;background:rgba(17,20,27,.9);border:1px solid #2a303c;color:#f1f2f4;display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center}
#g-deski .gt-lc canvas{width:64px;height:44px}
#g-deski .gt-lc b{font:italic 800 16px/1.05 ${FONT}}
#g-deski .gt-lc .gt-n{position:absolute;top:5px;left:8px;font:800 15px/1 ${FONT};color:#9aa2af}
#g-deski .gt-lc .gt-ls{font:800 15px/1 ${FONT};color:#ffe08a;letter-spacing:-1px}
#g-deski .gt-lc .gt-ls i{font-style:normal;color:rgba(255,255,255,.2)}
#g-deski .gt-lc.cur{border-color:${GOLD};box-shadow:0 0 16px rgba(242,193,78,.3)}
#g-deski .gt-lc.lock{opacity:.45}
#g-deski .gt-lc.leg{grid-column:span 3;flex-direction:row;justify-content:center;gap:12px;padding:10px;background:linear-gradient(180deg,rgba(242,193,78,.2),rgba(17,20,27,.9))}
#g-deski .gt-lc.leg b{font-size:22px;color:#ffe08a}
#g-deski .gt-pause{display:flex;flex-direction:column;justify-content:center;gap:12px;min-height:100%;max-width:340px;margin:0 auto;padding:24px}
#g-deski .gt-pause h2{text-align:center;font:italic 800 48px/1 ${FONT};color:#ffe08a;margin:0 0 10px}
`;
const STAR=(on)=>`<svg viewBox="0 0 24 24" class="${on?'on':''}"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.3 6 20.6l1.3-6.7-5-4.7 6.8-.8z" fill="${on?'#ffe08a':'rgba(255,255,255,.12)'}" stroke="${on?'#c99a2e':'rgba(255,255,255,.25)'}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const XSVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const starTxt=n=>'★'.repeat(n)+'<i>'+'★'.repeat(3-n)+'</i>';

/* ---------- stan ---------- */
let root=null,cv=null,cx=null,els={},raf=0,lastT=0,W=0,H=0,DPR=1,timers=[],listeners=[],G=null,geo={},shakeOK=true,playerImg=null,bgCur='',vig=null;
function on(t,ev,fn,opt){t.addEventListener(ev,fn,opt);listeners.push([t,ev,fn,opt])}
function later(fn,ms){const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);fn()},ms);timers.push(id);return id}

function data(){const S=S_();S.games=S.games||{};const d=S.games.deski=S.games.deski||{};
 if(!Array.isArray(d.stars))d.stars=[];if(!Array.isArray(d.best))d.best=[];
 for(let i=0;i<CH.length;i++){d.stars[i]=d.stars[i]||0;d.best[i]=d.best[i]||0}
 d.total=d.total||0;d.plays=d.plays||0;d.rec=d.rec||0;d.perfect=d.perfect||0;return d}
function unlocked(i){const d=data();return i===0||d.stars[i-1]>=1}
function nextCh(){const d=data();for(let i=0;i<CH.length;i++){if(!d.stars[i])return i}return CH.length-1}
function save(){try{DW().save()}catch(e){}}
function today(){try{return DW().today()}catch(e){return new Date().toISOString().slice(0,10)}}
function coinsToday(){const S=S_(),p=S.paid||{},d=today();let got=0;for(let t=0;t<3;t++)if(p['gt'+d+'-'+t])got+=COIN_N;return {got,max:3*COIN_N}}

/* ---------- tła ---------- */
function bgUrl(k){if(k==='dojo'){const S=S_();return S.bg?`media/sklep/shop-${S.bg}.webp`:'media/sklep/shop-tlo-dojo.webp'}return `media/gra/tlo-${k}.webp`}
function setBg(url){if(!root||!url||url===bgCur)return;const im=new Image();im.onload=()=>{if(!root||!root.isConnected)return;bgCur=url;
 const d=document.createElement('div');d.className='gt-bg gt-bgn';d.style.backgroundImage=`url('${url}')`;
 const old=[...root.querySelectorAll('.gt-bg')];old[old.length-1].after(d);requestAnimationFrame(()=>d.classList.add('on'));
 later(()=>old.forEach(o=>o.remove()),900)};im.src=url}

/* ---------- geometria ---------- */
function layout(){
 const tb=els.tech?els.tech.getBoundingClientRect():null;
 const top=(tb&&tb.height?tb.bottom:H*.2)+8;
 const floorY=H-Math.max(26,H*.05);
 const pw=Math.min(W*.56,270),u=pw/230;
 const bh=clamp(H*.055,30,46);
 const ph=clamp(H*.3,160,280);
 geo={top,floorY,pw,u,bh,ph,sx:W*.64,px:W*.19,k:1};
 if(G&&G.layers)stackLayout();
}
function stackLayout(){
 const L=G.layers,u=geo.u;let tot=0;for(const l of L)tot+=MAT[l.m].h*u;tot+=(L.length-1)*5*u;
 const maxH=(geo.floorY-geo.bh)-(geo.top+250);
 const k=tot>maxH?Math.max(.55,maxH/tot):1;geo.k=k;
 let y=geo.floorY-geo.bh;
 for(let i=L.length-1;i>=0;i--){const l=L[i];l.h=MAT[l.m].h*u*k;y-=l.h;l.y=y;y-=5*u*k}
 geo.stackTop=L[0].y;
 geo.aTop=geo.top+26;geo.aBot=Math.min(geo.stackTop-20,geo.floorY-geo.ph*.98);
}
function resize(){
 DPR=Math.min(2,window.devicePixelRatio||1);
 W=root.clientWidth;H=root.clientHeight;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
 const oldPw=geo.pw;layout();
 if(G&&G.layers&&oldPw!==geo.pw&&G.state==='ready')buildStack();
 SPR.block=blockSprite(geo.pw*.2,geo.bh,DPR);
 // winieta spowolnienia
 vig=mk(W,H);const x=vig.getContext('2d'),g=x.createRadialGradient(W/2,H*.55,Math.min(W,H)*.2,W/2,H*.55,Math.max(W,H)*.7);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.85)');x.fillStyle=g;x.fillRect(0,0,W,H);
 if(G&&!raf)draw();
}

/* ---------- przebieg próby ---------- */
function newAttempt(ci){
 const c=CH[ci];
 G={ci,c,state:'ready',t:0,v:0,vt:0,power:0,focus:0,parts:[],bodies:[],texts:[],rings:[],shake:0,flash:0,flashC:'255,255,255',
  tech:G&&G.ci===ci&&G.tech?G.tech:(c.legend?'seiken':MAT[c.mat].tech),ptr:null,ts:1,cam:0,layers:c.mats.map(m=>({m})),st:0,gt:0,impact:false,res:null,pl:{dx:0,dy:0,rot:0}};
 els.tech.classList.remove('off');techUI();
 layout();buildStack();
 setBg(bgUrl(c.bg));
 els.ttlS.textContent='Wyzwanie '+(ci+1)+' / '+CH.length;els.ttlB.textContent=chName(c);
 els.hst.innerHTML=starTxt(data().stars[ci]);
}
function buildStack(){
 const pw=geo.pw;stackLayout();
 for(const l of G.layers){l.spr=pieceSprite(l.m,pw,l.h,DPR);l.cut=cutLine(l.m,pw,l.h);l.L=halfSprite(l.spr,l.cut,true,pw,l.h,DPR);l.R=halfSprite(l.spr,l.cut,false,pw,l.h,DPR);l.state='whole';l.ct=0}
}
function techUI(){
 const c=G.c,rec=c.legend?null:MAT[c.mat].tech;
 els.techR.innerHTML=TK.map(k=>`<button class="gt-tb${G.tech===k?' on':''}" data-t="${k}"><b>${TECH[k].n}</b><span>${TECH[k].sh}</span>${k===rec?'<em>★ +10%</em>':''}</button>`).join('');
 const t=TECH[G.tech];
 els.tinfo.innerHTML=`<b>${t.jp}</b> – ${t.pl}.${rec?(G.tech===rec?' Najlepsza na ten materiał: <b>+10% siły</b>!':' Na '+plForm(MAT[c.mat].f,5)+' najlepsze jest <b>'+TECH[rec].n+'</b>.'):' Tu każda technika jest dobra!'}`;
}
function techBonus(){return !G.c.legend&&G.tech===MAT[G.c.mat].tech?1.1:1}

// pasek KIME: 0..1 trójkątnie
const zoneC=.78;
function kimeGrade(v){const hw=G.c.zone,d=Math.abs(v-zoneC);
 if(d<=hw)return {p:1-.1*(d/hw),txt:d<=hw*.45?'IDEALNE KIME!':'Dobre KIME!',good:true,perf:d<=hw*.45};
 return {p:Math.max(.15,.86-(d-hw)*2.4),txt:v<zoneC?'Za słabo…':'Za mocno – bez kontroli!',good:false}}
function focusGrade(r){const f=geo.ring,d=Math.abs(r-f.r0)/(f.R-f.r0),tol=G.c.ft;
 if(d<=tol)return {p:1-.1*(d/tol),txt:d<=tol*.45?'PEŁNE SKUPIENIE!':'Dobre skupienie!',good:true,perf:d<=tol*.45};
 return {p:Math.max(.2,.9-(d-tol)*1.5),txt:r>f.r0?'Za wcześnie!':'Za późno!',good:false}}
function ringGeo(){const aH=geo.aBot-geo.aTop,R=clamp(Math.min((aH-28-52)/2,W*.4),50,150);return {x:W/2,y:geo.aTop+28+(aH-28-44)/2,R,r0:R*.34}}
function ringR(t){const f=geo.ring,T=G.c.fp;return f.r0+(f.R-f.r0)*(.5+.5*Math.cos(2*Math.PI*t/T))}

function onDown(e){
 if(!G||!cv)return;e.preventDefault();
 if(G.state==='ready'){if(G.ptr!=null)return;G.ptr=e.pointerId;try{cv.setPointerCapture(e.pointerId)}catch(_){}G.state='charge';G.vt=0;G.v=0;chargeOn();buzz(10);return}
 if(G.state==='focus'){if(G.t<.25)return;const r=ringR(G.t),g=focusGrade(r);G.focus=g.p;G.fg=g;G.fr=r;
  ftext(W/2,geo.ring.y-geo.ring.R-6,g.txt,g.good?'#ffe08a':'#ffb3a6',g.good?30:26);
  G.state='kiai';G.t=0;SFX.kiai();try{DW().taiko(1)}catch(_){}try{DW().say('Kiai!')}catch(_){}buzz(30);flash(.25,'255,224,138');
  G.rings.push({x:W/2,y:geo.ring.y,r0:r,age:0,life:.5,col:'255,224,138'});return}
 if(G.state==='strike'&&G.resT>.35){finish();return}
}
function onUp(e){
 if(!G)return;
 if(G.state==='charge'&&e.pointerId===G.ptr){G.ptr=null;chargeOff();const g=kimeGrade(G.v);G.power=g.p;G.kg=g;G.lockV=G.v;SFX.lock(g.good);buzz(g.good?[15,30,15]:25);
  ftext(W/2,meterGeo().y-34,g.txt,g.good?'#ffe08a':'#ffb3a6',g.good?32:26);if(g.good)flash(.12,'255,224,138');
  G.state='locked';G.t=0;return}
 if(e.pointerId===G.ptr)G.ptr=null;
}
function meterGeo(){const aH=geo.aBot-geo.aTop,h=clamp(Math.min(aH*.7,aH-80),90,290),w=46;return {x:W/2-w/2,y:geo.aTop+28+(aH-72-h)*.45,w,h}}

/* ---------- efekty ---------- */
function ftext(x,y,txt,col,size,sub,life){G.texts.push({x,y,txt,col,size,sub,age:0,life:life||1.1});if(G.texts.length>6)G.texts.shift()}
function shake(a){if(shakeOK)G.shake=Math.max(G.shake,a)}
function flash(a,c){G.flash=Math.max(G.flash,a);G.flashC=c||'255,255,255'}
function addPart(p){if(G.parts.length>320)G.parts.shift();G.parts.push(p)}
function breakLayer(l,i,pow){
 const pw=geo.pw,x0=geo.sx-pw/2,m=MAT[l.m],side=1+pow*.6;
 l.state='broken';
 for(const [h,dir] of [[l.L,-1],[l.R,1]]){
  G.bodies.push({c:h.c,ox:h.cx,oy:l.h/2,w:pw,h:l.h,x:x0+h.cx,y:l.y+l.h/2,vx:dir*rnd(90,200)*side,vy:rnd(-220,-40)*side-i*10,rot:0,vr:dir*rnd(2.5,6)*side,ground:0})}
 const cxp=geo.sx+(l.cut[0][0]-pw/2),cy=l.y+l.h/2;
 const n=l.m==='lod'?18:l.m==='cegla'?16:14;
 for(let k=0;k<n;k++){const a=rnd(-Math.PI*.95,-Math.PI*.05),v=rnd(120,460)*side;
  addPart({t:l.m==='deska'?'spl':l.m==='cegla'?'chunk':'shard',x:cxp+rnd(-8,8),y:cy+rnd(-l.h/2,l.h/2),vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(1.2,2.2),age:0,s:rnd(2.5,6)*(l.m==='cegla'?1.2:1),c:pick(m.chip),g:1400,rot:rnd(0,6),vr:rnd(-14,14),bounce:1})}
 for(let k=0;k<7;k++)addPart({t:'dust',x:cxp+rnd(-pw*.25,pw*.25),y:cy+rnd(-6,6),vx:rnd(-60,60),vy:rnd(-50,-5),life:rnd(1.4,2.4),age:0,s:rnd(18,34),grow:rnd(24,50),spr:softSprite(m.dust),g:-10});
 if(l.m==='lod')for(let k=0;k<10;k++)addPart({t:'spark',x:cxp+rnd(-20,20),y:cy,vx:rnd(-260,260),vy:rnd(-320,-40),life:rnd(.5,1),age:0,s:rnd(4,8),g:600});
 SFX.crack(l.m,i);buzz(i===0?[40,20,60]:30);
 shake(Math.min(16,7+i*1.5));flash(i===0?.45:.12,i===0?'255,250,235':'255,240,210');
}

/* ---------- pętla ---------- */
function loop(now){
 raf=requestAnimationFrame(loop);
 let dt=(now-lastT)/1000;lastT=now;if(!(dt>0))dt=0;if(dt>.05)dt=.05;
 const p0=window.__gtPerf?performance.now():0;
 update(dt);draw();
 if(p0)window.__gtPerf.push(performance.now()-p0);
}
function update(dt){
 const g=G;g.t+=dt;
 if(g.state==='charge'){g.vt+=dt;const ph=(g.vt/g.c.mp)%2;g.v=ph<1?ph:2-ph;chargeSet(g.v)}
 else if(g.state==='locked'){if(g.t>.85){g.state='focus';g.t=0;geo.ring=ringGeo();g.lastB=-1}}
 else if(g.state==='focus'){const cyc=Math.floor(g.t/g.c.fp);if(cyc!==g.lastB){g.lastB=cyc;SFX.breath()}
  if(g.t>g.c.fp*3+.2){g.focus=.3;g.fg={txt:'Zabrakło skupienia…'};ftext(W/2,geo.ring.y-geo.ring.R-6,'Zabrakło skupienia…','#ffb3a6',26);g.state='kiai';g.t=0;SFX.kiai()}}
 else if(g.state==='kiai'){if(g.t>.75)startStrike()}
 else if(g.state==='strike')updStrike(dt);
 const sdt=dt*g.ts;
 // ciała (połówki)
 for(const b of g.bodies){b.vy+=1500*sdt;b.x+=b.vx*sdt;b.y+=b.vy*sdt;b.rot+=b.vr*sdt;
  const ext=Math.abs(Math.sin(b.rot))*b.w*.25+Math.abs(Math.cos(b.rot))*b.h/2;
  if(b.y+ext>geo.floorY){b.y=geo.floorY-ext;if(b.vy>0){b.vy*=-.28;b.vx*=.7;b.vr*=.55;if(Math.abs(b.vy)<40)b.vy=0}b.ground=1}
  if(b.ground){b.vx*=Math.pow(.2,sdt);const tgt=Math.round(b.rot/Math.PI)*Math.PI;b.vr+=(tgt-b.rot)*30*sdt+(b.rot>tgt?.4:-.4)*sdt*20;b.vr*=Math.pow(.15,sdt);if(Math.abs(tgt-b.rot)<.03&&Math.abs(b.vr)<.3){b.rot=tgt;b.vr=0}}}
 for(const p of g.parts){p.age+=sdt;p.vy+=p.g*sdt;p.x+=p.vx*sdt;p.y+=p.vy*sdt;if(p.rot!=null)p.rot+=p.vr*sdt;
  if(p.bounce&&p.y>geo.floorY){p.y=geo.floorY;p.vy*=-.3;p.vx*=.6;p.vr*=.5}}
 g.parts=g.parts.filter(p=>p.age<p.life);
 for(const t of g.texts)t.age+=dt;g.texts=g.texts.filter(t=>t.age<t.life);
 for(const r of g.rings)r.age+=sdt;g.rings=g.rings.filter(r=>r.age<r.life);
 g.shake=Math.max(0,g.shake-dt*45);g.flash=Math.max(0,g.flash-dt*1.8);
}
function startStrike(){
 const g=G,tb=techBonus();g.state='strike';g.st=0;g.gt=0;g.impact=false;g.resT=-1;
 els.tech.classList.add('off');
 const e=g.power*g.focus*tb,c=g.c;g.e=e;
 const ratio=clamp((e-.25)/(c.req-.25),0,1);
 g.broken=e>=c.req?c.n:Math.min(c.n,Math.floor(ratio*c.n+1e-4));
 g.stars=g.broken>=c.n?(g.power>=.9&&g.focus>=.9?3:2):g.broken>=Math.ceil(c.n/2)?1:0;
 const t=TECH[g.tech];ftext(W/2,geo.aTop+50,t.n.toUpperCase()+'!','#ffffff',58,t.pl,1.4);
}
function updStrike(dt){
 const g=G;g.st+=dt;const st=g.st,pl=g.pl,dir=g.tech==='hiza'||g.tech==='kakato';
 // ruch postaci: zamach -> wypad
 if(st<.45){const k=easeOut(st/.45);pl.dx=-14*k;pl.dy=dir?-10*k:4*k;pl.rot=-.06*k}
 else if(st<.6){const k=easeOut((st-.45)/.15);pl.dx=-14+(W*.1+14)*k;pl.dy=-16*k;pl.rot=-.06+.16*k}
 else{const k=clamp((st-1.6)/.6,0,1);pl.dx=W*.1*(1-easeOut(k));pl.dy=-16*(1-k);pl.rot=.1*(1-k)}
 if(st>=.45&&!g.whoosh){g.whoosh=1;SFX.whoosh()}
 if(st>=.6&&!g.impact){g.impact=true;g.ts=.16;g.gt=0;g.rt=0;g.burst=0;
  G.rings.push({x:geo.sx,y:geo.stackTop,r0:10,age:0,life:.35,col:'255,255,255',big:1});
  for(const l of g.layers)l.bump=1;
  try{DW().taiko(1)}catch(_){}}
 {let tg=0;if(st>.45)tg=g.impact?(g.rampT?0:1):.35;const rate=tg>g.cam?(g.impact?7:3):1.4;g.cam+=(tg-g.cam)*Math.min(1,dt*rate);if(!shakeOK)g.cam=0}
 if(!g.impact)return;
 g.burst+=dt*g.ts;
 g.gt+=dt*g.ts;g.rt+=dt;
 const L=g.layers,step=.05,cd=.045,pw=Math.min(1.2,g.e);
 for(let i=0;i<L.length;i++){const l=L[i];
  if(i<g.broken){if(l.state==='whole'&&g.gt>=i*step){l.state='crack';l.ct=0}
   if(l.state==='crack'){l.ct=(g.gt-i*step)/cd;if(l.ct>=1)breakLayer(l,i,pw)}}
  else if(i===g.broken&&!l.held&&g.gt>=i*step){l.held=1;l.state='hold';SFX.thud();shake(5);buzz(50);
   ftext(geo.sx,l.y-18,g.broken?'Ten wytrzymał!':'Stos wytrzymał!','#ffffff',24);
   for(let k=0;k<6;k++)addPart({t:'dust',x:geo.sx+rnd(-30,30),y:l.y,vx:rnd(-40,40),vy:rnd(-40,-5),life:1.4,age:0,s:16,grow:30,spr:softSprite(MAT[l.m].dust),g:0})}}
 const doneT=Math.max(1,Math.min(g.broken+1,L.length))*step+cd;
 if(g.gt>=doneT){if(!g.rampT)g.rampT=g.rt;const k=clamp((g.rt-g.rampT)/.55,0,1);g.ts=.16+.84*k*k;
  if(k>=1){if(g.resT<0){g.resT=0;showBigResult()}g.resT+=dt;if(g.resT>2.1)finish()}}
 for(const l of L)if(l.bump)l.bump=Math.max(0,l.bump-dt*4);
}
function showBigResult(){
 const g=G,c=g.c;
 const txt=g.broken>=c.n?(g.stars===3?'PERFEKCYJNIE!':'ROZBITE!'):g.broken?g.broken+' z '+c.n+'!':'OSU!';
 ftext(W/2,geo.aTop+(geo.aBot-geo.aTop)*.42,txt,g.broken?'#ffe08a':'#ffffff',g.broken>=c.n?64:52,g.broken+' / '+c.n+' rozbitych',2.4);
 if(g.broken>=c.n){flash(.2,'255,224,138');try{DW().taiko(2)}catch(_){}}
}

/* ---------- rysowanie ---------- */
function textC(x,t,px,py,size,col,stroke){x.font=`italic 800 ${size}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=Math.max(4,size*.1);x.strokeStyle=stroke||'rgba(0,0,0,.72)';x.strokeText(t,px,py);x.fillStyle=col;x.fillText(t,px,py)}
function fitSize(x,t,size,maxW,style){x.font=`${style} ${size}px ${FONT}`;const w=x.measureText(t).width;return w>maxW?Math.floor(size*maxW/w):size}
function draw(){
 const g=G,x=cx;if(!g||!x)return;
 x.setTransform(DPR,0,0,DPR,0,0);x.clearRect(0,0,W,H);
 x.save();
 if(g.cam>.001){const c=g.cam,z=1+.24*c,ix=geo.sx,iy=geo.stackTop;x.translate(ix+(W*.55-ix)*c,iy+(H*.56-iy)*c*.6);x.scale(z,z);x.translate(-ix,-iy)}
 if(g.shake>0){const s=g.shake;x.translate(rnd(-s,s),rnd(-s,s)*.7)}
 drawStack(x);drawPlayer(x);
 // połówki
 for(const b of g.bodies){x.save();x.translate(b.x,b.y);x.rotate(b.rot);x.drawImage(b.c,-b.ox,-b.oy,b.w,b.h);x.restore()}
 drawParts(x);
 if(g.state==='strike')drawStreak(x);
 for(const r of g.rings){const k=r.age/r.life;x.globalAlpha=1-k;x.strokeStyle=`rgba(${r.col},1)`;x.lineWidth=(r.big?10:6)*(1-k)+1;
  if(r.big){x.beginPath();x.ellipse(r.x,r.y,r.r0+k*geo.pw*.9,(r.r0+k*geo.pw*.9)*.32,0,0,7);x.stroke()}else{x.beginPath();x.arc(r.x,r.y,r.r0*(1+k*.8),0,7);x.stroke()}}
 x.globalAlpha=1;x.restore();
 // spowolnienie – winieta
 if(g.ts<1&&vig){x.globalAlpha=(1-g.ts)*.75;x.drawImage(vig,0,0,W,H);x.globalAlpha=1}
 if(g.state==='ready'||g.state==='charge'||g.state==='locked')drawMeter(x);
 if(g.state==='focus'||g.state==='kiai')drawFocus(x);
 if(g.state==='ready'||g.state==='charge'||g.state==='locked'||g.state==='focus'||g.state==='kiai')drawSteps(x);
 if(g.state==='kiai'){const k=g.t/.75,s=k<.25?easeOutBack(k/.25):1;x.globalAlpha=k>.7?1-(k-.7)/.3:1;textC(x,'KIAI!',W/2,geo.ring.y,Math.round(92*s),'#ffe08a');x.globalAlpha=1}
 drawTexts(x);
 if(g.flash>0){x.fillStyle=`rgba(${g.flashC},${g.flash})`;x.fillRect(0,0,W,H)}
}
function drawPlayer(x){
 const g=G,ph=geo.ph,c=scaled(playerImg,Math.round(ph*DPR)),bx=geo.px,by=geo.floorY+ph*.03;
 x.fillStyle='rgba(0,0,0,.45)';x.beginPath();x.ellipse(bx,geo.floorY-2,ph*.3,ph*.045,0,0,7);x.fill();
 if(!c)return;const pl=g.pl,idle=g.state==='strike'?0:Math.sin(performance.now()/450)*1.6;
 const w=c.width/DPR,h=c.height/DPR;
 x.save();x.translate(bx+pl.dx,by+pl.dy);x.rotate(pl.rot);
 if(g.state==='charge'){const v=g.v;x.translate(-3*v,0);x.scale(1-.03*v,1+.02*v);
  if(v>.3){x.globalAlpha=(v-.3)*.9;const gs=ph*1.3;x.drawImage(softSprite('242,193,78'),-gs/2,-h*.55-gs/2,gs,gs);x.globalAlpha=1}}
 x.drawImage(c,-w/2,-h+idle,w,h);x.restore();
}
function drawStack(x){
 const g=G,pw=geo.pw,x0=geo.sx-pw/2,u=geo.u*geo.k,bl=SPR.block,bw=pw*.2,by=geo.floorY-geo.bh;
 // podpory
 x.fillStyle='rgba(0,0,0,.4)';x.beginPath();x.ellipse(geo.sx,geo.floorY,pw*.62,8,0,0,7);x.fill();
 if(bl){x.drawImage(bl,x0-2,by,bw,geo.bh);x.drawImage(bl,x0+pw-bw+2,by,bw,geo.bh)}
 const L=g.layers;
 for(let i=0;i<L.length;i++){const l=L[i];if(l.state==='broken')continue;
  const bump=l.bump?Math.sin(l.bump*Math.PI)*3*(1-i/L.length):0,y=l.y+bump;
  // przekładki
  if(i<L.length-1&&L[i+1].state!=='broken'){x.fillStyle='#4a3420';const sw=pw*.07,sh=5*u;x.fillRect(x0+4,y+l.h,sw,sh+.5);x.fillRect(x0+pw-4-sw,y+l.h,sw,sh+.5)}
  x.drawImage(l.spr,x0,y,pw,l.h);
  if(l.state==='crack'||l.state==='hold'){const f=l.state==='hold'?.45:clamp(l.ct,0,1),pts=l.cut,n=pts.length-1,end=f*n;
   x.strokeStyle='rgba(25,12,4,.9)';x.lineWidth=2;x.lineJoin='round';x.beginPath();x.moveTo(x0+pts[0][0],y+pts[0][1]);
   for(let k=1;k<=Math.ceil(end);k++){const a=pts[k-1],b=pts[k],t=Math.min(1,end-(k-1));x.lineTo(x0+a[0]+(b[0]-a[0])*t,y+a[1]+(b[1]-a[1])*t)}x.stroke();
   if(l.state==='crack'){x.globalAlpha=.6;x.strokeStyle='#fff6d8';x.lineWidth=1;x.stroke();x.globalAlpha=1}}
 }
}
function drawParts(x){
 for(const p of G.parts){const k=1-p.age/p.life;
  if(p.t==='dust'){const s=p.s+p.grow*(p.age/p.life);x.globalAlpha=k*.75;x.drawImage(p.spr,p.x-s,p.y-s,s*2,s*2);continue}
  x.globalAlpha=Math.min(1,k*2.5);
  if(p.t==='spark'){const s=p.s*k+2;x.fillStyle='#ffffff';x.beginPath();x.moveTo(p.x,p.y-s);x.lineTo(p.x+s*.3,p.y);x.lineTo(p.x,p.y+s);x.lineTo(p.x-s*.3,p.y);x.closePath();x.fill();continue}
  x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.fillStyle=p.c;
  if(p.t==='spl')x.fillRect(-p.s*1.6,-p.s*.22,p.s*3.2,p.s*.44);
  else if(p.t==='chunk')x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.8);
  else{x.beginPath();x.moveTo(-p.s,p.s*.5);x.lineTo(p.s*.2,-p.s);x.lineTo(p.s,p.s*.6);x.closePath();x.fill()}
  x.restore()}
 x.globalAlpha=1;
}
function strikePath(){
 const ix=geo.sx,iy=geo.stackTop,t=G.tech,ph=geo.ph;
 const fx=geo.px+ph*.36+G.pl.dx,fy=geo.floorY-ph*.74;
 if(t==='kakato')return [[ix-W*.18,geo.aTop+20],[ix-W*.05,geo.aTop-10],[ix,iy]];
 if(t==='hiza')return [[geo.px+ph*.15,geo.floorY-ph*.35],[ix-W*.25,iy-ph*.7],[ix,iy]];
 if(t==='shuto')return [[fx,fy-ph*.2],[ix-W*.12,iy-ph*.9],[ix,iy]];
 return [[fx,fy],[ix-W*.2,iy-ph*.75],[ix,iy]];
}
function bez(P,t){const u=1-t;return [u*u*P[0][0]+2*u*t*P[1][0]+t*t*P[2][0],u*u*P[0][1]+2*u*t*P[1][1]+t*t*P[2][1]]}
function drawStreak(x){
 const g=G,st=g.st,ix=geo.sx,iy=geo.stackTop;
 if(st>=.45&&st<1.1){
  const P=strikePath(),k=easeOut(clamp((st-.45)/.15,0,1)),fade=st>.6?1-(st-.6)/.5:1,N=18;
  x.lineCap='round';x.lineJoin='round';
  for(let pass=0;pass<2;pass++){
   for(let i=1;i<=N;i++){const t0=k*(i-1)/N,t1=k*i/N,a=bez(P,t0),b=bez(P,t1),w=(pass?5:18)*(i/N);
    x.globalAlpha=fade*(i/N)*(pass?1:.55);x.strokeStyle=pass?'#fffaf0':'#f2c14e';x.lineWidth=w+1;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke()}}
  const h=bez(P,k),gs=110;x.globalAlpha=fade;x.drawImage(softSprite('255,236,170'),h[0]-gs/2,h[1]-gs/2,gs,gs);
  x.fillStyle='#fff';x.beginPath();x.arc(h[0],h[1],9*fade+3,0,7);x.fill();x.globalAlpha=1;
 }
 if(g.impact){
  // linie prędkości (manga) – tylko w spowolnieniu
  const sl=(1-g.ts)/.84;
  if(sl>.02){x.globalAlpha=sl*.55;x.strokeStyle='#fff';x.lineWidth=2;const R0=geo.pw*.55,R1=Math.max(W,H);
   for(let i=0;i<22;i++){const a=i/22*Math.PI*2+((i*7)%5)*.05,r0=R0+((i*13)%7)*14;x.beginPath();x.moveTo(ix+Math.cos(a)*r0,iy+Math.sin(a)*r0*.8);x.lineTo(ix+Math.cos(a)*R1,iy+Math.sin(a)*R1);x.stroke()}x.globalAlpha=1}
  // gwiazda uderzenia
  const b=g.burst/.12;if(b<1){const r=geo.pw*(.18+.32*easeOut(b));x.globalAlpha=1-b*b;x.fillStyle='#fffbe8';x.strokeStyle='#f2c14e';x.lineWidth=4;
   x.beginPath();for(let i=0;i<20;i++){const a=i/20*Math.PI*2,rr2=i%2?r*.42:r*(i%4?1:.8);x.lineTo(ix+Math.cos(a)*rr2,iy+Math.sin(a)*rr2*.75)}x.closePath();x.stroke();x.fill();x.globalAlpha=1}
 }
}
function drawSteps(x){
 const s=G.state,cur=s==='ready'||s==='charge'||s==='locked'?0:1,labels=['1 · KIME','2 · SKUPIENIE','3 · CIOS'],y=geo.aTop+2;
 x.font=`700 15px ${FONT}`;x.textBaseline='middle';x.textAlign='center';
 const gap=W/3.4;
 labels.forEach((t,i)=>{const px=W/2+(i-1)*gap,a=i===cur;x.fillStyle=a?'rgba(242,193,78,.95)':'rgba(17,20,27,.75)';const tw=x.measureText(t).width+18;rr(x,px-tw/2,y-12,tw,24,12);x.fill();
  if(!a){x.strokeStyle='rgba(255,255,255,.14)';x.lineWidth=1;x.stroke()}x.fillStyle=a?'#1a1405':i<cur?'#ffe08a':'#9aa2af';x.fillText(t,px,y+1)});
}
function drawMeter(x){
 const g=G,m=meterGeo(),hw=g.c.zone,v=g.state==='locked'?g.lockV:g.v;
 const yOf=t=>m.y+m.h*(1-t);
 // tor
 x.fillStyle='rgba(10,12,17,.85)';rr(x,m.x-4,m.y-4,m.w+8,m.h+8,16);x.fill();x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=1.5;x.stroke();
 // strefa za mocno
 x.fillStyle='rgba(226,69,43,.28)';x.fillRect(m.x,m.y,m.w,yOf(zoneC+hw)-m.y);
 // złota strefa
 const zy0=yOf(zoneC+hw),zy1=yOf(zoneC-hw),pulse=.75+.25*Math.sin(performance.now()/180);
 x.save();x.shadowColor='rgba(242,193,78,.9)';x.shadowBlur=14*pulse;x.fillStyle=`rgba(242,193,78,${.55*pulse+.2})`;x.fillRect(m.x,zy0,m.w,zy1-zy0);x.restore();
 // wypełnienie
 if(v>0){const fy=yOf(v),gr=x.createLinearGradient(0,m.y+m.h,0,m.y);gr.addColorStop(0,'#2f6fe0');gr.addColorStop(.55,'#7fb2ff');gr.addColorStop(.8,'#fff3c4');gr.addColorStop(1,'#ff7a5c');
  x.save();rr(x,m.x+5,m.y+5,m.w-10,m.h-10,10);x.clip();x.globalAlpha=.92;x.fillStyle=gr;x.fillRect(m.x+5,fy,m.w-10,m.y+m.h-fy);x.globalAlpha=1;x.restore()}
 // podziałka
 x.strokeStyle='rgba(255,255,255,.25)';x.lineWidth=1;for(let i=1;i<10;i++){const y=yOf(i/10);x.beginPath();x.moveTo(m.x+m.w-9,y);x.lineTo(m.x+m.w-3,y);x.stroke()}
 // znacznik
 const py=yOf(v);x.fillStyle=g.state==='locked'?(g.kg&&g.kg.good?'#ffe08a':'#ff9c8c'):'#ffffff';
 x.beginPath();x.moveTo(m.x+m.w+8,py);x.lineTo(m.x+m.w+24,py-10);x.lineTo(m.x+m.w+24,py+10);x.closePath();x.fill();
 x.beginPath();x.moveTo(m.x-8,py);x.lineTo(m.x-24,py-10);x.lineTo(m.x-24,py+10);x.closePath();x.fill();
 // podpisy
 x.font=`italic 800 18px ${FONT}`;x.textAlign='left';x.textBaseline='middle';x.fillStyle='#ffe08a';x.fillText('KIME',m.x+m.w+30,(zy0+zy1)/2);
 x.font=`600 13px ${FONT}`;x.fillStyle='#ff9c8c';x.fillText('za mocno',m.x+m.w+30,m.y+10);
 x.fillStyle='#9aa2af';x.fillText('za słabo',m.x+m.w+30,m.y+m.h-10);
 // instrukcja
 let hint=g.state==='ready'?'Przytrzymaj palec na ekranie…':g.state==='charge'?'…i puść w złotym polu!':'';
 if(hint){x.textAlign='center';const fs=fitSize(x,hint,21,W-30,'700');x.font=`700 ${fs}px ${FONT}`;x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.7)';x.lineJoin='round';const hy=m.y+m.h+26;if(g.state==='ready'){x.globalAlpha=.65+.35*Math.sin(performance.now()/220)}x.strokeText(hint,W/2,hy);x.fillStyle=g.state==='ready'?'#fff':'#ffe08a';x.fillText(hint,W/2,hy);x.globalAlpha=1}
}
function drawFocus(x){
 const g=G,f=geo.ring,r=g.state==='focus'?ringR(g.t):g.fr||f.r0,tol=g.c.ft*(f.R-f.r0);
 // pole tolerancji
 x.fillStyle='rgba(10,12,17,.55)';x.beginPath();x.arc(f.x,f.y,f.R+14,0,7);x.fill();
 x.strokeStyle='rgba(242,193,78,.35)';x.lineWidth=tol*2;x.beginPath();x.arc(f.x,f.y,f.r0,0,7);x.stroke();
 x.strokeStyle='#f2c14e';x.lineWidth=3;x.setLineDash([6,6]);x.beginPath();x.arc(f.x,f.y,f.r0,0,7);x.stroke();x.setLineDash([]);
 // środek
 const near=1-clamp(Math.abs(r-f.r0)/(f.R-f.r0),0,1);
 const gs=f.r0*2.4*(.8+near*.5);x.globalAlpha=.4+near*.6;x.drawImage(softSprite('242,193,78'),f.x-gs/2,f.y-gs/2,gs,gs);x.globalAlpha=1;
 // oddychający krąg
 x.save();x.shadowColor='rgba(255,255,255,.8)';x.shadowBlur=12;x.strokeStyle=near>1-g.c.ft?'#ffe08a':'#ffffff';x.lineWidth=5;x.beginPath();x.arc(f.x,f.y,r,0,7);x.stroke();x.restore();
 if(g.state==='focus'){
  const T=g.c.fp,ph=(g.t%T)/T,word=ph<.5?'WYDECH…':'WDECH…';
  textC(x,word,f.x,f.y,Math.round(Math.min(22,f.R*.36)),ph<.5?'#ffe08a':'#c9ced6');
  const hint='Stuknij, gdy krąg dotknie złotego koła!';x.textAlign='center';const fs=fitSize(x,hint,19,W-30,'700');x.font=`700 ${fs}px ${FONT}`;x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.7)';const hy=f.y+f.R+30;x.strokeText(hint,W/2,hy);x.fillStyle='#fff';x.fillText(hint,W/2,hy);
 }
}
function drawTexts(x){
 x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
 for(const t of G.texts){const k=t.age/t.life,pop=k<.12?easeOutBack(k/.12):1,y=t.y-k*24;x.globalAlpha=k>.75?1-(k-.75)/.25:1;
  const sz=Math.round(fitSize(x,t.txt,t.size,W-24,'italic 800')*pop);x.font=`italic 800 ${sz}px ${FONT}`;x.lineWidth=Math.max(4,sz*.1);x.strokeStyle='rgba(0,0,0,.7)';x.strokeText(t.txt,t.x,y);x.fillStyle=t.col;x.fillText(t.txt,t.x,y);
  if(t.sub){const fs=fitSize(x,t.sub,18,W-30,'700');x.font=`700 ${fs}px ${FONT}`;x.lineWidth=4;x.strokeText(t.sub,t.x,y+t.size*.62);x.fillStyle='#ffe08a';x.fillText(t.sub,t.x,y+t.size*.62)}}
 x.globalAlpha=1;
}

/* ---------- ikony do menu ---------- */
function stackIcon(mats,w,h){
 const c=document.createElement('canvas'),d=DPR;c.width=w*d;c.height=h*d;const x=c.getContext('2d');x.scale(d,d);
 const pw=w*.86,x0=(w-pw)/2,u=pw/230;let tot=0;mats.forEach(m=>tot+=MAT[m].h*u);tot+=(mats.length-1)*2;const bh=h*.18,k=Math.min(1,(h-bh-2)/tot);
 x.fillStyle='#7d8188';x.fillRect(x0,h-bh,pw*.2,bh);x.fillRect(x0+pw*.8,h-bh,pw*.2,bh);
 let y=h-bh;for(let i=mats.length-1;i>=0;i--){const ph=MAT[mats[i]].h*u*k;y-=ph;x.drawImage(pieceSprite(mats[i],pw,ph,d),x0,y,pw,ph);y-=2*k}
 return c}
function meterIcon(){const c=document.createElement('canvas'),d=DPR,s=42;c.width=c.height=s*d;const x=c.getContext('2d');x.scale(d,d);
 x.fillStyle='#11141b';rr(x,13,2,16,38,6);x.fill();x.fillStyle='rgba(242,193,78,.85)';x.fillRect(14,9,14,7);x.fillStyle='#7fb2ff';x.fillRect(16,18,10,20);x.fillStyle='#fff';x.beginPath();x.moveTo(31,12);x.lineTo(38,8);x.lineTo(38,16);x.fill();return c}
function ringIcon(){const c=document.createElement('canvas'),d=DPR,s=42;c.width=c.height=s*d;const x=c.getContext('2d');x.scale(d,d);
 x.strokeStyle='#fff';x.lineWidth=2.5;x.beginPath();x.arc(21,21,18,0,7);x.stroke();x.strokeStyle='#f2c14e';x.setLineDash([3,3]);x.beginPath();x.arc(21,21,8,0,7);x.stroke();x.setLineDash([]);x.fillStyle='#ffe08a';x.beginPath();x.arc(21,21,3,0,7);x.fill();return c}
function starIcon(){const c=document.createElement('canvas'),d=DPR,s=42;c.width=c.height=s*d;const x=c.getContext('2d');x.scale(d,d);x.font=`800 30px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillStyle='#ffe08a';x.fillText('★',21,23);return c}

/* ---------- ekrany ---------- */
function screenStart(){
 root.classList.add('menu');stopLoop();
 const d=data(),ct=coinsToday(),S=S_(),stars=d.stars.reduce((a,b)=>a+b,0),firstTime=!d.safe;
 const sc=els.scr;sc.hidden=false;
 const nx=nextCh(),allDone=d.stars.every(s=>s>0);
 sc.innerHTML=`<div class="gt-in">
  <div class="gt-top"><p class="gt-kick" style="margin:0">Mini-gra · Siła i skupienie</p><button class="gt-ib" data-a="exit" aria-label="Wyjdź">${XSVG}</button></div>
  <h2 class="gt-t">Tameshiwari</h2>
  <div class="gt-hero"><img src="${S.look?`media/sklep/shop-${esc(S.look)}.webp`:'media/gra-postac.webp'}" alt=""><span data-ic="hero"></span></div>
  <div class="gt-best"><div><b>${d.total}</b><span>rozbitych łącznie</span></div><div><b>${stars}<small style="font-size:16px;color:#9aa2af">/${CH.length*3}</small></b><span>gwiazdek</span></div><div><b>${ct.max-ct.got}</b><span>monet do zdobycia dziś</span></div></div>
  ${firstTime?`<div class="gt-safe"><i>!</i><div>W prawdziwym dojo tameshiwari robią tylko dorośli pod okiem sensei – tu możesz ćwiczyć bezpiecznie!</div></div>`:''}
  <div class="gt-how"><h3>Jak grać?</h3>
   <div class="gt-row" data-ic="meter"><p><b>1 · KIME – siła</b><small>Przytrzymaj palec: pasek rośnie i opada. Puść, gdy jest w złotym polu!</small></p></div>
   <div class="gt-row" data-ic="ring"><p><b>2 · SKUPIENIE – oddech</b><small>Krąg oddycha. Stuknij, gdy dotknie złotego koła – KIAI!</small></p></div>
   <div class="gt-row" data-ic="board"><p><b>3 · CIOS – technika</b><small>Wybierz technikę. Ta z ★ daje +10% siły na dany materiał.</small></p></div>
   <div class="gt-row" data-ic="star"><p><b>Gwiazdki</b><small>★ połowa stosu · ★★ cały stos · ★★★ cały stos z idealnym kime i skupieniem. Gwiazdka otwiera kolejne wyzwanie.</small></p></div>
   ${firstTime?'':`<div class="gt-safe sm"><i>!</i><div>W prawdziwym dojo tameshiwari robią tylko dorośli pod okiem sensei – tu możesz ćwiczyć bezpiecznie!</div></div>`}
  </div>
  <div class="gt-btns"><button class="btn-p full bigbtn" data-a="go" data-i="${nx}">${allDone?'Legendarny stos! Osu!':d.plays?'Wyzwanie '+(nx+1)+': '+esc(chName(CH[nx]))+'!':'Zaczynamy! Osu!'}</button><button class="full bigbtn" data-a="ladder">Drabina wyzwań</button></div></div>`;
 sc.querySelector('[data-ic="hero"]').replaceWith(stackIcon(['deska','deska','deska'],120,100));
 const ic={meter:meterIcon,ring:ringIcon,board:()=>stackIcon(['deska','deska'],42,42),star:starIcon};
 sc.querySelectorAll('.gt-row[data-ic]').forEach(r=>r.prepend(ic[r.dataset.ic]()));
 if(firstTime){d.safe=1;save()}
 sc.scrollTop=0;
}
function screenLadder(){
 root.classList.add('menu');stopLoop();
 const d=data(),nx=nextCh(),sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="gt-in">
  <div class="gt-top"><button class="gt-ib" data-a="menu" aria-label="Wróć"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><button class="gt-ib" data-a="exit" aria-label="Wyjdź">${XSVG}</button></div>
  <p class="gt-kick" style="margin-top:8px">Tameshiwari</p><h2 class="gt-t" style="font-size:40px">Drabina wyzwań</h2>
  <p class="gt-note" style="margin-top:6px">Zdobądź choć jedną ★, aby odblokować następny stos.</p>
  <div class="gt-lad">${CH.map((c,i)=>{const lk=!unlocked(i);return `<button class="gt-lc${c.legend?' leg':''}${i===nx&&!lk?' cur':''}${lk?' lock':''}" data-a="${lk?'locked':'go'}" data-i="${i}">
   ${c.legend?'':`<span class="gt-n">${i+1}</span>`}<span data-ic="${i}"></span><span style="display:flex;flex-direction:column;gap:3px;align-items:center"><b>${lk?'🔒 ':''}${esc(chName(c))}</b><span class="gt-ls">${starTxt(d.stars[i])}</span></span></button>`}).join('')}</div>
  <p class="gt-note">Rekord łącznie: <b>${d.total}</b> rozbitych elementów.</p>
 </div>`;
 sc.querySelectorAll('[data-ic]').forEach(s=>{const c=CH[+s.dataset.ic];s.replaceWith(stackIcon(c.legend?c.mats:c.mats.slice(0,Math.min(5,c.n)),64,44))});
 sc.scrollTop=0;
}
function screenPause(){
 const sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="gt-pause"><h2>Pauza</h2><p style="text-align:center;color:#c9ced6;margin:0 0 8px">Złap oddech. Gotowa?</p>
  <button class="btn-p full bigbtn" data-a="resume">Wracam</button><button class="full bigbtn" data-a="ladder">Drabina wyzwań</button><button class="full bigbtn" data-a="exit">Wyjdź</button></div>`;
}

function finish(){
 const g=G;if(!g||g.state==='over')return;g.state='over';stopLoop();chargeOff();
 const c=g.c,d=data(),S=S_(),day=today();
 if(d.day!==day){d.day=day;d.dayPieces=0}
 const prevStars=d.stars[c.i],wasUnl=unlocked(c.i+1)||c.i===CH.length-1;
 const rec=g.broken>d.best[c.i]||g.stars>prevStars;
 d.plays++;d.total+=g.broken;d.dayPieces+=g.broken;d.rec=Math.max(d.rec,g.broken);if(g.stars===3)d.perfect++;
 d.best[c.i]=Math.max(d.best[c.i],g.broken);d.stars[c.i]=Math.max(prevStars,g.stars);d.last=day;
 const newUnl=!wasUnl&&c.i<CH.length-1&&unlocked(c.i+1);
 // monety (max 3 progi dziennie po 5) + mała porcja XP
 let coins=0;const pay=(t,ok)=>{if(!ok)return;try{if(DW().payOnce('gt'+day+'-'+t,COIN_N,'Tameshiwari'))coins+=COIN_N}catch(e){}};
 pay(0,g.stars>=1);pay(1,g.stars===3);pay(2,d.dayPieces>=20);
 let xp=0;if(!prevStars&&g.stars)xp=c.legend?20:5;if(xp)try{DW().addXP(xp)}catch(e){}
 save();
 const ct=coinsToday(),tb=techBonus(),t=TECH[g.tech];
 const praise=g.stars===3?'Mistrzowskie tameshiwari!':g.broken>=c.n?'Cały stos rozbity!':g.stars?'Dobra robota!':g.broken?'Prawie! Jeszcze raz?':'Stos wytrzymał… tym razem!';
 const canNext=c.i<CH.length-1&&unlocked(c.i+1);
 root.classList.add('menu');els.tech.classList.add('off');const sc=els.scr;sc.hidden=false;
 sc.innerHTML=`<div class="gt-in gt-res">
  <div class="gt-top"><p class="gt-kick" style="margin:0">Wyzwanie ${c.i+1} · ${esc(chName(c))}</p><button class="gt-ib" data-a="exit" aria-label="Wyjdź">${XSVG}</button></div>
  <h2 class="gt-t" style="font-size:36px;margin-top:4px">${praise}</h2>
  <div class="gt-big">${g.broken}<small> / ${c.n}</small></div><p class="gt-sub">rozbitych</p>
  <div class="gt-stars">${[0,1,2].map(i=>STAR(i<g.stars)).join('')}</div>
  ${rec&&g.broken?'<span class="gt-rec">NOWY REKORD!</span>':''}
  ${newUnl?`<div class="gt-unl">Odblokowane: Wyzwanie ${c.i+2} – ${esc(chName(CH[c.i+1]))}!</div>`:''}
  <div class="gt-bars">
   <div class="gt-bar"><span>Kime</span><div><i style="width:${Math.round(g.power*100)}%"></i></div><b>${Math.round(g.power*100)}%</b></div>
   <div class="gt-bar"><span>Skupienie</span><div><i style="width:${Math.round(g.focus*100)}%"></i></div><b>${Math.round(g.focus*100)}%</b></div>
   <p class="gt-note" style="margin:4px 0 0"><b>${t.jp}</b> – ${t.pl}${tb>1?' · <b>+10%</b>':''}</p>
  </div>
  <p class="gt-note">Rozbitych łącznie: <b>${d.total}</b>${xp?` · <b>+${xp} XP</b>`:''}</p>
  <p class="gt-note">${coins?`Zdobywasz <b>+${coins} monet</b>!`:ct.got>=ct.max?'Dzisiejsze monety z tej gry już zebrane – wróć jutro!':`Monety dziś: jeszcze <b>${ct.max-ct.got}</b> (★, ★★★ i 20 rozbitych w ciągu dnia).`}</p>
  <div class="gt-btns">${canNext&&g.stars?`<button class="btn-p full bigbtn" data-a="go" data-i="${c.i+1}">Następne wyzwanie</button><button class="full bigbtn" data-a="go" data-i="${c.i}">Zagraj jeszcze raz</button>`:`<button class="btn-p full bigbtn" data-a="go" data-i="${c.i}">Zagraj jeszcze raz</button>`}
   <button class="full bigbtn" data-a="ladder">Drabina wyzwań</button></div></div>`;
 sc.scrollTop=0;
 if(g.stars)later(()=>{for(let i=0;i<g.stars;i++)later(()=>SFX.star(i),i*180)},150);
 if(g.stars===3||newUnl){try{DW().fanfare()}catch(e){}}
 if(c.legend&&g.stars&&!prevStars){try{DW().say('Legendarny stos rozbity! Jesteś mistrzynią tameshiwari. Osu!')}catch(e){}}
 else if(g.stars===3){try{DW().say('Perfekcyjnie! Osu!')}catch(e){}}
}

/* ---------- sterowanie ---------- */
function startLoop(){if(raf)return;lastT=performance.now();raf=requestAnimationFrame(loop)}
function stopLoop(){if(raf)cancelAnimationFrame(raf);raf=0}
function play(i){
 if(!unlocked(i))return;
 shakeOK=!reducedMotion();newAttempt(i);
 root.classList.remove('menu');els.scr.hidden=true;els.scr.innerHTML='';startLoop();
}
function pause(){if(!G||['menu','over','pause'].includes(G.state)||!raf)return;
 if(G.state==='charge'){chargeOff();G.state='ready';G.v=0;G.ptr=null}
 G.prev=G.state;G.state='pause';stopLoop();screenPause()}
function resume(){if(!G||G.state!=='pause')return;G.state=G.prev;if(G.state==='focus')G.t=0;els.scr.hidden=true;els.scr.innerHTML='';startLoop()}
function onClick(e){
 const tb=e.target.closest('[data-t]');if(tb&&G&&G.state==='ready'){G.tech=tb.dataset.t;techUI();SFX.tap();return}
 const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a==='go')play(+b.dataset.i);else if(a==='exit')close();else if(a==='pause')pause();else if(a==='resume')resume();
 else if(a==='ladder'){if(G)G.state='menu';chargeOff();screenLadder()}else if(a==='menu')screenStart();
 else if(a==='locked'){try{DW().toast('Najpierw zdobądź ★ w poprzednim wyzwaniu!')}catch(_){}}
}
function onVis(){if(document.hidden)pause()}
function onKey(e){if(e.key==='Escape'){if(G&&G.state==='pause')resume();else pause()}}

function open(){
 if(root)return;
 if(!document.getElementById('gt-css')){const st=document.createElement('style');st.id='gt-css';st.textContent=CSS;document.head.appendChild(st)}
 root=document.createElement('div');root.id='g-deski';root.className='menu';document.body.appendChild(root);
 const S=S_();playerImg=loadImg(S.look?`media/sklep/shop-${S.look}.webp`:'media/gra-postac.webp');
 const bg=bgUrl('dojo');bgCur=bg;
 root.innerHTML=`<div class="gt-bg" style="background-image:url('${bg}')"></div><canvas class="gt-cv"></canvas>
  <div class="gt-hud"><button class="gt-ib" data-a="pause" aria-label="Pauza">${PSVG}</button><div class="gt-ttl"><small></small><b></b></div><div class="gt-hst"></div></div>
  <div class="gt-tech"><div class="gt-tr"></div><div class="gt-tinfo"></div></div><div class="gt-scr" hidden></div>`;
 cv=root.querySelector('canvas');cx=cv.getContext('2d');
 els={ttlS:root.querySelector('.gt-ttl small'),ttlB:root.querySelector('.gt-ttl b'),hst:root.querySelector('.gt-hst'),tech:root.querySelector('.gt-tech'),techR:root.querySelector('.gt-tr'),tinfo:root.querySelector('.gt-tinfo'),scr:root.querySelector('.gt-scr')};
 document.documentElement.style.overflow='hidden';
 G=null;geo={};
 // wypełniamy pasek technik, żeby znać jego wysokość
 els.techR.innerHTML=TK.map(k=>`<button class="gt-tb"><b>${TECH[k].n}</b><span>${TECH[k].sh}</span></button>`).join('');els.tinfo.innerHTML='&nbsp;';
 resize();
 on(cv,'pointerdown',onDown);on(cv,'pointerup',onUp);on(cv,'pointercancel',onUp);
 on(root,'click',onClick);on(root,'contextmenu',e=>e.preventDefault());
 on(window,'resize',resize);on(document,'visibilitychange',onVis);on(document,'keydown',onKey);
 data();screenStart();
 try{DW().music(true)}catch(e){}
}
function close(){
 stopLoop();chargeOff();timers.forEach(clearTimeout);timers=[];
 listeners.forEach(([t,ev,fn,opt])=>t.removeEventListener(ev,fn,opt));listeners=[];
 live.forEach(n=>{try{n.o.stop();n.o2.stop()}catch(e){}});live=[];
 if(bus){try{bus.disconnect()}catch(e){}bus=null}
 if(root){root.remove();root=null}
 const st=document.getElementById('gt-css');if(st)st.remove();
 document.documentElement.style.overflow='';
 G=null;cv=null;cx=null;els={};geo={};vig=null;for(const k in SPR)delete SPR[k];
 try{DW().music(false)}catch(e){}
}
window.Games=window.Games||{};
window.Games.deski={open,close,get running(){return !!raf},_state:()=>G,_geo:()=>geo};
})();

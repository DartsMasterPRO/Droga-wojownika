/* Mistrzyni Kata – mini-gra pamięciowa dla „Droga wojownika”.
   Zwykły skrypt (IIFE). Publiczne API: window.Games.kata.open(), window.Games.kata.close().
   Korzysta z mostka window.DW (index.html). Postęp: DW.getS().games.kata.
   Sekwencje kata (Kyokushin): Kyokushin Budo Kai „Ultimate Beginners Guide” oraz opisy kata
   Jaapa Koomana (jaapkooman.nl) – patrz komentarze przy danych. */
(function(){
'use strict';

/* ---------- narzędzia ---------- */
const FONT="'Barlow Condensed','Arial Narrow',sans-serif";
const DW=()=>window.DW||{};
const S_=()=>{try{return DW().getS()||{}}catch(e){return {}}};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const easeOutBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const fmt=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const call=(f,...a)=>{try{const d=DW();return d[f]&&d[f](...a)}catch(e){}};

/* ---------- kierunki (0 = przód dojo / shōmen, zgodnie z ruchem wskazówek) ---------- */
const DV=[[0,-1],[.7071,-.7071],[1,0],[.7071,.7071],[0,1],[-.7071,.7071],[-1,0],[-.7071,-.7071]];
const DWORD=['do przodu','skos: przód-prawo','w prawo','skos: tył-prawo','do tyłu','skos: tył-lewo','w lewo','skos: przód-lewo'];

/* ---------- techniki i pozycje ---------- */
// [nazwa japońska, krótko po polsku, wymowa dla polskiego lektora]
const TECH={
 gedan:['Gedan barai','blok w dół','gedan baraj'],
 tc:['Oi tsuki chūdan','cios na brzuch','oj cuki czudan'],
 tj:['Oi tsuki jōdan','cios na głowę','oj cuki dżodan'],
 uchi:['Chūdan uchi uke','blok od środka','czudan uczi uke'],
 ju:['Jōdan uke','blok w górę','dżodan uke'],
 shuto:['Shutō mawashi uke','blok dłonią','szuto mawaszi uke'],
 tet:['Tettsui','młotek pięścią','tetsuj'],
 kamae:['Jōdan + uchi uke','podwójny blok','dżodan uke, uczi uke'],
 yoko:['Yoko geri + uraken','kopnięcie w bok','joko geri, uraken'],
 nuki:['Nukite','pchnięcie palcami','nukite'],
 mae:['Mae geri','kopnięcie przednie','mae geri'],
 gyaku:['Gyaku tsuki','cios ręką z tyłu','gjaku cuki'],
 morote:['Morote uke','blok dwiema rękami','morote uke']
};
const STANCE={
 zen:['Zenkutsu dachi','pozycja wypadu'],
 ko:['Kōkutsu dachi','ciężar na tylnej nodze'],
 kiba:['Kiba dachi','pozycja jeźdźca'],
 neko:['Neko ashi dachi','pozycja kota'],
 tsuru:['Tsuru ashi dachi','pozycja żurawia, na jednej nodze']
};

/* ---------- kata ----------
   Ruch: [kierunek 0–7, x, y, krok?(1/0), technika, pozycja, kiai?, nazwa dokładna, opis, obrót 270°?]
   Embusen rysujemy schematycznie: start (0,0), przód dojo = w górę ekranu. */
// Taikyoku (kształt H, 20 ruchów). Obroty na końcu „pnia” – 270° w lewo (wg Kyokushin guide / Kooman).
const TK=[[6,-1,0],[6,-2,0],[2,1,0],[2,2,0],[0,0,-1],[0,0,-2],[0,0,-3],[0,0,-4],[2,1,-4],[2,2,-4],[6,-1,-4],[6,-2,-4],[4,0,-3],[4,0,-2],[4,0,-1],[4,0,0],[6,-1,0],[6,-2,0],[2,1,0],[2,2,0]];
const TK_SIDE=[0,2,8,10,16,18],TK_STEM=[4,12];
function taikyoku(f){return TK.map((p,i)=>{const r=f(i);return [p[0],p[1],p[2],1,r[0],r[1],(i===7||i===15)?1:0,0,0,(i===8||i===16)?1:0]})}
const KDEF=[
 {id:'t1',n:'Taikyoku Sono Ichi',sub:'Gedan barai i oi tsuki chūdan',bg:'mata',set:['gedan','tc','tj'],
  mv:taikyoku(i=>TK_SIDE.includes(i)||TK_STEM.includes(i)?['gedan','zen']:['tc','zen'])},
 {id:'t2',n:'Taikyoku Sono Ni',sub:'Jak Sono Ichi, ale ciosy na głowę',bg:'ogrod',set:['gedan','tc','tj'],
  mv:taikyoku(i=>TK_SIDE.includes(i)||TK_STEM.includes(i)?['gedan','zen']:['tj','zen'])},
 {id:'t3',n:'Taikyoku Sono San',sub:'Uchi uke w kōkutsu dachi',bg:'bambus',set:['gedan','uchi','tc','tj'],
  mv:taikyoku(i=>TK_SIDE.includes(i)?['uchi','ko']:TK_STEM.includes(i)?['gedan','zen']:[4,12].some(s=>i>s&&i<s+4)?['tj','zen']:['tc','zen'])},
 // Pinan Sono Ichi (Kyokushin) = wzór Heian Shodan: Kyokushin guide + Kooman, „Pinan sono Ichi”.
 {id:'p1',n:'Pinan Sono Ichi',sub:'Jōdan uke, tettsui, shutō mawashi uke',bg:'gory',set:['gedan','tc','tet','ju','shuto'],
  mv:[
   [6,-1,0,1,'gedan','zen'],[6,-2,0,1,'tc','zen'],
   [2,1,0,1,'gedan','zen'],[2,1,0,0,'tet','neko',0,'Tettsui komi kami uchi','„młotkiem” pięści w skroń'],[2,2,0,1,'tc','zen'],
   [0,0,-1,1,'gedan','zen'],[0,0,-2,1,'ju','zen'],[0,0,-3,1,'ju','zen'],[0,0,-4,1,'ju','zen',1],
   [2,1,-4,1,'gedan','zen',0,0,0,1],[2,2,-4,1,'tc','zen'],[6,-1,-4,1,'gedan','zen'],[6,-2,-4,1,'tc','zen'],
   [4,0,-3,1,'gedan','zen'],[4,0,-2,1,'tc','zen'],[4,0,-1,1,'tc','zen'],[4,0,0,1,'tc','zen',1],
   [6,-1,0,1,'shuto','ko',0,0,0,1],[7,-1.7,-.7,1,'shuto','ko'],[2,1,0,1,'shuto','ko'],[1,1.7,-.7,1,'shuto','ko']]},
 // Pinan Sono Ni (Kyokushin) = wzór Heian Nidan: Kooman, „Pinan sono Ni”; uproszczone do jednej techniki na ruch.
 {id:'p2',n:'Pinan Sono Ni',sub:'Kopnięcia, nukite i dużo bloków',bg:'swiatynia',set:['kamae','tet','yoko','shuto','nuki','uchi','mae','gyaku','morote','gedan','ju'],
  mv:[
   [6,-1,0,1,'kamae','ko'],[6,-1,0,0,'tet','ko',0,'Tettsui hizo uchi','„młotkiem” pięści w bok'],[6,-1.5,0,1,'tet','kiba',0,'Tettsui jōdan yoko uchi','„młotkiem” pięści w bok, na głowę'],
   [2,1,0,1,'kamae','ko'],[2,1,0,0,'tet','ko',0,'Tettsui hizo uchi','„młotkiem” pięści w bok'],[2,1.5,0,1,'tet','kiba',0,'Tettsui jōdan yoko uchi','„młotkiem” pięści w bok, na głowę'],
   [2,1.5,0,0,'yoko','tsuru',0,'Yoko geri + uraken','kopnięcie w bok i cios grzbietem pięści – w prawo'],
   [0,0,-1,1,'shuto','ko'],[0,0,-2,1,'shuto','ko'],[0,0,-3,1,'shuto','ko'],[0,0,-4,1,'nuki','zen',1,'Yonhon nukite','pchnięcie czterema palcami (z blokiem osae uke)'],
   [2,1,-4,1,'shuto','ko',0,0,0,1],[3,1.7,-3.3,1,'shuto','ko'],[6,-1,-4,1,'shuto','ko'],[5,-1.7,-3.3,1,'shuto','ko'],
   [4,0,-3,1,'uchi','zen',0,'Haitō uke → uchi uke','blok grzbietem dłoni, potem powoli uchi uke'],[4,0,-3,0,'mae','zen'],[4,0,-2,1,'gyaku','zen'],
   [4,0,-2,0,'uchi','zen',0,'Uchi uke (powoli)','powolny blok od środka'],[4,0,-2,0,'mae','zen'],[4,0,-1,1,'gyaku','zen'],[4,0,0,1,'morote','zen',0,'Morote chūdan uke','blok wzmocniony drugą ręką'],
   [6,-1,0,1,'gedan','zen',0,0,0,1],[6,-1,0,0,'nuki','zen',0,'Nihon nukite jōdan','pchnięcie dwoma palcami, na skos'],[7,-1.7,-.7,1,'ju','zen'],
   [2,1,0,1,'gedan','zen'],[2,1,0,0,'nuki','zen',0,'Nihon nukite jōdan','pchnięcie dwoma palcami, na skos'],[1,1.7,-.7,1,'ju','zen',1]]}
];
const KATA=KDEF.map(k=>{
 let px=0,py=0,ph=0;const mv=k.mv.map((a,i)=>{
  const m={i,d:a[0],x:a[1],y:a[2],mv:!!a[3],t:a[4],s:a[5],k:!!a[6],n:a[7]||TECH[a[4]][0],p:a[8]||TECH[a[4]][1],t270:!!a[9],from:[px,py],h0:ph};
  const dv=DV[m.d],vx=m.x-px,vy=m.y-py;
  if(!m.mv)m.pts=[[px,py],[m.x,m.y]];
  else if(Math.abs(vx*dv[1]-vy*dv[0])<.05&&(vx*dv[0]+vy*dv[1])>0)m.pts=[[px,py],[m.x,m.y]];
  else m.pts=[[px,py],[m.x-dv[0],m.y-dv[1]],[m.x,m.y]];
  // opis obrotu
  const df=(m.d-ph+8)%8;
  m.turn=!m.mv?'w miejscu':m.t270?'obrót w lewo o 270°':df===0?'krok do przodu':df===2?'obrót w prawo o 90°':df===6?'obrót w lewo o 90°':df===4?'obrót o 180°':df===1||df===7?(m.d%2?'krok na skos (45°)':'obrót o 45°'):df===3?'obrót w prawo o 135°':'obrót w lewo o 135°';
  // kąt obrotu postaci (stopnie, + = zgodnie z ruchem wskazówek)
  let dd=((m.d-ph)*45+540)%360-180;if(m.t270)dd=-270;else if(df===4)dd=180;m.dh=dd;
  px=m.x;py=m.y;ph=m.d;return m});
 const nk=mv.filter(m=>m.k).length;
 // serie: 2,3,4,5,5… (resztę 1 dopisujemy do ostatniej)
 const ch=[];let a=0,sz=2;while(a<mv.length){let b=Math.min(mv.length,a+sz);if(mv.length-b===1)b++;ch.push([a,b]);a=b;sz=Math.min(5,sz+1)}
 return {...k,mv,nk,chunks:ch};
});

/* ---------- ikony (SVG) ---------- */
const FIG='<circle cx="13" cy="12" r="5" fill="#8b93a1"/><path d="M8 19h10l-1.5 15h-7z" fill="#8b93a1"/><path d="M11 33l-3 12M15.5 33l3 12" stroke="#8b93a1" stroke-width="3.2" stroke-linecap="round"/>';
const ICO={
 gedan:'<path d="M17 21Q34 22 37 39" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M31 37l6 4 3-7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
 tc:'<path d="M18 25h19" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><circle cx="40" cy="25" r="5" fill="currentColor"/>',
 tj:'<path d="M18 13h19" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><circle cx="40" cy="13" r="5" fill="currentColor"/>',
 uchi:'<path d="M27 33V17" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M31 13q9 5 7 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M34 27l4 4 3-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
 ju:'<path d="M5 4h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M18 21L26 6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M36 14V4m-4 4l4-4 4 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
 shuto:'<path d="M20 24l15-8 3 4-15 8z" fill="currentColor"/><path d="M41 28a9 9 0 1 1-6-14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
 tet:'<path d="M20 12q16-6 18 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M34 21l4 4 4-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="32" y="27" width="10" height="9" rx="3" fill="currentColor"/>',
 kamae:'<path d="M5 4h22" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M31 34V18" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
 yoko:'<path d="M15 32h28" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="33" cy="12" r="4.5" fill="currentColor"/><path d="M18 18l12-5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
 nuki:'<path d="M18 25h12" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M29 21h9l6 4-6 4h-9z" fill="currentColor"/>',
 mae:'<path d="M15 32l9-7 18-5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
 gyaku:'<path d="M18 24h18" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><circle cx="39" cy="24" r="5" fill="currentColor"/><path d="M5 37a8 3.5 0 0 0 16 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M19 34l2 3-3 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
 morote:'<path d="M27 33V16" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M36 33l-7-7" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="37" cy="34" r="3.5" fill="currentColor"/>'
};
const ico=(id,s=30)=>`<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true">${FIG}${ICO[id]||''}</svg>`;
const arrowSvg=(d,s=30)=>`<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><g transform="rotate(${d*45} 24 24)"><path d="M24 5l14 16h-8v20H18V21h-8z" fill="currentColor"/></g></svg>`;
const DOTSVG=s=>`<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="24" cy="24" r="4" fill="currentColor"/></svg>`;
const HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" fill="#e2452b" stroke="#ff9c8c" stroke-width="1"/></svg>';
const STAR=(on,s=22)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill="${on?'#f2c14e':'#323846'}" stroke="${on?'#ffe08a':'#454c5c'}" stroke-width="1"/></svg>`;
const LOCK='<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
const XSVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const PLAY='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
const PREV='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4L7 12l11 8zM4 4h3v16H4z"/></svg>';
const NEXT='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l11 8-11 8zM17 4h3v16h-3z"/></svg>';
const REPLAY='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/></svg>';
function embusenSvg(k,s){
 const pts=[];k.mv.forEach(m=>m.pts.forEach(p=>pts.push(p)));
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;pts.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)});
 const u=(s-12)/Math.max(x1-x0,y1-y0,1),ox=s/2-(x0+x1)/2*u,oy=s/2-(y0+y1)/2*u;
 const d=k.mv.map(m=>m.pts.map((p,i)=>(i?'L':'M')+(ox+p[0]*u).toFixed(1)+' '+(oy+p[1]*u).toFixed(1)).join('')).join('');
 const kd=k.mv.filter(m=>m.k).map(m=>`<circle cx="${(ox+m.x*u).toFixed(1)}" cy="${(oy+m.y*u).toFixed(1)}" r="3" fill="#e2452b"/>`).join('');
 return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true"><path d="${d}" fill="none" stroke="#f2c14e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>${kd}<circle cx="${ox}" cy="${oy}" r="3.4" fill="#fff"/></svg>`;
}

/* ---------- dźwięk ---------- */
let noiseBuf=null;
function ac(){if(S_().mute)return null;try{return DW().actx()}catch(e){return null}}
function noise(a){if(noiseBuf&&noiseBuf.sampleRate===a.sampleRate)return noiseBuf;const n=a.sampleRate*.5,b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return noiseBuf=b}
function nz(a,t,dur,type,f0,f1,vol){const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noise(a);f.type=type;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f);f.connect(g);g.connect(a.destination);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t,Math.random()*.3);s.stop(t+dur+.02)}
function tone(a,t,type,f0,f1,dur,vol){const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.02)}
const PENTA=[523,587,659,784,880,1047,1175,1319];
const SFX={
 step(){const a=ac();if(!a)return;nz(a,a.currentTime,.16,'bandpass',500,1800,.16)},
 tech(n){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',160,55,.15,.55);nz(a,t,.06,'lowpass',1600,400,.35);tone(a,t+.02,'triangle',PENTA[(n||0)%PENTA.length],0,.16,.12)},
 ok(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sine',1319,0,.18,.08);tone(a,t+.05,'sine',1760,0,.22,.07)},
 kiai(){const a=ac();if(!a)return;const t=a.currentTime;nz(a,t,.3,'bandpass',900,300,.5);tone(a,t,'sawtooth',320,160,.25,.12);tone(a,t,'sine',110,45,.35,.8)},
 wrong(){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'sawtooth',220,140,.2,.09);tone(a,t+.12,'sawtooth',180,110,.22,.08)},
 slip(){const a=ac();if(!a)return;tone(a,a.currentTime,'triangle',420,300,.12,.08)},
 star(i){const a=ac();if(!a)return;const t=a.currentTime;tone(a,t,'triangle',[880,1175,1568][i]||1568,0,.35,.16);tone(a,t+.03,'sine',[1760,2349,3136][i]||3136,0,.3,.05)}
};
const buzz=p=>{if(S_().mute)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
function say(t){call('say',t)}
function hush(){try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}}

/* ---------- CSS ---------- */
const CSS=`
#g-kata{position:fixed;inset:0;z-index:9000;background:#07090d;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;color:#f1f2f4;font:16px/1.4 Barlow,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
#g-kata [hidden]{display:none!important}
#g-kata .gm-bg{position:absolute;inset:0;background:#07090d center/cover no-repeat;transform:scale(1.04);transition:opacity .6s}
#g-kata .gm-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,9,13,.82),rgba(7,9,13,.5) 22%,rgba(7,9,13,.55) 62%,rgba(7,9,13,.93) 80%)}
#g-kata canvas.gm-fl{position:absolute;display:block;pointer-events:none}
#g-kata.gm-menu canvas.gm-fl{visibility:hidden}
#g-kata canvas.gm-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#g-kata button{font:inherit;min-height:44px;border-radius:12px;border:1px solid #252a36;background:#171b24;color:#f1f2f4;padding:0 14px;cursor:pointer;-webkit-tap-highlight-color:transparent}
#g-kata button:active{transform:scale(.97)}
#g-kata .gm-hud{position:absolute;left:0;right:0;top:0;padding:calc(8px + env(safe-area-inset-top)) 12px 0;display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center}
#g-kata.gm-menu .gm-hud,#g-kata.gm-menu .gm-bot{visibility:hidden}
#g-kata .gm-ib{width:44px;height:44px;min-height:0;padding:0;border-radius:50%;background:rgba(17,20,27,.78);border:1px solid rgba(255,255,255,.14);display:grid;place-items:center;color:#f1f2f4}
#g-kata .gm-ttl{min-width:0}
#g-kata .gm-ttl b{display:block;font:italic 800 21px/1.05 ${FONT};color:#ffe08a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 0 rgba(0,0,0,.5)}
#g-kata .gm-ttl span{display:block;font:600 14px/1.2 ${FONT};color:#c9ced6;letter-spacing:.3px}
#g-kata .gm-bar{height:6px;border-radius:9px;background:rgba(255,255,255,.12);margin-top:4px;overflow:hidden}
#g-kata .gm-bar i{display:block;height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#f2c14e,#ffe08a);transition:width .3s}
#g-kata .gm-hearts{display:flex;gap:2px}
#g-kata .gm-hearts svg{width:27px;height:27px;display:block;transition:opacity .3s,filter .3s}
#g-kata .gm-hearts svg.gm-dim{opacity:.22;filter:grayscale(1)}
#g-kata .gm-hearts svg.gm-lose{animation:gm-lose .7s}
#g-kata .gm-hearts.gm-hid{visibility:hidden}
@keyframes gm-lose{0%{transform:scale(1)}30%{transform:scale(1.5) rotate(-12deg)}60%{transform:scale(.8) rotate(8deg)}100%{transform:scale(1)}}
#g-kata .gm-bot{position:absolute;left:0;right:0;bottom:0;padding:0 10px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;max-width:520px;margin:0 auto}
#g-kata .gm-cap{background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:16px;padding:6px 10px;display:flex;gap:10px;align-items:center;height:72px;box-sizing:border-box;overflow:hidden}
#g-kata .gm-cap .tx>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#g-kata .gm-cap .ic{flex:none;width:48px;height:48px;border-radius:12px;background:rgba(242,193,78,.12);display:grid;place-items:center;color:#f2c14e}
#g-kata .gm-cap .ic.gm-me{background:none;overflow:hidden}
#g-kata .gm-cap .ic.gm-me img{height:52px;width:auto;margin-top:6px}
#g-kata .gm-cap .tx{flex:1;min-width:0}
#g-kata .gm-cap .jp{font:italic 800 22px/1.05 ${FONT};color:#ffe08a;letter-spacing:.2px}
#g-kata .gm-cap .jp em{font-style:normal;font-size:14px;color:#fff;background:#e2452b;border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:3px;letter-spacing:.5px}
#g-kata .gm-cap .pl{font-size:14.5px;color:#e6e8ec;line-height:1.25}
#g-kata .gm-cap .gm-st{font-size:12.5px;color:#9aa2af;line-height:1.25;margin-top:1px}
#g-kata .gm-cap .dir{flex:none;width:58px;text-align:center;color:#ffe08a;font:600 12px/1.1 ${FONT}}
#g-kata .gm-cap .dir svg{display:block;margin:0 auto 2px}
#g-kata .gm-cap .rp{flex:none;min-height:44px;padding:0 10px;display:flex;align-items:center;gap:5px;font:700 15px/1 ${FONT};color:#ffe08a;background:rgba(242,193,78,.1);border-color:rgba(242,193,78,.4)}
#g-kata .gm-cap.gm-bad{border-color:#e2452b;box-shadow:0 0 0 1px rgba(226,69,43,.6)}
#g-kata .gm-cap.gm-good{border-color:#2fb36a}
#g-kata .gm-hint{text-align:center;font-size:14px;color:#c9ced6;min-height:19px;line-height:19px;margin:-2px 0 -2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#g-kata .gm-hint.gm-warn{color:#ffb4a6}
#g-kata .gm-grid{display:grid;gap:7px;grid-template-columns:repeat(var(--c,3),1fr)}
#g-kata .gm-t{height:60px;min-height:0!important;padding:4px 6px;overflow:hidden;border-radius:14px;background:rgba(23,27,36,.96);border:1px solid #2f3543;display:flex;align-items:center;gap:5px;text-align:left;color:#f1f2f4;min-width:0;transition:background .15s,border-color .15s,box-shadow .15s,opacity .2s}
#g-kata .gm-t svg{flex:none;color:#f2c14e}
#g-kata .gm-grid.gm-dense .gm-t svg{display:none}
#g-kata .gm-grid.gm-dense .gm-t{padding:4px 8px}
#g-kata .gm-grid.gm-dense .gm-t b{font-size:15px}
#g-kata .gm-t span{min-width:0}
#g-kata .gm-t b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:700 16px/1 ${FONT};letter-spacing:.1px}
#g-kata .gm-t small{display:block;font-size:11.5px;color:#9aa2af;line-height:1.15;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#g-kata .gm-t.gm-hl,#g-kata .gm-kiai.gm-hl{border-color:#f2c14e;box-shadow:0 0 0 2px rgba(242,193,78,.55),0 0 20px rgba(242,193,78,.35);opacity:1!important}
#g-kata .gm-t.gm-ok{background:#1d5236;border-color:#2fb36a}
#g-kata .gm-t.gm-bad{background:#5e1f17;border-color:#e2452b;animation:gm-shk .35s}
@keyframes gm-shk{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
#g-kata .gm-kiai{min-height:50px;border-radius:14px;background:linear-gradient(180deg,#ff6a4d,#c9301c);border:1px solid #ff8a6e;color:#fff;font:italic 800 25px/1 ${FONT};letter-spacing:1.5px;text-shadow:0 2px 0 rgba(0,0,0,.3);transition:opacity .2s,box-shadow .15s}
#g-kata .gm-kiai small{font:600 13px/1 Barlow,sans-serif;letter-spacing:0;opacity:.85;margin-left:8px;font-style:normal}
#g-kata .gm-off .gm-t,#g-kata .gm-off .gm-kiai{opacity:.42;pointer-events:none}
#g-kata .gm-nav{display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:8px}
#g-kata .gm-nav button{min-height:50px;display:flex;align-items:center;justify-content:center;gap:6px;font:700 17px/1 ${FONT}}
#g-kata .gm-nav .gm-on{background:linear-gradient(180deg,#ffe08a,#f2c14e);color:#1a1405;border-color:#f2c14e}
#g-kata .gm-scr{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:rgba(7,9,13,.84);backdrop-filter:blur(3px)}
#g-kata .gm-scr[hidden]{display:none}
#g-kata .gm-in{max-width:460px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) 16px calc(22px + env(safe-area-inset-bottom));min-height:100%;box-sizing:border-box;display:flex;flex-direction:column}
#g-kata .gm-top{display:flex;align-items:flex-start;gap:10px}
#g-kata .gm-top>div{flex:1;min-width:0}
#g-kata .gm-kick{color:#f2c14e;font-weight:600;font-size:14px;margin:0 0 2px;letter-spacing:.4px;text-transform:uppercase}
#g-kata h2.gm-h{font:italic 800 44px/.95 ${FONT};margin:0;color:#ffe08a;text-shadow:0 3px 0 rgba(0,0,0,.5);letter-spacing:.5px}
#g-kata .gm-hero{position:relative;height:128px;margin:6px 0 8px;display:flex;justify-content:center;align-items:flex-end}
#g-kata .gm-hero::before{content:'';position:absolute;left:50%;bottom:2px;width:190px;height:24px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(242,193,78,.45),transparent)}
#g-kata .gm-hero img{position:relative;height:128px;width:auto;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6))}
#g-kata .gm-best{display:flex;gap:8px;margin:0 0 12px}
#g-kata .gm-best>div{flex:1;background:rgba(17,20,27,.88);border:1px solid #252a36;border-radius:14px;padding:8px 6px;text-align:center}
#g-kata .gm-best b{display:block;font:800 26px/1.1 ${FONT};color:#f2c14e}
#g-kata .gm-best span{font-size:12.5px;color:#9aa2af;line-height:1.2;display:block}
#g-kata .gm-how{background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:16px;padding:4px 12px;margin:0 0 12px}
#g-kata .gm-how summary{font:700 20px/1.1 ${FONT};padding:9px 0;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}
#g-kata .gm-how summary::-webkit-details-marker{display:none}
#g-kata .gm-how summary::after{content:'+';color:#f2c14e;font-size:24px}
#g-kata .gm-how[open] summary::after{content:'–'}
#g-kata .gm-row{display:flex;align-items:center;gap:12px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)}
#g-kata .gm-row>i{flex:none;width:40px;height:40px;border-radius:12px;background:rgba(242,193,78,.12);display:grid;place-items:center;color:#f2c14e;font:italic 800 15px ${FONT}}
#g-kata .gm-row>i.gm-ki{background:#c9301c;color:#fff}
#g-kata .gm-row p{margin:0;font-size:15px;line-height:1.3}
#g-kata .gm-row p small{display:block;color:#9aa2af;font-size:13px}
#g-kata .gm-list{display:grid;gap:10px;margin:0 0 6px}
#g-kata .gm-k{background:rgba(17,20,27,.92);border:1px solid #252a36;border-radius:16px;padding:10px;display:grid;grid-template-columns:62px 1fr;gap:4px 12px;align-items:center}
#g-kata .gm-k.gm-lock{opacity:.8}
#g-kata .gm-k .th{grid-row:span 2;width:62px;height:62px;border-radius:12px;background:#0b0e14;display:grid;place-items:center;border:1px solid #1f2430}
#g-kata .gm-k h3{margin:0;font:700 21px/1.05 ${FONT}}
#g-kata .gm-k .meta{font-size:13px;color:#9aa2af;line-height:1.25}
#g-kata .gm-k .meta .gm-s{display:inline-flex;vertical-align:-4px;margin-right:6px}
#g-kata .gm-k .act{grid-column:1/-1;display:grid;grid-template-columns:1.4fr 1fr;gap:8px;margin-top:6px}
#g-kata .gm-k .act button{min-height:46px;font:700 18px/1 ${FONT};display:flex;align-items:center;justify-content:center;gap:6px}
#g-kata .gm-k .act button:disabled{opacity:.55;cursor:default}
#g-kata .gm-gold{background:linear-gradient(180deg,#ffe08a,#f2c14e)!important;border-color:#f2c14e!important;color:#1a1405!important;font-weight:700;box-shadow:0 6px 22px rgba(242,193,78,.25),inset 0 1px 0 rgba(255,255,255,.55)}
#g-kata .gm-big{min-height:56px!important;font:700 20px/1 ${FONT}!important;width:100%}
#g-kata .gm-note{font-size:13px;color:#9aa2af;text-align:center;margin:6px 0 0}
#g-kata .gm-btns{display:grid;gap:10px;margin-top:auto;padding-top:14px}
#g-kata .gm-res{text-align:center}
#g-kata .gm-bow{position:relative;height:170px;display:flex;justify-content:center;align-items:flex-end;margin:6px 0 0}
#g-kata .gm-bow::before{content:'';position:absolute;left:50%;bottom:0;width:200px;height:26px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(242,193,78,.5),transparent)}
#g-kata .gm-bow img{position:relative;height:166px;width:auto;transform-origin:50% 96%;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6))}
#g-kata .gm-bow.gm-go img{animation:gm-rei 2.6s ease-in-out .35s both}
#g-kata .gm-bow b{position:absolute;right:12%;top:18px;font:italic 800 26px/1 ${FONT};color:#ffe08a;opacity:0}
#g-kata .gm-bow.gm-go b{animation:gm-reit 2.6s ease-in-out .35s both}
@keyframes gm-rei{0%{transform:none}30%,62%{transform:perspective(520px) rotateX(30deg) rotate(7deg) scaleY(.9) translateY(4px)}100%{transform:none}}
@keyframes gm-reit{0%,15%{opacity:0;transform:translateY(6px)}30%,62%{opacity:1;transform:none}85%,100%{opacity:0}}
#g-kata .gm-stars{display:flex;justify-content:center;gap:6px;margin:6px 0 2px}
#g-kata .gm-stars svg{animation:gm-pop .55s cubic-bezier(.3,1.7,.5,1) both}
@keyframes gm-pop{0%{transform:scale(0) rotate(-40deg);opacity:0}100%{transform:none;opacity:1}}
#g-kata .gm-score{font:italic 800 64px/1 ${FONT};color:#ffe08a;text-shadow:0 4px 0 rgba(0,0,0,.45),0 0 30px rgba(242,193,78,.35);margin:2px 0}
#g-kata .gm-rec{display:inline-block;background:linear-gradient(180deg,#ffe08a,#f2c14e);color:#1a1405;font:800 18px/1 ${FONT};padding:6px 14px;border-radius:99px;letter-spacing:.5px}
#g-kata .gm-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
#g-kata .gm-grid3>div{background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:14px;padding:8px 4px}
#g-kata .gm-grid3 b{display:block;font:800 25px/1.1 ${FONT}}
#g-kata .gm-grid3 span{font-size:12.5px;color:#9aa2af;line-height:1.2;display:block}
#g-kata .gm-coins{margin:0 0 4px;font-size:15px;color:#c9ced6}
#g-kata .gm-coins b{color:#f2c14e}
#g-kata .gm-tip{background:rgba(17,20,27,.9);border:1px solid #252a36;border-radius:14px;padding:10px 12px;margin:0 0 12px;font-size:14.5px;line-height:1.35;text-align:left}
#g-kata .gm-tip b{color:#ffe08a}
#g-kata .gm-pause{display:flex;flex-direction:column;justify-content:center;gap:12px;min-height:100%;max-width:340px;margin:0 auto;padding:24px;box-sizing:border-box}
#g-kata .gm-pause h2{text-align:center;font:italic 800 48px/1 ${FONT};color:#ffe08a;margin:0 0 10px}
@media (max-height:700px){#g-kata .gm-t{height:54px}#g-kata .gm-t small{display:none}#g-kata .gm-kiai{min-height:44px}#g-kata .gm-cap{height:64px}#g-kata .gm-cap .jp{font-size:20px}#g-kata .gm-cap .gm-st{display:none}#g-kata .gm-bot{gap:6px}}
@media (prefers-reduced-motion:reduce){#g-kata .gm-bow.gm-go img,#g-kata .gm-stars svg{animation-duration:.01s}}
`;

/* ---------- stan ---------- */
let root=null,cv=null,cx=null,els={},raf=0,lastT=0,W=0,H=0,DPR=1,listeners=[],G=null,F={x:0,y:0,w:0,h:0},MAP={u:60,ox:0,oy:0},floorC=null,floorKey='';
let playerImg=null,shakeOK=true;
function on(t,ev,fn,opt){t.addEventListener(ev,fn,opt);listeners.push([t,ev,fn,opt])}
const DEMO_T=1.35,TRAIN_T=3.2;

function data(){const S=S_();S.games=S.games||{};const d=S.games.kata=S.games.kata||{};d.lv=d.lv||{};d.plays=d.plays||0;d.train=d.train||0;return d}
function unlocked(i){if(i===0)return true;const r=data().lv[KATA[i-1].id];return !!(r&&r.s>=1)}
function coinsToday(){const S=S_();let d='';try{d=DW().today()}catch(e){}const p=S.paid||{};let got=0;for(let i=0;i<3;i++)if(p['gm'+d+'-'+i])got+=5;return {got,max:15}}
function lookSrc(){const S=S_();return S.look?`media/sklep/shop-${S.look}.webp`:'media/gra-postac.webp'}

/* ---------- nowa gra ---------- */
function newGame(ki,mode){
 const k=KATA[ki];
 return {ki,k,mode,state:'count',now:0,q:[],hearts:3,score:0,errs:0,soft:0,kiaiOk:0,kiaiMiss:0,kiaiWrong:0,replays:0,
  ci:0,mi:0,done:0,moveDone:false,moveErr:false,moveSoft:false,moveT0:0,times:[],pendK:null,
  mk:{x:0,y:0,h:0,anim:null,tech:null},ghost:[],reveal:null,demoArrow:null,parts:[],texts:[],rings:[],banner:null,shake:0,flash:0,flashC:'255,255,255',
  opts:null,ti:-1,auto:true,trainEnd:false,count:null,hl:null};
}
function later(s,fn){G.q.push({at:G.now+s,fn})}

/* ---------- geometria ---------- */
function bbox(k){let x0=0,x1=0,y0=0,y1=0;k.mv.forEach(m=>m.pts.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}));return {x0,x1,y0,y1}}
function layout(){
 if(!root)return;
 DPR=Math.min(2,window.devicePixelRatio||1);
 W=root.clientWidth;H=root.clientHeight;
 if(cv.width!==Math.round(W*DPR)||cv.height!==Math.round(H*DPR)){cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR)}
 const hb=els.hud.getBoundingClientRect().bottom,bt=els.bot.getBoundingClientRect().top;
 const pad=10;F={x:pad,y:hb+8,w:W-pad*2,h:Math.max(120,bt-hb-16)};
 if(G&&G.k){const b=bbox(G.k),m=.75,bw=b.x1-b.x0+m*2,bh=b.y1-b.y0+m*2,top=26;
  const u=Math.min((F.w-12)/bw,(F.h-top-12)/bh,104);
  MAP.u=u;MAP.ox=F.x+F.w/2-(b.x0+b.x1)/2*u;MAP.oy=F.y+top+(F.h-top)/2-(b.y0+b.y1)/2*u}
 buildFloor();
 if(G&&!raf)draw();
}
const mx=x=>MAP.ox+x*MAP.u,my=y=>MAP.oy+y*MAP.u;
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
function buildFloor(){
 const fl=els.fl;if(fl){fl.style.left=F.x+'px';fl.style.top=F.y+'px';fl.style.width=F.w+'px';fl.style.height=F.h+'px'}
 const key=[F.w,F.h,DPR].join('|');if(key===floorKey&&floorC)return;floorKey=key;
 const c=fl||document.createElement('canvas');c.width=Math.max(1,Math.round(F.w*DPR));c.height=Math.max(1,Math.round(F.h*DPR));const x=c.getContext('2d');x.scale(DPR,DPR);
 const w=F.w,h=F.h,r=18;
 x.save();rr(x,0,0,w,h,r);x.clip();
 // deski (widok z góry)
 const bw=clamp(w/9,30,52);let seed=7;const R=()=>(seed=(seed*9301+49297)%233280)/233280;
 for(let i=0,bx=0;bx<w;i++,bx+=bw){
  let by=-R()*120;
  while(by<h){const len=rnd(140,260)+R()*40,tnt=Math.round(R()*18-9);
   const base=[118+tnt,82+tnt*.8,50+tnt*.5];
   const g=x.createLinearGradient(bx,0,bx+bw,0);g.addColorStop(0,`rgb(${base[0]+8},${base[1]+6},${base[2]+4})`);g.addColorStop(.5,`rgb(${base[0]},${base[1]},${base[2]})`);g.addColorStop(1,`rgb(${base[0]-10},${base[1]-8},${base[2]-6})`);
   x.fillStyle=g;x.fillRect(bx,by,bw,len);
   x.strokeStyle='rgba(60,35,15,.25)';x.lineWidth=1;
   for(let j=0;j<3;j++){const lx=bx+bw*(.2+.3*j)+R()*4;x.beginPath();x.moveTo(lx,by+4);x.bezierCurveTo(lx+3,by+len*.3,lx-3,by+len*.6,lx+1,by+len-4);x.stroke()}
   x.fillStyle='rgba(30,16,6,.55)';x.fillRect(bx,by+len-1,bw,2);by+=len}
  x.fillStyle='rgba(30,16,6,.6)';x.fillRect(bx+bw-1,0,2,h)}
 // światło i winieta
 let g=x.createRadialGradient(w/2,h*.4,10,w/2,h*.5,Math.max(w,h)*.75);g.addColorStop(0,'rgba(255,230,180,.16)');g.addColorStop(.6,'rgba(0,0,0,.05)');g.addColorStop(1,'rgba(0,0,0,.5)');x.fillStyle=g;x.fillRect(0,0,w,h);
 x.fillStyle='rgba(7,9,13,.18)';x.fillRect(0,0,w,h);
 // pas shōmen
 g=x.createLinearGradient(0,0,0,30);g.addColorStop(0,'rgba(7,9,13,.65)');g.addColorStop(1,'rgba(7,9,13,0)');x.fillStyle=g;x.fillRect(0,0,w,30);
 x.restore();
 x.strokeStyle='rgba(242,193,78,.35)';x.lineWidth=2;rr(x,1,1,w-2,h-2,r);x.stroke();
 // shōmen: mały daszek kamidany + napis
 x.fillStyle='#f2c14e';x.globalAlpha=.85;const cxm=w/2;
 x.beginPath();x.moveTo(cxm-62,15);x.lineTo(cxm-52,9);x.lineTo(cxm-38,9);x.lineTo(cxm-28,15);x.closePath();x.fill();x.fillRect(cxm-51,15,3,6);x.fillRect(cxm-42,15,3,6);
 x.font=`700 13px ${FONT}`;x.textAlign='left';x.textBaseline='middle';x.fillText('SHŌMEN · PRZÓD DOJO',cxm-22,14);x.globalAlpha=1;
 floorC=c;
}

/* ---------- efekty ---------- */
function burst(px,py,col,n,sp){if(G.parts.length>200)G.parts.splice(0,G.parts.length-200);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rnd(.3,1)*sp;G.parts.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.35,.75),age:0,s:rnd(2.5,6),c:col})}}
function ring(px,py,r0,col,life){G.rings.push({x:px,y:py,r0,age:0,life:life||.45,col})}
function ftext(px,py,txt,col,size,sub){G.texts.push({x:px,y:py,txt,col,size,sub,age:0,life:1.1});if(G.texts.length>6)G.texts.shift()}
function shake(a){if(shakeOK)G.shake=Math.max(G.shake,a)}
function flash(a,c){G.flash=Math.max(G.flash,a);G.flashC=c||'255,255,255'}
function banner(txt,sub,dur,col){G.banner={txt,sub,t0:G.now,dur:dur||1,col:col||'#ffe08a'}}
function mkScreen(){return {x:mx(G.mk.x),y:my(G.mk.y)}}

/* ---------- postać / ruch ---------- */
function moveMarker(m,dur){
 const mk=G.mk,pts=m.pts.map(p=>p.slice());
 mk.anim={pts,t0:G.now,dur,h0:mk.h,h1:mk.h+m.dh};mk.hT=mk.h+m.dh;
}
function snapTo(i){ // pozycja po ruchu i (i=-1: start)
 const mk=G.mk;mk.anim=null;mk.tech=null;
 if(i<0){mk.x=0;mk.y=0;mk.h=0}else{const m=G.k.mv[i];mk.x=m.x;mk.y=m.y;mk.h=m.d*45}
}
function techAnim(m){G.mk.tech={t:m.t,t0:G.now,name:m.n}}

/* ---------- przyciski technik ---------- */
function optsFor(i){
 const set=G.k.set,m=G.k.mv[i];if(set.length<=6)return set.slice();
 const others=set.filter(t=>t!==m.t);for(let j=others.length-1;j>0;j--){const r=Math.floor(Math.random()*(j+1));[others[j],others[r]]=[others[r],others[j]]}
 const pick=new Set([m.t,...others.slice(0,5)]);return set.filter(t=>pick.has(t));
}
function renderGrid(opts){
 const key=opts.join(',');if(els.grid.dataset.k===key)return;els.grid.dataset.k=key;
 const n=opts.length;els.grid.style.setProperty('--c',n<=3?n:n===4?2:3);els.grid.classList.toggle('gm-dense',n>4);
 els.grid.innerHTML=opts.map(t=>`<button class="gm-t" data-t="${t}" aria-label="${esc(TECH[t][0])}">${ico(t,30)}<span><b>${esc(TECH[t][0])}</b><small>${esc(TECH[t][1])}</small></span></button>`).join('');
 requestAnimationFrame(layout);
}
function hlTech(t,cls,ms){
 els.grid.querySelectorAll('.gm-t').forEach(b=>{b.classList.remove('gm-hl');if(cls)b.classList.remove('gm-ok','gm-bad')});
 if(!t)return;const b=els.grid.querySelector(`[data-t="${t}"]`);if(!b)return;
 if(cls){b.classList.add(cls);const id=G.now;b._f=id;later(ms||.45,()=>{if(b._f===id)b.classList.remove(cls)})}else b.classList.add('gm-hl');
}
function setCtl(mode){
 els.bot.classList.toggle('gm-off',mode!=='input');
 els.kiai.hidden=mode==='train';els.nav.hidden=mode!=='train';
 els.kiai.classList.remove('gm-hl');
}
function hint(t,warn){els.hint.textContent=t||'';els.hint.classList.toggle('gm-warn',!!warn)}

/* ---------- podpis (karta ruchu) ---------- */
function capMove(m,opt){
 opt=opt||{};const st=STANCE[m.s];
 els.cap.className='gm-cap'+(opt.bad?' gm-bad':'');
 els.cap.innerHTML=`<div class="ic">${ico(m.t,40)}</div>
  <div class="tx"><div class="jp">${esc(m.n)}${m.k?'<em>KIAI!</em>':''}</div><div class="pl">${esc(opt.pre||'')}${esc(m.p)}</div><div class="gm-st">${esc(st[0])} · ${esc(st[1])}</div></div>
  <div class="dir">${m.mv?arrowSvg(m.d,32):DOTSVG(32)}${m.mv?esc(DWORD[m.d]):'w miejscu'}</div>`;
}
function capInput(){
 const [a,b]=G.k.chunks[G.ci],n=G.mi-a+1,tot=b-a;
 els.cap.className='gm-cap';
 const canReplay=G.mi===a&&!G.moveDone;
 els.cap.innerHTML=`<div class="ic gm-me"><img src="${esc(lookSrc())}" alt=""></div>
  <div class="tx"><div class="jp">Twoja kolej!</div><div class="pl">Ruch ${n} z ${tot} w tej serii</div><div class="gm-st">Ruch ${G.mi+1} z ${G.k.mv.length} w całym kata</div></div>
  ${canReplay?`<button class="rp" data-g="replay" aria-label="Pokaż ruchy jeszcze raz">${REPLAY}Pokaż<br>znowu</button>`:''}`;
}
function capText(jp,pl,st){els.cap.className='gm-cap';els.cap.innerHTML=`<div class="ic gm-me"><img src="${esc(lookSrc())}" alt=""></div><div class="tx"><div class="jp">${esc(jp)}</div><div class="pl">${esc(pl||'')}</div>${st?`<div class="gm-st">${esc(st)}</div>`:''}</div>`}

/* ---------- HUD ---------- */
function hud(){
 const g=G;if(!g)return;const k=g.k,n=k.mv.length;
 els.ttlB.textContent=k.n;
 const done=g.mode==='train'?g.ti+1:g.done;
 els.ttlS.textContent=g.mode==='train'?`Trening · ruch ${Math.max(0,g.ti+1)} z ${n}`:`Ruch ${Math.min(n,done)} z ${n}`;
 els.barI.style.width=(done/n*100)+'%';
 els.hearts.classList.toggle('gm-hid',g.mode==='train');
 const hs=els.hearts.children;for(let i=0;i<3;i++){hs[i].classList.toggle('gm-dim',i>=g.hearts)}
}

/* ---------- przebieg gry ---------- */
function startCount(){
 G.state='count';G.count={t0:G.now};setCtl('demo');hint('');
 capText('Przygotuj się','Patrz, jak sensei pokazuje ruchy – potem powtórz je sama.',G.k.n);
 const words=[['REI','Ukłon'],['YŌI','Gotowa?'],['HAJIME!','Zaczynamy!']];
 words.forEach((w,i)=>later(i*.8,()=>{G.count.i=i;G.count.ti=G.now;if(i<2)call('taiko',1);else call('beep',1046,.25,1)}));
 later(2.5,()=>{G.count=null;startDemo()});
}
function startDemo(replay){
 const [a,b]=G.k.chunks[G.ci];G.state='demo';G.ghost=[];G.reveal=null;
 setCtl('demo');hint(replay?'Patrz jeszcze raz…':'Zapamiętaj kierunki i techniki');
 snapTo(a-1);G.opts=null;
 renderGrid(G.k.set.length<=6?G.k.set:G.k.set.slice(0,6));
 banner(replay?'Jeszcze raz!':'Patrz uważnie!',`Seria ${G.ci+1} z ${G.k.chunks.length} · ${b-a} ${b-a<5?'ruchy':'ruchów'}`,1.05);
 capText('Sensei pokazuje',`${b-a} ${b-a<5?'ruchy':'ruchów'} – zapamiętaj je!`,'Kierunek, technika i kiai');
 let t=1.1;for(let i=a;i<b;i++){const ii=i;later(t,()=>demoMove(ii));t+=DEMO_T}
 later(t+.1,()=>{banner('Twoja kolej!','Powtórz ruchy',.9,'#ffffff');call('taiko',1)});
 later(t+.35,startInput);
}
function demoMove(i){
 const m=G.k.mv[i];G.ghost.push(i);
 if(m.mv){moveMarker(m,.5);SFX.step()}else G.mk.anim=null;
 G.demoArrow={i,t0:G.now};
 later(m.mv?.38:.1,()=>{techAnim(m);SFX.tech(i);const p=mkScreen();burst(p.x,p.y,'#ffe08a',8,160)});
 capMove(m,{turn:true});hint(`${m.i-G.k.chunks[G.ci][0]+1}. ${m.mv?m.turn+' – '+DWORD[m.d]:'w miejscu'}${m.k?' · KIAI!':''}`);
 if(G.k.set.length>6)renderGrid(G.k.set.includes(m.t)?(()=>{const o=G.k.set.slice(0,6);return o.includes(m.t)?o:[...o.slice(0,5),m.t]})():G.k.set.slice(0,6));
 hlTech(m.t);
 say(TECH[m.t][2]);
 if(m.k)later(.78,()=>{doKiaiFx(true);els.kiai.classList.add('gm-hl');later(.5,()=>els.kiai.classList.remove('gm-hl'))});
 hud();
}
function startInput(){
 const [a]=G.k.chunks[G.ci];G.state='input';G.mi=a;G.ghost=[];G.demoArrow=null;
 snapTo(a-1);G.moveDone=false;G.moveErr=false;G.moveSoft=false;G.moveT0=G.now;G.chunkErr=false;
 setCtl('input');hlTech(null);
 prepMove();
}
function prepMove(){
 const m=G.k.mv[G.mi];G.opts=optsFor(G.mi);renderGrid(G.opts);
 capInput();
 const first=G.ki===0&&G.ci===0;
 if(G.moveDone)hint('Teraz technika – stuknij przycisk');
 else hint(first?(m.mv?'Przesuń palcem po macie w stronę ruchu':'Stuknij technikę'):'Kierunek (przesuń palcem) albo technika');
 hud();
}
function needKiaiResolve(){ // brak kiai przed następnym ruchem
 if(!G.pendK)return;G.pendK=null;G.kiaiMiss++;const p=mkScreen();ftext(p.x,p.y-MAP.u*.9,'Zabrakło KIAI!','#ffb4a6',24);SFX.slip();
}
function onSwipe(d){
 if(!G)return;
 if(G.state!=='input')return;
 if(G.pendK&&!G.pendK.last)needKiaiResolve();else if(G.pendK)return;
 const m=G.k.mv[G.mi];
 if(!m.mv){G.soft++;G.moveSoft=true;SFX.slip();buzz(30);hint('Ta technika jest w miejscu – bez kroku. Stuknij technikę!',true);const p=mkScreen();ring(p.x,p.y,MAP.u*.4,'255,180,166');return}
 if(G.moveDone){SFX.slip();hint('Krok już jest – teraz stuknij technikę!',true);return}
 if(d===m.d){G.moveDone=true;moveMarker(m,.32);SFX.step();buzz(8);hint('Teraz technika – stuknij przycisk');
  later(.3,()=>{const p=mkScreen();ring(p.x,p.y,MAP.u*.35,'255,224,138',.35)});capInput()}
 else mistake('dir',m);
}
function onTech(t){
 if(!G)return;
 if(G.state!=='input')return;
 if(G.pendK&&!G.pendK.last)needKiaiResolve();else if(G.pendK)return;
 const m=G.k.mv[G.mi];
 if(m.mv&&!G.moveDone){G.soft++;G.moveSoft=true;SFX.slip();buzz(30);hint('Najpierw krok – przesuń palcem po macie!',true);const p=mkScreen();ring(p.x,p.y,MAP.u*.5,'255,180,166');return}
 if(t===m.t)completeMove(m,true);
 else{hlTech(t,'gm-bad',.5);mistake('tech',m)}
}
function onKiai(){
 if(!G||(G.state!=='input'&&G.state!=='wait'))return;
 if(G.pendK){const pk=G.pendK;G.pendK=null;G.kiaiOk++;G.score+=150;doKiaiFx(false);if(pk.last)later(.6,finishChunk);return}
 G.kiaiWrong++;SFX.slip();buzz(30);const p=mkScreen();ftext(p.x,p.y-MAP.u*.9,'Jeszcze nie teraz!','#ffb4a6',24);hint('Kiai tylko w ruchach z okrzykiem',true);
}
function doKiaiFx(demo){
 const p=mkScreen();SFX.kiai();call('taiko',2);buzz(demo?0:[30,30,60]);
 ftext(p.x,p.y-MAP.u*.6,'KIAI!','#ff6a4d',54,demo?'':'+150');ring(p.x,p.y,MAP.u*.5,'255,106,77',.6);ring(p.x,p.y,MAP.u*.9,'255,224,138',.8);
 burst(p.x,p.y,'#ff6a4d',22,420);shake(8);flash(.22,'255,120,90');
}
function completeMove(m,ok){
 const dt=G.now-G.moveT0;G.times.push(dt);
 techAnim(m);SFX.tech(G.mi);buzz(12);
 const p=mkScreen();
 if(ok){
  const base=G.moveErr?0:G.moveSoft?50:100,spd=G.moveErr?0:Math.round(50*clamp((4-dt)/(4-1.3),0,1));G.score+=base+spd;
  hlTech(m.t,'gm-ok',.4);burst(p.x,p.y,'#ffe08a',G.moveErr?6:14,280);ring(p.x,p.y,MAP.u*.45,'255,224,138');
  ftext(p.x,p.y-MAP.u*.75,m.n,'#ffe08a',22,base+spd?'+'+(base+spd):'');
  if(!G.moveErr)SFX.ok();
 }
 G.done=m.i+1;
 const [,b]=G.k.chunks[G.ci],last=m.i+1>=b;
 if(m.k)G.pendK={i:m.i,t:G.now,last};
 if(!last){G.mi++;G.moveDone=false;G.moveErr=false;G.moveSoft=false;G.moveT0=G.now;prepMove()}
 else{hud();G.state='wait';if(!m.k)later(.5,finishChunk);else hint('')}
}
function mistake(kind,m){
 G.hearts--;G.errs++;G.moveErr=true;G.chunkErr=true;G.state='reveal';
 SFX.wrong();buzz([60,40,60]);shake(7);flash(.25,'226,69,43');
 const hs=els.hearts.children[G.hearts];if(hs){hs.classList.add('gm-lose');hs.addEventListener('animationend',()=>hs.classList.remove('gm-lose'),{once:true})}
 hud();
 G.reveal={kind,i:m.i,t0:G.now};
 capMove(m,{bad:true,pre:kind==='dir'?'Tędy: ':'Ta technika: '});
 hint(kind==='dir'?`Ups! Ten ruch idzie ${DWORD[m.d]}.`:`Ups! Tu jest ${m.n}.`,true);
 if(kind==='tech')later(.5,()=>hlTech(m.t));
 later(1.6,()=>{
  if(!G)return;G.reveal=null;hlTech(null);
  if(G.hearts<=0){fail();return}
  G.state='input';
  if(kind==='dir'){G.moveDone=true;moveMarker(m,.32);hint('Teraz technika – stuknij przycisk');capInput()}
  else completeMove(m,true);
 });
}
function finishChunk(){
 if(!G||G.state==='done'||G.state==='fail')return;
 if(G.state!=='input'&&G.state!=='reveal'&&G.state!=='wait')return;
 G.pendK=null;G.ci++;
 const bonus=!G.chunkErr&&G.hearts<3;if(bonus){G.hearts++;hud();const hs=els.hearts.children[G.hearts-1];if(hs){hs.classList.add('gm-lose');hs.addEventListener('animationend',()=>hs.classList.remove('gm-lose'),{once:true})}}
 if(G.ci>=G.k.chunks.length){finishKata();return}
 G.state='between';setCtl('demo');
 const praise=['Dobrze! Osu!','Świetnie!','Tak trzymaj!','Pięknie!','Brawo!'];
 banner(praise[G.ci%praise.length],bonus?'Seria bez błędu – serduszko wraca!':`${G.done} z ${G.k.mv.length} ruchów`,1.1,'#ffe08a');SFX.ok();
 const p=mkScreen();burst(p.x,p.y,'#ffe08a',20,320);
 later(1.25,()=>startDemo());
}
// czekamy na kiai po ostatnim ruchu serii
function checkKiaiWait(){if(G.pendK&&G.pendK.last&&G.state==='wait'&&G.now-G.pendK.t>2.2){G.pendK=null;G.kiaiMiss++;const p=mkScreen();ftext(p.x,p.y-MAP.u*.9,'Zabrakło KIAI!','#ffb4a6',24);SFX.slip();later(.6,finishChunk)}}

/* ---------- koniec ---------- */
function stats(){
 const n=G.k.mv.length,good=n-G.errs,acc=Math.round(good/n*100),avg=G.times.length?G.times.reduce((a,b)=>a+b,0)/G.times.length:0;
 return {n,acc,avg,max:n*150+G.k.nk*150};
}
function finishKata(){
 G.state='done';setCtl('demo');hint('');G.ghost=[];capText('Kata ukończone!','Osu! Teraz ukłon – rei.',G.k.n);
 const k=G.k,st=stats(),stars=!G.errs&&G.kiaiOk===k.nk&&!G.kiaiWrong?3:G.errs<=2?2:1;
 G.score=Math.max(0,G.score-G.replays*30);
 const d=data(),rec=d.lv[k.id]||(d.lv[k.id]={});const firstEver=!rec.s,prevBest=rec.sc||0,newRec=G.score>prevBest;
 rec.s=Math.max(rec.s||0,stars);rec.sc=Math.max(prevBest,Math.round(G.score));rec.p=100;rec.n=(rec.n||0)+1;d.plays++;
 let today='';try{today=DW().today()}catch(e){}d.last=today;
 const nextUnlocked=firstEver&&G.ki+1<KATA.length;
 // monety: 3 progi dziennie po 5 (ukończenie, 2★, 3★)
 let coins=0,xp=0;
 const tiers=[true,stars>=2,stars>=3];
 tiers.forEach((ok,i)=>{if(ok){let paid=false;try{paid=DW().payOnce('gm'+today+'-'+i,5,'Mistrzyni Kata')}catch(e){}if(paid)coins+=5}});
 if(coins)xp+=5;if(firstEver)xp+=10;
 if(xp)call('addXP',xp);
 call('save');
 G.result={stars,st,coins,xp,newRec,prevBest,firstEver,nextUnlocked,ok:true};
 banner('Kata ukończone!','Osu!',2.2,'#ffe08a');
 call('gong');flash(.35,'255,224,138');const p=mkScreen();burst(p.x,p.y,'#ffe08a',40,520);ring(p.x,p.y,MAP.u,'255,224,138',.9);
 say('Kata ukończone! Osu!');
 later(2.1,()=>screenResult());
}
function fail(){
 G.state='fail';setCtl('demo');capText('Koniec serduszek','Nic nie szkodzi – każda mistrzyni ćwiczy wiele razy.',G.k.n);hint('');
 const d=data(),rec=d.lv[G.k.id]||(d.lv[G.k.id]={});const pct=Math.round(G.done/G.k.mv.length*100);rec.p=Math.max(rec.p||0,pct);d.plays++;call('save');
 G.result={ok:false,pct};
 banner('Koniec serduszek','Nic nie szkodzi – spróbuj jeszcze raz!',1.8,'#ffb4a6');
 later(1.9,()=>screenResult());
}

/* ---------- trening ---------- */
function startTrain(){
 G.state='train';G.ti=-1;G.auto=true;snapTo(-1);setCtl('train');renderGrid(G.k.set.length<=6?G.k.set:G.k.set.slice(0,6));
 capText('Trening','Sensei pokazuje całe kata krok po kroku. Możesz zatrzymać i cofać.',`${G.k.mv.length} ruchów · ${G.k.nk} × kiai`);
 hint('Dalej ▶ – następny ruch, ◀ – cofnij');
 navState();hud();G.trainNext=G.now+1.4;
}
function trainStep(dir){
 const n=G.k.mv.length;
 if(dir>0){
  if(G.ti>=n-1){trainEnd();return}
  G.ti++;const m=G.k.mv[G.ti];G.trainEndShown=false;
  if(m.mv){moveMarker(m,.8);SFX.step()}
  G.demoArrow={i:G.ti,t0:G.now};
  later(m.mv?.6:.15,()=>{if(G.ti===m.i){techAnim(m);SFX.tech(m.i)}});
  if(m.k)later(1.1,()=>{if(G.ti===m.i)doKiaiFx(true)});
  showTrainMove(m);
  say(TECH[m.t][2]+'. '+m.p+(m.k?'. Kiai!':''));
 }else{
  if(G.ti<0)return;G.ti--;snapTo(G.ti);G.demoArrow=null;
  if(G.ti>=0)showTrainMove(G.k.mv[G.ti]);else capText('Trening','Początek kata – ukłon i pozycja yōi.','Zacznij od ukłonu');
 }
 G.trainNext=G.now+TRAIN_T;navState();hud();
}
function showTrainMove(m){
 capMove(m,{turn:true});
 if(G.k.set.length>6){const o=G.k.set.slice(0,6);renderGrid(o.includes(m.t)?o:[...o.slice(0,5),m.t])}
 hlTech(m.t);
 hint(`${m.i+1}. ${m.mv?m.turn+' – '+DWORD[m.d]:'w miejscu'}${m.k?' · KIAI!':''}`);
}
function trainEnd(){
 G.auto=false;G.trainEndShown=true;navState();
 const d=data();if(!G.trainCounted){G.trainCounted=true;d.train++;call('save')}
 capText('Koniec kata – Osu!','Naore – wróć na start i ukłoń się.',unlocked(G.ki)?'Gotowa? Zagraj w to kata!':'');
 hint('');banner('Osu!','Całe kata przećwiczone',1.6);call('gong');
 const p=mkScreen();burst(p.x,p.y,'#ffe08a',30,420);
}
function navState(){
 const b=els.nav.querySelectorAll('button');
 b[0].disabled=G.ti<0;
 b[1].innerHTML=G.auto?`${PSVG}Pauza`:`${PLAY}Auto`;b[1].classList.toggle('gm-on',G.auto);
 const end=G.ti>=G.k.mv.length-1;b[2].innerHTML=end?(G.trainEndShown?(unlocked(G.ki)?`${PLAY}Graj`:`${REPLAY}Od nowa`):'Koniec'):`Dalej${NEXT}`;
}

/* ---------- pętla ---------- */
function loop(ts){
 raf=requestAnimationFrame(loop);
 let dt=(ts-lastT)/1000;lastT=ts;if(!(dt>0))dt=0;if(dt>.05)dt=.05;
 update(dt);if(G)draw();
}
function update(dt){
 const g=G;if(!g)return;g.now+=dt;
 // kolejka zdarzeń w czasie gry (pauza ją zatrzymuje)
 if(g.q.length){const due=g.q.filter(e=>e.at<=g.now);if(due.length){g.q=g.q.filter(e=>e.at>g.now);due.sort((a,b)=>a.at-b.at).forEach(e=>{if(G===g)e.fn()})}}
 if(G!==g)return;
 const mk=g.mk;
 if(mk.anim){const a=mk.anim,k=clamp((g.now-a.t0)/a.dur,0,1),e=easeIO(k);
  // pozycja po łamanej
  const P=a.pts;let L=0;const seg=[];for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);seg.push(l);L+=l}
  let s=e*L,i=0;while(i<seg.length-1&&s>seg[i]){s-=seg[i];i++}const f=seg[i]?clamp(s/seg[i],0,1):1;
  mk.x=lerp(P[i][0],P[i+1][0],f);mk.y=lerp(P[i][1],P[i+1][1],f);
  mk.h=lerp(a.h0,a.h1,easeIO(clamp(k*1.6,0,1)));
  if(k>=1){mk.h=((a.h1%360)+360)%360;mk.anim=null}}
 if(g.state==='wait')checkKiaiWait();
 if(g.state==='train'&&g.auto&&g.now>=g.trainNext){trainStep(1)}
 for(const p of g.parts){p.age+=dt;p.vy+=300*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
 g.parts=g.parts.filter(p=>p.age<p.life);
 for(const t of g.texts)t.age+=dt;g.texts=g.texts.filter(t=>t.age<t.life);
 for(const r of g.rings)r.age+=dt;g.rings=g.rings.filter(r=>r.age<r.life);
 g.shake=Math.max(0,g.shake-dt*40);g.flash=Math.max(0,g.flash-dt*1.4);
 if(g.banner&&g.now-g.banner.t0>g.banner.dur)g.banner=null;
}

/* ---------- rysowanie ---------- */
function draw(){
 const g=G,x=cx;if(!g||!x)return;
 x.setTransform(DPR,0,0,DPR,0,0);x.clearRect(0,0,W,H);
 if(g.shake>0){const s=g.shake;x.translate(rnd(-s,s),rnd(-s,s))}
 const u=MAP.u,k=g.k;
 // start
 x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=2;const sx=mx(0),sy=my(0),cs=u*.16;
 x.beginPath();x.moveTo(sx-cs,sy-cs);x.lineTo(sx+cs,sy+cs);x.moveTo(sx+cs,sy-cs);x.lineTo(sx-cs,sy+cs);x.stroke();
 // pełne embusen (trening)
 if(g.mode==='train'){x.setLineDash([6,8]);drawPath(x,0,k.mv.length,'rgba(255,255,255,.22)',3);x.setLineDash([])}
 // przebyta droga (złota)
 const doneN=g.mode==='train'?g.ti+1:g.done;
 if(doneN>0){drawPath(x,0,doneN,'rgba(242,193,78,.25)',Math.max(10,u*.18));drawPath(x,0,doneN,'#f2c14e',Math.max(4,u*.07));
  for(let i=0;i<doneN;i++){const m=k.mv[i];x.fillStyle=m.k?'#e2452b':'#ffe08a';x.beginPath();x.arc(mx(m.x),my(m.y),m.k?u*.09:u*.055,0,7);x.fill()}}
 // pokaz senseia: przerywana ścieżka + numery
 if(g.ghost.length){
  x.setLineDash([7,7]);for(const i of g.ghost)drawPath(x,i,i+1,'rgba(255,255,255,.8)',3);x.setLineDash([]);
  const a=g.k.chunks[g.ci][0],seen={};
  g.ghost.forEach((i,j)=>{const m=k.mv[i],key=m.x+','+m.y,off=(seen[key]=(seen[key]||0)+1)-1;const px=mx(m.x)+off*u*.32,py=my(m.y)-u*.42-off*2;
   x.fillStyle=m.k?'#e2452b':'rgba(17,20,27,.9)';x.strokeStyle='#ffffff';x.lineWidth=2;x.beginPath();x.arc(px,py,11,0,7);x.fill();x.stroke();
   x.fillStyle='#fff';x.font=`800 14px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillText(String(i-a+1),px,py+1)});
 }
 // strzałka pokazu
 if(g.demoArrow){const m=k.mv[g.demoArrow.i],t=g.now-g.demoArrow.t0,al=t<.15?t/.15:t>1?Math.max(0,1-(t-1)/.3):1;if(al>0&&m.mv)drawArrow(x,m.from[0],m.from[1],m.d,al*.85,'255,224,138')}
 // podpowiedź po błędzie
 if(g.reveal){const m=k.mv[g.reveal.i],t=g.now-g.reveal.t0,pulse=.6+.4*Math.sin(t*12);
  if(g.reveal.kind==='dir')drawArrow(x,m.from[0],m.from[1],m.d,pulse,'120,230,160');
  }
 drawFig(x);
 // cząsteczki, pierścienie, teksty
 for(const r of g.rings){if(!r.life)continue;const q=r.age/r.life;x.globalAlpha=1-q;x.strokeStyle=`rgba(${r.col},1)`;x.lineWidth=5*(1-q)+1;x.beginPath();x.arc(r.x,r.y,r.r0*(1+q*1.2)+2,0,7);x.stroke()}
 x.globalAlpha=1;
 for(const p of g.parts){x.globalAlpha=1-p.age/p.life;x.fillStyle=p.c;x.beginPath();x.arc(p.x,p.y,p.s*(1-p.age/p.life)+.6,0,7);x.fill()}
 x.globalAlpha=1;
 for(const t of g.texts){const q=t.age/t.life,pop=q<.15?easeOutBack(q/.15):1,y=t.y-q*34;x.globalAlpha=q>.7?1-(q-.7)/.3:1;
  const fs=fitSize(x,t.txt,t.size,W-28),tw=x.measureText(t.txt).width/2+14,tx=clamp(t.x,tw,W-tw);
  textC(x,t.txt,tx,y,Math.round(fs*pop),t.col);
  if(t.sub){x.font=`700 16px ${FONT}`;x.lineWidth=4;x.strokeStyle='rgba(0,0,0,.7)';x.strokeText(t.sub,tx,y+fs*.6);x.fillStyle='#ffe08a';x.fillText(t.sub,tx,y+fs*.6)}}
 x.globalAlpha=1;
 x.setTransform(DPR,0,0,DPR,0,0);
 if(g.flash>0){x.fillStyle=`rgba(${g.flashC},${g.flash})`;x.fillRect(0,0,W,H)}
 if(g.banner)drawBanner(x,g.banner);
 if(g.count&&g.count.i!=null)drawCount(x);
}
function drawPath(x,a,b,col,lw){
 x.strokeStyle=col;x.lineWidth=lw;x.lineCap='round';x.lineJoin='round';x.beginPath();
 for(let i=a;i<b;i++){const P=G.k.mv[i].pts;x.moveTo(mx(P[0][0]),my(P[0][1]));for(let j=1;j<P.length;j++)x.lineTo(mx(P[j][0]),my(P[j][1]))}
 x.stroke();
}
function drawArrow(x,fx,fy,d,al,col){
 const u=MAP.u,dv=DV[d],px=mx(fx),py=my(fy),len=u*1.05,ang=Math.atan2(dv[1],dv[0]);
 x.save();x.translate(px,py);x.rotate(ang);x.globalAlpha=al;
 const w=u*.17,hw=u*.36,s0=u*.38;
 x.fillStyle=`rgba(${col},1)`;x.strokeStyle='rgba(0,0,0,.45)';x.lineWidth=2;x.lineJoin='round';
 x.beginPath();x.moveTo(s0,-w);x.lineTo(s0+len-hw,-w);x.lineTo(s0+len-hw,-hw);x.lineTo(s0+len,0);x.lineTo(s0+len-hw,hw);x.lineTo(s0+len-hw,w);x.lineTo(s0,w);x.closePath();x.stroke();x.fill();
 x.restore();x.globalAlpha=1;
}
function textC(x,t,px,py,size,col){x.font=`italic 800 ${size}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=Math.max(4,size*.1);x.strokeStyle='rgba(0,0,0,.72)';x.strokeText(t,px,py);x.fillStyle=col;x.fillText(t,px,py)}
function fitSize(x,t,size,maxW){x.font=`italic 800 ${size}px ${FONT}`;const w=x.measureText(t).width;return w>maxW?Math.floor(size*maxW/w):size}
function drawBanner(x,b){
 const q=(G.now-b.t0)/b.dur,a=q<.12?q/.12:q>.8?(1-q)/.2:1,y=F.y+F.h*.5;x.globalAlpha=clamp(a,0,1);
 const hh=b.sub?92:70;let gr=x.createLinearGradient(0,y-hh/2,0,y+hh/2);gr.addColorStop(0,'rgba(7,9,13,0)');gr.addColorStop(.25,'rgba(7,9,13,.8)');gr.addColorStop(.75,'rgba(7,9,13,.8)');gr.addColorStop(1,'rgba(7,9,13,0)');
 x.fillStyle=gr;x.fillRect(0,y-hh/2,W,hh);
 const sc=q<.12?easeOutBack(q/.12):1;
 textC(x,b.txt,W/2,y-(b.sub?12:0),Math.round(fitSize(x,b.txt,46,W-40)*sc),b.col);
 if(b.sub){x.font=`600 18px ${FONT}`;x.textAlign='center';x.fillStyle='#e6e8ec';x.fillText(b.sub,W/2,y+26)}
 x.globalAlpha=1;
}
function drawCount(x){
 const c=G.count,q=(G.now-c.ti)/.8,words=[['REI','Ukłon'],['YŌI','Gotowa?'],['HAJIME!','Zaczynamy!']],w=words[c.i];if(!w)return;
 const s=easeOutBack(Math.min(1,q/.3)),y=F.y+F.h*.45;x.globalAlpha=c.i===2?clamp(1-Math.max(0,q-.6)/.4,0,1):1;
 x.fillStyle='rgba(7,9,13,.55)';x.fillRect(0,y-60,W,130);
 textC(x,w[0],W/2,y,Math.round((c.i===2?68:84)*s),c.i===2?'#ffe08a':'#ffffff');
 x.font=`700 22px ${FONT}`;x.fillStyle='#c9ced6';x.textAlign='center';x.fillText(w[1],W/2,y+52);x.globalAlpha=1;
}
// zawodniczka z góry: biała gi, brązowe włosy z warkoczem, złoty znacznik kierunku
function drawFig(x){
 const g=G,mk=g.mk,u=MAP.u,R=clamp(u*.3,13,30),px=mx(mk.x),py=my(mk.y);
 x.save();x.translate(px,py);
 x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(R*.12,R*.2,R*1.15,R*.95,0,0,7);x.fill();
 x.rotate(mk.h*Math.PI/180);
 // znacznik kierunku
 x.fillStyle='#f2c14e';x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=1.5;x.beginPath();x.moveTo(0,-R*1.95);x.lineTo(R*.42,-R*1.42);x.lineTo(-R*.42,-R*1.42);x.closePath();x.fill();x.stroke();
 // animacja techniki
 let a=0,t=null;if(mk.tech){const q=(g.now-mk.tech.t0);t=mk.tech.t;a=q<.12?q/.12:q<.55?1:Math.max(0,1-(q-.55)/.3);if(q>1)mk.tech=null}
 const SK='#f0c2a0',GI='#f4f5f7',GI2='#c9cfd7';
 const arm=(x0,y0,x1,y1,fist)=>{x.strokeStyle=GI;x.lineWidth=R*.34;x.lineCap='round';x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();x.strokeStyle=GI2;x.lineWidth=1;x.stroke();x.fillStyle=SK;x.beginPath();x.arc(x1,y1,R*(fist||.17),0,7);x.fill()};
 const kick=t==='mae'||t==='yoko';
 if(kick&&a>0){const side=t==='yoko';x.strokeStyle=GI;x.lineWidth=R*.42;x.lineCap='round';x.beginPath();x.moveTo(R*.25,R*.1);
  const ex=side?R*(.4+1.5*a):R*.25,ey=side?R*.1:-R*(.2+1.5*a);x.lineTo(ex,ey);x.stroke();x.fillStyle=SK;x.beginPath();x.ellipse(ex+(side?R*.15:0),ey-(side?0:R*.15),R*.17,R*.24,side?Math.PI/2:0,0,7);x.fill()}
 // ręce
 let L=[-R*.78,-R*.1,-R*.42,-R*.72],Rr=[R*.78,-R*.1,R*.42,-R*.72];
 if(t&&a>0){
  if(t==='tc'||t==='tj'||t==='gyaku'||t==='nuki')Rr=[R*.7,-R*.1,lerp(R*.42,R*.12,a),lerp(-R*.72,-R*(1.75+(t==='tj'?.1:0)),a)];
  else if(t==='gedan')L=[-R*.78,-R*.1,lerp(-R*.42,-R*1.05,a),lerp(-R*.72,-R*1.2,a)];
  else if(t==='ju'||t==='kamae')Rr=[R*.7,-R*.1,lerp(R*.42,-R*.55,a),lerp(-R*.72,-R*1.0,a)];
  else if(t==='uchi'||t==='morote')Rr=[R*.7,-R*.1,lerp(R*.42,R*.75,a),lerp(-R*.72,-R*1.05,a)];
  else if(t==='shuto'){const an=-Math.PI/2-.9+a*1.2;L=[-R*.78,-R*.1,-R*.2+Math.cos(an)*R*1.05,Math.sin(an)*R*1.05]}
  else if(t==='tet')Rr=[R*.7,-R*.1,lerp(R*.42,R*1.15,a),lerp(-R*.72,-R*1.0,a)];
  else if(t==='yoko')Rr=[R*.7,-R*.1,lerp(R*.42,R*1.3,a),lerp(-R*.72,-R*.5,a)];
 }
 arm(...L,t==='shuto'&&a>0?.2:.17);arm(...Rr);
 // tułów (gi)
 const gr=x.createRadialGradient(-R*.3,-R*.3,R*.1,0,0,R);gr.addColorStop(0,'#ffffff');gr.addColorStop(1,'#d8dde3');
 x.fillStyle=gr;x.beginPath();x.ellipse(0,0,R,R*.56,0,0,7);x.fill();
 x.strokeStyle='rgba(120,130,145,.6)';x.lineWidth=1.2;x.beginPath();x.moveTo(-R*.36,-R*.46);x.lineTo(R*.05,-R*.05);x.lineTo(R*.36,-R*.46);x.stroke();
 // warkocz
 x.fillStyle='#5b3a22';for(let i=0;i<4;i++){x.beginPath();x.ellipse(0,R*(.42+i*.2),R*(.13-i*.015),R*.12,0,0,7);x.fill()}
 // głowa
 const hg=x.createRadialGradient(-R*.12,-R*.1,R*.05,0,0,R*.44);hg.addColorStop(0,'#8a5a36');hg.addColorStop(1,'#4a2c18');
 x.fillStyle=hg;x.beginPath();x.arc(0,R*.04,R*.42,0,7);x.fill();
 x.strokeStyle='rgba(30,15,5,.5)';x.lineWidth=1;x.beginPath();x.moveTo(0,-R*.36);x.lineTo(0,R*.3);x.stroke();
 x.restore();
 // nazwa techniki nad postacią
 if(mk.tech&&mk.tech.name){const q=g.now-mk.tech.t0,al=q<.1?q/.1:q>.75?Math.max(0,1-(q-.75)/.25):1;
  if(al>0&&g.state!=='input'&&g.state!=='reveal'){x.globalAlpha=al;const ty=py-R*2.5;textC(x,mk.tech.name,clamp(px,96,W-96),Math.max(F.y+36,ty),fitSize(x,mk.tech.name,22,170),'#ffe08a');x.globalAlpha=1}}
}

/* ---------- ekrany ---------- */
function showScr(html){root.classList.add('gm-menu');els.scr.hidden=false;els.scr.innerHTML=html;els.scr.scrollTop=0}
function hideScr(){root.classList.remove('gm-menu');els.scr.hidden=true;els.scr.innerHTML=''}
function screenMenu(){
 stopLoop();hush();G=null;setBg(baseBg());
 const d=data(),ct=coinsToday();
 const tot=KATA.reduce((a,k)=>a+((d.lv[k.id]||{}).s||0),0),doneK=KATA.filter(k=>(d.lv[k.id]||{}).s).length;
 const first=!d.plays&&!d.train;
 showScr(`<div class="gm-in">
  <div class="gm-top"><div><p class="gm-kick">Mini-gra · Kata</p><h2 class="gm-h">Mistrzyni Kata</h2></div><button class="gm-ib" data-g="exit" aria-label="Wyjdź">${XSVG}</button></div>
  <div class="gm-hero"><img src="${esc(lookSrc())}" alt=""></div>
  <div class="gm-best"><div><b>${tot}/${KATA.length*3}</b><span>zdobytych gwiazdek</span></div><div><b>${doneK}/${KATA.length}</b><span>ukończonych kata</span></div><div><b>${ct.max-ct.got}</b><span>monet do zdobycia dziś</span></div></div>
  <details class="gm-how"${first?' open':''}><summary>Jak grać?</summary>
   <div class="gm-row"><i>${arrowSvg(2,26)}</i><p><b>1. Patrz, co pokazuje sensei</b><small>Kierunek, technika i okrzyk kiai – zapamiętaj serię ruchów.</small></p></div>
   <div class="gm-row"><i>${arrowSvg(0,26)}</i><p><b>2. Przesuń palcem po macie</b><small>w stronę, w którą idzie ruch (góra ekranu = przód dojo).</small></p></div>
   <div class="gm-row"><i>${ico('gedan',30)}</i><p><b>3. Stuknij technikę</b><small>Ruch „w miejscu” – od razu stuknij technikę, bez kroku.</small></p></div>
   <div class="gm-row"><i class="gm-ki">KIAI</i><p><b>4. Kiai po technice</b><small>W ruchach z okrzykiem: najpierw technika, potem przycisk KIAI!</small></p></div>
   <div class="gm-row"><i>${HEART.replace('<svg','<svg width="26" height="26"')}</i><p><b>Masz 3 serduszka</b><small>Błąd zabiera serduszko (sensei pokaże, jak trzeba). Seria bez błędu oddaje serduszko!</small></p></div>
   <div class="gm-row"><i>${STAR(true,26)}</i><p><b>3 gwiazdki</b><small>= bez błędów i z każdym kiai, 2 gwiazdki = najwyżej 2 błędy. Gwiazdka otwiera następne kata.</small></p></div>
  </details>
  <div class="gm-list">${KATA.map((k,i)=>{const r=d.lv[k.id]||{},un=unlocked(i),s=r.s||0;
   return `<div class="gm-k${un?'':' gm-lock'}"><div class="th">${embusenSvg(k,54)}</div><h3>${esc(k.n)}</h3>
    <div class="meta"><span class="gm-s">${STAR(s>0,17)}${STAR(s>1,17)}${STAR(s>2,17)}</span>${k.mv.length} ruchów · ${esc(k.sub)}${r.sc?` · rekord ${fmt(r.sc)}`:r.p?` · doszłaś do ${r.p}%`:''}</div>
    <div class="act"><button class="${un?'gm-gold':''}" data-g="play" data-k="${i}" ${un?'':'disabled'}>${un?PLAY+'Graj':LOCK+'Zamknięte'}</button><button data-g="train" data-k="${i}">Trening</button></div>
    ${un?'':`<p class="gm-note" style="grid-column:1/-1;margin:2px 0 0">Zdobądź gwiazdkę w ${esc(KATA[i-1].n)}, aby otworzyć</p>`}</div>`}).join('')}</div>
 </div>`);
}
function screenPause(){
 showScr(`<div class="gm-pause"><h2>Pauza</h2><p style="text-align:center;color:#c9ced6;margin:0 0 8px">Złap oddech. Gotowa?</p>
  <button class="gm-gold gm-big" data-g="resume">Wracam</button><button class="gm-big" data-g="again">Zacznij od nowa</button><button class="gm-big" data-g="menu">Lista kata</button><button class="gm-big" data-g="exit">Wyjdź</button></div>`);
}
function screenResult(){
 if(!G)return;stopLoop();const r=G.result,k=G.k;
 if(!r.ok){
  const tips=['Spróbuj najpierw Treningu – sensei pokaże całe kata powoli.','Patrz na złotą strzałkę: góra ekranu to przód dojo.','Ruchy „w miejscu” nie mają kroku – od razu stuknij technikę.'];
  showScr(`<div class="gm-in gm-res"><p class="gm-kick" style="margin-top:6px">${esc(k.n)}</p><h2 class="gm-h" style="font-size:42px">Prawie! Osu!</h2>
   <div class="gm-bow"><img src="${esc(lookSrc())}" alt=""></div>
   <div class="gm-score" style="font-size:56px">${r.pct}%</div><p style="margin:0 0 10px;color:#c9ced6">Doszłaś do ruchu <b style="color:#ffe08a">${G.done}</b> z ${k.mv.length}. Każda mistrzyni kiedyś zaczynała!</p>
   <div class="gm-tip"><b>Wskazówka:</b> ${esc(tips[Math.floor(Math.random()*tips.length)])}</div>
   <div class="gm-btns"><button class="gm-gold gm-big" data-g="again">Zagraj jeszcze raz</button><button class="gm-big" data-g="train" data-k="${G.ki}">Trening tego kata</button><button class="gm-big" data-g="menu">Lista kata</button><button class="gm-big" data-g="exit">Wyjdź</button></div></div>`);
  call('gong');return;
 }
 const st=r.st,praise=r.stars===3?'Mistrzowskie kata!':r.stars===2?'Pięknie!':'Kata ukończone!';
 const ct=coinsToday();
 const nx=G.ki+1<KATA.length&&unlocked(G.ki+1);
 showScr(`<div class="gm-in gm-res"><p class="gm-kick" style="margin-top:6px">${esc(k.n)}</p><h2 class="gm-h" style="font-size:40px">Kata ukończone! Osu!</h2>
  <div class="gm-bow"><img src="${esc(lookSrc())}" alt=""><b>Rei!</b></div>
  <div class="gm-stars">${[0,1,2].map(i=>`<span style="display:inline-block">${STAR(i<r.stars,46).replace('<svg',`<svg style="animation-delay:${2.9+i*.35}s"`)}</span>`).join('')}</div>
  <p style="margin:0;font:700 20px/1.2 ${FONT};color:#e6e8ec">${praise}</p>
  <div class="gm-score">${fmt(G.score)}</div>
  ${r.newRec&&r.prevBest?'<span class="gm-rec">NOWY REKORD!</span>':r.prevBest?`<p style="margin:0;color:#9aa2af">Rekord: <b style="color:#f2c14e">${fmt(r.prevBest)}</b></p>`:''}
  <div class="gm-grid3"><div><b>${st.acc}%</b><span>dokładność</span></div><div><b>${st.avg.toFixed(1).replace('.',',')} s</b><span>średnio na ruch</span></div><div><b>${G.kiaiOk}/${k.nk}</b><span>kiai</span></div></div>
  ${r.firstEver&&r.nextUnlocked?`<div class="gm-tip"><b>Nowe kata otwarte:</b> ${esc(KATA[G.ki+1].n)}!</div>`:''}
  <p class="gm-coins">${r.coins?`Zdobywasz <b>+${r.coins} monet</b>${r.xp?` i <b>+${r.xp} XP</b>`:''}!`:ct.got>=ct.max?'Dzisiejsze monety z kata już zebrane – wróć jutro!':r.stars<3?`Zdobądź ${r.stars<2?'2 lub 3 gwiazdki':'3 gwiazdki'}, a dostaniesz więcej monet (dziś jeszcze ${ct.max-ct.got}).`:''}${!r.coins&&r.xp?` <b>+${r.xp} XP</b>`:''}</p>
  <div class="gm-btns">${nx?`<button class="gm-gold gm-big" data-g="play" data-k="${G.ki+1}">Następne kata: ${esc(KATA[G.ki+1].n)}</button><button class="gm-big" data-g="again">Zagraj jeszcze raz</button>`:`<button class="gm-gold gm-big" data-g="again">Zagraj jeszcze raz</button>`}<button class="gm-big" data-g="menu">Lista kata</button><button class="gm-big" data-g="exit">Wyjdź</button></div></div>`);
 requestAnimationFrame(()=>{const b=els.scr.querySelector('.gm-bow');if(b)b.classList.add('gm-go')});
 call('taiko',1);
 const rs=r.stars;G.starT=[];for(let i=0;i<rs;i++){G.starT.push(setTimeout(()=>{SFX.star(i);buzz(20)},2900+i*350))}
 if(rs===3)G.starT.push(setTimeout(()=>{call('fanfare');call('celebrate')},2900+3*350+200));
}

/* ---------- tło ---------- */
let bgCur='';
function baseBg(){const S=S_();return S.bg?`media/sklep/shop-${S.bg}.webp`:'media/sklep/shop-tlo-dojo.webp'}
function setBg(url){if(!root||!url||url===bgCur)return;bgCur=url;const b=els.bg;if(!b)return;const im=new Image();im.onload=()=>{if(root&&bgCur===url)b.style.backgroundImage=`url('${url}')`};im.src=url}

/* ---------- sterowanie ---------- */
function startLoop(){if(raf)return;lastT=performance.now();raf=requestAnimationFrame(loop)}
function stopLoop(){if(raf)cancelAnimationFrame(raf);raf=0}
function clearStarT(){if(G&&G.starT){G.starT.forEach(clearTimeout);G.starT=null}}
function begin(ki,mode){
 clearStarT();hush();
 if(mode==='play'&&!unlocked(ki))return;
 G=newGame(ki,mode==='train'?'train':'game');
 hideScr();shakeOK=!reducedMotion();setBg(`media/gra/tlo-${G.k.bg}.webp`);
 els.grid.dataset.k='';hint('');
 setCtl(mode==='train'?'train':'demo');renderGrid(G.k.set.length<=6?G.k.set:G.k.set.slice(0,6));
 layout();snapTo(-1);hud();
 if(mode==='train')startTrain();else startCount();
 startLoop();
}
function pause(){if(!G||!['count','demo','input','reveal','between','wait','train'].includes(G.state)||G.paused)return;G.paused=true;stopLoop();hush();ptr=null;screenPause()}
function resume(){if(!G||!G.paused)return;G.paused=false;hideScr();layout();startLoop()}
function onClick(e){
 const b=e.target.closest('[data-g],[data-t],.gm-kiai');if(!b||!root.contains(b))return;
 if(b.classList.contains('gm-kiai')){onKiai();return}
 if(b.dataset.t){onTech(b.dataset.t);return}
 const a=b.dataset.g;
 if(a==='exit')close();
 else if(a==='pause')pause();
 else if(a==='resume')resume();
 else if(a==='menu'){clearStarT();screenMenu()}
 else if(a==='again'&&G){const ki=G.ki,m=G.mode==='train'?'train':'play';G.paused=false;begin(ki,m)}
 else if(a==='play')begin(+b.dataset.k,'play');
 else if(a==='train')begin(+b.dataset.k,'train');
 else if(a==='replay'&&G&&G.state==='input'){G.replays++;startDemo(true)}
 else if(a==='prev'&&G&&G.mode==='train'){G.auto=false;trainStep(-1)}
 else if(a==='next'&&G&&G.mode==='train'){if(G.trainEndShown){if(unlocked(G.ki))begin(G.ki,'play');else{G.ti=-1;snapTo(-1);G.trainEndShown=false;G.auto=true;G.trainNext=G.now+.3;navState();hud()}return}G.auto=false;trainStep(1)}
 else if(a==='auto'&&G&&G.mode==='train'){G.auto=!G.auto;if(G.auto){if(G.ti>=G.k.mv.length-1){G.ti=-1;snapTo(-1);G.trainEndShown=false}G.trainNext=G.now+.3}navState()}
}
// przesunięcia palcem po macie
let ptr=null;
function onDown(e){if(!G||G.paused)return;e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}ptr={id:e.pointerId,x0:e.clientX,y0:e.clientY,done:false}}
function onMove(e){
 if(!ptr||ptr.id!==e.pointerId||ptr.done||!G)return;
 const dx=e.clientX-ptr.x0,dy=e.clientY-ptr.y0;if(Math.hypot(dx,dy)<30)return;ptr.done=true;
 let ang=Math.atan2(dx,-dy)*180/Math.PI;ang=(ang+360)%360; // 0 = w górę, zgodnie z ruchem wskazówek
 const eight=G.k.mv.some(m=>m.d%2);const d=eight?Math.round(ang/45)%8:(Math.round(ang/90)%4)*2;
 onSwipe(d);
}
function onUp(e){if(ptr&&ptr.id===e.pointerId){if(!ptr.done&&G&&G.state==='input'){const m=G.k.mv[G.mi];if(m&&m.mv&&!G.moveDone)hint('Przesuń palcem – nie stukaj w matę',true)}ptr=null}}
function onVis(){if(document.hidden)pause()}
function onKey(e){
 if(!G)return;
 if(e.key==='Escape'){if(G.paused)resume();else pause();return}
 const K={ArrowUp:0,ArrowRight:2,ArrowDown:4,ArrowLeft:6};
 if(e.key in K){e.preventDefault();onSwipe(K[e.key]);return}
 if(e.key===' '||e.key==='k'){e.preventDefault();onKiai();return}
 if(/^[1-6]$/.test(e.key)&&G.opts){const t=G.opts[+e.key-1];if(t)onTech(t)}
}

function open(){
 if(root)return;
 if(!document.getElementById('gm-kata-css')){const st=document.createElement('style');st.id='gm-kata-css';st.textContent=CSS;document.head.appendChild(st)}
 root=document.createElement('div');root.id='g-kata';root.className='gm-menu';
 root.innerHTML=`<div class="gm-bg"></div><canvas class="gm-fl"></canvas><canvas class="gm-cv"></canvas>
  <div class="gm-hud"><button class="gm-ib" data-g="pause" aria-label="Pauza">${PSVG}</button>
   <div class="gm-ttl"><b></b><span></span><div class="gm-bar"><i></i></div></div>
   <div class="gm-hearts" aria-label="Serduszka">${HEART}${HEART}${HEART}</div></div>
  <div class="gm-bot gm-off"><div class="gm-cap"></div><div class="gm-hint"></div><div class="gm-grid"></div>
   <button class="gm-kiai" aria-label="Kiai">KIAI!<small>okrzyk</small></button>
   <div class="gm-nav" hidden><button data-g="prev" aria-label="Poprzedni ruch">${PREV}Wstecz</button><button data-g="auto">Auto</button><button data-g="next">Dalej${NEXT}</button></div></div>
  <div class="gm-scr" hidden></div>`;
 document.body.appendChild(root);
 cv=root.querySelector('.gm-cv');cx=cv.getContext('2d');
 els={fl:root.querySelector('.gm-fl'),bg:root.querySelector('.gm-bg'),hud:root.querySelector('.gm-hud'),bot:root.querySelector('.gm-bot'),cap:root.querySelector('.gm-cap'),hint:root.querySelector('.gm-hint'),grid:root.querySelector('.gm-grid'),
  kiai:root.querySelector('.gm-kiai'),nav:root.querySelector('.gm-nav'),scr:root.querySelector('.gm-scr'),ttlB:root.querySelector('.gm-ttl b'),ttlS:root.querySelector('.gm-ttl span'),barI:root.querySelector('.gm-bar i'),hearts:root.querySelector('.gm-hearts')};
 bgCur='';setBg(baseBg());
 playerImg=new Image();playerImg.src=lookSrc();
 document.documentElement.style.overflow='hidden';
 on(cv,'pointerdown',onDown);on(cv,'pointermove',onMove);on(cv,'pointerup',onUp);on(cv,'pointercancel',onUp);
 on(root,'click',onClick);on(root,'contextmenu',e=>e.preventDefault());
 on(window,'resize',layout);on(document,'visibilitychange',onVis);on(document,'keydown',onKey);
 layout();screenMenu();
 call('music',true);
}
function close(){
 stopLoop();clearStarT();hush();
 listeners.forEach(([t,ev,fn,opt])=>t.removeEventListener(ev,fn,opt));listeners=[];
 if(root){root.remove();root=null}
 const st=document.getElementById('gm-kata-css');if(st)st.remove();
 document.documentElement.style.overflow='';
 G=null;cv=null;cx=null;els={};ptr=null;floorC=null;floorKey='';bgCur='';
 call('music',false);
}
window.Games=window.Games||{};
window.Games.kata={open,close,get running(){return !!raf}};
})();

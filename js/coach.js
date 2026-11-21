// Droga wojownika – silnik analizy filmów (działa w całości w telefonie, nic nie jest wysyłane).
// Wykrywanie sylwetki: MediaPipe Pose Landmarker (lite). Ocena: reguły oparte na technice kyokushin.
import {FilesetResolver,PoseLandmarker} from '../vendor/mediapipe/vision_bundle.mjs';

const BASE=new URL('..',import.meta.url).href;
let L=null,loading=null,clock=0;

export function load(){
 if(L)return Promise.resolve(L);
 if(loading)return loading;
 loading=(async()=>{
  const fs=await FilesetResolver.forVisionTasks(BASE+'vendor/mediapipe/wasm');
  const opt=d=>({baseOptions:{modelAssetPath:BASE+'models/pose_landmarker_lite.task',delegate:d},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});
  try{L=await PoseLandmarker.createFromOptions(fs,opt('GPU'))}catch(e){L=await PoseLandmarker.createFromOptions(fs,opt('CPU'))}
  return L})();
 loading.catch(()=>{loading=null});
 return loading;
}

/* ---------- wideo ---------- */
function openVideo(file){return new Promise((res,rej)=>{
 const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.setAttribute('playsinline','');
 const to=setTimeout(()=>rej(new Error('Nie udało się otworzyć filmu.')),25000);
 v.onloadeddata=()=>{clearTimeout(to);res(v)};v.onerror=()=>{clearTimeout(to);rej(new Error('Ten format filmu nie jest obsługiwany.'))};
 v.src=URL.createObjectURL(file);v.load()})}
function seek(v,t){return new Promise(r=>{let done=false;const fin=()=>{if(done)return;done=true;v.removeEventListener('seeked',fin);r()};v.addEventListener('seeked',fin);setTimeout(fin,2500);v.currentTime=t})}
async function fixDuration(v){if(isFinite(v.duration)&&v.duration>0)return;await seek(v,1e7);await seek(v,0)}

async function track(v,fps,maxDur,onP){
 const dur=Math.min(v.duration,maxDur),n=Math.max(2,Math.floor(dur*fps)),F=[],b=clock+1000;
 for(let i=0;i<n;i++){
  const t=Math.min(i/fps,v.duration-0.02);await seek(v,t);
  clock=Math.max(clock+1,Math.round(b+t*1000));
  let r=null;try{r=L.detectForVideo(v,clock)}catch(e){}
  F.push({t,lm:r&&r.landmarks&&r.landmarks[0]||null,w:r&&r.worldLandmarks&&r.worldLandmarks[0]||null});
  if(i%2===0){onP&&onP((i+1)/n);await new Promise(z=>setTimeout(z,0))}
 }
 return smooth(F);
}
function smooth(F){return F.map((f,i)=>{if(!f.w)return f;const nb=[F[i-1],f,F[i+1]].filter(x=>x&&x.w);
 const w=f.w.map((p,k)=>({x:nb.reduce((a,x)=>a+x.w[k].x,0)/nb.length,y:nb.reduce((a,x)=>a+x.w[k].y,0)/nb.length,z:nb.reduce((a,x)=>a+x.w[k].z,0)/nb.length,visibility:p.visibility}));
 return{...f,w}})}

/* ---------- geometria ---------- */
const d3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});
const ang=(a,b,c)=>{const u=[a.x-b.x,a.y-b.y,a.z-b.z],v=[c.x-b.x,c.y-b.y,c.z-b.z],m=Math.hypot(...u)*Math.hypot(...v)||1;return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/m)))*180/Math.PI};
const lin=(x,a,b)=>Math.max(0,Math.min(1,(x-a)/(b-a)));
const med=a=>{const s=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN};
const avg=a=>{const s=a.filter(x=>x!=null&&isFinite(x));return s.length?s.reduce((x,y)=>x+y,0)/s.length:NaN};
function body(w){const sh=mid(w[11],w[12]),hp=mid(w[23],w[24]),torso=d3(sh,hp)||.45;
 const leg=((d3(w[23],w[25])+d3(w[25],w[27]))+(d3(w[24],w[26])+d3(w[26],w[28])))/2||.75;
 const lean=Math.atan2(Math.hypot(sh.x-hp.x,sh.z-hp.z),Math.max(.01,hp.y-sh.y))*180/Math.PI;
 return{sh,hp,torso,leg,lean,shW:d3(w[11],w[12])||.3}}
const LEG={L:{hip:23,kn:25,an:27,ft:31,he:29,sup:{kn:26,an:28}},R:{hip:24,kn:26,an:28,ft:32,he:30,sup:{kn:25,an:27}}};
const ARM={L:{sh:11,el:13,wr:15,o:16},R:{sh:12,el:14,wr:16,o:15}};
const SIDE={L:'lewa',R:'prawa'};

/* ---------- wykrywanie powtórzeń ---------- */
function segments(sig,hi,lo,minPeak,minLen){const ev=[];let i=0;
 while(i<sig.length){if(sig[i]!=null&&sig[i]>hi){let j=i,pk=i,gap=0;
   while(j<sig.length&&gap<3){if(sig[j]==null){gap++;j++;continue}if(sig[j]<=lo)break;gap=0;if(sig[j]>sig[pk])pk=j;j++}
   if(sig[pk]>=minPeak&&j-i>=minLen)ev.push({start:i,peak:pk,end:j});i=Math.max(j,i+1)}else i++}
 return ev}
function kickEvents(F,minPeak){const out=[];
 for(const s of['L','R']){const g=LEG[s];
  const sig=F.map(f=>{if(!f.w)return null;const b=body(f.w);return(f.w[g.sup.an].y-Math.min(f.w[g.an].y,f.w[g.ft].y))/b.leg});
  segments(sig,minPeak*.6,minPeak*.35,minPeak,2).forEach(e=>out.push({...e,side:s}))}
 return out.sort((a,b)=>a.peak-b.peak)}
function punchEvents(F,minReach){const out=[];
 for(const s of['L','R']){const a=ARM[s];
  const sig=F.map(f=>{if(!f.w)return null;const w=f.w,arm=d3(w[a.sh],w[a.el])+d3(w[a.el],w[a.wr])||.5;return d3(w[a.sh],w[a.wr])/arm});
  segments(sig,minReach-.06,minReach-.16,minReach,1).forEach(e=>out.push({...e,side:s}))}
 return out.sort((a,b)=>a.peak-b.peak)}

/* ---------- oceny ---------- */
function pickTips(checks){
 const fix=checks.filter(c=>c.s<.62&&c.fix).sort((a,b)=>(1-b.s)*b.wt-(1-a.s)*a.wt).slice(0,2).map(c=>c.fix);
 const good=checks.filter(c=>c.s>=.8&&c.good).sort((a,b)=>b.s*b.wt-a.s*a.wt).slice(0,2).map(c=>c.good);
 return{fix,good}}
const total=checks=>{const W=checks.reduce((a,c)=>a+c.wt,0)||1;return checks.reduce((a,c)=>a+c.s*c.wt,0)/W};
const pctTxt=s=>Math.round(s*100);
const fmt=(x,d=0)=>String(Math.round(x*10**d)/10**d).replace('.',',');

const KICK={
 mae:{min:.42,
  h:h=>lin(h,-.55,.05),hWord:'Celuj w brzuch (chudan) – kop trochę wyżej.',
  ext:e=>lin(e,125,160),ch:c=>lin(c,-.65,-.2),lean:l=>1-lin(l,32,58),wGuard:.15,wCh:.2},
 mawashi:{min:.42,
  h:h=>lin(h,-.45,.15),hWord:'Kop wyżej – mawashi chudan trafia w żebra.',
  ext:e=>lin(e,118,155),ch:c=>lin(c,-.65,-.2),lean:l=>1-lin(l,48,72),wGuard:.15,wCh:.2},
 low:{min:.24,
  h:(h,hk)=>hk<-.25?lin(hk,-.9,-.25):hk>1.35?1-lin(hk,1.35,2.3):1,hWord:null,
  ext:e=>lin(e,105,148),ch:c=>lin(c,-.85,-.45),lean:l=>1-lin(l,38,62),wGuard:.3,wCh:.08}
};

function analyzeKicks(F,fps,key){const K=KICK[key];const evs=kickEvents(F,K.min);
 if(!evs.length)return{error:'Nie widzę kopnięć na tym filmie. Stań bokiem do telefonu, cała w kadrze, i zrób kilka kopnięć.'};
 const reps=evs.map(e=>{const g=LEG[e.side],w=F[e.peak].w,b=body(w),hipY=b.hp.y,shY=b.sh.y,footY=Math.min(w[g.an].y,w[g.ft].y);
  const h=(hipY-footY)/Math.max(.05,hipY-shY),sk=w[g.sup.kn].y,hk=(sk-footY)/Math.max(.05,sk-hipY);
  const ext=ang(w[g.hip],w[g.kn],w[g.an]);
  let ch=-1;for(let k=e.start;k<=e.peak;k++){const ww=F[k].w;if(!ww)continue;const bb=body(ww),th=d3(ww[g.hip],ww[g.kn])||.35;ch=Math.max(ch,(bb.hp.y-ww[g.kn].y)/th)}
  const gt=shY+.3*b.torso,guard=(w[15].y<gt)+(w[16].y<gt);
  const level=h>=1.05?'jodan':h>=-.12?'chudan':'gedan';
  const s={h:K.h(h,hk),ext:K.ext(ext),ch:K.ch(ch),guard:guard===2?1:guard===1?.55:0,bal:K.lean(b.lean)};
  const sc=(s.h*.25+s.ext*.22+s.ch*K.wCh+s.guard*K.wGuard+s.bal*.15)/(.25+.22+K.wCh+K.wGuard+.15);
  return{...e,h,hk,ext,ch,guard,lean:b.lean,level,s,sc,time:(e.peak-e.start)/fps}});
 const A=k=>avg(reps.map(r=>r.s[k]));
 const best=reps.reduce((a,r)=>r.sc>a.sc?r:a,reps[0]);
 const lowTooHigh=key==='low'&&avg(reps.map(r=>r.hk))>1.35;
 const checks=[
  {k:'h',s:A('h'),wt:.25,label:key==='low'?'Wysokość (udo)':'Wysokość',
   good:key==='low'?'Low kick ładnie w udo – tak trzymaj!':best.level==='jodan'?'Wow, jodan! Kopiesz na wysokość głowy.':'Super wysokość kopnięcia!',
   fix:key==='low'?(lowTooHigh?'Low kick to kopnięcie w udo – celuj niżej, golenią.':'Celuj trochę wyżej – w udo przeciwnika.'):K.hWord},
  {k:'ext',s:A('ext'),wt:.22,label:key==='low'?'Siła nogi':'Wyprost nogi',good:key==='low'?'Noga mocno pracuje – fajny zamach.':'Noga ładnie wyprostowana!',fix:key==='low'?'Kop całą nogą, z obrotem biodra – nie tylko z kolana.':'Wyprostuj nogę do końca w momencie uderzenia.'},
  {k:'ch',s:A('ch'),wt:K.wCh,label:'Kolano w górę',good:'Świetnie podnosisz kolano przed kopnięciem.',fix:'Najpierw podnieś wysoko kolano, dopiero potem kopnij.'},
  {k:'guard',s:A('guard'),wt:K.wGuard,label:'Garda',good:'Ręce wysoko przy kopnięciu – brawo!',fix:'Nie opuszczaj rąk! Przy kopnięciu pięści zostają przy twarzy.'},
  {k:'bal',s:A('bal'),wt:.15,label:'Równowaga',good:'Stabilnie stoisz na nodze podporowej.',fix:key==='mae'?'Nie odchylaj się tak mocno do tyłu – plecy prościej.':'Trochę mniej przechylaj się w bok – łatwiej utrzymasz równowagę.'}
 ];
 const sides=['L','R'].map(s=>reps.filter(r=>r.side===s)).filter(a=>a.length);
 if(sides.length===2){const [a,b]=sides.map(a=>avg(a.map(r=>r.sc)));const weak=a<b?'lewa':'prawa',diff=Math.abs(a-b);
  checks.push({k:'sym',s:1-lin(diff,.08,.25),wt:.08,label:'Obie nogi',good:'Obie nogi kopią równo – super!',fix:`Twoja ${weak} noga kopie słabiej – poćwicz ją trochę więcej.`})}
 const sc=total(checks),tips=pickTips(checks);
 const nL=reps.filter(r=>r.side==='L').length,nR=reps.length-nL;
 return{score:sc,checks,tips,best:best.peak,hl:best.side,reps:reps.length,
  facts:[`${reps.length} ${reps.length===1?'kopnięcie':reps.length<5?'kopnięcia':'kopnięć'} (lewa: ${nL}, prawa: ${nR})`,`Najlepsze: ${SIDE[best.side]} noga, ${key==='low'?'na wysokości uda':best.level}`,`Czas kopnięcia: ${fmt(avg(reps.map(r=>r.time)),2)} s`],
  extra:{level:best.level,time:avg(reps.map(r=>r.time))}}}

function analyzePunch(F,fps){const evs=punchEvents(F,.9);
 if(!evs.length)return{error:'Nie widzę ciosów. Stań bokiem do telefonu i uderzaj do przodu, w bok kadru.'};
 const reps=evs.map(e=>{const a=ARM[e.side],w=F[e.peak].w,b=body(w);
  const ext=ang(w[a.sh],w[a.el],w[a.wr]),hp=(w[a.wr].y-b.sh.y)/Math.max(.05,b.hp.y-b.sh.y);
  const oArm=d3(w[a.o],w[a.o-2])+d3(w[a.o-2],w[a.o-4])||.5,oReach=d3(w[a.o-4],w[a.o])/oArm;
  const hik=(w[a.o].y>b.sh.y+.15*b.torso?.5:0)+(oReach<.62?.5:0);
  const s={ext:lin(ext,138,168),h:hp<-.2?lin(hp,-.8,-.2):hp>.85?1-lin(hp,.85,1.4):1,hik,post:1-lin(b.lean,12,30)};
  return{...e,ext,hp,hik,s,sc:(s.ext*.35+s.h*.25+s.hik*.25+s.post*.15),time:(e.peak-e.start)/fps}});
 const A=k=>avg(reps.map(r=>r.s[k])),best=reps.reduce((a,r)=>r.sc>a.sc?r:a,reps[0]),tooHigh=avg(reps.map(r=>r.hp))<-.2;
 const checks=[
  {k:'ext',s:A('ext'),wt:.35,label:'Wyprost ręki',good:'Pełny wyprost ręki – mocny cios!',fix:'Wyprostuj rękę do końca – pięść leci prosto do celu.'},
  {k:'h',s:A('h'),wt:.25,label:'Cel (chudan)',good:'Celujesz idealnie w środek korpusu.',fix:tooHigh?'Celuj trochę niżej – seiken chudan to cios w korpus.':'Celuj wyżej – w środek klatki piersiowej.'},
  {k:'hik',s:A('hik'),wt:.25,label:'Hikite',good:'Hikite jak u mistrzyni – druga ręka wraca do boku!',fix:'Druga ręka wraca szybko do boku (hikite) – to dodaje ciosowi siły.'},
  {k:'post',s:A('post'),wt:.15,label:'Postawa',good:'Plecy proste przy ciosach – tak trzymaj.',fix:'Plecy prosto, nie pochylaj się do przodu przy ciosie.'}];
 const nL=reps.filter(r=>r.side==='L').length;
 return{score:total(checks),checks,tips:pickTips(checks),best:best.peak,hl:'A'+best.side,reps:reps.length,
  facts:[`${reps.length} ${reps.length===1?'cios':reps.length<5?'ciosy':'ciosów'} (lewa: ${nL}, prawa: ${reps.length-nL})`,`Najlepszy cios: ${SIDE[best.side]} ręka`]}}

function core(F){const a=Math.floor(F.length*.2),b=Math.ceil(F.length*.8);const c=F.slice(a,b).filter(f=>f.w);return c.length>=3?c:F.filter(f=>f.w)}
function analyzeZenkutsu(F){const C=core(F);if(C.length<3)return{error:'Za mało klatek z widoczną sylwetką.'};
 const M=C.map(f=>{const w=f.w,b=body(w),aL=ang(w[23],w[25],w[27]),aR=ang(w[24],w[26],w[28]);return{len:Math.hypot(w[27].x-w[28].x,w[27].z-w[28].z)/b.leg,front:Math.min(aL,aR),back:Math.max(aL,aR),lean:b.lean,hx:f.lm?(f.lm[23].x+f.lm[24].x)/2:null,fl:aL<aR?'L':'R'}});
 const len=med(M.map(m=>m.len)),front=med(M.map(m=>m.front)),back=med(M.map(m=>m.back)),lean=med(M.map(m=>m.lean));
 const hx=M.map(m=>m.hx).filter(x=>x!=null),mu=avg(hx),sd=Math.sqrt(avg(hx.map(x=>(x-mu)**2)));
 const sF=front<=128?(front>=88?1:lin(front,60,88)):1-lin(front,128,162);
 const checks=[
  {k:'len',s:lin(len,.7,1.08),wt:.3,label:'Długość pozycji',good:'Długa, mocna pozycja – super!',fix:'Zrób dłuższy krok – zenkutsu dachi ma być długa i niska.'},
  {k:'front',s:sF,wt:.3,label:'Przednie kolano',good:'Przednie kolano ugięte idealnie.',fix:front>128?'Mocniej ugnij przednie kolano – kolano nad palcami stopy.':'Nie wychodź kolanem przed palce stopy.'},
  {k:'back',s:lin(back,145,166),wt:.2,label:'Tylna noga',good:'Tylna noga prosta jak strzała!',fix:'Wyprostuj tylną nogę – prosta jak strzała.'},
  {k:'post',s:1-lin(lean,10,25),wt:.12,label:'Plecy',good:'Plecy pionowo – piękna postawa.',fix:'Plecy pionowo, głowa wysoko – nie pochylaj się.'},
  {k:'still',s:1-lin(sd,.012,.05),wt:.08,label:'Spokój',good:'Stoisz stabilnie jak skała.',fix:'Stój nieruchomo – pozycja ma być stabilna.'}];
 return{score:total(checks),checks,tips:pickTips(checks),best:F.indexOf(C[Math.floor(C.length/2)]),hl:'LEGS',facts:[`Długość pozycji: ${fmt(len*100)}% długości nogi`,`Kąt przedniego kolana: ${fmt(front)}°`]}}

function analyzeKiba(F){const C=core(F);if(C.length<3)return{error:'Za mało klatek z widoczną sylwetką.'};
 const M=C.map(f=>{const w=f.w,b=body(w);const ad=Math.hypot(w[27].x-w[28].x,w[27].z-w[28].z),kd=Math.hypot(w[25].x-w[26].x,w[25].z-w[26].z);
  return{wid:ad/b.shW,knee:(ang(w[23],w[25],w[27])+ang(w[24],w[26],w[28]))/2,out:kd/Math.max(.05,ad),lean:b.lean,hx:f.lm?(f.lm[23].x+f.lm[24].x)/2:null}});
 const wid=med(M.map(m=>m.wid)),knee=med(M.map(m=>m.knee)),out=med(M.map(m=>m.out)),lean=med(M.map(m=>m.lean));
 const hx=M.map(m=>m.hx).filter(x=>x!=null),mu=avg(hx),sd=Math.sqrt(avg(hx.map(x=>(x-mu)**2)));
 const sK=knee>142?1-lin(knee,142,172):knee<95?lin(knee,70,95):1;
 const checks=[
  {k:'wid',s:lin(wid,1.3,1.9),wt:.28,label:'Szerokość',good:'Szeroko rozstawione stopy – idealnie.',fix:'Stopy szerzej – mniej więcej dwie szerokości barków.'},
  {k:'knee',s:sK,wt:.32,label:'Głębokość',good:'Nisko jak prawdziwy jeździec!',fix:knee>142?'Zejdź niżej – ugnij mocniej kolana, jakbyś siedziała na koniu.':'Trochę za nisko – podnieś się odrobinę.'},
  {k:'out',s:lin(out,.62,.9),wt:.2,label:'Kolana na zewnątrz',good:'Kolana ładnie na zewnątrz.',fix:'Wypchnij kolana na zewnątrz, nie zbliżaj ich do środka.'},
  {k:'post',s:1-lin(lean,8,20),wt:.12,label:'Plecy',good:'Plecy proste – świetnie.',fix:'Plecy prosto, nie wypinaj pupy do tyłu.'},
  {k:'still',s:1-lin(sd,.012,.05),wt:.08,label:'Spokój',good:'Stabilnie jak skała.',fix:'Stój nieruchomo – pozycja ma być stabilna.'}];
 return{score:total(checks),checks,tips:pickTips(checks),best:F.indexOf(C[Math.floor(C.length/2)]),hl:'LEGS',facts:[`Szerokość: ${fmt(wid,1)} × szerokość barków`,`Kąt kolan: ${fmt(knee)}°`]}}

function analyzeShadow(F,fps){const V=F.filter(f=>f.w&&f.lm);if(V.length<5)return{error:'Za mało klatek z widoczną sylwetką.'};
 let up=0;V.forEach(f=>{const b=body(f.w),g=b.sh.y+.32*b.torso;if(f.w[15].y<g&&f.w[16].y<g)up++});const guard=up/V.length;
 let path=0;for(let i=1;i<V.length;i++){const a=V[i-1].lm,b=V[i].lm,bh=Math.abs(((a[27].y+a[28].y)/2)-((a[11].y+a[12].y)/2))||.4;path+=Math.abs(((b[23].x+b[24].x)-(a[23].x+a[24].x))/2)/bh}
 const dur=(V[V.length-1].t-V[0].t)||1,mob=path/dur;
 const acts=kickEvents(F,.3).length+punchEvents(F,.86).length,rate=acts/dur*10;
 const checks=[
  {k:'guard',s:lin(guard,.35,.8),wt:.45,label:'Garda',good:`Ręce wysoko przez ${pctTxt(guard)}% czasu – brawo!`,fix:`Ręce były wysoko tylko przez ${pctTxt(guard)}% czasu. Pięści przy brodzie przez całą walkę!`},
  {k:'mob',s:lin(mob,.04,.22),wt:.3,label:'Praca nóg',good:'Super praca nóg – ciągle w ruchu!',fix:'Więcej ruchu na nogach – krok w bok, do przodu, do tyłu.'},
  {k:'act',s:lin(rate,1,5),wt:.25,label:'Aktywność',good:'Dużo akcji – świetne tempo!',fix:'Więcej technik – łącz ciosy z kopnięciami.'}];
 return{score:total(checks),checks,tips:pickTips(checks),best:F.indexOf(V[Math.floor(V.length/2)]),hl:'ALL',facts:[`Garda wysoko: ${pctTxt(guard)}% czasu`,`Technik: ${acts} w ${fmt(dur)} s`]}}

function analyzeKata(F,fps){const V=F.filter(f=>f.w&&f.lm);if(V.length<8)return{error:'Za mało klatek z widoczną sylwetką.'};
 const depth=1-med(V.map(f=>{const b=body(f.w);return(Math.max(f.w[27].y,f.w[28].y)-b.hp.y)/b.leg}));
 const mv=[];for(let i=1;i<V.length;i++){const a=V[i-1].lm,b=V[i].lm;let s=0;for(const k of[15,16,27,28,23,24])s+=Math.hypot(b[k].x-a[k].x,b[k].y-a[k].y);mv.push(s/((V[i].t-V[i-1].t)||.1))}
 const thr=med(mv)*.45;let kime=0,run=0,moved=false;mv.forEach(m=>{if(m<thr){run++;if(run===Math.max(2,Math.round(.3*fps))&&moved){kime++;moved=false}}else{run=0;if(m>thr*2)moved=true}});
 const dur=V[V.length-1].t-V[0].t,tail=mv.slice(-Math.max(3,Math.round(fps))),zan=avg(tail)<thr*1.2;
 const lean=med(V.map(f=>body(f.w).lean));
 const checks=[
  {k:'depth',s:lin(depth,.03,.13),wt:.35,label:'Niskie pozycje',good:'Nisko i stabilnie w pozycjach!',fix:'Schodź niżej w pozycjach – niskie pozycje to mocne kata.'},
  {k:'kime',s:lin(kime/Math.max(1,dur/3),.3,1),wt:.3,label:'Rytm i kime',good:'Świetny rytm i zatrzymania po technikach!',fix:'Zatrzymaj się na mgnienie oka po każdej technice (kime) – kata ma rytm.'},
  {k:'zan',s:zan?1:.3,wt:.15,label:'Zanshin',good:'Piękny spokojny koniec – zanshin!',fix:'Na końcu kata stój chwilę spokojnie i czujnie (zanshin).'},
  {k:'post',s:1-lin(lean,12,28),wt:.2,label:'Plecy',good:'Proste plecy przez całą kata.',fix:'Pilnuj prostych pleców w każdej pozycji.'}];
 return{score:total(checks),checks,tips:pickTips(checks),best:F.indexOf(V[Math.floor(V.length*.5)]),hl:'ALL',facts:[`Czas kata: ${fmt(dur)} s`,`Zatrzymań (kime): ${kime}`],extra:{dur}}}

/* ---------- kadr ze szkieletem ---------- */
const EDGES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32],[27,29],[28,30],[29,31],[30,32]];
function hlSet(h){const s=new Set();if(h==='L')[23,25,27,29,31].forEach(x=>s.add(x));if(h==='R')[24,26,28,30,32].forEach(x=>s.add(x));
 if(h==='AL')[11,13,15].forEach(x=>s.add(x));if(h==='AR')[12,14,16].forEach(x=>s.add(x));if(h==='LEGS')[23,24,25,26,27,28,29,30,31,32].forEach(x=>s.add(x));
 if(h==='ALL')for(let i=11;i<33;i++)s.add(i);return s}
async function snap(v,f,hl){await seek(v,f.t);const vw=v.videoWidth,vh=v.videoHeight,lm=f.lm;
 let x0=1,y0=1,x1=0,y1=0;lm.forEach((p,i)=>{if(i<11&&i!==0)return;if((p.visibility??1)<.3)return;x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y)});
 const bw=(x1-x0)*vw,bh=(y1-y0)*vh,sz=Math.min(Math.max(vw,vh),Math.max(bw,bh)*1.28+20),cx=(x0+x1)/2*vw,cy=(y0+y1)/2*vh;
 let sx=Math.max(0,Math.min(vw-sz,cx-sz/2)),sy=Math.max(0,Math.min(vh-sz,cy-sz/2));const S=360,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
 g.fillStyle='#05070b';g.fillRect(0,0,S,S);g.drawImage(v,sx,sy,sz,sz,0,0,S*Math.min(1,vw/sz),S*Math.min(1,vh/sz));
 const P=i=>[(lm[i].x*vw-sx)/sz*S,(lm[i].y*vh-sy)/sz*S],H=hlSet(hl);g.lineCap='round';
 for(const pass of[0,1])for(const[a,b]of EDGES){const on=H.has(a)&&H.has(b);if(on!==!!pass)continue;g.strokeStyle=on?'#f2c14e':'rgba(255,255,255,.75)';g.lineWidth=on?6:3;g.beginPath();g.moveTo(...P(a));g.lineTo(...P(b));g.stroke()}
 for(let i=11;i<33;i++){if(i>16&&i<23)continue;const[x,y]=P(i);g.fillStyle=H.has(i)?'#ffe08a':'#fff';g.beginPath();g.arc(x,y,H.has(i)?5:3.5,0,7);g.fill()}
 return c.toDataURL('image/jpeg',.8)}

/* ---------- główna funkcja ---------- */
const CFG={mae:{fps:15,max:20,fn:(F,f)=>analyzeKicks(F,f,'mae'),side:true},mawashi:{fps:15,max:20,fn:(F,f)=>analyzeKicks(F,f,'mawashi'),side:true},low:{fps:15,max:20,fn:(F,f)=>analyzeKicks(F,f,'low'),side:true},
 tsuki:{fps:15,max:20,fn:analyzePunch,side:true},zenkutsu:{fps:8,max:20,fn:analyzeZenkutsu,side:true},kiba:{fps:8,max:20,fn:analyzeKiba},kamae:{fps:10,max:45,fn:analyzeShadow},kata:{fps:8,max:120,fn:analyzeKata}};

export async function analyze(file,drill,onP=()=>{}){
 const cfg=CFG[drill];if(!cfg)throw new Error('Nieznane ćwiczenie');
 onP(0,'Budzę trenera…');await load();
 onP(.02,'Otwieram film…');const v=await openVideo(file);
 try{await fixDuration(v);
  const F=await track(v,cfg.fps,cfg.max,p=>onP(.03+p*.9,'Oglądam Twój film…'));
  const valid=F.filter(f=>f.w).length/F.length;
  if(valid<.45)return{error:'Nie widzę Cię dobrze na filmie. Stań tak, żeby cała sylwetka była w kadrze, i nagraj przy dobrym świetle.'};
  const warn=[];const V=F.filter(f=>f.lm);
  const ankVis=avg(V.map(f=>Math.min(f.lm[27].visibility??1,f.lm[28].visibility??1)));if(ankVis<.45)warn.push('Słabo widzę Twoje stopy – następnym razem odsuń telefon dalej.');
  if(cfg.side){const r=med(V.map(f=>Math.abs(f.lm[11].x-f.lm[12].x)/Math.max(.02,Math.abs((f.lm[23].y+f.lm[24].y)/2-(f.lm[11].y+f.lm[12].y)/2))));if(r>.62)warn.push('To ćwiczenie najlepiej nagrywać z boku – wtedy dokładniej ocenię technikę.')}
  onP(.94,'Sprawdzam technikę…');
  const R=cfg.fn(F,cfg.fps);if(R.error)return R;
  const bi=Math.max(0,Math.min(F.length-1,R.best));let fi=bi;if(!F[fi].lm){fi=F.findIndex(f=>f.lm)}
  onP(.97,'Robię zdjęcie…');const img=await snap(v,F[fi],R.hl);
  const score=Math.round(R.score*100);
  onP(1,'Gotowe!');
  return{score,stars:score>=90?5:score>=75?4:score>=60?3:score>=40?2:1,checks:R.checks.map(c=>({k:c.k,label:c.label,p:Math.round(c.s*100)})),
   good:R.tips.good,fix:R.tips.fix,facts:R.facts,warn,img,reps:R.reps||0,extra:R.extra||{},dur:v.duration};
 }finally{URL.revokeObjectURL(v.src)}
}

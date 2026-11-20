'use strict';
/* ============================================================
   Tafel-Spiele – Kern (läuft auf der Tafel)
   Verbindung zu den iPads, Lobby, Runden, Anzeige an den Rändern.
   Die einzelnen Spiele stehen in eigenen Dateien (js/*.js) und
   melden sich mit GAMES.push({...}) an.
   ============================================================ */

// ---------- Einstellungen ----------
const MAX_PLAYERS = 8;
const W = 1600, H = 900, CX = W/2, CY = H/2;
const CAR_BASE = 22;                 // Grundgröße der Autos
let CAR_R = CAR_BASE;                // aktueller Radius (wird von der Größen-Einstellung verändert)
const CAR_SCALES = [['klein',.8],['normal',1],['groß',1.35],['riesig',1.7]];
let carScaleIdx = 1, carScale = 1;
function cycleCarScale(){ carScaleIdx=(carScaleIdx+1)%CAR_SCALES.length; carScale=CAR_SCALES[carScaleIdx][1]; CAR_R=CAR_BASE*carScale; }
const FX0 = 110, FX1 = 1490, FY0 = 90, FY1 = 810;   // Spielfeld-Rechteck (Ballspiele, Tron, Münzen)
const ID_PREFIX = 'tafel-spiele-vb-';

const COLORS = [
  ['Hellblau','#4DB2E6'],['Gelb','#FFD100'],['Grün','#46A84A'],['Orange','#F39200'],
  ['Hellgrün','#A6D27A'],['Silber','#B9C1C8'],['Weiß','#FFFFFF'],['Zinnober','#EF6B45']
];
const TEAMS = [{name:'Links',color:'#4DB2E6'},{name:'Rechts',color:'#F39200'}];
// Plätze rund um die Tafel; rot = Drehung der Anzeige zum Spieler hin
const SEATS = [
  {side:'unten', x:.50,y:1,  rot:0},
  {side:'oben',  x:.50,y:0,  rot:Math.PI},
  {side:'links', x:0,  y:.50,rot:Math.PI/2},
  {side:'rechts',x:1,  y:.50,rot:-Math.PI/2},
  {side:'unten', x:.82,y:1,  rot:0},
  {side:'oben',  x:.18,y:0,  rot:Math.PI},
  {side:'links', x:0,  y:.22,rot:Math.PI/2},
  {side:'rechts',x:1,  y:.82,rot:-Math.PI/2},
];

// ---------- Hilfsfunktionen ----------
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
function angDiff(a,b){let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;}
function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

// ---------- Canvas ----------
const cv=document.getElementById('c'); let ctx=cv.getContext('2d');
let scale=1,offX=0,offY=0;
const QS=new URLSearchParams(location.search);
// Auflösung: Die Tafel wählt automatisch die schärfste Stufe, die flüssig läuft (hoch und runter).
// ?cap=1920 stellt eine feste Breite ein und schaltet die Automatik aus.
const Q_LEVELS=[800,960,1280,1920,2560,3840];   // mögliche Breiten der Zeichenfläche in Pixeln
const manualCap=+QS.get('cap')||0;
let qi=3, capW=manualCap||1920;
let lowFx=false, showFps=QS.has('debug'), ftAvg=16, fpsNote='';
const nativeW=()=>Math.round(cv.getBoundingClientRect().width*(devicePixelRatio||1));
(function initQuality(){   // Start: so scharf wie die Tafel, höchstens 2560; Automatik probiert später weiter
  if(manualCap) return;
  const n=nativeW()||1920; qi=0;
  for(let i=0;i<Q_LEVELS.length;i++) if(Q_LEVELS[i]<=Math.min(n,2560)) qi=i;
  capW=Q_LEVELS[qi];
})();
function resize(){
  // Größe aus dem tatsächlich sichtbaren Bereich nehmen (iPad-Safari: 100vh ist höher als der sichtbare Teil)
  let d=devicePixelRatio||1; const r=cv.getBoundingClientRect();
  if(r.width*d>capW) d=capW/r.width;
  cv.width=Math.max(2,Math.round(r.width*d)); cv.height=Math.max(2,Math.round(r.height*d));
  scale=Math.min(cv.width/W,cv.height/H);
  offX=(cv.width-W*scale)/2; offY=(cv.height-H*scale)/2;
}
addEventListener('resize',resize); addEventListener('orientationchange',()=>setTimeout(resize,200));
if(window.visualViewport) visualViewport.addEventListener('resize',resize);
if(window.ResizeObserver) new ResizeObserver(()=>resize()).observe(cv);   // auch wenn die Fläche erst später ihre Größe bekommt
resize();
// Ebenen für Zwischenspeicher (Spuren, Boden, Farbe …): bei hoher Auflösung feiner, sonst bleiben sie unscharf
function layerScale(){ return scale>=1.5?2:(scale>=1.1?1.5:1); }
function mkLayer(w,h){
  const ls=layerScale(), c=document.createElement('canvas');
  c.width=Math.round(w*ls); c.height=Math.round(h*ls);
  const x=c.getContext('2d'); x.setTransform(ls,0,0,ls,0,0);
  return {c,x,ls};
}

// ---------- Ton ----------
let ac=null;
function audioInit(){
  try{ if(!ac) ac=new (window.AudioContext||window.webkitAudioContext)(); if(ac.state==='suspended') ac.resume(); }catch(e){}
}
function beep(f,d=.12,type='square',vol=.07,slide=0){
  if(!ac) return;
  try{
    const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;
    o.type=type; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+d);
  }catch(e){}
}

// ---------- Zustand ----------
const GAMES=[];
let game=null;
const gameState={};            // gameState[id]={opts:{...},target:n}
const players=new Array(MAX_PLAYERS).fill(null);
let phase='lobby', phaseT=0, roundNo=0, lastCount=0, homeConfirm=0;
let winners=[], roundText='', roundColor='#E8F1F8';
let champions=[], championLabel='', championColor='#E8F1F8';
let particles=[], shake=0, bumpCd=0, buttons=[];
const ZERO={s:0,g:0,t:0};

const present=()=>players.filter(Boolean);
const inRound=()=>players.filter(p=>p&&p.car);
const cname=s=>COLORS[s][0];
const opt=k=>gameState[game.id].opts[k];
const curTarget=()=>gameState[game.id].target;

function selectGame(g){
  game=g;
  if(!gameState[g.id]){
    const o={}; for(const d of (g.options||[])) o[d.key]=d.def;
    gameState[g.id]={opts:o,target:g.defTarget||3};
  }
}

// ---------- Spieler ----------
function addPlayer(extra){
  const i=players.findIndex(p=>!p);
  if(i<0) return null;
  const p=Object.assign({seat:i,color:COLORS[i][1],score:0,input:{s:0,g:0,t:0},lastIn:0,
    conn:null,mode:'tilt',car:null,team:null,discAt:0,lastMsg:''},extra||{});
  players[i]=p;
  return p;
}
function addBot(){ const p=addPlayer({bot:true,mode:'bot'}); if(p) beep(520,.08); }
function removeBot(){ for(let i=MAX_PLAYERS-1;i>=0;i--) if(players[i]&&players[i].bot){players[i]=null;return;} }
function assignTeams(){
  const ps=present().sort((a,b)=>a.seat-b.seat);
  ps.forEach((p,i)=>p.team=game.teams?i%2:null);
}
function assignLate(p){
  const n=[0,0]; for(const q of present()) if(q.team!=null) n[q.team]++;
  p.team=n[0]<=n[1]?0:1;
}

// ---------- Netzwerk (PeerJS: iPad -> Tafel direkt) ----------
let peer=null, room='', peerReady=false, netStatus='Verbinde …', qrCanvas=null, joinUrl='';
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ';
function genCode(){let s='';for(let i=0;i<4;i++)s+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];return s;}
function makeQR(url){
  try{
    const qr=qrcode(0,'M'); qr.addData(url); qr.make();
    const n=qr.getModuleCount(), cell=8, q=3, size=(n+q*2)*cell;
    const c=document.createElement('canvas'); c.width=c.height=size;
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,size,size); g.fillStyle='#000';
    for(let r=0;r<n;r++)for(let k=0;k<n;k++) if(qr.isDark(r,k)) g.fillRect((k+q)*cell,(r+q)*cell,cell,cell);
    return c;
  }catch(e){ console.error(e); return null; }
}
function startPeer(){
  if(peer){ try{peer.destroy();}catch(e){} }
  peerReady=false; netStatus='Verbinde mit Vermittlungsserver …';
  room=genCode();
  peer=new Peer(ID_PREFIX+room);
  peer.on('open',()=>{
    peerReady=true; netStatus='';
    joinUrl=new URL('play.html?room='+room, location.href).href;
    qrCanvas=makeQR(joinUrl);
  });
  peer.on('connection',conn=>{
    conn.on('data',d=>onMsg(conn,d));
    conn.on('close',()=>onClose(conn));
    conn.on('error',()=>onClose(conn));
  });
  peer.on('disconnected',()=>{ try{peer.reconnect();}catch(e){} });
  peer.on('error',e=>{
    if(e.type==='unavailable-id'){ startPeer(); return; }
    netStatus='Netzwerkfehler: '+e.type;
    if(e.type==='network'||e.type==='server-error'||e.type==='socket-error') setTimeout(startPeer,4000);
  });
}
function send(conn,obj){ try{ if(conn&&conn.open) conn.send(obj); }catch(e){} }
function playerOf(conn){ return players.find(p=>p&&p.conn===conn)||null; }

function onMsg(conn,d){
  if(!d||typeof d!=='object') return;
  if(d.k==='join'){
    let p=players.find(q=>q&&!q.bot&&q.token&&q.token===d.token);
    if(p){ if(p.conn&&p.conn!==conn){ try{p.conn.close();}catch(e){} } }
    else { p=addPlayer({token:d.token}); if(!p){ send(conn,{k:'full'}); return; } }
    p.conn=conn; p.discAt=0; p.lastIn=0; p.lastMsg='';
    if(d.mode) p.mode=d.mode;
    send(conn,{k:'seat',seat:p.seat,color:p.color,name:cname(p.seat),side:SEATS[p.seat].side});
    beep(700,.08,'triangle'); beep(900,.1,'triangle');
  } else if(d.k==='in'){
    const p=playerOf(conn); if(!p) return;
    p.input={s:clamp(+d.s||0,-1,1),g:clamp(+d.g||0,-1,1),t:d.t?1:0,
      j:Array.isArray(d.j)?[clamp(+d.j[0]||0,-1,1),clamp(+d.j[1]||0,-1,1)]:null};
    p.lastIn=performance.now();
  } else if(d.k==='mode'){
    const p=playerOf(conn); if(p&&(d.mode==='touch'||d.mode==='tilt'||d.mode==='joy')) p.mode=d.mode;
  }
  // Start und Neustart gibt es nur an der Tafel.
}
function onClose(conn){
  const p=playerOf(conn);
  if(p){ p.conn=null; p.discAt=performance.now(); p.input={s:0,g:0,t:0}; }
}
let pushT=0;
function pushState(dt){
  pushT-=dt; if(pushT>0) return; pushT=.2;
  for(const p of players){
    if(!p||!p.conn) continue;
    const c=p.car;
    const msg={k:'st',phase,game:game.id,hint:game.hint||'',noGas:!!game.noGas,noPedals:!!game.noPedals,turboLabel:game.turboLabel||'',turboHold:!!game.holdT,
      alive:!!c&&!c.falling&&!c.dead,inRound:!!c&&phase!=='lobby',
      score:p.score,target:curTarget(),won:winners.includes(p),winnerName:roundText,
      champ:champions.includes(p),championName:championLabel,me:p.seat,n:present().length};
    const s=JSON.stringify(msg);
    if(s!==p.lastMsg){ p.lastMsg=s; send(p.conn,msg); }
  }
}

// ---------- Gemeinsame Physik ----------
// Auto-Antrieb: Gas, Lenken, Rutschen. P überschreibt Standardwerte.
function drive(c,inp,dt,P){
  P=P||{};
  const A=P.accel||430, RV=P.rev||300, DR=P.drag||1.4, GR=P.grip||5, TR=P.turn||3.1;
  const fx=Math.cos(c.a), fy=Math.sin(c.a), sx=-fy, sy=fx;
  let vf=c.vx*fx+c.vy*fy, vs=c.vx*sx+c.vy*sy;
  const turnFac=clamp(Math.abs(vf)/110,P.minTurn||.3,1)*(vf<-10?-1:1);
  c.a+=inp.s*TR*turnFac*dt;
  vf+=inp.g*(inp.g>0?A:RV)*dt;
  vf-=vf*DR*dt;
  vs-=vs*GR*dt;
  c.turboCd=(c.turboCd||0)-dt; c.turboFx=(c.turboFx||0)-dt;
  if(inp.t&&c.turboCd<=0){ vf=Math.max(vf,0)+(P.turboV||430); c.turboCd=3; c.turboFx=.4; beep(300,.18,'sawtooth',.06,500); }
  const nfx=Math.cos(c.a), nfy=Math.sin(c.a);
  c.vx=nfx*vf-nfy*vs; c.vy=nfy*vf+nfx*vs;
  c.x+=c.vx*dt; c.y+=c.vy*dt;
}
function impactFx(x,y,v){
  if(v>90){
    sparks(x,y,Math.min(14,Math.floor(v/30)));
    shake=Math.max(shake,Math.min(10,v/40));
    if(bumpCd<=0){beep(130,.12,'sawtooth',.1,-60);bumpCd=.08;}
  }
}
// Zwei Kreise stoßen (Massen a.m, b.m; Standard 1). Gibt die Aufprallgeschwindigkeit zurück.
function collideCircles(a,b,ra,rb,e){
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy); const R=ra+rb;
  if(d>=R) return 0;
  if(d<.001){dx=1;dy=0;d=1;}
  const nx=dx/d,ny=dy/d,ov=R-d,ma=a.m||1,mb=b.m||1,tot=ma+mb;
  a.x-=nx*ov*mb/tot;a.y-=ny*ov*mb/tot;b.x+=nx*ov*ma/tot;b.y+=ny*ov*ma/tot;
  const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(vn>=0) return 0;
  const j=-(1+e)*vn/(1/ma+1/mb);
  a.vx-=j*nx/ma;a.vy-=j*ny/ma;b.vx+=j*nx/mb;b.vy+=j*ny/mb;
  return -vn;
}
// Kreis (c,r) gegen feste Kapsel (Strecke a-b mit Dicke cap.r). Pfeiler: a=b.
function collideCapsule(c,r,cap,e){
  const abx=cap.bx-cap.ax,aby=cap.by-cap.ay,l2=abx*abx+aby*aby;
  let t=l2>0?((c.x-cap.ax)*abx+(c.y-cap.ay)*aby)/l2:0; t=clamp(t,0,1);
  const px=cap.ax+abx*t,py=cap.ay+aby*t;
  let dx=c.x-px,dy=c.y-py,d=Math.hypot(dx,dy); const R=r+cap.r;
  if(d>=R) return 0;
  if(d<.001){dx=1;dy=0;d=1;}
  const nx=dx/d,ny=dy/d;
  c.x=px+nx*R; c.y=py+ny*R;
  const vn=c.vx*nx+c.vy*ny;
  if(vn>=0) return 0;
  c.vx-=(1+e)*vn*nx; c.vy-=(1+e)*vn*ny;
  return -vn;
}
// Auto innerhalb eines Rechtecks halten
function keepInRect(c,r,x0,y0,x1,y1,e){
  if(c.x<x0+r){c.x=x0+r;c.vx=Math.abs(c.vx)*e;}
  if(c.x>x1-r){c.x=x1-r;c.vx=-Math.abs(c.vx)*e;}
  if(c.y<y0+r){c.y=y0+r;c.vy=Math.abs(c.vy)*e;}
  if(c.y>y1-r){c.y=y1-r;c.vy=-Math.abs(c.vy)*e;}
}

// ---------- Effekte ----------
function confetti(x,y,n,color){
  if(lowFx) n=Math.ceil(n/3);
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2), v=rand(120,520);
    particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-200,life:rand(1.2,2.4),g:500,
      c:Math.random()<.5?color:COLORS[Math.floor(rand(0,COLORS.length))][1],s:rand(6,12),rot:rand(0,6)});
  }
}
function sparks(x,y,n,color){
  if(lowFx) n=Math.ceil(n/2);
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2), v=rand(80,320);
    particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.2,.5),g:0,c:color||'#FFD100',s:4,rot:0,spark:true});
  }
}

// ---------- Eingaben (iPad oder Bot) ----------
// Bot-Stärke: schwächere Bots reagieren langsamer, lenken ungenauer und fahren nicht Vollgas.
const BOT_LEVELS=[
  {name:'leicht',delay:.30,steer:.65,gas:.55,noise:.5, turbo:0},
  {name:'mittel',delay:.15,steer:.85,gas:.80,noise:.25,turbo:.35},
  {name:'schwer',delay:0,  steer:1,  gas:1,  noise:0,  turbo:1},
];
let botLevel=0, simT=0;   // simT = Spielzeit in Sekunden
function botInput(p){
  const L=BOT_LEVELS[botLevel], now=simT;
  if(!p.botIn||now-p.botT>=L.delay){
    const raw=game.bot?game.bot(p):ZERO;
    p.botT=now;
    p.botNoise=(Math.random()*2-1)*L.noise;
    p.botIn={s:clamp(raw.s*L.steer+p.botNoise,-1,1),
             g:raw.g>0?raw.g*L.gas:raw.g,
             t:game.holdT?(raw.t?1:0):(raw.t&&Math.random()<L.turbo?1:0)};
  }
  return p.botIn;
}
// Joystick: Der Stick zeigt in Richtung des Spielers (oben = Tafelmitte). Das Auto dreht sich dorthin, Gas ist automatisch.
function joyInput(p){
  const [jx,jy]=p.input.j, mag=Math.hypot(jx,jy), c=p.car;
  if(!c||mag<.18) return {s:0,g:0,t:p.input.t};
  const rot=SEATS[p.seat].rot, cs=Math.cos(rot), sn=Math.sin(rot);
  const wx=jx*cs-jy*sn, wy=jx*sn+jy*cs;
  const diff=angDiff(Math.atan2(wy,wx),c.a);
  return {s:clamp(diff*2.5,-1,1),g:clamp(mag*1.15,0,1)*(Math.abs(diff)<1.9?1:.35),t:p.input.t};
}
function inputOf(p){
  if(p.bot) return botInput(p);
  if(!p.conn||performance.now()-p.lastIn>1000) return ZERO;
  if(p.input.j&&!game.rawInput) return joyInput(p);
  return p.input;
}

// ---------- Spielablauf ----------
function startMatch(){
  for(const p of present()){ p.score=0; p.team=null; }
  if(game.teams) assignTeams();
  roundNo=0; champions=[]; championLabel='';
  if(game.setup) game.setup();
  startRound();
}
function startRound(){
  roundNo++; winners=[]; particles=[]; lastCount=0;
  for(const p of present()){ p.car=null; if(game.teams&&p.team==null) assignLate(p); }
  game.startRound();
  phase='countdown'; phaseT=3.4;
}
function toLobby(){
  if(game&&game.teardown) game.teardown();   // große Zwischenspeicher des Spiels freigeben
  phase='lobby'; winners=[]; champions=[]; particles=[];
  for(const p of present()){ p.score=0; p.car=null; p.team=null; }
}
function endRound(res){
  phase='roundEnd'; phaseT=3.4;
  winners=res.winners||[]; roundText=res.text||''; roundColor=res.color||(winners[0]&&winners[0].color)||'#E8F1F8';
  for(const w of winners) w.score++;
  if(winners.length){ confetti(CX,CY,50,roundColor); beep(660,.15,'triangle'); setTimeout(()=>beep(880,.2,'triangle'),160); }
  else beep(220,.3,'sawtooth',.06);
}
function update(dt){
  simT+=dt; bumpCd-=dt;
  if(homeConfirm>0) homeConfirm-=dt;
  const now=performance.now();
  for(let i=0;i<MAX_PLAYERS;i++){   // getrennte iPads in der Lobby nach 12 s entfernen
    const p=players[i];
    if(p&&!p.bot&&!p.conn&&p.discAt&&now-p.discAt>12000&&(phase==='lobby'||phase==='final')) players[i]=null;
  }
  if(phase==='countdown'){
    phaseT-=dt;
    const n=Math.ceil(phaseT-.4);
    if(n!==lastCount){ lastCount=n; if(n>0&&n<=3) beep(520,.15,'square'); }
    if(phaseT<=.4){ phase='play'; beep(1000,.4,'square',.08); }
    game.update(dt,'countdown');
  } else if(phase==='play'){
    const r=game.update(dt,'play');
    if(r) endRound(r);
  } else if(phase==='roundEnd'){
    phaseT-=dt; game.update(dt,'roundEnd');
    if(phaseT<=0){
      const top=present().filter(p=>p.score>=curTarget()).sort((a,b)=>b.score-a.score)[0];
      if(top){
        phase='final';
        const coop=typeof game.coop==='function'?game.coop():!!game.coop;
        champions=coop?present():(game.teams?present().filter(q=>q.team===top.team):[top]);
        championLabel=coop?'Alle zusammen':(game.teams?'Team '+TEAMS[top.team].name:cname(top.seat));
        championColor=coop?'#A6D27A':(game.teams?TEAMS[top.team].color:top.color);
        confetti(CX,CY,160,championColor);
        beep(523,.2,'triangle'); setTimeout(()=>beep(659,.2,'triangle'),200); setTimeout(()=>beep(784,.35,'triangle'),400);
      } else startRound();
    }
  } else if(phase==='final'){
    if(Math.random()<dt*3) confetti(rand(200,1400),-10,6,championColor);
  }
  for(const q of particles){ q.life-=dt; q.x+=q.vx*dt; q.y+=q.vy*dt; q.vy+=q.g*dt; q.rot+=dt*6; }
  particles=particles.filter(q=>q.life>0);
  shake=Math.max(0,shake-dt*30);
  pushState(dt);
}

// ---------- Zeichnen ----------
function button(x,y,w,h,label,fn,opts){
  opts=opts||{};
  const key=x+','+y; buttons.push({x,y,w,h,fn,key,up:!!opts.up});
  const down=pressed===key&&performance.now()<pressUntil;
  ctx.save();
  rrect(ctx,x-w/2,y-h/2,w,h,Math.min(18,h/4));
  ctx.fillStyle=opts.fill||'#4DB2E6'; ctx.fill();
  if(down){ ctx.fillStyle='rgba(13,43,78,.28)'; ctx.fill(); }
  ctx.lineWidth=opts.sel?5:3; ctx.strokeStyle=opts.sel?'#0D2B4E':'rgba(13,43,78,.4)'; ctx.stroke();
  ctx.fillStyle='#0D2B4E'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const lines=String(label).split('\n');
  if(lines.length===1){
    ctx.font='bold '+(opts.font||Math.round(h*.42))+'px Andika,system-ui,sans-serif'; ctx.fillText(label,x,y+2);
  } else {
    ctx.font='bold '+(opts.font||Math.round(h*.42))+'px Andika,system-ui,sans-serif'; ctx.fillText(lines[0],x,y-h*.17);
    ctx.font='bold '+Math.round((opts.font||h*.42)*.5)+'px Andika,system-ui,sans-serif'; ctx.fillText(lines[1],x,y+h*.28);
  }
  ctx.restore();
}
function text(t,x,y,size,color,weight,align){
  ctx.font=(weight||'bold')+' '+size+'px Andika,system-ui,sans-serif';
  ctx.fillStyle=color||'#E8F1F8'; ctx.textAlign=align||'center'; ctx.textBaseline='middle';
  ctx.fillText(t,x,y);
}
// Auto zeichnen (Scooter, Ballspiele, Münzjagd). k = Größenfaktor
function drawCar(p,k){
  const c=p.car; if(!c||c.dead) return;
  k=(k||1)*carScale;
  const sc=(c.falling?Math.max(0,1-c.fall):1)*k;
  ctx.save();
  ctx.translate(c.x,c.y); ctx.rotate(c.a); ctx.scale(sc,sc);
  ctx.fillStyle='rgba(13,43,78,.35)'; ctx.beginPath(); ctx.ellipse(3,5,26,22,0,0,Math.PI*2); ctx.fill();
  if(c.turboFx>0){
    ctx.fillStyle='#F39200'; ctx.beginPath(); ctx.moveTo(-22,-9); ctx.lineTo(-22-40*(c.turboFx/.4+.3),0); ctx.lineTo(-22,9); ctx.fill();
    ctx.fillStyle='#FFE866'; ctx.beginPath(); ctx.moveTo(-22,-4); ctx.lineTo(-22-22*(c.turboFx/.4+.3),0); ctx.lineTo(-22,4); ctx.fill();
  }
  if(game.teams&&p.team!=null){
    ctx.beginPath(); ctx.arc(0,0,CAR_BASE+5,0,Math.PI*2); ctx.lineWidth=5; ctx.strokeStyle=TEAMS[p.team].color; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0,0,CAR_BASE,0,Math.PI*2); ctx.fillStyle='#0D2B4E'; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle='#E8F1F8'; ctx.stroke();
  rrect(ctx,-17,-14,34,28,9); ctx.fillStyle=p.color; ctx.fill();
  ctx.lineWidth=2; ctx.strokeStyle='rgba(13,43,78,.45)'; ctx.stroke();
  rrect(ctx,2,-9,10,18,4); ctx.fillStyle='rgba(13,43,78,.85)'; ctx.fill();
  ctx.fillStyle='#FFF1A8'; ctx.fillRect(15,-11,3,5); ctx.fillRect(15,6,3,5);
  ctx.restore();
}

function drawBadge(seat,p){
  const s=SEATS[seat];
  ctx.save(); ctx.translate(s.x*W,s.y*H); ctx.rotate(s.rot);
  const x=-115,y=-70,w=230,h=60;
  if(!p){ ctx.restore(); return; }   // freie Plätze werden nicht angezeigt
  const out=p.car&&(p.car.dead||p.car.falling)&&phase!=='lobby';
  ctx.globalAlpha=out?.5:1;
  rrect(ctx,x,y,w,h,14); ctx.fillStyle=p.color; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle=(winners.includes(p)||champions.includes(p))?'#E8F1F8':'rgba(13,43,78,.35)'; ctx.stroke();
  if(game.teams&&p.team!=null){   // Teamfarbe als Streifen
    rrect(ctx,x+10,y+h-9,w-20,6,3); ctx.fillStyle=TEAMS[p.team].color; ctx.fill();
  }
  const zusatz=p.bot?' (Bot)':(p.conn?'':' (getrennt)');
  const n=curTarget(), big=n<=5, step=big?24:16, r=big?9:6, startX=x+w-16-(n-1)*step;
  const label=cname(seat).toUpperCase()+zusatz, room=startX-r-8-(x+14);   // Platz links von den Punkten
  let fsz=zusatz?22:28; ctx.font='800 '+fsz+'px Andika,system-ui,sans-serif';
  const need=ctx.measureText(label).width; if(need>room) fsz=Math.max(13,Math.floor(fsz*room/need));
  text(label,x+14,y+h/2-2,fsz,'#0D2B4E','800','left');
  for(let i=0;i<n;i++){
    ctx.beginPath(); ctx.arc(startX+i*step,y+h/2-2,r,0,Math.PI*2);
    ctx.fillStyle=i<p.score?'#E8F1F8':'rgba(13,43,78,.25)'; ctx.fill();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(13,43,78,.5)'; ctx.stroke();
  }
  const ex=phase!=='lobby'&&game.hudExtra?game.hudExtra(p):'';
  if(ex){
    rrect(ctx,-50,y-34,100,30,15); ctx.fillStyle='rgba(13,43,78,.85)'; ctx.fill();
    text(ex,0,y-19,20,'#E8F1F8','800');
  }
  ctx.restore();
}

// Linien-Symbole (24x24, Strich 2.2) statt Emojis
const ICON_PATHS={
  scooter:['M3 14l2-5h14l2 5v4H3z','M7 18v2M17 18v2','M7 14h.01M17 14h.01'],
  soccer:['M12 3a9 9 0 100 18 9 9 0 000-18z','M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z','M12 3v5M15.5 10.5L20 9M14.2 14.5L17 18M9.8 14.5L7 18M8.5 10.5L4 9'],
  hockey:['M6 3l9 13','M15 16h5v3h-7','M5 20h.01'],
  tron:['M3 18h5l4-8h4l3 8h2','M12 10V6h4','M3 21h18'],
  coins:['M12 3a9 9 0 100 18 9 9 0 000-18z','M12 7v10M9.5 9.5c0-1.2 1.2-2 2.5-2s2.5.8 2.5 2c0 3-5 1.5-5 4.5 0 1.200 1.200 2 2.500 2s2.500-.8 2.500-2'],
  pong:['M4 8v8','M20 8v8','M12 12h.01','M8 5h8M8 19h8'],
  paint:['M12 3C7 3 3 7 3 12s4 9 9 9c2 0 2-2 1-3s0-3 2-3h3c2 0 3-1 3-3 0-4-4-7-9-7z','M8 11h.01M12 8h.01M16 11h.01'],
  sheep:['M7 10a4 4 0 017-2 4 4 0 014 3 3 3 0 011 5H7a4 4 0 010-6z','M8 16v4M16 16v4','M5 12l-2 1'],
  fire:['M12 3c1 4 5 6 5 11a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z'],
  territory:['M4 4h8v8H4z','M12 12h8v8h-8z','M12 4h8v8','M4 12v8h8']
};
function drawIcon(id,x,y,size,color){
  const P=ICON_PATHS[id]; if(!P) return;
  ctx.save(); ctx.translate(x-size/2,y-size/2); ctx.scale(size/24,size/24);
  ctx.strokeStyle=color||'#0D2B4E'; ctx.lineWidth=2.2; ctx.lineCap='round'; ctx.lineJoin='round';
  for(const d of P) ctx.stroke(new Path2D(d));
  ctx.restore();
}
function drawLobby(){
  ctx.save();
  rrect(ctx,400,95,800,710,28); ctx.fillStyle='#23598D'; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle='#B4D2EC'; ctx.stroke();
  ctx.restore();
  text('TAFEL-SPIELE',CX,128,36,'#E8F1F8','800');
  const per=GAMES.length>5?Math.ceil(GAMES.length/2):GAMES.length;   // Spielwahl in einer oder zwei Reihen
  GAMES.forEach((g,i)=>{
    const row=Math.floor(i/per), inRow=Math.min(per,GAMES.length-row*per), col=i-row*per;
    const x=CX+(col-(inRow-1)/2)*150, y=196+row*90;
    button(x,y,144,82,'\n'+g.name,()=>{ selectGame(g); beep(600,.06,'triangle'); },
      {fill:g===game?'#4DB2E6':'#DCE7F0',sel:g===game,font:32});
    drawIcon(g.id,x,y-14,34);
  });
  const rows=Math.ceil(GAMES.length/per), yb=196+(rows-1)*90+41;     // Unterkante der Spielwahl
  text(game.desc,CX,yb+26,20,'#D6E7F5','600');
  const st=gameState[game.id];
  const items=[];
  for(const d of (game.options||[])){
    const cur=d.values.findIndex(v=>v[0]===st.opts[d.key]);
    items.push({label:d.label+': '+d.values[cur][1],fn:()=>{ st.opts[d.key]=d.values[(cur+1)%d.values.length][0]; beep(500,.05,'triangle'); }});
  }
  const tg=game.targets||[1,3,5];
  items.push({label:(game.targetLabel||'Siege bis')+': '+st.target,fn:()=>{ const i=tg.indexOf(st.target); st.target=tg[(i+1)%tg.length]; beep(500,.05,'triangle'); }});
  items.forEach((it,i)=>{
    const col=i%2, row=Math.floor(i/2);
    button(CX+(col?175:-175),yb+72+row*64,340,56,it.label,it.fn,{fill:'#DCE7F0',font:22});
  });
  const qy=626;
  if(peerReady&&qrCanvas){
    const qs=170;
    ctx.imageSmoothingEnabled=false;
    rrect(ctx,560-qs/2-8,qy-qs/2-8,qs+16,qs+16,12); ctx.fillStyle='#fff'; ctx.fill();
    ctx.drawImage(qrCanvas,560-qs/2,qy-qs/2,qs,qs);
    text('Code: '+room,560,qy+qs/2+36,36,'#FFD100','800');
  } else text(netStatus||'…',560,qy,22,'#D6E7F5','600');
  button(CX+160,574,300,80,'START',()=>startMatch(),{fill:'#46A84A',font:34});
  const nb=present().filter(p=>p.bot).length;
  button(CX+62,650,80,56,'−',()=>removeBot(),{fill:'#DCE7F0',font:38});
  text(nb+' Bot'+(nb===1?'':'s'),CX+160,652,20,'#E8F1F8','800');
  button(CX+258,650,80,56,'+',()=>addBot(),{fill:'#DCE7F0',font:38});
  button(CX+82,708,150,44,'Bots: '+BOT_LEVELS[botLevel].name,()=>{ botLevel=(botLevel+1)%BOT_LEVELS.length; beep(500,.05,'triangle'); },{fill:'#DCE7F0',font:18});
  button(CX+238,708,150,44,'Autos: '+CAR_SCALES[carScaleIdx][0],()=>{ cycleCarScale(); beep(450,.05,'triangle'); },{fill:'#DCE7F0',font:18});
  // Wie viele sind angemeldet?
  const all=present(), humans=all.filter(q=>!q.bot), online=humans.filter(q=>q.conn).length, lost=humans.length-online;
  text(all.length+' von '+MAX_PLAYERS+' angemeldet',CX+160,758,26,all.length?'#BFE39A':'#D6E7F5','800');
  text(online+' iPad'+(online===1?'':'s')+'  ·  '+nb+' Bot'+(nb===1?'':'s')+(lost?'  ·  '+lost+' getrennt':''),CX+160,784,17,'#D6E7F5','600');
}

// ---------- Vollbild ----------
const fsEl=document.documentElement;
const fsSupported=!!(fsEl.requestFullscreen||fsEl.webkitRequestFullscreen);
const inFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function toggleFs(){
  try{
    let r;
    if(inFs()) r=(document.exitFullscreen||document.webkitExitFullscreen).call(document);
    else r=(fsEl.requestFullscreen||fsEl.webkitRequestFullscreen).call(fsEl);
    if(r&&r.catch) r.catch(()=>{});
  }catch(e){}
  setTimeout(resize,300);
}
document.addEventListener('fullscreenchange',()=>setTimeout(resize,150));
document.addEventListener('webkitfullscreenchange',()=>setTimeout(resize,150));
function drawFsButton(){
  if(!fsSupported) return;
  const x=1540,y=60,fs=inFs();
  button(x,y,84,84,'',toggleFs,{fill:'#4DB2E6',up:true});
  // Symbol: vier Ecken, nach außen (groß machen) oder nach innen (verkleinern)
  ctx.save(); ctx.strokeStyle='#0D2B4E'; ctx.lineWidth=5; ctx.lineCap='round'; ctx.lineJoin='round';
  const a=18, b=fs?7:22;
  for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
    ctx.beginPath();
    ctx.moveTo(x+sx*b,y+sy*(b+(fs?a*.6:-a*.9)));
    ctx.lineTo(x+sx*b,y+sy*b);
    ctx.lineTo(x+sx*(b+(fs?a*.6:-a*.9)),y+sy*b);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOverlay(){
  if(phase==='countdown'){
    const n=Math.ceil(phaseT-.4);
    if(n>0) text(String(n),CX,CY,240,'#E8F1F8','900');
    text('Runde '+roundNo,CX,CY-200,36,'#E8F1F8','800');
    if(game.hint){
      rrect(ctx,CX-380,CY+150,760,56,18); ctx.fillStyle='rgba(13,43,78,.75)'; ctx.fill();
      text(game.hint,CX,CY+179,26,'#FFD100','700');
    }
  } else if(phase==='play'){
    if(phaseT>-1.2&&game.playT!=null&&game.playT()<1.2) text('LOS!',CX,CY,200,'#FFD100','900');
  } else if(phase==='roundEnd'){
    rrect(ctx,CX-340,CY-70,680,140,24); ctx.fillStyle='rgba(13,43,78,.82)'; ctx.fill();
    text(roundText||(winners.length?'Rundensieg!':'Unentschieden'),CX,CY,38,roundColor,'900');
  } else if(phase==='final'){
    ctx.save();
    rrect(ctx,CX-330,CY-200,660,400,28); ctx.fillStyle='rgba(13,43,78,.9)'; ctx.fill();
    ctx.lineWidth=5; ctx.strokeStyle=championColor; ctx.stroke();
    ctx.restore();
    text('CHAMPION',CX,CY-140,46,'#E8F1F8','900');
    text(championLabel.toUpperCase(),CX,CY-60,championLabel.length>7?64:84,championColor,'900');
    button(CX-150,CY+70,270,84,'Nochmal',()=>startMatch(),{fill:'#46A84A',font:30});
    button(CX+150,CY+70,270,84,'Spielwahl',()=>toLobby(),{fill:'#DCE7F0',font:30});
    text('Neue Mitspieler können jederzeit per QR-Code beitreten',CX,CY+150,20,'#D6E7F5','600');
  }
  drawFsButton();
  if(phase==='countdown'||phase==='play'||phase==='roundEnd'){
    button(60,60,84,84,homeConfirm>0?'?':'Menü',()=>{ if(homeConfirm>0){homeConfirm=0;toLobby();} else homeConfirm=2.5; },
      {fill:homeConfirm>0?'#F39200':'#4DB2E6',font:homeConfirm>0?36:22});
  }
}

function drawLobbyBackdrop(){
  const bg=ctx.createRadialGradient(CX,CY,100,CX,CY,900);
  bg.addColorStop(0,'#1D4F80'); bg.addColorStop(1,'#1D4F80');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
}

function draw(){
  buttons=[];
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#0D2B4E'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(scale,0,0,scale,offX,offY);
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip();
  if(phase==='lobby') drawLobbyBackdrop();
  else {
    if(shake>0&&!lowFx) ctx.translate(rand(-shake,shake),rand(-shake,shake));
    game.draw();
    for(const q of particles){
      ctx.globalAlpha=clamp(q.life*2,0,1); ctx.fillStyle=q.c;
      if(q.spark) ctx.fillRect(q.x-2,q.y-2,4,4);
      else { ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(q.rot); ctx.fillRect(-q.s/2,-q.s/4,q.s,q.s/2); ctx.restore(); }
    }
    ctx.globalAlpha=1;
  }
  ctx.restore();
  for(let i=0;i<MAX_PLAYERS;i++) drawBadge(i,players[i]);
  if(phase==='lobby') drawLobby();
  drawOverlay();
  if(showFps){
    ctx.save(); rrect(ctx,CX-250,4,500,30,8); ctx.fillStyle='rgba(13,43,78,.7)'; ctx.fill();
    text(Math.round(1000/ftAvg)+' FPS · '+cv.width+'×'+cv.height+(lowFx?' · Sparmodus':'')+fpsNote,CX,19,18,'#A6D27A','700');
    ctx.restore();
  }
}

// ---------- Eingabe an der Tafel (nur Tippen, eine Berührung genügt) ----------
// Robust gegen Tafel-Touch: größere Trefferflächen, auslösen bei Down ODER Up (nur einmal),
// auch wenn die Tafel den Finger "abbricht" oder leicht wackelt.
let pressed=null, pressUntil=0, lastFire=0, lastKey='';
function worldPos(e){
  const r=cv.getBoundingClientRect();
  const bx=(e.clientX-r.left)*cv.width/r.width, by=(e.clientY-r.top)*cv.height/r.height;
  return {x:(bx-offX)/scale, y:(by-offY)/scale};
}
function hitButton(x,y){
  const M=14;   // Zusatzrand um jeden Knopf (Welt-Pixel)
  let best=null,bd=1e9;
  for(const b of buttons){
    const dx=Math.max(0,Math.abs(x-b.x)-b.w/2), dy=Math.max(0,Math.abs(y-b.y)-b.h/2);
    if(dx<=M&&dy<=M){ const d=dx*dx+dy*dy+((x-b.x)**2+(y-b.y)**2)*1e-4; if(d<bd){bd=d;best=b;} }
  }
  return best;
}
function fire(b){
  const now=performance.now();
  if(b.key===lastKey&&now-lastFire<350) return;   // doppelte Ereignisse (down+up) ignorieren
  lastFire=now; lastKey=b.key; pressed=b.key; pressUntil=now+200;
  b.fn();
}
let downKey=null, consumed=false;
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();
  audioInit();
  try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').catch(()=>{}); }catch(err){}
  const w=worldPos(e), b=hitButton(w.x,w.y);
  downKey=b?b.key:'';           // merken, wo der Finger aufgesetzt wurde
  consumed=false;
  if(b){
    pressed=b.key; pressUntil=performance.now()+200;
    if(!b.up){ consumed=true; fire(b); }   // sofort auslösen; das Loslassen danach zählt nicht mehr
  }
});
function upCancel(e){
  // Wurde der Tipp schon beim Aufsetzen verarbeitet, darf das Loslassen nichts mehr auslösen.
  // (Sonst trifft es nach einem Bildwechsel einen anderen Knopf an gleicher Stelle, z.B. START nach "Spielwahl".)
  if(consumed){ consumed=false; downKey=null; return; }
  const w=worldPos(e), b=hitButton(w.x,w.y), dk=downKey; downKey=null;
  if(b&&(dk===null||dk===b.key)) fire(b);   // greift z.B. beim Vollbild-Knopf oder wenn das "Down" verloren ging
}
cv.addEventListener('pointerup',upCancel);
cv.addEventListener('pointercancel',upCancel);
addEventListener('keydown',e=>{
  if(e.key==='Enter'&&(phase==='lobby'||phase==='final')){audioInit();startMatch();}
  if(e.key==='b') addBot();
  if(e.key==='f') showFps=!showFps;
});

// ---------- Start ----------
let lastT=performance.now(), slowAcc=0, fastAcc=0, noUpUntil=0, coolMul=1, clock=0;
function frame(t){
  const real=Math.max(0,(t-lastT)/1000); lastT=t;
  // Spielzeit läuft in Echtzeit: Ist die Tafel langsam, wird in mehreren kleinen Schritten nachgeholt,
  // statt das Spiel in Zeitlupe laufen zu lassen (früher: Countdown "30 Sekunden" bei 2 Bildern pro Sekunde).
  const el=Math.min(1,real), steps=Math.max(1,Math.ceil(el/(1/30)));   // bis 1 s pro Bild nachholen
  for(let i=0;i<steps;i++) update(el/steps);
  draw();
  ftAvg+=(Math.min(real,.5)*1000-ftAvg)*.08;
  // Automatische Auflösung: langsam -> eine Stufe runter (und länger nicht wieder hoch),
  // dauerhaft flüssig -> eine Stufe hoch, solange die Tafel noch mehr Pixel hat.
  clock+=real;
  if(!manualCap){
    if(ftAvg>38){ slowAcc+=real; fastAcc=0; }
    else if(ftAvg<19){ fastAcc+=real; slowAcc=Math.max(0,slowAcc-real); }
    else { slowAcc=Math.max(0,slowAcc-real); fastAcc=0; }
    if(slowAcc>1.5&&qi>0){
      qi--; capW=Q_LEVELS[qi]; slowAcc=0; fastAcc=0; noUpUntil=clock+60*coolMul; coolMul=Math.min(8,coolMul*2);
      lowFx=qi<=2; ftAvg=22; resize(); fpsNote=' · Auflösung gesenkt';
    } else if(fastAcc>6&&qi<Q_LEVELS.length-1&&clock>noUpUntil&&cv.width<nativeW()-2){
      qi++; capW=Q_LEVELS[qi]; fastAcc=0; lowFx=qi<=2; ftAvg=17; resize(); fpsNote=' · Auflösung erhöht';
    }
  }
  requestAnimationFrame(frame);
}
function startApp(){
  selectGame(GAMES[0]);
  startPeer();
  requestAnimationFrame(frame);
  window.__game={players,GAMES,setBotLevel:v=>{botLevel=v;},selectGame,gameState,addBot,startMatch,toLobby,
    get phase(){return phase;},get game(){return game;},get room(){return room;}}; // zum Testen
}

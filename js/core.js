'use strict';
/* ============================================================
   Tafel-Spiele – Kern (läuft auf der Tafel)
   Verbindung zu den iPads, Lobby, Runden, Anzeige an den Rändern.
   Die einzelnen Spiele stehen in eigenen Dateien (js/*.js) und
   melden sich mit GAMES.push({...}) an.
   ============================================================ */

// ---------- Einstellungen ----------
const MAX_PLAYERS = 8;
const W = 1600, H = 900, CX = W/2, CY = H/2, CAR_R = 22;
const FX0 = 110, FX1 = 1490, FY0 = 90, FY1 = 810;   // Spielfeld-Rechteck (Ballspiele, Tron, Münzen)
const ID_PREFIX = 'tafel-spiele-vb-';

const COLORS = [
  ['Rot','#ef4444'],['Blau','#3b82f6'],['Gelb','#facc15'],['Grün','#22c55e'],
  ['Orange','#f97316'],['Lila','#a855f7'],['Pink','#ec4899'],['Türkis','#14b8a6']
];
const TEAMS = [{name:'Links',color:'#38bdf8'},{name:'Rechts',color:'#fb923c'}];
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
const cv=document.getElementById('c'), ctx=cv.getContext('2d');
let scale=1,offX=0,offY=0;
function resize(){
  const d=devicePixelRatio||1;
  cv.width=Math.round(innerWidth*d); cv.height=Math.round(innerHeight*d);
  scale=Math.min(cv.width/W,cv.height/H);
  offX=(cv.width-W*scale)/2; offY=(cv.height-H*scale)/2;
}
addEventListener('resize',resize); resize();

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
let winners=[], roundText='', roundColor='#fff';
let champions=[], championLabel='', championColor='#fff';
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
    const msg={k:'st',phase,game:game.id,hint:game.hint||'',noGas:!!game.noGas,
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
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2), v=rand(120,520);
    particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-200,life:rand(1.2,2.4),g:500,
      c:Math.random()<.5?color:COLORS[Math.floor(rand(0,COLORS.length))][1],s:rand(6,12),rot:rand(0,6)});
  }
}
function sparks(x,y,n,color){
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2), v=rand(80,320);
    particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.2,.5),g:0,c:color||'#ffd24a',s:4,rot:0,spark:true});
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
             t:raw.t&&Math.random()<L.turbo?1:0};
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
  if(p.input.j) return joyInput(p);
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
  phase='lobby'; winners=[]; champions=[]; particles=[];
  for(const p of present()){ p.score=0; p.car=null; p.team=null; }
}
function endRound(res){
  phase='roundEnd'; phaseT=3.4;
  winners=res.winners||[]; roundText=res.text||''; roundColor=res.color||(winners[0]&&winners[0].color)||'#fff';
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
        champions=game.teams?present().filter(q=>q.team===top.team):[top];
        championLabel=game.teams?'Team '+TEAMS[top.team].name:cname(top.seat);
        championColor=game.teams?TEAMS[top.team].color:top.color;
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
  const key=x+','+y; buttons.push({x,y,w,h,fn,key});
  const down=pressed===key&&performance.now()<pressUntil;
  ctx.save();
  rrect(ctx,x-w/2,y-h/2,w,h,Math.min(18,h/4));
  ctx.fillStyle=opts.fill||'#1f6feb'; ctx.fill();
  if(down){ ctx.fillStyle='rgba(255,255,255,.45)'; ctx.fill(); }
  ctx.lineWidth=opts.sel?5:3; ctx.strokeStyle=opts.sel?'#fff':'rgba(255,255,255,.3)'; ctx.stroke();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const lines=String(label).split('\n');
  if(lines.length===1){
    ctx.font='bold '+(opts.font||Math.round(h*.42))+'px system-ui,sans-serif'; ctx.fillText(label,x,y+2);
  } else {
    ctx.font='bold '+(opts.font||Math.round(h*.42))+'px system-ui,sans-serif'; ctx.fillText(lines[0],x,y-h*.17);
    ctx.font='bold '+Math.round((opts.font||h*.42)*.5)+'px system-ui,sans-serif'; ctx.fillText(lines[1],x,y+h*.28);
  }
  ctx.restore();
}
function text(t,x,y,size,color,weight,align){
  ctx.font=(weight||'bold')+' '+size+'px system-ui,sans-serif';
  ctx.fillStyle=color||'#fff'; ctx.textAlign=align||'center'; ctx.textBaseline='middle';
  ctx.fillText(t,x,y);
}
// Auto zeichnen (Scooter, Ballspiele, Münzjagd). k = Größenfaktor
function drawCar(p,k){
  const c=p.car; if(!c||c.dead) return;
  k=k||1;
  const sc=(c.falling?Math.max(0,1-c.fall):1)*k;
  ctx.save();
  ctx.translate(c.x,c.y); ctx.rotate(c.a); ctx.scale(sc,sc);
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(3,5,26,22,0,0,Math.PI*2); ctx.fill();
  if(c.turboFx>0){
    ctx.fillStyle='#ff9a1f'; ctx.beginPath(); ctx.moveTo(-22,-9); ctx.lineTo(-22-40*(c.turboFx/.4+.3),0); ctx.lineTo(-22,9); ctx.fill();
    ctx.fillStyle='#fff2a8'; ctx.beginPath(); ctx.moveTo(-22,-4); ctx.lineTo(-22-22*(c.turboFx/.4+.3),0); ctx.lineTo(-22,4); ctx.fill();
  }
  if(game.teams&&p.team!=null){
    ctx.beginPath(); ctx.arc(0,0,CAR_R+5,0,Math.PI*2); ctx.lineWidth=5; ctx.strokeStyle=TEAMS[p.team].color; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0,0,CAR_R,0,Math.PI*2); ctx.fillStyle='#20232c'; ctx.fill();
  ctx.lineWidth=4; ctx.strokeStyle='#0c0d12'; ctx.stroke();
  rrect(ctx,-17,-14,34,28,9); ctx.fillStyle=p.color; ctx.fill();
  ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.stroke();
  rrect(ctx,2,-9,10,18,4); ctx.fillStyle='rgba(20,30,50,.85)'; ctx.fill();
  ctx.fillStyle='#fff7c2'; ctx.fillRect(15,-11,3,5); ctx.fillRect(15,6,3,5);
  ctx.restore();
}

function drawBadge(seat,p){
  const s=SEATS[seat];
  ctx.save(); ctx.translate(s.x*W,s.y*H); ctx.rotate(s.rot);
  const x=-115,y=-70,w=230,h=60;
  if(!p){
    if(phase==='lobby'){
      ctx.globalAlpha=.45; ctx.setLineDash([8,8]); ctx.lineWidth=2; ctx.strokeStyle=COLORS[seat][1];
      rrect(ctx,x,y,w,h,14); ctx.stroke();
      ctx.setLineDash([]); text('frei',0,y+h/2,22,COLORS[seat][1],'600');
    }
    ctx.restore(); return;
  }
  const out=p.car&&(p.car.dead||p.car.falling)&&phase!=='lobby';
  ctx.globalAlpha=out?.5:1;
  rrect(ctx,x,y,w,h,14); ctx.fillStyle=p.color; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle=(winners.includes(p)||champions.includes(p))?'#fff':'rgba(0,0,0,.35)'; ctx.stroke();
  if(game.teams&&p.team!=null){   // Teamfarbe als Streifen
    rrect(ctx,x+10,y+h-9,w-20,6,3); ctx.fillStyle=TEAMS[p.team].color; ctx.fill();
  }
  const icon=p.bot?'🤖':(p.conn?(p.mode==='tilt'?'📱':(p.mode==='joy'?'🕹️':'👆')):'⚠');
  text(icon+' '+cname(seat).toUpperCase(),x+14,y+h/2-2,28,'#10131a','800','left');
  const n=curTarget(), big=n<=5, step=big?24:16, r=big?9:6, startX=x+w-16-(n-1)*step;
  for(let i=0;i<n;i++){
    ctx.beginPath(); ctx.arc(startX+i*step,y+h/2-2,r,0,Math.PI*2);
    ctx.fillStyle=i<p.score?'#fff':'rgba(0,0,0,.25)'; ctx.fill();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.stroke();
  }
  const ex=phase!=='lobby'&&game.hudExtra?game.hudExtra(p):'';
  if(ex){
    rrect(ctx,-50,y-34,100,30,15); ctx.fillStyle='rgba(8,10,18,.85)'; ctx.fill();
    text(ex,0,y-19,20,'#fff','800');
  }
  ctx.restore();
}

function drawLobby(){
  ctx.save();
  rrect(ctx,400,95,800,710,28); ctx.fillStyle='rgba(8,10,18,.93)'; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.stroke();
  ctx.restore();
  text('TAFEL-SPIELE',CX,138,38,'#fff','800');
  GAMES.forEach((g,i)=>{
    const x=CX+(i-(GAMES.length-1)/2)*148;
    button(x,222,142,112,g.icon+'\n'+g.name,()=>{ selectGame(g); beep(600,.06,'triangle'); },
      {fill:g===game?'#1f6feb':'#2a3150',sel:g===game,font:36});
  });
  text(game.desc,CX,306,21,'#c9d3ee','600');
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
    button(CX+(col?175:-175),372+row*74,340,64,it.label,it.fn,{fill:'#3b4261',font:23});
  });
  if(peerReady&&qrCanvas){
    const qs=190;
    ctx.imageSmoothingEnabled=false;
    rrect(ctx,560-qs/2-8,625-qs/2-8,qs+16,qs+16,12); ctx.fillStyle='#fff'; ctx.fill();
    ctx.drawImage(qrCanvas,560-qs/2,625-qs/2,qs,qs);
    text('Code: '+room,560,752,38,'#ffd24a','800');
  } else text(netStatus||'…',560,625,22,'#9aa7c4','600');
  button(CX+160,590,300,84,'▶  START',()=>startMatch(),{fill:'#1a9b4b',font:34});
  const nb=present().filter(p=>p.bot).length;
  button(CX+62,676,80,60,'−',()=>removeBot(),{fill:'#3b4261',font:38});
  text('🤖 '+nb+' Bot'+(nb===1?'':'s'),CX+160,678,20,'#fff','800');
  button(CX+258,676,80,60,'+',()=>addBot(),{fill:'#3b4261',font:38});
  button(CX+160,742,300,50,'Bot-Stärke: '+BOT_LEVELS[botLevel].name,()=>{ botLevel=(botLevel+1)%BOT_LEVELS.length; beep(500,.05,'triangle'); },{fill:'#3b4261',font:21});
  text(present().length+' / '+MAX_PLAYERS+' Spieler',CX+160,785,18,'#c9d3ee','600');
}

function drawOverlay(){
  if(phase==='countdown'){
    const n=Math.ceil(phaseT-.4);
    if(n>0) text(String(n),CX,CY,240,'#fff','900');
    text('Runde '+roundNo,CX,CY-200,36,'#fff','800');
    if(game.hint){
      rrect(ctx,CX-380,CY+150,760,56,18); ctx.fillStyle='rgba(8,10,18,.75)'; ctx.fill();
      text(game.hint,CX,CY+179,26,'#ffd24a','700');
    }
  } else if(phase==='play'){
    if(phaseT>-1.2&&game.playT!=null&&game.playT()<1.2) text('LOS!',CX,CY,200,'#ffd24a','900');
  } else if(phase==='roundEnd'){
    rrect(ctx,CX-340,CY-70,680,140,24); ctx.fillStyle='rgba(8,10,18,.82)'; ctx.fill();
    text(roundText||(winners.length?'🏆 Rundensieg!':'Unentschieden'),CX,CY,38,roundColor,'900');
  } else if(phase==='final'){
    ctx.save();
    rrect(ctx,CX-330,CY-200,660,400,28); ctx.fillStyle='rgba(8,10,18,.9)'; ctx.fill();
    ctx.lineWidth=5; ctx.strokeStyle=championColor; ctx.stroke();
    ctx.restore();
    text('🏆 CHAMPION 🏆',CX,CY-140,46,'#fff','900');
    text(championLabel.toUpperCase(),CX,CY-60,championLabel.length>7?64:84,championColor,'900');
    button(CX-150,CY+70,270,84,'Nochmal',()=>startMatch(),{fill:'#1a9b4b',font:30});
    button(CX+150,CY+70,270,84,'Spielwahl',()=>toLobby(),{fill:'#3b4261',font:30});
    text('Neue Mitspieler können jederzeit per QR-Code beitreten',CX,CY+150,20,'#9aa7c4','600');
  }
  if(phase==='countdown'||phase==='play'||phase==='roundEnd'){
    button(60,60,84,84,homeConfirm>0?'?':'⌂',()=>{ if(homeConfirm>0){homeConfirm=0;toLobby();} else homeConfirm=2.5; },
      {fill:homeConfirm>0?'#b42318':'rgba(255,255,255,.12)',font:30});
  }
}

function drawLobbyBackdrop(){
  const bg=ctx.createRadialGradient(CX,CY,100,CX,CY,900);
  bg.addColorStop(0,'#1a2140'); bg.addColorStop(1,'#05070d');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
}

function draw(){
  buttons=[];
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#000'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(scale,0,0,scale,offX,offY);
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip();
  if(phase==='lobby') drawLobbyBackdrop();
  else {
    if(shake>0) ctx.translate(rand(-shake,shake),rand(-shake,shake));
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
}

// ---------- Eingabe an der Tafel (nur Tippen, eine Berührung genügt) ----------
// Robust gegen Tafel-Touch: größere Trefferflächen, auslösen bei Down ODER Up (nur einmal),
// auch wenn die Tafel den Finger "abbricht" oder leicht wackelt.
let pressed=null, pressUntil=0, lastFire=0, lastKey='';
function worldPos(e){
  const d=devicePixelRatio||1, r=cv.getBoundingClientRect();
  return {x:((e.clientX-r.left)*d-offX)/scale, y:((e.clientY-r.top)*d-offY)/scale};
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
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();
  audioInit();
  try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').catch(()=>{}); }catch(err){}
  const w=worldPos(e), b=hitButton(w.x,w.y);
  if(b){ pressed=b.key; pressUntil=performance.now()+200; fire(b); }
});
function upCancel(e){
  const w=worldPos(e), b=hitButton(w.x,w.y);
  if(b) fire(b);                       // greift, falls das "Down" verloren ging
}
cv.addEventListener('pointerup',upCancel);
cv.addEventListener('pointercancel',upCancel);
addEventListener('keydown',e=>{
  if(e.key==='Enter'&&(phase==='lobby'||phase==='final')){audioInit();startMatch();}
  if(e.key==='b') addBot();
});

// ---------- Start ----------
let lastT=performance.now();
function frame(t){
  const dt=Math.min(.05,(t-lastT)/1000); lastT=t;
  update(dt); draw();
  requestAnimationFrame(frame);
}
function startApp(){
  selectGame(GAMES[0]);
  startPeer();
  requestAnimationFrame(frame);
  window.__game={players,GAMES,setBotLevel:v=>{botLevel=v;},selectGame,gameState,addBot,startMatch,toLobby,
    get phase(){return phase;},get game(){return game;},get room(){return room;}}; // zum Testen
}

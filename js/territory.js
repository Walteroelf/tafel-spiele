'use strict';
/* Gebiet erobern (Paper.io-Stil): Fahre aus deinem Gebiet heraus und kehre zurück –
   die Fläche, die du dabei einschließt, gehört dir. Wer am Ende am meisten hat, gewinnt.
   Normal (Standard): Berührt jemand deine Spur, bist du raus; eigene Spur und Wand sind auch tödlich.
   Leicht: Spuren sind ungefährlich. Wer "raus" ist, steigt je nach Einstellung nach kurzer Pause wieder ein. */
(function(){
  const CELL=10, GWc=Math.floor((FX1-FX0)/CELL), GHc=Math.floor((FY1-FY0)/CELL), TOTAL=GWc*GHc;
  const SPEED=150, TURN=2.8;
  let grid=new Int8Array(TOTAL).fill(-1), trailGrid=new Uint8Array(TOTAL), counts=new Array(MAX_PLAYERS).fill(0);
  let dirty=[], timeLeft=90, playTime=0;
  const terr=document.createElement('canvas'); terr.width=W; terr.height=H;
  const tx=terr.getContext('2d');

  const dangerous=()=>opt('spur')==='gefaehrlich';
  const cellOf=(x,y)=>{ const gx=Math.floor((x-FX0)/CELL), gy=Math.floor((y-FY0)/CELL); return (gx<0||gy<0||gx>=GWc||gy>=GHc)?-1:gy*GWc+gx; };
  const cellCenter=i=>({x:FX0+(i%GWc)*CELL+CELL/2,y:FY0+Math.floor(i/GWc)*CELL+CELL/2});
  const pct=p=>Math.round(counts[p.seat]/TOTAL*100);
  function setOwner(i,id){ if(grid[i]!==id){ grid[i]=id; dirty.push(i); } }
  function recount(){ counts.fill(0); for(let i=0;i<TOTAL;i++) if(grid[i]>=0) counts[grid[i]]++; }
  // Flächen werden als geglättete Umrisse gemalt: Aus dem Raster wird mit "Marching Squares" der Umriss jeder Farbe
  // gewonnen und mit dem Chaikin-Verfahren abgerundet. So gibt es keine Treppenstufen und Ecken mehr.
  function contourLoops(k){
    const nb=new Map();
    const P=(x,y)=>x*8192+y;
    const link=(a,b)=>{ (nb.get(a)||nb.set(a,[]).get(a)).push(b); (nb.get(b)||nb.set(b,[]).get(b)).push(a); };
    const v=(ix,iy)=>(ix<1||iy<1||ix>GWc||iy>GHc)?0:(grid[(iy-1)*GWc+(ix-1)]===k?1:0);   // Rand mit 0 aufgefüllt
    for(let iy=0;iy<=GHc;iy++)for(let ix=0;ix<=GWc;ix++){
      const code=v(ix,iy)|v(ix+1,iy)<<1|v(ix+1,iy+1)<<2|v(ix,iy+1)<<3;
      if(code===0||code===15) continue;
      const T=P(2*ix+1,2*iy), R=P(2*ix+2,2*iy+1), B=P(2*ix+1,2*iy+2), L=P(2*ix,2*iy+1);
      switch(code){
        case 1: case 14: link(L,T); break;
        case 2: case 13: link(T,R); break;
        case 4: case 11: link(R,B); break;
        case 8: case 7: link(B,L); break;
        case 3: case 12: link(L,R); break;
        case 6: case 9: link(T,B); break;
        case 5: link(L,T); link(R,B); break;
        case 10: link(T,R); link(B,L); break;
      }
    }
    const seen=new Set(), loops=[];
    for(const start of nb.keys()){
      if(seen.has(start)) continue;
      const pts=[]; let prev=-1, cur=start, guard=0;
      do{
        seen.add(cur);
        pts.push([FX0+((Math.floor(cur/8192))/2-1)*CELL+CELL/2, FY0+((cur%8192)/2-1)*CELL+CELL/2]);
        const n=nb.get(cur); const next=(n[0]!==prev)?n[0]:n[1];
        prev=cur; cur=next;
      }while(cur!==start&&++guard<20000);
      if(pts.length>=3) loops.push(pts);
    }
    return loops;
  }
  function chaikin(pts,times){
    for(let t=0;t<times;t++){
      const out=[];
      for(let i=0;i<pts.length;i++){
        const a=pts[i], b=pts[(i+1)%pts.length];
        out.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]]);
      }
      pts=out;
    }
    return pts;
  }
  function relax(pts,times){   // Eckpunkte mit ihren Nachbarn mitteln: rundet auch mehrzellige Stufen ab
    for(let t=0;t<times;t++){
      const n=pts.length, o=new Array(n);
      for(let i=0;i<n;i++){ const a=pts[(i+n-1)%n], b=pts[i], c=pts[(i+1)%n]; o[i]=[(a[0]+2*b[0]+c[0])/4,(a[1]+2*b[1]+c[1])/4]; }
      pts=o;
    }
    return pts;
  }
  function flush(){
    if(!dirty.length) return;
    dirty=[];
    tx.clearRect(0,0,W,H);
    const has=new Array(MAX_PLAYERS).fill(false);
    for(let i=0;i<TOTAL;i++) if(grid[i]>=0) has[grid[i]]=true;
    for(let k=0;k<MAX_PLAYERS;k++){
      if(!has[k]) continue;
      tx.beginPath();
      for(const loop of contourLoops(k)){
        const sm=chaikin(relax(loop,4),2);
        tx.moveTo(sm[0][0],sm[0][1]);
        for(let i=1;i<sm.length;i++) tx.lineTo(sm[i][0],sm[i][1]);
        tx.closePath();
      }
      tx.fillStyle=COLORS[k][1]; tx.fill('evenodd');
    }
  }
  function block(i,r,id){   // Quadrat um Zelle i in Farbe von id
    const gx=i%GWc, gy=(i/GWc)|0;
    for(let y=Math.max(0,gy-r);y<=Math.min(GHc-1,gy+r);y++)for(let x=Math.max(0,gx-r);x<=Math.min(GWc-1,gx+r);x++) setOwner(y*GWc+x,id);
  }

  function seatSpawn(p){
    const s=SEATS[p.seat]; let x=s.x*W, y=s.y*H;
    x+=(CX-x)*.22; y+=(CY-y)*.22; x=clamp(x,FX0+80,FX1-80); y=clamp(y,FY0+80,FY1-80);
    return {x,y};
  }
  function place(p,x,y){
    const c=p.car; c.x=x; c.y=y; c.a=Math.atan2(CY-y,CX-x)+rand(-.3,.3); c.trail=[]; c.cell=cellOf(x,y);
    c.dead=false; c.wp=[]; c.boostT=0; c.boostCd=0; c.turboFx=0;
  }
  function newCar(p){
    const sp=seatSpawn(p);
    p.car={x:sp.x,y:sp.y,vx:0,vy:0,a:0,dead:false,falling:false,out:false,respT:0,trail:[],cell:0,wp:[],boostT:0,boostCd:0,turboFx:0,turboCd:0};
    block(cellOf(sp.x,sp.y),5,p.seat);    // Startgebiet (ca. 110 px)
    place(p,sp.x,sp.y);
  }
  function respawn(p){
    const c=p.car;
    if(counts[p.seat]>0){
      for(let t=0;t<200;t++){ const i=Math.floor(rand(0,TOTAL)); if(grid[i]===p.seat){ const q=cellCenter(i); place(p,q.x,q.y); return; } }
    }
    const sp=seatSpawn(p); block(cellOf(sp.x,sp.y),5,p.seat); recount(); place(p,sp.x,sp.y);
  }
  function kill(p){
    const c=p.car; if(!c||c.dead) return;
    for(const i of c.trail) trailGrid[i]=0;
    c.trail=[]; c.dead=true;
    sparks(c.x,c.y,30,p.color); sparks(c.x,c.y,10,'#fff'); shake=Math.max(shake,6); beep(220,.35,'sawtooth',.09,-150);
    if(opt('raus')==='raus'){
      c.out=true;
      for(let i=0;i<TOTAL;i++) if(grid[i]===p.seat) setOwner(i,-1);
      recount();
    } else c.respT=2.2;
  }

  // Schleife schließen: Spur wird Gebiet, alles was von außen nicht erreichbar ist, wird ebenfalls Gebiet
  function closeLoop(p){
    const c=p.car, id=p.seat;
    for(const i of c.trail){ setOwner(i,id); trailGrid[i]=0; }
    c.trail=[];
    const outside=new Uint8Array(TOTAL), q=[];
    const push=i=>{ if(!outside[i]&&grid[i]!==id){ outside[i]=1; q.push(i); } };
    for(let x=0;x<GWc;x++){ push(x); push((GHc-1)*GWc+x); }
    for(let y=0;y<GHc;y++){ push(y*GWc); push(y*GWc+GWc-1); }
    while(q.length){
      const i=q.pop(), gx=i%GWc, gy=(i/GWc)|0;
      if(gx>0) push(i-1); if(gx<GWc-1) push(i+1); if(gy>0) push(i-GWc); if(gy<GHc-1) push(i+GWc);
    }
    let gained=0;
    for(let i=0;i<TOTAL;i++) if(grid[i]!==id&&!outside[i]){ setOwner(i,id); gained++; }
    recount();
    // Hat jemand durch die Eroberung sein ganzes Gebiet verloren, ist er "raus" (je nach Option Wiedereinstieg oder Rausfliegen),
    // auch bei einfachen Spuren – so wirkt die Option "Wenn raus" immer.
    for(const q of present()){
      if(q===p||!q.car||q.car.out||counts[q.seat]>0) continue;
      const qc=q.car;
      if(opt('raus')==='raus'){
        for(const i of qc.trail) trailGrid[i]=0; qc.trail=[]; qc.out=true; qc.dead=true;
        sparks(qc.x,qc.y,30,q.color); beep(220,.35,'sawtooth',.09,-150);
      } else { for(const i of qc.trail) trailGrid[i]=0; qc.trail=[]; sparks(qc.x,qc.y,20,q.color); respawn(q); }
    }
    if(gained>6){ beep(660,.1,'triangle',.08); setTimeout(()=>beep(880,.12,'triangle',.08),90); sparks(c.x,c.y,12,p.color); }
  }

  function enter(p,idx){
    const c=p.car, id=p.seat;
    if(dangerous()){
      const t=trailGrid[idx];
      if(t>0){
        if(t===id+1){
          const k=c.trail.indexOf(idx);
          if(k>=0&&k<c.trail.length-8){ kill(p); return; }
        } else { const v=players[t-1]; if(v&&v.car&&!v.car.dead) kill(v); }
      }
    }
    if(grid[idx]===id){ if(c.trail.length) closeLoop(p); }
    else if(trailGrid[idx]!==id+1){ c.trail.push(idx); trailGrid[idx]=id+1; }
  }

  function move(p,dt){
    const c=p.car, inp=inputOf(p);
    c.boostCd-=dt; c.boostT-=dt; c.turboFx=c.boostT;
    if(inp.t&&c.boostCd<=0){ c.boostT=.6; c.boostCd=4; beep(300,.2,'sawtooth',.06,500); }
    const sp=SPEED*(c.boostT>0?1.7:1);
    c.a+=inp.s*TURN*dt;
    const steps=Math.max(1,Math.ceil(sp*dt/8)), st=sp*dt/steps;
    for(let k=0;k<steps&&!c.dead;k++){
      c.x+=Math.cos(c.a)*st; c.y+=Math.sin(c.a)*st;
      c.vx=Math.cos(c.a)*sp; c.vy=Math.sin(c.a)*sp;
      let idx=cellOf(c.x,c.y);
      if(idx<0){
        if(dangerous()){ kill(p); break; }
        c.x=clamp(c.x,FX0+2,FX1-2); c.y=clamp(c.y,FY0+2,FY1-2); idx=cellOf(c.x,c.y);
      }
      if(idx!==c.cell){ c.cell=idx; enter(p,idx); }
    }
  }

  // ----- Bots -----
  function nearestOwn(c,seat){
    let best=-1,bd=1e9;
    for(let i=0;i<TOTAL;i+=1){ if(grid[i]!==seat) continue; const q=cellCenter(i), d=(q.x-c.x)**2+(q.y-c.y)**2; if(d<bd){bd=d;best=i;} }
    return best<0?null:cellCenter(best);
  }
  const clampPt=(x,y)=>({x:clamp(x,FX0+40,FX1-40),y:clamp(y,FY0+40,FY1-40)});
  function blockedAt(x,y){ const i=cellOf(x,y); return i<0||(dangerous()&&trailGrid[i]>0); }
  function bot(p){
    const c=p.car; if(!c||c.dead) return ZERO;
    const own=grid[c.cell]===p.seat;
    if(own&&c.trail.length===0&&c.wp.length===0){   // Ausflug planen: raus, abbiegen, zurück
      const a=c.a+rand(-1.1,1.1), d1=rand(140,300), turn=Math.random()<.5?1:-1, d2=rand(110,240);
      const p1=clampPt(c.x+Math.cos(a)*d1,c.y+Math.sin(a)*d1);
      const p2=clampPt(p1.x+Math.cos(a+turn*Math.PI/2)*d2,p1.y+Math.sin(a+turn*Math.PI/2)*d2);
      c.wp=[p1,p2,'home'];
    }
    let t=c.wp[0];
    if(t==='home'){
      if(own){ c.wp.shift(); t=null; }
      else { t=nearestOwn(c,p.seat); if(!t){ c.wp=[]; t={x:CX,y:CY}; } }
    } else if(t&&Math.hypot(t.x-c.x,t.y-c.y)<35){ c.wp.shift(); t=c.wp[0]==='home'?nearestOwn(c,p.seat):c.wp[0]; }
    if(!t) t={x:c.x+Math.cos(c.a)*100,y:c.y+Math.sin(c.a)*100};
    let s=clamp(angDiff(Math.atan2(t.y-c.y,t.x-c.x),c.a)*2.2,-1,1);
    // Hindernisse (Wand, bei "gefährlich" auch Spuren) voraus: ausweichen
    const look=(da,d)=>blockedAt(c.x+Math.cos(c.a+da)*d,c.y+Math.sin(c.a+da)*d);
    if(look(0,45)||look(0,90)){ const l=look(-.6,45), r=look(.6,45); s=l&&!r?1:(r&&!l?-1:(c.pref||(c.pref=Math.random()<.5?-1:1))); }
    return {s,g:0,t:Math.random()<.004?1:0};
  }

  const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

  GAMES.push({
    id:'territory',name:'Gebiet',icon:'🗺️',noGas:true,
    desc:'Raus aus deinem Gebiet und zurück – die Fläche dazwischen gehört dir! Regeln einstellbar.',
    hint:'Raus aus deinem Gebiet und wieder zurück: Die Fläche dazwischen wird deine!',
    targets:[1,3,5],defTarget:3,
    options:[
      {key:'spur',label:'Spuren',values:[['sicher','sicher (leicht)'],['gefaehrlich','gefährlich (normal)']],def:'gefaehrlich'},
      {key:'raus',label:'Wenn raus',values:[['wieder','Wiedereinstieg'],['raus','Rausfliegen']],def:'wieder'},
      {key:'dauer',label:'Dauer',values:[['60','60 s'],['90','90 s'],['120','120 s']],def:'90'},
    ],
    bot,playT:()=>playTime,
    hudExtra:p=>'🗺️ '+pct(p)+'%',
    startRound(){
      grid.fill(-1); trailGrid.fill(0); counts.fill(0); dirty=[]; tx.clearRect(0,0,W,H);
      playTime=0; timeLeft=+opt('dauer');
      for(const p of present()) newCar(p);
      recount(); flush();
    },
    update(dt,ph){
      const list=inRound();
      if(ph==='countdown'){ flush(); return; }
      for(const p of list){ const c=p.car; if(c.dead&&!c.out){ c.respT-=dt; if(c.respT<=0) respawn(p); } }
      if(ph==='play'){
        playTime+=dt; timeLeft-=dt;
        for(const p of list) if(!p.car.dead) move(p,dt);
      }
      flush();
      if(ph!=='play') return;
      const aliveList=list.filter(p=>!p.car.out);
      if(list.length>=2&&aliveList.length<=1){
        const w=aliveList[0];
        return w?{winners:[w],text:'🏆 '+cname(w.seat).toUpperCase()+' bleibt als Einzige übrig!',color:w.color}
                :{winners:[],text:'Alle raus – Unentschieden',color:'#fff'};
      }
      if(timeLeft<=0){
        const max=list.reduce((m,p)=>Math.max(m,counts[p.seat]),0);
        const w=max>0?list.filter(p=>counts[p.seat]===max):[];
        const text=!w.length?'Niemand hat Gebiet':(w.length===1?'🗺️ '+cname(w[0].seat).toUpperCase()+' gewinnt mit '+pct(w[0])+' %!':'Gleichstand mit '+pct(w[0])+' %');
        return {winners:w,text,color:w.length===1?w[0].color:'#ffd24a'};
      }
    },
    draw(){
      ctx.fillStyle='#03050a'; ctx.fillRect(0,0,W,H);
      rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,24); ctx.fillStyle='#e9edf3'; ctx.fill();
      ctx.save(); rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,24); ctx.clip();
      ctx.strokeStyle='rgba(0,0,0,.06)'; ctx.lineWidth=1;
      for(let x=FX0;x<=FX1;x+=40){ ctx.beginPath(); ctx.moveTo(x,FY0); ctx.lineTo(x,FY1); ctx.stroke(); }
      for(let y=FY0;y<=FY1;y+=40){ ctx.beginPath(); ctx.moveTo(FX0,y); ctx.lineTo(FX1,y); ctx.stroke(); }
      ctx.globalAlpha=.78; ctx.drawImage(terr,0,0); ctx.globalAlpha=1;
      // Spuren als weiche, runde Linie durch die Zellmitten
      ctx.globalAlpha=dangerous()?.95:.55; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=CELL*.8;
      for(const p of present()){
        const c=p.car; if(!c||!c.trail.length) continue;
        ctx.strokeStyle=p.color; ctx.beginPath();
        let pts=c.trail.map(i=>[FX0+(i%GWc)*CELL+CELL/2,FY0+((i/GWc)|0)*CELL+CELL/2]); pts.push([c.x,c.y]);
        for(let t=0;t<2&&pts.length>2;t++){   // offene Linie glätten (Anfang und Ende bleiben)
          const o=[pts[0]];
          for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; o.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]]); }
          o.push(pts[pts.length-1]); pts=o;
        }
        pts.forEach((q,k)=>{ if(k) ctx.lineTo(q[0],q[1]); else ctx.moveTo(q[0],q[1]); });
        ctx.stroke();
      }
      ctx.lineCap='butt';
      ctx.globalAlpha=1;
      ctx.restore();
      ctx.lineWidth=10; ctx.strokeStyle='#59627d'; rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,24); ctx.stroke();
      for(const p of present()) drawCar(p,.8);
      ctx.save(); ctx.globalAlpha=.9; rrect(ctx,CX-80,FY0+12,160,56,16); ctx.fillStyle='rgba(8,10,18,.7)'; ctx.fill();
      text(fmt(timeLeft),CX,FY0+41,44,timeLeft<=10?'#ff6b5a':'#fff','900'); ctx.restore();
    },
  });
})();

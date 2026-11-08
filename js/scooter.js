'use strict';
/* Autoscooter-Arena: Rausdrängen. Optionen: Hindernisse, Eis, wandernde Löcher. */
(function(){
  const R0=390;
  let curR=R0, arenaT=0, obstacles=[], cells=[], holeT=0;
  const RINGS=[{r0:0,r1:.3,n:4},{r0:.3,r1:.65,n:8},{r0:.65,r1:1,n:12}];

  function spawn(seat){
    const s=SEATS[seat], a=Math.atan2(s.y*H-CY,s.x*W-CX), r=R0*.68;
    return {x:CX+Math.cos(a)*r,y:CY+Math.sin(a)*r,vx:0,vy:0,a:a+Math.PI,
      falling:false,fall:0,fallT:0,dead:false,deadT:0,turboCd:0,turboFx:0};
  }
  function params(){
    return opt('boden')==='eis'?{accel:230,drag:.55,grip:.45,turn:2.9,turboV:300}:{};
  }
  function buildObstacles(){
    obstacles=[];
    const h=opt('hind');
    if(h==='pfeiler'){
      for(let k=0;k<4;k++){ const a=k*Math.PI/2+Math.PI/4, x=CX+Math.cos(a)*R0*.4, y=CY+Math.sin(a)*R0*.4;
        obstacles.push({ax:x,ay:y,bx:x,by:y,r:30}); }
    } else if(h==='banden'){
      for(let k=0;k<4;k++){ // Windrad aus vier Banden
        const a=k*Math.PI/2+Math.PI/4, x=CX+Math.cos(a)*R0*.4, y=CY+Math.sin(a)*R0*.4;
        const tx=-Math.sin(a)*65, ty=Math.cos(a)*65;
        obstacles.push({ax:x-tx,ay:y-ty,bx:x+tx,by:y+ty,r:13});
      }
    }
  }
  function cellAt(x,y){
    const d=Math.hypot(x-CX,y-CY)/curR; if(d>=1) return null;
    let ri=RINGS.findIndex(r=>d>=r.r0&&d<r.r1); if(ri<0) return null;
    let a=Math.atan2(y-CY,x-CX); if(a<0) a+=Math.PI*2;
    const sec=Math.floor(a/(Math.PI*2)*RINGS[ri].n);
    return cells.find(c=>c.ring===ri&&c.sec===sec)||null;
  }
  function updateHoles(dt){
    for(const c of cells){ c.t-=dt; if(c.t<=0){ if(c.state===1){c.state=2;c.t=6;} else c.dead=true; } }
    cells=cells.filter(c=>!c.dead);
    holeT-=dt;
    if(arenaT>4&&holeT<=0&&cells.length<5){
      holeT=2.4;
      const ri=Math.floor(rand(0,3)), sec=Math.floor(rand(0,RINGS[ri].n));
      if(!cells.some(c=>c.ring===ri&&c.sec===sec)) cells.push({ring:ri,sec,state:1,t:1.5});
    }
  }
  function startFall(c){ c.falling=true; c.fall=0; c.fallT=performance.now()/1000; beep(520,.6,'sine',.09,-440); }

  function bot(p){
    const c=p.car;
    if(!c||c.dead||c.falling) return ZERO;
    const dc=Math.hypot(c.x-CX,c.y-CY);
    let tgt=null,best=1e9;
    for(const q of inRound()){
      if(q===p||q.car.dead||q.car.falling) continue;
      const d=Math.hypot(q.car.x-c.x,q.car.y-c.y);
      if(d<best){best=d;tgt=q.car;}
    }
    let tx=CX,ty=CY;
    if(tgt&&dc<curR*.7){ tx=tgt.x+tgt.vx*.25; ty=tgt.y+tgt.vy*.25; }
    // Löcher meiden: vor dem Auto prüfen
    const ax=c.x+Math.cos(c.a)*70, ay=c.y+Math.sin(c.a)*70;
    const ce=cellAt(ax,ay);
    if(ce&&ce.state>0){ tx=CX; ty=CY; }
    const want=Math.atan2(ty-c.y,tx-c.x), diff=angDiff(want,c.a);
    return {s:clamp(diff*2.2,-1,1),g:Math.abs(diff)<1.7?1:.15,
      t:(tgt&&best<260&&Math.abs(diff)<.12&&dc<curR*.6&&Math.random()<.03)?1:0};
  }

  const g={
    id:'scooter',name:'Scooter',icon:'🚗',
    desc:'Rausdrängen! Wer als Letzter in der Arena bleibt, gewinnt.',
    hint:'Dränge die anderen aus der Arena!',
    targets:[1,3,5],defTarget:3,
    options:[
      {key:'hind',label:'Hindernisse',values:[['aus','aus'],['pfeiler','Pfeiler'],['banden','Banden']],def:'aus'},
      {key:'boden',label:'Boden',values:[['normal','normal'],['eis','Eis ❄']],def:'normal'},
      {key:'loch',label:'Wandernde Löcher',values:[['aus','aus'],['an','an']],def:'aus'},
    ],
    bot,
    playT:()=>arenaT,
    startRound(){
      arenaT=0; curR=R0; cells=[]; holeT=0; buildObstacles();
      for(const p of present()) p.car=spawn(p.seat);
    },
    update(dt,ph){
      const list=inRound(), P=params();
      if(ph==='play'){ arenaT+=dt; curR=R0*(1-.45*clamp((arenaT-15)/45,0,1)); if(opt('loch')==='an') updateHoles(dt); }
      for(const p of list){
        const c=p.car;
        if(c.dead){ c.deadT+=dt; continue; }
        if(c.falling){ c.fall+=dt/.9; c.x+=c.vx*dt; c.y+=c.vy*dt; c.a+=dt*5; if(c.fall>=1){c.dead=true;c.fall=1;} continue; }
        if(ph==='countdown') continue;
        drive(c,inputOf(p),dt,P);
      }
      if(ph==='countdown') return;
      const act=list.filter(p=>!p.car.dead&&!p.car.falling);
      for(let i=0;i<act.length;i++)for(let j=i+1;j<act.length;j++){
        const a=act[i].car,b=act[j].car, v=collideCircles(a,b,CAR_R,CAR_R,1);
        if(v) impactFx((a.x+b.x)/2,(a.y+b.y)/2,v);
      }
      for(const p of act) for(const o of obstacles){ const v=collideCapsule(p.car,CAR_R,o,.8); if(v) impactFx(p.car.x,p.car.y,v); }
      for(const p of act){
        const c=p.car;
        if(Math.hypot(c.x-CX,c.y-CY)>curR+4){ startFall(c); continue; }
        if(cells.length){ const ce=cellAt(c.x,c.y); if(ce&&ce.state===2) startFall(c); }
      }
      if(ph!=='play') return;
      const alive=list.filter(p=>!p.car.falling&&!p.car.dead);
      if(list.length>=2&&alive.length<=1){
        let w=alive[0];
        if(!w) w=list.slice().sort((a,b)=>b.car.fallT-a.car.fallT)[0];
        return {winners:[w],text:'🏆 '+cname(w.seat).toUpperCase()+' gewinnt die Runde!',color:w.color};
      }
      if(list.length===1&&list[0].car.dead&&list[0].car.deadT>1.2) list[0].car=spawn(list[0].seat); // allein üben
    },
    draw(){
      const eis=opt('boden')==='eis';
      const bg=ctx.createRadialGradient(CX,CY,100,CX,CY,900);
      bg.addColorStop(0,'#14192b'); bg.addColorStop(1,'#05070d');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
      if(curR<R0-1){
        ctx.save(); ctx.setLineDash([10,14]); ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(CX,CY,R0,0,Math.PI*2); ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.shadowColor='rgba(255,70,50,.55)'; ctx.shadowBlur=38;
      ctx.beginPath(); ctx.arc(CX,CY,curR,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill(); ctx.restore();
      const gr=ctx.createRadialGradient(CX,CY-60,40,CX,CY,curR);
      if(eis){ gr.addColorStop(0,'#b9d9ee'); gr.addColorStop(1,'#6e9bbd'); } else { gr.addColorStop(0,'#4a5470'); gr.addColorStop(1,'#272e42'); }
      ctx.beginPath(); ctx.arc(CX,CY,curR,0,Math.PI*2); ctx.fillStyle=gr; ctx.fill();
      ctx.strokeStyle=eis?'rgba(255,255,255,.35)':'rgba(255,255,255,.10)'; ctx.lineWidth=2;
      for(const f of [.66,.33]){ ctx.beginPath(); ctx.arc(CX,CY,curR*f,0,Math.PI*2); ctx.stroke(); }
      // Löcher
      for(const c of cells){
        const R=RINGS[c.ring], a0=c.sec/R.n*Math.PI*2, a1=(c.sec+1)/R.n*Math.PI*2;
        ctx.beginPath(); ctx.arc(CX,CY,R.r1*curR,a0,a1); ctx.arc(CX,CY,R.r0*curR,a1,a0,true); ctx.closePath();
        if(c.state===1){ ctx.fillStyle=Math.floor(performance.now()/150)%2?'rgba(239,68,68,.75)':'rgba(255,200,60,.55)'; }
        else ctx.fillStyle='#04060b';
        ctx.fill();
        if(c.state===2){ ctx.lineWidth=3; ctx.strokeStyle='rgba(255,90,60,.6)'; ctx.stroke(); }
      }
      ctx.lineWidth=14; ctx.strokeStyle='#f5c518'; ctx.beginPath(); ctx.arc(CX,CY,curR+2,0,Math.PI*2); ctx.stroke();
      ctx.save(); ctx.setLineDash([22,22]); ctx.strokeStyle='#15171f';
      ctx.beginPath(); ctx.arc(CX,CY,curR+2,0,Math.PI*2); ctx.stroke(); ctx.restore();
      // Hindernisse
      for(const o of obstacles){
        ctx.lineCap='round';
        ctx.strokeStyle='#1a1d26'; ctx.lineWidth=o.r*2+6; ctx.beginPath(); ctx.moveTo(o.ax,o.ay); ctx.lineTo(o.bx,o.by); ctx.stroke();
        ctx.strokeStyle='#d9534a'; ctx.lineWidth=o.r*2-4; ctx.beginPath(); ctx.moveTo(o.ax,o.ay); ctx.lineTo(o.bx,o.by); ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(o.ax-3,o.ay-3); ctx.lineTo(o.bx-3,o.by-3); ctx.stroke();
        ctx.lineCap='butt';
      }
      for(const p of present()) drawCar(p);
      if(phase==='play'){
        if(arenaT>14&&arenaT<18) text('⚠ Die Arena schrumpft!',CX,CY-250,34,'#ffd24a','800');
      }
    },
  };
  GAMES.push(g);
})();

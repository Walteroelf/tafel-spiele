'use strict';
/* Farbe erobern: Jedes Auto malt den Boden in seiner Farbe. Wer am Ende die größte Fläche hat, gewinnt.
   Überfahrene Flächen anderer werden übermalt. TURBO malt kurz einen breiten Streifen. */
(function(){
  const CELL=12, GWc=Math.ceil((FX1-FX0)/CELL), GHc=Math.ceil((FY1-FY0)/CELL), TOTAL=GWc*GHc;
  let grid=new Int8Array(TOTAL).fill(-1), counts=new Array(MAX_PLAYERS).fill(0), timeLeft=60, playTime=0;
  const layer=document.createElement('canvas'); layer.width=W; layer.height=H;
  const lx=layer.getContext('2d');

  function paintDisc(p,x,y,r){
    lx.fillStyle=p.color; lx.beginPath(); lx.arc(x,y,r,0,Math.PI*2); lx.fill();
    const id=p.seat, r2=r*r;
    const g0=Math.max(0,Math.floor((x-r-FX0)/CELL)), g1=Math.min(GWc-1,Math.floor((x+r-FX0)/CELL));
    const h0=Math.max(0,Math.floor((y-r-FY0)/CELL)), h1=Math.min(GHc-1,Math.floor((y+r-FY0)/CELL));
    for(let gy=h0;gy<=h1;gy++)for(let gx=g0;gx<=g1;gx++){
      const cx=FX0+gx*CELL+CELL/2, cy=FY0+gy*CELL+CELL/2;
      if((cx-x)*(cx-x)+(cy-y)*(cy-y)>r2) continue;
      const i=gy*GWc+gx, old=grid[i];
      if(old===id) continue;
      if(old>=0) counts[old]--;
      grid[i]=id; counts[id]++;
    }
  }
  function paintCar(p,dt){
    const c=p.car, r=c.turboFx>0?54:30;
    const dx=c.x-c.px, dy=c.y-c.py, d=Math.hypot(dx,dy), n=Math.max(1,Math.ceil(d/(r*.5)));
    for(let i=1;i<=n;i++) paintDisc(p,c.px+dx*i/n,c.py+dy*i/n,r);
    c.px=c.x; c.py=c.y;
  }
  const pct=p=>Math.round(counts[p.seat]/TOTAL*100);

  function spawn(p){
    const s=SEATS[p.seat]; let x=s.x*W, y=s.y*H;
    x+=(CX-x)*.2; y+=(CY-y)*.2; x=clamp(x,FX0+60,FX1-60); y=clamp(y,FY0+60,FY1-60);
    return {x,y,px:x,py:y,vx:0,vy:0,a:Math.atan2(CY-y,CX-x),dead:false,falling:false,turboCd:0,turboFx:0};
  }
  function bot(p){
    const c=p.car; if(!c) return ZERO;
    if(!c.tT||c.tT<=0||Math.hypot(c.tx-c.x,c.ty-c.y)<50){
      // Ein paar zufällige Punkte prüfen, den nächsten nehmen, der noch nicht meine Farbe hat
      let best=null,bd=1e9;
      for(let k=0;k<16;k++){
        const x=rand(FX0+50,FX1-50), y=rand(FY0+50,FY1-50);
        const i=Math.floor((y-FY0)/CELL)*GWc+Math.floor((x-FX0)/CELL);
        if(grid[i]===p.seat) continue;
        const d=Math.hypot(x-c.x,y-c.y); if(d<bd){bd=d;best={x,y};}
      }
      if(!best) best={x:rand(FX0+50,FX1-50),y:rand(FY0+50,FY1-50)};
      c.tx=best.x; c.ty=best.y; c.tT=2.5;
    }
    c.tT-=1/30;
    const diff=angDiff(Math.atan2(c.ty-c.y,c.tx-c.x),c.a);
    return {s:clamp(diff*2.5,-1,1),g:Math.abs(diff)<1.5?1:.2,t:Math.random()<.006?1:0};
  }
  const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

  GAMES.push({
    id:'paint',name:'Farbe',icon:'🎨',
    desc:'Male den Boden in deiner Farbe. Wer am Ende am meisten hat, gewinnt!',
    hint:'Fahre überall hin und male den Boden an – TURBO malt breit!',
    targets:[1,3,5],defTarget:3,
    options:[{key:'dauer',label:'Dauer',values:[['45','45 s'],['60','60 s'],['90','90 s']],def:'60'}],
    bot,playT:()=>playTime,
    hudExtra:p=>'🎨 '+pct(p)+'%',
    startRound(){
      grid.fill(-1); counts.fill(0); playTime=0; timeLeft=+opt('dauer');
      lx.clearRect(0,0,W,H);
      for(const p of present()) p.car=spawn(p);
    },
    update(dt,ph){
      const list=inRound();
      for(const p of list){
        if(ph!=='countdown') drive(p.car,inputOf(p),dt);
        keepInRect(p.car,CAR_R,FX0,FY0,FX1,FY1,.5);
      }
      if(ph==='countdown') return;
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const a=list[i].car,b=list[j].car, v=collideCircles(a,b,CAR_R,CAR_R,1);
        if(v) impactFx((a.x+b.x)/2,(a.y+b.y)/2,v);
      }
      if(ph!=='play') return;
      playTime+=dt; timeLeft-=dt;
      for(const p of list) paintCar(p,dt);
      if(timeLeft<=0){
        const max=list.reduce((m,p)=>Math.max(m,counts[p.seat]),0);
        const w=max>0?list.filter(p=>counts[p.seat]===max):[];
        const text=!w.length?'Niemand hat gemalt':(w.length===1?'🎨 '+cname(w[0].seat).toUpperCase()+' gewinnt mit '+pct(w[0])+' %!':'Gleichstand mit '+pct(w[0])+' %');
        return {winners:w,text,color:w.length===1?w[0].color:'#ffd24a'};
      }
    },
    draw(){
      ctx.fillStyle='#03050a'; ctx.fillRect(0,0,W,H);
      rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.fillStyle='#161d2e'; ctx.fill();
      ctx.save(); rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.clip();
      ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=2;
      for(let x=FX0;x<=FX1;x+=80){ ctx.beginPath(); ctx.moveTo(x,FY0); ctx.lineTo(x,FY1); ctx.stroke(); }
      for(let y=FY0;y<=FY1;y+=80){ ctx.beginPath(); ctx.moveTo(FX0,y); ctx.lineTo(FX1,y); ctx.stroke(); }
      ctx.globalAlpha=.88; ctx.drawImage(layer,0,0); ctx.globalAlpha=1;
      ctx.restore();
      ctx.lineWidth=10; ctx.strokeStyle='#f5c518'; rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.stroke();
      for(const p of present()) drawCar(p);
      text(fmt(timeLeft),CX,FY0+44,56,timeLeft<=10?'#ff6b5a':'#fff','900');
    },
  });
})();

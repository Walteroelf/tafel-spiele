'use strict';
/* Münzjagd: Sammle in der Zeit möglichst viele Münzen. Diamanten zählen dreifach. */
(function(){
  let coins=[], timeLeft=60, spawnT=0, playTime=0;

  function spawn(p){
    const s=SEATS[p.seat]; let x=s.x*W, y=s.y*H;
    x+=(CX-x)*.2; y+=(CY-y)*.2;
    x=clamp(x,FX0+60,FX1-60); y=clamp(y,FY0+60,FY1-60);
    return {x,y,vx:0,vy:0,a:Math.atan2(CY-y,CX-x),dead:false,falling:false,turboCd:0,turboFx:0};
  }
  function addCoin(){
    const big=Math.random()<.12;
    coins.push({x:rand(FX0+70,FX1-70),y:rand(FY0+70,FY1-70),v:big?3:1,age:0,ph:rand(0,6)});
  }
  function bot(p){
    const c=p.car; if(!c) return ZERO;
    let best=null,bs=1e9;
    for(const k of coins){ const sc=Math.hypot(k.x-c.x,k.y-c.y)/k.v; if(sc<bs){bs=sc;best=k;} }
    if(!best) return {s:0,g:.2,t:0};
    const want=Math.atan2(best.y-c.y,best.x-c.x), diff=angDiff(want,c.a);
    return {s:clamp(diff*2.5,-1,1),g:Math.abs(diff)<1.4?1:.1,t:Math.random()<.004?1:0};
  }
  const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

  GAMES.push({
    id:'coins',name:'Münzen',icon:'🪙',
    desc:'Sammle in der Zeit die meisten Münzen. 💎 zählt dreifach!',
    hint:'Sammle Münzen – 💎 zählt dreifach!',
    targets:[1,3,5],defTarget:3,
    options:[{key:'dauer',label:'Dauer',values:[['45','45 s'],['60','60 s'],['90','90 s']],def:'60'}],
    bot,playT:()=>playTime,
    hudExtra:p=>'🪙 '+(p.coins||0),
    startRound(){
      coins=[]; playTime=0; spawnT=0; timeLeft=+opt('dauer');
      for(const p of present()){ p.coins=0; p.car=spawn(p); }
      for(let i=0;i<5;i++) addCoin();
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
      playTime+=dt; timeLeft-=dt; spawnT-=dt;
      if(spawnT<=0&&coins.length<10){ addCoin(); spawnT=.45; }
      for(const k of coins) k.age+=dt;
      coins=coins.filter(k=>k.age<14);
      for(const p of list){
        for(let i=coins.length-1;i>=0;i--){
          const k=coins[i];
          if(Math.hypot(k.x-p.car.x,k.y-p.car.y)<CAR_R+(k.v>1?19:14)){
            p.coins=(p.coins||0)+k.v; coins.splice(i,1);
            sparks(k.x,k.y,k.v>1?16:8,k.v>1?'#7dd3fc':'#ffd24a');
            beep(k.v>1?1200:900,.08,'triangle',.08,k.v>1?400:200);
          }
        }
      }
      if(timeLeft<=0){
        const max=list.reduce((m,p)=>Math.max(m,p.coins||0),0);
        const w=max>0?list.filter(p=>(p.coins||0)===max):[];
        const text=!w.length?'Keine Münzen gesammelt':(w.length===1?'🪙 '+cname(w[0].seat).toUpperCase()+' gewinnt mit '+max+' Münzen!':'Gleichstand mit '+max+' Münzen');
        return {winners:w,text,color:w.length===1?w[0].color:'#ffd24a'};
      }
    },
    draw(){
      ctx.fillStyle='#03050a'; ctx.fillRect(0,0,W,H);
      const g=ctx.createLinearGradient(0,FY0,0,FY1); g.addColorStop(0,'#16405a'); g.addColorStop(1,'#0e2a40');
      rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.fillStyle=g; ctx.fill();
      ctx.save(); rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.clip();
      ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=2;
      for(let x=FX0;x<=FX1;x+=80){ ctx.beginPath(); ctx.moveTo(x,FY0); ctx.lineTo(x,FY1); ctx.stroke(); }
      for(let y=FY0;y<=FY1;y+=80){ ctx.beginPath(); ctx.moveTo(FX0,y); ctx.lineTo(FX1,y); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth=10; ctx.strokeStyle='#f5c518'; rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.stroke();
      // Münzen
      const now=performance.now()/1000;
      for(const k of coins){
        if(k.age>10&&Math.floor(now*6)%2) continue;   // blinkt kurz vor dem Verschwinden
        const w=Math.abs(Math.cos(now*3+k.ph)), r=k.v>1?19:14;
        ctx.save(); ctx.translate(k.x,k.y);
        ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(3,r*.7,r,r*.4,0,0,Math.PI*2); ctx.fill();
        if(k.v>1){
          ctx.rotate(Math.PI/4); ctx.scale(.6+.4*w,1);
          ctx.fillStyle='#7dd3fc'; ctx.fillRect(-r*.8,-r*.8,r*1.6,r*1.6); ctx.lineWidth=3; ctx.strokeStyle='#e0f7ff'; ctx.strokeRect(-r*.8,-r*.8,r*1.6,r*1.6);
        } else {
          ctx.scale(.25+.75*w,1);
          ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle='#ffd24a'; ctx.fill();
          ctx.lineWidth=3; ctx.strokeStyle='#b8860b'; ctx.stroke();
          ctx.beginPath(); ctx.arc(0,0,r*.55,0,Math.PI*2); ctx.strokeStyle='#e8a317'; ctx.stroke();
        }
        ctx.restore();
      }
      for(const p of present()) drawCar(p);
      ctx.save(); ctx.globalAlpha=.95;
      text(fmt(timeLeft),CX,FY0+44,56,timeLeft<=10?'#ff6b5a':'#fff','900');
      ctx.restore();
    },
  });
})();

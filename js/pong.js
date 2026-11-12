'use strict';
/* 4er-Pong: Jede Tafelseite ist ein Tor mit einem Schläger. Wer den Ball durchlässt, verliert ein Leben.
   Stehen zwei Spieler an derselben Seite, teilen sie sich die Seite (jeder hat sein eigenes Tor-Stück).
   Gesteuert wird nur links/rechts (aus Sicht des Spielers). */
(function(){
  const TH=16, BALL_R=13, BASE_SP=380, MAX_SP=820, PADDLE_SPEED=640;
  const SIDEDEF={
    unten: {O:[FX0,FY1],L:FX1-FX0,rot:0},
    oben:  {O:[FX1,FY0],L:FX1-FX0,rot:Math.PI},
    links: {O:[FX0,FY0],L:FY1-FY0,rot:Math.PI/2},
    rechts:{O:[FX1,FY1],L:FY1-FY0,rot:-Math.PI/2},
  };
  let sides=[], ball={x:CX,y:CY,vx:0,vy:0,sp:BASE_SP}, serveT=1, trail=[], playTime=0;

  function mkSides(){
    sides=[];
    for(const name of Object.keys(SIDEDEF)){
      const d=SIDEDEF[name], T=[Math.cos(d.rot),Math.sin(d.rot)], n=[Math.sin(d.rot),-Math.cos(d.rot)];
      const sd={name,O:d.O,L:d.L,T,n,owners:[]};
      const ps=present().filter(p=>SEATS[p.seat].side===name);
      const u0=p=>{ const s=SEATS[p.seat], x=clamp(s.x*W,FX0,FX1), y=clamp(s.y*H,FY0,FY1); return (x-d.O[0])*T[0]+(y-d.O[1])*T[1]; };
      ps.sort((a,b)=>u0(a)-u0(b));
      ps.forEach((p,i)=>{
        const lo=i*d.L/ps.length, hi=(i+1)*d.L/ps.length, len=Math.min(150,(hi-lo)*.42);
        sd.owners.push({p,lo,hi,len,len0:len});
      });
      sides.push(sd);
    }
  }
  const alive=o=>!o.p.car.dead;
  const ownerAt=(sd,u)=>sd.owners.find(o=>alive(o)&&u>=o.lo&&u<=o.hi)||null;
  const side2xy=(sd,u,dist)=>({x:sd.O[0]+sd.T[0]*u+sd.n[0]*dist, y:sd.O[1]+sd.T[1]*u+sd.n[1]*dist});

  function prepServe(t){ ball={x:CX,y:CY,vx:0,vy:0,sp:BASE_SP}; trail=[]; serveT=t; }
  function launch(){
    const a=(Math.floor(rand(0,4))*90+rand(25,65))*Math.PI/180;
    ball.vx=Math.cos(a)*BASE_SP; ball.vy=Math.sin(a)*BASE_SP; beep(700,.08,'triangle');
    for(const sd of sides) for(const o of sd.owners) o.err=rand(-70,70);   // Bots zielen nicht immer perfekt
  }

  function bot(p){
    const c=p.car; if(!c||c.dead) return ZERO;
    const o=c.owner, sd=c.sd;
    const vn=ball.vx*sd.n[0]+ball.vy*sd.n[1], vt=ball.vx*sd.T[0]+ball.vy*sd.T[1];
    const ub=(ball.x-sd.O[0])*sd.T[0]+(ball.y-sd.O[1])*sd.T[1], db=(ball.x-sd.O[0])*sd.n[0]+(ball.y-sd.O[1])*sd.n[1];
    let target=(o.lo+o.hi)/2;
    if(serveT<=0){
      if(vn<0){ const t=Math.max(0,(db-TH-BALL_R)/-vn); target=ub+vt*t; }
      else target=(ub*.3+(o.lo+o.hi)/2*.7);
    }
    target=clamp(target+(o.err||0)*(1-Math.min(1,playTime/200)*.3),o.lo+o.len/2,o.hi-o.len/2);
    return {s:clamp((target-c.u)/45,-1,1),g:0,t:0};
  }

  function lose(o){
    const p=o.p, c=p.car;
    c.lives--;
    sparks(ball.x,ball.y,26,p.color); shake=Math.max(shake,7); beep(180,.35,'sawtooth',.1,-120);
    const single=inRound().length<2;
    if(c.lives<=0){
      if(single) c.lives=gameState.pong.opts.leben|0||3;    // allein üben: nie raus
      else { c.dead=true; sparks(ball.x,ball.y,24,'#fff'); }
    }
    prepServe(1.1);
  }

  const g={
    id:'pong',name:'4er-Pong',icon:'🏓',noPedals:true,rawInput:true,
    desc:'Jede Seite ist ein Tor. Halte den Ball mit deinem Schläger auf!',
    hint:'Schläger nach links/rechts bewegen – lass keinen Ball durch!',
    targets:[1,3,5],defTarget:3,
    options:[{key:'leben',label:'Leben',values:[['3','3'],['5','5'],['7','7']],def:'3'}],
    bot,
    dbg:()=>({ball:{x:Math.round(ball.x),y:Math.round(ball.y),vx:Math.round(ball.vx),vy:Math.round(ball.vy),sp:Math.round(ball.sp)},serveT:+serveT.toFixed(2)}),
    playT:()=>playTime,
    hudExtra:p=>p.car?'❤️ '+Math.max(0,p.car.lives):'',
    startRound(){
      playTime=0; mkSides();
      const lives=+opt('leben');
      for(const sd of sides) for(const o of sd.owners){
        o.p.car={u:(o.lo+o.hi)/2,lives,dead:false,falling:false,owner:o,sd,x:0,y:0,a:0};
      }
      prepServe(1.2);   // Ball ruht bis zum Aufschlag
    },
    update(dt,ph){
      const list=inRound();
      if(ph==='countdown') return;
      // Schläger bewegen
      for(const p of list){
        const c=p.car; if(c.dead) continue;
        const inp=inputOf(p); let mv=inp.j?inp.j[0]:inp.s; if(Math.abs(mv)<.08) mv=0;
        c.u=clamp(c.u+mv*PADDLE_SPEED*dt,c.owner.lo+c.owner.len/2,c.owner.hi-c.owner.len/2);
      }
      if(ph==='play') playTime+=dt;
      // Nach einer Minute werden die Schläger langsam kleiner, damit lange Ballwechsel irgendwann enden
      const shrink=clamp(1-(playTime-60)/150,.45,1);
      for(const sd of sides) for(const o of sd.owners) o.len=o.len0*shrink;
      if(ph==='roundEnd') return;
      // Aufschlag
      if(serveT>0){
        serveT-=dt;
        if(serveT<=0) launch(); else return;
      }
      ball.sp=Math.min(MAX_SP+130,ball.sp+(ph==='play'?9:0)*dt);   // wird mit der Zeit immer schneller, damit jeder Ballwechsel irgendwann endet
      { const k=Math.hypot(ball.vx,ball.vy); if(k>0&&k<ball.sp){ ball.vx*=ball.sp/k; ball.vy*=ball.sp/k; } }
      // Ball bewegen (zwei Teilschritte, damit er bei Tempo nicht durch den Schläger fliegt)
      for(let sub=0;sub<2;sub++){
        ball.x+=ball.vx*dt/2; ball.y+=ball.vy*dt/2;
        trail.push(ball.x,ball.y); if(trail.length>24) trail.splice(0,2);
        for(const sd of sides){
          const ub=(ball.x-sd.O[0])*sd.T[0]+(ball.y-sd.O[1])*sd.T[1], db=(ball.x-sd.O[0])*sd.n[0]+(ball.y-sd.O[1])*sd.n[1];
          const vn=ball.vx*sd.n[0]+ball.vy*sd.n[1];
          if(vn>=0) continue;
          const o=ownerAt(sd,ub);
          if(!o){   // Wand
            if(db<BALL_R){
              ball.vx-=2*vn*sd.n[0]; ball.vy-=2*vn*sd.n[1];
              ball.x+=sd.n[0]*(BALL_R-db); ball.y+=sd.n[1]*(BALL_R-db);
              beep(260,.04,'square',.05);
            }
            continue;
          }
          const c=o.p.car;
          if(db<TH+BALL_R&&db>-BALL_R*.2&&Math.abs(ub-c.u)<=o.len/2+BALL_R*.6){   // Schläger getroffen
            const k=clamp((ub-c.u)/(o.len/2+BALL_R*.6),-1,1), a=clamp(k*1.0+rand(-.22,.22),-1.2,1.2);   // etwas Zufall, damit der Ball nicht nur hin und her fliegt
            ball.sp=Math.min(MAX_SP+130,ball.sp*1.05+10);
            ball.vx=ball.sp*(sd.n[0]*Math.cos(a)+sd.T[0]*Math.sin(a));
            ball.vy=ball.sp*(sd.n[1]*Math.cos(a)+sd.T[1]*Math.sin(a));
            ball.x+=sd.n[0]*(TH+BALL_R-db); ball.y+=sd.n[1]*(TH+BALL_R-db);
            sparks(ball.x,ball.y,6,o.p.color); beep(520+Math.round(ball.sp/4),.06,'triangle',.09);
          } else if(db<-BALL_R*.2){ lose(o); break; }
        }
      }
      if(ph!=='play') return;
      const alive2=list.filter(p=>!p.car.dead);
      if(list.length>=2&&alive2.length<=1){
        const w=alive2[0];
        return w?{winners:[w],text:'🏆 '+cname(w.seat).toUpperCase()+' gewinnt die Runde!',color:w.color}
                :{winners:[],text:'Unentschieden',color:'#fff'};
      }
    },
    draw(){
      ctx.fillStyle='#03050a'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#0b1226'; ctx.fillRect(FX0,FY0,FX1-FX0,FY1-FY0);
      ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(CX,CY,120,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX-30,CY); ctx.lineTo(CX+30,CY); ctx.moveTo(CX,CY-30); ctx.lineTo(CX,CY+30); ctx.stroke();
      // Wände und Tor-Stücke
      ctx.lineCap='round';
      for(const sd of sides){
        const a=side2xy(sd,0,0), b=side2xy(sd,sd.L,0);
        ctx.strokeStyle='#59627d'; ctx.lineWidth=12; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        for(const o of sd.owners){
          if(!alive(o)) continue;
          const s0=side2xy(sd,o.lo,0), s1=side2xy(sd,o.hi,0);
          ctx.strokeStyle=o.p.color; ctx.globalAlpha=.55; ctx.lineWidth=12; ctx.beginPath(); ctx.moveTo(s0.x,s0.y); ctx.lineTo(s1.x,s1.y); ctx.stroke(); ctx.globalAlpha=1;
        }
      }
      ctx.lineCap='butt';
      // Schläger
      for(const sd of sides) for(const o of sd.owners){
        const c=o.p.car; if(!c||c.dead) continue;
        const a=side2xy(sd,c.u-o.len/2,TH/2), b=side2xy(sd,c.u+o.len/2,TH/2);
        ctx.lineCap='round';
        ctx.strokeStyle='#fff'; ctx.lineWidth=TH+5; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        ctx.strokeStyle=o.p.color; ctx.lineWidth=TH; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        ctx.lineCap='butt';
      }
      // Ball mit kurzer Spur
      for(let i=0;i<trail.length;i+=2){
        ctx.globalAlpha=(i/trail.length)*.35; ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.arc(trail[i],trail[i+1],BALL_R*(.4+.6*i/trail.length),0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
      ctx.beginPath(); ctx.arc(ball.x,ball.y,BALL_R,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
      ctx.lineWidth=3; ctx.strokeStyle='#ffd24a'; ctx.stroke();
    },
  };
  GAMES.push(g);
})();

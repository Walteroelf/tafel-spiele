'use strict';
/* Lichtspur (Tron): Alle fahren ständig vorwärts und hinterlassen eine Spur.
   Wer eine Wand oder eine Spur berührt, ist raus. TURBO = kurzer Spurt. */
(function(){
  const GS=4, GW=Math.ceil((FX1-FX0)/GS), GH=Math.ceil((FY1-FY0)/GS);
  let grid=new Uint8Array(GW*GH), playT=0;

  const idx=(x,y)=>{
    const gx=Math.floor((x-FX0)/GS), gy=Math.floor((y-FY0)/GS);
    return (gx<0||gy<0||gx>=GW||gy>=GH)?-1:gy*GW+gx;
  };
  const blocked=(x,y)=>{ const i=idx(x,y); return i<0||grid[i]!==0; };
  function stamp(x,y,id){
    for(const [dx,dy] of [[0,0],[2,0],[-2,0],[0,2],[0,-2]]){ const i=idx(x+dx,y+dy); if(i>=0) grid[i]=id; }
  }
  function stampLine(x0,y0,x1,y1,id){
    const d=Math.hypot(x1-x0,y1-y0), n=Math.max(1,Math.ceil(d/2));
    for(let i=1;i<=n;i++) stamp(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,id);
  }
  function clearOwner(id){ for(let i=0;i<grid.length;i++) if(grid[i]===id) grid[i]=0; }

  function spawn(p){
    const s=SEATS[p.seat]; let x=s.x*W, y=s.y*H;
    x+=(CX-x)*.22; y+=(CY-y)*.22;
    x=clamp(x,FX0+60,FX1-60); y=clamp(y,FY0+60,FY1-60);
    const a=Math.atan2(CY-y,CX-x);
    return {x,y,a,vx:0,vy:0,dead:false,falling:false,deadT:0,trail:[],boostT:0,boostCd:0,
      sx:x-Math.cos(a)*14,sy:y-Math.sin(a)*14,pref:Math.random()<.5?-1:1};
  }
  function die(p){
    const c=p.car; if(c.dead) return;
    c.dead=true; c.deadT=0; c.trail=[];
    clearOwner(p.seat+1);
    sparks(c.x,c.y,36,p.color); sparks(c.x,c.y,12,'#fff');
    shake=Math.max(shake,8); beep(200,.4,'sawtooth',.1,-150);
  }

  function bot(p){
    const c=p.car; if(!c||c.dead) return ZERO;
    const look=(ang,d)=>blocked(c.x+Math.cos(c.a+ang)*d,c.y+Math.sin(c.a+ang)*d);
    const front=look(0,48), far=look(0,115), l=look(-.55,48), r=look(.55,48);
    let s;
    if(front||(l&&r)){ s=l&&!r?1:(r&&!l?-1:c.pref); }
    else if(l){ s=.8; } else if(r){ s=-.8; }
    else if(far){ s=c.pref*.7; }
    else { s=Math.sin(playT*.9+p.seat*2)*.3; if(Math.random()<.002) c.pref=-c.pref; }
    return {s,g:0,t:0};
  }

  const g={
    id:'tron',name:'Lichtspur',icon:'🏍️',noGas:true,
    desc:'Du fährst immer vorwärts und ziehst eine Spur. Nicht berühren!',
    hint:'Nur lenken! Wand und Spuren sind tödlich. TURBO = Spurt',
    targets:[1,3,5],defTarget:3,
    bot,playT:()=>playT,
    startRound(){
      grid=new Uint8Array(GW*GH); playT=0;
      for(const p of present()) p.car=spawn(p);
    },
    update(dt,ph){
      const list=inRound();
      if(ph==='countdown') return;
      for(const p of list){
        const c=p.car;
        if(c.dead){ c.deadT+=dt; continue; }
        if(ph!=='play') continue;
        const inp=inputOf(p);
        c.boostCd-=dt; c.boostT-=dt;
        if(inp.t&&c.boostCd<=0){ c.boostT=.6; c.boostCd=4; beep(300,.2,'sawtooth',.06,500); }
        const sp=(210+Math.min(80,playT*1.5))*(c.boostT>0?1.8:1);
        c.a+=inp.s*2.8*dt;
        const steps=Math.max(1,Math.ceil(sp*dt/4)), step=sp*dt/steps;
        for(let k=0;k<steps&&!c.dead;k++){
          const ca=Math.cos(c.a), sa=Math.sin(c.a);
          c.x+=ca*step; c.y+=sa*step;
          if(blocked(c.x+ca*5,c.y+sa*5)){ die(p); break; }
          const tx=c.x-ca*14, ty=c.y-sa*14;
          stampLine(c.sx,c.sy,tx,ty,p.seat+1);
          if(Math.hypot(tx-c.sx,ty-c.sy)>=0){
            const n=c.trail.length;
            if(n<2||Math.hypot(tx-c.trail[n-2],ty-c.trail[n-1])>=6){ c.trail.push(tx,ty); }
          }
          c.sx=tx; c.sy=ty;
        }
      }
      if(ph==='play'){
        playT+=dt;
        const act=list.filter(p=>!p.car.dead);
        for(let i=0;i<act.length;i++)for(let j=i+1;j<act.length;j++){   // Kopf gegen Kopf
          if(Math.hypot(act[i].car.x-act[j].car.x,act[i].car.y-act[j].car.y)<14){ die(act[i]); die(act[j]); }
        }
        const alive=list.filter(p=>!p.car.dead);
        if(list.length>=2&&alive.length<=1){
          const w=alive[0];
          return w?{winners:[w],text:'🏆 '+cname(w.seat).toUpperCase()+' gewinnt die Runde!',color:w.color}
                  :{winners:[],text:'Alle raus – Unentschieden',color:'#fff'};
        }
        if(list.length===1&&list[0].car.dead&&list[0].car.deadT>1){   // allein üben
          grid=new Uint8Array(GW*GH); list[0].car=spawn(list[0]);
        }
      }
    },
    draw(){
      ctx.fillStyle='#03050a'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#070b18'; ctx.fillRect(FX0,FY0,FX1-FX0,FY1-FY0);
      ctx.strokeStyle='rgba(80,180,255,.10)'; ctx.lineWidth=1;
      for(let x=FX0;x<=FX1;x+=40){ ctx.beginPath(); ctx.moveTo(x,FY0); ctx.lineTo(x,FY1); ctx.stroke(); }
      for(let y=FY0;y<=FY1;y+=40){ ctx.beginPath(); ctx.moveTo(FX0,y); ctx.lineTo(FX1,y); ctx.stroke(); }
      ctx.save(); ctx.shadowColor='#38bdf8'; ctx.shadowBlur=24; ctx.lineWidth=6; ctx.strokeStyle='#7dd3fc';
      ctx.strokeRect(FX0,FY0,FX1-FX0,FY1-FY0); ctx.restore();
      ctx.lineCap='round'; ctx.lineJoin='round';
      for(const p of present()){
        const c=p.car; if(!c||c.dead) continue;
        const pts=c.trail;
        ctx.beginPath(); ctx.moveTo(pts.length?pts[0]:c.sx,pts.length?pts[1]:c.sy);
        for(let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i],pts[i+1]);
        ctx.lineTo(c.sx,c.sy); ctx.lineTo(c.x,c.y);
        ctx.strokeStyle=p.color; ctx.globalAlpha=.28; ctx.lineWidth=13; ctx.stroke();
        ctx.globalAlpha=1; ctx.lineWidth=5; ctx.stroke();
      }
      ctx.lineCap='butt';
      for(const p of present()){
        const c=p.car; if(!c||c.dead) continue;
        ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.a);
        ctx.shadowColor=p.color; ctx.shadowBlur=c.boostT>0?30:16;
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-9,-9); ctx.lineTo(-5,0); ctx.lineTo(-9,9); ctx.closePath(); ctx.fill();
        ctx.lineWidth=3; ctx.strokeStyle=p.color; ctx.stroke();
        ctx.restore();
      }
    },
  };
  GAMES.push(g);
})();

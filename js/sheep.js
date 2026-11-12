'use strict';
/* Schafe hüten: Die Autos treiben Schafe ins Gehege.
   Modus "gemeinsam": ein großes Gehege in der Mitte, alle zusammen gegen die Zeit.
   Modus "einzeln": jeder hat ein eigenes Gehege am Rand, die meisten Schafe gewinnen. */
(function(){
  const SR=13;   // Schaf-Radius
  let sheep=[], pens=[], timeLeft=90, playTime=0, total=12;

  const coopMode=()=>opt('modus')==='gemeinsam';
  // Wie scheu die Schafe sind: ruhig (leicht, Standard), normal, flink (schwer)
  const LV={ruhig:{range:120,flee:140,max:160,pull:1,pen:1.25},normal:{range:160,flee:210,max:230,pull:.5,pen:1.1},flink:{range:190,flee:300,max:280,pull:0,pen:1}};
  const lv=()=>LV[opt('tempo')]||LV.ruhig;
  function inPen(pen,x,y){
    return pen.r?Math.hypot(x-pen.x,y-pen.y)<pen.r-6:(Math.abs(x-pen.x)<pen.hw-6&&Math.abs(y-pen.y)<pen.hh-6);
  }
  function buildPens(){
    pens=[];
    const K=lv().pen;
    if(coopMode()){ pens.push({x:CX,y:CY,r:130*K,owner:-1}); return; }
    for(const p of present()){
      const s=SEATS[p.seat], rot=s.rot, nx=Math.sin(rot), ny=-Math.cos(rot);
      const ex=s.side==='links'?FX0:(s.side==='rechts'?FX1:clamp(s.x*W,FX0+130,FX1-130));
      const ey=s.side==='oben'?FY0:(s.side==='unten'?FY1:clamp(s.y*H,FY0+130,FY1-130));
      const horiz=s.side==='oben'||s.side==='unten';
      pens.push({x:ex+nx*62*K,y:ey+ny*62*K,hw:(horiz?118:62)*K,hh:(horiz?62:118)*K,owner:p.seat,color:p.color});
    }
  }
  function spawnCar(p){
    const s=SEATS[p.seat]; let x=s.x*W, y=s.y*H;
    x+=(CX-x)*.2; y+=(CY-y)*.2; x=clamp(x,FX0+60,FX1-60); y=clamp(y,FY0+60,FY1-60);
    return {x,y,vx:0,vy:0,a:Math.atan2(CY-y,CX-x),dead:false,falling:false,turboCd:0,turboFx:0};
  }
  function spawnSheep(){
    sheep=[];
    for(let tries=0;sheep.length<total&&tries<500;tries++){
      const x=rand(FX0+230,FX1-230), y=rand(FY0+140,FY1-140);
      if(pens.some(pn=>pn.r&&Math.hypot(x-pn.x,y-pn.y)<pn.r+60)) continue;
      if(sheep.some(s=>Math.hypot(s.x-x,s.y-y)<45)) continue;
      sheep.push({x,y,vx:0,vy:0,m:.3,locked:false,owner:-1,wa:rand(0,6.28),ws:0,wt:rand(0,2),face:rand(0,6.28)});
    }
  }
  const lockedCount=()=>sheep.filter(s=>s.locked).length;
  const ownCount=seat=>sheep.filter(s=>s.locked&&s.owner===seat).length;

  function bot(p){
    const c=p.car; if(!c) return ZERO;
    const pen=coopMode()?pens[0]:pens.find(q=>q.owner===p.seat);
    if(!pen) return ZERO;
    let best=null,bd=1e9;
    for(const s of sheep){ if(s.locked) continue; const d=Math.hypot(s.x-c.x,s.y-c.y); if(d<bd){bd=d;best=s;} }
    if(!best) return {s:0,g:0,t:0};
    let ux=pen.x-best.x, uy=pen.y-best.y; const L=Math.hypot(ux,uy)||1; ux/=L; uy/=L;
    let tx=clamp(best.x-ux*55,FX0+30,FX1-30), ty=clamp(best.y-uy*55,FY0+30,FY1-30);
    const dx=best.x-c.x, dy=best.y-c.y, toS=Math.hypot(dx,dy)||1, aligned=(dx*ux+dy*uy)/toS;
    if(aligned>.75){ tx=best.x+ux*40; ty=best.y+uy*40; }
    const diff=angDiff(Math.atan2(ty-c.y,tx-c.x),c.a);
    return {s:clamp(diff*2.5,-1,1),g:Math.abs(diff)<1.4?(aligned>.75?.7:1):.15,t:0};
  }

  const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

  GAMES.push({
    id:'sheep',name:'Schafe',icon:'🐑',
    desc:'Treibe die Schafe ins Gehege – gemeinsam oder jeder für sich.',
    hint:'Fahre hinter die Schafe und schiebe sie ins Gehege!',
    targets:[1,2,3],defTarget:1,
    coop:()=>coopMode(),
    options:[
      {key:'modus',label:'Modus',values:[['gemeinsam','gemeinsam'],['einzeln','jeder für sich']],def:'gemeinsam'},
      {key:'tempo',label:'Schafe sind',values:[['ruhig','ruhig (leicht)'],['normal','normal'],['flink','flink (schwer)']],def:'ruhig'},
      {key:'schafe',label:'Anzahl',values:[['8','8'],['12','12'],['16','16']],def:'12'},
    ],
    bot,playT:()=>playTime,
    hudExtra:p=>coopMode()?'🐑 '+lockedCount()+'/'+total:'🐑 '+ownCount(p.seat),
    startRound(){
      playTime=0; timeLeft=120; total=+opt('schafe');
      buildPens(); spawnSheep();
      for(const p of present()) p.car=spawnCar(p);
    },
    update(dt,ph){
      const list=inRound();
      for(const p of list){
        if(ph!=='countdown') drive(p.car,inputOf(p),dt);
        keepInRect(p.car,CAR_R,FX0,FY0,FX1,FY1,.5);
      }
      if(ph==='countdown') return;
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const a=list[i].car,b=list[j].car, v=collideCircles(a,b,CAR_R,CAR_R,.8);
        if(v) impactFx((a.x+b.x)/2,(a.y+b.y)/2,v);
      }
      // Schafe
      for(const s of sheep){
        if(s.locked){ continue; }
        s.wt-=dt;
        if(s.wt<=0){ s.wa=rand(0,6.28); s.ws=Math.random()<.4?0:rand(10,40); s.wt=rand(1,3); }
        let dx=Math.cos(s.wa)*s.ws, dy=Math.sin(s.wa)*s.ws;
        const L=lv();
        for(const p of list){
          const c=p.car, ex=s.x-c.x, ey=s.y-c.y, d=Math.hypot(ex,ey);
          if(d<L.range&&d>.1){ const k=Math.pow(1-d/L.range,1.2)*L.flee; dx+=ex/d*k; dy+=ey/d*k; }
        }
        // Nicht in Ecken und an Wänden festsitzen: sanft zur Mitte zurückdriften
        const m=100;
        if(s.x<FX0+m) dx+=(FX0+m-s.x)*1.6; if(s.x>FX1-m) dx-=(s.x-(FX1-m))*1.6;
        if(s.y<FY0+m) dy+=(FY0+m-s.y)*1.6; if(s.y>FY1-m) dy-=(s.y-(FY1-m))*1.6;
        if(L.pull>0){   // Schafe nahe am Gehege werden sanft hineingezogen
          let near=null,nd=1e9;
          for(const pn of pens){ const d=Math.hypot(pn.x-s.x,pn.y-s.y), reach=(pn.r||Math.max(pn.hw,pn.hh))*1.9; if(d<reach&&d<nd){nd=d;near=pn;} }
          if(near&&nd>1){ dx+=(near.x-s.x)/nd*70*L.pull; dy+=(near.y-s.y)/nd*70*L.pull; }
        }
        const k=Math.min(1,dt*4); s.vx+=(dx-s.vx)*k; s.vy+=(dy-s.vy)*k;
        const sp=Math.hypot(s.vx,s.vy); if(sp>L.max){ s.vx*=L.max/sp; s.vy*=L.max/sp; }
        s.x+=s.vx*dt; s.y+=s.vy*dt;
        if(sp>8) s.face=Math.atan2(s.vy,s.vx);
        keepInRect(s,SR,FX0,FY0,FX1,FY1,.3);
        for(const p of list) collideCircles(p.car,s,CAR_R,SR,.3);
        for(const o of sheep){ if(o===s) continue; const ddx=s.x-o.x, ddy=s.y-o.y, dd=Math.hypot(ddx,ddy); if(dd>0&&dd<SR*2){ const push=(SR*2-dd)/2; s.x+=ddx/dd*push; s.y+=ddy/dd*push; } }
        if(ph==='play') for(const pn of pens) if(inPen(pn,s.x,s.y)){
          s.locked=true; s.owner=pn.owner; s.vx=s.vy=0;
          sparks(s.x,s.y,10,'#fff'); beep(330+Math.random()*60,.18,'triangle',.09,-90);
          break;
        }
      }
      if(ph!=='play') return;
      playTime+=dt; timeLeft-=dt;
      const done=lockedCount()===sheep.length;
      if(done||timeLeft<=0){
        if(coopMode()){
          if(done) return {winners:list.slice(),text:'🐑 Alle '+total+' Schafe im Gehege – super!',color:'#7CFC9A'};
          return {winners:[],text:'Zeit um: '+lockedCount()+' von '+total+' Schafen im Gehege',color:'#ffd24a'};
        }
        const max=list.reduce((m,p)=>Math.max(m,ownCount(p.seat)),0);
        const w=max>0?list.filter(p=>ownCount(p.seat)===max):[];
        const text=!w.length?'Keine Schafe im Gehege':(w.length===1?'🐑 '+cname(w[0].seat).toUpperCase()+' gewinnt mit '+max+' Schafen!':'Gleichstand mit '+max+' Schafen');
        return {winners:w,text,color:w.length===1?w[0].color:'#ffd24a'};
      }
    },
    draw(){
      ctx.fillStyle='#03050a'; ctx.fillRect(0,0,W,H);
      rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.fillStyle='#3d8a3a'; ctx.fill();
      ctx.save(); rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.clip();
      ctx.fillStyle='rgba(255,255,255,.04)';
      for(let i=0;i<10;i+=2) ctx.fillRect(FX0+i*(FX1-FX0)/10,FY0,(FX1-FX0)/10,FY1-FY0);
      ctx.restore();
      ctx.lineWidth=10; ctx.strokeStyle='#8a5a2b'; rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.stroke();
      // Gehege
      for(const pn of pens){
        ctx.fillStyle='rgba(120,80,40,.55)'; ctx.strokeStyle=pn.color||'#f5c518'; ctx.lineWidth=8;
        if(pn.r){ ctx.beginPath(); ctx.arc(pn.x,pn.y,pn.r,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
        else { rrect(ctx,pn.x-pn.hw,pn.y-pn.hh,pn.hw*2,pn.hh*2,14); ctx.fill(); ctx.stroke(); }
      }
      // Schafe
      for(const s of sheep){
        ctx.save(); ctx.translate(s.x,s.y);
        ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(2,5,SR+2,SR-2,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff';
        for(const [dx,dy] of [[0,0],[-7,-5],[7,-5],[-7,6],[7,6]]){ ctx.beginPath(); ctx.arc(dx,dy,SR*.62,0,Math.PI*2); ctx.fill(); }
        ctx.rotate(s.face); ctx.fillStyle='#2b2b2b'; ctx.beginPath(); ctx.ellipse(SR*.8,0,6,5,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
        if(s.locked&&s.owner>=0){ ctx.fillStyle=COLORS[s.owner][1]; ctx.beginPath(); ctx.arc(s.x,s.y-SR-3,4,0,Math.PI*2); ctx.fill(); }
      }
      for(const p of present()) drawCar(p);
      if(coopMode()){
        text(fmt(timeLeft),CX,FY0+44,56,timeLeft<=10?'#ff6b5a':'#fff','900');
        text('🐑 '+lockedCount()+' / '+total,CX,FY0+92,30,'#fff','800');
      } else {   // Einzelmodus: Zeit in die Mitte, weil oben und unten Gehege stehen
        ctx.save(); ctx.globalAlpha=.55; text(fmt(timeLeft),CX,CY,84,timeLeft<=10?'#ff6b5a':'#fff','900'); ctx.restore();
      }
    },
  });
})();

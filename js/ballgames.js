'use strict';
/* Auto-Fußball und Bumper-Hockey: gleiche Technik, andere Regeln.
   Team Links verteidigt das linke Tor, Team Rechts das rechte. */
(function(){
  function make(cfg){
    let ball={x:CX,y:CY,vx:0,vy:0,m:1,r:cfg.ballR}, playTime=0;
    const gh=cfg.goalH;

    const teamScore=t=>present().filter(p=>p.team===t).reduce((m,p)=>Math.max(m,p.score),0);
    const teamPlayers=t=>present().filter(p=>p.team===t);

    function spawn(p){
      const mates=teamPlayers(p.team).sort((a,b)=>a.seat-b.seat), i=mates.indexOf(p), n=mates.length;
      return {x:p.team===0?FX0+cfg.spawnX:FX1-cfg.spawnX, y:CY+(i-(n-1)/2)*150, vx:0,vy:0,
        a:p.team===0?0:Math.PI, m:cfg.carM, dead:false, falling:false, turboCd:0, turboFx:0};
    }

    function bot(p){
      const c=p.car; if(!c) return ZERO;
      const att=p.team===0?FX1:FX0, own=p.team===0?FX0:FX1, dirIn=p.team===0?1:-1;
      let ux=att-ball.x, uy=CY-ball.y; const L=Math.hypot(ux,uy)||1; ux/=L; uy/=L;
      const ballMine=!cfg.halves||(p.team===0?ball.x<CX+40:ball.x>CX-40);
      let tx=ball.x-ux*50, ty=ball.y-uy*50, defend=false;
      if(!ballMine){ tx=own+dirIn*230; ty=clamp(ball.y,CY-190,CY+190); defend=true; }
      const dx=ball.x-c.x, dy=ball.y-c.y, toBall=Math.hypot(dx,dy)||1;
      const aligned=(dx*ux+dy*uy)/toBall;
      if(!defend&&aligned>.7){ tx=ball.x; ty=ball.y; }
      const want=Math.atan2(ty-c.y,tx-c.x), diff=angDiff(want,c.a);
      const dist=Math.hypot(tx-c.x,ty-c.y);
      let g=Math.abs(diff)<1.5?1:.1;
      if(defend&&dist<35) g=0;
      const t=(!defend&&toBall<150&&Math.abs(diff)<.2&&aligned>.8&&Math.random()<.04)?1:0;
      return {s:clamp(diff*2.5,-1,1),g,t};
    }

    function update(dt,ph){
      const list=inRound();
      if(ph==='play') playTime+=dt;
      for(const p of list){
        const c=p.car;
        if(ph!=='countdown') drive(c,inputOf(p),dt,cfg.carP);
        keepInRect(c,cfg.carR,FX0,FY0,FX1,FY1,.4);
        if(cfg.halves){
          if(p.team===0&&c.x>CX-cfg.carR){c.x=CX-cfg.carR;c.vx=Math.min(c.vx,0);}
          if(p.team===1&&c.x<CX+cfg.carR){c.x=CX+cfg.carR;c.vx=Math.max(c.vx,0);}
        }
      }
      if(ph==='countdown') return;
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const a=list[i].car,b=list[j].car, v=collideCircles(a,b,cfg.carR,cfg.carR,.5);
        if(v) impactFx((a.x+b.x)/2,(a.y+b.y)/2,v);
      }
      for(const p of list){
        const v=collideCircles(p.car,ball,cfg.carR,ball.r,cfg.ballE);
        if(v>40){ if(bumpCd<=0){beep(cfg.kickHz,.08,'triangle',.12,-40);bumpCd=.08;} sparks(ball.x,ball.y,Math.min(8,Math.floor(v/50)),'#fff'); }
      }
      // Ball bewegen
      ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
      const dr=Math.exp(-cfg.ballDrag*dt); ball.vx*=dr; ball.vy*=dr;
      const sp=Math.hypot(ball.vx,ball.vy);
      if(sp>cfg.ballMax){ ball.vx*=cfg.ballMax/sp; ball.vy*=cfg.ballMax/sp; }
      const r=ball.r;
      if(ball.y<FY0+r){ball.y=FY0+r;ball.vy=Math.abs(ball.vy)*cfg.wallE;}
      if(ball.y>FY1-r){ball.y=FY1-r;ball.vy=-Math.abs(ball.vy)*cfg.wallE;}
      let scoredSide=-1;
      for(const side of [0,1]){
        const wallX=side===0?FX0:FX1, sgn=side===0?1:-1, depth=(ball.x-wallX)*sgn;
        if(depth>=r) continue;
        if(Math.abs(ball.y-CY)<gh/2-6){
          if(depth<0){ // im Tor: seitlich begrenzen
            const lim=gh/2-r;
            if(ball.y<CY-lim){ball.y=CY-lim;ball.vy=Math.abs(ball.vy)*.5;}
            if(ball.y>CY+lim){ball.y=CY+lim;ball.vy=-Math.abs(ball.vy)*.5;}
          }
          if(depth<-r) scoredSide=side;
          if(depth<-(r+70)){ ball.x=wallX-sgn*(r+70); ball.vx=sgn*Math.abs(ball.vx)*.3; }
        } else { ball.x=wallX+sgn*r; ball.vx=sgn*Math.abs(ball.vx)*cfg.wallE; }
      }
      if(ph==='play'&&scoredSide>=0){
        const t=scoredSide===0?1:0;   // Ball im linken Tor -> Team Rechts trifft
        sparks(ball.x,ball.y,30,TEAMS[t].color);
        return {winners:teamPlayers(t),text:'⚽ Tor für Team '+TEAMS[t].name+'!',color:TEAMS[t].color};
      }
    }

    function drawField(){
      ctx.fillStyle='#05070d'; ctx.fillRect(0,0,W,H);
      // Tore (Taschen hinter der Linie)
      for(const side of [0,1]){
        const x=side===0?FX0-70:FX1, col=TEAMS[side].color;
        ctx.fillStyle='#0b0e17'; ctx.fillRect(x,CY-gh/2,70,gh);
        ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1;
        for(let i=0;i<=70;i+=14){ ctx.beginPath(); ctx.moveTo(x+i,CY-gh/2); ctx.lineTo(x+i,CY+gh/2); ctx.stroke(); }
        for(let j=0;j<=gh;j+=14){ ctx.beginPath(); ctx.moveTo(x,CY-gh/2+j); ctx.lineTo(x+70,CY-gh/2+j); ctx.stroke(); }
        ctx.lineWidth=8; ctx.strokeStyle=col; ctx.strokeRect(x+(side===0?4:-4),CY-gh/2,70,gh);
      }
      if(cfg.skin==='grass'){
        const g=ctx.createLinearGradient(FX0,0,FX1,0); g.addColorStop(0,'#2e8b3d'); g.addColorStop(1,'#2e8b3d');
        ctx.fillStyle=g; ctx.fillRect(FX0,FY0,FX1-FX0,FY1-FY0);
        ctx.fillStyle='rgba(255,255,255,.05)';
        for(let i=0;i<10;i+=2) ctx.fillRect(FX0+i*(FX1-FX0)/10,FY0,(FX1-FX0)/10,FY1-FY0);
        ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=4;
        ctx.strokeRect(FX0,FY0,FX1-FX0,FY1-FY0);
        ctx.beginPath(); ctx.moveTo(CX,FY0); ctx.lineTo(CX,FY1); ctx.stroke();
        ctx.beginPath(); ctx.arc(CX,CY,110,0,Math.PI*2); ctx.stroke();
        ctx.strokeRect(FX0,CY-210,170,420); ctx.strokeRect(FX1-170,CY-210,170,420);
      } else {
        const g=ctx.createLinearGradient(0,FY0,0,FY1); g.addColorStop(0,'#d7ecf8'); g.addColorStop(1,'#a9cde4');
        rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,60); ctx.fillStyle=g; ctx.fill();
        ctx.save(); rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,60); ctx.clip();
        ctx.lineWidth=8; ctx.strokeStyle='#e0463a'; ctx.beginPath(); ctx.moveTo(CX,FY0); ctx.lineTo(CX,FY1); ctx.stroke();
        ctx.lineWidth=5; ctx.strokeStyle='#3b6fd6';
        ctx.beginPath(); ctx.moveTo(CX-250,FY0); ctx.lineTo(CX-250,FY1); ctx.moveTo(CX+250,FY0); ctx.lineTo(CX+250,FY1); ctx.stroke();
        ctx.strokeStyle='#e0463a'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(CX,CY,95,0,Math.PI*2); ctx.stroke();
        for(const t of [0,1]){ ctx.beginPath(); ctx.arc(t===0?FX0:FX1,CY,gh/2+10,0,Math.PI*2); ctx.stroke(); }
        ctx.restore();
        ctx.lineWidth=10; ctx.strokeStyle='#2a3350'; rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,60); ctx.stroke();
      }
      // Torlinien-Lücke zeichnen (Tor-Öffnung)
      ctx.fillStyle=cfg.skin==='grass'?'rgba(0,0,0,.25)':'rgba(30,40,70,.25)';
      ctx.fillRect(FX0-4,CY-gh/2,8,gh); ctx.fillRect(FX1-4,CY-gh/2,8,gh);
      // Pfosten
      for(const x of [FX0,FX1]) for(const y of [CY-gh/2,CY+gh/2]){
        ctx.beginPath(); ctx.arc(x,y,9,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='#222'; ctx.stroke();
      }
    }
    function drawBall(){
      const r=ball.r;
      ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(ball.x+4,ball.y+6,r,r*.9,0,0,Math.PI*2); ctx.fill();
      if(cfg.skin==='grass'){
        ctx.beginPath(); ctx.arc(ball.x,ball.y,r,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
        ctx.lineWidth=3; ctx.strokeStyle='#222'; ctx.stroke();
        const a=Math.atan2(ball.vy,ball.vx)+performance.now()/400*Math.min(1,Math.hypot(ball.vx,ball.vy)/200);
        ctx.fillStyle='#222';
        for(let i=0;i<5;i++){ const t=a+i*Math.PI*2/5; ctx.beginPath(); ctx.arc(ball.x+Math.cos(t)*r*.55,ball.y+Math.sin(t)*r*.55,r*.2,0,Math.PI*2); ctx.fill(); }
        ctx.beginPath(); ctx.arc(ball.x,ball.y,r*.25,0,Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(ball.x,ball.y,r,0,Math.PI*2); ctx.fillStyle='#15161c'; ctx.fill();
        ctx.lineWidth=5; ctx.strokeStyle='#e0463a'; ctx.stroke();
        ctx.beginPath(); ctx.arc(ball.x,ball.y,r*.45,0,Math.PI*2); ctx.fillStyle='#2b2e3a'; ctx.fill();
      }
    }
    function draw(){
      drawField();
      const k=cfg.carR/CAR_R;
      for(const p of present()) drawCar(p,k);
      drawBall();
      // Spielstand
      ctx.save(); ctx.globalAlpha=.9;
      text(String(teamScore(0)),CX-70,FY0+42,56,TEAMS[0].color,'900');
      text(':',CX,FY0+38,52,'#fff','900');
      text(String(teamScore(1)),CX+70,FY0+42,56,TEAMS[1].color,'900');
      ctx.restore();
    }

    return {
      id:cfg.id,name:cfg.name,icon:cfg.icon,desc:cfg.desc,hint:cfg.hint,teams:true,
      targets:[3,5,7],defTarget:5,targetLabel:'Tore bis',
      bot,draw,update,playT:()=>playTime,
      startRound(){
        playTime=0; ball={x:CX,y:CY,vx:0,vy:0,m:1,r:cfg.ballR};
        for(const p of present()) p.car=spawn(p);
      },
    };
  }

  GAMES.push(make({
    id:'soccer',name:'Fußball',icon:'⚽',
    desc:'Zwei Teams: Schießt den Ball ins gegnerische Tor!',
    hint:'Links gegen Rechts – Ball ins gegnerische Tor!',
    skin:'grass',carR:22,carM:1.5,ballR:28,ballDrag:.55,ballE:.75,wallE:.7,ballMax:800,goalH:280,spawnX:260,
    kickHz:240,carP:{}
  }));
  GAMES.push(make({
    id:'hockey',name:'Hockey',icon:'🏒',
    desc:'Air-Hockey: Jeder bleibt in seiner Hälfte und schießt den Puck ins Tor.',
    hint:'Bleib in deiner Hälfte – Puck ins gegnerische Tor!',
    skin:'ice',carR:34,carM:5,ballR:20,ballDrag:.12,ballE:1,wallE:.96,ballMax:1100,goalH:240,spawnX:200,halves:true,
    kickHz:420,carP:{accel:850,rev:550,drag:3,grip:10,turn:4.2,minTurn:.6,turboV:420}
  }));
})();

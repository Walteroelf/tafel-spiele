'use strict';
/* Feuerwehr: Alle zusammen löschen Brände, bevor sie sich ausbreiten.
   Der Knopf WASSER spritzt, in der Mitte (Hydrant) füllt man den Tank wieder auf. */
(function(){
  const HYDRANT=[CX,CY], HYD_R=80;
  const LEVELS={leicht:{spawn:6.5,grow:3,max:10},mittel:{spawn:4.8,grow:5,max:9},schwer:{spawn:3.6,grow:7,max:8}};
  let fires=[], water=[], timeLeft=60, playTime=0, spawnT=2, spawning=true, carry=0;

  const lv=()=>LEVELS[opt('stufe')];
  function spawnCar(p){
    const s=SEATS[p.seat]; let x=s.x*W, y=s.y*H;
    x+=(CX-x)*.2; y+=(CY-y)*.2; x=clamp(x,FX0+60,FX1-60); y=clamp(y,FY0+60,FY1-60);
    return {x,y,vx:0,vy:0,a:Math.atan2(CY-y,CX-x),dead:false,falling:false,turboCd:0,turboFx:0,tank:100,fires:0};
  }
  function newFire(near){
    for(let t=0;t<40;t++){
      const x=near?near.x+rand(-150,150):rand(FX0+80,FX1-80), y=near?near.y+rand(-150,150):rand(FY0+80,FY1-80);
      if(x<FX0+50||x>FX1-50||y<FY0+50||y>FY1-50) continue;
      if(Math.hypot(x-HYDRANT[0],y-HYDRANT[1])<HYD_R+50) continue;
      if(fires.some(f=>Math.hypot(f.x-x,f.y-y)<70)) continue;
      fires.push({x,y,hp:near?55:40,ph:rand(0,6),last:null}); return true;
    }
    return false;
  }
  const radius=f=>14+f.hp*.28;

  function bot(p){
    const c=p.car; if(!c) return ZERO;
    let tx,ty,spray=0;
    if(c.tank<18||(!fires.length&&c.tank<90)){ tx=HYDRANT[0]; ty=HYDRANT[1]; }
    else {
      let best=null,bs=-1e9;
      for(const f of fires){ const sc=f.hp*1.5-Math.hypot(f.x-c.x,f.y-c.y)*.4; if(sc>bs){bs=sc;best=f;} }
      if(!best){ tx=HYDRANT[0]; ty=HYDRANT[1]; }
      else { tx=best.x; ty=best.y; }
    }
    const dx=tx-c.x, dy=ty-c.y, d=Math.hypot(dx,dy), diff=angDiff(Math.atan2(dy,dx),c.a);
    const atFire=tx!==HYDRANT[0]||ty!==HYDRANT[1];
    if(atFire&&d<190&&Math.abs(diff)<.3&&c.tank>0) spray=1;
    const g=atFire?(d<130?0:(Math.abs(diff)<1.4?1:.15)):(d<40?0:(Math.abs(diff)<1.4?1:.15));
    return {s:clamp(diff*2.5,-1,1),g,t:spray};
  }

  const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

  GAMES.push({
    id:'fire',name:'Feuerwehr',icon:'🚒',holdT:true,turboLabel:'💧 WASSER',coop:true,
    desc:'Gemeinsam Brände löschen, bevor es zu viele werden!',
    hint:'WASSER halten zum Löschen – in der Mitte nachfüllen!',
    targets:[1,2,3],defTarget:1,targetLabel:'Siege bis',
    options:[
      {key:'dauer',label:'Dauer',values:[['60','60 s'],['90','90 s'],['120','120 s']],def:'60'},
      {key:'stufe',label:'Schwierigkeit',values:[['leicht','leicht'],['mittel','mittel'],['schwer','schwer']],def:'leicht'},
    ],
    bot,playT:()=>playTime,
    hudExtra:p=>p.car?'💧 '+Math.round(p.car.tank)+'%':'',
    startRound(){
      fires=[]; water=[]; playTime=0; spawnT=2; spawning=true; carry=0; timeLeft=+opt('dauer');
      for(const p of present()) p.car=spawnCar(p);
    },
    update(dt,ph){
      const list=inRound();
      for(const p of list){
        const c=p.car, inp=inputOf(p);
        if(ph!=='countdown') drive(c,{s:inp.s,g:inp.g,t:0},dt);
        keepInRect(c,CAR_R,FX0,FY0,FX1,FY1,.5);
        c.spray=ph==='play'&&!!inp.t&&c.tank>0;
        if(Math.hypot(c.x-HYDRANT[0],c.y-HYDRANT[1])<HYD_R) c.tank=Math.min(100,c.tank+55*dt);
        if(c.spray) c.tank=Math.max(0,c.tank-30*dt);
      }
      if(ph==='countdown') return;
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const a=list[i].car,b=list[j].car, v=collideCircles(a,b,CAR_R,CAR_R,.8);
        if(v) impactFx((a.x+b.x)/2,(a.y+b.y)/2,v);
      }
      // Wasser spritzen
      for(const p of list){
        const c=p.car; if(!c.spray) continue;
        c.sprayAcc=(c.sprayAcc||0)+dt*140;
        const n=Math.floor(c.sprayAcc); c.sprayAcc-=n;
        for(let k=0;k<n;k++){
          const sp=rand(-.12,.12), a=c.a+sp, v=440+rand(-40,40);
          water.push({x:c.x+Math.cos(c.a)*(CAR_R+4),y:c.y+Math.sin(c.a)*(CAR_R+4),vx:Math.cos(a)*v+c.vx*.5,vy:Math.sin(a)*v+c.vy*.5,life:.45,p});
        }
      }
      for(const w of water){
        w.x+=w.vx*dt; w.y+=w.vy*dt; w.life-=dt;
        for(const f of fires){
          if(Math.hypot(w.x-f.x,w.y-f.y)<radius(f)+6){ f.hp-=1.6; f.last=w.p; w.life=0; break; }
        }
      }
      water=water.filter(w=>w.life>0);
      // Gelöschte Brände
      for(let i=fires.length-1;i>=0;i--){
        const f=fires[i];
        if(f.hp<=0){
          if(f.last) f.last.car.fires++;
          sparks(f.x,f.y,18,'#cfe8ff'); beep(520,.25,'sine',.08,200);
          fires.splice(i,1);
        }
      }
      if(ph!=='play') return;
      playTime+=dt; timeLeft-=dt;
      // Brände wachsen, breiten sich aus und kommen neu dazu
      const L=lv();
      for(const f of fires){
        f.hp+=L.grow*dt;
        if(f.hp>=100){ f.hp=60; newFire(f); }
      }
      if(timeLeft<=0) spawning=false;
      if(spawning){ spawnT-=dt; if(spawnT<=0){ newFire(null); spawnT=L.spawn*rand(.8,1.2); } }
      if(fires.length>L.max){
        return {winners:[],text:'🔥 Das Feuer hat gewonnen – zu viele Brände!',color:'#ff8a3d'};
      }
      if(!spawning&&fires.length===0){
        let hero=list[0]; for(const p of list) if(p.car.fires>hero.car.fires) hero=p;
        return {winners:list.slice(),text:'🚒 Geschafft!'+(hero&&hero.car.fires?' Held: '+cname(hero.seat).toUpperCase()+' ('+hero.car.fires+' Brände)':''),color:'#7CFC9A'};
      }
    },
    draw(){
      ctx.fillStyle='#03050a'; ctx.fillRect(0,0,W,H);
      rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.fillStyle='#2b2f3a'; ctx.fill();
      ctx.save(); rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.clip();
      ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=5; ctx.setLineDash([40,40]);
      ctx.beginPath(); ctx.moveTo(FX0,CY-170); ctx.lineTo(FX1,CY-170); ctx.moveTo(FX0,CY+170); ctx.lineTo(FX1,CY+170); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      ctx.lineWidth=10; ctx.strokeStyle='#d33a2a'; rrect(ctx,FX0,FY0,FX1-FX0,FY1-FY0,40); ctx.stroke();
      // Hydrant
      ctx.beginPath(); ctx.arc(HYDRANT[0],HYDRANT[1],HYD_R,0,Math.PI*2); ctx.fillStyle='rgba(70,150,255,.25)'; ctx.fill();
      ctx.lineWidth=6; ctx.strokeStyle='#4aa3ff'; ctx.stroke();
      text('💧',HYDRANT[0],HYDRANT[1]+2,46,'#fff','700');
      // Brände
      const now=performance.now()/1000;
      for(const f of fires){
        const r=radius(f), fl=Math.sin(now*9+f.ph)*.12+1;
        ctx.save(); ctx.translate(f.x,f.y);
        ctx.fillStyle='rgba(255,120,40,.22)'; ctx.beginPath(); ctx.arc(0,0,r*1.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ff5a1f'; ctx.beginPath(); ctx.ellipse(0,-r*.15,r*.95,r*1.25*fl,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ffb21f'; ctx.beginPath(); ctx.ellipse(0,-r*.1,r*.62,r*.9*(2-fl),0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff1a8'; ctx.beginPath(); ctx.ellipse(0,0,r*.3,r*.5*fl,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(-24,r*1.2,48,7);
        ctx.fillStyle=f.hp>75?'#ff4d3a':'#ffd24a'; ctx.fillRect(-24,r*1.2,48*clamp(f.hp/100,0,1),7);
        ctx.restore();
      }
      for(const p of present()) drawCar(p);
      for(const w of water){ ctx.globalAlpha=clamp(w.life*3,0,.9); ctx.fillStyle='#8fd0ff'; ctx.beginPath(); ctx.arc(w.x,w.y,4,0,Math.PI*2); ctx.fill(); }
      ctx.globalAlpha=1;
      // Tank-Balken am Auto
      for(const p of present()){
        const c=p.car; if(!c) continue;
        ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(c.x-22,c.y+CAR_R+8,44,6);
        ctx.fillStyle=c.tank<20?'#ff6b5a':'#4aa3ff'; ctx.fillRect(c.x-22,c.y+CAR_R+8,44*c.tank/100,6);
      }
      text('🔥 '+fires.length+' / '+(lv().max+1)+'     ⏱ '+(spawning?fmt(timeLeft):'Letzte Brände!'),CX,FY0+44,38,timeLeft<=10&&spawning?'#ff6b5a':'#fff','900');
    },
  });
})();

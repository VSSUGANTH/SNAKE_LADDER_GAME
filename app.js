
/* Friends-inspired Snake Game
   Features:
   - Obstacles, Power-ups, Speed boosts
   - Keyboard + swipe controls
   - Background music toggle
   - PWA-ready (service worker + manifest provided)
*/
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let devicePixelRatio = window.devicePixelRatio || 1;

  function resizeCanvas(){
    const maxW = Math.min(window.innerWidth - 64, 960);
    canvas.width = Math.floor(maxW * devicePixelRatio);
    canvas.height = Math.floor((Math.min(window.innerHeight * 0.6, 640)) * devicePixelRatio);
    canvas.style.width = `${Math.floor(maxW)}px`;
    canvas.style.height = `${Math.floor(Math.min(window.innerHeight * 0.6, 640))}px`;
    cellSize = Math.floor(20 * devicePixelRatio);
    cols = Math.floor(canvas.width / cellSize);
    rows = Math.floor(canvas.height / cellSize);
  }

  window.addEventListener('resize', ()=>{ devicePixelRatio = window.devicePixelRatio || 1; resizeCanvas(); draw(); });

  // Game state
  let scoreEl = document.getElementById('score');
  let highEl = document.getElementById('high');
  let speedEl = document.getElementById('speed');
  let messageEl = document.getElementById('message');
  const bgm = document.getElementById('bgm');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');

  let high = parseInt(localStorage.getItem('friends_snake_high')||'0',10);
  highEl.textContent = high;

  let cellSize = 20;
  let cols = 30, rows = 20;
  resizeCanvas();

  let snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  let dir = {x:1,y:0};
  let nextDir = dir;
  let food = null;
  let obstacles = [];
  let powerups = [];
  let speedBoost = null;
  let baseInterval = 120; // ms between ticks
  let speedMultiplier = 1;
  let running = false;
  let paused = false;
  let lastTick = 0;
  let lastSpawn = 0;

  function reset(){
    snake = [{x:Math.floor(cols/2),y:Math.floor(rows/2)},{x:Math.floor(cols/2)-1,y:Math.floor(rows/2)}];
    dir = {x:1,y:0}; nextDir = dir;
    food = null;
    obstacles = [];
    powerups = [];
    speedBoost = null;
    baseInterval = 120;
    speedMultiplier = 1;
    score = 0;
    updateHud();
  }

  function randCell(margin=2){
    return {x: Math.floor(Math.random()*(cols-2*margin))+margin, y: Math.floor(Math.random()*(rows-2*margin))+margin};
  }

  function placeFood(){
    let tries = 0;
    do {
      food = randCell();
      tries++;
      if(tries>500) break;
    } while(collidesWithSnake(food)||collidesWithObstacles(food));
  }

  function collidesWithSnake(cell){
    return snake.some(s=>s.x===cell.x && s.y===cell.y);
  }
  function collidesWithObstacles(cell){
    return obstacles.some(o=>o.x===cell.x && o.y===cell.y);
  }
  function collidesWithPowerups(cell){
    return powerups.some(p=>p.x===cell.x && p.y===cell.y);
  }

  function spawnObstacles(n=6){
    obstacles = [];
    for(let i=0;i<n;i++){
      let c = randCell(3);
      if(!collidesWithSnake(c)) obstacles.push(c);
    }
  }

  function spawnPowerup(){
    const types = ['grow','shrink','score','invincible','speedBoost'];
    let t = types[Math.floor(Math.random()*types.length)];
    let c = randCell(2);
    let tries=0;
    while((collidesWithSnake(c)||collidesWithObstacles(c)||collidesWithPowerups(c)||food && c.x===food.x && c.y===food.y) && tries<300){
      c = randCell(2); tries++;
    }
    powerups.push({x:c.x,y:c.y,type:t,ttl:10000}); // ttl in ms
  }

  // Input handling (keyboard + swipe)
  window.addEventListener('keydown', e=>{
    const k = e.key;
    if(k==='ArrowUp' && dir.y===0){ nextDir = {x:0,y:-1}; }
    if(k==='ArrowDown' && dir.y===0){ nextDir = {x:0,y:1}; }
    if(k==='ArrowLeft' && dir.x===0){ nextDir = {x:-1,y:0}; }
    if(k==='ArrowRight' && dir.x===0){ nextDir = {x:1,y:0}; }
    if(k===' '){ togglePause(); }
  });

  // basic swipe
  let touchStart = null;
  canvas.addEventListener('touchstart', e=>{
    const t=e.touches[0]; touchStart = {x:t.clientX,y:t.clientY};
  }, {passive:true});
  canvas.addEventListener('touchend', e=>{
    if(!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if(Math.abs(dx)>Math.abs(dy)){
      if(dx>20 && dir.x===0) nextDir = {x:1,y:0};
      if(dx<-20 && dir.x===0) nextDir = {x:-1,y:0};
    } else {
      if(dy>20 && dir.y===0) nextDir = {x:0,y:1};
      if(dy<-20 && dir.y===0) nextDir = {x:0,y:-1};
    }
    touchStart = null;
  }, {passive:true});

  // UI buttons
  startBtn.addEventListener('click', ()=>{
    if(!running){ startGame(); } else { resetAndStart(); }
  });
  pauseBtn.addEventListener('click', ()=> togglePause());
  muteBtn.addEventListener('click', ()=>{
    if(bgm.paused){ bgm.play(); muteBtn.textContent='Toggle Music'; }
    else { bgm.pause(); muteBtn.textContent='Unmute Music'; }
  });

  function togglePause(){
    if(!running) return;
    paused = !paused;
    messageEl.textContent = paused ? 'Paused' : '';
  }

  // Game tick
  let score = 0;
  let invincibleUntil = 0;

  function gameTick(now){
    if(!running || paused) { lastTick = now; requestAnimationFrame(gameTick); return; }
    const interval = baseInterval / speedMultiplier;
    if(now - lastTick < interval){ requestAnimationFrame(gameTick); return; }
    lastTick = now;

    // move
    dir = nextDir;
    let head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

    // wrap edges
    if(head.x < 0) head.x = cols-1;
    if(head.x >= cols) head.x = 0;
    if(head.y < 0) head.y = rows-1;
    if(head.y >= rows) head.y = 0;

    // collisions
    const hitSelf = snake.some((s,i)=>i>0 && s.x===head.x && s.y===head.y);
    const hitObstacle = obstacles.some(o=>o.x===head.x && o.y===head.y);
    const nowMs = performance.now();
    if(hitSelf && nowMs < invincibleUntil){
      // pass through when invincible
    } else if(hitSelf || (hitObstacle && nowMs>invincibleUntil)){
      // game over
      running = false;
      messageEl.textContent = 'Game Over — Press Start to retry';
      if(score>high){ high=score; localStorage.setItem('friends_snake_high',String(high)); highEl.textContent = high; }
      draw();
      return;
    }

    snake.unshift(head);

    // eat food
    if(food && head.x===food.x && head.y===food.y){
      score += 10;
      placeFood();
      // small chance to spawn powerup when food eaten
      if(Math.random()<0.35) spawnPowerup();
    } else {
      snake.pop();
    }

    // powerups pickup
    for(let i=0;i<powerups.length;i++){
      const p = powerups[i];
      if(head.x===p.x && head.y===p.y){
        applyPowerup(p.type);
        powerups.splice(i,1); i--; break;
      }
    }

    // speed boost (special powerup) as ground pickup or temporary tile
    if(speedBoost && head.x===speedBoost.x && head.y===speedBoost.y){
      activateSpeedBoost(1.8, 4000);
      speedBoost = null;
    }

    // Occasionally spawn obstacles/powerups
    if(nowMs - lastSpawn > 5000){
      lastSpawn = nowMs;
      if(Math.random()<0.4) spawnPowerup();
      if(Math.random()<0.25) spawnObstacles(Math.min(10, obstacles.length + 1));
      if(Math.random()<0.15) { speedBoost = randCell(); }
    }

    // reduce powerup ttls
    powerups = powerups.filter(p => {
      p.ttl -= interval;
      return p.ttl > 0;
    });

    // update hud
    updateHud();
    draw();
    requestAnimationFrame(gameTick);
  }

  function applyPowerup(type){
    if(type==='grow'){ // adds segments
      for(let i=0;i<3;i++){ const tail = snake[snake.length-1]; snake.push({x:tail.x,y:tail.y}); }
      score += 15;
    } else if(type==='shrink'){
      if(snake.length>4) snake.splice(-3,3);
      score += 5;
    } else if(type==='score'){
      score += 30;
    } else if(type==='invincible'){
      invincibleUntil = performance.now() + 6000;
    } else if(type==='speedBoost'){
      activateSpeedBoost(2.2, 3500);
    }
  }

  function activateSpeedBoost(mult, ms){
    speedMultiplier = mult;
    setTimeout(()=>{
      speedMultiplier = 1;
    }, ms);
  }

  function updateHud(){
    scoreEl.textContent = score;
    speedEl.textContent = `${(speedMultiplier).toFixed(2)}x`;
  }

  function startGame(){
    reset();
    placeFood();
    spawnObstacles(6);
    running = true;
    paused = false;
    lastTick = performance.now();
    lastSpawn = performance.now();
    messageEl.textContent = '';
    // start music if allowed
    bgm.play().catch(()=>{});
    requestAnimationFrame(gameTick);
  }

  function resetAndStart(){
    reset();
    startGame();
  }

  // drawing helpers
  function drawGrid(){
    ctx.fillStyle = '#f6f9ff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  function drawCell(x,y,fill,stroke){
    ctx.fillStyle = fill;
    ctx.fillRect(x*cellSize+2, y*cellSize+2, cellSize-4, cellSize-4);
    if(stroke){
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x*cellSize+2, y*cellSize+2, cellSize-4, cellSize-4);
    }
  }

  function draw(){
    // clear
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // background
    ctx.fillStyle = '#f3f8ff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // draw obstacles
    obstacles.forEach(o=> drawCell(o.x,o.y,'#8b5cf6','#6d28d9'));
    // draw food
    if(food) drawCell(food.x, food.y, '#ff6f61','#c2410c');
    // draw powerups
    powerups.forEach(p=>{
      let color = '#10b981';
      if(p.type==='grow') color='#84cc16';
      if(p.type==='shrink') color='#fb923c';
      if(p.type==='score') color='#f97316';
      if(p.type==='invincible') color='#06b6d4';
      if(p.type==='speedBoost') color='#ef4444';
      drawCell(p.x,p.y,color);
      ctx.fillStyle='#fff'; ctx.font = `${12*devicePixelRatio}px sans-serif`; ctx.fillText(p.type.charAt(0).toUpperCase(), p.x*cellSize + cellSize/3, p.y*cellSize + cellSize*0.65);
    });
    // draw speedBoost tile special
    if(speedBoost) drawCell(speedBoost.x, speedBoost.y, '#fde68a', '#f59e0b');

    // draw snake
    snake.forEach((s,i)=>{
      const c = i===0 ? '#061178' : (i%2? '#3b82f6' : '#60a5fa');
      drawCell(s.x, s.y, c);
    });

    // overlay text when not running
    if(!running){
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
  }

  // initial draw
  draw();

  // expose for debugging
  window.gameAPI = { startGame, reset, draw };
})();

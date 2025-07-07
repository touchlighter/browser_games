/* ─────────────────────────────────────────
   CONFIG & CONSTANTS
───────────────────────────────────────── */
const W = 600, H = 800;
const PLAYER_W = 42, PLAYER_H = 20, PLAYER_Y = H - 60, PLAYER_SPEED = 6;
const BULLET_R = 4, BULLET_SPEED = 8;
const ENEMY_W = 32, ENEMY_H = 24, ROWS = 5, COLS = 11;
const ENEMY_H_SPACING = 50, ENEMY_V_SPACING = 40;
const ENEMY_START_X = 60, ENEMY_START_Y = 80;
const ENEMY_STEP = 0.15, ENEMY_DROP = 30, ENEMY_SHOOT_INTERVAL = 1500;
const BUNKER_W = 80, BUNKER_H = 40, BUNKER_Y = H - 160;

/* ─────────────────────────────────────────
   CANVAS
───────────────────────────────────────── */
const cv  = document.getElementById("game");
const ctx = cv.getContext("2d");

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const rand = (a, b) => Math.random() * (b - a) + a;
function circleHitsRect(c, r, rect) {
  return (
    c.x + r >= rect.x &&
    c.x - r <= rect.x + rect.w &&
    c.y + r >= rect.y &&
    c.y - r <= rect.y + rect.h
  );
}

/* ─────────────────────────────────────────
   CLASSES
───────────────────────────────────────── */
class Bullet {
  constructor(x, y, dy, color, enemy = false) {
    this.x = x;
    this.y = y;
    this.dy = dy;
    this.color = color;
    this.enemy = enemy;
  }
  update() { this.y += this.dy; }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, BULLET_R, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

class Player {
  constructor() {
    this.w = PLAYER_W;
    this.h = PLAYER_H;
    this.x = (W - this.w) / 2;
    this.y = PLAYER_Y;
    this.cooldown = 0;
    this.lives = 3;
    this.score = 0;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  move(dir) {
    this.x += dir * PLAYER_SPEED;
    this.x = Math.max(0, Math.min(W - this.w, this.x));
  }
  shoot() {
    if (this.cooldown <= 0) {
      bullets.push(
        new Bullet(this.x + this.w / 2, this.y - 8, -BULLET_SPEED, "#fff")
      );
      this.cooldown = 15;
      beep(440, 0.05);
    }
  }
  update() { if (this.cooldown > 0) this.cooldown--; }
  draw() {
    ctx.fillStyle = "#0f0";
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

class Enemy {
  constructor(col, row) {
    this.w = ENEMY_W;
    this.h = ENEMY_H;
    this.x = ENEMY_START_X + col * ENEMY_H_SPACING;
    this.y = ENEMY_START_Y + row * ENEMY_V_SPACING;
    this.row = row;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  draw() {
    const colors = ["#0f8", "#6f6", "#ff0", "#f80", "#f44"];
    ctx.fillStyle = colors[this.row];
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

class Bunker {
  constructor(x) {
    this.x = x;
    this.y = BUNKER_Y;
    this.w = BUNKER_W;
    this.h = BUNKER_H;
    this.health = 20;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  damage() { this.health = Math.max(0, this.health - 1); }
  draw() {
    ctx.fillStyle = "#0a0";
    const blocks = Math.ceil((this.health / 20) * this.w);
    ctx.fillRect(this.x, this.y, blocks, this.h);
  }
}

/* ─────────────────────────────────────────
   AUDIO (simple beep)
───────────────────────────────────────── */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audio = new AudioCtx();
function beep(freq, dur) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = freq;
  osc.type = "square";
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  gain.gain.setValueAtTime(0.1, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  osc.stop(audio.currentTime + dur);
}

/* ─────────────────────────────────────────
   GAME STATE & INIT
───────────────────────────────────────── */
let player, enemies, bullets, bunkers;
let dir, enemySpeed, lastEnemyShot;
let level, state;

function init(levelNum = 1) {
  player = new Player();
  bullets = [];
  enemies = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) enemies.push(new Enemy(c, r));
  dir = 1;
  enemySpeed = ENEMY_STEP * levelNum;
  lastEnemyShot = 0;
  bunkers = [];
  const spacing = (W - 4 * BUNKER_W) / 5;
  for (let i = 0; i < 4; i++)
    bunkers.push(new Bunker(spacing + i * (BUNKER_W + spacing)));
  level = levelNum;
  state = "playing";
}
init();

/* ─────────────────────────────────────────
   INPUT
───────────────────────────────────────── */
const keys = {};
document.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (state !== "playing" && e.key === " ") init(level);
});
document.addEventListener("keyup", e => { keys[e.key] = false; });

/* ─────────────────────────────────────────
   MAIN LOOP
───────────────────────────────────────── */
let last = 0;
function loop(timestamp) {
  const dt = (timestamp - last) || 0;
  last = timestamp;
  update(dt, timestamp);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ─────────────────────────────────────────
   UPDATE
───────────────────────────────────────── */
function update(dt, now) {
  if (state !== "playing") return;

  /* Player */
  if (keys["ArrowLeft"]) player.move(-1);
  if (keys["ArrowRight"]) player.move(1);
  if (keys[" "] || keys["ArrowUp"]) player.shoot();
  player.update();

  /* Enemy movement */
  let shift = false;
  enemies.forEach(e => { e.x += dir * enemySpeed * dt; });
  const xs = enemies.map(e => e.x);
  const ws = enemies.map(e => e.w);
  if (Math.min(...xs) <= 10 || Math.max(...xs.map((x, i) => x + ws[i])) >= W - 10)
    shift = true;
  if (shift) {
    dir *= -1;
    enemies.forEach(e => { e.y += ENEMY_DROP; });
    enemySpeed *= 1.01;
  }

  /* Enemy shooting */
  if (now - lastEnemyShot > ENEMY_SHOOT_INTERVAL && enemies.length) {
    const shooter = enemies[Math.floor(Math.random() * enemies.length)];
    bullets.push(
      new Bullet(shooter.x + ENEMY_W / 2, shooter.y + ENEMY_H, BULLET_SPEED, "#f44", true)
    );
    lastEnemyShot = now;
    beep(180, 0.08);
  }

  /* Update bullets */
  bullets.forEach(b => b.update());
  bullets = bullets.filter(b => b.y > -20 && b.y < H + 20);

  /* Collisions */
  bullets.forEach((b, bi) => {
    if (b.enemy) {
      if (circleHitsRect(b, BULLET_R, player.rect)) {
        bullets.splice(bi, 1);
        player.lives--;
        beep(110, 0.2);
        if (player.lives <= 0) state = "gameover";
      } else {
        bunkers.forEach(bk => {
          if (circleHitsRect(b, BULLET_R, bk.rect)) {
            bk.damage();
            bullets.splice(bi, 1);
          }
        });
      }
    } else {
      enemies.forEach((e, ei) => {
        if (circleHitsRect(b, BULLET_R, e.rect)) {
          enemies.splice(ei, 1);
          bullets.splice(bi, 1);
          player.score += 100;
          beep(660, 0.05);
        }
      });
      bunkers.forEach(bk => {
        if (circleHitsRect(b, BULLET_R, bk.rect)) {
          bk.damage();
          bullets.splice(bi, 1);
        }
      });
    }
  });

  /* Level progression */
  if (!enemies.length) init(level + 1);

  /* Enemy reached player line */
  enemies.forEach(e => {
    if (e.y + e.h >= PLAYER_Y) state = "gameover";
  });
}

/* ─────────────────────────────────────────
   DRAW
───────────────────────────────────────── */
function draw() {
  ctx.clearRect(0, 0, W, H);

  /* Stars background */
  ctx.fillStyle = "#030";
  for (let i = 0; i < 50; i++) ctx.fillRect(rand(0, W), rand(0, H), 2, 2);

  /* Entities */
  player.draw();
  enemies.forEach(e => e.draw());
  bunkers.forEach(bk => bk.draw());
  bullets.forEach(b => b.draw());

  /* HUD */
  ctx.fillStyle = "#0f0";
  ctx.font = "18px monospace";
  ctx.fillText(`Score ${player.score}`, 16, 24);
  ctx.fillText(`Lives ${player.lives}`, W - 100, 24);
  ctx.fillText(`Level ${level}`, W / 2 - 40, 24);

  if (state === "gameover") {
    ctx.textAlign = "center";
    ctx.font = "48px monospace";
    ctx.fillText("GAME OVER", W / 2, H / 2);
    ctx.font = "20px monospace";
    ctx.fillText("Press Space to Restart", W / 2, H / 2 + 40);
    ctx.textAlign = "left";
  }
}


import {
  World, createSystem, PanelUI, PanelDocument, UIKitDocument, UIKit, eq, Follower,
  InputComponent, Vector3, Color, Mesh, MeshBasicMaterial, BoxGeometry, SphereGeometry,
  CylinderGeometry, PlaneGeometry, Group, LineSegments, EdgesGeometry, LineBasicMaterial,
  AdditiveBlending, DoubleSide, AmbientLight, DirectionalLight, PointLight,
  TorusGeometry, FogExp2, RingGeometry, ConeGeometry
} from '@iwsdk/core';

// ==================== CONSTANTS ====================
const COLS = 11;
const ROWS = 13;
const CELL = 0.3;
const BW = COLS * CELL;
const BXL = -BW / 2;
const BXR = BW / 2;
const HOP_DUR = 0.15;
const HOP_ARC = 0.15;
const FROG_R = 0.07;
const HOME_COLS = [1, 3, 5, 7, 9];
const WRAP_M = 1.0;
const DIFF_SPD: Record<string, number> = { easy: 0.7, medium: 1.0, hard: 1.4 };
const MODE_TIME: Record<string, number> = { easy: 90, medium: 60, hard: 45 };

const VW: Record<string, number> = { motorcycle: 0.15, car: 0.35, sportsCar: 0.28, truck: 0.55, bus: 0.65 };
const VH: Record<string, number> = { motorcycle: 0.06, car: 0.08, sportsCar: 0.07, truck: 0.1, bus: 0.12 };
const VD: Record<string, number> = { motorcycle: 0.1, car: 0.15, sportsCar: 0.13, truck: 0.18, bus: 0.16 };
const VCOL: Record<string, number> = { motorcycle: 0xffcc00, car: 0xff4400, sportsCar: 0xff00aa, truck: 0xaa00ff, bus: 0x00aaff };
const PW: Record<string, number> = { shortLog: 0.5, longLog: 0.9, turtles: 0.6 };

type VType = 'motorcycle' | 'car' | 'sportsCar' | 'truck' | 'bus';
type PType = 'shortLog' | 'longLog' | 'turtles';
type GState = 'title' | 'modeSelect' | 'difficulty' | 'playing' | 'paused' | 'gameOver' |
  'levelComplete' | 'countdown' | 'leaderboard' | 'achievements' | 'settings' | 'skins' | 'stats' | 'help';
type GMode = 'classic' | 'endless' | 'timeAttack' | 'survival' | 'zen' | 'daily' | 'rushHour' | 'speedRun';
type Diff = 'easy' | 'medium' | 'hard';

interface VObj { type: VType; row: number; x: number; spd: number; w: number; mesh: Group; }
interface PObj { type: PType; row: number; x: number; spd: number; w: number; mesh: Group;
  diving: boolean; dt: number; dd: number; sd: number; }
interface Ptcl { mesh: Mesh; vx: number; vy: number; vz: number; life: number; age: number; }
interface Lane { type: 'safe' | 'road' | 'river' | 'home'; dir?: number; spd?: number;
  item?: string; cnt?: number; gap?: number; }

const LANES: Lane[] = [
  { type: 'safe' },
  { type: 'road', dir: -1, spd: 0.5, item: 'motorcycle', cnt: 4, gap: 0.55 },
  { type: 'road', dir: 1, spd: 0.2, item: 'bus', cnt: 2, gap: 1.2 },
  { type: 'road', dir: -1, spd: 0.35, item: 'car', cnt: 3, gap: 0.65 },
  { type: 'road', dir: 1, spd: 0.25, item: 'truck', cnt: 2, gap: 0.9 },
  { type: 'road', dir: -1, spd: 0.45, item: 'sportsCar', cnt: 3, gap: 0.6 },
  { type: 'safe' },
  { type: 'river', dir: 1, spd: 0.18, item: 'longLog', cnt: 2, gap: 0.85 },
  { type: 'river', dir: -1, spd: 0.25, item: 'turtles', cnt: 3, gap: 0.55 },
  { type: 'river', dir: 1, spd: 0.3, item: 'shortLog', cnt: 3, gap: 0.6 },
  { type: 'river', dir: -1, spd: 0.2, item: 'turtles', cnt: 2, gap: 0.9 },
  { type: 'river', dir: 1, spd: 0.4, item: 'shortLog', cnt: 3, gap: 0.45 },
  { type: 'home' },
];

// ==================== THEMES ====================
interface Theme { name: string; grid: number; accent: number; bg: number; fog: number;
  road: number; water: number; safe: number; frog: number; home: number; glow: number; }

const THEMES: Theme[] = [
  { name: 'Neon Holodeck', grid: 0x00ffcc, accent: 0x00ffff, bg: 0x000811, fog: 0x000811,
    road: 0x111122, water: 0x001133, safe: 0x003322, frog: 0x00ff88, home: 0x00ff44, glow: 0x00ffcc },
  { name: 'Crimson Grid', grid: 0xff3344, accent: 0xff6644, bg: 0x0a0004, fog: 0x0a0004,
    road: 0x1a0808, water: 0x0a0022, safe: 0x1a1100, frog: 0xff4466, home: 0xff6622, glow: 0xff3344 },
  { name: 'Toxic Neon', grid: 0x44ff00, accent: 0x88ff22, bg: 0x000a02, fog: 0x000a02,
    road: 0x0a1108, water: 0x001a0a, safe: 0x112200, frog: 0x66ff22, home: 0x88ff00, glow: 0x44ff00 },
  { name: 'Ultra Violet', grid: 0xaa44ff, accent: 0xcc66ff, bg: 0x06000f, fog: 0x06000f,
    road: 0x110022, water: 0x08001a, safe: 0x1a0033, frog: 0xbb66ff, home: 0xcc44ff, glow: 0xaa44ff },
  { name: 'Solar Blaze', grid: 0xff8800, accent: 0xffaa22, bg: 0x0a0400, fog: 0x0a0400,
    road: 0x1a0a00, water: 0x0a0800, safe: 0x1a1100, frog: 0xffaa00, home: 0xff8822, glow: 0xff8800 },
];

// ==================== SKINS ====================
interface Skin { name: string; color: number; glow: number; req: string; desc: string; }
const SKINS: Skin[] = [
  { name: 'Neon Green', color: 0x00ff88, glow: 0x00ffaa, req: 'default', desc: 'Default' },
  { name: 'Solar Flare', color: 0xff8800, glow: 0xffaa22, req: 'hops_50', desc: '50 hops' },
  { name: 'Frost Frog', color: 0x44ccff, glow: 0x66ddff, req: 'score_5k', desc: '5K score' },
  { name: 'Toxic Toad', color: 0x88ff00, glow: 0xaaff22, req: 'games_10', desc: '10 games' },
  { name: 'Plasma Pink', color: 0xff44cc, glow: 0xff66dd, req: 'combo_5', desc: 'x5 combo' },
  { name: 'Royal Gold', color: 0xffcc00, glow: 0xffdd44, req: 'no_death', desc: 'Perfect run' },
  { name: 'Void Purple', color: 0x8844ff, glow: 0xaa66ff, req: 'homes_50', desc: '50 homes' },
  { name: 'Inferno', color: 0xff2200, glow: 0xff4422, req: 'all_modes', desc: 'All modes' },
];

// ==================== ACHIEVEMENTS ====================
interface Achv { id: string; name: string; desc: string; }
const ACHVS: Achv[] = [
  { id: 'first_hop', name: 'Baby Steps', desc: 'Make your first hop' },
  { id: 'first_home', name: 'Home Sweet Home', desc: 'Reach a home base' },
  { id: 'fill_all', name: 'Full House', desc: 'Fill all 5 homes' },
  { id: 'hops_50', name: 'Hopper', desc: '50 total hops' },
  { id: 'hops_500', name: 'Marathon Frog', desc: '500 total hops' },
  { id: 'score_1k', name: 'Point Collector', desc: 'Score 1,000 pts' },
  { id: 'score_5k', name: 'Score Master', desc: 'Score 5,000 pts' },
  { id: 'score_10k', name: 'Score Legend', desc: 'Score 10,000 pts' },
  { id: 'combo_3', name: 'Hop Chain', desc: 'x3 forward combo' },
  { id: 'combo_5', name: 'Combo Frog', desc: 'x5 forward combo' },
  { id: 'combo_10', name: 'Unstoppable', desc: 'x10 forward combo' },
  { id: 'level_3', name: 'Getting Warmer', desc: 'Reach level 3' },
  { id: 'level_5', name: 'Road Warrior', desc: 'Reach level 5' },
  { id: 'level_10', name: 'Frog Master', desc: 'Reach level 10' },
  { id: 'no_death', name: 'Perfect Run', desc: 'No deaths in a level' },
  { id: 'speed_30', name: 'Speed Demon', desc: 'Fill homes under 30s' },
  { id: 'ride_log', name: 'Log Rider', desc: 'Ride a log 3+ seconds' },
  { id: 'close_call', name: 'Close Call', desc: 'Barely dodge a vehicle' },
  { id: 'daily_1', name: 'Daily Player', desc: 'Complete a daily challenge' },
  { id: 'daily_3', name: 'Dedicated', desc: '3 daily challenges' },
  { id: 'daily_7', name: 'Weekly Warrior', desc: '7 daily challenges' },
  { id: 'games_10', name: 'Regular', desc: 'Play 10 games' },
  { id: 'games_50', name: 'Veteran', desc: 'Play 50 games' },
  { id: 'games_100', name: 'Centurion', desc: 'Play 100 games' },
  { id: 'survival_60', name: 'Survivor', desc: '60s in Survival' },
  { id: 'survival_120', name: 'Endurance', desc: '120s in Survival' },
  { id: 'rush_clear', name: 'Rush Expert', desc: 'Clear Rush Hour level' },
  { id: 'speed_run', name: 'Lightning Frog', desc: 'Speed Run under 15s' },
  { id: 'homes_50', name: 'Homebound', desc: '50 total homes' },
  { id: 'homes_100', name: 'Home Legend', desc: '100 total homes' },
  { id: 'no_back', name: 'Only Forward', desc: 'Clear without going back' },
  { id: 'all_modes', name: 'Mode Explorer', desc: 'Play all 8 modes' },
  { id: 'skin_unlock', name: 'Fashion Frog', desc: 'Unlock a skin' },
  { id: 'theme_all', name: 'Theme Tourist', desc: 'Play every theme' },
  { id: 'turtle_ride', name: 'Turtle Power', desc: 'Ride turtles 5 times' },
  { id: 'zen_100', name: 'Zen Master', desc: '100 pts in Zen' },
  { id: 'endless_5', name: 'Endless Runner', desc: '5 levels in Endless' },
  { id: 'total_10k', name: 'Career Score', desc: '10K career pts' },
  { id: 'total_50k', name: 'Legend', desc: '50K career pts' },
  { id: 'back_forth', name: 'Indecisive', desc: 'Hop back 5 times' },
];

// ==================== HELPERS ====================
function colToX(col: number): number { return BXL + (col + 0.5) * CELL; }
function rowToZ(row: number): number { return -row * CELL; }
function xToCol(x: number): number { return Math.round((x - BXL) / CELL - 0.5); }
function snapToCol(x: number): number { return colToX(Math.max(0, Math.min(COLS - 1, xToCol(x)))); }
function mulberry32(s: number) { return () => { let t = s += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dateSeed(): number { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

// ==================== AUDIO ====================
class AudioManager {
  private ctx: AudioContext | null = null;
  masterVol = 0.7; sfxVol = 0.8; musicVol = 0.5;
  private drone: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  private tone(freq: number, type: OscillatorType, dur: number, vol: number, delay = 0) {
    const c = this.getCtx(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol * this.sfxVol * this.masterVol;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur);
  }
  private noise(dur: number, vol: number) {
    const c = this.getCtx(), n = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf; const g = c.createGain();
    g.gain.value = vol * this.sfxVol * this.masterVol;
    n.connect(g).connect(c.destination); n.start();
  }
  hop() { this.tone(440, 'triangle', 0.08, 0.3); this.tone(660, 'sine', 0.06, 0.2, 0.03); }
  splash() { this.noise(0.15, 0.3); this.tone(200, 'sine', 0.1, 0.15); }
  squish() { this.tone(220, 'sawtooth', 0.15, 0.3); this.tone(110, 'square', 0.1, 0.2, 0.05); }
  homeReach() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'sine', 0.12, 0.25, i * 0.08)); }
  levelUp() { [440, 554, 659, 784, 880, 1047].forEach((f, i) => this.tone(f, 'triangle', 0.1, 0.2, i * 0.06)); }
  gameOverSfx() { [880, 660, 440, 330].forEach((f, i) => this.tone(f, 'sawtooth', 0.15, 0.2, i * 0.1)); }
  gameStartSfx() { [330, 440, 554, 660].forEach((f, i) => this.tone(f, 'triangle', 0.1, 0.2, i * 0.08)); }
  click() { this.tone(800, 'sine', 0.04, 0.15); }
  achv() { [660, 784, 880, 1047, 1175].forEach((f, i) => this.tone(f, 'sine', 0.1, 0.2, i * 0.06)); }
  combo(lv: number) { this.tone(440 + lv * 55, 'triangle', 0.08, 0.25); }
  tick() { this.tone(440, 'sine', 0.06, 0.2); }
  go() { this.tone(880, 'sine', 0.12, 0.3); }
  startDrone() {
    const c = this.getCtx(); this.droneGain = c.createGain();
    this.droneGain.gain.value = this.musicVol * this.masterVol * 0.12;
    this.droneGain.connect(c.destination);
    const fs: [number, OscillatorType][] = [[55, 'sine'], [82.5, 'triangle'], [110, 'sine']];
    this.drone = fs.map(([f, t]) => {
      const o = c.createOscillator(); o.type = t; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      o.connect(lp).connect(this.droneGain!); o.start(); return o;
    });
  }
  stopDrone() { this.drone.forEach(o => { try { o.stop(); } catch {} }); this.drone = []; }
  updateDrone() { if (this.droneGain) this.droneGain.gain.value = this.musicVol * this.masterVol * 0.12; }
}

const audio = new AudioManager();

// ==================== GAME STATE ====================
class GameMgr {
  state: GState = 'title'; mode: GMode = 'classic'; diff: Diff = 'medium';
  level = 1; score = 0; lives = 3; combo = 0; bestCombo = 0;
  homesFilled = [false, false, false, false, false];
  frogX = 0; frogRow = 0; hopping = false; hopProg = 0;
  hopFX = 0; hopFR = 0; hopTX = 0; hopTR = 0;
  hopDir: 'up' | 'down' | 'left' | 'right' = 'up';
  alive = true; deathT = 0; timer = 0; lvlT = 0;
  cdT = 0; cdVal = 3; hopsLvl = 0; deathsLvl = 0;
  backHops = 0; turtleRides = 0; logRideT = 0;
  vehicles: VObj[] = []; platforms: PObj[] = [];
  // Career
  totalGames = 0; totalHops = 0; totalHomes = 0; totalScore = 0;
  totalDeaths = 0; bestScore = 0; bestLevel = 0; bestComboEver = 0;
  totalPlayTime = 0; dailyCount = 0;
  modesPlayed = new Set<string>(); themesPlayed = new Set<string>();
  achvs = new Set<string>(); skinIdx = 0; themeIdx = 0;
  lb: { score: number; mode: string; level: number; date: string }[] = [];
  achPage = 0; pendingToast: string[] = [];

  constructor() { this.load(); }

  save() {
    try { localStorage.setItem('neon-frog', JSON.stringify({
      achvs: [...this.achvs], skinIdx: this.skinIdx, themeIdx: this.themeIdx,
      lb: this.lb, totalGames: this.totalGames, totalHops: this.totalHops,
      totalHomes: this.totalHomes, totalScore: this.totalScore, totalDeaths: this.totalDeaths,
      bestScore: this.bestScore, bestLevel: this.bestLevel, bestComboEver: this.bestComboEver,
      totalPlayTime: this.totalPlayTime, dailyCount: this.dailyCount,
      modesPlayed: [...this.modesPlayed], themesPlayed: [...this.themesPlayed],
      masterVol: audio.masterVol, sfxVol: audio.sfxVol, musicVol: audio.musicVol,
    })); } catch {}
  }

  load() {
    try {
      const d = JSON.parse(localStorage.getItem('neon-frog') || '{}');
      if (d.achvs) this.achvs = new Set(d.achvs);
      if (d.skinIdx != null) this.skinIdx = d.skinIdx;
      if (d.themeIdx != null) this.themeIdx = d.themeIdx;
      if (d.lb) this.lb = d.lb;
      if (d.totalGames != null) this.totalGames = d.totalGames;
      if (d.totalHops != null) this.totalHops = d.totalHops;
      if (d.totalHomes != null) this.totalHomes = d.totalHomes;
      if (d.totalScore != null) this.totalScore = d.totalScore;
      if (d.totalDeaths != null) this.totalDeaths = d.totalDeaths;
      if (d.bestScore != null) this.bestScore = d.bestScore;
      if (d.bestLevel != null) this.bestLevel = d.bestLevel;
      if (d.bestComboEver != null) this.bestComboEver = d.bestComboEver;
      if (d.totalPlayTime != null) this.totalPlayTime = d.totalPlayTime;
      if (d.dailyCount != null) this.dailyCount = d.dailyCount;
      if (d.modesPlayed) this.modesPlayed = new Set(d.modesPlayed);
      if (d.themesPlayed) this.themesPlayed = new Set(d.themesPlayed);
      if (d.masterVol != null) audio.masterVol = d.masterVol;
      if (d.sfxVol != null) audio.sfxVol = d.sfxVol;
      if (d.musicVol != null) audio.musicVol = d.musicVol;
    } catch {}
  }

  resetFrog() {
    this.frogX = colToX(5); this.frogRow = 0; this.hopping = false;
    this.alive = true; this.combo = 0; this.hopsLvl = 0;
    this.deathsLvl = 0; this.backHops = 0; this.turtleRides = 0;
    this.logRideT = 0; this.lvlT = 0;
  }

  startGame(mode: GMode, diff: Diff) {
    this.mode = mode; this.diff = diff; this.level = 1; this.score = 0;
    this.bestCombo = 0;
    this.lives = mode === 'survival' ? 1 : diff === 'easy' ? 5 : diff === 'medium' ? 3 : 2;
    this.homesFilled = [false, false, false, false, false];
    this.resetFrog(); this.totalGames++; this.modesPlayed.add(mode);
    this.themesPlayed.add(THEMES[this.themeIdx].name);
    if (mode === 'timeAttack') this.timer = MODE_TIME[diff];
    else this.timer = 0;
  }

  hop(dir: 'up' | 'down' | 'left' | 'right'): boolean {
    if (this.hopping || !this.alive || this.state !== 'playing') return false;
    const nr = dir === 'up' ? this.frogRow + 1 : dir === 'down' ? this.frogRow - 1 : this.frogRow;
    const nx = dir === 'left' ? this.frogX - CELL : dir === 'right' ? this.frogX + CELL : this.frogX;
    if (nr < 0 || nr > ROWS - 1 || nx < BXL - 0.01 || nx > BXR + 0.01) return false;
    this.hopFX = this.frogX; this.hopFR = this.frogRow;
    this.hopTX = nx; this.hopTR = nr; this.hopDir = dir;
    this.hopping = true; this.hopProg = 0;
    this.totalHops++; this.hopsLvl++;
    if (dir === 'up') {
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      if (this.combo > this.bestComboEver) this.bestComboEver = this.combo;
      this.score += 10 * Math.min(this.combo, 10);
    } else { if (dir === 'down') this.backHops++; this.combo = 0; }
    return true;
  }

  finishHop() {
    this.hopping = false; this.frogX = this.hopTX; this.frogRow = this.hopTR;
    const lane = LANES[this.frogRow];
    if (lane.type === 'safe' || lane.type === 'road') this.frogX = snapToCol(this.frogX);
  }

  checkHome(): 'home' | 'miss' | 'none' {
    if (this.frogRow !== ROWS - 1) return 'none';
    const col = xToCol(this.frogX);
    const nearestHome = HOME_COLS.reduce((best, hc) =>
      Math.abs(colToX(hc) - this.frogX) < Math.abs(colToX(best) - this.frogX) ? hc : best, HOME_COLS[0]);
    const dist = Math.abs(colToX(nearestHome) - this.frogX);
    if (dist < CELL * 0.7) {
      const idx = HOME_COLS.indexOf(nearestHome);
      if (!this.homesFilled[idx]) {
        this.homesFilled[idx] = true; this.totalHomes++;
        this.score += 50;
        if (this.lvlT < 30) this.score += Math.floor((30 - this.lvlT) * 5);
        this.unlock('first_home');
        if (this.homesFilled.every(h => h)) {
          this.score += 1000; this.unlock('fill_all');
          if (this.deathsLvl === 0) this.unlock('no_death');
          if (this.lvlT < 30) this.unlock('speed_30');
          if (this.backHops === 0) this.unlock('no_back');
          return 'home';
        }
        this.frogX = colToX(5); this.frogRow = 0; this.combo = 0;
        return 'home';
      }
    }
    return 'miss';
  }

  die() {
    if (this.mode === 'zen') { this.frogX = colToX(5); this.frogRow = 0; this.combo = 0; return; }
    this.alive = false; this.deathT = 0.8; this.lives--; this.combo = 0;
    this.deathsLvl++; this.totalDeaths++;
    if (this.lives <= 0) this.endGame();
  }

  respawn() { this.alive = true; this.frogX = colToX(5); this.frogRow = 0; this.hopping = false; }

  endGame() {
    this.state = 'gameOver';
    if (this.score > this.bestScore) this.bestScore = this.score;
    this.totalScore += this.score;
    this.lb.push({ score: this.score, mode: this.mode, level: this.level, date: new Date().toLocaleDateString() });
    this.lb.sort((a, b) => b.score - a.score);
    if (this.lb.length > 20) this.lb.length = 20;
    this.checkAchvs(); this.save();
  }

  unlock(id: string): boolean {
    if (!this.achvs.has(id)) {
      this.achvs.add(id);
      const a = ACHVS.find(a => a.id === id);
      if (a) this.pendingToast.push(a.name);
      if (id !== 'first_hop' && id !== 'skin_unlock') this.unlock('skin_unlock');
      return true;
    }
    return false;
  }

  checkAchvs() {
    if (this.totalHops >= 50) this.unlock('hops_50');
    if (this.totalHops >= 500) this.unlock('hops_500');
    if (this.score >= 1000) this.unlock('score_1k');
    if (this.score >= 5000) this.unlock('score_5k');
    if (this.score >= 10000) this.unlock('score_10k');
    if (this.bestCombo >= 3) this.unlock('combo_3');
    if (this.bestCombo >= 5) this.unlock('combo_5');
    if (this.bestCombo >= 10) this.unlock('combo_10');
    if (this.level >= 3) this.unlock('level_3');
    if (this.level >= 5) this.unlock('level_5');
    if (this.level >= 10) this.unlock('level_10');
    if (this.totalGames >= 10) this.unlock('games_10');
    if (this.totalGames >= 50) this.unlock('games_50');
    if (this.totalGames >= 100) this.unlock('games_100');
    if (this.totalHomes >= 50) this.unlock('homes_50');
    if (this.totalHomes >= 100) this.unlock('homes_100');
    if (this.modesPlayed.size >= 8) this.unlock('all_modes');
    if (this.totalScore >= 10000) this.unlock('total_10k');
    if (this.totalScore >= 50000) this.unlock('total_50k');
    if (this.turtleRides >= 5) this.unlock('turtle_ride');
    if (this.backHops >= 5) this.unlock('back_forth');
    if (this.themesPlayed.size >= 5) this.unlock('theme_all');
    if (this.mode === 'zen' && this.score >= 100) this.unlock('zen_100');
    if (this.mode === 'endless' && this.level >= 5) this.unlock('endless_5');
    if (this.mode === 'rushHour') this.unlock('rush_clear');
    if (this.mode === 'daily') {
      this.dailyCount++; this.unlock('daily_1');
      if (this.dailyCount >= 3) this.unlock('daily_3');
      if (this.dailyCount >= 7) this.unlock('daily_7');
    }
  }

  spdMult(): number {
    const dm = DIFF_SPD[this.diff]; const lm = 1 + (this.level - 1) * 0.08;
    const mm = this.mode === 'rushHour' ? 1.3 : this.mode === 'speedRun' ? 1.2 : 1.0;
    return dm * lm * mm;
  }

  skinUnlocked(idx: number): boolean {
    if (idx === 0) return true;
    return this.achvs.has(SKINS[idx].req);
  }
}

// ==================== MESH FACTORIES ====================
function mkVehicle(type: string): Group {
  const g = new Group();
  const w = VW[type] || 0.3, h = VH[type] || 0.08, d = VD[type] || 0.14;
  const col = VCOL[type] || 0xff4400;
  const body = new Mesh(new BoxGeometry(w, h, d),
    new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 }));
  body.position.y = h / 2 + 0.01; g.add(body);
  g.add(Object.assign(new LineSegments(new EdgesGeometry(new BoxGeometry(w, h, d)),
    new LineBasicMaterial({ color: col })), { position: body.position.clone() }));
  const glow = new Mesh(new BoxGeometry(w * 1.1, h * 1.3, d * 1.1),
    new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: AdditiveBlending }));
  glow.position.copy(body.position); g.add(glow);
  // Headlights
  const hlGeo = new SphereGeometry(0.012, 6, 4);
  const hlMat = new MeshBasicMaterial({ color: 0xffffaa });
  [-1, 1].forEach(s => {
    const hl = new Mesh(hlGeo, hlMat);
    hl.position.set(s * w * 0.35, h * 0.5 + 0.01, -d * 0.5 - 0.005);
    g.add(hl);
  });
  return g;
}

function mkPlatform(type: string): Group {
  const g = new Group(); const w = PW[type] || 0.5;
  if (type === 'turtles') {
    const cnt = 3, sp = w / cnt;
    for (let i = 0; i < cnt; i++) {
      const sh = new Mesh(new SphereGeometry(0.045, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new MeshBasicMaterial({ color: 0x00aa44, transparent: true, opacity: 0.6 }));
      sh.position.set((i - 1) * sp, 0.005, 0); g.add(sh);
      g.add(Object.assign(new LineSegments(new EdgesGeometry(new SphereGeometry(0.045, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
        new LineBasicMaterial({ color: 0x00ff66 })), { position: sh.position.clone() }));
    }
  } else {
    const col = type === 'longLog' ? 0xcc8844 : 0xaa6633;
    const log = new Mesh(new CylinderGeometry(0.035, 0.035, w, 8),
      new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 }));
    log.rotation.z = Math.PI / 2; log.position.y = 0.02; g.add(log);
    g.add(Object.assign(new LineSegments(new EdgesGeometry(new CylinderGeometry(0.035, 0.035, w, 8)),
      new LineBasicMaterial({ color: col })), { rotation: log.rotation.clone(), position: log.position.clone() }));
    const gl = new Mesh(new CylinderGeometry(0.045, 0.045, w, 8),
      new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, blending: AdditiveBlending }));
    gl.rotation.z = Math.PI / 2; gl.position.y = 0.02; g.add(gl);
  }
  return g;
}

function mkFrog(skin: Skin): Group {
  const g = new Group();
  const body = new Mesh(new SphereGeometry(FROG_R, 12, 8),
    new MeshBasicMaterial({ color: skin.color, transparent: true, opacity: 0.7 }));
  body.position.y = FROG_R; g.add(body);
  g.add(Object.assign(new LineSegments(new EdgesGeometry(new SphereGeometry(FROG_R, 12, 8)),
    new LineBasicMaterial({ color: skin.color })), { position: body.position.clone() }));
  const eyeG = new SphereGeometry(FROG_R * 0.25, 8, 6);
  const eyeM = new MeshBasicMaterial({ color: 0xffffff });
  const pupG = new SphereGeometry(FROG_R * 0.12, 6, 4);
  const pupM = new MeshBasicMaterial({ color: 0x111111 });
  [-1, 1].forEach(s => {
    const eye = new Mesh(eyeG, eyeM);
    eye.position.set(s * FROG_R * 0.5, FROG_R * 1.6, -FROG_R * 0.3); g.add(eye);
    const pup = new Mesh(pupG, pupM);
    pup.position.set(s * FROG_R * 0.5, FROG_R * 1.6, -FROG_R * 0.5); g.add(pup);
  });
  // Legs
  const legG = new CylinderGeometry(0.008, 0.006, FROG_R * 0.8, 4);
  const legM = new MeshBasicMaterial({ color: skin.color, transparent: true, opacity: 0.6 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new Mesh(legG, legM);
    leg.position.set(sx * FROG_R * 0.7, FROG_R * 0.2, sz * FROG_R * 0.5);
    leg.rotation.z = sx * 0.3; g.add(leg);
  });
  const gl = new Mesh(new SphereGeometry(FROG_R * 1.4, 8, 6),
    new MeshBasicMaterial({ color: skin.glow, transparent: true, opacity: 0.15, blending: AdditiveBlending }));
  gl.position.y = FROG_R; g.add(gl);
  return g;
}

// ==================== BOARD + ENVIRONMENT ====================
function buildBoard(scene: { add(o: any): void }, theme: Theme) {
  const board = new Group();
  const homeMarkers: Group[] = [];
  for (let row = 0; row < ROWS; row++) {
    const lane = LANES[row];
    let color = theme.safe;
    if (lane.type === 'road') color = theme.road;
    else if (lane.type === 'river') color = theme.water;
    const p = new Mesh(new PlaneGeometry(BW + 0.02, CELL),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: DoubleSide }));
    p.rotation.x = -Math.PI / 2; p.position.set(0, -0.005, rowToZ(row)); board.add(p);
    if (lane.type === 'road' && row > 1 && LANES[row - 1].type === 'road') {
      for (let i = 0; i < 8; i++) {
        const dash = new Mesh(new PlaneGeometry(0.06, 0.004),
          new MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.4, side: DoubleSide }));
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(BXL + (i + 0.5) * (BW / 8), -0.003, rowToZ(row) + CELL / 2);
        board.add(dash);
      }
    }
  }
  const waterPlane = new Mesh(new PlaneGeometry(BW + 0.1, CELL * 5 + 0.05),
    new MeshBasicMaterial({ color: theme.water, transparent: true, opacity: 0.15, side: DoubleSide }));
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.set(0, -0.007, rowToZ(9));
  board.add(waterPlane);
  HOME_COLS.forEach(col => {
    const mg = new Group();
    const ring = new Mesh(new RingGeometry(CELL * 0.2, CELL * 0.38, 12),
      new MeshBasicMaterial({ color: theme.home, transparent: true, opacity: 0.6, side: DoubleSide }));
    ring.rotation.x = -Math.PI / 2; mg.add(ring);
    const gl = new Mesh(new RingGeometry(CELL * 0.15, CELL * 0.42, 12),
      new MeshBasicMaterial({ color: theme.home, transparent: true, opacity: 0.12, side: DoubleSide, blending: AdditiveBlending }));
    gl.rotation.x = -Math.PI / 2; mg.add(gl);
    mg.position.set(colToX(col), 0.001, rowToZ(ROWS - 1));
    board.add(mg); homeMarkers.push(mg);
  });
  // Border lines as thin boxes
  const bMat = new MeshBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.3 });
  [-BW / 2, BW / 2].forEach(x => {
    const border = new Mesh(new BoxGeometry(0.005, 0.01, ROWS * CELL), bMat);
    border.position.set(x, 0, -((ROWS - 1) * CELL) / 2);
    board.add(border);
  });
  scene.add(board);
  return { board, homeMarkers, waterPlane };
}

function buildEnvironment(scene: { add(o: any): void; fog: any }, theme: Theme) {
  scene.fog = new FogExp2(theme.fog, 0.15);
  scene.add(new AmbientLight(theme.accent, 0.3));
  const dir = new DirectionalLight(0xffffff, 0.4);
  dir.position.set(2, 5, 3); scene.add(dir);
  const p1 = new PointLight(theme.grid, 1, 8); p1.position.set(-1, 2, -1); scene.add(p1);
  const p2 = new PointLight(theme.accent, 0.8, 8); p2.position.set(1, 2, -2.5); scene.add(p2);
  // Grid floor
  const gridMat = new MeshBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.08, side: DoubleSide });
  const floor = new Mesh(new PlaneGeometry(20, 20), gridMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; scene.add(floor);
  // Floating decorations
  const decors: Group = new Group();
  const shapes = [new TorusGeometry(0.08, 0.02, 8, 12), new BoxGeometry(0.1, 0.1, 0.1),
    new SphereGeometry(0.06, 8, 6), new ConeGeometry(0.05, 0.12, 6)];
  const dMat = new MeshBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.2, wireframe: true });
  for (let i = 0; i < 12; i++) {
    const m = new Mesh(shapes[i % shapes.length], dMat);
    m.position.set((Math.random() - 0.5) * 6, 1 + Math.random() * 2, -Math.random() * 5);
    m.userData.rotSpeed = 0.3 + Math.random() * 0.5;
    m.userData.bobSpeed = 0.5 + Math.random() * 0.5;
    m.userData.bobBase = m.position.y;
    decors.add(m);
  }
  scene.add(decors);
  return decors;
}

function spawnLaneItems(game: GameMgr, scene: { add(o: any): void }) {
  // Clear existing
  game.vehicles.forEach(v => v.mesh.parent?.remove(v.mesh));
  game.platforms.forEach(p => p.mesh.parent?.remove(p.mesh));
  game.vehicles = []; game.platforms = [];
  const totalW = BW + WRAP_M * 2;
  for (let row = 0; row < ROWS; row++) {
    const lane = LANES[row];
    if (lane.type === 'road' && lane.item && lane.cnt) {
      const spacing = totalW / lane.cnt;
      for (let i = 0; i < lane.cnt; i++) {
        const mesh = mkVehicle(lane.item);
        const x = BXL - WRAP_M + (i + 0.5) * spacing;
        mesh.position.set(x, 0, rowToZ(row));
        scene.add(mesh);
        game.vehicles.push({
          type: lane.item as VType, row, x, spd: (lane.spd || 0.3) * (lane.dir || 1),
          w: VW[lane.item] || 0.3, mesh
        });
      }
    }
    if (lane.type === 'river' && lane.item && lane.cnt) {
      const spacing = totalW / lane.cnt;
      for (let i = 0; i < lane.cnt; i++) {
        const mesh = mkPlatform(lane.item);
        const x = BXL - WRAP_M + (i + 0.5) * spacing;
        mesh.position.set(x, 0, rowToZ(row));
        scene.add(mesh);
        game.platforms.push({
          type: lane.item as PType, row, x, spd: (lane.spd || 0.2) * (lane.dir || 1),
          w: PW[lane.item] || 0.5, mesh, diving: false, dt: Math.random() * 5,
          dd: 2 + Math.random(), sd: 4 + Math.random() * 3
        });
      }
    }
  }
}

// ==================== PARTICLE SYSTEM ====================
const particles: Ptcl[] = [];
function spawnPtcl(scene: { add(o: any): void }, x: number, y: number, z: number, col: number, n: number) {
  for (let i = 0; i < n && particles.length < 150; i++) {
    const m = new Mesh(new SphereGeometry(0.008, 4, 3),
      new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: AdditiveBlending }));
    m.position.set(x, y, z); scene.add(m);
    particles.push({
      mesh: m, vx: (Math.random() - 0.5) * 0.8, vy: Math.random() * 1.2 + 0.3,
      vz: (Math.random() - 0.5) * 0.8, life: 0.6 + Math.random() * 0.4, age: 0
    });
  }
}
function updatePtcls(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.age += dt;
    if (p.age >= p.life) { p.mesh.parent?.remove(p.mesh); particles.splice(i, 1); continue; }
    p.vy -= 3 * dt; p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
    (p.mesh.material as MeshBasicMaterial).opacity = 0.8 * (1 - p.age / p.life);
  }
}

// ==================== ECS GAME SYSTEM ====================
const getDoc = (e: any) => e.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
const setText = (e: any, id: string, text: string) =>
  (getDoc(e)?.getElementById(id) as UIKit.Text | undefined)?.setProperties({ text });
const setVis = (e: any, vis: boolean) => { if (e?.object3D) e.object3D.visible = vis; };

class FrogSystem extends createSystem({
  title: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/title.json')] },
  modes: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/modeselect.json')] },
  diffs: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/difficulty.json')] },
  hud: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  pause: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
  over: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/gameover.json')] },
  lvlc: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/levelcomplete.json')] },
  lb: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/leaderboard.json')] },
  ach: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achvlist.json')] },
  sett: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
  skin: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/skins.json')] },
  stat: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/stats.json')] },
  help: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/help.json')] },
  toast: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/toast.json')] },
  cd: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/countdown.json')] },
}) {
  private game!: GameMgr;
  private frogMesh!: Group;
  private boardData!: ReturnType<typeof buildBoard>;
  private decors!: Group;
  private ents: Record<string, any> = {};
  private prevSY = 0; private prevSX = 0;
  private toastT = 0;
  private filledMeshes: Mesh[] = [];

  setRefs(refs: { game: GameMgr; frog: Group; board: ReturnType<typeof buildBoard>; decors: Group }) {
    this.game = refs.game; this.frogMesh = refs.frog;
    this.boardData = refs.board; this.decors = refs.decors;
  }

  init() {
    const wirePanel = (qName: string, key: string, cb: (doc: UIKitDocument, ent: any) => void) => {
      (this.queries as any)[qName].subscribe('qualify', (entity: any) => {
        this.ents[key] = entity;
        const doc = getDoc(entity);
        if (doc) cb(doc, entity);
        setVis(entity, false);
      });
    };
    wirePanel('title', 'title', (doc) => {
      setVis(this.ents.title, true);
      const click = (id: string, fn: () => void) => {
        const el = doc.getElementById(id) as UIKit.Text | undefined;
        el?.addEventListener('click', () => { audio.click(); fn(); });
      };
      click('btn-play', () => this.showOnly('modes'));
      click('btn-scores', () => { this.updateLB(); this.showOnly('lb'); });
      click('btn-achv', () => { this.updateAch(); this.showOnly('ach'); });
      click('btn-stats', () => { this.updateStats(); this.showOnly('stat'); });
      click('btn-skins', () => { this.updateSkins(); this.showOnly('skin'); });
      click('btn-settings', () => { this.updateSettings(); this.showOnly('sett'); });
      click('btn-help', () => this.showOnly('help'));
    });
    wirePanel('modes', 'modes', (doc) => {
      const modes: GMode[] = ['classic', 'endless', 'timeAttack', 'survival', 'zen', 'daily', 'rushHour', 'speedRun'];
      modes.forEach(m => {
        const el = doc.getElementById('btn-' + m) as UIKit.Text | undefined;
        el?.addEventListener('click', () => { audio.click(); this.game.mode = m; this.showOnly('diffs'); });
      });
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.showOnly('title');
      });
    });
    wirePanel('diffs', 'diffs', (doc) => {
      (['easy', 'medium', 'hard'] as Diff[]).forEach(d => {
        (doc.getElementById('btn-' + d) as UIKit.Text | undefined)?.addEventListener('click', () => {
          audio.click(); this.startGameplay(this.game.mode, d);
        });
      });
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.showOnly('modes');
      });
    });
    wirePanel('hud', 'hud', () => {});
    wirePanel('pause', 'pause', (doc) => {
      (doc.getElementById('btn-resume') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.game.state = 'playing'; this.showOnly('hud');
      });
      (doc.getElementById('btn-quit') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.game.state = 'title'; audio.stopDrone(); this.showOnly('title');
      });
    });
    wirePanel('over', 'over', (doc) => {
      (doc.getElementById('btn-rematch') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.startGameplay(this.game.mode, this.game.diff);
      });
      (doc.getElementById('btn-menu') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.game.state = 'title'; audio.stopDrone(); this.showOnly('title');
      });
    });
    wirePanel('lvlc', 'lvlc', (doc) => {
      (doc.getElementById('btn-next') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.nextLevel();
      });
      (doc.getElementById('btn-menu') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.game.state = 'title'; audio.stopDrone(); this.showOnly('title');
      });
    });
    wirePanel('lb', 'lb', (doc) => {
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.showOnly('title');
      });
    });
    wirePanel('ach', 'ach', (doc) => {
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.showOnly('title');
      });
      (doc.getElementById('btn-prev') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); if (this.game.achPage > 0) { this.game.achPage--; this.updateAch(); }
      });
      (doc.getElementById('btn-next') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click();
        if ((this.game.achPage + 1) * 15 < ACHVS.length) { this.game.achPage++; this.updateAch(); }
      });
    });
    wirePanel('sett', 'sett', (doc) => {
      const volBtn = (id: string, fn: () => void) => {
        (doc.getElementById(id) as UIKit.Text | undefined)?.addEventListener('click', () => { audio.click(); fn(); this.updateSettings(); });
      };
      volBtn('btn-master-up', () => { audio.masterVol = Math.min(1, audio.masterVol + 0.1); audio.updateDrone(); });
      volBtn('btn-master-dn', () => { audio.masterVol = Math.max(0, audio.masterVol - 0.1); audio.updateDrone(); });
      volBtn('btn-sfx-up', () => { audio.sfxVol = Math.min(1, audio.sfxVol + 0.1); });
      volBtn('btn-sfx-dn', () => { audio.sfxVol = Math.max(0, audio.sfxVol - 0.1); });
      volBtn('btn-music-up', () => { audio.musicVol = Math.min(1, audio.musicVol + 0.1); audio.updateDrone(); });
      volBtn('btn-music-dn', () => { audio.musicVol = Math.max(0, audio.musicVol - 0.1); audio.updateDrone(); });
      volBtn('btn-theme-prev', () => { this.game.themeIdx = (this.game.themeIdx - 1 + THEMES.length) % THEMES.length; });
      volBtn('btn-theme-next', () => { this.game.themeIdx = (this.game.themeIdx + 1) % THEMES.length; });
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.game.save(); this.showOnly('title');
      });
    });
    wirePanel('skin', 'skin', (doc) => {
      for (let i = 0; i < 8; i++) {
        (doc.getElementById('btn-skin-' + i) as UIKit.Text | undefined)?.addEventListener('click', () => {
          audio.click();
          if (this.game.skinUnlocked(i)) {
            this.game.skinIdx = i; this.rebuildFrog(); this.game.save(); this.updateSkins();
          }
        });
      }
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.showOnly('title');
      });
    });
    wirePanel('stat', 'stat', (doc) => {
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.showOnly('title');
      });
    });
    wirePanel('help', 'help', (doc) => {
      (doc.getElementById('btn-back') as UIKit.Text | undefined)?.addEventListener('click', () => {
        audio.click(); this.showOnly('title');
      });
    });
    wirePanel('toast', 'toast', () => {});
    wirePanel('cd', 'cd', () => {});
  }

  showOnly(key: string) {
    const allKeys = ['title', 'modes', 'diffs', 'hud', 'pause', 'over', 'lvlc', 'lb', 'ach', 'sett', 'skin', 'stat', 'help'];
    allKeys.forEach(k => setVis(this.ents[k], k === key));
  }

  startGameplay(mode: GMode, diff: Diff) {
    this.game.startGame(mode, diff);
    spawnLaneItems(this.game, this.scene);
    this.clearFilledHomes();
    this.game.state = 'countdown'; this.game.cdVal = 3; this.game.cdT = 0;
    this.showOnly(''); setVis(this.ents.cd, true);
    this.updateCd();
    this.rebuildFrog();
    this.frogMesh.visible = false;
    audio.startDrone();
  }

  nextLevel() {
    this.game.homesFilled = [false, false, false, false, false];
    this.game.resetFrog(); this.game.state = 'countdown';
    this.game.cdVal = 3; this.game.cdT = 0;
    spawnLaneItems(this.game, this.scene);
    this.clearFilledHomes();
    this.showOnly(''); setVis(this.ents.cd, true);
    this.updateCd();
    this.frogMesh.visible = false;
    if (this.game.level > this.game.bestLevel) this.game.bestLevel = this.game.level;
  }

  rebuildFrog() {
    const parent = this.frogMesh.parent;
    if (parent) parent.remove(this.frogMesh);
    const newFrog = mkFrog(SKINS[this.game.skinIdx]);
    newFrog.position.copy(this.frogMesh.position);
    if (parent) parent.add(newFrog);
    this.frogMesh = newFrog;
  }

  clearFilledHomes() {
    this.filledMeshes.forEach(m => m.parent?.remove(m));
    this.filledMeshes = [];
  }

  markHomeFilled(idx: number) {
    const col = HOME_COLS[idx];
    const m = new Mesh(new SphereGeometry(CELL * 0.25, 8, 6),
      new MeshBasicMaterial({ color: SKINS[this.game.skinIdx].color, transparent: true, opacity: 0.5, blending: AdditiveBlending }));
    m.position.set(colToX(col), 0.05, rowToZ(ROWS - 1));
    this.scene.add(m); this.filledMeshes.push(m);
  }

  updateCd() {
    if (this.ents.cd) setText(this.ents.cd, 'cd-text', this.game.cdVal > 0 ? String(this.game.cdVal) : 'HOP!');
  }

  update(delta: number, time: number) {
    // Countdown
    if (this.game.state === 'countdown') {
      this.game.cdT += delta;
      if (this.game.cdT >= 0.8) {
        this.game.cdT = 0; this.game.cdVal--;
        if (this.game.cdVal > 0) { audio.tick(); this.updateCd(); }
        else if (this.game.cdVal === 0) { audio.go(); this.updateCd(); }
        else {
          this.game.state = 'playing'; setVis(this.ents.cd, false);
          this.showOnly('hud'); this.frogMesh.visible = true;
          this.updateFrogPos(); audio.gameStartSfx();
        }
      }
      return;
    }
    if (this.game.state !== 'playing') {
      this.animateDecors(time);
      return;
    }
    // Input
    this.handleInput();
    // Vehicles
    const sm = this.game.spdMult();
    for (const v of this.game.vehicles) {
      v.x += v.spd * sm * delta;
      if (v.spd > 0 && v.x > BXR + WRAP_M + v.w) v.x = BXL - WRAP_M - v.w;
      if (v.spd < 0 && v.x < BXL - WRAP_M - v.w) v.x = BXR + WRAP_M + v.w;
      v.mesh.position.x = v.x;
    }
    // Platforms
    for (const p of this.game.platforms) {
      p.x += p.spd * sm * delta;
      if (p.spd > 0 && p.x > BXR + WRAP_M + p.w) p.x = BXL - WRAP_M - p.w;
      if (p.spd < 0 && p.x < BXL - WRAP_M - p.w) p.x = BXR + WRAP_M + p.w;
      p.mesh.position.x = p.x;
      if (p.type === 'turtles') {
        p.dt += delta;
        if (p.diving) {
          p.mesh.visible = p.dt > p.dd * 0.8;
          if (p.dt >= p.dd) { p.diving = false; p.dt = 0; p.mesh.visible = true; }
        } else {
          if (p.dt >= p.sd) { p.diving = true; p.dt = 0; p.mesh.visible = false; }
        }
      }
    }
    // Frog
    this.updateFrog(delta);
    // Particles
    updatePtcls(delta);
    // Timer
    this.game.totalPlayTime += delta;
    this.game.lvlT += delta;
    if (this.game.mode === 'timeAttack') {
      this.game.timer -= delta;
      if (this.game.timer <= 0) { this.game.timer = 0; this.game.endGame(); audio.gameOverSfx(); this.showOver(); }
    } else if (this.game.mode === 'survival') {
      this.game.timer += delta;
      if (this.game.timer >= 60) this.game.unlock('survival_60');
      if (this.game.timer >= 120) this.game.unlock('survival_120');
    }
    // Toast
    if (this.toastT > 0) { this.toastT -= delta; if (this.toastT <= 0) setVis(this.ents.toast, false); }
    if (this.game.pendingToast.length > 0 && this.toastT <= 0) {
      const msg = this.game.pendingToast.shift()!;
      setText(this.ents.toast, 'toast-text', msg); setVis(this.ents.toast, true);
      this.toastT = 2; audio.achv();
    }
    // HUD
    this.updateHUD();
    // Decor animation
    this.animateDecors(time);
    // Water animation
    if (this.boardData?.waterPlane) {
      (this.boardData.waterPlane.material as MeshBasicMaterial).opacity = 0.12 + Math.sin(time * 2) * 0.04;
    }
  }

  handleInput() {
    const kb = this.input.keyboard;
    if (kb.getKeyDown('ArrowUp') || kb.getKeyDown('KeyW')) this.tryHop('up');
    else if (kb.getKeyDown('ArrowDown') || kb.getKeyDown('KeyS')) this.tryHop('down');
    else if (kb.getKeyDown('ArrowLeft') || kb.getKeyDown('KeyA')) this.tryHop('left');
    else if (kb.getKeyDown('ArrowRight') || kb.getKeyDown('KeyD')) this.tryHop('right');
    if (kb.getKeyDown('Escape') || kb.getKeyDown('KeyP')) {
      this.game.state = 'paused'; this.showOnly('pause');
    }
    // XR thumbstick
    const rg = this.input.xr.gamepads.right;
    if (rg) {
      const st = rg.getAxesValues(InputComponent.Thumbstick);
      if (st) {
        const T = 0.5;
        if (st.y < -T && this.prevSY >= -T) this.tryHop('up');
        if (st.y > T && this.prevSY <= T) this.tryHop('down');
        if (st.x < -T && this.prevSX >= -T) this.tryHop('left');
        if (st.x > T && this.prevSX <= T) this.tryHop('right');
        this.prevSY = st.y; this.prevSX = st.x;
      }
      if (rg.getButtonDown(InputComponent.B_Button)) {
        this.game.state = 'paused'; this.showOnly('pause');
      }
    }
  }

  tryHop(dir: 'up' | 'down' | 'left' | 'right') {
    if (this.game.hop(dir)) {
      audio.hop();
      if (this.game.combo >= 3) audio.combo(this.game.combo);
      this.game.unlock('first_hop');
    }
  }

  updateFrog(dt: number) {
    if (!this.game.alive) {
      this.game.deathT -= dt;
      if (this.game.deathT <= 0 && this.game.lives > 0) {
        this.game.respawn(); this.frogMesh.scale.setScalar(1);
        this.frogMesh.rotation.y = 0; this.updateFrogPos();
      } else {
        this.frogMesh.rotation.y += dt * 12;
        this.frogMesh.scale.setScalar(Math.max(0.01, this.game.deathT));
      }
      return;
    }
    if (this.game.hopping) {
      this.game.hopProg += dt / HOP_DUR;
      if (this.game.hopProg >= 1) {
        this.game.finishHop();
        // Check collisions at destination
        this.checkRoadCollision();
        // Check home
        const hr = this.game.checkHome();
        if (hr === 'home') {
          const filled = this.game.homesFilled;
          for (let i = 0; i < 5; i++) if (filled[i] && !this.filledMeshes[i]) this.markHomeFilled(i);
          audio.homeReach();
          spawnPtcl(this.scene, this.game.frogX, 0.1, rowToZ(ROWS - 1), SKINS[this.game.skinIdx].color, 15);
          if (filled.every(h => h)) {
            audio.levelUp(); this.game.state = 'levelComplete';
            this.game.level++;
            this.showLvlComplete(); return;
          }
        } else if (hr === 'miss') {
          audio.splash(); this.game.die();
          if (this.game.state === 'gameOver') { audio.gameOverSfx(); this.showOver(); return; }
        }
        this.updateFrogPos();
      } else {
        const t = this.game.hopProg;
        const x = this.game.hopFX + (this.game.hopTX - this.game.hopFX) * t;
        const z = rowToZ(this.game.hopFR) + (rowToZ(this.game.hopTR) - rowToZ(this.game.hopFR)) * t;
        const y = HOP_ARC * Math.sin(t * Math.PI);
        this.frogMesh.position.set(x, y, z);
        const dirs: Record<string, number> = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };
        this.frogMesh.rotation.y = dirs[this.game.hopDir] || 0;
      }
      return;
    }
    // Platform riding
    const lane = LANES[this.game.frogRow];
    if (lane.type === 'river') {
      let onPlat = false;
      for (const p of this.game.platforms) {
        if (p.row === this.game.frogRow && !p.diving) {
          if (this.game.frogX >= p.x - p.w / 2 - FROG_R * 0.5 &&
              this.game.frogX <= p.x + p.w / 2 + FROG_R * 0.5) {
            onPlat = true;
            this.game.frogX += p.spd * this.game.spdMult() * dt;
            if (p.type === 'turtles') this.game.turtleRides++;
            if (p.type !== 'turtles') {
              this.game.logRideT += dt;
              if (this.game.logRideT >= 3) this.game.unlock('ride_log');
            }
            break;
          }
        }
      }
      if (!onPlat) {
        audio.splash();
        spawnPtcl(this.scene, this.game.frogX, 0, rowToZ(this.game.frogRow), 0x0088ff, 12);
        this.game.die();
        if (this.game.state === 'gameOver') { audio.gameOverSfx(); this.showOver(); return; }
        return;
      }
      if (this.game.frogX < BXL - CELL * 0.5 || this.game.frogX > BXR + CELL * 0.5) {
        audio.splash(); this.game.die();
        if (this.game.state === 'gameOver') { audio.gameOverSfx(); this.showOver(); return; }
        return;
      }
    }
    this.updateFrogPos();
  }

  checkRoadCollision() {
    const lane = LANES[this.game.frogRow];
    if (lane.type !== 'road') return;
    for (const v of this.game.vehicles) {
      if (v.row === this.game.frogRow) {
        const d = Math.abs(this.game.frogX - v.x);
        if (d < FROG_R + v.w / 2) {
          audio.squish();
          spawnPtcl(this.scene, this.game.frogX, FROG_R, rowToZ(this.game.frogRow), 0xff4444, 15);
          this.game.die();
          if (this.game.state === 'gameOver') { audio.gameOverSfx(); this.showOver(); }
          return;
        }
        if (d < FROG_R + v.w / 2 + 0.04) { this.game.unlock('close_call'); }
      }
    }
  }

  updateFrogPos() {
    if (!this.game.alive) return;
    this.frogMesh.position.set(this.game.frogX, 0, rowToZ(this.game.frogRow));
    this.frogMesh.scale.setScalar(1);
    this.frogMesh.rotation.y = Math.PI; // face forward (toward home)
  }

  updateHUD() {
    const e = this.ents.hud; if (!e) return;
    setText(e, 'score', String(this.game.score));
    setText(e, 'lives', String(this.game.lives));
    setText(e, 'level', 'Lv ' + this.game.level);
    setText(e, 'combo', this.game.combo > 1 ? 'x' + this.game.combo : '');
    setText(e, 'homes', this.game.homesFilled.filter(h => h).length + '/5');
    if (this.game.mode === 'timeAttack') setText(e, 'timer', Math.ceil(this.game.timer) + 's');
    else if (this.game.mode === 'survival') setText(e, 'timer', Math.floor(this.game.timer) + 's');
    else setText(e, 'timer', Math.floor(this.game.lvlT) + 's');
    setText(e, 'mode', this.game.mode);
  }

  showOver() {
    this.showOnly('over');
    const e = this.ents.over; if (!e) return;
    setText(e, 'score', String(this.game.score));
    setText(e, 'level', 'Level ' + this.game.level);
    setText(e, 'homes', this.game.homesFilled.filter(h => h).length + ' homes');
    setText(e, 'combo', 'Best combo: x' + this.game.bestCombo);
  }

  showLvlComplete() {
    this.showOnly('lvlc');
    const e = this.ents.lvlc; if (!e) return;
    setText(e, 'level', 'Level ' + (this.game.level - 1) + ' Complete!');
    setText(e, 'score', 'Score: ' + this.game.score);
    setText(e, 'time', 'Time: ' + Math.floor(this.game.lvlT) + 's');
    setText(e, 'homes', '5/5 Homes Filled');
  }

  updateLB() {
    const e = this.ents.lb; if (!e) return;
    for (let i = 0; i < 10; i++) {
      const entry = this.game.lb[i];
      setText(e, 'lb-' + i, entry ? (i + 1) + '. ' + entry.score + ' - ' + entry.mode + ' Lv' + entry.level : (i + 1) + '. ---');
    }
  }

  updateAch() {
    const e = this.ents.ach; if (!e) return;
    const page = this.game.achPage; const start = page * 15;
    for (let i = 0; i < 15; i++) {
      const a = ACHVS[start + i];
      const done = a ? this.game.achvs.has(a.id) : false;
      setText(e, 'ach-' + i, a ? (done ? '[X] ' : '[ ] ') + a.name + ' - ' + a.desc : '');
    }
    setText(e, 'page', 'Page ' + (page + 1) + '/' + Math.ceil(ACHVS.length / 15));
  }

  updateSettings() {
    const e = this.ents.sett; if (!e) return;
    setText(e, 'master-val', Math.round(audio.masterVol * 100) + '%');
    setText(e, 'sfx-val', Math.round(audio.sfxVol * 100) + '%');
    setText(e, 'music-val', Math.round(audio.musicVol * 100) + '%');
    setText(e, 'theme-val', THEMES[this.game.themeIdx].name);
  }

  updateSkins() {
    const e = this.ents.skin; if (!e) return;
    for (let i = 0; i < 8; i++) {
      const s = SKINS[i]; const unlocked = this.game.skinUnlocked(i);
      const equipped = this.game.skinIdx === i;
      setText(e, 'skin-' + i, s.name + (equipped ? ' [ON]' : unlocked ? '' : ' [' + s.desc + ']'));
    }
  }

  updateStats() {
    const e = this.ents.stat; if (!e) return;
    setText(e, 'stat-0', 'Games: ' + this.game.totalGames);
    setText(e, 'stat-1', 'Total Score: ' + this.game.totalScore);
    setText(e, 'stat-2', 'Best Score: ' + this.game.bestScore);
    setText(e, 'stat-3', 'Total Hops: ' + this.game.totalHops);
    setText(e, 'stat-4', 'Total Homes: ' + this.game.totalHomes);
    setText(e, 'stat-5', 'Total Deaths: ' + this.game.totalDeaths);
    setText(e, 'stat-6', 'Best Level: ' + this.game.bestLevel);
    setText(e, 'stat-7', 'Best Combo: x' + this.game.bestComboEver);
    setText(e, 'stat-8', 'Achievements: ' + this.game.achvs.size + '/' + ACHVS.length);
    setText(e, 'stat-9', 'Play Time: ' + Math.floor(this.game.totalPlayTime / 60) + 'm');
  }

  animateDecors(time: number) {
    if (!this.decors) return;
    this.decors.children.forEach(c => {
      c.rotation.y += (c.userData.rotSpeed || 0.3) * 0.016;
      c.position.y = (c.userData.bobBase || 1.5) + Math.sin(time * (c.userData.bobSpeed || 0.5)) * 0.1;
    });
  }
}


// ==================== MAIN ====================
async function main() {
  const world = await World.create({
    xr: { offer: 'once' },
    browserControls: true,
  });

  const game = new GameMgr();
  const frog = mkFrog(SKINS[0]);
  frog.position.set(colToX(5), 0, rowToZ(0));
  world.scene.add(frog);

  const board = buildBoard(world.scene, THEMES[game.themeIdx]);
  const decors = buildEnvironment(world.scene, THEMES[game.themeIdx]);
  spawnLaneItems(game, world.scene);

  // Menu panels — world-space, centered at eye level over board
  const menuConfigs = [
    './ui/title.json', './ui/modeselect.json', './ui/difficulty.json',
    './ui/pause.json', './ui/gameover.json', './ui/levelcomplete.json',
    './ui/leaderboard.json', './ui/achvlist.json', './ui/settings.json',
    './ui/skins.json', './ui/stats.json', './ui/help.json',
  ];
  for (const config of menuConfigs) {
    const e = world.createEntity();
    e.addComponent(PanelUI, { config });
    e.object3D.position.set(0, 1.5, -1.8);
  }

  // HUD follower panels
  const hudConfigs = [
    { config: './ui/hud.json', y: 0.35, z: -1.0 },
    { config: './ui/toast.json', y: -0.3, z: -1.0 },
    { config: './ui/countdown.json', y: 0.0, z: -0.8 },
  ];
  for (const p of hudConfigs) {
    const e = world.createEntity();
    e.addComponent(PanelUI, { config: p.config });
    e.addComponent(Follower);
    const off = e.getVectorView(Follower, 'offsetPosition');
    off.set(0, p.y, p.z);
  }

  const sys = world.registerSystem(FrogSystem);
  sys.setRefs({ game, frog, board, decors });
}

main();

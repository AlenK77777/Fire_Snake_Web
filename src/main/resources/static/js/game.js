// ==========================================
// FIRE SNAKE GAME - Web Version
// Port of the Java Swing game to HTML5 Canvas
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game dimensions
const GAME_WIDTH = 800;
const GAME_HEIGHT = 800;
const BLOCK_SIZE = 20;

// Timing
const NORMAL_FPS = 12;
const SLOW_FPS = 6;
const FAST_FPS = 24;
let currentFPS = NORMAL_FPS;
let lastTime = 0;
let frameInterval = 1000 / currentFPS;

// Colors
const COLORS = {
    background1: '#05050f',
    background2: '#0f0f23',
    grid: 'rgba(40, 40, 80, 0.3)',
    snakeHead: '#00ff96',
    snakeBodyStart: '#00c864',
    snakeBodyEnd: '#006432',
    snakeGlow: 'rgba(0, 255, 150, 0.5)',
    snakeSlow: '#6496ff',
    snakeFast: '#ffb432',
    food: '#ff3264',
    foodGlow: 'rgba(255, 50, 100, 0.6)',
    foodInner: '#ff96b4',
    bullet: '#00ffff',
    bulletGlow: 'rgba(0, 255, 255, 0.6)',
    slowTarget: '#6496ff',
    shrinkTarget: '#ff3232',
    speedTarget: '#ff9600',
    text: '#ffffff'
};

// Target types with colors and points
const TARGET_TYPES = {
    COMMON: { color: '#ffc832', innerColor: '#ffff96', points: 1, name: 'Common' },
    FAST: { color: '#32c8ff', innerColor: '#96e6ff', points: 2, name: 'Fast' },
    RARE: { color: '#c832ff', innerColor: '#e696ff', points: 3, name: 'Rare' },
    EPIC: { color: '#ff6432', innerColor: '#ffb464', points: 5, name: 'Epic' },
    LEGENDARY: { color: '#ffd700', innerColor: '#fff596', points: 10, name: 'Legendary' }
};

// Game state
let snake = [];
let snakeLength = 1;
let snakeX, snakeY;
let dirX = 0, dirY = 0;
let nextDirX = 0, nextDirY = 0;
let foodX, foodY;
let score = 0;
let highScore = parseInt(localStorage.getItem('fireSnakeHighScore') || '0');
let gameOver = false;
let gameStarted = false;
let gamePaused = false;

// Timers and effects
let slowdownTimer = 0;
let speedupTimer = 0;
const SLOWDOWN_DURATION = 120;
const SPEEDUP_DURATION = 240;
let foodTimer = 0;
const FOOD_TIME_LIMIT = 120;

// Statistics
let targetsHit = 0;
let totalShots = 0;
let foodEaten = 0;

// Game objects
let bullets = [];
let targets = [];
let slowTargets = [];
let shrinkTargets = [];
let speedTargets = [];
let particles = [];
let stars = [];

// Auto-fire
let spacePressed = false;
let autoFireCooldown = 0;
const AUTO_FIRE_DELAY = 4;

// Animation
let foodPulse = 0;
const BULLET_SPEED = 50;
const TARGET_SPAWN_INTERVAL = 60;
let targetSpawnTimer = 0;

// Sound
let soundMuted = false;
let userHasInteracted = false;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Music tempo (affected by snake length)
let musicTempo = 1.0;

// ==========================================
// SOUND ENGINE (8-bit style with 80s/90s melodies)
// ==========================================
class SoundEngine {
    constructor() {
        this.ctx = audioCtx;
        this.menuMusicPlaying = false;
        this.gameMusicPlaying = false;
        this.menuMusicTimeouts = [];
        this.gameMusicTimeouts = [];
        this.menuMusicInterval = null;
        this.gameMusicInterval = null;
        this.currentNoteIndex = 0;
    }
    
    playTone(frequency, duration, type = 'square', volume = 0.3) {
        if (soundMuted) return;
        try {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            
            const oscillator = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            
            gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            oscillator.start(this.ctx.currentTime);
            oscillator.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }
    
    playSweep(startFreq, endFreq, duration, volume = 0.3) {
        if (soundMuted) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            
            const oscillator = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
            
            gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            oscillator.start(this.ctx.currentTime);
            oscillator.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }
    
    playNoise(duration, volume = 0.3) {
        if (soundMuted) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            
            const bufferSize = this.ctx.sampleRate * duration;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
                data[i] *= 1 - (i / bufferSize);
            }
            
            const source = this.ctx.createBufferSource();
            const gainNode = this.ctx.createGain();
            
            source.buffer = buffer;
            source.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
            
            source.start(this.ctx.currentTime);
        } catch (e) {}
    }
    
    playShoot() {
        this.playSweep(1200, 400, 0.08, 0.2);
    }
    
    playExplosion() {
        this.playNoise(0.15, 0.3);
        this.playTone(80, 0.15, 'square', 0.2);
    }
    
    playEat() {
        this.playSweep(500, 900, 0.05, 0.15);
    }
    
    playPowerUp() {
        this.playSweep(300, 1000, 0.15, 0.2);
    }
    
    playShrink() {
        this.playSweep(800, 200, 0.2, 0.2);
    }
    
    playSpeedUp() {
        this.playSweep(400, 1500, 0.2, 0.2);
    }
    
    playGameOver() {
        this.stopGameMusic();
        setTimeout(() => this.playTone(400, 0.15, 'square', 0.3), 0);
        setTimeout(() => this.playTone(300, 0.15, 'square', 0.3), 150);
        setTimeout(() => this.playTone(200, 0.3, 'square', 0.3), 300);
    }
    
    playNewRecord() {
        const notes = [
            { freq: 523, delay: 0 },
            { freq: 659, delay: 80 },
            { freq: 784, delay: 160 },
            { freq: 1047, delay: 240 },
            { freq: 784, delay: 320 },
            { freq: 1047, delay: 400 },
            { freq: 1319, delay: 500 },
            { freq: 1568, delay: 650 },
        ];
        notes.forEach(n => {
            setTimeout(() => this.playTone(n.freq, n.delay < 500 ? 0.12 : 0.4, 'square', 0.25), n.delay);
        });
    }
    
    // ========== MENU MUSIC (80s/90s Synth Style) ==========
    playMenuMusic() {
        if (this.menuMusicPlaying || soundMuted) return;
        this.menuMusicPlaying = true;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        // 80s/90s style catchy synth melody (like Tetris/Contra vibes)
        const melody = [
            // Part A - Catchy intro
            { freq: 330, dur: 150 },  // E4
            { freq: 392, dur: 150 },  // G4
            { freq: 494, dur: 150 },  // B4
            { freq: 659, dur: 300 },  // E5
            { freq: 587, dur: 150 },  // D5
            { freq: 494, dur: 150 },  // B4
            { freq: 440, dur: 300 },  // A4
            { freq: 0, dur: 150 },    // pause
            
            // Part B
            { freq: 330, dur: 150 },  // E4
            { freq: 392, dur: 150 },  // G4
            { freq: 494, dur: 150 },  // B4
            { freq: 587, dur: 300 },  // D5
            { freq: 523, dur: 150 },  // C5
            { freq: 494, dur: 150 },  // B4
            { freq: 392, dur: 300 },  // G4
            { freq: 0, dur: 150 },    // pause
            
            // Part C - Bridge
            { freq: 523, dur: 200 },  // C5
            { freq: 587, dur: 200 },  // D5
            { freq: 659, dur: 200 },  // E5
            { freq: 587, dur: 200 },  // D5
            { freq: 523, dur: 200 },  // C5
            { freq: 494, dur: 200 },  // B4
            { freq: 440, dur: 400 },  // A4
            { freq: 0, dur: 200 },    // pause
            
            // Part D - Resolution
            { freq: 392, dur: 150 },  // G4
            { freq: 440, dur: 150 },  // A4
            { freq: 494, dur: 150 },  // B4
            { freq: 523, dur: 300 },  // C5
            { freq: 494, dur: 150 },  // B4
            { freq: 440, dur: 150 },  // A4
            { freq: 392, dur: 400 },  // G4
            { freq: 0, dur: 300 },    // pause
        ];
        
        let noteIndex = 0;
        let totalTime = 0;
        
        const playNextNote = () => {
            if (!this.menuMusicPlaying || soundMuted) return;
            
            const note = melody[noteIndex];
            if (note.freq > 0) {
                this.playTone(note.freq, note.dur / 1000, 'square', 0.25);
            }
            
            noteIndex = (noteIndex + 1) % melody.length;
            
            const timeout = setTimeout(playNextNote, note.dur);
            this.menuMusicTimeouts.push(timeout);
        };
        
        playNextNote();
    }
    
    stopMenuMusic() {
        this.menuMusicPlaying = false;
        this.menuMusicTimeouts.forEach(t => clearTimeout(t));
        this.menuMusicTimeouts = [];
        if (this.menuMusicInterval) {
            clearInterval(this.menuMusicInterval);
            this.menuMusicInterval = null;
        }
    }
    
    // ========== GAME MUSIC (80s/90s Action Style) ==========
    playGameMusic() {
        if (this.gameMusicPlaying || soundMuted) return;
        this.gameMusicPlaying = true;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        // Action-style 80s/90s game music (faster, more intense)
        const melody = [
            // Driving bass line with melody
            { freq: 165, dur: 100 },  // E3 bass
            { freq: 330, dur: 100 },  // E4
            { freq: 165, dur: 100 },  // E3 bass
            { freq: 392, dur: 100 },  // G4
            { freq: 165, dur: 100 },  // E3 bass
            { freq: 440, dur: 100 },  // A4
            { freq: 165, dur: 100 },  // E3 bass
            { freq: 392, dur: 100 },  // G4
            
            { freq: 196, dur: 100 },  // G3 bass
            { freq: 392, dur: 100 },  // G4
            { freq: 196, dur: 100 },  // G3 bass
            { freq: 494, dur: 100 },  // B4
            { freq: 196, dur: 100 },  // G3 bass
            { freq: 523, dur: 100 },  // C5
            { freq: 196, dur: 100 },  // G3 bass
            { freq: 494, dur: 100 },  // B4
            
            { freq: 220, dur: 100 },  // A3 bass
            { freq: 440, dur: 100 },  // A4
            { freq: 220, dur: 100 },  // A3 bass
            { freq: 523, dur: 100 },  // C5
            { freq: 220, dur: 100 },  // A3 bass
            { freq: 587, dur: 100 },  // D5
            { freq: 220, dur: 100 },  // A3 bass
            { freq: 523, dur: 100 },  // C5
            
            { freq: 247, dur: 100 },  // B3 bass
            { freq: 494, dur: 100 },  // B4
            { freq: 247, dur: 100 },  // B3 bass
            { freq: 587, dur: 100 },  // D5
            { freq: 247, dur: 100 },  // B3 bass
            { freq: 659, dur: 150 },  // E5
            { freq: 587, dur: 150 },  // D5
            { freq: 494, dur: 100 },  // B4
        ];
        
        let noteIndex = 0;
        
        const playNextNote = () => {
            if (!this.gameMusicPlaying || soundMuted) return;
            
            const note = melody[noteIndex];
            const adjustedDur = note.dur / musicTempo;
            
            if (note.freq > 0) {
                // Lower notes (bass) quieter
                const vol = note.freq < 300 ? 0.15 : 0.2;
                this.playTone(note.freq, (note.dur / 1000) / musicTempo, 'square', vol);
            }
            
            noteIndex = (noteIndex + 1) % melody.length;
            
            const timeout = setTimeout(playNextNote, adjustedDur);
            this.gameMusicTimeouts.push(timeout);
        };
        
        playNextNote();
    }
    
    stopGameMusic() {
        this.gameMusicPlaying = false;
        this.gameMusicTimeouts.forEach(t => clearTimeout(t));
        this.gameMusicTimeouts = [];
        if (this.gameMusicInterval) {
            clearInterval(this.gameMusicInterval);
            this.gameMusicInterval = null;
        }
    }
    
    // Update music tempo based on snake length
    updateMusicTempo(snakeLen) {
        // Every 10 blocks, increase tempo by 10%
        const speedLevel = Math.floor(snakeLen / 10);
        musicTempo = 1.0 + (speedLevel * 0.1);
        // Cap at 2x speed
        if (musicTempo > 2.0) musicTempo = 2.0;
    }
}

const sound = new SoundEngine();

// ==========================================
// STAR CLASS (Hyperspace effect)
// ==========================================
class Star {
    constructor() {
        this.reset(true);
    }
    
    reset(initial = false) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.1 + Math.random() * (initial ? 0.9 : 0.5);
        this.x = Math.cos(angle) * dist;
        this.y = Math.sin(angle) * dist;
        this.z = initial ? Math.random() : 1.0;
        this.speed = 0.003 + Math.random() * 0.007;
    }
    
    update() {
        this.z -= this.speed;
        if (this.z <= 0.01) this.reset();
    }
    
    draw() {
        const screenX = GAME_WIDTH / 2 + (this.x / this.z) * GAME_WIDTH * 0.5;
        const screenY = GAME_HEIGHT / 2 + (this.y / this.z) * GAME_HEIGHT * 0.5;
        
        if (screenX < 0 || screenX > GAME_WIDTH || screenY < 0 || screenY > GAME_HEIGHT) {
            this.reset();
            return;
        }
        
        const prevZ = this.z + this.speed * 2;
        const prevScreenX = GAME_WIDTH / 2 + (this.x / prevZ) * GAME_WIDTH * 0.5;
        const prevScreenY = GAME_HEIGHT / 2 + (this.y / prevZ) * GAME_HEIGHT * 0.5;
        
        const proximity = 1.0 - this.z;
        const brightness = Math.min(255, proximity * 300);
        const size = 1 + proximity * 2;
        
        if (brightness > 20) {
            ctx.strokeStyle = `rgba(200, 200, 255, ${brightness / 3 / 255})`;
            ctx.lineWidth = Math.max(0.5, size * 0.3);
            ctx.beginPath();
            ctx.moveTo(prevScreenX, prevScreenY);
            ctx.lineTo(screenX, screenY);
            ctx.stroke();
            
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness / 255})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, Math.max(1, size / 2), 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ==========================================
// PARTICLE CLASS
// ==========================================
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.maxLife = 25 + Math.random() * 15;
        this.life = this.maxLife;
        this.size = 3 + Math.random() * 5;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.life--;
    }
    
    isDead() {
        return this.life <= 0;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        const currentSize = this.size * alpha;
        ctx.fillStyle = this.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ==========================================
// BULLET CLASS
// ==========================================
class Bullet {
    constructor(x, y, dirX, dirY) {
        this.x = x;
        this.y = y;
        if (dirX !== 0 || dirY !== 0) {
            const length = Math.sqrt(dirX * dirX + dirY * dirY);
            this.vx = (dirX / length) * BULLET_SPEED;
            this.vy = (dirY / length) * BULLET_SPEED;
        } else {
            this.vx = 0;
            this.vy = -BULLET_SPEED;
        }
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
    
    isOutOfBounds() {
        return this.x < 0 || this.x > GAME_WIDTH || this.y < 0 || this.y > GAME_HEIGHT;
    }
    
    draw() {
        // Glow
        ctx.fillStyle = COLORS.bulletGlow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        ctx.fillStyle = COLORS.bullet;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(this.x - 1, this.y - 1, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ==========================================
// TARGET CLASS (Square - Dangerous)
// ==========================================
class Target {
    constructor(x, y, type, gridSize = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.gridSize = gridSize;
        this.maxLifetime = (60 + Math.random() * 61) / (1 + Object.keys(TARGET_TYPES).indexOf(type) * 0.2);
        this.lifetime = this.maxLifetime;
        this.pulse = 0;
        this.spawnDelay = 36; // 3 seconds at 12 FPS
    }
    
    getPixelSize() {
        return this.gridSize * BLOCK_SIZE;
    }
    
    occupiesCell(cellX, cellY) {
        for (let dx = 0; dx < this.gridSize; dx++) {
            for (let dy = 0; dy < this.gridSize; dy++) {
                if (this.x + dx * BLOCK_SIZE === cellX && this.y + dy * BLOCK_SIZE === cellY) {
                    return true;
                }
            }
        }
        return false;
    }
    
    update() {
        if (this.spawnDelay > 0) {
            this.spawnDelay--;
        } else {
            this.lifetime--;
        }
        this.pulse += 0.2 + Object.keys(TARGET_TYPES).indexOf(this.type) * 0.05;
    }
    
    isDead() {
        return this.lifetime <= 0;
    }
    
    isActive() {
        return this.spawnDelay <= 0;
    }
    
    draw() {
        const typeData = TARGET_TYPES[this.type];
        let alpha = Math.min(1.0, this.lifetime / 30.0);
        
        if (this.spawnDelay > 0) {
            alpha *= (Math.floor(this.spawnDelay / 3) % 2 === 0) ? 0.3 : 0.7;
        }
        
        const totalSize = this.gridSize * BLOCK_SIZE;
        const pulseScale = Math.sin(this.pulse) * 0.05 + 1;
        const size = totalSize * pulseScale;
        const offset = (totalSize - size) / 2;
        
        // Glow
        for (let i = 3; i > 0; i--) {
            const glowSize = size + i * 6;
            const glowOffset = (totalSize - glowSize) / 2;
            ctx.fillStyle = hexToRgba(typeData.color, (30 - i * 8) / 255 * alpha);
            roundRect(this.x + glowOffset, this.y + glowOffset, glowSize, glowSize, 4);
        }
        
        // Main body with gradient
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x + totalSize, this.y + totalSize);
        gradient.addColorStop(0, hexToRgba(typeData.innerColor, alpha));
        gradient.addColorStop(1, hexToRgba(typeData.color, alpha));
        ctx.fillStyle = gradient;
        roundRect(this.x + offset, this.y + offset, size, size, 6);
        
        // X pattern
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.78 * alpha})`;
        ctx.lineWidth = 2 + this.gridSize - 1;
        const centerX = this.x + totalSize / 2;
        const centerY = this.y + totalSize / 2;
        const crossSize = size / 4;
        ctx.beginPath();
        ctx.moveTo(centerX - crossSize, centerY - crossSize);
        ctx.lineTo(centerX + crossSize, centerY + crossSize);
        ctx.moveTo(centerX + crossSize, centerY - crossSize);
        ctx.lineTo(centerX - crossSize, centerY + crossSize);
        ctx.stroke();
        
        // Lifetime bar
        const lifePercent = this.lifetime / this.maxLifetime;
        const barWidth = totalSize * lifePercent;
        ctx.fillStyle = hexToRgba(typeData.color, 0.6 * alpha);
        ctx.fillRect(this.x, this.y + totalSize + 2, barWidth, 3);
    }
}

// ==========================================
// SLOW TARGET CLASS (Circle)
// ==========================================
class SlowTarget {
    constructor(x, y, gridSize = 1) {
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.maxLifetime = 80 + Math.random() * 40;
        this.lifetime = this.maxLifetime;
        this.pulse = 0;
    }
    
    getPixelSize() {
        return this.gridSize * BLOCK_SIZE;
    }
    
    occupiesCell(cellX, cellY) {
        for (let dx = 0; dx < this.gridSize; dx++) {
            for (let dy = 0; dy < this.gridSize; dy++) {
                if (this.x + dx * BLOCK_SIZE === cellX && this.y + dy * BLOCK_SIZE === cellY) {
                    return true;
                }
            }
        }
        return false;
    }
    
    update() {
        this.lifetime--;
        this.pulse += 0.15;
    }
    
    isDead() {
        return this.lifetime <= 0;
    }
    
    draw() {
        const alpha = Math.min(1.0, this.lifetime / 30.0);
        const totalSize = this.gridSize * BLOCK_SIZE;
        const pulseScale = Math.sin(this.pulse) * 0.1 + 1;
        const size = totalSize * pulseScale;
        
        const centerX = this.x + totalSize / 2;
        const centerY = this.y + totalSize / 2;
        
        // Glow
        for (let i = 3; i > 0; i--) {
            const glowRadius = size / 2 + i * 3;
            ctx.fillStyle = hexToRgba(COLORS.slowTarget, (25 - i * 6) / 255 * alpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Main circle
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size / 2);
        gradient.addColorStop(0, hexToRgba('#b4c8ff', alpha));
        gradient.addColorStop(1, hexToRgba(COLORS.slowTarget, alpha));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // "1/2" text
        ctx.fillStyle = `rgba(255, 255, 255, ${0.78 * alpha})`;
        ctx.font = `bold ${10 + this.gridSize * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('½', centerX, centerY);
        
        // Lifetime bar
        const lifePercent = this.lifetime / this.maxLifetime;
        const barWidth = totalSize * lifePercent;
        ctx.fillStyle = hexToRgba(COLORS.slowTarget, 0.6 * alpha);
        ctx.fillRect(this.x, this.y + totalSize + 2, barWidth, 3);
    }
}

// ==========================================
// SHRINK TARGET CLASS (Triangle)
// ==========================================
class ShrinkTarget {
    constructor(x, y, gridSize = 1) {
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.maxLifetime = 60 + Math.random() * 40;
        this.lifetime = this.maxLifetime;
        this.pulse = 0;
    }
    
    getPixelSize() {
        return this.gridSize * BLOCK_SIZE;
    }
    
    occupiesCell(cellX, cellY) {
        for (let dx = 0; dx < this.gridSize; dx++) {
            for (let dy = 0; dy < this.gridSize; dy++) {
                if (this.x + dx * BLOCK_SIZE === cellX && this.y + dy * BLOCK_SIZE === cellY) {
                    return true;
                }
            }
        }
        return false;
    }
    
    update() {
        this.lifetime--;
        this.pulse += 0.2;
    }
    
    isDead() {
        return this.lifetime <= 0;
    }
    
    draw() {
        const alpha = Math.min(1.0, this.lifetime / 30.0);
        const totalSize = this.gridSize * BLOCK_SIZE;
        const pulseScale = Math.sin(this.pulse) * 0.1 + 1;
        const size = totalSize * pulseScale;
        
        const centerX = this.x + totalSize / 2;
        const centerY = this.y + totalSize / 2;
        const halfSize = size / 2;
        
        // Triangle points
        const points = [
            { x: centerX, y: centerY - halfSize },
            { x: centerX + halfSize, y: centerY + halfSize },
            { x: centerX - halfSize, y: centerY + halfSize }
        ];
        
        // Glow
        for (let i = 3; i > 0; i--) {
            const glowScale = 1 + i * 0.15;
            ctx.fillStyle = hexToRgba(COLORS.shrinkTarget, (25 - i * 6) / 255 * alpha);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - halfSize * glowScale);
            ctx.lineTo(centerX + halfSize * glowScale, centerY + halfSize * glowScale);
            ctx.lineTo(centerX - halfSize * glowScale, centerY + halfSize * glowScale);
            ctx.closePath();
            ctx.fill();
        }
        
        // Main triangle
        const gradient = ctx.createLinearGradient(centerX, centerY - halfSize, centerX, centerY + halfSize);
        gradient.addColorStop(0, hexToRgba('#ff9696', alpha));
        gradient.addColorStop(1, hexToRgba(COLORS.shrinkTarget, alpha));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.closePath();
        ctx.fill();
        
        // "÷2" text
        ctx.fillStyle = `rgba(255, 255, 255, ${0.78 * alpha})`;
        ctx.font = `bold ${8 + this.gridSize * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('÷2', centerX, centerY + 2);
        
        // Lifetime bar
        const lifePercent = this.lifetime / this.maxLifetime;
        const barWidth = totalSize * lifePercent;
        ctx.fillStyle = hexToRgba(COLORS.shrinkTarget, 0.6 * alpha);
        ctx.fillRect(this.x, this.y + totalSize + 2, barWidth, 3);
    }
}

// ==========================================
// SPEED TARGET CLASS (Diamond)
// ==========================================
class SpeedTarget {
    constructor(x, y, gridSize = 1) {
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.maxLifetime = 70 + Math.random() * 50;
        this.lifetime = this.maxLifetime;
        this.pulse = 0;
    }
    
    getPixelSize() {
        return this.gridSize * BLOCK_SIZE;
    }
    
    occupiesCell(cellX, cellY) {
        for (let dx = 0; dx < this.gridSize; dx++) {
            for (let dy = 0; dy < this.gridSize; dy++) {
                if (this.x + dx * BLOCK_SIZE === cellX && this.y + dy * BLOCK_SIZE === cellY) {
                    return true;
                }
            }
        }
        return false;
    }
    
    update() {
        this.lifetime--;
        this.pulse += 0.2;
    }
    
    isDead() {
        return this.lifetime <= 0;
    }
    
    draw() {
        const alpha = Math.min(1.0, this.lifetime / 30.0);
        const totalSize = this.gridSize * BLOCK_SIZE;
        const pulseScale = Math.sin(this.pulse) * 0.1 + 1;
        const size = totalSize * pulseScale;
        
        const centerX = this.x + totalSize / 2;
        const centerY = this.y + totalSize / 2;
        const halfSize = size / 2;
        
        // Diamond points
        const points = [
            { x: centerX, y: centerY - halfSize },
            { x: centerX + halfSize, y: centerY },
            { x: centerX, y: centerY + halfSize },
            { x: centerX - halfSize, y: centerY }
        ];
        
        // Glow
        for (let i = 3; i > 0; i--) {
            const glowSize = halfSize + i * 3;
            ctx.fillStyle = hexToRgba(COLORS.speedTarget, (25 - i * 6) / 255 * alpha);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - glowSize);
            ctx.lineTo(centerX + glowSize, centerY);
            ctx.lineTo(centerX, centerY + glowSize);
            ctx.lineTo(centerX - glowSize, centerY);
            ctx.closePath();
            ctx.fill();
        }
        
        // Main diamond
        const gradient = ctx.createLinearGradient(centerX, centerY - halfSize, centerX, centerY + halfSize);
        gradient.addColorStop(0, hexToRgba('#ffdc64', alpha));
        gradient.addColorStop(1, hexToRgba(COLORS.speedTarget, alpha));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.lineTo(points[3].x, points[3].y);
        ctx.closePath();
        ctx.fill();
        
        // Lightning bolt
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.86 * alpha})`;
        ctx.lineWidth = 1 + this.gridSize;
        const boltSize = 2 + this.gridSize * 2;
        ctx.beginPath();
        ctx.moveTo(centerX - boltSize/2, centerY - boltSize);
        ctx.lineTo(centerX + boltSize/2, centerY - boltSize/3);
        ctx.lineTo(centerX - boltSize/2, centerY + boltSize/3);
        ctx.lineTo(centerX + boltSize/2, centerY + boltSize);
        ctx.stroke();
        
        // "x2" text
        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * alpha})`;
        ctx.font = `bold ${8 + this.gridSize * 2}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('x2', this.x + 4, this.y - 2);
        
        // Lifetime bar
        const lifePercent = this.lifetime / this.maxLifetime;
        const barWidth = totalSize * lifePercent;
        ctx.fillStyle = hexToRgba(COLORS.speedTarget, 0.6 * alpha);
        ctx.fillRect(this.x, this.y + totalSize + 2, barWidth, 3);
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
    }
    return hex;
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// ==========================================
// GAME INITIALIZATION
// ==========================================
function initGame() {
    // Stop all music
    sound.stopMenuMusic();
    sound.stopGameMusic();
    musicTempo = 1.0;
    
    snake = [];
    snakeLength = 1;
    
    snakeX = Math.floor(GAME_WIDTH / 2 / BLOCK_SIZE) * BLOCK_SIZE;
    snakeY = Math.floor(GAME_HEIGHT / 2 / BLOCK_SIZE) * BLOCK_SIZE;
    dirX = 0;
    dirY = 0;
    nextDirX = 0;
    nextDirY = 0;
    
    spawnFood();
    
    score = 0;
    targetsHit = 0;
    totalShots = 0;
    foodEaten = 0;
    slowdownTimer = 0;
    speedupTimer = 0;
    foodTimer = FOOD_TIME_LIMIT;
    currentFPS = NORMAL_FPS;
    frameInterval = 1000 / currentFPS;
    
    gameOver = false;
    gameStarted = false;
    spacePressed = false;
    autoFireCooldown = 0;
    
    particles = [];
    bullets = [];
    targets = [];
    slowTargets = [];
    shrinkTargets = [];
    speedTargets = [];
    targetSpawnTimer = 0;
    
    updateStats();
    
    // Start menu music if user has interacted
    if (userHasInteracted && !soundMuted) {
        sound.playMenuMusic();
    }
}

// Start the actual gameplay
function startGame() {
    gameStarted = true;
    sound.stopMenuMusic();
    if (!soundMuted) {
        sound.playGameMusic();
    }
}

function spawnFood() {
    let validPosition;
    do {
        validPosition = true;
        foodX = (Math.floor(Math.random() * ((GAME_WIDTH - BLOCK_SIZE * 2) / BLOCK_SIZE)) + 1) * BLOCK_SIZE;
        foodY = (Math.floor(Math.random() * ((GAME_HEIGHT - BLOCK_SIZE * 2) / BLOCK_SIZE)) + 1) * BLOCK_SIZE;
        
        for (const segment of snake) {
            if (segment[0] === foodX && segment[1] === foodY) {
                validPosition = false;
                break;
            }
        }
    } while (!validPosition);
    
    foodTimer = FOOD_TIME_LIMIT;
}

function getRandomTargetType() {
    const roll = Math.random() * 100;
    if (roll < 50) return 'COMMON';
    if (roll < 75) return 'FAST';
    if (roll < 90) return 'RARE';
    if (roll < 98) return 'EPIC';
    return 'LEGENDARY';
}

function isValidTargetPosition(tx, ty, gridSize) {
    for (let dx = 0; dx < gridSize; dx++) {
        for (let dy = 0; dy < gridSize; dy++) {
            const cellX = tx + dx * BLOCK_SIZE;
            const cellY = ty + dy * BLOCK_SIZE;
            
            if (cellX < BLOCK_SIZE || cellX >= GAME_WIDTH - BLOCK_SIZE ||
                cellY < BLOCK_SIZE || cellY >= GAME_HEIGHT - BLOCK_SIZE) {
                return false;
            }
            
            if (cellX === foodX && cellY === foodY) return false;
            
            for (const segment of snake) {
                if (segment[0] === cellX && segment[1] === cellY) return false;
            }
            
            for (const t of targets) {
                if (t.occupiesCell(cellX, cellY)) return false;
            }
            for (const st of slowTargets) {
                if (st.occupiesCell(cellX, cellY)) return false;
            }
            for (const sht of shrinkTargets) {
                if (sht.occupiesCell(cellX, cellY)) return false;
            }
            for (const spt of speedTargets) {
                if (spt.occupiesCell(cellX, cellY)) return false;
            }
        }
    }
    return true;
}

function spawnTargets() {
    const count = Math.floor(Math.random() * 12) + 1;
    
    for (let i = 0; i < count; i++) {
        let attempts = 0;
        let validPosition = false;
        let tx = 0, ty = 0;
        
        const sizeRoll = Math.random() * 100;
        let gridSize;
        if (sizeRoll < 60) gridSize = 1;
        else if (sizeRoll < 90) gridSize = 2;
        else gridSize = 3;
        
        while (!validPosition && attempts < 50) {
            const maxX = Math.floor((GAME_WIDTH - BLOCK_SIZE * (1 + gridSize)) / BLOCK_SIZE);
            const maxY = Math.floor((GAME_HEIGHT - BLOCK_SIZE * (1 + gridSize)) / BLOCK_SIZE);
            tx = (Math.floor(Math.random() * maxX) + 1) * BLOCK_SIZE;
            ty = (Math.floor(Math.random() * maxY) + 1) * BLOCK_SIZE;
            validPosition = isValidTargetPosition(tx, ty, gridSize);
            attempts++;
        }
        
        if (validPosition) {
            const roll = Math.random() * 100;
            if (roll < 12) {
                slowTargets.push(new SlowTarget(tx, ty, gridSize));
            } else if (roll < 37) {
                shrinkTargets.push(new ShrinkTarget(tx, ty, gridSize));
            } else if (roll < 50) {
                speedTargets.push(new SpeedTarget(tx, ty, gridSize));
            } else {
                targets.push(new Target(tx, ty, getRandomTargetType(), gridSize));
            }
        }
    }
}

function shoot() {
    if (!gameStarted || gameOver) return;
    if (snake.length === 0) return;
    
    const head = snake[snake.length - 1];
    const startX = head[0] + BLOCK_SIZE / 2;
    const startY = head[1] + BLOCK_SIZE / 2;
    
    let shootDirX = dirX;
    let shootDirY = dirY;
    
    if (shootDirX === 0 && shootDirY === 0) {
        shootDirY = -BLOCK_SIZE;
    }
    
    bullets.push(new Bullet(startX, startY, shootDirX, shootDirY));
    totalShots++;
    sound.playShoot();
}

function activateSlowdown() {
    slowdownTimer = SLOWDOWN_DURATION;
    speedupTimer = 0;
    currentFPS = SLOW_FPS;
    frameInterval = 1000 / currentFPS;
    sound.playPowerUp();
}

function activateSpeedup() {
    speedupTimer = SPEEDUP_DURATION;
    slowdownTimer = 0;
    currentFPS = FAST_FPS;
    frameInterval = 1000 / currentFPS;
    sound.playSpeedUp();
}

function checkLineCollision(bullet, targetX, targetY, targetSize) {
    const tolerance = 4;
    const tLeft = targetX - tolerance;
    const tRight = targetX + targetSize + tolerance;
    const tTop = targetY - tolerance;
    const tBottom = targetY + targetSize + tolerance;
    
    if (bullet.vy === 0 && bullet.vx !== 0) {
        if (bullet.y >= tTop && bullet.y <= tBottom) {
            if (bullet.x >= tLeft && bullet.x <= tRight) {
                return true;
            }
        }
    } else if (bullet.vx === 0 && bullet.vy !== 0) {
        if (bullet.x >= tLeft && bullet.x <= tRight) {
            if (bullet.y >= tTop && bullet.y <= tBottom) {
                return true;
            }
        }
    }
    return false;
}

function updateStats() {
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('highScoreValue').textContent = highScore;
    document.getElementById('lengthValue').textContent = snakeLength;
    document.getElementById('targetsValue').textContent = targetsHit;
}

// ==========================================
// GAME UPDATE
// ==========================================
function update() {
    if (gameOver || !gameStarted) return;
    
    // Update direction
    dirX = nextDirX;
    dirY = nextDirY;
    
    // Auto-fire
    if (spacePressed) {
        autoFireCooldown--;
        if (autoFireCooldown <= 0) {
            shoot();
            autoFireCooldown = AUTO_FIRE_DELAY;
        }
    }
    
    // Move snake
    snakeX += dirX;
    snakeY += dirY;
    
    // Wall collision
    if (snakeX < 0 || snakeX >= GAME_WIDTH || snakeY < 0 || snakeY >= GAME_HEIGHT) {
        endGame();
        return;
    }
    
    // Self collision
    for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i][0] === snakeX && snake[i][1] === snakeY) {
            endGame();
            return;
        }
    }
    
    // Target collision (dangerous squares)
    for (const t of targets) {
        if (t.isActive() && t.occupiesCell(snakeX, snakeY)) {
            endGame();
            return;
        }
    }
    
    // Add new head
    snake.push([snakeX, snakeY]);
    
    // Food collision
    if (snakeX === foodX && snakeY === foodY) {
        snakeLength++;
        foodEaten++;
        score++;
        // Update music tempo based on snake length
        sound.updateMusicTempo(snakeLength);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('fireSnakeHighScore', highScore.toString());
            sound.playNewRecord();
        }
        sound.playEat();
        spawnFood();
        spawnParticles(foodX + BLOCK_SIZE/2, foodY + BLOCK_SIZE/2, 15, 'rgb(255, 50, 100)');
    }
    
    // Remove tail if too long
    while (snake.length > snakeLength) {
        snake.shift();
    }
    
    // Food timer
    foodTimer--;
    if (foodTimer <= 0) {
        endGame();
        return;
    }
    
    // Update timers
    if (slowdownTimer > 0) {
        slowdownTimer--;
        if (slowdownTimer === 0) {
            currentFPS = NORMAL_FPS;
            frameInterval = 1000 / currentFPS;
        }
    }
    if (speedupTimer > 0) {
        speedupTimer--;
        if (speedupTimer === 0) {
            currentFPS = NORMAL_FPS;
            frameInterval = 1000 / currentFPS;
        }
    }
    
    // Target spawning
    targetSpawnTimer++;
    if (targetSpawnTimer >= TARGET_SPAWN_INTERVAL) {
        spawnTargets();
        targetSpawnTimer = 0;
    }
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].isOutOfBounds()) {
            bullets.splice(i, 1);
            continue;
        }
        
        // Check bullet collisions
        let bulletHit = false;
        
        // Dangerous targets
        for (let j = targets.length - 1; j >= 0; j--) {
            if (checkLineCollision(bullets[i], targets[j].x, targets[j].y, targets[j].getPixelSize())) {
                const t = targets[j];
                const centerX = t.x + t.getPixelSize() / 2;
                const centerY = t.y + t.getPixelSize() / 2;
                spawnParticles(centerX, centerY, 20 * t.gridSize, TARGET_TYPES[t.type].color);
                sound.playExplosion();
                score += TARGET_TYPES[t.type].points * t.gridSize;
                snakeLength += TARGET_TYPES[t.type].points * t.gridSize;
                // Update music tempo based on snake length
                sound.updateMusicTempo(snakeLength);
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('fireSnakeHighScore', highScore.toString());
                    sound.playNewRecord();
                }
                targetsHit++;
                targets.splice(j, 1);
                bullets.splice(i, 1);
                bulletHit = true;
                break;
            }
        }
        
        if (bulletHit) continue;
        
        // Slow targets
        for (let j = slowTargets.length - 1; j >= 0; j--) {
            if (checkLineCollision(bullets[i], slowTargets[j].x, slowTargets[j].y, slowTargets[j].getPixelSize())) {
                const st = slowTargets[j];
                const centerX = st.x + st.getPixelSize() / 2;
                const centerY = st.y + st.getPixelSize() / 2;
                spawnParticles(centerX, centerY, 20 * st.gridSize, COLORS.slowTarget);
                activateSlowdown();
                targetsHit++;
                slowTargets.splice(j, 1);
                bullets.splice(i, 1);
                bulletHit = true;
                break;
            }
        }
        
        if (bulletHit) continue;
        
        // Shrink targets
        for (let j = shrinkTargets.length - 1; j >= 0; j--) {
            if (checkLineCollision(bullets[i], shrinkTargets[j].x, shrinkTargets[j].y, shrinkTargets[j].getPixelSize())) {
                const sht = shrinkTargets[j];
                const centerX = sht.x + sht.getPixelSize() / 2;
                const centerY = sht.y + sht.getPixelSize() / 2;
                spawnParticles(centerX, centerY, 20 * sht.gridSize, COLORS.shrinkTarget);
                sound.playExplosion();
                sound.playShrink();
                snakeLength = Math.max(1, Math.floor(snakeLength / 2));
                while (snake.length > snakeLength) {
                    snake.shift();
                }
                targetsHit++;
                shrinkTargets.splice(j, 1);
                bullets.splice(i, 1);
                bulletHit = true;
                break;
            }
        }
        
        if (bulletHit) continue;
        
        // Speed targets
        for (let j = speedTargets.length - 1; j >= 0; j--) {
            if (checkLineCollision(bullets[i], speedTargets[j].x, speedTargets[j].y, speedTargets[j].getPixelSize())) {
                const spt = speedTargets[j];
                const centerX = spt.x + spt.getPixelSize() / 2;
                const centerY = spt.y + spt.getPixelSize() / 2;
                spawnParticles(centerX, centerY, 20 * spt.gridSize, COLORS.speedTarget);
                activateSpeedup();
                targetsHit++;
                speedTargets.splice(j, 1);
                bullets.splice(i, 1);
                break;
            }
        }
    }
    
    // Update targets
    for (let i = targets.length - 1; i >= 0; i--) {
        targets[i].update();
        if (targets[i].isDead()) targets.splice(i, 1);
    }
    for (let i = slowTargets.length - 1; i >= 0; i--) {
        slowTargets[i].update();
        if (slowTargets[i].isDead()) slowTargets.splice(i, 1);
    }
    for (let i = shrinkTargets.length - 1; i >= 0; i--) {
        shrinkTargets[i].update();
        if (shrinkTargets[i].isDead()) shrinkTargets.splice(i, 1);
    }
    for (let i = speedTargets.length - 1; i >= 0; i--) {
        speedTargets[i].update();
        if (speedTargets[i].isDead()) speedTargets.splice(i, 1);
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDead()) particles.splice(i, 1);
    }
    
    updateStats();
}

function endGame() {
    gameOver = true;
    sound.playGameOver();
}

// ==========================================
// DRAWING
// ==========================================
function draw() {
    // Background
    const gradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT);
    gradient.addColorStop(0, COLORS.background1);
    gradient.addColorStop(1, COLORS.background2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Stars
    for (const star of stars) {
        star.update();
        star.draw();
    }
    
    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < GAME_WIDTH; x += BLOCK_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < GAME_HEIGHT; y += BLOCK_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_WIDTH, y);
        ctx.stroke();
    }
    
    // Border
    let borderColor = '#00ff96';
    if (speedupTimer > 0) borderColor = COLORS.speedTarget;
    else if (slowdownTimer > 0) borderColor = COLORS.slowTarget;
    
    ctx.strokeStyle = hexToRgba(borderColor, 0.4);
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);
    ctx.strokeStyle = hexToRgba(borderColor, 0.8);
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);
    
    if (gameOver) {
        drawGameOver();
    } else if (!gameStarted) {
        drawStartScreen();
        drawFood();
        drawSnake();
    } else {
        // Draw game objects
        for (const t of targets) t.draw();
        for (const st of slowTargets) st.draw();
        for (const sht of shrinkTargets) sht.draw();
        for (const spt of speedTargets) spt.draw();
        drawFood();
        drawSnake();
        for (const b of bullets) b.draw();
        for (const p of particles) p.draw();
        
        // Effect indicators
        if (slowdownTimer > 0) drawEffectBar(slowdownTimer, SLOWDOWN_DURATION, COLORS.slowTarget, 'SLOWED');
        if (speedupTimer > 0) drawEffectBar(speedupTimer, SPEEDUP_DURATION, COLORS.speedTarget, 'SPEED x2');
        
        // Food timer
        drawFoodTimer();
    }
    
    foodPulse += 0.15;
}

function drawSnake() {
    const isSlowed = slowdownTimer > 0;
    const isFast = speedupTimer > 0;
    
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        const progress = i / Math.max(snake.length - 1, 1);
        
        let color;
        if (i === snake.length - 1) {
            // Head
            if (isFast) {
                color = COLORS.snakeFast;
                ctx.fillStyle = 'rgba(255, 180, 50, 0.5)';
            } else if (isSlowed) {
                color = COLORS.snakeSlow;
                ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
            } else {
                color = COLORS.snakeHead;
                ctx.fillStyle = COLORS.snakeGlow;
            }
            ctx.beginPath();
            ctx.arc(segment[0] + BLOCK_SIZE/2, segment[1] + BLOCK_SIZE/2, BLOCK_SIZE/2 + 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Body gradient
            if (isFast) {
                const r = Math.floor(255 + (200 - 255) * (1 - progress));
                const g = Math.floor(180 + (100 - 180) * (1 - progress));
                const b = Math.floor(50 + (0 - 50) * (1 - progress));
                color = `rgb(${r}, ${g}, ${b})`;
            } else if (isSlowed) {
                const r = Math.floor(150 + (100 - 150) * (1 - progress));
                const g = Math.floor(180 + (150 - 180) * (1 - progress));
                const b = Math.floor(255 + (200 - 255) * (1 - progress));
                color = `rgb(${r}, ${g}, ${b})`;
            } else {
                const sr = parseInt(COLORS.snakeBodyStart.slice(1, 3), 16);
                const sg = parseInt(COLORS.snakeBodyStart.slice(3, 5), 16);
                const sb = parseInt(COLORS.snakeBodyStart.slice(5, 7), 16);
                const er = parseInt(COLORS.snakeBodyEnd.slice(1, 3), 16);
                const eg = parseInt(COLORS.snakeBodyEnd.slice(3, 5), 16);
                const eb = parseInt(COLORS.snakeBodyEnd.slice(5, 7), 16);
                const r = Math.floor(sr + (er - sr) * (1 - progress));
                const g = Math.floor(sg + (eg - sg) * (1 - progress));
                const b = Math.floor(sb + (eb - sb) * (1 - progress));
                color = `rgb(${r}, ${g}, ${b})`;
            }
        }
        
        ctx.fillStyle = color;
        roundRect(segment[0] + 1, segment[1] + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2, 6);
        
        // Shine
        const shineGradient = ctx.createLinearGradient(segment[0], segment[1], segment[0], segment[1] + BLOCK_SIZE);
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shineGradient;
        roundRect(segment[0] + 2, segment[1] + 2, BLOCK_SIZE - 4, BLOCK_SIZE / 2 - 2, 4);
        
        // Eyes on head
        if (i === snake.length - 1) {
            drawSnakeEyes(segment[0], segment[1]);
        }
    }
}

function drawSnakeEyes(x, y) {
    const eyeSize = 5;
    const pupilSize = 3;
    let eye1X, eye1Y, eye2X, eye2Y;
    
    if (dirX > 0) {
        eye1X = x + BLOCK_SIZE - 7; eye1Y = y + 4;
        eye2X = x + BLOCK_SIZE - 7; eye2Y = y + BLOCK_SIZE - 9;
    } else if (dirX < 0) {
        eye1X = x + 2; eye1Y = y + 4;
        eye2X = x + 2; eye2Y = y + BLOCK_SIZE - 9;
    } else if (dirY > 0) {
        eye1X = x + 4; eye1Y = y + BLOCK_SIZE - 7;
        eye2X = x + BLOCK_SIZE - 9; eye2Y = y + BLOCK_SIZE - 7;
    } else {
        eye1X = x + 4; eye1Y = y + 2;
        eye2X = x + BLOCK_SIZE - 9; eye2Y = y + 2;
    }
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(eye1X + eyeSize/2, eye1Y + eyeSize/2, eyeSize/2, 0, Math.PI * 2);
    ctx.arc(eye2X + eyeSize/2, eye2Y + eyeSize/2, eyeSize/2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#141428';
    ctx.beginPath();
    ctx.arc(eye1X + eyeSize/2 + 0.5, eye1Y + eyeSize/2 + 0.5, pupilSize/2, 0, Math.PI * 2);
    ctx.arc(eye2X + eyeSize/2 + 0.5, eye2Y + eyeSize/2 + 0.5, pupilSize/2, 0, Math.PI * 2);
    ctx.fill();
}

function drawFood() {
    const pulse = Math.sin(foodPulse) * 0.2 + 1;
    const size = BLOCK_SIZE * pulse;
    const offset = (BLOCK_SIZE - size) / 2;
    
    // Glow
    for (let i = 3; i > 0; i--) {
        const glowSize = size + i * 6;
        const glowOffset = (BLOCK_SIZE - glowSize) / 2;
        ctx.fillStyle = hexToRgba(COLORS.food, (30 - i * 8) / 255);
        ctx.beginPath();
        ctx.arc(foodX + BLOCK_SIZE/2, foodY + BLOCK_SIZE/2, glowSize/2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Food
    const foodGradient = ctx.createRadialGradient(
        foodX + BLOCK_SIZE/2, foodY + BLOCK_SIZE/2, 0,
        foodX + BLOCK_SIZE/2, foodY + BLOCK_SIZE/2, size/2
    );
    foodGradient.addColorStop(0, COLORS.foodInner);
    foodGradient.addColorStop(1, COLORS.food);
    ctx.fillStyle = foodGradient;
    ctx.beginPath();
    ctx.arc(foodX + BLOCK_SIZE/2, foodY + BLOCK_SIZE/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(foodX + offset + size * 0.3, foodY + offset + size * 0.3, size/6, 0, Math.PI * 2);
    ctx.fill();
}

function drawEffectBar(timer, maxTimer, color, text) {
    const progress = timer / maxTimer;
    const barWidth = GAME_WIDTH * 0.6;
    const barHeight = 8;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = 15;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(barX - 5, barY - 5, barWidth + 10, barHeight + 20, 10);
    
    // Bar background
    ctx.fillStyle = 'rgba(50, 50, 100, 1)';
    roundRect(barX, barY, barWidth, barHeight, 4);
    
    // Bar fill
    ctx.fillStyle = color;
    roundRect(barX, barY, barWidth * progress, barHeight, 4);
    
    // Text
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    const seconds = (timer / NORMAL_FPS).toFixed(1);
    ctx.fillText(`${text} - ${seconds}s`, GAME_WIDTH / 2, barY + barHeight + 14);
}

function drawFoodTimer() {
    const progress = foodTimer / FOOD_TIME_LIMIT;
    const barWidth = 100;
    const barHeight = 6;
    const barX = foodX + BLOCK_SIZE/2 - barWidth/2;
    const barY = foodY - 12;
    
    // Only show when less than 50%
    if (progress < 0.5) {
        const alpha = 1 - progress * 2;
        const color = progress < 0.25 ? '#ff3232' : '#ffaa00';
        
        ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * alpha})`;
        ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
        
        ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`;
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = hexToRgba(color, alpha);
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // "FIRE SNAKE" in red
    ctx.fillStyle = '#ff3232';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 50, 50, 0.8)';
    ctx.shadowBlur = 20;
    ctx.fillText('FIRE SNAKE', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80);
    ctx.shadowBlur = 0;
    
    // Main instruction - Press SPACE to start
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Press SPACE to start', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
    
    ctx.fillStyle = '#888';
    ctx.font = '16px Arial';
    ctx.fillText('or use ARROW KEYS / WASD', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
    
    ctx.fillText('Hold SPACE to shoot • Eat food before time runs out!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
    ctx.fillText('Shoot targets for points • Avoid square targets!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 85);
    
    // Controls hint
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.fillText('BACKSPACE - mute all sounds', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120);
    
    // Hint to press any key for music
    if (!userHasInteracted) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Click or press any key to enable sound', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 150);
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    ctx.fillStyle = '#ff3264';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 50, 100, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = COLORS.text;
    ctx.font = '28px Arial';
    ctx.fillText(`Score: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
    
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`High Score: ${highScore}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
    
    ctx.fillStyle = '#888';
    ctx.font = '18px Arial';
    ctx.fillText(`Length: ${snakeLength} • Targets Hit: ${targetsHit} • Food Eaten: ${foodEaten}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
    
    // "R" in cyan/turquoise color, "SPACE" in yellow
    ctx.font = '20px Arial';
    ctx.fillStyle = '#00ccff';
    ctx.fillText('Press R or SPACE to restart', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120);
}

// ==========================================
// GAME LOOP
// ==========================================
function gameLoop(timestamp) {
    if (timestamp - lastTime >= frameInterval) {
        update();
        lastTime = timestamp;
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// ==========================================
// INPUT HANDLING
// ==========================================
document.addEventListener('keydown', (e) => {
    // Resume audio context on first interaction
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    // Track first interaction for menu music
    if (!userHasInteracted) {
        userHasInteracted = true;
        // Start menu music on first interaction if in menu
        if (!gameStarted && !gameOver && !soundMuted) {
            sound.playMenuMusic();
        }
    }
    
    const key = e.key.toLowerCase();
    
    // Direction controls
    if ((key === 'arrowup' || key === 'w') && dirY !== BLOCK_SIZE) {
        nextDirX = 0;
        nextDirY = -BLOCK_SIZE;
        if (!gameStarted && !gameOver) {
            startGame();
        }
    }
    if ((key === 'arrowdown' || key === 's') && dirY !== -BLOCK_SIZE) {
        nextDirX = 0;
        nextDirY = BLOCK_SIZE;
        if (!gameStarted && !gameOver) {
            startGame();
        }
    }
    if ((key === 'arrowleft' || key === 'a') && dirX !== BLOCK_SIZE) {
        nextDirX = -BLOCK_SIZE;
        nextDirY = 0;
        if (!gameStarted && !gameOver) {
            startGame();
        }
    }
    if ((key === 'arrowright' || key === 'd') && dirX !== -BLOCK_SIZE) {
        nextDirX = BLOCK_SIZE;
        nextDirY = 0;
        if (!gameStarted && !gameOver) {
            startGame();
        }
    }
    
    // Space key handling
    if (key === ' ') {
        e.preventDefault();
        // Space for restart when game over
        if (gameOver) {
            initGame();
            return;
        }
        // Space to START the game from menu
        if (!gameStarted && !gameOver) {
            // Start moving up by default
            nextDirX = 0;
            nextDirY = -BLOCK_SIZE;
            startGame();
            return;
        }
        // Space for shooting during game (auto-fire)
        if (gameStarted && !spacePressed) {
            shoot();
            spacePressed = true;
            autoFireCooldown = AUTO_FIRE_DELAY;
        }
    }
    
    // Restart with R
    if (key === 'r' && gameOver) {
        initGame();
    }
    
    // Mute with M or Backspace
    if (key === 'm' || key === 'backspace') {
        e.preventDefault();
        soundMuted = !soundMuted;
        if (soundMuted) {
            sound.stopMenuMusic();
            sound.stopGameMusic();
        } else if (userHasInteracted) {
            if (gameStarted && !gameOver) {
                sound.playGameMusic();
            } else if (!gameStarted && !gameOver) {
                sound.playMenuMusic();
            }
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
        spacePressed = false;
    }
});

// Handle click/touch to enable audio
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!userHasInteracted) {
        userHasInteracted = true;
        if (!gameStarted && !gameOver && !soundMuted) {
            sound.playMenuMusic();
        }
    }
});

// ==========================================
// INITIALIZATION
// ==========================================
// Create stars
for (let i = 0; i < 100; i++) {
    stars.push(new Star());
}

initGame();
requestAnimationFrame(gameLoop);

console.log('Fire Snake Game loaded! Open http://localhost:5050 to play.');

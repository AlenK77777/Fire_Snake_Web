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
let newRecordThisGame = false; // Track if record was beaten this game

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
let enemySnake = null; // Current enemy snake (only one at a time)
let enemyBullets = []; // Bullets shot by enemy snakes

// Enemy snake spawn timer
let enemySpawnTimer = 0;
let nextEnemySpawnTime = 60; // Start with 5 seconds for first spawn, then randomize 10-15 seconds

// Enemy snake types
const ENEMY_TYPES = {
    DUMB: {
        name: 'Dumb',
        color: '#d4a574',        // Beige
        headColor: '#c9956c',
        glowColor: 'rgba(212, 165, 116, 0.5)',
        accuracy: 0.2,          // 20% accuracy
        moveAccuracy: 0.5,      // 50% chance to make correct move
        crashChance: 0.002,     // 0.2% chance to crash each frame (was 3% - way too high!)
        shootInterval: 30,      // Shoots every 2.5 seconds
        spawnChance: 50         // 50% chance to spawn this type
    },
    MEDIUM: {
        name: 'Medium',
        color: '#ffd700',        // Yellow
        headColor: '#ffec00',
        glowColor: 'rgba(255, 215, 0, 0.5)',
        accuracy: 0.5,          // 50% accuracy
        moveAccuracy: 0.75,     // 75% correct moves
        crashChance: 0.001,     // 0.1% crash chance (was 1%)
        shootInterval: 20,      // Shoots every ~1.7 seconds
        spawnChance: 35         // 35% chance
    },
    SMART: {
        name: 'Smart',
        color: '#ff4444',        // Red
        headColor: '#ff6666',
        glowColor: 'rgba(255, 68, 68, 0.5)',
        accuracy: 0.85,         // 85% accuracy
        moveAccuracy: 0.95,     // 95% correct moves
        crashChance: 0.0005,    // 0.05% crash chance (was 0.2%)
        shootInterval: 12,      // Shoots every second
        spawnChance: 15         // 15% chance
    }
};

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
// SOUND ENGINE with MIDI support
// ==========================================
class SoundEngine {
    constructor() {
        this.ctx = audioCtx;
        this.currentMusic = null;
        this.currentMusicType = null; // 'menu', 'game', 'gameOverWin', 'gameOverLose'
        this.loopChecker = null;
        this.midiReady = false;
        
        // MIDI file paths
        this.MUSIC = {
            menu: '/music/entertainer.mid',
            game: '/music/macarena.mid',
            gameOverLose: '/music/requiem.mid',
            gameOverWin: '/music/we are the champions.mid'
        };
        
        // Wait for MIDIjs without playing anything
        this.initMidi();
    }
    
    initMidi() {
        const checkMidi = () => {
            if (typeof MIDIjs !== 'undefined') {
                this.midiReady = true;
                console.log('MIDIjs ready (no pre-warm)');
                // Just preload files into browser cache (no audio)
                Object.values(this.MUSIC).forEach(file => {
                    fetch(file).catch(() => {});
                });
            } else {
                setTimeout(checkMidi, 100);
            }
        };
        checkMidi();
    }
    
    // ========== SOUND EFFECTS (8-bit style) ==========
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
    
    // ========== MIDI MUSIC PLAYBACK ==========
    
    // Estimated durations for each track (in milliseconds)
    // These are approximate - better to be slightly shorter to ensure looping
    MUSIC_DURATIONS = {
        '/music/entertainer.mid': 120000,      // ~2 minutes
        '/music/macarena.mid': 180000,         // ~3 minutes
        '/music/requiem.mid': 240000,          // ~4 minutes
        '/music/we are the champions.mid': 180000  // ~3 minutes
    };
    
    // Internal method to actually play MIDI
    _playMidiInternal(filePath, shouldLoop) {
        if (typeof MIDIjs === 'undefined') return;
        
        console.log('_playMidiInternal:', filePath, 'loop:', shouldLoop);
        MIDIjs.play(filePath);
        this.lastPlayTime = Date.now();
        this.isLooping = shouldLoop;
        
        if (shouldLoop) {
            // Get estimated duration for this track (default 2 minutes)
            const duration = this.MUSIC_DURATIONS[filePath] || 120000;
            
            // Set up loop restart based on estimated duration
            // Don't use MIDIjs.playing - it's unreliable
            this.loopChecker = setTimeout(() => {
                if (this.currentMusic === filePath && !soundMuted && this.isLooping) {
                    console.log('Looping (duration-based):', filePath);
                    this._playMidiInternal(filePath, true);
                }
            }, duration);
        }
    }
    
    // Stop all music completely
    stopAllMusic() {
        console.log('stopAllMusic called');
        
        // Clear any loop timer
        if (this.loopChecker) {
            clearTimeout(this.loopChecker);
            this.loopChecker = null;
        }
        
        this.isLooping = false;
        
        // Stop MIDIjs
        try {
            if (typeof MIDIjs !== 'undefined') {
                MIDIjs.stop();
            }
        } catch (e) {}
        
        this.currentMusic = null;
        this.currentMusicType = null;
    }
    
    // ========== MUSIC CONTROL FUNCTIONS ==========
    
    // Play menu music (Entertainer) - loops
    playMenuMusic() {
        if (soundMuted) return;
        if (this.currentMusicType === 'menu') return; // Already playing
        
        console.log('=== PLAY MENU MUSIC (Entertainer) ===');
        this.stopAllMusic();
        this.currentMusic = this.MUSIC.menu;
        this.currentMusicType = 'menu';
        
        if (this.midiReady) {
            this._playMidiInternal(this.MUSIC.menu, true);
        } else {
            // Wait for MIDIjs
            setTimeout(() => this.playMenuMusic(), 200);
        }
    }
    
    stopMenuMusic() {
        if (this.currentMusicType === 'menu') {
            console.log('=== STOP MENU MUSIC ===');
            this.stopAllMusic();
        }
    }
    
    // Play game music (Macarena) - loops
    playGameMusic() {
        if (soundMuted) return;
        if (this.currentMusicType === 'game') return; // Already playing
        
        console.log('=== PLAY GAME MUSIC (Macarena) ===');
        this.stopAllMusic();
        this.currentMusic = this.MUSIC.game;
        this.currentMusicType = 'game';
        
        if (this.midiReady) {
            this._playMidiInternal(this.MUSIC.game, true);
        } else {
            setTimeout(() => this.playGameMusic(), 200);
        }
    }
    
    stopGameMusic() {
        if (this.currentMusicType === 'game') {
            console.log('=== STOP GAME MUSIC ===');
            this.stopAllMusic();
        }
    }
    
    // Play game over music - does NOT loop
    playGameOverMusic(beatRecord) {
        if (soundMuted) return;
        
        console.log('=== PLAY GAME OVER MUSIC ===', 'beatRecord:', beatRecord);
        this.stopAllMusic();
        
        if (beatRecord) {
            // Play "We Are The Champions" - no loop
            this.currentMusic = this.MUSIC.gameOverWin;
            this.currentMusicType = 'gameOverWin';
            if (this.midiReady) {
                this._playMidiInternal(this.MUSIC.gameOverWin, false);
            }
        } else {
            // Play "Requiem" - no loop
            this.currentMusic = this.MUSIC.gameOverLose;
            this.currentMusicType = 'gameOverLose';
            if (this.midiReady) {
                this._playMidiInternal(this.MUSIC.gameOverLose, false);
            }
        }
    }
    
    // Mute/unmute all
    setMuted(muted) {
        soundMuted = muted;
        if (muted) {
            this.stopAllMusic();
        }
    }
    
    // Update music tempo based on snake length (for future use with custom music)
    updateMusicTempo(snakeLen) {
        // MIDI playback speed is controlled by the MIDI file itself
        // This is kept for compatibility but doesn't affect MIDI files
        const speedLevel = Math.floor(snakeLen / 10);
        musicTempo = 1.0 + (speedLevel * 0.1);
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
// ENEMY SNAKE CLASS
// ==========================================
class EnemySnake {
    constructor(type, initialLength) {
        console.log('EnemySnake constructor called. Type:', type, 'Length:', initialLength);
        this.type = type;
        this.typeData = ENEMY_TYPES[type];
        this.segments = [];
        this.length = initialLength;
        this.dirX = 0;
        this.dirY = 0;
        this.shootCooldown = this.typeData.shootInterval;
        this.alive = true;
        this.spawnAnimation = 15; // Blink for spawn animation (reduced from 30)
        
        // Spawn at random edge
        this.spawn();
        console.log('EnemySnake spawned. Segments:', this.segments.length, 'Position:', this.segments[0], 'Direction:', this.dirX, this.dirY);
    }
    
    spawn() {
        // Choose random edge to spawn from
        const edge = Math.floor(Math.random() * 4);
        let headX, headY, dirX, dirY;
        
        // Calculate safe spawn position - head at edge, body extends INTO screen
        const margin = BLOCK_SIZE * 2; // Distance from edge for head
        const bodySpace = BLOCK_SIZE * this.length; // Space needed for body
        
        switch(edge) {
            case 0: // Top - snake enters from top, moving down
                headX = Math.floor(Math.random() * (GAME_WIDTH / BLOCK_SIZE - 4) + 2) * BLOCK_SIZE;
                headY = margin;
                dirX = 0;
                dirY = BLOCK_SIZE; // Moving down
                break;
            case 1: // Bottom - snake enters from bottom, moving up  
                headX = Math.floor(Math.random() * (GAME_WIDTH / BLOCK_SIZE - 4) + 2) * BLOCK_SIZE;
                headY = GAME_HEIGHT - margin;
                dirX = 0;
                dirY = -BLOCK_SIZE; // Moving up
                break;
            case 2: // Left - snake enters from left, moving right
                headX = margin;
                headY = Math.floor(Math.random() * (GAME_HEIGHT / BLOCK_SIZE - 4) + 2) * BLOCK_SIZE;
                dirX = BLOCK_SIZE; // Moving right
                dirY = 0;
                break;
            case 3: // Right - snake enters from right, moving left
                headX = GAME_WIDTH - margin;
                headY = Math.floor(Math.random() * (GAME_HEIGHT / BLOCK_SIZE - 4) + 2) * BLOCK_SIZE;
                dirX = -BLOCK_SIZE; // Moving left
                dirY = 0;
                break;
        }
        
        this.dirX = dirX;
        this.dirY = dirY;
        
        // Create segments: tail first, head last
        // Body extends FORWARD (in direction of movement) from tail to head
        // This makes the snake "enter" the screen with head first
        for (let i = 0; i < this.length; i++) {
            // Tail is furthest from edge, head is at edge
            const distFromHead = this.length - 1 - i;
            this.segments.push([
                headX - dirX * distFromHead,
                headY - dirY * distFromHead
            ]);
        }
        
        console.log('Spawn edge:', edge, 'Head:', this.getHead(), 'Tail:', this.segments[0], 'All on screen:', 
            this.segments.every(s => s[0] >= 0 && s[0] < GAME_WIDTH && s[1] >= 0 && s[1] < GAME_HEIGHT));
    }
    
    getHead() {
        return this.segments.length > 0 ? this.segments[this.segments.length - 1] : null;
    }
    
    update() {
        if (!this.alive) return;
        
        // Spawn animation countdown
        if (this.spawnAnimation > 0) {
            this.spawnAnimation--;
            return;
        }
        
        // Random crash based on type
        if (Math.random() < this.typeData.crashChance) {
            this.die('random_crash');
            return;
        }
        
        // AI decision making
        this.makeDecision();
        
        // Move
        const head = this.getHead();
        if (!head) return;
        
        const newX = head[0] + this.dirX;
        const newY = head[1] + this.dirY;
        
        // Check wall collision
        if (newX < 0 || newX >= GAME_WIDTH || newY < 0 || newY >= GAME_HEIGHT) {
            this.die('wall_collision');
            return;
        }
        
        // Check self collision
        for (let i = 0; i < this.segments.length - 1; i++) {
            if (this.segments[i][0] === newX && this.segments[i][1] === newY) {
                this.die('self_collision');
                return;
            }
        }
        
        // Check collision with player snake
        for (const seg of snake) {
            if (seg[0] === newX && seg[1] === newY) {
                this.die('player_collision');
                return;
            }
        }
        
        // Check collision with dangerous targets
        for (const t of targets) {
            if (t.isActive() && t.occupiesCell(newX, newY)) {
                this.die('target_collision');
                return;
            }
        }
        
        // Add new head
        this.segments.push([newX, newY]);
        
        // Check if enemy eats food
        if (newX === foodX && newY === foodY) {
            this.length++;
            spawnFood(); // Respawn food
        }
        
        // Remove tail if too long
        while (this.segments.length > this.length) {
            this.segments.shift();
        }
        
        // Shooting logic
        this.shootCooldown--;
        if (this.shootCooldown <= 0) {
            this.shoot();
            this.shootCooldown = this.typeData.shootInterval;
        }
    }
    
    makeDecision() {
        // AI decides where to move
        const head = this.getHead();
        if (!head) return;
        
        // Target is the player's head
        const playerHead = snake.length > 0 ? snake[snake.length - 1] : null;
        if (!playerHead) return;
        
        // Calculate direction to player
        const dx = playerHead[0] - head[0];
        const dy = playerHead[1] - head[1];
        
        // Decide if making smart move or random move
        if (Math.random() < this.typeData.moveAccuracy) {
            // Smart move - try to get closer to player
            const possibleMoves = [];
            
            // Can't reverse direction
            if (this.dirX !== BLOCK_SIZE) possibleMoves.push([-BLOCK_SIZE, 0]);
            if (this.dirX !== -BLOCK_SIZE) possibleMoves.push([BLOCK_SIZE, 0]);
            if (this.dirY !== BLOCK_SIZE) possibleMoves.push([0, -BLOCK_SIZE]);
            if (this.dirY !== -BLOCK_SIZE) possibleMoves.push([0, BLOCK_SIZE]);
            
            // Score each move
            let bestMove = [this.dirX, this.dirY];
            let bestScore = -Infinity;
            
            for (const move of possibleMoves) {
                const newX = head[0] + move[0];
                const newY = head[1] + move[1];
                
                // Check if move is safe
                if (this.isSafePosition(newX, newY)) {
                    // Score based on distance to player
                    const distToPlayer = Math.abs(playerHead[0] - newX) + Math.abs(playerHead[1] - newY);
                    const score = -distToPlayer; // Closer is better
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                }
            }
            
            this.dirX = bestMove[0];
            this.dirY = bestMove[1];
        } else {
            // Random move
            const moves = [];
            if (this.dirX !== BLOCK_SIZE) moves.push([-BLOCK_SIZE, 0]);
            if (this.dirX !== -BLOCK_SIZE) moves.push([BLOCK_SIZE, 0]);
            if (this.dirY !== BLOCK_SIZE) moves.push([0, -BLOCK_SIZE]);
            if (this.dirY !== -BLOCK_SIZE) moves.push([0, BLOCK_SIZE]);
            
            if (moves.length > 0) {
                const randomMove = moves[Math.floor(Math.random() * moves.length)];
                this.dirX = randomMove[0];
                this.dirY = randomMove[1];
            }
        }
    }
    
    isSafePosition(x, y) {
        // Check walls
        if (x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT) return false;
        
        // Check self
        for (const seg of this.segments) {
            if (seg[0] === x && seg[1] === y) return false;
        }
        
        // Check player snake
        for (const seg of snake) {
            if (seg[0] === x && seg[1] === y) return false;
        }
        
        // Check dangerous targets
        for (const t of targets) {
            if (t.isActive() && t.occupiesCell(x, y)) return false;
        }
        
        return true;
    }
    
    shoot() {
        if (!this.alive) return;
        
        const head = this.getHead();
        if (!head) return;
        
        // Aim at player with accuracy based on type
        const playerHead = snake.length > 0 ? snake[snake.length - 1] : null;
        if (!playerHead) return;
        
        let shootDirX = playerHead[0] - head[0];
        let shootDirY = playerHead[1] - head[1];
        
        // Add inaccuracy based on type
        if (Math.random() > this.typeData.accuracy) {
            // Miss - shoot in random direction
            const angle = Math.random() * Math.PI * 2;
            shootDirX = Math.cos(angle) * 100;
            shootDirY = Math.sin(angle) * 100;
        }
        
        // Normalize
        const len = Math.sqrt(shootDirX * shootDirX + shootDirY * shootDirY);
        if (len > 0) {
            shootDirX = (shootDirX / len) * BULLET_SPEED;
            shootDirY = (shootDirY / len) * BULLET_SPEED;
        }
        
        // Create enemy bullet
        enemyBullets.push({
            x: head[0] + BLOCK_SIZE / 2,
            y: head[1] + BLOCK_SIZE / 2,
            vx: shootDirX,
            vy: shootDirY,
            color: this.typeData.color
        });
        
        sound.playShoot();
    }
    
    die(reason = 'unknown') {
        console.log('>>> ENEMY DIED! Reason:', reason, 'Type:', this.type, 'Position:', this.getHead());
        this.alive = false;
        // Spawn particles
        const head = this.getHead();
        if (head) {
            spawnParticles(head[0] + BLOCK_SIZE/2, head[1] + BLOCK_SIZE/2, 30, this.typeData.color);
        }
        sound.playExplosion();
    }
    
    draw() {
        if (!this.alive) return;
        
        // Spawn animation - blink
        if (this.spawnAnimation > 0 && Math.floor(this.spawnAnimation / 3) % 2 === 0) {
            return;
        }
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const isHead = i === this.segments.length - 1;
            const progress = i / Math.max(this.segments.length - 1, 1);
            
            // Color gradient from tail to head
            const baseColor = this.typeData.color;
            const alpha = 0.5 + progress * 0.5;
            
            if (isHead) {
                // Draw glow
                ctx.fillStyle = this.typeData.glowColor;
                ctx.beginPath();
                ctx.arc(segment[0] + BLOCK_SIZE/2, segment[1] + BLOCK_SIZE/2, BLOCK_SIZE/2 + 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = this.typeData.headColor;
            } else {
                ctx.fillStyle = hexToRgba(baseColor, alpha);
            }
            
            roundRect(segment[0] + 1, segment[1] + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2, 6);
            
            // Eyes on head
            if (isHead) {
                this.drawEyes(segment[0], segment[1]);
            }
        }
        
        // Draw type indicator above head
        const head = this.getHead();
        if (head) {
            ctx.fillStyle = this.typeData.color;
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.typeData.name, head[0] + BLOCK_SIZE/2, head[1] - 5);
        }
    }
    
    drawEyes(x, y) {
        const eyeSize = 5;
        const pupilSize = 3;
        let eye1X, eye1Y, eye2X, eye2Y;
        
        if (this.dirX > 0) {
            eye1X = x + BLOCK_SIZE - 7; eye1Y = y + 4;
            eye2X = x + BLOCK_SIZE - 7; eye2Y = y + BLOCK_SIZE - 9;
        } else if (this.dirX < 0) {
            eye1X = x + 2; eye1Y = y + 4;
            eye2X = x + 2; eye2Y = y + BLOCK_SIZE - 9;
        } else if (this.dirY > 0) {
            eye1X = x + 4; eye1Y = y + BLOCK_SIZE - 7;
            eye2X = x + BLOCK_SIZE - 9; eye2Y = y + BLOCK_SIZE - 7;
        } else {
            eye1X = x + 4; eye1Y = y + 2;
            eye2X = x + BLOCK_SIZE - 9; eye2Y = y + 2;
        }
        
        // Red eyes for enemy
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(eye1X + eyeSize/2, eye1Y + eyeSize/2, eyeSize/2, 0, Math.PI * 2);
        ctx.arc(eye2X + eyeSize/2, eye2Y + eyeSize/2, eyeSize/2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(eye1X + eyeSize/2 + 0.5, eye1Y + eyeSize/2 + 0.5, pupilSize/2, 0, Math.PI * 2);
        ctx.arc(eye2X + eyeSize/2 + 0.5, eye2Y + eyeSize/2 + 0.5, pupilSize/2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Spawn a random enemy snake
function spawnEnemySnake() {
    console.log('spawnEnemySnake called. Current enemy:', enemySnake, 'alive:', enemySnake?.alive);
    if (enemySnake && enemySnake.alive) {
        console.log('Enemy already exists and alive, skipping spawn');
        return; // Only one enemy at a time
    }
    
    // Choose type based on spawn chances
    const roll = Math.random() * 100;
    let type;
    
    if (roll < ENEMY_TYPES.SMART.spawnChance) {
        type = 'SMART';
    } else if (roll < ENEMY_TYPES.SMART.spawnChance + ENEMY_TYPES.MEDIUM.spawnChance) {
        type = 'MEDIUM';
    } else {
        type = 'DUMB';
    }
    
    console.log('Creating enemy snake of type:', type, 'with length:', snakeLength);
    // Create enemy with player's current length
    enemySnake = new EnemySnake(type, snakeLength);
    console.log('Enemy snake created:', enemySnake);
}

// Update enemy bullets
function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;
        
        // Remove if out of bounds
        if (b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT) {
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // Check collision with player snake
        for (const seg of snake) {
            const dx = b.x - (seg[0] + BLOCK_SIZE/2);
            const dy = b.y - (seg[1] + BLOCK_SIZE/2);
            if (Math.sqrt(dx*dx + dy*dy) < BLOCK_SIZE/2) {
                // Player hit! Game over
                enemyBullets.splice(i, 1);
                endGame();
                return;
            }
        }
        
        // Check collision with targets (enemy can hit targets too)
        for (let j = targets.length - 1; j >= 0; j--) {
            if (checkLineCollision({x: b.x, y: b.y, vx: b.vx, vy: b.vy}, targets[j].x, targets[j].y, targets[j].getPixelSize())) {
                const t = targets[j];
                spawnParticles(t.x + t.getPixelSize()/2, t.y + t.getPixelSize()/2, 15, TARGET_TYPES[t.type].color);
                sound.playExplosion();
                
                // Enemy snake grows
                if (enemySnake && enemySnake.alive) {
                    enemySnake.length += TARGET_TYPES[t.type].points * t.gridSize;
                }
                
                targets.splice(j, 1);
                enemyBullets.splice(i, 1);
                break;
            }
        }
    }
}

// Draw enemy bullets
function drawEnemyBullets() {
    for (const b of enemyBullets) {
        // Glow
        ctx.fillStyle = `rgba(255, 100, 100, 0.6)`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(b.x - 1, b.y - 1, 2, 0, Math.PI * 2);
        ctx.fill();
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
    sound.stopAllMusic();
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
    newRecordThisGame = false;
    spacePressed = false;
    autoFireCooldown = 0;
    
    particles = [];
    bullets = [];
    targets = [];
    slowTargets = [];
    shrinkTargets = [];
    speedTargets = [];
    targetSpawnTimer = 0;
    
    // Reset enemy snake
    enemySnake = null;
    enemyBullets = [];
    enemySpawnTimer = 0;
    nextEnemySpawnTime = 120 + Math.floor(Math.random() * 60); // Random 10-15 seconds
    
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
    
    // Enemy snake collision
    if (enemySnake && enemySnake.alive && enemySnake.spawnAnimation <= 0) {
        for (const seg of enemySnake.segments) {
            if (seg[0] === snakeX && seg[1] === snakeY) {
                endGame();
                return;
            }
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
            newRecordThisGame = true;
            localStorage.setItem('fireSnakeHighScore', highScore.toString());
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
                    newRecordThisGame = true;
                    localStorage.setItem('fireSnakeHighScore', highScore.toString());
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
    
    // Enemy snake spawning (random interval 10-15 seconds)
    enemySpawnTimer++;
    
    // Debug: log timer progress every 60 frames (5 seconds)
    if (enemySpawnTimer % 60 === 0) {
        console.log('Enemy spawn timer:', enemySpawnTimer, '/', nextEnemySpawnTime, 'Enemy exists:', !!enemySnake);
    }
    
    if (enemySpawnTimer >= nextEnemySpawnTime) {
        console.log('>>> ENEMY SPAWN TRIGGERED! Timer:', enemySpawnTimer, 'Target:', nextEnemySpawnTime);
        spawnEnemySnake();
        enemySpawnTimer = 0;
        // Set next spawn time randomly between 10-15 seconds (120-180 frames)
        nextEnemySpawnTime = 120 + Math.floor(Math.random() * 60);
        console.log('>>> Next spawn time set to:', nextEnemySpawnTime);
    }
    
    // Update enemy snake
    if (enemySnake) {
        if (enemySnake.alive) {
            enemySnake.update();
        } else {
            // Remove dead enemy snake after a delay
            enemySnake = null;
        }
    }
    
    // Update enemy bullets
    updateEnemyBullets();
    
    // Check if player bullet hits enemy snake
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (enemySnake && enemySnake.alive) {
            for (const seg of enemySnake.segments) {
                const dx = bullets[i].x - (seg[0] + BLOCK_SIZE/2);
                const dy = bullets[i].y - (seg[1] + BLOCK_SIZE/2);
                if (Math.sqrt(dx*dx + dy*dy) < BLOCK_SIZE/2) {
                    // Hit enemy snake - kill it!
                    enemySnake.die();
                    bullets.splice(i, 1);
                    score += 5; // Bonus for killing enemy
                    if (score > highScore) {
                        highScore = score;
                        newRecordThisGame = true;
                        localStorage.setItem('fireSnakeHighScore', highScore.toString());
                    }
                    break;
                }
            }
        }
    }
    
    updateStats();
}

function endGame() {
    gameOver = true;
    sound.stopGameMusic();
    
    // Play appropriate game over music
    sound.playGameOverMusic(newRecordThisGame);
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
        
        // Draw enemy snake
        if (enemySnake && enemySnake.alive) {
            enemySnake.draw();
        }
        
        // Draw bullets
        for (const b of bullets) b.draw();
        drawEnemyBullets();
        
        for (const p of particles) p.draw();
        
        // Effect indicators
        if (slowdownTimer > 0) drawEffectBar(slowdownTimer, SLOWDOWN_DURATION, COLORS.slowTarget, 'SLOWED');
        if (speedupTimer > 0) drawEffectBar(speedupTimer, SPEEDUP_DURATION, COLORS.speedTarget, 'SPEED x2');
        
        // Enemy warning
        if (enemySnake && enemySnake.alive) {
            drawEnemyWarning();
        }
        
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

function drawEnemyWarning() {
    if (!enemySnake || !enemySnake.alive) return;
    
    const type = enemySnake.typeData;
    
    // Warning bar at top of screen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    roundRect(GAME_WIDTH / 2 - 100, 40, 200, 30, 8);
    
    ctx.fillStyle = type.color;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ENEMY: ${type.name.toUpperCase()} SNAKE ⚠`, GAME_WIDTH / 2, 60);
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

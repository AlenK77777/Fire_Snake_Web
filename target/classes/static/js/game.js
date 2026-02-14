// ==========================================
// FIRE SNAKE GAME - Web Version
// Port of the Java Swing game to HTML5 Canvas
// Version: 2.2.0 (Modular structure)
// ==========================================

// Import configuration and state
import {
    initCanvas, canvas, ctx,
    GAME_WIDTH, GAME_HEIGHT, BLOCK_SIZE,
    NORMAL_FPS, SLOW_FPS, FAST_FPS, INVINCIBILITY_DURATION,
    COLORS, TARGET_TYPES, ENEMY_TYPES,
    MAX_FOOD_ITEMS, FOOD_TIME_LIMIT, HEART_SPAWN_INTERVAL, HEART_LIFETIME,
    SLOWDOWN_DURATION, SPEEDUP_DURATION, AUTO_FIRE_DELAY,
    BULLET_SPEED, TARGET_SPAWN_INTERVAL
} from './game-config.js';

import { GameState } from './game-state.js';
import { hexToRgba, roundRect } from './game-utils.js';

// Initialize canvas - wait for DOM to be ready
let canvasInitialized = false;
function ensureCanvasInitialized() {
    if (!canvasInitialized) {
        try {
            initCanvas();
            if (canvas && ctx) {
                canvasInitialized = true;
                console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
            } else {
                console.error('Failed to initialize canvas! Canvas:', canvas, 'CTX:', ctx);
                return false;
            }
        } catch (error) {
            console.error('Error initializing canvas:', error);
            return false;
        }
    }
    return true;
}

// Force cache clear on load
if ('caches' in window) {
    caches.keys().then(function(names) {
        for (let name of names) {
            caches.delete(name);
        }
    });
}

// Log version to console for debugging
console.log('%cFire Snake Game v2.2.0 (Modular)', 'color: #00ff96; font-size: 16px; font-weight: bold;');
console.log('Target health system: 1 cell = 1 hit, 4 cells = 2 hits, 9 cells = 3 hits');
console.log('Cache cleared. Fresh version loaded at:', new Date().toLocaleString());

// Initialize high score from localStorage
GameState.highScore = parseInt(localStorage.getItem('fireSnakeHighScore') || '0');

// Session log: send events to server (logs/ folder, one file per session)
const LOG_SESSION_ID = '' + Date.now();
function logToServer(message) {
    try {
        fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: LOG_SESSION_ID, message })
        }).catch(() => {});
    } catch (_) {}
}

// Sound context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Create local aliases for easier access
// Arrays/Objects: direct reference (const snake = GameState.snake)
// Primitives: use GameState directly or create getters/setters
const snake = GameState.snake;
const foods = GameState.foods;
const hearts = GameState.hearts;
const bullets = GameState.bullets;
const targets = GameState.targets;
const slowTargets = GameState.slowTargets;
const shrinkTargets = GameState.shrinkTargets;
const speedTargets = GameState.speedTargets;
const particles = GameState.particles;
const stars = GameState.stars;
const enemyBullets = GameState.enemyBullets;

// For primitives, we'll use GameState directly throughout the code
// But create local variables for backward compatibility (they'll be synced manually)
// Note: This is a temporary solution - ideally all code should use GameState directly

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
        if (GameState.soundMuted) return;
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
        if (GameState.soundMuted) return;
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
        if (GameState.soundMuted) return;
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
                if (this.currentMusic === filePath && !GameState.soundMuted && this.isLooping) {
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
        if (GameState.soundMuted) return;
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
        if (GameState.soundMuted) return;
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
        if (GameState.soundMuted) return;
        
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
        GameState.soundMuted = muted;
        if (muted) {
            this.stopAllMusic();
        }
    }
    
    // Update music tempo based on snake length (for future use with custom music)
    updateMusicTempo(snakeLen) {
        // MIDI playback speed is controlled by the MIDI file itself
        // This is kept for compatibility but doesn't affect MIDI files
        const speedLevel = Math.floor(snakeLen / 10);
        GameState.musicTempo = 1.0 + (speedLevel * 0.1);
        if (GameState.musicTempo > 2.0) GameState.musicTempo = 2.0;
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
        if (!ctx) return; // Safety check
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
        if (!ctx) return; // Safety check
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
        if (!ctx) return; // Safety check
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
        // Health system: 1 cell = 1 hit, 4 cells (2x2) = 2 hits, 9 cells (3x3) = 3 hits
        this.health = gridSize;
        this.maxHealth = gridSize;
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
        if (!ctx) return; // Safety check
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
        
        // Health bar (shows remaining hits needed)
        if (this.maxHealth > 1) {
            const healthPercent = this.health / this.maxHealth;
            const healthBarWidth = totalSize * healthPercent;
            // Red for damaged, green for full health
            const healthColor = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
            ctx.fillStyle = hexToRgba(healthColor, 0.8 * alpha);
            ctx.fillRect(this.x, this.y + totalSize + 6, healthBarWidth, 3);
        }
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
        
        // Check if enemy eats food — one food object = one circle
        for (let i = foods.length - 1; i >= 0; i--) {
            const food = foods[i];
            if (!food.cells?.length) continue;
            const hit = food.cells.some(([dx, dy]) =>
                newX === food.x + dx * BLOCK_SIZE && newY === food.y + dy * BLOCK_SIZE
            );
            if (!hit) continue;
            this.length += 1;
            foods.splice(i, 1);
            if (foods.length === 0) spawnFoods();
            break;
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
        
        // Get all possible moves (can't reverse direction)
        const possibleMoves = [];
        if (this.dirX !== BLOCK_SIZE) possibleMoves.push([-BLOCK_SIZE, 0]);
        if (this.dirX !== -BLOCK_SIZE) possibleMoves.push([BLOCK_SIZE, 0]);
        if (this.dirY !== BLOCK_SIZE) possibleMoves.push([0, -BLOCK_SIZE]);
        if (this.dirY !== -BLOCK_SIZE) possibleMoves.push([0, BLOCK_SIZE]);
        
        // Filter to only safe moves
        const safeMoves = possibleMoves.filter(move => {
            const newX = head[0] + move[0];
            const newY = head[1] + move[1];
            return this.isSafePosition(newX, newY);
        });
        
        // If no safe moves, just continue (will die)
        if (safeMoves.length === 0) {
            return;
        }
        
        // Decide if making smart move or random safe move
        if (Math.random() < this.typeData.moveAccuracy) {
            // Smart move - try to get closer to player from safe moves
            let bestMove = safeMoves[0];
            let bestScore = -Infinity;
            
            for (const move of safeMoves) {
                const newX = head[0] + move[0];
                const newY = head[1] + move[1];
                
                // Score based on distance to player
                const distToPlayer = Math.abs(playerHead[0] - newX) + Math.abs(playerHead[1] - newY);
                const score = -distToPlayer; // Closer is better
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
            
            this.dirX = bestMove[0];
            this.dirY = bestMove[1];
        } else {
            // Random SAFE move
            const randomMove = safeMoves[Math.floor(Math.random() * safeMoves.length)];
            this.dirX = randomMove[0];
            this.dirY = randomMove[1];
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
        logToServer('Enemy died reason=' + reason + ' type=' + this.type);
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
    console.log('spawnEnemySnake called. Current enemy:', GameState.enemySnake, 'alive:', GameState.enemySnake?.alive);
    if (GameState.enemySnake && GameState.enemySnake.alive) {
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
    
    console.log('Creating enemy snake of type:', type, 'with length:', GameState.snakeLength);
    logToServer('Enemy spawned type=' + type + ' length=' + GameState.snakeLength);
    // Create enemy with player's current length
    GameState.enemySnake = new EnemySnake(type, GameState.snakeLength);
    console.log('Enemy snake created:', GameState.enemySnake);
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
        
        // CRITICAL: Skip collision checks during invincibility or if life was lost this frame
        if (GameState.invincibilityTimer > 0 || GameState.lifeLostThisFrame) {
            continue;
        }
        
        // Check collision with player snake
        // CRITICAL: Skip if snake array is empty (during respawn)
        if (snake.length > 0) {
            for (const seg of snake) {
                const dx = b.x - (seg[0] + BLOCK_SIZE/2);
                const dy = b.y - (seg[1] + BLOCK_SIZE/2);
                if (Math.sqrt(dx*dx + dy*dy) < BLOCK_SIZE/2) {
                    enemyBullets.splice(i, 1);
                    console.log('>>> Enemy bullet collision detected at:', b.x, b.y, 'Snake segment:', seg);
                    if (!loseLife()) {
                        endGame();
                    }
                    return;
                }
                // Check flags AFTER checking collision to break loop if life was lost
                if (GameState.lifeLostThisFrame || GameState.invincibilityTimer > 0) {
                    break;
                }
            }
        }
        
        // Check collision with targets (enemy can hit targets too)
        for (let j = targets.length - 1; j >= 0; j--) {
            if (checkLineCollision({x: b.x, y: b.y, vx: b.vx, vy: b.vy}, targets[j].x, targets[j].y, targets[j].getPixelSize())) {
                const t = targets[j];
                spawnParticles(t.x + t.getPixelSize()/2, t.y + t.getPixelSize()/2, 15, TARGET_TYPES[t.type].color);
                sound.playExplosion();
                
                // Enemy snake grows
                if (GameState.enemySnake && GameState.enemySnake.alive) {
                    GameState.enemySnake.length += TARGET_TYPES[t.type].points * t.gridSize;
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
// Helper functions (hexToRgba and roundRect imported from game-utils.js)
// ==========================================
function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// ==========================================
// GAME INITIALIZATION
// ==========================================
function initGame(resetLives = true) {
    // Stop all music
    sound.stopAllMusic();
    GameState.musicTempo = 1.0;
    
    snake.length = 0; // Clear array
    GameState.snakeLength = 1;
    
    GameState.snakeX = Math.floor(GAME_WIDTH / 2 / BLOCK_SIZE) * BLOCK_SIZE;
    GameState.snakeY = Math.floor(GAME_HEIGHT / 2 / BLOCK_SIZE) * BLOCK_SIZE;
    GameState.dirX = 0;
    GameState.dirY = 0;
    GameState.nextDirX = 0;
    GameState.nextDirY = 0;
    
    // Add initial snake segment so it's visible from the start
    snake.push([GameState.snakeX, GameState.snakeY]);
    
    // Reset lives only on full reset
    if (resetLives) {
        GameState.lives = 3;
    }
    
    // Clear and spawn new food items
    foods.length = 0;
    spawnFoods();
    
    // Clear hearts
    hearts.length = 0;
    GameState.heartSpawnTimer = 0;
    
    GameState.score = 0;
    GameState.targetsHit = 0;
    GameState.totalShots = 0;
    GameState.foodEaten = 0;
    GameState.slowdownTimer = 0;
    GameState.speedupTimer = 0;
    GameState.currentFPS = NORMAL_FPS;
    GameState.frameInterval = 1000 / GameState.currentFPS;
    
    GameState.gameOver = false;
    GameState.gameStarted = false;
    GameState.newRecordThisGame = false;
    GameState.spacePressed = false;
    GameState.autoFireCooldown = 0;
    GameState.invincibilityTimer = 0; // Reset invincibility
    GameState.lifeLostThisFrame = false; // Reset life loss flag

    // Edges disappear: next disappearance in 10–30 sec (at 12 FPS)
    GameState.edgesState = 'normal';
    GameState.edgesNextDisappearInFrames = 10 * NORMAL_FPS + Math.floor(Math.random() * (21 * NORMAL_FPS)); // 10–30 sec
    GameState.edgesWarningFramesLeft = 0;
    GameState.edgesGoneFramesLeft = 0;
    GameState.edgesGoneDurationFrames = 0;
    
    particles.length = 0;
    bullets.length = 0;
    targets.length = 0;
    slowTargets.length = 0;
    shrinkTargets.length = 0;
    speedTargets.length = 0;
    GameState.targetSpawnTimer = 0;
    
    // Reset enemy snake
    GameState.enemySnake = null;
    enemyBullets.length = 0;
    GameState.enemySpawnTimer = 0;
    GameState.nextEnemySpawnTime = 120 + Math.floor(Math.random() * 60); // Random 10-15 seconds
    
    updateStats();
    updateLivesDisplay();
    
    // Start menu music if user has interacted
    if (GameState.userHasInteracted && !GameState.soundMuted) {
        sound.playMenuMusic();
    }
}

// Start the actual gameplay
function startGame() {
    // Show loading screen before transitioning to game
    showLoadingScreen();
    
    // Start game music IMMEDIATELY during loading to overcome delay
    sound.stopMenuMusic();
    if (!GameState.soundMuted) {
        sound.playGameMusic();
    }
    
    setTimeout(() => {
        GameState.gameStarted = true;
        hideLoadingScreen();
        logToServer('Game started — score=0 length=' + GameState.snakeLength + ' lives=' + GameState.lives);
    }, 2000);
}

// Check if a position overlaps with any existing game objects
function isPositionOccupied(x, y, size = 1) {
    const checkCells = [];
    for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) {
            checkCells.push([x + dx * BLOCK_SIZE, y + dy * BLOCK_SIZE]);
        }
    }
    
    // Check snake
    for (const cell of checkCells) {
        for (const seg of snake) {
            if (seg[0] === cell[0] && seg[1] === cell[1]) return true;
        }
    }
    
    // Check existing foods (cells-based Tetris shapes)
    for (const food of foods) {
        const cells = food.cells || (function(){ const s=food.size||1; const c=[]; for(let fx=0;fx<s;fx++) for(let fy=0;fy<s;fy++) c.push([fx,fy]); return c; })();
        for (const cell of checkCells) {
            for (const [dx, dy] of cells) {
                if (food.x + dx * BLOCK_SIZE === cell[0] && food.y + dy * BLOCK_SIZE === cell[1]) return true;
            }
        }
    }
    
    // Check hearts
    for (const heart of hearts) {
        for (const cell of checkCells) {
            if (heart.x === cell[0] && heart.y === cell[1]) return true;
        }
    }
    
    // Check targets
    for (const t of targets) {
        for (const cell of checkCells) {
            if (t.occupiesCell(cell[0], cell[1])) return true;
        }
    }
    for (const t of slowTargets) {
        for (const cell of checkCells) {
            if (t.occupiesCell(cell[0], cell[1])) return true;
        }
    }
    for (const t of shrinkTargets) {
        for (const cell of checkCells) {
            if (t.occupiesCell(cell[0], cell[1])) return true;
        }
    }
    for (const t of speedTargets) {
        for (const cell of checkCells) {
            if (t.occupiesCell(cell[0], cell[1])) return true;
        }
    }
    
    return false;
}

// Spawn multiple food items with varying sizes
function spawnFoods() {
    const numFoods = 1 + Math.floor(Math.random() * MAX_FOOD_ITEMS); // 1-5 foods
    
    for (let i = 0; i < numFoods; i++) {
        spawnSingleFood();
    }
}

// Generate a random Tetris-like shape (connected cells), 1-9 cells
function generateTetrisShape() {
    const numCells = 1 + Math.floor(Math.random() * 9); // 1 to 9
    const set = new Set();
    set.add('0,0');
    const neighbors = (a, b) => [[a-1,b],[a+1,b],[a,b-1],[a,b+1]];
    
    while (set.size < numCells) {
        const entries = Array.from(set);
        const pick = entries[Math.floor(Math.random() * entries.length)].split(',').map(Number);
        const adj = neighbors(pick[0], pick[1]);
        const empty = adj.filter(([x,y]) => !set.has(x+','+y));
        if (empty.length === 0) break;
        const [nx, ny] = empty[Math.floor(Math.random() * empty.length)];
        set.add(nx+','+ny);
    }
    
    const cells = Array.from(set).map(s => s.split(',').map(Number));
    const minX = Math.min(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    const normalized = cells.map(([a, b]) => [a - minX, b - minY]);
    const w = Math.max(...normalized.map(c => c[0])) + 1;
    const h = Math.max(...normalized.map(c => c[1])) + 1;
    return { cells: normalized, width: w, height: h };
}

function spawnSingleFood() {
    const shape = generateTetrisShape();
    const w = shape.width;
    const h = shape.height;
    
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        const maxX = Math.floor((GAME_WIDTH - BLOCK_SIZE * (w + 1)) / BLOCK_SIZE);
        const maxY = Math.floor((GAME_HEIGHT - BLOCK_SIZE * (h + 1)) / BLOCK_SIZE);
        const baseX = (Math.floor(Math.random() * Math.max(1, maxX)) + 1) * BLOCK_SIZE;
        const baseY = (Math.floor(Math.random() * Math.max(1, maxY)) + 1) * BLOCK_SIZE;
        
        if (!isPositionOccupiedForShape(baseX, baseY, shape.cells)) {
            const timer = FOOD_TIME_LIMIT + Math.random() * 60;
            // One food object per cell — eating removes only that circle
            for (const [dx, dy] of shape.cells) {
                foods.push({
                    x: baseX + dx * BLOCK_SIZE,
                    y: baseY + dy * BLOCK_SIZE,
                    cells: [[0, 0]],
                    timer,
                    pulse: Math.random() * Math.PI * 2
                });
            }
            return;
        }
        attempts++;
    }
}

function isPositionOccupiedForShape(baseX, baseY, cells) {
    for (const [dx, dy] of cells) {
        const cx = baseX + dx * BLOCK_SIZE;
        const cy = baseY + dy * BLOCK_SIZE;
        if (isPositionOccupied(cx, cy, 1)) return true;
    }
    return false;
}

// Spawn a heart pickup (extra life)
function spawnHeart() {
    // Only one heart on screen at a time
    if (hearts.length > 0) return;
    
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        const x = (Math.floor(Math.random() * ((GAME_WIDTH - BLOCK_SIZE * 2) / BLOCK_SIZE)) + 1) * BLOCK_SIZE;
        const y = (Math.floor(Math.random() * ((GAME_HEIGHT - BLOCK_SIZE * 2) / BLOCK_SIZE)) + 1) * BLOCK_SIZE;
        
        if (!isPositionOccupied(x, y, 1)) {
            hearts.push({
                x: x,
                y: y,
                timer: HEART_LIFETIME, // 5 seconds at 12 FPS
                pulse: 0
            });
            return;
        }
        attempts++;
    }
}

// Update lives display in HTML
function updateLivesDisplay() {
    const livesDisplay = document.getElementById('livesDisplay');
    if (livesDisplay) {
        let html = '';
        // Show all current lives (no limit)
        for (let i = 0; i < GameState.lives; i++) {
            html += '<span class="heart">❤</span>';
        }
        // If no lives, show empty hearts for visual feedback
        if (GameState.lives === 0) {
            html = '<span class="heart lost">❤</span>';
        }
        livesDisplay.innerHTML = html;
    }
}

// Lose a life (returns true if game should continue, false if game over)
// Find safe respawn position (maximally distant from death location)
function findSafeRespawnPosition(deathX, deathY) {
    let bestX = GAME_WIDTH / 2;
    let bestY = GAME_HEIGHT / 2;
    let maxDistance = 0;
    
    // Try multiple positions and find the one farthest from death location
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
        const testX = (Math.floor(Math.random() * ((GAME_WIDTH - BLOCK_SIZE * 4) / BLOCK_SIZE)) + 2) * BLOCK_SIZE;
        const testY = (Math.floor(Math.random() * ((GAME_HEIGHT - BLOCK_SIZE * 4) / BLOCK_SIZE)) + 2) * BLOCK_SIZE;
        
        // Calculate distance from death location
        const dx = testX - deathX;
        const dy = testY - deathY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if position is safe (not occupied)
        if (!isPositionOccupied(testX, testY, 1) && distance > maxDistance) {
            maxDistance = distance;
            bestX = testX;
            bestY = testY;
        }
    }
    
    // If no safe position found, try center
    if (isPositionOccupied(bestX, bestY, 1)) {
        bestX = Math.floor(GAME_WIDTH / 2 / BLOCK_SIZE) * BLOCK_SIZE;
        bestY = Math.floor(GAME_HEIGHT / 2 / BLOCK_SIZE) * BLOCK_SIZE;
    }
    
    return [bestX, bestY];
}

function loseLife() {
    // CRITICAL: Check invincibility FIRST - before any other checks
    if (GameState.invincibilityTimer > 0) {
        console.log('>>> loseLife() blocked: invincibility active, timer:', GameState.invincibilityTimer);
        return GameState.lives > 0;
    }
    
    // Prevent multiple calls in the same frame - CRITICAL CHECK
    // This MUST be checked IMMEDIATELY and flags set IMMEDIATELY
    if (GameState.lifeLostThisFrame) {
        console.log('>>> loseLife() blocked: life already lost this frame');
        return GameState.lives > 0;
    }
    
    // Prevent losing life if already game over or no lives left
    if (GameState.lives <= 0 || GameState.gameOver) {
        console.log('>>> loseLife() blocked: no lives left or game over');
        return false;
    }
    
    // ATOMIC OPERATION: Set flags IMMEDIATELY as the VERY FIRST thing
    // This prevents any other calls to loseLife() in the same frame
    // Set BOTH flags before doing anything else
    GameState.lifeLostThisFrame = true;
    GameState.invincibilityTimer = INVINCIBILITY_DURATION;
    
    console.log('>>> loseLife() EXECUTING - setting flags. Invincibility:', GameState.invincibilityTimer);
    
    GameState.lives--;
    updateLivesDisplay();
    
    console.log('>>> Life lost! Remaining lives:', GameState.lives, 'Invincibility started:', GameState.invincibilityTimer, 'Snake length:', GameState.snakeLength);
    logToServer('Life lost — remaining lives=' + GameState.lives + ' invincibility=48 snakeLength=' + GameState.snakeLength);

    if (GameState.lives <= 0) {
        GameState.invincibilityTimer = 0; // Clear invincibility if game over
        return false; // Game over
    }
    
    // CLEAR ALL OBJECTS ON SCREEN to prevent immediate collisions
    // This is the key fix: remove everything that could collide with respawned snake
    targets.length = 0;
    slowTargets.length = 0;
    shrinkTargets.length = 0;
    speedTargets.length = 0;
    foods.length = 0;
    hearts.length = 0;
    bullets.length = 0;
    enemyBullets.length = 0;
    GameState.enemySnake = null;
    particles.length = 0;
    
    // Reset enemy spawn timer to give player time before next enemy
    GameState.enemySpawnTimer = 0;
    GameState.nextEnemySpawnTime = 60; // 5 seconds before first enemy spawns
    
    // Reset timers
    GameState.slowdownTimer = 0;
    GameState.speedupTimer = 0;
    GameState.currentFPS = NORMAL_FPS;
    GameState.frameInterval = 1000 / GameState.currentFPS;
    
    // IMMEDIATELY clear snake to prevent further collisions
    snake.length = 0;
    // Reset to minimum length to avoid self-collision issues
    GameState.snakeLength = 1;
    
    // Respawn snake in the CENTER of the screen
    GameState.snakeX = Math.floor(GAME_WIDTH / 2 / BLOCK_SIZE) * BLOCK_SIZE;
    GameState.snakeY = Math.floor(GAME_HEIGHT / 2 / BLOCK_SIZE) * BLOCK_SIZE;
    
    // CRITICAL: Reset all movement to zero to prevent any movement during invincibility
    GameState.dirX = 0;
    GameState.dirY = 0;
    
    // Set a random default direction immediately so the arrow can be shown and snake won't crash into itself
    const directions = [
        {x: 0, y: -BLOCK_SIZE},  // Up
        {x: 0, y: BLOCK_SIZE},  // Down
        {x: -BLOCK_SIZE, y: 0}, // Left
        {x: BLOCK_SIZE, y: 0}   // Right
    ];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    GameState.nextDirX = randomDir.x;
    GameState.nextDirY = randomDir.y;
    
    // CRITICAL: Don't add any segments to snake array yet
    // snake array stays empty until first movement after invincibility
    
    console.log('>>> Snake respawned at:', GameState.snakeX, GameState.snakeY, 'Length:', GameState.snakeLength, 'Invincibility:', GameState.invincibilityTimer, 'Snake segments:', snake.length, 'Lives:', GameState.lives);
    logToServer('Snake respawned at ' + GameState.snakeX + ',' + GameState.snakeY + ' length=' + GameState.snakeLength + ' lives=' + GameState.lives);
    
    // CRITICAL: Ensure snake cannot collide with anything immediately after respawn
    // All objects are cleared, snake array is empty, invincibility is set
    // This should prevent any immediate collisions
    
    // Brief invincibility visual effect
    spawnParticles(GameState.snakeX + BLOCK_SIZE/2, GameState.snakeY + BLOCK_SIZE/2, 30, '#ff3264');
    sound.playPowerUp();
    
    // Return true to continue game - snake is now safely respawned
    return true; // Continue game
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
    // Check boundaries
    if (tx < BLOCK_SIZE || tx + gridSize * BLOCK_SIZE >= GAME_WIDTH - BLOCK_SIZE ||
        ty < BLOCK_SIZE || ty + gridSize * BLOCK_SIZE >= GAME_HEIGHT - BLOCK_SIZE) {
        return false;
    }
    
    // Use isPositionOccupied to check all objects (snake, foods, hearts, targets, enemy snake)
    if (isPositionOccupied(tx, ty, gridSize)) {
        return false;
    }
    
    // Also check enemy snake if it exists
    if (GameState.enemySnake && GameState.enemySnake.alive) {
        for (let dx = 0; dx < gridSize; dx++) {
            for (let dy = 0; dy < gridSize; dy++) {
                const cellX = tx + dx * BLOCK_SIZE;
                const cellY = ty + dy * BLOCK_SIZE;
                for (const seg of GameState.enemySnake.segments) {
                    if (seg[0] === cellX && seg[1] === cellY) return false;
                }
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
    if (!GameState.gameStarted || GameState.gameOver) return;
    if (snake.length === 0) return;
    
    const head = snake[snake.length - 1];
    const startX = head[0] + BLOCK_SIZE / 2;
    const startY = head[1] + BLOCK_SIZE / 2;
    
    let shootDirX = GameState.dirX;
    let shootDirY = GameState.dirY;
    
    if (shootDirX === 0 && shootDirY === 0) {
        shootDirY = -BLOCK_SIZE;
    }
    
    bullets.push(new Bullet(startX, startY, shootDirX, shootDirY));
    GameState.totalShots++;
    sound.playShoot();
}

function activateSlowdown() {
    GameState.slowdownTimer = SLOWDOWN_DURATION;
    GameState.speedupTimer = 0;
    GameState.currentFPS = SLOW_FPS;
    GameState.frameInterval = 1000 / GameState.currentFPS;
    sound.playPowerUp();
}

function activateSpeedup() {
    GameState.speedupTimer = SPEEDUP_DURATION;
    GameState.slowdownTimer = 0;
    GameState.currentFPS = FAST_FPS;
    GameState.frameInterval = 1000 / GameState.currentFPS;
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
    document.getElementById('scoreValue').textContent = GameState.score;
    document.getElementById('highScoreValue').textContent = GameState.highScore;
    document.getElementById('lengthValue').textContent = GameState.snakeLength;
    document.getElementById('targetsValue').textContent = GameState.targetsHit;
}

// ==========================================
// GAME UPDATE
// ==========================================
// Edges disappear: random 5–20 sec gone, 10–30 sec between (frames at NORMAL_FPS)
function tickEdgesState() {
    const FPS = NORMAL_FPS;
    if (GameState.edgesState === 'normal') {
        GameState.edgesNextDisappearInFrames--;
        if (GameState.edgesNextDisappearInFrames <= 0) {
            GameState.edgesState = 'warning';
            GameState.edgesWarningFramesLeft = 3 * FPS; // 3 sec warning
            GameState.edgesGoneDurationFrames = 5 * FPS + Math.floor(Math.random() * (16 * FPS)); // 5–20 sec
        }
    } else if (GameState.edgesState === 'warning') {
        GameState.edgesWarningFramesLeft--;
        if (GameState.edgesWarningFramesLeft <= 0) {
            GameState.edgesState = 'gone';
            GameState.edgesGoneFramesLeft = GameState.edgesGoneDurationFrames;
        }
    } else if (GameState.edgesState === 'gone') {
        GameState.edgesGoneFramesLeft--;
        if (GameState.edgesGoneFramesLeft <= 0) {
            GameState.edgesState = 'normal';
            GameState.edgesNextDisappearInFrames = 10 * FPS + Math.floor(Math.random() * (21 * FPS)); // 10–30 sec
        }
    }
}

function update() {
    if (GameState.gameOver || !GameState.gameStarted) return;

    tickEdgesState();
    
    // CRITICAL: Check invincibility FIRST - skip ALL updates during invincibility
    const wasInvincible = GameState.invincibilityTimer > 0;
    if (GameState.invincibilityTimer > 0) {
        GameState.invincibilityTimer--;
        // During invincibility: DON'T update anything (no movement, no collisions, no other game logic)
        // Snake should already be fully respawned - just blink visually
        return;
    }
    
    // Direction was already set in loseLife() (random) or by player; no need to set again here
    
    // Reset life loss flag at start of each frame (BEFORE any collision checks)
    // This ensures we can detect collisions, but only lose one life per frame
    const wasLifeLostLastFrame = GameState.lifeLostThisFrame;
    GameState.lifeLostThisFrame = false;
    
    // If life was lost last frame, skip collision checks this frame to prevent immediate re-collision
    if (wasLifeLostLastFrame) {
        // Still update direction and other game mechanics, but skip collision detection
        GameState.dirX = GameState.nextDirX;
        GameState.dirY = GameState.nextDirY;
        return;
    }
    
    // Update direction (invincibility already checked above, so we're safe here)
    GameState.dirX = GameState.nextDirX;
    GameState.dirY = GameState.nextDirY;
    
    // Auto-fire
    if (GameState.spacePressed) {
        GameState.autoFireCooldown--;
        if (GameState.autoFireCooldown <= 0) {
            shoot();
            GameState.autoFireCooldown = AUTO_FIRE_DELAY;
        }
    }
    
    // CRITICAL: Check invincibility BEFORE any movement or collision checks
    if (GameState.invincibilityTimer > 0) {
        return; // Skip all updates during invincibility
    }
    
    // CRITICAL: Check if life was already lost this frame BEFORE any updates
    if (GameState.lifeLostThisFrame) {
        return; // Skip all updates if life was already lost
    }
    
    // Move snake
    GameState.snakeX += GameState.dirX;
    GameState.snakeY += GameState.dirY;
    
    const outOfBounds = GameState.snakeX < 0 || GameState.snakeX >= GAME_WIDTH || GameState.snakeY < 0 || GameState.snakeY >= GAME_HEIGHT;
    if (outOfBounds) {
        if (GameState.edgesState === 'gone') {
            // Wrap: exit one edge → appear on opposite
            if (GameState.snakeX < 0) GameState.snakeX += GAME_WIDTH;
            else if (GameState.snakeX >= GAME_WIDTH) GameState.snakeX -= GAME_WIDTH;
            if (GameState.snakeY < 0) GameState.snakeY += GAME_HEIGHT;
            else if (GameState.snakeY >= GAME_HEIGHT) GameState.snakeY -= GAME_HEIGHT;
        } else {
            // Walls active — lose life
            if (GameState.invincibilityTimer === 0) {
                if (!loseLife()) endGame();
                return;
            }
        }
    }
    
    // Add new head to snake
    snake.push([GameState.snakeX, GameState.snakeY]);
    
    // Self collision (check BEFORE removing tail) - skip during invincibility
    // CRITICAL: Also skip if snake array was empty before adding head (first movement after respawn)
    if (GameState.invincibilityTimer === 0 && snake.length > 1) {
        // Only check self-collision if snake has more than 1 segment
        // If snake was empty and we just added first segment, no self-collision possible
        for (let i = 0; i < snake.length - 1; i++) {
            if (snake[i][0] === GameState.snakeX && snake[i][1] === GameState.snakeY) {
                console.log('>>> Self-collision detected at:', GameState.snakeX, GameState.snakeY, 'Snake length:', snake.length);
                if (!loseLife()) {
                    endGame();
                }
                return;
            }
        }
    }
    
    // Remove tail if too long
    while (snake.length > GameState.snakeLength) {
        snake.shift();
    }
    
    // Target collision (dangerous squares) - check AFTER movement - skip during invincibility
    if (GameState.invincibilityTimer === 0) {
        for (const t of targets) {
            if (t.isActive() && t.occupiesCell(GameState.snakeX, GameState.snakeY)) {
                if (!loseLife()) {
                    endGame();
                }
                return;
            }
        }
    }
    
    // Enemy snake collision - check AFTER movement - skip during invincibility
    if (GameState.invincibilityTimer === 0 && GameState.enemySnake && GameState.enemySnake.alive && GameState.enemySnake.spawnAnimation <= 0) {
        for (const seg of GameState.enemySnake.segments) {
            if (seg[0] === GameState.snakeX && seg[1] === GameState.snakeY) {
                if (!loseLife()) {
                    endGame();
                }
                return;
            }
        }
    }
    
    // Food collision — each food object is ONE circle; remove only the one hit
    for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        const hit = food.cells && food.cells.some(([dx, dy]) =>
            GameState.snakeX === food.x + dx * BLOCK_SIZE &&
            GameState.snakeY === food.y + dy * BLOCK_SIZE
        );
        if (!hit) continue;
        GameState.snakeLength += 1;
        GameState.foodEaten++;
        GameState.score += 1;
        sound.updateMusicTempo(GameState.snakeLength);
        if (GameState.score > GameState.highScore) {
            GameState.highScore = GameState.score;
            GameState.newRecordThisGame = true;
            localStorage.setItem('fireSnakeHighScore', GameState.highScore.toString());
        }
        sound.playEat();
        spawnParticles(food.x + BLOCK_SIZE / 2, food.y + BLOCK_SIZE / 2, 5, COLORS.food);
        logToServer('Food eaten — score=' + GameState.score + ' length=' + GameState.snakeLength);
        foods.splice(i, 1); // remove this one food object (one circle)
        break;
    }
    
    // Heart collision (extra life pickup)
    for (let i = hearts.length - 1; i >= 0; i--) {
        if (GameState.snakeX === hearts[i].x && GameState.snakeY === hearts[i].y) {
            GameState.lives++; // No limit on lives!
            updateLivesDisplay();
            GameState.score += 5; // Bonus for collecting heart
            sound.playPowerUp();
            spawnParticles(hearts[i].x + BLOCK_SIZE/2, hearts[i].y + BLOCK_SIZE/2, 20, '#ff3264');
            hearts.splice(i, 1);
        }
    }
    
    // Remove tail if too long
    while (snake.length > GameState.snakeLength) {
        snake.shift();
    }
    
    // Spawn more food if needed
    if (foods.length === 0) {
        spawnFoods();
    }
    
    // Update food timers and remove expired food
    for (let i = foods.length - 1; i >= 0; i--) {
        foods[i].timer--;
        foods[i].pulse += 0.1;
        if (foods[i].timer <= 0) {
            foods.splice(i, 1);
        }
    }
    
    // Spawn more food if all expired
    if (foods.length === 0) {
        spawnFoods();
    }
    
    // Update heart timers
    for (let i = hearts.length - 1; i >= 0; i--) {
        hearts[i].timer--;
        hearts[i].pulse += 0.15;
        if (hearts[i].timer <= 0) {
            hearts.splice(i, 1);
        }
    }
    
    // Heart spawn timer
    GameState.heartSpawnTimer++;
    if (GameState.heartSpawnTimer >= HEART_SPAWN_INTERVAL) {
        GameState.heartSpawnTimer = 0;
        spawnHeart(); // Only spawns if no heart exists (checked in function)
    }
    
    // Update timers
    if (GameState.slowdownTimer > 0) {
        GameState.slowdownTimer--;
        if (GameState.slowdownTimer === 0) {
            GameState.currentFPS = NORMAL_FPS;
            GameState.frameInterval = 1000 / GameState.currentFPS;
        }
    }
    if (GameState.speedupTimer > 0) {
        GameState.speedupTimer--;
        if (GameState.speedupTimer === 0) {
            GameState.currentFPS = NORMAL_FPS;
            GameState.frameInterval = 1000 / GameState.currentFPS;
        }
    }
    
    // Target spawning
    GameState.targetSpawnTimer++;
    if (GameState.targetSpawnTimer >= TARGET_SPAWN_INTERVAL) {
        spawnTargets();
        GameState.targetSpawnTimer = 0;
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
        
        // Check if player bullet hits enemy snake FIRST (before other collisions)
        // Enemy snake should die if hit in ANY part of body (head or tail)
        if (GameState.enemySnake && GameState.enemySnake.alive) {
            for (const seg of GameState.enemySnake.segments) {
                const dx = bullets[i].x - (seg[0] + BLOCK_SIZE/2);
                const dy = bullets[i].y - (seg[1] + BLOCK_SIZE/2);
                if (Math.sqrt(dx*dx + dy*dy) < BLOCK_SIZE/2) {
                    // Hit enemy snake in ANY segment - kill it!
                    // Points based on enemy type: DUMB=1, MEDIUM=5, SMART=10
                    let killPoints = 1;
                    if (GameState.enemySnake.type === 'MEDIUM') killPoints = 5;
                    else if (GameState.enemySnake.type === 'SMART') killPoints = 10;
                    
                    GameState.enemySnake.die('shot_by_player');
                    bullets.splice(i, 1);
                    GameState.score += killPoints;
                    if (GameState.score > GameState.highScore) {
                        GameState.highScore = GameState.score;
                        GameState.newRecordThisGame = true;
                        localStorage.setItem('fireSnakeHighScore', GameState.highScore.toString());
                    }
                    bulletHit = true;
                    break;
                }
            }
        }
        
        if (bulletHit) continue;
        
        // Dangerous targets - require multiple hits based on size
        for (let j = targets.length - 1; j >= 0; j--) {
            if (checkLineCollision(bullets[i], targets[j].x, targets[j].y, targets[j].getPixelSize())) {
                const t = targets[j];
                const centerX = t.x + t.getPixelSize() / 2;
                const centerY = t.y + t.getPixelSize() / 2;
                
                // Reduce health on hit
                t.health--;
                bullets.splice(i, 1);
                bulletHit = true;
                
                // Visual feedback for hit
                spawnParticles(centerX, centerY, 10 * t.gridSize, TARGET_TYPES[t.type].color);
                sound.playExplosion();
                
                // Only destroy target when health reaches 0
                if (t.health <= 0) {
                    // Target destroyed - give rewards
                    spawnParticles(centerX, centerY, 20 * t.gridSize, TARGET_TYPES[t.type].color);
                    GameState.score += TARGET_TYPES[t.type].points * t.gridSize;
                    GameState.snakeLength += TARGET_TYPES[t.type].points * t.gridSize;
                    // Update music tempo based on snake length
                    sound.updateMusicTempo(GameState.snakeLength);
                    if (GameState.score > GameState.highScore) {
                        GameState.highScore = GameState.score;
                        GameState.newRecordThisGame = true;
                        localStorage.setItem('fireSnakeHighScore', GameState.highScore.toString());
                    }
                    GameState.targetsHit++;
                    targets.splice(j, 1);
                    logToServer('Target destroyed type=' + t.type + ' targetsHit=' + GameState.targetsHit + ' score=' + GameState.score);
                }
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
                GameState.targetsHit++;
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
                GameState.snakeLength = Math.max(1, Math.floor(GameState.snakeLength / 2));
                while (snake.length > GameState.snakeLength) {
                    snake.shift();
                }
                GameState.targetsHit++;
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
                GameState.targetsHit++;
                speedTargets.splice(j, 1);
                bullets.splice(i, 1);
                bulletHit = true;
                break;
            }
        }
        
        if (bulletHit) continue;
        
        // Food collision — bullet hits one circle (one food object)
        for (let j = foods.length - 1; j >= 0; j--) {
            const food = foods[j];
            if (!food.cells?.length) continue;
            for (const [dx, dy] of food.cells) {
                const cellX = food.x + dx * BLOCK_SIZE;
                const cellY = food.y + dy * BLOCK_SIZE;
                if (checkLineCollision(bullets[i], cellX, cellY, BLOCK_SIZE)) {
                    bullets.splice(i, 1);
                    foods.splice(j, 1);
                    if (!loseLife()) endGame();
                    bulletHit = true;
                    break;
                }
            }
            if (bulletHit) break;
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
    GameState.enemySpawnTimer++;
    
    // Debug: log timer progress every 60 frames (5 seconds)
    if (GameState.enemySpawnTimer % 60 === 0) {
        console.log('Enemy spawn timer:', GameState.enemySpawnTimer, '/', GameState.nextEnemySpawnTime, 'Enemy exists:', !!GameState.enemySnake);
    }
    
    if (GameState.enemySpawnTimer >= GameState.nextEnemySpawnTime) {
        console.log('>>> ENEMY SPAWN TRIGGERED! Timer:', GameState.enemySpawnTimer, 'Target:', GameState.nextEnemySpawnTime);
        spawnEnemySnake();
        GameState.enemySpawnTimer = 0;
        // Set next spawn time randomly between 10-15 seconds (120-180 frames)
        GameState.nextEnemySpawnTime = 120 + Math.floor(Math.random() * 60);
        console.log('>>> Next spawn time set to:', GameState.nextEnemySpawnTime);
    }
    
    // Update enemy snake
    if (GameState.enemySnake) {
        if (GameState.enemySnake.alive) {
            GameState.enemySnake.update();
        } else {
            // Remove dead enemy snake after a delay
            GameState.enemySnake = null;
        }
    }
    
    // Update enemy bullets (only if not in invincibility)
    // Note: bullets still move, but collision checks are skipped in updateEnemyBullets()
    updateEnemyBullets();
    
    // Note: Enemy snake collision with bullets is now checked in the bullet update loop above
    // This ensures enemy snake dies when hit in ANY part of body (head or tail)
    
    updateStats();
}

function endGame() {
    // Prevent multiple calls to endGame()
    if (GameState.gameOver) {
        console.log('>>> endGame() called but game already over, ignoring');
        return;
    }
    
    // Mark game as over immediately to prevent further updates
    GameState.gameOver = true;
    logToServer('Game over — score=' + GameState.score + ' length=' + GameState.snakeLength + ' lives=' + GameState.lives + ' highScore=' + GameState.highScore + ' foodEaten=' + (GameState.foodEaten || 0) + ' targetsHit=' + (GameState.targetsHit || 0));

    // Show loading screen before transitioning to game over
    showLoadingScreen();
    
    // Stop game music and start game over music IMMEDIATELY during loading
    sound.stopGameMusic();
    if (!GameState.soundMuted) {
        sound.playGameOverMusic(GameState.newRecordThisGame);
    }
    
    setTimeout(() => {
        hideLoadingScreen();
    }, 2000);
}

// ==========================================
// DRAWING
// ==========================================
function draw() {
    if (!ctx || !canvas) {
        console.error('Cannot draw: canvas or ctx not initialized');
        return;
    }
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
    
    // Border (dim/dashed when edges are gone)
    let borderColor = '#00ff96';
    if (GameState.speedupTimer > 0) borderColor = COLORS.speedTarget;
    else if (GameState.slowdownTimer > 0) borderColor = COLORS.slowTarget;
    const edgesGone = GameState.edgesState === 'gone';
    if (edgesGone) {
        ctx.setLineDash([8, 8]);
        borderColor = '#ffaa00';
    }
    ctx.strokeStyle = hexToRgba(borderColor, edgesGone ? 0.5 : 0.4);
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);
    ctx.strokeStyle = hexToRgba(borderColor, edgesGone ? 0.6 : 0.8);
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);
    if (edgesGone) ctx.setLineDash([]);
    
    if (GameState.gameOver) {
        drawGameOver();
    } else if (!GameState.gameStarted) {
        drawStartScreen();
        drawFood();
        // Draw snake with blinking effect during invincibility
        if (GameState.invincibilityTimer > 0) {
            // Blink effect: draw every other frame
            if (Math.floor(GameState.invincibilityTimer / 3) % 2 === 0) {
                drawSnake();
            }
        } else {
            drawSnake();
        }
    } else {
        // Draw game objects
        for (const t of targets) t.draw();
        for (const st of slowTargets) st.draw();
        for (const sht of shrinkTargets) sht.draw();
        for (const spt of speedTargets) spt.draw();
        drawFood();
        // Draw snake with blinking effect during invincibility
        if (GameState.invincibilityTimer > 0) {
            // Blink effect: draw every other frame
            if (Math.floor(GameState.invincibilityTimer / 3) % 2 === 0) {
                drawSnake();
            }
        } else {
            drawSnake();
        }
        
        // Draw enemy snake
        if (GameState.enemySnake && GameState.enemySnake.alive) {
            GameState.enemySnake.draw();
        }
        
        // Draw bullets
        for (const b of bullets) b.draw();
        drawEnemyBullets();
        
        for (const p of particles) p.draw();
        
        // Effect indicators
        if (GameState.slowdownTimer > 0) drawEffectBar(GameState.slowdownTimer, SLOWDOWN_DURATION, COLORS.slowTarget, 'SLOWED');
        if (GameState.speedupTimer > 0) drawEffectBar(GameState.speedupTimer, SPEEDUP_DURATION, COLORS.speedTarget, 'SPEED x2');
        
        // Enemy warning
        if (GameState.enemySnake && GameState.enemySnake.alive) {
            drawEnemyWarning();
        }

        // Edges disappear: warning and timer overlay
        drawEdgesOverlay();
        
        // Food timer
        drawFoodTimer();
    }
    
    GameState.foodPulse += 0.15;
}

// Draw "Choose direction" text and direction arrow during respawn invincibility
function drawRespawnDirectionUI(centerX, segmentTopY) {
    if (!ctx) return;
    const textY = segmentTopY - 52;
    const arrowY = segmentTopY - 28;
    
    // "Choose direction" text above the snake
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Choose direction', centerX, textY);
    ctx.fillStyle = '#00ff96';
    ctx.fillText('Choose direction', centerX, textY);
    
    // Arrow pointing in nextDir direction (nextDirX, nextDirY)
    const dx = GameState.nextDirX;
    const dy = GameState.nextDirY;
    const size = 14;
    
    ctx.fillStyle = '#00ff96';
    ctx.strokeStyle = 'rgba(0, 255, 150, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    if (dy < 0) {
        // Up
        ctx.moveTo(centerX, arrowY - size);
        ctx.lineTo(centerX - size * 0.8, arrowY + size * 0.6);
        ctx.lineTo(centerX + size * 0.8, arrowY + size * 0.6);
    } else if (dy > 0) {
        // Down
        ctx.moveTo(centerX, arrowY + size);
        ctx.lineTo(centerX - size * 0.8, arrowY - size * 0.6);
        ctx.lineTo(centerX + size * 0.8, arrowY - size * 0.6);
    } else if (dx < 0) {
        // Left
        ctx.moveTo(centerX - size, arrowY);
        ctx.lineTo(centerX + size * 0.6, arrowY - size * 0.8);
        ctx.lineTo(centerX + size * 0.6, arrowY + size * 0.8);
    } else {
        // Right (or default if both 0)
        ctx.moveTo(centerX + size, arrowY);
        ctx.lineTo(centerX - size * 0.6, arrowY - size * 0.8);
        ctx.lineTo(centerX - size * 0.6, arrowY + size * 0.8);
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawSnake() {
    const isSlowed = GameState.slowdownTimer > 0;
    const isFast = GameState.speedupTimer > 0;
    
    // If snake array is empty but snakeX/snakeY are set (during respawn invincibility), draw single segment
    if (snake.length === 0 && GameState.snakeX !== undefined && GameState.snakeY !== undefined) {
        // Draw single segment during invincibility respawn with blinking effect
        if (GameState.invincibilityTimer > 0) {
            // Blink during invincibility
            if (Math.floor(GameState.invincibilityTimer / 3) % 2 === 0) {
                const color = COLORS.snakeHead;
                ctx.fillStyle = COLORS.snakeGlow;
                ctx.fillRect(GameState.snakeX - 2, GameState.snakeY - 2, BLOCK_SIZE + 4, BLOCK_SIZE + 4);
                ctx.fillStyle = color;
                ctx.fillRect(GameState.snakeX, GameState.snakeY, BLOCK_SIZE, BLOCK_SIZE);
            }
            // Always show "Choose direction" and arrow during respawn invincibility
            drawRespawnDirectionUI(GameState.snakeX + BLOCK_SIZE / 2, GameState.snakeY);
        } else {
            // Normal draw when not invincible
            const color = COLORS.snakeHead;
            ctx.fillStyle = COLORS.snakeGlow;
            ctx.fillRect(GameState.snakeX - 2, GameState.snakeY - 2, BLOCK_SIZE + 4, BLOCK_SIZE + 4);
            ctx.fillStyle = color;
            ctx.fillRect(GameState.snakeX, GameState.snakeY, BLOCK_SIZE, BLOCK_SIZE);
        }
        return;
    }
    
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
    if (!ctx) return; // Safety check
    const eyeSize = 5;
    const pupilSize = 3;
    let eye1X, eye1Y, eye2X, eye2Y;
    
    if (GameState.dirX > 0) {
        eye1X = x + BLOCK_SIZE - 7; eye1Y = y + 4;
        eye2X = x + BLOCK_SIZE - 7; eye2Y = y + BLOCK_SIZE - 9;
    } else if (GameState.dirX < 0) {
        eye1X = x + 2; eye1Y = y + 4;
        eye2X = x + 2; eye2Y = y + BLOCK_SIZE - 9;
    } else if (GameState.dirY > 0) {
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
    // Draw all food items as Tetris shapes (small circles per cell)
    for (const food of foods) {
        const pulse = Math.sin(food.pulse) * 0.12 + 1;
        const cellRadius = (BLOCK_SIZE / 2) * pulse;
        const cells = food.cells || [];
        
        for (const [dx, dy] of cells) {
            const cx = food.x + dx * BLOCK_SIZE + BLOCK_SIZE / 2;
            const cy = food.y + dy * BLOCK_SIZE + BLOCK_SIZE / 2;
            
            // Glow
            for (let g = 3; g > 0; g--) {
                ctx.fillStyle = hexToRgba(COLORS.food, (30 - g * 8) / 255);
                ctx.beginPath();
                ctx.arc(cx, cy, cellRadius + g * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Small circle (food cell)
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellRadius);
            grad.addColorStop(0, COLORS.foodInner);
            grad.addColorStop(1, COLORS.food);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, cellRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Timer warning (flash when low) - on bounding box
        if (food.timer < 60 && Math.floor(food.timer / 5) % 2 === 0 && cells.length > 0) {
            const minDx = Math.min(...cells.map(c => c[0])), maxDx = Math.max(...cells.map(c => c[0]));
            const minDy = Math.min(...cells.map(c => c[1])), maxDy = Math.max(...cells.map(c => c[1]));
            const bx = food.x + minDx * BLOCK_SIZE, by = food.y + minDy * BLOCK_SIZE;
            const bw = (maxDx - minDx + 1) * BLOCK_SIZE, bh = (maxDy - minDy + 1) * BLOCK_SIZE;
            ctx.strokeStyle = '#ff3232';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
        }
    }
    
    // Draw hearts
    for (const heart of hearts) {
        const pulse = Math.sin(heart.pulse) * 0.2 + 1;
        const size = BLOCK_SIZE * pulse;
        const centerX = heart.x + BLOCK_SIZE / 2;
        const centerY = heart.y + BLOCK_SIZE / 2;
        
        // Glow
        ctx.fillStyle = 'rgba(255, 50, 100, 0.4)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size / 2 + 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Heart symbol
        ctx.fillStyle = '#ff3264';
        ctx.font = `bold ${Math.floor(size)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❤', centerX, centerY);
        
        // Timer warning
        if (heart.timer < 60 && Math.floor(heart.timer / 5) % 2 === 0) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, size / 2 + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
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
    // Food timers are now shown individually on each food item
    // This function is kept for compatibility but does nothing
}

function drawEnemyWarning() {
    if (!GameState.enemySnake || !GameState.enemySnake.alive) return;
    
    const type = GameState.enemySnake.typeData;
    
    // Warning bar at top of screen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    roundRect(GAME_WIDTH / 2 - 100, 40, 200, 30, 8);
    
    ctx.fillStyle = type.color;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ENEMY: ${type.name.toUpperCase()} SNAKE ⚠`, GAME_WIDTH / 2, 60);
}

function drawEdgesOverlay() {
    const FPS = NORMAL_FPS;
    const state = GameState.edgesState;
    if (state === 'normal') return;

    const blink = Math.floor(GameState.foodPulse / 3) % 2 === 0;
    const bgAlpha = blink ? 0.2 : 0.1;
    const strokeAlpha = blink ? 0.4 : 0.225;
    const textAlpha = blink ? 0.48 : 0.275;

    ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;
    roundRect(GAME_WIDTH / 2 - 180, 78, 360, 44, 8);
    ctx.strokeStyle = `rgba(255, 170, 0, ${strokeAlpha})`;
    ctx.lineWidth = 2;
    roundRect(GAME_WIDTH / 2 - 180, 78, 360, 44, 8);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 204, 0, ${textAlpha})`;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';

    if (state === 'warning') {
        const secLeft = Math.ceil(GameState.edgesWarningFramesLeft / FPS);
        const durationSec = Math.round(GameState.edgesGoneDurationFrames / FPS);
        ctx.fillText(`⚠ EDGES DISAPPEAR IN ${secLeft}s — DURATION: ${durationSec}s`, GAME_WIDTH / 2, 100);
        ctx.font = '12px Arial';
        ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
        ctx.fillText('You will wrap to the opposite side', GAME_WIDTH / 2, 116);
    } else if (state === 'gone') {
        const secLeft = Math.ceil(GameState.edgesGoneFramesLeft / FPS);
        ctx.fillStyle = `rgba(255, 204, 0, ${textAlpha})`;
        ctx.fillText(`EDGES GONE — BACK IN ${secLeft}s`, GAME_WIDTH / 2, 108);
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
    if (!GameState.userHasInteracted) {
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
    ctx.fillText(`Score: ${GameState.score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
    
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`High Score: ${GameState.highScore}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
    
    ctx.fillStyle = '#888';
    ctx.font = '18px Arial';
    ctx.fillText(`Length: ${GameState.snakeLength} • Targets Hit: ${GameState.targetsHit} • Food Eaten: ${GameState.foodEaten}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
    
    // "R" in cyan/turquoise color, "SPACE" in yellow
    ctx.font = '20px Arial';
    ctx.fillStyle = '#00ccff';
    ctx.fillText('Press R or SPACE to restart', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120);
}

// ==========================================
// GAME LOOP
// ==========================================
function gameLoop(timestamp) {
    if (timestamp - GameState.lastTime >= GameState.frameInterval) {
        update();
        GameState.lastTime = timestamp;
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
    if (!GameState.userHasInteracted) {
        GameState.userHasInteracted = true;
        // Start menu music on first interaction if in menu
        if (!GameState.gameStarted && !GameState.gameOver && !GameState.soundMuted) {
            sound.playMenuMusic();
        }
    }
    
    const key = e.key.toLowerCase();
    logToServer('Key: ' + (e.key || key));

    // Direction controls
    if ((key === 'arrowup' || key === 'w') && GameState.dirY !== BLOCK_SIZE) {
        GameState.nextDirX = 0;
        GameState.nextDirY = -BLOCK_SIZE;
        if (!GameState.gameStarted && !GameState.gameOver) {
            startGame();
        }
    }
    if ((key === 'arrowdown' || key === 's') && GameState.dirY !== -BLOCK_SIZE) {
        GameState.nextDirX = 0;
        GameState.nextDirY = BLOCK_SIZE;
        if (!GameState.gameStarted && !GameState.gameOver) {
            startGame();
        }
    }
    if ((key === 'arrowleft' || key === 'a') && GameState.dirX !== BLOCK_SIZE) {
        GameState.nextDirX = -BLOCK_SIZE;
        GameState.nextDirY = 0;
        if (!GameState.gameStarted && !GameState.gameOver) {
            startGame();
        }
    }
    if ((key === 'arrowright' || key === 'd') && GameState.dirX !== -BLOCK_SIZE) {
        GameState.nextDirX = BLOCK_SIZE;
        GameState.nextDirY = 0;
        if (!GameState.gameStarted && !GameState.gameOver) {
            startGame();
        }
    }
    
    // Space key handling
    if (key === ' ') {
        e.preventDefault();
        // Space for restart when game over
        if (GameState.gameOver) {
            showLoadingScreen();
            // Start menu music IMMEDIATELY during loading
            sound.stopGameMusic();
            if (!GameState.soundMuted) {
                sound.playMenuMusic();
            }
            setTimeout(() => {
                initGame(true);
                hideLoadingScreen();
            }, 2000);
            return;
        }
        // Space to START the game from menu
        if (!GameState.gameStarted && !GameState.gameOver) {
            // Start moving up by default
            GameState.nextDirX = 0;
            GameState.nextDirY = -BLOCK_SIZE;
            startGame();
            return;
        }
        // Space for shooting during game (auto-fire)
        if (GameState.gameStarted && !GameState.spacePressed) {
            shoot();
            GameState.spacePressed = true;
            GameState.autoFireCooldown = AUTO_FIRE_DELAY;
        }
    }
    
    // Restart with R
    if (key === 'r' && GameState.gameOver) {
        logToServer('Restart (R) — reinitializing game');
        showLoadingScreen();
        // Start menu music IMMEDIATELY during loading
        sound.stopGameMusic();
        if (!GameState.soundMuted) {
            sound.playMenuMusic();
        }
        setTimeout(() => {
            initGame(true);
            hideLoadingScreen();
        }, 2000);
    }
    
    // Mute with M or Backspace
    if (key === 'm' || key === 'backspace') {
        e.preventDefault();
        GameState.soundMuted = !GameState.soundMuted;
        if (GameState.soundMuted) {
            sound.stopMenuMusic();
            sound.stopGameMusic();
        } else if (GameState.userHasInteracted) {
            if (GameState.gameStarted && !GameState.gameOver) {
                sound.playGameMusic();
            } else if (!GameState.gameStarted && !GameState.gameOver) {
                sound.playMenuMusic();
            }
        }
    }
    
    // Escape to exit/return to menu (NEVER close browser window)
    if (key === 'escape') {
        e.preventDefault();
        e.stopPropagation();
        if (GameState.gameStarted && !GameState.gameOver) {
            // During game - show loading and return to menu
            showLoadingScreen();
            // Start menu music IMMEDIATELY during loading
            sound.stopGameMusic();
            if (!GameState.soundMuted) {
                sound.playMenuMusic();
            }
            setTimeout(() => {
                initGame(true);
                hideLoadingScreen();
            }, 2000);
        } else if (GameState.gameOver) {
            // At game over - show loading and return to menu
            showLoadingScreen();
            // Start menu music IMMEDIATELY during loading
            sound.stopGameMusic();
            if (!GameState.soundMuted) {
                sound.playMenuMusic();
            }
            setTimeout(() => {
                initGame(true);
                hideLoadingScreen();
            }, 2000);
        } else {
            // In menu - close the game/window
            e.preventDefault();
            e.stopPropagation();
            // Try to close the window (works if opened via window.open)
            if (window.opener) {
                window.close();
            } else {
                // If not opened via window.open, try to close anyway
                // Some browsers may block this, but we try
                window.close();
                // Fallback: show confirmation
                if (confirm('Вы действительно хотите выйти из игры?')) {
                    // Try to navigate away or close
                    window.close();
                }
            }
        }
        return false;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
        GameState.spacePressed = false;
    }
});

// Handle click/touch to enable audio
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!GameState.userHasInteracted) {
        GameState.userHasInteracted = true;
        if (!GameState.gameStarted && !GameState.gameOver && !GameState.soundMuted) {
            sound.playMenuMusic();
        }
    }
});

// Prevent Escape from closing browser window ONLY during game (capture phase)
// In menu, allow Escape to close the window
window.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) && (GameState.gameStarted || GameState.gameOver)) {
        // During game or game over - prevent default, let main handler deal with it
        // Don't prevent in menu - allow it to close
        return;
    }
}, true); // Use capture phase to intercept before browser handles it

// ==========================================
// INITIALIZATION
// ==========================================

// Loading screen functionality
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
        loadingScreen.style.pointerEvents = 'auto';
        loadingScreen.style.zIndex = '1000';
        loadingScreen.classList.remove('hidden');
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        // Immediately hide and remove from DOM flow
        loadingScreen.style.opacity = '0';
        loadingScreen.style.pointerEvents = 'none';
        loadingScreen.style.zIndex = '-1';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            loadingScreen.classList.add('hidden');
        }, 300);
    }
    GameState.gameLoaded = true;
}

function showGame() {
    // Ensure canvas is initialized
    if (!ensureCanvasInitialized()) {
        console.error('Cannot start game: canvas not initialized');
        setTimeout(showGame, 100); // Retry after 100ms
        return;
    }
    
    // Create stars
    for (let i = 0; i < 100; i++) {
        stars.push(new Star());
    }
    
    initGame(true);
    updateLivesDisplay();
    requestAnimationFrame(gameLoop);
    
    // Hide loading screen after exactly 4 seconds
    setTimeout(() => {
        hideLoadingScreen();
    }, 2000);
}

// Wait for DOM to be ready before starting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, starting game...');
        showGame();
    });
} else {
    // DOM already loaded
    console.log('DOM already loaded, starting game...');
    showGame();
}

console.log('Fire Snake Game loaded! Open http://localhost:5050 to play.');
logToServer('Session started at ' + new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }) + ' — game loaded');

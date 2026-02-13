// ==========================================
// GAME CONFIGURATION - Constants
// ==========================================

// Canvas setup (will be initialized in main game.js)
export let canvas;
export let ctx;

// Game dimensions
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 800;
export const BLOCK_SIZE = 20;

// Timing
export const NORMAL_FPS = 12;
export const SLOW_FPS = 6;
export const FAST_FPS = 24;
export const INVINCIBILITY_DURATION = 48; // 4 seconds at 12 FPS

// Colors
export const COLORS = {
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
export const TARGET_TYPES = {
    COMMON: { color: '#ffc832', innerColor: '#ffff96', points: 1, name: 'Common' },
    FAST: { color: '#32c8ff', innerColor: '#96e6ff', points: 2, name: 'Fast' },
    RARE: { color: '#c832ff', innerColor: '#e696ff', points: 3, name: 'Rare' },
    EPIC: { color: '#ff6432', innerColor: '#ffb464', points: 5, name: 'Epic' },
    LEGENDARY: { color: '#ffd700', innerColor: '#fff596', points: 10, name: 'Legendary' }
};

// Enemy snake types
export const ENEMY_TYPES = {
    DUMB: {
        name: 'Dumb',
        color: '#d4a574',
        headColor: '#c9956c',
        glowColor: 'rgba(212, 165, 116, 0.5)',
        accuracy: 0.3,
        moveAccuracy: 0.7,
        crashChance: 0.0,
        shootInterval: 36,
        spawnChance: 50
    },
    MEDIUM: {
        name: 'Medium',
        color: '#ffd700',
        headColor: '#ffec00',
        glowColor: 'rgba(255, 215, 0, 0.5)',
        accuracy: 0.5,
        moveAccuracy: 0.85,
        crashChance: 0.0,
        shootInterval: 24,
        spawnChance: 35
    },
    SMART: {
        name: 'Smart',
        color: '#ff4444',
        headColor: '#ff6666',
        glowColor: 'rgba(255, 68, 68, 0.5)',
        accuracy: 0.85,
        moveAccuracy: 0.95,
        crashChance: 0.0,
        shootInterval: 12,
        spawnChance: 15
    }
};

// Game constants
export const MAX_FOOD_ITEMS = 5;
export const FOOD_TIME_LIMIT = 180; // 15 seconds at 12 FPS
export const HEART_SPAWN_INTERVAL = 1440; // ~2 minutes at 12 FPS
export const HEART_LIFETIME = 60; // 5 seconds at 12 FPS
export const SLOWDOWN_DURATION = 120;
export const SPEEDUP_DURATION = 240;
export const AUTO_FIRE_DELAY = 4;
export const BULLET_SPEED = 50;
export const TARGET_SPAWN_INTERVAL = 60;

// Initialize canvas (called from main game.js)
export function initCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
}

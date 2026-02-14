// ==========================================
// GAME STATE - Mutable state variables
// ==========================================

import { NORMAL_FPS } from './game-config.js';

// Game state object - all mutable variables
export const GameState = {
    // Snake
    snake: [],
    snakeLength: 1,
    snakeX: undefined,
    snakeY: undefined,
    dirX: 0,
    dirY: 0,
    nextDirX: 0,
    nextDirY: 0,
    
    // Game status
    score: 0,
    highScore: parseInt(localStorage.getItem('fireSnakeHighScore') || '0'),
    gameOver: false,
    gameStarted: false,
    gamePaused: false,
    newRecordThisGame: false,
    gameLoaded: false,
    
    // Lives and invincibility
    lives: 3,
    lifeLostThisFrame: false,
    invincibilityTimer: 0,
    
    // Timing
    currentFPS: NORMAL_FPS,
    lastTime: 0,
    frameInterval: 1000 / NORMAL_FPS,
    
    // Food
    foods: [],
    hearts: [],
    heartSpawnTimer: 0,
    
    // Timers and effects
    slowdownTimer: 0,
    speedupTimer: 0,
    
    // Statistics
    targetsHit: 0,
    totalShots: 0,
    foodEaten: 0,
    
    // Game objects
    bullets: [],
    targets: [],
    slowTargets: [],
    shrinkTargets: [],
    speedTargets: [],
    particles: [],
    stars: [],
    enemySnake: null,
    enemyBullets: [],
    
    // Enemy spawn
    enemySpawnTimer: 0,
    nextEnemySpawnTime: 60,
    
    // Auto-fire
    spacePressed: false,
    autoFireCooldown: 0,
    
    // Animation
    foodPulse: 0,
    targetSpawnTimer: 0,
    
    // Sound
    soundMuted: false,
    userHasInteracted: false,
    musicTempo: 1.0,

    // Edges disappear: 'normal' | 'warning' | 'gone'
    edgesState: 'normal',
    edgesWarningFramesLeft: 0,
    edgesGoneFramesLeft: 0,
    edgesNextDisappearInFrames: 0,
    edgesGoneDurationFrames: 0
};

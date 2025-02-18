// Game constants
const GRID_SIZE = Math.floor(550/30);
const GRID_COUNT = 30;
const BASE_SPEED = 100;
const WALL_COUNT = Math.floor(GRID_COUNT * GRID_COUNT * 0.05); // 5% of grid will be walls
const PARTICLE_COUNT = 15; // Number of particles per food collection
const STARS_COUNT = 50; // Number of background stars
const PARALLAX_STRENGTH = 0.3; // How much the background moves

// Game variables
let snake = [
    { x: 10, y: 10 }
];
let food = null;
let walls = [];
let direction = 'right';
let directionQueue = [];
let score = 0;
let gameLoop = null;
let gameSpeed = BASE_SPEED;
let highScore = localStorage.getItem('highScore') || 0;
let particles = [];
let currentDifficulty = 'normal';
let backgroundStars = [];
let floatingTexts = [];
let activeEffects = [];
let combo = 0;
let lastFoodTime = 0;
let comboTimeout = null;

// Food types with their properties
const FOOD_TYPES = {
    normal: { color: '#FF5722', points: 10, effect: null },
    speed: { color: '#2196F3', points: 20, effect: 'speedUp', duration: 5000 },
    slow: { color: '#9C27B0', points: 15, effect: 'slowDown' },
    bonus: { color: '#FFD700', points: 30, effect: null }
};

// Particle class for effects
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.gravity = 0.2;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.life -= this.decay;
        this.size *= 0.99;
        return this.life > 0;
    }
}

// Star class for background
class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.depth = Math.random() * 0.5 + 0.5; // Used for parallax effect
        this.brightness = Math.random() * 0.5 + 0.5;
    }
}

// Floating text for score/effects
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.velocity = -2;
    }
}

// Function to create particle burst
function createParticleBurst(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle(
            x * GRID_SIZE + GRID_SIZE / 2,
            y * GRID_SIZE + GRID_SIZE / 2,
            color
        ));
    }
}

// Create floating score text
function createFloatingText(x, y, text, color) {
    floatingTexts.push(new FloatingText(
        x * GRID_SIZE + GRID_SIZE / 2,
        y * GRID_SIZE,
        text,
        color
    ));
}

// Add status effect
function addStatusEffect(type, duration) {
    activeEffects.push({
        type,
        duration,
        startTime: Date.now(),
        color: FOOD_TYPES[type].color
    });
}

// Handle combo system
function updateCombo() {
    const currentTime = Date.now();
    const timeSinceLastFood = currentTime - lastFoodTime;
    
    if (timeSinceLastFood < 2000) { // 2 seconds window for combo
        combo++;
        // Clear existing timeout
        if (comboTimeout) clearTimeout(comboTimeout);
    } else {
        combo = 1;
    }
    
    lastFoodTime = currentTime;
    
    // Set new timeout to reset combo
    comboTimeout = setTimeout(() => {
        if (combo > 1) {
            createFloatingText(snake[0].x, snake[0].y, "Combo End!", "#ff4444");
        }
        combo = 0;
    }, 2000);
    
    return combo;
}

// Initialize background stars
function initializeStars() {
    backgroundStars = Array.from({ length: STARS_COUNT }, () => new Star());
}

initializeStars();

// Difficulty settings
const DIFFICULTY_SETTINGS = {
    easy: { speedMultiplier: 1.2, foodPoints: 1.0 },
    normal: { speedMultiplier: 1.0, foodPoints: 1.0 },
    hard: { speedMultiplier: 0.8, foodPoints: 1.5 }
};

// Get canvas context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Initialize game
function init() {
    spawnFood();
    document.addEventListener('keydown', handleKeyPress);
    lastUpdateTime = Date.now();
    update();
}

// Generate walls in a way that ensures playability
function generateWalls() {
    walls = [];
    const tempWalls = new Set();
    
    // Keep snake spawn area clear
    const clearZone = [];
    for (let x = 8; x <= 12; x++) {
        for (let y = 8; y <= 12; y++) {
            clearZone.push(`${x},${y}`);
        }
    }

    // Start with a few random seed walls
    const seedCount = Math.floor(WALL_COUNT * 0.3);
    while (tempWalls.size < seedCount) {
        const x = Math.floor(Math.random() * GRID_COUNT);
        const y = Math.floor(Math.random() * GRID_COUNT);
        const wallKey = `${x},${y}`;
        
        if (!clearZone.includes(wallKey)) {
            tempWalls.add(wallKey);
            walls.push({ x, y });
        }
    }

    // Grow clusters from seed walls
    while (tempWalls.size < WALL_COUNT) {
        const existingWall = walls[Math.floor(Math.random() * walls.length)];
        const direction = Math.floor(Math.random() * 4);
        let newX = existingWall.x;
        let newY = existingWall.y;

        switch(direction) {
            case 0: newY--; break; // up
            case 1: newY++; break; // down
            case 2: newX--; break; // left
            case 3: newX++; break; // right
        }

        const wallKey = `${newX},${newY}`;
        
        // Check if the new position is valid
        if (newX >= 0 && newX < GRID_COUNT && newY >= 0 && newY < GRID_COUNT && 
            !clearZone.includes(wallKey) && !tempWalls.has(wallKey)) {
            // Ensure we don't create completely enclosed areas
            const adjacentSpaces = [
                `${newX-1},${newY}`, `${newX+1},${newY}`,
                `${newX},${newY-1}`, `${newX},${newY+1}`
            ].filter(key => !tempWalls.has(key)).length;
            
            if (adjacentSpaces >= 2) {
                tempWalls.add(wallKey);
                walls.push({ x: newX, y: newY });
            }
        }
    }
}

// Spawn food at random position
// Update spawnFood to consider walls
function spawnFood() {
    const types = Object.keys(FOOD_TYPES);
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    do {
        food = {
            x: Math.floor(Math.random() * GRID_COUNT),
            y: Math.floor(Math.random() * GRID_COUNT),
            type: randomType
        };
    } while (
        snake.some(segment => segment.x === food.x && segment.y === food.y) ||
        walls.some(wall => wall.x === food.x && wall.y === food.y)
    );
}

// Update handleKeyPress to include WASD
function handleKeyPress(event) {
    let newDirection;
    switch(event.key.toLowerCase()) {
        case 'arrowup':
        case 'w': newDirection = 'up'; break;
        case 'arrowdown':
        case 's': newDirection = 'down'; break;
        case 'arrowleft':
        case 'a': newDirection = 'left'; break;
        case 'arrowright':
        case 'd': newDirection = 'right'; break;
        default: return;
    }
    
    const lastDirection = directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : direction;
    if (isValidTurn(lastDirection, newDirection) && directionQueue.length < 2) {
        directionQueue.push(newDirection);
    }
}

// Check if the turn is valid
function isValidTurn(currentDir, newDir) {
    return (currentDir !== newDir) && 
           !((currentDir === 'up' && newDir === 'down') ||
             (currentDir === 'down' && newDir === 'up') ||
             (currentDir === 'left' && newDir === 'right') ||
             (currentDir === 'right' && newDir === 'left'));
}

// Add interpolation variables
let lastUpdateTime = 0;
let interpolationProgress = 1;
const MOVE_DURATION = BASE_SPEED;

// Update game state
function update() {
    const currentTime = Date.now();
    if (!lastUpdateTime) lastUpdateTime = currentTime;
    interpolationProgress = Math.min(1, (currentTime - lastUpdateTime) / MOVE_DURATION);

    if (interpolationProgress >= 1) {
        lastUpdateTime = currentTime;
        interpolationProgress = 0;

        // Process direction queue
        if (directionQueue.length > 0) {
            direction = directionQueue.shift();
        }

        const head = { ...snake[0] };

        // Move snake head
        switch(direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        // Check for collisions
        // Update collision check in update function
        if (head.x < 0 || head.x >= GRID_COUNT || head.y < 0 || head.y >= GRID_COUNT ||
            snake.some(segment => segment.x === head.x && segment.y === head.y) ||
            walls.some(wall => wall.x === head.x && wall.y === head.y)) {
            gameOver();
            return;
        }

        // Add new head
        snake.unshift(head);

        // Check if snake ate food
        if (head.x === food.x && head.y === food.y) {
            const foodType = FOOD_TYPES[food.type];
            const currentCombo = updateCombo();
            const comboMultiplier = currentCombo > 1 ? currentCombo * 0.5 : 1;
            const points = Math.floor(
                foodType.points * 
                DIFFICULTY_SETTINGS[currentDifficulty].foodPoints * 
                comboMultiplier
            );
            createParticleBurst(food.x, food.y, foodType.color);
            createFloatingText(food.x, food.y, `+${points}${currentCombo > 1 ? ` x${currentCombo}` : ''}`, foodType.color);
            score += points;
            
            // Apply food effects
            if (foodType.effect === 'speedUp') {
                gameSpeed = Math.max(BASE_SPEED * 0.7, gameSpeed * 0.8);
                clearInterval(gameLoop);
                gameLoop = setInterval(update, gameSpeed / 60);
                addStatusEffect('speed', foodType.duration);
            } else if (foodType.effect === 'slowDown') {
                gameSpeed = Math.min(BASE_SPEED * 1.3, gameSpeed * 1.2);
                clearInterval(gameLoop);
                gameLoop = setInterval(update, gameSpeed / 60);
            }

            
            // Update scores
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('highScore', highScore);
            }
            scoreElement.textContent = `Score: ${score} | High Score: ${highScore}`;
            spawnFood();
        } else {
            snake.pop();
        }
    }

    // Draw game
    draw();
    requestAnimationFrame(update);
}

// Draw game state
function draw() {
    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate parallax offset based on snake head position
    const snakeHead = snake[0];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const offsetX = (snakeHead.x * GRID_SIZE - centerX) * PARALLAX_STRENGTH;
    const offsetY = (snakeHead.y * GRID_SIZE - centerY) * PARALLAX_STRENGTH;

    // Draw background stars with parallax effect
    backgroundStars.forEach(star => {
        const parallaxX = offsetX * star.depth;
        const parallaxY = offsetY * star.depth;
        
        // Wrap stars around the canvas
        let drawX = star.x - parallaxX;
        let drawY = star.y - parallaxY;
        
        drawX = ((drawX % canvas.width) + canvas.width) % canvas.width;
        drawY = ((drawY % canvas.height) + canvas.height) % canvas.height;
        
        const gradient = ctx.createRadialGradient(
            drawX, drawY, 0,
            drawX, drawY, star.size * 2
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.6 * star.brightness})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(drawX - star.size, drawY - star.size, star.size * 2, star.size * 2);
    });

    // Add subtle color overlay to create depth
    ctx.fillStyle = `rgba(0, 0, 0, 0.1)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw and update particles
    particles = particles.filter(particle => {
        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        return particle.update();
    });

    ctx.globalAlpha = 1;

    // Draw and update floating texts
    floatingTexts = floatingTexts.filter(text => {
        text.y += text.velocity;
        text.life -= 0.02;
        
        if (text.life > 0) {
            ctx.save();
            ctx.globalAlpha = text.life;
            ctx.fillStyle = text.color;
            ctx.shadowColor = text.color;
            ctx.shadowBlur = 5;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(text.text, text.x, text.y);
            ctx.restore();
            return true;
        }
        return false;
    });

    // Draw status effects
    const currentTime = Date.now();
    activeEffects = activeEffects.filter(effect => {
        const timeLeft = effect.duration - (currentTime - effect.startTime);
        if (timeLeft > 0) {
            const x = 20;
            const y = canvas.height - 60;
            const width = 100;
            const height = 4;
            const progress = timeLeft / effect.duration;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x, y, width, height);
            ctx.fillStyle = effect.color;
            ctx.fillRect(x, y, width * progress, height);
            return true;
        }
        return false;
    });

    // Draw combo indicator if active
    if (combo > 1) {
        const comboText = `${combo}x Combo!`;
        ctx.save();
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Create gradient for combo text
        const gradient = ctx.createLinearGradient(
            canvas.width/2 - 50, canvas.height - 40,
            canvas.width/2 + 50, canvas.height - 40
        );
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ffd93d');
        ctx.fillStyle = gradient;
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 10;
        ctx.fillText(comboText, canvas.width/2, canvas.height - 40);
        ctx.restore();
    }

    // Draw walls
    ctx.fillStyle = '#34495e';
    walls.forEach(wall => {
        ctx.beginPath();
        ctx.roundRect(
            wall.x * GRID_SIZE,
            wall.y * GRID_SIZE,
            GRID_SIZE - 1,
            GRID_SIZE - 1,
            4
        );
        ctx.fill();
    });

    // Draw snake trail effect with improved interpolation
    snake.forEach((segment, index) => {
        const alpha = 1 - (index / snake.length) * 0.6;
        const time = Date.now() / 1000;
        const hue = (200 + Math.sin(time + index * 0.1) * 20) % 360;
        const gradient = ctx.createLinearGradient(
            segment.x * GRID_SIZE, segment.y * GRID_SIZE,
            (segment.x + 1) * GRID_SIZE, (segment.y + 1) * GRID_SIZE);
        gradient.addColorStop(0, `hsla(${hue}, 70%, 50%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${hue + 30}, 70%, 40%, ${alpha})`);
        ctx.fillStyle = gradient;

        let x = segment.x;
        let y = segment.y;

        // Apply smoother interpolation for the head and body segments
        if (index === 0 && interpolationProgress < 1) {
            const moveOffset = Math.sin(interpolationProgress * Math.PI / 2);
            switch(direction) {
                case 'up': y = segment.y + (1 - moveOffset); break;
                case 'down': y = segment.y - (1 - moveOffset); break;
                case 'left': x = segment.x + (1 - moveOffset); break;
                case 'right': x = segment.x - (1 - moveOffset); break;
            }
        } else if (index > 0 && interpolationProgress < 1) {
            const prevSegment = snake[index - 1];
            const lerpFactor = Math.sin(interpolationProgress * Math.PI / 2);
            x = x + (prevSegment.x - x) * lerpFactor * 0.5;
            y = y + (prevSegment.y - y) * lerpFactor * 0.5;
        }

        const segmentSize = GRID_SIZE - 1;
        x = x * GRID_SIZE;
        y = y * GRID_SIZE;

        ctx.beginPath();
        ctx.roundRect(x, y, segmentSize, segmentSize, 6);
        
        // Add speed effect trail when speed powerup is active
        if (activeEffects.some(effect => effect.type === 'speed')) {
            const trailGradient = ctx.createLinearGradient(
                x, y + segmentSize,
                x, y
            );
            trailGradient.addColorStop(0, 'rgba(33, 150, 243, 0)');
            trailGradient.addColorStop(1, 'rgba(33, 150, 243, 0.3)');
            
            ctx.shadowColor = '#2196F3';
            ctx.shadowBlur = 20;
        } else {
            ctx.shadowColor = gradient.addColorStop(0);
        }
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        ctx.fill();
    });

    // Draw food with enhanced pulsing animation
    const foodType = FOOD_TYPES[food.type];
    ctx.fillStyle = foodType.color;
    const pulseScale = 0.15 * Math.sin(Date.now() / 150) + 0.85;
    const foodSize = GRID_SIZE * pulseScale;
    
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE/2,
        food.y * GRID_SIZE + GRID_SIZE/2,
        foodSize/2,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Add glow effect to food
    ctx.shadowColor = foodType.color;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw snake head with enhanced appearance and smoother interpolation
    const head = snake[0];
    let headX = head.x;
    let headY = head.y;

    if (interpolationProgress < 1) {
        const moveOffset = Math.sin(interpolationProgress * Math.PI / 2);
        switch(direction) {
            case 'up': headY = head.y + (1 - moveOffset); break;
            case 'down': headY = head.y - (1 - moveOffset); break;
            case 'left': headX = head.x + (1 - moveOffset); break;
            case 'right': headX = head.x - (1 - moveOffset); break;
        }
    }

    // Enhanced snake head with gradient and glow
    const headGradient = ctx.createRadialGradient(
        headX * GRID_SIZE + GRID_SIZE/2, headY * GRID_SIZE + GRID_SIZE/2, 0,
        headX * GRID_SIZE + GRID_SIZE/2, headY * GRID_SIZE + GRID_SIZE/2, GRID_SIZE/2
    );
    headGradient.addColorStop(0, '#2ecc71');
    headGradient.addColorStop(1, '#27ae60');
    ctx.fillStyle = headGradient;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(
        headX * GRID_SIZE + GRID_SIZE/2,
        headY * GRID_SIZE + GRID_SIZE/2,
        GRID_SIZE/2,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Reset shadow effect
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
}

// Initialize game
function init() {
    generateWalls();
    spawnFood();
    document.addEventListener('keydown', handleKeyPress);
    lastUpdateTime = Date.now();
    update();
}

// Game over function
function gameOver() {
    clearInterval(gameLoop);
    const modal = document.createElement('div');
    modal.className = 'game-over-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2><span class="lang-en">Game Over!</span><span class="lang-ko">게임 오버!</span></h2>
            <p><span class="lang-en">Score:</span><span class="lang-ko">점수:</span> ${score}</p>
            <p><span class="lang-en">High Score:</span><span class="lang-ko">최고점수:</span> ${highScore}</p>
            <button class="btn play-again-btn">
                <span class="lang-en">Play Again</span>
                <span class="lang-ko">다시 하기</span>
            </button>
        </div>
    `;
    document.body.appendChild(modal);
    updateLanguage();

    modal.querySelector('.play-again-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
        resetGame();
        spawnFood();
        init();
    });
}

// Add difficulty selection
function setDifficulty(difficulty) {
    currentDifficulty = difficulty;
    gameSpeed = BASE_SPEED * DIFFICULTY_SETTINGS[difficulty].speedMultiplier;
    clearInterval(gameLoop);
    gameLoop = setInterval(update, gameSpeed);
}

// Add keyboard controls for difficulty
document.addEventListener('keydown', (event) => {
    switch(event.key) {
        case '1': setDifficulty('easy'); break;
        case '2': setDifficulty('normal'); break;
        case '3': setDifficulty('hard'); break;
    }
});

// Theme and language management
let currentLang = 'en';

function toggleTheme() {
    document.body.classList.toggle('light-mode');
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ko' : 'en';
    updateLanguage();
}

function updateLanguage() {
    document.querySelectorAll('.lang-en, .lang-ko').forEach(el => {
        el.style.display = el.classList.contains(`lang-${currentLang}`) ? 'inline' : 'none';
    });
}

// Initialize theme and language controls
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('langToggle').addEventListener('click', toggleLanguage);

// Hide Korean text initially
updateLanguage();

// Initialize start button
document.getElementById('startButton').addEventListener('click', function() {
    this.disabled = true;
    init();
});

// Reset game state when game is over
function resetGame() {
    snake = [{ x: 10, y: 10 }];
    direction = 'right';
    score = 0;
    particles = [];
    floatingTexts = [];
    activeEffects = [];
    combo = 0;
    lastFoodTime = 0;
    if (comboTimeout) clearTimeout(comboTimeout);
    initializeStars(); // Reset background stars
    gameSpeed = BASE_SPEED * DIFFICULTY_SETTINGS[currentDifficulty].speedMultiplier;
    scoreElement.textContent = `Score: 0 | High Score: ${highScore}`;
    document.getElementById('startButton').disabled = false;
}

// Update gameOver function to use resetGame
function gameOver() {
    clearInterval(gameLoop);
    alert(`Game Over! Your score: ${score}\nHigh Score: ${highScore}`);
    resetGame();
    spawnFood();
}
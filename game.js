// Game constants
const GRID_SIZE = Math.floor(550/30);
const GRID_COUNT = 30;
const BASE_SPEED = 100;
const WALL_COUNT = Math.floor(GRID_COUNT * GRID_COUNT * 0.05); // 5% of grid will be walls

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
let currentDifficulty = 'normal';

// Food types with their properties
const FOOD_TYPES = {
    normal: { color: '#FF5722', points: 10, effect: null },
    speed: { color: '#2196F3', points: 20, effect: 'speedUp' },
    slow: { color: '#9C27B0', points: 15, effect: 'slowDown' },
    bonus: { color: '#FFD700', points: 30, effect: null }
};

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
            const points = Math.floor(foodType.points * DIFFICULTY_SETTINGS[currentDifficulty].foodPoints);
            score += points;
            
            // Apply food effects
            if (foodType.effect === 'speedUp') {
                gameSpeed = Math.max(BASE_SPEED * 0.7, gameSpeed * 0.8);
                clearInterval(gameLoop);
                gameLoop = setInterval(update, gameSpeed / 60);
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
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, `rgba(46, 204, 113, ${alpha})`);
        gradient.addColorStop(1, `rgba(39, 174, 96, ${alpha})`);
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

    ctx.fillStyle = '#219653';
    ctx.beginPath();
    ctx.arc(
        headX * GRID_SIZE + GRID_SIZE/2,
        headY * GRID_SIZE + GRID_SIZE/2,
        GRID_SIZE/2,
        0,
        Math.PI * 2
    );
    ctx.fill();
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
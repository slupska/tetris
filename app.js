const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24;//w px

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

// skalujemy; rysujemy w jednostkach klocków zamiast pikseli, 1 kratka = 1bloczek 24px
ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const NEXT_SIZE = 4;
const NEXT_BLOCK_SIZE = 32;
nextCanvas.width = NEXT_SIZE * NEXT_BLOCK_SIZE;
nextCanvas.height = NEXT_SIZE * NEXT_BLOCK_SIZE;
nextCtx.scale(NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE);

const scoreEl = document.getElementById('score');
const gameOverMsg = document.getElementById('gameOverMsg');
const startBtn = document.getElementById('startBtn');

const SHAPES = {
    I: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ],
    J: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    L: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
    ],
    S: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    Z: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
    T: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    O: [
        [1, 1],
        [1, 1],
    ],
};

const COLORS = {
    I: '#5feaffff',
    J: '#609dffff',
    L: '#ffa462ff',
    S: '#60ff9aff',
    Z: '#ef4444',
    T: '#c17effff',
    O: '#ffdb71ff',
};

let board = createEmptyBoard();
let currentPiece = null;
let nextPiece = randomPiece();
let score = 0;
let gameOver = false;
let isRunning = false; // gra rusza po "Nowa gra"

let dropInterval = 800; // ms
let lastTime = 0;
let dropCounter = 0;

function createEmptyBoard() {
    const matrix = [];
    for (let y = 0; y < ROWS; y++) {
        const row = new Array(COLS).fill(null);
        matrix.push(row);
    }
    return matrix;
}

function randomPiece() {
    const types = Object.keys(SHAPES);
    const randomIndex = Math.floor(Math.random() * types.length);
    const type = types[randomIndex];
    const shapeTemplate = SHAPES[type];

    // kopiujemy kształt, żeby go nie modyfikować w oryginalnym SHAPES
    const shape = [];
    for (let y = 0; y < shapeTemplate.length; y++) {
        shape[y] = shapeTemplate[y].slice();           // kopia wiersza
    }

    return {
        x: 3,               // pozycja startowa w poziomie
        y: -2,              // trochę nad górą planszy
        shape: shape,       // macierz 0/1
        color: COLORS[type],
        type: type,
    };
}

function resetGame() {
    board = createEmptyBoard();
    score = 0;
    scoreEl.textContent = score;
    gameOver = false;
    gameOverMsg.textContent = '';
    currentPiece = randomPiece();
    nextPiece = randomPiece();
    dropCounter = 0;
    lastTime = 0;
}

// rysowanie
function drawCell(x, y, color, context = ctx) {
    context.fillStyle = color;
    context.fillRect(x, y, 1, 1);
    context.strokeStyle = 'rgba(15,23,42,0.6)';
    context.lineWidth = 0.05;
    context.strokeRect(x, y, 1, 1);
}

function drawBoard() {
    ctx.clearRect(0, 0, COLS, ROWS);

    // tło
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, COLS, ROWS);

    // siatka
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = '#323e5bff';
    // pionowe linie
    for (let x = 0; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ROWS);
        ctx.stroke();
    }
    // poziome linie
    for (let y = 0; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(COLS, y);
        ctx.stroke();
    }

    // klocki które spadły
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const cell = board[y][x];
            if (cell) {
                drawCell(x, y, cell);
            }
        }
    }

    // aktualny klocek
    if (currentPiece) {
        drawPiece(currentPiece);
    }
}

function drawPiece(piece) {
    for (let y = 0; y < piece.shape.length; y++) {
        const row = piece.shape[y];

        for (let x = 0; x < row.length; x++) {
            const value = row[x];

            if (value === 1) {
                const drawX = piece.x + x;
                const drawY = piece.y + y;

                if (drawY >= 0) {
                    drawCell(drawX, drawY, piece.color);
                }
            }
        }
    }
}

function drawNext() {
    nextCtx.clearRect(0, 0, NEXT_SIZE, NEXT_SIZE);
    nextCtx.fillStyle = '#020617';
    nextCtx.fillRect(0, 0, NEXT_SIZE, NEXT_SIZE);

    if (!nextPiece) return;

    const shape = nextPiece.shape;
    const size = shape.length;

    // wyśrodkowanie !!!
    const offsetX = Math.floor((NEXT_SIZE - size) / 2);
    const offsetY = Math.floor((NEXT_SIZE - size) / 2);

    for (let y = 0; y < size; y++) {
        const row = shape[y];
        for (let x = 0; x < row.length; x++) {
            const value = row[x];
            if (!value) {
                continue;
            }
            drawCell(offsetX + x, offsetY + y, nextPiece.color, nextCtx);
        }
    }

}

// ruch i kolizje
function collide(piece, offsetX, offsetY) {
    const shape = piece.shape;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (!shape[y][x]) continue;

            const newX = piece.x + x + offsetX;
            const newY = piece.y + y + offsetY;

            // poza planszą
            if (newX < 0 || newX >= COLS || newY >= ROWS) {
                return true;
            }

            // kolizja ze stałym klockiem
            if (newY >= 0 && board[newY][newX]) {
                return true;
            }
        }
    }
    return false;
}

function mergePiece() {
    let overflow = false;

    const shape = currentPiece.shape;

    for (let y = 0; y < shape.length; y++) {
        const row = shape[y];
        for (let x = 0; x < row.length; x++) {
            const value = row[x];
            if (!value) {
                continue;
            }

            const boardX = currentPiece.x + x;
            const boardY = currentPiece.y + y;

            if (boardY < 0) {
                // klocek "wystaje" nad planszę -> koniec gry
                overflow = true;
            } else {
                board[boardY][boardX] = currentPiece.color;
            }
        }
    }

    if (overflow) {
        gameOver = true;
        isRunning = false;
        gameOverMsg.textContent = 'Koniec gry! Kliknij "Nowa gra".';
    }
}

function rotateMatrix(matrix) {
    const size = matrix.length;
    const result = [];

    for (let y = 0; y < size; y++) {
        result[y] = [];
        for (let x = 0; x < size; x++) {
            result[y][x] = matrix[size - 1 - x][y]; // obrót w prawo
        }
    }
    return result;
}

function rotatePiece() {
    if (!currentPiece) return;

    const oldShape = currentPiece.shape;
    const rotated = rotateMatrix(oldShape);

    currentPiece.shape = rotated;

    // jeśli kolizja po obrocie anuluj obrót
    if (collide(currentPiece, 0, 0)) {
        currentPiece.shape = oldShape;
    }
}

function clearLines() {
    let linesCleared = 0;

    for (let y = ROWS - 1; y >= 0; y--) {
        let full = true;

        for (let x = 0; x < COLS; x++) {
            if (!board[y][x]) {
                full = false;
                break;
            }
        }

        if (full) {
            // usuwamy pełną linię
            board.splice(y, 1);
            // dodajemy pusty wiersz na górze
            board.unshift(new Array(COLS).fill(null));
            linesCleared++;
            y++; // sprawdzamy jeszcze raz ten sam indeks po zsunięciu
        }
    }

    if (linesCleared > 0) {
        const points = [0, 100, 300, 500, 800]; // 1,2,3,4 linie
        score += points[linesCleared];
        scoreEl.textContent = score;
    }
}

function drop() {
    if (!currentPiece || gameOver) return;

    if (!collide(currentPiece, 0, 1)) {
        currentPiece.y++;
    } else {
        // dotknął dołu albo innego klocka
        mergePiece();

        // jeśli w mergePiece wykryliśmy przepełnienie, kończymy
        if (gameOver) {
            return;
        }

        clearLines();
        currentPiece = nextPiece;
        nextPiece = randomPiece();

        // dodatkowy bezpiecznik: gdy nowy klocek od razu koliduje
        if (collide(currentPiece, 0, 0)) {
            gameOver = true;
            isRunning = false;
            gameOverMsg.textContent = 'Koniec gry! Kliknij "Nowa gra".';
        }
    }
}

function hardDrop() {
    if (!currentPiece || gameOver) return;
    while (!collide(currentPiece, 0, 1)) {
        currentPiece.y++;
    }
    drop();
}

// gra
function update(time = 0) {
    const delta = time - lastTime;
    lastTime = time;

    if (isRunning && !gameOver) {
        dropCounter += delta;

        if (dropCounter > dropInterval) {
            drop();
            dropCounter = 0;
        }
    }

    drawBoard();
    drawNext();

    requestAnimationFrame(update);
}

// sterowanie klawiaturą
document.addEventListener('keydown', function (event) {
    if (!currentPiece || gameOver || !isRunning) return;

    const key = event.key;

    if (key === 'ArrowLeft') {
        if (!collide(currentPiece, -1, 0)) {
            currentPiece.x--;
        }
    } else if (key === 'ArrowRight') {
        if (!collide(currentPiece, 1, 0)) {
            currentPiece.x++;
        }
    } else if (key === 'ArrowDown') {
        if (!collide(currentPiece, 0, 1)) {
            currentPiece.y++;
        }
    } else if (key === 'ArrowUp') {
        rotatePiece();
    } else if (key === ' ') {
        event.preventDefault();
        hardDrop();
    }
});

// sterowanie dotykowe
const touchButtons = document.querySelectorAll('.btn-control');

touchButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (!currentPiece || gameOver || !isRunning) return;

        const action = btn.dataset.action;

        if (action === 'left') {
            if (!collide(currentPiece, -1, 0)) {
                currentPiece.x--;
            }
        } else if (action === 'right') {
            if (!collide(currentPiece, 1, 0)) {
                currentPiece.x++;
            }
        } else if (action === 'down') {
            if (!collide(currentPiece, 0, 1)) {
                currentPiece.y++;
            }
        } else if (action === 'rotate') {
            rotatePiece();
        } else if (action === 'drop') {
            hardDrop();
        }
    });
});

// start/reset
startBtn.addEventListener('click', function () {
    resetGame();
    isRunning = true;
    gameOverMsg.textContent = '';
});

// początek- gra zatrzymana, tylko plansza
resetGame();
gameOverMsg.textContent = 'Kliknij "Nowa gra" aby zacząć.';
requestAnimationFrame(update);

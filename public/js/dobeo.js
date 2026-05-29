// public/js/dobeo.js

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Home Page
    const btnStartDobeo = document.getElementById('btnStartDobeo');
    const minigameHome = document.getElementById('minigameHome');
    const dobeoPlayground = document.getElementById('dobeoPlayground');
    
    // DOM Elements - Dobeo Playground
    const gridElement = document.getElementById('dobeoGrid');
    const difficultySelect = document.getElementById('dobeoDifficulty');
    const timerDisplay = document.getElementById('dobeoTimer');
    const flagsCountDisplay = document.getElementById('dobeoFlagsCount');
    const btnRestart = document.getElementById('btnDobeoRestart');
    const btnQuit = document.getElementById('btnDobeoQuit');
    
    // DOM Elements - Overlay
    const overlay = document.getElementById('dobeoOverlay');
    const overlayIcon = document.getElementById('dobeoOverlayIcon');
    const overlayTitle = document.getElementById('dobeoOverlayTitle');
    const overlayMessage = document.getElementById('dobeoOverlayMessage');
    const btnOverlayClose = document.getElementById('btnDobeoOverlayClose');

    // Audio setup (chờ user thêm file audio vào thư mục)
    const wakeUpAudio = new Audio('/img/do-beo/audio/wake-up.mp3');

    // Mức độ
    const DIFFICULTIES = {
        easy: { rows: 9, cols: 9, mines: 10 },
        medium: { rows: 16, cols: 16, mines: 40 },
        hard: { rows: 16, cols: 30, mines: 99 } // row x col: 16x30
    };

    let currentDifficulty = 'easy';
    let rows, cols, totalMines;
    let board = [];
    let flagsPlaced = 0;
    let isGameOver = false;
    let isFirstClick = true;
    let revealedCount = 0;
    
    let timerInterval = null;
    let timeElapsed = 0;

    // --- Khởi tạo Game ---
    function initGame() {
        // Lấy thông số mức độ
        currentDifficulty = difficultySelect.value;
        const config = DIFFICULTIES[currentDifficulty];
        rows = config.rows;
        cols = config.cols;
        totalMines = config.mines;

        // Reset state
        isGameOver = false;
        isFirstClick = true;
        flagsPlaced = 0;
        revealedCount = 0;
        timeElapsed = 0;
        board = [];
        
        clearInterval(timerInterval);
        updateTimerDisplay();
        updateFlagsDisplay();

        // Ẩn overlay
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        dobeoPlayground.classList.remove('shake-screen');

        // Khởi tạo bảng logic
        for (let r = 0; r < rows; r++) {
            let row = [];
            for (let c = 0; c < cols; c++) {
                row.push({
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    neighborMines: 0
                });
            }
            board.push(row);
        }

        renderGrid();
    }

    // --- Render Giao Diện Bảng ---
    function renderGrid() {
        gridElement.innerHTML = '';
        gridElement.style.gridTemplateColumns = `repeat(${cols}, max-content)`;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.classList.add('dobeo-cell');
                cell.dataset.r = r;
                cell.dataset.c = c;

                cell.addEventListener('click', () => handleLeftClick(r, c));
                cell.addEventListener('contextmenu', (e) => handleRightClick(e, r, c));

                gridElement.appendChild(cell);
            }
        }
    }

    // --- Đặt mìn (Sau khi click ô đầu tiên) ---
    function placeMines(firstRow, firstCol) {
        let minesPlaced = 0;
        while (minesPlaced < totalMines) {
            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);
            
            // Tránh đặt mìn vào ô đầu tiên click (hoặc 8 ô xung quanh để luôn có khoảng trống an toàn)
            const isSafeZone = Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1;

            if (!board[r][c].isMine && !isSafeZone) {
                board[r][c].isMine = true;
                minesPlaced++;
            }
        }
    }

    // --- Tính toán số mìn xung quanh ---
    function calculateNumbers() {
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].isMine) continue;
                
                let count = 0;
                directions.forEach(dir => {
                    const nr = r + dir[0];
                    const nc = c + dir[1];
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
                        count++;
                    }
                });
                board[r][c].neighborMines = count;
            }
        }
    }

    // --- Xử lý Left Click ---
    function handleLeftClick(r, c) {
        if (isGameOver || board[r][c].isFlagged || board[r][c].isRevealed) return;

        // Xử lý click đầu tiên
        if (isFirstClick) {
            isFirstClick = false;
            placeMines(r, c);
            calculateNumbers();
            startTimer();
        }

        const cellData = board[r][c];

        // Click trúng Lbeo (Mìn)
        if (cellData.isMine) {
            revealAllMines();
            gameOver(false);
            return;
        }

        // Mở ô an toàn
        revealCell(r, c);

        // Kiểm tra thắng
        checkWinCondition();
    }

    // --- Xử lý Right Click (Cắm bia / Mở nhanh) ---
    function handleRightClick(e, r, c) {
        e.preventDefault(); // Ngăn menu chuột phải mặc định
        if (isGameOver) return;

        const cellData = board[r][c];

        if (cellData.isRevealed) {
            // Tính năng Chording: Right click vào ô số để mở nhanh các ô xung quanh
            if (cellData.neighborMines > 0) {
                chordCell(r, c);
            }
            return;
        }

        const cellElement = getCellElement(r, c);

        if (!cellData.isFlagged) {
            if (flagsPlaced < totalMines) {
                cellData.isFlagged = true;
                flagsPlaced++;
                cellElement.classList.add('flag');
            }
        } else {
            cellData.isFlagged = false;
            flagsPlaced--;
            cellElement.classList.remove('flag');
        }

        updateFlagsDisplay();
    }

    // --- Mở nhanh 8 ô xung quanh (Chording) ---
    function chordCell(r, c) {
        const cellData = board[r][c];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        let flagsAround = 0;
        let neighbors = [];

        directions.forEach(dir => {
            const nr = r + dir[0];
            const nc = c + dir[1];
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                if (board[nr][nc].isFlagged) {
                    flagsAround++;
                } else if (!board[nr][nc].isRevealed) {
                    neighbors.push([nr, nc]);
                }
            }
        });

        // Chỉ kích hoạt mở nhanh nếu số cờ xung quanh bằng với số mìn của ô
        if (flagsAround === cellData.neighborMines) {
            let hitMine = false;
            neighbors.forEach(([nr, nc]) => {
                if (board[nr][nc].isMine) {
                    hitMine = true;
                } else {
                    revealCell(nr, nc);
                }
            });

            if (hitMine) {
                revealAllMines();
                gameOver(false);
            } else {
                checkWinCondition();
            }
        }
    }

    // --- Đệ quy mở ô an toàn (Flood Fill) ---
    function revealCell(r, c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        const cellData = board[r][c];
        
        if (cellData.isRevealed || cellData.isFlagged || cellData.isMine) return;

        cellData.isRevealed = true;
        revealedCount++;

        const cellElement = getCellElement(r, c);
        cellElement.classList.add('revealed');

        if (cellData.neighborMines > 0) {
            cellElement.textContent = cellData.neighborMines;
            cellElement.dataset.value = cellData.neighborMines;
        } else {
            // Nếu là ô trống (0 mìn), đệ quy mở 8 ô xung quanh
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            directions.forEach(dir => revealCell(r + dir[0], c + dir[1]));
        }
    }

    // --- Hiện toàn bộ mìn khi thua ---
    function revealAllMines() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].isMine) {
                    const cellEl = getCellElement(r, c);
                    cellEl.classList.add('revealed', 'mine');
                    // Gỡ cờ nếu có để hiện Lbeo
                    cellEl.classList.remove('flag'); 
                }
            }
        }
    }

    // --- Trạng thái kết thúc game ---
    function gameOver(isWin) {
        isGameOver = true;
        clearInterval(timerInterval);

        overlay.classList.remove('hidden');
        overlay.classList.add('flex');

        if (isWin) {
            overlayIcon.innerHTML = '<img src="/img/do-beo/win.gif" class="w-full max-w-[280px] h-auto object-contain mx-auto border-4 border-green-500 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.6)]">';
            overlayTitle.textContent = 'BẠN THÌ KINH RỒI! NHẤT BẠN DỒIIII!';
            overlayTitle.className = 'text-green-400 font-black text-2xl md:text-3xl tracking-wider px-2 text-center';
            overlayMessage.innerHTML = `<span class="text-sm font-bold text-gray-400">Hoàn thành xuất sắc trong ${timeElapsed} giây</span>`;
            btnOverlayClose.textContent = 'Nhậu Tiếp Bàn Khác!';
            
            // Có thể thêm hiệu ứng bắn pháo hoa ở đây
        } else {
            // Rung màn hình khi đánh thức Lbeo
            dobeoPlayground.classList.add('shake-screen');

            // Chữ to bay ra giữa màn hình
            const flyText = document.createElement('div');
            flyText.className = 'fly-out-text';
            flyText.innerHTML = 'Ối dời ơi!<br>Dẫm phải Lbeo rồi';
            dobeoPlayground.appendChild(flyText);
            // Dọn dẹp sau khi bay xong
            setTimeout(() => {
                if(flyText.parentNode) flyText.remove();
            }, 2500);
            
            // Phát âm thanh đánh thức Lbeo (Bỏ trong khối try-catch để tránh lỗi nếu chưa có file)
            try {
                wakeUpAudio.currentTime = 0;
                wakeUpAudio.play().catch(e => console.log('Chưa tìm thấy file audio wake-up.mp3'));
            } catch(e) {}

            overlayIcon.innerHTML = '<img src="/img/do-beo/boom.png" class="w-[14rem] h-[14rem] object-cover mx-auto">';
            overlayTitle.textContent = 'BẠN ĐÃ ĐÁNH THỨC LBEO!';
            overlayTitle.className = 'text-red-500 font-black text-3xl tracking-wider';
            overlayMessage.textContent = 'Thua rồi! Lbeo đang rất quạu!';
            btnOverlayClose.textContent = 'Chơi Lại (Uống Phạt 1 Ly)';
        }
    }

    function checkWinCondition() {
        const totalSafeCells = (rows * cols) - totalMines;
        if (revealedCount === totalSafeCells) {
            // Auto flag remaining mines
            flagsPlaced = totalMines;
            updateFlagsDisplay();
            gameOver(true);
        }
    }

    // --- Utils & Updates ---
    function getCellElement(r, c) {
        return gridElement.children[r * cols + c];
    }

    function updateFlagsDisplay() {
        const remaining = totalMines - flagsPlaced;
        flagsCountDisplay.textContent = remaining.toString().padStart(3, '0');
    }

    function updateTimerDisplay() {
        timerDisplay.textContent = timeElapsed.toString().padStart(3, '0');
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeElapsed++;
            updateTimerDisplay();
        }, 1000);
    }

    // --- Event Listeners Điều Hướng ---
    btnStartDobeo?.addEventListener('click', () => {
        if (minigameHome) minigameHome.classList.add('hidden');
        dobeoPlayground.classList.remove('hidden');
        initGame();
    });

    btnQuit.addEventListener('click', () => {
        clearInterval(timerInterval);
        if (minigameHome) {
            dobeoPlayground.classList.add('hidden');
            minigameHome.classList.remove('hidden');
        } else {
            window.location.href = '/minigame';
        }
    });

    btnRestart.addEventListener('click', initGame);
    btnOverlayClose.addEventListener('click', initGame);
    difficultySelect.addEventListener('change', initGame);

    // Auto-init on dedicated page
    if (!minigameHome) {
        dobeoPlayground.classList.remove('hidden');
        initGame();
    }
});

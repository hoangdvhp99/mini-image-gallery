/**
 * BeoHub Pikabeo Onet Connect Game Controller
 * 100% Offline-friendly, fully responsive, standard Pikachu 2003 algorithm
 */

class PikabeoGame {
    constructor() {
        // Grid sizes
        this.rows = 8;
        this.cols = 14;

        // Matrix padding of 1 cell all around (padding is empty border)
        this.grid = []; // (rows + 2) x (cols + 2)
        this.activeTileFaces = []; // Tracks unique faces (images/emojis) for the current level

        // State variables
        this.level = 1;
        this.score = 0;
        this.shuffles = 10;
        this.timeLeft = 180; // seconds
        this.maxTime = 180;
        this.timerInterval = null;
        this.selectedTile = null;
        this.soundEnabled = true;
        this.gameActive = false;

        // Asset cache
        this.secretBgUrl = '';
        this.mediaAssets = [];

        // Web Audio Context for synthesized sounds
        this.audioCtx = null;

        // Lbeo Funny SVG Templates (Fallback if gallery is empty)
        this.lbeoTemplates = [
            // 1. Vui vẻ
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><circle cx="50" cy="50" r="45" fill="#fde047" stroke="#ca8a04" stroke-width="4"/><circle cx="35" cy="40" r="5" fill="#000"/><circle cx="65" cy="40" r="5" fill="#000"/><path d="M 30,60 Q 50,75 70,60" fill="none" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="55" r="5" fill="#f43f5e" opacity="0.6"/><circle cx="75" cy="55" r="5" fill="#f43f5e" opacity="0.6"/></svg>`,
            // 2. Nháy mắt
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><circle cx="50" cy="50" r="45" fill="#fde047" stroke="#ca8a04" stroke-width="4"/><path d="M 28,40 Q 35,33 42,40" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/><circle cx="65" cy="40" r="5" fill="#000"/><path d="M 30,60 Q 50,75 70,60" fill="none" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/></svg>`,
            // 3. Đeo kính ngầu
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><circle cx="50" cy="50" r="45" fill="#fed7aa" stroke="#ea580c" stroke-width="4"/><path d="M 20,38 L 46,38 L 40,55 L 26,55 Z" fill="#000"/><path d="M 54,38 L 80,38 L 74,55 L 60,55 Z" fill="#000"/><line x1="46" y1="42" x2="54" y2="42" stroke="#000" stroke-width="4"/><path d="M 32,68 Q 50,80 68,68" fill="none" stroke="#ea580c" stroke-width="4" stroke-linecap="round"/></svg>`,
            // 4. Ngạc nhiên
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><circle cx="50" cy="50" r="45" fill="#fde047" stroke="#ca8a04" stroke-width="4"/><ellipse cx="32" cy="38" rx="5" ry="8" fill="#000"/><ellipse cx="68" cy="38" rx="5" ry="8" fill="#000"/><circle cx="50" cy="65" r="10" fill="none" stroke="#ca8a04" stroke-width="4"/></svg>`,
            // 5. Mặt quỷ cười toe
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><circle cx="50" cy="50" r="45" fill="#fbcfe8" stroke="#db2777" stroke-width="4"/><path d="M 25,35 L 40,42" stroke="#000" stroke-width="4" stroke-linecap="round"/><path d="M 75,35 L 60,42" stroke="#000" stroke-width="4" stroke-linecap="round"/><circle cx="33" cy="48" r="5" fill="#000"/><circle cx="67" cy="48" r="5" fill="#000"/><path d="M 30,62 Q 50,80 70,62" fill="none" stroke="#db2777" stroke-width="4" stroke-linecap="round"/></svg>`,
            // 6. Thèm tiền
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><circle cx="50" cy="50" r="45" fill="#bbf7d0" stroke="#16a34a" stroke-width="4"/><text x="25" y="47" font-size="20" font-weight="black" fill="#15803d">$</text><text x="57" y="47" font-size="20" font-weight="black" fill="#15803d">$</text><path d="M 30,65 Q 50,75 70,65" fill="none" stroke="#16a34a" stroke-width="4" stroke-linecap="round"/></svg>`,
            // 7. Người ngoài hành tinh
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><ellipse cx="50" cy="50" rx="42" ry="48" fill="#cbd5e1" stroke="#475569" stroke-width="4"/><ellipse cx="30" cy="40" rx="12" ry="7" fill="#000" transform="rotate(-15 30 40)"/><ellipse cx="70" cy="40" rx="12" ry="7" fill="#000" transform="rotate(15 70 40)"/><path d="M 40,75 Q 50,80 60,75" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/></svg>`,
            // 8. Tinh hoa đỏ trán
            `<svg viewBox="0 0 100 100" class="pikabeo-tile-svg"><circle cx="50" cy="50" r="45" fill="#fef08a" stroke="#ca8a04" stroke-width="4"/><circle cx="35" cy="42" r="5" fill="#000"/><circle cx="65" cy="42" r="5" fill="#000"/><path d="M 35,62 Q 50,72 65,62" fill="none" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="22" r="5" fill="#ef4444"/></svg>`
        ];
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btnStartPikabeo').addEventListener('click', () => this.startGame());
        document.getElementById('btnPikaSound').addEventListener('click', () => this.toggleSound());
        document.getElementById('btnPikaShuffle').addEventListener('click', () => this.manualShuffle());
        document.getElementById('btnPikaRestart').addEventListener('click', () => this.restartGame());
        document.getElementById('btnPikaQuit').addEventListener('click', () => this.quitGame());

        // Listen to Admin Secret Uploads
        const fileInput = document.getElementById('secretImageFile');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleSecretUpload(e));
        }

        // Handle window resize dynamically to adjust board cells size
        window.addEventListener('resize', () => {
            if (this.gameActive) {
                this.resizeCanvas();
            }
        });
    }

    // Play offline-synthesized Web Audio tones
    playSound(type) {
        if (!this.soundEnabled) return;
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            const now = this.audioCtx.currentTime;

            if (type === 'select') {
                // Short light tap tone
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'match') {
                // Synthesized Ting-Ting sound!
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1046.50, now); // C6
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);

                const osc2 = this.audioCtx.createOscillator();
                const gain2 = this.audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(this.audioCtx.destination);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
                gain2.gain.setValueAtTime(0.12, now + 0.08);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc2.start(now + 0.08);
                osc2.stop(now + 0.35);
            } else if (type === 'shuffle') {
                // Rushing frequency sweep sound
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'error') {
                // Double low pitch buzz
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(120, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'win') {
                // High-pitched glorious fanfare
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, index) => {
                    const o = this.audioCtx.createOscillator();
                    const g = this.audioCtx.createGain();
                    o.connect(g);
                    g.connect(this.audioCtx.destination);
                    o.type = 'sine';
                    o.frequency.setValueAtTime(freq, now + index * 0.1);
                    g.gain.setValueAtTime(0.1, now + index * 0.1);
                    g.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.4);
                    o.start(now + index * 0.1);
                    o.stop(now + index * 0.1 + 0.4);
                });
            } else if (type === 'gameover') {
                // Downward tragic sound
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(60, now + 0.8);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
                osc.start(now);
                osc.stop(now + 0.8);
            }
        } catch (e) {
            console.error('Lỗi khi phát âm thanh Web Audio:', e);
        }
    }

    // Toggle sound
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const btn = document.getElementById('btnPikaSound');
        const icon = document.getElementById('pikaSoundIcon');
        if (this.soundEnabled) {
            btn.classList.remove('text-neutral-500');
            btn.classList.add('text-white');
            icon.innerText = '🔊';
            btn.innerHTML = `<span>🔊</span> Âm Thanh: Bật`;
        } else {
            btn.classList.remove('text-white');
            btn.classList.add('text-neutral-500');
            icon.innerText = '🔇';
            btn.innerHTML = `<span>🔇</span> Âm Thanh: Tắt`;
        }
        this.playSound('select');
    }

    // Start / Load the Pikabeo Game
    async startGame() {
        this.playSound('select');

        // Expand the container to take maximum screen width when playing
        const container = document.getElementById('minigameContainer');
        if (container) {
            container.classList.remove('max-w-4xl');
            container.classList.add('max-w-[95vw]');
        }

        // Check viewport size to determine responsive grid rows & columns
        if (window.innerWidth < 768) {
            this.rows = 6;
            this.cols = 10;
        } else {
            this.rows = 8;
            this.cols = 14;
        }

        // Reset score & levels
        this.level = 1;
        this.score = 0;
        this.shuffles = 10;
        this.timeLeft = 180;
        this.maxTime = 180;
        this.selectedTile = null;

        // Hide main section, show playground
        document.getElementById('minigameHome').classList.add('hidden');
        document.getElementById('pikabeoPlayground').classList.remove('hidden');

        // Fetch Admin uploaded secret image random reward
        await this.loadSecretReward();

        // Fetch media lists to load tiles icons
        await this.loadTilesAssets();

        this.gameActive = true;
        this.setupNewLevel();
        this.startTimer();
    }

    // Load random secret reward image
    async loadSecretReward() {
        try {
            const res = await fetch('/api/pikabeo/secrets/random');
            const data = await res.json();
            if (data.success) {
                this.secretBgUrl = data.url;

                // Set the secret background
                const secretBg = document.getElementById('pikabeoSecretBg');
                secretBg.style.backgroundImage = `url('${this.secretBgUrl}')`;
                secretBg.style.opacity = '0'; // keep hidden initially
            }
        } catch (e) {
            console.error('Lỗi khi tải ảnh bí mật:', e);
            // Default fallback
            this.secretBgUrl = '/img/default_secrets/secret_1.svg';
        }
    }

    // Fetch BeoHub media to populate tile icons
    async loadTilesAssets() {
        try {
            const res = await fetch('/api/images');
            const media = await res.json();

            // Filter only image elements based on common file extensions
            const imagesOnly = media.filter(item => {
                const url = (item.url || '').toLowerCase();
                return url.endsWith('.png') ||
                    url.endsWith('.jpg') ||
                    url.endsWith('.jpeg') ||
                    url.endsWith('.webp') ||
                    url.endsWith('.gif') ||
                    url.endsWith('.svg');
            });

            if (imagesOnly.length > 0) {
                // Use actual gallery images as card faces! Standardise to relative urls
                this.mediaAssets = imagesOnly.map(img => img.url);
            } else {
                this.mediaAssets = []; // fallback to funny Lbeo SVGs
            }
        } catch (e) {
            console.error('Lỗi khi quét ảnh media:', e);
            this.mediaAssets = [];
        }
    }

    // Configure grid arrays, fill pairs and shuffle
    setupNewLevel() {
        document.getElementById('pikaLevel').innerText = this.level;
        document.getElementById('pikaShuffles').innerText = this.shuffles;
        document.getElementById('pikaScore').innerText = this.score;

        // 1. Initialize padded matrix representation
        // (rows + 2) x (cols + 2) padded with 0 (empty outer cells)
        this.grid = Array(this.rows + 2).fill(null).map(() => Array(this.cols + 2).fill(0));

        // 2. Prepare unique tile faces for this level (guarantee exactly 1 pair per card face)
        const totalActiveCells = this.rows * this.cols;
        const totalPairs = totalActiveCells / 2;

        // Shuffle gallery images to pick random ones for this session
        let galleryPool = [...this.mediaAssets];
        this.shuffleArray(galleryPool);

        this.activeTileFaces = [];

        // Fill with unique gallery images first
        const numGalleryToUse = Math.min(totalPairs, galleryPool.length);
        for (let i = 0; i < numGalleryToUse; i++) {
            this.activeTileFaces.push({
                type: 'image',
                value: galleryPool[i]
            });
        }

        // Fill the rest with unique high-quality emojis if gallery has fewer images than totalPairs
        if (this.activeTileFaces.length < totalPairs) {
            const needed = totalPairs - this.activeTileFaces.length;
            let emojiPool = [
                '🐱', '🐶', '🦊', '🐯', '🦁', '🐮', '🐷', '🐵', '🐔', '🐧', 
                '🐦', '🐸', '🐙', '🦑', '🐝', '🐞', '🦋', '🐢', '🐍', '🐬', 
                '🐳', '🐠', '🦀', '🦞', '🦖', '🦄', '🐨', '🐼', '🐺', '🐗', 
                '🐴', '🐑', '🐐', '🐪', '🐘', '🦏', '🦍', '🐁', '🐇', '🐿', 
                '🦔', '🦇', '🦉', '🦅', '🦆', 'Swan', '🦩', '🦎', '🦈', '🐡',
                '🍯', '🍒', '🍓', '🍑', '🍋', '🍍', '🥥', '🥝', '🍅', '🍆',
                '🥑', '🥦', '🍔', '🍕', '🍟', '🥪', '🌮', '🍿', '🍩', '🍪',
                '🧁', '🍫', '🍬', '🍭', '🍨', '🎨', '🚀', '🛸', '🎸', '⚽'
            ];
            this.shuffleArray(emojiPool);
            
            for (let i = 0; i < needed; i++) {
                this.activeTileFaces.push({
                    type: 'emoji',
                    value: emojiPool[i % emojiPool.length]
                });
            }
        }

        // Generate tilesPool with exactly 2 of each unique type (1 to totalPairs)
        let tilesPool = [];
        for (let i = 1; i <= totalPairs; i++) {
            tilesPool.push(i);
            tilesPool.push(i);
        }

        // Shuffle pool
        this.shuffleArray(tilesPool);

        // 3. Fill internal board grid (from row 1 to rows, col 1 to cols)
        let idx = 0;
        for (let r = 1; r <= this.rows; r++) {
            for (let c = 1; c <= this.cols; c++) {
                this.grid[r][c] = tilesPool[idx++];
            }
        }

        // 4. Verify board has at least one valid move, if not, shuffle automatically!
        let safety = 0;
        while (!this.hasValidMove() && safety < 100) {
            this.shuffleBoardData();
            safety++;
        }

        // 5. Render dynamically
        this.renderBoard();
        this.resizeCanvas();

        // Clear secret bg reveal opacity
        document.getElementById('pikabeoSecretBg').style.opacity = '0.05'; // very slight hint
    }

    // Shuffle simple JS Array
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // Shuffle active board values
    shuffleBoardData() {
        let activeTiles = [];
        for (let r = 1; r <= this.rows; r++) {
            for (let c = 1; c <= this.cols; c++) {
                if (this.grid[r][c] !== 0) {
                    activeTiles.push(this.grid[r][c]);
                }
            }
        }
        this.shuffleArray(activeTiles);

        let idx = 0;
        for (let r = 1; r <= this.rows; r++) {
            for (let c = 1; c <= this.cols; c++) {
                if (this.grid[r][c] !== 0) {
                    this.grid[r][c] = activeTiles[idx++];
                }
            }
        }
    }

    // Render active board grid dynamically
    renderBoard() {
        const gridContainer = document.getElementById('pikabeoGrid');
        gridContainer.innerHTML = '';

        // Setup Grid templates
        gridContainer.style.gridTemplateRows = `repeat(${this.rows}, minmax(0, 1fr))`;
        gridContainer.style.gridTemplateColumns = `repeat(${this.cols}, minmax(0, 1fr))`;

        for (let r = 1; r <= this.rows; r++) {
            for (let c = 1; c <= this.cols; c++) {
                const type = this.grid[r][c];
                const tileWrapper = document.createElement('div');
                tileWrapper.className = 'pikabeo-tile-wrapper aspect-square w-full h-full';
                tileWrapper.dataset.row = r;
                tileWrapper.dataset.col = c;

                if (type !== 0) {
                    const tile = document.createElement('div');
                    tile.className = 'pikabeo-tile';

                    // Render active unique tile face
                    if (this.activeTileFaces && this.activeTileFaces[type - 1]) {
                        const face = this.activeTileFaces[type - 1];
                        if (face.type === 'image') {
                            const img = document.createElement('img');
                            img.src = face.value;
                            img.className = 'pikabeo-tile-img';
                            tile.appendChild(img);
                        } else {
                            // Render high-quality fallback emoji
                            tile.innerHTML = `<span style="font-size: 1.8rem; pointer-events: none; user-select: none;">${face.value}</span>`;
                        }
                    }

                    tileWrapper.appendChild(tile);

                    // Register click listener
                    tileWrapper.addEventListener('click', () => this.handleTileClick(r, c));
                }

                gridContainer.appendChild(tileWrapper);
            }
        }
    }

    // Click handler
    handleTileClick(r, c) {
        if (!this.gameActive) return;

        const tileEl = this.getTileDOM(r, c);
        if (!tileEl) return;

        // If clicked on already matched tile, do nothing
        if (this.grid[r][c] === 0) return;

        this.playSound('select');

        if (!this.selectedTile) {
            // First select
            this.selectedTile = { r, c };
            tileEl.classList.add('selected');
        } else {
            // Second select
            const first = this.selectedTile;
            const firstEl = this.getTileDOM(first.r, first.c);

            // Clicked same cell - deselect
            if (first.r === r && first.c === c) {
                tileEl.classList.remove('selected');
                this.selectedTile = null;
                return;
            }

            // Verify they have the same type
            const type1 = this.grid[first.r][first.c];
            const type2 = this.grid[r][c];

            if (type1 === type2) {
                // Find path
                const path = this.findOnetPath(first.r, first.c, r, c);
                if (path) {
                    // Match found!
                    this.playSound('match');

                    // Draw glowing line connecting them!
                    this.drawLightningPath(path);

                    // Mark grid space empty
                    this.grid[first.r][first.c] = 0;
                    this.grid[r][c] = 0;

                    // Match animations
                    firstEl.classList.remove('selected');
                    firstEl.classList.add('matched');
                    tileEl.classList.add('matched');

                    // Score increase
                    this.score += 100;
                    document.getElementById('pikaScore').innerText = this.score;

                    // Add time bonus (max 180s)
                    this.timeLeft = Math.min(this.maxTime, this.timeLeft + 8);
                    this.updateTimerUI();

                    this.selectedTile = null;

                    // Check win state
                    if (this.isBoardCleared()) {
                        this.handleWin();
                    } else {
                        // Verify moves left
                        if (!this.hasValidMove()) {
                            setTimeout(() => this.autoShuffle(), 500);
                        }
                    }
                } else {
                    // No match path
                    this.playSound('error');
                    firstEl.classList.remove('selected');
                    this.selectedTile = { r, c };
                    tileEl.classList.add('selected');
                }
            } else {
                // Different types
                this.playSound('error');
                firstEl.classList.remove('selected');
                this.selectedTile = { r, c };
                tileEl.classList.add('selected');
            }
        }
    }

    // Get DOM element for a tile
    getTileDOM(r, c) {
        const wrapper = document.querySelector(`.pikabeo-tile-wrapper[data-row="${r}"][data-col="${c}"]`);
        return wrapper ? wrapper.querySelector('.pikabeo-tile') : null;
    }

    // Check if board is cleared
    isBoardCleared() {
        for (let r = 1; r <= this.rows; r++) {
            for (let c = 1; c <= this.cols; c++) {
                if (this.grid[r][c] !== 0) return false;
            }
        }
        return true;
    }

    // ================= Onet Connect Pathfinding Algorithm =================

    /**
     * Standard Pikachu Onet Connect BFS Pathfinder.
     * Finds a path from (r1, c1) to (r2, c2) with at most 2 turns (3 straight segments).
     * Routes smoothly through empty borders because the grid array is padded.
     */
    findOnetPath(r1, c1, r2, c2) {
        // Queue state: { r, c, dir, turns, path }
        // dir: 0: up, 1: right, 2: down, 3: left, -1: start
        const queue = [];

        // Visited tracking: visited[r][c][dir][turns] = boolean
        const rowsCount = this.rows + 2;
        const colsCount = this.cols + 2;

        const visited = Array(rowsCount).fill(null).map(() =>
            Array(colsCount).fill(null).map(() =>
                Array(4).fill(null).map(() => Array(3).fill(false))
            )
        );

        // Directions vectors
        const dr = [-1, 0, 1, 0];
        const dc = [0, 1, 0, -1];

        // Push start nodes in all 4 directions
        for (let d = 0; d < 4; d++) {
            const nr = r1 + dr[d];
            const nc = c1 + dc[d];

            if (nr >= 0 && nr < rowsCount && nc >= 0 && nc < colsCount) {
                if (nr === r2 && nc === c2) {
                    return [[r1, c1], [r2, c2]];
                }
                if (this.grid[nr][nc] === 0) {
                    queue.push({
                        r: nr,
                        c: nc,
                        dir: d,
                        turns: 0,
                        path: [[r1, c1], [nr, nc]]
                    });
                    visited[nr][nc][d][0] = true;
                }
            }
        }

        while (queue.length > 0) {
            const curr = queue.shift();

            // Destination reached!
            if (curr.r === r2 && curr.c === c2) {
                return curr.path;
            }

            // Search neighbors
            for (let d = 0; d < 4; d++) {
                const nr = curr.r + dr[d];
                const nc = curr.c + dc[d];

                if (nr >= 0 && nr < rowsCount && nc >= 0 && nc < colsCount) {
                    // Check turn count
                    const newTurns = curr.dir === d ? curr.turns : curr.turns + 1;

                    if (newTurns <= 2) {
                        // Check if block is empty or is target
                        if (this.grid[nr][nc] === 0 || (nr === r2 && nc === c2)) {
                            if (!visited[nr][nc][d][newTurns]) {
                                visited[nr][nc][d][newTurns] = true;
                                queue.push({
                                    r: nr,
                                    c: nc,
                                    dir: d,
                                    turns: newTurns,
                                    path: [...curr.path, [nr, nc]]
                                });
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    // Verify if there is at least one active pair that can be connected
    hasValidMove() {
        // Collect all active tiles with coordinates
        const activeList = [];
        for (let r = 1; r <= this.rows; r++) {
            for (let c = 1; c <= this.cols; c++) {
                if (this.grid[r][c] !== 0) {
                    activeList.push({ r, c, type: this.grid[r][c] });
                }
            }
        }

        // Compare all pairs of same type
        for (let i = 0; i < activeList.length; i++) {
            for (let j = i + 1; j < activeList.length; j++) {
                const a = activeList[i];
                const b = activeList[j];

                if (a.type === b.type) {
                    const path = this.findOnetPath(a.r, a.c, b.r, b.c);
                    if (path) {
                        return true; // Valid move exists!
                    }
                }
            }
        }
        return false;
    }

    // Auto shuffle board when no moves left
    autoShuffle() {
        if (!this.gameActive) return;

        if (this.shuffles <= 0) {
            // No shuffles left, lose condition
            this.handleGameOver();
            return;
        }

        this.shuffles--;
        document.getElementById('pikaShuffles').innerText = this.shuffles;
        this.playSound('shuffle');
        showToast('🔄 Không còn nước đi khả dụng! Tự động đổi vị trí bài...', 'info');

        let safety = 0;
        while (!this.hasValidMove() && safety < 100) {
            this.shuffleBoardData();
            safety++;
        }

        this.renderBoard();
    }

    // Manual shuffle clicked by user
    manualShuffle() {
        this.playSound('select');
        if (!this.gameActive) return;

        if (this.shuffles <= 0) {
            showToast('⚠️ Bạn đã hết lượt đổi vị trí bài!', 'error');
            return;
        }

        this.shuffles--;
        document.getElementById('pikaShuffles').innerText = this.shuffles;
        this.playSound('shuffle');

        let safety = 0;
        while (!this.hasValidMove() && safety < 100) {
            this.shuffleBoardData();
            safety++;
        }

        this.renderBoard();
    }

    // ================= Neon Canvas drawing of paths =================

    resizeCanvas() {
        const board = document.getElementById('pikabeoBoard');
        const canvas = document.getElementById('pikabeoCanvas');
        if (board && canvas) {
            canvas.width = board.clientWidth;
            canvas.height = board.clientHeight;
        }
    }

    drawLightningPath(path) {
        const canvas = document.getElementById('pikabeoCanvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear previous
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Convert path grid indices into absolute canvas coordinates
        const coords = path.map(([r, c]) => this.getCellCenterCoords(r, c));

        // Draw neon glow path lines
        let alpha = 1.0;
        const fadeInterval = setInterval(() => {
            if (alpha <= 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                clearInterval(fadeInterval);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.moveTo(coords[0].x, coords[0].y);

            for (let i = 1; i < coords.length; i++) {
                ctx.lineTo(coords[i].x, coords[i].y);
            }

            // Neon stroke glow settings
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Background thick neon shadow lines
            ctx.shadowBlur = 16;
            ctx.shadowColor = '#ff9900';
            ctx.strokeStyle = `rgba(255, 153, 0, ${alpha * 0.7})`;
            ctx.lineWidth = 6;
            ctx.stroke();

            // Inner intense white core line
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            alpha -= 0.15; // fade speed
        }, 30);
    }

    // Calculate center coordinates of a grid cell
    getCellCenterCoords(r, c) {
        const gridEl = document.getElementById('pikabeoGrid');
        const wrapper = document.querySelector(`.pikabeo-tile-wrapper[data-row="${r}"][data-col="${c}"]`);

        if (wrapper && gridEl) {
            const gridRect = gridEl.getBoundingClientRect();
            const cellRect = wrapper.getBoundingClientRect();

            const x = (cellRect.left - gridRect.left) + cellRect.width / 2;
            const y = (cellRect.top - gridRect.top) + cellRect.height / 2;

            return { x, y };
        }

        // Safe padding calculation outside boundary boxes
        // If coordinate routes outside active boundaries, estimate it
        const cellWidth = gridEl.clientWidth / this.cols;
        const cellHeight = gridEl.clientHeight / this.rows;

        const x = (c - 0.5) * cellWidth;
        const y = (r - 0.5) * cellHeight;
        return { x, y };
    }

    // ================= Timer controller =================

    startTimer() {
        this.stopTimer();
        this.timeLeft = this.maxTime;
        this.updateTimerUI();

        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerUI();

            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.handleGameOver();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerUI() {
        const timerBar = document.getElementById('pikaTimerBar');
        if (timerBar) {
            const percentage = (this.timeLeft / this.maxTime) * 100;
            timerBar.style.width = `${percentage}%`;

            // Adjust timer bar colors based on remaining time percentage
            if (percentage > 50) {
                timerBar.className = "h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all duration-100";
            } else if (percentage > 20) {
                timerBar.className = "h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-100";
            } else {
                timerBar.className = "h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-full transition-all duration-100 animate-pulse";
            }
        }
    }

    // ================= Victory & Defeat overlays =================

    handleWin() {
        this.stopTimer();
        this.gameActive = false;
        this.playSound('win');

        // Fade in the secret reward background image 100%!
        const secretBg = document.getElementById('pikabeoSecretBg');
        secretBg.style.opacity = '1';

        // Render gorgeous success panel
        setTimeout(() => {
            const gridContainer = document.getElementById('pikabeoGrid');
            gridContainer.innerHTML = `
                <div class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-6 space-y-4 backdrop-blur-md rounded-2xl z-30 border border-amber-500/30 animate-pulse">
                    <span class="text-4xl">🏆👑</span>
                    <h2 class="text-xl md:text-2xl font-black text-amber-400 uppercase tracking-widest">GIẢI MÃ THÀNH CÔNG!</h2>
                    <p class="text-xs text-gray-300 max-w-sm leading-relaxed">
                        Bạn thật xuất sắc khi chinh phục toàn bộ câu đố và mở khóa thành công **Ảnh Bí Mật Của Lbeo**!
                    </p>
                    <div class="flex flex-col sm:flex-row gap-3 pt-2">
                        <a href="${this.secretBgUrl}" download="lbeo_bi_mat.webp" class="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl font-black text-xs tracking-wider transition shadow-lg shadow-amber-500/10">
                            📥 TẢI ẢNH BÍ MẬT VỀ MÁY
                        </a>
                        <button onclick="pikaGame.advanceLevel()" class="bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 rounded-xl font-black text-xs tracking-wider transition shadow-lg shadow-emerald-500/10">
                            TIẾP TỤC BÀN MỚI ⏭️
                        </button>
                    </div>
                </div>
            `;
        }, 800);
    }

    advanceLevel() {
        this.level++;
        this.shuffles = Math.min(15, this.shuffles + 2); // reward extra shuffles
        this.timeLeft = Math.max(90, 180 - (this.level * 15)); // level gets faster
        this.maxTime = this.timeLeft;
        this.selectedTile = null;

        // Fetch another new secret image random reward
        this.loadSecretReward().then(() => {
            this.gameActive = true;
            this.setupNewLevel();
            this.startTimer();
        });
    }

    handleGameOver() {
        this.stopTimer();
        this.gameActive = false;
        this.playSound('gameover');

        // Reveal background partially
        document.getElementById('pikabeoSecretBg').style.opacity = '0.3';

        const gridContainer = document.getElementById('pikabeoGrid');
        gridContainer.innerHTML = `
            <div class="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 space-y-4 backdrop-blur-md rounded-2xl z-30 border border-red-500/20">
                <span class="text-4xl">⏱️💔</span>
                <h2 class="text-xl font-black text-red-500 uppercase tracking-widest">GAME OVER</h2>
                <p class="text-xs text-gray-300 max-w-sm leading-relaxed">
                    Đã hết thời gian chơi hoặc hết nước cờ khả dụng. Đừng nản chí nhé!
                </p>
                <div class="flex gap-3 pt-2">
                    <button onclick="pikaGame.restartGame()" class="bg-red-500 hover:bg-red-400 text-white px-5 py-2.5 rounded-xl font-black text-xs tracking-wider transition shadow-lg shadow-red-500/10">
                        CHƠI LẠI BÀN NÀY 🔄
                    </button>
                    <button onclick="pikaGame.quitGame()" class="bg-neutral-800 hover:bg-neutral-700 text-gray-400 px-5 py-2.5 rounded-xl font-black text-xs tracking-wider transition border border-neutral-700">
                        🚪 THOÁT GAME
                    </button>
                </div>
            </div>
        `;
    }

    restartGame() {
        this.playSound('select');
        this.selectedTile = null;
        this.shuffles = 10;
        this.score = 0;
        this.timeLeft = 180;
        this.maxTime = 180;

        this.loadSecretReward().then(() => {
            this.gameActive = true;
            this.setupNewLevel();
            this.startTimer();
        });
    }

    quitGame() {
        this.playSound('select');
        this.stopTimer();
        this.gameActive = false;
        this.selectedTile = null;

        // Restore the container width back to 4xl when exiting the game
        const container = document.getElementById('minigameContainer');
        if (container) {
            container.classList.remove('max-w-[95vw]');
            container.classList.add('max-w-4xl');
        }

        // Switch sections
        document.getElementById('pikabeoPlayground').classList.add('hidden');
        document.getElementById('minigameHome').classList.remove('hidden');
    }

    // ================= Admin Secret Image upload and management =================

    async loadAdminSecretsList() {
        const container = document.getElementById('adminSecretsList');
        if (!container) return;

        try {
            const res = await fetch('/api/pikabeo/secrets?isLbeo=0');
            const data = await res.json();
            if (data.success) {
                container.innerHTML = '';

                if (data.secrets.length === 0) {
                    container.innerHTML = `
                        <div class="col-span-full py-6 text-center text-xs text-neutral-600 font-medium">
                            Kho ảnh trống! Hệ thống đang dùng 5 ảnh Lbeo mặc định có sẵn.
                        </div>
                    `;
                    return;
                }

                data.secrets.forEach(sec => {
                    const card = document.createElement('div');
                    card.className = 'relative aspect-square rounded-lg border border-neutral-850 overflow-hidden group/sec shadow-inner';
                    card.innerHTML = `
                        <img src="${sec.url}" class="w-full h-full object-cover" alt="Secret Image">
                        <button onclick="pikaGame.deleteSecretImage('${sec.name}')" class="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-500 text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition shadow-md opacity-0 group-hover/sec:opacity-100">
                            &times;
                        </button>
                    `;
                    container.appendChild(card);
                });
            }
        } catch (e) {
            console.error('Lỗi khi tải kho ảnh bí mật:', e);
        }
    }

    async handleSecretUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('secretImage', file);

        try {
            showToast('📤 Đang tải ảnh bí mật lên...', 'info');
            const res = await fetch('/api/pikabeo/secrets?isLbeo=0', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Đã thêm ảnh bí mật thành công vào kho lưu trữ!', 'success');
                this.loadAdminSecretsList();
            } else {
                showToast(`❌ Lỗi: ${data.message}`, 'error');
            }
        } catch (err) {
            console.error('Lỗi upload ảnh bí ẩn:', err);
            showToast('❌ Gặp lỗi khi gửi ảnh lên máy chủ!', 'error');
        } finally {
            // clear input
            e.target.value = '';
        }
    }

    async deleteSecretImage(name) {
        if (!confirm('Bạn có chắc chắn muốn xóa ảnh bí mật này khỏi kho lưu trữ?')) return;

        try {
            showToast('🗑️ Đang xóa ảnh bí mật...', 'info');
            const res = await fetch(`/api/pikabeo/secrets/${name}?isLbeo=0`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Đã xóa ảnh bí mật thành công!', 'success');
                this.loadAdminSecretsList();
            } else {
                showToast('❌ Không thể xóa ảnh bí ẩn!', 'error');
            }
        } catch (e) {
            console.error('Lỗi khi xóa ảnh bí ẩn:', e);
            showToast('❌ Gặp lỗi kết nối khi xóa ảnh!', 'error');
        }
    }
}

// Global instances
const pikaGame = new PikabeoGame();
window.pikaGame = pikaGame;
document.addEventListener('DOMContentLoaded', () => pikaGame.init());

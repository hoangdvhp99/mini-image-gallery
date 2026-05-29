(function() {
class FlappyGame {
    constructor() {
        this.canvas = document.getElementById('flappyCanvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('flappyScore');
        this.highScoreElement = document.getElementById('flappyHighScore');
        this.overlay = document.getElementById('flappyOverlay');
        this.statusText = document.getElementById('flappyStatusText');

        // Modal UI Elements
        this.nameModal = document.getElementById('flappyNameModal');
        this.inputName = document.getElementById('flappyInputName');
        this.leaderboardOverlay = document.getElementById('flappyLeaderboardOverlay');
        this.leaderboardList = document.getElementById('flappyLeaderboardList');

        // Player Info
        this.playerName = localStorage.getItem('beoFlappyPlayerName') || '';

        // Game state
        this.isPlaying = false;
        this.isGameOver = false;
        this.score = 0;
        this.highScore = localStorage.getItem('beoFlappyHighScore') || 0;
        this.highScoreElement.innerText = this.highScore.toString().padStart(5, '0');

        // Physics Configurations
        this.gravity = 0.38;
        this.flapPower = -7.2;
        this.gameSpeed = 3.6;
        this.pipes = [];
        this.beers = [];
        this.clouds = [];
        this.frameCount = 0;
        this.pipeSpawnInterval = 135; // Frames between pipe spawns
        
        // Background images
        this.sunImg = new Image();
        this.sunImg.src = '/img/beo-dino/items/sun.png';
        this.moonImg = new Image();
        this.moonImg.src = '/img/beo-dino/items/moon.png';

        // Load characters (Shared assets with Dino)
        this.totalCharacters = 0;
        this.sprites = [];
        this.spritesLoaded = 0;
        
        // Items (Beer files)
        this.beerSprites = [];
        this.beersLoaded = 0;
        this.foodFiles = [];

        // Player Bird Object
        this.player = {
            x: 100,
            y: 200,
            width: 60,
            height: 60,
            velocityY: 0,
            characterIndex: 5 // Default index 5 (Character 6)
        };

        // Resize Canvas
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initialize clouds
        for (let i = 0; i < 4; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * (this.canvas.height * 0.4),
                speed: 0.3 + Math.random() * 0.4,
                scale: 0.4 + Math.random() * 0.5
            });
        }

        // Binds event listeners
        this.bindEvents();
        this.setupModals();
        this.initCharacters();
    }

    async initCharacters() {
        try {
            const [charRes, itemsRes] = await Promise.all([
                fetch('/api/dino/characters/count'),
                fetch('/api/dino/items/count')
            ]);
            const charData = await charRes.json();
            const itemsData = await itemsRes.json();
            
            if (charData.success && charData.count > 0) {
                this.totalCharacters = charData.count;
            } else {
                this.totalCharacters = 9;
            }

            if (itemsData.success) {
                this.foodFiles = itemsData.food || [];
            } else {
                this.foodFiles = [];
            }
        } catch (e) {
            this.totalCharacters = 9;
            this.foodFiles = [];
        }

        const checkAllLoaded = () => {
            if (this.spritesLoaded === this.totalCharacters && this.beersLoaded === this.foodFiles.length) {
                this.initCharSelector();
                if (this.player.characterIndex >= this.totalCharacters) {
                    this.player.characterIndex = 0;
                }
                this.draw();
            }
        };

        // Load Player sprites
        for (let i = 1; i <= this.totalCharacters; i++) {
            let img = new Image();
            img.src = `/img/beo-dino/characters/${i}.png`;
            const onLoadOrError = () => {
                this.spritesLoaded++;
                checkAllLoaded();
            };
            img.onload = onLoadOrError;
            img.onerror = onLoadOrError;
            this.sprites.push(img);
        }

        // Load Beer files
        if (this.foodFiles.length > 0) {
            for (let i = 0; i < this.foodFiles.length; i++) {
                let img = new Image();
                img.src = `/img/beo-dino/food/${this.foodFiles[i]}`;
                img.onload = () => { this.beersLoaded++; checkAllLoaded(); };
                img.onerror = () => { this.beersLoaded++; checkAllLoaded(); };
                this.beerSprites.push(img);
            }
        } else {
            // Backup static beer image loading
            let img = new Image();
            img.src = '/img/beer.png'; 
            img.onload = () => { this.beersLoaded = 0; checkAllLoaded(); };
            img.onerror = () => { this.beersLoaded = 0; checkAllLoaded(); };
        }
    }

    playSound(type) {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            if (type === 'jump') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(450, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.12);
                gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.12);
            } else if (type === 'item') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, audioCtx.currentTime);
                osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.08);
                osc.frequency.setValueAtTime(1500, audioCtx.currentTime + 0.16);
                gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.25);
            } else if (type === 'die') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, audioCtx.currentTime);
                osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.35);
                gainNode.gain.setValueAtTime(0.18, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.35);
            }
        } catch (e) {
            console.log("Audio synthesis error", e);
        }
    }

    setupModals() {
        const btnSubmit = document.getElementById('btnFlappyNameSubmit');
        const btnCancel = document.getElementById('btnFlappyNameCancel');
        const btnLeaderboard = document.getElementById('btnFlappyShowLeaderboard');
        const btnCloseLeaderboard = document.getElementById('btnFlappyCloseLeaderboard');

        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                const name = this.inputName.value.trim();
                if (name) {
                    this.playerName = name;
                    localStorage.setItem('beoFlappyPlayerName', name);
                    this.nameModal.classList.add('hidden');
                    this.start();
                } else {
                    if (window.showToast) window.showToast('Vui lòng điền tên Phi công!', 'error');
                }
            });
        }
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                this.nameModal.classList.add('hidden');
            });
        }
        if (btnLeaderboard) {
            btnLeaderboard.addEventListener('click', () => {
                this.loadLeaderboard();
                this.leaderboardOverlay.classList.remove('hidden');
            });
        }
        if (btnCloseLeaderboard) {
            btnCloseLeaderboard.addEventListener('click', () => {
                this.leaderboardOverlay.classList.add('hidden');
                if (this.isGameOver) {
                    this.isGameOver = false;
                    this.needsResetOptions = true;
                    this.overlay.style.opacity = '1';
                    if (this.statusText) this.statusText.innerText = 'NHẤN SPACE ĐỂ BAY LẠI';
                }
            });
        }
    }

    async loadLeaderboard() {
        if (!this.leaderboardList) return;
        this.leaderboardList.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-neutral-600 font-medium">Đang tải bảng xếp hạng...</td></tr>';

        try {
            const res = await fetch('/api/flappy/scores/leaderboard');
            const data = await res.json();

            if (data.success) {
                this.leaderboardList.innerHTML = '';
                if (data.leaderboard.length === 0) {
                    this.leaderboardList.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-neutral-600">Chưa có kỷ lục bay nào. Hãy mở màn!</td></tr>';
                    return;
                }

                const headerRow = this.leaderboardList.closest('table').querySelector('thead tr');
                if (window.isAdmin && headerRow && !headerRow.querySelector('.admin-col')) {
                    const th = document.createElement('th');
                    th.className = 'py-5 px-6 text-center admin-col w-24';
                    th.innerText = 'Xóa';
                    headerRow.appendChild(th);
                }

                data.leaderboard.forEach((item, index) => {
                    const tr = document.createElement('tr');
                    let rankIcon = `#${index + 1}`;
                    if (index === 0) rankIcon = '🥇';
                    else if (index === 1) rankIcon = '🥈';
                    else if (index === 2) rankIcon = '🥉';

                    tr.innerHTML = `
                        <td class="py-4 px-4 text-center ${index < 3 ? 'text-amber-400 text-xl font-black' : 'text-gray-400 text-base'}">${rankIcon}</td>
                        <td class="py-4 px-4 ${index === 0 ? 'text-amber-400 font-black text-lg' : 'text-gray-200 text-base font-bold'}">${item.playerName}</td>
                        <td class="py-4 px-6 text-right text-orange-400 font-mono text-lg font-black">${item.score}</td>
                        ${window.isAdmin ? `<td class="py-4 px-6 text-center"><button onclick="window.beoFlappyGame.deleteScore('${item.id}')" class="text-red-500 hover:text-red-400 px-2 py-1 rounded transition text-xl">❌</button></td>` : ''}
                    `;
                    this.leaderboardList.appendChild(tr);
                });
            }
        } catch (e) {
            this.leaderboardList.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-red-500">Lỗi tải bảng xếp hạng</td></tr>';
        }
    }

    async deleteScore(id) {
        if (!confirm('⚠️ Xóa kỷ lục bay này khỏi bảng xếp hạng?')) return;
        try {
            const res = await fetch(`/api/flappy/scores/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                if (window.showToast) window.showToast('🗑️ Đã xóa kỷ lục thành công!', 'success');
                this.loadLeaderboard();
            } else {
                if (window.showToast) window.showToast('⚠️ Lỗi: ' + data.message, 'error');
            }
        } catch (e) {
            console.error('Lỗi khi xóa kỷ lục:', e);
            if (window.showToast) window.showToast('⚠️ Lỗi kết nối máy chủ!', 'error');
        }
    }

    async submitScore() {
        if (!this.playerName || this.score === 0) return;

        try {
            const res = await fetch('/api/flappy/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName: this.playerName,
                    score: this.score
                })
            });
            const data = await res.json();
            if (data.success) {
                if (window.showToast) {
                    if (data.rank <= 10) {
                        window.showToast(`Cực đỉnh! Bạn đứng thứ ${data.rank} bảng xếp hạng phi công!`, 'success');
                    } else {
                        window.showToast(`Đã lưu điểm: ${this.score}`, 'info');
                    }
                }
            } else {
                console.warn("Gửi điểm thất bại:", data.message);
                if (window.showToast) {
                    window.showToast(`⚠️ Không thể lưu điểm: ${data.message || 'Lỗi hệ thống'}`, 'error');
                }
            }
        } catch (e) {
            console.error("Lỗi gửi điểm", e);
        }
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.groundY = this.canvas.height - 40;

        if (!this.isPlaying && !this.isGameOver) {
            this.player.y = this.canvas.height / 2 - this.player.height / 2;
        }
    }

    bindEvents() {
        const btnStartFlappy = document.getElementById('btnStartFlappy');
        if (btnStartFlappy) {
            btnStartFlappy.addEventListener('click', () => {
                document.getElementById('minigameHome').classList.add('hidden');
                document.getElementById('flappyPlayground').classList.remove('hidden');
                this.resize();

                const charSelectPanel = document.getElementById('flappyCharSelectPanel');
                if (charSelectPanel) charSelectPanel.classList.remove('hidden');
            });
        }

        const handleFlap = (e) => {
            const playground = document.getElementById('flappyPlayground');
            if (!playground || playground.classList.contains('hidden')) return;

            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.type === 'touchstart' || e.type === 'mousedown') {
                if (e.type !== 'mousedown') e.preventDefault();

                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

                if (!this.isPlaying) {
                    if (this.isGameOver) return;
                    if (this.nameModal && !this.nameModal.classList.contains('hidden')) return;
                    if (this.leaderboardOverlay && !this.leaderboardOverlay.classList.contains('hidden')) return;

                    if (this.needsResetOptions) {
                        this.needsResetOptions = false;
                        const charSelectPanel = document.getElementById('flappyCharSelectPanel');
                        if (charSelectPanel) charSelectPanel.classList.remove('hidden');

                        if (this.nameModal) {
                            if (this.inputName && this.playerName) {
                                this.inputName.value = this.playerName;
                            }
                            this.nameModal.classList.remove('hidden');
                            if (this.inputName) this.inputName.focus();
                        }
                        return;
                    }

                    this.requestStart();
                } else {
                    this.doFlap();
                }
            }
        };

        window.addEventListener('keydown', handleFlap);
        this.canvas.addEventListener('mousedown', handleFlap);
        this.canvas.addEventListener('touchstart', handleFlap, { passive: false });

        const btnQuit = document.getElementById('btnFlappyQuit');
        if (btnQuit) {
            btnQuit.addEventListener('click', () => {
                this.isGameOver = true;
                this.isPlaying = false;
                document.getElementById('flappyPlayground').classList.add('hidden');
                document.getElementById('minigameHome').classList.remove('hidden');
                document.getElementById('flappyCharSelectPanel').classList.add('hidden');
            });
        }

        const btnCharSelect = document.getElementById('btnFlappyCharSelect');
        const charSelectPanel = document.getElementById('flappyCharSelectPanel');
        const btnCharClose = document.getElementById('btnFlappyCharClose');

        if (btnCharSelect && charSelectPanel) {
            btnCharSelect.addEventListener('click', () => {
                charSelectPanel.classList.toggle('hidden');
            });
            btnCharClose.addEventListener('click', () => {
                charSelectPanel.classList.add('hidden');
            });
        }
    }

    initCharSelector() {
        const grid = document.getElementById('flappyCharGrid');
        if (!grid) return;

        grid.innerHTML = '';
        for (let i = 0; i < this.totalCharacters; i++) {
            const btn = document.createElement('button');
            const isSelected = this.player.characterIndex === i;
            btn.className = `w-full aspect-[4/3] rounded-xl border-2 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 overflow-hidden relative group ${isSelected ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)] z-10' : 'border-neutral-700/60 hover:border-indigo-400/80 hover:shadow-[0_0_15px_rgba(129,140,248,0.4)]'}`;

            const imgDiv = document.createElement('div');
            imgDiv.className = 'absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-105';
            imgDiv.style.backgroundImage = `url('/img/beo-dino/characters/${i + 1}.png')`;
            imgDiv.style.backgroundSize = 'contain';
            imgDiv.style.backgroundPosition = 'center';
            imgDiv.style.backgroundRepeat = 'no-repeat';
            imgDiv.style.backgroundColor = '#ffffff';

            const overlay = document.createElement('div');
            overlay.className = `absolute inset-0 bg-black transition-opacity duration-300 ${isSelected ? 'opacity-0' : 'opacity-30 group-hover:opacity-0'}`;

            btn.appendChild(imgDiv);
            btn.appendChild(overlay);

            btn.addEventListener('click', () => {
                this.player.characterIndex = i;

                Array.from(grid.children).forEach(child => {
                    child.classList.remove('border-amber-400', 'shadow-[0_0_20px_rgba(251,191,36,0.6)]', 'z-10');
                    child.classList.add('border-neutral-700/60');
                    child.children[1].classList.remove('opacity-0');
                    child.children[1].classList.add('opacity-30');
                });

                btn.classList.remove('border-neutral-700/60');
                btn.classList.add('border-amber-400', 'shadow-[0_0_20px_rgba(251,191,36,0.6)]', 'z-10');
                overlay.classList.remove('opacity-30');
                overlay.classList.add('opacity-0');

                if (!this.isPlaying) this.draw();
            });
            grid.appendChild(btn);
        }
    }

    requestStart() {
        if (!this.playerName) {
            this.nameModal.classList.remove('hidden');
            if (this.inputName) this.inputName.focus();
        } else {
            this.start();
        }
    }

    start() {
        this.isPlaying = true;
        this.isGameOver = false;
        this.score = 0;
        this.scoreElement.innerText = this.score.toString().padStart(5, '0');
        this.pipes = [];
        this.beers = [];
        this.frameCount = 0;
        this.player.y = this.canvas.height / 2.3;
        this.player.velocityY = 0;

        this.overlay.style.opacity = '0';

        const charSelectPanel = document.getElementById('flappyCharSelectPanel');
        if (charSelectPanel && !charSelectPanel.classList.contains('hidden')) {
            charSelectPanel.classList.add('hidden');
        }

        // Initialize backend session anti-cheat protection
        try {
            fetch('/api/game/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameType: 'flappy' })
            });
        } catch (e) {
            console.error('Lỗi khởi tạo phiên chơi flappy:', e);
        }

        this.loop();
    }

    doFlap() {
        this.player.velocityY = this.flapPower;
        this.playSound('jump');
    }

    spawnPipe() {
        const gap = 175; // Kích thước khe hở
        const minHeight = 60;
        const maxHeight = this.groundY - gap - minHeight;
        const topHeight = minHeight + Math.floor(Math.random() * (maxHeight - minHeight));
        const bottomHeight = this.groundY - gap - topHeight;
        const pipeWidth = 78;
        const spawnX = this.canvas.width;

        const newPipe = {
            x: spawnX,
            topHeight,
            bottomHeight,
            width: pipeWidth,
            passed: false
        };

        this.pipes.push(newPipe);

        // Sinh vật phẩm bia ở khoảng trống giữa ống nước (40% cơ hội)
        if (Math.random() < 0.45) {
            const beerSize = 42;
            this.beers.push({
                x: spawnX + pipeWidth / 2 - beerSize / 2,
                y: topHeight + gap / 2 - beerSize / 2,
                width: beerSize,
                height: beerSize,
                collected: false,
                beerIndex: this.beerSprites.length > 0 ? Math.floor(Math.random() * this.beerSprites.length) : 0
            });
        }
    }

    update() {
        // Apply physics to bird
        this.player.velocityY += this.gravity;
        this.player.y += this.player.velocityY;

        // Collision with Ground
        if (this.player.y + this.player.height >= this.groundY) {
            this.player.y = this.groundY - this.player.height;
            this.gameOver();
        }

        // Clamp ceiling
        if (this.player.y < 0) {
            this.player.y = 0;
            this.player.velocityY = 0.5; // Bump downward slightly
        }

        // Scrolling clouds
        for (let c of this.clouds) {
            c.x -= c.speed * 0.8;
            if (c.x + 120 < 0) {
                c.x = this.canvas.width + 50;
                c.y = Math.random() * (this.canvas.height * 0.4);
            }
        }

        // Spawning Pipes
        if (this.frameCount % this.pipeSpawnInterval === 0) {
            this.spawnPipe();
        }

        // Update Pipes
        for (let i = 0; i < this.pipes.length; i++) {
            let pipe = this.pipes[i];
            pipe.x -= this.gameSpeed;

            // Remove offscreen pipes
            if (pipe.x + pipe.width < 0) {
                this.pipes.splice(i, 1);
                i--;
                continue;
            }

            // Scoring point when passed
            if (!pipe.passed && pipe.x + pipe.width / 2 < this.player.x + this.player.width / 2) {
                pipe.passed = true;
                this.score += 1;
                this.scoreElement.innerText = this.score.toString().padStart(5, '0');
                this.playSound('jump'); // Play mini tick
            }

            // Collision check with pipes (AABB with margins)
            const marginX = 12;
            const marginY = 8;
            
            // Check top pipe
            const colTop = (
                this.player.x + marginX < pipe.x + pipe.width &&
                this.player.x + this.player.width - marginX > pipe.x &&
                this.player.y + marginY < pipe.topHeight
            );

            // Check bottom pipe
            const colBottom = (
                this.player.x + marginX < pipe.x + pipe.width &&
                this.player.x + this.player.width - marginX > pipe.x &&
                this.player.y + this.player.height - marginY > this.groundY - pipe.bottomHeight
            );

            if (colTop || colBottom) {
                this.gameOver();
                return;
            }
        }

        // Update Beer Items
        for (let i = 0; i < this.beers.length; i++) {
            let beer = this.beers[i];
            beer.x -= this.gameSpeed;

            // Remove offscreen items
            if (beer.x + beer.width < 0) {
                this.beers.splice(i, 1);
                i--;
                continue;
            }

            // Check collision with player
            const mX = 6;
            const mY = 6;
            if (
                this.player.x + mX < beer.x + beer.width &&
                this.player.x + this.player.width - mX > beer.x &&
                this.player.y + mY < beer.y + beer.height &&
                this.player.y + this.player.height - mY > beer.y
            ) {
                this.playSound('item');
                this.score += 2; // Bonus +2 points for beer collection!
                this.scoreElement.innerText = this.score.toString().padStart(5, '0');
                this.beers.splice(i, 1);
                i--;
            }
        }

        this.frameCount++;
    }

    drawSky() {
        const cycleFrames = 4800;
        const phaseDuration = cycleFrames / 3;
        const cycleProgress = this.frameCount % cycleFrames;
        const phase = Math.floor(cycleProgress / phaseDuration);
        const progress = (cycleProgress % phaseDuration) / phaseDuration;

        const mix = (from, to, t) => Math.round(from + (to - from) * t);
        const smooth = (t) => t * t * (3 - 2 * t);
        const easedProgress = smooth(progress);

        const dawnStart = { r: 14, g: 116, b: 144 }; // Cyan neon sky
        const dawnEnd = { r: 124, g: 58, b: 237 };  // Purple sunset
        const nightStart = { r: 9, g: 9, b: 11 };     // Rich dark night

        let r, g, b;

        if (phase === 0) {
            r = mix(dawnStart.r, dawnEnd.r, easedProgress);
            g = mix(dawnStart.g, dawnEnd.g, easedProgress);
            b = mix(dawnStart.b, dawnEnd.b, easedProgress);

            const sunAlpha = Math.max(0.2, 1 - (easedProgress * 0.8));
            if (this.sunImg.complete && this.sunImg.naturalWidth !== 0) {
                this.ctx.globalAlpha = sunAlpha;
                this.ctx.drawImage(this.sunImg, this.canvas.width * 0.75 - 45, this.canvas.height * 0.25 - 45, 90, 90);
                this.ctx.globalAlpha = 1.0;
            }
        } else if (phase === 1) {
            r = mix(dawnEnd.r, nightStart.r, easedProgress);
            g = mix(dawnEnd.g, nightStart.g, easedProgress);
            b = mix(dawnEnd.b, nightStart.b, easedProgress);
            this.drawStars(Math.max(0, (easedProgress - 0.25) / 0.75) * 0.65);
        } else {
            r = mix(nightStart.r, dawnStart.r, easedProgress);
            g = mix(nightStart.g, dawnStart.g, easedProgress);
            b = mix(nightStart.b, dawnStart.b, easedProgress);
            this.drawStars(1 - easedProgress * 0.85);

            const moonX = this.canvas.width * 0.25;
            const moonY = this.canvas.height * 0.25;
            this.ctx.globalAlpha = 1 - easedProgress * 0.8;
            if (this.moonImg.complete && this.moonImg.naturalWidth !== 0) {
                this.ctx.drawImage(this.moonImg, moonX - 25, moonY - 25, 50, 50);
            }
            this.ctx.globalAlpha = 1.0;
        }

        this.canvas.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

        // Draw dynamic clouds
        this.ctx.fillStyle = `rgba(255, 255, 255, 0.12)`;
        for (let c of this.clouds) {
            this.ctx.beginPath();
            this.ctx.arc(c.x, c.y, 25 * c.scale, 0, Math.PI * 2);
            this.ctx.arc(c.x + 22 * c.scale, c.y - 12 * c.scale, 30 * c.scale, 0, Math.PI * 2);
            this.ctx.arc(c.x + 44 * c.scale, c.y, 22 * c.scale, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawStars(alpha) {
        if (alpha <= 0) return;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        for (let i = 0; i < 12; i++) {
            let x = (i * 91 + this.frameCount * 0.05) % this.canvas.width;
            let y = (i * 27) % (this.canvas.height * 0.4);
            this.ctx.fillRect(x, y, 2.5, 2.5);
        }
    }

    drawClassicPipe(pipe) {
        // Draw Top Pipe
        const topGrad = this.ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
        topGrad.addColorStop(0, '#16a34a'); // Green neon
        topGrad.addColorStop(0.3, '#4ade80'); // Light reflection
        topGrad.addColorStop(0.7, '#16a34a');
        topGrad.addColorStop(1, '#14532d'); // Shadow border

        this.ctx.fillStyle = topGrad;
        this.ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight - 25);

        // Top Pipe Cap (Bottom end)
        this.ctx.fillStyle = '#14532d';
        this.ctx.fillRect(pipe.x - 4, pipe.topHeight - 25, pipe.width + 8, 25);
        this.ctx.fillStyle = topGrad;
        this.ctx.fillRect(pipe.x - 3, pipe.topHeight - 24, pipe.width + 6, 23);

        // Draw Bottom Pipe
        const bottomGrad = this.ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
        bottomGrad.addColorStop(0, '#15803d');
        bottomGrad.addColorStop(0.3, '#4ade80');
        bottomGrad.addColorStop(0.7, '#15803d');
        bottomGrad.addColorStop(1, '#14532d');

        this.ctx.fillStyle = bottomGrad;
        this.ctx.fillRect(pipe.x, this.groundY - pipe.bottomHeight + 25, pipe.width, pipe.bottomHeight - 25);

        // Bottom Pipe Cap (Top end)
        this.ctx.fillStyle = '#14532d';
        this.ctx.fillRect(pipe.x - 4, this.groundY - pipe.bottomHeight, pipe.width + 8, 25);
        this.ctx.fillStyle = bottomGrad;
        this.ctx.fillRect(pipe.x - 3, this.groundY - pipe.bottomHeight + 1, pipe.width + 6, 23);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background sky
        this.drawSky();

        // Draw pipes
        for (let pipe of this.pipes) {
            this.drawClassicPipe(pipe);
        }

        // Draw Beer Items
        for (let beer of this.beers) {
            if (this.beerSprites.length > 0) {
                const img = this.beerSprites[beer.beerIndex];
                if (img && img.complete && img.naturalWidth > 0) {
                    const floatY = Math.sin(this.frameCount * 0.12) * 5;
                    this.ctx.drawImage(img, beer.x, beer.y + floatY, beer.width, beer.height);
                }
            } else {
                // Gold fallback circle
                this.ctx.fillStyle = '#eab308';
                this.ctx.beginPath();
                this.ctx.arc(beer.x + beer.width / 2, beer.y + beer.height / 2, beer.width / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Draw Ground (classic brown-green look)
        this.ctx.fillStyle = '#14532d'; // Dark green grass layer
        this.ctx.fillRect(0, this.groundY, this.canvas.width, 10);
        this.ctx.fillStyle = '#713f12'; // Brown dirt layer
        this.ctx.fillRect(0, this.groundY + 10, this.canvas.width, this.canvas.height - this.groundY - 10);

        // Draw Ground moving pattern lines
        this.ctx.strokeStyle = '#451a03';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let i = 0; i < 15; i++) {
            const patternX = ((this.frameCount * this.gameSpeed * -1) + (i * 60)) % this.canvas.width;
            this.ctx.moveTo(patternX, this.groundY + 10);
            this.ctx.lineTo(patternX - 10, this.canvas.height);
        }
        this.ctx.stroke();

        // Draw Player Bird
        if (this.spritesLoaded === this.totalCharacters) {
            const currentSprite = this.sprites[this.player.characterIndex];

            // Tilts the bird depending on velocityY
            this.ctx.save();
            this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
            
            // Limit tilt angle
            let tiltAngle = this.player.velocityY * 0.055;
            tiltAngle = Math.max(-0.45, Math.min(tiltAngle, 0.75));
            this.ctx.rotate(tiltAngle);

            this.ctx.drawImage(
                currentSprite,
                -this.player.width / 2, -this.player.height / 2, this.player.width, this.player.height
            );
            this.ctx.restore();
        } else {
            // Draw placeholder yellow box
            this.ctx.fillStyle = '#f97316';
            this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        }
    }

    loop() {
        if (!this.isPlaying) return;

        this.update();
        this.draw();

        requestAnimationFrame(() => this.loop());
    }

    gameOver() {
        this.playSound('die');
        this.isPlaying = false;
        this.isGameOver = true;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('beoFlappyHighScore', this.highScore);
            this.highScoreElement.innerText = this.highScore.toString().padStart(5, '0');
        }

        // Submit to leaderboard
        this.submitScore();

        this.statusText.innerText = 'BỊ ĐÂM RỒI! ĐANG TẢI XẾP HẠNG...';
        this.overlay.style.opacity = '1';

        // Draw Crash text
        this.ctx.fillStyle = '#f87171';
        this.ctx.font = 'bold 32px "Outfit", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('NÁT GÁO RỒI!', this.canvas.width / 2, this.canvas.height / 2 - 25);

        // Auto display rankings after 1.5s
        setTimeout(() => {
            if (this.leaderboardOverlay && this.isGameOver) {
                this.loadLeaderboard();
                this.leaderboardOverlay.classList.remove('hidden');
            }
        }, 1500);
    }
}

// Instantiate Flappy Beo Game on load
let beoFlappyGame;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        beoFlappyGame = new FlappyGame();
    });
} else {
    beoFlappyGame = new FlappyGame();
}

window.beoFlappyGame = {
    loadLeaderboard: () => beoFlappyGame.loadLeaderboard(),
    deleteScore: (id) => beoFlappyGame.deleteScore(id)
};
})();

class DinoGame {
    constructor() {
        this.canvas = document.getElementById('dinoCanvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('dinoScore');
        this.highScoreElement = document.getElementById('dinoHighScore');
        this.overlay = document.getElementById('dinoOverlay');
        this.statusText = document.getElementById('dinoStatusText');

        // Modal UI Elements
        this.nameModal = document.getElementById('dinoNameModal');
        this.inputName = document.getElementById('dinoInputName');
        this.leaderboardOverlay = document.getElementById('dinoLeaderboardOverlay');
        this.leaderboardList = document.getElementById('dinoLeaderboardList');

        // Player Info
        this.playerName = localStorage.getItem('beoDinoPlayerName') || '';

        // Game state
        this.isPlaying = false;
        this.isGameOver = false;
        this.score = 0;
        this.highScore = localStorage.getItem('beoDinoHighScore') || 0;
        this.highScoreElement.innerText = this.highScore.toString().padStart(5, '0');

        // Cấu hình
        this.gravity = 0.6;
        this.gameSpeed = 6;
        this.obstacles = [];
        this.clouds = [];
        this.frameCount = 0;

        // Danh sách nhân vật (Lấy số lượng từ API)
        this.totalCharacters = 0;
        this.sprites = [];
        this.spritesLoaded = 0;
        
        // Item sprites
        this.totalBirds = 0;
        this.totalPlants = 0;
        this.itemsLoaded = 0;
        this.totalItemsToLoad = 0;
        this.itemSprites = {
            birds: [],
            plants: []
        };

        // Player (Cậu bé)
        this.player = {
            x: 50,
            y: 0,
            width: 100,
            height: 100,
            originalHeight: 100,
            duckHeight: 55,
            velocityY: 0,
            jumpPower: -13,
            isJumping: false,
            isDucking: false,
            characterIndex: 5 // Mặc định ảnh số 6 (index 5)
        };

        // Resize canvas
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Khởi tạo nền động (Mây)
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * (this.canvas.height / 2),
                speed: 0.5 + Math.random() * 0.5,
                scale: 0.5 + Math.random() * 0.5
            });
        }

        // Khởi tạo Controls & UI
        this.bindEvents();
        this.setupModals();

        // Lấy số lượng nhân vật từ server, sau đó tự load ảnh và initCharSelector
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
                this.totalBirds = itemsData.birds;
                this.totalPlants = itemsData.plants;
            } else {
                this.totalBirds = 1;
                this.totalPlants = 1;
            }
        } catch (e) {
            this.totalCharacters = 9;
            this.totalBirds = 1;
            this.totalPlants = 1;
        }

        this.totalItemsToLoad = this.totalBirds + this.totalPlants;

        const checkAllLoaded = () => {
            if (this.spritesLoaded === this.totalCharacters && this.itemsLoaded === this.totalItemsToLoad) {
                this.initCharSelector();
                if (this.player.characterIndex >= this.totalCharacters) {
                    this.player.characterIndex = 0;
                }
                this.draw();
            }
        };

        // Tải ảnh nhân vật
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

        // Tải ảnh items
        for (let i = 1; i <= this.totalBirds; i++) {
            let img = new Image();
            img.src = `/img/beo-dino/items/birds/${i}.png`;
            img.onload = () => { this.itemsLoaded++; checkAllLoaded(); };
            img.onerror = () => { this.itemsLoaded++; checkAllLoaded(); };
            this.itemSprites.birds.push(img);
        }
        
        for (let i = 1; i <= this.totalPlants; i++) {
            let img = new Image();
            img.src = `/img/beo-dino/items/plants/${i}.png`;
            img.onload = () => { this.itemsLoaded++; checkAllLoaded(); };
            img.onerror = () => { this.itemsLoaded++; checkAllLoaded(); };
            this.itemSprites.plants.push(img);
        }
    }

    // Audio Synthesizer (Web Audio API)
    playSound(type) {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            if (type === 'jump') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(300, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.1);
            } else if (type === 'item') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.2);
            } else if (type === 'die') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.3);
            }
        } catch (e) {
            console.log("Audio play error", e);
        }
    }

    setupModals() {
        const btnSubmit = document.getElementById('btnDinoNameSubmit');
        const btnCancel = document.getElementById('btnDinoNameCancel');
        const btnLeaderboard = document.getElementById('btnDinoShowLeaderboard');
        const btnCloseLeaderboard = document.getElementById('btnDinoCloseLeaderboard');

        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                const name = this.inputName.value.trim();
                if (name) {
                    this.playerName = name;
                    localStorage.setItem('beoDinoPlayerName', name);
                    this.nameModal.classList.add('hidden');
                    this.start();
                } else {
                    if (window.showToast) window.showToast('Vui lòng nhập tên Quái xế!', 'error');
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

                // Nếu đang trong trạng thái Game Over, chỉ reset màn hình chờ người chơi ấn Space
                if (this.isGameOver) {
                    this.isGameOver = false; // Reset cờ
                    this.needsResetOptions = true; // Đánh dấu cần bật bảng đăng ký khi ấn Space
                    this.overlay.style.opacity = '1'; // Hiện lại text
                    if (this.statusText) this.statusText.innerText = 'NHẤN SPACE ĐỂ CHƠI LẠI';
                }
            });
        }
    }

    async loadLeaderboard() {
        if (!this.leaderboardList) return;
        this.leaderboardList.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-neutral-600 font-medium">Đang tải bảng xếp hạng...</td></tr>';

        try {
            const res = await fetch('/api/dino/scores/leaderboard');
            const data = await res.json();

            if (data.success) {
                this.leaderboardList.innerHTML = '';
                if (data.leaderboard.length === 0) {
                    this.leaderboardList.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-neutral-600">Chưa có kỷ lục nào. Hãy là người đầu tiên!</td></tr>';
                    return;
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
                        <td class="py-4 px-6 text-right text-emerald-400 font-mono text-lg font-black">${item.score}</td>
                    `;
                    this.leaderboardList.appendChild(tr);
                });
            }
        } catch (e) {
            this.leaderboardList.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-red-500">Lỗi tải bảng xếp hạng</td></tr>';
        }
    }

    async submitScore() {
        if (!this.playerName || this.score === 0) return;

        try {
            const res = await fetch('/api/dino/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName: this.playerName,
                    score: this.score
                })
            });
            const data = await res.json();
            if (data.success && window.showToast) {
                if (data.rank <= 10) {
                    window.showToast(`Tuyệt đỉnh! Bạn lọt Top ${data.rank} Bảng Xếp Hạng!`, 'success');
                } else {
                    window.showToast(`Đã lưu điểm: ${this.score}`, 'info');
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

        if (!this.player.isDucking) {
            this.player.y = this.groundY - this.player.height;
        } else {
            this.player.y = this.groundY - this.player.duckHeight;
        }
    }

    bindEvents() {
        // Nút mở game từ màn hình chính
        const btnStartDino = document.getElementById('btnStartDino');
        if (btnStartDino) {
            btnStartDino.addEventListener('click', () => {
                document.getElementById('minigameHome').classList.add('hidden');
                document.getElementById('dinoPlayground').classList.remove('hidden');
                this.resize();

                // Mở sẵn bảng chọn nhân vật
                const charSelectPanel = document.getElementById('dinoCharSelectPanel');
                if (charSelectPanel) charSelectPanel.classList.remove('hidden');
            });
        }

        const handleJump = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.type === 'touchstart' || e.type === 'mousedown') {
                if (e.type !== 'mousedown') e.preventDefault();

                // Tránh ấn jump khi đang click các nút UI
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

                if (!this.isPlaying) {
                    // Nếu đang chết, phải đợi xem bảng Xếp hạng, chặn không cho bấm chơi lại bằng Space
                    if (this.isGameOver) return;

                    // Nếu đang mở Modal nhập tên hoặc Xếp hạng, chặn phím Space
                    if (this.nameModal && !this.nameModal.classList.contains('hidden')) return;
                    if (this.leaderboardOverlay && !this.leaderboardOverlay.classList.contains('hidden')) return;

                    // Nếu vừa đóng bảng xếp hạng xong, ấn Space sẽ hiện bảng thông tin
                    if (this.needsResetOptions) {
                        this.needsResetOptions = false;

                        const charSelectPanel = document.getElementById('dinoCharSelectPanel');
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
                    this.doJump();
                }
            }
        };

        const handleKeyDown = (e) => {
            handleJump(e);
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                if (this.isPlaying && !this.player.isJumping) {
                    this.doDuck(true);
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                this.doDuck(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        this.canvas.addEventListener('mousedown', handleJump);
        this.canvas.addEventListener('touchstart', handleJump, { passive: false });

        const btnQuit = document.getElementById('btnDinoQuit');
        if (btnQuit) {
            btnQuit.addEventListener('click', () => {
                this.isGameOver = true;
                this.isPlaying = false;
                document.getElementById('dinoPlayground').classList.add('hidden');
                document.getElementById('minigameHome').classList.remove('hidden');
                document.getElementById('dinoCharSelectPanel').classList.add('hidden');
            });
        }

        const btnCharSelect = document.getElementById('btnDinoCharSelect');
        const charSelectPanel = document.getElementById('dinoCharSelectPanel');
        const btnCharClose = document.getElementById('btnDinoCharClose');

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
        const grid = document.getElementById('dinoCharGrid');
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
        this.gameSpeed = 6;
        this.obstacles = [];
        this.frameCount = 0;
        this.doDuck(false); // Reset vị trí
        this.player.velocityY = 0;

        this.overlay.style.opacity = '0';

        // Đóng modal nhân vật nếu đang mở
        const charSelectPanel = document.getElementById('dinoCharSelectPanel');
        if (charSelectPanel && !charSelectPanel.classList.contains('hidden')) {
            charSelectPanel.classList.add('hidden');
        }

        this.loop();
    }

    doJump() {
        if (!this.player.isJumping && !this.player.isDucking) {
            this.playSound('jump');
            this.player.velocityY = this.player.jumpPower;
            this.player.isJumping = true;
        }
    }

    doDuck(isDucking) {
        if (this.player.isJumping) return;

        this.player.isDucking = isDucking;
        if (isDucking) {
            this.player.height = this.player.duckHeight;
            this.player.y = this.groundY - this.player.duckHeight;
        } else {
            this.player.height = this.player.originalHeight;
            this.player.y = this.groundY - this.player.originalHeight;
        }
    }

    update() {
        // Player Physics
        this.player.velocityY += this.gravity;
        this.player.y += this.player.velocityY;

        // Chạm đất
        if (this.player.y >= this.groundY - this.player.height) {
            this.player.y = this.groundY - this.player.height;
            this.player.velocityY = 0;
            this.player.isJumping = false;
        }

        // Cập nhật mây
        for (let c of this.clouds) {
            c.x -= c.speed * (this.gameSpeed / 6);
            if (c.x + 100 < 0) {
                c.x = this.canvas.width + 50;
                c.y = Math.random() * (this.canvas.height / 2);
            }
        }

        // Tạo chướng ngại vật & Vật phẩm (giảm tần suất, dễ hơn)
        if (this.frameCount % Math.floor(Math.random() * 80 + 100) === 0) {
            const rand = Math.random();
            if (rand < 0.6) {
                // CACTUS (Dưới đất)
                this.obstacles.push({
                    type: 'CACTUS',
                    x: this.canvas.width,
                    y: this.groundY - 65,
                    width: 55,
                    height: 65,
                    plantIndex: Math.floor(Math.random() * this.itemSprites.plants.length)
                });
            } else if (rand < 0.9) {
                // BIRD (Bay ngang tầm đầu)
                this.obstacles.push({
                    type: 'BIRD',
                    x: this.canvas.width,
                    y: this.groundY - 95,
                    width: 60,
                    height: 45,
                    birdIndex: Math.floor(Math.random() * Math.max(1, this.itemSprites.birds.length))
                });
            } else {
                // BEER (Vật phẩm Bia)
                this.obstacles.push({
                    type: 'BEER',
                    x: this.canvas.width,
                    y: this.groundY - 80 - Math.random() * 40,
                    width: 40,
                    height: 45
                });
            }
        }

        // Cập nhật chướng ngại vật & Va chạm
        for (let i = 0; i < this.obstacles.length; i++) {
            let obs = this.obstacles[i];
            obs.x -= this.gameSpeed;

            if (obs.x + obs.width < 0) {
                this.obstacles.splice(i, 1);
                i--;
                continue;
            }

            // AABB hitbox
            let hitboxMargin = 10;
            if (
                this.player.x + hitboxMargin < obs.x + obs.width &&
                this.player.x + this.player.width - hitboxMargin > obs.x &&
                this.player.y + hitboxMargin < obs.y + obs.height &&
                this.player.y + this.player.height - hitboxMargin > obs.y
            ) {
                if (obs.type === 'BEER') {
                    this.playSound('item');
                    this.score += 100; // Thưởng điểm
                    this.obstacles.splice(i, 1);
                    i--;
                    continue;
                } else {
                    this.gameOver();
                }
            }
        }

        // Điểm & Tốc độ
        this.frameCount++;
        if (this.frameCount % 10 === 0) {
            this.score++;
            this.scoreElement.innerText = this.score.toString().padStart(5, '0');

            if (this.score > 0 && this.score % 100 === 0) {
                this.gameSpeed += 0.4;
            }
        }
    }

    drawSky() {
        // Chu kỳ Ngày - Đêm dựa vào điểm
        // 0-300: Sáng xanh, 300-600: Hoàng hôn đỏ, >600: Đêm đen
        let phase = Math.floor(this.score / 300);
        let progress = (this.score % 300) / 300;

        let r, g, b;

        if (phase === 0) {
            // Sáng (87, 193, 235) sang Hoàng Hôn (252, 165, 165)
            r = 87 + (252 - 87) * progress;
            g = 193 + (165 - 193) * progress;
            b = 235 + (165 - 235) * progress;

            // Vẽ Mặt Trời
            this.ctx.fillStyle = `rgba(253, 224, 71, ${1 - progress})`;
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width * 0.8, this.canvas.height * 0.3, 30, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (phase === 1) {
            // Hoàng Hôn (252, 165, 165) sang Đêm (15, 23, 42)
            r = 252 + (15 - 252) * progress;
            g = 165 + (23 - 165) * progress;
            b = 165 + (42 - 165) * progress;

            // Vẽ Sao mờ
            this.drawStars(progress);
        } else {
            // Đêm
            r = 15; g = 23; b = 42;

            // Vẽ Sao rõ
            this.drawStars(1);

            // Vẽ Mặt Trăng
            this.ctx.fillStyle = '#f8fafc';
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width * 0.2, this.canvas.height * 0.3, 20, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Đổ màu nền
        this.canvas.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

        // Vẽ Mây Trắng (Mờ dần khi đêm)
        let cloudAlpha = phase === 0 ? 0.8 : (phase === 1 ? 0.8 * (1 - progress) : 0);
        if (cloudAlpha > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${cloudAlpha})`;
            for (let c of this.clouds) {
                this.ctx.beginPath();
                this.ctx.arc(c.x, c.y, 20 * c.scale, 0, Math.PI * 2);
                this.ctx.arc(c.x + 20 * c.scale, c.y - 10 * c.scale, 25 * c.scale, 0, Math.PI * 2);
                this.ctx.arc(c.x + 40 * c.scale, c.y, 20 * c.scale, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    drawStars(alpha) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        for (let i = 0; i < 15; i++) {
            let x = (i * 73 + this.frameCount * 0.1) % this.canvas.width;
            let y = (i * 21) % (this.canvas.height / 2);
            this.ctx.fillRect(x, y, 2, 2);
        }
    }

    draw() {
        // Xóa màn hình bằng Transparent (Canvas để trống, bg chỉnh bằng CSS)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Vẽ Trời / Ngày / Đêm
        this.drawSky();

        // Vẽ đất
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvas.width, this.groundY);
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Vẽ mặt đất trôi dạt (Dots)
        this.ctx.fillStyle = '#444';
        for (let i = 0; i < 20; i++) {
            let dotX = ((this.frameCount * this.gameSpeed * -0.5) + (i * 50)) % this.canvas.width;
            if (dotX < 0) dotX += this.canvas.width;
            this.ctx.fillRect(dotX, this.groundY + 10 + (i % 3) * 5, 3, 3);
        }

        // Vẽ chướng ngại vật & Vật phẩm
        for (let obs of this.obstacles) {
            if (obs.type === 'CACTUS') {
                const plantImg = this.itemSprites.plants[obs.plantIndex || 0];
                if (plantImg.complete && plantImg.naturalWidth > 0) {
                    this.ctx.drawImage(plantImg, obs.x, obs.y, obs.width, obs.height);
                } else {
                    // Fallback
                    this.ctx.fillStyle = '#10b981';
                    this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                }
            } else if (obs.type === 'BIRD') {
                const birdImg = this.itemSprites.birds[obs.birdIndex || 0];
                if (birdImg && birdImg.complete && birdImg.naturalWidth > 0) {
                    let wingY = Math.sin(this.frameCount * 0.2) * 5;
                    this.ctx.drawImage(birdImg, obs.x, obs.y + wingY, obs.width, obs.height);
                } else {
                    this.ctx.fillStyle = '#9ca3af';
                    this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                }
            } else if (obs.type === 'BEER') {
                // Ly bia
                this.ctx.fillStyle = '#fcd34d'; // Nước bia vàng
                this.ctx.fillRect(obs.x + 5, obs.y + 12, obs.width - 10, obs.height - 12);
                
                // Viền ly thủy tinh
                this.ctx.strokeStyle = '#e5e7eb';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obs.x + 5, obs.y + 12, obs.width - 10, obs.height - 12);
                
                // Quai ly
                this.ctx.beginPath();
                this.ctx.arc(obs.x + obs.width - 5, obs.y + 26, 8, -Math.PI/2, Math.PI/2);
                this.ctx.stroke();

                // Bọt bia
                this.ctx.fillStyle = '#ffffff'; // Bọt trắng
                this.ctx.beginPath();
                this.ctx.arc(obs.x + 10, obs.y + 12, 8, 0, Math.PI * 2);
                this.ctx.arc(obs.x + 20, obs.y + 10, 9, 0, Math.PI * 2);
                this.ctx.arc(obs.x + 30, obs.y + 12, 8, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Vẽ Player
        if (this.spritesLoaded === this.totalCharacters) {
            let currentSprite = this.sprites[this.player.characterIndex];

            let yOffset = 0;
            if (this.isPlaying && !this.player.isJumping) {
                if (Math.floor(this.frameCount / 5) % 2 === 0) {
                    yOffset = -3;
                }
            }

            // Nếu đang duck, vẽ biến dạng ngang
            this.ctx.save();
            if (this.player.isDucking) {
                // Scale trục Y xuống, Scale trục X lên để tạo cảm giác cúi/ẹp người xuống
                this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height);
                this.ctx.scale(1.2, 0.5);
                this.ctx.drawImage(
                    currentSprite,
                    -this.player.width / 2, -this.player.originalHeight, this.player.width, this.player.originalHeight
                );
            } else {
                this.ctx.drawImage(
                    currentSprite,
                    this.player.x, this.player.y + yOffset, this.player.width, this.player.originalHeight
                );
            }
            this.ctx.restore();

        } else {
            this.ctx.fillStyle = '#f59e0b';
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
        this.gameOverTime = Date.now(); // Lưu lại thời điểm chết
        this.doDuck(false);

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('beoDinoHighScore', this.highScore);
            this.highScoreElement.innerText = this.highScore.toString().padStart(5, '0');
        }

        // Gửi điểm lên server
        this.submitScore();

        this.statusText.innerText = 'GAME OVER! ĐANG TẢI XẾP HẠNG...';
        this.overlay.style.opacity = '1';

        this.ctx.fillStyle = '#f87171';
        this.ctx.font = 'bold 30px "Outfit", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ỐI ZỜI ÔI!', this.canvas.width / 2, this.canvas.height / 2 - 20);

        // Tự động show bảng xếp hạng sau 1.5s
        setTimeout(() => {
            if (this.leaderboardOverlay && this.isGameOver) {
                this.loadLeaderboard();
                this.leaderboardOverlay.classList.remove('hidden');
            }
        }, 1500);
    }
}

// Khởi tạo game
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.beoDinoGame = new DinoGame();
    });
} else {
    window.beoDinoGame = new DinoGame();
}

// public/js/caro.js
import { showToast } from './ui.js';

class CaroGame {
    constructor() {
        this.socket = null;
        
        // Game Board State
        this.board = Array(15).fill(null).map(() => Array(15).fill(null));
        this.rows = 15;
        this.cols = 15;
        
        // Active Lobbies & Players
        this.roomCode = null;
        this.myPlayer = null; // { name, symbol, color }
        this.players = []; // Array of 2 players
        this.currentTurn = 0; // 0 or 1 index
        this.turnTimeLimit = 30; // Default seconds
        this.timeLeft = 30;
        this.isMyTurn = false;
        
        // Sound and Graphics preloads
        this.audioCtx = null;
        this.soundEnabled = true;
        this.imagesLoaded = 0;
        this.gopherBlue = new Image();
        this.gopherRed = new Image();
        
        // UI & Canvas elements
        this.canvas = document.getElementById('caroCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // Hover targeting tracker
        this.hoverCell = null; // { r, c }
        
        // Victory animation and particles
        this.winningPath = null; // Array of [r,c]
        this.gameOverResult = null; // 'win', 'lose', 'draw', 'disconnect', 'timeout'
        this.particles = [];
        this.animationFrameId = null;
        this.timerInterval = null;
        
        // Load custom pieces
        this.preloadAssets();
    }
    
    init() {
        this.bindEvents();
        this.setupTimerSelection();
        
        // Resize canvas initially if matches open
        window.addEventListener('resize', () => {
            if (this.roomCode && this.canvas) {
                this.resizeCanvas();
                this.drawBoard();
            }
        });
    }
    
    preloadAssets() {
        const checkLoad = () => {
            this.imagesLoaded++;
            if (this.imagesLoaded === 2) {
                console.log("[Caro] Custom gopher pieces loaded successfully.");
            }
        };
        
        this.gopherBlue.src = '/img/caro/blue.png';
        this.gopherBlue.onload = checkLoad;
        this.gopherBlue.onerror = () => console.error("Lỗi khi tải ảnh quân cờ xanh.");
        
        this.gopherRed.src = '/img/caro/red.png';
        this.gopherRed.onload = checkLoad;
        this.gopherRed.onerror = () => console.error("Lỗi khi tải ảnh quân cờ đỏ.");
    }
    
    bindEvents() {
        const btnStartCaro = document.getElementById('btnStartCaro');
        const minigameHome = document.getElementById('minigameHome');
        const caroPlayground = document.getElementById('caroPlayground');
        
        // Trình kích hoạt mở game
        if (btnStartCaro) {
            btnStartCaro.addEventListener('click', () => {
                minigameHome.classList.add('hidden');
                caroPlayground.classList.remove('hidden');
                this.playSound('click');
                
                // Điền tên đã lưu nếu có
                const savedName = localStorage.getItem('pikabeoPlayerName') || localStorage.getItem('beoDinoPlayerName') || '';
                const nameInput = document.getElementById('caroPlayerNameInput');
                if (nameInput) {
                    nameInput.value = savedName;
                }
                
                // Khởi tạo socket connection
                this.connectSocket();
                this.resetToLobbyView();
            });
        }
        
        // Nút Tạo phòng
        const btnCreate = document.getElementById('btnCaroCreateRoom');
        if (btnCreate) {
            btnCreate.addEventListener('click', () => this.handleCreateRoom());
        }
        
        // Nút Vào phòng
        const btnJoin = document.getElementById('btnCaroJoinRoom');
        if (btnJoin) {
            btnJoin.addEventListener('click', () => this.handleJoinRoom());
        }
        
        // Hủy phòng khi đang đợi
        const btnCancelWaiting = document.getElementById('btnCaroCancelWaiting');
        if (btnCancelWaiting) {
            btnCancelWaiting.addEventListener('click', () => {
                this.playSound('click');
                if (this.socket) this.socket.emit('leaveRoom');
                this.resetToLobbyView();
            });
        }
        
        // Rời phòng hoặc đầu hàng
        const btnLeaveMatch = document.getElementById('btnCaroLeaveMatch');
        if (btnLeaveMatch) {
            btnLeaveMatch.addEventListener('click', () => {
                if (confirm("Bạn có chắc chắn muốn rời phòng? Nếu trận đấu đang diễn ra, bạn sẽ bị xử thua cuộc!")) {
                    this.playSound('click');
                    if (this.socket) this.socket.emit('leaveRoom');
                    this.resetToLobbyView();
                }
            });
        }
        
        // Đóng overlay kết quả
        const btnCloseResult = document.getElementById('btnCaroCloseResult');
        if (btnCloseResult) {
            btnCloseResult.addEventListener('click', () => {
                this.playSound('click');
                const overlay = document.getElementById('caroResultOverlay');
                if (overlay) overlay.classList.add('hidden');
                this.resetToLobbyView();
            });
        }
        
        // Nút gửi chat
        const btnSendChat = document.getElementById('btnCaroSendChat');
        const chatInput = document.getElementById('caroChatInput');
        if (btnSendChat && chatInput) {
            btnSendChat.addEventListener('click', () => this.sendChatMessage());
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
        }
        
        // Chat gáy nhanh
        const quickChatBtns = document.querySelectorAll('.btn-caro-quick-chat');
        quickChatBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const msg = btn.getAttribute('data-msg');
                if (msg && this.socket && this.roomCode) {
                    this.playSound('click');
                    this.socket.emit('sendChat', { message: msg });
                }
            });
        });
        
        // Đăng ký sự kiện nhấn trên Canvas
        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => {
                this.hoverCell = null;
                this.drawBoard();
            });
            this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            
            // Hỗ trợ cảm ứng trên thiết bị di động
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                const ratio = this.canvas.width / rect.width;
                const canvasX = x * ratio;
                const canvasY = y * ratio;
                
                const padding = this.canvas.width * 0.04;
                const boardWidth = this.canvas.width - padding * 2;
                const cellSize = boardWidth / 15;
                
                const c = Math.floor((canvasX - padding) / cellSize);
                const r = Math.floor((canvasY - padding) / cellSize);
                
                if (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === null) {
                    this.hoverCell = { r, c };
                    this.drawBoard();
                    // Click luôn
                    this.triggerMakeMove(r, c);
                }
            });
        }
    }
    
    setupTimerSelection() {
        const select = document.getElementById('caroCreateTimerSelect');
        const customBox = document.getElementById('caroCreateTimerCustomBox');
        if (select && customBox) {
            select.addEventListener('change', () => {
                this.playSound('click');
                if (select.value === 'custom') {
                    customBox.classList.remove('hidden');
                    document.getElementById('caroCreateTimerCustomInput').focus();
                } else {
                    customBox.classList.add('hidden');
                }
            });
        }
    }
    
    connectSocket() {
        if (this.socket) return;
        
        // Khởi tạo kết nối Socket.io
        this.socket = io();
        
        // Lắng nghe sự kiện từ Server
        this.socket.on('roomCreated', ({ roomCode, player }) => {
            this.roomCode = roomCode;
            this.myPlayer = player;
            this.players = [player];
            
            // Chuyển sang màn hình chờ đối thủ
            document.getElementById('caroLobbyPanel').classList.add('hidden');
            document.getElementById('caroWaitingPanel').classList.remove('hidden');
            document.getElementById('caroMatchPanel').classList.add('hidden');
            
            document.getElementById('caroWaitingCode').innerText = roomCode;
            document.getElementById('caroWaitingP1Name').innerText = player.name;
            
            showToast(`🎉 Phòng #${roomCode} được tạo thành công!`, 'success');
        });
        
        this.socket.on('joinError', ({ message }) => {
            showToast(`⚠️ ${message}`, 'error');
            this.playSound('error');
        });
        
        this.socket.on('gameStarted', ({ roomCode, players, turn, timeLeft }) => {
            this.roomCode = roomCode;
            this.players = players;
            this.currentTurn = turn;
            this.turnTimeLimit = timeLeft;
            this.timeLeft = timeLeft;
            
            // Tìm thông tin của mình
            this.myPlayer = players.find(p => p.socketId === this.socket.id);
            this.isMyTurn = players[turn].socketId === this.socket.id;
            
            // Xóa sạch bảng cờ cũ
            this.board = Array(15).fill(null).map(() => Array(15).fill(null));
            this.winningPath = null;
            this.gameOverResult = null;
            this.hoverCell = null;
            
            // Dọn khung chat
            const chatHistory = document.getElementById('caroChatHistory');
            if (chatHistory) {
                chatHistory.innerHTML = `<div class="text-center text-cyan-400/80 font-bold py-2 select-none animate-pulse">⚔️ TRẬN ĐẤU BẮT ĐẦU! ⚔️</div>`;
            }
            
            // Cập nhật giao diện
            document.getElementById('caroLobbyPanel').classList.add('hidden');
            document.getElementById('caroWaitingPanel').classList.add('hidden');
            document.getElementById('caroMatchPanel').classList.remove('hidden');
            
            // Điền tên
            document.getElementById('caroP1Name').innerText = players[0].name;
            document.getElementById('caroP2Name').innerText = players[1].name;
            document.getElementById('caroMatchCodeDisplay').innerText = `Phòng #${roomCode}`;
            
            this.resizeCanvas();
            this.updateTurnUI();
            this.drawBoard();
            this.playSound('win');
            
            showToast(`⚔️ Trận đấu bắt đầu! ${players[0].name} VS ${players[1].name}`, 'success');
        });
        
        this.socket.on('moveMade', ({ r, c, symbol, playerName }) => {
            this.board[r][c] = symbol;
            this.playSound('click');
            
            // Hiệu ứng hạt rơi nhẹ tại ô cờ vừa hạ
            this.spawnImpactParticles(r, c, symbol === 'X' ? '#06b6d4' : '#f43f5e');
            
            this.drawBoard();
        });
        
        this.socket.on('timerUpdate', ({ turn, timeLeft }) => {
            this.currentTurn = turn;
            this.timeLeft = timeLeft;
            this.isMyTurn = this.players[turn].socketId === this.socket.id;
            
            this.updateTurnUI();
            
            // Nếu sắp hết giờ suy nghĩ dưới 10s, kích hoạt tiếng tích tắc
            if (timeLeft <= 10 && timeLeft > 0) {
                this.playSound('ticktock');
            }
        });
        
        this.socket.on('receiveChat', ({ senderName, senderColor, message }) => {
            const chatHistory = document.getElementById('caroChatHistory');
            if (!chatHistory) return;
            
            const isMe = senderName === this.myPlayer.name;
            const tagColorClass = senderColor === 'blue' ? 'text-cyan-400' : 'text-rose-500';
            
            const chatRow = document.createElement('div');
            chatRow.className = "chat-msg-row flex flex-col space-y-0.5 bg-neutral-950/40 p-2 rounded-xl border border-neutral-850/50";
            chatRow.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-black text-[10px] ${tagColorClass}">${isMe ? '👤 Bạn' : '⚔️ ' + senderName}</span>
                    <span class="text-[8px] text-gray-500">${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                <p class="text-gray-200 text-xs break-all leading-normal pl-1">${message}</p>
            `;
            
            chatHistory.appendChild(chatRow);
            chatHistory.scrollTop = chatHistory.scrollHeight;
            
            this.playSound('chat');
        });
        
        this.socket.on('gameOver', ({ result, winner, loser, winningPath }) => {
            this.winningPath = winningPath;
            this.gameOverResult = result;
            
            // Dừng bộ đếm ngược
            this.timeLeft = 0;
            
            // Vẽ đường thắng và cờ
            this.drawBoard();
            
            // Hiển thị Overlay với Meme bựa
            const overlay = document.getElementById('caroResultOverlay');
            const titleEl = document.getElementById('caroResultTitle');
            const msgEl = document.getElementById('caroResultMsg');
            const memeEl = document.getElementById('caroResultMeme');
            const emojiEl = document.getElementById('caroResultEmoji');
            const glowEl = document.getElementById('caroResultGlow');
            
            if (overlay) {
                overlay.classList.remove('hidden');
                
                const amIWinner = winner && winner.socketId === this.socket.id;
                
                if (result === 'win') {
                    if (amIWinner) {
                        emojiEl.innerText = '🏆👑';
                        titleEl.innerText = 'CHIẾN THẮNG QUÁ ĐỈNH!';
                        titleEl.className = 'text-cyan-400 font-black text-xl md:text-2xl tracking-widest';
                        msgEl.innerText = `Chúc mừng bạn! Bạn đã hủy diệt đối thủ bằng nước cờ Caro chuẩn sách giáo khoa.`;
                        memeEl.src = `/img/beo-dino/characters/${Math.floor(Math.random() * 5) + 5}.png`; // Mấy sprite Lbeo cười ngầu
                        glowEl.className = 'absolute -top-16 -left-16 w-32 h-32 bg-cyan-500/20 rounded-full filter blur-2xl pointer-events-none';
                        this.playSound('win');
                        this.startCelebrationParticles('#06b6d4');
                    } else {
                        emojiEl.innerText = '💀😭';
                        titleEl.innerText = 'BẠN ĐÃ ĂN HÀNH THƠM PHỨC!';
                        titleEl.className = 'text-rose-500 font-black text-xl md:text-2xl tracking-widest';
                        msgEl.innerText = `Đối thủ ${winner.name} quá nguy hiểm! Hãy uống một ngụm lạc và làm ván phục thù.`;
                        memeEl.src = `/img/beo-dino/characters/${Math.floor(Math.random() * 3) + 1}.png`; // Mấy sprite Lbeo mếu/quạu
                        glowEl.className = 'absolute -top-16 -left-16 w-32 h-32 bg-rose-500/20 rounded-full filter blur-2xl pointer-events-none';
                        this.playSound('error');
                    }
                } else if (result === 'timeout') {
                    if (amIWinner) {
                        emojiEl.innerText = '⏰🛡️';
                        titleEl.innerText = 'THẮNG CUỘC DO ĐỐI THỦ HẾT GIỜ!';
                        titleEl.className = 'text-emerald-400 font-black text-xl md:text-2xl tracking-widest';
                        msgEl.innerText = `Đối thủ ${loser.name} đã rơi vào thế cờ quá hiểm hóc và cạn kiệt thời gian suy nghĩ.`;
                        memeEl.src = `/img/beo-dino/characters/8.png`;
                        this.playSound('win');
                    } else {
                        emojiEl.innerText = '⏰💥';
                        titleEl.innerText = 'HẾT GIỜ SUY NGHĨ!';
                        titleEl.className = 'text-rose-500 font-black text-xl md:text-2xl tracking-widest';
                        msgEl.innerText = `Thời gian suy nghĩ quá nhanh, bạn đã quá chậm chạp và bị xử thua cuộc đáng tiếc!`;
                        memeEl.src = `/img/beo-dino/characters/2.png`;
                        this.playSound('error');
                    }
                } else if (result === 'disconnect') {
                    emojiEl.innerText = '🚪🏃';
                    titleEl.innerText = 'ĐỐI THỦ ĐÃ BỎ CHẠY (RAGE QUIT)!';
                    titleEl.className = 'text-amber-500 font-black text-xl md:text-2xl tracking-widest';
                    msgEl.innerText = `Nhận thấy nước cờ quá bế tắc, đối thủ đã lẳng lặng đứt kết nối hoặc Rage Quit. Bạn thắng cuộc!`;
                    memeEl.src = `/img/beo-dino/characters/16.png`; // Sprite chạy trốn
                    this.playSound('win');
                    this.startCelebrationParticles('#f59e0b');
                } else if (result === 'draw') {
                    emojiEl.innerText = '🤝🍻';
                    titleEl.innerText = 'HÒA CỜ THÂN THIỆN!';
                    titleEl.className = 'text-indigo-400 font-black text-xl md:text-2xl tracking-widest';
                    msgEl.innerText = 'Cả hai kỳ thủ đã đi hết 225 ô cờ trên bàn mà không phân thắng bại. Rất ngang tài ngang sức!';
                    memeEl.src = `/img/beo-dino/characters/13.png`;
                    this.playSound('click');
                }
            }
        });
    }
    
    resetToLobbyView() {
        this.roomCode = null;
        this.players = [];
        this.winningPath = null;
        this.gameOverResult = null;
        this.isMyTurn = false;
        
        // Hủy vòng lặp đếm ngược & hạt
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        
        // Mở sảnh chờ và ẩn bàn chơi
        document.getElementById('caroLobbyPanel').classList.remove('hidden');
        document.getElementById('caroWaitingPanel').classList.add('hidden');
        document.getElementById('caroMatchPanel').classList.add('hidden');
        
        // Clean các input
        const codeInput = document.getElementById('caroJoinCodeInput');
        if (codeInput) codeInput.value = '';
    }
    
    handleCreateRoom() {
        const nameInput = document.getElementById('caroPlayerNameInput');
        const playerName = nameInput ? nameInput.value.trim() : '';
        
        if (!playerName) {
            showToast('⚠️ Vui lòng điền tên kỳ thủ trước khi tạo phòng!', 'warning');
            this.playSound('error');
            nameInput.focus();
            return;
        }
        
        localStorage.setItem('pikabeoPlayerName', playerName); // Lưu đồng bộ pikabeo
        this.playSound('click');
        
        // Đọc cấu hình giây suy nghĩ
        const timerSelect = document.getElementById('caroCreateTimerSelect');
        let turnTimeLimit = 30;
        
        if (timerSelect.value === 'custom') {
            const customInput = document.getElementById('caroCreateTimerCustomInput');
            const customVal = parseInt(customInput.value);
            if (!customVal || customVal < 5 || customVal > 300) {
                showToast('⚠️ Thời gian tùy chỉnh phải nằm trong khoảng 5 - 300 giây!', 'warning');
                this.playSound('error');
                customInput.focus();
                return;
            }
            turnTimeLimit = customVal;
        } else {
            turnTimeLimit = parseInt(timerSelect.value) || 30;
        }
        
        if (this.socket) {
            this.socket.emit('createRoom', { playerName, turnTimeLimit });
        }
    }
    
    handleJoinRoom() {
        const nameInput = document.getElementById('caroPlayerNameInput');
        const playerName = nameInput ? nameInput.value.trim() : '';
        
        if (!playerName) {
            showToast('⚠️ Vui lòng điền tên kỳ thủ trước khi tham gia!', 'warning');
            this.playSound('error');
            nameInput.focus();
            return;
        }
        
        const codeInput = document.getElementById('caroJoinCodeInput');
        const roomCode = codeInput ? codeInput.value.trim() : '';
        
        if (!roomCode || roomCode.length !== 4) {
            showToast('⚠️ Vui lòng nhập mã PIN phòng gồm đúng 4 chữ số!', 'warning');
            this.playSound('error');
            codeInput.focus();
            return;
        }
        
        localStorage.setItem('pikabeoPlayerName', playerName);
        this.playSound('click');
        
        if (this.socket) {
            this.socket.emit('joinRoom', { roomCode, playerName });
        }
    }
    
    sendChatMessage() {
        const input = document.getElementById('caroChatInput');
        const message = input ? input.value.trim() : '';
        
        if (!message || !this.socket || !this.roomCode) return;
        
        this.socket.emit('sendChat', { message });
        input.value = '';
        input.focus();
    }
    
    updateTurnUI() {
        const indicator = document.getElementById('caroTurnIndicator');
        const card1 = document.getElementById('caroPlayer1Card');
        const card2 = document.getElementById('caroPlayer2Card');
        
        // Reset classes
        if (card1) card1.className = "flex items-center gap-2 p-2 rounded-xl border border-neutral-900 transition-all duration-300";
        if (card2) card2.className = "flex items-center gap-2 p-2 rounded-xl border border-neutral-900 transition-all duration-300";
        
        // Đánh dấu thẻ hoạt động
        if (this.currentTurn === 0 && card1) {
            card1.classList.add('player-active-cyan');
        } else if (this.currentTurn === 1 && card2) {
            card2.classList.add('player-active-rose');
        }
        
        // Đọc tên người chơi hiện tại
        const activePlayerName = this.players[this.currentTurn]?.name || 'Đối thủ';
        
        if (this.isMyTurn) {
            indicator.innerText = "👉 LƯỢT ĐI CỦA BẠN 👈";
            indicator.className = "text-xs font-black text-cyan-400 uppercase tracking-widest animate-pulse";
        } else {
            indicator.innerText = `⌛ LƯỢT CỦA ${activePlayerName}`;
            indicator.className = "text-xs font-black text-neutral-400 uppercase tracking-wider blink-general";
        }
        
        // Cập nhật thanh thời gian suy nghĩ
        const timerText = document.getElementById('caroTimerText');
        const timerBar = document.getElementById('caroTimerBar');
        
        if (timerText) timerText.innerText = `${this.timeLeft}s`;
        
        if (timerBar) {
            const pct = Math.max(0, Math.min(100, (this.timeLeft / this.turnTimeLimit) * 100));
            timerBar.style.width = `${pct}%`;
            
            // Thay đổi gradient phát sáng màu sắc tùy thuộc lượt và thời gian
            if (this.timeLeft <= 10) {
                timerBar.className = "h-full bg-gradient-to-r from-red-500 to-rose-600 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(244,63,94,0.7)] animate-pulse";
                if (timerText) timerText.className = "text-rose-500 font-mono animate-bounce font-black";
            } else {
                if (this.currentTurn === 0) {
                    timerBar.className = "h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(6,182,212,0.4)]";
                    if (timerText) timerText.className = "text-cyan-400 font-mono";
                } else {
                    timerBar.className = "h-full bg-gradient-to-r from-rose-500 to-purple-500 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(244,63,94,0.4)]";
                    if (timerText) timerText.className = "text-rose-500 font-mono";
                }
            }
        }
    }
    
    // --- Canvas Board Rendering Engine ---
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        
        // High-DPI screens support
        const dpr = window.devicePixelRatio || 1;
        const targetSize = Math.min(width, 580);
        
        this.canvas.width = targetSize * dpr;
        this.canvas.height = targetSize * dpr;
        
        this.canvas.style.width = `${targetSize}px`;
        this.canvas.style.height = `${targetSize}px`;
        
        if (this.ctx) {
            this.ctx.scale(dpr, dpr);
        }
        
        this.logicalWidth = targetSize;
        this.logicalHeight = targetSize;
    }
    
    drawBoard() {
        if (!this.ctx || !this.canvas) return;
        
        const ctx = this.ctx;
        const width = this.logicalWidth;
        const height = this.logicalHeight;
        
        // Xóa bảng
        ctx.clearRect(0, 0, width, height);
        
        // Khởi tạo các biên tọa độ (bàn cờ cách viền 4%)
        const padding = width * 0.04;
        const boardWidth = width - padding * 2;
        const cellSize = boardWidth / 15;
        
        // 1. Vẽ các đường lưới
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1e293b'; // Sleek dark gray
        
        for (let i = 0; i <= 15; i++) {
            const pos = padding + i * cellSize;
            
            // Vẽ đường dọc
            ctx.beginPath();
            ctx.moveTo(pos, padding);
            ctx.lineTo(pos, padding + boardWidth);
            ctx.stroke();
            
            // Vẽ đường ngang
            ctx.beginPath();
            ctx.moveTo(padding, pos);
            ctx.lineTo(padding + boardWidth, pos);
            ctx.stroke();
        }
        
        // 2. Vẽ 5 dấu chấm tròn tiêu chuẩn Gomoku để bàn cờ nhìn cổ điển và cao cấp
        const dotIndexes = [3, 7, 11];
        ctx.fillStyle = '#334155';
        for (let r of dotIndexes) {
            for (let c of dotIndexes) {
                // Độc nhất các điểm chéo/tâm
                if ((r === 7 && c === 7) || (r !== 7 && c !== 7)) {
                    ctx.beginPath();
                    ctx.arc(padding + (c + 0.5) * cellSize, padding + (r + 0.5) * cellSize, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        
        // 3. Vẽ ô Hover định vị
        if (this.hoverCell && this.isMyTurn && !this.gameOverResult) {
            const { r, c } = this.hoverCell;
            const x = padding + c * cellSize;
            const y = padding + r * cellSize;
            
            ctx.fillStyle = this.myPlayer.symbol === 'X' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(244, 63, 94, 0.12)';
            ctx.strokeStyle = this.myPlayer.symbol === 'X' ? '#06b6d4' : '#f43f5e';
            ctx.lineWidth = 1.5;
            
            // Bo nhẹ viền
            ctx.beginPath();
            this.drawRoundedRect(ctx, x + 2, y + 2, cellSize - 4, cellSize - 4, 4);
            ctx.fill();
            ctx.stroke();
        }
        
        // 4. Vẽ các quân cờ xanh đỏ gopher
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const val = this.board[r][c];
                if (val !== null) {
                    const x = padding + c * cellSize;
                    const y = padding + r * cellSize;
                    
                    const pieceSize = cellSize * 0.88;
                    const offset = (cellSize - pieceSize) / 2;
                    
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = val === 'X' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(244, 63, 94, 0.3)';
                    
                    if (val === 'X') {
                        // Vẽ gopher xanh cyan
                        if (this.gopherBlue.complete) {
                            ctx.drawImage(this.gopherBlue, x + offset, y + offset, pieceSize, pieceSize);
                        } else {
                            // Fallback vẽ tay quân tròn neon xanh
                            this.drawFallbackPiece(ctx, x, y, cellSize, '#06b6d4', 'X');
                        }
                    } else if (val === 'O') {
                        // Vẽ gopher đỏ neon
                        if (this.gopherRed.complete) {
                            ctx.drawImage(this.gopherRed, x + offset, y + offset, pieceSize, pieceSize);
                        } else {
                            // Fallback vẽ tay quân tròn neon đỏ
                            this.drawFallbackPiece(ctx, x, y, cellSize, '#f43f5e', 'O');
                        }
                    }
                    
                    // Reset shadow
                    ctx.shadowBlur = 0;
                }
            }
        }
        
        // 5. Vẽ nét sáng nối liền 5 quân cờ thắng cuộc (Laser neon line)
        if (this.winningPath && this.winningPath.length >= 5) {
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#22c55e'; // Green neon laser line
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#22c55e';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            this.winningPath.forEach((cell, idx) => {
                const [r, c] = cell;
                const x = padding + (c + 0.5) * cellSize;
                const y = padding + (r + 0.5) * cellSize;
                
                if (idx === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
            
            // Reset stroke
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;
        }
    }
    
    drawFallbackPiece(ctx, x, y, cellSize, color, text) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.38, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.font = `black ${cellSize * 0.4}px Outfit`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + cellSize / 2, y + cellSize / 2);
    }
    
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
    }
    
    // --- Mouse/Touch Event Parsers ---
    handleCanvasMouseMove(e) {
        if (!this.canvas || !this.isMyTurn || this.gameOverResult) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Chuyển đổi tọa độ logic do scale DPR
        const ratio = this.canvas.width / rect.width;
        const canvasX = x * ratio;
        const canvasY = y * ratio;
        
        const padding = this.canvas.width * 0.04;
        const boardWidth = this.canvas.width - padding * 2;
        const cellSize = boardWidth / 15;
        
        // Tìm ô dòng và cột gần nhất
        const c = Math.floor((canvasX - padding) / cellSize);
        const r = Math.floor((canvasY - padding) / cellSize);
        
        if (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === null) {
            if (!this.hoverCell || this.hoverCell.r !== r || this.hoverCell.c !== c) {
                this.hoverCell = { r, c };
                this.drawBoard();
            }
        } else {
            if (this.hoverCell !== null) {
                this.hoverCell = null;
                this.drawBoard();
            }
        }
    }
    
    handleCanvasClick(e) {
        if (!this.canvas || !this.isMyTurn || this.gameOverResult) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ratio = this.canvas.width / rect.width;
        const canvasX = x * ratio;
        const canvasY = y * ratio;
        
        const padding = this.canvas.width * 0.04;
        const boardWidth = this.canvas.width - padding * 2;
        const cellSize = boardWidth / 15;
        
        const c = Math.floor((canvasX - padding) / cellSize);
        const r = Math.floor((canvasY - padding) / cellSize);
        
        this.triggerMakeMove(r, c);
    }
    
    triggerMakeMove(r, c) {
        if (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === null) {
            // Gửi nước đi tới máy chủ
            if (this.socket) {
                this.socket.emit('makeMove', { r, c });
                this.hoverCell = null;
                this.isMyTurn = false; // Tạm khóa cho đến khi nhận update từ server
            }
        }
    }
    
    // --- Web Audio sound synthesis ---
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
            
            if (type === 'click') {
                // Đặt cờ đanh giòn giã
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(450, now);
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'ticktock') {
                // Tiếng tíc tắc cảnh báo
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, now);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'chat') {
                // Chime khi chat
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'error') {
                // Âm thất bại
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(130, now);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (type === 'win') {
                // Nhạc kèn chiến thắng
                const winMelody = [523.25, 659.25, 783.99, 1046.50];
                winMelody.forEach((freq, idx) => {
                    const o = this.audioCtx.createOscillator();
                    const g = this.audioCtx.createGain();
                    o.connect(g);
                    g.connect(this.audioCtx.destination);
                    o.type = 'sine';
                    o.frequency.setValueAtTime(freq, now + idx * 0.09);
                    g.gain.setValueAtTime(0.08, now + idx * 0.09);
                    g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.3);
                    o.start(now + idx * 0.09);
                    o.stop(now + idx * 0.09 + 0.3);
                });
            }
        } catch (e) {
            console.error('Web Audio synthetic audio failure:', e);
        }
    }
    
    // --- Confetti / Particle celebration engine ---
    spawnImpactParticles(row, col, color) {
        const padding = this.logicalWidth * 0.04;
        const boardWidth = this.logicalWidth - padding * 2;
        const cellSize = boardWidth / 15;
        
        const x = padding + (col + 0.5) * cellSize;
        const y = padding + (row + 0.5) * cellSize;
        
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 3,
                color,
                alpha: 1,
                life: 30 + Math.random() * 20
            });
        }
        
        if (!this.animationFrameId && this.particles.length > 0) {
            this.animateParticles();
        }
    }
    
    startCelebrationParticles(color) {
        this.particles = [];
        const canvasWidth = this.logicalWidth;
        const canvasHeight = this.logicalHeight;
        
        // Spawn particles inside overlay or canvas bounds
        for (let i = 0; i < 80; i++) {
            this.particles.push({
                x: Math.random() * canvasWidth,
                y: -10 - Math.random() * 50,
                vx: -1.5 + Math.random() * 3,
                vy: 2 + Math.random() * 4,
                radius: 3 + Math.random() * 4,
                color: `hsl(${Math.random() * 360}, 90%, 60%)`,
                alpha: 1,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: -0.05 + Math.random() * 0.1,
                life: 180
            });
        }
        
        if (!this.animationFrameId) {
            this.animateParticles();
        }
    }
    
    animateParticles() {
        if (this.particles.length === 0) {
            this.animationFrameId = null;
            return;
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.animateParticles());
        
        // Update particles
        this.particles.forEach((p, idx) => {
            p.x += p.vx || 0;
            p.y += p.vy;
            if (p.rotation !== undefined) {
                p.rotation += p.rotationSpeed;
            }
            p.alpha -= 0.01;
            p.life--;
            
            if (p.alpha <= 0 || p.life <= 0) {
                this.particles.splice(idx, 1);
            }
        });
        
        // Draw board first
        this.drawBoard();
        
        // Draw particles on top of the canvas
        const ctx = this.ctx;
        if (!ctx) return;
        
        this.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            
            if (p.rotation !== undefined) {
                ctx.rotate(p.rotation);
                // Draw rotating rectangle for confetti
                ctx.fillRect(-p.radius, -p.radius * 1.5, p.radius * 2, p.radius * 3);
            } else {
                // Draw simple round splash
                ctx.beginPath();
                ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }
}

// Khởi chạy game khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    const game = new CaroGame();
    game.init();
    window.caroGame = game; // Expose globally
});

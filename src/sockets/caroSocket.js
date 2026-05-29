const rooms = new Map(); // Stores active game rooms

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log(`[Socket] Người chơi kết nối: ${socket.id}`);

        // 1. Tạo phòng mới
        socket.on('createRoom', ({ playerName }) => {
            const roomCode = Math.floor(1000 + Math.random() * 9000).toString(); // Mã phòng 4 chữ số
            
            const room = {
                id: roomCode,
                status: 'waiting',
                players: [
                    {
                        socketId: socket.id,
                        name: playerName || 'Người chơi 1',
                        symbol: 'X', // Xanh cyan gopher
                        color: 'blue'
                    }
                ],
                board: Array(15).fill(null).map(() => Array(15).fill(null)),
                rows: 15,
                cols: 15,
                turn: 0,
                timer: null,
                timeLeft: 30, // 30 giây đếm ngược mỗi lượt
                movesCount: 0
            };

            rooms.set(roomCode, room);
            socket.join(roomCode);
            socket.roomCode = roomCode;

            console.log(`[Caro] Phòng được tạo: #${roomCode} bởi ${playerName}`);
            socket.emit('roomCreated', { roomCode, player: room.players[0] });
        });

        // 2. Vào phòng sẵn có
        socket.on('joinRoom', ({ roomCode, playerName }) => {
            const room = rooms.get(roomCode);

            if (!room) {
                return socket.emit('joinError', { message: 'Mã phòng không tồn tại!' });
            }

            if (room.status !== 'waiting') {
                return socket.emit('joinError', { message: 'Phòng đã đủ người hoặc trận đấu đang diễn ra!' });
            }

            // Đăng ký người chơi thứ hai
            const player2 = {
                socketId: socket.id,
                name: playerName || 'Người chơi 2',
                symbol: 'O', // Đỏ neon gopher
                color: 'red'
            };

            room.players.push(player2);
            room.status = 'playing';
            socket.join(roomCode);
            socket.roomCode = roomCode;

            console.log(`[Caro] Phòng #${roomCode} bắt đầu: ${room.players[0].name} VS ${room.players[1].name}`);

            // Phát thông báo bắt đầu trận đấu cho cả phòng
            io.to(roomCode).emit('gameStarted', {
                roomCode,
                players: room.players,
                turn: room.turn,
                timeLeft: room.timeLeft
            });

            // Khởi chạy đếm ngược thời gian cho lượt đầu tiên
            startTurnCountdown(io, roomCode);
        });

        // 3. Người chơi gửi nước cờ
        socket.on('makeMove', ({ r, c }) => {
            const roomCode = socket.roomCode;
            if (!roomCode) return;

            const room = rooms.get(roomCode);
            if (!room || room.status !== 'playing') return;

            // Xác thực lượt chơi
            const activePlayerIdx = room.turn;
            const activePlayer = room.players[activePlayerIdx];

            if (activePlayer.socketId !== socket.id) {
                return socket.emit('moveError', { message: 'Chưa tới lượt đi của bạn!' });
            }

            // Xác thực ô cờ hợp lệ
            if (r < 0 || r >= room.rows || c < 0 || c >= room.cols || room.board[r][c] !== null) {
                return socket.emit('moveError', { message: 'Nước đi không hợp lệ!' });
            }

            // Đặt quân cờ
            room.board[r][c] = activePlayer.symbol;
            room.movesCount++;
            
            // Xóa bộ hẹn giờ lượt cũ
            if (room.timer) {
                clearInterval(room.timer);
                room.timer = null;
            }

            // Phát thông điệp nước cờ vừa đánh để cả hai vẽ lên màn hình ngay
            io.to(roomCode).emit('moveMade', {
                r,
                c,
                symbol: activePlayer.symbol,
                playerName: activePlayer.name
            });

            // Kiểm tra trạng thái thắng cuộc (chuẩn chặn hai đầu Việt Nam)
            const winResult = checkCaroWinner(room.board, room.rows, room.cols, r, c, activePlayer.symbol);
            
            if (winResult) {
                room.status = 'ended';
                console.log(`[Caro] Trận đấu #${roomCode} kết thúc: ${activePlayer.name} CHIẾN THẮNG!`);
                io.to(roomCode).emit('gameOver', {
                    result: 'win',
                    winner: activePlayer,
                    winningPath: winResult.path
                });
                rooms.delete(roomCode);
                return;
            }

            // Kiểm tra hòa cờ (Đầy bàn cờ)
            if (room.movesCount >= room.rows * room.cols) {
                room.status = 'ended';
                console.log(`[Caro] Trận đấu #${roomCode} HÒA CỜ!`);
                io.to(roomCode).emit('gameOver', { result: 'draw' });
                rooms.delete(roomCode);
                return;
            }

            // Đổi lượt chơi
            room.turn = 1 - room.turn;
            room.timeLeft = 30; // Reset 30s suy nghĩ

            // Bắt đầu đếm ngược lượt mới
            startTurnCountdown(io, roomCode);
        });

        // 4. Chat nhanh trong trận đấu
        socket.on('sendChat', ({ message }) => {
            const roomCode = socket.roomCode;
            if (!roomCode) return;

            const room = rooms.get(roomCode);
            if (!room) return;

            const sender = room.players.find(p => p.socketId === socket.id);
            if (!sender) return;

            console.log(`[Chat Caro] #${roomCode} - ${sender.name}: ${message}`);
            io.to(roomCode).emit('receiveChat', {
                senderName: sender.name,
                senderColor: sender.color,
                message: message.substring(0, 100) // Giới hạn 100 ký tự chống spam
            });
        });

        // 5. Rời phòng chơi
        socket.on('leaveRoom', () => {
            handlePlayerDisconnect(io, socket);
        });

        // 6. Mất kết nối đột ngột
        socket.on('disconnect', () => {
            handlePlayerDisconnect(io, socket);
        });
    });
};

// Hàm đếm ngược thời gian suy nghĩ 30 giây mỗi lượt
function startTurnCountdown(io, roomCode) {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    // Đồng bộ thời gian đếm ngược về Client
    io.to(roomCode).emit('timerUpdate', {
        turn: room.turn,
        timeLeft: room.timeLeft
    });

    room.timer = setInterval(() => {
        room.timeLeft--;

        io.to(roomCode).emit('timerUpdate', {
            turn: room.turn,
            timeLeft: room.timeLeft
        });

        if (room.timeLeft <= 0) {
            // Hết giờ! Xử thua người chơi đang trong lượt đi
            clearInterval(room.timer);
            room.timer = null;
            room.status = 'ended';

            const losingPlayer = room.players[room.turn];
            const winningPlayer = room.players[1 - room.turn];

            console.log(`[Caro] Hết giờ ở phòng #${roomCode}! ${winningPlayer.name} thắng theo luật đếm ngược.`);
            io.to(roomCode).emit('gameOver', {
                result: 'timeout',
                winner: winningPlayer,
                loser: losingPlayer
            });

            rooms.delete(roomCode);
        }
    }, 1000);
}

// Xử lý khi người chơi thoát phòng hoặc mất mạng
function handlePlayerDisconnect(io, socket) {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    console.log(`[Caro] Người chơi ${socket.id} đã thoát khỏi phòng #${roomCode}`);
    
    // Tìm người chơi còn lại
    const remainingPlayer = room.players.find(p => p.socketId !== socket.id);

    if (room.timer) {
        clearInterval(room.timer);
    }

    if (room.status === 'playing' && remainingPlayer) {
        // Nếu trận đấu đang diễn ra, tự động xử thắng cho người còn lại
        io.to(roomCode).emit('gameOver', {
            result: 'disconnect',
            winner: remainingPlayer
        });
    }

    rooms.delete(roomCode);
    socket.leave(roomCode);
    delete socket.roomCode;
}

// Thuật toán kiểm tra thắng cuộc chuẩn Caro Việt Nam (Chặn hai đầu)
function checkCaroWinner(board, rows, cols, r, c, playerSymbol) {
    const directions = [
        { dr: 0, dc: 1 },  // Hàng ngang
        { dr: 1, dc: 0 },  // Hàng dọc
        { dr: 1, dc: 1 },  // Đường chéo chính
        { dr: 1, dc: -1 }  // Đường chéo phụ
    ];

    for (const { dr, dc } of directions) {
        let count = 1;
        const path = [[r, c]];

        // Đi theo hướng dương
        let rPlus = r + dr;
        let cPlus = c + dc;
        let blockedPlus = false;
        while (rPlus >= 0 && rPlus < rows && cPlus >= 0 && cPlus < cols) {
            if (board[rPlus][cPlus] === playerSymbol) {
                count++;
                path.push([rPlus, cPlus]);
            } else {
                if (board[rPlus][cPlus] !== null) {
                    blockedPlus = true;
                }
                break;
            }
            rPlus += dr;
        }

        // Đi theo hướng âm
        let rMinus = r - dr;
        let cMinus = c - dc;
        let blockedMinus = false;
        while (rMinus >= 0 && rMinus < rows && cMinus >= 0 && cMinus < cols) {
            if (board[rMinus][cMinus] === playerSymbol) {
                count++;
                path.push([rMinus, cMinus]);
            } else {
                if (board[rMinus][cMinus] !== null) {
                    blockedMinus = true;
                }
                break;
            }
            rMinus -= dr;
        }

        // Đạt đủ từ 5 quân cờ liên tiếp trở lên
        if (count >= 5) {
            // Luật chặn hai đầu: nếu bị chặn cả 2 đầu bởi quân đối thủ thì chưa thắng!
            if (blockedPlus && blockedMinus) {
                continue;
            }
            // Sắp xếp đường đi để vẽ nét thắng dọc/ngang/chéo
            path.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            return { winner: playerSymbol, path };
        }
    }

    return null;
}

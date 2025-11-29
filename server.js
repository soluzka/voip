const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
const users = {};

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);
    
    // When a user joins
    socket.on('join-call', (roomId) => {
        socket.join(roomId);
        users[socket.id] = { roomId };
        
        // Notify other users in the room
        socket.to(roomId).emit('user-connected', socket.id);
        
        // Send existing users to the new user
        const usersInRoom = Object.entries(users)
            .filter(([id, data]) => data.roomId === roomId && id !== socket.id)
            .map(([id]) => id);
        
        socket.emit('existing-users', usersInRoom);
    });
    
    // Relay signaling data
    socket.on('signal', ({ to, signal }) => {
        io.to(to).emit('user-joined', { signal, callerId: socket.id });
    });
    
    // Relay return signal
    socket.on('return-signal', ({ callerId, signal }) => {
        io.to(callerId).emit('receiving-returned-signal', { signal, id: socket.id });
    });
    
    // Handle user disconnection
    socket.on('disconnect', () => {
        const userData = users[socket.id];
        if (userData) {
            socket.to(userData.roomId).emit('user-disconnected', socket.id);
            delete users[socket.id];
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

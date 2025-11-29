// DOM Elements
const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remoteVideos');
const startButton = document.getElementById('startButton');
const endButton = document.getElementById('endButton');
const joinButton = document.getElementById('joinButton');
const roomIdInput = document.getElementById('roomId');

// Global variables
let localStream;
let peers = {};
let socket;
let currentRoom = null;

// Initialize the application
async function init() {
    try {
        // Connect to the signaling server
        socket = io();
        setupSocketHandlers();
        
        // Set up event listeners
        startButton.addEventListener('click', startCall);
        endButton.addEventListener('click', endCall);
        joinButton.addEventListener('click', joinRoom);
        
        // Request access to the user's media devices
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        
        // Display the local video stream
        localVideo.srcObject = localStream;
        
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Error accessing media devices. Please ensure you have granted the necessary permissions.');
    }
}

// Set up WebSocket event handlers
function setupSocketHandlers() {
    // Handle existing users in the room
    socket.on('existing-users', users => {
        users.forEach(userId => {
            createPeer(userId, false);
        });
    });
    
    // Handle new user joining
    socket.on('user-connected', userId => {
        createPeer(userId, true);
    });
    
    // Handle user disconnection
    socket.on('user-disconnected', userId => {
        if (peers[userId]) {
            removeVideoElement(userId);
            peers[userId].destroy();
            delete peers[userId];
        }
    });
    
    // Handle incoming call
    socket.on('user-joined', ({ signal, callerId }) => {
        const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: localStream
        });
        
        peer.on('signal', signal => {
            socket.emit('return-signal', { signal, callerId });
        });
        
        peer.signal(signal);
        peers[callerId] = peer;
        
        peer.on('stream', stream => {
            addVideoElement(callerId, stream);
        });
    });
    
    // Handle return signal
    socket.on('receiving-returned-signal', ({ signal, id }) => {
        if (peers[id]) {
            peers[id].signal(signal);
        }
    });
}

// Create a new WebRTC peer connection
function createPeer(userId, initiator) {
    const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: localStream
    });
    
    peer.on('signal', signal => {
        socket.emit('signal', { to: userId, signal });
    });
    
    peer.on('stream', stream => {
        addVideoElement(userId, stream);
    });
    
    peer.on('close', () => {
        removeVideoElement(userId);
        delete peers[userId];
    });
    
    peers[userId] = peer;
}

// Add a video element for a remote stream
function addVideoElement(userId, stream) {
    // Check if video element already exists
    if (document.getElementById(`video-${userId}`)) return;
    
    const videoContainer = document.createElement('div');
    videoContainer.className = 'remote-video';
    videoContainer.id = `container-${userId}`;
    
    const video = document.createElement('video');
    video.id = `video-${userId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    
    const userIdLabel = document.createElement('div');
    userIdLabel.className = 'user-id';
    userIdLabel.textContent = `User: ${userId.substring(0, 8)}`;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(userIdLabel);
    remoteVideos.appendChild(videoContainer);
}

// Remove a video element
function removeVideoElement(userId) {
    const videoContainer = document.getElementById(`container-${userId}`);
    if (videoContainer) {
        videoContainer.remove();
    }
}

// Start a call
function startCall() {
    if (!currentRoom) {
        alert('Please join a room first');
        return;
    }
    
    startButton.disabled = true;
    endButton.disabled = false;
    
    // Notify other users in the room that we've joined
    socket.emit('join-call', currentRoom);
}

// End the call
function endCall() {
    // Close all peer connections
    Object.keys(peers).forEach(userId => {
        if (peers[userId]) {
            peers[userId].destroy();
            removeVideoElement(userId);
        }
    });
    
    peers = {};
    startButton.disabled = false;
    endButton.disabled = true;
    
    // Clear remote videos
    remoteVideos.innerHTML = '';
}

// Join a room
function joinRoom() {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    currentRoom = roomId;
    joinButton.disabled = true;
    roomIdInput.disabled = true;
    startButton.disabled = false;
    
    console.log(`Joining room: ${roomId}`);
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

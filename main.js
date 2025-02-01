
let peer = null;
let connection = null;
let localStream = null;
let call = null;
let typingTimeout = null;
let liveMode = false;

// Initialize PeerJS
function initializePeer() {
    peer = new Peer();
    
    peer.on('open', (id) => {
        document.getElementById('my-id').value = id;
    });

    peer.on('connection', (conn) => {
        connection = conn;
        setupConnection();
    });

    peer.on('call', (incomingCall) => {
        call = incomingCall;
        if (confirm('Incoming video call. Accept?')) {
            startVideo(true);
        }
    });

    peer.on('error', (err) => {
        console.error(err);
        alert('An error occurred: ' + err.message);
    });
}

// Start video
window.startVideo = async (isReceiving = false) => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('start-video').classList.add('hidden');
        document.getElementById('end-video').classList.remove('hidden');

        if (isReceiving && call) {
            call.answer(localStream);
            setupCallEvents(call);
        } else if (connection) {
            call = peer.call(connection.peer, localStream);
            setupCallEvents(call);
        }
    } catch (err) {
        console.error('Failed to get local stream', err);
        alert('Failed to start video: ' + err.message);
    }
};

// End video
window.endVideo = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        document.getElementById('local-video').srcObject = null;
        document.getElementById('remote-video').srcObject = null;
        document.getElementById('start-video').classList.remove('hidden');
        document.getElementById('end-video').classList.add('hidden');
        if (call) {
            call.close();
            call = null;
        }
    }
};

// Setup call events
function setupCallEvents(call) {
    call.on('stream', (remoteStream) => {
        document.getElementById('remote-video').srcObject = remoteStream;
    });

    call.on('close', () => {
        document.getElementById('remote-video').srcObject = null;
    });
}

// Connect to a peer
window.connectToPeer = () => {
    const peerId = document.getElementById('peer-id').value;
    if (!peerId) {
        alert('Please enter a peer ID');
        return;
    }

    connection = peer.connect(peerId);
    setupConnection();
};

// Setup connection event handlers
function setupConnection() {
    connection.on('open', () => {
        document.getElementById('connection-panel').classList.add('hidden');
        document.getElementById('chat-panel').classList.remove('hidden');
        document.getElementById('peer-id-label').textContent = connection.peer;
        setupLiveMode();
    });

    connection.on('data', (data) => {
        if (data.type === 'typing') {
            handleTypingPreview(data.text);
        } else {
            addMessage(data.text, false);
            document.getElementById('live-preview').textContent = '';
        }
    });

    connection.on('close', () => {
        resetChat();
    });
}

// Setup live mode
function setupLiveMode() {
    const liveModeToggle = document.getElementById('live-mode-toggle');
    const messageInput = document.getElementById('message-input');

    liveModeToggle.addEventListener('change', (e) => {
        liveMode = e.target.checked;
        document.getElementById('live-preview').classList.toggle('hidden', !liveMode);
    });

    messageInput.addEventListener('input', (e) => {
        if (liveMode && connection) {
            connection.send({
                type: 'typing',
                text: e.target.value
            });
        }
    });
}

// Handle typing preview
function handleTypingPreview(text) {
    const livePreview = document.getElementById('live-preview');
    if (text) {
        livePreview.textContent = `${connection.peer} is typing: ${text}`;
        livePreview.classList.remove('hidden');
    } else {
        livePreview.textContent = '';
        livePreview.classList.add('hidden');
    }
}

// Send a message
window.sendMessage = () => {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message && connection) {
        connection.send({
            type: 'message',
            text: message
        });
        addMessage(message, true);
        input.value = '';
        
        // Clear live preview when message is sent
        if (liveMode) {
            connection.send({
                type: 'typing',
                text: ''
            });
        }
    }
};

// Add a message to the chat
function addMessage(message, sent) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sent ? 'sent' : 'received'}`;
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Copy ID to clipboard
window.copyToClipboard = () => {
    const myId = document.getElementById('my-id');
    myId.select();
    document.execCommand('copy');
    alert('ID copied to clipboard!');
};

// Disconnect from peer
window.disconnect = () => {
    if (connection) {
        connection.close();
    }
    endVideo();
    resetChat();
};

// Reset chat UI
function resetChat() {
    document.getElementById('connection-panel').classList.remove('hidden');
    document.getElementById('chat-panel').classList.add('hidden');
    document.getElementById('messages').innerHTML = '';
    document.getElementById('peer-id').value = '';
    document.getElementById('live-preview').textContent = '';
    document.getElementById('live-mode-toggle').checked = false;
    liveMode = false;
    connection = null;
}

// Handle Enter key in message input
document.addEventListener('DOMContentLoaded', () => {
    initializePeer();
    
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});
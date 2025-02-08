

let peer = null;
let connection = null;
let localStream = null;
let call = null;
let currentCameraFacing = 'user';
let liveMode = false;

// Initialize PeerJS and setup DOM event listeners
function initialize() {
	console.log("initializePeer");
    initializePeer();
	console.log("setupDOMListeners")
    setupDOMListeners();
}

// Initialize PeerJS
function initializePeer() {
    peer = new Peer();
    
    peer.on('open', (id) => {
        const myIdElement = document.getElementById('my-id');
        if (myIdElement) {
            myIdElement.value = id;
        }
    });

    peer.on('connection', (conn) => {
        connection = conn;
        setupConnection();
    });

    peer.on('call', (incomingCall) => {
        call = incomingCall;
        if (confirm('Incoming video call. Accept?')) {
            startVideo(true);
        } else {
            incomingCall.close();
        }
    });

    peer.on('error', (err) => {
        console.error(err);
        alert('An error occurred: ' + err.message);
    });
}

// Setup all DOM event listeners
function setupDOMListeners() {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
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

    // Add event listeners for buttons
    const liveModeBtn = document.getElementById('live-mode-btn');
    if (liveModeBtn) {
        liveModeBtn.addEventListener('click', requestLiveMode);
    }

    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', connectToPeer);
    }

    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }

    const disconnectBtn = document.getElementById('disconnect-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnect);
    }
}

// Start video
window.startVideo = async (isReceiving = false) => {
    try {
        const constraints = {
            video: { 
                facingMode: currentCameraFacing
            },
            audio: true
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.play().catch(e => console.error('Error playing local video:', e));
        }
        
        const videoSection = document.getElementById('video-section');
        const chatSection = document.getElementById('chat-section');
        
        if (videoSection && chatSection) {
            videoSection.classList.remove('hidden');
            chatSection.classList.add('hidden');
        }

        if (isReceiving && call) {
            call.answer(localStream);
            setupCallEvents(call);
        } else if (connection) {
            call = peer.call(connection.peer, localStream);
            setupCallEvents(call);
        }
    } catch (err) {
        console.error('Failed to get local stream', err);
		document.getElementById("error").innerText = err;
        alert('Failed to start video: ' + err.message);
    }
};

// Switch camera
window.switchCamera = async () => {
    if (!localStream) return;
    
    currentCameraFacing = currentCameraFacing === 'user' ? 'environment' : 'user';
    
    localStream.getTracks().forEach(track => track.stop());
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: currentCameraFacing,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        });
        
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.play().catch(e => console.error('Error playing local video:', e));
        }
        
        if (call && call.peerConnection) {
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];
            
            const senders = call.peerConnection.getSenders();
            const videoSender = senders.find(sender => sender.track?.kind === 'video');
            const audioSender = senders.find(sender => sender.track?.kind === 'audio');
            
            if (videoSender && videoTrack) {
                videoSender.replaceTrack(videoTrack);
            }
            if (audioSender && audioTrack) {
                audioSender.replaceTrack(audioTrack);
            }
        }
    } catch (err) {
        console.error('Failed to switch camera:', err);
        alert('Failed to switch camera: ' + err.message);
    }
};

// End video
window.endVideo = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        
        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');
        const videoSection = document.getElementById('video-section');
        const chatSection = document.getElementById('chat-section');
        
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        
        if (videoSection && chatSection) {
            videoSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
        }
        
        if (call) {
            call.close();
            call = null;
        }
    }
};

// Setup call events
function setupCallEvents(call) {
    call.on('stream', (remoteStream) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.play().catch(e => console.error('Error playing remote video:', e));
        }
    });

    call.on('close', () => {
        const remoteVideo = document.getElementById('remote-video');
        const videoSection = document.getElementById('video-section');
        const chatSection = document.getElementById('chat-section');
        
        if (remoteVideo) remoteVideo.srcObject = null;
        
        if (videoSection && chatSection) {
            videoSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
        }
    });

    call.on('error', (err) => {
        console.error('Call error:', err);
        alert('Call error: ' + err.message);
        endVideo();
    });
}

// Request live mode
function requestLiveMode() {
    if (connection) {
        connection.send({
            type: 'live-mode-request'
        });
        alert('Waiting for peer to accept Live Mode...');
    }
}

// Connect to a peer
function connectToPeer() {
    const peerIdElement = document.getElementById('peer-id');
    if (!peerIdElement) return;
    
    const peerId = peerIdElement.value;
    if (!peerId) {
        alert('Please enter a peer ID');
        return;
    }

    connection = peer.connect(peerId);
    setupConnection();
}

// Setup connection event handlers
function setupConnection() {
    connection.on('open', () => {
        const connectionPanel = document.getElementById('connection-panel');
        const chatPanel = document.getElementById('chat-panel');
        const peerIdLabel = document.getElementById('peer-id-label');
        
        if (connectionPanel) connectionPanel.classList.add('hidden');
        if (chatPanel) chatPanel.classList.remove('hidden');
        if (peerIdLabel) peerIdLabel.textContent = connection.peer;
    });

    connection.on('data', (data) => {
        if (data.type === 'live-mode-request') {
            handleLiveModeRequest();
        } else if (data.type === 'live-mode-response') {
            handleLiveModeResponse(data.accepted);
        } else if (data.type === 'typing' && liveMode) {
            handleTypingPreview(data.text);
        } else if (data.type === 'message') {
            addMessage(data.text, false);
            const typingPreview = document.querySelector('.typing-preview');
            if (typingPreview) {
                typingPreview.remove();
            }
        }
    });

    connection.on('close', () => {
        resetChat();
    });
}

function handleLiveModeRequest() {
    const accept = confirm('The other user wants to enable Live Mode. Accept?');
    liveMode = accept;
    connection.send({
        type: 'live-mode-response',
        accepted: accept
    });
    
    const liveModeBtn = document.getElementById('live-mode-btn');
    if (accept && liveModeBtn) {
        liveModeBtn.textContent = 'Live Mode: ON';
        liveModeBtn.classList.add('text-green-600');
    }
}

function handleLiveModeResponse(accepted) {
    const liveModeBtn = document.getElementById('live-mode-btn');
    if (accepted) {
        liveMode = true;
        if (liveModeBtn) {
            liveModeBtn.textContent = 'Live Mode: ON';
            liveModeBtn.classList.add('text-green-600');
        }
        alert('Live Mode enabled!');
    } else {
        liveMode = false;
        alert('Live Mode request was declined.');
    }
}

// Handle typing preview
function handleTypingPreview(text) {
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;
    
    const typingPreview = document.querySelector('.typing-preview');
    if (typingPreview) {
        typingPreview.remove();
    }
    
    if (text) {
        const previewElement = document.createElement('div');
        previewElement.className = 'message received typing-preview';
        previewElement.textContent = text;
        messagesDiv.appendChild(previewElement);
        previewElement.scrollIntoView({ behavior: 'smooth' });
    }
}

// Send a message
function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input || !connection) return;
    
    const message = input.value.trim();
    if (message) {
        connection.send({
            type: 'message',
            text: message
        });
        addMessage(message, true);
        input.value = '';
        
        if (liveMode) {
            connection.send({
                type: 'typing',
                text: ''
            });
        }
    }
}

// Add a message to the chat
function addMessage(message, sent) {
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sent ? 'sent' : 'received'}`;
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Copy ID to clipboard
function copyToClipboard() {
    const myId = document.getElementById('my-id');
    if (!myId) return;
    
    myId.select();
    document.execCommand('copy');
    alert('ID copied to clipboard!');
}

// Disconnect from peer
function disconnect() {
    if (connection) {
        connection.close();
    }
    endVideo();
    resetChat();
}

// Reset chat UI
function resetChat() {
    const connectionPanel = document.getElementById('connection-panel');
    const chatPanel = document.getElementById('chat-panel');
    const messages = document.getElementById('messages');
    const peerId = document.getElementById('peer-id');
    const liveModeBtn = document.getElementById('live-mode-btn');
    
    if (connectionPanel) connectionPanel.classList.remove('hidden');
    if (chatPanel) chatPanel.classList.add('hidden');
    if (messages) messages.innerHTML = '';
    if (peerId) peerId.value = '';
    if (liveModeBtn) {
        liveModeBtn.textContent = 'Enable Live Mode';
        liveModeBtn.classList.remove('text-green-600');
    }
    
    liveMode = false;
    connection = null;
}

console.log("document.readyState: ", document.readyState)
// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log("JS Loaded!");
window.addEventListener("load", () => console.log("Window loaded"));

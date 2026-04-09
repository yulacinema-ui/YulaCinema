import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, onDisconnect, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-2n8UlUbuiD0SLNj0tLTjvVaIfaTY61g",
    authDomain: "yulacinema-ec8ef.firebaseapp.com",
    projectId: "yulacinema-ec8ef",
    databaseURL: "https://yulacinema-ec8ef-default-rtdb.firebaseio.com",
    storageBucket: "yulacinema-ec8ef.firebasestorage.app",
    messagingSenderId: "194720886903",
    appId: "1:194720886903:web:4c1015a88a0332698a5672"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const params = new URLSearchParams(window.location.search);
const roomId = params.get("id");
const video = document.getElementById("mainVideo");
const roomTitle = document.getElementById("roomTitle");

if (!roomId) window.location.href = "watch.html";

let hls = null;
let blockSending = false;

// ---------- ГЕНЕРАЦИЯ БЕЗОПАСНОГО ID ДЛЯ PEER ----------
function generateRandomPeerId() {
    return 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
}

// ---------- ГОЛОСОВОЙ ЧАТ ----------
let peer = null;
let localStream = null;
let currentUid = null;
let activeCalls = new Map();
let isMicActive = false;
let myPeerId = null;

const enableMicBtn = document.getElementById("enableMicBtn");
const muteMicBtn = document.getElementById("muteMicBtn");
const voiceStatusSpan = document.getElementById("voiceStatus");

function updateVoiceUI() {
    if (localStream && localStream.active && isMicActive) {
        const audioTracks = localStream.getAudioTracks();
        const enabled = audioTracks.length > 0 && audioTracks[0].enabled;
        if (enabled) {
            voiceStatusSpan.innerHTML = "🟢 Микрофон активен";
            voiceStatusSpan.className = "voice-status on";
            muteMicBtn.textContent = "🔇 Выключить звук";
        } else {
            voiceStatusSpan.innerHTML = "🔴 Микрофон отключён (кнопкой)";
            voiceStatusSpan.className = "voice-status";
            muteMicBtn.textContent = "🎤 Включить звук";
        }
        muteMicBtn.disabled = false;
    } else {
        voiceStatusSpan.innerHTML = "⚫ Микрофон выключен";
        voiceStatusSpan.className = "voice-status";
        muteMicBtn.textContent = "🔇 Отключить звук";
        muteMicBtn.disabled = true;
    }
}

function toggleMute() {
    if (!localStream || !isMicActive) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        updateVoiceUI();
    }
}

async function disableMicrophone() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    for (let item of activeCalls.values()) {
        if (item.call && item.call.close) item.call.close();
        if (item.audioElement) item.audioElement.remove();
    }
    activeCalls.clear();
    isMicActive = false;
    myPeerId = null;
    if (peer) {
        peer.destroy();
        peer = null;
    }
    if (currentUid && roomId) {
        const peerRef = ref(db, `room_peers/${roomId}/${currentUid}`);
        await remove(peerRef).catch(console.warn);
    }
    enableMicBtn.style.display = "inline-block";
    updateVoiceUI();
}

function attachRemoteStream(call, remoteStream) {
    const remoteAudio = document.createElement('audio');
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.controls = false;
    remoteAudio.style.display = 'none';
    document.body.appendChild(remoteAudio);
    remoteAudio.srcObject = remoteStream;
    remoteAudio.play().catch(e => console.log("Audio play error:", e));
    call.on('close', () => {
        if (remoteAudio) remoteAudio.remove();
    });
    return remoteAudio;
}

async function callAllPeers() {
    if (!peer || !localStream || !isMicActive) return;
    const peersRef = ref(db, `room_peers/${roomId}`);
    const snapshot = await new Promise(resolve => onValue(peersRef, resolve, { onlyOnce: true }));
    const peers = snapshot.val() || {};
    for (const [uid, data] of Object.entries(peers)) {
        if (uid === currentUid) continue;
        const targetPeerId = data.peerId;
        if (targetPeerId && !activeCalls.has(targetPeerId)) {
            const call = peer.call(targetPeerId, localStream);
            if (call) {
                call.on('stream', (remoteStream) => {
                    const audioEl = attachRemoteStream(call, remoteStream);
                    activeCalls.set(targetPeerId, { call, audioElement: audioEl });
                });
                call.on('close', () => {
                    activeCalls.delete(targetPeerId);
                });
            }
        }
    }
}

function listenForNewPeers() {
    const peersRef = ref(db, `room_peers/${roomId}`);
    onValue(peersRef, (snapshot) => {
        if (!peer || !localStream || !isMicActive) return;
        const peers = snapshot.val() || {};
        for (const [uid, data] of Object.entries(peers)) {
            if (uid === currentUid) continue;
            const targetPeerId = data.peerId;
            if (targetPeerId && !activeCalls.has(targetPeerId)) {
                const call = peer.call(targetPeerId, localStream);
                if (call) {
                    call.on('stream', (remoteStream) => {
                        const audioEl = attachRemoteStream(call, remoteStream);
                        activeCalls.set(targetPeerId, { call, audioElement: audioEl });
                    });
                    call.on('close', () => {
                        activeCalls.delete(targetPeerId);
                    });
                }
            }
        }
        for (let [peerId, item] of activeCalls.entries()) {
            let stillExists = false;
            for (let item2 of Object.values(peers)) {
                if (item2.peerId === peerId) { stillExists = true; break; }
            }
            if (!stillExists) {
                if (item.call) item.call.close();
                if (item.audioElement) item.audioElement.remove();
                activeCalls.delete(peerId);
            }
        }
    });
}

async function enableMicrophone() {
    if (isMicActive) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream = stream;
        isMicActive = true;

        const peerId = generateRandomPeerId();
        console.log("Creating Peer with ID:", peerId);
        
        peer = new Peer(peerId, {
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" }
                ]
            }
        });

        peer.on('open', async (id) => {
            myPeerId = id;
            console.log("Peer open, ID:", id);
            const peerRef = ref(db, `room_peers/${roomId}/${currentUid}`);
            await set(peerRef, { peerId: id, email: auth.currentUser.email });
            onDisconnect(peerRef).remove();
            callAllPeers();
        });

        peer.on('call', (incomingCall) => {
            if (!localStream || !isMicActive) return;
            console.log("Incoming call from:", incomingCall.peer);
            incomingCall.answer(localStream);
            const callerId = incomingCall.peer;
            incomingCall.on('stream', (remoteStream) => {
                const audioEl = attachRemoteStream(incomingCall, remoteStream);
                activeCalls.set(callerId, { call: incomingCall, audioElement: audioEl });
            });
            incomingCall.on('close', () => {
                activeCalls.delete(callerId);
            });
        });

        peer.on('error', (err) => {
            console.error("PeerJS error:", err);
            if (err.type === 'unavailable-id' || err.type === 'invalid-id') {
                console.log("Retrying with new ID");
                peer.destroy();
                const newPeerId = generateRandomPeerId();
                peer = new Peer(newPeerId, {
                    config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
                });
                peer.on('open', async (id) => {
                    myPeerId = id;
                    const peerRef = ref(db, `room_peers/${roomId}/${currentUid}`);
                    await set(peerRef, { peerId: id, email: auth.currentUser.email });
                    onDisconnect(peerRef).remove();
                    callAllPeers();
                });
                peer.on('call', (incomingCall) => {
                    if (!localStream || !isMicActive) return;
                    incomingCall.answer(localStream);
                    const callerId = incomingCall.peer;
                    incomingCall.on('stream', (remoteStream) => {
                        const audioEl = attachRemoteStream(incomingCall, remoteStream);
                        activeCalls.set(callerId, { call: incomingCall, audioElement: audioEl });
                    });
                    incomingCall.on('close', () => {
                        activeCalls.delete(callerId);
                    });
                });
            }
        });

        enableMicBtn.style.display = "none";
        muteMicBtn.onclick = () => toggleMute();
        updateVoiceUI();
    } catch (err) {
        console.error("Microphone error:", err);
        alert("Не удалось получить доступ к микрофону. Разрешите доступ в настройках браузера.");
        isMicActive = false;
        enableMicBtn.style.display = "inline-block";
        muteMicBtn.disabled = true;
    }
}

window.addEventListener("beforeunload", () => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (peer && !peer.destroyed) peer.destroy();
    if (currentUid && roomId) {
        remove(ref(db, `room_peers/${roomId}/${currentUid}`)).catch(() => {});
    }
});

// ---------- ВИДЕО СИНХРОНИЗАЦИЯ ----------
function loadVideo(url) {
    if (hls) { hls.destroy(); hls = null; }
    if (url.endsWith(".m3u8")) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
        } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
        }
    } else {
        video.src = url;
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    currentUid = user.uid;

    const myPresenceRef = ref(db, `room_presence/${roomId}/${user.uid}`);
    onDisconnect(myPresenceRef).remove();
    await set(myPresenceRef, { email: user.email, online: true });

    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) return;
        roomTitle.innerText = room.name || "Cinema Room";
        if (room.owner === user.email) document.getElementById("hostControls").style.display = "block";

        if (room.videoUrl && video.dataset.url !== room.videoUrl) {
            video.dataset.url = room.videoUrl;
            loadVideo(room.videoUrl);
            video.style.display = "block";
            document.getElementById("videoPlaceholder").style.display = "none";
        }

        if (!room.state || room.state.user === user.email) return;
        const state = room.state;
        blockSending = true;
        if (Math.abs(video.currentTime - state.time) > 1) video.currentTime = state.time;
        if (state.playing && video.paused) video.play().catch(() => console.log("Нужен клик"));
        else if (!state.playing && !video.paused) video.pause();
        setTimeout(() => { blockSending = false; }, 100);
    });

    const sendAction = (isPlaying) => {
        if (blockSending) return;
        update(ref(db, `rooms/${roomId}/state`), {
            playing: isPlaying,
            time: video.currentTime,
            user: user.email,
            ts: Date.now()
        });
    };

    video.onplay = () => sendAction(true);
    video.onpause = () => sendAction(false);
    video.onseeked = () => {
        if (blockSending) return;
        video.pause();
        sendAction(false);
    };

    onValue(ref(db, `room_presence/${roomId}`), (snapshot) => {
        const listUI = document.getElementById("userList");
        listUI.innerHTML = "";
        snapshot.forEach(child => {
            const name = child.val().email.split("@")[0];
            listUI.innerHTML += `<div class="user-badge"><span class="status-dot"></span>${name}</div>`;
        });
    });

    enableMicBtn.onclick = () => enableMicrophone();
    listenForNewPeers();
});

document.getElementById("setVideoBtn").onclick = () => {
    const url = document.getElementById("videoUrlInput").value.trim();
    if (url && auth.currentUser) {
        update(ref(db, `rooms/${roomId}`), {
            videoUrl: url,
            state: { playing: false, time: 0, ts: Date.now(), user: auth.currentUser.email }
        });
    }
};
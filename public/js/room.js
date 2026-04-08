import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, onDisconnect, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
let blockSending = false; // Флаг: блокируем отправку, когда получаем данные из базы

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

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    // 1. Присутствие
    const myPresenceRef = ref(db, `room_presence/${roomId}/${user.uid}`);
    onDisconnect(myPresenceRef).remove();
    set(myPresenceRef, { email: user.email, online: true });

    // 2. Слушатель комнаты (Play / Pause / Seek)
    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) return;

        roomTitle.innerText = room.name || "Cinema Room";
        if (room.owner === user.email) document.getElementById("hostControls").style.display = "block";

        // URL видео
        if (room.videoUrl && video.dataset.url !== room.videoUrl) {
            video.dataset.url = room.videoUrl;
            loadVideo(room.videoUrl);
            video.style.display = "block";
            document.getElementById("videoPlaceholder").style.display = "none";
        }

        // --- ЛОГИКА СИНХРОНИЗАЦИИ ---
        if (!room.state || room.state.user === user.email) return;

        const state = room.state;
        blockSending = true; // Запрещаем плееру отправлять события "обратно"

        // Всегда синхронизируем время при изменениях
        if (Math.abs(video.currentTime - state.time) > 1) {
            video.currentTime = state.time;
        }

        // Состояние воспроизведения
        if (state.playing && video.paused) {
            video.play().catch(() => console.log("Нужен клик"));
        } else if (!state.playing && !video.paused) {
            video.pause();
        }

        // Снимаем блок через мгновение, когда плеер обработал команду
        setTimeout(() => { blockSending = false; }, 100);
    });

    // 3. Отправка действий в базу
    const sendAction = (isPlaying) => {
        if (blockSending) return;
        update(ref(db, `rooms/${roomId}/state`), {
            playing: isPlaying,
            time: video.currentTime,
            user: user.email,
            ts: Date.now()
        });
    };

    // События плеера
    video.onplay = () => sendAction(true);
    video.onpause = () => sendAction(false);
    
    video.onseeked = () => {
        if (blockSending) return;
        // При перемотке — принудительная пауза у всех
        video.pause(); 
        sendAction(false);
    };

    // Список участников
    onValue(ref(db, `room_presence/${roomId}`), (snapshot) => {
        const listUI = document.getElementById("userList");
        listUI.innerHTML = "";
        snapshot.forEach(child => {
            const name = child.val().email.split("@")[0];
            listUI.innerHTML += `<div class="user-badge"><span class="status-dot"></span>${name}</div>`;
        });
    });
});

// Смена видео ссылки
document.getElementById("setVideoBtn").onclick = () => {
    const url = document.getElementById("videoUrlInput").value.trim();
    if (url) {
        update(ref(db, `rooms/${roomId}`), {
            videoUrl: url,
            state: { playing: false, time: 0, ts: Date.now(), user: auth.currentUser.email }
        });
    }
};
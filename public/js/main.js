import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onDisconnect, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const roomListUI = document.getElementById('roomList');
const onlineListUI = document.getElementById('onlineList');
const createBtn = document.getElementById('createRoom');
const logoutBtn = document.getElementById('logoutBtn');

// 1. СТАТУС ОНЛАЙН
onAuthStateChanged(auth, (user) => {
    if (user) {
        const myStatusRef = ref(db, `status/${user.uid}`);
        const connectedRef = ref(db, ".info/connected");
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                onDisconnect(myStatusRef).remove();
                set(myStatusRef, { email: user.email, online: true });
            }
        });
    } else {
        window.location.href = "index.html";
    }
});

// 2. КТО В СЕТИ
onValue(ref(db, 'status'), (snapshot) => {
    onlineListUI.innerHTML = "";
    snapshot.forEach((child) => {
        const badge = document.createElement('div');
        badge.className = 'user-badge';
        badge.innerHTML = `<span class="status-dot"></span><span class="user-name">${child.val().email.split('@')[0]}</span>`;
        onlineListUI.appendChild(badge);
    });
});

// 3. СОЗДАНИЕ КОМНАТЫ
createBtn.onclick = async () => {
    const roomName = prompt("Название комнаты:");
    if (roomName) {
        const newRoomRef = push(ref(db, 'rooms'));
        await set(newRoomRef, {
            name: roomName,
            owner: auth.currentUser.email,
            createdAt: serverTimestamp()
        });
        window.location.href = `room.html?id=${newRoomRef.key}`;
    }
};

// 4. СПИСОК КОМНАТ + УДАЛЕНИЕ
onValue(ref(db, 'rooms'), (snapshot) => {
    roomListUI.innerHTML = "";
    snapshot.forEach((child) => {
        const roomId = child.key;
        const room = child.val();
        const isOwner = auth.currentUser && room.owner === auth.currentUser.email;

        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div class="room-info">
                <h4>${room.name}</h4>
                <p>Host: ${room.owner.split('@')[0]}</p>
            </div>
            <div class="room-actions">
            <button class="join-btn" data-id="${roomId}">Join</button>
            ${isOwner ? `<button class="btn-secondary delete-btn" data-id="${roomId}">Delete</button>` : ''}
            </div>
        `;
        roomListUI.appendChild(card);
    });

    // Кнопка входа
    document.querySelectorAll('.join-btn').forEach(btn => {
        btn.onclick = () => window.location.href = `room.html?id=${btn.dataset.id}`;
    });

    // Кнопка удаления (только для владельца)
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation(); // Чтобы не сработал клик по карточке
            if (confirm("Удалить эту комнату?")) {
                remove(ref(db, `rooms/${btn.dataset.id}`));
                remove(ref(db, `room_presence/${btn.dataset.id}`));
            }
        };
    });
});

logoutBtn.onclick = () => signOut(auth);
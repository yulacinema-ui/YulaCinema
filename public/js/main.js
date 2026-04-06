import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-2n8UlUbuiD0SLNj0tLTjvVaIfaTY61g",
    authDomain: "yulacinema-ec8ef.firebaseapp.com",
    projectId: "yulacinema-ec8ef",
    databaseURL: "https://yulacinema-ec8ef-default-rtdb.firebaseio.com",
    storageBucket: "yulacinema-ec8ef.firebasestorage.app",
    messagingSenderId: "194720886903",
    appId: "1:194720886903:web:4c1015a88a0332698a5672"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Элементы
const roomListUI = document.getElementById('roomList');
const onlineListUI = document.getElementById('onlineList');
const createBtn = document.getElementById('createRoom');
const logoutBtn = document.getElementById('logoutBtn');

// --- 1. СИСТЕМА ПРИСУТСТВИЯ И ПРОВЕРКА ВХОДА ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const myStatusRef = ref(db, `status/${user.uid}`);
        const connectedRef = ref(db, ".info/connected");

        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // Когда пользователь отключается, Firebase удаляет запись из /status/
                onDisconnect(myStatusRef).remove();

                // Устанавливаем статус "В сети"
                set(myStatusRef, {
                    email: user.email,
                    online: true,
                    lastActive: serverTimestamp()
                });
            }
        });
    } else {
        // Если не авторизован — отправляем на логин
        if (!window.location.pathname.includes("index.html")) {
            window.location.href = "index.html";
        }
    }
});

// --- 2. ОТОБРАЖЕНИЕ КТО В СЕТИ ---
onValue(ref(db, 'status'), (snapshot) => {
    onlineListUI.innerHTML = "";
    
    if (!snapshot.exists()) {
        onlineListUI.innerHTML = '<span class="empty-msg">Никого нет в сети</span>';
        return;
    }

    snapshot.forEach((child) => {
        const userData = child.val();
        const name = userData.email.split('@')[0];
        
        const badge = document.createElement('div');
        badge.className = 'user-badge';
        badge.innerHTML = `
            <span class="status-dot"></span>
            <span class="user-name">${name}</span>
        `;
        onlineListUI.appendChild(badge);
    });
});

// --- 3. СОЗДАНИЕ КОМНАТЫ ---
if (createBtn) {
    createBtn.onclick = async () => {
        const roomName = prompt("Введите название комнаты:", "Мой кинотеатр");
        if (roomName) {
            try {
                const roomsRef = ref(db, 'rooms');
                const newRoomRef = push(roomsRef);
                
                await set(newRoomRef, {
                    name: roomName,
                    owner: auth.currentUser.email,
                    createdAt: serverTimestamp()
                });
                
                window.location.href = `room.html?id=${newRoomRef.key}`;
            } catch (e) {
                alert("Ошибка доступа! Проверьте правила в Firebase Console.");
            }
        }
    };
}

// --- 4. СПИСОК КОМНАТ ---
onValue(ref(db, 'rooms'), (snapshot) => {
    roomListUI.innerHTML = "";
    
    if (!snapshot.exists()) {
        roomListUI.innerHTML = '<p style="color:gray; padding:20px;">Список комнат пуст</p>';
        return;
    }

    snapshot.forEach((child) => {
        const roomId = child.key;
        const room = child.val();
        
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div class="room-info">
                <h4>${room.name}</h4>
                <p>Создал: ${room.owner.split('@')[0]}</p>
            </div>
            <button class="btn-secondary join-btn" data-id="${roomId}">Войти</button>
        `;
        roomListUI.appendChild(card);
    });

    // Обработчик для кнопок "Войти"
    document.querySelectorAll('.join-btn').forEach(btn => {
        btn.onclick = () => {
            window.location.href = `room.html?id=${btn.dataset.id}`;
        };
    });
});

// ВЫХОД
if (logoutBtn) {
    logoutBtn.onclick = () => signOut(auth);
}
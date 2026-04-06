import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- Твой Firebase конфиг ---
const firebaseConfig = {
    apiKey: "AIzaSyD-2n8UlUbuiD0SLNj0tLTjvVaIfaTY61g",
    authDomain: "yulacinema-ec8ef.firebaseapp.com",
    projectId: "yulacinema-ec8ef",
    databaseURL: "https://yulacinema-ec8ef-default-rtdb.firebaseio.com/",
    storageBucket: "yulacinema-ec8ef.firebasestorage.app",
    messagingSenderId: "194720886903",
    appId: "1:194720886903:web:4c1015a88a0332698a5672"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Элементы интерфейса
const roomListUI = document.getElementById('roomList');
const createBtn = document.getElementById('createRoom');
const logoutBtn = document.getElementById('logoutBtn');

// 1. ПРОВЕРКА АВТОРИЗАЦИИ
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Если не залогинен — на выход
        window.location.href = "index.html";
    } else {
        console.log("Logged in as:", user.email);
    }
});

// 2. ВЫХОД ИЗ АККАУНТА
if (logoutBtn) {
    logoutBtn.onclick = () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        });
    };
}

// 3. СОЗДАНИЕ КОМНАТЫ
if (createBtn) {
    createBtn.onclick = async () => {
        try {
            const roomsRef = ref(db, 'rooms');
            const newRoomRef = push(roomsRef); // Генерируем уникальный ID
            
            const roomName = prompt("Введите название комнаты:", "Кинотеатр " + Math.floor(Math.random() * 100));
            
            if (roomName) {
                await set(newRoomRef, {
                    name: roomName,
                    owner: auth.currentUser.email,
                    createdAt: Date.now(),
                    status: "waiting"
                });
                
                // Сразу переходим в созданную комнату
                window.location.href = `room.html?id=${newRoomRef.key}`;
            }
        } catch (error) {
            console.error("Ошибка при создании комнаты:", error);
            alert("Не удалось создать комнату. Проверьте правила базы данных.");
        }
    };
}

// 4. ОТОБРАЖЕНИЕ СПИСКА КОМНАТ (Realtime)
onValue(ref(db, 'rooms'), (snapshot) => {
    roomListUI.innerHTML = "";
    
    if (!snapshot.exists()) {
        roomListUI.innerHTML = `<p style="color: grey; text-align: center; margin-top: 20px;">Нет доступных комнат. Создайте первую!</p>`;
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const roomId = childSnapshot.key;
        const room = childSnapshot.val();
        
        // Создаем карточку в стиле iOS
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.innerHTML = `
            <div class="room-info">
                <h4>${room.name}</h4>
                <p>Хост: ${room.owner.split('@')[0]}</p>
            </div>
            <button class="btn-secondary join-btn" data-id="${roomId}">Войти</button>
        `;
        
        roomListUI.appendChild(roomCard);
    });

    // Добавляем обработчик на кнопки "Войти"
    document.querySelectorAll('.join-btn').forEach(button => {
        button.onclick = () => {
            const id = button.getAttribute('data-id');
            window.location.href = `room.html?id=${id}`;
        };
    });
});
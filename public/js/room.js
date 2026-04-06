import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Получаем ID комнаты из ссылки (?id=XXXXX)
const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');

if (!roomId) {
    window.location.href = 'watch.html';
}

const roomTitle = document.getElementById('roomTitle');

// Подгружаем данные именно этой комнаты
onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        roomTitle.innerText = data.name;
    } else {
        roomTitle.innerText = "Room not found";
    }
});
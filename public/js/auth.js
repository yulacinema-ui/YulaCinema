import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-2n8UlUbuiD0SLNj0tLTjvVaIfaTY61g", // Проверь, чтобы не было пробелов
    authDomain: "yulacinema-ec8ef.firebaseapp.com",
    projectId: "yulacinema-ec8ef",
    storageBucket: "yulacinema-ec8ef.firebasestorage.app",
    messagingSenderId: "194720886903",
    appId: "1:194720886903:web:4c1015a88a0332698a5672"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const errorMsg = document.getElementById("error");

loginBtn.addEventListener("click", () => {
    const email = emailInput.value;
    const password = passInput.value;

    if(!email || !password) {
        errorMsg.innerText = "Введите почту и пароль";
        return;
    }

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            window.location.href = "watch.html";
        })
        .catch((error) => {
            console.error(error);
            errorMsg.innerText = "Ошибка: неверный логин или пароль";
        });
});
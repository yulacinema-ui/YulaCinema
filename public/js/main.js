import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- Firebase конфиг ---
const firebaseConfig = {
  apiKey: "AIzaSyD-2n8UlUbuiD0SLNj0tLTjvVaIfaTY61g",
  authDomain: "yulacinema-ec8ef.firebaseapp.com",
  projectId: "yulacinema-ec8ef",
  storageBucket: "yulacinema-ec8ef.firebasestorage.app",
  messagingSenderId: "194720886903",
  appId: "1:194720886903:web:4c1015a88a0332698a5672"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;

// --- Проверка авторизации ---
onAuthStateChanged(auth, user => {
  currentUser = user;
  if(user){
    if(document.getElementById('loginBtn')) initLoginPage();
    if(document.getElementById('createRoom')) initWatchPage();
  }else{
    if(document.getElementById('loginBtn') === null) window.location="index.html";
  }
});

// --- Страница логина ---
function initLoginPage(){
  document.getElementById('loginBtn').addEventListener('click', ()=>{
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    signInWithEmailAndPassword(auth,email,password)
      .then(()=> window.location="watch.html")
      .catch(()=> document.getElementById('error').innerText="Неверный email или пароль");
  });
}

// --- Главная watch.html ---
function initWatchPage(){
  updateUserStatus();
  loadRooms();

  document.getElementById('createRoom').addEventListener('click', createRoom);
}

// --- Статус пользователей ---
function updateUserStatus(){
  if(!currentUser) return;
  const usersRef = ref(db,'users/' + currentUser.uid);
  set(usersRef,{ name: currentUser.email, online:true });

  onValue(ref(db,'users'), snapshot=>{
    const data = snapshot.val() || {};
    const userEls = document.querySelectorAll('.profile');
    Object.keys(data).forEach((uid,i)=>{
      if(userEls[i]) userEls[i].innerText=`👤 ${data[uid].name} (${data[uid].online?'online':'offline'})`;
    });
  });
}

// --- Создать комнату ---
function createRoom(){
  if(!currentUser) return;
  const newRoomRef = push(ref(db,'rooms'));
  set(newRoomRef,{ name:`Комната ${newRoomRef.key}`, creator: currentUser.uid });
}

// --- Список комнат ---
function loadRooms(){
  onValue(ref(db,'rooms'), snapshot=>{
    const data = snapshot.val() || {};
    const roomList = document.getElementById('roomList');
    if(!roomList) return;
    roomList.innerHTML='';
    for(let key in data){
      const li = document.createElement('li');
      li.innerText = data[key].name;
      li.dataset.roomId = key;
      roomList.appendChild(li);
    }
  });
}
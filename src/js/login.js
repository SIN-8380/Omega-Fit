// 🔥 Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPo_Ye4r9JBKXyNODh7lqJ0SCaxKwApVs",
  authDomain: "workoutplanner-8380.firebaseapp.com",
  databaseURL: "https://workoutplanner-8380-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "workoutplanner-8380",
  storageBucket: "workoutplanner-8380.firebasestorage.app",
  messagingSenderId: "555373044829",
  appId: "1:555373044829:web:486657d67535a8173bd9b4"
};


// 🔥 Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


window.showCustomAlert = function (message, callback) {
  const msgEl = document.getElementById("customAlertMessage");
  const boxEl = document.getElementById("customAlert");
  const okBtn = document.getElementById("customAlertOkBtn");

  if (!msgEl || !boxEl || !okBtn) return console.warn("❌ Alert elements not found.");

  msgEl.innerText = message;
  boxEl.classList.remove("hidden");

  okBtn.onclick = () => {
    boxEl.classList.add("hidden");
    if (typeof callback === "function") callback();
  };
};

// ✅ LOGIN Handler
function handleLogin() {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  if (!email.endsWith("@gmail.com")) return showCustomAlert("❌ Gmail only.");
  if (password.length < 6) return showCustomAlert("❌ Password must be at least 6 characters.");

  signInWithEmailAndPassword(auth, email, password)
    .then((userCred) => {
      const user = userCred.user;
      localStorage.setItem("userId", user.uid);
      localStorage.setItem("userEmail", email);
      window.location.href = "index.html";
    })
    .catch((err) => {
      showCustomAlert("⚠️ Unrecognized login. No matching account was found. You need to register first." );
    });
}

// ✅ REGISTER Handler
function handleRegister() {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  if (!email.endsWith("@gmail.com")) return showCustomAlert("❌ Gmail only.");
  if (password.length < 6) return showCustomAlert("❌ Password must be at least 6 characters.");

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCred) => {
      const user = userCred.user;

      set(ref(db, "users/" + user.uid), {
        email: email,
        workouts: []
      });

      localStorage.setItem("userId", user.uid);
      localStorage.setItem("userEmail", email);
      showCustomAlert("✅ Registered! Redirecting...");
      window.location.href = "index.html";
    })
    .catch((err) => {
      showCustomAlert("❌ Registration failed: " + err.message);
    });
}

// ✅ Attach to buttons after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginButton")?.addEventListener("click", handleLogin);
  document.getElementById("registerButton")?.addEventListener("click", handleRegister);
});


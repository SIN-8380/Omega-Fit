// ─── 🔗 IMPORTS ───────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, remove, set, get, update, child } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
 import { getStorage, ref as storageRef, getDownloadURL, uploadBytes } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { getAuth, deleteUser, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


// ─── ⚙️ FIREBASE CONFIGURATION ───────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBPo_Ye4r9JBKXyNODh7lqJ0SCaxKwApVs",
  authDomain: "workoutplanner-8380.firebaseapp.com",
  databaseURL: "https://workoutplanner-8380-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "workoutplanner-8380",
  storageBucket: "workoutplanner-8380.appspot.com",
  messagingSenderId: "555373044829",
  appId: "1:555373044829:web:486657d67535a8173bd9b4"
};

// ─── 🚀 INITIALIZE FIREBASE APP AND SERVICES ─────────────────────

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);

// ─── 🧠 GLOBAL STATE VARIABLES ─────────────────────────────────────
let editBoxExercises = [];
let currentBoxElement = null;
let playExercises = [];
let paused = false;
let remainingTime = 0;
let workoutFinishedNaturally = false;
let playIndex = 0;
let currentSet = 1;
let playTimerInterval = null;
let circularCountdownInterval = null;
let circularOnComplete = null;
let circularTotalSeconds = 0;
let countdownStartTime = null;
let countdownPausedAt = null;
let beepPlayed = false;
let beepWasPlaying = false;
let countdownTargetTime = null;
let playWorkoutBoxName = "";
let currentMonthOffset = 0;
let noteCreationLock = false;
const badgeRegistry = defineBadgeRegistry();
const svg = badgeRegistry["Rookie"][3];

// ─── 🔊 SOUND CONFIG ───────────────────────────────────────────────
const soundPathPrefix = location.hostname === "localhost" ? "/sounds/" : "/Omega-Fit/sounds/";
const timerBeep = new Audio(soundPathPrefix + "timer.mp3");

// ─── 🧪 BOOTSTRAP: AUTH + DATA LOAD ─────────────────────────────────────
function waitForFirebaseAndRun() {
  try {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "./login.html";
        return;
      }
      
      const userId = user.uid;
      const email = user.email;
      
      localStorage.setItem("userId", userId);
      localStorage.setItem("userEmail", email);
    
      loadFromFirebase(userId);
      loadUserProfileFromFirebase(userId);
      loadAnalyticsFromFirebase(userId);
      loadNotes(userId); 
      fetchRankFromFirebase(userId);
      
      fetchBadgeProgress(userId).then((progressMap) => {
        const savedRank = localStorage.getItem("userRank") || "Rookie I";
        
        updateBadgeProgress(savedRank);
        
        const patchedMap = JSON.parse(localStorage.getItem("userRankProgress") || "{}");
        
        renderUserRank(savedRank);
        renderCurrentRankBadge(savedRank);
        renderAllUnlockedBadges(patchedMap);
      });
      
      setupAvatar?.();
      setupProfileName?.();
      injectUserEmail?.();
      renderWorkoutChart?.();
    });
  } catch (err) {
    console.warn("⏳ Firebase not ready yet. Retrying...");
    setTimeout(waitForFirebaseAndRun, 100);
  }
}

function loadUserRank() {
  const rank = localStorage.getItem("userRank") || "Rookie I";
  const progressMap = JSON.parse(localStorage.getItem("userRankProgress")) || {};
  
  document.getElementById("userRank").innerText = rank;
  }

// ─── 🧰 DOM UTILITIES ─────────────────────────────────────────────
window.toggleCalendar = function () {
  const wrapper = document.getElementById("calendarWrapper");
  if (!wrapper) return;

  const isClosing = !wrapper.classList.contains("hidden");
  wrapper.classList.toggle("hidden");

  if (isClosing) {
    currentMonthOffset = 0;
  }

  if (!wrapper.classList.contains("hidden")) {
    renderCalendar("calendar");
  }
};

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function openAddExerciseModal() {

  document.getElementById("exName").value = "";
  document.getElementById("exSet").value = "";
  document.getElementById("exRep").value = "";
  document.getElementById("exTime").value = "";
  document.getElementById("exRest").value = "";
  document.getElementById("exRestBetween").value = "";

  document.getElementById("addExerciseModal").style.display = "flex";
}

function injectUserEmail(id = "userEmailDisplay") {
  const email = localStorage.getItem("userEmail") || "Unknown";
  const el = document.getElementById(id);
  if (el) el.textContent = email;
}

function convertRomanToNumber(roman) {
  const map = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const val = map[roman?.toUpperCase()];
  if (!val) console.warn(`⚠️ Unknown Roman numeral: ${roman}`);
  return val || 1;
}

function toRoman(num) {
  const map = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V"
  };
  return map[num] || "?";
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function toggleNoteExpansion(noteId) {
  const noteBox = document.querySelector(`[data-note-id="${noteId}"]`);
  if (!noteBox) return;
  
  document.querySelectorAll(".note-box.expanded").forEach(box => {
    box.classList.remove("expanded");
    const ta = box.querySelector(".note-content");
    if (ta) ta.readOnly = true;
    
    const backBtn = box.querySelector(".note-back-btn");
    if (backBtn) backBtn.style.display = "none";
  });
  
  noteBox.classList.add("expanded");
  const textarea = noteBox.querySelector(".note-content");
  if (textarea) {
    textarea.readOnly = false;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    
    textarea.style.overflowY = "scroll";
  }
  
  const backBtn = noteBox.querySelector(".note-back-btn");
  if (backBtn) backBtn.style.display = "inline-block";
}

function collapseNoteBox(noteId) {
  const noteBox = document.querySelector(`[data-note-id="${noteId}"]`);
  if (!noteBox) return;
  
  noteBox.classList.remove("expanded");
  
  const textarea = noteBox.querySelector(".note-content");
  if (textarea) {
    textarea.readOnly = true;
    textarea.scrollTop = 0;
  }
  
  const backBtn = noteBox.querySelector(".note-back-btn");
  if (backBtn) backBtn.style.display = "none";
}

function closeNotesScreen() {
  const mainUI = document.querySelector("#app");
  const notesScreen = document.querySelector("#notesScreen");
  
  if (!mainUI || !notesScreen) {
    console.warn("❌ Missing #notesScreen or #app in DOM.");
    return;
  }
  
  notesScreen.style.display = "none";
  mainUI.style.display = "";
}

// ─── 👤 PROFILE NAME SETUP ─────────────────────────────────────────────
function setupAvatar() {
  const profilePic = document.getElementById("profilePic");
  const avatarUpload = document.getElementById("avatarUpload");
  const storage = getStorage();
  const userId = localStorage.getItem("userId") || "defaultUser";
  
  const cachedAvatar = localStorage.getItem("profileAvatar");
  if (cachedAvatar) {
    profilePic.src = cachedAvatar;
  } else {
    const imageRef = storageRef(storage, `avatars/${userId}.jpg`);
    getDownloadURL(imageRef)
      .then((url) => {
        profilePic.src = url;
        localStorage.setItem("profileAvatar", url);
      })
      .catch((err) => {
        console.warn("⚠️ No Firebase avatar found or failed:", err.message);
      });
  }
  
  const wrapper = document.querySelector(".profile-pic-wrapper");
  if (wrapper && avatarUpload) {
    wrapper.addEventListener("click", () => avatarUpload.click());
  }
  
  avatarUpload.addEventListener("change", async () => {
    const file = avatarUpload.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      profilePic.src = e.target.result;
      localStorage.setItem("profileAvatar", e.target.result);
    };
    reader.readAsDataURL(file);
    
    try {
      const avatarRef = storageRef(storage, `avatars/${userId}.jpg`);
      await uploadBytes(avatarRef, file);
      const downloadURL = await getDownloadURL(avatarRef);
      profilePic.src = downloadURL;
      localStorage.setItem("profileAvatar", downloadURL);
      console.log("✅ Avatar updated in Firebase");
    } catch (error) {
      console.error("🔥 Upload failed:", error.message);
    }
  });
}

function loadUserProfileFromFirebase(userId) {
  const profileRef = ref(db, `users/${userId}/profile`);
  get(profileRef)
    .then((snapshot) => {
      if (!snapshot.exists()) {
        console.log("⚠️ No profile data");
        return;
      }
      
      const { name, avatar } = snapshot.val();
      
      if (name) {
        document.getElementById("profileNameDisplay").innerText = name;
        localStorage.setItem("profileName", name);
      }
      
      if (avatar) {
        document.getElementById("profilePic").src = avatar;
        localStorage.setItem("profileAvatar", avatar);
      }
    })
    .catch((err) => console.error("❌ Failed to load profile:", err));
}

function syncProfileToFirebase() {
  const userId = localStorage.getItem("userId");
  if (!userId) return console.warn("❌ Cannot sync profile: Missing userId");
  
  const name = localStorage.getItem("profileName") || "Anonymous";
  const avatar = localStorage.getItem("profileAvatar") || "default.jpg";
  
  console.log("🛰️ Syncing profile:", { name, avatar });
  
  const profileRef = ref(db, `users/${userId}/profile`);
  set(profileRef, { name, avatar })
    .then(() => console.log("✅ Profile synced to Firebase"))
    .catch((err) => console.error("❌ Failed to sync profile:", err));
}

function loadProfileName() {
  const stored = localStorage.getItem("profileName");
  if (stored) {
    document.getElementById("profileNameDisplay").textContent = stored;
  }
}

function setupProfileName() {
  const nameDisplay = document.getElementById("profileNameDisplay");
  const nameInput = document.getElementById("profileNameInput");

  const stored = localStorage.getItem("profileName");
  if (stored) nameDisplay.innerText = stored;

  nameDisplay.addEventListener("click", () => {
    nameInput.value = nameDisplay.innerText;
    nameDisplay.style.display = "none";
    nameInput.style.display = "inline-block";
    nameInput.focus();
    nameInput.select();
  });

function startEditingProfileName() {
  const display = document.getElementById("profileNameDisplay");
  const input = document.getElementById("profileNameInput");
  
  input.value = display.innerText;
  display.style.display = "none";
  input.style.display = "inline-block";
  input.focus();
  input.select();
}

function saveProfileName() {
    let name = nameInput.value.trim();
    if (!name) name = "Anonymous";
    nameDisplay.innerText = name;
    localStorage.setItem("profileName", name);
    nameInput.style.display = "none";
    nameDisplay.style.display = "inline-block";
    syncProfileToFirebase();
  }

  nameInput.addEventListener("blur", saveProfileName);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveProfileName();
  });
}

function saveProfileName() {
  const input = document.getElementById("profileNameInput");
  const display = document.getElementById("profileNameDisplay");
  
  let name = input.value.trim();
  if (name === "") name = "Anonymous";
  
  display.textContent = name;
  localStorage.setItem("profileName", name);
  
  input.style.display = "none";
  display.style.display = "inline-block";
  
  syncProfileToFirebase();
}

// ─── 👤 PROFILE SCREEN TOGGLE ─────────────────────────────────────

function openProfileScreen() {
  document.getElementById("profilePage").style.display = "block";

  document.querySelector("header").style.display = "none";
  document.querySelector(".workout-container").style.display = "none";
  document.querySelector(".floating-btn").style.display = "none";
  document.querySelector(".floating-btn-profile").style.display = "none";

  requestAnimationFrame(() => {
  renderWorkoutChart();
  updateProfileStats();
});
}

function closeProfileScreen() {
  document.getElementById("profilePage").style.display = "none";

  document.querySelector("header").style.display = "flex";
  document.querySelector(".workout-container").style.display = "block";
  document.querySelector(".floating-btn").style.display = "block";
  document.querySelector(".floating-btn-profile").style.display = "block";
}

// ─── 💾 WORKOUT DATA SYNC ─────────────────────────────────────────
window.serializeWorkoutBox = function (box) {
  const name = box.querySelector("h3").innerText;
  const prepTime = parseInt(box.dataset.prepTime || "0");
  const exercises = Array.from(box.querySelectorAll("tbody tr")).map((row) => ({
    name: row.children[0].innerText,
    set: +row.children[1].innerText,
    rep: +row.children[2].innerText,
    time: +row.children[3].innerText,
    rest: +row.children[4].innerText,
    restAfter: +row.dataset.restAfter || 20
  }));
  return { name, prepTime, exercises };
};

window.saveWorkoutData = function() {
  const userId = localStorage.getItem("userId");
  if (!userId) return console.warn("❌ No user ID found");
  
  const allBoxes = [];
  document.querySelectorAll(".workout-box").forEach(box => {
    const boxName = box.querySelector(".box-title")?.innerText || "Unnamed";
    const prepTime = box.dataset.prepTime || 0;
    const exercises = [];
    
    box.querySelectorAll("tbody tr").forEach(row => {
      exercises.push({
        name: row.cells[0].innerText,
        set: +row.cells[1].innerText,
        rep: +row.cells[2].innerText,
        time: +row.cells[3].innerText,
        rest: +row.cells[4].innerText,
        restAfter: +row.dataset.restAfter || 0
      });
    });
    
    allBoxes.push({ name: boxName, prep: +prepTime, exercises });
  });
  
  localStorage.setItem("workoutData", JSON.stringify(allBoxes));
  
  set(ref(db, `users/${userId}/workouts`), allBoxes)
    .then(() => console.log("✅ Workouts saved to Firebase"))
    .catch((err) => console.error("❌ Workout save failed:", err));
};

window.loadFromFirebase = function() {
  const auth = getAuth();
  const userId = localStorage.getItem("userId");
  
  get(ref(db, `users/${userId}/workouts`))
    .then((snapshot) => {
      if (!snapshot.exists()) {
        console.log("⚠️ No workout data found.");
        return;
      }
      
      const container = document.getElementById("workoutContainer");
      if (container) container.innerHTML = "";
     
      const workoutData = snapshot.val();
      workoutData.forEach(createWorkoutBoxFromData);
      
      localStorage.setItem("workoutData", JSON.stringify(workoutData));
    })
    .catch((err) => console.error("❌ Load failed:", err));
};

function saveRankToFirebase(userId, rank, progressMap = {}) {
  const updates = {
    [`users/${userId}/rank`]: rank,
    [`users/${userId}/rankProgress`]: progressMap
  };
  
  return update(ref(db), updates)
    .then(() => {
      localStorage.setItem("userRank", rank);
      localStorage.setItem("userRankProgress", JSON.stringify(progressMap));
    })
    .catch(err => {
      console.error("❌ Failed to save rank and badge progress:", err.message);
    });
}

function saveNotes(userId, notes) {
  
  const db = getDatabase();
  const notesRef = ref(db, `users/${userId}/notes`);
  //const notesRef = ref(db, `notes/${userId}`);
  
  set(notesRef, notes);
}

function loadNotes(userId) {
  const db = getDatabase();
    const notesRef = ref(db, `users/${userId}/notes`);

  get(notesRef)
    .then(snapshot => {
      const notes = snapshot.exists() ? snapshot.val() : [];
      localStorage.setItem("userNotes", JSON.stringify(notes));
      renderAllNotes();
    })
    .catch(err => console.error("❌ Failed to load notes:", err));
}

// ─── 🎮 PLAY MODE EXECUTION ─────────────────────────────────────────

function startPlayMode(btn) {
  const box = btn.closest(".workout-box");
  playWorkoutBoxName = box.querySelector("h3").innerText.trim();
  
  if (timerBeep) timerBeep.load();
  
  const rows = Array.from(box.querySelectorAll("tbody tr"));
  if (rows.length === 0) return showCustomAlert("⚠️ No exercises to play");
  
  playExercises = rows.map(row => ({
    name: row.children[0].innerText,
    set: +row.children[1].innerText,
    rep: +row.children[2].innerText,
    time: +row.children[3].innerText,
    rest: +row.children[4].innerText,
    restAfter: isNaN(+row.dataset.restAfter) ? 0 : +row.dataset.restAfter
  }));
  
  playIndex = 0;
  currentSet = 1;
  document.getElementById("playScreen").style.display = "flex";
  
  const prep = parseInt(box.dataset.prepTime || "0");
  if (prep > 0) {
    document.getElementById("playExerciseName").innerText = "Get Ready";
    document.getElementById("playExerciseDetails").innerText = "Starting in...";
    startCircularCountdown(prep, showCurrentSet);
  } else {
    showCurrentSet();
  }
}

function showCurrentSet() {
  const ex = playExercises[playIndex];
  
  document.getElementById("playExerciseName").innerText = ex.name;
  document.getElementById("playExerciseDetails").innerText = `Set ${currentSet}/${ex.set} | Rep: ${ex.rep}`;
  
  if (ex.time > 0) {
    startCircularCountdown(ex.time, () => {
      const restTime = currentSet >= ex.set ? ex.restAfter : ex.rest;
      startRestPhase(restTime);
    });
  } else {
    const nextBtn = document.getElementById("nextSetBtn");
    if (nextBtn) nextBtn.style.display = "inline-block";
  }
}

function startRestPhase(duration) {
  const isFinalSet = currentSet >= playExercises[playIndex].set;
  const isLastExercise = playIndex + 1 >= playExercises.length;
  
  if (isFinalSet && isLastExercise && duration <= 0) {
    workoutFinishedNaturally = true;
    
    document.getElementById("playExerciseName").innerText = "Workout Complete";
    document.getElementById("playExerciseDetails").innerText = "Great job! Returning...";
    
    setTimeout(() => {
      exitPlayMode();
    }, 2000);
    
    return;
  }
  
  const nextExerciseName = !isLastExercise ? playExercises[playIndex + 1].name : "You're done!";
  const message = isFinalSet ?
    `Next: ${nextExerciseName}` :
    `Rest before set ${currentSet + 1}`;
  
  document.getElementById("playExerciseName").innerText = "Rest";
  document.getElementById("playExerciseDetails").innerText = message;
  
  startCircularCountdown(duration, () => {
    if (isFinalSet) {
      playIndex++;
      currentSet = 1;
      
      if (playIndex >= playExercises.length) {
        workoutFinishedNaturally = true;
        
        document.getElementById("playExerciseName").innerText = "Workout Complete";
        document.getElementById("playExerciseDetails").innerText = "Great job! Returning...";
        
        return setTimeout(() => {
          exitPlayMode();
        }, 2000);
      }
    } else {
      currentSet++;
    }
    
    showCurrentSet();
  });
}

function pauseWorkout() {
  if (paused) return;
  paused = true;
  countdownPausedAt = performance.now();
  cancelAnimationFrame(circularCountdownInterval);
  
  if (timerBeep && !timerBeep.paused) {
    timerBeep.pause();
    beepWasPlaying = true;
  } else {
    beepWasPlaying = false;
  }
  
  console.log("⏸️ Paused at", remainingTime.toFixed(2), "seconds");
}

function resumeWorkout() {
  if (!paused || remainingTime <= 0) return;
  paused = false;
  
  const pauseDuration = performance.now() - countdownPausedAt;
  countdownStartTime += pauseDuration;
  countdownTargetTime += pauseDuration;
  
  if (circularCountdownInterval) cancelAnimationFrame(circularCountdownInterval);
  circularCountdownInterval = null;
  
  function update(now) {
    if (paused) {
      circularCountdownInterval = requestAnimationFrame(update);
      return;
    }
    
    const remainingMs = countdownTargetTime - now;
    remainingTime = Math.max(0, remainingMs / 1000);
    
    const progress = document.querySelector(".circle-progress");
    const text = document.querySelector(".circle-text");
    const offset = (2 * Math.PI * 45) * (1 - remainingTime / circularTotalSeconds);
    progress.style.strokeDashoffset = offset.toFixed(2);
    text.textContent = Math.ceil(remainingTime);
    
    if (remainingTime <= 4 && !beepPlayed) {
      beepPlayed = true;
      try {
        timerBeep.currentTime = 0;
        timerBeep.play();
      } catch (err) {
        console.warn("🔇 Resume beep failed:", err.message);
      }
    }
    
    if (remainingTime <= 0) {
      if (typeof circularOnComplete === "function") circularOnComplete();
      circularCountdownInterval = null;
      return;
    }
    
    circularCountdownInterval = requestAnimationFrame(update);
  }
  
  circularCountdownInterval = requestAnimationFrame(update);
  
  if (timerBeep && beepWasPlaying) {
    try {
      timerBeep.play();
    } catch (err) {
      console.warn("🔇 Resume audio failed:", err.message);
    }
    beepWasPlaying = false;
  }
  
  console.log("▶️ Resumed with", remainingTime.toFixed(2), "s remaining");
}

function startCircularCountdown(durationInSeconds, onComplete) {
  const progress = document.querySelector(".circle-progress");
  const text = document.querySelector(".circle-text");
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  progress.style.strokeDasharray = circumference;
  
  circularTotalSeconds = durationInSeconds;
  paused = false;
  beepPlayed = false;
  circularOnComplete = onComplete;
  
  const now = performance.now();
  countdownStartTime = now;
  countdownTargetTime = now + durationInSeconds * 1000;
  
  if (circularCountdownInterval) cancelAnimationFrame(circularCountdownInterval);
  circularCountdownInterval = null;
  
  const firstSpokenNumber = 4;
  const skipAmount = Math.max(0, firstSpokenNumber - durationInSeconds);
  
  function update(now) {
    if (paused) {
      circularCountdownInterval = requestAnimationFrame(update);
      return;
    }
    
    const remainingMs = countdownTargetTime - now;
    remainingTime = Math.max(0, remainingMs / 1000);
    
    const offset = circumference * (1 - remainingTime / circularTotalSeconds);
    progress.style.strokeDashoffset = offset.toFixed(2);
    text.textContent = Math.ceil(remainingTime);
    
    const beepOffset = 4 - remainingTime;

if (!beepPlayed && remainingTime <= 4 && beepOffset >= 0 && beepOffset <= 4) {
  beepPlayed = true;
  try {
    timerBeep.currentTime = beepOffset;
    timerBeep.play();
    console.log(`🔊 Beep played from ${beepOffset.toFixed(2)}s`);
  } catch (err) {
    console.warn("🔇 Beep play failed:", err.message);
  }
}
    
    if (remainingTime <= 0) {
      if (typeof circularOnComplete === "function") circularOnComplete();
      circularCountdownInterval = null;
      return;
    }
    
    circularCountdownInterval = requestAnimationFrame(update);
  }
  
  circularCountdownInterval = requestAnimationFrame(update);
}

function togglePauseResume(btn) {
  if (paused) {
    resumeWorkout();
    btn.innerText = "Pause";
  } else {
    pauseWorkout();
    btn.innerText = "Resume";
  }
}

function nextSetOrExercise() {
  clearInterval(playTimerInterval);
  const ex = playExercises[playIndex];
  
  const isFinalSet = currentSet >= ex.set;
  
  const nextBtn = document.getElementById("nextSetBtn");
  if (nextBtn) nextBtn.style.display = "none";
  
  if (ex.time === 0) {
    const restDuration = isFinalSet ? ex.restAfter : ex.rest;
    startRestPhase(restDuration);
    return;
  }
  
  if (isFinalSet) {
    playIndex++;
    currentSet = 1;
    
    if (playIndex >= playExercises.length) {
      workoutFinishedNaturally = true;
      exitPlayMode();
      return;
    }
  } else {
    currentSet++;
  }
  
  showCurrentSet();
}

function exitPlayMode() {
  
  const screen = document.getElementById("playScreen");
  if (screen) screen.style.display = "none";
  
  if (playTimerInterval) {
    clearInterval(playTimerInterval);
    playTimerInterval = null;
  }
  
  if (circularCountdownInterval) {
  cancelAnimationFrame(circularCountdownInterval);
  circularCountdownInterval = null;
}
  beepPlayed = false;
paused = false;
circularOnComplete = null;

  if (typeof activeTimeout !== "undefined" && activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  
  if (timerBeep) {
    try {
      timerBeep.pause();
      timerBeep.currentTime = 0;
    } catch (e) {
      console.warn("⚠️ Beep kill failed:", e);
    }
  }
  
  const progress = document.querySelector(".circle-progress");
  const text = document.querySelector(".circle-text");
  if (progress) progress.style.strokeDashoffset = 0;
  if (text) text.textContent = "";

  if (!workoutFinishedNaturally && playIndex >= playExercises.length) {
    workoutFinishedNaturally = true;
  }
  
  if (workoutFinishedNaturally) {
    markTodayWorkoutComplete(playWorkoutBoxName);
    updateUserRank();
    updateProfileStats();
    renderWorkoutChart();
    syncAnalyticsToFirebase();
    
  }
  workoutFinishedNaturally = false;
  playIndex = 0;
  currentSet = 1;
  playExercises = [];
}

// ─── 📦 WORKOUT BOX MANAGEMENT ──────────────────────────────────────

window.openAddWorkoutModal = function() {
  document.getElementById("addBoxModal").style.display = "flex";
  currentBoxElement = null;
  
  document.getElementById("newBoxName").value = "";
  document.getElementById("prepTimeInput").value = "";
};

function createWorkoutBox() {
  const nameInput = document.getElementById("newBoxName");
  const prepInput = document.getElementById("prepTimeInput");
  
  const name = nameInput.value.trim();
  const prepTime = parseInt(prepInput.value || "0");
  
  if (!name) {
    showCustomAlert("Workout box name is required.");
    return;
  }
  
  const box = document.createElement("div");
  box.className = "workout-box";
  box.dataset.prepTime = prepTime;
  
  box.innerHTML = `
    <div class="workout-header">
      <h3 contenteditable="true" class="box-title">${name}</h3>
      <div>
        <button class="btn" onclick="openEditOptions(this)">Edit</button>
        <button class="btn" onclick="startPlayMode(this)">Play</button>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>Name</th><th>Set</th><th>Rep</th><th>Time</th><th>Rest</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  
  document.getElementById("workoutContainer").appendChild(box);
  
  box.querySelector("h3").addEventListener("input", saveWorkoutData);
  
  saveWorkoutData();
  
  nameInput.value = "";
  prepInput.value = "";
  
  document.getElementById("addBoxModal").style.display = "none";
}

window.createWorkoutBoxFromData = function(data) {
  const container = document.getElementById("workoutContainer");
  const { name, prep = 0, exercises = [] } = data;
  
  const box = document.createElement("div");
  box.className = "workout-box";
  box.dataset.prepTime = prep;
  
  box.innerHTML = `
    <div class="workout-header">
      <h3 contenteditable="true" class="box-title">${name}</h3> <!-- ✅ Add class -->
      <div>
        <button class="btn" onclick="openEditOptions(this)">Edit</button>
        <button class="btn" onclick="startPlayMode(this)">Play</button>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>Name</th><th>Set</th><th>Rep</th><th>Time</th><th>Rest</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  
  const tbody = box.querySelector("tbody");
  exercises.forEach((ex) => {
    const tr = document.createElement("tr");
    tr.dataset.restAfter = isNaN(ex.restAfter) ? 0 : ex.restAfter;
    tr.innerHTML = `<td>${ex.name}</td><td>${ex.set}</td><td>${ex.rep}</td><td>${ex.time}</td><td>${ex.rest}</td>`;
    tbody.appendChild(tr);
  });
  
  box.querySelector(".box-title").addEventListener("input", saveWorkoutData);
  container.appendChild(box);
};

function openEditOptions(btn) {
  currentBoxElement = btn.closest(".workout-box");
  document.getElementById("editOptionsModal").style.display = "flex";
}

function openEditBoxModal() {
  const name = currentBoxElement.querySelector("h3").innerText;
  document.getElementById("editBoxName").value = name;
  
  const list = document.getElementById("editExerciseList");
  list.innerHTML = "";
  
  currentBoxElement.querySelectorAll("tbody tr").forEach((row) => {
    const block = document.createElement("div");
    block.classList.add("edit-exercise-block");
    
    const exName = row.children[0]?.innerText.trim() || "";
const set = row.children[1]?.innerText.trim() || "1";
const rep = row.children[2]?.innerText.trim() || "0";
const time = row.children[3]?.innerText.trim() || "0";
const rest = row.children[4]?.innerText.trim() || "0";
const restBetween = row.dataset.restAfter?.trim() || "20";
    
    block.innerHTML = `
      <div class="exercise-row">
        <input class="edit-ex-name" value="${exName}" placeholder="Exercise Name" />
        <button class="btn small" onclick="moveExerciseBlock(this, -1)">↑</button>
        <button class="btn small" onclick="moveExerciseBlock(this, 1)">↓</button>
        <button class="btn danger-btn small" onclick="deleteExerciseBlock(this)">x</button>
      </div>

      <input type="hidden" class="edit-ex-set" value="${set}" />
      <input type="hidden" class="edit-ex-rep" value="${rep}" />
      <input type="hidden" class="edit-ex-time" value="${time}" />
      <input type="hidden" class="edit-ex-rest" value="${rest}" />
      <input type="hidden" class="edit-ex-rest-between" value="${restBetween}" />
    `;
    
    list.appendChild(block);
  });
  
  document.getElementById("editBoxModal").style.display = "flex";
}

function saveEditedBox() {
  const boxName = document.getElementById("editBoxName").value;
  currentBoxElement.querySelector("h3").innerText = boxName;
  
  const tbody = currentBoxElement.querySelector("tbody");
  tbody.innerHTML = "";
  
  const blocks = document.querySelectorAll("#editExerciseList .edit-exercise-block");
  
  for (let block of blocks) {
    const name = block.querySelector(".edit-ex-name")?.value.trim() || "";
    const set = parseInt(block.querySelector(".edit-ex-set")?.value || "0");
    const rep = parseInt(block.querySelector(".edit-ex-rep")?.value || "0");
    const time = parseInt(block.querySelector(".edit-ex-time")?.value || "0");
    const rest = parseInt(block.querySelector(".edit-ex-rest")?.value || "0");
    const restBetween = parseInt(block.querySelector(".edit-ex-rest-between")?.value || "0");
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${set}</td>
      <td>${rep}</td>
      <td>${time}</td>
      <td>${rest}</td>
    `;
    tr.dataset.restAfter = restBetween;
    
    tbody.appendChild(tr);
  }
  
  closeModal("editBoxModal");
  saveWorkoutData?.(); 
}

function moveExerciseBlock(button, direction) {
  const block = button.closest(".edit-exercise-block");
  const list = document.getElementById("editExerciseList");
  const blocks = Array.from(list.children);
  const index = blocks.indexOf(block);
  const targetIndex = index + direction;
  
  if (targetIndex < 0 || targetIndex >= blocks.length) return;
  
  list.insertBefore(block, direction === 1 ? blocks[targetIndex].nextSibling : blocks[targetIndex]);
}

function deleteExerciseBlock(button) {
  const block = button.closest(".edit-exercise-block");
  block.remove();
}

function openEditExerciseModal(index) {
  const row = currentBoxElement.querySelectorAll("tbody tr")[index];
  if (!row) return;

  document.getElementById("editExName").value = row.children[0].innerText;
  document.getElementById("editExSet").value = row.children[1].innerText;
  document.getElementById("editExRep").value = row.children[2].innerText;
  document.getElementById("editExTime").value = row.children[3].innerText;
  document.getElementById("editExRest").value = row.children[4].innerText;
  document.getElementById("editExRestAfter").value = row.dataset.restAfter || 20;

  document.getElementById("editExerciseModal").style.display = "flex";
  document.getElementById("saveEditedExerciseBtn").onclick = () => saveEditedExercise(index);
}

function saveEditedExercise(index) {
  const row = currentBoxElement.querySelectorAll("tbody tr")[index];
  if (!row) return;

  row.children[0].innerText = document.getElementById("editExName").value;
  row.children[1].innerText = document.getElementById("editExSet").value;
  row.children[2].innerText = document.getElementById("editExRep").value;
  row.children[3].innerText = document.getElementById("editExTime").value;
  row.children[4].innerText = document.getElementById("editExRest").value;
  const restAfter = parseInt(document.getElementById("editExRestAfter").value);
row.dataset.restAfter = isNaN(restAfter) ? 0 : restAfter;

  document.getElementById("editExerciseModal").style.display = "none";
  saveWorkoutData();
}

function saveNewExercise() {
  const ex = {
    name: document.getElementById("exName").value,
    set: +document.getElementById("exSet").value,
    rep: +document.getElementById("exRep").value,
    time: +document.getElementById("exTime").value,
    rest: +document.getElementById("exRest").value,
    restAfter: isNaN(+document.getElementById("exRestBetween").value) ? 0 : +document.getElementById("exRestBetween").value,
  };

  const tbody = currentBoxElement.querySelector("tbody");
  const row = document.createElement("tr");
  row.dataset.restAfter = ex.restAfter;
  row.innerHTML = `<td>${ex.name}</td><td>${ex.set}</td><td>${ex.rep}</td><td>${ex.time}</td><td>${ex.rest}</td>`;
  tbody.appendChild(row);

  document.getElementById("addExerciseModal").style.display = "none";
  saveWorkoutData();
}

function deleteWorkoutBox() {
  if (!currentBoxElement) return;
  currentBoxElement.remove();
  closeModal("editOptionsModal");
  closeModal("editBoxModal");
  saveWorkoutData();
}

function renderAllNotes() {
  const notesContainer = document.getElementById("notesContainer");
  const notes = JSON.parse(localStorage.getItem("userNotes") || "[]");
  
  notesContainer.innerHTML = "";
  
  notes.forEach(note => {
    const box = document.createElement("div");
    box.className = "note-box";
    box.dataset.noteId = note.id;
    
    const header = document.createElement("div");
    header.className = "note-header";
    
    const titleInput = document.createElement("input");
    titleInput.className = "note-title";
    titleInput.value = note.title;
    titleInput.addEventListener("change", () => {
      updateNote(note.id, "title", titleInput.value);
    });
    
    const backBtn = document.createElement("button");
    backBtn.innerHTML = "«";
    backBtn.className = "note-back-btn";
    backBtn.style.display = "none";
    backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      collapseNoteBox(note.id);
    });
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "note-delete-btn";
    deleteBtn.innerHTML = "x";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNoteById(note.id);
    });
    
    header.appendChild(titleInput);
    header.appendChild(backBtn);
    header.appendChild(deleteBtn);
    
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "note-content-wrapper";
    
    const textarea = document.createElement("textarea");
    textarea.className = "note-content";
    textarea.value = note.content;
    textarea.readOnly = true;
    
    textarea.addEventListener("input", () => {
      updateNote(note.id, "content", textarea.value);
    });
    
    contentWrapper.appendChild(textarea);
    
    box.addEventListener("click", (e) => {
      const ignoreClasses = ["note-title", "note-back-btn", "note-delete-btn"];
      if (ignoreClasses.some(cls => e.target.classList.contains(cls))) return;
      if (box.classList.contains("expanded")) return;
      
      toggleNoteExpansion(note.id);
    });
    
    box.appendChild(header);
    box.appendChild(contentWrapper);
    notesContainer.appendChild(box);
  });
}

function createNoteBox() {
  if (noteCreationLock) return;
  noteCreationLock = true;
  
  const notesContainer = document.getElementById("notesContainer");
  if (!notesContainer) {
    console.warn("❌ notesContainer not found.");
    noteCreationLock = false;
    return;
  }
  
  const id = Date.now().toString();
  const newNote = {
    id,
    title: "Untitled",
    content: ""
  };
  
  const userId = localStorage.getItem("userId");
  const currentNotes = JSON.parse(localStorage.getItem("userNotes") || "[]");
  currentNotes.push(newNote);
  localStorage.setItem("userNotes", JSON.stringify(currentNotes));
  saveNotes(userId, currentNotes);
  
  renderAllNotes();
  
  setTimeout(() => noteCreationLock = false, 100); 
}

function deleteNoteById(noteId) {
  const notesContainer = document.getElementById("notesContainer");
  if (!notesContainer) {
    console.warn("❌ notesContainer not found.");
    return;
  }
  
  const userId = localStorage.getItem("userId");
  let currentNotes = JSON.parse(localStorage.getItem("userNotes") || "[]");
  currentNotes = currentNotes.filter(note => note.id !== noteId);
  
  localStorage.setItem("userNotes", JSON.stringify(currentNotes));
  saveNotes(userId, currentNotes);
  
  renderAllNotes();
}

function updateNote(noteId, field, newValue) {
  if (!["title", "content"].includes(field)) {
    console.warn(`❌ Invalid field "${field}" for note update.`);
    return;
  }
  
  const userId = localStorage.getItem("userId");
  const notes = JSON.parse(localStorage.getItem("userNotes") || "[]");
  
  const noteIndex = notes.findIndex(note => note.id === noteId);
  if (noteIndex === -1) {
    console.warn(`❌ Note with ID ${noteId} not found.`);
    return;
  }
  
  notes[noteIndex][field] = newValue;
  localStorage.setItem("userNotes", JSON.stringify(notes));
  saveNotes(userId, notes); 
}

// ─── 📤 EXPORT / IMPORT WORKOUTS ─────────────────────────────────────

function exportToJSON() {
  const data = [];
  document.querySelectorAll(".workout-box").forEach(box => {
    const name = box.querySelector("h3").innerText;
    const exercises = [];
    box.querySelectorAll("tbody tr").forEach(row => {
      exercises.push({
        name: row.children[0].innerText,
        set: +row.children[1].innerText,
        rep: +row.children[2].innerText,
        time: +row.children[3].innerText,
        rest: +row.children[4].innerText,
        restAfter: +row.dataset.restAfter || 20
      });
    });
    data.push({ name, exercises });
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "workouts.json";
  a.click();
}

function importFromJSON(jsonData) {
  const data = JSON.parse(jsonData);
  data.forEach(createWorkoutBoxFromData); 
  saveWorkoutData();
}


// ─── 📊 ANALYTICS & STATS ─────────────────────────────────────────
function evaluateWorkoutStreak(today) {
  const last = localStorage.getItem("lastWorkoutDate");
  const current = today;

  let streak = parseInt(localStorage.getItem("currentStreak") || "0");

  if (!last || last === current) return; 

  const diff = (new Date(current) - new Date(last)) / (1000 * 60 * 60 * 24);

  if (diff === 1) {
    streak++;
  } else if (diff > 1) {
    streak = 1; 
  }

  localStorage.setItem("currentStreak", streak);
}

function renderWorkoutChart() {
  const canvas = document.getElementById("workoutChart");
  if (!canvas) return console.warn("⚠️ workoutChart element not found");
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return console.warn("⚠️ Canvas context not available");
  
  if (window.workoutChartInstance) {
    window.workoutChartInstance.destroy();
  }
  
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    labels.push(date.toLocaleDateString("en-US", { weekday: "short" }));
    const log = JSON.parse(localStorage.getItem("workoutLog") || "{}");
const logForDay = log[key];
const completed = logForDay ? Object.keys(logForDay).length : 0;
data.push(completed);
  }
  window.workoutChartInstance = new Chart(ctx, {
  type: "bar",
  data: {
    labels,
    datasets: [{
      label: "Workouts Done",
      data,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
      borderRadius: 8
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Last 7 Days Workout Log",
        color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
        font: {
          size: 16,
          family: getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
          font: {
            family: getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
          }
        },
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim()
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          precision: 0,
          color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
          font: {
            family: getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
          }
        },
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim()
        }
      }
    }
  }
});
}

function markTodayWorkoutComplete() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  
  const boxName = playWorkoutBoxName || "Unnamed";
  
  const log = JSON.parse(localStorage.getItem("workoutLog") || "{}");
  
  if (!log[today]) {
    log[today] = {};
  }
  
 
  if (!log[today][boxName]) {
    log[today][boxName] = true;
    
    localStorage.setItem("workoutLog", JSON.stringify(log));
    localStorage.setItem("lastWorkoutLogged", today);
    localStorage.setItem("lastWorkoutDate", today);
    window._workoutLoggedToday = true;
    
    evaluateWorkoutStreak(today);
    updateProfileStats();
    renderWorkoutChart();
    
    console.log(`✅ Workout for '${boxName}' logged on ${today}`);
  } else {
    console.warn(`⚠️ '${boxName}' already logged today`);
  }
}

function updateProfileStats() {
  const log = JSON.parse(localStorage.getItem("workoutLog") || "{}");
  
 
  const totalWorkouts = Object.values(log).reduce((sum, day) => {
  return sum + Object.keys(day).length;
}, 0);
  localStorage.setItem("totalWorkouts", totalWorkouts); 

  const dates = Object.keys(log).sort();
  const lastDate = dates.at(-1) || "N/A";
  

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    if (log[key]) {
      streak++;
    } else {
      break;
    }
  }
  
  const cw = document.getElementById("completedWorkouts");
  const cs = document.getElementById("currentStreak");
  const lw = document.getElementById("lastWorkout");
  const tb = document.getElementById("totalBoxes");
  
  if (cw) cw.textContent = totalWorkouts;
  if (cs) cs.textContent = `${streak} Days`;
  if (lw) lw.textContent = lastDate;
  if (tb) tb.textContent = document.querySelectorAll(".workout-box").length;
}

function syncAnalyticsToFirebase() {
  const userId = localStorage.getItem("userId");
  if (!userId) return console.warn("❌ Cannot sync analytics: Missing userId");

  const analytics = {
    totalWorkouts: parseInt(localStorage.getItem("totalWorkouts") || "0"),
    currentStreak: parseInt(localStorage.getItem("currentStreak") || "0"),
    lastWorkoutDate: localStorage.getItem("lastWorkoutDate") || "N/A",
    workoutLog: JSON.parse(localStorage.getItem("workoutLog") || "{}"),
  };

  set(ref(db, `users/${userId}/analytics`), analytics)
    .then(() => console.log("✅ Analytics synced to Firebase"))
    .catch((err) => console.error("❌ Failed to sync analytics:", err));
}

function loadAnalyticsFromFirebase(userId, callback) {
  const analyticsRef = ref(db, `users/${userId}/analytics`);
  get(analyticsRef).then((snapshot) => {
    if (!snapshot.exists()) return;
    
    const analytics = snapshot.val();
    localStorage.setItem("totalWorkouts", analytics.totalWorkouts || "0");
    localStorage.setItem("currentStreak", analytics.currentStreak || "0");
    localStorage.setItem("lastWorkoutDate", analytics.lastWorkoutDate || "N/A");
    localStorage.setItem("workoutLog", JSON.stringify(analytics.workoutLog || {}));
    
    if (typeof callback === "function") callback(); 
  }).catch((err) => {
    console.error("❌ Failed to load analytics:", err);
  });
}

function changeMonth(offset) {
  currentMonthOffset += offset;
  renderCalendar("calendar");
}

function renderCalendar(containerId = "calendar") {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = "";
  
  const log = JSON.parse(localStorage.getItem("workoutLog") || "{}");
  const today = new Date();
  const baseDate = new Date(today.getFullYear(), today.getMonth() + currentMonthOffset, 1);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  const label = document.getElementById("calendarMonthLabel");
  if (label) {
    label.textContent = baseDate.toLocaleString("default", { month: "long", year: "numeric" });
  }
  
  const totalSlots = 42; 
  const blanksBefore = firstDay;
  const blanksAfter = totalSlots - (blanksBefore + totalDays);
  
  for (let i = 0; i < blanksBefore; i++) {
    const blank = document.createElement("div");
    blank.classList.add("calendar-day", "blank");
    container.appendChild(blank);
  }
  
  for (let i = 1; i <= totalDays; i++) {
    const date = new Date(year, month, i);
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    
    const dayEl = document.createElement("div");
    dayEl.classList.add("calendar-day");
    dayEl.innerText = i;
    
    if (
      key === today.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) &&
      currentMonthOffset === 0
    ) {
      dayEl.classList.add("today");
    }
    
    if (log[key]) {
      dayEl.classList.add("completed");
    }
    
    dayEl.onclick = () => showWorkoutLogDetails(key);
    container.appendChild(dayEl);
  }
  
  for (let i = 0; i < blanksAfter; i++) {
    const blank = document.createElement("div");
    blank.classList.add("calendar-day", "blank");
    container.appendChild(blank);
  }
}

function calculateUserRank(totalWorkouts) {
  if (totalWorkouts >= 125) return "Legend V";
  if (totalWorkouts >= 120) return "Legend IV";
  if (totalWorkouts >= 115) return "Legend III";
  if (totalWorkouts >= 110) return "Legend II";
  if (totalWorkouts >= 100) return "Legend I";
  
  if (totalWorkouts >= 95) return "Master V";
  if (totalWorkouts >= 90) return "Master IV";
  if (totalWorkouts >= 85) return "Master III";
  if (totalWorkouts >= 80) return "Master II";
  if (totalWorkouts >= 70) return "Master I";
  
  if (totalWorkouts >= 65) return "Elite V";
  if (totalWorkouts >= 60) return "Elite IV";
  if (totalWorkouts >= 55) return "Elite III";
  if (totalWorkouts >= 50) return "Elite II";
  if (totalWorkouts >= 40) return "Elite I";
  
  if (totalWorkouts >= 35) return "Pro V";
  if (totalWorkouts >= 30) return "Pro IV";
  if (totalWorkouts >= 25) return "Pro III";
  if (totalWorkouts >= 20) return "Pro II";
  if (totalWorkouts >= 10) return "Pro I";
  
  if (totalWorkouts >= 8) return "Rookie V";
  if (totalWorkouts >= 6) return "Rookie IV";
  if (totalWorkouts >= 4) return "Rookie III";
  if (totalWorkouts >= 2) return "Rookie II";
  return "Rookie I";
}

function updateUserRank() {
  const log = JSON.parse(localStorage.getItem("workoutLog") || "{}");
  
  const totalWorkouts = Object.values(log).reduce((sum, day) => {
    return sum + Object.keys(day).length;
  }, 0);
  
  const rank = calculateUserRank(totalWorkouts);
  
  localStorage.setItem("userRank", rank);
  document.getElementById("userRank").innerText = rank;
  
  const userId = localStorage.getItem("userId");
  
  if (userId) {
    saveRankToFirebase(userId, rank);
  } else {
    console.warn("⚠️ Cannot save rank — userId not found.");
  }
  
  updateBadgeProgress(rank);
  
  evaluateNextBadgeTier(rank);
  
  const progressMap = JSON.parse(localStorage.getItem("userRankProgress") || "{}");
  syncBadgesAfterRankChange(rank, progressMap);
}

function renderUserRank(rank) {
  const rankElement = document.getElementById("userRank");
  if (rankElement) {
    rankElement.innerText = rank;
  } else {
    console.warn("⚠️ userRank element not found.");
  }
}

// ─── 🏅 BADGE & RANK REGISTRY ─────────────────────────────────────
function defineBadgeRegistry() {
  return {
    Rookie: {
      1: `
        <svg class="rank-badge rookie-medal-1" viewBox="0 0 24 24" fill="#c0c0c0" xmlns="http://www.w3.org/2000/svg" title="Rookie I">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z" />
        </svg>`,
      2: `
        <svg class="rank-badge rookie-medal-2" viewBox="0 0 24 24" fill="#b0b0b0" xmlns="http://www.w3.org/2000/svg" title="Rookie II">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z" />
          <circle cx="12" cy="12" r="2" fill="#fff"/>
        </svg>`,
      3: `
        <svg class="rank-badge rookie-medal-3" viewBox="0 0 24 24" fill="#a0a0a0" xmlns="http://www.w3.org/2000/svg" title="Rookie III">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z" />
          <circle cx="10" cy="12" r="2" fill="#fff"/>
          <circle cx="14" cy="12" r="2" fill="#fff"/>
        </svg>`,
      4: `
        <svg class="rank-badge rookie-medal-4" viewBox="0 0 24 24" fill="#909090" xmlns="http://www.w3.org/2000/svg" title="Rookie IV">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z" />
          <rect x="10" y="10" width="1.5" height="4" fill="#fff"/>
          <rect x="12.5" y="10" width="1.5" height="4" fill="#fff"/>
        </svg>`,
      5: `
        <svg class="rank-badge rookie-medal-5" viewBox="0 0 24 24" fill="#808080" xmlns="http://www.w3.org/2000/svg" title="Rookie V">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z" />
          <text x="12" y="16" text-anchor="middle" font-size="6" fill="#fff">V</text>
        </svg>`
    },
    
    Pro: {
      1: `
        <svg class="rank-badge pro-medal-1" viewBox="0 0 24 24" fill="#1e90ff" xmlns="http://www.w3.org/2000/svg" title="Pro I">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z"/>
        </svg>`,
      2: `
        <svg class="rank-badge pro-medal-2" viewBox="0 0 24 24" fill="#1e90ff" xmlns="http://www.w3.org/2000/svg" title="Pro II">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z"/>
          <circle cx="12" cy="12" r="2" fill="#fff"/>
        </svg>`,
      3: `
        <svg class="rank-badge pro-medal-3" viewBox="0 0 24 24" fill="#1e80ee" xmlns="http://www.w3.org/2000/svg" title="Pro III">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z"/>
          <circle cx="10" cy="12" r="2" fill="#fff"/>
          <circle cx="14" cy="12" r="2" fill="#fff"/>
        </svg>`,
      4: `
        <svg class="rank-badge pro-medal-4" viewBox="0 0 24 24" fill="#1c78dd" xmlns="http://www.w3.org/2000/svg" title="Pro IV">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z"/>
          <rect x="9.5" y="10" width="1.5" height="4" fill="#fff"/>
          <rect x="13" y="10" width="1.5" height="4" fill="#fff"/>
        </svg>`,
      5: `
        <svg class="rank-badge pro-medal-5" viewBox="0 0 24 24" fill="#1a6fd0" xmlns="http://www.w3.org/2000/svg" title="Pro V">
          <path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z"/>
          <text x="12" y="16" text-anchor="middle" font-size="6" fill="#fff">V</text>
        </svg>`
    },
    
    Elite: {
      1: `
    <svg class="rank-badge elite-medal-1" viewBox="0 0 24 24" fill="#FFD700" xmlns="http://www.w3.org/2000/svg" title="Elite I">
      <path d="M12 2L3 6v6c0 5 4 10 9 12 5-2 9-7 9-12V6l-9-4z" />
    </svg>`,
      2: `
    <svg class="rank-badge elite-medal-2" viewBox="0 0 24 24" fill="#FFC700" xmlns="http://www.w3.org/2000/svg" title="Elite II">
      <path d="M12 2L3 6v6c0 5 4 10 9 12 5-2 9-7 9-12V6l-9-4z" />
      <circle cx="12" cy="12" r="2" fill="#fff"/>
    </svg>`,
      3: `
    <svg class="rank-badge elite-medal-3" viewBox="0 0 24 24" fill="#FFB000" xmlns="http://www.w3.org/2000/svg" title="Elite III">
      <path d="M12 2L3 6v6c0 5 4 10 9 12 5-2 9-7 9-12V6l-9-4z" />
      <circle cx="10" cy="12" r="2" fill="#fff"/>
      <circle cx="14" cy="12" r="2" fill="#fff"/>
    </svg>`,
      4: `
    <svg class="rank-badge elite-medal-4" viewBox="0 0 24 24" fill="#FF9900" xmlns="http://www.w3.org/2000/svg" title="Elite IV">
      <path d="M12 2L3 6v6c0 5 4 10 9 12 5-2 9-7 9-12V6l-9-4z" />
      <rect x="9.5" y="10" width="1.5" height="4" fill="#fff"/>
      <rect x="13" y="10" width="1.5" height="4" fill="#fff"/>
    </svg>`,
      5: `
    <svg class="rank-badge elite-medal-5" viewBox="0 0 24 24" fill="#FF8000" xmlns="http://www.w3.org/2000/svg" title="Elite V">
      <path d="M12 2L3 6v6c0 5 4 10 9 12 5-2 9-7 9-12V6l-9-4z" />
      <text x="12" y="16" text-anchor="middle" font-size="6" fill="#fff">V</text>
    </svg>`
    },
    Master: {
      1: `
    <svg class="rank-badge master-medal-1" viewBox="0 0 24 24" fill="#444" xmlns="http://www.w3.org/2000/svg" title="Master I">
      <path d="M12 2L3 6v6c0 5 5 11 9 12 4-1 9-7 9-12V6l-9-4z" />
    </svg>`,
      2: `
    <svg class="rank-badge master-medal-2" viewBox="0 0 24 24" fill="#333" xmlns="http://www.w3.org/2000/svg" title="Master II">
      <path d="M12 2L3 6v6c0 5 5 11 9 12 4-1 9-7 9-12V6l-9-4z" />
      <circle cx="12" cy="12" r="2" fill="#e74c3c"/>
    </svg>`,
      3: `
    <svg class="rank-badge master-medal-3" viewBox="0 0 24 24" fill="#2c2c2c" xmlns="http://www.w3.org/2000/svg" title="Master III">
      <path d="M12 2L3 6v6c0 5 5 11 9 12 4-1 9-7 9-12V6l-9-4z" />
      <circle cx="10" cy="12" r="2" fill="#e74c3c"/>
      <circle cx="14" cy="12" r="2" fill="#e74c3c"/>
    </svg>`,
      4: `
    <svg class="rank-badge master-medal-4" viewBox="0 0 24 24" fill="#1a1a1a" xmlns="http://www.w3.org/2000/svg" title="Master IV">
      <path d="M12 2L3 6v6c0 5 5 11 9 12 4-1 9-7 9-12V6l-9-4z" />
      <rect x="9.5" y="10" width="1.5" height="4" fill="#e74c3c"/>
      <rect x="13" y="10" width="1.5" height="4" fill="#e74c3c"/>
    </svg>`,
      5: `
    <svg class="rank-badge master-medal-5" viewBox="0 0 24 24" fill="#000" xmlns="http://www.w3.org/2000/svg" title="Master V">
      <path d="M12 2L3 6v6c0 5 5 11 9 12 4-1 9-7 9-12V6l-9-4z" />
      <text x="12" y="16" text-anchor="middle" font-size="6" fill="#e74c3c">V</text>
    </svg>`
    },
    Legend: {
      1: `
    <svg class="rank-badge legend-medal-1" viewBox="0 0 24 24" fill="#111" xmlns="http://www.w3.org/2000/svg" title="Legend I">
      <path d="M12 2L2 6v6c0 5 6 12 10 13 4-1 10-8 10-13V6L12 2z" />
    </svg>`,
      2: `
    <svg class="rank-badge legend-medal-2" viewBox="0 0 24 24" fill="#0d0d0d" xmlns="http://www.w3.org/2000/svg" title="Legend II">
      <path d="M12 2L2 6v6c0 5 6 12 10 13 4-1 10-8 10-13V6L12 2z" />
      <circle cx="12" cy="12" r="2" fill="#ffd700"/>
    </svg>`,
      3: `
    <svg class="rank-badge legend-medal-3" viewBox="0 0 24 24" fill="#0a0a0a" xmlns="http://www.w3.org/2000/svg" title="Legend III">
      <path d="M12 2L2 6v6c0 5 6 12 10 13 4-1 10-8 10-13V6L12 2z" />
      <circle cx="10" cy="12" r="2" fill="#ffd700"/>
      <circle cx="14" cy="12" r="2" fill="#ffd700"/>
    </svg>`,
      4: `
    <svg class="rank-badge legend-medal-4" viewBox="0 0 24 24" fill="#070707" xmlns="http://www.w3.org/2000/svg" title="Legend IV">
      <path d="M12 2L2 6v6c0 5 6 12 10 13 4-1 10-8 10-13V6L12 2z" />
      <rect x="9.5" y="10" width="1.5" height="4" fill="#ffd700"/>
      <rect x="13" y="10" width="1.5" height="4" fill="#ffd700"/>
    </svg>`,
      5: `
    <svg class="rank-badge legend-medal-5" viewBox="0 0 24 24" fill="#000" xmlns="http://www.w3.org/2000/svg" title="Legend V">
      <path d="M12 2L2 6v6c0 5 6 12 10 13 4-1 10-8 10-13V6L12 2z" />
      <text x="12" y="16" text-anchor="middle" font-size="6" fill="#ffd700">V</text>
    </svg>`
    }
  };
}

function getBadgeSVGByRank(rankTitle) {
  if (typeof rankTitle !== "string" || !rankTitle.includes(" ")) {
    console.warn("⚠️ Invalid rank title format:", rankTitle);
    return null;
  }
  
  const [tierRaw, romanLevel] = rankTitle.trim().split(" ");
  const tier = capitalize(tierRaw);
  const level = convertRomanToNumber(romanLevel); 
  
  const registry = defineBadgeRegistry();
  
  if (!registry[tier] || !registry[tier][level]) {
    console.warn(`❌ Badge not found for ${tier} level ${level}`);
    return null;
  }
  
  return registry[tier][level];
}

function updateBadgeProgress(userRank) {
  const [tierRaw, romanLevel] = userRank.split(" ");
  const tier = capitalize(tierRaw);
  const level = convertRomanToNumber(romanLevel);
  
  let progressMap = JSON.parse(localStorage.getItem("userRankProgress") || "{}");
  
  const tiers = ["Rookie", "Pro", "Elite", "Master", "Legend"];
  const tierIndex = tiers.indexOf(tier);
  
  for (let i = 0; i < tierIndex; i++) {
    const pastTier = tiers[i];
    if (!progressMap[pastTier] || progressMap[pastTier] < 5) {
      progressMap[pastTier] = 5;
    }
  }
  
  const current = progressMap[tier] || 1;
  if (level > current) {
    progressMap[tier] = level;
  }
  
  localStorage.setItem("userRankProgress", JSON.stringify(progressMap));
  
  const userId = localStorage.getItem("userId");
  if (userId) {
    saveBadgeProgress(userId, progressMap);
  } else {
    console.warn("⚠️ Cannot sync badge progress — userId not found.");
  }
}

function renderCurrentRankBadge(currentRank) {
  if (!currentRank || typeof currentRank !== "string") {
    console.warn("⚠️ Invalid rank input:", currentRank);
    return;
  }
  
  const [tierRaw, romanLevel] = currentRank.trim().split(" ");
  const tier = capitalize(tierRaw);
  const level = convertRomanToNumber(romanLevel);
  
  const registry = defineBadgeRegistry();
  const svg = registry?.[tier]?.[level];
  
  if (!svg) {
    console.warn(`❌ No badge SVG for ${tier} level ${level}`);
    return;
  }
  
  const container = document.querySelector(`.badge-slot.${tier.toLowerCase()}-medal`);
  if (!container) {
    console.warn(`❌ Badge container not found for .${tier.toLowerCase()}-medal`);
    return;
  }
  
  container.innerHTML = svg;
}

function renderAllUnlockedBadges(progressMap = {}) {
  const registry = defineBadgeRegistry();
  const tiers = ["Rookie", "Pro", "Elite", "Master", "Legend"];
  
  for (const tier of tiers) {
    const container = document.querySelector(`.badge-slot.${tier.toLowerCase()}-medal`);
    if (!container) {
      console.warn(`❌ No container for .${tier.toLowerCase()}-medal`);
      continue;
    }
    
    container.innerHTML = "";
    
    const level = progressMap[tier] || 0;
    const svg = level > 0 ? registry[tier]?.[level] : registry[tier]?.[1]; 
    
    const wrapper = document.createElement("div");
    wrapper.className = `badge-wrapper ${level > 0 ? "unlocked" : "locked"}`;
    wrapper.innerHTML = svg || "";
    
    wrapper.title = level > 0 ? `${tier} ${toRoman(level)}` : `${tier} — Locked`;
    
    container.appendChild(wrapper);
  }
}

function saveBadgeProgress(userId, progressMap) {
  if (!userId || typeof progressMap !== "object") {
    console.warn("❌ Invalid arguments for saveBadgeProgress.");
    return;
  }
  
  const progressRef = ref(db, `users/${userId}/rankProgress`);
  
  return set(progressRef, progressMap)
    .then(() => {
      localStorage.setItem("userRankProgress", JSON.stringify(progressMap));
    })
    .catch((err) => {
      console.error("🔥 Failed to save badge progress:", err.message);
    });
}

function fetchBadgeProgress(userId) {
  if (!userId) {
    console.warn("❌ fetchBadgeProgress: userId is missing.");
    return;
  }
  
  const progressRef = ref(db, `users/${userId}/rankProgress`);
  
  return get(progressRef)
    .then((snapshot) => {
      if (snapshot.exists()) {
        const progressMap = snapshot.val();
        localStorage.setItem("userRankProgress", JSON.stringify(progressMap));
        
        return progressMap;
      } else {
        const defaultProgress = {};
        localStorage.setItem("userRankProgress", JSON.stringify(defaultProgress));
        return defaultProgress;
      }
    })
    .catch((err) => {
      console.error("🔥 Error fetching badge progress:", err.message);
      const fallback = {};
      localStorage.setItem("userRankProgress", JSON.stringify(fallback));
      return fallback;
    });
}

function evaluateNextBadgeTier(currentRank) {
  if (!currentRank || typeof currentRank !== "string") {
    console.warn("⚠️ Invalid rank format:", currentRank);
    return;
  }
  
  const [tierRaw, romanLevel] = currentRank.split(" ");
  const tier = capitalize(tierRaw);
  const level = convertRomanToNumber(romanLevel);
  
  if (!tier || !level) {
    console.warn("⚠️ Failed to parse rank:", currentRank);
    return;
  }
  
  const progressMap = JSON.parse(localStorage.getItem("userRankProgress") || "{}");
  const savedLevel = progressMap[tier] || 0;
  
  if (level > savedLevel) {
    progressMap[tier] = level;
    localStorage.setItem("userRankProgress", JSON.stringify(progressMap));
    
    const userId = localStorage.getItem("userId");
    if (userId) {
      saveBadgeProgress(userId, progressMap);
    } else {
      console.warn("⚠️ Cannot save updated badge tier — userId not found.");
    }
    
    renderCurrentRankBadge(currentRank);
  }
}

function parseRankTitle(rankTitle) {
  if (typeof rankTitle !== "string") {
    console.warn("⚠️ Invalid rank title input:", rankTitle);
    return { tier: null, level: null };
  }
  
  const [tierRaw, romanLevel] = rankTitle.trim().split(" ");
  const tier = capitalize(tierRaw);
  const level = convertRomanToNumber(romanLevel);
  
  if (!tier || !level) {
    console.warn("⚠️ Failed to parse rankTitle:", rankTitle);
    return { tier: null, level: null };
  }
  
  return { tier, level };
}

function syncBadgesAfterRankChange(rankTitle, progressMap) {
  if (!rankTitle || typeof rankTitle !== "string") {
    console.warn("⚠️ Invalid rank title:", rankTitle);
    return;
  }
  
  localStorage.setItem("userRank", rankTitle);
  localStorage.setItem("userRankProgress", JSON.stringify(progressMap));
  
  renderUserRank(rankTitle);
  
  renderCurrentRankBadge(rankTitle);
  
  renderAllUnlockedBadges(progressMap);
  
  const userId = localStorage.getItem("userId");
  if (userId) {
    saveRankToFirebase(userId, rankTitle, progressMap);
  } else {
    console.warn("⚠️ Cannot sync badge visuals — userId not found.");
  }
}


// ─── 🛠️ SETTINGS UI TOGGLE ─────────────────────────────────────────────

function openSettings() {
  document.getElementById("settingsPage").style.display = "block";
  
  const header = document.querySelector("header");
  const workoutContainer = document.getElementById("workoutContainer");
  const profileScreen = document.getElementById("profileScreen");
  
  if (header) header.style.display = "none";
  if (workoutContainer) workoutContainer.style.display = "none";
  if (profileScreen) profileScreen.style.display = "none";
}

function closeSettings() {
  document.getElementById("settingsPage").style.display = "none";
  
  const header = document.querySelector("header");
  const workoutContainer = document.getElementById("workoutContainer");
  
  if (header) header.style.display = "flex";
  if (workoutContainer) workoutContainer.style.display = "block";
}

function showSettingsSection(section) {
  const content = document.getElementById("settingsContent");
  content.innerHTML = ""; 
  
  if (section === "account") {
    const email = localStorage.getItem("userEmail") || "Unknown";
    const storedName = localStorage.getItem("profileName") || "Anonymous";
    const avatar = localStorage.getItem("profileAvatar") || "default.jpg";
    
    content.innerHTML = `
      <label>Email:</label><br>
      <div id="userEmailDisplay" style="margin-bottom: 1rem;">${email}</div>
    `;
    
    document.getElementById("avatarUploadSettings").addEventListener("change", function() {
  const file = this.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const avatarData = e.target.result;
    localStorage.setItem("profileAvatar", avatarData);
    document.querySelector("#settingsContent img").src = avatarData;
    syncProfileToFirebase();
  };
  reader.readAsDataURL(file);
});
    
  } else if (section === "logout") {
    content.innerHTML = `
      <h2>🚪 Logout</h2>
      <p>Are you sure you want to log out?</p>
      <button class="btn danger" onclick="confirmLogout()">Yes, Logout</button>
    `;
  }
}

window.toggleTheme = function() {
  const root = document.documentElement;
  const isDark = root.classList.toggle("dark-theme");
  const theme = isDark ? "dark" : "light";
  
  localStorage.setItem("theme", theme);
  
  const userId = localStorage.getItem("userId");
  if (userId) {
    set(ref(db, `users/${userId}/settings/theme`), theme)
      .then(() => console.log("✅ Theme saved to Firebase"))
      .catch((err) => console.error("❌ Firebase save failed:", err));
  }
};

window.applySavedTheme = function() {
  const userId = localStorage.getItem("userId");
  
  if (userId) {
    get(ref(db, `users/${userId}/settings/theme`))
      .then((snapshot) => {
        const theme = snapshot.val() || "light";
        document.documentElement.classList.toggle("dark-theme", theme === "dark");
        localStorage.setItem("theme", theme);
      })
      .catch((err) => {
        console.warn("⚠️ Firebase theme load failed:", err);
      
        const theme = localStorage.getItem("theme");
        document.documentElement.classList.toggle("dark-theme", theme === "dark");
      });
  } else {
  
    const theme = localStorage.getItem("theme");
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
  }
};

window.setupNotificationToggle = function() {
  const notifyBtn = document.getElementById("notifyBtn");
  if (!notifyBtn) return console.warn("⚠️ Notification button not found.");
  
  notifyBtn.addEventListener("click", async () => {
    
    const permission = Notification.permission;
    
    if (permission === "granted") {
      const reg = await navigator.serviceWorker.ready;
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          action: "showNotification",
          title: "🔔 Notifications are already enabled.",
          options: {
            body: "You're set to receive workout reminders daily.",
            icon: "/assets/icons/icon-512.png"
          }
        });
      } else {
        console.warn("⚠️ No active controller. Reloading to gain control...");
        location.reload();
      }
    } else if (permission === "denied") {
      showCustomAlert("⚠️ You’ve blocked notifications. Enable them manually in browser settings.");
    } else {
      try {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          const reg = await navigator.serviceWorker.ready;
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              action: "showNotification",
              title: "✅ Notifications enabled.",
              options: {
                body: "You’ll now receive workout reminders.",
                icon: "/assets/icons/icon-512.png"
              }
            });
          } else {
            console.warn("⚠️ No active controller after permission grant. Reloading...");
            location.reload();
          }
        } else {
          showCustomAlert("❌ Permission not granted.");
        }
      } catch (err) {
        console.error("❌ Notification request failed:", err);
      }
    }
  });
};

// ─── 🔊 SOUND SETTING CONTROLS ─────────────────────────────────────

function toggleSoundSetting() {
  const enabled = localStorage.getItem("soundEnabled") !== "false";
  localStorage.setItem("soundEnabled", !enabled);
}

function playBeep() {
  if (localStorage.getItem("soundEnabled") !== "false") {
    timerBeep.play();
  }
}

// ─── 🔔 NOTIFICATIONS ─────────────────────────────────────────────
function scheduleDailyReminder(hour = 8) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, 0, 0, 0);
  
  if (now > target) target.setDate(target.getDate() + 1);
  
  const timeout = target.getTime() - now.getTime();
  
  setTimeout(() => {
  
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        action: 'showNotification',
        title: '⏰ Time to train!',
        options: {
          body: 'Your workout awaits. Launch the app now.',
          icon: '/assets/icons/icon-512.png',
          badge: '/assets/icons/badge-128.png', 
          vibrate: [200, 100, 200],
        }
      });
    });
    
    scheduleDailyReminder(hour); 
  }, timeout);
}

// ─── 🔐 AUTH / ACCOUNT CONTROL ─────────────────────────────────────

function fetchRankFromFirebase(userId) {
  const rankRef = ref(db, `users/${userId}/rank`);
  
  get(rankRef)
    .then((snapshot) => {
      const rank = snapshot.exists() ? snapshot.val() : "Rookie I";
      localStorage.setItem("userRank", rank);
      
     
      const rankEl = document.getElementById("userRank");
      if (rankEl) {
        rankEl.innerText = rank;
      } else {
        console.warn("⚠️ #userRank element not found.");
      }
      
     
      fetchBadgeProgress(userId).then((progressMap) => {
        syncBadgesAfterRankChange(rank, progressMap);
      });
      
    })
    .catch((error) => {
      console.error("🔥 Failed to fetch rank:", error.message);
      
      const fallbackRank = "Rookie I";
      localStorage.setItem("userRank", fallbackRank);
      
      const rankEl = document.getElementById("userRank");
      if (rankEl) {
        rankEl.innerText = fallbackRank;
      }
      
    
      const defaultProgress = {};
      localStorage.setItem("userRankProgress", JSON.stringify(defaultProgress));
      syncBadgesAfterRankChange(fallbackRank, defaultProgress);
    });
}

window.confirmLogout = function() {
  const auth = getAuth();
  auth.signOut().then(() => {
    localStorage.clear(); 
    window.location.href = "login.html"; 
  }).catch((error) => {
    showCustomAlert("❌ Logout failed: " + error.message);
  });
};

window.resetEverything = async function() {
  const user = auth.currentUser;
  if (!user) return showCustomAlert("❌ No user is signed in.");
  
  const confirmation = await showDeleteDialog();
  if (confirmation !== "DELETE") {
    showCustomAlert("❌ Reset aborted. You must type DELETE to proceed.");
    return;
  }
  
  const userId = user.uid;
  
  try {
    await remove(ref(db, `users/${userId}`));
    localStorage.clear();
    
    showCustomAlert("✅ All data deleted. Click OK to finish account deletion.", async () => {
      try {
        await deleteUser(user);
        window.location.href = "login.html";
      } catch (err) {
        if (err.code === "auth/requires-recent-login") {
          showCustomAlert("⚠️ You need to log in again before deleting your account.");
          localStorage.setItem("resetPending", "true");
          window.location.href = "login.html";
        } else {
          showCustomAlert("❌ Error: " + err.message);
        }
      }
    });
    
  } catch (err) {
    showCustomAlert("❌ Error: " + err.message);
  }
};


// ─── 🌐 GLOBAL WINDOW BINDINGS ─────────────────────────────────────
window.closeNotesScreen = closeNotesScreen;
window.deleteNoteById = deleteNoteById;
window.toggleNoteExpansion = toggleNoteExpansion;
window.updateNote = updateNote;
window.saveNotes = saveNotes;
window.loadNotes = loadNotes;
window.renderAllNotes = renderAllNotes;
window.createNoteBox = createNoteBox;

window.togglePauseResume = togglePauseResume;
window.pauseWorkout = pauseWorkout;
window.auth = auth;
window.deleteUser = deleteUser;
window.set = set;
window.get = get;
window.child = child;
window.db = db;
window.ref = ref;
window.remove = remove;
window.moveExerciseBlock = moveExerciseBlock;
window.deleteExerciseBlock = deleteExerciseBlock;
window.saveEditedBox = saveEditedBox;
window.renderWorkoutChart = renderWorkoutChart;
window.showSettingsSection    = showSettingsSection;
window.resetEverything        = resetEverything;
window.closeSettings          = closeSettings;
window.openSettings           = openSettings;
window.saveWorkoutData        = saveWorkoutData;
window.loadFromFirebase       = loadFromFirebase;
window.createWorkoutBox       = createWorkoutBox;
window.openEditOptions        = openEditOptions;
window.startPlayMode          = startPlayMode;
window.openProfileScreen      = openProfileScreen;
window.openAddWorkoutModal    = openAddWorkoutModal;
window.closeModal             = closeModal;
window.saveNewExercise        = saveNewExercise;
window.openEditBoxModal       = openEditBoxModal;
window.openAddExerciseModal   = openAddExerciseModal;
window.deleteWorkoutBox       = deleteWorkoutBox;
window.nextSetOrExercise      = nextSetOrExercise;
window.exitPlayMode           = exitPlayMode;
window.closeProfileScreen     = closeProfileScreen;
window.markTodayWorkoutComplete = markTodayWorkoutComplete;
window.updateProfileStats = updateProfileStats;
window.changeMonth = changeMonth;
window.applySavedTheme = applySavedTheme;
window.openProfileScreen = openProfileScreen;
window.openAddWorkoutModal = openAddWorkoutModal;
window.toggleCalendar = function () {
  const wrapper = document.getElementById("calendarWrapper");
  if (!wrapper) return;
  wrapper.classList.toggle("hidden");
  if (!wrapper.classList.contains("hidden")) {
    renderCalendar("calendar");
  }
};
document.getElementById("notifyBtn")?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showCustomAlert("❌ This browser does not support notifications.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    if (navigator.serviceWorker.controller) {
      console.log("✅ SW Controller available. Sending notification...");
      navigator.serviceWorker.controller.postMessage({
        action: 'showNotification',
        title: '✅ Notifications Enabled',
        options: {
          body: "You’ll get a reminder daily at 8:00 AM.",
          icon: 'src/images/default.jpg' 
        }
      });

      scheduleDailyReminder(8);
    } else {
      console.warn("⚠️ No SW controller. Reloading...");
      location.reload();
    }
  } else {
    showCustomAlert("⚠️ Notifications blocked. Enable them in browser settings.");
  }
});
window.openNotesScreen = function() {
  const mainUI = document.querySelector("#app");
  const notesScreen = document.querySelector("#notesScreen");
  
  if (!mainUI || !notesScreen) {
    console.warn("❌ Missing #notesScreen or #app in DOM.");
    return;
  }
  
  mainUI.style.display = "none";
  notesScreen.style.display = "flex";
  notesScreen.scrollTop = 0;
};


// ─── 🚀 BOOTSTRAP & ENTRY POINT ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  applySavedTheme();
  waitForFirebaseAndRun();
  renderCalendar("calendar");
  setupNotificationToggle();
  
  window.openNotesScreen = function() {
    const mainUI = document.querySelector("#app");
    const notesScreen = document.querySelector("#notesScreen");
    
    if (!mainUI || !notesScreen) {
      console.warn("❌ Missing #notesScreen or #app in DOM.");
      return;
    }
    
    mainUI.style.display = "none";
    notesScreen.style.display = "flex";
    notesScreen.scrollTop = 0;
  };
  
  window.closeNotesScreen = function() {
    const mainUI = document.querySelector("#app");
    const notesScreen = document.querySelector("#notesScreen");
    
    if (!mainUI || !notesScreen) {
      console.warn("❌ Missing #notesScreen or #app in DOM.");
      return;
    }
    
    notesScreen.style.display = "none";
    mainUI.style.display = "";
  };



  
  window.showCustomAlert = function(message, callback) {
  const msgEl = document.getElementById("customAlertMessage");
  const boxEl = document.getElementById("customAlert");
  const okBtn = document.getElementById("customAlertOkBtn");
  
  if (!msgEl || !boxEl || !okBtn) {
    console.warn("❌ Alert elements not found.");
    return;
  }
  
  msgEl.innerText = message;
  boxEl.classList.remove("hidden");
  
  okBtn.onclick = () => {
    boxEl.classList.add("hidden");
    if (typeof callback === "function") callback();
  };
};

  window.closeCustomAlert = function () {
    const boxEl = document.getElementById("customAlert");
    if (boxEl) boxEl.classList.add("hidden");
  };

  window.showDeleteDialog = function() {
  return new Promise((resolve) => {
    const dialog = document.getElementById("confirmDeleteDialog");
    const input = document.getElementById("confirmDeleteInput");
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelDeleteBtn");
    
    dialog.classList.remove("hidden");
    input.value = "";
    input.focus();
    
    function cleanup() {
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.classList.add("hidden");
    }
    
    function onConfirm() {
      const typed = input.value.trim().toUpperCase();
      resolve(typed);
      cleanup();
    }
    
    function onCancel() {
      resolve(null);
      cleanup();
    }
    
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
  });
};

const userRank = localStorage.getItem("userRank") || "Rookie I";
document.getElementById("userRank").innerText = userRank;

});

document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("calendarWrapper");
  if (!wrapper || wrapper.classList.contains("hidden")) return;
  
  const isClickInside = wrapper.querySelector(".calendar-popup")?.contains(e.target);
  const isCalendarBtn = e.target.closest("#calendarToggle");
  
  if (!isClickInside && !isCalendarBtn) {
    wrapper.classList.add("hidden");
    if (currentMonthOffset !== 0) currentMonthOffset = 0;
  }
});

// ─── 🛰️ PWA / SERVICE WORKER REGISTRATION ─────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/Omega-Fit/service-worker.js")
    .then((reg) => {
      console.log("✅ Service Worker Registered:", reg);
      
      if (!navigator.serviceWorker.controller) {
        console.warn("⚠️ No active Service Worker controller. Forcing reload after install...");
        navigator.serviceWorker.ready.then(() => {
          console.log("🔁 SW is ready. Reloading for full control.");
          location.reload();
        });
      }
    })
    .catch((err) => console.error("❌ Service Worker Failed:", err));
}

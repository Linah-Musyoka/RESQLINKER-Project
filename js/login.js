// Import necessary Firebase modules
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBUX5vcK2c3XzFvIGc2aTf4j5ECYtNT1Mk",
    authDomain: "resq-linker-project.firebaseapp.com",
    databaseURL: "https://resq-linker-project-default-rtdb.firebaseio.com",
    projectId: "resq-linker-project",
    storageBucket: "resq-linker-project.firebasestorage.app",
    messagingSenderId: "561153672211",
    appId: "1:561153672211:web:4415adc6c4cba3997cabe6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// DOM Elements
const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const toggleLink = document.getElementById("toggle-link");
const toggleLoginLink = document.getElementById("toggle-link-login");
const toggleText = document.getElementById("toggle-text");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");

// Show error with 2-second timeout
function showError(message) {
  errorText.innerText = message;
  errorMessage.style.display = "block";
  setTimeout(() => {
    errorMessage.style.display = "none";
  }, 2000);
}

// Close error modal manually (if needed)
function closeError() {
  errorMessage.style.display = "none";
}

// Toggle between forms
if (toggleLink) {
  toggleLink.addEventListener("click", () => {
    signupForm.style.display = "none";
    loginForm.style.display = "block";
    toggleText.innerText = "Login to your account";
  });
}

if (toggleLoginLink) {
  toggleLoginLink.addEventListener("click", () => {
    signupForm.style.display = "block";
    loginForm.style.display = "none";
    toggleText.innerText = "Sign up to get started";
  });
}

// Handle Sign-Up
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("username").value + "@resqlinker.com"; // converting username to email format
  const password = document.getElementById("password").value;
  const role = document.getElementById("role-select").value; // patient or driver

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Store user role in Firestore
    await setDoc(doc(db, "users", user.uid), {
      username: document.getElementById("username").value,
      role: role
    });

    // Store user data in Realtime Database
    await set(ref(rtdb, 'users/' + user.uid), {
      username: document.getElementById("username").value,
      role: role
    });

    // Redirect based on role
    if (role === "patient") {
      window.location.href = "../pages/patient-dashboard.html";
    } else {
      window.location.href = "../pages/driver-dashboard.html";
    }
  } catch (error) {
    if (error.code === 'auth/weak-password') {
      showError("Password should be at least 6 characters long.");
    } else if (error.code === 'auth/email-already-in-use') {
      showError("An account with this username already exists.");
    } else {
      showError("Sign-up failed. Please try again.");
    }
  }
});

// Handle Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("username").value + "@resqlinker.com";
  const password = document.getElementById("login-password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Get user role from Firestore
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      if (userData.role === "patient") {
        window.location.href = "../pages/patient-dashboard.html";
      } else {
        window.location.href = "../pages/driver-dashboard.html";
      }
    } else {
      showError("User data not found. Contact support.");
    }
  } catch (error) {
    if (error.code === 'auth/wrong-password') {
      showError("Incorrect password. Please try again.");
    } else if (error.code === 'auth/user-not-found') {
      showError("User not found. Please sign up first.");
    } else {
      showError("Login failed. Please try again.");
    }
  }
});

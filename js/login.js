// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBUX5vcK2c3XzFvIGc2aTf4j5ECYtNT1Mk",
    authDomain: "resq-linker-project.firebaseapp.com",
    databaseURL: "https://resq-linker-project-default-rtdb.firebaseio.com",
    projectId: "resq-linker-project",
    storageBucket: "resq-linker-project.appspot.com",
    messagingSenderId: "561153672211",
    appId: "1:561153672211:web:4415adc6c4cba3997cabe6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const S_username = document.getElementById('S-username');
const password = document.getElementById('password');
const roleSelect = document.getElementById('role-select');
const L_username = document.getElementById('L-username');
const loginPassword = document.getElementById('login-password');
const logoutBtn = document.getElementById('logout-btn');

// Auth State Listener with Redirection
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User is logged in:", user.uid);
        const collectionName = await getUserRole(user.uid);
        
        // Redirect based on user role
        if (collectionName === "Drivers") {
            window.location.href = "driver-dashboard.html";
        } else if (collectionName === "Patients") {
            window.location.href = "patient-dashboard.html";
        }
    } else {
        console.log("No user is logged in");
        // Show login form if on login page
        if (window.location.pathname.includes("login.html")) {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
        }
    }
});

// Enhanced Sign Up Function (without auto-login)
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = S_username.value.trim();
    const userPassword = password.value;
    const role = roleSelect.value;

    // Validation
    if (!username || !userPassword || !role) {
        alert("Please fill in all fields");
        return;
    }

    const passwordValidation = validatePassword(userPassword);
    if (passwordValidation !== true) {
        alert(passwordValidation);
        return;
    }

    try {
        const email = `${username}@resqlinker.com`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, userPassword);
        const user = userCredential.user;

        // Prepare user data
        const userData = {
            username: username,
            role: role,
            uid: user.uid,
            email: email,
            createdAt: new Date().toISOString(),
            status: "active"
        };

        // Add driver-specific fields if needed
        if (role === "driver") {
            userData.availability = false;
            userData.vehicleInfo = {
                type: "",
                licensePlate: ""
            };
            userData.assignedPatients = [];
        }

        const collectionName = role === "driver" ? "Drivers" : "Patients";
        
        await setDoc(doc(db, collectionName, user.uid), userData);
        alert(`Account created successfully as ${role}! Please login with your credentials.`);
        signupForm.reset();
        
        // Removed auto-login for development
        // Switch to login form instead
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
        
    } catch (error) {
        console.error("Signup error:", error);
        let errorMessage = "Signup failed. ";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage += "Username already exists.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage += "Password is too weak.";
        } else {
            errorMessage += error.message;
        }
        alert(errorMessage);
        
        // Cleanup: Delete user if creation failed after auth
        if (auth.currentUser) {
            try {
                await auth.currentUser.delete();
            } catch (deleteError) {
                console.error("Error cleaning up user:", deleteError);
            }
        }
    }
});

// Enhanced Login Function with Redirection
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = L_username.value.trim();
    const userPassword = loginPassword.value;

    if (!username || !userPassword) {
        alert("Please enter both username and password");
        return;
    }

    try {
        const email = `${username}@resqlinker.com`;
        const userCredential = await signInWithEmailAndPassword(auth, email, userPassword);
        const user = userCredential.user;
        
        console.log("User signed in:", user.uid);
        
        const collectionName = await getUserRole(user.uid);
        
        if (!collectionName) {
            alert("Account exists but no role assigned. Please contact support.");
            await signOut(auth);
            return;
        }
        
        alert(`Login successful as ${collectionName === "Drivers" ? "driver" : "patient"}!`);
        loginForm.reset();
        
        // Redirect based on role
        if (collectionName === "Drivers") {
            window.location.href = "driver-dashboard.html";
        } else {
            window.location.href = "patient.html";
        }
        
    } catch (error) {
        console.error("Login error:", error);
        let errorMessage = "Login failed. ";
        if (error.code === 'auth/user-not-found') {
            errorMessage += "Username not found.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage += "Incorrect password.";
        } else {
            errorMessage += error.message;
        }
        alert(errorMessage);
    }
});

// Helper function to determine user role
async function getUserRole(uid) {
    try {
        const [driverDoc, patientDoc] = await Promise.all([
            getDoc(doc(db, "Drivers", uid)),
            getDoc(doc(db, "Patients", uid))
        ]);
        
        if (driverDoc.exists()) return "Drivers";
        if (patientDoc.exists()) return "Patients";
        return null;
    } catch (error) {
        console.error("Error getting user role:", error);
        return null;
    }
}

// Password validation function
function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    let errorMessage = "";

    if (password.length < minLength) {
        errorMessage += "Password must be at least 8 characters long.\n";
    }
    if (!hasUpperCase) {
        errorMessage += "Password must contain at least one uppercase letter.\n";
    }
    if (!hasLowerCase) {
        errorMessage += "Password must contain at least one lowercase letter.\n";
    }
    if (!hasNumber) {
        errorMessage += "Password must contain at least one number.\n";
    }
    
    return errorMessage.length > 0 ? errorMessage.trim() : true;
}

// Toggle between forms
document.getElementById('toggle-link').addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
});

document.getElementById('toggle-link-login').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

// Logout functionality (if logout button exists)
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch (error) {
            console.error("Logout error:", error);
        }
    });
}
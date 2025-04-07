import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, doc, updateDoc, onSnapshot, serverTimestamp,
  collection, query, where, addDoc, getDocs, orderBy, limit
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { 
  getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUX5vcK2c3XzFvIGc2aTf4j5ECYtNT1Mk",
  authDomain: "resq-linker-project.firebaseapp.com",
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
const emergencyInfo = document.getElementById('emergency-info');
const patientName = document.getElementById('patient-name');
const patientLocation = document.getElementById('patient-location');
const patientCondition = document.getElementById('patient-condition');
const acceptBtn = document.getElementById('accept-btn');
const rejectBtn = document.getElementById('reject-btn');
const statusForm = document.getElementById('status-form');
const statusSelect = document.getElementById('status');
const completeBtn = document.getElementById('complete-btn');
const historyTable = document.getElementById('history-table').getElementsByTagName('tbody')[0];
const currentTimeSpan = document.getElementById('current-time');

// Current user and hospital reference
let currentHospitalId = null;
let currentEmergencyId = null;

// Authentication state listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentHospitalId = user.uid;
        setupDashboard();
    } else {
        window.location.href = '../index.html';
    }
});

// Setup dashboard functionality
function setupDashboard() {
    // Update current time every second
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    // Listen for new emergency requests
    listenForEmergencyRequests();

    // Setup button event listeners
    setupEventListeners();

    // Load emergency history
    loadEmergencyHistory();
}

function updateCurrentTime() {
    const now = new Date();
    currentTimeSpan.textContent = now.toLocaleString();
}

function listenForEmergencyRequests() {
    const q = query(
        collection(db, "emergencies"),
        where("status", "==", "pending"),
        where("assignedHospitalId", "==", currentHospitalId)
    );
    
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const emergency = change.doc.data();
                currentEmergencyId = change.doc.id;
                displayEmergencyRequest(emergency);
                enableButtons(true);
            }
        });
    });
}

function displayEmergencyRequest(emergency) {
    emergencyInfo.textContent = 'New emergency request received!';
    patientName.textContent = emergency.patientName || 'Unknown';
    patientLocation.textContent = emergency.location || 'Unknown location';
    patientCondition.textContent = emergency.condition || 'Unknown condition';
    document.getElementById('request-details').style.display = 'block';
}

function enableButtons(enabled) {
    acceptBtn.disabled = !enabled;
    rejectBtn.disabled = !enabled;
    statusSelect.disabled = !enabled;
    statusForm.querySelector('button').disabled = !enabled;
    completeBtn.disabled = !enabled;
}

function setupEventListeners() {
    // Accept emergency
    acceptBtn.addEventListener('click', () => {
        updateEmergencyStatus('accepted');
    });

    // Reject emergency
    rejectBtn.addEventListener('click', () => {
        updateEmergencyStatus('rejected');
        resetEmergencyUI();
    });

    // Update status
    statusForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const status = statusSelect.value;
        updateEmergencyStatus(status);
    });

    // Complete emergency
    completeBtn.addEventListener('click', () => {
        updateEmergencyStatus('completed');
        addToHistory();
        resetEmergencyUI();
    });
}

async function updateEmergencyStatus(status) {
    if (!currentEmergencyId) return;

    try {
        await updateDoc(doc(db, "emergencies", currentEmergencyId), {
            status: status,
            lastUpdated: serverTimestamp()
        });
        console.log('Status updated successfully');
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

async function addToHistory() {
    if (!currentEmergencyId) return;

    try {
        const emergencyDoc = await getDoc(doc(db, "emergencies", currentEmergencyId));
        if (emergencyDoc.exists()) {
            const emergency = emergencyDoc.data();
            await addDoc(collection(db, "hospitals", currentHospitalId, "history"), {
                emergencyId: currentEmergencyId,
                patientName: emergency.patientName,
                timestamp: serverTimestamp(),
                status: 'completed',
                condition: emergency.condition
            });
            console.log('Added to history');
        }
    } catch (error) {
        console.error('Error adding to history:', error);
    }
}

async function loadEmergencyHistory() {
    try {
        const q = query(
            collection(db, "hospitals", currentHospitalId, "history"),
            orderBy("timestamp", "desc"),
            limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return;
        }

        historyTable.innerHTML = ''; // Clear existing rows
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = historyTable.insertRow();
            
            row.insertCell(0).textContent = doc.id.substring(0, 8);
            row.insertCell(1).textContent = data.patientName;
            row.insertCell(2).textContent = data.timestamp.toDate().toLocaleString();
            row.insertCell(3).textContent = data.status;
        });
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function resetEmergencyUI() {
    emergencyInfo.textContent = 'No emergency request at the moment.';
    document.getElementById('request-details').style.display = 'none';
    currentEmergencyId = null;
    enableButtons(false);
    statusSelect.value = '';
}

// Logout functionality
document.querySelector('.logout').addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
        window.location.href = '../index.html';
    });
});

// Notification functions
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showError(message) {
    const error = document.createElement('div');
    error.className = 'notification error';
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 3000);
}
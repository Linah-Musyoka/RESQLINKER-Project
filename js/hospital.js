import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
    getFirestore, doc, updateDoc, onSnapshot, serverTimestamp,
    collection, query, where, addDoc, getDocs, orderBy, limit, getDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBUX5vcK2c3XzFvIGc2aTf4j5ECYtNT1Mk",
    authDomain: "resq-linker-project.firebaseapp.com",
    projectId: "resq-linker-project",
    storageBucket: "resq-linker-project.appspot.com",
    messagingSenderId: "561153672211",
    appId: "1:561153672211:web:4415adc6c4cba3997cabe6"
};

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
const emergenciesList = document.getElementById('emergencies-list');

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

function setupDashboard() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    listenForEmergencyRequests();
    setupEmergencyListener();
    setupEventListeners();
    loadEmergencyHistory();
}

function updateCurrentTime() {
    const now = new Date();
    currentTimeSpan.textContent = now.toLocaleString();
}

function listenForEmergencyRequests() {
    const emergenciesQuery = query(
        collection(db, "Emergencies"),
        where("status", "==", "pending"),
        where("hospitalId", "==", currentHospitalId)
    );
    
    onSnapshot(emergenciesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const emergency = change.doc.data();
                currentEmergencyId = change.doc.id;
                displayEmergencyRequest(emergency);
                enableButtons(true);
            }
        });
    }, (error) => {
        showError("Error listening for emergency requests: " + error.message);
    });
}

function setupEmergencyListener() {
    const q = query(
        collection(db, "Emergencies"),
        where("status", "in", ["en_route", "arrived"]),
        where("hospitalId", "==", currentHospitalId)
    );
    
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                addEmergencyToDashboard(change.doc.data());
            } else if (change.type === "modified") {
                updateEmergencyStatus(change.doc.data());
            }
        });
    }, (error) => {
        showError("Error listening for emergency updates: " + error.message);
    });
}

function addEmergencyToDashboard(emergency) {
    const emergencyCard = document.createElement('div');
    emergencyCard.className = 'emergency-card';
    emergencyCard.id = `emergency-${emergency.id}`;
    emergencyCard.innerHTML = `
        <h3>${emergency.condition} (${emergency.severity})</h3>
        <p>Patient: ${emergency.patientName}</p>
        <p>Symptoms: ${emergency.symptoms}</p>
        <p>Driver ETA: <span class="eta">Calculating...</span></p>
        <div class="actions">
            <button class="prepare-btn">Prepare for Arrival</button>
        </div>
    `;
    emergenciesList.appendChild(emergencyCard);
    
    const prepareBtn = emergencyCard.querySelector('.prepare-btn');
    prepareBtn.addEventListener('click', () => {
        prepareForEmergency(emergency.id);
    });
    
    trackEmergencyDriver(emergency.driverId, emergency.id);
}

function trackEmergencyDriver(driverId, emergencyId) {
    const driverRef = doc(db, "Drivers", driverId);
    
    onSnapshot(driverRef, (doc) => {
        if (doc.exists() && doc.data().currentLocation) {
            updateEmergencyETA(emergencyId, doc.data().currentLocation);
        }
    }, (error) => {
        showError("Error tracking driver: " + error.message);
    });
}

function updateEmergencyETA(emergencyId, driverLocation) {
    const etaElement = document.querySelector(`#emergency-${emergencyId} .eta`);
    if (etaElement) {
        const now = new Date();
        const estimatedMinutes = Math.floor(Math.random() * 15) + 5;
        const eta = new Date(now.getTime() + estimatedMinutes * 60000);
        etaElement.textContent = `${estimatedMinutes} min (approx. ${eta.toLocaleTimeString()})`;
    }
}

function prepareForEmergency(emergencyId) {
    updateDoc(doc(db, "Emergencies", emergencyId), {
        hospitalPrepared: true,
        preparedTime: serverTimestamp()
    })
    .then(() => {
        showNotification(`Hospital prepared for emergency #${emergencyId}`);
        const card = document.querySelector(`#emergency-${emergencyId}`);
        if (card) {
            card.classList.add('prepared');
            const prepareBtn = card.querySelector('.prepare-btn');
            prepareBtn.textContent = 'Prepared';
            prepareBtn.disabled = true;
        }
    })
    .catch(error => {
        showError(`Error preparing for emergency: ${error.message}`);
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
    acceptBtn.addEventListener('click', () => updateEmergencyStatus('accepted'));
    rejectBtn.addEventListener('click', () => {
        updateEmergencyStatus('rejected');
        resetEmergencyUI();
    });
    statusForm.addEventListener('submit', (e) => {
        e.preventDefault();
        updateEmergencyStatus(statusSelect.value);
    });
    completeBtn.addEventListener('click', () => {
        updateEmergencyStatus('completed');
        addToHistory();
        resetEmergencyUI();
    });
}

async function updateEmergencyStatus(statusOrEmergency) {
    if (typeof statusOrEmergency === 'object') {
        const emergency = statusOrEmergency;
        const card = document.querySelector(`#emergency-${emergency.id}`);
        if (card) {
            const statusIndicator = card.querySelector('h3');
            if (statusIndicator) {
                statusIndicator.textContent = `${emergency.condition} (${emergency.severity}) - ${emergency.status}`;
            }
            if (emergency.status === 'arrived') {
                card.classList.add('arrived');
                showNotification(`Emergency has arrived at the hospital!`);
            }
        }
    } else if (currentEmergencyId) {
        const status = statusOrEmergency;
        try {
            await updateDoc(doc(db, "Emergencies", currentEmergencyId), {
                status: status,
                lastUpdated: serverTimestamp()
            });
            showNotification(`Status updated to: ${status}`);
        } catch (error) {
            showError("Error updating status: " + error.message);
        }
    }
}

async function addToHistory() {
    if (!currentEmergencyId) return;

    try {
        const emergencyDoc = await getDoc(doc(db, "Emergencies", currentEmergencyId));
        if (emergencyDoc.exists()) {
            const emergency = emergencyDoc.data();
            await addDoc(collection(db, "hospitals", currentHospitalId, "history"), {
                emergencyId: currentEmergencyId,
                patientName: emergency.patientName,
                timestamp: serverTimestamp(),
                status: 'completed',
                condition: emergency.condition
            });
            showNotification("Emergency case added to history");
        }
    } catch (error) {
        showError("Error adding to history: " + error.message);
    }
}

async function loadEmergencyHistory() {
    try {
        const historyQuery = query(
            collection(db, "hospitals", currentHospitalId, "history"),
            orderBy("timestamp", "desc"),
            limit(5)
        );
        
        const querySnapshot = await getDocs(historyQuery);
        
        historyTable.innerHTML = '';
        if (querySnapshot.empty) {
            const row = historyTable.insertRow();
            row.insertCell(0).textContent = "No recent cases";
            row.insertCell(1).textContent = "";
            row.insertCell(2).textContent = "";
            row.insertCell(3).textContent = "";
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = historyTable.insertRow();
            row.insertCell(0).textContent = doc.id.substring(0, 8);
            row.insertCell(1).textContent = data.patientName;
            row.insertCell(2).textContent = data.timestamp.toDate().toLocaleString();
            row.insertCell(3).textContent = data.status;
        });
    } catch (error) {
        showError("Error loading history: " + error.message);
    }
}

function resetEmergencyUI() {
    emergencyInfo.textContent = 'No emergency request at the moment.';
    document.getElementById('request-details').style.display = 'none';
    currentEmergencyId = null;
    enableButtons(false);
    statusSelect.value = '';
}

document.querySelector('.logout').addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
        window.location.href = '../index.html';
    });
});

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
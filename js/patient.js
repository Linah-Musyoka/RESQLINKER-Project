// patient.js - Optimized and Enhanced
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, doc, getDoc, updateDoc, setDoc,
  collection, query, where, getDocs, onSnapshot,
  writeBatch, serverTimestamp
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
const profileForm = document.querySelector('.profile form');
const emergencyBtn = document.querySelector('.emergency-section .btn');
const emergencyForm = document.querySelector('.emergency-form form');
const logoutBtn = document.getElementById('logout-btn');
const currentLocationEl = document.getElementById('current-location');
const notificationPanel = document.getElementById('notification-panel');
const rideStatusIndicator = document.getElementById('ride-status-indicator');
const etaDisplay = document.getElementById('eta-display');
const driverNameEl = document.getElementById('driver-name');

// Global Variables
let currentUser = null;
let patientData = {};
let watchId = null;
let etaTimer = null;

// Error Messages
const errorMessages = {
  auth: "Authentication error. Please login again.",
  firestore: "Database error. Please try again.",
  location: "Location services required for this feature.",
  network: "Network connection issue detected.",
  permission: "You don't have permission for this action."
};

// Auth State Listener
onAuthStateChanged(auth, handleAuthStateChange);

async function handleAuthStateChange(user) {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  
  try {
    currentUser = user;
    await loadPatientData(user.uid);
    setupRealTimeUpdates(user.uid);
    startLocationTracking(user.uid);
  } catch (error) {
    handleError(error, "Initialization failed");
    await signOut(auth);
  }
}

// Patient Data Management
async function loadPatientData(uid) {
  const docRef = doc(db, "Patients", uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    patientData = docSnap.data();
    updateUI();
    if (!patientData.profileComplete) await saveInitialProfile(uid);
  } else {
    await initializePatient(uid);
  }
}

async function initializePatient(uid) {
  const user = auth.currentUser;
  await setDoc(doc(db, "Patients", uid), {
    uid: uid,
    username: user.displayName || '',
    email: user.email || '',
    createdAt: serverTimestamp(),
    status: "inactive",
    profileComplete: false,
    location: null
  });
}

async function saveInitialProfile(uid) {
  await updateDoc(doc(db, "Patients", uid), {
    username: auth.currentUser.displayName || 'New Patient',
    email: auth.currentUser.email || '',
    profileComplete: true,
    lastUpdated: serverTimestamp()
  });
}

// Emergency System
async function handleEmergencyRequest() {
  const confirmEmergency = confirm("This will notify available drivers. Continue?");
  if (!confirmEmergency) return;

  try {
    const location = await getCurrentLocation();
    await updateDoc(doc(db, "Patients", currentUser.uid), {
      status: "awaiting_driver",
      emergencyRequestTime: serverTimestamp(),
      location: location
    });
    
    await assignNearestDriver(location);
    showNotification("Emergency request sent! Finding nearest driver...", "success");
  } catch (error) {
    handleError(error, "Emergency request failed");
  }
}

async function assignNearestDriver(patientLocation) {
  const drivers = await getAvailableDrivers();
  if (drivers.length === 0) throw new Error("No available drivers");
  
  const driversWithETAs = await calculateDriverETAs(drivers, patientLocation);
  const nearestDriver = driversWithETAs.sort((a, b) => a.eta - b.eta)[0];
  
  const batch = writeBatch(db);
  const rideRef = doc(collection(db, "Rides"));
  
  // Update driver
  batch.update(doc(db, "Drivers", nearestDriver.id), {
    availability: false,
    currentPatient: currentUser.uid,
    lastAssignmentTime: serverTimestamp()
  });
  
  // Update patient
  batch.update(doc(db, "Patients", currentUser.uid), {
    assignedDriver: nearestDriver.id,
    assignedDriverName: nearestDriver.username,
    assignedDriverETA: nearestDriver.eta,
    status: "driver_assigned",
    currentRideId: rideRef.id
  });
  
  // Create ride record
  batch.set(rideRef, {
    patientId: currentUser.uid,
    driverId: nearestDriver.id,
    startTime: serverTimestamp(),
    status: "active",
    initialETA: nearestDriver.eta,
    startLocation: patientLocation
  });
  
  await batch.commit();
  startETACountdown(nearestDriver.eta);
}

async function calculateDriverETAs(drivers, patientLocation) {
  return await Promise.all(drivers.map(async driver => {
    const eta = await calculateETA(patientLocation, driver.location);
    return { ...driver, eta };
  }));
}

async function calculateETA(patientLoc, driverLoc) {
  // Simple distance calculation (mock)
  const distance = Math.sqrt(
    Math.pow(patientLoc.lat - driverLoc.lat, 2) + 
    Math.pow(patientLoc.lng - driverLoc.lng, 2)
  ) * 100;
  const hours = distance / 60;
  return Math.max(5, Math.round(hours * 60));
}

// Location Services
async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: new Date().toISOString()
      }),
      error => reject(error),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

function startLocationTracking(uid) {
  if (!navigator.geolocation) {
    currentLocationEl.textContent = "Geolocation not supported";
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: new Date().toISOString()
      };
      
      currentLocationEl.textContent = `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`;
      
      try {
        await updatePatientLocation(uid, location);
      } catch (error) {
        console.error("Location update failed:", error);
      }
    },
    (error) => {
      currentLocationEl.textContent = "Location unavailable";
      console.error("Geolocation error:", error);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, distanceFilter: 50 }
  );
}

async function updatePatientLocation(uid, location) {
  const updates = {
    location: location,
    lastLocationUpdate: serverTimestamp()
  };
  
  if (patientData.status === "in_transit") {
    updates.currentLocation = location;
    await updateDoc(doc(db, "Rides", patientData.currentRideId), {
      currentLocation: location,
      updatedAt: serverTimestamp()
    });
  }
  
  await updateDoc(doc(db, "Patients", uid), updates);
}

// Real-time Updates
function setupRealTimeUpdates(uid) {
  const patientRef = doc(db, "Patients", uid);
  
  onSnapshot(patientRef, (doc) => {
    if (!doc.exists()) return;
    
    patientData = doc.data();
    updateUI();
    
    if (patientData.status === "driver_assigned" && patientData.assignedDriverETA && !etaTimer) {
      startETACountdown(patientData.assignedDriverETA);
    }
  });
}

function updateUI() {
  // Update profile form
  if (patientData.username) document.getElementById('name').value = patientData.username;
  if (patientData.email) document.getElementById('email').value = patientData.email;
  if (patientData.allergies) document.getElementById('allergies').value = patientData.allergies;
  
  // Update ride status
  document.querySelector('.ride-status p').textContent = `Status: ${formatStatus(patientData.status)}`;
  rideStatusIndicator.className = `status-${patientData.status.replace('_', '-')}`;
  
  // Update driver info
  if (patientData.assignedDriverName) {
    driverNameEl.textContent = patientData.assignedDriverName;
    document.getElementById('emergency-form').classList.remove('disabled');
  }
}

function formatStatus(status) {
  const statusMap = {
    "inactive": "No active ride",
    "awaiting_driver": "Waiting for driver",
    "driver_assigned": "Driver on the way",
    "in_transit": "En route to hospital",
    "arrived": "Arrived at hospital"
  };
  return statusMap[status] || status;
}

function startETACountdown(etaMinutes) {
  if (etaTimer) clearInterval(etaTimer);
  
  let minutesLeft = etaMinutes;
  updateETADisplay(minutesLeft);
  
  etaTimer = setInterval(() => {
    minutesLeft--;
    updateETADisplay(minutesLeft);
    
    if (minutesLeft <= 0) {
      clearInterval(etaTimer);
      etaTimer = null;
    }
  }, 60000);
}

function updateETADisplay(minutes) {
  etaDisplay.textContent = minutes > 0 ? 
    `${minutes} min${minutes !== 1 ? 's' : ''}` : 
    "Arriving soon";
}

// Form Handlers
async function handleProfileSubmit(e) {
  e.preventDefault();
  try {
    await updateDoc(doc(db, "Patients", currentUser.uid), {
      username: document.getElementById('name').value,
      email: document.getElementById('email').value,
      profileComplete: true,
      lastUpdated: serverTimestamp()
    });
    showNotification("Profile updated successfully!", "success");
  } catch (error) {
    handleError(error, "Profile update failed");
  }
}

async function handleEmergencyFormSubmit(e) {
  e.preventDefault();
  try {
    if (patientData.status !== "driver_assigned") {
      throw new Error("Please wait for driver assignment");
    }

    const batch = writeBatch(db);
    const formData = {
      patientId: currentUser.uid,
      patientName: patientData.username,
      allergies: document.getElementById('allergies').value,
      emergencyDetails: document.getElementById('emergency-details').value,
      status: "pending",
      createdAt: serverTimestamp(),
      assignedDriver: patientData.assignedDriver,
      driverName: patientData.assignedDriverName
    };

    batch.update(doc(db, "Patients", currentUser.uid), {
      medicalInfoSubmitted: true,
      lastUpdated: serverTimestamp()
    });

    const emergencyRef = doc(collection(db, "HospitalEmergencyForms"));
    batch.set(emergencyRef, formData);
    await batch.commit();

    showNotification("Emergency details sent to hospital!", "success");
  } catch (error) {
    handleError(error, "Form submission failed");
  }
}

// Notification System
function showNotification(message, type = "info") {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notificationPanel.appendChild(notification);
  
  setTimeout(() => notification.remove(), 5000);
}

function handleError(error, context) {
  console.error(`${context}:`, error);
  
  let message = errorMessages.network;
  if (error.code === 'permission-denied') message = errorMessages.permission;
  if (error.code === 'unavailable') message = errorMessages.firestore;
  
  showNotification(`${context}: ${message}`, "error");
}

// Event Listeners
profileForm.addEventListener('submit', handleProfileSubmit);
emergencyBtn.addEventListener('click', handleEmergencyRequest);
emergencyForm.addEventListener('submit', handleEmergencyFormSubmit);
logoutBtn.addEventListener('click', async () => {
  try {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (etaTimer) clearInterval(etaTimer);
    await signOut(auth);
  } catch (error) {
    handleError(error, "Logout failed");
  }
});

// Initialize
function init() {
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

document.addEventListener('DOMContentLoaded', init);
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, doc, getDoc, updateDoc, onSnapshot, setDoc,
  collection, query, where, getDocs, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { 
  getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Firebase Configuration (same as patient.js)
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
const profileForm = document.getElementById('profile-form');
const vehicleForm = document.getElementById('vehicle-info-form');
const availabilityBtn = document.getElementById('availability-btn');
const startTripBtn = document.getElementById('start-trip-btn');
const logoutBtn = document.getElementById('logout-btn');
const routeDisplay = document.getElementById('route');
const etaDisplay = document.getElementById('eta');
const locationDisplay = document.getElementById('location');

// Global Variables
let currentDriver = null;
let currentRide = null;
let watchId = null;
let isAvailable = false;

// Initialize the application
function init() {
  // Set up event listeners
  profileForm.addEventListener('submit', handleProfileSubmit);
  vehicleForm.addEventListener('submit', handleVehicleSubmit);
  availabilityBtn.addEventListener('click', toggleAvailability);
  startTripBtn.addEventListener('click', startTrip);
  logoutBtn.addEventListener('click', handleLogout);
  
  // Check auth state
  onAuthStateChanged(auth, handleAuthStateChange);
}

// Handle authentication state
async function handleAuthStateChange(user) {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  
  currentDriver = user;
  await loadDriverData(user.uid);
  setupRealTimeUpdates(user.uid);
  setupRideRequestListener(); // Add ride request listener
  startLocationTracking(user.uid);
}

// Load driver data
async function loadDriverData(driverId) {
  const docRef = doc(db, "Drivers", driverId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    updateDriverUI(data);
    isAvailable = data.availability || false;
    updateAvailabilityButton();
    
    if (data.currentRide) {
      loadCurrentRide(data.currentRide);
    }
  } else {
    // Initialize new driver document
    await setDoc(docRef, {
      uid: driverId,
      name: '',
      email: '',
      contact: '',
      vehicleMake: '',
      vehicleModel: '',
      registration: '',
      availability: false,
      status: 'offline',
      createdAt: serverTimestamp()
    });
  }
}

// Update UI with driver data
function updateDriverUI(data) {
  document.getElementById('driver-name').value = data.name || '';
  document.getElementById('driver-contact').value = data.contact || '';
  document.getElementById('driver-email').value = data.email || '';
  document.getElementById('vehicle-make').value = data.vehicleMake || '';
  document.getElementById('vehicle-model').value = data.vehicleModel || '';
  document.getElementById('vehicle-reg').value = data.registration || '';
  
  isAvailable = data.availability || false;
  updateAvailabilityButton();
}

// Update availability button state
function updateAvailabilityButton() {
  availabilityBtn.textContent = isAvailable ? 'Available' : 'Unavailable';
  availabilityBtn.className = isAvailable ? 'btn available' : 'btn unavailable';
}

// Handle profile form submission
async function handleProfileSubmit(e) {
  e.preventDefault();
  try {
    await updateDoc(doc(db, "Drivers", currentDriver.uid), {
      name: document.getElementById('driver-name').value,
      contact: document.getElementById('driver-contact').value,
      email: document.getElementById('driver-email').value,
      lastUpdated: serverTimestamp()
    });
    showNotification("Profile updated successfully!");
  } catch (error) {
    showError("Failed to update profile: " + error.message);
  }
}

// Handle vehicle form submission
async function handleVehicleSubmit(e) {
  e.preventDefault();
  try {
    await updateDoc(doc(db, "Drivers", currentDriver.uid), {
      vehicleMake: document.getElementById('vehicle-make').value,
      vehicleModel: document.getElementById('vehicle-model').value,
      registration: document.getElementById('vehicle-reg').value,
      lastUpdated: serverTimestamp()
    });
    showNotification("Vehicle information updated!");
  } catch (error) {
    showError("Failed to update vehicle info: " + error.message);
  }
}

// Toggle driver availability
async function toggleAvailability() {
  try {
    isAvailable = !isAvailable;
    await updateDoc(doc(db, "Drivers", currentDriver.uid), {
      availability: isAvailable,
      status: isAvailable ? 'available' : 'unavailable',
      lastUpdated: serverTimestamp()
    });
    updateAvailabilityButton();
    showNotification(`You are now ${isAvailable ? 'available' : 'unavailable'}`);
  } catch (error) {
    showError("Failed to update availability: " + error.message);
  }
}

// Load current ride information
async function loadCurrentRide(rideId) {
  const rideDoc = await getDoc(doc(db, "Rides", rideId));
  if (rideDoc.exists()) {
    currentRide = rideDoc.data();
    updateRideUI(currentRide);
  }
}

// Update ride information in UI
function updateRideUI(ride) {
  document.getElementById('pickup-location').value = ride.pickupLocation || '';
  document.getElementById('passenger-name').value = ride.patientName || '';
  routeDisplay.textContent = `${ride.pickupLocation} to ${ride.hospitalName}`;
  etaDisplay.textContent = ride.eta ? `${ride.eta} minutes` : 'Calculating...';
  
  // Enable trip controls
  startTripBtn.disabled = false;
}

// Start trip
async function startTrip() {
  try {
    await updateDoc(doc(db, "Rides", currentRide.id), {
      status: 'in_progress',
      startTime: serverTimestamp()
    });
    showNotification("Trip started successfully!");
  } catch (error) {
    showError("Failed to start trip: " + error.message);
  }
}

// Location tracking
function startLocationTracking(driverId) {
  if (!navigator.geolocation) {
    locationDisplay.textContent = "Geolocation not supported";
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: new Date().toISOString()
      };
      
      locationDisplay.textContent = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
      
      try {
        await updateDoc(doc(db, "Drivers", driverId), {
          location: location,
          lastLocationUpdate: serverTimestamp()
        });
        
        if (currentRide) {
          await updateDoc(doc(db, "Rides", currentRide.id), {
            driverLocation: location,
            updatedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Location update failed:", error);
      }
    },
    (error) => {
      locationDisplay.textContent = "Location unavailable";
      console.error("Geolocation error:", error);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, distanceFilter: 50 }
  );
}

// Setup real-time updates
function setupRealTimeUpdates(driverId) {
  // Listen for ride assignments
  onSnapshot(doc(db, "Drivers", driverId), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      if (data.currentRide && (!currentRide || currentRide.id !== data.currentRide)) {
        loadCurrentRide(data.currentRide);
      }
    }
  });
}

// Setup ride request listener
function setupRideRequestListener() {
  const q = query(
    collection(db, "RideRequests"),
    where("driverId", "==", currentDriver.uid),
    where("status", "==", "pending")
  );
  
  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        showRideRequest(change.doc.id, change.doc.data());
      }
    });
  });
}

// Show ride request modal
function showRideRequest(requestId, request) {
  const modal = document.getElementById('request-modal');
  modal.innerHTML = `
    <div class="modal-content">
      <h3>New Ride Request</h3>
      <p>Patient is requesting assistance</p>
      <div class="patient-info">
        <p>Location: ${request.patientLocation.address || 'Unknown location'}</p>
      </div>
      <div class="action-buttons">
        <button class="accept-btn">Accept</button>
        <button class="reject-btn">Reject</button>
      </div>
    </div>
  `;
  
  modal.style.display = 'block';
  
  // Add event listeners
  modal.querySelector('.accept-btn').addEventListener('click', () => {
    acceptRideRequest(requestId);
    modal.style.display = 'none';
  });
  
  modal.querySelector('.reject-btn').addEventListener('click', () => {
    rejectRideRequest(requestId);
    modal.style.display = 'none';
  });
}

// Accept ride request
async function acceptRideRequest(requestId) {
  try {
    const batch = writeBatch(db);
    
    // Update request status
    batch.update(doc(db, "RideRequests", requestId), {
      status: "accepted",
      respondedAt: serverTimestamp()
    });
    
    // Update driver status
    batch.update(doc(db, "Drivers", currentDriver.uid), {
      availability: false,
      status: "on_ride"
    });
    
    await batch.commit();
    showNotification("Ride accepted. Please proceed to patient location.");
  } catch (error) {
    handleError(error, "Failed to accept ride");
  }
}

// Reject ride request
async function rejectRideRequest(requestId) {
  try {
    await updateDoc(doc(db, "RideRequests", requestId), {
      status: "rejected",
      respondedAt: serverTimestamp()
    });
    showNotification("Ride request declined.", "info");
  } catch (error) {
    handleError(error, "Failed to reject ride");
  }
}

// Handle errors
function handleError(error, message) {
  console.error(message, error);
  showError(`${message}: ${error.message}`);
}

// Handle logout
async function handleLogout() {
  try {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    await signOut(auth);
    window.location.href = "../index.html";
  } catch (error) {
    showError("Logout failed: " + error.message);
  }
}

// Helper functions
function showNotification(message, type = "success") {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

function showError(message) {
  showNotification(message, "error");
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);
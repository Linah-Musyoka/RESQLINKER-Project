import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, doc, getDoc, updateDoc, setDoc,
    collection, query, where, getDocs, onSnapshot,
    writeBatch, serverTimestamp, addDoc
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

// DOM Elements with null checks
const getElement = (id) => document.getElementById(id) || console.error(`Element ${id} not found`);
const notificationPanel = getElement('notification-panel');
const rideStatusIndicator = getElement('ride-status-indicator');
const rideStatusText = getElement('ride-status-text');
const etaDisplay = getElement('eta-display');
const driverNameEl = getElement('driver-name');
const currentLocationEl = getElement('current-location');
const emergencyBtn = getElement('emergency-btn');

// Global Variables
let currentUser = null;
let patientData = {
    status: 'inactive', // Default status
    assignedDriverName: null
};
let watchId = null;
let etaTimer = null;
let availableDrivers = [];
let selectedDriverId = null;
let rideRequestListener = null;

// Error Messages
const errorMessages = {
    auth: "Authentication error. Please login again.",
    firestore: "Database error. Please try again.",
    location: "Location services required for this feature.",
    network: "Network connection issue detected.",
    permission: "You don't have permission for this action."
};

// ======================
// 1. Core Functions
// ======================

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

async function loadPatientData(uid) {
    try {
        const docRef = doc(db, "Patients", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            patientData = docSnap.data();
            updateUI();
            if (!patientData.profileComplete) await saveInitialProfile(uid);
        } else {
            await initializePatient(uid);
        }
    } catch (error) {
        handleError(error, "Failed to load patient data");
    }
}

// ======================
// 2. Emergency System
// ======================

async function handleEmergencyRequest() {
    const confirmEmergency = confirm("This will notify available drivers. Continue?");
    if (!confirmEmergency) return;

    try {
        showNotification("Getting your location...", "info");
        const location = await getCurrentLocation();

        await updateDoc(doc(db, "Patients", currentUser.uid), {
            status: "awaiting_driver",
            emergencyRequestTime: serverTimestamp(),
            location: location
        });

        showNotification("Loading available drivers...", "info");
        await loadAvailableDrivers();

        // Show driver selection
        getElement('driver-selection').style.display = 'block';
        getElement('emergency-btn').disabled = true;

    } catch (error) {
        handleError(error, "Emergency request failed: " + error.message);
        showNotification("Failed to get location. Please try again.", "error");

        if (error.message.includes("permission")) {
          getElement('emergency-btn').disabled = false;
        }

    }
}

// ======================
// 3. Location Services
// ======================

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
            showNotification("Location services have encountered an error.", "error")
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, distanceFilter: 50 }
    );
}

// ======================
// 4. UI Updates
// ======================

function updateUI() {
    try {
        // Update profile form
        const nameInput = getElement('name');
        const emailInput = getElement('email');
        const allergiesInput = getElement('allergies');

        if (nameInput && patientData.username) nameInput.value = patientData.username;
        if (emailInput && patientData.email) emailInput.value = patientData.email;
        if (allergiesInput && patientData.allergies) allergiesInput.value = patientData.allergies;

        // Update ride status
        const statusText = patientData.status ? formatStatus(patientData.status) : 'Unknown';
        if (rideStatusText) rideStatusText.textContent = `Status: ${statusText}`;

        if (rideStatusIndicator) {
            rideStatusIndicator.className = patientData.status
                ? `status-${String(patientData.status).replace('_', '-')}`
                : 'status-unknown';
        }

        // Update driver info
        if (driverNameEl) {
            driverNameEl.textContent = patientData.assignedDriverName || 'Not assigned';
        }

        // Enable/disable emergency form based on driver assignment
        const emergencyForm = getElement('emergency-form');
        if (emergencyForm) {
            if (patientData.assignedDriverName) {
                emergencyForm.classList.remove('disabled');
            } else {
                emergencyForm.classList.add('disabled');
            }
        }
    } catch (error) {
        console.error("UI update failed:", error);
    }
}

// ======================
// 5. Driver Selection System
// ======================

async function loadAvailableDrivers() {
    try {
        const q = query(
            collection(db, "Drivers"),
            where("availability", "==", true),
            where("status", "==", "available")
        );

        const querySnapshot = await getDocs(q);
        availableDrivers = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displayDriversList();
    } catch (error) {
        handleError(error, "Error loading drivers");
    }
}

function displayDriversList() {
    const driversList = getElement('drivers-list');
    if (!driversList) return;

    driversList.innerHTML = '';

    if (availableDrivers.length === 0) {
        driversList.innerHTML = '<p>No available drivers at the moment. Please try again later.</p>';
        return;
    }

    availableDrivers.forEach(driver => {
        const driverCard = document.createElement('div');
        driverCard.className = 'driver-card';
        driverCard.innerHTML = `
            <img src="${driver.photoURL || 'default-driver.jpg'}" alt="${driver.name}">
            <h3>${driver.name}</h3>
            <p>${driver.vehicleMake} ${driver.vehicleModel}</p>
            <p>Rating: ${driver.rating || '4.5'} ★</p>
            <button class="select-driver" data-id="${driver.id}">Select Driver</button>
        `;
        driversList.appendChild(driverCard);
    });

    // Add event listeners
    document.querySelectorAll('.select-driver').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedDriverId = e.target.dataset.id;
            requestDriver(selectedDriverId);
        });
    });
}

// ======================
// 6. Initialization
// ======================

function init() {
    try {
        // Set up event listeners
        const profileForm = document.querySelector('.profile form');
        if (profileForm) profileForm.addEventListener('submit', handleProfileSubmit);

        if (emergencyBtn) emergencyBtn.addEventListener('click', handleEmergencyRequest);

        const emergencyForm = getElement('emergency-form');
        if (emergencyForm) emergencyForm.addEventListener('submit', handleEmergencyFormSubmit);

        const logoutBtn = getElement('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

        // Initialize auth state listener
        onAuthStateChanged(auth, handleAuthStateChange);

        // Initialize UI with default values
        updateUI();
    } catch (error) {
        console.error("Initialization failed:", error);
        showNotification("System initialization failed. Please refresh.", "error");
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);

// ======================
// 7. Helper Functions
// ======================

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

function showNotification(message, type = "info") {
    if (!notificationPanel) {
        console.warn("Notification panel not found in DOM");
        return;
    }

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

async function requestDriver(driverId) {
    try {
        const rideRequestRef = await addDoc(collection(db, "RideRequests"), {
            patientId: currentUser.uid,
            driverId: driverId,
            status: "pending",
            createdAt: serverTimestamp(),
            patientLocation: patientData.location
        });

        setupRideRequestListener(rideRequestRef.id);
        showNotification("Driver request sent. Waiting for response...");
    } catch (error) {
        handleError(error, "Failed to request driver");
    }
}

function setupRideRequestListener(requestId) {
    if (rideRequestListener) rideRequestListener();

    const requestRef = doc(db, "RideRequests", requestId);
    rideRequestListener = onSnapshot(requestRef, (doc) => {
        if (!doc.exists()) return;

        const request = doc.data();

        if (request.status === "accepted") {
            showNotification("Driver accepted your request!");
            showEmergencyForm(request.driverId);
            if (rideRequestListener) rideRequestListener();
        } else if (request.status === "rejected") {
            showNotification("Driver declined. Please select another.", "warning");
            if (rideRequestListener) rideRequestListener();
            loadAvailableDrivers();
        }
    });
}
async function handleProfileSubmit(e) {
    e.preventDefault();
    try {
        await updateDoc(doc(db, "Patients", currentUser.uid), {
            username: getElement('name').value,
            email: getElement('email').value,
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
            allergies: getElement('allergies').value,
            emergencyDetails: getElement('emergency-details').value,
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

async function handleLogout() {
    try {
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (etaTimer) clearInterval(etaTimer);
        if (rideRequestListener) rideRequestListener();
        await signOut(auth);
        window.location.href = "../index.html";
    } catch (error) {
        handleError(error, "Logout failed");
    }
}

function showEmergencyForm(driverId) {
    getElement('driver-selection').style.display = 'none';
    getElement('emergency-form').style.display = 'block';

    getElement('emergency-form').onsubmit = async (e) => {
        e.preventDefault();

        const emergencyData = {
            patientId: currentUser.uid,
            driverId: driverId,
            condition: getElement('condition').value,
            symptoms: getElement('symptoms').value,
            severity: getElement('severity').value,
            status: "en_route",
            createdAt: serverTimestamp(),
            hospitalId: "default_hospital_id"
        };

        try {
            await addDoc(collection(db, "Emergencies"), emergencyData);

            await updateDoc(doc(db, "Patients", currentUser.uid), {
                status: "driver_assigned",
                assignedDriver: driverId
            });

            await updateDoc(doc(db, "Drivers", driverId), {
                availability: false,
                status: "on_ride",
                currentEmergency: emergencyData
            });

            showNotification("Emergency submitted! Help is on the way.", "success");
            trackDriverLocation(driverId);
        } catch (error) {
            handleError(error, "Failed to submit emergency");
        }
    };
}

async function viewDriverProfile(driverId) {
    try {
        const driverDoc = await getDoc(doc(db, "Drivers", driverId));
        if (driverDoc.exists()) {
            const driver = driverDoc.data();

            getElement('driver-profile-modal').innerHTML = `
                <div class="modal-content">
                    <span class="close" onclick="closeModal()">&times;</span>
                    <img src="${driver.photoURL || 'default-driver.jpg'}" class="profile-img">
                    <h2>${driver.name}</h2>
                    <div class="profile-section">
                        <h3>Vehicle Information</h3>
                        <p>${driver.vehicleMake} ${driver.vehicleModel} (${driver.vehicleYear})</p>
                        <p>Color: ${driver.vehicleColor}</p>
                        <p>License: ${driver.licensePlate}</p>
                    </div>
                    <div class="profile-section">
                        <h3>Driver Details</h3>
                        <p>Rating: ${driver.rating || '4.5'} ★ (${driver.rideCount || 0} rides)</p>
                        <p>Medical Training: ${driver.medicalTraining || 'Basic First Aid'}</p>
                    </div>
                </div>
            `;
            getElement('driver-profile-modal').style.display = 'block';
        }
    } catch (error) {
        handleError(error, "Failed to load driver profile");
    }
}

function closeModal() {
    getElement('driver-profile-modal').style.display = 'none';
}

function trackDriverLocation(driverId) {
    const driverRef = doc(db, "Drivers", driverId);

    onSnapshot(driverRef, (doc) => {
        if (doc.exists()) {
            const driver = doc.data();
            if (driver.currentLocation) {
                updateDriverOnMap(driver.currentLocation);
                updateETA(driver.currentLocation);
            }
        }
    });
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

async function getAvailableDrivers() {
    const q = query(
        collection(db, "Drivers"),
        where("availability", "==", true),
        where("status", "==", "available")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function calculateETA(patientLoc, driverLoc) {
    const distance = Math.sqrt(
        Math.pow(patientLoc.lat - driverLoc.lat, 2) +
        Math.pow(patientLoc.lng - driverLoc.lng, 2)
    ) * 100;
    const hours = distance / 60;
    return Math.max(5, Math.round(hours * 60));
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

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            position => resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString()
            }),
            error => {
                console.error("Geolocation error:", error);
                if (error.code === error.PERMISSION_DENIED) {
                    reject(new Error("Location permission denied. Please enable location access."));
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    reject(new Error("Location unavailable. Please check your device settings."));
                } else if(error.code === error.TIMEOUT){
                    reject(new Error("Location retrieval timed out. Please try again."));
                } else {
                    reject(new Error("Failed to get location."));
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        );
    });
}

async function calculateDriverETAs(drivers, patientLocation) {
    return await Promise.all(drivers.map(async driver => {
        const eta = await calculateETA(patientLocation, driver.location);
        return { ...driver, eta };
    }));
}

function updateDriverOnMap(location) {
    console.log("Driver location updated:", location);
}

function updateETA(driverLocation) {
    if (!patientData.location) return;

    calculateETA(patientData.location, driverLocation)
        .then(minutes => {
            if (etaTimer) clearInterval(etaTimer);
            startETACountdown(minutes);
        })
        .catch(error => {
            console.error("ETA calculation failed:", error);
        });
}
// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { 
  getAuth, 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Firebase configuration
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
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const profileForm = document.querySelector('.profile form');
const emergencyBtn = document.querySelector('.emergency-section .btn');
const bookRideBtn = document.querySelector('.book-ride .btn');
const emergencyForm = document.querySelector('.emergency-form form');
const currentLocationDisplay = document.getElementById('current-location');
const rideStatusDisplay = document.querySelector('.ride-status p');

// Check authentication state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  // Check if user is a patient
  const patientDoc = await getDoc(doc(db, "Patients", user.uid));
  if (!patientDoc.exists()) {
    alert("You don't have patient access");
    await signOut(auth);
    window.location.href = "../index.html";
    return;
  }

  // Load patient data
  loadPatientData(user.uid);
});

// Load patient data from Firestore
async function loadPatientData(patientId) {
  try {
    const docRef = doc(db, "Patients", patientId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const patientData = docSnap.data();
      
      // Populate profile form
      if (profileForm) {
        profileForm.elements['name'].value = patientData.fullName || '';
        profileForm.elements['email'].value = patientData.email || '';
      }

      // Display current ride status if available
      if (rideStatusDisplay && patientData.currentRide) {
        rideStatusDisplay.textContent = `Current Ride: ${patientData.currentRide.status || 'Not Started'}`;
      }
    }
  } catch (error) {
    console.error("Error loading patient data:", error);
    alert("Error loading your data. Please try again.");
  }
}

// Update profile
if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = profileForm.elements['name'].value;
    const email = profileForm.elements['email'].value;
    const user = auth.currentUser;

    try {
      await updateDoc(doc(db, "Patients", user.uid), {
        fullName: name,
        email: email,
        lastUpdated: new Date().toISOString()
      });
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Error updating profile. Please try again.");
    }
  });
}

// Emergency ride request
if (emergencyBtn) {
  emergencyBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure you need an emergency ride?")) return;
    
    try {
      const user = auth.currentUser;
      const patientDoc = await getDoc(doc(db, "Patients", user.uid));
      
      if (!patientDoc.exists()) {
        alert("Patient record not found");
        return;
      }

      // Get current location
      let location = "Unknown";
      try {
        const pos = await getCurrentPosition();
        location = `Lat: ${pos.coords.latitude}, Long: ${pos.coords.longitude}`;
        if (currentLocationDisplay) {
          currentLocationDisplay.textContent = location;
        }
      } catch (geoError) {
        console.warn("Geolocation error:", geoError);
        location = "Approximate location (permissions denied)";
      }

      // Create emergency ride request
      const rideRequest = {
        patientId: user.uid,
        patientName: patientDoc.data().fullName || "Unknown",
        location: location,
        status: "requested",
        timestamp: new Date().toISOString(),
        isEmergency: true
      };

      // Add to rides collection
      const rideRef = await addDoc(collection(db, "Rides"), rideRequest);
      
      // Update patient document with current ride
      await updateDoc(doc(db, "Patients", user.uid), {
        currentRide: {
          id: rideRef.id,
          status: "requested"
        }
      });

      alert("Emergency ride requested! A driver will be assigned soon.");
      if (rideStatusDisplay) {
        rideStatusDisplay.textContent = "Current Ride: Requested (Emergency)";
      }
    } catch (error) {
      console.error("Error requesting emergency ride:", error);
      alert("Error requesting emergency ride. Please try again.");
    }
  });
}

// Book regular ride
if (bookRideBtn) {
  bookRideBtn.addEventListener('click', async () => {
    // Implement similar logic to emergency ride but with isEmergency: false
    alert("Regular ride booking functionality will be implemented here");
  });
}

// Submit emergency form
if (emergencyForm) {
  emergencyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      name: emergencyForm.elements['patient-name'].value,
      allergies: emergencyForm.elements['allergies'].value,
      details: emergencyForm.elements['emergency-details'].value,
      timestamp: new Date().toISOString(),
      patientId: auth.currentUser.uid
    };

    try {
      await addDoc(collection(db, "EmergencyForms"), formData);
      alert("Emergency form submitted successfully!");
      emergencyForm.reset();
    } catch (error) {
      console.error("Error submitting emergency form:", error);
      alert("Error submitting form. Please try again.");
    }
  });
}

// Logout functionality
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.href = "../index.html";
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

// Geolocation helper
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    }
  });
}

// Attempt to get location on page load
if (currentLocationDisplay) {
  getCurrentPosition()
    .then(pos => {
      currentLocationDisplay.textContent = 
        `Lat: ${pos.coords.latitude.toFixed(4)}, Long: ${pos.coords.longitude.toFixed(4)}`;
    })
    .catch(err => {
      console.warn("Geolocation error:", err);
      currentLocationDisplay.textContent = "Location unavailable (check permissions)";
    });
}
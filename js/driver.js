// Function to handle form submission (profile, vehicle, active ride)
document.getElementById('profile-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const name = document.getElementById('driver-name').value;
    const contact = document.getElementById('driver-contact').value;
    const email = document.getElementById('driver-email').value;
    
    // Save the profile data to Firebase (this part will be added once Firebase is integrated)
    console.log('Profile Saved:', { name, contact, email });
});

document.getElementById('vehicle-info-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const make = document.getElementById('vehicle-make').value;
    const model = document.getElementById('vehicle-model').value;
    const registration = document.getElementById('vehicle-reg').value;

    // Save the vehicle info to Firebase (this part will be added once Firebase is integrated)
    console.log('Vehicle Info Saved:', { make, model, registration });
});

document.getElementById('active-ride-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const pickupLocation = document.getElementById('pickup-location').value;
    const passengerName = document.getElementById('passenger-name').value;

    // Update active ride details (this part will be added once Firebase is integrated)
    console.log('Active Ride Updated:', { pickupLocation, passengerName });
});

// Real-Time Location Updates for Ongoing Trip
let ongoingTripStarted = false;

document.getElementById('start-trip-btn').addEventListener('click', function() {
    if (!ongoingTripStarted) {
        ongoingTripStarted = true;
        startRealTimeLocationUpdates();
    }
});

// Function to start real-time location updates using the Geolocation API
function startRealTimeLocationUpdates() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            // Display the current location in the ongoing trip section
            document.getElementById('location').textContent = `Lat: ${latitude}, Lon: ${longitude}`;

            // Update the trip route and ETA (Placeholder, real-time calculations can be added)
            document.getElementById('route').textContent = `Route: From Pickup to Destination`;
            document.getElementById('eta').textContent = `ETA: 10 minutes`;

            // Simulate real-time updates to Firebase (to be integrated later)
            console.log('Real-Time Location:', { latitude, longitude });
        }, function(error) {
            console.log('Geolocation error:', error);
            document.getElementById('location').textContent = 'Location not available';
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

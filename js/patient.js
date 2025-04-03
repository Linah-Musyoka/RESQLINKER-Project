// JavaScript for Patient Dashboard (with Location Tracking)

document.addEventListener("DOMContentLoaded", function() {
    // Fetch the form and profile elements
    const profileForm = document.getElementById("profile-form");
    const nameField = document.getElementById("name");
    const emailField = document.getElementById("email");
    const contactField = document.getElementById("contact");
    const logoutBtn = document.getElementById("logout-btn");
    
    // Elements for displaying current location
    const locationDisplay = document.getElementById("current-location");

    // Mock patient data, replace with Firebase or database logic later
    const patientData = {
        name: "John Doe",
        email: "johndoe@example.com",
        contact: "123-456-7890",
        location: {
            latitude: null,
            longitude: null
        }
    };

    // Load patient profile into form fields when page loads
    nameField.value = patientData.name;
    emailField.value = patientData.email;
    contactField.value = patientData.contact;

    // Handle form submission to update profile (Firebase integration will be added later)
    profileForm.addEventListener("submit", function(event) {
        event.preventDefault(); // Prevent form from reloading the page
        
        // Get updated values from the form
        const updatedName = nameField.value;
        const updatedEmail = emailField.value;
        const updatedContact = contactField.value;
        
        // Simulate saving to Firebase (Replace with Firebase update logic)
        console.log("Profile updated:", {
            name: updatedName,
            email: updatedEmail,
            contact: updatedContact
        });

        // Update the profile with new data (here we just log to console, replace with actual logic)
        patientData.name = updatedName;
        patientData.email = updatedEmail;
        patientData.contact = updatedContact;

        // Optionally show success message (could be done using Firebase response)
        alert("Profile updated successfully!");
    });

    // Handle the logout functionality (Redirect to Home)
    logoutBtn.addEventListener("click", function() {
        // For now, redirect to the home page
        window.location.href = "../index.html";
    });

    // Get current location using the Geolocation API
    function getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                // Update the patientData object with the current location
                patientData.location.latitude = latitude;
                patientData.location.longitude = longitude;

                // Display the current location on the page
                locationDisplay.innerHTML = `
                    Latitude: ${latitude} <br> Longitude: ${longitude}
                `;

                // Optionally, update the location in Firebase or another database
                console.log("Current location updated:", patientData.location);
            }, function(error) {
                console.log("Error getting location: ", error);
                locationDisplay.innerHTML = "Unable to retrieve your location.";
            });
        } else {
            locationDisplay.innerHTML = "Geolocation is not supported by this browser.";
        }
    }

    // Get location when the page loads
    getCurrentLocation();
});

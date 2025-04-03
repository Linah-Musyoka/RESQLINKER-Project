// JavaScript for Hospital Dashboard

document.addEventListener("DOMContentLoaded", function() {
    // Fetch elements
    const acceptBtn = document.getElementById("accept-btn");
    const rejectBtn = document.getElementById("reject-btn");
    const statusForm = document.getElementById("status-form");
    const statusSelect = document.getElementById("status");
    const completeBtn = document.getElementById("complete-btn");
    const emergencyInfo = document.getElementById("emergency-info");

    // Example mock emergency data (replace with Firebase logic later)
    let emergencyRequest = {
        patientName: "John Doe",
        pickUpLocation: "123 Main Street",
        status: "Pending"
    };

    // Display the emergency request info
    function displayEmergencyInfo() {
        emergencyInfo.innerHTML = `
            Patient: ${emergencyRequest.patientName} <br>
            Pick-up Location: ${emergencyRequest.pickUpLocation} <br>
            Status: ${emergencyRequest.status}
        `;
    }

    // Display emergency request info on load
    displayEmergencyInfo();

    // Accept emergency request
    acceptBtn.addEventListener("click", function() {
        emergencyRequest.status = "Accepted";
        displayEmergencyInfo();
        alert("Emergency request accepted!");
    });

    // Reject emergency request
    rejectBtn.addEventListener("click", function() {
        emergencyRequest.status = "Rejected";
        displayEmergencyInfo();
        alert("Emergency request rejected!");
    });

    // Update status (on the way, at the hospital)
    statusForm.addEventListener("submit", function(event) {
        event.preventDefault();
        emergencyRequest.status = statusSelect.value;
        displayEmergencyInfo();
        alert("Status updated!");
    });

    // Mark the emergency as completed
    completeBtn.addEventListener("click", function() {
        emergencyRequest.status = "Completed";
        displayEmergencyInfo();
        alert("Emergency request marked as completed!");
    });
});

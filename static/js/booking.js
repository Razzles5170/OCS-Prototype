// this just handles the booking system for the consultation and installation
// it handles the form submission ofs it and the date and time slection and wont let you pick a time if you have not selected a date
// it also handles the validation of the form and the error messages and success messages


let hasApprovedConsultation = false;
document.addEventListener('DOMContentLoaded', function() {

    const consultationDateInput = document.getElementById('consultation-date');
    const installationDateInput = document.getElementById('installation-date');
    const consultationTimeSelect = document.getElementById('consultation-time');
    const installationTimeSelect = document.getElementById('installation-time');
    const consultationForm = document.getElementById('consultation-form');
    const installationForm = document.getElementById('installation-form');

    const consultationTab = document.querySelector('.consultation-option');
    const installationTab = document.querySelector('.installation-option');
    const installationRequirementNotice = document.getElementById('installation-requirement-notice');
    const installationBookingContent = document.getElementById('installation-booking-content');
    if (document.querySelector('.option-select')) {
        selectOption('Consultation');
        checkConsultationStatus();

        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];

        if (consultationDateInput) {
            consultationDateInput.setAttribute('min', formattedDate);
            consultationDateInput.addEventListener('change', function() {
                const selectedDate = this.value;

                if (!selectedDate) return;

                const date = new Date(selectedDate);
                if (isWeekend(date)) {
                    showMessage(false, "Weekend dates are not available. Please select a weekday.");
                    this.value = '';
                    return;
                }

                getAvailableTimeSlots(selectedDate, consultationTimeSelect);
            });
        }

        if (installationDateInput) {
            installationDateInput.setAttribute('min', formattedDate);
            installationDateInput.addEventListener('change', function() {
                const selectedDate = this.value;

                if (!selectedDate) return;

                const date = new Date(selectedDate);
                if (isWeekend(date)) {
                    showMessage(false, "Weekend dates are not available. Please select a weekday.");
                    this.value = '';
                    return;
                }

                getAvailableTimeSlots(selectedDate, installationTimeSelect);
            });
        }
    }

    if (consultationForm) {
        consultationForm.addEventListener('submit', function(event) {
            event.preventDefault();
            hideMessages();

            const date = document.getElementById('consultation-date').value;
            const time = document.getElementById('consultation-time').value;
            const reason = document.getElementById('consultation-reason').value;

            if (!date || !time || !reason.trim()) {
                showMessage(false, "Please complete all required fields.");
                return;
            }

            const formData = {
                date: date,
                time: time,
                reason: reason,
                type: 'consultation'
            };

            fetch('/book_consultation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(true);
                    consultationForm.reset();
                    document.getElementById('consultation-date').value = '';
                    document.getElementById('consultation-date-input').value = '';
                } else {
                    showMessage(false, data.message || 'Booking failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage(false, 'An error occurred. Please try again.');
            });
        });
    }

    if (installationForm) {
        installationForm.addEventListener('submit', function(event) {
            event.preventDefault();
            hideMessages();

            if (!hasApprovedConsultation) {
                showMessage(false, "You must complete a consultation before booking an installation.");
                return;
            }

            const date = document.getElementById('installation-date').value;
            const time = document.getElementById('installation-time').value;
            const address = document.getElementById('installation-address').value;

            if (!date || !time || !address.trim()) {
                showMessage(false, "Please complete all required fields.");
                return;
            }

            const formData = {
                date: date,
                time: time,
                address: address,
                type: 'installation'
            };

            fetch('/book_installation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(true);
                    installationForm.reset();
                    document.getElementById('installation-date').value = '';
                    document.getElementById('installation-date-input').value = '';
                } else {
                    showMessage(false, data.message || 'Booking failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage(false, 'An error occurred. Please try again.');
            });
        });
    }
});

function selectOption(option) {
    document.querySelectorAll('.option-select a').forEach(tab => {
        tab.classList.remove('active');
    });

    if (option === 'Consultation') {
        document.querySelector('.consultation-form').style.display = 'block';
        document.querySelector('.installation-form').style.display = 'none';
        document.querySelector('.consultation-option').classList.add('active');
    } else if (option === 'Installation') {
        document.querySelector('.installation-form').style.display = 'block';
        document.querySelector('.consultation-form').style.display = 'none';
        document.querySelector('.installation-option').classList.add('active');

        checkConsultationStatus();
    }

    hideMessages();
}

function checkConsultationStatus() {
    fetch('/api/check_consultation_status')
        .then(response => response.json())
        .then(data => {
            hasApprovedConsultation = data.has_approved_consultation;

            if (hasApprovedConsultation) {
                document.getElementById('installation-requirement-notice').style.display = 'none';
                document.getElementById('installation-booking-content').style.display = 'block';
            } else {
                document.getElementById('installation-requirement-notice').style.display = 'block';
                document.getElementById('installation-booking-content').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error checking consultation status:', error);
        });
}

function getAvailableTimeSlots(date, timeSelect) {
    if (!timeSelect) return;

    timeSelect.innerHTML = '<option value="">Loading...</option>';

    return fetch(`/api/availability?date=${date}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            timeSelect.innerHTML = '<option value="">Select a time slot</option>';

            if (data.available_slots && data.available_slots.length > 0) {
                data.available_slots.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot;
                    option.textContent = slot;
                    timeSelect.appendChild(option);
                });
                return true;
            } else {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = data.available_slots && data.available_slots.length === 0 ? "No slots available" : "Error loading slots";
                option.disabled = true;
                timeSelect.appendChild(option);
                return false;
            }
        })
        .catch(error => {
            console.error('Error fetching time slots:', error);
            timeSelect.innerHTML = '<option value="">Error loading slots</option>';
            return false;
        });
}

function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; 
}

function showMessage(isSuccess, message) {
    hideMessages();
    if (isSuccess) {
        document.getElementById('booking-success').style.display = 'block';
    } else {
        document.getElementById('error-message').textContent = message || 'An unknown error occurred.';
        document.getElementById('booking-error').style.display = 'block';
    }
}

function hideMessages() {
    document.getElementById('booking-success').style.display = 'none';
    document.getElementById('booking-error').style.display = 'none';
}
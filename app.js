// 🔑 FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyCUn_OVro6-NBfIAn0SAcGZeV25HqiCvlc",
    authDomain: "barangay-san-juan.firebaseapp.com",
    projectId: "barangay-san-juan",
    storageBucket: "barangay-san-juan.firebasestorage.app",
    messagingSenderId: "987977241267",
    appId: "1:987977241267:web:4685a282641fce2ccad6c6",
    measurementId: "G-5XWG6ET1CE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global state
let currentUser = null;

// ==================== AUTHENTICATION ====================

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'block';
        showToast(`Welcome, ${user.email}!`, 'success');
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-wrapper').style.display = 'none';
    }
});

function toggleAuthMode(mode) {
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('signup-form').style.display = mode === 'signup' ? 'block' : 'none';
    document.getElementById('auth-error').style.display = 'none';
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const fname = document.getElementById('signup-fname').value.trim();
    const lname = document.getElementById('signup-lname').value.trim();
    const purok = document.getElementById('signup-purok').value;

    if (!email || password.length < 6 || !fname || !lname || !purok) {
        showAuthError('Please fill all fields. Password must be 6+ characters.');
        return;
    }

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('profiles').doc(cred.user.uid).set({
            firstName: fname,
            lastName: lname,
            purok: purok,
            email: email,
            role: 'resident',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Account created! Please verify your email.', 'success');
    } catch (error) {
        showAuthError(error.message);
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showAuthError('Please enter email and password.');
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        showAuthError('Invalid email or password.');
    }
}

async function handleLogout() {
    await auth.signOut();
    showToast('Logged out successfully.', 'success');
}

function showAuthError(message) {
    const el = document.getElementById('auth-error');
    el.textContent = message;
    el.style.display = 'block';
}

// ==================== COMPLAINTS ====================

async function submitComplaint() {
    const category = document.getElementById('complaint-category').value;
    const title = document.getElementById('complaint-title').value.trim();
    const description = document.getElementById('complaint-desc').value.trim();
    const purok = document.getElementById('complaint-purok').value;

    if (!category || !title || !description || !purok) {
        showToast('Please fill all required fields.', 'warning');
        return;
    }

    try {
        await db.collection('complaints').add({
            userId: currentUser.uid,
            userName: currentUser.email,
            category,
            title,
            description,
            purok,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Complaint filed successfully!', 'success');
        clearComplaintForm();
    } catch (error) {
        showToast('Failed to submit complaint: ' + error.message, 'danger');
    }
}

function clearComplaintForm() {
    document.getElementById('complaint-category').value = '';
    document.getElementById('complaint-title').value = '';
    document.getElementById('complaint-desc').value = '';
    document.getElementById('complaint-purok').value = '';
}

// ==================== SUMMONS ====================

async function addSummons() {
    const complainantName = document.getElementById('summons-complainant').value.trim();
    const respondentName = document.getElementById('summons-respondent').value.trim();
    const caseTitle = document.getElementById('summons-case').value.trim();
    const date = document.getElementById('summons-date').value;
    const time = document.getElementById('summons-time').value;
    const location = document.getElementById('summons-location').value;

    if (!complainantName || !respondentName || !caseTitle || !date || !time) {
        showToast('Please fill all required fields.', 'warning');
        return;
    }

    try {
        await db.collection('summons').add({
            complainantName,
            respondentName,
            caseTitle,
            date,
            time,
            location,
            status: 'confirmed',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Summons scheduled!', 'success');
        clearSummonsForm();
    } catch (error) {
        showToast('Failed to schedule: ' + error.message, 'danger');
    }
}

function clearSummonsForm() {
    document.getElementById('summons-complainant').value = '';
    document.getElementById('summons-respondent').value = '';
    document.getElementById('summons-case').value = '';
    document.getElementById('summons-date').value = '';
    document.getElementById('summons-time').value = '';
}

// ==================== COURT BOOKINGS ====================

async function bookCourt() {
    const bookerName = document.getElementById('court-booker').value.trim();
    const date = document.getElementById('court-date').value;
    const timeSlot = document.getElementById('court-timeslot').value;
    const activity = document.getElementById('court-activity').value;

    if (!bookerName || !date) {
        showToast('Please enter name and select date.', 'warning');
        return;
    }

    try {
        const existing = await db.collection('courtBookings')
            .where('date', '==', date)
            .where('timeSlot', '==', timeSlot)
            .get();

        if (!existing.empty) {
            showToast('This time slot is already booked.', 'danger');
            return;
        }

        await db.collection('courtBookings').add({
            userId: currentUser.uid,
            bookerName,
            date,
            timeSlot,
            activity,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`Court booked for ${bookerName}!`, 'success');
        clearCourtForm();
    } catch (error) {
        showToast('Booking failed: ' + error.message, 'danger');
    }
}

function clearCourtForm() {
    document.getElementById('court-booker').value = '';
    document.getElementById('court-date').value = '';
}

// ==================== UTILITIES ====================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✅',
        danger: '❌',
        warning: '⚠️'
    };
    
    toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Set default date to today
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) input.value = today;
    });
});

// Make functions globally available
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.toggleAuthMode = toggleAuthMode;
window.submitComplaint = submitComplaint;
window.clearComplaintForm = clearComplaintForm;
window.addSummons = addSummons;
window.clearSummonsForm = clearSummonsForm;
window.bookCourt = bookCourt;
window.clearCourtForm = clearCourtForm;

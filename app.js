// app.js - Firebase v9+ Modular SDK

// 🔥 Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    serverTimestamp,
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 🔑 Your Firebase Configuration
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state
let currentUser = null;
let userRole = 'resident';

// ==================== AUTHENTICATION ====================

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserProfile();
        showApp();
    } else {
        currentUser = null;
        showAuth();
    }
});

function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-wrapper').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'block';
}

function toggleAuthMode(mode) {
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('signup-form').style.display = mode === 'signup' ? 'block' : 'none';
    document.getElementById('auth-error').style.display = 'none';
}

// Sign Up
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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update display name
        await updateProfile(user, { displayName: `${fname} ${lname}` });

        // Create profile in Firestore
        await setDoc(doc(db, "profiles", user.uid), {
            firstName: fname,
            lastName: lname,
            purok: purok,
            email: email,
            role: 'resident',
            createdAt: serverTimestamp()
        });

        showToast('Account created! Please verify your email.', 'success');
    } catch (error) {
        showAuthError(getErrorMessage(error.code));
    }
}

// Login
async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showAuthError('Please enter email and password.');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAuthError(getErrorMessage(error.code));
    }
}

// Logout
async function handleLogout() {
    try {
        await signOut(auth);
        showToast('Logged out successfully.', 'success');
    } catch (error) {
        showToast('Logout failed: ' + error.message, 'danger');
    }
}

// Load user profile from Firestore
async function loadUserProfile() {
    if (!currentUser) return;
    
    try {
        const docRef = doc(db, "profiles", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            userRole = data.role || 'resident';
            
            // Update UI
            const userNameEl = document.getElementById('user-name');
            const userRoleEl = document.getElementById('user-role');
            const userAvatarEl = document.getElementById('user-avatar');
            
            if (userNameEl) userNameEl.textContent = `${data.firstName} ${data.lastName}`;
            if (userRoleEl) userRoleEl.textContent = data.role === 'admin' ? 'Barangay Admin' : 'Resident';
            if (userAvatarEl) userAvatarEl.textContent = `${data.firstName[0]}${data.lastName[0]}`;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function showAuthError(message) {
    const el = document.getElementById('auth-error');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

function getErrorMessage(code) {
    const errors = {
        'auth/invalid-email': 'Invalid email address.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'Email already registered.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/operation-not-allowed': 'This operation is not allowed.',
        'auth/network-request-failed': 'Network error. Please check your connection.'
    };
    return errors[code] || 'Authentication error. Please try again.';
}

// ==================== COMPLAINTS ====================

async function submitComplaint() {
    const category = document.getElementById('complaint-category')?.value;
    const title = document.getElementById('complaint-title')?.value.trim();
    const description = document.getElementById('complaint-desc')?.value.trim();
    const purok = document.getElementById('complaint-purok')?.value;

    if (!category || !title || !description || !purok) {
        showToast('Please fill all required fields.', 'warning');
        return;
    }

    try {
        await addDoc(collection(db, "complaints"), {
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            category,
            title,
            description,
            purok,
            status: 'pending',
            createdAt: serverTimestamp()
        });

        showToast('Complaint filed successfully!', 'success');
        clearComplaintForm();
        
        // Refresh complaints list if on complaints page
        if (document.getElementById('complaint-list')) {
            renderComplaints();
        }
    } catch (error) {
        showToast('Failed to submit: ' + error.message, 'danger');
    }
}

function clearComplaintForm() {
    const fields = ['complaint-category', 'complaint-title', 'complaint-desc', 'complaint-purok'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

async function renderComplaints(filter = 'all') {
    const container = document.getElementById('complaint-list');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading complaints...</p>';

    try {
        let q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
        
        if (filter !== 'all') {
            q = query(q, where("status", "==", filter));
        }

        const snapshot = await getDocs(q);
        const complaints = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (complaints.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">No complaints found.</p>';
            return;
        }

        container.innerHTML = complaints.map(c => `
            <div class="complaint-item">
                <div class="complaint-header">
                    <span class="complaint-category cat-${c.category || 'other'}">
                        ${getCategoryLabel(c.category)}
                    </span>
                    <span class="status-badge status-${c.status || 'pending'}">
                        <span class="status-dot"></span> ${getStatusLabel(c.status)}
                    </span>
                </div>
                <div class="complaint-title">${escapeHtml(c.title)}</div>
                <div class="complaint-desc">${escapeHtml(c.description)}</div>
                <div class="complaint-meta">
                    <span>👤 ${escapeHtml(c.userName || 'Unknown')}</span>
                    <span>📍 ${escapeHtml(c.purok)}</span>
                    <span>🕐 ${c.createdAt ? formatDate(c.createdAt) : 'N/A'}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger); padding:20px;">Error: ${error.message}</p>`;
    }
}

function filterComplaints(filter, btn) {
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    renderComplaints(filter);
}

// ==================== SUMMONS ====================

async function addSummons() {
    const complainantName = document.getElementById('summons-complainant')?.value.trim();
    const respondentName = document.getElementById('summons-respondent')?.value.trim();
    const caseTitle = document.getElementById('summons-case')?.value.trim();
    const date = document.getElementById('summons-date')?.value;
    const time = document.getElementById('summons-time')?.value;
    const location = document.getElementById('summons-location')?.value;

    if (!complainantName || !respondentName || !caseTitle || !date || !time) {
        showToast('Please fill all required fields.', 'warning');
        return;
    }

    try {
        await addDoc(collection(db, "summons"), {
            complainantName,
            respondentName,
            caseTitle,
            date,
            time,
            location,
            status: 'confirmed',
            createdAt: serverTimestamp()
        });

        showToast('Summons scheduled!', 'success');
        clearSummonsForm();
        
        if (document.getElementById('summons-list')) {
            renderSummons();
        }
    } catch (error) {
        showToast('Failed: ' + error.message, 'danger');
    }
}

function clearSummonsForm() {
    const fields = ['summons-complainant', 'summons-respondent', 'summons-case', 'summons-date', 'summons-time'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

async function renderSummons() {
    const container = document.getElementById('summons-list');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading...</p>';

    try {
        const q = query(collection(db, "summons"), orderBy("date", "asc"));
        const snapshot = await getDocs(q);
        const summons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (summons.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">No scheduled summons.</p>';
            return;
        }

        container.innerHTML = summons.map(s => `
            <div class="summons-card">
                <div class="summons-info">
                    <h4>${escapeHtml(s.caseTitle)}</h4>
                    <p>Complainant: ${escapeHtml(s.complainantName)} | Respondent: ${escapeHtml(s.respondentName)}</p>
                    <p>📍 ${escapeHtml(s.location)}</p>
                </div>
                <div class="summons-date">
                    <div class="date">${s.date ? new Date(s.date).toLocaleDateString() : 'N/A'}</div>
                    <div class="time">${escapeHtml(s.time)}</div>
                    <span class="status-badge status-confirmed">
                        <span class="status-dot"></span> Confirmed
                    </span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger);">Error: ${error.message}</p>`;
    }
}

// ==================== COURT BOOKINGS ====================

const TIME_SLOTS = [
    '6:00 AM - 7:00 AM', '7:00 AM - 8:00 AM', '8:00 AM - 9:00 AM',
    '9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM',
    '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM', '6:00 PM - 7:00 PM'
];

async function bookCourt() {
    const bookerName = document.getElementById('court-booker')?.value.trim();
    const date = document.getElementById('court-date')?.value;
    const timeSlot = document.getElementById('court-timeslot')?.value;
    const activity = document.getElementById('court-activity')?.value;

    if (!bookerName || !date) {
        showToast('Please enter name and select date.', 'warning');
        return;
    }

    try {
        // Check if slot is already booked
        const q = query(
            collection(db, "courtBookings"),
            where("date", "==", date),
            where("timeSlot", "==", timeSlot)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            showToast('This time slot is already booked.', 'danger');
            return;
        }

        await addDoc(collection(db, "courtBookings"), {
            userId: currentUser.uid,
            bookerName,
            date,
            timeSlot,
            activity,
            createdAt: serverTimestamp()
        });

        showToast(`Court booked for ${bookerName}!`, 'success');
        clearCourtForm();
        
        if (document.getElementById('court-schedule')) {
            renderCourt(date);
        }
    } catch (error) {
        showToast('Booking failed: ' + error.message, 'danger');
    }
}

function clearCourtForm() {
    const fields = ['court-booker', 'court-date'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

async function renderCourt(selectedDate) {
    const container = document.getElementById('court-schedule');
    if (!container) return;
    
    const date = selectedDate || new Date().toISOString().split('T')[0];
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d; grid-column:1/-1;">Loading...</p>';

    try {
        const q = query(
            collection(db, "courtBookings"),
            where("date", "==", date)
        );
        const snapshot = await getDocs(q);
        const bookings = snapshot.docs.map(doc => doc.data());
        const bookedMap = new Map(bookings.map(b => [b.timeSlot, b]));

        container.innerHTML = TIME_SLOTS.map(slot => {
            const booking = bookedMap.get(slot);
            const isBooked = !!booking;
            return `
                <div class="schedule-slot ${isBooked ? 'booked' : 'available'}">
                    <div class="schedule-time">${slot}</div>
                    <div class="schedule-status">${isBooked ? 'Booked' : 'Available'}</div>
                    ${isBooked ? `
                        <div class="schedule-booker">
                            ${escapeHtml(booking.bookerName)}<br>
                            ${escapeHtml(booking.activity)}
                        </div>
                    ` : '<div class="schedule-booker">Click to book</div>'}
                </div>
            `;
        }).join('');

        const dateTitle = document.getElementById('court-date-title');
        if (dateTitle) {
            dateTitle.textContent = `Schedule for ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
        }
    } catch (error) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger);">Error: ${error.message}</p>`;
    }
}

function filterCourt(period, btn) {
    document.querySelectorAll('#page-court .filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    let date = new Date().toISOString().split('T')[0];
    if (period === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().split('T')[0];
    }
    
    renderCourt(date);
}

// ==================== UTILITIES ====================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
}

function getCategoryLabel(category) {
    const labels = {
        roadwork: '🚧 Roadwork',
        lightpost: '💡 Lightpost',
        drainage: '🔧 Drainage',
        noise: '📢 Noise',
        garbage: '🗑️ Garbage',
        other: '📌 Other'
    };
    return labels[category] || '📌 Other';
}

function getStatusLabel(status) {
    const labels = {
        pending: 'Pending',
        progress: 'In Progress',
        resolved: 'Resolved',
        confirmed: 'Confirmed'
    };
    return labels[status] || 'Pending';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        alert(`${type.toUpperCase()}: ${message}`);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = { success: '✅', danger: '❌', warning: '⚠️' };
    toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// ==================== INITIALIZATION ====================

// Set default dates and initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date for date inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.value = today;
    });

    // Make functions globally available for onclick handlers
    window.handleLogin = handleLogin;
    window.handleSignup = handleSignup;
    window.handleLogout = handleLogout;
    window.toggleAuthMode = toggleAuthMode;
    window.submitComplaint = submitComplaint;
    window.clearComplaintForm = clearComplaintForm;
    window.filterComplaints = filterComplaints;
    window.renderComplaints = renderComplaints;
    window.addSummons = addSummons;
    window.clearSummonsForm = clearSummonsForm;
    window.renderSummons = renderSummons;
    window.bookCourt = bookCourt;
    window.clearCourtForm = clearCourtForm;
    window.renderCourt = renderCourt;
    window.filterCourt = filterCourt;
});

// Export for module usage (optional)
export { auth, db };

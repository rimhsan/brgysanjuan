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
let userRole = 'resident';
let mapInstance = null;

// Category & Status configs
const categoryConfig = {
    roadwork: { label: '🚧 Roadwork', class: 'cat-roadwork' },
    lightpost: { label: '💡 Lightpost', class: 'cat-lightpost' },
    drainage: { label: '🔧 Drainage', class: 'cat-drainage' },
    noise: { label: '📢 Noise', class: 'cat-noise' },
    garbage: { label: '🗑️ Garbage', class: 'cat-garbage' },
    other: { label: '📌 Other', class: 'cat-other' }
};

const statusConfig = {
    pending: { label: 'Pending', class: 'status-pending' },
    progress: { label: 'In Progress', class: 'status-progress' },
    resolved: { label: 'Resolved', class: 'status-resolved' },
    confirmed: { label: 'Confirmed', class: 'status-confirmed' }
};

const TIME_SLOTS = [
    '6:00 AM - 7:00 AM', '7:00 AM - 8:00 AM', '8:00 AM - 9:00 AM',
    '9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM',
    '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM', '6:00 PM - 7:00 PM'
];

// ==================== AUTHENTICATION ====================

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserProfile();
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'block';
        initializeApp();
    } else {
        currentUser = null;
        document.getElementById('auth-overlay').style.display = 'flex';
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
            firstName: fname, lastName: lname, purok, email,
            role: 'resident', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Account created! Please verify your email.', 'success');
    } catch (error) {
        showAuthError(error.message);
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showAuthError('Please enter email and password.'); return; }
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

async function loadUserProfile() {
    const doc = await db.collection('profiles').doc(currentUser.uid).get();
    if (doc.exists) {
        const data = doc.data();
        document.getElementById('user-name').textContent = `${data.firstName} ${data.lastName}`;
        document.getElementById('user-role').textContent = data.role === 'admin' ? 'Barangay Admin' : 'Resident';
        document.getElementById('user-avatar').textContent = `${data.firstName[0]}${data.lastName[0]}`;
        userRole = data.role;
        // Show admin buttons
        if (userRole === 'admin') {
            document.getElementById('schedule-summons-btn').style.display = 'block';
        }
    }
}

// ==================== NAVIGATION ====================

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    const navLink = document.querySelector(`.sidebar-nav a[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    if (page === 'map') setTimeout(initMap, 100);
}

document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(link.dataset.page); });
});

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ==================== MODALS ====================

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay.id); });
});

// ==================== COMPLAINTS ====================

async function fetchComplaints() {
    const snapshot = await db.collection('complaints').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function renderComplaints(filter = 'all', elementId = 'complaintList') {
    const container = document.getElementById(elementId);
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading...</p>';
    const complaints = await fetchComplaints();
    const filtered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">No complaints found.</p>';
        return;
    }
    container.innerHTML = filtered.map(c => `
        <div class="complaint-item">
            <div class="complaint-header">
                <span class="complaint-category ${categoryConfig[c.category]?.class || 'cat-other'}">
                    ${categoryConfig[c.category]?.label || '📌 Other'}
                </span>
                <span class="status-badge ${statusConfig[c.status]?.class || 'status-pending'}">
                    <span class="status-dot"></span> ${statusConfig[c.status]?.label || 'Pending'}
                </span>
            </div>
            <div class="complaint-title">${escapeHtml(c.title)}</div>
            <div class="complaint-desc">${escapeHtml(c.description)}</div>
            <div class="complaint-meta">
                <span>👤 ${escapeHtml(c.userName || 'Unknown')}</span>
                <span>📍 ${escapeHtml(c.purok)}</span>
                <span>🕐 ${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                ${userRole === 'admin' ? `<button class="btn btn-sm btn-success" onclick="updateComplaintStatus('${c.id}', 'resolved')">✅ Mark Resolved</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function submitComplaint() {
    const category = document.getElementById('complaint-category').value;
    const title = document.getElementById('complaint-title').value.trim();
    const description = document.getElementById('complaint-desc').value.trim();
    const purok = document.getElementById('complaint-purok').value;
    if (!category || !title || !description || !purok) { showToast('Please fill all required fields.', 'warning'); return; }
    try {
        await db.collection('complaints').add({
            userId: currentUser.uid, userName: currentUser.email, category, title, description, purok,
            status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('complaintModal'); showToast('Complaint filed successfully!', 'success');
        renderComplaints(); updateStats();
        document.getElementById('complaint-category').value = '';
        document.getElementById('complaint-title').value = '';
        document.getElementById('complaint-desc').value = '';
        document.getElementById('complaint-purok').value = '';
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

async function updateComplaintStatus(id, status) {
    if (userRole !== 'admin') { showToast('Only admins can update status.', 'warning'); return; }
    try {
        await db.collection('complaints').doc(id).update({ status });
        showToast(`Complaint marked as ${status}`, 'success'); renderComplaints(); updateStats();
    } catch (error) { showToast('Update failed: ' + error.message, 'danger'); }
}

function filterComplaints(filter, btn) {
    document.querySelectorAll('#page-complaints .filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active'); renderComplaints(filter);
}

// ==================== RESIDENTS ====================

async function fetchResidents() {
    const snapshot = await db.collection('profiles').orderBy('lastName').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function renderResidents() {
    const container = document.getElementById('residentGrid');
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d; grid-column:1/-1;">Loading...</p>';
    const residents = await fetchResidents();
    container.innerHTML = residents.map(r => `
        <div class="resident-card">
            <div class="resident-avatar" style="background:${stringToColor(r.firstName + r.lastName)}">
                ${r.firstName[0]}${r.lastName[0]}
            </div>
            <div class="resident-name">${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</div>
            <div class="resident-address">${escapeHtml(r.purok)} • ${escapeHtml(r.phone || 'N/A')}</div>
            <div class="resident-info">
                <div><div class="label">Role</div><div class="value">${r.role}</div></div>
                <div><div class="label">Joined</div><div class="value">${r.createdAt ? new Date(r.createdAt.toDate()).toLocaleDateString() : 'N/A'}</div></div>
            </div>
        </div>
    `).join('');
}

// ==================== SUMMONS ====================

async function fetchSummons() {
    const snapshot = await db.collection('summons').orderBy('date', 'asc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function renderSummons() {
    const container = document.getElementById('summonsList');
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading...</p>';
    const summons = await fetchSummons();
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
                <div class="date">${s.date ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
                <div class="time">${escapeHtml(s.time)}</div>
                <span class="status-badge status-confirmed" style="margin-top:8px;"><span class="status-dot"></span> Confirmed</span>
            </div>
        </div>
    `).join('');
}

async function addSummons() {
    const complainantName = document.getElementById('summons-complainant').value.trim();
    const respondentName = document.getElementById('summons-respondent').value.trim();
    const caseTitle = document.getElementById('summons-case').value.trim();
    const date = document.getElementById('summons-date').value;
    const time = document.getElementById('summons-time').value;
    const location = document.getElementById('summons-location').value;
    if (!complainantName || !respondentName || !caseTitle || !date || !time) { showToast('Please fill all required fields.', 'warning'); return; }
    try {
        await db.collection('summons').add({
            complainantName, respondentName, caseTitle, date, time, location,
            status: 'confirmed', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('summonsModal'); showToast('Summons scheduled!', 'success'); renderSummons(); updateStats();
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

// ==================== COURT BOOKINGS ====================

async function fetchCourtBookings(date) {
    const snapshot = await db.collection('courtBookings').where('date', '==', date).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function renderCourt(selectedDate = new Date().toISOString().split('T')[0]) {
    const container = document.getElementById('courtSchedule');
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d; grid-column:1/-1;">Loading...</p>';
    const bookings = await fetchCourtBookings(selectedDate);
    const bookedMap = new Map(bookings.map(b => [b.timeSlot, b]));
    container.innerHTML = TIME_SLOTS.map(slot => {
        const booking = bookedMap.get(slot);
        const isBooked = !!booking;
        return `
            <div class="schedule-slot ${isBooked ? 'booked' : 'available'}">
                <div class="schedule-time">${slot}</div>
                <div class="schedule-status">${isBooked ? 'Booked' : 'Available'}</div>
                ${isBooked ? `<div class="schedule-booker">${escapeHtml(booking.bookerName)}<br>${escapeHtml(booking.activity)}</div>` : '<div class="schedule-booker">Click to book</div>'}
            </div>
        `;
    }).join('');
    document.getElementById('courtDateTitle').textContent = `Schedule for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
}

async function bookCourt() {
    const bookerName = document.getElementById('court-booker').value.trim();
    const date = document.getElementById('court-date').value;
    const timeSlot = document.getElementById('court-timeslot').value;
    const activity = document.getElementById('court-activity').value;
    if (!bookerName || !date) { showToast('Please enter name and select date.', 'warning'); return; }
    try {
        const existing = await db.collection('courtBookings').where('date', '==', date).where('timeSlot', '==', timeSlot).get();
        if (!existing.empty) { showToast('This time slot is already booked.', 'danger'); return; }
        await db.collection('courtBookings').add({
            userId: currentUser.uid, bookerName, date, timeSlot, activity,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('courtModal'); showToast(`Court booked for ${bookerName}!`, 'success'); renderCourt(date); updateStats();
    } catch (error) { showToast('Booking failed: ' + error.message, 'danger'); }
}

function filterCourt(period, btn) {
    document.querySelectorAll('#page-court .filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    let date = new Date().toISOString().split('T')[0];
    if (period === 'tomorrow') { const t = new Date(); t.setDate(t.getDate() + 1); date = t.toISOString().split('T')[0]; }
    renderCourt(date);
}

// ==================== DASHBOARD & STATS ====================

async function updateStats() {
    try {
        const complaintsSnap = await db.collection('complaints').where('status', '!=', 'resolved').get();
        const residentsSnap = await db.collection('profiles').get();
        const summonsSnap = await db.collection('summons').where('status', '==', 'confirmed').get();
        const today = new Date().toISOString().split('T')[0];
        const courtSnap = await db.collection('courtBookings').where('date', '==', today).get();
        document.getElementById('stat-complaints').textContent = complaintsSnap.size;
        document.getElementById('stat-residents').textContent = residentsSnap.size;
        document.getElementById('stat-summons').textContent = summonsSnap.size;
        document.getElementById('stat-court').textContent = courtSnap.size;
    } catch (error) { console.error('Stats error:', error); }
}

async function loadRecentComplaints() {
    const container = document.getElementById('recent-complaints');
    const snapshot = await db.collection('complaints').orderBy('createdAt', 'desc').limit(3).get();
    if (snapshot.empty) { container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:20px;">No recent complaints.</p>'; return; }
    container.innerHTML = snapshot.docs.map(doc => {
        const c = doc.data();
        return `
            <div class="complaint-item" style="padding:14px;">
                <div class="complaint-header">
                    <span class="complaint-category ${categoryConfig[c.category]?.class || 'cat-other'}">
                        ${categoryConfig[c.category]?.label || '📌 Other'}
                    </span>
                </div>
                <div class="complaint-title">${escapeHtml(c.title)}</div>
                <div class="complaint-meta">
                    <span>🕐 ${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function loadActivityTimeline() {
    const container = document.getElementById('activity-timeline');
    const activities = [];
    const complaintsSnap = await db.collection('complaints').orderBy('createdAt', 'desc').limit(5).get();
    complaintsSnap.forEach(doc => {
        const data = doc.data();
        activities.push({ time: data.createdAt ? data.createdAt.toDate() : new Date(), event: `New complaint: ${data.title}` });
    });
    const courtSnap = await db.collection('courtBookings').orderBy('createdAt', 'desc').limit(3).get();
    courtSnap.forEach(doc => {
        const data = doc.data();
        activities.push({ time: data.createdAt ? data.createdAt.toDate() : new Date(), event: `Court booked by ${data.bookerName}` });
    });
    activities.sort((a, b) => b.time - a.time);
    const recent = activities.slice(0, 6);
    if (recent.length === 0) { container.innerHTML = '<p style="text-align:center; color:#7f8c8d;">No recent activity.</p>'; return; }
    container.innerHTML = recent.map(a => `
        <div class="timeline-item">
            <div class="time">${a.time.toLocaleString()}</div>
            <div class="event">${escapeHtml(a.event)}</div>
        </div>
    `).join('');
}

// ==================== MAP ====================

function initMap() {
    if (mapInstance) { mapInstance.invalidateSize(); return; }
    mapInstance = L.map('map').setView([13.4150, 123.4300], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(mapInstance);
    L.marker([13.4150, 123.4300]).addTo(mapInstance).bindPopup('<b>🏛️ Barangay San Juan Hall</b><br>Iriga City, Camarines Sur').openPopup();
    const markers = [
        { lat: 13.4165, lng: 123.4280, icon: '🚧', label: 'Roadwork - Rizal St' },
        { lat: 13.4135, lng: 123.4320, icon: '💡', label: 'Lightpost - Purok 3' },
        { lat: 13.4170, lng: 123.4250, icon: '🔧', label: 'Drainage - Purok 2' }
    ];
    markers.forEach(m => {
        const icon = L.divIcon({ html: `<div style="font-size:24px;">${m.icon}</div>`, className: '', iconSize: [30,30], iconAnchor: [15,15] });
        L.marker([m.lat, m.lng], { icon }).addTo(mapInstance).bindPopup(`<b>${m.label}</b>`);
    });
}

// ==================== UTILITIES ====================

function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function stringToColor(str) { let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash); const c = (hash & 0x00ffffff).toString(16).toUpperCase(); return '#' + '00000'.substring(0, 6 - c.length) + c; }
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', danger: '❌', warning: '⚠️' };
    toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ==================== INITIALIZATION ====================

async function initializeApp() {
    await updateStats();
    await renderComplaints('all', 'complaintList');
    await loadRecentComplaints();
    await loadActivityTimeline();
    await renderResidents();
    await renderSummons();
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => { if (!input.value) input.value = today; });
}

// Global search
document.getElementById('globalSearch')?.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase();
    if (query.length < 2) return;
    // Could add real search logic here
});

// Make functions globally available for onclick handlers
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.toggleAuthMode = toggleAuthMode;
window.navigateTo = navigateTo;
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitComplaint = submitComplaint;
window.filterComplaints = filterComplaints;
window.updateComplaintStatus = updateComplaintStatus;
window.addSummons = addSummons;
window.bookCourt = bookCourt;
window.filterCourt = filterCourt;

// Account Dropdown Toggle
let accountDropdownOpen = false;

function toggleAccountDropdown() {
    const dropdown = document.getElementById('accountDropdown');
    accountDropdownOpen = !accountDropdownOpen;
    
    if (accountDropdownOpen) {
        dropdown.classList.add('show');
        updateDropdownInfo();
    } else {
        dropdown.classList.remove('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.getElementById('accountDropdown');
    
    if (accountDropdownOpen && !userProfile.contains(e.target) && !dropdown.contains(e.target)) {
        toggleAccountDropdown();
    }
});

// Add click event to user profile
document.querySelector('.user-profile').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleAccountDropdown();
});

// Update dropdown info
function updateDropdownInfo() {
    if (currentUser) {
        document.getElementById('dropdown-name').textContent = 
            `${currentUser.displayName || currentUser.email.split('@')[0]}`;
        document.getElementById('dropdown-email').textContent = currentUser.email;
        
        const initials = (currentUser.displayName || currentUser.email).split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('dropdown-avatar').textContent = initials;
    }
}

// Open Account Page/Modal
function openAccountPage() {
    toggleAccountDropdown();
    openAccountModal();
}

function openAccountSettings() {
    toggleAccountDropdown();
    openAccountModal();
    switchTab('security');
}

function openAccountModal() {
    loadAccountData();
    document.getElementById('accountModal').classList.add('show');
}

function closeAccountModal() {
    document.getElementById('accountModal').classList.remove('show');
}

// Load account data
async function loadAccountData() {
    if (!currentUser) return;
    
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            // Update profile picture/initials
            const initials = `${data.firstName[0]}${data.lastName[0]}`.toUpperCase();
            document.getElementById('profile-picture-large').textContent = initials;
            document.getElementById('profile-picture-large').style.background = stringToColor(data.firstName + data.lastName);
            
            // Fill form fields
            document.getElementById('edit-first-name').value = data.firstName || '';
            document.getElementById('edit-last-name').value = data.lastName || '';
            document.getElementById('edit-email').value = data.email || currentUser.email;
            document.getElementById('edit-purok').value = data.purok || '';
            document.getElementById('edit-phone').value = data.phone || '';
            
            // Load notification settings
            document.getElementById('email-notifications').checked = data.emailNotifications !== false;
            document.getElementById('complaint-notifications').checked = data.complaintNotifications !== false;
            document.getElementById('summons-notifications').checked = data.summonsNotifications !== false;
        }
    } catch (error) {
        console.error('Error loading account data:', error);
    }
}

// Tab switching
function switchTab(tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.account-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.account-tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Update profile picture
function updateProfilePicture(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // For now, we'll just update the initials display
    // In production, you'd upload to Firebase Storage
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('profile-picture-large').style.backgroundImage = `url(${e.target.result})`;
        document.getElementById('profile-picture-large').style.backgroundSize = 'cover';
        document.getElementById('profile-picture-large').textContent = '';
    };
    reader.readAsDataURL(file);
    
    showToast('Profile picture updated!', 'success');
}

// Save profile changes
async function saveProfileChanges() {
    const firstName = document.getElementById('edit-first-name').value.trim();
    const lastName = document.getElementById('edit-last-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const purok = document.getElementById('edit-purok').value;
    const phone = document.getElementById('edit-phone').value.trim();
    
    if (!firstName || !lastName || !email) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }
    
    try {
        await db.collection('profiles').doc(currentUser.uid).update({
            firstName,
            lastName,
            email,
            purok,
            phone,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update email in Firebase Auth if changed
        if (email !== currentUser.email) {
            await currentUser.updateEmail(email);
        }
        
        // Update display name
        await currentUser.updateProfile({
            displayName: `${firstName} ${lastName}`
        });
        
        // Update UI
        document.getElementById('user-name').textContent = `${firstName} ${lastName}`;
        
        showToast('Profile updated successfully!', 'success');
        closeAccountModal();
    } catch (error) {
        showToast('Failed to update profile: ' + error.message, 'danger');
    }
}

// Change password
async function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all password fields.', 'warning');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters.', 'warning');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match.', 'danger');
        return;
    }
    
    try {
        // Re-authenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        await currentUser.reauthenticateWithCredential(credential);
        
        // Update password
        await currentUser.updatePassword(newPassword);
        
        // Clear fields
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        
        showToast('Password updated successfully!', 'success');
    } catch (error) {
        showToast('Failed to update password: ' + error.message, 'danger');
    }
}

// Save notification settings
async function saveNotificationSettings() {
    try {
        await db.collection('profiles').doc(currentUser.uid).update({
            emailNotifications: document.getElementById('email-notifications').checked,
            complaintNotifications: document.getElementById('complaint-notifications').checked,
            summonsNotifications: document.getElementById('summons-notifications').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Notification preferences saved!', 'success');
    } catch (error) {
        showToast('Failed to save settings: ' + error.message, 'danger');
    }
}

// View my complaints
function viewMyComplaints() {
    toggleAccountDropdown();
    navigateTo('complaints');
    // Could filter to show only user's complaints
    showToast('Showing your complaints', 'success');
}

// Make functions globally available
window.toggleAccountDropdown = toggleAccountDropdown;
window.openAccountPage = openAccountPage;
window.openAccountSettings = openAccountSettings;
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.switchTab = switchTab;
window.updateProfilePicture = updateProfilePicture;
window.saveProfileChanges = saveProfileChanges;
window.changePassword = changePassword;
window.saveNotificationSettings = saveNotificationSettings;
window.viewMyComplaints = viewMyComplaints;

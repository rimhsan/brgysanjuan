// 🔑 FIREBASE CONFIGURATION - CHECK THIS!
const firebaseConfig = {
    apiKey: "AIzaSyCUn_OVro6-NBfIAn0SAcGZeV25HqiCvlc", // <-- Ensure this matches your console
    authDomain: "barangay-san-juan.firebaseapp.com",
    projectId: "barangay-san-juan",
    storageBucket: "barangay-san-juan.firebasestorage.app",
    messagingSenderId: "987977241267",
    appId: "1:987977241267:web:4685a282641fce2ccad6c6",
    measurementId: "G-5XWG6ET1CE"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase Init Error:", e);
    alert("Firebase Configuration Error. Check console.");
}

const auth = firebase.auth();
const db = firebase.firestore();

// Global state
let currentUser = null;
let userRole = 'resident';
let mapInstance = null;
let accountDropdownOpen = false;

// Detect current page
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// Constants
const TIME_SLOTS = [
    '6:00 AM - 7:00 AM', '7:00 AM - 8:00 AM', '8:00 AM - 9:00 AM',
    '9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM',
    '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM', '6:00 PM - 7:00 PM'
];

const categoryConfig = {
    roadwork: { label: '🚧 Roadwork', class: 'cat-roadwork' },
    lightpost: { label: '💡 Lightpost', class: 'cat-lightpost' },
    drainage: { label: '🔧 Drainage', class: 'cat-drainage' },
    noise: { label: '📢 Noise', class: 'cat-noise' },
    garbage: { label: '🗑️ Garbage', class: 'cat-garbage' },
    other: { label: '📌 Other', class: 'cat-other' },
    general: { label: '📢 General', class: 'cat-general' }
};

// ==================== AUTHENTICATION (CRITICAL FIX) ====================
auth.onAuthStateChanged(async (user) => {
    const isLoginPage = currentPage === 'login.html';
    const authOverlay = document.getElementById('auth-overlay');
    const appWrapper = document.getElementById('app-wrapper');

    if (user) {
        currentUser = user;
        
        // If logged in but on login page, redirect to dashboard
        if (isLoginPage) {
            window.location.href = 'index.html';
            return;
        }

        try {
            await loadUserProfile();
            
            // Hide Auth, Show App
            if (authOverlay) authOverlay.style.display = 'none';
            if (appWrapper) appWrapper.style.display = 'block';
            
            // Initialize Page Data
            initializeApp();
        } catch (error) {
            console.error("Init Error:", error);
            // Even if init fails, show the app so user isn't stuck on loading
            if (authOverlay) authOverlay.style.display = 'none';
            if (appWrapper) appWrapper.style.display = 'block';
        }
    } else {
        currentUser = null;
        
        // If NOT logged in and NOT on login page, redirect to login
        if (!isLoginPage) {
            window.location.href = 'login.html';
            return;
        }
        
        // Show Auth Overlay if on login page
        if (authOverlay) authOverlay.style.display = 'flex';
        if (appWrapper) appWrapper.style.display = 'none';
    }
});

async function loadUserProfile() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            userRole = data.role || 'resident';
            
            // Update UI Elements safely
            const setName = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            setName('user-name', `${data.firstName} ${data.lastName}`);
            setName('user-role', data.role === 'admin' ? 'Barangay Admin' : 'Resident');
            setName('dropdown-name', `${data.firstName} ${data.lastName}`);
            setName('dropdown-email', data.email);
            
            const initials = `${data.firstName[0]}${data.lastName[0]}`.toUpperCase();
            setName('user-avatar', initials);
            setName('dropdown-avatar', initials);
            
            // Show Admin Buttons if applicable
            if (userRole === 'admin') {
                const showBtn = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'inline-flex'; };
                showBtn('schedule-summons-btn');
                showBtn('add-announcement-btn');
                showBtn('admin-court-btn');
            }
        }
    } catch (error) {
        console.error("Profile Load Error:", error);
    }
}

// ==================== PAGE INITIALIZATION ====================
async function initializeApp() {
    // Only run functions relevant to the current page to prevent errors
    
    if (currentPage === 'index.html' || currentPage === '') {
        await updateStats();
        await loadRecentComplaints();
        await loadActivityTimeline();
    }
    
    if (currentPage === 'complaints.html') {
        await renderComplaints('all', 'complaintList');
    }
    
    if (currentPage === 'residents.html') {
        await renderResidents();
    }
    
    if (currentPage === 'summons.html') {
        await renderSummons();
    }
    
    if (currentPage === 'court.html') {
        // TRUE forces it to reset to TODAY'S date locally
        await initCalendar(true);
    }
    
    if (currentPage === 'map.html') {
        setTimeout(initMap, 500); // Delay slightly to ensure container exists
    }
    
    if (currentPage === 'announcements.html') {
        await loadAnnouncements();
    }
}

// ==================== NAVIGATION & UI HELPERS ====================
function toggleSidebar() { 
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open'); 
}

function openModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show'); 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show'); 
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) { 
    if (!text) return ''; 
    const div = document.createElement('div'); 
    div.textContent = text; 
    return div.innerHTML; 
}

// ==================== ACCOUNT DROPDOWN ====================
function toggleAccountDropdown() {
    const dropdown = document.getElementById('accountDropdown');
    if (!dropdown) return;
    accountDropdownOpen = !accountDropdownOpen;
    dropdown.classList.toggle('show', accountDropdownOpen);
}

document.addEventListener('click', (e) => {
    if (!accountDropdownOpen) return;
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.getElementById('accountDropdown');
    if (userProfile && dropdown && !userProfile.contains(e.target) && !dropdown.contains(e.target)) {
        toggleAccountDropdown();
    }
});

function openAccountModal() { 
    toggleAccountDropdown(); 
    loadAccountData(); 
    openModal('accountModal'); 
}

function closeAccountModal() { closeModal('accountModal'); }
function openAccountSettings() { toggleAccountDropdown(); openAccountModal(); switchTab('security'); }

async function loadAccountData() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
            setVal('edit-first-name', data.firstName);
            setVal('edit-last-name', data.lastName);
            setVal('edit-email', data.email);
            setVal('edit-purok', data.purok);
            setVal('edit-phone', data.phone);
            
            const setCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val !== false; };
            setCheck('email-notifications', data.emailNotifications);
            setCheck('complaint-notifications', data.complaintNotifications);
            setCheck('summons-notifications', data.summonsNotifications);
        }
    } catch (error) { console.error(error); }
}

function switchTab(tabName) {
    document.querySelectorAll('.account-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.account-tab-content').forEach(c => c.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    const content = document.getElementById(`${tabName}-tab`);
    if(content) content.classList.add('active');
}

async function saveProfileChanges() {
    const firstName = document.getElementById('edit-first-name')?.value.trim();
    const lastName = document.getElementById('edit-last-name')?.value.trim();
    const email = document.getElementById('edit-email')?.value.trim();
    const purok = document.getElementById('edit-purok')?.value;
    const phone = document.getElementById('edit-phone')?.value.trim();
    
    if (!firstName || !lastName || !email) { showToast('Fill required fields.', 'warning'); return; }
    
    try {
        await db.collection('profiles').doc(currentUser.uid).update({ firstName, lastName, email, purok, phone });
        if (email !== currentUser.email) await currentUser.updateEmail(email);
        await currentUser.updateProfile({ displayName: `${firstName} ${lastName}` });
        showToast('Profile updated!', 'success');
        closeAccountModal();
        loadUserProfile(); // Refresh topbar
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

async function changePassword() {
    const current = document.getElementById('current-password')?.value;
    const newPass = document.getElementById('new-password')?.value;
    const confirm = document.getElementById('confirm-password')?.value;
    
    if (!current || !newPass || !confirm) { showToast('Fill all fields.', 'warning'); return; }
    if (newPass !== confirm) { showToast('Passwords mismatch.', 'danger'); return; }
    
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, current);
        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updatePassword(newPass);
        showToast('Password updated!', 'success');
        ['current-password', 'new-password', 'confirm-password'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

async function saveNotificationSettings() {
    try {
        await db.collection('profiles').doc(currentUser.uid).update({
            emailNotifications: document.getElementById('email-notifications')?.checked,
            complaintNotifications: document.getElementById('complaint-notifications')?.checked,
            summonsNotifications: document.getElementById('summons-notifications')?.checked
        });
        showToast('Preferences saved!', 'success');
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

function viewMyComplaints() { toggleAccountDropdown(); window.location.href = 'complaints.html'; }
async function handleLogout() { await auth.signOut(); window.location.href = 'login.html'; }

// ==================== DATA FUNCTIONS (SAFE) ====================

async function updateStats() {
    if (!document.getElementById('stat-residents')) return;
    try {
        const res = await db.collection('profiles').get();
        const comp = await db.collection('complaints').where('status', '!=', 'resolved').get();
        const sum = await db.collection('summons').where('status', '==', 'confirmed').get();
        const today = new Date().toISOString().split('T')[0];
        const court = await db.collection('courtBookings').where('date', '==', today).get();
        
        const setStat = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setStat('stat-residents', res.size);
        setStat('stat-complaints', comp.size);
        setStat('stat-summons', sum.size);
        setStat('stat-court', court.size);
    } catch (e) { console.error(e); }
}

async function loadRecentComplaints() {
    const container = document.getElementById('recent-complaints');
    if (!container) return;
    try {
        const snap = await db.collection('complaints').orderBy('createdAt', 'desc').limit(3).get();
        if (snap.empty) { container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:20px;">No recent complaints.</p>'; return; }
        container.innerHTML = snap.docs.map(doc => {
            const c = doc.data();
            return `<div class="complaint-item" style="padding:14px;"><div class="complaint-header"><span class="complaint-category cat-${c.category||'other'}">${categoryConfig[c.category]?.label||'📌 Other'}</span></div><div class="complaint-title">${escapeHtml(c.title)}</div></div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

async function loadActivityTimeline() {
    const container = document.getElementById('activity-timeline');
    if (!container) return;
    try {
        const snap = await db.collection('complaints').orderBy('createdAt', 'desc').limit(5).get();
        const activities = snap.docs.map(doc => {
            const d = doc.data();
            return { time: d.createdAt?.toDate() || new Date(), event: `New complaint: ${d.title}` };
        });
        if (activities.length === 0) { container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">No activity.</p>'; return; }
        container.innerHTML = activities.map(a => `<div class="timeline-item"><div class="time">${a.time.toLocaleString()}</div><div class="event">${escapeHtml(a.event)}</div></div>`).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

async function renderComplaints(filter = 'all', elementId = 'complaintList') {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">Loading...</p>';
    try {
        const snap = await db.collection('complaints').orderBy('createdAt', 'desc').get();
        let complaints = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (filter !== 'all') complaints = complaints.filter(c => c.status === filter);
        
        if (complaints.length === 0) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">No complaints found.</p>'; return; }
        
        container.innerHTML = complaints.map(c => `
            <div class="complaint-item">
                <div class="complaint-header">
                    <span class="complaint-category ${categoryConfig[c.category]?.class||'cat-other'}">${categoryConfig[c.category]?.label||'📌 Other'}</span>
                    ${userRole === 'admin' ? `<select class="status-dropdown" onchange="updateComplaintStatus('${c.id}', this.value)"><option value="pending" ${c.status==='pending'?'selected':''}>⏳ Pending</option><option value="progress" ${c.status==='progress'?'selected':''}>🔄 Progress</option><option value="resolved" ${c.status==='resolved'?'selected':''}>✅ Resolved</option></select>` : `<span class="status-badge status-${c.status||'pending'}"><span class="status-dot"></span> ${c.status||'Pending'}</span>`}
                </div>
                <div class="complaint-title">${escapeHtml(c.title)}</div>
                <div class="complaint-desc">${escapeHtml(c.description)}</div>
                <div class="complaint-meta"><span>👤 ${escapeHtml(c.userName)}</span><span>📍 ${escapeHtml(c.purok)}</span></div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p>Error loading complaints.</p>'; }
}

async function submitComplaint() {
    const category = document.getElementById('complaint-category')?.value;
    const title = document.getElementById('complaint-title')?.value.trim();
    const desc = document.getElementById('complaint-desc')?.value.trim();
    const purok = document.getElementById('complaint-purok')?.value;
    
    if (!category || !title || !desc || !purok) { showToast('Fill all fields.', 'warning'); return; }
    
    try {
        await db.collection('complaints').add({
            userId: currentUser.uid, userName: currentUser.email, category, title, description: desc, purok, status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('complaintModal');
        showToast('Complaint filed!', 'success');
        if (currentPage === 'complaints.html') renderComplaints();
        if (currentPage === 'index.html') loadRecentComplaints();
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

async function updateComplaintStatus(id, status) {
    if (userRole !== 'admin') return;
    try {
        await db.collection('complaints').doc(id).update({ status });
        showToast(`Marked as ${status}`, 'success');
        renderComplaints();
    } catch (e) { showToast('Update failed.', 'danger'); }
}

function filterComplaints(filter, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderComplaints(filter);
}

async function renderResidents() {
    const container = document.getElementById('residentGrid');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">Loading...</p>';
    try {
        const snap = await db.collection('profiles').orderBy('lastName').get();
        const residents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        container.innerHTML = residents.map(r => `
            <div class="resident-card">
                <div class="resident-avatar" style="background:${stringToColor(r.firstName+r.lastName)}">${r.firstName[0]}${r.lastName[0]}</div>
                <div class="resident-name">${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</div>
                <div class="resident-address">${escapeHtml(r.purok)}</div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

async function renderSummons() {
    const container = document.getElementById('summonsList');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">Loading...</p>';
    try {
        const snap = await db.collection('summons').orderBy('date', 'asc').get();
        const summons = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (summons.length === 0) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">No summons.</p>'; return; }
        container.innerHTML = summons.map(s => `
            <div class="summons-card">
                <div class="summons-info"><h4>${escapeHtml(s.caseTitle)}</h4><p>${escapeHtml(s.complainantName)} vs ${escapeHtml(s.respondentName)}</p></div>
                <div class="summons-date"><div class="date">${s.date}</div><div class="time">${s.time}</div></div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

async function addSummons() {
    const c = document.getElementById('summons-complainant')?.value.trim();
    const r = document.getElementById('summons-respondent')?.value.trim();
    const caseT = document.getElementById('summons-case')?.value.trim();
    const d = document.getElementById('summons-date')?.value;
    const t = document.getElementById('summons-time')?.value;
    const l = document.getElementById('summons-location')?.value;
    
    if (!c || !r || !caseT || !d || !t) { showToast('Fill all fields.', 'warning'); return; }
    
    try {
        await db.collection('summons').add({ complainantName: c, respondentName: r, caseTitle: caseT, date: d, time: t, location: l, status: 'confirmed', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        closeModal('summonsModal');
        showToast('Summons scheduled!', 'success');
        renderSummons();
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

// ==================== CALENDAR & COURT FUNCTIONS ====================

let currentMonth = new Date();
let selectedDate = new Date();
let allBookings = [];

// Helper: Get YYYY-MM-DD string from any Date object (Local Time)
function getLocalDateString(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Initialize Calendar
async function initCalendar(resetDate = false) {
    if (resetDate) {
        // Force reset to NOW
        currentMonth = new Date();
        selectedDate = new Date();
    }
    
    renderCalendarHeader();
    await fetchMonthBookings();
    renderCalendarGrid();
}

function renderCalendarHeader() {
    const options = { month: 'long', year: 'numeric' };
    const el = document.getElementById('current-month');
    if(el) el.textContent = currentMonth.toLocaleDateString('en-US', options);
}

async function fetchMonthBookings() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    // Use local date strings for query bounds
    const startOfMonth = getLocalDateString(new Date(year, month, 1));
    const endOfMonth = getLocalDateString(new Date(year, month + 1, 0));
    
    try {
        const snapshot = await db.collection('courtBookings')
            .where('date', '>=', startOfMonth)
            .where('date', '<=', endOfMonth)
            .get();
        allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.warn("Fetch error", error);
        allBookings = [];
    }
}

function renderCalendarGrid() {
    const grid = document.getElementById('calendar-grid');
    if(!grid) return;

    // Clear old days (keep headers)
    const headers = Array.from(grid.children).slice(0, 7);
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get Today's string once for comparison
    const todayStr = getLocalDateString(new Date());
    const selectedStr = getLocalDateString(selectedDate);
    
    // Empty cells
    for (let i = 0; i < firstDayOfMonth; i++) {
        const emptyCell = document.createElement('div');
        grid.appendChild(emptyCell);
    }
    
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        // Construct date string manually to avoid timezone shifts
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const dayBookings = allBookings.filter(b => b.date === dateStr);
        
        // Compare strings directly
        const isToday = (dateStr === todayStr);
        const isSelected = (dateStr === selectedStr);
        
        const cell = document.createElement('div');
        cell.className = `calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;
        cell.setAttribute('data-count', dayBookings.length);
        
        cell.onclick = () => {
            // Set selected date explicitly to avoid timezone issues
            selectedDate = new Date(year, month, day);
            renderCalendarGrid(); 
        };
        
        // Render bookings inside grid
        let bookingsHtml = '';
        if (dayBookings.length > 0) {
            dayBookings.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            bookingsHtml = '<div class="grid-bookings">';
            dayBookings.forEach(b => {
                const time = (b.startTime && b.endTime) ? `${b.startTime} - ${b.endTime}` : 'All Day';
                const isAdmin = b.isAdminBooking;
                bookingsHtml += `
                    <div class="grid-booking ${isAdmin ? 'admin' : ''}">
                        <div class="grid-time">${time}</div>
                        <div class="grid-name">${escapeHtml(b.bookerName)}</div>
                    </div>
                `;
            });
            bookingsHtml += '</div>';
        }
        
        cell.innerHTML = `
            <div class="day-top"><div class="day-number">${day}</div></div>
            ${bookingsHtml}
        `;
        grid.appendChild(cell);
    }
}

// Change Month (Arrow Buttons)
function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    initCalendar(false); 
}

// Open Booking Modal
function openBookingModal() {
    // Ensure the input gets the local date string of the selected date
    document.getElementById('court-date').value = getLocalDateString(selectedDate);
    openModal('courtModal');
}

// Submit Booking
async function bookCourt() {
    const name = document.getElementById('court-booker')?.value.trim();
    // Use the value from the input, which is already in YYYY-MM-DD format
    const date = document.getElementById('court-date')?.value; 
    const start = document.getElementById('court-start-time')?.value;
    const end = document.getElementById('court-end-time')?.value;
    const activity = document.getElementById('court-activity')?.value;
    
    if (!name || !date || !start || !end) { showToast('Fill all fields.', 'warning'); return; }
    if (start >= end) { showToast('End time must be after start.', 'warning'); return; }
    
    const startH = parseInt(start.split(':')[0]);
    const endH = parseInt(end.split(':')[0]);
    if (startH < 6 || endH > 19) { showToast('Court hours: 6 AM - 7 PM', 'warning'); return; }
    
    try {
        const reqStart = toMinutes(start);
        const reqEnd = toMinutes(end);
        
        // Check overlaps using the date string from the form
        const hasOverlap = allBookings.some(b => {
            if (b.date !== date) return false;
            return (reqStart < toMinutes(b.endTime) && reqEnd > toMinutes(b.startTime));
        });
        
        if (hasOverlap) { showToast('Time slot overlaps!', 'danger'); return; }
        
        await db.collection('courtBookings').add({
            userId: currentUser.uid, 
            bookerName: name, 
            date: date, // Save exactly what was selected
            startTime: start, 
            endTime: end, 
            activity,
            isAdminBooking: false, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeModal('courtModal');
        showToast('Booking Confirmed!', 'success');
        
        // Refresh view
        await fetchMonthBookings();
        renderCalendarGrid();
        document.getElementById('court-booker').value = '';
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

// Admin Clear
async function adminClearDay() {
    if (userRole !== 'admin') return;
    const date = getLocalDateString(selectedDate);
    if (!confirm(`Delete ALL bookings for ${date}?`)) return;
    try {
        const snap = await db.collection('courtBookings').where('date', '==', date).get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showToast('Day cleared', 'success');
        await fetchMonthBookings();
        renderCalendarGrid();
        closeModal('adminCourtModal');
    } catch (e) { showToast('Error', 'danger'); }
}

// Helpers
function toMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
}
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Global Exports
window.initCalendar = initCalendar;
window.changeMonth = changeMonth;
window.openBookingModal = openBookingModal;
window.bookCourt = bookCourt;
window.adminClearDay = adminClearDay;
window.openModal = function(id) { document.getElementById(id).classList.add('show'); };
window.closeModal = function(id) { document.getElementById(id).classList.remove('show'); };
window.toggleSidebar = function() { document.getElementById('sidebar').classList.toggle('open'); };
window.toggleAccountDropdown = function() { document.getElementById('accountDropdown')?.classList.toggle('show'); };
window.handleLogout = async function() { await firebase.auth().signOut(); window.location.href='login.html'; };
window.saveProfileChanges = async function() {
    const fn = document.getElementById('edit-first-name')?.value;
    const ln = document.getElementById('edit-last-name')?.value;
    if(fn && ln) {
        try {
            await db.collection('profiles').doc(currentUser.uid).update({ firstName: fn, lastName: ln });
            showToast('Saved!', 'success');
            window.closeModal('accountModal');
            document.getElementById('user-name').textContent = `${fn} ${ln}`;
        } catch(e) { showToast('Error', 'danger'); }
    }
};

// ==================== UTILS ====================
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function initMap() {
    if (mapInstance || !document.getElementById('map')) return;
    mapInstance = L.map('map').setView([13.4150, 123.4300], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    L.marker([13.4150, 123.4300]).addTo(mapInstance).bindPopup('Barangay Hall');
}

// Expose global functions
window.handleLogin = async () => {
    const e = document.getElementById('login-email')?.value;
    const p = document.getElementById('login-password')?.value;
    if(!e||!p) return alert('Enter credentials');
    try { await auth.signInWithEmailAndPassword(e,p); } catch(err) { alert(err.message); }
};
window.handleSignup = async () => {
    // Simplified signup for demo
    alert('Please use the full signup form in the HTML');
};
window.handleLogout = handleLogout;
window.toggleAuthMode = (m) => {
    document.getElementById('login-form').style.display = m==='login'?'block':'none';
    document.getElementById('signup-form').style.display = m==='signup'?'block':'none';
};
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleAccountDropdown = toggleAccountDropdown;
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.openAccountSettings = openAccountSettings;
window.switchTab = switchTab;
window.saveProfileChanges = saveProfileChanges;
window.changePassword = changePassword;
window.saveNotificationSettings = saveNotificationSettings;
window.viewMyComplaints = viewMyComplaints;
window.submitComplaint = submitComplaint;
window.filterComplaints = filterComplaints;
window.updateComplaintStatus = updateComplaintStatus;
window.renderResidents = renderResidents;
window.addSummons = addSummons;
window.bookCourt = bookCourt;
window.filterCourt = filterCourt;
window.changeDate = changeDate;
window.openAdminCourtModal = openAdminCourtModal;
window.adminBookCourt = adminBookCourt;
window.adminRemoveBooking = adminRemoveBooking;
window.openBookingModal = openBookingModal;

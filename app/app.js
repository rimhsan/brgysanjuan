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
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase Init Error:", e);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Global State
let currentUser = null;
let userRole = 'resident';
let mapInstance = null;
let currentMonth = new Date();
let selectedDate = new Date();
let allBookings = [];

// Detect Current Page
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// Constants
const categoryConfig = {
    roadwork: { label: '🚧 Roadwork', class: 'cat-roadwork' },
    lightpost: { label: '💡 Lightpost', class: 'cat-lightpost' },
    drainage: { label: '🔧 Drainage', class: 'cat-drainage' },
    noise: { label: '📢 Noise', class: 'cat-noise' },
    garbage: { label: '🗑️ Garbage', class: 'cat-garbage' },
    other: { label: '📌 Other', class: 'cat-other' },
    general: { label: '📢 General', class: 'cat-general' }
};

// ==================== AUTHENTICATION ====================
auth.onAuthStateChanged(async (user) => {
    const isLoginPage = currentPage === 'login.html';
    const authOverlay = document.getElementById('auth-overlay');
    
    if (user) {
        currentUser = user;
        if (isLoginPage) {
            window.location.href = 'index.html';
            return;
        }
        try {
            await loadUserProfile();
            if (authOverlay) authOverlay.style.display = 'none';
            initializeApp();
        } catch (error) {
            console.error("Init Error:", error);
            if (authOverlay) authOverlay.style.display = 'none';
        }
    } else {
        currentUser = null;
        if (!isLoginPage) {
            window.location.href = 'login.html';
            return;
        }
        if (authOverlay) authOverlay.style.display = 'flex';
    }
});

async function loadUserProfile() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            userRole = data.role || 'resident';
            
            const name = `${data.firstName} ${data.lastName}`;
            const initials = `${data.firstName[0]}${data.lastName[0]}`.toUpperCase();
            
            const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            
            setText('user-name', name);
            setText('user-role', userRole === 'admin' ? 'Admin' : 'Resident');
            setText('dropdown-name', name);
            setText('dropdown-email', data.email);
            setText('user-avatar', initials);
            setText('dropdown-avatar', initials);
            setText('dropdown-role', userRole === 'admin' ? 'Admin' : 'Resident');
            setText('user-role-badge', userRole === 'admin' ? 'Admin' : 'Resident');
            
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
    if (currentPage === 'index.html' || currentPage === '') {
        await updateStats();
        await loadRecentComplaints();
        await loadRecentCourtBookings();
    }
    if (currentPage === 'complaints.html') await renderComplaints('all', 'complaintList');
    if (currentPage === 'residents.html') await renderResidents();
    if (currentPage === 'summons.html') await renderSummons();
    if (currentPage === 'court.html') await initCalendar(true);
    if (currentPage === 'map.html') setTimeout(initMap, 500);
    if (currentPage === 'announcements.html') await loadAnnouncements();
    if (currentPage === 'account.html') await loadAccountPage();
}

// ==================== UI HELPERS ====================
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

// ==================== PROFILE DROPDOWN ====================
window.toggleProfileDropdown = function() {
    const dropdown = document.getElementById('profileDropdown');
    const trigger = document.querySelector('.user-profile-trigger');
    if (dropdown) {
        dropdown.classList.toggle('show');
        if (trigger) trigger.classList.toggle('active');
    }
};

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('profileDropdown');
    const trigger = document.querySelector('.user-profile-trigger');
    if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
        if(trigger) trigger.classList.remove('active');
    }
});

async function handleLogout() { 
    await auth.signOut(); 
    window.location.href = 'login.html'; 
}

// ==================== DASHBOARD DATA ====================
async function updateStats() {
    if (!document.getElementById('stat-residents')) return;
    try {
        const resSnap = await db.collection('profiles').get();
        const compSnap = await db.collection('complaints').get();
        let activeComplaints = 0;
        compSnap.forEach(doc => { if (doc.data().status !== 'resolved') activeComplaints++; });
        
        const sumSnap = await db.collection('summons').where('status', '==', 'confirmed').get();
        const today = new Date().toISOString().split('T')[0];
        const courtSnap = await db.collection('courtBookings').where('date', '==', today).get();
        
        const setStat = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setStat('stat-residents', resSnap.size);
        setStat('stat-complaints', activeComplaints);
        setStat('stat-summons', sumSnap.size);
        setStat('stat-court', courtSnap.size);
    } catch (e) { console.error("Stats Error:", e); }
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

async function loadRecentCourtBookings() {
    const container = document.getElementById('recent-court-bookings');
    if (!container) return;
    try {
        const snap = await db.collection('courtBookings').orderBy('createdAt', 'desc').limit(5).get();
        const bookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).slice(0, 5);
        if (bookings.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:20px;">No recent bookings.</p>';
            return;
        }
        container.innerHTML = bookings.map(b => {
            const time = (b.startTime && b.endTime) ? `${formatTime(b.startTime)} - ${formatTime(b.endTime)}` : 'All Day';
            return `<div class="court-booking-item ${b.isAdminBooking ? 'admin' : ''}"><div class="court-booking-header"><span class="court-booking-time">${time}</span><span class="court-booking-date">${new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><div class="court-booking-name">${escapeHtml(b.bookerName)}</div><div class="court-booking-activity">${escapeHtml(b.activity)}</div></div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// ==================== COMPLAINTS ====================
async function renderComplaints(filter = 'all', elementId = 'complaintList') {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">⏳ Loading...</p>';
    
    try {
        const snap = await db.collection('complaints').orderBy('createdAt', 'desc').get();
        let complaints = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (filter !== 'all') complaints = complaints.filter(c => c.status === filter);
        
        if (complaints.length === 0) { 
            container.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">No complaints found.</p>'; 
            return; 
        }
        
        container.innerHTML = complaints.map(c => `
            <div class="complaint-item">
                <div class="complaint-header">
                    <span class="complaint-category ${categoryConfig[c.category]?.class || 'cat-other'}">
                        ${categoryConfig[c.category]?.label || '📌 Other'}
                    </span>
                    ${userRole === 'admin' ? `
                        <div class="status-controls" data-id="${c.id}" style="display:flex; gap:8px; align-items:center;">
                            <select class="status-dropdown" id="status-select-${c.id}">
                                <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                                <option value="progress" ${c.status === 'progress' ? 'selected' : ''}>🔄 In Progress</option>
                                <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
                            </select>
                            <button class="btn btn-sm btn-primary" onclick="saveComplaintStatus('${c.id}')">💾 Save</button>
                        </div>
                    ` : `
                        <span class="status-badge status-${c.status || 'pending'}">
                            <span class="status-dot"></span> ${c.status === 'progress' ? 'In Progress' : (c.status === 'resolved' ? 'Resolved' : 'Pending')}
                        </span>
                    `}
                </div>
                <div class="complaint-title">${escapeHtml(c.title)}</div>
                <div class="complaint-desc">${escapeHtml(c.description)}</div>
                <div class="complaint-meta">
                    <span>👤 ${escapeHtml(c.userName)}</span>
                    <span>📍 ${escapeHtml(c.purok)}</span>
                    <span>🕐 ${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                </div>
            </div>
        `).join('');
    } catch (e) { 
        console.error(e);
        container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Error loading complaints.</p>'; 
    }
}

async function saveComplaintStatus(id) {
    if (userRole !== 'admin') return;
    const select = document.getElementById(`status-select-${id}`);
    const btn = document.querySelector(`.status-controls[data-id="${id}"] .btn`);
    const newStatus = select.value;
    if (!newStatus) return showToast('Select a status.', 'warning');
    
    const orig = btn.innerHTML; btn.innerHTML = '⏳ Saving...'; btn.disabled = true;
    try {
        await db.collection('complaints').doc(id).update({ status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast(`Updated to ${newStatus === 'progress' ? 'In Progress' : newStatus}`, 'success');
        renderComplaints();
    } catch (err) { showToast('Failed: ' + err.message, 'danger'); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

async function openEditComplaintModal(id) {
    if (userRole !== 'admin') return;
    try {
        const doc = await db.collection('complaints').doc(id).get();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('complaint-edit-id').value = id;
            document.getElementById('complaint-category').value = d.category;
            document.getElementById('complaint-title').value = d.title;
            document.getElementById('complaint-desc').value = d.description;
            document.getElementById('complaint-purok').value = d.purok;
            document.getElementById('complaint-modal-title').textContent = '✏️ Edit Complaint';
            openModal('complaintModal');
        }
    } catch (e) { showToast('Error loading complaint', 'danger'); }
}

async function deleteComplaint(id) {
    if (userRole !== 'admin') return;
    if (!confirm('Delete this complaint?')) return;
    try {
        await db.collection('complaints').doc(id).delete();
        showToast('Deleted', 'success');
        renderComplaints();
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

async function submitComplaint() {
    const cat = document.getElementById('complaint-category')?.value;
    const title = document.getElementById('complaint-title')?.value.trim();
    const desc = document.getElementById('complaint-desc')?.value.trim();
    const purok = document.getElementById('complaint-purok')?.value;
    const editId = document.getElementById('complaint-edit-id')?.value;
    if (!cat || !title || !desc || !purok) return showToast('Fill all fields.', 'warning');

    try {
        const data = { category: cat, title, description: desc, purok };
        if (editId) {
            await db.collection('complaints').doc(editId).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Updated!', 'success');
        } else {
            await db.collection('complaints').add({ ...data, userId: currentUser.uid, userName: currentUser.email, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Filed!', 'success');
        }
        closeModal('complaintModal');
        renderComplaints();
        document.getElementById('complaint-edit-id').value = '';
        ['complaint-category','complaint-title','complaint-desc','complaint-purok'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

function filterComplaints(filter, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderComplaints(filter);
}

// ==================== RESIDENTS ====================
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
            </div>`).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// ==================== SUMMONS ====================
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
                <div class="summons-date">
                    <div class="date">${s.date}</div><div class="time">${s.time}</div>
                    ${userRole === 'admin' ? `<div style="display:flex;gap:6px;margin-top:6px;"><button class="btn btn-sm btn-outline" onclick="openEditSummonsModal('${s.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="deleteSummons('${s.id}')">🗑️</button></div>` : `<span class="status-badge status-confirmed"><span class="status-dot"></span> Confirmed</span>`}
                </div>
            </div>`).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

async function openEditSummonsModal(id) {
    if (userRole !== 'admin') return;
    try {
        const doc = await db.collection('summons').doc(id).get();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('summons-edit-id').value = id;
            document.getElementById('summons-complainant').value = d.complainantName;
            document.getElementById('summons-respondent').value = d.respondentName;
            document.getElementById('summons-case').value = d.caseTitle;
            document.getElementById('summons-date').value = d.date;
            document.getElementById('summons-time').value = d.time;
            document.getElementById('summons-location').value = d.location;
            document.getElementById('summons-modal-title').textContent = '✏️ Edit Summons';
            openModal('summonsModal');
        }
    } catch (e) { showToast('Error', 'danger'); }
}

async function deleteSummons(id) {
    if (userRole !== 'admin') return;
    if (!confirm('Delete?')) return;
    try { await db.collection('summons').doc(id).delete(); showToast('Deleted', 'success'); renderSummons(); }
    catch (e) { showToast('Failed', 'danger'); }
}

async function addSummons() {
    const c = document.getElementById('summons-complainant')?.value.trim();
    const r = document.getElementById('summons-respondent')?.value.trim();
    const caseT = document.getElementById('summons-case')?.value.trim();
    const d = document.getElementById('summons-date')?.value;
    const t = document.getElementById('summons-time')?.value;
    const l = document.getElementById('summons-location')?.value;
    const editId = document.getElementById('summons-edit-id')?.value;
    if (!c || !r || !caseT || !d || !t) return showToast('Fill all fields.', 'warning');

    try {
        const data = { complainantName: c, respondentName: r, caseTitle: caseT, date: d, time: t, location: l };
        if (editId) { await db.collection('summons').doc(editId).update({ ...data, status: 'confirmed' }); showToast('Updated!', 'success'); }
        else { await db.collection('summons').add({ ...data, status: 'confirmed', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Scheduled!', 'success'); }
        closeModal('summonsModal'); renderSummons(); document.getElementById('summons-edit-id').value = '';
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

// ==================== COURT CALENDAR ====================
function getLocalDateString(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function initCalendar(resetDate = false) {
    if (resetDate) { currentMonth = new Date(); selectedDate = new Date(); }
    renderCalendarHeader(); await fetchMonthBookings(); renderCalendarGrid();
}

function renderCalendarHeader() {
    const el = document.getElementById('current-month');
    if(el) el.textContent = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

async function fetchMonthBookings() {
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const start = getLocalDateString(new Date(y, m, 1)), end = getLocalDateString(new Date(y, m + 1, 0));
    try {
        const snap = await db.collection('courtBookings').where('date', '>=', start).where('date', '<=', end).get();
        allBookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) { allBookings = []; }
}

function renderCalendarGrid() {
    const grid = document.getElementById('calendar-grid'); if(!grid) return;
    const headers = Array.from(grid.children).slice(0, 7); grid.innerHTML = ''; headers.forEach(h => grid.appendChild(h));
    
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayStr = getLocalDateString(new Date()), selStr = getLocalDateString(selectedDate);
    
    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayBookings = allBookings.filter(b => b.date === dateStr);
        const cell = document.createElement('div');
        cell.className = `calendar-day ${dateStr === todayStr ? 'today' : ''} ${dateStr === selStr ? 'selected' : ''}`;
        cell.onclick = () => { selectedDate = new Date(y, m, day); renderCalendarGrid(); };
        
        let html = `<div class="day-top"><div class="day-number">${day}</div></div>`;
        if (dayBookings.length > 0) {
            html += '<div class="grid-bookings">';
            dayBookings.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            dayBookings.forEach(b => {
                const time = (b.startTime && b.endTime) ? `${b.startTime} - ${b.endTime}` : 'All Day';
                const click = userRole === 'admin' ? `onclick="openEditBookingModal('${b.id}')"` : '';
                html += `<div class="grid-booking ${b.isAdminBooking ? 'admin' : ''}" ${click}><div class="grid-time">${time}</div><div class="grid-name">${escapeHtml(b.bookerName)}</div></div>`;
            });
            html += '</div>';
        }
        cell.innerHTML = html; grid.appendChild(cell);
    }
}

function changeMonth(delta) { currentMonth.setMonth(currentMonth.getMonth() + delta); initCalendar(false); }

function openBookingModal() {
    document.getElementById('court-booking-edit-id').value = '';
    document.getElementById('court-date').value = getLocalDateString(selectedDate);
    document.getElementById('court-booker').value = '';
    document.getElementById('court-start-time').value = '';
    document.getElementById('court-end-time').value = '';
    document.getElementById('court-activity').value = 'Basketball';
    document.getElementById('court-modal-title').textContent = '📅 Book Court Slot';
    document.getElementById('btn-delete-booking').style.display = 'none';
    openModal('courtModal');
}

async function openEditBookingModal(id) {
    if (userRole !== 'admin') return;
    try {
        const doc = await db.collection('courtBookings').doc(id).get();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('court-booking-edit-id').value = id;
            document.getElementById('court-booker').value = d.bookerName;
            document.getElementById('court-date').value = d.date;
            document.getElementById('court-start-time').value = d.startTime;
            document.getElementById('court-end-time').value = d.endTime;
            document.getElementById('court-activity').value = d.activity;
            document.getElementById('court-modal-title').textContent = '✏️ Edit Booking';
            document.getElementById('btn-delete-booking').style.display = 'inline-flex';
            openModal('courtModal');
        }
    } catch (e) { showToast('Error', 'danger'); }
}

async function deleteCurrentBooking() {
    const id = document.getElementById('court-booking-edit-id')?.value;
    if (!id) return;
    if (!confirm('Delete this booking?')) return;
    try { await db.collection('courtBookings').doc(id).delete(); showToast('Deleted', 'success'); closeModal('courtModal'); await fetchMonthBookings(); renderCalendarGrid(); }
    catch (e) { showToast('Failed', 'danger'); }
}

function toMinutes(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }

async function bookCourt() {
    const name = document.getElementById('court-booker')?.value.trim();
    const date = document.getElementById('court-date')?.value;
    const start = document.getElementById('court-start-time')?.value;
    const end = document.getElementById('court-end-time')?.value;
    const activity = document.getElementById('court-activity')?.value;
    const editId = document.getElementById('court-booking-edit-id')?.value;

    if (!name || !date || !start || !end) return showToast('Fill all fields.', 'warning');
    if (start >= end) return showToast('End time must be after start.', 'warning');
    if (parseInt(start.split(':')[0]) < 6 || parseInt(end.split(':')[0]) > 19) return showToast('Court hours: 6 AM - 7 PM', 'warning');

    try {
        if (!editId) {
            if (allBookings.some(b => b.date === date && toMinutes(start) < toMinutes(b.endTime) && toMinutes(end) > toMinutes(b.startTime))) return showToast('Slot overlaps!', 'danger');
            await db.collection('courtBookings').add({ userId: currentUser.uid, bookerName: name, date, startTime: start, endTime: end, activity, isAdminBooking: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Booked!', 'success');
        } else {
            await db.collection('courtBookings').doc(editId).update({ bookerName: name, startTime: start, endTime: end, activity, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('Updated!', 'success');
        }
        closeModal('courtModal'); await fetchMonthBookings(); renderCalendarGrid(); document.getElementById('court-booking-edit-id').value = ''; document.getElementById('court-booker').value = '';
    } catch (e) { showToast('Failed: ' + e.message, 'danger'); }
}

// ==================== ANNOUNCEMENTS ====================
async function loadAnnouncements() {
    const c = document.getElementById('announcementsList'); if (!c) return; c.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">Loading...</p>';
    try {
        const snap = await db.collection('announcements').orderBy('createdAt', 'desc').get();
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (list.length === 0) { c.innerHTML = '<p style="text-align:center;padding:40px;color:#7f8c8d;">No announcements.</p>'; return; }
        c.innerHTML = list.map(a => `
            <div class="announcement-card">
                <div class="announcement-header"><div><span class="complaint-category cat-${a.category||'general'}">${categoryConfig[a.category]?.label||'📢 General'}</span><div class="announcement-title">${escapeHtml(a.title)}</div></div>
                ${userRole === 'admin' ? `<div class="announcement-actions"><button class="btn btn-sm btn-outline" onclick="editAnnouncement('${a.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${a.id}')">🗑️</button></div>` : ''}</div>
                <div class="announcement-content">${escapeHtml(a.content)}</div>
                <div class="announcement-meta"><span>📅 ${a.createdAt ? new Date(a.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span><span>👤 ${escapeHtml(a.createdBy||'Admin')}</span></div>
            </div>`).join('');
    } catch (e) { c.innerHTML = '<p>Error</p>'; }
}

function openAnnouncementModal(editId = null) {
    document.getElementById('announcement-modal-title').textContent = editId ? '✏️ Edit' : '📢 Add';
    document.getElementById('announcement-edit-id').value = editId || '';
    if (editId) {
        db.collection('announcements').doc(editId).get().then(doc => {
            if(doc.exists) { const d=doc.data(); document.getElementById('announcement-title').value=d.title; document.getElementById('announcement-category').value=d.category; document.getElementById('announcement-content').value=d.content; }
        });
    } else {
        document.getElementById('announcement-title').value = ''; document.getElementById('announcement-content').value = ''; document.getElementById('announcement-category').value = 'general';
    }
    openModal('announcementModal');
}

async function saveAnnouncement() {
    const title = document.getElementById('announcement-title')?.value.trim();
    const category = document.getElementById('announcement-category')?.value;
    const content = document.getElementById('announcement-content')?.value.trim();
    const editId = document.getElementById('announcement-edit-id')?.value;
    if (!title || !content) return showToast('Fill title & content.', 'warning');
    try {
        const data = { title, category, content, updatedBy: currentUser.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (editId) { await db.collection('announcements').doc(editId).update(data); showToast('Updated!', 'success'); }
        else { await db.collection('announcements').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentUser.email }); showToast('Posted!', 'success'); }
        closeModal('announcementModal'); loadAnnouncements();
    } catch (e) { showToast('Failed', 'danger'); }
}

async function editAnnouncement(id) { openAnnouncementModal(id); }
async function deleteAnnouncement(id) {
    if (userRole !== 'admin') return; if(!confirm('Delete?')) return;
    try { await db.collection('announcements').doc(id).delete(); showToast('Deleted', 'success'); loadAnnouncements(); } catch(e){ showToast('Failed', 'danger'); }
}

// ==================== ACCOUNT PAGE ====================
function switchAccountTab(tabId, btn) {
    document.querySelectorAll('.account-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.account-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active'); btn.classList.add('active');
}

async function loadAccountPage() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('acc-first-name').value = d.firstName||'';
            document.getElementById('acc-last-name').value = d.lastName||'';
            document.getElementById('acc-email').value = d.email||'';
            document.getElementById('acc-purok').value = d.purok||'';
            document.getElementById('acc-phone').value = d.phone||'';
            document.getElementById('acc-notif-email').checked = d.emailNotifications !== false;
        }
        await loadMyComplaints();
    } catch (e) { console.error(e); }
}

async function saveAccountProfile() {
    const fn = document.getElementById('acc-first-name')?.value.trim();
    const ln = document.getElementById('acc-last-name')?.value.trim();
    const pk = document.getElementById('acc-purok')?.value;
    const ph = document.getElementById('acc-phone')?.value.trim();
    if (!fn || !ln) return showToast('Name required.', 'warning');
    try {
        await db.collection('profiles').doc(currentUser.uid).update({ firstName: fn, lastName: ln, purok: pk, phone: ph });
        await currentUser.updateProfile({ displayName: `${fn} ${ln}` });
        showToast('Updated!', 'success'); loadUserProfile();
    } catch (e) { showToast('Failed', 'danger'); }
}

async function changeAccountPassword() {
    const curr = document.getElementById('acc-current-pass')?.value;
    const newP = document.getElementById('acc-new-pass')?.value;
    const conf = document.getElementById('acc-confirm-pass')?.value;
    if (!curr || !newP || !conf) return showToast('Fill all fields.', 'warning');
    if (newP.length < 6) return showToast('Min 6 chars.', 'warning');
    if (newP !== conf) return showToast('Passwords mismatch.', 'danger');
    try {
        await currentUser.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(currentUser.email, curr));
        await currentUser.updatePassword(newP);
        showToast('Password updated!', 'success');
        ['acc-current-pass','acc-new-pass','acc-confirm-pass'].forEach(id => document.getElementById(id).value = '');
    } catch (e) { showToast('Failed', 'danger'); }
}

async function saveNotifPrefs() {
    try { await db.collection('profiles').doc(currentUser.uid).update({ emailNotifications: document.getElementById('acc-notif-email').checked }); showToast('Saved!', 'success'); }
    catch (e) { showToast('Failed', 'danger'); }
}

async function loadMyComplaints() {
    const c = document.getElementById('my-complaints-list'); if (!c) return;
    try {
        const snap = await db.collection('complaints').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').get();
        if (snap.empty) { c.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;">No complaints yet.</p>'; return; }
        c.innerHTML = snap.docs.map(doc => {
            const d = doc.data(); const cls = d.status==='resolved'?'resolved':(d.status==='progress'?'progress':'');
            return `<div class="complaint-card ${cls}"><div class="complaint-header"><h4>${escapeHtml(d.title)}</h4><span class="status-badge status-${d.status||'pending'}"><span class="status-dot"></span> ${d.status||'Pending'}</span></div><div class="complaint-desc">${escapeHtml(d.description)}</div><div class="complaint-meta"><span>📍 ${escapeHtml(d.purok)}</span><span>🕐 ${d.createdAt?new Date(d.createdAt.toDate()).toLocaleDateString():'N/A'}</span></div></div>`;
        }).join('');
    } catch (e) { c.innerHTML = '<p>Error</p>'; }
}

// ==================== MAP ====================
function initMap() {
    if (mapInstance || !document.getElementById('map')) return;
    mapInstance = L.map('map').setView([13.4205, 123.4194], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    L.marker([13.4205, 123.4194]).addTo(mapInstance).bindPopup('Barangay Hall');
}

// ==================== LOGIN/SIGNUP ====================
window.handleLogin = async () => {
    const e = document.getElementById('login-email')?.value; const p = document.getElementById('login-password')?.value;
    if(!e||!p) return alert('Enter credentials');
    try { await auth.signInWithEmailAndPassword(e,p); } catch(err) { alert(err.message); }
};

window.handleSignup = async () => {
    const email = document.getElementById('signup-email')?.value.trim();
    const pass = document.getElementById('signup-password')?.value;
    const fname = document.getElementById('signup-fname')?.value.trim();
    const lname = document.getElementById('signup-lname')?.value.trim();
    const purok = document.getElementById('signup-purok')?.value;
    if (!email || !pass || !fname || !lname || !purok) return alert('Fill all fields');
    if (pass.length < 6) return alert('Password min 6 chars');
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('profiles').doc(cred.user.uid).set({ firstName: fname, lastName: lname, email, purok, role: 'resident', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        alert('Account created! Please login.');
        toggleAuthMode('login');
        ['signup-email','signup-password','signup-fname','signup-lname'].forEach(id => document.getElementById(id).value = '');
    } catch(err) { alert(err.message); }
};

window.toggleAuthMode = (m) => {
    const l = document.getElementById('login-form'), s = document.getElementById('signup-form');
    if(l) l.style.display = m==='login'?'block':'none';
    if(s) s.style.display = m==='signup'?'block':'none';
};

// ==================== GLOBAL EXPORTS ====================
window.initCalendar = initCalendar;
window.changeMonth = changeMonth;
window.openBookingModal = openBookingModal;
window.bookCourt = bookCourt;
window.openEditBookingModal = openEditBookingModal;
window.deleteCurrentBooking = deleteCurrentBooking;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.handleLogout = handleLogout;
window.toggleProfileDropdown = window.toggleProfileDropdown;
window.saveAccountProfile = saveAccountProfile;
window.switchAccountTab = switchAccountTab;
window.changeAccountPassword = changeAccountPassword;
window.saveNotifPrefs = saveNotifPrefs;
window.loadAccountPage = loadAccountPage;
window.submitComplaint = submitComplaint;
window.filterComplaints = filterComplaints;
window.saveComplaintStatus = saveComplaintStatus;
window.openEditComplaintModal = openEditComplaintModal;
window.deleteComplaint = deleteComplaint;
window.renderResidents = renderResidents;
window.addSummons = addSummons;
window.openEditSummonsModal = openEditSummonsModal;
window.deleteSummons = deleteSummons;
window.openAnnouncementModal = openAnnouncementModal;
window.saveAnnouncement = saveAnnouncement;
window.editAnnouncement = editAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.loadAnnouncements = loadAnnouncements;
window.loadMyComplaints = loadMyComplaints;

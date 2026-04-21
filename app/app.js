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
    alert("Firebase Configuration Error. Check console.");
}

const auth = firebase.auth();
const db = firebase.firestore();

// Global State
let currentUser = null;
let userRole = 'resident';
let mapInstance = null;

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
            
            if (userRole === 'admin') {
                const showBtn = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'inline-flex'; };
                showBtn('schedule-summons-btn');
                showBtn('add-announcement-btn');
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

// ==================== DROPDOWN ====================
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
        compSnap.forEach(doc => {
            if (doc.data().status !== 'resolved') activeComplaints++;
        });
        
        const sumSnap = await db.collection('summons').where('status', '==', 'confirmed').get();
        const today = new Date().toISOString().split('T')[0];
        const courtSnap = await db.collection('courtBookings').where('date', '==', today).get();
        
        const setStat = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setStat('stat-residents', resSnap.size);
        setStat('stat-complaints', activeComplaints);
        setStat('stat-summons', sumSnap.size);
        setStat('stat-court', courtSnap.size);
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
        
        // FIXED: c => instead of c = >
        container.innerHTML = complaints.map(c => `
            <div class="complaint-item">
                <div class="complaint-header">
                    <span class="complaint-category ${categoryConfig[c.category]?.class || 'cat-other'}">
                        ${categoryConfig[c.category]?.label || '📌 Other'}
                    </span>
                    ${userRole === 'admin' ? `
                        <select class="status-dropdown" onchange="updateComplaintStatus('${c.id}', this.value)">
                            <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="progress" ${c.status === 'progress' ? 'selected' : ''}>🔄 In Progress</option>
                            <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
                        </select>
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
                </div>
            </div>
        `).join('');
    } catch (e) { 
        console.error(e);
        container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Error loading complaints.</p>'; 
    }
}

async function updateComplaintStatus(id, status) {
    if (userRole !== 'admin') return;
    try {
        await db.collection('complaints').doc(id).update({ status });
        showToast(`Updated to ${status}`, 'success');
        renderComplaints();
    } catch (error) {
        showToast('Failed: ' + error.message, 'danger');
    }
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
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// ==================== SUMMONS FUNCTIONS ====================

async function renderSummons() {
    const container = document.getElementById('summonsList');
    const scheduleBtn = document.getElementById('schedule-summons-btn');
    
    if (!container) return;
    
    // Show Schedule button only for admins
    if (userRole === 'admin') {
        if (scheduleBtn) scheduleBtn.style.display = 'inline-flex';
    } else {
        if (scheduleBtn) scheduleBtn.style.display = 'none';
    }
    
    container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">⏳ Loading...</p>';
    
    try {
        const snap = await db.collection('summons').orderBy('date', 'asc').get();
        const summons = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (summons.length === 0) { 
            container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">📭 No summons scheduled.</p>'; 
            return; 
        }
        
        container.innerHTML = summons.map(s => {
            const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
            
            return `
                <div class="summons-card">
                    <div class="summons-info">
                        <h4>${escapeHtml(s.caseTitle)}</h4>
                        <p><strong>Complainant:</strong> ${escapeHtml(s.complainantName)}</p>
                        <p><strong>Respondent:</strong> ${escapeHtml(s.respondentName)}</p>
                        <p><strong>Location:</strong> ${escapeHtml(s.location)}</p>
                    </div>
                    <div class="summons-date">
                        <div class="date">${dateStr}</div>
                        <div class="time">🕐 ${s.time || 'N/A'}</div>
                        ${userRole === 'admin' ? `
                            <div class="announcement-actions" style="margin-top:12px;">
                                <button class="btn btn-sm btn-outline" onclick="editSummons('${s.id}')">✏️ Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteSummons('${s.id}')">🗑️ Delete</button>
                            </div>
                        ` : `<span class="status-badge status-confirmed"><span class="status-dot"></span> Confirmed</span>`}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) { 
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color:var(--danger); padding:20px;">Error loading summons.</p>'; 
    }
}

async function saveSummons() {
    const editId = document.getElementById('summons-edit-id')?.value;
    const complainant = document.getElementById('summons-complainant')?.value.trim();
    const respondent = document.getElementById('summons-respondent')?.value.trim();
    const caseTitle = document.getElementById('summons-case')?.value.trim();
    const date = document.getElementById('summons-date')?.value;
    const time = document.getElementById('summons-time')?.value;
    const location = document.getElementById('summons-location')?.value;
    
    if (!complainant || !respondent || !caseTitle || !date || !time) { 
        showToast('Please fill in all required fields.', 'warning'); 
        return; 
    }
    
    try {
        const summonsData = {
            complainantName: complainant,
            respondentName: respondent,
            caseTitle: caseTitle,
            date: date,
            time: time,
            location: location || 'Barangay Hall',
            status: 'confirmed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (editId) {
            // Update existing
            await db.collection('summons').doc(editId).update(summonsData);
            showToast('Summons updated!', 'success');
        } else {
            // Create new
            summonsData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('summons').add(summonsData);
            showToast('Summons scheduled!', 'success');
        }
        
        closeModal('summonsModal');
        renderSummons();
        
        // Clear inputs
        document.getElementById('summons-edit-id').value = '';
        document.getElementById('summons-complainant').value = '';
        document.getElementById('summons-respondent').value = '';
        document.getElementById('summons-case').value = '';
        document.getElementById('summons-date').value = '';
        document.getElementById('summons-time').value = '';
        
    } catch (error) { 
        showToast('Failed: ' + error.message, 'danger'); 
    }
}

async function editSummons(id) {
    if (userRole !== 'admin') return;
    
    try {
        const doc = await db.collection('summons').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('summons-edit-id').value = id;
            document.getElementById('summons-complainant').value = data.complainantName || '';
            document.getElementById('summons-respondent').value = data.respondentName || '';
            document.getElementById('summons-case').value = data.caseTitle || '';
            document.getElementById('summons-date').value = data.date || '';
            document.getElementById('summons-time').value = data.time || '';
            document.getElementById('summons-location').value = data.location || 'Barangay Hall - Conference Room';
            document.getElementById('summons-modal-title').textContent = '✏️ Edit Summons';
            openModal('summonsModal');
        }
    } catch (error) {
        showToast('Error loading summons', 'danger');
    }
}

async function deleteSummons(id) {
    if (userRole !== 'admin') return;
    if (!confirm('Are you sure you want to delete this summons?')) return;
    
    try {
        await db.collection('summons').doc(id).delete();
        showToast('Summons deleted', 'success');
        renderSummons();
    } catch (error) {
        showToast('Failed to delete: ' + error.message, 'danger');
    }
}

function openSummonsModal() {
    // Clear form for new summons
    document.getElementById('summons-edit-id').value = '';
    document.getElementById('summons-complainant').value = '';
    document.getElementById('summons-respondent').value = '';
    document.getElementById('summons-case').value = '';
    document.getElementById('summons-date').value = '';
    document.getElementById('summons-time').value = '';
    document.getElementById('summons-location').value = 'Barangay Hall - Conference Room';
    document.getElementById('summons-modal-title').textContent = '📋 Schedule Summons';
    openModal('summonsModal');
}

// ==================== COURT CALENDAR ====================
let currentMonth = new Date();
let selectedDate = new Date();
let allBookings = [];

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
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startOfMonth = getLocalDateString(new Date(year, month, 1));
    const endOfMonth = getLocalDateString(new Date(year, month + 1, 0));
    try {
        const snapshot = await db.collection('courtBookings').where('date', '>=', startOfMonth).where('date', '<=', endOfMonth).get();
        allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { allBookings = []; }
}

function renderCalendarGrid() {
    const grid = document.getElementById('calendar-grid');
    if(!grid) return;
    const headers = Array.from(grid.children).slice(0, 7);
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getLocalDateString(new Date());
    const selectedStr = getLocalDateString(selectedDate);
    
    for (let i = 0; i < firstDayOfMonth; i++) grid.appendChild(document.createElement('div'));
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayBookings = allBookings.filter(b => b.date === dateStr);
        const cell = document.createElement('div');
        cell.className = `calendar-day ${dateStr === todayStr ? 'today' : ''} ${dateStr === selectedStr ? 'selected' : ''}`;
        cell.onclick = () => { selectedDate = new Date(year, month, day); renderCalendarGrid(); };
        
        let bookingsHtml = '';
        if (dayBookings.length > 0) {
            bookingsHtml = '<div class="grid-bookings">';
            dayBookings.forEach(b => {
                const time = (b.startTime && b.endTime) ? `${b.startTime} - ${b.endTime}` : 'All Day';
                bookingsHtml += `<div class="grid-booking ${b.isAdminBooking ? 'admin' : ''}"><div class="grid-time">${time}</div><div class="grid-name">${escapeHtml(b.bookerName)}</div></div>`;
            });
            bookingsHtml += '</div>';
        }
        cell.innerHTML = `<div class="day-top"><div class="day-number">${day}</div></div>${bookingsHtml}`;
        grid.appendChild(cell);
    }
}

function changeMonth(delta) { currentMonth.setMonth(currentMonth.getMonth() + delta); initCalendar(false); }

function openBookingModal() {
    document.getElementById('court-date').value = getLocalDateString(selectedDate);
    openModal('courtModal');
}

async function bookCourt() {
    const name = document.getElementById('court-booker')?.value.trim();
    const date = document.getElementById('court-date')?.value;
    const start = document.getElementById('court-start-time')?.value;
    const end = document.getElementById('court-end-time')?.value;
    const activity = document.getElementById('court-activity')?.value;
    
    if (!name || !date || !start || !end) { showToast('Fill all fields.', 'warning'); return; }
    if (start >= end) { showToast('End time must be after start.', 'warning'); return; }
    
    try {
        await db.collection('courtBookings').add({
            userId: currentUser.uid, bookerName: name, date, startTime: start, endTime: end, activity,
            isAdminBooking: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('courtModal');
        showToast('Booking Confirmed!', 'success');
        await fetchMonthBookings();
        renderCalendarGrid();
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

// ==================== ANNOUNCEMENTS FUNCTIONS ====================

async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    const addBtn = document.getElementById('add-announcement-btn');
    
    if (!container) return;
    
    // Show Add button only for admins
    if (userRole === 'admin') {
        if (addBtn) addBtn.style.display = 'inline-flex';
    } else {
        if (addBtn) addBtn.style.display = 'none';
    }
    
    container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">⏳ Loading...</p>';
    
    try {
        const snap = await db.collection('announcements').orderBy('createdAt', 'desc').get();
        const announcements = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (announcements.length === 0) { 
            container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:60px 20px;">📭 No announcements yet.</p>'; 
            return; 
        }
        
        container.innerHTML = announcements.map(a => {
            const categoryLabel = categoryConfig[a.category]?.label || '📢 General';
            const categoryClass = categoryConfig[a.category]?.class || 'cat-general';
            const dateStr = a.createdAt ? new Date(a.createdAt.toDate()).toLocaleDateString() : 'N/A';
            
            return `
                <div class="announcement-card">
                    <div class="announcement-header">
                        <div>
                            <span class="complaint-category ${categoryClass}">${categoryLabel}</span>
                            <div class="announcement-title">${escapeHtml(a.title)}</div>
                        </div>
                        ${userRole === 'admin' ? `
                            <div class="announcement-actions">
                                <button class="btn btn-sm btn-outline" onclick="editAnnouncement('${a.id}')">✏️ Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${a.id}')">🗑️ Delete</button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="announcement-content">${escapeHtml(a.content)}</div>
                    <div class="announcement-meta">
                        <span>📅 ${dateStr}</span>
                        <span>👤 ${escapeHtml(a.createdBy || 'Admin')}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) { 
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color:var(--danger); padding:20px;">Error loading announcements.</p>'; 
    }
}

async function saveAnnouncement() {
    const editId = document.getElementById('announcement-edit-id')?.value;
    const title = document.getElementById('announcement-title')?.value.trim();
    const content = document.getElementById('announcement-content')?.value.trim();
    const category = document.getElementById('announcement-category')?.value;
    
    if (!title || !content) { 
        showToast('Please fill in Title and Content.', 'warning'); 
        return; 
    }
    
    try {
        if (editId) {
            // Update existing
            await db.collection('announcements').doc(editId).update({
                title: title,
                content: content,
                category: category,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Announcement updated!', 'success');
        } else {
            // Create new
            await db.collection('announcements').add({
                title: title,
                content: content,
                category: category || 'general',
                createdBy: currentUser.email || 'Admin',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Announcement posted!', 'success');
        }
        
        closeModal('announcementModal');
        loadAnnouncements();
        
        // Clear inputs
        document.getElementById('announcement-edit-id').value = '';
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-content').value = '';
        
    } catch (error) { 
        showToast('Failed: ' + error.message, 'danger'); 
    }
}

async function editAnnouncement(id) {
    if (userRole !== 'admin') return;
    
    try {
        const doc = await db.collection('announcements').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('announcement-edit-id').value = id;
            document.getElementById('announcement-title').value = data.title || '';
            document.getElementById('announcement-content').value = data.content || '';
            document.getElementById('announcement-category').value = data.category || 'general';
            document.getElementById('announcement-modal-title').textContent = '✏️ Edit Announcement';
            openModal('announcementModal');
        }
    } catch (error) {
        showToast('Error loading announcement', 'danger');
    }
}

async function deleteAnnouncement(id) {
    if (userRole !== 'admin') return;
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
        await db.collection('announcements').doc(id).delete();
        showToast('Announcement deleted', 'success');
        loadAnnouncements();
    } catch (error) {
        showToast('Failed to delete: ' + error.message, 'danger');
    }
}

function openAnnouncementModal() {
    // Clear form for new announcement
    document.getElementById('announcement-edit-id').value = '';
    document.getElementById('announcement-title').value = '';
    document.getElementById('announcement-content').value = '';
    document.getElementById('announcement-category').value = 'general';
    document.getElementById('announcement-modal-title').textContent = '📢 Add Announcement';
    openModal('announcementModal');
}
// ==================== ACCOUNT PAGE ====================
function switchAccountTab(tabId, btn) {
    document.querySelectorAll('.account-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.account-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    btn.classList.add('active');
}

async function loadAccountPage() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
            setVal('acc-first-name', data.firstName);
            setVal('acc-last-name', data.lastName);
            setVal('acc-email', data.email);
            setVal('acc-purok', data.purok);
        }
    } catch (e) { console.error(e); }
}

async function saveAccountProfile() {
    const fn = document.getElementById('acc-first-name')?.value.trim();
    const ln = document.getElementById('acc-last-name')?.value.trim();
    const pk = document.getElementById('acc-purok')?.value;
    if (!fn || !ln) { showToast('Name is required', 'warning'); return; }
    try {
        await db.collection('profiles').doc(currentUser.uid).update({ firstName: fn, lastName: ln, purok: pk });
        showToast('Profile updated!', 'success');
        loadUserProfile();
    } catch (e) { showToast('Error: ' + e.message, 'danger'); }
}

// ==================== MAP ====================
function initMap() {
    if (mapInstance || !document.getElementById('map')) return;
    mapInstance = L.map('map').setView([13.4205, 123.4194], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    L.marker([13.4205, 123.4194]).addTo(mapInstance).bindPopup('Barangay Hall');
}

// ==================== LOGIN / SIGNUP (FIXED) ====================
window.handleLogin = async () => {
    const e = document.getElementById('login-email')?.value;
    const p = document.getElementById('login-password')?.value;
    if(!e||!p) return alert('Enter credentials');
    try { await auth.signInWithEmailAndPassword(e,p); } catch(err) { alert(err.message); }
};

// FIXED SIGNUP FUNCTION - This saves to Firestore ✅
window.handleSignup = async () => {
    const email = document.getElementById('signup-email')?.value.trim();
    const pass = document.getElementById('signup-password')?.value;
    const fname = document.getElementById('signup-fname')?.value.trim();
    const lname = document.getElementById('signup-lname')?.value.trim();
    const purok = document.getElementById('signup-purok')?.value;
    
    if (!email || !pass || !fname || !lname || !purok) {
        alert('Please fill in all fields.');
        return;
    }
    if (pass.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }

    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        // 2. SAVE PROFILE TO FIRESTORE DATABASE ✅
        await db.collection('profiles').doc(user.uid).set({
            firstName: fname,
            lastName: lname,
            email: email,
            purok: purok,
            role: 'resident',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Account created successfully! Please log in.');
        
        // Switch to login form
        toggleAuthMode('login');
        
        // Clear inputs
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-fname').value = '';
        document.getElementById('signup-lname').value = '';
        document.getElementById('signup-purok').value = '';

    } catch (error) {
        console.error("Signup Error:", error);
        alert('Error: ' + error.message);
    }
};

window.toggleAuthMode = (m) => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    if(loginForm) loginForm.style.display = m==='login'?'block':'none';
    if(signupForm) signupForm.style.display = m==='signup'?'block':'none';
};

// ==================== GLOBAL EXPORTS ====================
window.initCalendar = initCalendar;
window.changeMonth = changeMonth;
window.openBookingModal = openBookingModal;
window.bookCourt = bookCourt;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.handleLogout = handleLogout;
window.toggleProfileDropdown = window.toggleProfileDropdown;
window.saveAccountProfile = saveAccountProfile;
window.switchAccountTab = switchAccountTab;
window.submitComplaint = submitComplaint;
window.filterComplaints = filterComplaints;
window.updateComplaintStatus = updateComplaintStatus;
window.renderResidents = renderResidents;
window.addSummons = addSummons;
window.loadAnnouncements = loadAnnouncements;
window.saveAnnouncement = saveAnnouncement;
window.openAnnouncementModal = function() { openModal('announcementModal'); };
window.saveAnnouncement = saveAnnouncement;
window.loadAccountPage = loadAccountPage;
window.loadAnnouncements = loadAnnouncements;
window.saveAnnouncement = saveAnnouncement;
window.editAnnouncement = editAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.openAnnouncementModal = openAnnouncementModal;
window.renderSummons = renderSummons;
window.saveSummons = saveSummons;
window.editSummons = editSummons;
window.deleteSummons = deleteSummons;
window.openSummonsModal = openSummonsModal;

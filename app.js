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
let accountDropdownOpen = false;

// Detect current page
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// Category & Status configs
const categoryConfig = {
    roadwork: { label: '🚧 Roadwork', class: 'cat-roadwork' },
    lightpost: { label: '💡 Lightpost', class: 'cat-lightpost' },
    drainage: { label: '🔧 Drainage', class: 'cat-drainage' },
    noise: { label: '📢 Noise', class: 'cat-noise' },
    garbage: { label: '🗑️ Garbage', class: 'cat-garbage' },
    other: { label: '📌 Other', class: 'cat-other' },
    general: { label: '📢 General', class: 'cat-general' },
    infrastructure: { label: '🚧 Infrastructure', class: 'cat-infrastructure' },
    utilities: { label: '💡 Utilities', class: 'cat-utilities' },
    sanitation: { label: '🗑️ Sanitation', class: 'cat-sanitation' },
    events: { label: '🎉 Events', class: 'cat-events' }
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
    // Check if we are on the login page
    const isLoginPage = currentPage === 'login.html';

    if (user) {
        currentUser = user;
        
        // If already logged in and on login page, redirect to dashboard
        if (isLoginPage) {
            window.location.href = 'index.html';
            return;
        }

        await loadUserProfile();
        
        // Hide auth overlay, show app wrapper (if they exist)
        const authOverlay = document.getElementById('auth-overlay');
        const appWrapper = document.getElementById('app-wrapper');
        
        if (authOverlay) authOverlay.style.display = 'none';
        if (appWrapper) appWrapper.style.display = 'block';
        
        initializeApp();
    } else {
        currentUser = null;
        
        // If not logged in and NOT on login page, redirect to login
        if (!isLoginPage) {
            window.location.href = 'login.html';
            return;
        }

        // Show auth overlay if on login page
        const authOverlay = document.getElementById('auth-overlay');
        if (authOverlay) authOverlay.style.display = 'flex';
    }
});

function toggleAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authError = document.getElementById('auth-error');
    
    if (loginForm) loginForm.style.display = mode === 'login' ? 'block' : 'none';
    if (signupForm) signupForm.style.display = mode === 'signup' ? 'block' : 'none';
    if (authError) authError.style.display = 'none';
}

async function handleSignup() {
    const email = document.getElementById('signup-email')?.value.trim();
    const password = document.getElementById('signup-password')?.value;
    const fname = document.getElementById('signup-fname')?.value.trim();
    const lname = document.getElementById('signup-lname')?.value.trim();
    const purok = document.getElementById('signup-purok')?.value;
    
    if (!email || !password || !fname || !lname || !purok) { 
        showAuthError('Please fill all fields.'); return; 
    }
    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters.'); return;
    }
    
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('profiles').doc(cred.user.uid).set({ 
            firstName: fname, lastName: lname, purok, email, 
            role: 'resident', createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        showToast('Account created! Please verify your email.', 'success');
    } catch (error) { showAuthError(error.message); }
}

async function handleLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) { showAuthError('Please enter email and password.'); return; }
    try { await auth.signInWithEmailAndPassword(email, password); } 
    catch (error) { showAuthError('Invalid email or password.'); }
}

async function handleLogout() {
    await auth.signOut();
    window.location.href = 'login.html';
}

function showAuthError(message) {
    const el = document.getElementById('auth-error');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

async function loadUserProfile() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            // Update Topbar User Info (if elements exist)
            const userNameEl = document.getElementById('user-name');
            const userRoleEl = document.getElementById('user-role');
            const userAvatarEl = document.getElementById('user-avatar');
            
            if (userNameEl) userNameEl.textContent = `${data.firstName} ${data.lastName}`;
            if (userRoleEl) userRoleEl.textContent = data.role === 'admin' ? 'Barangay Admin' : 'Resident';
            if (userAvatarEl) userAvatarEl.textContent = `${data.firstName[0]}${data.lastName[0]}`;
            
            userRole = data.role;
            
            // Show admin-only buttons (if they exist)
            if (userRole === 'admin') {
                const summonsBtn = document.getElementById('schedule-summons-btn');
                const announceBtn = document.getElementById('add-announcement-btn');
                const courtBtn = document.getElementById('admin-court-btn');
                
                if (summonsBtn) summonsBtn.style.display = 'inline-flex';
                if (announceBtn) announceBtn.style.display = 'inline-flex';
                if (courtBtn) courtBtn.style.display = 'inline-flex';
            }
        }
    } catch (error) { console.error('Profile load error:', error); }
}

// ==================== NAVIGATION & UI ====================
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

// Close modals on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('show');
    }
});

// ==================== ACCOUNT DROPDOWN ====================
function toggleAccountDropdown() {
    const dropdown = document.getElementById('accountDropdown');
    if (!dropdown) return;
    
    accountDropdownOpen = !accountDropdownOpen;
    if (accountDropdownOpen) {
        dropdown.classList.add('show');
        updateDropdownInfo();
    } else { 
        dropdown.classList.remove('show'); 
    }
}

document.addEventListener('click', function(e) {
    if (!accountDropdownOpen) return;
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.getElementById('accountDropdown');
    if (userProfile && dropdown && !userProfile.contains(e.target) && !dropdown.contains(e.target)) { 
        toggleAccountDropdown(); 
    }
});

function updateDropdownInfo() {
    if (!currentUser) return;
    const nameEl = document.getElementById('dropdown-name');
    const emailEl = document.getElementById('dropdown-email');
    const avatarEl = document.getElementById('dropdown-avatar');
    
    if (nameEl) nameEl.textContent = `${currentUser.displayName || currentUser.email.split('@')[0]}`;
    if (emailEl) emailEl.textContent = currentUser.email;
    if (avatarEl) {
        const initials = (currentUser.displayName || currentUser.email).split(' ').map(n => n[0]).join('').toUpperCase();
        avatarEl.textContent = initials;
    }
}

function openAccountModal() { 
    toggleAccountDropdown(); 
    loadAccountData(); 
    openModal('accountModal'); 
}

function closeAccountModal() { 
    closeModal('accountModal'); 
}

function openAccountSettings() { 
    toggleAccountDropdown(); 
    openAccountModal(); 
    switchTab('security'); 
}

async function loadAccountData() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('profiles').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const initials = `${data.firstName[0]}${data.lastName[0]}`.toUpperCase();
            
            const picLarge = document.getElementById('profile-picture-large');
            if (picLarge) {
                picLarge.textContent = initials;
                picLarge.style.background = stringToColor(data.firstName + data.lastName);
            }
            
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            
            setVal('edit-first-name', data.firstName);
            setVal('edit-last-name', data.lastName);
            setVal('edit-email', data.email);
            setVal('edit-purok', data.purok);
            setVal('edit-phone', data.phone);
            
            const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
            setCheck('email-notifications', data.emailNotifications !== false);
            setCheck('complaint-notifications', data.complaintNotifications !== false);
            setCheck('summons-notifications', data.summonsNotifications !== false);
        }
    } catch (error) { console.error('Account data error:', error); }
}

function switchTab(tabName) {
    document.querySelectorAll('.account-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.account-tab-content').forEach(content => content.classList.remove('active'));
    
    // Find the button that was clicked (or passed via event)
    if (event && event.target) event.target.classList.add('active');
    
    const content = document.getElementById(`${tabName}-tab`);
    if (content) content.classList.add('active');
}

function updateProfilePicture(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const picLarge = document.getElementById('profile-picture-large');
        if (picLarge) {
            picLarge.style.backgroundImage = `url(${e.target.result})`;
            picLarge.style.backgroundSize = 'cover';
            picLarge.textContent = '';
        }
    };
    reader.readAsDataURL(file);
    showToast('Profile picture updated!', 'success');
}

async function saveProfileChanges() {
    const firstName = document.getElementById('edit-first-name')?.value.trim();
    const lastName = document.getElementById('edit-last-name')?.value.trim();
    const email = document.getElementById('edit-email')?.value.trim();
    const purok = document.getElementById('edit-purok')?.value;
    const phone = document.getElementById('edit-phone')?.value.trim();
    
    if (!firstName || !lastName || !email) { showToast('Please fill in required fields.', 'warning'); return; }
    
    try {
        await db.collection('profiles').doc(currentUser.uid).update({ 
            firstName, lastName, email, purok, phone, 
            updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        if (email !== currentUser.email) await currentUser.updateEmail(email);
        await currentUser.updateProfile({ displayName: `${firstName} ${lastName}` });
        
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = `${firstName} ${lastName}`;
        
        showToast('Profile updated successfully!', 'success');
        closeAccountModal();
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

async function changePassword() {
    const currentPassword = document.getElementById('current-password')?.value;
    const newPassword = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) { showToast('Fill all password fields.', 'warning'); return; }
    if (newPassword.length < 6) { showToast('Min 6 chars.', 'warning'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match.', 'danger'); return; }
    
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updatePassword(newPassword);
        
        ['current-password', 'new-password', 'confirm-password'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        
        showToast('Password updated!', 'success');
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

async function saveNotificationSettings() {
    try {
        await db.collection('profiles').doc(currentUser.uid).update({
            emailNotifications: document.getElementById('email-notifications')?.checked,
            complaintNotifications: document.getElementById('complaint-notifications')?.checked,
            summonsNotifications: document.getElementById('summons-notifications')?.checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Preferences saved!', 'success');
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

function viewMyComplaints() { 
    toggleAccountDropdown(); 
    window.location.href = 'complaints.html'; 
}

// ==================== DATA LOADING FUNCTIONS ====================

async function fetchComplaints() {
    const snapshot = await db.collection('complaints').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function renderComplaints(filter = 'all', elementId = 'complaintList') {
    const container = document.getElementById(elementId);
    if (!container) return; // Exit if element doesn't exist on this page
    
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading...</p>';
    
    try {
        const complaints = await fetchComplaints();
        const filtered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);
        
        if (filtered.length === 0) { 
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">No complaints found.</p>'; 
            return; 
        }
        
        container.innerHTML = filtered.map(c => `
            <div class="complaint-item">
                <div class="complaint-header">
                    <span class="complaint-category ${categoryConfig[c.category]?.class || 'cat-other'}">${categoryConfig[c.category]?.label || '📌 Other'}</span>
                    ${userRole === 'admin' ? `
                        <select class="status-dropdown" onchange="updateComplaintStatus('${c.id}', this.value)">
                            <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="progress" ${c.status === 'progress' ? 'selected' : ''}>🔄 In Progress</option>
                            <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
                        </select>
                    ` : `<span class="status-badge ${statusConfig[c.status]?.class || 'status-pending'}"><span class="status-dot"></span> ${statusConfig[c.status]?.label || 'Pending'}</span>`}
                </div>
                <div class="complaint-title">${escapeHtml(c.title)}</div>
                <div class="complaint-desc">${escapeHtml(c.description)}</div>
                <div class="complaint-meta">
                    <span>👤 ${escapeHtml(c.userName || 'Unknown')}</span>
                    <span>📍 ${escapeHtml(c.purok)}</span>
                    <span>🕐 ${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="color:red">Error loading complaints.</p>`;
    }
}

async function submitComplaint() {
    const category = document.getElementById('complaint-category')?.value;
    const title = document.getElementById('complaint-title')?.value.trim();
    const description = document.getElementById('complaint-desc')?.value.trim();
    const purok = document.getElementById('complaint-purok')?.value;
    
    if (!category || !title || !description || !purok) { showToast('Fill all fields.', 'warning'); return; }
    
    try {
        await db.collection('complaints').add({ 
            userId: currentUser.uid, userName: currentUser.email, category, title, description, purok, 
            status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        closeModal('complaintModal'); 
        showToast('Complaint filed!', 'success'); 
        
        // Refresh if on complaints page
        if (currentPage === 'complaints.html') renderComplaints();
        if (currentPage === 'index.html') loadRecentComplaints();
        
        // Clear form
        ['complaint-category', 'complaint-title', 'complaint-desc', 'complaint-purok'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

async function updateComplaintStatus(id, status) {
    if (userRole !== 'admin') return;
    try {
        await db.collection('complaints').doc(id).update({ status });
        showToast(`Marked as ${status}`, 'success'); 
        if (currentPage === 'complaints.html') renderComplaints();
    } catch (error) { showToast('Update failed', 'danger'); }
}

function filterComplaints(filter, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderComplaints(filter);
}

// Residents
async function renderResidents() {
    const container = document.getElementById('residentGrid');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading...</p>';
    try {
        const snapshot = await db.collection('profiles').orderBy('lastName').get();
        const residents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        container.innerHTML = residents.map(r => `
            <div class="resident-card">
                <div class="resident-avatar" style="background:${stringToColor(r.firstName + r.lastName)}">${r.firstName[0]}${r.lastName[0]}</div>
                <div class="resident-name">${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</div>
                <div class="resident-address">${escapeHtml(r.purok)} • ${escapeHtml(r.phone || 'N/A')}</div>
                <div class="resident-info">
                    <div><div class="label">Role</div><div class="value">${r.role}</div></div>
                    <div><div class="label">Joined</div><div class="value">${r.createdAt ? new Date(r.createdAt.toDate()).toLocaleDateString() : 'N/A'}</div></div>
                </div>
            </div>
        `).join('');
    } catch (error) { container.innerHTML = '<p>Error loading residents.</p>'; }
}

// Summons
async function renderSummons() {
    const container = document.getElementById('summonsList');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading...</p>';
    try {
        const snapshot = await db.collection('summons').orderBy('date', 'asc').get();
        const summons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (summons.length === 0) { container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">No scheduled summons.</p>'; return; }
        
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
                    <span class="status-badge status-confirmed"><span class="status-dot"></span> Confirmed</span>
                </div>
            </div>
        `).join('');
    } catch (error) { container.innerHTML = '<p>Error loading summons.</p>'; }
}

async function addSummons() {
    const complainantName = document.getElementById('summons-complainant')?.value.trim();
    const respondentName = document.getElementById('summons-respondent')?.value.trim();
    const caseTitle = document.getElementById('summons-case')?.value.trim();
    const date = document.getElementById('summons-date')?.value;
    const time = document.getElementById('summons-time')?.value;
    const location = document.getElementById('summons-location')?.value;
    
    if (!complainantName || !respondentName || !caseTitle || !date || !time) { showToast('Fill all fields.', 'warning'); return; }
    
    try {
        await db.collection('summons').add({
            complainantName, respondentName, caseTitle, date, time, location,
            status: 'confirmed', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('summonsModal'); showToast('Summons scheduled!', 'success'); renderSummons();
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

// ==================== COURT BOOKINGS (CUSTOM TIME) ====================

// Operating hours
const COURT_OPEN = 6;  // 6 AM
const COURT_CLOSE = 19; // 7 PM

// Render court schedule with custom time support
async function renderCourt(selectedDate = new Date().toISOString().split('T')[0]) {
    const container = document.getElementById('courtSchedule');
    const timeline = document.getElementById('court-timeline');
    const dateTitle = document.getElementById('courtDateTitle');
    const datePicker = document.getElementById('court-date-picker');
    
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">⏳ Loading schedule...</p>';
    if (timeline) timeline.innerHTML = timeline.innerHTML.split('<!-- Bookings -->')[0] || timeline.innerHTML;
    
    try {
        const queryDate = selectedDate || new Date().toISOString().split('T')[0');
        
        // Update UI
        if (datePicker) datePicker.value = queryDate;
        if (dateTitle) {
            const formatted = new Date(queryDate).toLocaleDateString('en-US', { 
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
            });
            dateTitle.textContent = formatted;
        }
        
        // Fetch bookings
        let bookings = [];
        try {
            const snapshot = await db.collection('courtBookings')
                .where('date', '==', queryDate)
                .get();
            bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (queryError) {
            console.warn('Query failed, using fallback:', queryError.message);
            const allSnapshot = await db.collection('courtBookings').get();
            bookings = allSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(b => b.date === queryDate);
        }
        
        // Render timeline
        if (timeline) renderTimeline(timeline, bookings, queryDate);
        
        // Render grid (fallback)
        renderScheduleGrid(container, bookings, queryDate);
        
    } catch (error) {
        console.error('Court render error:', error);
        container.innerHTML = `<p style="text-align:center; color:var(--danger); padding:20px;">⚠️ Error loading schedule. Please try again.</p>`;
    }
}

// Render visual timeline with clickable available blocks
function renderTimeline(container, bookings, date) {
    // Clear existing bookings/available blocks (keep hour markers)
    const existing = container.querySelectorAll('.timeline-booking, .timeline-available');
    existing.forEach(el => el.remove());
    
    // Convert bookings to time ranges for overlap detection
    const bookedRanges = bookings.map(b => ({
        start: timeToMinutes(b.startTime || b.timeSlot?.split(' - ')[0]),
        end: timeToMinutes(b.endTime || b.timeSlot?.split(' - ')[1]),
        booking: b
    })).filter(r => r.start && r.end);
    
    // Find available blocks (simplified: check each hour)
    const availableBlocks = [];
    for (let hour = COURT_OPEN; hour < COURT_CLOSE; hour++) {
        const blockStart = hour * 60;
        const blockEnd = (hour + 1) * 60;
        
        // Check if this hour is free
        const isFree = !bookedRanges.some(r => 
            (blockStart < r.end && blockEnd > r.start) // Overlap detection
        );
        
        if (isFree) {
            availableBlocks.push({
                start: hour,
                end: hour + 1,
                left: ((hour - COURT_OPEN) / (COURT_CLOSE - COURT_OPEN)) * 100,
                width: (1 / (COURT_CLOSE - COURT_OPEN)) * 100
            });
        }
    }
    
    // Render available blocks (clickable)
    availableBlocks.forEach(block => {
        const el = document.createElement('div');
        el.className = 'timeline-available';
        el.style.left = `${block.left}%`;
        el.style.width = `${block.width}%`;
        el.textContent = '📅 Book';
        el.title = `Available: ${block.start}:00 - ${block.end}:00`;
        el.onclick = () => {
            const startStr = `${String(block.start).padStart(2,'0')}:00`;
            const endStr = `${String(block.end).padStart(2,'0')}:00`;
            openBookingModal(date, startStr, endStr);
        };
        container.appendChild(el);
    });
    
    // Render existing bookings
    bookings.forEach(b => {
        const startMin = timeToMinutes(b.startTime || b.timeSlot?.split(' - ')[0]);
        const endMin = timeToMinutes(b.endTime || b.timeSlot?.split(' - ')[1]);
        if (!startMin || !endMin) return;
        
        const left = ((startMin/60 - COURT_OPEN) / (COURT_CLOSE - COURT_OPEN)) * 100;
        const width = ((endMin - startMin)/60 / (COURT_CLOSE - COURT_OPEN)) * 100;
        
        const el = document.createElement('div');
        el.className = `timeline-booking ${b.isAdminBooking ? 'admin' : 'user'}`;
        el.style.left = `${Math.max(0, left)}%`;
        el.style.width = `${Math.min(100-left, width)}%`;
        el.textContent = b.bookerName?.split(' ')[0] || 'Booked';
        el.title = `${b.bookerName}: ${formatTime(b.startTime)} - ${formatTime(b.endTime)}\n${b.activity}`;
        el.onclick = (e) => {
            e.stopPropagation();
            if (userRole === 'admin') {
                openAdminCourtModal({ id: b.id, ...b });
            }
        };
        container.appendChild(el);
    });
}

// Render schedule grid (fallback/list view)
function renderScheduleGrid(container, bookings, date) {
    // Group bookings by hour for display
    const hourlySlots = [];
    for (let h = COURT_OPEN; h < COURT_CLOSE; h++) {
        const slotStart = `${String(h).padStart(2,'0')}:00`;
        const slotEnd = `${String(h+1).padStart(2,'0')}:00`;
        
        // Find bookings that overlap this hour
        const overlapping = bookings.filter(b => {
            const bStart = timeToMinutes(b.startTime || b.timeSlot?.split(' - ')[0]);
            const bEnd = timeToMinutes(b.endTime || b.timeSlot?.split(' - ')[1]);
            const hStart = h * 60;
            const hEnd = (h+1) * 60;
            return bStart && bEnd && (hStart < bEnd && hEnd > bStart);
        });
        
        hourlySlots.push({
            time: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
            booked: overlapping.length > 0,
            bookings: overlapping,
            isAdmin: overlapping.some(b => b.isAdminBooking)
        });
    }
    
    container.innerHTML = hourlySlots.map(slot => `
        <div class="schedule-slot ${slot.booked ? (slot.isAdmin ? 'admin-booked' : 'booked') : 'available'}"
             ${!slot.booked ? `onclick="openBookingModal('${date}', '${slot.time.split(' - ')[0].replace(/[^0-9:]/g,'')}', '${slot.time.split(' - ')[1].replace(/[^0-9:]/g,'')}')"` : ''}>
            
            <div class="slot-time">${slot.time}</div>
            <div class="slot-status">${slot.booked ? 'Booked' : 'Available'}</div>
            
            ${slot.booked ? `
                <div class="slot-booker">
                    <strong>${escapeHtml(slot.bookings[0].bookerName)}</strong>
                    ${escapeHtml(slot.bookings[0].activity)}
                </div>
            ` : `<div class="slot-cta">📅 Click to Book</div>`}
        </div>
    `).join('');
}

// Book court with custom time range
async function bookCourt() {
    const bookerName = document.getElementById('court-booker')?.value.trim();
    const date = document.getElementById('court-date')?.value;
    const startTime = document.getElementById('court-start-time')?.value;
    const endTime = document.getElementById('court-end-time')?.value;
    const activity = document.getElementById('court-activity')?.value;
    
    if (!bookerName || !date || !startTime || !endTime) { 
        showToast('Please fill all required fields.', 'warning'); 
        return; 
    }
    
    // Validate time range
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
        showToast('End time must be after start time.', 'danger');
        return;
    }
    if (startMin < COURT_OPEN*60 || endMin > COURT_CLOSE*60) {
        showToast(`Court hours: ${COURT_OPEN}:00 AM - ${COURT_CLOSE}:00 PM`, 'warning');
        return;
    }
    
    try {
        // Check for overlaps
        const existing = await db.collection('courtBookings')
            .where('date', '==', date)
            .get();
            
        const hasOverlap = existing.docs.some(doc => {
            const b = doc.data();
            const bStart = timeToMinutes(b.startTime || b.timeSlot?.split(' - ')[0]);
            const bEnd = timeToMinutes(b.endTime || b.timeSlot?.split(' - ')[1]);
            return bStart && bEnd && (startMin < bEnd && endMin > bStart);
        });
        
        if (hasOverlap) { 
            showToast('This time range overlaps with an existing booking.', 'danger'); 
            renderCourt(date); // Refresh to show updated status
            return; 
        }
        
        // Create booking with custom time
        await db.collection('courtBookings').add({
            userId: currentUser.uid, 
            bookerName, 
            date, 
            startTime,
            endTime,
            activity,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeModal('courtModal'); 
        showToast(`✅ Court booked: ${formatTime(startTime)} - ${formatTime(endTime)}!`, 'success'); 
        renderCourt(date);
        
        // Clear form
        ['court-booker', 'court-activity'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        
    } catch (error) {
        console.error('Booking error:', error);
        showToast('Booking failed: ' + error.message, 'danger');
    }
}

// Helper: Convert time string to minutes
function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    // Handle both "HH:MM" and "HH:MM AM/PM" formats
    const clean = timeStr.replace(/[^0-9:]/g, '');
    const [h, m] = clean.split(':').map(Number);
    return h * 60 + (m || 0);
}

// Helper: Format minutes to readable time
function formatTime(timeStr) {
    if (!timeStr) return '';
    const clean = timeStr.replace(/[^0-9:]/g, '');
    const [h, m] = clean.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m||'00').padStart(2,'0')} ${ampm}`;
}

// Filter court view
function filterCourt(period, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    let targetDate = new Date();
    if (period === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    
    renderCourt(targetDate.toISOString().split('T')[0]);
}

// Change date
function changeDate(days) {
    const picker = document.getElementById('court-date-picker');
    if (!picker) return;
    
    const currentDate = new Date(picker.value || new Date());
    currentDate.setDate(currentDate.getDate() + days);
    
    const newDate = currentDate.toISOString().split('T')[0];
    picker.value = newDate;
    renderCourt(newDate);
}

// ==================== ADMIN COURT (Updated for custom time) ====================

function openAdminCourtModal(editBooking = null) {
    if (userRole !== 'admin') {
        showToast('Admin access required.', 'warning');
        return;
    }
    
    const dateInput = document.getElementById('admin-court-date');
    const startInput = document.getElementById('admin-start-time');
    const endInput = document.getElementById('admin-end-time');
    
    if (!dateInput || !startInput || !endInput) return;
    
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = editBooking?.date || today;
    
    if (editBooking) {
        startInput.value = editBooking.startTime || editBooking.timeSlot?.split(' - ')[0]?.replace(/[^0-9:]/g,'') || '06:00';
        endInput.value = editBooking.endTime || editBooking.timeSlot?.split(' - ')[1]?.replace(/[^0-9:]/g,'') || '07:00';
        document.getElementById('admin-court-booker').value = editBooking.bookerName || '';
        document.getElementById('admin-court-activity').value = editBooking.activity || 'Other';
        document.getElementById('admin-court-modal-title').textContent = '✏️ Edit Booking';
        document.getElementById('admin-court-action-btn').textContent = '💾 Update';
        document.getElementById('admin-court-action-btn').dataset.action = 'update';
        document.getElementById('admin-court-action-btn').dataset.id = editBooking.id;
    } else {
        startInput.value = '06:00';
        endInput.value = '08:00';
        document.getElementById('admin-court-booker').value = '';
        document.getElementById('admin-court-activity').value = 'Basketball Practice';
        document.getElementById('admin-court-modal-title').textContent = '⚙️ Court Booking Manager';
        document.getElementById('admin-court-action-btn').textContent = '✅ Book/Override';
        document.getElementById('admin-court-action-btn').dataset.action = 'book';
        document.getElementById('admin-court-action-btn').dataset.id = '';
    }
    
    loadAdminCourtList(editBooking?.date || today);
    openModal('adminCourtModal');
}

async function adminBookCourt() {
    if (userRole !== 'admin') { showToast('Admin access required.', 'warning'); return; }
    
    const date = document.getElementById('admin-court-date')?.value;
    const startTime = document.getElementById('admin-start-time')?.value;
    const endTime = document.getElementById('admin-end-time')?.value;
    const bookerName = document.getElementById('admin-court-booker')?.value.trim() || 'Admin Override';
    const activity = document.getElementById('admin-court-activity')?.value;
    const actionBtn = document.getElementById('admin-court-action-btn');
    const action = actionBtn?.dataset.action || 'book';
    const bookingId = actionBtn?.dataset.id;
    
    if (!date || !startTime || !endTime) { showToast('Select date and time range.', 'warning'); return; }
    
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) { showToast('End time must be after start time.', 'warning'); return; }
    
    if (actionBtn) { actionBtn.disabled = true; actionBtn.innerHTML = '⏳ Processing...'; }
    
    try {
        if (action === 'update' && bookingId) {
            await db.collection('courtBookings').doc(bookingId).update({
                bookerName, activity, startTime, endTime,
                updatedBy: currentUser.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Booking updated!', 'success');
        } else {
            // Check overlaps
            const existing = await db.collection('courtBookings')
                .where('date', '==', date)
                .get();
                
            const hasOverlap = existing.docs.some(doc => {
                const b = doc.data();
                const bStart = timeToMinutes(b.startTime || b.timeSlot?.split(' - ')[0]);
                const bEnd = timeToMinutes(b.endTime || b.timeSlot?.split(' - ')[1]);
                return bStart && bEnd && (startMin < bEnd && endMin > bStart);
            });
            
            if (hasOverlap) {
                if (!confirm('This time range overlaps with an existing booking. Override?')) {
                    resetAdminButton();
                    return;
                }
                // Find and update the overlapping booking
                const overlap = existing.docs.find(doc => {
                    const b = doc.data();
                    const bStart = timeToMinutes(b.startTime || b.timeSlot?.split(' - ')[0]);
                    const bEnd = timeToMinutes(b.endTime || b.timeSlot?.split(' - ')[1]);
                    return bStart && bEnd && (startMin < bEnd && endMin > bStart);
                });
                if (overlap) {
                    await overlap.ref.update({
                        bookerName, activity, startTime, endTime,
                        updatedBy: currentUser.email,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isAdminBooking: true
                    });
                    showToast('Booking overridden!', 'success');
                }
            } else {
                await db.collection('courtBookings').add({
                    userId: currentUser.uid, bookerName, date, startTime, endTime, activity,
                    createdBy: currentUser.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isAdminBooking: true
                });
                showToast('Slot booked by admin!', 'success');
            }
        }
        
        closeModal('adminCourtModal');
        if (currentPage === 'court.html') renderCourt(date);
        
    } catch (error) {
        showToast('Failed: ' + error.message, 'danger');
    } finally {
        resetAdminButton();
    }
    
    function resetAdminButton() {
        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.textContent = actionBtn.dataset.action === 'update' ? '💾 Update' : '✅ Book/Override';
        }
    }
}

// ... (adminRemoveBooking and loadAdminCourtList remain similar, just use startTime/endTime instead of timeSlot)

// Announcements
async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">Loading...</p>';
    try {
        const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').get();
        const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (announcements.length === 0) { container.innerHTML = '<p style="text-align:center; padding:40px; color:#7f8c8d;">No announcements.</p>'; return; }
        
        container.innerHTML = announcements.map(a => `
            <div class="announcement-card">
                <div class="announcement-header">
                    <div>
                        <span class="complaint-category cat-${a.category || 'general'}">${categoryConfig[a.category]?.label || '📢 General'}</span>
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
                    <span>📅 ${a.createdAt ? new Date(a.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                    <span>👤 ${escapeHtml(a.createdBy || 'Admin')}</span>
                </div>
            </div>
        `).join('');
    } catch (error) { container.innerHTML = '<p>Error loading announcements.</p>'; }
}

function openAnnouncementModal(editId = null) {
    const titleEl = document.getElementById('announcement-modal-title');
    if(titleEl) titleEl.textContent = editId ? '✏️ Edit Announcement' : '📢 Add Announcement';
    
    const editIdEl = document.getElementById('announcement-edit-id');
    if(editIdEl) editIdEl.value = editId || '';
    
    if (editId) {
        db.collection('announcements').doc(editId).get().then(doc => {
            if (doc.exists) {
                const data = doc.data();
                const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
                setVal('announcement-title', data.title);
                setVal('announcement-category', data.category);
                setVal('announcement-content', data.content);
            }
        });
    } else {
        ['announcement-title', 'announcement-content'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
        const catEl = document.getElementById('announcement-category'); if(catEl) catEl.value = 'general';
    }
    openModal('announcementModal');
}

async function saveAnnouncement() {
    const title = document.getElementById('announcement-title')?.value.trim();
    const category = document.getElementById('announcement-category')?.value;
    const content = document.getElementById('announcement-content')?.value.trim();
    const editId = document.getElementById('announcement-edit-id')?.value;
    
    if (!title || !content) { showToast('Fill title and content.', 'warning'); return; }
    
    try {
        const data = { title, category, content, updatedBy: currentUser.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (editId) {
            await db.collection('announcements').doc(editId).update(data);
            showToast('Updated!', 'success');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.createdBy = currentUser.email;
            await db.collection('announcements').add(data);
            showToast('Posted!', 'success');
        }
        closeModal('announcementModal'); loadAnnouncements();
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

async function editAnnouncement(id) { openAnnouncementModal(id); }
async function deleteAnnouncement(id) {
    if (!confirm('Delete?')) return;
    try {
        await db.collection('announcements').doc(id).delete();
        showToast('Deleted.', 'success'); loadAnnouncements();
    } catch (error) { showToast('Failed: ' + error.message, 'danger'); }
}

// Dashboard Stats & Recent Data
async function updateStats() {
    // Only run if elements exist
    if (!document.getElementById('stat-residents')) return;
    
    try {
        const residentsSnap = await db.collection('profiles').get();
        const complaintsSnap = await db.collection('complaints').where('status', '!=', 'resolved').get();
        const summonsSnap = await db.collection('summons').where('status', '==', 'confirmed').get();
        const today = new Date().toISOString().split('T')[0];
        const courtSnap = await db.collection('courtBookings').where('date', '==', today).get();
        
        const setStat = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setStat('stat-residents', residentsSnap.size);
        setStat('stat-complaints', complaintsSnap.size);
        setStat('stat-summons', summonsSnap.size);
        setStat('stat-court', courtSnap.size);
    } catch (error) { console.error('Stats error:', error); }
}

async function loadRecentComplaints() {
    const container = document.getElementById('recent-complaints');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('complaints').orderBy('createdAt', 'desc').limit(3).get();
        if (snapshot.empty) { container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:20px;">No recent complaints.</p>'; return; }
        
        container.innerHTML = snapshot.docs.map(doc => {
            const c = doc.data();
            return `
                <div class="complaint-item" style="padding:14px;">
                    <div class="complaint-header">
                        <span class="complaint-category ${categoryConfig[c.category]?.class || 'cat-other'}">${categoryConfig[c.category]?.label || '📌 Other'}</span>
                    </div>
                    <div class="complaint-title">${escapeHtml(c.title)}</div>
                    <div class="complaint-meta"><span>🕐 ${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span></div>
                </div>
            `;
        }).join('');
    } catch (error) { container.innerHTML = '<p>Error.</p>'; }
}

async function loadActivityTimeline() {
    const container = document.getElementById('activity-timeline');
    if (!container) return;
    
    try {
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
    } catch (error) { container.innerHTML = '<p>Error.</p>'; }
}

// Map
function initMap() {
    if (mapInstance) { mapInstance.invalidateSize(); return; }
    if (!document.getElementById('map')) return;
    
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

// Utilities
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function stringToColor(str) { let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash); const c = (hash & 0x00ffffff).toString(16).toUpperCase(); return '#' + '00000'.substring(0, 6 - c.length) + c; }
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', danger: '❌', warning: '⚠️' };
    toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ==================== INITIALIZATION ====================
async function initializeApp() {
    // Load data based on current page
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
        await renderCourt();
    }
    
    if (currentPage === 'map.html') {
        setTimeout(initMap, 100);
    }
    
    if (currentPage === 'announcements.html') {
        await loadAnnouncements();
    }
    
    // Set default dates for inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => { 
        if (!input.value) input.value = today; 
    });
}

// Expose functions globally for HTML onclick attributes
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.toggleAuthMode = toggleAuthMode;
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleAccountDropdown = toggleAccountDropdown;
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.openAccountSettings = openAccountSettings;
window.switchTab = switchTab;
window.updateProfilePicture = updateProfilePicture;
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
window.openAdminCourtModal = openAdminCourtModal;
window.adminBookCourt = adminBookCourt;
window.adminRemoveBooking = adminRemoveBooking;
window.openAnnouncementModal = openAnnouncementModal;
window.saveAnnouncement = saveAnnouncement;
window.editAnnouncement = editAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;

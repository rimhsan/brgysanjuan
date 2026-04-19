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

// ==================== ADMIN COURT MANAGEMENT (IMPROVED) ====================

// Open Admin Court Modal with pre-filled data if editing
function openAdminCourtModal(editBooking = null) {
    // Safety checks
    const dateInput = document.getElementById('admin-court-date');
    const slotSelect = document.getElementById('admin-court-slot');
    const bookerInput = document.getElementById('admin-court-booker');
    const activitySelect = document.getElementById('admin-court-activity');
    
    if (!dateInput || !slotSelect) {
        showToast('Admin court modal not found.', 'danger');
        return;
    }
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = editBooking?.date || today;
    
    // Populate time slots
    slotSelect.innerHTML = TIME_SLOTS.map(t => 
        `<option value="${t}" ${editBooking?.timeSlot === t ? 'selected' : ''}>${t}</option>`
    ).join('');
    
    // Pre-fill if editing existing booking
    if (editBooking) {
        if (bookerInput) bookerInput.value = editBooking.bookerName || '';
        if (activitySelect) activitySelect.value = editBooking.activity || 'Other';
        document.getElementById('admin-court-modal-title').textContent = '✏️ Edit Booking';
        document.getElementById('admin-court-action-btn').textContent = '💾 Update Booking';
        document.getElementById('admin-court-action-btn').dataset.action = 'update';
        document.getElementById('admin-court-action-btn').dataset.id = editBooking.id;
    } else {
        if (bookerInput) bookerInput.value = '';
        if (activitySelect) activitySelect.value = 'Basketball Practice';
        document.getElementById('admin-court-modal-title').textContent = '⚙️ Court Booking Manager';
        document.getElementById('admin-court-action-btn').textContent = '✅ Book/Override';
        document.getElementById('admin-court-action-btn').dataset.action = 'book';
        document.getElementById('admin-court-action-btn').dataset.id = '';
    }
    
    openModal('adminCourtModal');
}

// Admin Book/Override Court Slot
async function adminBookCourt() {
    // Admin check
    if (userRole !== 'admin') {
        showToast('Admin access required.', 'warning');
        return;
    }
    
    const dateInput = document.getElementById('admin-court-date');
    const slotSelect = document.getElementById('admin-court-slot');
    const bookerInput = document.getElementById('admin-court-booker');
    const activitySelect = document.getElementById('admin-court-activity');
    const actionBtn = document.getElementById('admin-court-action-btn');
    
    if (!dateInput || !slotSelect || !bookerInput || !activitySelect) {
        showToast('Modal fields not found.', 'danger');
        return;
    }
    
    const date = dateInput.value;
    const timeSlot = slotSelect.value;
    const bookerName = bookerInput.value.trim() || 'Admin Override';
    const activity = activitySelect.value;
    const action = actionBtn?.dataset.action || 'book';
    const bookingId = actionBtn?.dataset.id;
    
    // Validation
    if (!date) { showToast('Please select a date.', 'warning'); return; }
    if (!timeSlot) { showToast('Please select a time slot.', 'warning'); return; }
    
    // Show loading state
    if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.innerHTML = '⏳ Processing...';
    }
    
    try {
        if (action === 'update' && bookingId) {
            // Update existing booking
            await db.collection('courtBookings').doc(bookingId).update({
                bookerName,
                activity,
                updatedBy: currentUser.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Booking updated!', 'success');
        } else {
            // Check if slot is already booked (for new bookings)
            const existing = await db.collection('courtBookings')
                .where('date', '==', date)
                .where('timeSlot', '==', timeSlot)
                .get();
                
            if (!existing.empty && action !== 'override') {
                // Ask if admin wants to override
                if (!confirm(`This slot is already booked by "${existing.docs[0].data().bookerName}". Override?`)) {
                    if (actionBtn) {
                        actionBtn.disabled = false;
                        actionBtn.textContent = action === 'update' ? '💾 Update Booking' : '✅ Book/Override';
                    }
                    return;
                }
                // Override: update the existing doc
                await existing.docs[0].ref.update({
                    bookerName,
                    activity,
                    updatedBy: currentUser.email,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('Booking overridden!', 'success');
            } else {
                // Create new booking
                await db.collection('courtBookings').add({
                    userId: currentUser.uid,
                    bookerName,
                    date,
                    timeSlot,
                    activity,
                    createdBy: currentUser.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isAdminBooking: true
                });
                showToast('Slot booked by admin!', 'success');
            }
        }
        
        closeModal('adminCourtModal');
        
        // Refresh court view if on court page
        if (currentPage === 'court.html') {
            renderCourt(date);
        }
        
    } catch (error) {
        console.error('Admin court error:', error);
        showToast('Failed: ' + error.message, 'danger');
    } finally {
        // Reset button state
        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.textContent = action === 'update' ? '💾 Update Booking' : '✅ Book/Override';
        }
    }
}

// Admin Remove Booking
async function adminRemoveBooking() {
    if (userRole !== 'admin') {
        showToast('Admin access required.', 'warning');
        return;
    }
    
    const dateInput = document.getElementById('admin-court-date');
    const slotSelect = document.getElementById('admin-court-slot');
    
    if (!dateInput || !slotSelect) {
        showToast('Modal fields not found.', 'danger');
        return;
    }
    
    const date = dateInput.value;
    const timeSlot = slotSelect.value;
    
    if (!date || !timeSlot) {
        showToast('Please select date and time slot.', 'warning');
        return;
    }
    
    // Confirm deletion
    if (!confirm(`⚠️ Delete booking for ${timeSlot} on ${new Date(date).toLocaleDateString()}? This cannot be undone.`)) {
        return;
    }
    
    try {
        const snapshot = await db.collection('courtBookings')
            .where('date', '==', date)
            .where('timeSlot', '==', timeSlot)
            .get();
            
        if (snapshot.empty) {
            showToast('No booking found for this slot.', 'warning');
            return;
        }
        
        // Delete the booking
        await snapshot.docs[0].ref.delete();
        
        showToast('Booking removed.', 'success');
        closeModal('adminCourtModal');
        
        // Refresh court view
        if (currentPage === 'court.html') {
            renderCourt(date);
        }
        
    } catch (error) {
        console.error('Remove booking error:', error);
        showToast('Failed: ' + error.message, 'danger');
    }
}

// Admin: Load existing bookings into a list for management (optional enhancement)
async function loadAdminCourtList(date = null) {
    const container = document.getElementById('admin-court-list');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:20px;">⏳ Loading...</p>';
    
    try {
        let query = db.collection('courtBookings').orderBy('date', 'desc').orderBy('timeSlot');
        
        // Filter by date if provided
        if (date) {
            query = db.collection('courtBookings')
                .where('date', '==', date)
                .orderBy('timeSlot');
        }
        
        const snapshot = await query.get();
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (bookings.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:20px;">No bookings found.</p>';
            return;
        }
        
        container.innerHTML = bookings.map(b => `
            <div class="court-booking-item">
                <div>
                    <strong>${b.timeSlot}</strong> on ${new Date(b.date).toLocaleDateString()}<br>
                    <small>${escapeHtml(b.bookerName)} • ${escapeHtml(b.activity)}</small>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-outline" onclick="openAdminCourtModal(${JSON.stringify({id: b.id, ...b}).replace(/"/g, '&quot;')})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="adminDeleteBooking('${b.id}', '${b.date}', '${b.timeSlot}')">🗑️</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        container.innerHTML = `<p style="color:var(--danger);">Error: ${error.message}</p>`;
    }
}

// Helper: Delete booking by ID (for the list view)
async function adminDeleteBooking(bookingId, date, timeSlot) {
    if (userRole !== 'admin') return;
    if (!confirm(`Delete this booking?`)) return;
    
    try {
        await db.collection('courtBookings').doc(bookingId).delete();
        showToast('Deleted.', 'success');
        loadAdminCourtList(date); // Refresh list
        if (currentPage === 'court.html') renderCourt(date); // Refresh main view
    } catch (error) {
        showToast('Failed: ' + error.message, 'danger');
    }
}

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

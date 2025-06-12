// Global state
let currentUser = null;
let authToken = null;
let currentPlan = null;
let currentPaymentMethod = null;
let currentStep = 1;
let userSubscription = null;
let editingWillId = null; // Track if we're editing an existing will

// SECURITY: Session-only will data (NOT stored in database)
let sessionWillData = {
    personal_info: {},
    assets: {},
    beneficiaries: {},
    instructions: {}
};

// API Configuration
const API_BASE_URL = 'https://bitcoin-will-backend-production.up.railway.app/api';

// DOM Elements
const authModal = document.getElementById('authModal');
const paymentModal = document.getElementById('paymentModal');
const subscriptionModal = document.getElementById('subscriptionModal');
const dashboard = document.getElementById('dashboard');
const willCreator = document.getElementById('willCreator');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthStatus();
    handleURLParameters();
    showSecurityNotice();
});

function initializeApp() {
    // Check for stored auth token
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedToken && storedUser) {
        authToken = storedToken;
        currentUser = JSON.parse(storedUser);
        showUserInterface();
    }
}

// SECURITY: Show security notice about session-only mode
function showSecurityNotice() {
    const securityBanner = document.createElement('div');
    securityBanner.className = 'security-notice';
    securityBanner.innerHTML = `
        <div class="security-notice-content">
            <span class="security-icon">🔒</span>
            <span class="security-text">
                <strong>Enhanced Security:</strong> For your protection, Bitcoin data is processed session-only and never stored in our database.
            </span>
            <button onclick="this.parentElement.parentElement.style.display='none'" class="security-close">×</button>
        </div>
    `;
    document.body.insertBefore(securityBanner, document.body.firstChild);
}

function setupEventListeners() {
    // Auth form submission
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
    
    // Will form submission
    const willForm = document.getElementById('willForm');
    if (willForm) {
        willForm.addEventListener('submit', handleWillSubmit);
    }
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    // Modal close on outside click
    if (authModal) {
        authModal.addEventListener('click', function(e) {
            if (e.target === authModal) {
                closeAuthModal();
            }
        });
    }
    
    if (paymentModal) {
        paymentModal.addEventListener('click', function(e) {
            if (e.target === paymentModal) {
                closePaymentModal();
            }
        });
    }
    
    if (subscriptionModal) {
        subscriptionModal.addEventListener('click', function(e) {
            if (e.target === subscriptionModal) {
                closeSubscriptionModal();
            }
        });
    }
    
    // SECURITY: Warn before leaving if session data exists
    window.addEventListener('beforeunload', function(e) {
        if (hasSessionData()) {
            e.preventDefault();
            e.returnValue = 'You have unsaved Bitcoin will data that will be lost. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// SECURITY: Check if user has session data
function hasSessionData() {
    return Object.keys(sessionWillData.personal_info).length > 0 ||
           Object.keys(sessionWillData.assets).length > 0 ||
           Object.keys(sessionWillData.beneficiaries).length > 0 ||
           Object.keys(sessionWillData.instructions).length > 0;
}

// Navigation Functions
function goHome() {
    // Show main content and hide other sections
    document.querySelector('main').style.display = 'block';
    if (dashboard) dashboard.classList.add('hidden');
    if (willCreator) willCreator.classList.add('hidden');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// MISSING FUNCTION: Check subscription and create will
function checkSubscriptionAndCreateWill() {
    if (!userSubscription || !userSubscription.active) {
        showSubscriptionModal();
        return;
    }
    
    editingWillId = null; // Ensure we're creating new will
    showWillCreator();
}

// MISSING FUNCTION: Hide will creator
function hideWillCreator() {
    if (willCreator) {
        willCreator.classList.add('hidden');
    }
    editingWillId = null; // Clear editing state
    showDashboard();
}

// Authentication Functions
function showAuthModal(mode = 'login') {
    const authTitle = document.getElementById('authTitle');
    const authSubmit = document.getElementById('authSubmit');
    const authToggleText = document.getElementById('authToggleText');
    const authToggleBtn = document.getElementById('authToggleBtn');
    
    if (authTitle && authSubmit && authToggleText && authToggleBtn) {
        if (mode === 'login') {
            authTitle.textContent = 'Welcome Back';
            authSubmit.textContent = 'Sign In';
            authToggleText.textContent = "Don't have an account?";
            authToggleBtn.textContent = 'Sign up';
            authToggleBtn.onclick = () => toggleAuthMode();
        } else {
            authTitle.textContent = 'Create Account';
            authSubmit.textContent = 'Sign Up';
            authToggleText.textContent = 'Already have an account?';
            authToggleBtn.textContent = 'Sign in';
            authToggleBtn.onclick = () => toggleAuthMode();
        }
    }
    
    if (authModal) {
        authModal.classList.add('show');
        authModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeAuthModal() {
    if (authModal) {
        authModal.classList.remove('show');
        authModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        clearAuthForm();
    }
}

function toggleAuthMode() {
    const authTitle = document.getElementById('authTitle');
    if (authTitle) {
        const isLogin = authTitle.textContent === 'Welcome Back';
        showAuthModal(isLogin ? 'register' : 'login');
    }
}

function clearAuthForm() {
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.reset();
        hideError('authError');
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const authTitle = document.getElementById('authTitle');
    const isLogin = authTitle ? authTitle.textContent === 'Welcome Back' : true;
    
    showLoading();
    
    try {
        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const response = await fetch(API_BASE_URL + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            closeAuthModal();
            showUserInterface();
            
            // Load subscription status
            await loadSubscriptionStatus();
            
            if (!isLogin) {
                // New user, show subscription options
                setTimeout(() => {
                    const pricingSection = document.getElementById('pricing');
                    if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 500);
            }
        } else {
            showError('authError', data.message || 'Authentication failed');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('authError', 'Connection error. Please try again.');
    } finally {
        hideLoading();
    }
}

function logout() {
    // SECURITY: Clear session data on logout
    sessionWillData = {
        personal_info: {},
        assets: {},
        beneficiaries: {},
        instructions: {}
    };
    
    authToken = null;
    currentUser = null;
    userSubscription = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    showGuestInterface();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showUserInterface() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const userEmail = document.getElementById('userEmail');
    
    if (authButtons) authButtons.classList.add('hidden');
    if (userMenu) userMenu.classList.remove('hidden');
    if (userEmail && currentUser) userEmail.textContent = currentUser.email;
}

function showGuestInterface() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    
    if (authButtons) authButtons.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
    
    // Hide dashboard and will creator
    if (dashboard) dashboard.classList.add('hidden');
    if (willCreator) willCreator.classList.add('hidden');
    
    // Show main content
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.style.display = 'block';
}

async function checkAuthStatus() {
    if (!authToken) return;
    
    try {
        const response = await fetch(API_BASE_URL + '/auth/me', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            logout();
        } else {
            await loadSubscriptionStatus();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        logout();
    }
}

// Subscription Functions
async function loadSubscriptionStatus() {
    if (!authToken) return;
    
    try {
        const response = await fetch(API_BASE_URL + '/subscription/status', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            userSubscription = data;
            updateSubscriptionDisplay(data);
        }
    } catch (error) {
        console.error('Subscription status error:', error);
    }
}

function updateSubscriptionDisplay(subscription) {
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    
    if (statusBadge && statusText) {
        if (subscription && subscription.active) {
            statusBadge.textContent = 'Active';
            statusBadge.style.backgroundColor = '#10b981';
            statusText.textContent = `Next billing: ${new Date(subscription.subscription.current_period_end).toLocaleDateString()}`;
            
            // Update manage subscription button for active users
            const manageBtn = document.getElementById('manageSubscriptionBtn');
            if (manageBtn) {
                manageBtn.textContent = 'Manage Subscription';
                manageBtn.onclick = openSubscriptionManagement;
            }
        } else {
            statusBadge.textContent = 'Inactive';
            statusBadge.style.backgroundColor = '#ef4444';
            statusText.textContent = 'Subscribe to create Bitcoin wills';
            
            const manageBtn = document.getElementById('manageSubscriptionBtn');
            if (manageBtn) {
                manageBtn.textContent = 'Subscribe Now';
                manageBtn.onclick = showSubscriptionModal;
            }
        }
    }
}

// Subscription management function
async function openSubscriptionManagement() {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        // Show loading state on button
        const manageBtn = document.getElementById('manageSubscriptionBtn');
        let originalText = 'Manage Subscription';
        if (manageBtn) {
            originalText = manageBtn.innerHTML;
            manageBtn.innerHTML = '<span class="loading"></span> Loading...';
            manageBtn.disabled = true;
        }
        
        // Create portal session
        let portal;
        try {
            portal = await fetch(API_BASE_URL + '/subscription/manage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (fetchError) {
            console.error('Network error:', fetchError);
            throw new Error('Network error. Please check your connection and try again.');
        }
        
        if (!portal.ok) {
            if (portal.status === 500) {
                throw new Error('Server error. The portal service is currently unavailable.');
            } else {
                throw new Error(`Server responded with status: ${portal.status}`);
            }
        }
        
        let portalData;
        try {
            portalData = await portal.json();
        } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            throw new Error('Invalid response from server. Please try again later.');
        }
        
        // Check if we have a valid URL
        if (!portalData || !portalData.portal_url) {
            throw new Error('No portal URL received. Please try again later.');
        }
        
        // Redirect to Stripe portal
        window.location.href = portalData.portal_url;
        
    } catch (err) {
        console.error('Error creating portal session', err);
        
        // Reset button
        const manageBtn = document.getElementById('manageSubscriptionBtn');
        if (manageBtn) {
            manageBtn.innerHTML = originalText;
            manageBtn.disabled = false;
        }
        
        // Show error
        alert(err.message || 'Unable to open subscription management portal. Please try again later.');
    }
}

function selectPlan(plan) {
    if (!currentUser) {
        showAuthModal('register');
        return;
    }
    
    currentPlan = plan;
    showPaymentModal();
}

function showPaymentModal() {
    const paymentTitle = document.getElementById('paymentTitle');
    if (paymentTitle) {
        paymentTitle.textContent = `Choose Payment Method - ${currentPlan === 'monthly' ? 'Monthly' : 'Yearly'} Plan`;
    }
    
    if (paymentModal) {
        paymentModal.classList.add('show');
        paymentModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closePaymentModal() {
    if (paymentModal) {
        paymentModal.classList.remove('show');
        paymentModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function selectPaymentMethod(method) {
    currentPaymentMethod = method;
    closePaymentModal();
    
    showLoading();
    
    try {
        if (method === 'stripe') {
            await processStripePayment();
        } else if (method === 'btcpay') {
            await processBTCPayPayment();
        }
    } catch (error) {
        console.error('Payment error:', error);
        showError('paymentError', 'Payment processing failed. Please try again.');
    } finally {
        hideLoading();
    }
}

async function processStripePayment() {
    try {
        const response = await fetch(API_BASE_URL + '/subscription/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                plan: currentPlan
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect to Stripe Checkout
            window.location.href = data.checkout_url;
        } else {
            throw new Error(data.message || 'Failed to create checkout session');
        }
    } catch (error) {
        console.error('Stripe payment error:', error);
        throw error;
    }
}

async function processBTCPayPayment() {
    try {
        const response = await fetch(API_BASE_URL + '/subscription/create-btcpay-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                plan: currentPlan
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect to BTCPay Server invoice
            window.location.href = data.invoice_url;
        } else {
            throw new Error(data.message || 'Failed to create BTCPay invoice');
        }
    } catch (error) {
        console.error('BTCPay payment error:', error);
        throw error;
    }
}

// Payment Success Handling
async function handlePaymentSuccess(sessionId) {
    if (!authToken || !sessionId) return;
    
    showLoading();
    
    try {
        const response = await fetch(API_BASE_URL + '/subscription/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                session_id: sessionId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message
            showPaymentSuccessMessage();
            
            // Reload subscription status
            await loadSubscriptionStatus();
            
            // Show dashboard
            setTimeout(() => {
                showDashboard();
            }, 2000);
        } else {
            console.error('Payment verification failed:', data.message);
            showError('paymentError', 'Payment verification failed. Please contact support.');
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        showError('paymentError', 'Failed to verify payment. Please contact support.');
    } finally {
        hideLoading();
    }
}

function showPaymentSuccessMessage() {
    // Create and show success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        z-index: 3000;
        text-align: center;
        max-width: 400px;
        width: 90%;
    `;
    
    successDiv.innerHTML = `
        <div style="color: #10b981; font-size: 3rem; margin-bottom: 1rem;">✅</div>
        <h3 style="color: #1f2937; margin-bottom: 1rem;">Payment Successful!</h3>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">Your subscription is now active. You can start creating Bitcoin wills.</p>
        <button onclick="this.parentElement.remove()" style="background: #f7931a; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Continue</button>
    `;
    
    document.body.appendChild(successDiv);
}

// URL Parameter Handling
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');
    
    if (success === 'true' && sessionId) {
        handlePaymentSuccess(sessionId);
    }
}

// Dashboard Functions
async function showDashboard() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    // Hide main content and show dashboard
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.style.display = 'none';
    if (dashboard) dashboard.classList.remove('hidden');
    if (willCreator) willCreator.classList.add('hidden');
    
    loadUserWills();
}

async function loadUserWills() {
    if (!authToken) return;
    
    try {
        const response = await fetch(API_BASE_URL + '/will/list', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const wills = await response.json();
            displayWills(wills);
        } else {
            console.error('Failed to load wills');
        }
    } catch (error) {
        console.error('Error loading wills:', error);
    }
}

function displayWills(wills) {
    const willsList = document.getElementById('willsList');
    
    if (!willsList) return;
    
    if (wills.length === 0) {
        willsList.innerHTML = `
            <div class="no-wills">
                <h3>No wills created yet</h3>
                <p>Create your first Bitcoin will to get started.</p>
                <button onclick="checkSubscriptionAndCreateWill()" class="btn btn-primary">Create Your First Will</button>
            </div>
        `;
        return;
    }
    
    willsList.innerHTML = wills.map(will => `
        <div class="will-card">
            <div class="will-info">
                <h3>${will.title}</h3>
                <p>Testator: ${will.testator_name}</p>
                <p>Created: ${new Date(will.created_at).toLocaleDateString()}</p>
                <p>Updated: ${new Date(will.updated_at).toLocaleDateString()}</p>
            </div>
            <div class="will-actions">
                <button onclick="editWill(${will.id})" class="btn btn-outline">Edit</button>
                <button onclick="downloadWill(${will.id})" class="btn btn-primary">Download</button>
                <button onclick="deleteWill(${will.id})" class="btn btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

// Will Creation Functions
function showWillCreator() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    // Check subscription
    if (!userSubscription || !userSubscription.active) {
        showSubscriptionModal();
        return;
    }
    
    // SECURITY: Show warning about session-only mode
    if (!hasSessionData()) {
        showSessionWarning();
        return;
    }
    
    // Hide other sections and show will creator
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.style.display = 'none';
    if (dashboard) dashboard.classList.add('hidden');
    if (willCreator) willCreator.classList.remove('hidden');
    
    // Reset form and state
    editingWillId = null;
    currentStep = 1;
    
    // SECURITY: Clear session data for new will
    sessionWillData = {
        personal_info: {},
        assets: {},
        beneficiaries: {},
        instructions: {}
    };
    
    updateWillForm();
}

// SECURITY: Show session warning
function showSessionWarning() {
    const warningModal = document.createElement('div');
    warningModal.className = 'session-warning-modal';
    warningModal.innerHTML = `
        <div class="session-warning-content">
            <h2>🔒 Enhanced Security Mode</h2>
            <div class="warning-points">
                <div class="warning-point">
                    <span class="warning-icon">🛡️</span>
                    <div>
                        <strong>No Data Storage:</strong> Your Bitcoin information is NEVER stored in our database for maximum security.
                    </div>
                </div>
                <div class="warning-point">
                    <span class="warning-icon">⏱️</span>
                    <div>
                        <strong>Session Only:</strong> Will creation must be completed in one session. You cannot save and return later.
                    </div>
                </div>
                <div class="warning-point">
                    <span class="warning-icon">📋</span>
                    <div>
                        <strong>Be Prepared:</strong> Have all your Bitcoin wallet information, beneficiary details, and instructions ready.
                    </div>
                </div>
                <div class="warning-point">
                    <span class="warning-icon">⚠️</span>
                    <div>
                        <strong>Data Loss Warning:</strong> If you close your browser or navigate away, all data will be lost.
                    </div>
                </div>
            </div>
            <div class="warning-actions">
                <button onclick="cancelWillCreation()" class="btn btn-secondary">Cancel - Let Me Prepare</button>
                <button onclick="proceedWithWillCreation()" class="btn btn-primary">I'm Ready - Start Creating</button>
            </div>
        </div>
    `;
    document.body.appendChild(warningModal);
    document.body.style.overflow = 'hidden';
}

function cancelWillCreation() {
    const warningModal = document.querySelector('.session-warning-modal');
    if (warningModal) {
        warningModal.remove();
        document.body.style.overflow = '';
    }
}

function proceedWithWillCreation() {
    const warningModal = document.querySelector('.session-warning-modal');
    if (warningModal) {
        warningModal.remove();
        document.body.style.overflow = '';
    }
    
    // Proceed with will creation
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.style.display = 'none';
    if (dashboard) dashboard.classList.add('hidden');
    if (willCreator) willCreator.classList.remove('hidden');
    
    editingWillId = null;
    currentStep = 1;
    
    sessionWillData = {
        personal_info: {},
        assets: {},
        beneficiaries: {},
        instructions: {}
    };
    
    updateWillForm();
}

async function editWill(willId) {
    if (!authToken) return;
    
    try {
        const response = await fetch(API_BASE_URL + `/will/${willId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const will = await response.json();
            
            // SECURITY: Only load personal info, no Bitcoin data
            editingWillId = willId;
            sessionWillData = {
                personal_info: will.personal_info || {},
                assets: {},  // Empty for security
                beneficiaries: {},  // Empty for security
                instructions: {}  // Empty for security
            };
            
            // Show security warning for editing
            showEditWarning();
        } else {
            console.error('Failed to load will for editing');
        }
    } catch (error) {
        console.error('Error loading will:', error);
    }
}

// SECURITY: Show edit warning
function showEditWarning() {
    const warningModal = document.createElement('div');
    warningModal.className = 'edit-warning-modal';
    warningModal.innerHTML = `
        <div class="edit-warning-content">
            <h2>🔒 Secure Editing Mode</h2>
            <div class="warning-points">
                <div class="warning-point">
                    <span class="warning-icon">🛡️</span>
                    <div>
                        <strong>Security Notice:</strong> Only personal information is loaded. Bitcoin data must be re-entered for security.
                    </div>
                </div>
                <div class="warning-point">
                    <span class="warning-icon">⏱️</span>
                    <div>
                        <strong>Session Only:</strong> All Bitcoin data must be re-entered and completed in this session.
                    </div>
                </div>
                <div class="warning-point">
                    <span class="warning-icon">📋</span>
                    <div>
                        <strong>Fresh Start:</strong> This ensures your Bitcoin information is never stored in our database.
                    </div>
                </div>
            </div>
            <div class="warning-actions">
                <button onclick="cancelEdit()" class="btn btn-secondary">Cancel</button>
                <button onclick="proceedWithEdit()" class="btn btn-primary">Continue Editing</button>
            </div>
        </div>
    `;
    document.body.appendChild(warningModal);
    document.body.style.overflow = 'hidden';
}

function cancelEdit() {
    const warningModal = document.querySelector('.edit-warning-modal');
    if (warningModal) {
        warningModal.remove();
        document.body.style.overflow = '';
    }
    editingWillId = null;
}

function proceedWithEdit() {
    const warningModal = document.querySelector('.edit-warning-modal');
    if (warningModal) {
        warningModal.remove();
        document.body.style.overflow = '';
    }
    
    // Proceed with editing
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.style.display = 'none';
    if (dashboard) dashboard.classList.add('hidden');
    if (willCreator) willCreator.classList.remove('hidden');
    
    currentStep = 1;
    updateWillForm();
    populateWillForm();
}

async function downloadWill(willId) {
    if (!authToken) return;
    
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + `/will/${willId}/download`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bitcoin_will_${willId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            console.error('Failed to download will');
            alert('Failed to download will. Please try again.');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download will. Please try again.');
    } finally {
        hideLoading();
    }
}

async function deleteWill(willId) {
    if (!confirm('Are you sure you want to delete this will? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(API_BASE_URL + `/will/${willId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            loadUserWills(); // Refresh the list
        } else {
            console.error('Failed to delete will');
            alert('Failed to delete will. Please try again.');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete will. Please try again.');
    }
}

// Will Form Functions
function updateWillForm() {
    const stepIndicators = document.querySelectorAll('.step');
    const formSteps = document.querySelectorAll('.form-step');
    
    // Update step indicators
    stepIndicators.forEach((step, index) => {
        if (index + 1 === currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    // Show current form step
    formSteps.forEach((step, index) => {
        if (index + 1 === currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prevStep');
    const nextBtn = document.getElementById('nextStep');
    
    if (prevBtn) {
        prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
    }
    if (nextBtn) {
        nextBtn.textContent = currentStep === 4 ? 'Generate Will' : 'Next Step';
    }
}

function populateWillForm() {
    // SECURITY: Only populate personal info, Bitcoin data must be re-entered
    if (sessionWillData.personal_info) {
        const personalInfo = sessionWillData.personal_info;
        
        // Populate personal information fields
        const fullNameField = document.getElementById('fullName');
        const dobField = document.getElementById('dateOfBirth');
        const phoneField = document.getElementById('phone');
        const executorNameField = document.getElementById('executorName');
        const executorContactField = document.getElementById('executorContact');
        
        if (fullNameField && personalInfo.full_name) fullNameField.value = personalInfo.full_name;
        if (dobField && personalInfo.date_of_birth) dobField.value = personalInfo.date_of_birth;
        if (phoneField && personalInfo.phone) phoneField.value = personalInfo.phone;
        if (executorNameField && personalInfo.executor_name) executorNameField.value = personalInfo.executor_name;
        if (executorContactField && personalInfo.executor_contact) executorContactField.value = personalInfo.executor_contact;
        
        // Populate address if available
        if (personalInfo.address) {
            const address = personalInfo.address;
            const addressField = document.getElementById('address');
            const cityField = document.getElementById('city');
            const stateField = document.getElementById('state');
            const zipField = document.getElementById('zipCode');
            const countryField = document.getElementById('country');
            
            if (addressField && address.street) addressField.value = address.street;
            if (cityField && address.city) cityField.value = address.city;
            if (stateField && address.state) stateField.value = address.state;
            if (zipField && address.zip_code) zipField.value = address.zip_code;
            if (countryField && address.country) countryField.value = address.country;
        }
    }
    
    // Note: Bitcoin data fields remain empty for security
}

function nextStep() {
    if (currentStep < 4) {
        // SECURITY: Save current step to session data
        saveCurrentStepToSession();
        currentStep++;
        updateWillForm();
    } else {
        // Generate will
        handleWillSubmit();
    }
}

function prevStep() {
    if (currentStep > 1) {
        saveCurrentStepToSession();
        currentStep--;
        updateWillForm();
    }
}

// SECURITY: Save current step data to session only
function saveCurrentStepToSession() {
    switch(currentStep) {
        case 1:
            // Save personal information
            const fullNameField = document.getElementById('fullName');
            const dobField = document.getElementById('dateOfBirth');
            const phoneField = document.getElementById('phone');
            const executorNameField = document.getElementById('executorName');
            const executorContactField = document.getElementById('executorContact');
            const addressField = document.getElementById('address');
            const cityField = document.getElementById('city');
            const stateField = document.getElementById('state');
            const zipField = document.getElementById('zipCode');
            const countryField = document.getElementById('country');
            
            sessionWillData.personal_info = {
                full_name: fullNameField ? fullNameField.value : '',
                date_of_birth: dobField ? dobField.value : '',
                phone: phoneField ? phoneField.value : '',
                executor_name: executorNameField ? executorNameField.value : '',
                executor_contact: executorContactField ? executorContactField.value : '',
                address: {
                    street: addressField ? addressField.value : '',
                    city: cityField ? cityField.value : '',
                    state: stateField ? stateField.value : '',
                    zip_code: zipField ? zipField.value : '',
                    country: countryField ? countryField.value : ''
                }
            };
            break;
        case 2:
            // Save Bitcoin assets
            sessionWillData.assets = collectAssetsData();
            break;
        case 3:
            // Save beneficiaries
            sessionWillData.beneficiaries = collectBeneficiariesData();
            break;
        case 4:
            // Save instructions
            sessionWillData.instructions = collectInstructionsData();
            break;
    }
}

function collectAssetsData() {
    // Collect wallet data
    const wallets = [];
    document.querySelectorAll('.wallet-entry').forEach((entry, index) => {
        const wallet = {
            name: entry.querySelector('[name="walletName"]')?.value || '',
            type: entry.querySelector('[name="walletType"]')?.value || '',
            description: entry.querySelector('[name="walletDescription"]')?.value || '',
            access_method: entry.querySelector('[name="accessMethod"]')?.value || '',
            seed_phrase_location: entry.querySelector('[name="seedPhraseLocation"]')?.value || '',
            private_key_location: entry.querySelector('[name="privateKeyLocation"]')?.value || '',
            additional_notes: entry.querySelector('[name="additionalNotes"]')?.value || ''
        };
        wallets.push(wallet);
    });
    
    // Collect exchange data
    const exchanges = [];
    document.querySelectorAll('.exchange-entry').forEach((entry, index) => {
        const exchange = {
            name: entry.querySelector('[name="exchangeName"]')?.value || '',
            username: entry.querySelector('[name="exchangeUsername"]')?.value || '',
            email: entry.querySelector('[name="exchangeEmail"]')?.value || '',
            two_factor_backup: entry.querySelector('[name="twoFactorBackup"]')?.value || '',
            additional_notes: entry.querySelector('[name="exchangeNotes"]')?.value || ''
        };
        exchanges.push(exchange);
    });
    
    const storageMethodField = document.getElementById('storageMethod');
    const storageLocationField = document.getElementById('storageLocation');
    const storageDetailsField = document.getElementById('storageDetails');
    
    return {
        storage_method: storageMethodField ? storageMethodField.value : '',
        storage_location: storageLocationField ? storageLocationField.value : '',
        storage_details: storageDetailsField ? storageDetailsField.value : '',
        wallets: wallets,
        exchanges: exchanges
    };
}

function collectBeneficiariesData() {
    // Collect primary beneficiaries
    const primary = [];
    document.querySelectorAll('.primary-beneficiary').forEach((entry, index) => {
        const beneficiary = {
            name: entry.querySelector('[name="beneficiaryName"]')?.value || '',
            relationship: entry.querySelector('[name="beneficiaryRelationship"]')?.value || '',
            percentage: entry.querySelector('[name="beneficiaryPercentage"]')?.value || '',
            phone: entry.querySelector('[name="beneficiaryPhone"]')?.value || '',
            email: entry.querySelector('[name="beneficiaryEmail"]')?.value || '',
            bitcoin_address: entry.querySelector('[name="beneficiaryBitcoinAddress"]')?.value || '',
            address: {
                street: entry.querySelector('[name="beneficiaryStreet"]')?.value || '',
                city: entry.querySelector('[name="beneficiaryCity"]')?.value || '',
                state: entry.querySelector('[name="beneficiaryState"]')?.value || '',
                zip_code: entry.querySelector('[name="beneficiaryZip"]')?.value || '',
                country: entry.querySelector('[name="beneficiaryCountry"]')?.value || ''
            }
        };
        primary.push(beneficiary);
    });
    
    // Collect contingent beneficiaries
    const contingent = [];
    document.querySelectorAll('.contingent-beneficiary').forEach((entry, index) => {
        const beneficiary = {
            name: entry.querySelector('[name="contingentName"]')?.value || '',
            relationship: entry.querySelector('[name="contingentRelationship"]')?.value || '',
            percentage: entry.querySelector('[name="contingentPercentage"]')?.value || '',
            phone: entry.querySelector('[name="contingentPhone"]')?.value || '',
            email: entry.querySelector('[name="contingentEmail"]')?.value || '',
            bitcoin_address: entry.querySelector('[name="contingentBitcoinAddress"]')?.value || '',
            address: {
                street: entry.querySelector('[name="contingentStreet"]')?.value || '',
                city: entry.querySelector('[name="contingentCity"]')?.value || '',
                state: entry.querySelector('[name="contingentState"]')?.value || '',
                zip_code: entry.querySelector('[name="contingentZip"]')?.value || '',
                country: entry.querySelector('[name="contingentCountry"]')?.value || ''
            }
        };
        contingent.push(beneficiary);
    });
    
    return {
        primary: primary,
        contingent: contingent
    };
}

function collectInstructionsData() {
    // Collect trusted contacts
    const trusted_contacts = [];
    document.querySelectorAll('.trusted-contact').forEach((entry, index) => {
        const contact = {
            name: entry.querySelector('[name="contactName"]')?.value || '',
            contact: entry.querySelector('[name="contactInfo"]')?.value || '',
            relationship: entry.querySelector('[name="contactRelationship"]')?.value || '',
            role: entry.querySelector('[name="contactRole"]')?.value || ''
        };
        trusted_contacts.push(contact);
    });
    
    const accessInstructionsField = document.getElementById('accessInstructions');
    const securityNotesField = document.getElementById('securityNotes');
    const additionalInstructionsField = document.getElementById('additionalInstructions');
    const emergencyContactField = document.getElementById('emergencyContact');
    
    return {
        access_instructions: accessInstructionsField ? accessInstructionsField.value : '',
        security_notes: securityNotesField ? securityNotesField.value : '',
        additional_instructions: additionalInstructionsField ? additionalInstructionsField.value : '',
        emergency_contact: emergencyContactField ? emergencyContactField.value : '',
        trusted_contacts: trusted_contacts
    };
}

// MODIFIED: Will submission for session-only processing
async function handleWillSubmit(e) {
    if (e) e.preventDefault();
    
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    // Check subscription
    if (!userSubscription || !userSubscription.active) {
        showSubscriptionModal();
        return;
    }
    
    try {
        showLoading();
        
        // Save current step data
        saveCurrentStepToSession();
        
        // SECURITY: Use session-only endpoint
        const endpoint = '/will/create-session';
        
        const response = await fetch(API_BASE_URL + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: `Bitcoin Will - ${sessionWillData.personal_info.full_name || 'Untitled'} - ${new Date().toLocaleDateString()}`,
                personal_info: sessionWillData.personal_info,
                assets: sessionWillData.assets,
                beneficiaries: sessionWillData.beneficiaries,
                instructions: sessionWillData.instructions
            })
        });
        
        if (response.ok) {
            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bitcoin_will_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // SECURITY: Clear session data after successful generation
            sessionWillData = {
                personal_info: {},
                assets: {},
                beneficiaries: {},
                instructions: {}
            };
            
            // Show success message
            showWillSuccessMessage();
            
        } else {
            const errorData = await response.json();
            showError('willError', errorData.message || 'Failed to create will');
        }
    } catch (error) {
        console.error('Will creation error:', error);
        showError('willError', 'Failed to create will. Please try again.');
    } finally {
        hideLoading();
    }
}

function showWillSuccessMessage() {
    const successModal = document.createElement('div');
    successModal.className = 'will-success-modal';
    successModal.innerHTML = `
        <div class="will-success-content">
            <h2>✅ Bitcoin Will Created Successfully!</h2>
            <div class="success-points">
                <div class="success-point">
                    <span class="success-icon">📄</span>
                    <div>Your Bitcoin will has been generated and downloaded.</div>
                </div>
                <div class="success-point">
                    <span class="success-icon">🔒</span>
                    <div>For your security, no Bitcoin data was stored in our database.</div>
                </div>
                <div class="success-point">
                    <span class="success-icon">🗑️</span>
                    <div>All session data has been cleared from memory.</div>
                </div>
            </div>
            <div class="success-actions">
                <button onclick="returnToDashboard()" class="btn btn-primary">Return to Dashboard</button>
                <button onclick="createAnotherWill()" class="btn btn-secondary">Create Another Will</button>
            </div>
        </div>
    `;
    document.body.appendChild(successModal);
    document.body.style.overflow = 'hidden';
}

function returnToDashboard() {
    const successModal = document.querySelector('.will-success-modal');
    if (successModal) {
        successModal.remove();
        document.body.style.overflow = '';
    }
    showDashboard();
}

function createAnotherWill() {
    const successModal = document.querySelector('.will-success-modal');
    if (successModal) {
        successModal.remove();
        document.body.style.overflow = '';
    }
    showWillCreator();
}

// Subscription Modal Functions
function showSubscriptionModal() {
    if (subscriptionModal) {
        subscriptionModal.classList.add('show');
        subscriptionModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeSubscriptionModal() {
    if (subscriptionModal) {
        subscriptionModal.classList.remove('show');
        subscriptionModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Utility Functions
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('show');
    }
}

// Dynamic form functions (preserved from original)
function addWallet() {
    const container = document.getElementById('walletsContainer');
    if (!container) return;
    
    const walletCount = container.children.length + 1;
    
    const walletDiv = document.createElement('div');
    walletDiv.className = 'wallet-entry';
    walletDiv.innerHTML = `
        <h4>Wallet ${walletCount}</h4>
        <div class="form-group">
            <label>Wallet Name/Label</label>
            <input type="text" name="walletName" placeholder="e.g., Ledger Nano S">
        </div>
        <div class="form-group">
            <label>Wallet Type</label>
            <select name="walletType">
                <option value="">Select type</option>
                <option value="hardware">Hardware Wallet</option>
                <option value="software">Software Wallet</option>
                <option value="paper">Paper Wallet</option>
                <option value="brain">Brain Wallet</option>
            </select>
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" name="walletDescription" placeholder="Brief description">
        </div>
        <div class="form-group">
            <label>Access Method</label>
            <input type="text" name="accessMethod" placeholder="How to access this wallet">
        </div>
        <div class="form-group">
            <label>Seed Phrase Location</label>
            <input type="text" name="seedPhraseLocation" placeholder="Where seed phrase is stored">
        </div>
        <div class="form-group">
            <label>Private Key Location</label>
            <input type="text" name="privateKeyLocation" placeholder="Where private key is stored">
        </div>
        <div class="form-group">
            <label>Additional Notes</label>
            <textarea name="additionalNotes" rows="3" placeholder="Any additional information"></textarea>
        </div>
        <button type="button" onclick="removeWallet(this)" class="btn btn-danger">Remove Wallet</button>
    `;
    
    container.appendChild(walletDiv);
}

function removeWallet(button) {
    button.parentElement.remove();
}

function addExchange() {
    const container = document.getElementById('exchangesContainer');
    if (!container) return;
    
    const exchangeCount = container.children.length + 1;
    
    const exchangeDiv = document.createElement('div');
    exchangeDiv.className = 'exchange-entry';
    exchangeDiv.innerHTML = `
        <h4>Exchange ${exchangeCount}</h4>
        <div class="form-group">
            <label>Exchange Name</label>
            <input type="text" name="exchangeName" placeholder="e.g., Coinbase, Binance">
        </div>
        <div class="form-group">
            <label>Username/Account ID</label>
            <input type="text" name="exchangeUsername" placeholder="Username or account identifier">
        </div>
        <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="exchangeEmail" placeholder="Account email">
        </div>
        <div class="form-group">
            <label>2FA Backup Codes Location</label>
            <input type="text" name="twoFactorBackup" placeholder="Where 2FA backup codes are stored">
        </div>
        <div class="form-group">
            <label>Additional Notes</label>
            <textarea name="exchangeNotes" rows="3" placeholder="Any additional information about this exchange account"></textarea>
        </div>
        <button type="button" onclick="removeExchange(this)" class="btn btn-danger">Remove Exchange</button>
    `;
    
    container.appendChild(exchangeDiv);
}

function removeExchange(button) {
    button.parentElement.remove();
}

function addBeneficiary(type = 'primary') {
    const container = document.getElementById(type === 'primary' ? 'primaryBeneficiariesContainer' : 'contingentBeneficiariesContainer');
    if (!container) return;
    
    const beneficiaryCount = container.children.length + 1;
    const className = type === 'primary' ? 'primary-beneficiary' : 'contingent-beneficiary';
    const namePrefix = type === 'primary' ? 'beneficiary' : 'contingent';
    
    const beneficiaryDiv = document.createElement('div');
    beneficiaryDiv.className = className;
    beneficiaryDiv.innerHTML = `
        <h4>${type.charAt(0).toUpperCase() + type.slice(1)} Beneficiary ${beneficiaryCount}</h4>
        <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="${namePrefix}Name" required>
        </div>
        <div class="form-group">
            <label>Relationship</label>
            <input type="text" name="${namePrefix}Relationship" placeholder="e.g., Spouse, Child, Friend" required>
        </div>
        <div class="form-group">
            <label>Percentage of Assets</label>
            <input type="number" name="${namePrefix}Percentage" min="0" max="100" step="0.01" required>
        </div>
        <div class="form-group">
            <label>Phone Number</label>
            <input type="tel" name="${namePrefix}Phone">
        </div>
        <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="${namePrefix}Email">
        </div>
        <div class="form-group">
            <label>Bitcoin Address (Optional)</label>
            <input type="text" name="${namePrefix}BitcoinAddress" placeholder="Their Bitcoin address if known">
        </div>
        <div class="form-group">
            <label>Street Address</label>
            <input type="text" name="${namePrefix}Street">
        </div>
        <div class="form-group">
            <label>City</label>
            <input type="text" name="${namePrefix}City">
        </div>
        <div class="form-group">
            <label>State/Province</label>
            <input type="text" name="${namePrefix}State">
        </div>
        <div class="form-group">
            <label>ZIP/Postal Code</label>
            <input type="text" name="${namePrefix}Zip">
        </div>
        <div class="form-group">
            <label>Country</label>
            <input type="text" name="${namePrefix}Country" value="United States">
        </div>
        <button type="button" onclick="removeBeneficiary(this)" class="btn btn-danger">Remove Beneficiary</button>
    `;
    
    container.appendChild(beneficiaryDiv);
}

function removeBeneficiary(button) {
    button.parentElement.remove();
}

function addTrustedContact() {
    const container = document.getElementById('trustedContactsContainer');
    if (!container) return;
    
    const contactCount = container.children.length + 1;
    
    const contactDiv = document.createElement('div');
    contactDiv.className = 'trusted-contact';
    contactDiv.innerHTML = `
        <h4>Trusted Contact ${contactCount}</h4>
        <div class="form-group">
            <label>Name</label>
            <input type="text" name="contactName" placeholder="Full name">
        </div>
        <div class="form-group">
            <label>Contact Information</label>
            <input type="text" name="contactInfo" placeholder="Phone and/or email">
        </div>
        <div class="form-group">
            <label>Relationship</label>
            <input type="text" name="contactRelationship" placeholder="e.g., Friend, Colleague">
        </div>
        <div class="form-group">
            <label>Role/Expertise</label>
            <input type="text" name="contactRole" placeholder="e.g., Bitcoin expert, Tech support">
        </div>
        <button type="button" onclick="removeTrustedContact(this)" class="btn btn-danger">Remove Contact</button>
    `;
    
    container.appendChild(contactDiv);
}

function removeTrustedContact(button) {
    button.parentElement.remove();
}


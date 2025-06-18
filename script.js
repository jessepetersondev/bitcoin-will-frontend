// Global state
let currentUser = null;
let authToken = null;
let currentPlan = null;
let currentPaymentMethod = null;
let currentStep = 1;
let userSubscription = null;
let editingWillId = null; // Track if we're editing an existing will

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

function setupEventListeners() {
    // Auth form submission
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    
    // Will form submission
    document.getElementById('willForm').addEventListener('submit', handleWillSubmit);
    
    // Mobile menu toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', toggleMobileMenu);
    
    // Modal close on outside click
    authModal.addEventListener('click', function(e) {
        if (e.target === authModal) {
            closeAuthModal();
        }
    });
    
    paymentModal.addEventListener('click', function(e) {
        if (e.target === paymentModal) {
            closePaymentModal();
        }
    });
    
    subscriptionModal.addEventListener('click', function(e) {
        if (e.target === subscriptionModal) {
            closeSubscriptionModal();
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

// Authentication Functions
function showAuthModal(mode = 'login') {
    const authTitle = document.getElementById('authTitle');
    const authSubmit = document.getElementById('authSubmit');
    const authToggleText = document.getElementById('authToggleText');
    const authToggleBtn = document.getElementById('authToggleBtn');
    
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
    
    authModal.classList.add('show');
    authModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    authModal.classList.remove('show');
    authModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    clearAuthForm();
}

function toggleAuthMode() {
    const authTitle = document.getElementById('authTitle');
    const isLogin = authTitle.textContent === 'Welcome Back';
    showAuthModal(isLogin ? 'register' : 'login');
}

function clearAuthForm() {
    document.getElementById('authForm').reset();
    hideError('authError');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const isLogin = document.getElementById('authTitle').textContent === 'Welcome Back';
    
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
            
            if (isLogin) {
                // REDIRECT TO DASHBOARD AFTER LOGIN
                showDashboard();
            } else {
                // New user, show subscription options
                setTimeout(() => {
                    document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
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
    document.getElementById('authButtons').classList.add('hidden');
    document.getElementById('userMenu').classList.remove('hidden');
    document.getElementById('userEmail').textContent = currentUser.email;
}

function showGuestInterface() {
    document.getElementById('authButtons').classList.remove('hidden');
    document.getElementById('userMenu').classList.add('hidden');
    
    // Hide dashboard and will creator
    dashboard.classList.add('hidden');
    willCreator.classList.add('hidden');
    
    // Show main content
    document.querySelector('main').style.display = 'block';
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
        showAlert('Unable to open subscription management portal. Please try again later.', 'error');
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
    paymentTitle.textContent = `Choose Payment Method - ${currentPlan === 'monthly' ? 'Monthly' : 'Yearly'} Plan`;
    
    paymentModal.classList.add('show');
    paymentModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
    paymentModal.classList.remove('show');
    paymentModal.style.display = 'none';
    document.body.style.overflow = 'auto';
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
        <h2 style="color: #1f2937; margin-bottom: 1rem;">Payment Successful!</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
            Thank you for subscribing! Your account has been activated and you can now create Bitcoin wills.
        </p>
        <div style="color: #3b82f6; font-weight: 600;">Redirecting to dashboard...</div>
    `;
    
    document.body.appendChild(successDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        document.body.removeChild(successDiv);
    }, 3000);
}

// Subscription Modal Functions
function showSubscriptionModal() {
    subscriptionModal.classList.add('show');
    subscriptionModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeSubscriptionModal() {
    subscriptionModal.classList.remove('show');
    subscriptionModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function checkSubscriptionAndCreateWill() {
    if (!userSubscription || !userSubscription.active) {
        showSubscriptionModal();
        return;
    }
    
    editingWillId = null; // Ensure we're creating new will
    showWillCreator();
}

// Dashboard Functions
async function showDashboard() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    // CLOSE MOBILE MENU AFTER NAVIGATION
    closeMobileMenu();
    
    // Hide main content
    document.querySelector('main').style.display = 'none';
    willCreator.classList.add('hidden');
    
    // Show dashboard
    dashboard.classList.remove('hidden');
    
    // Load dashboard data
    await loadDashboardData();
}

async function loadDashboardData() {
    showLoading();
    
    try {
        // Load subscription status
        await loadSubscriptionStatus();
        
        // Load user's wills
        const willsResponse = await fetch(API_BASE_URL + '/will/list', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (willsResponse.ok) {
            const willsData = await willsResponse.json();
            updateWillsList(willsData.wills || []);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    } finally {
        hideLoading();
    }
}

function updateWillsList(wills) {
    const willsList = document.getElementById('willsList');
    
    if (wills.length === 0) {
        willsList.innerHTML = `
            <div class="will-card">
                <h3>No wills created yet</h3>
                <p>Create your first Bitcoin will to get started</p>
                <div class="will-actions">
                    <button class="btn btn-primary" onclick="checkSubscriptionAndCreateWill()">Create Will</button>
                </div>
            </div>
        `;
        return;
    }
    
    willsList.innerHTML = wills.map(will => `
        <div class="will-card">
            <h3>${will.title}</h3>
            <p>Created: ${new Date(will.created_at).toLocaleDateString()}</p>
            <p>Status: ${will.status}</p>
            <div class="will-actions">
                <button class="btn btn-primary" onclick="downloadWill(${will.id})">Download PDF</button>
                <button class="btn btn-outline" onclick="editWill(${will.id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteWill(${will.id}, '${will.title}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Will Creator Functions
function showWillCreator() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    // Hide other sections
    document.querySelector('main').style.display = 'none';
    dashboard.classList.add('hidden');
    
    // Show will creator
    willCreator.classList.remove('hidden');
    
    // Reset form and progress for both new and editing wills
    if (!editingWillId) {
        // Creating new will - full reset
        document.getElementById('willForm').reset();
        currentStep = 1;
        updateProgressBar();
        showStep(1);
    } else {
        // Editing existing will - ensure we start at step 1
        // Form will be populated by populateWillForm after this
        currentStep = 1;
        updateProgressBar();
        showStep(1);
    }
}

function hideWillCreator() {
    willCreator.classList.add('hidden');
    
    // COMPLETE STATE RESET when hiding will creator
    editingWillId = null; // Clear editing state
    currentStep = 1; // Reset step counter
    
    // Reset form
    document.getElementById('willForm').reset();
    
    // Clear any dynamic content
    const walletsContainer = document.getElementById('walletsContainer');
    const primaryBeneficiaries = document.getElementById('primaryBeneficiaries');
    const contingentBeneficiaries = document.getElementById('contingentBeneficiaries');
    const trustedContactsContainer = document.getElementById('trustedContactsContainer');
    
    if (walletsContainer) walletsContainer.innerHTML = '';
    if (primaryBeneficiaries) primaryBeneficiaries.innerHTML = '';
    if (contingentBeneficiaries) contingentBeneficiaries.innerHTML = '';
    if (trustedContactsContainer) trustedContactsContainer.innerHTML = '';
    
    // Reset progress bar
    updateProgressBar();
    
    showDashboard();
}

function updateProgressBar() {
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNumber < currentStep) {
            step.classList.add('completed');
        } else if (stepNumber === currentStep) {
            step.classList.add('active');
        }
    });
}

function showStep(stepNumber) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const tabs = ['personal', 'assets', 'beneficiaries', 'instructions', 'review'];
    const tabId = tabs[stepNumber - 1] + 'Tab';
    document.getElementById(tabId).classList.add('active');
    
    // Update review content if on review step
    if (stepNumber === 5) {
        updateReviewContent();
    }
}

function nextStep(stepNumber) {
    if (validateCurrentStep()) {
        currentStep = stepNumber;
        updateProgressBar();
        showStep(stepNumber);
    }
}

function prevStep(stepNumber) {
    currentStep = stepNumber;
    updateProgressBar();
    showStep(stepNumber);
}

function validateCurrentStep() {
    const currentTab = document.querySelector('.tab-content.active');
    const requiredFields = currentTab.querySelectorAll('input[required], select[required], textarea[required]');
    
    for (let field of requiredFields) {
        if (!field.value.trim()) {
            field.focus();
            showError('willError', 'Please fill in all required fields');
            return false;
        }
    }
    
    // Additional validation for specific steps
    if (currentStep === 3) {
        // Validate beneficiary percentages
        const percentages = Array.from(document.querySelectorAll('input[name="beneficiaryPercentage"]'))
            .map(input => parseInt(input.value) || 0);
        
        const total = percentages.reduce((sum, pct) => sum + pct, 0);
        if (total !== 100) {
            showError('willError', 'Beneficiary percentages must total 100%');
            return false;
        }
    }
    
    return true;
}

function updateReviewContent() {
    const formData = new FormData(document.getElementById('willForm'));
    const reviewContent = document.getElementById('reviewContent');
    
    // Personal Information
    const personalInfo = {
        title: formData.get('title'),
        fullName: formData.get('fullName'),
        dateOfBirth: formData.get('dateOfBirth'),
        address: formData.get('address'),
        phone: formData.get('phone'),
        ssn: formData.get('ssn'),
        executorName: formData.get('executorName'),
        executorContact: formData.get('executorContact')
    };
    
    // Bitcoin Assets - Wallets
    const wallets = [];
    const walletTypes = formData.getAll('walletType');
    const walletValues = formData.getAll('walletValue');
    const walletDescriptions = formData.getAll('walletDescription');
    const walletAddresses = formData.getAll('walletAddress');
    
    for (let i = 0; i < walletTypes.length; i++) {
        if (walletTypes[i] || walletValues[i] || walletDescriptions[i]) {
            wallets.push({
                type: walletTypes[i] || 'Not specified',
                value: walletValues[i] || 'Not specified',
                description: walletDescriptions[i] || 'Not specified',
                address: walletAddresses[i] || 'Not specified'
            });
        }
    }
    
    // Storage Information
    const storageInfo = {
        method: formData.get('storageMethod'),
        location: formData.get('storageLocation'),
        details: formData.get('storageDetails')
    };
    
    // Beneficiaries - Primary
    const primaryBeneficiaries = [];
    const primaryNames = formData.getAll('beneficiaryName');
    const primaryRelationships = formData.getAll('beneficiaryRelationship');
    const primaryPercentages = formData.getAll('beneficiaryPercentage');
    const primaryContacts = formData.getAll('beneficiaryContact');
    const primaryBitcoinAddresses = formData.getAll('beneficiaryBitcoinAddress');
    
    for (let i = 0; i < primaryNames.length; i++) {
        if (primaryNames[i]) {
            primaryBeneficiaries.push({
                name: primaryNames[i],
                relationship: primaryRelationships[i] || 'Not specified',
                percentage: primaryPercentages[i] || 'Not specified',
                contact: primaryContacts[i] || 'Not specified',
                bitcoinAddress: primaryBitcoinAddresses[i] || 'Not specified'
            });
        }
    }
    
    // Instructions
    const instructions = {
        accessInstructions: formData.get('accessInstructions'),
        securityNotes: formData.get('securityNotes')
    };
    
    // Trusted Contacts
    const trustedContacts = [];
    const contactNames = formData.getAll('trustedContactName');
    const contactInfos = formData.getAll('trustedContactInfo');
    
    for (let i = 0; i < contactNames.length; i++) {
        if (contactNames[i]) {
            trustedContacts.push({
                name: contactNames[i],
                contact: contactInfos[i] || 'Not specified'
            });
        }
    }
    
    // Generate comprehensive review content with mobile-friendly structure
    reviewContent.innerHTML = `
        <div class="review-section">
            <h3>📋 Personal Information</h3>
            <div class="review-grid">
                <div class="review-item"><strong>Will Title:</strong><br>${personalInfo.title || 'Not specified'}</div>
                <div class="review-item"><strong>Full Name:</strong><br>${personalInfo.fullName || 'Not specified'}</div>
                <div class="review-item"><strong>Date of Birth:</strong><br>${personalInfo.dateOfBirth || 'Not specified'}</div>
                <div class="review-item"><strong>Address:</strong><br>${personalInfo.address || 'Not specified'}</div>
                <div class="review-item"><strong>Phone:</strong><br>${personalInfo.phone || 'Not specified'}</div>
                <div class="review-item"><strong>SSN:</strong><br>${personalInfo.ssn ? '***-**-' + personalInfo.ssn.slice(-4) : 'Not provided'}</div>
                <div class="review-item"><strong>Executor Name:</strong><br>${personalInfo.executorName || 'Not specified'}</div>
                <div class="review-item"><strong>Executor Contact:</strong><br>${personalInfo.executorContact || 'Not specified'}</div>
            </div>
        </div>
        
        <div class="review-section">
            <h3>₿ Bitcoin Assets</h3>
            ${wallets.length > 0 ? `
                <div class="wallets-review">
                    ${wallets.map((wallet, index) => `
                        <div class="wallet-review-item">
                            <h4>Wallet ${index + 1}</h4>
                            <div class="wallet-details">
                                <div class="detail-row"><strong>Type:</strong><br>${wallet.type}</div>
                                <div class="detail-row"><strong>Value:</strong><br>${wallet.value}</div>
                                <div class="detail-row"><strong>Description:</strong><br>${wallet.description}</div>
                                <div class="detail-row address-row"><strong>Address:</strong><br><span class="bitcoin-address">${wallet.address}</span></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p>No wallets specified</p>'}
            
            <div class="storage-review">
                <h4>Storage Information</h4>
                <div class="storage-details">
                    <div class="detail-row"><strong>Method:</strong><br>${storageInfo.method || 'Not specified'}</div>
                    <div class="detail-row"><strong>Location:</strong><br>${storageInfo.location || 'Not specified'}</div>
                    <div class="detail-row"><strong>Details:</strong><br>${storageInfo.details || 'Not specified'}</div>
                </div>
            </div>
        </div>
        
        <div class="review-section">
            <h3>👥 Beneficiaries</h3>
            ${primaryBeneficiaries.length > 0 ? `
                <div class="beneficiaries-review">
                    <h4>Primary Beneficiaries</h4>
                    ${primaryBeneficiaries.map((beneficiary, index) => `
                        <div class="beneficiary-review-item">
                            <h5>Beneficiary ${index + 1}</h5>
                            <div class="beneficiary-details">
                                <div class="detail-row"><strong>Name:</strong><br>${beneficiary.name}</div>
                                <div class="detail-row"><strong>Relationship:</strong><br>${beneficiary.relationship}</div>
                                <div class="detail-row"><strong>Percentage:</strong><br>${beneficiary.percentage}%</div>
                                <div class="detail-row"><strong>Contact:</strong><br>${beneficiary.contact}</div>
                                <div class="detail-row address-row"><strong>Bitcoin Address:</strong><br><span class="bitcoin-address">${beneficiary.bitcoinAddress}</span></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p>No beneficiaries specified</p>'}
        </div>
        
        <div class="review-section">
            <h3>📝 Instructions</h3>
            <div class="instructions-review">
                <div class="instruction-section">
                    <h4>Access Instructions:</h4>
                    <div class="instruction-text">${instructions.accessInstructions || 'Not specified'}</div>
                </div>
                
                <div class="instruction-section">
                    <h4>Security Notes:</h4>
                    <div class="instruction-text">${instructions.securityNotes || 'Not specified'}</div>
                </div>
            </div>
            
            ${trustedContacts.length > 0 ? `
                <div class="trusted-contacts-review">
                    <h4>Trusted Contacts</h4>
                    <div class="contacts-list">
                        ${trustedContacts.map((contact, index) => `
                            <div class="contact-item">
                                <strong>${contact.name}:</strong><br>
                                <span class="contact-info">${contact.contact}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function addWallet() {
    const container = document.getElementById('walletsContainer');
    const walletCount = container.children.length + 1;
    
    const walletHTML = `
        <div class="wallet-entry">
            <h4>Wallet ${walletCount}</h4>
            <div class="form-grid">
                <div class="form-group">
                    <label>Cryptocurrency Type</label>
                    <input type="text" name="walletType" value="Bitcoin" required>
                </div>
                <div class="form-group">
                    <label>Approximate Value</label>
                    <input type="text" name="walletValue" placeholder="$10,000 or 0.5 BTC">
                </div>
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" name="walletDescription" placeholder="Hardware wallet, exchange account, etc.">
            </div>
            <div class="form-group">
                <label>Wallet Address (Public)</label>
                <input type="text" name="walletAddress" placeholder="Public wallet address">
            </div>
            <button type="button" class="btn btn-outline" onclick="removeWallet(this)">Remove Wallet</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', walletHTML);
}

function removeWallet(button) {
    button.closest('.wallet-entry').remove();
}

function addBeneficiary(type) {
    const container = document.getElementById(type + 'Beneficiaries');
    const beneficiaryCount = container.children.length + 1;
    const title = type === 'primary' ? 'Primary' : 'Contingent';
    
    const beneficiaryHTML = `
        <div class="beneficiary-entry">
            <h4>${title} Beneficiary ${beneficiaryCount}</h4>
            <div class="form-grid">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="beneficiaryName" required>
                </div>
                <div class="form-group">
                    <label>Relationship</label>
                    <input type="text" name="beneficiaryRelationship" placeholder="Spouse, child, etc.">
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Percentage (%)</label>
                    <input type="number" name="beneficiaryPercentage" min="0" max="100" required>
                </div>
                <div class="form-group">
                    <label>Contact Information</label>
                    <input type="text" name="beneficiaryContact" placeholder="Phone or email">
                </div>
            </div>
            <button type="button" class="btn btn-outline" onclick="removeBeneficiary(this)">Remove Beneficiary</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', beneficiaryHTML);
}

function removeBeneficiary(button) {
    button.closest('.beneficiary-entry').remove();
}

function addTrustedContact() {
    const container = document.getElementById('trustedContacts');
    
    const contactHTML = `
        <div class="form-grid" style="margin-bottom: 16px;">
            <div class="form-group">
                <label>Contact Name</label>
                <input type="text" name="trustedContactName" placeholder="Technical advisor name">
            </div>
            <div class="form-group">
                <label>Contact Information</label>
                <input type="text" name="trustedContactInfo" placeholder="Phone or email">
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', contactHTML);
}

async function handleWillSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    if (!userSubscription || !userSubscription.active) {
        showSubscriptionModal();
        return;
    }
    
    if (!validateCurrentStep()) {
        return;
    }
    
    showLoading();
    
    try {
        const formData = new FormData(e.target);
        const willData = extractWillData(formData);
        
        let response;
        
        if (editingWillId) {
            // Update existing will
            response = await fetch(API_BASE_URL + `/will/${editingWillId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(willData)
            });
        } else {
            // Create new will
            response = await fetch(API_BASE_URL + '/will/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(willData)
            });
        }
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert(editingWillId ? 'Will updated successfully!' : 'Bitcoin will created successfully!', 'success');
            hideWillCreator();
            showDashboard();
        } else {
            throw new Error(data.message || 'Failed to save will');
        }
    } catch (error) {
        console.error('Will submit error:', error);
        showAlert('Failed to save will. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function extractWillData(formData) {
    const data = {
        title: formData.get('title'),
        personal_info: {
            full_name: formData.get('fullName'),
            date_of_birth: formData.get('dateOfBirth'),
            address: formData.get('address'),
            ssn: formData.get('ssn'),
            executor_name: formData.get('executorName'),
            executor_contact: formData.get('executorContact')
        },
        assets: {
            wallets: [],
            storage_method: formData.get('storageMethod'),
            storage_location: formData.get('storageLocation'),
            storage_details: formData.get('storageDetails')
        },
        beneficiaries: {
            primary: [],
            contingent: []
        },
        instructions: {
            access_instructions: formData.get('accessInstructions'),
            security_notes: formData.get('securityNotes'),
            trusted_contacts: []
        }
    };
    
    // Extract wallet data
    const walletTypes = formData.getAll('walletType');
    const walletValues = formData.getAll('walletValue');
    const walletDescriptions = formData.getAll('walletDescription');
    const walletAddresses = formData.getAll('walletAddress');
    
    for (let i = 0; i < walletTypes.length; i++) {
        data.assets.wallets.push({
            type: walletTypes[i],
            value: walletValues[i],
            description: walletDescriptions[i],
            address: walletAddresses[i]
        });
    }
    
    // Extract beneficiary data
    const beneficiaryNames = formData.getAll('beneficiaryName');
    const beneficiaryRelationships = formData.getAll('beneficiaryRelationship');
    const beneficiaryPercentages = formData.getAll('beneficiaryPercentage');
    const beneficiaryContacts = formData.getAll('beneficiaryContact');
    
    // Determine primary vs contingent based on container
    const primaryContainer = document.getElementById('primaryBeneficiaries');
    const primaryCount = primaryContainer.querySelectorAll('.beneficiary-entry').length;
    
    for (let i = 0; i < beneficiaryNames.length; i++) {
        const beneficiary = {
            name: beneficiaryNames[i],
            relationship: beneficiaryRelationships[i],
            percentage: parseInt(beneficiaryPercentages[i]),
            contact: beneficiaryContacts[i]
        };
        
        if (i < primaryCount) {
            data.beneficiaries.primary.push(beneficiary);
        } else {
            data.beneficiaries.contingent.push(beneficiary);
        }
    }
    
    // Extract trusted contacts
    const trustedContactNames = formData.getAll('trustedContactName');
    const trustedContactInfos = formData.getAll('trustedContactInfo');
    
    for (let i = 0; i < trustedContactNames.length; i++) {
        if (trustedContactNames[i]) {
            data.instructions.trusted_contacts.push({
                name: trustedContactNames[i],
                contact: trustedContactInfos[i]
            });
        }
    }
    
    return data;
}

async function downloadWill(willId) {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + `/will/${willId}/download`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            // Get the filename from the response headers or use a default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'bitcoin_will.pdf';
            
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Will downloaded successfully!', 'success');
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to download will', 'error');
        }
    } catch (error) {
        console.error('Download will error:', error);
        showAlert('Failed to download will', 'error');
    } finally {
        hideLoading();
    }
}

async function editWill(willId) {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        showLoading();
        
        // Fetch will data
        const response = await fetch(API_BASE_URL + `/will/${willId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const will = data.will;
            
            // Set editing state
            editingWillId = willId;
            
            // FORCE RESET STATE FOR NEW WILL EDITING
            currentStep = 1;
            
            // Show will creator
            showWillCreator();
            
            // FORCE STEP 1 DISPLAY BEFORE POPULATING DATA
            updateProgressBar();
            showStep(1);
            
            // Populate form with existing data AFTER ensuring we're on step 1
            setTimeout(() => {
                populateWillForm(will);
            }, 50);
            
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to load will', 'error');
        }
    } catch (error) {
        console.error('Edit will error:', error);
        showAlert('Failed to load will for editing', 'error');
    } finally {
        hideLoading();
    }
}

// Populate form with existing will data
function populateWillForm(will) {
    console.log('Populating will form with data:', will);
    
    // Personal Information - Handle JSON string parsing
    if (will.personal_info) {
        let personal;
        
        // Check if personal_info is a string that needs parsing
        if (typeof will.personal_info === 'string') {
            try {
                personal = JSON.parse(will.personal_info);
                console.log('Parsed personal_info:', personal);
            } catch (e) {
                console.error('Failed to parse personal_info JSON:', e);
                personal = {};
            }
        } else {
            personal = will.personal_info;
        }
        
        if (personal && Object.keys(personal).length > 0) {
            setFormValue('title', will.title);
            setFormValue('fullName', personal.full_name);
            setFormValue('dateOfBirth', personal.date_of_birth);
            
            // Handle address - could be string or object
            if (personal.address) {
                if (typeof personal.address === 'string') {
                    setFormValue('address', personal.address);
                } else if (typeof personal.address === 'object') {
                    // If address is an object, convert to string or handle appropriately
                    const addressStr = `${personal.address.street || ''}, ${personal.address.city || ''}, ${personal.address.state || ''} ${personal.address.zip_code || ''}`.trim();
                    setFormValue('address', addressStr);
                }
            }
            
            setFormValue('phone', personal.phone);
            setFormValue('ssn', personal.ssn);
            setFormValue('executorName', personal.executor_name);
            setFormValue('executorContact', personal.executor_contact);
        }
    }
    
    // Bitcoin Assets - Check both 'assets' and 'bitcoin_assets' fields
    const assets = will.assets || will.bitcoin_assets || {};
    console.log('Assets data:', assets);
    
    if (assets && Object.keys(assets).length > 0) {
        // Storage information
        setFormValue('storageMethod', assets.storage_method);
        setFormValue('storageLocation', assets.storage_location);
        setFormValue('storageDetails', assets.storage_details);
        
        // Populate wallets
        if (assets.wallets && Array.isArray(assets.wallets) && assets.wallets.length > 0) {
            const walletsContainer = document.getElementById('walletsContainer');
            walletsContainer.innerHTML = '';
            
            assets.wallets.forEach((wallet, index) => {
                addWallet();
                const walletEntries = walletsContainer.querySelectorAll('.wallet-entry');
                const currentEntry = walletEntries[walletEntries.length - 1];
                
                setFormValueInContainer(currentEntry, 'walletName', wallet.name);
                setFormValueInContainer(currentEntry, 'walletType', wallet.type);
                setFormValueInContainer(currentEntry, 'walletValue', wallet.value); // FIX: Add Bitcoin Amount population
                setFormValueInContainer(currentEntry, 'walletDescription', wallet.description);
                setFormValueInContainer(currentEntry, 'walletAddress', wallet.address); // FIX: Add wallet address population
                setFormValueInContainer(currentEntry, 'accessMethod', wallet.access_method);
                setFormValueInContainer(currentEntry, 'seedPhraseLocation', wallet.seed_phrase_location);
                setFormValueInContainer(currentEntry, 'privateKeyLocation', wallet.private_key_location);
                setFormValueInContainer(currentEntry, 'additionalNotes', wallet.additional_notes);
            });
        }
        
        // Populate exchanges
        if (assets.exchanges && Array.isArray(assets.exchanges) && assets.exchanges.length > 0) {
            const exchangesContainer = document.getElementById('exchangesContainer');
            if (exchangesContainer) {
                exchangesContainer.innerHTML = '';
                
                assets.exchanges.forEach((exchange, index) => {
                    addExchange();
                    const exchangeEntries = exchangesContainer.querySelectorAll('.exchange-entry');
                    const currentEntry = exchangeEntries[exchangeEntries.length - 1];
                    
                    setFormValueInContainer(currentEntry, 'exchangeName', exchange.name);
                    setFormValueInContainer(currentEntry, 'exchangeUsername', exchange.username);
                    setFormValueInContainer(currentEntry, 'twoFactorBackup', exchange.two_factor_backup);
                    setFormValueInContainer(currentEntry, 'exchangeNotes', exchange.notes);
                });
            }
        }
        
        // Other crypto assets
        setFormValue('otherCrypto', assets.other_crypto);
    }
    
    // Beneficiaries
    const beneficiaries = will.beneficiaries || {};
    console.log('Beneficiaries data:', beneficiaries);
    
    if (beneficiaries && Object.keys(beneficiaries).length > 0) {
        // Primary beneficiaries
        if (beneficiaries.primary && Array.isArray(beneficiaries.primary) && beneficiaries.primary.length > 0) {
            const primaryContainer = document.getElementById('primaryBeneficiaries');
            primaryContainer.innerHTML = '';
            
            beneficiaries.primary.forEach((beneficiary, index) => {
                addBeneficiary('primary');
                const beneficiaryEntries = primaryContainer.querySelectorAll('.beneficiary-entry');
                const currentEntry = beneficiaryEntries[beneficiaryEntries.length - 1];
                
                setFormValueInContainer(currentEntry, 'beneficiaryName', beneficiary.name);
                setFormValueInContainer(currentEntry, 'beneficiaryRelationship', beneficiary.relationship);
                setFormValueInContainer(currentEntry, 'beneficiaryPercentage', beneficiary.percentage);
                setFormValueInContainer(currentEntry, 'beneficiaryContact', beneficiary.contact);
                setFormValueInContainer(currentEntry, 'beneficiaryBitcoinAddress', beneficiary.bitcoin_address);
            });
        }
        
        // Contingent beneficiaries
        if (beneficiaries.contingent && Array.isArray(beneficiaries.contingent) && beneficiaries.contingent.length > 0) {
            const contingentContainer = document.getElementById('contingentBeneficiaries');
            contingentContainer.innerHTML = '';
            
            beneficiaries.contingent.forEach((beneficiary, index) => {
                addBeneficiary('contingent');
                const beneficiaryEntries = contingentContainer.querySelectorAll('.beneficiary-entry');
                const currentEntry = beneficiaryEntries[beneficiaryEntries.length - 1];
                
                setFormValueInContainer(currentEntry, 'beneficiaryName', beneficiary.name);
                setFormValueInContainer(currentEntry, 'beneficiaryRelationship', beneficiary.relationship);
                setFormValueInContainer(currentEntry, 'beneficiaryPercentage', beneficiary.percentage);
                setFormValueInContainer(currentEntry, 'beneficiaryContact', beneficiary.contact);
                setFormValueInContainer(currentEntry, 'beneficiaryBitcoinAddress', beneficiary.bitcoin_address);
            });
        }
    }
    
    // Instructions - Check both 'instructions' and 'executor_instructions' fields
    const instructions = will.instructions || will.executor_instructions || {};
    console.log('Instructions data:', instructions);
    
    if (instructions && Object.keys(instructions).length > 0) {
        setFormValue('accessInstructions', instructions.access_instructions);
        setFormValue('securityNotes', instructions.security_notes);
        
        // Trusted contacts
        if (instructions.trusted_contacts && Array.isArray(instructions.trusted_contacts) && instructions.trusted_contacts.length > 0) {
            const contactsContainer = document.getElementById('trustedContacts');
            contactsContainer.innerHTML = '';
            
            instructions.trusted_contacts.forEach((contact, index) => {
                addTrustedContact();
                const contactEntries = contactsContainer.querySelectorAll('.form-grid');
                const currentEntry = contactEntries[contactEntries.length - 1];
                
                setFormValueInContainer(currentEntry, 'trustedContactName', contact.name);
                setFormValueInContainer(currentEntry, 'trustedContactInfo', contact.contact);
            });
        }
    }
    
    // Update review content after populating all data - BUT DON'T SHOW REVIEW STEP
    setTimeout(() => {
        updateReviewContent();
        // ENSURE WE STAY ON STEP 1 AFTER POPULATING DATA
        if (editingWillId) {
            currentStep = 1;
            updateProgressBar();
            showStep(1);
        }
    }, 100);
}

// Helper function to set form values safely
function setFormValue(fieldName, value) {
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (field && value !== undefined && value !== null) {
        field.value = value;
    }
}

// Helper function to set form values within a specific container
function setFormValueInContainer(container, fieldName, value) {
    const field = container.querySelector(`[name="${fieldName}"]`);
    if (field && value !== undefined && value !== null) {
        field.value = value;
    }
}

// Utility Functions
function showLoading() {
    loadingOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideError(elementId);
        }, 5000);
    } else {
        // Fallback to styled alert if error element not found
        showAlert(message, 'error');
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.classList.remove('show');
    }
}

function toggleMobileMenu() {
    const nav = document.getElementById('nav');
    nav.classList.toggle('mobile-open');
}

// Navigation Functions
function goHome() {
    // CLOSE MOBILE MENU AFTER NAVIGATION
    closeMobileMenu();
    
    document.querySelector('main').style.display = 'block';
    dashboard.classList.add('hidden');
    willCreator.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Handle URL parameters for payment success/failure
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('payment') === 'success') {
        const sessionId = urlParams.get('session_id');
        if (sessionId && authToken) {
            handlePaymentSuccess(sessionId);
        } else if (authToken) {
            // Payment successful but no session ID, just reload subscription status
            loadSubscriptionStatus();
            showDashboard();
            showPaymentSuccessMessage();
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('payment') === 'cancelled') {
        // Payment cancelled
        showAlert('Payment was cancelled. You can try again anytime.', 'warning');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('return') === 'portal') {
        // Returning from Stripe customer portal
        if (authToken) {
            loadSubscriptionStatus();
            showDashboard();
            showAlert('Subscription management completed successfully!', 'success');
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}


// Mobile menu functionality
function toggleMobileMenu() {
    const nav = document.getElementById('nav');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    nav.classList.toggle('mobile-open');
    mobileMenuBtn.classList.toggle('active');
}

// CLOSE MOBILE MENU AFTER NAVIGATION
function closeMobileMenu() {
    const nav = document.getElementById('nav');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    nav.classList.remove('mobile-open');
    mobileMenuBtn.classList.remove('active');
}
// ALERT MODAL SYSTEM - Replace JavaScript alerts with styled modals
function showAlert(message, type = 'info', title = null) {
    const alertModal = document.getElementById('alertModal');
    const alertIcon = document.getElementById('alertIcon');
    const alertIconSymbol = document.getElementById('alertIconSymbol');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    
    // Set alert type and styling
    alertIcon.className = 'alert-icon';
    
    switch (type) {
        case 'success':
            alertIcon.classList.add('success');
            alertIconSymbol.textContent = '✅';
            alertTitle.textContent = title || 'Success';
            break;
        case 'error':
            alertIcon.classList.add('error');
            alertIconSymbol.textContent = '❌';
            alertTitle.textContent = title || 'Error';
            break;
        case 'warning':
            alertIcon.classList.add('warning');
            alertIconSymbol.textContent = '⚠️';
            alertTitle.textContent = title || 'Warning';
            break;
        default: // info
            alertIconSymbol.textContent = 'ℹ️';
            alertTitle.textContent = title || 'Information';
    }
    
    // Set message
    alertMessage.textContent = message;
    
    // Show modal
    alertModal.classList.remove('hidden');
    
    // Focus on OK button for accessibility
    setTimeout(() => {
        document.getElementById('alertOkBtn').focus();
    }, 100);
}

function closeAlert() {
    const alertModal = document.getElementById('alertModal');
    alertModal.classList.add('hidden');
}

// Close alert on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const alertModal = document.getElementById('alertModal');
        if (!alertModal.classList.contains('hidden')) {
            closeAlert();
        }
    }
});

// Close alert when clicking outside the modal
document.getElementById('alertModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeAlert();
    }
});


// DELETE WILL FUNCTIONALITY
async function deleteWill(willId, willTitle) {
    // Show confirmation modal instead of browser confirm
    const confirmDelete = await showConfirmDialog(
        `Are you sure you want to delete "${willTitle}"?`,
        'This action cannot be undone. The will and all its data will be permanently removed.',
        'Delete Will',
        'Cancel'
    );
    
    if (!confirmDelete) {
        return;
    }
    
    if (!authToken) {
        showAlert('Please log in to delete wills.', 'error');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + `/will/${willId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            showAlert('Will deleted successfully!', 'success');
            // Refresh the dashboard to remove the deleted will
            await loadDashboardData();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to delete will', 'error');
        }
    } catch (error) {
        console.error('Delete will error:', error);
        showAlert('Failed to delete will. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// CONFIRMATION DIALOG SYSTEM
function showConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        // Create confirmation modal HTML
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.id = 'confirmModal';
        
        confirmModal.innerHTML = `
            <div class="modal-content alert-modal">
                <div class="alert-header">
                    <div class="alert-icon warning">
                        <span>⚠️</span>
                    </div>
                    <h3>${title}</h3>
                </div>
                <div class="alert-body">
                    <p>${message}</p>
                </div>
                <div class="alert-footer">
                    <button class="btn btn-outline" onclick="resolveConfirm(false)">${cancelText}</button>
                    <button class="btn btn-danger" onclick="resolveConfirm(true)">${confirmText}</button>
                </div>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(confirmModal);
        
        // Show modal
        confirmModal.classList.remove('hidden');
        
        // Store resolve function globally for button handlers
        window.resolveConfirm = (result) => {
            document.body.removeChild(confirmModal);
            delete window.resolveConfirm;
            resolve(result);
        };
        
        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escapeHandler);
                window.resolveConfirm(false);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Close when clicking outside
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                window.resolveConfirm(false);
            }
        });
    });
}


// LEGAL MODAL FUNCTIONS
function showTermsModal() {
    document.getElementById('termsModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeTermsModal() {
    document.getElementById('termsModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function showPrivacyModal() {
    document.getElementById('privacyModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePrivacyModal() {
    document.getElementById('privacyModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function showLegalDisclaimerModal() {
    document.getElementById('legalDisclaimerModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLegalDisclaimerModal() {
    document.getElementById('legalDisclaimerModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Close legal modals when clicking outside
document.addEventListener('click', function(event) {
    const termsModal = document.getElementById('termsModal');
    const privacyModal = document.getElementById('privacyModal');
    const legalModal = document.getElementById('legalDisclaimerModal');
    
    if (event.target === termsModal) {
        closeTermsModal();
    }
    if (event.target === privacyModal) {
        closePrivacyModal();
    }
    if (event.target === legalModal) {
        closeLegalDisclaimerModal();
    }
});

// Close legal modals with ESC key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeTermsModal();
        closePrivacyModal();
        closeLegalDisclaimerModal();
    }
});

// LEGAL COMPLIANCE WARNINGS
function showWillCreationWarning() {
    const warningMessage = `
        <strong>IMPORTANT LEGAL NOTICE</strong><br><br>
        Before creating your Bitcoin Asset Addendum, please understand:<br><br>
        • This is a document template, not legal advice<br>
        • You must consult with a qualified attorney<br>
        • Estate planning laws vary by jurisdiction<br>
        • Proper execution may require witnesses/notarization<br><br>
        Do you wish to continue?
    `;
    
    return confirm(warningMessage);
}

// Add legal warning before will creation
const originalShowWillForm = showWillForm;
showWillForm = function() {
    if (showWillCreationWarning()) {
        originalShowWillForm();
    }
};

// ENHANCED LEGAL DISCLAIMERS FOR WILL STEPS
function addLegalWarningToStep(stepNumber) {
    const warnings = {
        1: "Remember: This information will be used to create a legal document template. Consult with an attorney for legal advice.",
        2: "Important: Accurate Bitcoin asset information is crucial for estate planning. Consider professional cryptocurrency guidance.",
        3: "Note: Beneficiary designations have legal implications. Ensure compliance with your jurisdiction's inheritance laws.",
        4: "Reminder: Access instructions are critical for your beneficiaries. Consider security implications and legal requirements.",
        5: "Final Notice: Review all information carefully. This document should be reviewed by qualified legal counsel before execution."
    };
    
    const warning = warnings[stepNumber];
    if (warning) {
        const warningElement = document.createElement('div');
        warningElement.className = 'legal-warning';
        warningElement.innerHTML = `<strong>⚠️ Legal Notice:</strong> ${warning}`;
        
        const stepContent = document.querySelector(`#step${stepNumber}`);
        if (stepContent) {
            stepContent.insertBefore(warningElement, stepContent.firstChild);
        }
    }
}


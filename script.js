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
            
            if (!isLogin) {
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
    `;
    
    successDiv.innerHTML = `
        <div style="color: #10b981; font-size: 3rem; margin-bottom: 1rem;">✓</div>
        <h3 style="margin: 0 0 1rem 0; color: #1f2937;">Payment Successful!</h3>
        <p style="margin: 0; color: #6b7280;">Your subscription is now active. Redirecting to dashboard...</p>
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        document.body.removeChild(successDiv);
    }, 3000);
}

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

// Navigation Functions
function goHome() {
    // Hide all sections
    dashboard.classList.add('hidden');
    willCreator.classList.add('hidden');
    
    // Show main content
    document.querySelector('main').style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboard() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    // Hide main content
    document.querySelector('main').style.display = 'none';
    
    // Show dashboard
    dashboard.classList.remove('hidden');
    willCreator.classList.add('hidden');
    
    // Load wills
    loadWills();
}

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
    
    // Hide main content and dashboard
    document.querySelector('main').style.display = 'none';
    dashboard.classList.add('hidden');
    
    // Show will creator
    willCreator.classList.remove('hidden');
    
    // Reset form
    currentStep = 1;
    editingWillId = null;
    document.getElementById('willForm').reset();
    showStep(1);
}

function hideWillCreator() {
    willCreator.classList.add('hidden');
    showDashboard();
}

// Will Creation Functions
function showStep(step) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        const stepElement = document.getElementById(`step${i}`);
        if (stepElement) {
            stepElement.classList.add('hidden');
        }
    }
    
    // Show current step
    const currentStepElement = document.getElementById(`step${step}`);
    if (currentStepElement) {
        currentStepElement.classList.remove('hidden');
    }
    
    // Update progress
    updateProgress();
    
    // Update navigation buttons
    updateNavigationButtons();
}

function updateProgress() {
    const progressBar = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar) {
        const progress = (currentStep / 4) * 100;
        progressBar.style.width = `${progress}%`;
    }
    
    if (progressText) {
        progressText.textContent = `Step ${currentStep} of 4`;
    }
}

function updateNavigationButtons() {
    const prevBtn = document.querySelector('.prev-step');
    const nextBtn = document.querySelector('.next-step');
    const submitBtn = document.querySelector('.submit-will');
    
    if (prevBtn) {
        prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';
    }
    
    if (nextBtn) {
        nextBtn.style.display = currentStep < 4 ? 'inline-block' : 'none';
    }
    
    if (submitBtn) {
        submitBtn.style.display = currentStep === 4 ? 'inline-block' : 'none';
    }
}

function nextStep() {
    if (currentStep < 4) {
        currentStep++;
        showStep(currentStep);
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

// FIXED: Form validation that handles hidden fields properly
function validateCurrentStep() {
    const currentStepElement = document.getElementById(`step${currentStep}`);
    if (!currentStepElement) return true;
    
    const requiredFields = currentStepElement.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        // FIX: Remove required attribute from hidden fields to prevent validation errors
        if (field.offsetParent === null) {
            field.removeAttribute('required');
            return;
        }
        
        if (!field.value.trim()) {
            field.classList.add('error');
            isValid = false;
        } else {
            field.classList.remove('error');
        }
    });
    
    if (!isValid) {
        alert('Please fill in all required fields before proceeding.');
    }
    
    return isValid;
}

async function handleWillSubmit(e) {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    showLoading();
    
    try {
        const willData = extractWillData();
        
        let response;
        if (editingWillId) {
            // Update existing will
            response = await fetch(`${API_BASE_URL}/will/${editingWillId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(willData)
            });
        } else {
            // Create new will
            response = await fetch(`${API_BASE_URL}/will/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(willData)
            });
        }
        
        if (response.ok) {
            const result = await response.json();
            alert(editingWillId ? 'Will updated successfully!' : 'Will created successfully!');
            showDashboard();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save will');
        }
    } catch (error) {
        console.error('Will submit error:', error);
        alert('Error saving will: ' + error.message);
    } finally {
        hideLoading();
    }
}

function extractWillData() {
    const formData = new FormData(document.getElementById('willForm'));
    
    // Extract personal information
    const personalInfo = {
        full_name: formData.get('fullName'),
        date_of_birth: formData.get('dateOfBirth'),
        phone: formData.get('phone'),
        address: {
            street: formData.get('street'),
            city: formData.get('city'),
            state: formData.get('state'),
            zip_code: formData.get('zipCode'),
            country: formData.get('country')
        },
        executor_name: formData.get('executorName'),
        executor_contact: formData.get('executorContact')
    };
    
    // Extract Bitcoin assets
    const assets = {
        storage_method: formData.get('storageMethod'),
        storage_location: formData.get('storageLocation'),
        storage_details: formData.get('storageDetails'),
        wallets: [],
        exchanges: []
    };
    
    // Collect wallet data
    const walletContainers = document.querySelectorAll('.wallet-container');
    walletContainers.forEach(container => {
        const wallet = {
            name: container.querySelector('[name="walletName"]')?.value || '',
            type: container.querySelector('[name="walletType"]')?.value || '',
            description: container.querySelector('[name="walletDescription"]')?.value || '',
            access_method: container.querySelector('[name="accessMethod"]')?.value || '',
            seed_phrase_location: container.querySelector('[name="seedPhraseLocation"]')?.value || '',
            private_key_location: container.querySelector('[name="privateKeyLocation"]')?.value || '',
            additional_notes: container.querySelector('[name="walletNotes"]')?.value || ''
        };
        
        if (wallet.name || wallet.type || wallet.description) {
            assets.wallets.push(wallet);
        }
    });
    
    // Collect exchange data
    const exchangeContainers = document.querySelectorAll('.exchange-container');
    exchangeContainers.forEach(container => {
        const exchange = {
            name: container.querySelector('[name="exchangeName"]')?.value || '',
            username: container.querySelector('[name="exchangeUsername"]')?.value || '',
            email: container.querySelector('[name="exchangeEmail"]')?.value || '',
            two_factor_backup: container.querySelector('[name="twoFactorBackup"]')?.value || '',
            additional_notes: container.querySelector('[name="exchangeNotes"]')?.value || ''
        };
        
        if (exchange.name || exchange.username || exchange.email) {
            assets.exchanges.push(exchange);
        }
    });
    
    // Extract beneficiaries
    const beneficiaries = {
        primary: [],
        contingent: []
    };
    
    // Collect primary beneficiaries
    const primaryContainers = document.querySelectorAll('.primary-beneficiary-container');
    primaryContainers.forEach(container => {
        const beneficiary = {
            name: container.querySelector('[name="beneficiaryName"]')?.value || '',
            relationship: container.querySelector('[name="relationship"]')?.value || '',
            percentage: container.querySelector('[name="percentage"]')?.value || '',
            phone: container.querySelector('[name="beneficiaryPhone"]')?.value || '',
            email: container.querySelector('[name="beneficiaryEmail"]')?.value || '',
            bitcoin_address: container.querySelector('[name="bitcoinAddress"]')?.value || '',
            address: {
                street: container.querySelector('[name="beneficiaryStreet"]')?.value || '',
                city: container.querySelector('[name="beneficiaryCity"]')?.value || '',
                state: container.querySelector('[name="beneficiaryState"]')?.value || '',
                zip_code: container.querySelector('[name="beneficiaryZip"]')?.value || '',
                country: container.querySelector('[name="beneficiaryCountry"]')?.value || ''
            }
        };
        
        if (beneficiary.name || beneficiary.relationship) {
            beneficiaries.primary.push(beneficiary);
        }
    });
    
    // Collect contingent beneficiaries
    const contingentContainers = document.querySelectorAll('.contingent-beneficiary-container');
    contingentContainers.forEach(container => {
        const beneficiary = {
            name: container.querySelector('[name="contingentName"]')?.value || '',
            relationship: container.querySelector('[name="contingentRelationship"]')?.value || '',
            percentage: container.querySelector('[name="contingentPercentage"]')?.value || '',
            phone: container.querySelector('[name="contingentPhone"]')?.value || '',
            email: container.querySelector('[name="contingentEmail"]')?.value || '',
            bitcoin_address: container.querySelector('[name="contingentBitcoinAddress"]')?.value || '',
            address: {
                street: container.querySelector('[name="contingentStreet"]')?.value || '',
                city: container.querySelector('[name="contingentCity"]')?.value || '',
                state: container.querySelector('[name="contingentState"]')?.value || '',
                zip_code: container.querySelector('[name="contingentZip"]')?.value || '',
                country: container.querySelector('[name="contingentCountry"]')?.value || ''
            }
        };
        
        if (beneficiary.name || beneficiary.relationship) {
            beneficiaries.contingent.push(beneficiary);
        }
    });
    
    // Extract instructions
    const instructions = {
        access_instructions: formData.get('accessInstructions'),
        security_notes: formData.get('securityNotes'),
        additional_instructions: formData.get('additionalInstructions'),
        emergency_contact: formData.get('emergencyContact'),
        trusted_contacts: []
    };
    
    // Collect trusted contacts
    const contactContainers = document.querySelectorAll('.trusted-contact-container');
    contactContainers.forEach(container => {
        const contact = {
            name: container.querySelector('[name="contactName"]')?.value || '',
            contact: container.querySelector('[name="contactInfo"]')?.value || '',
            relationship: container.querySelector('[name="contactRelationship"]')?.value || '',
            role: container.querySelector('[name="contactRole"]')?.value || ''
        };
        
        if (contact.name || contact.contact) {
            instructions.trusted_contacts.push(contact);
        }
    });
    
    return {
        personal_info: personalInfo,
        assets: assets,
        beneficiaries: beneficiaries,
        instructions: instructions
    };
}

// Dashboard Functions
async function loadWills() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/will/list`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const wills = await response.json();
            updateWillsList(wills);
        } else {
            console.error('Failed to load wills');
        }
    } catch (error) {
        console.error('Load wills error:', error);
    }
}

function updateWillsList(wills) {
    const willsList = document.getElementById('willsList');
    if (!willsList) return;
    
    if (wills.length === 0) {
        willsList.innerHTML = `
            <div class="empty-state">
                <h3>No wills created yet</h3>
                <p>Create your first Bitcoin will to get started</p>
                <button onclick="showWillCreator()" class="btn btn-primary">Create Will</button>
            </div>
        `;
        return;
    }
    
    willsList.innerHTML = wills.map(will => `
        <div class="will-item">
            <div class="will-header">
                <h3>${will.title || 'Bitcoin Will'}</h3>
                <span class="will-status ${will.status}">${will.status}</span>
            </div>
            <div class="will-details">
                <p><strong>Testator:</strong> ${will.testator_name || 'Not specified'}</p>
                <p><strong>Created:</strong> ${new Date(will.created_at).toLocaleDateString()}</p>
                <p><strong>Updated:</strong> ${new Date(will.updated_at).toLocaleDateString()}</p>
            </div>
            <div class="will-actions">
                <button onclick="editWill(${will.id})" class="btn btn-secondary">Edit</button>
                <button onclick="downloadWill(${will.id})" class="btn btn-primary">Download PDF</button>
                <button onclick="deleteWill(${will.id})" class="btn btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

async function editWill(willId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/will/${willId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const willData = await response.json();
            editingWillId = willId;
            
            // Show will creator
            showWillCreator();
            
            // Populate form with existing data
            populateWillForm(willData);
        } else {
            alert('Failed to load will data');
        }
    } catch (error) {
        console.error('Edit will error:', error);
        alert('Error loading will data');
    } finally {
        hideLoading();
    }
}

function populateWillForm(willData) {
    // Populate personal info
    const personalInfo = willData.personal_info || {};
    setFormValue('fullName', personalInfo.full_name);
    setFormValue('dateOfBirth', personalInfo.date_of_birth);
    setFormValue('phone', personalInfo.phone);
    
    const address = personalInfo.address || {};
    setFormValue('street', address.street);
    setFormValue('city', address.city);
    setFormValue('state', address.state);
    setFormValue('zipCode', address.zip_code);
    setFormValue('country', address.country);
    
    setFormValue('executorName', personalInfo.executor_name);
    setFormValue('executorContact', personalInfo.executor_contact);
    
    // Populate assets
    const assets = willData.assets || {};
    setFormValue('storageMethod', assets.storage_method);
    setFormValue('storageLocation', assets.storage_location);
    setFormValue('storageDetails', assets.storage_details);
    
    // Populate wallets
    if (assets.wallets && assets.wallets.length > 0) {
        // Clear existing wallets
        document.getElementById('walletsContainer').innerHTML = '';
        
        assets.wallets.forEach((wallet, index) => {
            addWallet();
            const container = document.querySelectorAll('.wallet-container')[index];
            if (container) {
                setFormValueInContainer(container, 'walletName', wallet.name);
                setFormValueInContainer(container, 'walletType', wallet.type);
                setFormValueInContainer(container, 'walletDescription', wallet.description);
                setFormValueInContainer(container, 'accessMethod', wallet.access_method);
                setFormValueInContainer(container, 'seedPhraseLocation', wallet.seed_phrase_location);
                setFormValueInContainer(container, 'privateKeyLocation', wallet.private_key_location);
                setFormValueInContainer(container, 'walletNotes', wallet.additional_notes);
            }
        });
    }
    
    // Populate exchanges
    if (assets.exchanges && assets.exchanges.length > 0) {
        // Clear existing exchanges
        document.getElementById('exchangesContainer').innerHTML = '';
        
        assets.exchanges.forEach((exchange, index) => {
            addExchange();
            const container = document.querySelectorAll('.exchange-container')[index];
            if (container) {
                setFormValueInContainer(container, 'exchangeName', exchange.name);
                setFormValueInContainer(container, 'exchangeUsername', exchange.username);
                setFormValueInContainer(container, 'exchangeEmail', exchange.email);
                setFormValueInContainer(container, 'twoFactorBackup', exchange.two_factor_backup);
                setFormValueInContainer(container, 'exchangeNotes', exchange.additional_notes);
            }
        });
    }
    
    // Populate beneficiaries
    const beneficiaries = willData.beneficiaries || {};
    
    // Primary beneficiaries
    if (beneficiaries.primary && beneficiaries.primary.length > 0) {
        document.getElementById('primaryBeneficiariesContainer').innerHTML = '';
        
        beneficiaries.primary.forEach((beneficiary, index) => {
            addPrimaryBeneficiary();
            const container = document.querySelectorAll('.primary-beneficiary-container')[index];
            if (container) {
                setFormValueInContainer(container, 'beneficiaryName', beneficiary.name);
                setFormValueInContainer(container, 'relationship', beneficiary.relationship);
                setFormValueInContainer(container, 'percentage', beneficiary.percentage);
                setFormValueInContainer(container, 'beneficiaryPhone', beneficiary.phone);
                setFormValueInContainer(container, 'beneficiaryEmail', beneficiary.email);
                setFormValueInContainer(container, 'bitcoinAddress', beneficiary.bitcoin_address);
                
                const address = beneficiary.address || {};
                setFormValueInContainer(container, 'beneficiaryStreet', address.street);
                setFormValueInContainer(container, 'beneficiaryCity', address.city);
                setFormValueInContainer(container, 'beneficiaryState', address.state);
                setFormValueInContainer(container, 'beneficiaryZip', address.zip_code);
                setFormValueInContainer(container, 'beneficiaryCountry', address.country);
            }
        });
    }
    
    // Contingent beneficiaries
    if (beneficiaries.contingent && beneficiaries.contingent.length > 0) {
        document.getElementById('contingentBeneficiariesContainer').innerHTML = '';
        
        beneficiaries.contingent.forEach((beneficiary, index) => {
            addContingentBeneficiary();
            const container = document.querySelectorAll('.contingent-beneficiary-container')[index];
            if (container) {
                setFormValueInContainer(container, 'contingentName', beneficiary.name);
                setFormValueInContainer(container, 'contingentRelationship', beneficiary.relationship);
                setFormValueInContainer(container, 'contingentPercentage', beneficiary.percentage);
                setFormValueInContainer(container, 'contingentPhone', beneficiary.phone);
                setFormValueInContainer(container, 'contingentEmail', beneficiary.email);
                setFormValueInContainer(container, 'contingentBitcoinAddress', beneficiary.bitcoin_address);
                
                const address = beneficiary.address || {};
                setFormValueInContainer(container, 'contingentStreet', address.street);
                setFormValueInContainer(container, 'contingentCity', address.city);
                setFormValueInContainer(container, 'contingentState', address.state);
                setFormValueInContainer(container, 'contingentZip', address.zip_code);
                setFormValueInContainer(container, 'contingentCountry', address.country);
            }
        });
    }
    
    // Populate instructions
    const instructions = willData.instructions || {};
    setFormValue('accessInstructions', instructions.access_instructions);
    setFormValue('securityNotes', instructions.security_notes);
    setFormValue('additionalInstructions', instructions.additional_instructions);
    setFormValue('emergencyContact', instructions.emergency_contact);
    
    // Populate trusted contacts
    if (instructions.trusted_contacts && instructions.trusted_contacts.length > 0) {
        document.getElementById('trustedContactsContainer').innerHTML = '';
        
        instructions.trusted_contacts.forEach((contact, index) => {
            addTrustedContact();
            const container = document.querySelectorAll('.trusted-contact-container')[index];
            if (container) {
                setFormValueInContainer(container, 'contactName', contact.name);
                setFormValueInContainer(container, 'contactInfo', contact.contact);
                setFormValueInContainer(container, 'contactRelationship', contact.relationship);
                setFormValueInContainer(container, 'contactRole', contact.role);
            }
        });
    }
}

function setFormValue(name, value) {
    const element = document.querySelector(`[name="${name}"]`);
    if (element && value) {
        element.value = value;
    }
}

function setFormValueInContainer(container, name, value) {
    const element = container.querySelector(`[name="${name}"]`);
    if (element && value) {
        element.value = value;
    }
}

async function downloadWill(willId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/will/${willId}/download`, {
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
            alert('Failed to download will');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading will');
    } finally {
        hideLoading();
    }
}

async function deleteWill(willId) {
    if (!confirm('Are you sure you want to delete this will? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/will/${willId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            alert('Will deleted successfully');
            loadWills();
        } else {
            alert('Failed to delete will');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting will');
    } finally {
        hideLoading();
    }
}

// Dynamic Form Functions
function addWallet() {
    const container = document.getElementById('walletsContainer');
    const walletCount = container.children.length + 1;
    
    const walletHTML = `
        <div class="wallet-container">
            <h4>Wallet ${walletCount}</h4>
            <div class="form-group">
                <label>Wallet Name/Label:</label>
                <input type="text" name="walletName" placeholder="e.g., Main Bitcoin Wallet">
            </div>
            <div class="form-group">
                <label>Wallet Type:</label>
                <select name="walletType">
                    <option value="">Select wallet type</option>
                    <option value="hardware">Hardware Wallet</option>
                    <option value="software">Software Wallet</option>
                    <option value="paper">Paper Wallet</option>
                    <option value="mobile">Mobile Wallet</option>
                    <option value="web">Web Wallet</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description:</label>
                <textarea name="walletDescription" rows="2" placeholder="Brief description of this wallet"></textarea>
            </div>
            <div class="form-group">
                <label>Access Method:</label>
                <textarea name="accessMethod" rows="2" placeholder="How to access this wallet"></textarea>
            </div>
            <div class="form-group">
                <label>Seed Phrase Location:</label>
                <textarea name="seedPhraseLocation" rows="2" placeholder="Where the seed phrase is stored"></textarea>
            </div>
            <div class="form-group">
                <label>Private Key Location:</label>
                <textarea name="privateKeyLocation" rows="2" placeholder="Where private keys are stored"></textarea>
            </div>
            <div class="form-group">
                <label>Additional Notes:</label>
                <textarea name="walletNotes" rows="2" placeholder="Any additional information"></textarea>
            </div>
            <button type="button" onclick="removeWallet(this)" class="btn btn-danger">Remove Wallet</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', walletHTML);
}

function removeWallet(button) {
    button.closest('.wallet-container').remove();
}

function addExchange() {
    const container = document.getElementById('exchangesContainer');
    const exchangeCount = container.children.length + 1;
    
    const exchangeHTML = `
        <div class="exchange-container">
            <h4>Exchange ${exchangeCount}</h4>
            <div class="form-group">
                <label>Exchange Name:</label>
                <input type="text" name="exchangeName" placeholder="e.g., Coinbase, Binance">
            </div>
            <div class="form-group">
                <label>Username/Account ID:</label>
                <input type="text" name="exchangeUsername" placeholder="Your username or account ID">
            </div>
            <div class="form-group">
                <label>Email Address:</label>
                <input type="email" name="exchangeEmail" placeholder="Email associated with account">
            </div>
            <div class="form-group">
                <label>2FA Backup Codes:</label>
                <textarea name="twoFactorBackup" rows="3" placeholder="Location of 2FA backup codes"></textarea>
            </div>
            <div class="form-group">
                <label>Additional Notes:</label>
                <textarea name="exchangeNotes" rows="2" placeholder="Any additional information"></textarea>
            </div>
            <button type="button" onclick="removeExchange(this)" class="btn btn-danger">Remove Exchange</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', exchangeHTML);
}

function removeExchange(button) {
    button.closest('.exchange-container').remove();
}

function addPrimaryBeneficiary() {
    const container = document.getElementById('primaryBeneficiariesContainer');
    const beneficiaryCount = container.children.length + 1;
    
    const beneficiaryHTML = `
        <div class="primary-beneficiary-container">
            <h4>Primary Beneficiary ${beneficiaryCount}</h4>
            <div class="form-group">
                <label>Full Name:</label>
                <input type="text" name="beneficiaryName" placeholder="Beneficiary's full name" required>
            </div>
            <div class="form-group">
                <label>Relationship:</label>
                <input type="text" name="relationship" placeholder="e.g., Spouse, Child, Parent" required>
            </div>
            <div class="form-group">
                <label>Percentage of Assets:</label>
                <input type="number" name="percentage" min="0" max="100" placeholder="0" required>
            </div>
            <div class="form-group">
                <label>Phone Number:</label>
                <input type="tel" name="beneficiaryPhone" placeholder="Phone number">
            </div>
            <div class="form-group">
                <label>Email Address:</label>
                <input type="email" name="beneficiaryEmail" placeholder="Email address">
            </div>
            <div class="form-group">
                <label>Bitcoin Address (optional):</label>
                <input type="text" name="bitcoinAddress" placeholder="Bitcoin address for direct transfers">
            </div>
            <div class="address-section">
                <h5>Address</h5>
                <div class="form-group">
                    <label>Street Address:</label>
                    <input type="text" name="beneficiaryStreet" placeholder="Street address">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>City:</label>
                        <input type="text" name="beneficiaryCity" placeholder="City">
                    </div>
                    <div class="form-group">
                        <label>State/Province:</label>
                        <input type="text" name="beneficiaryState" placeholder="State/Province">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>ZIP/Postal Code:</label>
                        <input type="text" name="beneficiaryZip" placeholder="ZIP/Postal Code">
                    </div>
                    <div class="form-group">
                        <label>Country:</label>
                        <input type="text" name="beneficiaryCountry" placeholder="Country">
                    </div>
                </div>
            </div>
            <button type="button" onclick="removePrimaryBeneficiary(this)" class="btn btn-danger">Remove Beneficiary</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', beneficiaryHTML);
}

function removePrimaryBeneficiary(button) {
    button.closest('.primary-beneficiary-container').remove();
}

function addContingentBeneficiary() {
    const container = document.getElementById('contingentBeneficiariesContainer');
    const beneficiaryCount = container.children.length + 1;
    
    const beneficiaryHTML = `
        <div class="contingent-beneficiary-container">
            <h4>Contingent Beneficiary ${beneficiaryCount}</h4>
            <div class="form-group">
                <label>Full Name:</label>
                <input type="text" name="contingentName" placeholder="Beneficiary's full name">
            </div>
            <div class="form-group">
                <label>Relationship:</label>
                <input type="text" name="contingentRelationship" placeholder="e.g., Sibling, Friend, Charity">
            </div>
            <div class="form-group">
                <label>Percentage of Assets:</label>
                <input type="number" name="contingentPercentage" min="0" max="100" placeholder="0">
            </div>
            <div class="form-group">
                <label>Phone Number:</label>
                <input type="tel" name="contingentPhone" placeholder="Phone number">
            </div>
            <div class="form-group">
                <label>Email Address:</label>
                <input type="email" name="contingentEmail" placeholder="Email address">
            </div>
            <div class="form-group">
                <label>Bitcoin Address (optional):</label>
                <input type="text" name="contingentBitcoinAddress" placeholder="Bitcoin address for direct transfers">
            </div>
            <div class="address-section">
                <h5>Address</h5>
                <div class="form-group">
                    <label>Street Address:</label>
                    <input type="text" name="contingentStreet" placeholder="Street address">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>City:</label>
                        <input type="text" name="contingentCity" placeholder="City">
                    </div>
                    <div class="form-group">
                        <label>State/Province:</label>
                        <input type="text" name="contingentState" placeholder="State/Province">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>ZIP/Postal Code:</label>
                        <input type="text" name="contingentZip" placeholder="ZIP/Postal Code">
                    </div>
                    <div class="form-group">
                        <label>Country:</label>
                        <input type="text" name="contingentCountry" placeholder="Country">
                    </div>
                </div>
            </div>
            <button type="button" onclick="removeContingentBeneficiary(this)" class="btn btn-danger">Remove Beneficiary</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', beneficiaryHTML);
}

function removeContingentBeneficiary(button) {
    button.closest('.contingent-beneficiary-container').remove();
}

function addTrustedContact() {
    const container = document.getElementById('trustedContactsContainer');
    const contactCount = container.children.length + 1;
    
    const contactHTML = `
        <div class="trusted-contact-container">
            <h4>Trusted Contact ${contactCount}</h4>
            <div class="form-group">
                <label>Name:</label>
                <input type="text" name="contactName" placeholder="Contact's full name">
            </div>
            <div class="form-group">
                <label>Contact Information:</label>
                <input type="text" name="contactInfo" placeholder="Phone, email, or other contact method">
            </div>
            <div class="form-group">
                <label>Relationship:</label>
                <input type="text" name="contactRelationship" placeholder="e.g., Friend, Lawyer, Accountant">
            </div>
            <div class="form-group">
                <label>Role/Expertise:</label>
                <input type="text" name="contactRole" placeholder="How they can help with Bitcoin assets">
            </div>
            <button type="button" onclick="removeTrustedContact(this)" class="btn btn-danger">Remove Contact</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', contactHTML);
}

function removeTrustedContact(button) {
    button.closest('.trusted-contact-container').remove();
}

// Legacy beneficiary functions for backward compatibility
function addBeneficiary() {
    addPrimaryBeneficiary();
}

function removeBeneficiary(button) {
    removePrimaryBeneficiary(button);
}

// Utility Functions
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
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
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (mobileMenu && mobileMenuBtn) {
        mobileMenu.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
    }
}

// URL Parameter Handling
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
        // Handle payment success
        handlePaymentSuccess(sessionId);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Review content update (for step 4)
function updateReviewContent() {
    const reviewContent = document.getElementById('reviewContent');
    if (!reviewContent) return;
    
    const willData = extractWillData();
    
    let html = '<h3>Review Your Bitcoin Will</h3>';
    
    // Personal Information
    html += '<h4>Personal Information</h4>';
    html += `<p><strong>Name:</strong> ${willData.personal_info.full_name || 'Not specified'}</p>`;
    html += `<p><strong>Date of Birth:</strong> ${willData.personal_info.date_of_birth || 'Not specified'}</p>`;
    html += `<p><strong>Executor:</strong> ${willData.personal_info.executor_name || 'Not specified'}</p>`;
    
    // Assets Summary
    html += '<h4>Bitcoin Assets</h4>';
    html += `<p><strong>Wallets:</strong> ${willData.assets.wallets.length} wallet(s)</p>`;
    html += `<p><strong>Exchanges:</strong> ${willData.assets.exchanges.length} exchange(s)</p>`;
    
    // Beneficiaries Summary
    html += '<h4>Beneficiaries</h4>';
    html += `<p><strong>Primary:</strong> ${willData.beneficiaries.primary.length} beneficiary(ies)</p>`;
    html += `<p><strong>Contingent:</strong> ${willData.beneficiaries.contingent.length} beneficiary(ies)</p>`;
    
    reviewContent.innerHTML = html;
}

// Navigation helper
function to(section) {
    if (section === 'dashboard') {
        showDashboard();
    } else if (section === 'will-creator') {
        showWillCreator();
    } else if (section === 'home') {
        goHome();
    }
}

// Check subscription and create will
function checkSubscriptionAndCreateWill() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    if (!userSubscription || !userSubscription.active) {
        showSubscriptionModal();
        return;
    }
    
    showWillCreator();
}

// Hide will creator
function hideWillCreator() {
    willCreator.classList.add('hidden');
    showDashboard();
}


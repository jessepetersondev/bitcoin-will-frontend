// Global state - PRESERVED WORKING CODE
let currentUser = null;
let authToken = null;
let currentPlan = null;
let currentPaymentMethod = null;
let currentStep = 1;
let userSubscription = null;
let editingWillId = null; // NEW: Track if we're editing an existing will

// API Configuration - PRESERVED WORKING CODE
const API_BASE_URL = 'https://bitcoin-will-backend-production.up.railway.app/api';

// DOM Elements - PRESERVED WORKING CODE
const authModal = document.getElementById('authModal');
const paymentModal = document.getElementById('paymentModal');
const subscriptionModal = document.getElementById('subscriptionModal');
const dashboard = document.getElementById('dashboard');
const willCreator = document.getElementById('willCreator');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize app - PRESERVED WORKING CODE
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

// Authentication Functions - PRESERVED WORKING CODE
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
    
    authModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    authModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function toggleAuthMode() {
    const authTitle = document.getElementById('authTitle');
    const isLogin = authTitle.textContent === 'Welcome Back';
    showAuthModal(isLogin ? 'register' : 'login');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const isLogin = document.getElementById('authSubmit').textContent === 'Sign In';
    
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
            
            // Store in localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            closeAuthModal();
            showUserInterface();
            
            // Load subscription status after successful login
            await loadSubscriptionStatus();
            
        } else {
            showError(data.message || 'Authentication failed');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('Authentication failed. Please try again.');
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
    
    showLandingPage();
}

async function checkAuthStatus() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showUserInterface();
        } else {
            // Token is invalid, clear it
            logout();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        logout();
    }
}

// Subscription Functions - PRESERVED WORKING CODE
async function loadSubscriptionStatus() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/subscription/status`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            userSubscription = data;
            updateSubscriptionUI();
        }
    } catch (error) {
        console.error('Subscription status error:', error);
    }
}

function updateSubscriptionUI() {
    const subscriptionStatus = document.getElementById('subscriptionStatus');
    const manageSubscriptionBtn = document.getElementById('manageSubscriptionBtn');
    
    if (userSubscription && userSubscription.active) {
        const sub = userSubscription.subscription;
        subscriptionStatus.innerHTML = `
            <div class="subscription-active">
                <h3>Active Subscription</h3>
                <p>Plan: ${sub.plan_type} ($${sub.amount}/${sub.plan_type === 'monthly' ? 'month' : 'year'})</p>
                <p>Status: ${sub.status}</p>
            </div>
        `;
        
        // ENHANCED: Change button to manage subscription instead of subscribe
        if (manageSubscriptionBtn) {
            manageSubscriptionBtn.textContent = 'Manage Subscription';
            manageSubscriptionBtn.onclick = openSubscriptionManagement;
        }
    } else {
        subscriptionStatus.innerHTML = `
            <div class="subscription-inactive">
                <h3>No Active Subscription</h3>
                <p>Subscribe to create Bitcoin wills</p>
            </div>
        `;
        
        if (manageSubscriptionBtn) {
            manageSubscriptionBtn.textContent = 'Subscribe Now';
            manageSubscriptionBtn.onclick = showSubscriptionModal;
        }
    }
}

// ENHANCED: New function for subscription management
async function openSubscriptionManagement() {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/subscription/manage`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect to Stripe customer portal
            window.location.href = data.portal_url;
        } else {
            showError(data.message || 'Failed to open subscription management');
        }
    } catch (error) {
        console.error('Subscription management error:', error);
        showError('Failed to open subscription management');
    } finally {
        hideLoading();
    }
}

function showSubscriptionModal() {
    subscriptionModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeSubscriptionModal() {
    subscriptionModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function selectPaymentMethod(method) {
    currentPaymentMethod = method;
    
    if (method === 'stripe') {
        showPaymentModal();
    } else if (method === 'btcpay') {
        processBTCPayPayment();
    }
}

function showPaymentModal() {
    paymentModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
    paymentModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function selectPlan(plan) {
    currentPlan = plan;
    
    // Update UI to show selected plan
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.querySelector(`[data-plan="${plan}"]`).classList.add('selected');
}

async function processStripePayment() {
    if (!currentPlan) {
        showError('Please select a plan first');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/subscription/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                plan: currentPlan
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect to Stripe checkout
            window.location.href = data.checkout_url;
        } else {
            throw new Error(data.message || 'Failed to create checkout session');
        }
    } catch (error) {
        console.error('Stripe payment error:', error);
        showError('Payment error: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function processBTCPayPayment() {
    showError('BTCPay integration coming soon');
}

// UI Functions - PRESERVED WORKING CODE
function showUserInterface() {
    document.querySelector('main').style.display = 'none';
    showDashboard();
}

function showLandingPage() {
    document.querySelector('main').style.display = 'block';
    dashboard.classList.add('hidden');
    willCreator.classList.add('hidden');
}

function showDashboard() {
    dashboard.classList.remove('hidden');
    willCreator.classList.add('hidden');
    loadDashboardData();
}

async function loadDashboardData() {
    if (!authToken) return;
    
    try {
        showLoading();
        
        // Load subscription status
        await loadSubscriptionStatus();
        
        // Load wills
        const willsResponse = await fetch(`${API_BASE_URL}/will/list`, {
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
            </div>
        </div>
    `).join('');
}

// Will Creator Functions - ENHANCED FOR EDITING
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
    
    // Reset form and progress if creating new will
    if (!editingWillId) {
        document.getElementById('willForm').reset();
        currentStep = 1;
        updateProgressBar();
        showStep(1);
    }
}

function hideWillCreator() {
    willCreator.classList.add('hidden');
    editingWillId = null; // Clear editing state
    showDashboard();
}

// ENHANCED: New function to edit existing will
async function editWill(willId) {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        showLoading();
        
        // Fetch will data
        const response = await fetch(`${API_BASE_URL}/will/${willId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const will = data.will;
            
            console.log('Loading will for editing:', will);
            
            // Set editing state
            editingWillId = willId;
            
            // Show will creator
            showWillCreator();
            
            // Populate form with existing data
            populateWillForm(will);
            
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Failed to load will');
        }
    } catch (error) {
        console.error('Edit will error:', error);
        showError('Failed to load will for editing');
    } finally {
        hideLoading();
    }
}

// ENHANCED: New function to populate form with existing will data
function populateWillForm(will) {
    console.log('Populating form with will data:', will);
    
    // Personal Information
    if (will.personal_info) {
        const personal = will.personal_info;
        setFormValue('fullName', personal.full_name);
        setFormValue('dateOfBirth', personal.date_of_birth);
        setFormValue('address', personal.address);
        setFormValue('executorName', personal.executor_name);
        setFormValue('executorContact', personal.executor_contact);
    }
    
    // Bitcoin Assets
    if (will.assets) {
        const assets = will.assets;
        setFormValue('storageMethod', assets.storage_method);
        setFormValue('storageLocation', assets.storage_location);
        setFormValue('storageDetails', assets.storage_details);
        
        // Populate wallets
        if (assets.wallets && assets.wallets.length > 0) {
            // Clear existing wallet entries
            const walletsContainer = document.getElementById('walletsContainer');
            walletsContainer.innerHTML = '';
            
            // Add each wallet
            assets.wallets.forEach((wallet, index) => {
                addWalletEntry();
                setFormValue(`walletType${index}`, wallet.type);
                setFormValue(`walletValue${index}`, wallet.value);
                setFormValue(`walletDescription${index}`, wallet.description);
                setFormValue(`walletAddress${index}`, wallet.address);
            });
        }
    }
    
    // Beneficiaries
    if (will.beneficiaries) {
        const beneficiaries = will.beneficiaries;
        
        // Primary beneficiaries
        if (beneficiaries.primary && beneficiaries.primary.length > 0) {
            const primaryContainer = document.getElementById('primaryBeneficiariesContainer');
            primaryContainer.innerHTML = '';
            
            beneficiaries.primary.forEach((beneficiary, index) => {
                addPrimaryBeneficiary();
                setFormValue(`primaryName${index}`, beneficiary.name);
                setFormValue(`primaryRelationship${index}`, beneficiary.relationship);
                setFormValue(`primaryPercentage${index}`, beneficiary.percentage);
                setFormValue(`primaryContact${index}`, beneficiary.contact);
            });
        }
        
        // Contingent beneficiaries
        if (beneficiaries.contingent && beneficiaries.contingent.length > 0) {
            const contingentContainer = document.getElementById('contingentBeneficiariesContainer');
            contingentContainer.innerHTML = '';
            
            beneficiaries.contingent.forEach((beneficiary, index) => {
                addContingentBeneficiary();
                setFormValue(`contingentName${index}`, beneficiary.name);
                setFormValue(`contingentRelationship${index}`, beneficiary.relationship);
                setFormValue(`contingentPercentage${index}`, beneficiary.percentage);
                setFormValue(`contingentContact${index}`, beneficiary.contact);
            });
        }
    }
    
    // Instructions
    if (will.instructions) {
        const instructions = will.instructions;
        setFormValue('accessInstructions', instructions.access_instructions);
        setFormValue('securityNotes', instructions.security_notes);
        
        // Trusted contacts
        if (instructions.trusted_contacts && instructions.trusted_contacts.length > 0) {
            const contactsContainer = document.getElementById('trustedContactsContainer');
            contactsContainer.innerHTML = '';
            
            instructions.trusted_contacts.forEach((contact, index) => {
                addTrustedContact();
                setFormValue(`contactName${index}`, contact.name);
                setFormValue(`contactInfo${index}`, contact.contact);
            });
        }
    }
    
    console.log('Form populated successfully');
}

// Helper function to set form values safely
function setFormValue(fieldName, value) {
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (field && value !== undefined && value !== null) {
        field.value = value;
    }
}

// ENHANCED: Download will function
async function downloadWill(willId) {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/will/${willId}/download`, {
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
            
            showSuccess('Will downloaded successfully!');
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Failed to download will');
        }
    } catch (error) {
        console.error('Download will error:', error);
        showError('Failed to download will');
    } finally {
        hideLoading();
    }
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
    // Add validation logic here
    return true;
}

function updateReviewContent() {
    // Update review tab with form data
    const reviewContent = document.getElementById('reviewContent');
    // Implementation for review content
}

// ENHANCED: Handle will form submission for both create and edit
async function handleWillSubmit(e) {
    e.preventDefault();
    
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        showLoading();
        
        // Collect form data
        const formData = new FormData(e.target);
        const willData = collectWillData(formData);
        
        let response;
        
        if (editingWillId) {
            // Update existing will
            response = await fetch(`${API_BASE_URL}/will/${editingWillId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(willData)
            });
        } else {
            // Create new will
            response = await fetch(`${API_BASE_URL}/will/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(willData)
            });
        }
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess(editingWillId ? 'Will updated successfully!' : 'Will created successfully!');
            hideWillCreator();
            loadDashboardData(); // Refresh the dashboard
        } else {
            showError(data.message || 'Failed to save will');
        }
    } catch (error) {
        console.error('Will submit error:', error);
        showError('Failed to save will');
    } finally {
        hideLoading();
    }
}

function collectWillData(formData) {
    // Collect personal info
    const personalInfo = {
        full_name: formData.get('fullName'),
        date_of_birth: formData.get('dateOfBirth'),
        address: formData.get('address'),
        executor_name: formData.get('executorName'),
        executor_contact: formData.get('executorContact')
    };
    
    // Collect assets
    const assets = {
        storage_method: formData.get('storageMethod'),
        storage_location: formData.get('storageLocation'),
        storage_details: formData.get('storageDetails'),
        wallets: collectWallets(formData)
    };
    
    // Collect beneficiaries
    const beneficiaries = {
        primary: collectPrimaryBeneficiaries(formData),
        contingent: collectContingentBeneficiaries(formData)
    };
    
    // Collect instructions
    const instructions = {
        access_instructions: formData.get('accessInstructions'),
        security_notes: formData.get('securityNotes'),
        trusted_contacts: collectTrustedContacts(formData)
    };
    
    return {
        title: formData.get('willTitle') || 'My Bitcoin Will',
        personal_info: personalInfo,
        assets: assets,
        beneficiaries: beneficiaries,
        instructions: instructions,
        status: 'draft'
    };
}

function collectWallets(formData) {
    const wallets = [];
    let index = 0;
    
    while (formData.get(`walletType${index}`)) {
        wallets.push({
            type: formData.get(`walletType${index}`),
            value: formData.get(`walletValue${index}`),
            description: formData.get(`walletDescription${index}`),
            address: formData.get(`walletAddress${index}`)
        });
        index++;
    }
    
    return wallets;
}

function collectPrimaryBeneficiaries(formData) {
    const beneficiaries = [];
    let index = 0;
    
    while (formData.get(`primaryName${index}`)) {
        beneficiaries.push({
            name: formData.get(`primaryName${index}`),
            relationship: formData.get(`primaryRelationship${index}`),
            percentage: parseFloat(formData.get(`primaryPercentage${index}`) || 0),
            contact: formData.get(`primaryContact${index}`)
        });
        index++;
    }
    
    return beneficiaries;
}

function collectContingentBeneficiaries(formData) {
    const beneficiaries = [];
    let index = 0;
    
    while (formData.get(`contingentName${index}`)) {
        beneficiaries.push({
            name: formData.get(`contingentName${index}`),
            relationship: formData.get(`contingentRelationship${index}`),
            percentage: parseFloat(formData.get(`contingentPercentage${index}`) || 0),
            contact: formData.get(`contingentContact${index}`)
        });
        index++;
    }
    
    return beneficiaries;
}

function collectTrustedContacts(formData) {
    const contacts = [];
    let index = 0;
    
    while (formData.get(`contactName${index}`)) {
        contacts.push({
            name: formData.get(`contactName${index}`),
            contact: formData.get(`contactInfo${index}`)
        });
        index++;
    }
    
    return contacts;
}

// Dynamic form functions (preserved)
function addWalletEntry() {
    // Implementation for adding wallet entries
}

function addPrimaryBeneficiary() {
    // Implementation for adding primary beneficiaries
}

function addContingentBeneficiary() {
    // Implementation for adding contingent beneficiaries
}

function addTrustedContact() {
    // Implementation for adding trusted contacts
}

function checkSubscriptionAndCreateWill() {
    if (!userSubscription || !userSubscription.active) {
        showSubscriptionModal();
    } else {
        editingWillId = null; // Ensure we're creating new will
        showWillCreator();
    }
}

// URL Parameter Handling - ENHANCED
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle payment success
    if (urlParams.get('payment') === 'success') {
        const sessionId = urlParams.get('session_id');
        if (sessionId) {
            verifyPayment(sessionId);
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Handle payment cancellation
    if (urlParams.get('payment') === 'cancelled') {
        showError('Payment was cancelled');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // ENHANCED: Handle return from Stripe customer portal
    if (urlParams.get('portal') === 'return') {
        showSuccess('Subscription updated successfully!');
        loadSubscriptionStatus(); // Refresh subscription status
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function verifyPayment(sessionId) {
    if (!authToken) return;
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/subscription/verify-payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ session_id: sessionId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showPaymentSuccess();
            await loadSubscriptionStatus();
        } else {
            showError(data.message || 'Payment verification failed');
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        showError('Payment verification failed');
    } finally {
        hideLoading();
    }
}

function showPaymentSuccess() {
    // Create success overlay
    const successOverlay = document.createElement('div');
    successOverlay.className = 'payment-success-overlay';
    successOverlay.innerHTML = `
        <div class="payment-success-modal">
            <div class="success-icon">✅</div>
            <h2>Payment Successful!</h2>
            <p>Your subscription has been activated. You can now create Bitcoin wills.</p>
            <button class="btn btn-primary" onclick="closePaymentSuccess()">Continue to Dashboard</button>
        </div>
    `;
    
    document.body.appendChild(successOverlay);
    document.body.style.overflow = 'hidden';
    
    // Auto-close after 3 seconds
    setTimeout(() => {
        closePaymentSuccess();
    }, 3000);
}

function closePaymentSuccess() {
    const overlay = document.querySelector('.payment-success-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
}

// Utility Functions - PRESERVED WORKING CODE
function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

function showError(message) {
    // Simple error display - could be enhanced with a proper modal
    alert('Error: ' + message);
}

function showSuccess(message) {
    // Simple success display - could be enhanced with a proper modal
    alert('Success: ' + message);
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.toggle('hidden');
}


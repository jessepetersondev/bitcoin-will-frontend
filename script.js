// Session-Only Bitcoin Will Creation - Enhanced Security
// NO BITCOIN DATA IS STORED - Session only for maximum security

let currentUser = null;
let authToken = null;
let currentPlan = null;
let currentPaymentMethod = null;
let currentStep = 1;
let userSubscription = null;

// Session-only will data (NOT stored in database)
let sessionWillData = {
    personal_info: {},
    bitcoin_assets: { wallets: [], exchanges: [], other_crypto: [] },
    beneficiaries: { primary: [], contingent: [] },
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
    showSecurityWarning();
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

// Show security warning on page load
function showSecurityWarning() {
    const securityBanner = document.createElement('div');
    securityBanner.className = 'security-warning-banner';
    securityBanner.innerHTML = `
        <div class="security-warning-content">
            <div class="security-icon">🔒</div>
            <div class="security-text">
                <strong>ENHANCED SECURITY:</strong> For your protection, Bitcoin data is NEVER stored in our database. 
                Will creation is session-only. Please have all information ready before starting.
            </div>
            <button onclick="this.parentElement.parentElement.style.display='none'" class="security-close">×</button>
        </div>
    `;
    document.body.insertBefore(securityBanner, document.body.firstChild);
}

function setupEventListeners() {
    // Auth form submission
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    
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
    
    // Warn user before leaving page if will data exists
    window.addEventListener('beforeunload', function(e) {
        if (hasWillData()) {
            e.preventDefault();
            e.returnValue = 'You have unsaved will data that will be lost. Are you sure you want to leave?';
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

// Check if user has will data in session
function hasWillData() {
    return Object.keys(sessionWillData.personal_info).length > 0 ||
           sessionWillData.bitcoin_assets.wallets.length > 0 ||
           sessionWillData.beneficiaries.primary.length > 0 ||
           Object.keys(sessionWillData.instructions).length > 0;
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
    const isLogin = document.getElementById('authTitle').textContent === 'Welcome Back';
    
    try {
        showLoading();
        
        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const response = await fetch(API_BASE_URL + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            
            // Store auth data
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            closeAuthModal();
            showUserInterface();
            
            if (!isLogin) {
                showSubscriptionModal();
            }
        } else {
            alert(data.message || 'Authentication failed');
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert('Authentication failed. Please try again.');
    } finally {
        hideLoading();
    }
}

function logout() {
    // Clear session will data on logout for security
    sessionWillData = {
        personal_info: {},
        bitcoin_assets: { wallets: [], exchanges: [], other_crypto: [] },
        beneficiaries: { primary: [], contingent: [] },
        instructions: {}
    };
    
    authToken = null;
    currentUser = null;
    userSubscription = null;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    showLandingPage();
    updateAuthUI();
}

function showUserInterface() {
    updateAuthUI();
    loadUserSubscription();
    showDashboard();
}

function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const userName = document.getElementById('userName');
    
    if (currentUser) {
        authButtons.classList.add('hidden');
        userMenu.classList.remove('hidden');
        userName.textContent = currentUser.email;
    } else {
        authButtons.classList.remove('hidden');
        userMenu.classList.add('hidden');
    }
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
            await loadUserSubscription();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        logout();
    }
}

// Subscription Functions
async function loadUserSubscription() {
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
    
    if (subscription && subscription.status === 'active') {
        if (statusBadge) {
            statusBadge.textContent = 'Active';
            statusBadge.className = 'status-badge active';
        }
        if (statusText) {
            statusText.textContent = `Plan: ${subscription.plan_name || 'Premium'}`;
        }
    } else {
        if (statusBadge) {
            statusBadge.textContent = 'Inactive';
            statusBadge.className = 'status-badge inactive';
        }
        if (statusText) {
            statusText.textContent = 'Subscribe to create Bitcoin wills';
        }
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
    
    paymentModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
    paymentModal.classList.add('hidden');
    document.body.style.overflow = '';
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
        alert('Payment processing failed. Please try again.');
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

// Subscription management function
async function openSubscriptionManagement() {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + '/subscription/manage', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.portal_url) {
                window.location.href = data.portal_url;
            } else {
                throw new Error('No portal URL received');
            }
        } else {
            throw new Error('Failed to create portal session');
        }
    } catch (error) {
        console.error('Error creating portal session:', error);
        alert('Unable to open subscription management. Please try again later.');
    } finally {
        hideLoading();
    }
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
            showPaymentSuccessMessage();
            await loadUserSubscription();
            setTimeout(() => {
                showDashboard();
            }, 2000);
        } else {
            console.error('Payment verification failed:', data.message);
            alert('Payment verification failed. Please contact support.');
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        alert('Failed to verify payment. Please contact support.');
    } finally {
        hideLoading();
    }
}

function showPaymentSuccessMessage() {
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

// Session-Only Will Creation Functions
function showWillCreator() {
    if (!authToken) {
        showAuthModal('login');
        return;
    }
    
    // Check subscription
    if (!userSubscription || userSubscription.status !== 'active') {
        showSubscriptionModal();
        return;
    }
    
    // Show security warning before starting
    showWillCreationSecurityWarning();
}

function showWillCreationSecurityWarning() {
    const warningModal = document.createElement('div');
    warningModal.className = 'security-modal';
    warningModal.innerHTML = `
        <div class="security-modal-content">
            <div class="security-modal-header">
                <h2>🔒 Enhanced Security Notice</h2>
            </div>
            <div class="security-modal-body">
                <div class="security-points">
                    <div class="security-point">
                        <span class="security-icon">🛡️</span>
                        <div>
                            <strong>No Data Storage:</strong> Your Bitcoin information is NEVER stored in our database for your security.
                        </div>
                    </div>
                    <div class="security-point">
                        <span class="security-icon">⏱️</span>
                        <div>
                            <strong>Session Only:</strong> Will creation must be completed in one session. You cannot save and return later.
                        </div>
                    </div>
                    <div class="security-point">
                        <span class="security-icon">📋</span>
                        <div>
                            <strong>Be Prepared:</strong> Have all your Bitcoin wallet information, beneficiary details, and instructions ready before starting.
                        </div>
                    </div>
                    <div class="security-point">
                        <span class="security-icon">⚠️</span>
                        <div>
                            <strong>Data Loss Warning:</strong> If you close your browser or navigate away, all entered data will be permanently lost.
                        </div>
                    </div>
                </div>
                <div class="security-recommendation">
                    <strong>Recommendation:</strong> Gather all necessary information before proceeding. This includes wallet details, 
                    beneficiary information, and access instructions.
                </div>
            </div>
            <div class="security-modal-footer">
                <button onclick="cancelWillCreation()" class="btn btn-secondary">Cancel - Let Me Prepare</button>
                <button onclick="proceedWithWillCreation()" class="btn btn-primary">I'm Ready - Start Creating Will</button>
            </div>
        </div>
    `;
    document.body.appendChild(warningModal);
    document.body.style.overflow = 'hidden';
}

function cancelWillCreation() {
    const warningModal = document.querySelector('.security-modal');
    if (warningModal) {
        warningModal.remove();
        document.body.style.overflow = '';
    }
}

function proceedWithWillCreation() {
    const warningModal = document.querySelector('.security-modal');
    if (warningModal) {
        warningModal.remove();
        document.body.style.overflow = '';
    }
    
    // Clear any existing session data
    sessionWillData = {
        personal_info: {},
        bitcoin_assets: { wallets: [], exchanges: [], other_crypto: [] },
        beneficiaries: { primary: [], contingent: [] },
        instructions: {}
    };
    
    currentStep = 1;
    showWillCreationInterface();
}

function showWillCreationInterface() {
    const mainContent = document.getElementById('main-content');
    
    mainContent.innerHTML = `
        <div class="will-creation-container">
            <div class="session-warning">
                <div class="session-warning-content">
                    <span class="session-icon">🔒</span>
                    <span class="session-text">Session-Only Mode: Your data is secure and will not be stored</span>
                    <span class="session-timer" id="sessionTimer">Session Active</span>
                </div>
            </div>
            
            <div class="document-header">
                <h1 class="document-title">Last Will and Testament</h1>
                <p class="document-subtitle">Bitcoin and Cryptocurrency Estate Planning Document</p>
            </div>
            
            <div class="will-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(currentStep / 5) * 100}%"></div>
                </div>
                <div class="step-indicators">
                    ${Array.from({length: 5}, (_, i) => `
                        <div class="step-indicator ${i + 1 <= currentStep ? 'active' : ''}" data-step="${i + 1}">
                            <span>${i + 1}</span>
                            <label>${getStepLabel(i + 1)}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="will-form-container">
                <div id="will-step-content">
                    ${getStepContent(currentStep)}
                </div>
                
                <div class="will-navigation">
                    <button id="prev-step" onclick="previousStep()" ${currentStep === 1 ? 'disabled' : ''}>
                        Previous
                    </button>
                    <button id="next-step" onclick="nextStep()">
                        ${currentStep === 5 ? 'Generate & Download Will' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Start session timer
    startSessionTimer();
}

// Session timer to show active session
function startSessionTimer() {
    const startTime = Date.now();
    const timerElement = document.getElementById('sessionTimer');
    
    setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        if (timerElement) {
            timerElement.textContent = `Session: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// Get step label
function getStepLabel(step) {
    const labels = {
        1: 'Personal Info',
        2: 'Bitcoin Assets',
        3: 'Beneficiaries',
        4: 'Instructions',
        5: 'Generate Will'
    };
    return labels[step];
}

// Get step content
function getStepContent(step) {
    switch(step) {
        case 1:
            return getPersonalInfoStep();
        case 2:
            return getBitcoinAssetsStep();
        case 3:
            return getBeneficiariesStep();
        case 4:
            return getInstructionsStep();
        case 5:
            return getReviewStep();
        default:
            return '';
    }
}

function getPersonalInfoStep() {
    return `
        <div class="form-section">
            <h2>Personal Information</h2>
            <div class="form-grid">
                <div class="form-group">
                    <label for="fullName">Full Legal Name *</label>
                    <input type="text" name="fullName" id="fullName" required>
                </div>
                <div class="form-group">
                    <label for="dateOfBirth">Date of Birth *</label>
                    <input type="date" name="dateOfBirth" id="dateOfBirth" required>
                </div>
                <div class="form-group">
                    <label for="email">Email Address *</label>
                    <input type="email" name="email" id="email" required>
                </div>
                <div class="form-group">
                    <label for="phone">Phone Number</label>
                    <input type="tel" name="phone" id="phone">
                </div>
                <div class="form-group">
                    <label for="ssn">Social Security Number</label>
                    <input type="text" name="ssn" id="ssn" placeholder="XXX-XX-XXXX">
                </div>
            </div>
            
            <h3>Address</h3>
            <div class="form-grid">
                <div class="form-group full-width">
                    <label for="address">Street Address *</label>
                    <input type="text" name="address" id="address" required>
                </div>
                <div class="form-group">
                    <label for="city">City *</label>
                    <input type="text" name="city" id="city" required>
                </div>
                <div class="form-group">
                    <label for="state">State/Province *</label>
                    <input type="text" name="state" id="state" required>
                </div>
                <div class="form-group">
                    <label for="zipCode">ZIP/Postal Code *</label>
                    <input type="text" name="zipCode" id="zipCode" required>
                </div>
                <div class="form-group">
                    <label for="country">Country *</label>
                    <input type="text" name="country" id="country" value="United States" required>
                </div>
            </div>
            
            <h3>Executor Information</h3>
            <div class="form-grid">
                <div class="form-group">
                    <label for="executorName">Executor Name *</label>
                    <input type="text" name="executorName" id="executorName" required>
                </div>
                <div class="form-group">
                    <label for="executorContact">Executor Contact Information *</label>
                    <input type="text" name="executorContact" id="executorContact" placeholder="Phone and/or email" required>
                </div>
            </div>
        </div>
    `;
}

function getBitcoinAssetsStep() {
    return `
        <div class="form-section">
            <h2>Bitcoin & Cryptocurrency Assets</h2>
            
            <div class="form-group">
                <label for="storageMethod">Primary Storage Method *</label>
                <select name="storageMethod" id="storageMethod" required>
                    <option value="">Select storage method</option>
                    <option value="hardware_wallet">Hardware Wallet</option>
                    <option value="software_wallet">Software Wallet</option>
                    <option value="paper_wallet">Paper Wallet</option>
                    <option value="exchange">Exchange</option>
                    <option value="multiple">Multiple Methods</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="storageLocation">Storage Location *</label>
                <input type="text" name="storageLocation" id="storageLocation" placeholder="e.g., Safe deposit box, home safe, etc." required>
            </div>
            
            <div class="form-group">
                <label for="storageDetails">Storage Details</label>
                <textarea name="storageDetails" id="storageDetails" rows="3" placeholder="Additional details about storage location and access"></textarea>
            </div>
            
            <h3>Bitcoin Wallets</h3>
            <div id="walletsContainer">
                <div class="wallet-entry" data-title="Wallet 1">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Wallet Type *</label>
                            <select name="walletType" required>
                                <option value="">Select type</option>
                                <option value="hardware">Hardware Wallet</option>
                                <option value="software">Software Wallet</option>
                                <option value="paper">Paper Wallet</option>
                                <option value="brain">Brain Wallet</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Wallet Name/Label</label>
                            <input type="text" name="walletName" placeholder="e.g., Ledger Nano S">
                        </div>
                        <div class="form-group">
                            <label>Estimated Value (USD)</label>
                            <input type="number" name="walletValue" placeholder="0.00" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <input type="text" name="walletDescription" placeholder="Brief description">
                        </div>
                        <div class="form-group full-width">
                            <label>Bitcoin Address (if applicable)</label>
                            <input type="text" name="walletAddress" placeholder="Bitcoin address">
                        </div>
                        <div class="form-group">
                            <label>Seed Phrase Location</label>
                            <input type="text" name="walletSeed" placeholder="Where seed phrase is stored">
                        </div>
                        <div class="form-group">
                            <label>Private Key Location</label>
                            <input type="text" name="walletPrivateKey" placeholder="Where private key is stored">
                        </div>
                        <div class="form-group full-width">
                            <label>Additional Notes</label>
                            <textarea name="walletNotes" rows="2" placeholder="Any additional information"></textarea>
                        </div>
                    </div>
                    <button type="button" class="remove-button" onclick="removeWallet(this)">Remove Wallet</button>
                </div>
            </div>
            <button type="button" class="add-button" onclick="addWallet()">+ Add Another Wallet</button>
            
            <h3>Exchange Accounts</h3>
            <div id="exchangesContainer">
                <div class="exchange-entry" data-title="Exchange 1">
                    <div class="form-grid">
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
                            <input type="text" name="exchange2FA" placeholder="Where 2FA backup codes are stored">
                        </div>
                        <div class="form-group full-width">
                            <label>Additional Notes</label>
                            <textarea name="exchangeNotes" rows="2" placeholder="Any additional information about this exchange account"></textarea>
                        </div>
                    </div>
                    <button type="button" class="remove-button" onclick="removeExchange(this)">Remove Exchange</button>
                </div>
            </div>
            <button type="button" class="add-button" onclick="addExchange()">+ Add Another Exchange</button>
        </div>
    `;
}

function getBeneficiariesStep() {
    return `
        <div class="form-section">
            <h2>Beneficiaries</h2>
            
            <h3>Primary Beneficiaries</h3>
            <p>These are the people who will inherit your Bitcoin assets.</p>
            
            <div id="primaryBeneficiaries">
                <div class="beneficiary-entry" data-title="Primary Beneficiary 1">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" name="beneficiaryName" required>
                        </div>
                        <div class="form-group">
                            <label>Relationship *</label>
                            <input type="text" name="beneficiaryRelationship" placeholder="e.g., Spouse, Child, Friend" required>
                        </div>
                        <div class="form-group">
                            <label>Percentage of Assets *</label>
                            <input type="number" name="beneficiaryPercentage" min="0" max="100" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label>Phone Number</label>
                            <input type="tel" name="beneficiaryPhone">
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" name="beneficiaryEmail">
                        </div>
                        <div class="form-group">
                            <label>Bitcoin Address (Optional)</label>
                            <input type="text" name="beneficiaryBitcoinAddress" placeholder="Their Bitcoin address if known">
                        </div>
                        <div class="form-group full-width">
                            <label>Street Address</label>
                            <input type="text" name="beneficiaryStreet">
                        </div>
                        <div class="form-group">
                            <label>City</label>
                            <input type="text" name="beneficiaryCity">
                        </div>
                        <div class="form-group">
                            <label>State/Province</label>
                            <input type="text" name="beneficiaryState">
                        </div>
                        <div class="form-group">
                            <label>ZIP/Postal Code</label>
                            <input type="text" name="beneficiaryZip">
                        </div>
                        <div class="form-group">
                            <label>Country</label>
                            <input type="text" name="beneficiaryCountry" value="United States">
                        </div>
                    </div>
                    <button type="button" class="remove-button" onclick="removeBeneficiary(this)">Remove Beneficiary</button>
                </div>
            </div>
            <button type="button" class="add-button" onclick="addBeneficiary('primary')">+ Add Primary Beneficiary</button>
            
            <div class="percentage-total">
                <strong>Total Percentage: <span id="totalPercentage">0</span>%</strong>
                <small>Must equal 100%</small>
            </div>
            
            <h3>Contingent Beneficiaries</h3>
            <p>These people will inherit if primary beneficiaries cannot.</p>
            
            <div id="contingentBeneficiaries">
                <div class="beneficiary-entry" data-title="Contingent Beneficiary 1">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" name="beneficiaryName">
                        </div>
                        <div class="form-group">
                            <label>Relationship</label>
                            <input type="text" name="beneficiaryRelationship" placeholder="e.g., Sibling, Charity">
                        </div>
                        <div class="form-group">
                            <label>Percentage of Assets</label>
                            <input type="number" name="beneficiaryPercentage" min="0" max="100" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Phone Number</label>
                            <input type="tel" name="beneficiaryPhone">
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" name="beneficiaryEmail">
                        </div>
                        <div class="form-group">
                            <label>Bitcoin Address (Optional)</label>
                            <input type="text" name="beneficiaryBitcoinAddress">
                        </div>
                        <div class="form-group full-width">
                            <label>Street Address</label>
                            <input type="text" name="beneficiaryStreet">
                        </div>
                        <div class="form-group">
                            <label>City</label>
                            <input type="text" name="beneficiaryCity">
                        </div>
                        <div class="form-group">
                            <label>State/Province</label>
                            <input type="text" name="beneficiaryState">
                        </div>
                        <div class="form-group">
                            <label>ZIP/Postal Code</label>
                            <input type="text" name="beneficiaryZip">
                        </div>
                        <div class="form-group">
                            <label>Country</label>
                            <input type="text" name="beneficiaryCountry" value="United States">
                        </div>
                    </div>
                    <button type="button" class="remove-button" onclick="removeBeneficiary(this)">Remove Beneficiary</button>
                </div>
            </div>
            <button type="button" class="add-button" onclick="addBeneficiary('contingent')">+ Add Contingent Beneficiary</button>
        </div>
    `;
}

function getInstructionsStep() {
    return `
        <div class="form-section">
            <h2>Access Instructions & Security</h2>
            
            <div class="form-group">
                <label for="accessInstructions">Access Instructions *</label>
                <textarea name="accessInstructions" id="accessInstructions" rows="5" required 
                    placeholder="Detailed instructions on how to access your Bitcoin assets. Include information about passwords, seed phrases, hardware wallet PINs, etc."></textarea>
            </div>
            
            <div class="form-group">
                <label for="securityNotes">Security Notes</label>
                <textarea name="securityNotes" id="securityNotes" rows="4" 
                    placeholder="Important security considerations, warnings, or special procedures your executor should know about."></textarea>
            </div>
            
            <div class="form-group">
                <label for="additionalInstructions">Additional Instructions</label>
                <textarea name="additionalInstructions" id="additionalInstructions" rows="4" 
                    placeholder="Any other important information or instructions for your executor and beneficiaries."></textarea>
            </div>
            
            <div class="form-group">
                <label for="emergencyContact">Emergency Contact</label>
                <input type="text" name="emergencyContact" id="emergencyContact" 
                    placeholder="Someone who can be contacted in case of emergency">
            </div>
            
            <h3>Trusted Contacts</h3>
            <p>People who can help your executor with technical aspects of Bitcoin recovery.</p>
            
            <div id="trustedContacts">
                <div class="trusted-contact-entry" data-title="Trusted Contact 1">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" name="trustedContactName" placeholder="Full name">
                        </div>
                        <div class="form-group">
                            <label>Contact Information</label>
                            <input type="text" name="trustedContactInfo" placeholder="Phone and/or email">
                        </div>
                        <div class="form-group">
                            <label>Relationship</label>
                            <input type="text" name="trustedContactRelationship" placeholder="e.g., Friend, Colleague">
                        </div>
                        <div class="form-group">
                            <label>Role/Expertise</label>
                            <input type="text" name="trustedContactRole" placeholder="e.g., Bitcoin expert, Tech support">
                        </div>
                    </div>
                    <button type="button" class="remove-button" onclick="removeTrustedContact(this)">Remove Contact</button>
                </div>
            </div>
            <button type="button" class="add-button" onclick="addTrustedContact()">+ Add Trusted Contact</button>
        </div>
    `;
}

function getReviewStep() {
    return `
        <div class="form-section">
            <h2>Review & Generate Will</h2>
            <p>Please review your information below. Once you generate your will, all data will be cleared from our system for your security.</p>
            
            <div id="reviewContent">
                <div class="review-section">
                    <h3>Personal Information</h3>
                    <div id="reviewPersonal"></div>
                </div>
                
                <div class="review-section">
                    <h3>Bitcoin Assets</h3>
                    <div id="reviewAssets"></div>
                </div>
                
                <div class="review-section">
                    <h3>Beneficiaries</h3>
                    <div id="reviewBeneficiaries"></div>
                </div>
                
                <div class="review-section">
                    <h3>Instructions</h3>
                    <div id="reviewInstructions"></div>
                </div>
            </div>
            
            <div class="final-warning">
                <h4>⚠️ Important Security Notice</h4>
                <p>After generating your will, all data will be permanently deleted from our system. Make sure to download and securely store your will document.</p>
            </div>
        </div>
    `;
}

// Navigation functions
function nextStep() {
    if (currentStep < 5) {
        saveCurrentStepData();
        currentStep++;
        updateWillInterface();
        if (currentStep === 5) {
            populateReviewStep();
        }
    } else {
        generateSessionWill();
    }
}

function previousStep() {
    if (currentStep > 1) {
        saveCurrentStepData();
        currentStep--;
        updateWillInterface();
    }
}

function updateWillInterface() {
    document.getElementById('will-step-content').innerHTML = getStepContent(currentStep);
    
    // Update progress
    document.querySelector('.progress-fill').style.width = `${(currentStep / 5) * 100}%`;
    
    // Update step indicators
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        if (index + 1 <= currentStep) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    });
    
    // Update navigation buttons
    document.getElementById('prev-step').disabled = currentStep === 1;
    document.getElementById('next-step').textContent = currentStep === 5 ? 'Generate & Download Will' : 'Next';
    
    // Add event listeners for dynamic content
    if (currentStep === 3) {
        setupBeneficiaryCalculations();
    }
}

// Save current step data to session
function saveCurrentStepData() {
    switch(currentStep) {
        case 1:
            savePersonalInfo();
            break;
        case 2:
            saveBitcoinAssets();
            break;
        case 3:
            saveBeneficiaries();
            break;
        case 4:
            saveInstructions();
            break;
    }
}

function savePersonalInfo() {
    sessionWillData.personal_info = {
        full_name: getFormValue('fullName'),
        date_of_birth: getFormValue('dateOfBirth'),
        email: getFormValue('email'),
        phone: getFormValue('phone'),
        ssn: getFormValue('ssn'),
        executor_name: getFormValue('executorName'),
        executor_contact: getFormValue('executorContact'),
        address: {
            street: getFormValue('address'),
            city: getFormValue('city'),
            state: getFormValue('state'),
            zip_code: getFormValue('zipCode'),
            country: getFormValue('country')
        }
    };
}

function saveBitcoinAssets() {
    // Save wallets
    const wallets = [];
    document.querySelectorAll('.wallet-entry').forEach((entry, index) => {
        wallets.push({
            type: getFormValueFromContainer(entry, 'walletType'),
            name: getFormValueFromContainer(entry, 'walletName'),
            value: getFormValueFromContainer(entry, 'walletValue'),
            description: getFormValueFromContainer(entry, 'walletDescription'),
            address: getFormValueFromContainer(entry, 'walletAddress'),
            seed_phrase_location: getFormValueFromContainer(entry, 'walletSeed'),
            private_key_location: getFormValueFromContainer(entry, 'walletPrivateKey'),
            additional_notes: getFormValueFromContainer(entry, 'walletNotes')
        });
    });
    
    // Save exchanges
    const exchanges = [];
    document.querySelectorAll('.exchange-entry').forEach((entry, index) => {
        exchanges.push({
            name: getFormValueFromContainer(entry, 'exchangeName'),
            username: getFormValueFromContainer(entry, 'exchangeUsername'),
            email: getFormValueFromContainer(entry, 'exchangeEmail'),
            two_factor_backup: getFormValueFromContainer(entry, 'exchange2FA'),
            additional_notes: getFormValueFromContainer(entry, 'exchangeNotes')
        });
    });
    
    sessionWillData.bitcoin_assets = {
        storage_method: getFormValue('storageMethod'),
        storage_location: getFormValue('storageLocation'),
        storage_details: getFormValue('storageDetails'),
        wallets: wallets,
        exchanges: exchanges,
        other_crypto: []
    };
}

function saveBeneficiaries() {
    // Save primary beneficiaries
    const primary = [];
    document.querySelectorAll('#primaryBeneficiaries .beneficiary-entry').forEach((entry, index) => {
        primary.push({
            name: getFormValueFromContainer(entry, 'beneficiaryName'),
            relationship: getFormValueFromContainer(entry, 'beneficiaryRelationship'),
            percentage: getFormValueFromContainer(entry, 'beneficiaryPercentage'),
            contact: getFormValueFromContainer(entry, 'beneficiaryContact'),
            phone: getFormValueFromContainer(entry, 'beneficiaryPhone'),
            email: getFormValueFromContainer(entry, 'beneficiaryEmail'),
            bitcoin_address: getFormValueFromContainer(entry, 'beneficiaryBitcoinAddress'),
            address: {
                street: getFormValueFromContainer(entry, 'beneficiaryStreet'),
                city: getFormValueFromContainer(entry, 'beneficiaryCity'),
                state: getFormValueFromContainer(entry, 'beneficiaryState'),
                zip_code: getFormValueFromContainer(entry, 'beneficiaryZip'),
                country: getFormValueFromContainer(entry, 'beneficiaryCountry')
            }
        });
    });
    
    // Save contingent beneficiaries
    const contingent = [];
    document.querySelectorAll('#contingentBeneficiaries .beneficiary-entry').forEach((entry, index) => {
        contingent.push({
            name: getFormValueFromContainer(entry, 'beneficiaryName'),
            relationship: getFormValueFromContainer(entry, 'beneficiaryRelationship'),
            percentage: getFormValueFromContainer(entry, 'beneficiaryPercentage'),
            contact: getFormValueFromContainer(entry, 'beneficiaryContact'),
            phone: getFormValueFromContainer(entry, 'beneficiaryPhone'),
            email: getFormValueFromContainer(entry, 'beneficiaryEmail'),
            bitcoin_address: getFormValueFromContainer(entry, 'beneficiaryBitcoinAddress'),
            address: {
                street: getFormValueFromContainer(entry, 'beneficiaryStreet'),
                city: getFormValueFromContainer(entry, 'beneficiaryCity'),
                state: getFormValueFromContainer(entry, 'beneficiaryState'),
                zip_code: getFormValueFromContainer(entry, 'beneficiaryZip'),
                country: getFormValueFromContainer(entry, 'beneficiaryCountry')
            }
        });
    });
    
    sessionWillData.beneficiaries = {
        primary: primary,
        contingent: contingent
    };
}

function saveInstructions() {
    const trusted_contacts = [];
    document.querySelectorAll('.trusted-contact-entry').forEach((entry, index) => {
        trusted_contacts.push({
            name: getFormValueFromContainer(entry, 'trustedContactName'),
            contact: getFormValueFromContainer(entry, 'trustedContactInfo'),
            relationship: getFormValueFromContainer(entry, 'trustedContactRelationship'),
            role: getFormValueFromContainer(entry, 'trustedContactRole')
        });
    });
    
    sessionWillData.instructions = {
        access_instructions: getFormValue('accessInstructions'),
        security_notes: getFormValue('securityNotes'),
        additional_instructions: getFormValue('additionalInstructions'),
        emergency_contact: getFormValue('emergencyContact'),
        trusted_contacts: trusted_contacts
    };
}

// Dynamic form functions
function addWallet() {
    const container = document.getElementById('walletsContainer');
    const walletCount = container.children.length + 1;
    
    const walletDiv = document.createElement('div');
    walletDiv.className = 'wallet-entry';
    walletDiv.setAttribute('data-title', `Wallet ${walletCount}`);
    walletDiv.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Wallet Type *</label>
                <select name="walletType" required>
                    <option value="">Select type</option>
                    <option value="hardware">Hardware Wallet</option>
                    <option value="software">Software Wallet</option>
                    <option value="paper">Paper Wallet</option>
                    <option value="brain">Brain Wallet</option>
                </select>
            </div>
            <div class="form-group">
                <label>Wallet Name/Label</label>
                <input type="text" name="walletName" placeholder="e.g., Ledger Nano S">
            </div>
            <div class="form-group">
                <label>Estimated Value (USD)</label>
                <input type="number" name="walletValue" placeholder="0.00" step="0.01">
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" name="walletDescription" placeholder="Brief description">
            </div>
            <div class="form-group full-width">
                <label>Bitcoin Address (if applicable)</label>
                <input type="text" name="walletAddress" placeholder="Bitcoin address">
            </div>
            <div class="form-group">
                <label>Seed Phrase Location</label>
                <input type="text" name="walletSeed" placeholder="Where seed phrase is stored">
            </div>
            <div class="form-group">
                <label>Private Key Location</label>
                <input type="text" name="walletPrivateKey" placeholder="Where private key is stored">
            </div>
            <div class="form-group full-width">
                <label>Additional Notes</label>
                <textarea name="walletNotes" rows="2" placeholder="Any additional information"></textarea>
            </div>
        </div>
        <button type="button" class="remove-button" onclick="removeWallet(this)">Remove Wallet</button>
    `;
    
    container.appendChild(walletDiv);
}

function removeWallet(button) {
    button.parentElement.remove();
}

function addExchange() {
    const container = document.getElementById('exchangesContainer');
    const exchangeCount = container.children.length + 1;
    
    const exchangeDiv = document.createElement('div');
    exchangeDiv.className = 'exchange-entry';
    exchangeDiv.setAttribute('data-title', `Exchange ${exchangeCount}`);
    exchangeDiv.innerHTML = `
        <div class="form-grid">
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
                <input type="text" name="exchange2FA" placeholder="Where 2FA backup codes are stored">
            </div>
            <div class="form-group full-width">
                <label>Additional Notes</label>
                <textarea name="exchangeNotes" rows="2" placeholder="Any additional information about this exchange account"></textarea>
            </div>
        </div>
        <button type="button" class="remove-button" onclick="removeExchange(this)">Remove Exchange</button>
    `;
    
    container.appendChild(exchangeDiv);
}

function removeExchange(button) {
    button.parentElement.remove();
}

function addBeneficiary(type) {
    const container = document.getElementById(type === 'primary' ? 'primaryBeneficiaries' : 'contingentBeneficiaries');
    const beneficiaryCount = container.children.length + 1;
    const title = type === 'primary' ? `Primary Beneficiary ${beneficiaryCount}` : `Contingent Beneficiary ${beneficiaryCount}`;
    
    const beneficiaryDiv = document.createElement('div');
    beneficiaryDiv.className = 'beneficiary-entry';
    beneficiaryDiv.setAttribute('data-title', title);
    beneficiaryDiv.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Full Name ${type === 'primary' ? '*' : ''}</label>
                <input type="text" name="beneficiaryName" ${type === 'primary' ? 'required' : ''}>
            </div>
            <div class="form-group">
                <label>Relationship ${type === 'primary' ? '*' : ''}</label>
                <input type="text" name="beneficiaryRelationship" placeholder="e.g., Spouse, Child, Friend" ${type === 'primary' ? 'required' : ''}>
            </div>
            <div class="form-group">
                <label>Percentage of Assets ${type === 'primary' ? '*' : ''}</label>
                <input type="number" name="beneficiaryPercentage" min="0" max="100" step="0.01" ${type === 'primary' ? 'required' : ''} onchange="updateTotalPercentage()">
            </div>
            <div class="form-group">
                <label>Phone Number</label>
                <input type="tel" name="beneficiaryPhone">
            </div>
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" name="beneficiaryEmail">
            </div>
            <div class="form-group">
                <label>Bitcoin Address (Optional)</label>
                <input type="text" name="beneficiaryBitcoinAddress" placeholder="Their Bitcoin address if known">
            </div>
            <div class="form-group full-width">
                <label>Street Address</label>
                <input type="text" name="beneficiaryStreet">
            </div>
            <div class="form-group">
                <label>City</label>
                <input type="text" name="beneficiaryCity">
            </div>
            <div class="form-group">
                <label>State/Province</label>
                <input type="text" name="beneficiaryState">
            </div>
            <div class="form-group">
                <label>ZIP/Postal Code</label>
                <input type="text" name="beneficiaryZip">
            </div>
            <div class="form-group">
                <label>Country</label>
                <input type="text" name="beneficiaryCountry" value="United States">
            </div>
        </div>
        <button type="button" class="remove-button" onclick="removeBeneficiary(this)">Remove Beneficiary</button>
    `;
    
    container.appendChild(beneficiaryDiv);
    updateTotalPercentage();
}

function removeBeneficiary(button) {
    button.parentElement.remove();
    updateTotalPercentage();
}

function addTrustedContact() {
    const container = document.getElementById('trustedContacts');
    const contactCount = container.children.length + 1;
    
    const contactDiv = document.createElement('div');
    contactDiv.className = 'trusted-contact-entry';
    contactDiv.setAttribute('data-title', `Trusted Contact ${contactCount}`);
    contactDiv.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Name</label>
                <input type="text" name="trustedContactName" placeholder="Full name">
            </div>
            <div class="form-group">
                <label>Contact Information</label>
                <input type="text" name="trustedContactInfo" placeholder="Phone and/or email">
            </div>
            <div class="form-group">
                <label>Relationship</label>
                <input type="text" name="trustedContactRelationship" placeholder="e.g., Friend, Colleague">
            </div>
            <div class="form-group">
                <label>Role/Expertise</label>
                <input type="text" name="trustedContactRole" placeholder="e.g., Bitcoin expert, Tech support">
            </div>
        </div>
        <button type="button" class="remove-button" onclick="removeTrustedContact(this)">Remove Contact</button>
    `;
    
    container.appendChild(contactDiv);
}

function removeTrustedContact(button) {
    button.parentElement.remove();
}

function setupBeneficiaryCalculations() {
    // Add event listeners to percentage inputs
    document.querySelectorAll('#primaryBeneficiaries input[name="beneficiaryPercentage"]').forEach(input => {
        input.addEventListener('input', updateTotalPercentage);
        input.addEventListener('change', updateTotalPercentage);
    });
    updateTotalPercentage();
}

function updateTotalPercentage() {
    const percentageInputs = document.querySelectorAll('#primaryBeneficiaries input[name="beneficiaryPercentage"]');
    let total = 0;
    
    percentageInputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        total += value;
    });
    
    const totalElement = document.getElementById('totalPercentage');
    if (totalElement) {
        totalElement.textContent = total.toFixed(2);
        totalElement.style.color = total === 100 ? '#10b981' : '#ef4444';
    }
}

function populateReviewStep() {
    // Save current step data first
    saveCurrentStepData();
    
    // Populate review sections
    populatePersonalReview();
    populateAssetsReview();
    populateBeneficiariesReview();
    populateInstructionsReview();
}

function populatePersonalReview() {
    const container = document.getElementById('reviewPersonal');
    const personal = sessionWillData.personal_info;
    
    container.innerHTML = `
        <p><strong>Name:</strong> ${personal.full_name || 'Not specified'}</p>
        <p><strong>Date of Birth:</strong> ${personal.date_of_birth || 'Not specified'}</p>
        <p><strong>Email:</strong> ${personal.email || 'Not specified'}</p>
        <p><strong>Phone:</strong> ${personal.phone || 'Not specified'}</p>
        <p><strong>Address:</strong> ${personal.address ? `${personal.address.street}, ${personal.address.city}, ${personal.address.state} ${personal.address.zip_code}` : 'Not specified'}</p>
        <p><strong>Executor:</strong> ${personal.executor_name || 'Not specified'} (${personal.executor_contact || 'No contact info'})</p>
    `;
}

function populateAssetsReview() {
    const container = document.getElementById('reviewAssets');
    const assets = sessionWillData.bitcoin_assets;
    
    let html = `
        <p><strong>Storage Method:</strong> ${assets.storage_method || 'Not specified'}</p>
        <p><strong>Storage Location:</strong> ${assets.storage_location || 'Not specified'}</p>
    `;
    
    if (assets.wallets && assets.wallets.length > 0) {
        html += '<h4>Wallets:</h4><ul>';
        assets.wallets.forEach((wallet, index) => {
            html += `<li>${wallet.name || `Wallet ${index + 1}`} (${wallet.type || 'Unknown type'})</li>`;
        });
        html += '</ul>';
    }
    
    if (assets.exchanges && assets.exchanges.length > 0) {
        html += '<h4>Exchanges:</h4><ul>';
        assets.exchanges.forEach((exchange, index) => {
            html += `<li>${exchange.name || `Exchange ${index + 1}`}</li>`;
        });
        html += '</ul>';
    }
    
    container.innerHTML = html;
}

function populateBeneficiariesReview() {
    const container = document.getElementById('reviewBeneficiaries');
    const beneficiaries = sessionWillData.beneficiaries;
    
    let html = '';
    
    if (beneficiaries.primary && beneficiaries.primary.length > 0) {
        html += '<h4>Primary Beneficiaries:</h4><ul>';
        beneficiaries.primary.forEach(beneficiary => {
            html += `<li>${beneficiary.name || 'Unnamed'} (${beneficiary.relationship || 'Unknown relationship'}) - ${beneficiary.percentage || 0}%</li>`;
        });
        html += '</ul>';
    }
    
    if (beneficiaries.contingent && beneficiaries.contingent.length > 0) {
        html += '<h4>Contingent Beneficiaries:</h4><ul>';
        beneficiaries.contingent.forEach(beneficiary => {
            html += `<li>${beneficiary.name || 'Unnamed'} (${beneficiary.relationship || 'Unknown relationship'}) - ${beneficiary.percentage || 0}%</li>`;
        });
        html += '</ul>';
    }
    
    container.innerHTML = html || '<p>No beneficiaries specified</p>';
}

function populateInstructionsReview() {
    const container = document.getElementById('reviewInstructions');
    const instructions = sessionWillData.instructions;
    
    let html = `
        <p><strong>Access Instructions:</strong> ${instructions.access_instructions ? 'Provided' : 'Not provided'}</p>
        <p><strong>Security Notes:</strong> ${instructions.security_notes ? 'Provided' : 'Not provided'}</p>
    `;
    
    if (instructions.trusted_contacts && instructions.trusted_contacts.length > 0) {
        html += '<h4>Trusted Contacts:</h4><ul>';
        instructions.trusted_contacts.forEach(contact => {
            html += `<li>${contact.name || 'Unnamed'} (${contact.role || 'No role specified'})</li>`;
        });
        html += '</ul>';
    }
    
    container.innerHTML = html;
}

// Generate and download will from session data
async function generateSessionWill() {
    try {
        showLoading();
        
        // Save current step data
        saveCurrentStepData();
        
        // Generate will title
        const willTitle = `Bitcoin Will - ${sessionWillData.personal_info.full_name || 'Untitled'} - ${new Date().toLocaleDateString()}`;
        
        // Prepare will data for PDF generation
        const willData = {
            title: willTitle,
            personal_info: sessionWillData.personal_info,
            bitcoin_assets: sessionWillData.bitcoin_assets,
            beneficiaries: sessionWillData.beneficiaries,
            instructions: sessionWillData.instructions,
            created_at: new Date().toISOString()
        };
        
        // Send to backend for PDF generation (no storage)
        const response = await fetch(API_BASE_URL + '/will/generate-session', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(willData)
        });
        
        if (response.ok) {
            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${willTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Show success message and clear session data
            showWillGenerationSuccess();
            
        } else {
            const errorData = await response.json();
            alert(errorData.message || 'Failed to generate will');
        }
    } catch (error) {
        console.error('Will generation error:', error);
        alert('Failed to generate will. Please try again.');
    } finally {
        hideLoading();
    }
}

function showWillGenerationSuccess() {
    const successModal = document.createElement('div');
    successModal.className = 'success-modal';
    successModal.innerHTML = `
        <div class="success-modal-content">
            <div class="success-modal-header">
                <h2>✅ Will Generated Successfully!</h2>
            </div>
            <div class="success-modal-body">
                <div class="success-points">
                    <div class="success-point">
                        <span class="success-icon">📄</span>
                        <div>Your Bitcoin will has been generated and downloaded to your device.</div>
                    </div>
                    <div class="success-point">
                        <span class="success-icon">🔒</span>
                        <div>For your security, no Bitcoin data was stored in our database.</div>
                    </div>
                    <div class="success-point">
                        <span class="success-icon">🗑️</span>
                        <div>All session data has been cleared from memory.</div>
                    </div>
                    <div class="success-point">
                        <span class="success-icon">⚖️</span>
                        <div>Please review your will with a legal professional.</div>
                    </div>
                </div>
                <div class="success-recommendation">
                    <strong>Important:</strong> Store your will securely and inform your executor of its location.
                </div>
            </div>
            <div class="success-modal-footer">
                <button onclick="returnToDashboard()" class="btn btn-primary">Return to Dashboard</button>
                <button onclick="createAnotherWill()" class="btn btn-secondary">Create Another Will</button>
            </div>
        </div>
    `;
    document.body.appendChild(successModal);
    document.body.style.overflow = 'hidden';
    
    // Clear session data for security
    sessionWillData = {
        personal_info: {},
        bitcoin_assets: { wallets: [], exchanges: [], other_crypto: [] },
        beneficiaries: { primary: [], contingent: [] },
        instructions: {}
    };
}

function returnToDashboard() {
    const successModal = document.querySelector('.success-modal');
    if (successModal) {
        successModal.remove();
        document.body.style.overflow = '';
    }
    showDashboard();
}

function createAnotherWill() {
    const successModal = document.querySelector('.success-modal');
    if (successModal) {
        successModal.remove();
        document.body.style.overflow = '';
    }
    showWillCreator();
}

// Helper functions
function getFormValue(fieldName) {
    const field = document.querySelector(`[name="${fieldName}"]`) || 
                  document.getElementById(fieldName);
    return field ? field.value : '';
}

function getFormValueFromContainer(container, fieldName) {
    const field = container.querySelector(`[name="${fieldName}"]`);
    return field ? field.value : '';
}

// Dashboard Functions - Modified to remove will listing
function showDashboard() {
    const mainContent = document.getElementById('main-content');
    
    mainContent.innerHTML = `
        <div class="dashboard-container">
            <div class="dashboard-header">
                <h1>Bitcoin Will Dashboard</h1>
                <p>Secure, session-only Bitcoin estate planning</p>
            </div>
            
            <div class="security-notice">
                <div class="security-notice-content">
                    <h3>🔒 Enhanced Security Mode</h3>
                    <p>For maximum security, Bitcoin data is never stored. Each will creation is a fresh, secure session.</p>
                </div>
            </div>
            
            <div class="dashboard-actions">
                <div class="action-card primary-action">
                    <div class="action-icon">📄</div>
                    <h3>Create Bitcoin Will</h3>
                    <p>Start a secure session to create your Bitcoin will. Have all information ready before starting.</p>
                    <button onclick="showWillCreator()" class="btn btn-primary">Start Will Creation</button>
                </div>
                
                <div class="action-card">
                    <div class="action-icon">💳</div>
                    <h3>Subscription</h3>
                    <p>Manage your subscription and billing information.</p>
                    <button onclick="showSubscriptionModal()" class="btn btn-outline">Manage Subscription</button>
                </div>
                
                <div class="action-card">
                    <div class="action-icon">🛡️</div>
                    <h3>Security Information</h3>
                    <p>Learn about our security measures and best practices.</p>
                    <button onclick="showSecurityInfo()" class="btn btn-outline">View Security Info</button>
                </div>
            </div>
            
            <div class="dashboard-info">
                <div class="info-section">
                    <h3>Why Session-Only?</h3>
                    <ul>
                        <li><strong>Maximum Security:</strong> No Bitcoin data stored in databases</li>
                        <li><strong>Zero Risk:</strong> No honeypot for hackers to target</li>
                        <li><strong>Your Privacy:</strong> Complete data privacy and control</li>
                        <li><strong>Legal Compliance:</strong> Professional will generation</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function showSecurityInfo() {
    const securityModal = document.createElement('div');
    securityModal.className = 'security-info-modal';
    securityModal.innerHTML = `
        <div class="security-info-content">
            <div class="security-info-header">
                <h2>🛡️ Security Information</h2>
                <button onclick="this.closest('.security-info-modal').remove(); document.body.style.overflow='';" class="close-btn">×</button>
            </div>
            <div class="security-info-body">
                <div class="security-feature">
                    <h3>🔒 No Data Storage</h3>
                    <p>Your Bitcoin wallet information, private keys, and asset details are NEVER stored in our database. This eliminates the risk of data breaches affecting your cryptocurrency holdings.</p>
                </div>
                <div class="security-feature">
                    <h3>⏱️ Session-Only Processing</h3>
                    <p>All will creation happens in your browser session. Once you close the browser or complete the will, all data is permanently deleted from our servers.</p>
                </div>
                <div class="security-feature">
                    <h3>🛡️ Zero Honeypot Risk</h3>
                    <p>Since we don't store Bitcoin data, our servers are not a target for hackers looking for cryptocurrency information.</p>
                </div>
                <div class="security-feature">
                    <h3>📄 Professional Will Generation</h3>
                    <p>Despite the enhanced security, you still get a comprehensive, legally-formatted will document with all necessary clauses and protections.</p>
                </div>
                <div class="security-recommendation">
                    <h3>🎯 Best Practices</h3>
                    <ul>
                        <li>Prepare all information before starting</li>
                        <li>Use a secure, private internet connection</li>
                        <li>Complete the will in one session</li>
                        <li>Store the generated PDF securely</li>
                        <li>Inform your executor of the will's location</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(securityModal);
    document.body.style.overflow = 'hidden';
}

function showLandingPage() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'block';
    }
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('show');
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
        document.body.style.overflow = '';
    }
}


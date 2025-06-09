// Global state
let currentUser = null;
let authToken = null;
let currentPlan = null;
let currentPaymentMethod = null;

// API Configuration
const API_BASE_URL = 'https://your-backend-url.railway.app/api'; // Update this when deploying

// DOM Elements
const authModal = document.getElementById('authModal');
const paymentModal = document.getElementById('paymentModal');
const dashboard = document.getElementById('dashboard');
const willCreator = document.getElementById('willCreator');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthStatus();
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
        }
    } catch (error) {
        console.error('Auth check error:', error);
        logout();
    }
}

// Subscription Functions
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
                plan: currentPlan,
                payment_method: 'stripe'
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
                plan: currentPlan,
                payment_method: 'btcpay'
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

// Dashboard Functions
async function showDashboard() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    // Hide main content
    document.querySelector('main').style.display = 'none';
    willCreator.classList.add('hidden');
    
    // Show dashboard
    dashboard.classList.remove('hidden');
    
    // Load user data
    await loadDashboardData();
}

async function loadDashboardData() {
    showLoading();
    
    try {
        // Load subscription status
        const subResponse = await fetch(API_BASE_URL + '/subscription/status', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (subResponse.ok) {
            const subData = await subResponse.json();
            updateSubscriptionStatus(subData);
        }
        
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

function updateSubscriptionStatus(data) {
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    
    if (data.active) {
        statusBadge.textContent = 'Active';
        statusBadge.style.backgroundColor = '#10b981';
        statusText.textContent = `Next billing: ${new Date(data.next_billing_date).toLocaleDateString()}`;
    } else {
        statusBadge.textContent = 'Inactive';
        statusBadge.style.backgroundColor = '#ef4444';
        statusText.textContent = 'Please subscribe to create Bitcoin wills';
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
                    <button class="btn btn-primary" onclick="showWillCreator()">Create Will</button>
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
    
    // Reset form
    document.getElementById('willForm').reset();
    showTab('personal');
}

function hideWillCreator() {
    willCreator.classList.add('hidden');
    showDashboard();
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
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
    const contactCount = container.children.length + 1;
    
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
    
    showLoading();
    
    try {
        const formData = new FormData(e.target);
        const willData = extractWillData(formData);
        
        const response = await fetch(API_BASE_URL + '/will/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(willData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Bitcoin will created successfully!');
            hideWillCreator();
            showDashboard();
        } else {
            throw new Error(data.message || 'Failed to create will');
        }
    } catch (error) {
        console.error('Will creation error:', error);
        alert('Failed to create will. Please try again.');
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
    
    // Assume first half are primary, second half are contingent
    const primaryCount = Math.ceil(beneficiaryNames.length / 2);
    
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
    showLoading();
    
    try {
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
            a.download = `bitcoin-will-${willId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            throw new Error('Failed to download will');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download will. Please try again.');
    } finally {
        hideLoading();
    }
}

async function editWill(willId) {
    // For now, just show the will creator
    // In a full implementation, you'd load the existing will data
    showWillCreator();
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
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.classList.remove('show');
}

function toggleMobileMenu() {
    const nav = document.getElementById('nav');
    nav.classList.toggle('mobile-open');
}

// Navigation Functions
function goHome() {
    document.querySelector('main').style.display = 'block';
    dashboard.classList.add('hidden');
    willCreator.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// URL handling for GitHub Pages
function updateAPIBaseURL() {
    // Update this when you deploy the backend
    // For local development, use: http://localhost:5000/api
    // For production, use your Railway backend URL
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_BASE_URL = 'http://localhost:5000/api';
    } else {
        API_BASE_URL = 'https://your-backend-url.railway.app/api';
    }
}

// Call this on page load
updateAPIBaseURL();


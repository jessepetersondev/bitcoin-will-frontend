// Global state
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let currentStep = 1;
let editingWillId = null;

// API Configuration
const API_BASE_URL = 'https://bitcoin-will-backend-production.up.railway.app/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Check authentication status
    if (authToken) {
        console.log('Auth token found, verifying...');
        verifyToken();
    } else {
        console.log('No auth token found, showing guest interface');
        showGuestInterface();
    }
    
    // Handle URL parameters for payment success
    handleURLParameters();
    
    // Initialize mobile menu
    initializeMobileMenu();
});

// Authentication Functions
async function verifyToken() {
    try {
        const response = await fetch(API_BASE_URL + '/auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            showUserInterface();
            loadDashboardData();
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
            showGuestInterface();
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('authToken');
        authToken = null;
        showGuestInterface();
    }
}

function showUserInterface() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('userSection').style.display = 'block';
    
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
    }
    
    showDashboard();
}

function showGuestInterface() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('userSection').style.display = 'none';
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showGuestInterface();
    hideWillCreator();
}

// Authentication Modal Functions
function openAuthModal() {
    document.getElementById('authModal').style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    clearAuthForm();
}

function toggleAuthMode() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
    clearAuthForm();
}

function clearAuthForm() {
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

async function handleAuthSubmit(event, isLogin) {
    event.preventDefault();
    
    const email = isLogin ? 
        document.getElementById('loginEmail').value : 
        document.getElementById('registerEmail').value;
    const password = isLogin ? 
        document.getElementById('loginPassword').value : 
        document.getElementById('registerPassword').value;
    
    if (!isLogin) {
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
    }
    
    try {
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
            localStorage.setItem('authToken', authToken);
            currentUser = { email: email };
            closeAuthModal();
            showUserInterface();
            loadDashboardData();
        } else {
            alert(data.message || 'Authentication failed');
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert('Authentication failed. Please try again.');
    }
}

// Dashboard Functions
function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('willCreator').style.display = 'none';
    document.getElementById('subscriptionSection').style.display = 'none';
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        showLoading();
        
        // Load subscription status
        await loadSubscriptionStatus();
        
        // Load wills
        const response = await fetch(API_BASE_URL + '/will/list', {
            method: 'GET',
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
        console.error('Error loading dashboard:', error);
    } finally {
        hideLoading();
    }
}

function displayWills(wills) {
    const willsList = document.getElementById('willsList');
    
    if (wills.length === 0) {
        willsList.innerHTML = '<p>No wills created yet. Create your first Bitcoin will!</p>';
        return;
    }
    
    willsList.innerHTML = wills.map(will => `
        <div class="will-item">
            <h3>${will.title}</h3>
            <p><strong>Testator:</strong> ${will.testator_name}</p>
            <p><strong>Status:</strong> ${will.status}</p>
            <p><strong>Created:</strong> ${new Date(will.created_at).toLocaleDateString()}</p>
            <div class="will-actions">
                <button onclick="editWill(${will.id})" class="btn btn-secondary">Edit</button>
                <button onclick="downloadWill(${will.id})" class="btn btn-primary">Download PDF</button>
                <button onclick="deleteWill(${will.id})" class="btn btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

// Subscription Functions
async function loadSubscriptionStatus() {
    try {
        const response = await fetch(API_BASE_URL + '/subscription/status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateSubscriptionDisplay(data);
        }
    } catch (error) {
        console.error('Error loading subscription status:', error);
    }
}

function updateSubscriptionDisplay(subscriptionData) {
    const statusElement = document.getElementById('subscriptionStatus');
    const actionsElement = document.getElementById('subscriptionActions');
    
    if (subscriptionData.active) {
        statusElement.innerHTML = `
            <span class="status-active">✓ Active Subscription</span>
            <p>Plan: ${subscriptionData.plan_name}</p>
            <p>Next billing: ${new Date(subscriptionData.current_period_end * 1000).toLocaleDateString()}</p>
        `;
        actionsElement.innerHTML = `
            <button onclick="openSubscriptionManagement()" class="btn btn-secondary">Manage Subscription</button>
        `;
    } else {
        statusElement.innerHTML = `
            <span class="status-inactive">⚠ No Active Subscription</span>
            <p>Subscribe to create and download Bitcoin wills</p>
        `;
        actionsElement.innerHTML = `
            <button onclick="showSubscriptionSection()" class="btn btn-primary">Subscribe Now</button>
        `;
    }
}

function showSubscriptionSection() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('willCreator').style.display = 'none';
    document.getElementById('subscriptionSection').style.display = 'block';
}

async function openSubscriptionManagement() {
    try {
        const response = await fetch(API_BASE_URL + '/subscription/portal', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            window.open(data.url, '_blank');
        } else {
            alert('Failed to open subscription management');
        }
    } catch (error) {
        console.error('Error opening subscription management:', error);
        alert('Failed to open subscription management');
    }
}

// Payment Functions
function selectPlan(planType) {
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    event.target.closest('.plan-card').classList.add('selected');
    
    // Store selected plan
    window.selectedPlan = planType;
    
    // Show payment methods
    document.getElementById('paymentMethods').style.display = 'block';
}

function selectPaymentMethod(method) {
    if (method === 'stripe') {
        processStripePayment();
    } else if (method === 'btcpay') {
        processBTCPayPayment();
    }
}

async function processStripePayment() {
    if (!window.selectedPlan) {
        alert('Please select a plan first');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + '/subscription/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                plan_type: window.selectedPlan
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect to Stripe Checkout
            window.location.href = data.checkout_url;
        } else {
            alert(data.error || 'Failed to create checkout session');
        }
    } catch (error) {
        console.error('Stripe payment error:', error);
        alert('Payment processing failed. Please try again.');
    } finally {
        hideLoading();
    }
}

async function processBTCPayPayment() {
    if (!window.selectedPlan) {
        alert('Please select a plan first');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + '/subscription/create-btcpay-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                plan_type: window.selectedPlan
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect to BTCPay invoice
            window.location.href = data.invoice_url;
        } else {
            alert(data.error || 'Failed to create BTCPay invoice');
        }
    } catch (error) {
        console.error('BTCPay payment error:', error);
        alert('Payment processing failed. Please try again.');
    } finally {
        hideLoading();
    }
}

// Will Creation Functions
async function checkSubscriptionAndCreateWill() {
    try {
        const response = await fetch(API_BASE_URL + '/subscription/status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.active) {
                showWillCreator();
            } else {
                alert('Please subscribe to create Bitcoin wills');
                showSubscriptionSection();
            }
        } else {
            alert('Please check your subscription status');
        }
    } catch (error) {
        console.error('Subscription check error:', error);
        alert('Failed to verify subscription. Please try again.');
    }
}

function showWillCreator() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('willCreator').style.display = 'block';
    document.getElementById('subscriptionSection').style.display = 'none';
    
    // Reset form
    editingWillId = null;
    currentStep = 1;
    updateWillForm();
    
    // Clear all form data
    document.getElementById('willForm').reset();
    
    // Clear dynamic sections
    document.getElementById('walletsContainer').innerHTML = '';
    document.getElementById('exchangesContainer').innerHTML = '';
    document.getElementById('primaryBeneficiariesContainer').innerHTML = '';
    document.getElementById('contingentBeneficiariesContainer').innerHTML = '';
    document.getElementById('trustedContactsContainer').innerHTML = '';
    
    // Add initial dynamic items
    addWallet();
    addExchange();
    addBeneficiary('primary');
    addBeneficiary('contingent');
    addTrustedContact();
}

function hideWillCreator() {
    document.getElementById('willCreator').style.display = 'none';
    showDashboard();
}

function updateWillForm() {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step${i}`);
        if (step) {
            step.style.display = 'none';
        }
    }
    
    // Show current step
    const currentStepElement = document.getElementById(`step${currentStep}`);
    if (currentStepElement) {
        currentStepElement.style.display = 'block';
    }
    
    // Update progress bar
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${(currentStep / 4) * 100}%`;
    }
    
    // Update step indicators
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        indicator.classList.toggle('active', index + 1 === currentStep);
        indicator.classList.toggle('completed', index + 1 < currentStep);
    });
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    if (prevBtn) prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-block';
    if (nextBtn) nextBtn.style.display = currentStep === 4 ? 'none' : 'inline-block';
    if (submitBtn) submitBtn.style.display = currentStep === 4 ? 'inline-block' : 'none';
}

function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < 4) {
            currentStep++;
            updateWillForm();
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateWillForm();
    }
}

function validateCurrentStep() {
    const currentStepElement = document.getElementById(`step${currentStep}`);
    if (!currentStepElement) return true;
    
    // Get all required fields in current step that are visible
    const requiredFields = currentStepElement.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        // FIXED: Check if field is actually visible before validating
        const isVisible = field.offsetParent !== null && 
                         getComputedStyle(field).display !== 'none' && 
                         getComputedStyle(field).visibility !== 'hidden';
        
        if (isVisible) {
            if (!field.value.trim()) {
                field.classList.add('error');
                isValid = false;
            } else {
                field.classList.remove('error');
            }
        } else {
            // FIXED: Remove required attribute from hidden fields to prevent validation errors
            field.removeAttribute('required');
            field.setAttribute('data-was-required', 'true');
        }
    });
    
    if (!isValid) {
        alert('Please fill in all required fields before proceeding.');
    }
    
    return isValid;
}

// Dynamic Form Functions
function addWallet() {
    const container = document.getElementById('walletsContainer');
    const walletCount = container.children.length;
    
    const walletDiv = document.createElement('div');
    walletDiv.className = 'wallet-item';
    walletDiv.innerHTML = `
        <h4>Wallet ${walletCount + 1}</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Wallet Name:</label>
                <input type="text" name="walletName" required>
            </div>
            <div class="form-group">
                <label>Wallet Type:</label>
                <select name="walletType" required>
                    <option value="">Select type</option>
                    <option value="hardware">Hardware Wallet</option>
                    <option value="software">Software Wallet</option>
                    <option value="paper">Paper Wallet</option>
                    <option value="mobile">Mobile Wallet</option>
                    <option value="web">Web Wallet</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Description:</label>
            <textarea name="walletDescription" rows="2"></textarea>
        </div>
        <div class="form-group">
            <label>Access Method:</label>
            <textarea name="accessMethod" rows="2" required></textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Seed Phrase Location:</label>
                <input type="text" name="seedPhraseLocation">
            </div>
            <div class="form-group">
                <label>Private Key Location:</label>
                <input type="text" name="privateKeyLocation">
            </div>
        </div>
        <div class="form-group">
            <label>Additional Notes:</label>
            <textarea name="walletNotes" rows="2"></textarea>
        </div>
        <button type="button" onclick="removeWallet(this)" class="btn btn-danger btn-small">Remove Wallet</button>
    `;
    
    container.appendChild(walletDiv);
}

function removeWallet(button) {
    const walletItem = button.closest('.wallet-item');
    walletItem.remove();
    
    // Update wallet numbers
    const wallets = document.querySelectorAll('.wallet-item');
    wallets.forEach((wallet, index) => {
        wallet.querySelector('h4').textContent = `Wallet ${index + 1}`;
    });
}

function addExchange() {
    const container = document.getElementById('exchangesContainer');
    const exchangeCount = container.children.length;
    
    const exchangeDiv = document.createElement('div');
    exchangeDiv.className = 'exchange-item';
    exchangeDiv.innerHTML = `
        <h4>Exchange ${exchangeCount + 1}</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Exchange Name:</label>
                <input type="text" name="exchangeName" required>
            </div>
            <div class="form-group">
                <label>Username/Account ID:</label>
                <input type="text" name="exchangeUsername" required>
            </div>
        </div>
        <div class="form-group">
            <label>Email Address:</label>
            <input type="email" name="exchangeEmail">
        </div>
        <div class="form-group">
            <label>2FA Backup Location:</label>
            <input type="text" name="twoFactorBackup">
        </div>
        <div class="form-group">
            <label>Additional Notes:</label>
            <textarea name="exchangeNotes" rows="2"></textarea>
        </div>
        <button type="button" onclick="removeExchange(this)" class="btn btn-danger btn-small">Remove Exchange</button>
    `;
    
    container.appendChild(exchangeDiv);
}

function removeExchange(button) {
    const exchangeItem = button.closest('.exchange-item');
    exchangeItem.remove();
    
    // Update exchange numbers
    const exchanges = document.querySelectorAll('.exchange-item');
    exchanges.forEach((exchange, index) => {
        exchange.querySelector('h4').textContent = `Exchange ${index + 1}`;
    });
}

function addBeneficiary(type) {
    const container = document.getElementById(`${type}BeneficiariesContainer`);
    const beneficiaryCount = container.children.length;
    
    const beneficiaryDiv = document.createElement('div');
    beneficiaryDiv.className = 'beneficiary-item';
    beneficiaryDiv.innerHTML = `
        <h4>${type.charAt(0).toUpperCase() + type.slice(1)} Beneficiary ${beneficiaryCount + 1}</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Full Name:</label>
                <input type="text" name="beneficiaryName" required>
            </div>
            <div class="form-group">
                <label>Relationship:</label>
                <input type="text" name="beneficiaryRelationship" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Percentage of Assets:</label>
                <input type="number" name="beneficiaryPercentage" min="0" max="100" required>
            </div>
            <div class="form-group">
                <label>Phone Number:</label>
                <input type="tel" name="beneficiaryPhone">
            </div>
        </div>
        <div class="form-group">
            <label>Email Address:</label>
            <input type="email" name="beneficiaryEmail">
        </div>
        <div class="form-group">
            <label>Bitcoin Address (optional):</label>
            <input type="text" name="beneficiaryBitcoinAddress">
        </div>
        <div class="address-section">
            <h5>Address Information</h5>
            <div class="form-group">
                <label>Street Address:</label>
                <input type="text" name="beneficiaryStreet">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>City:</label>
                    <input type="text" name="beneficiaryCity">
                </div>
                <div class="form-group">
                    <label>State/Province:</label>
                    <input type="text" name="beneficiaryState">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>ZIP/Postal Code:</label>
                    <input type="text" name="beneficiaryZip">
                </div>
                <div class="form-group">
                    <label>Country:</label>
                    <input type="text" name="beneficiaryCountry">
                </div>
            </div>
        </div>
        <button type="button" onclick="removeBeneficiary(this, '${type}')" class="btn btn-danger btn-small">Remove Beneficiary</button>
    `;
    
    container.appendChild(beneficiaryDiv);
}

function removeBeneficiary(button, type) {
    const beneficiaryItem = button.closest('.beneficiary-item');
    beneficiaryItem.remove();
    
    // Update beneficiary numbers
    const beneficiaries = document.querySelectorAll(`#${type}BeneficiariesContainer .beneficiary-item`);
    beneficiaries.forEach((beneficiary, index) => {
        beneficiary.querySelector('h4').textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Beneficiary ${index + 1}`;
    });
}

function addTrustedContact() {
    const container = document.getElementById('trustedContactsContainer');
    const contactCount = container.children.length;
    
    const contactDiv = document.createElement('div');
    contactDiv.className = 'trusted-contact-item';
    contactDiv.innerHTML = `
        <h4>Trusted Contact ${contactCount + 1}</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Name:</label>
                <input type="text" name="contactName" required>
            </div>
            <div class="form-group">
                <label>Contact Information:</label>
                <input type="text" name="contactInfo" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Relationship:</label>
                <input type="text" name="contactRelationship">
            </div>
            <div class="form-group">
                <label>Role/Expertise:</label>
                <input type="text" name="contactRole">
            </div>
        </div>
        <button type="button" onclick="removeTrustedContact(this)" class="btn btn-danger btn-small">Remove Contact</button>
    `;
    
    container.appendChild(contactDiv);
}

function removeTrustedContact(button) {
    const contactItem = button.closest('.trusted-contact-item');
    contactItem.remove();
    
    // Update contact numbers
    const contacts = document.querySelectorAll('.trusted-contact-item');
    contacts.forEach((contact, index) => {
        contact.querySelector('h4').textContent = `Trusted Contact ${index + 1}`;
    });
}

// Form Data Collection
function collectFormData() {
    const formData = new FormData(document.getElementById('willForm'));
    
    // Personal Information
    const personalInfo = {
        full_name: formData.get('fullName'),
        date_of_birth: formData.get('dateOfBirth'),
        phone: formData.get('phone'),
        executor_name: formData.get('executorName'),
        executor_contact: formData.get('executorContact'),
        address: {
            street: formData.get('street'),
            city: formData.get('city'),
            state: formData.get('state'),
            zip_code: formData.get('zipCode'),
            country: formData.get('country')
        }
    };
    
    // Bitcoin Assets
    const assets = {
        wallets: collectWallets(),
        exchanges: collectExchanges(),
        storage_method: formData.get('storageMethod'),
        storage_location: formData.get('storageLocation'),
        storage_details: formData.get('storageDetails')
    };
    
    // Beneficiaries
    const beneficiaries = {
        primary: collectBeneficiaries('primary'),
        contingent: collectBeneficiaries('contingent')
    };
    
    // Instructions
    const instructions = {
        access_instructions: formData.get('accessInstructions'),
        security_notes: formData.get('securityNotes'),
        additional_instructions: formData.get('additionalInstructions'),
        emergency_contact: formData.get('emergencyContact'),
        trusted_contacts: collectTrustedContacts()
    };
    
    return {
        personal_info: personalInfo,
        assets: assets,
        beneficiaries: beneficiaries,
        instructions: instructions
    };
}

function collectWallets() {
    const wallets = [];
    const walletItems = document.querySelectorAll('.wallet-item');
    
    walletItems.forEach(item => {
        const wallet = {
            name: item.querySelector('[name="walletName"]').value,
            type: item.querySelector('[name="walletType"]').value,
            description: item.querySelector('[name="walletDescription"]').value,
            access_method: item.querySelector('[name="accessMethod"]').value,
            seed_phrase_location: item.querySelector('[name="seedPhraseLocation"]').value,
            private_key_location: item.querySelector('[name="privateKeyLocation"]').value,
            additional_notes: item.querySelector('[name="walletNotes"]').value
        };
        wallets.push(wallet);
    });
    
    return wallets;
}

function collectExchanges() {
    const exchanges = [];
    const exchangeItems = document.querySelectorAll('.exchange-item');
    
    exchangeItems.forEach(item => {
        const exchange = {
            name: item.querySelector('[name="exchangeName"]').value,
            username: item.querySelector('[name="exchangeUsername"]').value,
            email: item.querySelector('[name="exchangeEmail"]').value,
            two_factor_backup: item.querySelector('[name="twoFactorBackup"]').value,
            additional_notes: item.querySelector('[name="exchangeNotes"]').value
        };
        exchanges.push(exchange);
    });
    
    return exchanges;
}

function collectBeneficiaries(type) {
    const beneficiaries = [];
    const beneficiaryItems = document.querySelectorAll(`#${type}BeneficiariesContainer .beneficiary-item`);
    
    beneficiaryItems.forEach(item => {
        const beneficiary = {
            name: item.querySelector('[name="beneficiaryName"]').value,
            relationship: item.querySelector('[name="beneficiaryRelationship"]').value,
            percentage: item.querySelector('[name="beneficiaryPercentage"]').value,
            phone: item.querySelector('[name="beneficiaryPhone"]').value,
            email: item.querySelector('[name="beneficiaryEmail"]').value,
            bitcoin_address: item.querySelector('[name="beneficiaryBitcoinAddress"]').value,
            address: {
                street: item.querySelector('[name="beneficiaryStreet"]').value,
                city: item.querySelector('[name="beneficiaryCity"]').value,
                state: item.querySelector('[name="beneficiaryState"]').value,
                zip_code: item.querySelector('[name="beneficiaryZip"]').value,
                country: item.querySelector('[name="beneficiaryCountry"]').value
            }
        };
        beneficiaries.push(beneficiary);
    });
    
    return beneficiaries;
}

function collectTrustedContacts() {
    const contacts = [];
    const contactItems = document.querySelectorAll('.trusted-contact-item');
    
    contactItems.forEach(item => {
        const contact = {
            name: item.querySelector('[name="contactName"]').value,
            contact: item.querySelector('[name="contactInfo"]').value,
            relationship: item.querySelector('[name="contactRelationship"]').value,
            role: item.querySelector('[name="contactRole"]').value
        };
        contacts.push(contact);
    });
    
    return contacts;
}

// Will Management Functions
async function handleWillSubmit(event) {
    event.preventDefault();
    
    if (!validateCurrentStep()) {
        return;
    }
    
    try {
        showLoading();
        
        const willData = collectFormData();
        
        let response;
        if (editingWillId) {
            // Update existing will
            response = await fetch(API_BASE_URL + `/will/${editingWillId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
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
            alert(editingWillId ? 'Will updated successfully!' : 'Bitcoin will created successfully!');
            hideWillCreator();
            showDashboard();
        } else {
            throw new Error(data.message || 'Failed to save will');
        }
    } catch (error) {
        console.error('Will submit error:', error);
        alert('Failed to save will. Please try again.');
    } finally {
        hideLoading();
    }
}

async function editWill(willId) {
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + `/will/${willId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const willData = await response.json();
            editingWillId = willId;
            showWillCreator();
            populateWillForm(willData);
        } else {
            alert('Failed to load will data');
        }
    } catch (error) {
        console.error('Error loading will:', error);
        alert('Failed to load will data');
    } finally {
        hideLoading();
    }
}

function populateWillForm(willData) {
    // Populate personal information
    if (willData.personal_info) {
        setFormValue('fullName', willData.personal_info.full_name);
        setFormValue('dateOfBirth', willData.personal_info.date_of_birth);
        setFormValue('phone', willData.personal_info.phone);
        setFormValue('executorName', willData.personal_info.executor_name);
        setFormValue('executorContact', willData.personal_info.executor_contact);
        
        if (willData.personal_info.address) {
            setFormValue('street', willData.personal_info.address.street);
            setFormValue('city', willData.personal_info.address.city);
            setFormValue('state', willData.personal_info.address.state);
            setFormValue('zipCode', willData.personal_info.address.zip_code);
            setFormValue('country', willData.personal_info.address.country);
        }
    }
    
    // Populate assets
    if (willData.assets) {
        // Clear existing dynamic sections
        document.getElementById('walletsContainer').innerHTML = '';
        document.getElementById('exchangesContainer').innerHTML = '';
        
        // Populate wallets
        if (willData.assets.wallets && willData.assets.wallets.length > 0) {
            willData.assets.wallets.forEach((wallet, index) => {
                addWallet();
                const walletItem = document.querySelectorAll('.wallet-item')[index];
                setFormValueInContainer(walletItem, 'walletName', wallet.name);
                setFormValueInContainer(walletItem, 'walletType', wallet.type);
                setFormValueInContainer(walletItem, 'walletDescription', wallet.description);
                setFormValueInContainer(walletItem, 'accessMethod', wallet.access_method);
                setFormValueInContainer(walletItem, 'seedPhraseLocation', wallet.seed_phrase_location);
                setFormValueInContainer(walletItem, 'privateKeyLocation', wallet.private_key_location);
                setFormValueInContainer(walletItem, 'walletNotes', wallet.additional_notes);
            });
        } else {
            addWallet();
        }
        
        // Populate exchanges
        if (willData.assets.exchanges && willData.assets.exchanges.length > 0) {
            willData.assets.exchanges.forEach((exchange, index) => {
                addExchange();
                const exchangeItem = document.querySelectorAll('.exchange-item')[index];
                setFormValueInContainer(exchangeItem, 'exchangeName', exchange.name);
                setFormValueInContainer(exchangeItem, 'exchangeUsername', exchange.username);
                setFormValueInContainer(exchangeItem, 'exchangeEmail', exchange.email);
                setFormValueInContainer(exchangeItem, 'twoFactorBackup', exchange.two_factor_backup);
                setFormValueInContainer(exchangeItem, 'exchangeNotes', exchange.additional_notes);
            });
        } else {
            addExchange();
        }
        
        // Populate storage information
        setFormValue('storageMethod', willData.assets.storage_method);
        setFormValue('storageLocation', willData.assets.storage_location);
        setFormValue('storageDetails', willData.assets.storage_details);
    }
    
    // Populate beneficiaries
    if (willData.beneficiaries) {
        // Clear existing beneficiaries
        document.getElementById('primaryBeneficiariesContainer').innerHTML = '';
        document.getElementById('contingentBeneficiariesContainer').innerHTML = '';
        
        // Populate primary beneficiaries
        if (willData.beneficiaries.primary && willData.beneficiaries.primary.length > 0) {
            willData.beneficiaries.primary.forEach((beneficiary, index) => {
                addBeneficiary('primary');
                const beneficiaryItem = document.querySelectorAll('#primaryBeneficiariesContainer .beneficiary-item')[index];
                populateBeneficiaryData(beneficiaryItem, beneficiary);
            });
        } else {
            addBeneficiary('primary');
        }
        
        // Populate contingent beneficiaries
        if (willData.beneficiaries.contingent && willData.beneficiaries.contingent.length > 0) {
            willData.beneficiaries.contingent.forEach((beneficiary, index) => {
                addBeneficiary('contingent');
                const beneficiaryItem = document.querySelectorAll('#contingentBeneficiariesContainer .beneficiary-item')[index];
                populateBeneficiaryData(beneficiaryItem, beneficiary);
            });
        } else {
            addBeneficiary('contingent');
        }
    }
    
    // Populate instructions
    if (willData.instructions) {
        setFormValue('accessInstructions', willData.instructions.access_instructions);
        setFormValue('securityNotes', willData.instructions.security_notes);
        setFormValue('additionalInstructions', willData.instructions.additional_instructions);
        setFormValue('emergencyContact', willData.instructions.emergency_contact);
        
        // Clear existing trusted contacts
        document.getElementById('trustedContactsContainer').innerHTML = '';
        
        // Populate trusted contacts
        if (willData.instructions.trusted_contacts && willData.instructions.trusted_contacts.length > 0) {
            willData.instructions.trusted_contacts.forEach((contact, index) => {
                addTrustedContact();
                const contactItem = document.querySelectorAll('.trusted-contact-item')[index];
                setFormValueInContainer(contactItem, 'contactName', contact.name);
                setFormValueInContainer(contactItem, 'contactInfo', contact.contact);
                setFormValueInContainer(contactItem, 'contactRelationship', contact.relationship);
                setFormValueInContainer(contactItem, 'contactRole', contact.role);
            });
        } else {
            addTrustedContact();
        }
    }
}

function populateBeneficiaryData(container, beneficiary) {
    setFormValueInContainer(container, 'beneficiaryName', beneficiary.name);
    setFormValueInContainer(container, 'beneficiaryRelationship', beneficiary.relationship);
    setFormValueInContainer(container, 'beneficiaryPercentage', beneficiary.percentage);
    setFormValueInContainer(container, 'beneficiaryPhone', beneficiary.phone);
    setFormValueInContainer(container, 'beneficiaryEmail', beneficiary.email);
    setFormValueInContainer(container, 'beneficiaryBitcoinAddress', beneficiary.bitcoin_address);
    
    if (beneficiary.address) {
        setFormValueInContainer(container, 'beneficiaryStreet', beneficiary.address.street);
        setFormValueInContainer(container, 'beneficiaryCity', beneficiary.address.city);
        setFormValueInContainer(container, 'beneficiaryState', beneficiary.address.state);
        setFormValueInContainer(container, 'beneficiaryZip', beneficiary.address.zip_code);
        setFormValueInContainer(container, 'beneficiaryCountry', beneficiary.address.country);
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

async function deleteWill(willId) {
    if (!confirm('Are you sure you want to delete this will? This action cannot be undone.')) {
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
            alert('Will deleted successfully');
            loadDashboardData();
        } else {
            alert('Failed to delete will');
        }
    } catch (error) {
        console.error('Error deleting will:', error);
        alert('Failed to delete will');
    } finally {
        hideLoading();
    }
}

async function downloadWill(willId) {
    try {
        showLoading();
        
        const response = await fetch(API_BASE_URL + `/will/${willId}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `bitcoin_will_${willId}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Failed to download will');
        }
    } catch (error) {
        console.error('Error downloading will:', error);
        alert('Failed to download will');
    } finally {
        hideLoading();
    }
}

// Utility Functions
function showLoading() {
    const loader = document.getElementById('loadingSpinner');
    if (loader) {
        loader.style.display = 'block';
    }
}

function hideLoading() {
    const loader = document.getElementById('loadingSpinner');
    if (loader) {
        loader.style.display = 'none';
    }
}

function showError(message) {
    alert(message);
}

function hideError() {
    // Implementation for hiding error messages
}

function toggleMobileMenu() {
    const nav = document.querySelector('.nav-links');
    if (nav) {
        nav.classList.toggle('active');
    }
}

function initializeMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    if (hamburger) {
        hamburger.addEventListener('click', toggleMobileMenu);
    }
}

function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const cancelled = urlParams.get('cancelled');
    
    if (success === 'true') {
        alert('Payment successful! Your subscription is now active.');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Reload subscription status
        if (authToken) {
            loadSubscriptionStatus();
        }
    } else if (cancelled === 'true') {
        alert('Payment was cancelled.');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Navigation helper function
function to(section) {
    if (section === 'dashboard') {
        showDashboard();
    } else if (section === 'subscription') {
        showSubscriptionSection();
    } else if (section === 'will-creator') {
        checkSubscriptionAndCreateWill();
    }
}


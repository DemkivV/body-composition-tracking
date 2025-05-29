// Ensure pywebview.api is ready
window.addEventListener('pywebviewready', function() {
    console.log("pywebview API is ready.");
    // Initialize UI elements that depend on pywebview.api or initial state
    updateButtonStates(); // Example: update based on initial auth status from Python if available
});

// Track authentication and data import status
let isAuthenticated = false;
let hasImportedData = false;
let hasUnifiedData = false;
let isAuthenticating = false;

function openTab(evt, tabName) {
    console.log('openTab called with tabName:', tabName);

    // Check if the clicked tab is disabled
    if (evt && evt.currentTarget && evt.currentTarget.classList.contains('disabled')) {
        console.log('Tab is disabled, preventing navigation');
        evt.preventDefault();
        return false;
    }

    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");

    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablinks");

    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    const currentTab = document.getElementById(tabName);
    if (currentTab) {
        currentTab.style.display = "block";
        console.log('Switched to tab:', tabName);
    } else {
        console.error('Tab with ID not found:', tabName);
    }

    if (evt && evt.currentTarget) {
        evt.currentTarget.className += " active";
    }

    // Load data when switching to specific tabs
    if (tabName === 'raw-data') {
        loadRawData();
    }
}

async function loadRawData() {
    try {
        const response = await pywebview.api.load_raw_data();
        if (response.success) {
            displayRawData(response.data);
        } else {
            console.error('Failed to load raw data:', response.message);
            displayRawData([]);
        }
    } catch (e) {
        console.error('Error loading raw data:', e);
        displayRawData([]);
    }
}

function showStatus(message, isError = false, timeout = 0) {
    const statusDiv = document.getElementById('auth-status');
    if (!statusDiv) return;

    statusDiv.textContent = message;
    if (isError) {
        statusDiv.className = 'auth-status error';
    } else if (message.includes('Successfully')) {
        statusDiv.className = 'auth-status authenticated';
    } else {
        statusDiv.className = 'auth-status authenticating';
    }
    statusDiv.style.display = 'block';

    // Only hide after timeout if timeout > 0 and it's not a success message
    if (timeout > 0 && !message.includes('Successfully')) {
        setTimeout(() => {
            if (statusDiv && isAuthenticated) {
                updateAuthStatus(); // Restore auth status
            } else if (statusDiv && !isAuthenticated) {
                statusDiv.textContent = 'Not authenticated yet.';
                statusDiv.className = 'auth-status not-authenticated';
            }
        }, timeout);
    }
}

function updateAuthStatus() {
    const authStatus = document.getElementById('auth-status');
    if (!authStatus) return;

    if (isAuthenticated) {
        authStatus.textContent = 'Successfully authenticated with Withings!';
        authStatus.className = 'auth-status authenticated';
    } else {
        authStatus.textContent = 'Not authenticated yet.';
        authStatus.className = 'auth-status not-authenticated';
    }
}

function updateTabStates() {
    // Remove the disabled state logic - tabs should always be clickable
    // Users should be able to see what each tab contains, even if empty
    const rawDataTab = document.querySelector('[data-tab="raw-data"]');
    const analysisTab = document.querySelector('[data-tab="analysis"]');

    // Make sure tabs are always enabled
    if (rawDataTab) {
        rawDataTab.classList.remove('disabled');
    }

    if (analysisTab) {
        analysisTab.classList.remove('disabled');
    }
}

async function checkUnifiedDataStatus() {
    try {
        const response = await pywebview.api.has_unified_data();
        if (response.success) {
            hasUnifiedData = response.has_data;
            updateTabStates();
            updateButtonStates(null, true); // Preserve any existing status message
        }
    } catch (e) {
        console.error("Failed to check unified data status:", e);
    }
}

function updateButtonStates(authenticated = null, preserveStatusMessage = false) {
    if (authenticated !== null) {
        isAuthenticated = authenticated;
    }

    const authBtn = document.getElementById('authenticate-btn');
    const importBtn = document.getElementById('import-btn');
    const clearBtn = document.getElementById('clear-btn');

    if (authBtn) {
        authBtn.disabled = isAuthenticated;
        if (isAuthenticated) {
            authBtn.textContent = 'Authenticated';
            authBtn.className = 'authenticated';
        } else {
            authBtn.textContent = 'Authenticate';
            authBtn.className = '';
        }
    }
    if (importBtn) {
        importBtn.disabled = !isAuthenticated;
        // Update button text based on whether data exists
        if (hasUnifiedData) {
            importBtn.textContent = 'Update Data';
        } else {
            importBtn.textContent = 'Import Data';
        }
    }
    if (clearBtn) clearBtn.disabled = !isAuthenticated;

    // Only update auth status if we're not preserving a status message
    if (!preserveStatusMessage) {
        updateAuthStatus();
    }
    updateTabStates();
}

async function authenticateWithings() {
    if (isAuthenticating) return;

    isAuthenticating = true;
    const authBtn = document.getElementById('authenticate-btn');
    if (authBtn) {
        authBtn.disabled = true;
        authBtn.textContent = 'Authenticating...';
    }

    showStatus('Authenticating...', false, 0);

    try {
        const response = await pywebview.api.authenticate();
        if (response.success) {
            updateButtonStates(true);
            showStatus('Successfully authenticated with Withings!', false, 0);
        } else {
            showStatus('Authentication failed: ' + (response.message || "Unknown error"), true, 5000);
            updateButtonStates(false);
        }
    } catch (e) {
        console.error("Authentication API call failed:", e);
        showStatus('Authentication error: ' + (e.message || 'Unknown error occurred'), true, 5000);
        updateButtonStates(false);
    } finally {
        isAuthenticating = false;
    }
}

async function importData() {
    showStatus('Importing data...', false, 0);
    try {
        const response = await pywebview.api.import_data();
        if (response.success) {
            showStatus(response.message, false, 0); // Success message persists
            hasImportedData = true;
            // Check for unified data after import
            await checkUnifiedDataStatus();
        } else {
            showStatus(response.message || "Import failed", true, 5000);
        }
    } catch (e) {
        console.error("Import data API call failed:", e);
        showStatus('Import error: ' + e.message, true, 5000);
    }
}

function displayRawData(data) {
    const tableContent = document.getElementById('raw-data-content');
    if (!tableContent) {
        console.error("Raw data display element 'raw-data-content' not found.");
        return;
    }
    if (!data || data.length === 0) {
        tableContent.innerHTML = '<p>No data to display.</p>';
        return;
    }

    // Check what fields are available in the data
    const hasAdvancedFields = data.some(item =>
        item.muscle_percent !== null || item.bone_percent !== null || item.water_percent !== null
    );

    let tableHTML = '<table><thead><tr>' +
                    '<th>Date</th>' +
                    '<th>Weight (kg)</th>' +
                    '<th>Fat (%)</th>';

    if (hasAdvancedFields) {
        tableHTML += '<th>Muscle (%)</th><th>Bone (%)</th><th>Water (%)</th>';
    }

    tableHTML += '</tr></thead><tbody>';

    data.forEach(item => {
        const date = item.date ? new Date(item.date).toLocaleString() : 'N/A';
        const weight = item.weight_kg !== null && item.weight_kg !== undefined ?
                       parseFloat(item.weight_kg).toFixed(2) : 'N/A';
        const fat = item.fat_percent !== null && item.fat_percent !== undefined ?
                    parseFloat(item.fat_percent).toFixed(2) : 'N/A';

        tableHTML += `<tr><td>${date}</td>` +
                     `<td>${weight}</td>` +
                     `<td>${fat}</td>`;

        if (hasAdvancedFields) {
            const muscle = item.muscle_percent !== null && item.muscle_percent !== undefined ?
                           parseFloat(item.muscle_percent).toFixed(2) : 'N/A';
            const bone = item.bone_percent !== null && item.bone_percent !== undefined ?
                         parseFloat(item.bone_percent).toFixed(2) : 'N/A';
            const water = item.water_percent !== null && item.water_percent !== undefined ?
                          parseFloat(item.water_percent).toFixed(2) : 'N/A';
            tableHTML += `<td>${muscle}</td><td>${bone}</td><td>${water}</td>`;
        }

        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';

    if (data.length > 0) {
        tableHTML += `<p class="data-info">Showing ${data.length} most recent entries.</p>`;
    }

    tableContent.innerHTML = tableHTML;
}

async function clearData() {
    if (confirm('Are you sure you want to clear all local data?')) {
        // Clear any previous error messages
        updateAuthStatus();

        showStatus('Clearing data...', false, 0);
        try {
            const response = await pywebview.api.clear_data();
            if (response.success) {
                showStatus(response.message);
                displayRawData([]);
                hasImportedData = false;
                hasUnifiedData = false;
                updateButtonStates(false);
            } else {
                showStatus('Clear data failed: ' + (response.message || "Unknown error"), true, 0);
            }
        } catch (e) {
            console.error("Clear data API call failed:", e);
            showStatus('Clear data error: ' + e.message, true, 0);
        }
    }
}

async function checkInitialAuthStatus() {
    try {
        const response = await pywebview.api.is_authenticated();
        if (response.success) {
            updateButtonStates(response.authenticated);
        }
    } catch (e) {
        console.error("Failed to check initial auth status:", e);
    }

    // Also check for existing unified data
    await checkUnifiedDataStatus();
}

// Initialize the first tab and button states on DOM load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing tabs...');

    // Debug: Log all tab elements
    const allTabs = document.querySelectorAll('[data-tab]');
    console.log('Found tabs:', allTabs.length);
    allTabs.forEach((tab, index) => {
        console.log(`Tab ${index}: data-tab="${tab.dataset.tab}", classes="${tab.className}"`);
    });

    // Set the first tab as active and make sure it's displayed
    const firstTab = document.querySelector('.tab button[data-tab="data-import"]');
    if (firstTab) {
        firstTab.classList.add('active');
        // Manually show the first tab content
        openTab({currentTarget: firstTab}, 'data-import');
    } else {
        console.error('First tab not found!');
    }

    // Add event delegation for buttons
    document.addEventListener('click', function(event) {
        const button = event.target.closest('button');
        if (!button) return;

        if (button.id === 'authenticate-btn' || button.dataset.action === 'authenticate') {
            event.preventDefault();
            if (!isAuthenticating) {
                authenticateWithings();
            }
        }

        // Handle import data button
        if (button.id === 'import-btn') {
            event.preventDefault();
            if (!button.disabled) {
                importData();
            }
        }

        // Handle clear data button
        if (button.id === 'clear-btn') {
            event.preventDefault();
            if (!button.disabled) {
                clearData();
            }
        }

        // Handle tab clicks
        if (button.classList.contains('tablinks')) {
            // Check if tab is disabled
            if (button.classList.contains('disabled')) {
                event.preventDefault();
                return false;
            }
            // Handle tab switching
            const tabName = button.dataset.tab;
            if (tabName) {
                openTab(event, tabName);
            }
        }
    });

    // Check if pywebview.api is already available
    if (window.pywebview && window.pywebview.api) {
        checkInitialAuthStatus();
    }
});

// Check authentication status when pywebview is ready
window.addEventListener('pywebviewready', function() {
    checkInitialAuthStatus();
});

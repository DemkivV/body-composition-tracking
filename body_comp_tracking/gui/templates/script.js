// Ensure pywebview.api is ready
window.addEventListener('pywebviewready', function() {
    console.log("pywebview API is ready.");
    // Initialize UI elements that depend on pywebview.api or initial state
    updateButtonStates(); // Example: update based on initial auth status from Python if available
});

function openTab(evt, tabName) {
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
    }
    if (evt && evt.currentTarget) {
        evt.currentTarget.className += " active";
    }
}

function showStatus(message, isError = false, duration = 5000) {
    const statusDiv = document.getElementById('import-status');
    if (!statusDiv) {
        console.error("Status display element 'import-status' not found.");
        return;
    }
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + (isError ? 'error' : 'success');
    statusDiv.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, duration);
    }
}

function updateButtonStates(isAuthenticated = false) {
    const authBtn = document.getElementById('authenticate-btn');
    const importBtn = document.getElementById('import-btn');
    const clearBtn = document.getElementById('clear-btn');
    const authStatusEl = document.getElementById('auth-status');

    if (authBtn) authBtn.disabled = isAuthenticated;
    if (importBtn) importBtn.disabled = !isAuthenticated;
    if (clearBtn) clearBtn.disabled = !isAuthenticated; // Or based on data presence

    if (authStatusEl) {
        authStatusEl.textContent = isAuthenticated ? 'Authenticated with Withings.' : 'Not authenticated yet.';
        authStatusEl.className = 'auth-status ' + (isAuthenticated ? 'authenticated' : 'not-authenticated');
    }
}

async function authenticateWithings() {
    if (isAuthenticating) return; // Prevent multiple authentication attempts

    isAuthenticating = true;
    const authBtn = document.getElementById('authenticate-btn');
    if (authBtn) {
        authBtn.disabled = true;
        authBtn.textContent = 'Authenticating...';
    }

    showStatus('Authenticating with Withings...', false, 0); // Show indefinitely until response

    try {
        const response = await pywebview.api.authenticate();
        if (response.success) {
            showStatus(response.message);
            updateButtonStates(true);
        } else {
            showStatus('Authentication failed: ' + (response.message || "Unknown error"), true);
            updateButtonStates(false);
            if (authBtn) {
                authBtn.disabled = false;
                authBtn.textContent = 'Authenticate with Withings';
            }
        }
    } catch (e) {
        console.error("Authentication API call failed:", e);
        showStatus('Authentication error: ' + (e.message || 'Unknown error occurred'), true);
        updateButtonStates(false);
        if (authBtn) {
            authBtn.disabled = false;
            authBtn.textContent = 'Authenticate with Withings';
        }
    } finally {
        isAuthenticating = false;
    }
}

async function importData() {
    showStatus('Importing data...', false, 0); // Show indefinitely
    try {
        const response = await pywebview.api.import_data();
        if (response.success) {
            showStatus(response.message);
            if (response.data) {
                displayRawData(response.data);
            } else {
                 displayRawData([]); // Clear or show no data
            }
        } else {
            showStatus('Import failed: ' + (response.message || "Unknown error"), true);
        }
    } catch (e) {
        console.error("Import data API call failed:", e);
        showStatus('Import error: ' + e.message, true);
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
    let tableHTML = '<table><thead><tr>' +
                    '<th>Date</th>' +
                    '<th>Weight (kg)</th><th>Fat (%)</th>' +
                    '</tr></thead><tbody>';
    data.forEach(item => {
        const date = item.date ? new Date(item.date).toLocaleString() : 'N/A';
        const weight = item.weight_kg !== null && item.weight_kg !== undefined ?
                       parseFloat(item.weight_kg).toFixed(2) : 'N/A';
        const fat = item.fat_percent !== null && item.fat_percent !== undefined ?
                    parseFloat(item.fat_percent).toFixed(2) : 'N/A';

        tableHTML += `<tr><td>${date}</td>` +
                     `<td>${weight}</td>` +
                     `<td>${fat}</td></tr>`;
    });
    tableHTML += '</tbody></table>';
    tableContent.innerHTML = tableHTML;
}

async function clearData() {
    if (confirm('Are you sure you want to clear all local data? This action is for demonstration and may not persist data across sessions yet.')) {
        showStatus('Clearing data...', false, 0);
        try {
            const response = await pywebview.api.clear_data();
            if (response.success) {
                showStatus('Data cleared successfully.');
                displayRawData([]); // Clear the displayed data
                updateButtonStates(false); // Reset to non-authenticated state for buttons
                                          // Or, if auth persists, just disable import/clear if no data
            } else {
                showStatus('Clear data failed: ' + (response.message || "Unknown error"), true);
            }
        } catch (e) {
            console.error("Clear data API call failed:", e);
            showStatus('Clear data error: ' + e.message, true);
        }
    }
}

// Track if authentication is in progress
let isAuthenticating = false;

// Initialize the first tab and button states on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Set the first tab as active
    const firstTab = document.querySelector('.tab button');
    if (firstTab) {
        firstTab.classList.add('active');
    }
    // Show the first tab content
    openTab({currentTarget: firstTab}, 'data-import');

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
    });

    // Check if pywebview.api is already available
    if (window.pywebview && window.pywebview.api) {
        updateButtonStates(); // Initial button state update
    }
});

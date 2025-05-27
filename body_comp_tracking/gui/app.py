"""Main GUI application for body composition tracking."""

import logging
import platform
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

import webview

from ..config import get_withings_credentials
from ..data_sources.withings_source import WithingsAuth, WithingsSource

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Get the directory where the package is installed
PACKAGE_DIR = Path(__file__).parent.parent


class Api:
    """API class to expose Python functions to JavaScript."""

    def __init__(self) -> None:
        """Initialize the API."""
        self.withings_auth: Optional[WithingsAuth] = None
        self.withings_source: Optional[WithingsSource] = None
        self._initialize_auth()
        self._check_existing_auth()

    def _initialize_auth(self) -> None:
        """Initialize the Withings authentication client."""
        creds = get_withings_credentials()
        if not all([creds.get("client_id"), creds.get("client_secret")]):
            logger.warning("Withings credentials not configured")
            return

        try:
            self.withings_auth = WithingsAuth(
                client_id=creds["client_id"],
                client_secret=creds["client_secret"],
                redirect_uri=creds.get(
                    "redirect_uri", "http://localhost:8000/callback"
                ),
            )
            self.withings_source = WithingsSource(self.withings_auth)
        except Exception as e:
            logger.error(f"Failed to initialize Withings auth: {e}")

    def _check_existing_auth(self) -> None:
        """Check if valid token exists and set up the authentication state."""
        if not self.withings_auth:
            logger.info("No authentication client available")
            return

        try:
            # Try to load existing token
            existing_token = self.withings_auth.token_storage.load_token()
            if existing_token:
                self.withings_auth._token = existing_token
                logger.info("Successfully loaded existing authentication token")
        except Exception as e:
            logger.debug(f"No existing token found or failed to load: {e}")

    def is_authenticated(self) -> Dict[str, Any]:
        """Check if the user is currently authenticated.

        Returns:
            Dict with authentication status
        """
        if not self.withings_auth or not self.withings_auth._token:
            return {"authenticated": False}

        try:
            # Check if token is still valid
            token = self.withings_auth.get_token()
            return {"authenticated": bool(token)}
        except Exception:
            return {"authenticated": False}

    def authenticate(self) -> Dict[str, Any]:
        """Authenticate with Withings API.

        Returns:
            Dict with success status and optional message
        """
        try:
            if not self.withings_auth:
                self._initialize_auth()
                if not self.withings_auth:
                    return {
                        "success": False,
                        "message": "Withings not properly initialized",
                    }

            self.withings_auth.authenticate()
            return {
                "success": True,
                "message": "Successfully authenticated with Withings",
            }
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return {"success": False, "message": str(e)}

    def import_data(self) -> Dict[str, Any]:
        """Import data from Withings API.

        Returns:
            Dict with success status, message, and optional data
        """
        if not self.withings_source:
            return {"success": False, "message": "Not authenticated with Withings"}

        try:
            # Get data for the last 30 days
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

            measurements = self.withings_source.get_measurements(start_date, end_date)

            # Convert measurements to a list of dicts for JSON serialization
            measurements_data = [
                {
                    "date": m.timestamp.isoformat(),
                    "weight_kg": float(m.weight_kg) if m.weight_kg else None,
                    "fat_percent": (
                        float(m.body_fat_percent) if m.body_fat_percent else None
                    ),
                }
                for m in measurements
            ]

            return {
                "success": True,
                "message": (
                    f"Successfully imported {len(measurements_data)} measurements"
                ),
                "data": measurements_data,
            }
        except Exception as e:
            logger.error(f"Error importing data: {e}")
            return {"success": False, "message": f"Failed to import data: {e}"}

    def clear_data(self) -> Dict[str, Any]:
        """Clear stored data and authentication tokens.

        Returns:
            Dict with success status and message
        """
        try:
            # Clear authentication token
            if self.withings_auth:
                self.withings_auth.token_storage.clear_token()
                self.withings_auth._token = None
            # In a real app, you would also clear the local database or storage here
            return {
                "success": True,
                "message": "Data and authentication cleared successfully",
            }
        except Exception as e:
            logger.error(f"Error clearing data: {e}")
            return {"success": False, "message": f"Failed to clear data: {e}"}


def detect_webview_backend() -> str:
    """Detect the best available WebView backend for the current platform."""
    system = platform.system().lower()

    if system == "windows":
        try:
            # Try to use Edge WebView2 if available (recommended for Windows)
            import webview.platforms.edgechromium  # noqa: F401

            return "edgechromium"
        except ImportError:
            # Fall back to MSHTML (Trident) which is built into Windows
            return "winforms"
    elif system == "darwin":  # macOS
        return "cocoa"
    elif system == "linux":
        # On Linux, prefer Qt if available, otherwise GTK
        try:
            import PyQt5  # noqa: F401

            return "qt"
        except ImportError:
            return "gtk"
    else:
        # Default to Qt if available
        try:
            import PyQt5  # noqa: F401

            return "qt"
        except ImportError:
            return "gtk"  # Fall back to GTK as a last resort


def create_gui() -> None:
    """Create and run the PyWebview GUI."""
    # Create the HTML file if it doesn't exist
    html_file = PACKAGE_DIR / "gui" / "index.html"
    html_file.parent.mkdir(parents=True, exist_ok=True)

    # Create basic HTML if it doesn't exist
    if not html_file.exists():
        html_file.write_text(
            """
<!DOCTYPE html>
<html>
<head>
    <title>Body Composition Tracker</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
        }
        .tab {
            overflow: hidden;
            border: 1px solid #ccc;
            background-color: #f1f1f1;
        }
        .tab button {
            background-color: inherit;
            float: left;
            border: none;
            outline: none;
            cursor: pointer;
            padding: 14px 16px;
        }
        .tab button:hover {
            background-color: #ddd;
        }
        .tab button.active {
            background-color: #4CAF50;
            color: white;
        }
        .tabcontent {
            display: none;
            padding: 20px;
            border: 1px solid #ccc;
            border-top: none;
        }
        button {
            margin: 5px;
            padding: 8px 15px;
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .status {
            margin: 10px 0;
            padding: 10px;
            border-radius: 4px;
        }
        .success {
            background-color: #dff0d8;
            color: #3c763d;
            border: 1px solid #d6e9c6;
        }
        .error {
            background-color: #f2dede;
            color: #a94442;
            border: 1px solid #ebccd1;
        }
        .auth-status {
            margin: 10px 0;
            padding: 10px;
            border-radius: 4px;
        }
        .authenticated {
            background-color: #dff0d8;
            color: #3c763d;
            border: 1px solid #d6e9c6;
        }
        .not-authenticated {
            background-color: #fcf8e3;
            color: #8a6d3b;
            border: 1px solid #faebcc;
        }
    </style>
</head>
<body>
    <h1>Body Composition Tracker</h1>

    <div class="tab">
        <button class="tablinks active"
                onclick="openTab(event, 'data-import')">Data Import</button>
        <button class="tablinks"
                onclick="openTab(event, 'raw-data')">Raw Data</button>
        <button class="tablinks"
                onclick="openTab(event, 'analysis')">Analysis</button>
    </div>

    <!-- Data Import Tab -->
    <div id="data-import" class="tabcontent" style="display: block;">
        <h2>Import Data</h2>
        <div>
            <label for="data-source">Data Source:</label>
            <select id="data-source">
                <option value="withings" selected>Withings API</option>
            </select>
        </div>

        <div id="withings-auth-section">
            <div>
                <button id="authenticate-btn"
                        onclick="authenticateWithings()">
                    Authenticate with Withings
                </button>
                <button id="import-btn" onclick="importData()" disabled>
                    Import Data
                </button>
                <button id="clear-btn" onclick="clearData()" disabled>
                    Clear Data
                </button>
            </div>
            <div id="auth-status" class="auth-status not-authenticated">
                Not authenticated yet.
            </div>
            <div id="import-status" class="status"></div>
    </div>

    <!-- Raw Data Tab -->
    <div id="raw-data" class="tabcontent">
        <h2>Raw Data</h2>
        <p>Raw measurement data will be displayed here.</p>
        <div id="raw-data-content"></div>
    </div>

    <!-- Analysis Tab -->
    <div id="analysis" class="tabcontent">
        <h2>Analysis</h2>
        <p>Data analysis and visualizations will be displayed here.</p>
        <div id="analysis-content"></div>
    </div>

    <script>
        function openTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tablinks = document.getElementsByClassName("tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className =
                    tablinks[i].className.replace(" active", "");
            }
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";
        }

        function showStatus(message, isError = false) {
            const statusDiv = document.getElementById('import-status');
            statusDiv.textContent = message;
            statusDiv.className = 'status ' +
                                  (isError ? 'error' : 'success');
            statusDiv.style.display = 'block';

            setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
        }

        async function authenticateWithings() {
            try {
                const response = await pywebview.api.authenticate();
                if (response.success) {
                    var authBtn =
                        document.getElementById('authenticate-btn');
                    authBtn.textContent = '✓ Authenticated';
                    authBtn.disabled = true;
                    document.getElementById('import-btn').disabled = false;
                    document.getElementById('clear-btn').disabled = false;
                    const authStatus =
                        document.getElementById('auth-status');
                    authStatus.textContent =
                        'Successfully authenticated with Withings!';
                    authStatus.className = 'auth-status authenticated';
                    showStatus('Authentication successful!');
                } else {
                    showStatus('Auth failed: ' + response.message, true);
                }
            } catch (error) {
                console.error('Auth Error:', error);
                showStatus('Auth Error: ' + error, true);
            }
        }

        async function importData() {
            try {
                const response = await pywebview.api.import_data();
                if (response.success) {
                    showStatus(response.message);
                    if (response.data && response.data.length > 0) {
                        updateRawDataTable(response.data);
                    }
                } else {
                    showStatus('Import failed: ' + response.message, true);
                }
            } catch (error) {
                console.error('Import Error:', error);
                showStatus('Import Error: ' + error, true);
            }
        }

        function updateRawDataTable(data) {
            const tableContent =
                document.getElementById('raw-data-content');
            let tableHTML = '<table><thead><tr><th>Date</th>' +
                            '<th>Weight (kg)</th><th>Fat (%)</th>' +
                            '</tr></thead><tbody>';
            data.forEach(item => {
                tableHTML += `<tr><td>${item.date}</td>` +
                             `<td>${item.weight_kg !== null ?
                                 item.weight_kg.toFixed(2) : 'N/A'}</td>` +
                             `<td>${item.fat_percent !== null ?
                                 item.fat_percent.toFixed(2) : 'N/A'}</td></tr>`;
            });
            tableHTML += '</tbody></table>';
            tableContent.innerHTML = tableHTML;
        }

        async function clearData() {
            if (confirm('Are you sure you want to clear all local data?')) {
                const response = await pywebview.api.clear_data();
                if (response.success) {
                    showStatus('Data cleared successfully.');
                    document.getElementById('raw-data-content')
                        .innerHTML = '';
                    const authBtn =
                        document.getElementById('authenticate-btn');
                    authBtn.textContent = 'Authenticate with Withings';
                    authBtn.disabled = false;
                    document.getElementById('import-btn').disabled = true;
                    document.getElementById('clear-btn').disabled = true;
                    const authStatus =
                        document.getElementById('auth-status');
                    authStatus.textContent =
                        'Not authenticated with Withings.';
                    authStatus.className =
                        'auth-status not-authenticated';
                } else {
                    showStatus('Clear data failed: ' + response.message, true);
                }
            }
        }
    </script>
</body>
</html>
"""
        )

    # Detect the best available backend
    backend = detect_webview_backend()
    logger.info(f"Using WebView backend: {backend}")

    # Create the API instance
    api = Api()

    # Create the webview window
    try:
        window = webview.create_window(
            "Body Composition Tracker",
            str(html_file),
            js_api=api,
            min_size=(900, 700),
            text_select=True,
        )

        # Store the API instance on the window for debugging
        window._api = api

        # Start the webview with the selected backend
        webview.start(debug=True, gui=backend)

    except Exception as e:
        logger.error(f"Failed to initialize WebView with backend {backend}: {e}")
        # Try with default backend as fallback
        if backend != "qt":  # Don't try Qt again if it already failed
            logger.info("Falling back to default WebView backend")
            webview.start(debug=True)
        else:
            raise


def main() -> None:
    """Entry point for the GUI application."""
    try:
        # Check if WebView is available
        import webview  # noqa: F401
    except ImportError:
        print("Error: pywebview is not installed. Please install it with:")
        print("  pip install pywebview")
        print(
            "\nFor better experience, you can also install platform-specific backends:"
        )
        system = platform.system().lower()
        if system == "windows":
            print("  pip install pywebview[winforms]  # For Windows native WebView")
            print("  # OR")
            print(
                "  pip install pywebview[edgechromium]"
                "  # For Edge WebView2 (recommended)"
            )
        elif system == "darwin":
            print("  pip install pywebview[cocoa]  # For macOS native WebView")
        elif system == "linux":
            print("  pip install pywebview[gtk]  # For GTK WebView")
            print("  # OR")
            print(
                "  pip install pywebview[qt]  # For Qt WebView (requires PyQt5/PySide2)"
            )
        sys.exit(1)

    # Create and run the GUI
    create_gui()


if __name__ == "__main__":
    main()

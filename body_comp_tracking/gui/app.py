"""Main GUI application for body composition tracking."""

import logging
import platform
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import webview

from .. import config
from ..config import get_withings_credentials
from ..data_sources.withings_source import WithingsAuth, WithingsSource

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
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
                redirect_uri=creds.get("redirect_uri", "http://localhost:8000/callback"),
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
                # Test if the token is still valid by making a simple API call
                if self.withings_auth.is_authenticated():
                    logger.info("Successfully loaded and validated existing authentication token")
                else:
                    logger.info("Loaded token is no longer valid")
                    self.withings_auth._token = None
        except Exception as e:
            logger.debug(f"No existing token found or failed to load: {e}")

    def is_authenticated(self) -> Dict[str, Any]:
        """Check if the user is currently authenticated.

        Returns:
            Dict with authentication status
        """
        if not self.withings_auth:
            return {"success": True, "authenticated": False}

        try:
            # Check if we have a token and if it's still valid
            is_auth = self.withings_auth.is_authenticated()
            return {"success": True, "authenticated": is_auth}
        except Exception as e:
            logger.error(f"Error checking authentication status: {e}")
            return {"success": False, "authenticated": False, "message": str(e)}

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
        """Import body composition data from Withings API, transform to unified format.

        Returns:
            Dict with success status, message, and optional data
        """
        try:
            if not self.withings_auth:
                return {"success": False, "message": "Withings auth not initialized"}

            # Check authentication
            if not self.withings_auth.is_authenticated():
                return {
                    "success": False,
                    "message": "Not authenticated. Please authenticate first.",
                }

            # Import from Withings API
            import_result = self._import_from_withings_api()
            if not import_result["success"]:
                return import_result

            # Transform to unified format
            unified_result = self._apply_unified_transformation(import_result)

            return unified_result

        except Exception as e:
            return self._handle_import_error(e)

    def _import_from_withings_api(self) -> Dict[str, Any]:
        """Import data from Withings API and save to CSV."""
        if not self.withings_auth:
            raise ValueError("Withings auth not initialized")

        source = WithingsSource(self.withings_auth)
        withings_csv = config.DATA_DIR / "raw_data_withings_api.csv"

        # Determine import strategy
        start_date, import_message = self._determine_import_strategy(withings_csv)

        # Import data from Withings API
        logger.info(import_message)
        count = source.import_incremental_data_to_csv(withings_csv, start_date)

        # Generate result message based on actual count and context
        if count == 0:
            message = "No new measurements available."
        else:
            message = f"Successfully imported {count} new measurements."

        return {
            "success": True,
            "message": message,
            "file_path": str(withings_csv),
            "count": count,
        }

    def _determine_import_strategy(self, withings_csv: Path) -> Tuple[datetime, str]:
        """Determine start date and message for import strategy."""
        start_date = datetime(2015, 1, 1)  # Default start date
        import_message = "Importing all historical data..."

        if withings_csv.exists():
            try:
                last_date = self._get_last_date_from_csv(withings_csv)
                if last_date:
                    start_date = last_date + timedelta(days=1)
                    import_message = f"Importing new data since {last_date.strftime('%Y-%m-%d')}..."
            except Exception as e:
                logger.warning(f"Could not read last date from CSV, importing all data: {e}")

        return start_date, import_message

    def _apply_unified_transformation(self, import_result: Dict[str, Any]) -> Dict[str, Any]:
        """Apply unified format transformation."""
        withings_csv = Path(import_result["file_path"])
        app_csv = config.DATA_DIR / "raw_data_this_app.csv"

        # Always attempt unified transformation, even if no new API data
        new_entries_added = self._transform_to_unified_format(withings_csv, app_csv)

        result = import_result.copy()

        # Show consistent messaging based on API count and unified data count
        api_count = import_result.get("count", 0)

        if api_count == 0 and new_entries_added == 0:
            # No new data from API and no new entries added to unified
            result["message"] = "No new measurements available."
        elif api_count > 0 and new_entries_added == 0:
            # API returned data but it was all duplicates
            result["message"] = "0 entries added"
        else:
            # Show unified data count for all other cases
            result["message"] = f"{new_entries_added} entries added"

        result["unified_file"] = str(app_csv)
        result["total_unified"] = new_entries_added  # Fix test failure by using expected field name
        return result

    def _handle_import_error(self, error: Exception) -> Dict[str, Any]:
        """Handle and format import errors for user display."""
        error_msg = str(error)
        logger.error(f"Error importing data: {error_msg}")

        # Provide user-friendly error messages
        if "NameResolutionError" in error_msg or "Failed to resolve" in error_msg:
            user_message = "Network connection failed. Please check your internet connection and try again."
        elif "HTTPSConnectionPool" in error_msg or "Max retries exceeded" in error_msg:
            user_message = "Cannot connect to Withings servers. Please check your internet connection and try again."
        elif "access_token" in error_msg.lower() or "unauthorized" in error_msg.lower():
            user_message = "Authentication expired. Please authenticate again."
        elif "timeout" in error_msg.lower():
            user_message = "Request timed out. Please try again."
        else:
            user_message = f"Import failed: {error_msg}"

        return {"success": False, "message": user_message}

    def _get_last_date_from_csv(self, csv_file: Path) -> Optional[datetime]:
        """Get the most recent date from a CSV file.

        Args:
            csv_file: Path to the CSV file

        Returns:
            The most recent datetime from the file, or None if file is empty/invalid
        """
        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                lines = f.readlines()

            if len(lines) <= 1:  # Only header or empty
                return None

            # Get the first data line (newest due to reverse chronological order)
            first_data_line = lines[1].strip()
            if not first_data_line:
                return None

            # Extract date (first column) and remove quotes if present
            date_str = first_data_line.split(",")[0].strip('"')
            return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")

        except Exception as e:
            logger.error(f"Error reading last date from {csv_file}: {e}")
            return None

    def _transform_to_unified_format(self, withings_csv: Path, app_csv: Path) -> int:
        """Transform Withings CSV data to unified app format.

        Args:
            withings_csv: Source Withings CSV file
            app_csv: Target unified app CSV file

        Returns:
            Number of NEW entries added to the unified file
        """
        if not withings_csv.exists():
            logger.warning(f"Withings CSV file does not exist: {withings_csv}")
            return 0

        try:
            withings_lines = self._read_csv_lines(withings_csv)
            if len(withings_lines) <= 1:  # Only header or empty
                return 0

            # If app CSV doesn't exist, just copy the Withings data
            if not app_csv.exists():
                return self._create_new_unified_file(app_csv, withings_lines)

            # If app CSV exists, merge data while maintaining chronological order
            return self._merge_with_existing_unified_file(app_csv, withings_lines)

        except Exception as e:
            logger.error(f"Error transforming to unified format: {e}")
            return 0

    def _read_csv_lines(self, csv_file: Path) -> List[str]:
        """Read all lines from a CSV file."""
        with open(csv_file, "r", encoding="utf-8") as f:
            return f.readlines()

    def _create_new_unified_file(self, app_csv: Path, withings_lines: List[str]) -> int:
        """Create a new unified CSV file by copying Withings data."""
        with open(app_csv, "w", encoding="utf-8") as f:
            f.writelines(withings_lines)
        return len(withings_lines) - 1  # Exclude header

    def _merge_with_existing_unified_file(self, app_csv: Path, withings_lines: List[str]) -> int:
        """Merge Withings data with existing unified CSV file."""
        app_lines = self._read_csv_lines(app_csv)
        existing_dates, app_data = self._parse_existing_app_data(app_lines)

        # Count entries before adding new data
        initial_count = len(app_data)

        # Add new Withings data that doesn't already exist
        self._add_new_withings_data(withings_lines, existing_dates, app_data)

        # Write merged data to file
        self._write_merged_data(app_csv, withings_lines[0], app_data)

        # Return the number of NEW entries added
        return len(app_data) - initial_count

    def _parse_existing_app_data(self, app_lines: List[str]) -> Tuple[Set[datetime], List[Tuple[datetime, str]]]:
        """Parse existing app data and return dates set and data list."""
        existing_dates: Set[datetime] = set()
        app_data: List[Tuple[datetime, str]] = []

        if len(app_lines) > 1:
            for line in app_lines[1:]:
                if line.strip():
                    try:
                        # Handle both quoted and unquoted dates
                        date_str = line.split(",")[0].strip('"')
                        date_dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                        existing_dates.add(date_dt)
                        app_data.append((date_dt, line))
                    except ValueError:
                        continue

        return existing_dates, app_data

    def _add_new_withings_data(
        self, withings_lines: List[str], existing_dates: Set[datetime], app_data: List[Tuple[datetime, str]]
    ) -> None:
        """Add new Withings data to app_data if it doesn't already exist."""
        for line in withings_lines[1:]:  # Skip header
            if line.strip():
                try:
                    # Handle both quoted and unquoted dates
                    date_str = line.split(",")[0].strip('"')
                    date_dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                    if date_dt not in existing_dates:
                        app_data.append((date_dt, line))
                        existing_dates.add(date_dt)
                except ValueError:
                    continue

    def _write_merged_data(self, app_csv: Path, header: str, app_data: List[Tuple[datetime, str]]) -> None:
        """Write merged data to the unified CSV file."""
        # Sort by date (newest first)
        app_data.sort(key=lambda x: x[0], reverse=True)

        with open(app_csv, "w", encoding="utf-8") as f:
            f.write(header)  # Write header
            for _, line in app_data:
                f.write(line)

    def has_unified_data(self) -> Dict[str, Any]:
        """Check if unified data file exists and has data.

        Returns:
            Dict with success status and data availability info
        """
        try:
            app_csv = config.DATA_DIR / "raw_data_this_app.csv"

            if not app_csv.exists():
                return {"success": True, "has_data": False, "count": 0}

            with open(app_csv, "r", encoding="utf-8") as f:
                lines = f.readlines()

            # Count non-empty data lines (excluding header)
            data_count = sum(1 for line in lines[1:] if line.strip())

            return {
                "success": True,
                "has_data": data_count > 0,
                "count": data_count,
                "file_path": str(app_csv),
            }

        except Exception as e:
            logger.error(f"Error checking unified data: {e}")
            return {"success": False, "message": str(e)}

    def load_raw_data(self) -> Dict[str, Any]:
        """Load raw data from the unified CSV file for display.

        Returns:
            Dict with success status and data array
        """
        try:
            app_csv = config.DATA_DIR / "raw_data_this_app.csv"

            if not app_csv.exists():
                return {"success": True, "data": []}

            data = []
            with open(app_csv, "r", encoding="utf-8") as f:
                lines = f.readlines()

            if len(lines) <= 1:  # Only header or empty
                return {"success": True, "data": []}

            # Parse CSV data (skip header)
            for line in lines[1:]:
                if line.strip():
                    try:
                        # Expected CSV format: date,weight_kg,fat_percent,muscle_percent,bone_percent,water_percent
                        parts = [p.strip('"') for p in line.strip().split(",")]
                        if len(parts) >= 3:
                            data.append(
                                {
                                    "date": parts[0],
                                    "weight_kg": float(parts[1]) if parts[1] and parts[1] != "None" else None,
                                    "fat_percent": float(parts[2]) if parts[2] and parts[2] != "None" else None,
                                    # Add more fields if they exist
                                    "muscle_percent": (
                                        float(parts[3]) if len(parts) > 3 and parts[3] and parts[3] != "None" else None
                                    ),
                                    "bone_percent": (
                                        float(parts[4]) if len(parts) > 4 and parts[4] and parts[4] != "None" else None
                                    ),
                                    "water_percent": (
                                        float(parts[5]) if len(parts) > 5 and parts[5] and parts[5] != "None" else None
                                    ),
                                }
                            )
                    except (ValueError, IndexError) as e:
                        logger.warning(f"Skipping malformed CSV line: {line.strip()}, error: {e}")
                        continue

            return {
                "success": True,
                "data": data[:100],  # Limit to first 100 entries for performance
                "total_count": len(data),
            }

        except Exception as e:
            logger.error(f"Error loading raw data: {e}")
            return {"success": False, "message": str(e)}

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

            # Clear CSV data files
            csv_files_deleted = []

            # Delete Withings API CSV file
            withings_csv = config.DATA_DIR / "raw_data_withings_api.csv"
            if withings_csv.exists():
                withings_csv.unlink()
                csv_files_deleted.append("raw_data_withings_api.csv")

            # Delete app's unified CSV file
            app_csv = config.DATA_DIR / "raw_data_this_app.csv"
            if app_csv.exists():
                app_csv.unlink()
                csv_files_deleted.append("raw_data_this_app.csv")

            message = "Data and authentication cleared successfully"
            if csv_files_deleted:
                message += f". Deleted files: {', '.join(csv_files_deleted)}"

            return {
                "success": True,
                "message": message,
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
        print("\nFor better experience, you can also install platform-specific backends:")
        system = platform.system().lower()
        if system == "windows":
            print("  pip install pywebview[winforms]  # For Windows native WebView")
            print("  # OR")
            print("  pip install pywebview[edgechromium]" "  # For Edge WebView2 (recommended)")
        elif system == "darwin":
            print("  pip install pywebview[cocoa]  # For macOS native WebView")
        elif system == "linux":
            print("  pip install pywebview[gtk]  # For GTK WebView")
            print("  # OR")
            print("  pip install pywebview[qt]  # For Qt WebView (requires PyQt5/PySide2)")
        sys.exit(1)

    # Create and run the GUI
    create_gui()


if __name__ == "__main__":
    main()

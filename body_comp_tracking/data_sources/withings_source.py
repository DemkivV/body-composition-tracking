"""Withings API data source implementation using OAuth 2.0 Device Flow."""

import http.server
import json
import logging
import math
import os
import socketserver
import time
import urllib.parse
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union, cast

import requests
from requests_oauthlib import OAuth2Session

from body_comp_tracking.models import BodyMeasurement, DataSource

from .. import config

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)


class TokenStorage:
    """Handles secure storage of OAuth tokens."""

    def __init__(self, token_file_name: str = "authentication_token_withings.json") -> None:
        """Initialize token storage.

        Args:
            token_file_name: The name of the token file (e.g.,
              'authentication_token_withings.json')
        """
        # Ensure the data directory from config exists
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.token_file: Path = config.DATA_DIR / token_file_name
        logger.info(f"Token storage will use file: {self.token_file}")

    def save_token(self, token: Dict[str, Any]) -> None:
        """Save token to secure storage.

        Args:
            token: The OAuth token to save
        """
        try:
            with open(self.token_file, "w") as f:
                json.dump(token, f, indent=2)
            # Set restrictive permissions
            os.chmod(self.token_file, 0o600)
        except IOError as e:
            logger.error("Failed to save token: %s", e)
            raise

    def load_token(self) -> Optional[Dict[str, Any]]:
        """Load token from storage if it exists.

        Returns:
            The loaded token dictionary, or None if no token exists or there was an
            error
        """
        if not os.path.exists(self.token_file):
            return None

        try:
            with open(self.token_file, "r") as f:
                token_data = json.load(f)
                if not isinstance(token_data, dict):
                    logger.error("Token file does not contain a valid token dictionary")
                    return None
                return token_data
        except (json.JSONDecodeError, IOError) as e:
            logger.error("Failed to load token: %s", e)
            return None

    def clear_token(self) -> None:
        """Remove stored token."""
        try:
            if os.path.exists(self.token_file):
                os.remove(self.token_file)
        except IOError as e:
            import logging

            logging.error(f"Failed to clear token: {e}")


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    """HTTP server to handle OAuth callback on localhost."""

    def __init__(
        self,
        request: Any,
        client_address: Tuple[str, int],
        server: socketserver.BaseServer,
        on_auth_code: Callable[[str], None],
    ) -> None:
        """Initialize the callback handler.

        Args:
            request: The HTTP request
            client_address: The client address
            server: The server
            on_auth_code: Callable to run when the authorization code is received
        """
        self.on_auth_code = on_auth_code
        super().__init__(request, client_address, server)

    def do_GET(self) -> None:
        """Handle GET request for OAuth callback."""
        # Extract the code from the callback URL
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            code = params["code"][0]
            self.on_auth_code(code)

            # Send success response
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h1>Authentication successful!</h1>"
                b"<p>You can close this window and return to the application.</p>"
                b"</body></html>"
            )
        else:
            # Send error response
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h1>Error: No code parameter found</h1>" b"<p>Please try again.</p></body></html>"
            )

    def log_message(self, format: str, *args: Any) -> None:
        """Disable logging to stderr."""
        return


class WithingsAuth:
    """Handles OAuth2 authentication with the Withings API using Device Flow."""

    # Withings API endpoints
    BASE_URL = "https://wbsapi.withings.net"
    AUTH_URL = "https://account.withings.com/oauth2_user/authorize2"
    TOKEN_URL = f"{BASE_URL}/v2/oauth2"  # Standard Withings token endpoint

    # Start with the most basic scope for testing
    # See: https://developer.withings.com/developer-guide/v3/
    #   integration-guide/connect-oauth/authorization
    SCOPES = ["user.metrics"]  # Required scope for measurement data access

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str = "http://localhost:8000/callback",
    ) -> None:
        """Initialize Withings authentication.

        Args:
            client_id: Your Withings client ID
            client_secret: Your Withings client secret
            redirect_uri: Redirect URI (default works for local development)
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.token_storage = TokenStorage()
        self._token: Optional[Dict[str, Any]] = None

    def _start_local_server(self, port: int = 8000) -> str:
        """Start a local server to handle the OAuth callback.

        Args:
            port: Port to listen on

        Returns:
            str: The authorization code

        Raises:
            TimeoutError: If no authorization code is received within the timeout
        """
        auth_code = None

        # Define the callback handler
        def handle_auth_code(code: str) -> None:
            nonlocal auth_code
            # Extract just the code part before any '&' or '#' characters
            clean_code = code.split("&")[0].split("#")[0]
            auth_code = clean_code
            logger.debug(f"Extracted clean auth code: {auth_code}")

        # Create a simple HTTP server that handles one request
        def handler_factory(*args: Any, **kwargs: Any) -> CallbackHandler:
            # Pass the handle_auth_code callback to the CallbackHandler constructor
            kwargs["on_auth_code"] = handle_auth_code
            return CallbackHandler(*args, **kwargs)

        with socketserver.TCPServer(("localhost", port), handler_factory) as httpd:
            print(f"Listening on port {port}...")  # noqa: T201
            print(
                "Please visit this URL to authorize the application" " (if your browser didn't open automatically):"
            )  # noqa: T201
            print(self.get_auth_url())  # noqa: T201
            httpd.handle_request()

            # Wait for the auth code or timeout
            timeout = 300  # 5 minutes
            start_time = time.time()
            while time.time() - start_time < timeout:
                if auth_code:
                    return auth_code
                time.sleep(1)

            raise TimeoutError("Timed out waiting for authorization code")

    def get_auth_url(self) -> str:
        """Get the authorization URL for OAuth 2.0 flow.

        Returns:
            str: The authorization URL
        """
        scope_string = " ".join(self.SCOPES)
        logger.debug(f"Requesting scopes: {scope_string}")
        logger.debug(f"Client ID: {self.client_id}")
        logger.debug(f"Redirect URI: {self.redirect_uri}")

        # Create OAuth2 session with debug logging
        oauth = OAuth2Session(client_id=self.client_id, redirect_uri=self.redirect_uri, scope=scope_string)

        # Generate the authorization URL
        auth_url, state = oauth.authorization_url(self.AUTH_URL, access_type="offline", prompt="consent")

        logger.debug(f"Generated auth URL: {auth_url}")
        logger.debug(f"OAuth state: {state}")
        return auth_url

    def _make_token_request(self, token_data: Dict[str, Any]) -> requests.Response:
        """Make a token request to the Withings API.

        Args:
            token_data: The token request data

        Returns:
            The API response
        """
        # Log the request data (without sensitive info)
        log_data = token_data.copy()
        if "client_secret" in log_data:
            log_data["client_secret"] = "***"
        if "code" in log_data:
            log_data["code"] = "***"
        logger.debug(f"Token request data: {log_data}")

        # Make the token request with the correct headers
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "body-composition-tracking/1.0",
        }

        logger.debug(f"Making token request to: {self.TOKEN_URL}")
        try:
            response = requests.post(
                self.TOKEN_URL,
                data=token_data,
                headers=headers,
                timeout=30,  # 30 seconds timeout
            )
            logger.debug(f"Request completed in {response.elapsed.total_seconds():.2f} seconds")
            return response
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise

    def _extract_token_info(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract token information from the API response.

        Args:
            response_data: The parsed JSON response from the API

        Returns:
            Dict containing the token information

        Raises:
            Exception: If there's an error in the response or the token is invalid
        """
        # Check if the response has a 'body' field (Withings format)
        if "body" in response_data and isinstance(response_data["body"], dict):
            token_info = response_data["body"]
            logger.debug(f"Extracted token info from 'body': {token_info}")
        else:
            token_info = response_data

        # Check for error in response
        if "error" in token_info:
            error_msg = f"Withings API error: {token_info.get('error', 'Unknown error')}"
            if "error_description" in token_info:
                error_msg += f" - {token_info['error_description']}"
            logger.error(error_msg)
            raise Exception(error_msg)

        # Check if we got the expected access token
        if "access_token" not in token_info:
            error_msg = f"No access token in response: {token_info}"
            logger.error(error_msg)
            raise Exception(error_msg)

        return token_info

    def _exchange_auth_code(self, auth_code: str) -> Dict[str, Any]:
        """Exchange authorization code for an access token.

        Args:
            auth_code: The authorization code

        Returns:
            Dict containing the token information
        """
        token_data = {
            "action": "requesttoken",
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": auth_code,
            "redirect_uri": self.redirect_uri,
        }

        # Make the token request
        response = self._make_token_request(token_data)

        # Log response details
        logger.debug(f"Token response status: {response.status_code}")
        logger.debug(f"Token response headers: {response.headers}")
        logger.debug(f"Token response text: {response.text}")

        try:
            response_data = response.json()
            logger.debug(f"Raw token response: {response_data}")
            return self._extract_token_info(response_data)
        except json.JSONDecodeError as e:
            error_msg = f"Failed to parse token response: {e}"
            logger.error(f"{error_msg}. Response: {response.text}")
            raise Exception(error_msg) from e

    def authenticate(self) -> Dict[str, Any]:
        """Perform the OAuth 2.0 Device Flow authentication.

        Returns:
            Dict containing the token information

        Raises:
            Exception: If authentication fails
        """
        # Try to load existing token first
        self._token = self.token_storage.load_token()
        if self._token:
            try:
                refreshed_token = self.refresh_token()
                logger.info("Successfully refreshed Withings API token.")
                return refreshed_token
            except Exception as e:
                logger.warning(f"Failed to refresh token: {e}")
                # If refresh fails, clear the token and re-authenticate
                self.token_storage.clear_token()

        # Get and display the authorization URL
        auth_url = self.get_auth_url()
        print("Please open this URL in your browser to authorize the" f" application:\n\n{auth_url}\n")
        webbrowser.open(auth_url)

        try:
            # Start a local server to handle the callback
            auth_code = self._start_local_server()
            logger.debug(f"Received authorization code: {auth_code}")

            # Exchange the authorization code for a token
            self._token = self._exchange_auth_code(auth_code)

            # Add expires_at timestamp if it's not present
            if "expires_at" not in self._token and "expires_in" in self._token:
                self._token["expires_at"] = time.time() + self._token["expires_in"]

            self.token_storage.save_token(self._token)
            logger.info("Successfully authenticated with Withings API")
            return self._token

        except Exception as e:
            logger.error(f"Authentication failed: {e}", exc_info=True)
            raise

    def refresh_token(self) -> Dict[str, Any]:
        """Refresh the access token using the refresh token."""
        if not self._token or "refresh_token" not in self._token:
            raise ValueError("No refresh token available")

        oauth = OAuth2Session(client_id=self.client_id, token=self._token)

        try:
            # Mypy indicated the None check was unreachable, implying refresh_token
            #   returns Dict, not Optional.
            # The unused type: ignore was on the refresh_token line, which is now clean.
            self._token = oauth.refresh_token(
                self.TOKEN_URL,
                client_id=self.client_id,
                client_secret=self.client_secret,
                refresh_token=self._token["refresh_token"],
            )

            # Add expires_at timestamp if it's not present
            if "expires_at" not in self._token and "expires_in" in self._token:
                self._token["expires_at"] = time.time() + self._token["expires_in"]

            self.token_storage.save_token(self._token)
            return self._token
        except Exception as e:
            print(f"Failed to refresh token: {e}")
            self.token_storage.clear_token()
            raise

    def get_token(self) -> Dict[str, Any]:
        """Get current access token, refreshing if necessary.

        Returns:
            Dict containing token information

        Raises:
            ValueError: If no token is available or refresh fails
        """
        if not self._token:
            logger.debug("No token available, checking storage...")
            stored_token = self.token_storage.load_token()
            if stored_token:
                logger.debug("Found stored token, attempting to use it")
                self._token = stored_token
            else:
                raise ValueError("No authentication token available")

        # Check if token is expired and refresh if needed
        if self._is_token_expired():
            logger.debug("Token expired, attempting refresh")
            try:
                self._token = self.refresh_token()
                logger.debug("Token refreshed successfully")
            except Exception as e:
                logger.error(f"Failed to refresh token: {e}")
                self._token = None
                raise ValueError("Token expired and refresh failed") from e

        return self._token

    def _is_token_expired(self) -> bool:
        """Check if the current token is expired or about to expire.

        Returns:
            True if token is expired or will expire within 60 seconds
        """
        if not self._token:
            return True

        expires_at = self._token.get("expires_at", float("inf"))
        if expires_at == float("inf"):
            return False  # Token doesn't have expiry info, assume valid

        return time.time() > (float(expires_at) - 60)  # Expired or expires within 60 seconds

    def is_authenticated(self) -> bool:
        """Check if user is currently authenticated with valid token.

        Returns:
            True if authenticated with valid token, False otherwise
        """
        try:
            self.get_token()
            return True
        except ValueError:
            return False


class WithingsSource(DataSource):
    """Data source for Withings API."""

    BASE_URL = "https://wbsapi.withings.net/measure"

    def __init__(self, auth: WithingsAuth) -> None:
        """Initialize the Withings data source.

        Args:
            auth: Authenticated WithingsAuth instance
        """
        self.auth = auth
        self._session: Optional[OAuth2Session] = None

    @property
    def session(self) -> OAuth2Session:
        """Get an authenticated session, refreshing the token if needed."""
        if self._session is None:
            # Get a valid token (will refresh if needed)
            token = self.auth.get_token()
            if token is None:
                raise ValueError("Failed to get authentication token")
            self._session = OAuth2Session(client_id=self.auth.client_id, token=token)
        return self._session

    def _make_request(self, action: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make an authenticated request to the Withings API.

        Args:
            action: API action to perform
            params: Additional parameters for the request

        Returns:
            JSON response from the API

        Raises:
            requests.HTTPError: If the API request fails
            ValueError: If the response is not valid JSON
        """
        if params is None:
            params = {}

        # Get a valid token (will refresh if needed)
        token_data = self.auth.get_token()
        if not isinstance(token_data, dict) or "access_token" not in token_data:
            raise ValueError("Invalid token data")

        access_token = token_data["access_token"]

        # Add the action to the parameters
        request_params = params.copy()
        request_params["action"] = action

        # Make the request using form data in the body
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        response = requests.post(
            self.BASE_URL,
            data=request_params,  # Send as form data, not query parameters
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()

        try:
            return cast(Dict[str, Any], response.json())
        except ValueError as e:
            raise ValueError(f"Invalid JSON response: {e}") from e

    def get_measurements(self, start_date: datetime, end_date: datetime) -> List[BodyMeasurement]:
        """Get body composition measurements from Withings.

        Args:
            start_date: Start date for the measurement range
            end_date: End date for the measurement range

        Returns:
            List of BodyMeasurement objects

        Raises:
            requests.HTTPError: If the API request fails
        """
        # Convert datetimes to timestamps (seconds since epoch)
        start_timestamp = int(start_date.timestamp())
        end_timestamp = int(end_date.timestamp())

        # Make the API request
        response = self._make_request(
            "getmeas",
            {
                "startdate": start_timestamp,
                "enddate": end_timestamp,
                # Weight, fat mass, fat free mass, bone mass, water mass
                "meastypes": "1,8,5,88,77",
                "category": 1,  # Real measurements only (not user-entered)
                "lastupdate": start_timestamp,
            },
        )

        # Process and return measurements
        measurements = []
        for measure_group in response.get("body", {}).get("measuregrps", []):
            timestamp = datetime.fromtimestamp(measure_group["date"])
            measures = {m["type"]: m["value"] * (10 ** m["unit"]) for m in measure_group["measures"]}

            measurement = BodyMeasurement(
                timestamp=timestamp,
                weight_kg=measures.get(1),  # Weight in kg
                body_fat_percent=measures.get(8),  # Fat mass in kg (not percentage!)
                source="withings",
            )
            measurements.append(measurement)

        return measurements

    @staticmethod
    def _format_measurement_row(
        timestamp: datetime,
        measurement_data: Dict[str, float],
    ) -> Dict[str, str]:
        """Format a measurement row for CSV.

        Args:
            timestamp: The timestamp of the measurement
            measurement_data: The measurement data
        """
        row = {
            "Date": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "Weight (kg)": WithingsSource._get_formatted_metric(measurement_data, "weight_kg"),
            "Fat mass (kg)": WithingsSource._get_formatted_metric(measurement_data, "fat_mass_kg"),
            "Bone mass (kg)": WithingsSource._get_formatted_metric(measurement_data, "bone_mass_kg"),
            "Muscle mass (kg)": WithingsSource._get_formatted_metric(measurement_data, "muscle_mass_kg"),
            "Hydration (kg)": WithingsSource._get_formatted_metric(measurement_data, "hydration_kg"),
            "Comments": "",
        }
        return row

    @staticmethod
    def _get_formatted_metric(data_dict: Dict[str, float], key_name: str) -> str:
        """Safely retrieves metric from data_dict by key_name.

        Returns:
            Empty string if value is not present, None, an empty string, or cannot be
            converted to float.
        """
        value = data_dict.get(key_name)

        if value is None:
            return ""

        if math.isnan(value) or math.isinf(value):
            # Return an empty string or another placeholder for NaN/Infinity values.
            return ""

        try:
            return f"{float(value):.2f}"
        except (ValueError, TypeError):
            return ""

    def import_all_data_to_csv(self, csv_file_path: Path) -> int:
        """Import all available data from Withings and save to CSV file.

        Args:
            csv_file_path: Path where to save the CSV file

        Returns:
            Number of measurements imported

        Raises:
            requests.HTTPError: If the API request fails
        """
        # Get measurements from a wide date range (10 years back)
        end_date = datetime.now()
        start_date = datetime(2015, 1, 1)  # Withings API data typically starts around 2015

        logger.info(f"Importing all data from {start_date.date()} to {end_date.date()}")

        # Make the API request for all measurement types
        response = self._make_request(
            "getmeas",
            {
                "startdate": int(start_date.timestamp()),
                "enddate": int(end_date.timestamp()),
                # Weight, fat mass, fat free mass, bone mass, water mass
                "meastypes": "1,8,5,88,77",
                "category": 1,  # Real measurements only (not user-entered)
            },
        )

        # Process measurements and group by timestamp
        measurements_by_timestamp = self._process_api_measurements(response)

        # Apply muscle mass correction
        self._apply_muscle_mass_correction(measurements_by_timestamp)

        # Write data to CSV file
        self._write_all_data_to_csv(csv_file_path, measurements_by_timestamp)

        logger.info(f"Successfully imported {len(measurements_by_timestamp)}" f" measurements to {csv_file_path}")
        return len(measurements_by_timestamp)

    def _process_api_measurements(self, response: Dict[str, Any]) -> Dict[datetime, Dict[str, float]]:
        """Process API response and group measurements by timestamp."""
        measurements_by_timestamp: Dict[datetime, Dict[str, float]] = {}

        for measure_group in response.get("body", {}).get("measuregrps", []):
            timestamp = datetime.fromtimestamp(measure_group["date"])

            # Initialize measurement dict if not exists
            if timestamp not in measurements_by_timestamp:
                measurements_by_timestamp[timestamp] = {}

            # Process each measurement in the group
            for measure in measure_group["measures"]:
                value = measure["value"] * (10 ** measure["unit"])
                measure_type = measure["type"]

                # Map measurement types according to Withings API docs
                self._map_measurement_type(measurements_by_timestamp[timestamp], measure_type, value)

        return measurements_by_timestamp

    def _map_measurement_type(self, data: Dict[str, float], measure_type: int, value: float) -> None:
        """Map Withings measurement type to our data structure."""
        # Updated mapping based on official API documentation
        if measure_type == 1:  # Weight in kg
            data["weight_kg"] = value
        elif measure_type == 8:  # Fat mass in kg
            data["fat_mass_kg"] = value
        elif measure_type == 88:  # Bone mass in kg
            data["bone_mass_kg"] = value
        elif measure_type == 5:  # Fat free mass (muscle mass) in kg
            data["muscle_mass_kg"] = value
        elif measure_type == 77:  # Water mass (hydration) in kg
            data["hydration_kg"] = value

    def _apply_muscle_mass_correction(self, measurements: Dict[datetime, Dict[str, float]]) -> None:
        """Apply muscle mass correction by subtracting bone mass from fat-free mass."""
        for measurement_data in measurements.values():
            # Calculate correct muscle mass by subtracting bone mass from fat-free mass
            fat_free_mass = measurement_data.get("muscle_mass_kg", 0)  # This is actually fat-free mass
            bone_mass_val = measurement_data.get("bone_mass_kg", 0)

            # Only calculate muscle mass if we have fat-free mass data
            if fat_free_mass > 0:
                actual_muscle_mass = fat_free_mass - bone_mass_val if bone_mass_val > 0 else fat_free_mass
                measurement_data["muscle_mass_kg"] = actual_muscle_mass
            else:
                # No fat-free mass data available
                measurement_data.pop("muscle_mass_kg", None)

    def _write_all_data_to_csv(self, csv_file_path: Path, measurements: Dict[datetime, Dict[str, float]]) -> None:
        """Write all measurements to CSV file."""
        # Ensure the directory exists
        csv_file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write to CSV file
        with open(csv_file_path, "w", newline="", encoding="utf-8") as csvfile:
            # Write header manually to match exact Withings format
            csvfile.write(
                'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
            )

            # Sort by timestamp in reverse chronological order (newest first)
            for timestamp in sorted(measurements.keys(), reverse=True):
                measurement_data = measurements[timestamp]

                # Format date with quotes
                date_str = f'"{timestamp.strftime("%Y-%m-%d %H:%M:%S")}"'

                # Format each measurement value
                weight = WithingsSource._get_formatted_metric(measurement_data, "weight_kg")
                fat_mass = WithingsSource._get_formatted_metric(measurement_data, "fat_mass_kg")
                bone_mass = WithingsSource._get_formatted_metric(measurement_data, "bone_mass_kg")
                muscle_mass = WithingsSource._get_formatted_metric(measurement_data, "muscle_mass_kg")
                hydration = WithingsSource._get_formatted_metric(measurement_data, "hydration_kg")

                # Write row in correct format
                csvfile.write(f"{date_str},{weight},{fat_mass},{bone_mass},{muscle_mass},{hydration},\n")

    def import_incremental_data_to_csv(self, csv_file_path: Path, start_date: datetime) -> int:
        """Import data from API starting from specific date and update CSV file.

        Args:
            csv_file_path: Path where to save the CSV file
            start_date: Start date for importing new data

        Returns:
            Number of new measurements imported

        Raises:
            requests.HTTPError: If the API request fails
        """
        end_date = datetime.now()

        logger.info(f"Importing incremental data from {start_date.date()} " f"to {end_date.date()}")

        # Get new measurements from API
        new_measurements = self._fetch_measurements_from_api(start_date, end_date)

        if not new_measurements:
            logger.info("No new measurements found")
            return 0

        # Load existing data and merge with new data
        all_measurements = self._merge_with_existing_data(csv_file_path, new_measurements)

        # Write updated data to CSV
        self._write_measurements_to_csv(csv_file_path, all_measurements)

        new_count = len(new_measurements)
        logger.info(
            f"Successfully imported {new_count} new measurements "
            f"(total: {len(all_measurements)}) to {csv_file_path}"
        )
        return new_count

    def _fetch_measurements_from_api(
        self, start_date: datetime, end_date: datetime
    ) -> Dict[datetime, Dict[str, float]]:
        """Fetch measurements from Withings API."""
        response = self._make_request(
            "getmeas",
            {
                "startdate": int(start_date.timestamp()),
                "enddate": int(end_date.timestamp()),
                "meastypes": "1,8,5,88,77",  # Weight, fat mass, fat free mass, bone mass, water mass
                "category": 1,  # Real measurements only
            },
        )

        # Process measurements using the same logic as import_all_data_to_csv
        measurements = self._process_api_measurements_for_incremental(response)

        # Apply muscle mass correction
        self._apply_muscle_mass_correction_for_incremental(measurements)

        return measurements

    def _process_api_measurements_for_incremental(self, response: Dict[str, Any]) -> Dict[datetime, Dict[str, float]]:
        """Process API response for incremental import (uses fat_free_mass_kg key initially)."""
        measurements: Dict[datetime, Dict[str, float]] = {}

        for measure_group in response.get("body", {}).get("measuregrps", []):
            timestamp = datetime.fromtimestamp(measure_group["date"])
            if timestamp not in measurements:
                measurements[timestamp] = {}

            for measure in measure_group["measures"]:
                value = measure["value"] * (10 ** measure["unit"])
                measure_type = measure["type"]

                # Map measurement types to CSV columns (use fat_free_mass_kg for type 5)
                self._map_measurement_type_for_incremental(measurements[timestamp], measure_type, value)

        return measurements

    def _map_measurement_type_for_incremental(self, data: Dict[str, float], measure_type: int, value: float) -> None:
        """Map measurement types for incremental import (keeps fat_free_mass separate initially)."""
        if measure_type == 1:  # Weight in kg
            data["weight_kg"] = value
        elif measure_type == 8:  # Fat mass in kg
            data["fat_mass_kg"] = value
        elif measure_type == 88:  # Bone mass in kg
            data["bone_mass_kg"] = value
        elif measure_type == 5:  # Fat free mass (will be corrected to muscle mass)
            data["fat_free_mass_kg"] = value
        elif measure_type == 77:  # Water mass (hydration) in kg
            data["hydration_kg"] = value

    def _apply_muscle_mass_correction_for_incremental(self, measurements: Dict[datetime, Dict[str, float]]) -> None:
        """Apply muscle mass correction for incremental import."""
        # Calculate correct muscle mass by subtracting bone mass from fat-free mass
        for timestamp, data in measurements.items():
            fat_free_mass = data.get("fat_free_mass_kg", 0)
            bone_mass_val = data.get("bone_mass_kg", 0)

            # Only calculate muscle mass if we have fat-free mass data
            if fat_free_mass > 0:
                actual_muscle_mass = fat_free_mass - bone_mass_val if bone_mass_val > 0 else fat_free_mass
                data["muscle_mass_kg"] = actual_muscle_mass
            else:
                # No fat-free mass data available - don't add muscle_mass_kg key
                pass

            # Remove the fat_free_mass_kg as we don't need it in the final output
            data.pop("fat_free_mass_kg", None)

    def _merge_with_existing_data(
        self, csv_file_path: Path, new_measurements: Dict[datetime, Dict[str, float]]
    ) -> Dict[datetime, Dict[str, Union[float, None]]]:
        """Merge new measurements with existing CSV data."""
        existing_timestamps: Set[datetime] = set()
        all_measurements: Dict[datetime, Dict[str, Union[float, None]]] = {}

        # Load existing data if file exists
        if csv_file_path.exists():
            existing_timestamps, existing_data = self._load_existing_csv_data(csv_file_path)
            all_measurements.update(existing_data)

        # Add new measurements that don't already exist
        for timestamp, data in new_measurements.items():
            if timestamp not in existing_timestamps:
                # Convert to Union[float, None] format
                measurement_data: Dict[str, Union[float, None]] = {key: value for key, value in data.items()}
                all_measurements[timestamp] = measurement_data

        return all_measurements

    def _load_existing_csv_data(
        self, csv_file_path: Path
    ) -> Tuple[Set[datetime], Dict[datetime, Dict[str, Union[float, None]]]]:
        """Load existing CSV data and return timestamps and measurements."""
        existing_timestamps: Set[datetime] = set()
        existing_data: Dict[datetime, Dict[str, Union[float, None]]] = {}

        try:
            with open(csv_file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

            if len(lines) <= 1:  # Only header or empty
                return existing_timestamps, existing_data

            for line in lines[1:]:
                if line.strip():
                    try:
                        date_str = line.split(",")[0]
                        # Remove quotes if present
                        date_str = date_str.strip('"')
                        timestamp = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                        existing_timestamps.add(timestamp)

                        # Parse measurement values
                        parts = line.strip().split(",")
                        if len(parts) >= 6:
                            existing_data[timestamp] = {
                                "weight_kg": float(parts[1]) if parts[1] else None,
                                "fat_mass_kg": (float(parts[2]) if parts[2] else None),
                                "bone_mass_kg": (float(parts[3]) if parts[3] else None),
                                "muscle_mass_kg": (float(parts[4]) if parts[4] else None),
                                "hydration_kg": (float(parts[5]) if parts[5] else None),
                            }
                    except (ValueError, IndexError):
                        continue

        except Exception as e:
            logger.warning(f"Could not read existing CSV file: {e}")

        return existing_timestamps, existing_data

    def _write_measurements_to_csv(
        self,
        csv_file_path: Path,
        measurements: Dict[datetime, Dict[str, Union[float, None]]],
    ) -> None:
        """Write measurements to CSV file."""
        # Ensure the directory exists
        csv_file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(csv_file_path, "w", newline="", encoding="utf-8") as csvfile:
            # Write header manually to match exact Withings format
            csvfile.write(
                'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)",' '"Muscle mass (kg)","Hydration (kg)",Comments\n'
            )

            # Sort by timestamp in reverse chronological order (newest first)
            for timestamp in sorted(measurements.keys(), reverse=True):
                measurement_data = measurements[timestamp]

                # Format date with quotes
                date_str = f'"{timestamp.strftime("%Y-%m-%d %H:%M:%S")}"'

                # Format each measurement value (handle Union[float, None])
                weight = self._format_optional_metric(measurement_data, "weight_kg")
                fat_mass = self._format_optional_metric(measurement_data, "fat_mass_kg")
                bone_mass = self._format_optional_metric(measurement_data, "bone_mass_kg")
                muscle_mass = self._format_optional_metric(measurement_data, "muscle_mass_kg")
                hydration = self._format_optional_metric(measurement_data, "hydration_kg")

                # Write row in correct format
                csvfile.write(f"{date_str},{weight},{fat_mass},{bone_mass}," f"{muscle_mass},{hydration},\n")

    @staticmethod
    def _format_optional_metric(data_dict: Dict[str, Union[float, None]], key_name: str) -> str:
        """Format metric value that can be None."""
        value = data_dict.get(key_name)

        if value is None:
            return ""

        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return ""

        try:
            return f"{float(value):.2f}"
        except (ValueError, TypeError):
            return ""

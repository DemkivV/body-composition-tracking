"""Withings API data source implementation using OAuth 2.0 Device Flow."""

import http.server
import json
import logging
import os
import socketserver
import time
import urllib.parse
import webbrowser
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple, cast

import requests
from requests_oauthlib import OAuth2Session

from ..models import BodyMeasurement, DataSource

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

    def __init__(self, config_dir: Optional[str] = None) -> None:
        """Initialize token storage.

        Args:
            config_dir: Optional directory to store tokens. If None, uses the default
                config directory.
        """
        from ..config import get_token_storage_dir

        if config_dir is None:
            config_dir = get_token_storage_dir()

        self.token_file = os.path.join(config_dir, "withings_token.json")
        os.makedirs(os.path.dirname(self.token_file), exist_ok=True)

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
                b"<html><body><h1>Error: No code parameter found</h1>"
                b"<p>Please try again.</p></body></html>"
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
    SCOPES = ["user.info"]  # Basic scope for authentication

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
            print("Please visit this URL to authorize the application:")  # noqa: T201
            print(self.get_auth_url())  # noqa: T201
            webbrowser.open(self.get_auth_url())
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
        oauth = OAuth2Session(
            client_id=self.client_id, redirect_uri=self.redirect_uri, scope=scope_string
        )

        # Generate the authorization URL
        auth_url, state = oauth.authorization_url(
            self.AUTH_URL, access_type="offline", prompt="consent"
        )

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
            logger.debug(
                f"Request completed in {response.elapsed.total_seconds():.2f} seconds"
            )
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
            error_msg = (
                f"Withings API error: {token_info.get('error', 'Unknown error')}"
            )
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
                self.refresh_token()
                return self._token
            except Exception as e:
                logger.warning(f"Failed to refresh token: {e}")
                # If refresh fails, clear the token and re-authenticate
                self.token_storage.clear_token()

        # Get and display the authorization URL
        auth_url = self.get_auth_url()
        print(
            "Please open this URL in your browser to authorize the"
            f" application:\n\n{auth_url}\n"
        )
        webbrowser.open(auth_url)

        try:
            # Start a local server to handle the callback
            auth_code = self._start_local_server()
            logger.debug(f"Received authorization code: {auth_code}")

            # Exchange the authorization code for a token
            self._token = self._exchange_auth_code(auth_code)
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
            self.token_storage.save_token(self._token)
            return self._token
        except Exception as e:
            print(f"Failed to refresh token: {e}")
            self.token_storage.clear_token()
            raise

    def get_token(self) -> Dict[str, Any]:
        """Get a valid token, refreshing if necessary.

        Returns:
            Dict containing the token information

        Raises:
            ValueError: If not authenticated and unable to authenticate
        """
        if not self._token:
            self._token = self.token_storage.load_token()

        if not self._token:
            self.authenticate()
            if not self._token:
                raise ValueError("Authentication failed")
            return self._token

        # Check if token is expired or about to expire (within 60 seconds)
        if time.time() > (self._token.get("expires_at", 0) - 60):
            try:
                self.refresh_token()
            except Exception as e:
                logger.warning("Token refresh failed: %s", e)
                self.authenticate()

        if not self._token:
            raise ValueError("Authentication failed after refresh attempt")

        return self._token


class WithingsSource(DataSource):
    """Data source for Withings API."""

    BASE_URL = "https://wbsapi.withings.com/v2/measure"

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

    def _make_request(
        self, action: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
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

        # Make the request
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(
            self.BASE_URL,
            params=request_params,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()

        try:
            return cast(Dict[str, Any], response.json())
        except ValueError as e:
            raise ValueError(f"Invalid JSON response: {e}") from e

    def get_measurements(
        self, start_date: datetime, end_date: datetime
    ) -> List[BodyMeasurement]:
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
                "meastypes": [1, 6, 5, 8, 11],  # Weight, fat, muscle, hydration, bone
                "category": 1,  # Real measurements only (not user-entered)
                "lastupdate": start_timestamp,
            },
        )

        # Process and return measurements
        measurements = []
        for measure_group in response.get("body", {}).get("measuregrps", []):
            timestamp = datetime.fromtimestamp(measure_group["date"])
            measures = {
                m["type"]: m["value"] * (10 ** m["unit"])
                for m in measure_group["measures"]
            }

            measurement = BodyMeasurement(
                timestamp=timestamp,
                weight_kg=measures.get(1),  # Weight in kg
                body_fat_percent=measures.get(6),  # Fat ratio in %
                muscle_mass_kg=measures.get(5),  # Muscle mass in kg
                hydration_percent=measures.get(8),  # Hydration in %
                bone_mass_kg=measures.get(11),  # Bone mass in kg
                source="withings",
            )
            measurements.append(measurement)

        return measurements

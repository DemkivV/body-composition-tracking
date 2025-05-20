"""
Withings API data source implementation using OAuth 2.0 Device Flow.
"""
import os
import json
import time
import webbrowser
import http.server
import socketserver
import urllib.parse
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple, Callable

import requests
from requests_oauthlib import OAuth2Session
from oauthlib.oauth2 import BackendApplicationClient, TokenExpiredError

from ..models import BodyMeasurement, DataSource


class TokenStorage:
    """Handles secure storage of OAuth tokens."""
    
    def __init__(self, config_dir: str = None):
        """Initialize token storage.
        
        Args:
            config_dir: Optional directory to store tokens. If None, uses the default config directory.
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
            with open(self.token_file, 'w') as f:
                json.dump(token, f, indent=2)
            # Set restrictive permissions
            os.chmod(self.token_file, 0o600)
        except IOError as e:
            import logging
            logging.error(f"Failed to save token: {e}")
            raise
    
    def load_token(self) -> Optional[Dict[str, Any]]:
        """Load token from storage if it exists.
        
        Returns:
            The loaded token dictionary, or None if no token exists or there was an error
        """
        if not os.path.exists(self.token_file):
            return None
        
        try:
            with open(self.token_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            import logging
            logging.error(f"Failed to load token: {e}")
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
    
    def __init__(self, request, client_address, server, on_auth_code: Callable[[str], None]):
        self.on_auth_code = on_auth_code
        super().__init__(request, client_address, server)
    
    def do_GET(self):
        """Handle GET request for OAuth callback."""
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        
        if 'code' in params:
            self.on_auth_code(params['code'][0])
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<html><body><h1>Authentication successful!</h1><p>You can close this window now.</p></body></html>')
        else:
            self.send_error(400, 'Missing authorization code')
        
        # Shutdown the server after handling the request
        self.server.shutdown()
    
    def log_message(self, format, *args):
        """Disable logging to stderr."""
        return


class WithingsAuth:
    """Handles OAuth2 authentication with the Withings API using Device Flow."""
    
    BASE_URL = "https://wbsapi.withings.com"
    AUTH_URL = "https://account.withings.com/oauth2_user/authorize2"
    TOKEN_URL = f"{BASE_URL}/v2/oauth2"
    
    # Scopes needed for body metrics
    SCOPES = [
        "user.metrics",
        "user.info.read"
    ]
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str = "http://localhost:8000/callback"):
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
        self._token = None
    
    def _start_local_server(self, port: int = 8000) -> Tuple[str, int]:
        """Start a local server to handle the OAuth callback."""
        auth_code = None
        
        def handle_auth_code(code: str):
            nonlocal auth_code
            auth_code = code
        
        # Create a custom handler with our callback
        handler = lambda *args: CallbackHandler(*args, on_auth_code=handle_auth_code)
        
        with socketserver.TCPServer(("localhost", port), handler) as httpd:
            # Get the actual port (in case port 0 was used to get a free port)
            _, port = httpd.server_address
            
            # Start the server in a background thread
            import threading
            server_thread = threading.Thread(target=httpd.serve_forever)
            server_thread.daemon = True
            server_thread.start()
            
            # Wait for the auth code or timeout
            timeout = 300  # 5 minutes
            start_time = time.time()
            
            while not auth_code and (time.time() - start_time) < timeout:
                time.sleep(0.1)
            
            # Shutdown the server
            httpd.shutdown()
            server_thread.join()
            
            if not auth_code:
                raise TimeoutError("Timed out waiting for authorization")
            
            return auth_code
    
    def authenticate(self) -> Dict[str, Any]:
        """Perform the OAuth 2.0 Device Flow authentication."""
        # Try to load existing token first
        self._token = self.token_storage.load_token()
        if self._token:
            try:
                self.refresh_token()
                return self._token
            except Exception:
                # If refresh fails, clear the token and re-authenticate
                self.token_storage.clear_token()
        
        # Step 1: Get the authorization URL
        oauth = OAuth2Session(
            client_id=self.client_id,
            redirect_uri=self.redirect_uri,
            scope=self.SCOPES
        )
        
        auth_url, _ = oauth.authorization_url(self.AUTH_URL)
        
        # Step 2: Open the browser for the user to authorize
        print(f"Please open this URL in your browser to authorize the application:\n\n{auth_url}\n")
        webbrowser.open(auth_url)
        
        # Step 3: Start a local server to handle the callback
        try:
            auth_code = self._start_local_server()
            
            # Step 4: Exchange the authorization code for tokens
            self._token = oauth.fetch_token(
                self.TOKEN_URL,
                code=auth_code,
                client_secret=self.client_secret,
                include_client_id=True
            )
            
            # Save the token
            self.token_storage.save_token(self._token)
            return self._token
            
        except Exception as e:
            print(f"Authentication failed: {e}")
            raise
    
    def refresh_token(self) -> Dict[str, Any]:
        """Refresh the access token using the refresh token."""
        if not self._token or 'refresh_token' not in self._token:
            raise ValueError("No refresh token available")
        
        oauth = OAuth2Session(
            client_id=self.client_id,
            token=self._token
        )
        
        try:
            self._token = oauth.refresh_token(
                self.TOKEN_URL,
                client_id=self.client_id,
                client_secret=self.client_secret,
                refresh_token=self._token['refresh_token']
            )
            self.token_storage.save_token(self._token)
            return self._token
        except Exception as e:
            print(f"Failed to refresh token: {e}")
            self.token_storage.clear_token()
            raise
    
    def get_token(self) -> Dict[str, Any]:
        """Get a valid token, refreshing if necessary."""
        if not self._token:
            self._token = self.token_storage.load_token()
        
        if not self._token:
            raise ValueError("Not authenticated. Call authenticate() first.")
        
        # Check if token is expired or about to expire (within 60 seconds)
        if time.time() > (self._token.get('expires_at', 0) - 60):
            try:
                self.refresh_token()
            except Exception:
                # If refresh fails, try to re-authenticate
                self.authenticate()
        
        return self._token


class WithingsSource(DataSource):
    """Data source for Withings API."""
    
    BASE_URL = "https://wbsapi.withings.com/v2/measure"
    
    def __init__(self, auth: WithingsAuth):
        """Initialize the Withings data source.
        
        Args:
            auth: Authenticated WithingsAuth instance
        """
        self.auth = auth
        self._session = None
    
    @property
    def session(self):
        """Get an authenticated session, refreshing the token if needed."""
        if self._session is None:
            # Get a valid token (will refresh if needed)
            token = self.auth.get_token()
            self._session = OAuth2Session(
                client_id=self.auth.client_id,
                token=token
            )
        return self._session
    
    def _make_request(self, action: str, params: Optional[Dict] = None) -> Dict:
        """Make an authenticated request to the Withings API.
        
        Args:
            action: API action to perform
            params: Additional parameters for the request
            
        Returns:
            JSON response from the API
            
        Raises:
            requests.HTTPError: If the API request fails
        """
        url = f"{self.BASE_URL}"
        params = params or {}
        params["action"] = action
        
        # Add OAuth token to the request
        headers = {
            "Authorization": f"Bearer {self.auth.get_token()['access_token']}"
        }
        
        response = self.session.post(url, data=params, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        if data.get("status") != 0:
            raise requests.HTTPError(f"Withings API error: {data.get('error', 'Unknown error')}")
            
        return data
    
    def get_measurements(self, start_date: datetime, end_date: datetime) -> List[BodyMeasurement]:
        """Retrieve body measurements from Withings API.
        
        Args:
            start_date: Start of the date range (inclusive)
            end_date: End of the date range (inclusive)
            
        Returns:
            List of body measurements
            
        Raises:
            requests.HTTPError: If the API request fails
        """
        # Convert dates to timestamps
        start_date_ts = int(start_date.timestamp())
        end_date_ts = int(end_date.timestamp())
        
        try:
            # Get measurements from Withings
            data = self._make_request(
                "getmeas",
                params={
                    "meastypes": json.dumps([1, 6, 5, 8, 11]),  # Weight, fat ratio, muscle mass, hydration, bone mass
                    "category": 1,  # Real measurements
                    "startdate": start_date_ts,
                    "enddate": end_date_ts,
                    "offset": 0,
                    "lastupdate": start_date_ts
                }
            )
            
            # Process and return measurements
            measurements = []
            for measure_group in data.get("body", {}).get("measuregrps", []):
                timestamp = datetime.fromtimestamp(measure_group["date"])
                measures = {m["type"]: m["value"] * (10 ** m["unit"]) 
                          for m in measure_group["measures"]}
                
                measurement = BodyMeasurement(
                    timestamp=timestamp,
                    weight_kg=measures.get(1),  # Weight in kg
                    body_fat_percent=measures.get(6),  # Fat ratio in %
                    muscle_mass_kg=measures.get(5),  # Muscle mass in kg
                    hydration_percent=measures.get(8),  # Hydration in %
                    bone_mass_kg=measures.get(11),  # Bone mass in kg
                    source="withings"
                )
                measurements.append(measurement)
                
            return measurements
            
        except requests.HTTPError as e:
            if e.response.status_code == 401:  # Unauthorized
                # Clear the session to force re-authentication
                self._session = None
                # Try again with a fresh session
                return self.get_measurements(start_date, end_date)
            raise

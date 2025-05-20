"""
Withings API data source implementation.
"""
import os
import json
import webbrowser
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

import requests
from requests_oauthlib import OAuth2Session
from oauthlib.oauth2 import LegacyApplicationClient
from oauthlib.oauth2.rfc6749.errors import TokenExpiredError

from ..models import BodyMeasurement, DataSource


class WithingsAuth:
    """Handles OAuth2 authentication with the Withings API."""
    
    BASE_URL = "https://wbsapi.withings.com"
    AUTH_URL = "https://account.withings.com/oauth2_user/authorize2"
    TOKEN_URL = "https://wbsapi.withings.com/v2/oauth2"
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        """Initialize Withings authentication.
        
        Args:
            client_id: Your Withings client ID
            client_secret: Your Withings client secret
            redirect_uri: Redirect URI registered in your Withings app
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.token: Optional[Dict[str, Any]] = None
    
    def get_auth_url(self) -> str:
        """Get the authorization URL for the user to authenticate."""
        oauth = OAuth2Session(
            client_id=self.client_id,
            redirect_uri=self.redirect_uri,
            scope=["user.metrics"]
        )
        auth_url, _ = oauth.authorization_url(self.AUTH_URL)
        return auth_url
    
    def fetch_token(self, authorization_response: str) -> Dict[str, Any]:
        """Fetch the access token using the authorization response."""
        oauth = OAuth2Session(
            client_id=self.client_id,
            redirect_uri=self.redirect_uri
        )
        self.token = oauth.fetch_token(
            self.TOKEN_URL,
            authorization_response=authorization_response,
            client_secret=self.client_secret
        )
        return self.token
    
    def refresh_token(self) -> Dict[str, Any]:
        """Refresh the access token."""
        if not self.token:
            raise ValueError("No token available to refresh")
            
        oauth = OAuth2Session(
            client_id=self.client_id,
            token=self.token
        )
        self.token = oauth.refresh_token(
            self.TOKEN_URL,
            client_id=self.client_id,
            client_secret=self.client_secret
        )
        return self.token


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
        if not self._session or not self.auth.token:
            raise ValueError("Not authenticated. Call authenticate() first.")
            
        # Check if token is expired
        if datetime.now().timestamp() > self.auth.token['expires_at'] - 60:  # 60s buffer
            self.auth.refresh_token()
            
        if not self._session:
            self._session = OAuth2Session(
                client_id=self.auth.client_id,
                token=self.auth.token
            )
            
        return self._session
    
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """Make an authenticated request to the Withings API."""
        url = f"{self.BASE_URL}{endpoint}"
        response = self.session.post(url, data=params or {})
        response.raise_for_status()
        return response.json()
    
    def get_measurements(self, start_date: datetime, end_date: datetime) -> List[BodyMeasurement]:
        """Retrieve body measurements from Withings API.
        
        Args:
            start_date: Start of the date range (inclusive)
            end_date: End of the date range (inclusive)
            
        Returns:
            List of body measurements
        """
        # Convert dates to timestamps
        start_date_ts = int(start_date.timestamp())
        end_date_ts = int(end_date.timestamp())
        
        # Get measurements from Withings
        data = self._make_request(
            "/measure",
            params={
                "action": "getmeas",
                "meastype": [1, 6, 5, 8, 11],  # Weight, fat free mass, fat ratio, fat mass, muscle mass
                "category": 1,  # Real measurements
                "startdate": start_date_ts,
                "enddate": end_date_ts,
            }
        )
        
        # Process and return measurements
        measurements = []
        for measure_group in data.get("body", {}).get("measuregrps", []):
            timestamp = datetime.fromtimestamp(measure_group["date"])
            measures = {m["type"]: m["value"] * (10 ** m["unit"]) for m in measure_group["measures"]}
            
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

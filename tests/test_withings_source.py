"""
Tests for Withings data source.
"""
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from body_comp_tracking.data_sources.withings_source import WithingsAuth, WithingsSource
from body_comp_tracking.models import BodyMeasurement


class TestWithingsAuth(unittest.TestCase):
    """Tests for Withings authentication."""
    
    def setUp(self):
        self.client_id = "test_client_id"
        self.client_secret = "test_client_secret"
        self.redirect_uri = "http://test.com/callback"
        self.auth = WithingsAuth(self.client_id, self.client_secret, self.redirect_uri)
    
    @patch('requests_oauthlib.OAuth2Session')
    def test_get_auth_url(self, mock_oauth):
        """Test getting authorization URL."""
        mock_session = MagicMock()
        mock_session.authorization_url.return_value = ("http://auth.url", None)
        mock_oauth.return_value = mock_session
        
        url = self.auth.get_auth_url()
        self.assertEqual(url, "http://auth.url")
        mock_oauth.assert_called_once_with(
            client_id=self.client_id,
            redirect_uri=self.redirect_uri,
            scope=["user.metrics"]
        )


class TestWithingsSource(unittest.TestCase):
    """Tests for Withings data source."""
    
    def setUp(self):
        self.auth = MagicMock()
        self.auth.token = {
            'access_token': 'test_token',
            'expires_at': (datetime.now() + timedelta(hours=1)).timestamp()
        }
        self.source = WithingsSource(self.auth)
        self.source._session = MagicMock()
    
    def test_get_measurements_success(self):
        """Test successful retrieval of measurements."""
        # Mock API response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "grpid": 123,
                        "attrib": 0,
                        "date": 1672531200,  # 2023-01-01 00:00:00
                        "category": 1,
                        "measures": [
                            {"value": 75000, "type": 1, "unit": -3},  # 75.0 kg
                            {"value": 2000, "type": 6, "unit": -2},   # 20.0%
                            {"value": 60000, "type": 5, "unit": -3},  # 60.0 kg
                            {"value": 6000, "type": 8, "unit": -2},   # 60.0%
                            {"value": 3000, "type": 11, "unit": -3}   # 3.0 kg
                        ]
                    }
                ]
            }
        }
        self.source._session.post.return_value = mock_response
        
        # Call the method
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 1, 2)
        measurements = self.source.get_measurements(start_date, end_date)
        
        # Verify results
        self.assertEqual(len(measurements), 1)
        self.assertEqual(measurements[0].weight_kg, 75.0)
        self.assertEqual(measurements[0].body_fat_percent, 20.0)
        self.assertEqual(measurements[0].muscle_mass_kg, 60.0)
        self.assertEqual(measurements[0].hydration_percent, 60.0)
        self.assertEqual(measurements[0].bone_mass_kg, 3.0)
        
        # Verify API call
        self.source._session.post.assert_called_once()
        _, kwargs = self.source._session.post.call_args
        self.assertEqual(kwargs['data']['action'], 'getmeas')
        self.assertEqual(kwargs['data']['startdate'], 1672531200)
        self.assertEqual(kwargs['data']['enddate'], 1672617600)
    
    def test_get_measurements_empty(self):
        """Test retrieval when no measurements are found."""
        # Mock empty API response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "status": 0,
            "body": {
                "measuregrps": []
            }
        }
        self.source._session.post.return_value = mock_response
        
        # Call the method
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 1, 2)
        measurements = self.source.get_measurements(start_date, end_date)
        
        # Verify results
        self.assertEqual(len(measurements), 0)


if __name__ == "__main__":
    unittest.main()

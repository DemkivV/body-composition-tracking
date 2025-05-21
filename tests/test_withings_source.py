"""Tests for Withings data source."""

import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from body_comp_tracking.data_sources.withings_source import WithingsAuth, WithingsSource


class TestWithingsAuth(unittest.TestCase):
    """Tests for Withings authentication."""

    def setUp(self):
        """Set up test environment."""
        self.client_id = "test_client_id"
        self.client_secret = "test_client_secret"
        self.redirect_uri = "http://test.com/callback"
        self.auth = WithingsAuth(self.client_id, self.client_secret, self.redirect_uri)

    @patch("body_comp_tracking.data_sources.withings_source.OAuth2Session")
    def test_get_auth_url(self, mock_oauth):
        """Test getting authorization URL."""
        # Test the authorization URL generation
        pass
        # Setup mock
        mock_session = MagicMock()
        expected_url = (
            "https://account.withings.com/oauth2_user/authorize2?"
            "response_type=code&client_id=test_client_id"
        )
        mock_session.authorization_url.return_value = (expected_url, None)
        mock_oauth.return_value = mock_session

        # Call the method
        url = self.auth.get_auth_url()

        # Verify the URL contains expected components
        self.assertIn("https://account.withings.com/oauth2_user/authorize2", url)
        self.assertIn("response_type=code", url)
        self.assertIn(f"client_id={self.client_id}", url)

        # Verify OAuth2Session was called correctly
        mock_oauth.assert_called_once_with(
            client_id=self.client_id,
            redirect_uri=self.redirect_uri,
            scope=self.auth.SCOPES,
        )
        mock_session.authorization_url.assert_called_once_with(self.auth.AUTH_URL)


class TestWithingsSource(unittest.TestCase):
    """Tests for Withings data source."""

    def setUp(self):
        """Set up test environment."""
        self.auth = MagicMock()
        self.auth._token = {
            "access_token": "test_token",
            "expires_at": (datetime.now() + timedelta(hours=1)).timestamp(),
        }
        self.source = WithingsSource(self.auth)
        self.source._session = MagicMock()

    def test_get_measurements_success(self):
        """Test successful retrieval of measurements."""
        # Test successful measurement retrieval
        pass
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
                            {"value": 2000, "type": 6, "unit": -2},  # 20.0%
                            {"value": 60000, "type": 5, "unit": -3},  # 60.0 kg
                            {"value": 6000, "type": 8, "unit": -2},  # 60.0%
                            {"value": 3000, "type": 11, "unit": -3},  # 3.0 kg
                        ],
                    }
                ]
            },
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
        self.assertEqual(kwargs["data"]["action"], "getmeas")

        # Convert test timestamps to local timezone for comparison
        import datetime as dt

        local_tz = dt.datetime.now(dt.timezone.utc).astimezone().tzinfo
        test_start = dt.datetime(2023, 1, 1, tzinfo=dt.timezone.utc).astimezone(
            local_tz
        )
        test_end = dt.datetime(2023, 1, 2, tzinfo=dt.timezone.utc).astimezone(local_tz)

        self.assertEqual(int(kwargs["data"]["startdate"]), int(test_start.timestamp()))
        self.assertEqual(int(kwargs["data"]["enddate"]), int(test_end.timestamp()))
        self.assertEqual(kwargs["data"]["meastypes"], "[1, 6, 5, 8, 11]")
        self.assertEqual(
            int(kwargs["data"]["category"]), 1
        )  # Category should be an integer
        self.assertEqual(int(kwargs["data"]["lastupdate"]), int(test_start.timestamp()))

    def test_get_measurements_empty(self):
        """Test retrieval when no measurements are found."""
        # Test empty measurement retrieval
        pass
        # Mock empty API response
        mock_response = MagicMock()
        mock_response.json.return_value = {"status": 0, "body": {"measuregrps": []}}
        self.source._session.post.return_value = mock_response

        # Call the method
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 1, 2)
        measurements = self.source.get_measurements(start_date, end_date)

        # Verify results
        self.assertEqual(len(measurements), 0)


if __name__ == "__main__":
    unittest.main()

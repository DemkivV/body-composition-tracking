"""Tests for Withings data source."""

import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from requests import Response

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
        # Patch requests.post for all tests in this class
        self.requests_patcher = patch("requests.post")
        self.mock_post = self.requests_patcher.start()

        # Setup auth mock
        self.auth = MagicMock()
        self.auth.get_token.return_value = {
            "access_token": "test_token",
            "expires_at": (datetime.now() + timedelta(hours=1)).timestamp(),
        }

        # Create source instance
        self.source = WithingsSource(self.auth)

        # Mock the session
        self.mock_response = MagicMock(spec=Response)
        self.mock_response.json.return_value = {
            "status": 0,
            "body": {"measuregrps": []},
        }
        self.mock_post.return_value = self.mock_response

    def tearDown(self):
        """Clean up after tests."""
        self.requests_patcher.stop()

    def test_get_measurements_success(self):
        """Test successful retrieval of measurements."""
        # Setup mock API response
        self.mock_response.json.return_value = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "grpid": 123,
                        "attrib": 0,
                        "date": 1672531200,  # 2023-01-01 00:00:00 UTC
                        "category": 1,
                        "measures": [
                            {
                                "value": 75000,
                                "type": 1,
                                "unit": -3,
                                "algo": 0,
                                "fm": 1,
                                "fwid": 1,
                            },  # 75.0 kg
                            {
                                "value": 2000,
                                "type": 6,
                                "unit": -2,
                                "algo": 0,
                                "fm": 1,
                                "fwid": 1,
                            },  # 20.0%
                            {
                                "value": 60000,
                                "type": 5,
                                "unit": -3,
                                "algo": 0,
                                "fm": 1,
                                "fwid": 1,
                            },  # 60.0 kg
                            {
                                "value": 6000,
                                "type": 8,
                                "unit": -2,
                                "algo": 0,
                                "fm": 1,
                                "fwid": 1,
                            },  # 60.0%
                            {
                                "value": 3000,
                                "type": 11,
                                "unit": -3,
                                "algo": 0,
                                "fm": 1,
                                "fwid": 1,
                            },  # 3.0 kg
                        ],
                    }
                ]
            },
        }

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
        self.mock_post.assert_called_once()

        # Get the arguments passed to requests.post
        args, kwargs = self.mock_post.call_args

        # Verify the URL and headers
        self.assertEqual(args[0], "https://wbsapi.withings.com/v2/measure")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test_token")

        # Verify the request parameters
        params = kwargs["params"]
        self.assertEqual(params["action"], "getmeas")

        # Verify timestamp parameters
        expected_start_ts = int(start_date.timestamp())
        expected_end_ts = int(end_date.timestamp())

        self.assertEqual(int(params["startdate"]), expected_start_ts)
        self.assertEqual(int(params["enddate"]), expected_end_ts)
        self.assertEqual(int(params["lastupdate"]), expected_start_ts)

        # Verify meastypes is a list
        self.assertIsInstance(params["meastypes"], list)
        self.assertSetEqual(set(params["meastypes"]), {1, 5, 6, 8, 11})

        # Verify other parameters
        self.assertEqual(int(params["category"]), 1)  # Category should be an integer

    def test_get_measurements_empty(self):
        """Test retrieval when no measurements are found."""
        # Setup empty API response (already set in setUp)
        self.mock_response.json.return_value = {
            "status": 0,
            "body": {"measuregrps": []},
        }

        # Call the method
        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 1, 2)
        measurements = self.source.get_measurements(start_date, end_date)

        # Verify results
        self.assertEqual(len(measurements), 0)

        # Verify the API was called with the correct parameters
        self.mock_post.assert_called_once()

        # Get the arguments passed to requests.post
        args, kwargs = self.mock_post.call_args

        # Verify the URL and headers
        self.assertEqual(args[0], "https://wbsapi.withings.com/v2/measure")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test_token")

        # Verify the request parameters
        params = kwargs["params"]
        self.assertEqual(params["action"], "getmeas")


if __name__ == "__main__":
    unittest.main()

"""Tests for GUI status handling and authentication."""

from unittest.mock import Mock, patch

import pytest

from body_comp_tracking.gui.app import Api


class TestGuiStatusHandling:
    """Test class for GUI status handling functionality."""

    @pytest.fixture
    def api_instance(self):
        """Create an API instance for testing."""
        return Api()

    def test_is_authenticated_returns_proper_format(self, api_instance):
        """Test that is_authenticated returns the expected format with success field."""
        result = api_instance.is_authenticated()

        # Should always have 'success' and 'authenticated' fields
        assert "success" in result
        assert "authenticated" in result
        assert isinstance(result["success"], bool)
        assert isinstance(result["authenticated"], bool)

    def test_is_authenticated_without_auth_client(self, api_instance):
        """Test is_authenticated when no auth client is available."""
        api_instance.withings_auth = None
        result = api_instance.is_authenticated()

        assert result["success"] is True
        assert result["authenticated"] is False

    @patch("body_comp_tracking.gui.app.get_withings_credentials")
    def test_is_authenticated_with_valid_token(self, mock_creds, api_instance):
        """Test is_authenticated when a valid token exists."""
        # Mock credentials
        mock_creds.return_value = {"client_id": "test_id", "client_secret": "test_secret"}

        # Mock auth with valid token
        mock_auth = Mock()
        mock_auth.is_authenticated.return_value = True
        api_instance.withings_auth = mock_auth

        result = api_instance.is_authenticated()

        assert result["success"] is True
        assert result["authenticated"] is True

    @patch("body_comp_tracking.gui.app.get_withings_credentials")
    def test_is_authenticated_with_invalid_token(self, mock_creds, api_instance):
        """Test is_authenticated when token is invalid."""
        # Mock credentials
        mock_creds.return_value = {"client_id": "test_id", "client_secret": "test_secret"}

        # Mock auth with invalid token
        mock_auth = Mock()
        mock_auth.is_authenticated.return_value = False
        api_instance.withings_auth = mock_auth

        result = api_instance.is_authenticated()

        assert result["success"] is True
        assert result["authenticated"] is False

    @patch("body_comp_tracking.gui.app.get_withings_credentials")
    def test_authentication_error_handling(self, mock_creds, api_instance):
        """Test is_authenticated when an exception occurs."""
        # Mock credentials
        mock_creds.return_value = {"client_id": "test_id", "client_secret": "test_secret"}

        # Mock auth that raises an exception
        mock_auth = Mock()
        mock_auth.is_authenticated.side_effect = Exception("Auth error")
        api_instance.withings_auth = mock_auth

        result = api_instance.is_authenticated()

        assert result["success"] is False
        assert result["authenticated"] is False
        assert "message" in result

    def test_authenticate_success_returns_proper_format(self, api_instance):
        """Test that authenticate returns proper format on success."""
        # Mock successful authentication
        mock_auth = Mock()
        mock_auth.authenticate.return_value = None  # No exception means success
        api_instance.withings_auth = mock_auth

        result = api_instance.authenticate()

        assert "success" in result
        assert "message" in result
        assert result["success"] is True

    def test_authenticate_failure_returns_proper_format(self, api_instance):
        """Test that authenticate returns proper format on failure."""
        # Mock failed authentication
        mock_auth = Mock()
        mock_auth.authenticate.side_effect = Exception("Auth failed")
        api_instance.withings_auth = mock_auth

        result = api_instance.authenticate()

        assert "success" in result
        assert "message" in result
        assert result["success"] is False
        assert "Auth failed" in result["message"]

    def test_import_data_success_returns_proper_format(self, api_instance):
        """Test that import_data returns proper format on success."""
        # Mock successful import
        mock_auth = Mock()
        mock_auth.is_authenticated.return_value = True
        api_instance.withings_auth = mock_auth

        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "Successfully imported 5 new measurements.",
                "file_path": "/test/path",
                "count": 5,
            }

            with patch.object(api_instance, "_apply_unified_transformation") as mock_transform:
                mock_transform.return_value = {
                    "success": True,
                    "message": "Successfully imported 5 new measurements."
                    " Unified data file updated with 10 total entries.",
                    "file_path": "/test/path",
                    "count": 5,
                    "unified_file": "/test/unified",
                    "total_unified": 10,
                }

                result = api_instance.import_data()

                assert "success" in result
                assert "message" in result
                assert result["success"] is True
                assert "Successfully imported" in result["message"]

    def test_import_data_not_authenticated(self, api_instance):
        """Test that import_data handles unauthenticated state properly."""
        # Mock unauthenticated state
        mock_auth = Mock()
        mock_auth.is_authenticated.return_value = False
        api_instance.withings_auth = mock_auth

        result = api_instance.import_data()

        assert "success" in result
        assert "message" in result
        assert result["success"] is False
        assert "Not authenticated" in result["message"]

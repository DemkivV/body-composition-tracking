"""Tests for GUI app import data functionality."""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from body_comp_tracking.gui.app import Api


class TestGuiImport:
    """Test class for GUI app import functionality."""

    @pytest.fixture
    def api_instance(self):
        """Create an Api instance with mocked dependencies."""
        api = Api()
        # Mock the authentication components
        api.withings_auth = Mock()
        api.withings_source = Mock()
        return api

    def test_import_data_success(self, api_instance):
        """Test successful data import."""
        # Mock the incremental import method and format transformation
        mock_source = MagicMock()
        mock_source.import_incremental_data_to_csv.return_value = 42

        with tempfile.TemporaryDirectory() as temp_dir:
            withings_csv = Path(temp_dir) / "raw_data_withings_api.csv"
            app_csv = Path(temp_dir) / "raw_data_this_app.csv"

            # Mock the config.DATA_DIR to point to our temp directory
            with patch("body_comp_tracking.gui.app.config.DATA_DIR", Path(temp_dir)):
                # Mock the WithingsSource creation
                with patch(
                    "body_comp_tracking.gui.app.WithingsSource",
                    return_value=mock_source,
                ):
                    # Mock unified format transformation
                    with patch.object(api_instance, "_transform_to_unified_format", return_value=50):
                        result = api_instance.import_data()

            # Verify the result
            assert result["success"] is True
            assert "50 entries added" in result["message"]
            assert result["file_path"] == str(withings_csv)
            assert result["unified_file"] == str(app_csv)
            assert result["count"] == 42
            assert result["total_unified"] == 50

    def test_import_data_not_authenticated(self, api_instance):
        """Test import data when not authenticated."""
        # Mock is_authenticated to return False
        api_instance.withings_auth.is_authenticated.return_value = False

        result = api_instance.import_data()

        assert result["success"] is False
        assert "Not authenticated. Please authenticate first." in result["message"]

    def test_import_data_api_error(self, api_instance):
        """Test import data when API call fails."""
        # Mock the incremental import method to raise an exception
        mock_source = MagicMock()
        mock_source.import_incremental_data_to_csv.side_effect = Exception("API connection failed")

        with tempfile.TemporaryDirectory() as temp_dir:
            with patch("body_comp_tracking.gui.app.config.DATA_DIR", Path(temp_dir)):
                with patch(
                    "body_comp_tracking.gui.app.WithingsSource",
                    return_value=mock_source,
                ):
                    result = api_instance.import_data()

        assert result["success"] is False
        assert "Import failed: API connection failed" in result["message"]

    def test_import_data_empty_result(self, api_instance):
        """Test import data when no measurements are found."""
        # Mock the incremental import method to return 0 measurements
        mock_source = MagicMock()
        mock_source.import_incremental_data_to_csv.return_value = 0

        with tempfile.TemporaryDirectory() as temp_dir:
            withings_csv = Path(temp_dir) / "raw_data_withings_api.csv"
            # Create empty CSV file to simulate existing file
            withings_csv.touch()

            with patch("body_comp_tracking.gui.app.config.DATA_DIR", Path(temp_dir)):
                with patch(
                    "body_comp_tracking.gui.app.WithingsSource",
                    return_value=mock_source,
                ):
                    with patch.object(api_instance, "_transform_to_unified_format", return_value=0):
                        result = api_instance.import_data()

        assert result["success"] is True
        assert "No new measurements available" in result["message"]

    def test_import_data_file_path_generation(self, api_instance):
        """Test that the correct file path is generated."""
        mock_source = MagicMock()
        mock_source.import_incremental_data_to_csv.return_value = 10

        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "custom_data"

            with patch("body_comp_tracking.gui.app.config.DATA_DIR", data_dir):
                with patch(
                    "body_comp_tracking.gui.app.WithingsSource",
                    return_value=mock_source,
                ):
                    with patch.object(api_instance, "_transform_to_unified_format", return_value=15):
                        result = api_instance.import_data()

            expected_withings_path = data_dir / "raw_data_withings_api.csv"
            expected_app_path = data_dir / "raw_data_this_app.csv"
            assert result["file_path"] == str(expected_withings_path)
            assert result["unified_file"] == str(expected_app_path)

    @patch("body_comp_tracking.gui.app.logger")
    def test_import_data_logs_error(self, mock_logger, api_instance):
        """Test that errors are properly logged."""
        error_message = "Network timeout"
        mock_source = MagicMock()
        mock_source.import_incremental_data_to_csv.side_effect = Exception(error_message)

        with tempfile.TemporaryDirectory() as temp_dir:
            with patch("body_comp_tracking.gui.app.config.DATA_DIR", Path(temp_dir)):
                with patch(
                    "body_comp_tracking.gui.app.WithingsSource",
                    return_value=mock_source,
                ):
                    _ = api_instance.import_data()

        # Verify error was logged
        mock_logger.error.assert_called_once()
        logged_message = mock_logger.error.call_args[0][0]
        assert "Error importing data:" in logged_message
        assert error_message in str(mock_logger.error.call_args)

    def test_import_data_response_format(self, api_instance):
        """Test that the response has the expected format."""
        mock_source = MagicMock()
        mock_source.import_incremental_data_to_csv.return_value = 25

        with tempfile.TemporaryDirectory() as temp_dir:
            with patch("body_comp_tracking.gui.app.config.DATA_DIR", Path(temp_dir)):
                with patch(
                    "body_comp_tracking.gui.app.WithingsSource",
                    return_value=mock_source,
                ):
                    with patch.object(api_instance, "_transform_to_unified_format", return_value=30):
                        result = api_instance.import_data()

        # Verify response format
        assert isinstance(result, dict)
        assert "success" in result
        assert "message" in result
        assert "file_path" in result
        assert "unified_file" in result
        assert "count" in result
        assert "total_unified" in result


class TestApiInitialization:
    """Test class for Api initialization and authentication checking."""

    @patch("body_comp_tracking.gui.app.get_withings_credentials")
    def test_initialization_without_credentials(self, mock_get_creds):
        """Test Api initialization when credentials are not configured."""
        mock_get_creds.return_value = {}

        api = Api()

        assert api.withings_auth is None
        assert api.withings_source is None

    @patch("body_comp_tracking.gui.app.get_withings_credentials")
    def test_initialization_with_incomplete_credentials(self, mock_get_creds):
        """Test Api initialization when credentials are incomplete."""
        mock_get_creds.return_value = {"client_id": "test_id"}  # Missing client_secret

        api = Api()

        assert api.withings_auth is None
        assert api.withings_source is None

    @patch("body_comp_tracking.gui.app.get_withings_credentials")
    def test_initialization_with_complete_credentials(self, mock_get_creds):
        """Test Api initialization when credentials are complete."""
        mock_get_creds.return_value = {
            "client_id": "test_id",
            "client_secret": "test_secret",
        }

        api = Api()

        assert api.withings_auth is not None
        assert api.withings_source is not None
        assert api.withings_auth.client_id == "test_id"
        assert api.withings_auth.client_secret == "test_secret"

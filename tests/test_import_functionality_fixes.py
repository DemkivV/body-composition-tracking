"""Test import functionality fixes for subsequent imports and button text changes."""

import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from body_comp_tracking.data_sources.withings_source import WithingsAuth
from body_comp_tracking.gui.app import Api


class TestImportFunctionalityFixes:
    """Test class for import functionality fixes."""

    @pytest.fixture
    def temp_data_dir(self):
        """Create a temporary data directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch("body_comp_tracking.config.DATA_DIR", Path(temp_dir)):
                yield Path(temp_dir)

    @pytest.fixture
    def mock_withings_auth(self):
        """Create a mock WithingsAuth object."""
        mock_auth = Mock(spec=WithingsAuth)
        mock_auth.is_authenticated.return_value = True
        mock_auth.get_token.return_value = {"access_token": "test_token"}
        return mock_auth

    @pytest.fixture
    def api_instance(self, mock_withings_auth):
        """Create an Api instance with mocked authentication."""
        api = Api()
        api.withings_auth = mock_withings_auth
        return api

    @pytest.fixture
    def sample_csv_data(self):
        """Sample CSV data for testing."""
        header = 'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        data_lines = [
            '"2024-01-15 10:30:00",75.5,15.2,3.1,45.2,12.0,\n',
            '"2024-01-14 10:30:00",75.3,15.1,3.1,45.1,12.0,\n',
            '"2024-01-13 10:30:00",75.1,15.0,3.1,45.0,12.0,\n',
        ]
        return header + "".join(data_lines)

    def test_no_new_data_available_message(self, api_instance, temp_data_dir):
        """Test that 'No new measurements available.' message appears when no API data is fetched."""
        # Mock the import to return 0 new measurements (no new data from API)
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "No new measurements available.",
                "file_path": str(temp_data_dir / "raw_data_withings_api.csv"),
                "count": 0,
            }

            result = api_instance.import_data()

            assert result["success"] is True
            assert result["message"] == "No new measurements available."
            # Should not contain unified data message when no new data
            assert "Unified data file updated" not in result["message"]

    def test_new_measurements_with_actual_unified_additions(self, api_instance, temp_data_dir, sample_csv_data):
        """Test correct unified count when new measurements are actually added to unified file."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Create existing app CSV with 2 entries
        existing_app_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        existing_app_data += '"2024-01-12 10:30:00",75.0,14.9,3.1,44.9,12.0,\n'
        existing_app_data += '"2024-01-11 10:30:00",74.8,14.8,3.1,44.8,12.0,\n'
        app_csv.write_text(existing_app_data)

        # Mock import returning 5 new measurements from API
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "Successfully imported 5 new measurements.",
                "file_path": str(withings_csv),
                "count": 5,
            }

            # Write new withings data (5 entries, 3 of which are new to unified)
            withings_csv.write_text(sample_csv_data)

            result = api_instance.import_data()

            assert result["success"] is True
            assert "3 entries added" in result["message"]
            # Verify that 3 new entries were added to unified (not the 5 from API)
            assert result["total_unified"] == 3

    def test_api_data_but_no_new_unified_entries(self, api_instance, temp_data_dir, sample_csv_data):
        """Test when API returns data but unified file gets no new entries (data already exists)."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Create existing files with same data (simulating data already in unified file)
        withings_csv.write_text(sample_csv_data)
        app_csv.write_text(sample_csv_data)

        # Mock API import returning data from Withings (maybe re-imported all data)
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "Successfully imported 244 new measurements.",
                "file_path": str(withings_csv),
                "count": 244,
            }

            result = api_instance.import_data()

            assert result["success"] is True
            assert "0 entries added" in result["message"]
            # Verify that no new entries were added to unified
            assert result["total_unified"] == 0

    def test_first_import_success_message(self, api_instance, temp_data_dir, sample_csv_data):
        """Test that first import shows correct success message."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"

        # Mock the import to return sample data
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "Successfully imported 3 new measurements.",
                "file_path": str(withings_csv),
                "count": 3,
            }

            # Write sample data to file
            withings_csv.write_text(sample_csv_data)

            result = api_instance.import_data()

            assert result["success"] is True
            assert "3 entries added" in result["message"]

    def test_partial_import_with_mixed_data(self, api_instance, temp_data_dir):
        """Test import when some data is new and some already exists."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Create existing app CSV with 2 entries
        existing_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        existing_data += '"2024-01-13 10:30:00",75.1,15.0,3.1,45.0,12.0,\n'
        existing_data += '"2024-01-12 10:30:00",75.0,14.9,3.1,44.9,12.0,\n'
        app_csv.write_text(existing_data)

        # Create withings CSV with some new and some existing data
        new_withings_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        new_withings_data += '"2024-01-15 10:30:00",75.5,15.2,3.1,45.2,12.0,\n'  # New
        new_withings_data += '"2024-01-14 10:30:00",75.3,15.1,3.1,45.1,12.0,\n'  # New
        new_withings_data += '"2024-01-13 10:30:00",75.1,15.0,3.1,45.0,12.0,\n'  # Exists
        withings_csv.write_text(new_withings_data)

        # Mock import returning 2 new measurements from API
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "Successfully imported 2 new measurements.",
                "file_path": str(withings_csv),
                "count": 2,
            }

            result = api_instance.import_data()

            assert result["success"] is True
            assert "2 entries added" in result["message"]

    def test_determine_import_strategy_first_time(self, api_instance, temp_data_dir):
        """Test import strategy determination for first-time import."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"

        start_date, message = api_instance._determine_import_strategy(withings_csv)

        assert start_date == datetime(2015, 1, 1)
        assert message == "Importing all historical data..."

    def test_determine_import_strategy_incremental(self, api_instance, temp_data_dir, sample_csv_data):
        """Test import strategy determination for incremental import."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        withings_csv.write_text(sample_csv_data)

        start_date, message = api_instance._determine_import_strategy(withings_csv)

        # Should start from day after last date (2024-01-15 10:30:00 + 1 day = 2024-01-16 10:30:00)
        expected_date = datetime(2024, 1, 16, 10, 30)
        assert start_date == expected_date
        assert "Importing new data since 2024-01-15" in message

    def test_has_imported_data_detection(self, api_instance, temp_data_dir, sample_csv_data):
        """Test that the system correctly detects when data has been imported."""
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Initially no data
        result = api_instance.has_unified_data()
        assert result["success"] is True
        assert result["has_data"] is False
        assert result["count"] == 0

        # After writing data
        app_csv.write_text(sample_csv_data)
        result = api_instance.has_unified_data()
        assert result["success"] is True
        assert result["has_data"] is True
        assert result["count"] == 3

    def test_button_text_logic_first_time(self, api_instance, temp_data_dir):
        """Test button text logic for first-time users."""
        # No data exists initially
        result = api_instance.has_unified_data()
        assert result["has_data"] is False
        # This would trigger "Import Data" button text in frontend

    def test_button_text_logic_subsequent_times(self, api_instance, temp_data_dir, sample_csv_data):
        """Test button text logic for users with existing data."""
        app_csv = temp_data_dir / "raw_data_this_app.csv"
        app_csv.write_text(sample_csv_data)

        result = api_instance.has_unified_data()
        assert result["has_data"] is True
        # This would trigger "Update Data" button text in frontend

    def test_unified_data_preservation_on_reimport(self, api_instance, temp_data_dir):
        """Test that existing unified data is preserved when re-importing data."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Create initial data
        initial_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        initial_data += '"2024-01-15 10:30:00",75.5,15.2,3.1,45.2,12.0,\n'
        initial_data += '"2024-01-14 10:30:00",75.3,15.1,3.1,45.1,12.0,\n'
        app_csv.write_text(initial_data)

        # Create withings data with the same entries
        withings_csv.write_text(initial_data)

        # Transform to unified format (should not duplicate)
        result = api_instance._transform_to_unified_format(withings_csv, app_csv)
        assert result == 0  # No new entries added

        # Verify original data is preserved
        with open(app_csv, "r") as f:
            lines = f.readlines()

        # Should still have 3 lines: header + 2 data lines
        assert len(lines) == 3
        assert "2024-01-15" in lines[1]
        assert "2024-01-14" in lines[2]

    def test_transform_unified_format_tracks_new_entries_correctly(self, api_instance, temp_data_dir):
        """Test that _transform_to_unified_format correctly tracks only NEW entries added."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # First import: 3 entries
        withings_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        withings_data += '"2024-01-15 10:30:00",75.5,15.2,3.1,45.2,12.0,\n'
        withings_data += '"2024-01-14 10:30:00",75.3,15.1,3.1,45.1,12.0,\n'
        withings_data += '"2024-01-13 10:30:00",75.1,15.0,3.1,45.0,12.0,\n'
        withings_csv.write_text(withings_data)

        # First transformation - should return 3 new entries
        result = api_instance._transform_to_unified_format(withings_csv, app_csv)
        assert result == 3

        # Second import with 2 additional entries
        updated_withings_data = withings_data + '"2024-01-16 10:30:00",75.7,15.3,3.1,45.3,12.0,\n'
        updated_withings_data += '"2024-01-17 10:30:00",75.9,15.4,3.1,45.4,12.0,\n'
        withings_csv.write_text(updated_withings_data)

        # Second transformation - should return only 2 new entries
        result = api_instance._transform_to_unified_format(withings_csv, app_csv)
        assert result == 2

        # Third import with same data - should return 0 new entries
        result = api_instance._transform_to_unified_format(withings_csv, app_csv)
        assert result == 0

    def test_large_api_import_with_few_new_unified_entries(self, api_instance, temp_data_dir):
        """Test scenario where API imports many measurements but only few are new to unified."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Create existing unified data with many entries
        existing_unified_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        for i in range(240):  # 240 existing entries
            date = f'"2024-01-{i+1:02d} 10:30:00"'
            existing_unified_data += f"{date},75.{i % 10},{15}.{i % 10},3.1,45.{i % 10},12.0,\n"
        app_csv.write_text(existing_unified_data)

        # Mock API returning 244 measurements (240 existing + 4 new)
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            # Create withings data with existing + 4 new entries
            withings_data = existing_unified_data
            withings_data += '"2024-02-01 10:30:00",76.0,16.0,3.1,46.0,12.0,\n'  # New
            withings_data += '"2024-02-02 10:30:00",76.1,16.1,3.1,46.1,12.0,\n'  # New
            withings_data += '"2024-02-03 10:30:00",76.2,16.2,3.1,46.2,12.0,\n'  # New
            withings_data += '"2024-02-04 10:30:00",76.3,16.3,3.1,46.3,12.0,\n'  # New
            withings_csv.write_text(withings_data)

            mock_import.return_value = {
                "success": True,
                "message": "Successfully imported 244 new measurements.",
                "file_path": str(withings_csv),
                "count": 244,
            }

            result = api_instance.import_data()

            assert result["success"] is True
            assert "4 entries added" in result["message"]
            # Should show only 4 new entries added to unified file, not 244
            assert result["total_unified"] == 4

    def test_zero_api_count_zero_unified_additions(self, api_instance, temp_data_dir):
        """Test when API returns 0 count and unified gets 0 additions."""
        # Mock the import to return 0 new measurements
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "No new measurements available.",
                "file_path": str(temp_data_dir / "raw_data_withings_api.csv"),
                "count": 0,
            }

            result = api_instance.import_data()

            assert result["success"] is True
            assert result["message"] == "No new measurements available."
            # Should not show unified message when API returns 0
            assert "Unified data file updated" not in result["message"]

    def test_api_import_error_handling(self, api_instance, temp_data_dir):
        """Test proper error handling when API import fails."""
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": False,
                "message": "API authentication failed.",
            }

            result = api_instance.import_data()

            assert result["success"] is False
            assert result["message"] == "API authentication failed."

    def test_manual_deletion_scenario_feedback(self, api_instance, temp_data_dir):
        """Test that manually deleting data and then importing shows 'No new measurements available.'.

        This test verifies the scenario where data is manually deleted from the CSV
        and then import is triggered, which should show the proper message.
        """
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Create initial data in both files
        initial_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        initial_data += '"2024-01-15 10:30:00",75.5,15.2,3.1,45.2,12.0,\n'
        initial_data += '"2024-01-14 10:30:00",75.3,15.1,3.1,45.1,12.0,\n'

        withings_csv.write_text(initial_data)
        app_csv.write_text(initial_data)

        # Simulate manual deletion from withings CSV (remove one entry)
        modified_withings_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        modified_withings_data += '"2024-01-14 10:30:00",75.3,15.1,3.1,45.1,12.0,\n'
        withings_csv.write_text(modified_withings_data)

        # Mock import returning 0 new measurements (no new API data)
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "No new measurements available.",
                "file_path": str(withings_csv),
                "count": 0,
            }

            result = api_instance.import_data()

            assert result["success"] is True
            # Should show "No new measurements available." not "0 entries added"
            assert result["message"] == "No new measurements available."
            # Should not contain unified data message when both API and unified are 0
            assert "entries added" not in result["message"]

    def test_api_data_all_duplicates_feedback(self, api_instance, temp_data_dir):
        """Test that API returning data but all duplicates shows '0 entries added'."""
        withings_csv = temp_data_dir / "raw_data_withings_api.csv"
        app_csv = temp_data_dir / "raw_data_this_app.csv"

        # Create existing app CSV with data
        existing_data = (
            'Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments\n'
        )
        existing_data += '"2024-01-15 10:30:00",75.5,15.2,3.1,45.2,12.0,\n'
        existing_data += '"2024-01-14 10:30:00",75.3,15.1,3.1,45.1,12.0,\n'
        app_csv.write_text(existing_data)

        # Create withings CSV with same data (duplicates)
        withings_csv.write_text(existing_data)

        # Mock import returning 2 measurements from API (but they're duplicates)
        with patch.object(api_instance, "_import_from_withings_api") as mock_import:
            mock_import.return_value = {
                "success": True,
                "message": "Successfully imported 2 new measurements.",
                "file_path": str(withings_csv),
                "count": 2,
            }

            result = api_instance.import_data()

            assert result["success"] is True
            # Should show "0 entries added" when API has data but all are duplicates
            assert result["message"] == "0 entries added"
            assert result["total_unified"] == 0

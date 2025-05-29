"""Tests for Withings data import functionality."""

import csv
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from body_comp_tracking.data_sources.withings_source import WithingsAuth, WithingsSource


class TestWithingsDataImport:
    """Test class for Withings data import functionality."""

    @pytest.fixture
    def mock_auth(self):
        """Create a mock WithingsAuth instance."""
        auth = Mock(spec=WithingsAuth)
        auth.client_id = "test_client_id"
        auth.get_token.return_value = {
            "access_token": "test_token",
            "token_type": "Bearer",
        }
        return auth

    @pytest.fixture
    def withings_source(self, mock_auth):
        """Create a WithingsSource instance with mocked auth."""
        return WithingsSource(mock_auth)

    @pytest.fixture
    def sample_api_response(self):
        """Sample API response from Withings API."""
        return {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,  # 2022-01-20 06:54:22
                        "measures": [
                            {"type": 1, "value": 8653, "unit": -2},  # Weight: 86.53 kg
                            {
                                "type": 8,
                                "value": 1326,
                                "unit": -2,
                            },  # Fat mass: 13.26 kg
                            {
                                "type": 88,
                                "value": 363,
                                "unit": -2,
                            },  # Bone mass: 3.63 kg
                            {
                                "type": 5,
                                "value": 6965,
                                "unit": -2,
                            },  # Fat-free mass: 69.65 kg (muscle mass = 69.65 - 3.63 = 66.02 kg)
                            {
                                "type": 77,
                                "value": 4980,
                                "unit": -2,
                            },  # Hydration: 49.80 kg
                        ],
                    },
                    {
                        "date": 1642751662,  # 2022-01-21 06:54:22
                        "measures": [
                            {"type": 1, "value": 8645, "unit": -2},  # Weight: 86.45 kg
                            {
                                "type": 8,
                                "value": 1320,
                                "unit": -2,
                            },  # Fat mass: 13.20 kg
                            # Missing other measurements on this day
                        ],
                    },
                    {
                        "date": 1642838062,  # 2022-01-22 06:54:22
                        "measures": [
                            {"type": 1, "value": 8640, "unit": -2},  # Weight: 86.40 kg
                            # No body composition data on this day
                        ],
                    },
                ]
            },
        }

    def test_import_all_data_to_csv_success(self, withings_source, sample_api_response):
        """Test successful data import to CSV."""
        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_data.csv"

            # Mock the API request
            with patch.object(withings_source, "_make_request", return_value=sample_api_response):
                result = withings_source.import_all_data_to_csv(csv_path)

            # Verify the number of measurements
            assert result == 3

            # Verify the CSV file was created
            assert csv_path.exists()

            # Read and verify CSV content
            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                rows = list(reader)

            # Should have 3 rows (one for each measurement group)
            assert len(rows) == 3

            # Data should be sorted newest first (reverse chronological)
            # The newest timestamp in our test data is 1642838062 (2022-01-22)
            first_row = rows[0]
            expected_timestamp = datetime.fromtimestamp(1642838062).strftime("%Y-%m-%d %H:%M:%S")
            assert first_row["Date"] == expected_timestamp

    def test_import_all_data_to_csv_empty_response(self, withings_source):
        """Test import with empty API response."""
        empty_response = {"status": 0, "body": {"measuregrps": []}}

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "empty_data.csv"

            with patch.object(withings_source, "_make_request", return_value=empty_response):
                result = withings_source.import_all_data_to_csv(csv_path)

            # Should return 0 measurements
            assert result == 0

            # CSV file should still be created with headers
            assert csv_path.exists()

            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                rows = list(reader)

            # Should have no data rows, only headers
            assert len(rows) == 0

    def test_import_all_data_to_csv_api_error(self, withings_source):
        """Test import when API request fails."""
        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "error_data.csv"

            # Mock API request to raise an exception
            with patch.object(withings_source, "_make_request", side_effect=Exception("API Error")):
                with pytest.raises(Exception, match="API Error"):
                    withings_source.import_all_data_to_csv(csv_path)

    def test_csv_format_matches_withings_export(self, withings_source, sample_api_response):
        """Test that CSV format matches official Withings export format."""
        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "format_test.csv"

            with patch.object(withings_source, "_make_request", return_value=sample_api_response):
                withings_source.import_all_data_to_csv(csv_path)

            # Read the CSV and check format
            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                content = csvfile.read()

            lines = content.strip().split("\n")

            # Check header format (strip whitespace to handle different line endings)
            header_line = lines[0].strip()
            assert "Date" in header_line
            assert "Weight (kg)" in header_line
            assert "Fat mass (kg)" in header_line
            assert "Comments" in header_line

            # Check first data line - this should be the newest data (1642838062 = 86.40kg)
            first_data_line = lines[1].strip()
            assert "86.40" in first_data_line  # Weight from newest measurement

            # Check that date doesn't have quotes but other headers do
            assert header_line.startswith('Date,"Weight (kg)"')

    def test_measurement_type_mapping(self, withings_source):
        """Test that measurement types are correctly mapped."""
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,
                        "measures": [
                            {"type": 1, "value": 8653, "unit": -2},  # Weight
                            {"type": 8, "value": 1326, "unit": -2},  # Fat mass
                            {"type": 88, "value": 363, "unit": -2},  # Bone mass
                            {"type": 5, "value": 6965, "unit": -2},  # Fat-free mass
                            {"type": 77, "value": 4980, "unit": -2},  # Hydration
                            {
                                "type": 99,
                                "value": 1234,
                                "unit": -2,
                            },  # Unknown type (should be ignored)
                        ],
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "mapping_test.csv"

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_all_data_to_csv(csv_path)

            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                row = next(reader)

            # Verify all known types are mapped correctly
            assert row["Weight (kg)"] == "86.53"
            assert row["Fat mass (kg)"] == "13.26"
            assert row["Muscle mass (kg)"] == "66.02"
            assert row["Hydration (kg)"] == "49.80"
            assert row["Bone mass (kg)"] == "3.63"
            # Unknown type should not affect the output

    def test_directory_creation(self, withings_source, sample_api_response):
        """Test that the method creates necessary directories."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Use a nested path that doesn't exist
            csv_path = Path(temp_dir) / "nested" / "directory" / "data.csv"

            with patch.object(withings_source, "_make_request", return_value=sample_api_response):
                result = withings_source.import_all_data_to_csv(csv_path)

            # Verify directory was created and file exists
            assert csv_path.exists()
            assert csv_path.parent.exists()
            assert result == 3

    def test_unit_conversion(self, withings_source):
        """Test that measurement units are correctly converted."""
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,
                        "measures": [
                            {
                                "type": 1,
                                "value": 86530,
                                "unit": -3,
                            },  # Weight: 86530 * 10^-3 = 86.53 kg
                            {
                                "type": 8,
                                "value": 13260,
                                "unit": -3,
                            },  # Fat mass: 13260 * 10^-3 = 13.26 kg
                        ],
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "unit_test.csv"

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_all_data_to_csv(csv_path)

            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                row = next(reader)

            # Verify unit conversion is correct
            assert row["Weight (kg)"] == "86.53"
            assert row["Fat mass (kg)"] == "13.26"

    def test_data_sorting_by_timestamp(self, withings_source):
        """Test that data is sorted by timestamp in reverse chronological order."""
        # Create response with timestamps in random order
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642838062,  # 2022-01-22 (latest)
                        "measures": [{"type": 1, "value": 8640, "unit": -2}],
                    },
                    {
                        "date": 1642665262,  # 2022-01-20 (earliest)
                        "measures": [{"type": 1, "value": 8653, "unit": -2}],
                    },
                    {
                        "date": 1642751662,  # 2022-01-21 (middle)
                        "measures": [{"type": 1, "value": 8645, "unit": -2}],
                    },
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "sorting_test.csv"

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_all_data_to_csv(csv_path)

            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                rows = list(reader)

            # Verify data is sorted in reverse chronological order (newest first)
            expected_1 = datetime.fromtimestamp(1642838062).strftime("%Y-%m-%d %H:%M:%S")  # Latest (should be first)
            expected_2 = datetime.fromtimestamp(1642751662).strftime("%Y-%m-%d %H:%M:%S")  # Middle (should be second)
            expected_3 = datetime.fromtimestamp(1642665262).strftime("%Y-%m-%d %H:%M:%S")  # Earliest (should be last)

            assert rows[0]["Date"] == expected_1  # Newest first
            assert rows[1]["Date"] == expected_2  # Middle second
            assert rows[2]["Date"] == expected_3  # Oldest last

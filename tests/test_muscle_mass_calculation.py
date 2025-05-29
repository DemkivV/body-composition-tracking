"""Tests for muscle mass calculation correctness."""

import csv
import re
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest

from body_comp_tracking.data_sources.withings_source import WithingsAuth, WithingsSource


class TestMuscleMassCalculation:
    """Test class for muscle mass calculation functionality."""

    @pytest.fixture
    def withings_auth(self):
        """Create a mock WithingsAuth instance."""
        auth = WithingsAuth(client_id="test_client_id", client_secret="test_client_secret")
        # Mock the token to avoid actual authentication
        auth._token = {"access_token": "test_token", "token_type": "Bearer"}
        return auth

    @pytest.fixture
    def withings_source(self, withings_auth):
        """Create a WithingsSource instance."""
        return WithingsSource(withings_auth)

    def test_muscle_mass_calculation_in_import_all_data(self, withings_source):
        """Test that muscle mass is correctly calculated as fat-free mass minus bone mass."""
        # Mock API response with test data
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,  # 2022-01-20 06:54:22
                        "measures": [
                            {"type": 1, "value": 8653, "unit": -2},  # Weight: 86.53 kg
                            {"type": 8, "value": 1326, "unit": -2},  # Fat mass: 13.26 kg
                            {"type": 88, "value": 367, "unit": -2},  # Bone mass: 3.67 kg
                            {"type": 5, "value": 7519, "unit": -2},  # Fat-free mass: 75.19 kg
                            {"type": 77, "value": 4980, "unit": -2},  # Hydration: 49.80 kg
                        ],
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_muscle_mass.csv"

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_all_data_to_csv(csv_path)

            # Read the CSV and verify muscle mass calculation
            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                row = next(reader)

            # Verify the calculation: muscle_mass = fat_free_mass - bone_mass
            # Expected: 75.19 - 3.67 = 71.52
            assert row["Muscle mass (kg)"] == "71.52"
            assert row["Bone mass (kg)"] == "3.67"
            assert row["Weight (kg)"] == "86.53"
            assert row["Fat mass (kg)"] == "13.26"

    def test_muscle_mass_calculation_in_incremental_import(self, withings_source):
        """Test muscle mass calculation in incremental import."""
        # Mock API response
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,
                        "measures": [
                            {"type": 1, "value": 8500, "unit": -2},  # Weight: 85.00 kg
                            {"type": 88, "value": 350, "unit": -2},  # Bone mass: 3.50 kg
                            {"type": 5, "value": 7400, "unit": -2},  # Fat-free mass: 74.00 kg
                        ],
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_incremental.csv"
            start_date = datetime(2022, 1, 1)

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_incremental_data_to_csv(csv_path, start_date)

            # Read and verify
            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                row = next(reader)

            # Expected: 74.00 - 3.50 = 70.50
            assert row["Muscle mass (kg)"] == "70.50"
            assert row["Bone mass (kg)"] == "3.50"

    def test_muscle_mass_calculation_with_missing_bone_mass(self, withings_source):
        """Test muscle mass calculation when bone mass is missing."""
        # Mock API response without bone mass
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,
                        "measures": [
                            {"type": 1, "value": 8500, "unit": -2},  # Weight: 85.00 kg
                            {"type": 5, "value": 7400, "unit": -2},  # Fat-free mass: 74.00 kg
                            # No bone mass measurement
                        ],
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_missing_bone.csv"

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_all_data_to_csv(csv_path)

            # Read and verify
            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                row = next(reader)

            # Should use fat-free mass as muscle mass when bone mass is missing
            assert row["Muscle mass (kg)"] == "74.00"
            assert row["Bone mass (kg)"] == ""  # Empty because no bone mass data

    def test_muscle_mass_calculation_with_missing_fat_free_mass(self, withings_source):
        """Test muscle mass calculation when fat-free mass is missing."""
        # Mock API response without fat-free mass
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,
                        "measures": [
                            {"type": 1, "value": 8500, "unit": -2},  # Weight: 85.00 kg
                            {"type": 88, "value": 350, "unit": -2},  # Bone mass: 3.50 kg
                            # No fat-free mass measurement
                        ],
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_missing_fat_free.csv"

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_all_data_to_csv(csv_path)

            # Read and verify
            with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                row = next(reader)

            # Should be empty when no fat-free mass data
            assert row["Muscle mass (kg)"] == ""
            assert row["Bone mass (kg)"] == "3.50"

    def test_date_format_with_quotes(self, withings_source):
        """Test that dates are formatted with quotes in CSV output."""
        api_response = {
            "status": 0,
            "body": {
                "measuregrps": [
                    {
                        "date": 1642665262,  # 2022-01-20 06:54:22 UTC
                        "measures": [
                            {"type": 1, "value": 8500, "unit": -2},  # Weight: 85.00 kg
                        ],
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_date_format.csv"

            with patch.object(withings_source, "_make_request", return_value=api_response):
                withings_source.import_all_data_to_csv(csv_path)

            # Read raw content to check date format
            with open(csv_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Verify date has quotes and is in the right format (may be different time due to timezone)
            assert re.search(
                r'"2022-01-20 \d{2}:\d{2}:\d{2}"', content
            ), f"Expected quoted date format not found in: {content}"

    def test_csv_loading_handles_quoted_dates(self, withings_source):
        """Test that CSV loading correctly handles dates with quotes."""
        # Create a test CSV with quoted dates
        test_csv_content = """
Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments
"2022-01-20 06:54:22",85.00,13.00,3.50,70.50,49.00,
"2022-01-19 06:54:22",84.50,12.80,3.45,70.25,48.80,
"""

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "test_quoted_dates.csv"

            # Write test CSV
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write(test_csv_content)

            # Test loading
            existing_timestamps, existing_data = withings_source._load_existing_csv_data(csv_path)

            # Verify dates were parsed correctly
            assert len(existing_timestamps) == 2
            assert len(existing_data) == 2

            # Check specific dates
            expected_date1 = datetime(2022, 1, 20, 6, 54, 22)
            expected_date2 = datetime(2022, 1, 19, 6, 54, 22)

            assert expected_date1 in existing_timestamps
            assert expected_date2 in existing_timestamps

            # Verify data was parsed correctly
            assert existing_data[expected_date1]["weight_kg"] == 85.00
            assert existing_data[expected_date1]["muscle_mass_kg"] == 70.50

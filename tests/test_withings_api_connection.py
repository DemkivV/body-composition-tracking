"""Manual test for Withings API connection (requires valid authentication token)."""

import tempfile
from pathlib import Path

import pytest

from body_comp_tracking.config import get_withings_credentials
from body_comp_tracking.data_sources.withings_source import WithingsAuth, WithingsSource


# @pytest.mark.skip(
#     reason="This test is currently disabled and needs manual intervention."
# )
def test_withings_api_connection_manual():
    """Manual test for Withings API connection.

    This test requires a valid authentication token and should be run manually.
    """
    # Get Withings credentials
    credentials = get_withings_credentials()
    if not credentials or not credentials.get("client_id"):
        pytest.skip("Withings credentials not available")

    # Initialize auth
    auth = WithingsAuth(client_id=credentials["client_id"], client_secret=credentials["client_secret"])

    # Check if we have a valid token
    try:
        token = auth.get_token()
        if not token:
            pytest.skip("No valid authentication token available")
    except ValueError:
        pytest.skip("No valid authentication token available")

    # Initialize source
    source = WithingsSource(auth)

    # Create a temporary CSV file
    with tempfile.TemporaryDirectory() as temp_dir:
        csv_path = Path(temp_dir) / "test_withings_data.csv"

        # Try to import data
        num_measurements = source.import_all_data_to_csv(csv_path)

        # Verify the file was created and contains data
        assert csv_path.exists(), "CSV file should be created"

        # Read the file content
        content = csv_path.read_text()
        lines = content.strip().split("\n")

        # Check the header
        header = lines[0]
        expected_columns = [
            "Date",
            "Weight (kg)",
            "Fat mass (kg)",
            "Bone mass (kg)",
            "Muscle mass (kg)",
            "Hydration (kg)",
            "Comments",
        ]
        for col in expected_columns:
            assert col in header, f"Header should contain '{col}'"

        # If we have measurements, check that we got some data
        if num_measurements > 0:
            assert len(lines) > 1, "Should have data rows beyond header"
            print(f"Successfully imported {num_measurements} measurements")
            print(f"CSV file created at: {csv_path}")
            print("First few lines of CSV:")
            for i, line in enumerate(lines[:5]):
                print(f"  {i+1}: {line}")
        else:
            print("No measurements found in the API response")


if __name__ == "__main__":
    # Allow running this test directly
    test_withings_api_connection_manual()

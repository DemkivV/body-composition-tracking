"""Command-line interface for body composition tracking."""

import json
import logging
import sys
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import click
from tabulate import tabulate

from .config import get_withings_credentials, set_withings_credentials
from .data_sources.withings_source import WithingsAuth, WithingsSource

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@click.group()
def cli() -> None:
    """Body Composition Tracking CLI."""
    pass


@cli.group()
def config() -> None:
    """Handle configuration commands."""
    pass


@config.command()
@click.option(
    "--client-id", prompt="Withings Client ID", help="Your Withings Client ID"
)
@click.option(
    "--client-secret",
    prompt="Withings Client Secret",
    hide_input=True,
    help="Your Withings Client Secret",
)
@click.option(
    "--redirect-uri",
    default="http://localhost:8000/callback",
    help="Redirect URI (default: http://localhost:8000/callback)",
)
def setup_withings(client_id: str, client_secret: str, redirect_uri: str) -> None:
    """Configure Withings API credentials."""
    set_withings_credentials(client_id, client_secret, redirect_uri)
    click.echo("✅ Withings credentials configured successfully!")


@cli.command()
def auth_withings() -> int:
    """Authenticate with Withings API."""
    creds = get_withings_credentials()
    if not creds["client_id"] or not creds["client_secret"]:
        click.echo(
            "❌ Please configure Withings credentials first using "
            "'config setup-withings'"
        )
        return 1

    try:
        auth = WithingsAuth(**creds)
        click.echo("🔑 Starting authentication process...")
        auth.authenticate()
        click.echo("✅ Successfully authenticated with Withings!")
        return 0
    except Exception as e:
        logger.error("Failed to authenticate: %s", str(e))
        click.echo(f"❌ Failed to authenticate: {str(e)}")
        return 1


@cli.command()
@click.option(
    "--days", default=30, help="Number of days of data to fetch (default: 30)"
)
@click.option(
    "--output", type=click.Path(), help="Output file path to save data as JSON"
)
@click.option(
    "--format",
    type=click.Choice(["table", "json", "csv"], case_sensitive=False),
    default="table",
    help="Output format (default: table)",
)
def _format_measurements(measurements: List[Dict[str, Any]], format_type: str) -> str:
    """Format measurements based on the specified format type."""
    if format_type == "table":
        return tabulate(
            measurements,
            headers="keys",
            tablefmt="grid",
            floatfmt=".2f",
        )
    if format_type == "json":
        return json.dumps(measurements, indent=2)

    # Handle CSV format
    import csv
    from io import StringIO

    output = StringIO()
    fieldnames = measurements[0].keys() if measurements else []
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(measurements)
    return output.getvalue()


def show_measurements(days: int, output: Optional[str], format_type: str) -> int:
    """Show recent body composition measurements.

    Args:
        days: Number of days of measurements to show
        output: Output file path (optional)
        format_type: Output format (table, json, csv)
    """
    creds = get_withings_credentials()
    if not creds["client_id"] or not creds["client_secret"]:
        click.echo(
            "❌ Please configure Withings credentials first using 'config setup-withings'"  # noqa: E501
        )
        return 1

    try:
        # Initialize auth and source
        auth = WithingsAuth(**creds)
        source = WithingsSource(auth)

        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        click.echo(
            f"📊 Fetching measurements from {start_date.date()} to {end_date.date()}..."  # noqa: E501
        )

        # Get measurements
        measurements = source.get_measurements(start_date, end_date)

        if not measurements:
            click.echo(f"ℹ️ No measurements found in the last {days} days.")
            return 0

        # Sort by date descending
        measurements.sort(key=lambda x: x.timestamp, reverse=True)

        # Format measurements for display
        formatted_measurements = [
            {
                "Date": m.timestamp.strftime("%Y-%m-%d %H:%M"),
                "Weight (kg)": m.weight_kg,
                "Body Fat (%)": m.body_fat_percent,
                "Muscle Mass (kg)": m.muscle_mass_kg,
                "Hydration (%)": m.hydration_percent,
                "Bone Mass (kg)": m.bone_mass_kg,
                "Source": m.source,
            }
            for m in measurements
        ]

        # Get output in requested format
        output_str = _format_measurements(formatted_measurements, format_type)

        # Output to file or console
        if output:
            with open(output, "w") as f:
                f.write(output_str)
            click.echo(f"✅ Data saved to {output}")
        else:
            click.echo(output_str)

        return 0

    except Exception as e:
        logger.error(f"Error fetching measurements: {str(e)}", exc_info=True)
        click.echo(f"❌ Error: {str(e)}", err=True)
        return 1


if __name__ == "__main__":
    sys.exit(cli())

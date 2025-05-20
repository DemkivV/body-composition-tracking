"""
Command-line interface for body composition tracking.
"""
import os
import sys
import json
import click
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from tabulate import tabulate

from .config import get_withings_credentials, set_withings_credentials
from .data_sources.withings_source import WithingsAuth, WithingsSource
from .models import BodyMeasurement

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@click.group()
def cli():
    """Body Composition Tracking CLI."""
    pass


@cli.group()
def config():
    """Configuration commands."""
    pass


@config.command()
@click.option('--client-id', prompt='Withings Client ID', help='Your Withings Client ID')
@click.option('--client-secret', prompt='Withings Client Secret', hide_input=True, help='Your Withings Client Secret')
@click.option('--redirect-uri', default='http://localhost:8000/callback', 
              help='Redirect URI (default: http://localhost:8000/callback)')
def setup_withings(client_id: str, client_secret: str, redirect_uri: str):
    """Configure Withings API credentials."""
    set_withings_credentials(client_id, client_secret, redirect_uri)
    click.echo("✅ Withings credentials configured successfully!")


@cli.command()
def auth_withings():
    """Authenticate with Withings API."""
    creds = get_withings_credentials()
    if not creds["client_id"] or not creds["client_secret"]:
        click.echo("❌ Please configure Withings credentials first using 'config setup-withings'")
        return 1
    
    try:
        auth = WithingsAuth(**creds)
        click.echo("🔑 Starting authentication process...")
        auth.authenticate()
        click.echo("✅ Successfully authenticated with Withings!")
        return 0
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        click.echo(f"❌ Authentication failed: {str(e)}")
        return 1


@cli.command()
@click.option('--days', default=30, help='Number of days of data to fetch (default: 30)')
@click.option('--output', type=click.Path(), help='Output file path to save data as JSON')
@click.option('--format', type=click.Choice(['table', 'json', 'csv'], case_sensitive=False), 
              default='table', help='Output format (default: table)')
def show_measurements(days: int, output: Optional[str], format: str):
    """Show recent body composition measurements."""
    creds = get_withings_credentials()
    if not creds["client_id"] or not creds["client_secret"]:
        click.echo("❌ Please configure Withings credentials first using 'config setup-withings'")
        return 1
    
    try:
        # Initialize auth and source
        auth = WithingsAuth(**creds)
        source = WithingsSource(auth)
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        click.echo(f"📊 Fetching measurements from {start_date.date()} to {end_date.date()}...")
        
        # Get measurements
        measurements = source.get_measurements(start_date, end_date)
        
        if not measurements:
            click.echo("ℹ️ No measurements found in the specified date range.")
            return 0
            
        # Sort by date descending
        measurements.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Prepare output data
        output_data = []
        for m in measurements:
            output_data.append({
                'timestamp': m.timestamp.isoformat(),
                'weight_kg': m.weight_kg,
                'body_fat_percent': m.body_fat_percent,
                'muscle_mass_kg': m.muscle_mass_kg,
                'hydration_percent': m.hydration_percent,
                'bone_mass_kg': m.bone_mass_kg,
                'source': m.source
            })
            
        # Output to file if specified
        if output:
            with open(output, 'w') as f:
                json.dump(output_data, f, indent=2)
            click.echo(f"💾 Saved {len(measurements)} measurements to {output}")
        
        # Output to console based on format
        if format == 'table':
            # Prepare table data
            table_data = []
            for m in measurements:
                table_data.append([
                    m.timestamp.strftime('%Y-%m-%d %H:%M'),
                    f"{m.weight_kg:.1f} kg" if m.weight_kg is not None else "N/A",
                    f"{m.body_fat_percent:.1f}%" if m.body_fat_percent is not None else "N/A",
                    f"{m.muscle_mass_kg:.1f} kg" if m.muscle_mass_kg is not None else "N/A",
                    f"{m.hydration_percent:.1f}%" if m.hydration_percent is not None else "N/A",
                    f"{m.bone_mass_kg:.1f} kg" if m.bone_mass_kg is not None else "N/A"
                ])
            
            # Display table
            headers = ["Date", "Weight", "Body Fat", "Muscle Mass", "Hydration", "Bone Mass"]
            click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))
        elif format == 'json':
            click.echo(json.dumps(output_data, indent=2))
        elif format == 'csv':
            import csv
            import io
            
            # Convert to CSV
            output = io.StringIO()
            if output_data:
                writer = csv.DictWriter(output, fieldnames=output_data[0].keys())
                writer.writeheader()
                writer.writerows(output_data)
            click.echo(output.getvalue())
        
        return 0
        
    except Exception as e:
        logger.error(f"Error fetching measurements: {str(e)}", exc_info=True)
        click.echo(f"❌ Error: {str(e)}", err=True)
        return 1


if __name__ == "__main__":
    sys.exit(cli())

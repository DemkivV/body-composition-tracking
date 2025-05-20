"""
Command-line interface for body composition tracking.
"""
import sys
import webbrowser
from datetime import datetime, timedelta
from typing import List, Optional

import click
from tabulate import tabulate

from .config import get_withings_credentials, set_withings_credentials
from .data_sources.withings_source import WithingsAuth, WithingsSource
from .models import BodyMeasurement


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
@click.option('--redirect-uri', help='Redirect URI (default: http://localhost:8000/callback)')
def setup_withings(client_id: str, client_secret: str, redirect_uri: Optional[str] = None):
    """Configure Withings API credentials."""
    set_withings_credentials(client_id, client_secret, redirect_uri)
    click.echo("✅ Withings credentials configured successfully!")


@cli.command()
def auth_withings():
    """Authenticate with Withings API."""
    creds = get_withings_credentials()
    if not creds["client_id"] or not creds["client_secret"]:
        click.echo("❌ Please configure Withings credentials first using 'config setup-withings'")
        return
    
    auth = WithingsAuth(**creds)
    auth_url = auth.get_auth_url()
    
    click.echo("Opening browser for Withings authentication...")
    webbrowser.open(auth_url)
    
    click.echo("\nAfter authorizing, you'll be redirected to a local URL.")
    click.echo("Please paste that URL here:")
    redirect_url = click.prompt("Redirect URL")
    
    try:
        token = auth.fetch_token(redirect_url)
        click.echo("✅ Successfully authenticated with Withings!")
        # Here you would typically store the token securely
    except Exception as e:
        click.echo(f"❌ Authentication failed: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.option('--days', default=30, help='Number of days of data to fetch (default: 30)')
def show_measurements(days: int):
    """Show recent body composition measurements."""
    creds = get_withings_credentials()
    if not creds["client_id"] or not creds["client_secret"]:
        click.echo("❌ Please configure Withings credentials first using 'config setup-withings'")
        return
    
    # TODO: Load token from secure storage
    auth = WithingsAuth(**creds)
    source = WithingsSource(auth)
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    try:
        measurements = source.get_measurements(start_date, end_date)
        if not measurements:
            click.echo("No measurements found in the specified date range.")
            return
            
        # Sort by date descending
        measurements.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Prepare table data
        table_data = []
        for m in measurements:
            table_data.append([
                m.timestamp.strftime('%Y-%m-%d %H:%M'),
                f"{m.weight_kg:.1f} kg" if m.weight_kg else "N/A",
                f"{m.body_fat_percent:.1f}%" if m.body_fat_percent else "N/A",
                f"{m.muscle_mass_kg:.1f} kg" if m.muscle_mass_kg else "N/A",
                f"{m.hydration_percent:.1f}%" if m.hydration_percent else "N/A",
                f"{m.bone_mass_kg:.1f} kg" if m.bone_mass_kg else "N/A"
            ])
        
        # Display table
        headers = ["Date", "Weight", "Body Fat", "Muscle Mass", "Hydration", "Bone Mass"]
        click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))
        
    except Exception as e:
        click.echo(f"❌ Error fetching measurements: {str(e)}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    cli()

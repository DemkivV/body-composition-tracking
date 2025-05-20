"""
Configuration management for the application.
"""
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional

DEFAULT_CONFIG = {
    "withings": {
        "client_id": "",
        "client_secret": "",
        "redirect_uri": "http://localhost:8000/callback",
    },
    "data_dir": "data"
}

CONFIG_DIR = Path.home() / ".body_comp_tracking"
CONFIG_FILE = CONFIG_DIR / "config.json"


def ensure_config_dir() -> None:
    """Ensure the configuration directory exists."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> Dict[str, Any]:
    """Load the configuration file.
    
    Returns:
        Dict containing the configuration
    """
    ensure_config_dir()
    
    if not CONFIG_FILE.exists():
        # Create default config if it doesn't exist
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            # Ensure all default values are present
            for key, value in DEFAULT_CONFIG.items():
                if key not in config:
                    config[key] = value
            return config
    except (json.JSONDecodeError, IOError):
        # If there's an error reading the config, return defaults
        return DEFAULT_CONFIG.copy()


def save_config(config: Dict[str, Any]) -> None:
    """Save the configuration to file.
    
    Args:
        config: Configuration dictionary to save
    """
    ensure_config_dir()
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)


def get_withings_credentials() -> Dict[str, str]:
    """Get Withings API credentials from config.
    
    Returns:
        Dict with client_id, client_secret, and redirect_uri
    """
    config = load_config()
    return {
        "client_id": config["withings"]["client_id"],
        "client_secret": config["withings"]["client_secret"],
        "redirect_uri": config["withings"]["redirect_uri"]
    }


def set_withings_credentials(client_id: str, client_secret: str, redirect_uri: Optional[str] = None) -> None:
    """Set Withings API credentials in config.
    
    Args:
        client_id: Withings client ID
        client_secret: Withings client secret
        redirect_uri: Optional redirect URI (defaults to config value)
    """
    config = load_config()
    config["withings"]["client_id"] = client_id
    config["withings"]["client_secret"] = client_secret
    if redirect_uri:
        config["withings"]["redirect_uri"] = redirect_uri
    save_config(config)

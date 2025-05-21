"""Configuration management for the application."""

import json
import logging
import os
from typing import Any, Dict

# Configure logging
logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_CONFIG = {
    "withings": {
        "client_id": "",
        "client_secret": "",
        "redirect_uri": "http://localhost:8000/callback",
    },
    "general": {"data_dir": "~/.local/share/body_comp_tracking"},
}


def get_config_dir() -> str:
    """
    Get the configuration directory path.

    Returns:
        str: Path to the configuration directory
    """
    config_dir: str
    try:
        import appdirs

        config_dir = appdirs.user_config_dir("body_comp_tracking")
    except ImportError:
        # Fallback to a default directory if appdirs is not available
        config_dir = os.path.join(
            os.path.expanduser("~"), ".config", "body_comp_tracking"
        )

    os.makedirs(config_dir, exist_ok=True)
    return config_dir


def get_config_path() -> str:
    """
    Get the path to the configuration file.

    Returns:
        str: Path to the configuration file
    """
    return os.path.join(get_config_dir(), "config.json")


def load_config() -> Dict[str, Any]:
    """
    Load the configuration from file.

    Returns:
        Dict containing the configuration
    """
    config_path = get_config_path()
    if not os.path.exists(config_path):
        return DEFAULT_CONFIG.copy()

    try:
        with open(config_path, "r") as f:
            config_data = json.load(f)
            if not isinstance(config_data, dict):
                raise json.JSONDecodeError("Expected a JSON object", "", 0)

            # Ensure all default values are present
            config = DEFAULT_CONFIG.copy()
            for key, value in config_data.items():
                if (
                    isinstance(value, dict)
                    and key in config
                    and isinstance(config[key], dict)
                ):
                    config[key].update(value)
                else:
                    config[key] = value
            return config
    except (json.JSONDecodeError, IOError) as e:
        logger.error("Failed to load config: %s", e)
        return DEFAULT_CONFIG.copy()


def save_config(config: Dict[str, Any]) -> None:
    """
    Save the configuration to the config file.

    Args:
        config: Configuration dictionary to save
    """
    config_path = get_config_path()
    try:
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)
        # Set restrictive permissions
        os.chmod(config_path, 0o600)
    except IOError as e:
        logger.error(f"Failed to save config: {e}")
        raise


def get_withings_credentials() -> Dict[str, str]:
    """
    Get Withings API credentials from config file.

    Returns:
        Dict containing client_id, client_secret, and redirect_uri
    """
    config = load_config()
    withings_config = config.get("withings", {})

    return {
        "client_id": withings_config.get("client_id", ""),
        "client_secret": withings_config.get("client_secret", ""),
        "redirect_uri": withings_config.get(
            "redirect_uri", "http://localhost:8000/callback"
        ),
    }


def set_withings_credentials(
    client_id: str, client_secret: str, redirect_uri: str
) -> None:
    """
    Save Withings API credentials to config file.

    Args:
        client_id: Withings API client ID
        client_secret: Withings API client secret
        redirect_uri: OAuth redirect URI
    """
    config = load_config()

    # Update or create the withings section
    config["withings"] = {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri or "http://localhost:8000/callback",
    }

    save_config(config)


def get_token_storage_dir() -> str:
    """
    Get the directory for storing OAuth tokens.

    Returns:
        str: Path to the token storage directory
    """
    token_dir = os.path.join(get_config_dir(), "tokens")
    os.makedirs(token_dir, exist_ok=True)
    return token_dir

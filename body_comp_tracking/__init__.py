"""Tool to track and analyze body composition metrics."""

__version__ = "0.1.0"

from .config import (
    get_config_dir,
    get_config_path,
    get_token_storage_dir,
    get_withings_credentials,
    load_config,
    save_config,
    set_withings_credentials,
)
from .data_sources.withings_source import WithingsAuth, WithingsSource
from .models import BodyMeasurement

# Define what gets imported with 'from body_comp_tracking import *'
__all__ = [
    "BodyMeasurement",
    "WithingsAuth",
    "WithingsSource",
    "get_config_dir",
    "get_config_path",
    "load_config",
    "save_config",
    "get_withings_credentials",
    "set_withings_credentials",
    "get_token_storage_dir",
]

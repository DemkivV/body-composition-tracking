"""
Body Composition Tracking - A tool to track and analyze body composition metrics.
"""

__version__ = "0.1.0"

# Import main classes and functions to make them available at the package level
from .models import BodyMeasurement
from .data_sources.withings_source import WithingsAuth, WithingsSource
from .config import (
    get_config_dir,
    get_config_path,
    load_config,
    save_config,
    get_withings_credentials,
    set_withings_credentials,
    get_token_storage_dir
)

# Define what gets imported with 'from body_comp_tracking import *'
__all__ = [
    'BodyMeasurement',
    'WithingsAuth',
    'WithingsSource',
    'get_config_dir',
    'get_config_path',
    'load_config',
    'save_config',
    'get_withings_credentials',
    'set_withings_credentials',
    'get_token_storage_dir'
]

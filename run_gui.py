#!/usr/bin/env python3
"""Run the body-comp-tracking GUI without installing the package."""

import sys
from pathlib import Path

from body_comp_tracking.gui.app import main

# Add the project root to the Python path
project_root = Path(__file__).parent.absolute()
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    main()

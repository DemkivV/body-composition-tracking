"""Data models for body composition tracking."""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Protocol, runtime_checkable


@dataclass
class BodyMeasurement:
    """A single body measurement."""

    timestamp: datetime
    weight_kg: Optional[float] = None
    body_fat_percent: Optional[float] = None
    source: str = "unknown"


@runtime_checkable
class DataSource(Protocol):
    """Protocol for data sources.

    This allows us to easily swap different data sources while maintaining
    the same interface.
    """

    def get_measurements(self, start_date: datetime, end_date: datetime) -> List[BodyMeasurement]:
        """Retrieve body measurements for the given date range.

        Args:
            start_date: Start of the date range (inclusive)
            end_date: End of the date range (inclusive)

        Returns:
            List of body measurements
        """
        ...

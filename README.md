# Body Composition Tracker

A Python tool to track and analyze body composition metrics from various sources like Withings smart scales.

## Features

- 📊 Track weight, body fat percentage, muscle mass, hydration, and bone mass
- 🔄 Support for multiple data sources (currently Withings)
- 📈 View measurements in a clean tabular format
- 🔐 Secure OAuth2 authentication
- 🧪 Test-driven development with comprehensive test coverage
- 🛠️ Modular architecture for easy extension

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd body-composition-tracking
   ```

2. Create and activate a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the package in development mode:
   ```bash
   pip install -e .
   ```

## Configuration

1. Register an application in the [Withings Developer Portal](https://account.withings.com/partner/dashboard)
2. Configure the application with a redirect URI (e.g., `http://localhost:8000/callback`)
3. Set up your credentials:
   ```bash
   body-comp config setup-withings
   ```
   Follow the prompts to enter your Withings API credentials.

## Usage

### Authenticate with Withings

```bash
body-comp auth-withings
```

This will open a browser window for you to log in to your Withings account and authorize the application.

### View Measurements

Show recent measurements (last 30 days by default):
```bash
body-comp show-measurements
```

Show measurements for a specific date range (e.g., last 60 days):
```bash
body-comp show-measurements --days 60
```

## Development

### Running Tests

```bash
python -m pytest tests/
```

### Code Style

This project uses:
- Black for code formatting
- isort for import sorting
- flake8 for linting
- mypy for type checking

Run all code quality checks:
```bash
black .
isort .
flake8
mypy .
```

## Architecture

The application is built with modularity in mind:

- `body_comp_tracking/models/`: Data models and interfaces
- `body_comp_tracking/data_sources/`: Data source implementations
- `body_comp_tracking/visualization/`: Data visualization components
- `body_comp_tracking/cli.py`: Command-line interface
- `tests/`: Unit and integration tests

## License

MIT

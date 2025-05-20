# Body Composition Tracker

A Python tool to track and analyze body composition metrics from various sources like Withings smart scales.

## Features

- 📊 Track weight, body fat percentage, muscle mass, hydration, and bone mass
- 🔄 Support for Withings API with OAuth 2.0 authentication
- 🔄 Automatic token refresh and secure storage
- 📈 View measurements in clean tabular, JSON, or CSV formats
- 🚀 Command-line interface for easy integration with scripts and automation
- 🔐 Secure credential and token storage
- 🧪 Comprehensive test coverage
- 🛠️ Modular architecture for easy extension

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [License](#license)

## Installation

### From PyPI (Coming Soon)

```bash
pip install body-comp-tracking
```

### From Source

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd body-composition-tracking
   ```

2. Create and activate a virtual environment (recommended):
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Unix or MacOS:
   source venv/bin/activate
   ```

3. Install the package in development mode with all dependencies:
   ```bash
   pip install -e ".[dev]"
   ```

## Configuration

### Withings API Setup

1. Register an application in the [Withings Developer Portal](https://account.withings.com/partner/dashboard)
2. For local development, use the following redirect URI: `http://localhost:8000/callback`
   - This is the default and works with the built-in OAuth flow
   - No need to expose a public endpoint for the OAuth callback

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

This will:
1. Open a browser window for you to log in to your Withings account
2. Request permissions to access your health data
3. Store the authentication tokens securely on your machine

### View Your Measurements

Show recent measurements (default: last 30 days):

```bash
body-comp show-measurements
```

Show measurements from the last 90 days:

```bash
body-comp show-measurements --days 90
```

### Output Formats

#### Table (default)

```bash
body-comp show-measurements --format table
```

#### JSON

```bash
body-comp show-measurements --format json
```

#### CSV

```bash
body-comp show-measurements --format csv
```

### Save Output to File

```bash
body-comp show-measurements --output measurements.json --format json
```

## Development

### Running Tests

```bash
pytest
```

### Code Style

Format code with Black and isort:

```bash
black .
isort .
```

Check code style with flake8:

```bash
flake8
```

### Type Checking

```bash
mypy .
```

### Building the Package

```bash
python -m build
```

## License

MIT - See [LICENSE](LICENSE) for more information.

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

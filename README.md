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

1. The first time you use the tool, you'll be guided through the authentication process.
2. When you run the `auth-withings` command, it will:
   - Open a browser window for you to log in to your Withings account
   - Request necessary permissions to access your health data
   - Store the authentication tokens securely on your machine
   - No manual application registration is required - we use a standard OAuth flow with a local callback server

3. The authentication tokens will be stored securely and automatically refreshed when needed, so you only need to authenticate once.

## Usage

### Authenticate with Withings

To get started, you'll need to authenticate with your Withings account:

```bash
body-comp auth-withings
```

This will:
1. Start a local server to handle the OAuth callback
2. Open your default web browser to the Withings login page
3. After logging in and granting permissions, you'll be redirected back to the local server
4. The authentication tokens will be securely stored on your machine
5. The tokens will be automatically refreshed when needed

You only need to run this command once - the tokens will be stored securely and reused for future sessions.

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

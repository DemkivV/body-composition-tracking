# Body Composition Tracker

> **⚠️ Experimental Project Notice**
> This project is currently **in active development** and should be considered experimental.
> It's part of a "vibe coding" experiment, so please use it with caution.
> The code and features may change significantly as development continues.
>
> While the repository is public, it's not yet recommended for production use.

## 🎯 Project Goal

Body Composition Tracker is designed to provide deeper insights into your body composition data through advanced visualization techniques. Unlike commercial health apps that use simple time-series plots with fixed scales, this tool offers:

- **Cycle-Based Analysis**: Compare multiple training or menstrual cycles overlaid on the same timescale to identify recurring patterns
- **Pattern Recognition**: Spot consistent trends and relationships between different cycles that would be invisible in traditional plots
- **Custom Scaling**: Dynamic Y-axis scaling that focuses on meaningful ranges for better visibility of changes
- **Noise Reduction**: Separate signal from daily fluctuations to see the true trajectory of your progress

### The Power of Cycle-Based Visualization

Traditional weight tracking shows data in a continuous timeline, which can obscure important patterns that repeat across cycles. By aligning and overlaying multiple cycles (training blocks, menstrual cycles, etc.), you can:

- Identify if weight fluctuations follow a predictable pattern within each cycle
- Compare progress between similar points in different cycles (e.g., start/end of mesocycles)
- Detect if you're consistently gaining/losing weight at specific cycle phases
- Visualize if your progress is linear or follows a different pattern across cycles

This approach transforms raw weight data into actionable insights about your body's response to training and nutrition over time.

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

This application uses OAuth 2.0 to securely access your Withings data. To maintain privacy and security, each user needs to register their own application with Withings. This approach ensures that you maintain complete control over your health data.

#### Registering Your Application

1. Go to the [Withings Developer Portal](https://account.withings.com/partner/add_oauth2)
2. Log in with your Withings account
3. Fill in the application details:
   - **Application Name**: Choose a name (e.g., "My Body Comp Tracker")
   - **Description**: Optional description of your use case
   - **Contact email**: Your email address
   - **Application website**: You can use a placeholder like `https://example.com`
   - **Callback URL**: `http://localhost:8000/callback`
   - **Company name**: Your name or organization
   - **Sector**: Select "Other"
4. After submission, you'll receive your **Client ID** and **Client Secret**

#### First-Time Authentication

1. The first time you run the `auth-withings` command, you'll be prompted to enter your Client ID and Client Secret.
2. The tool will then guide you through the authentication process:
   - Open a browser window for you to log in to your Withings account
   - Request necessary permissions to access your health data
   - Store the authentication tokens securely on your machine

3. The authentication tokens will be stored securely and automatically refreshed when needed, so you only need to authenticate once.

> **🔒 Data Privacy Note**: By registering your own application, you maintain full control over your health data. Your credentials and tokens are stored only on your local machine and are never transmitted to any third-party servers.

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

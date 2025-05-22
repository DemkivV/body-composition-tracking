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

- **Cross-platform Support**: Works on Windows, macOS, and Linux
- **Multiple Data Sources**:
  - Withings API integration
  - (More data sources coming soon)
- **Data Visualization**: View your body composition metrics over time
- **Export Options**: Export your data in various formats (JSON, CSV)
- **Command Line Interface (CLI)**: Full-featured CLI for power users and automation
- **Graphical User Interface (GUI)**: User-friendly interface for visual data exploration

## Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installing the Package

1. **Install the package** using pip:

   ```bash
   pip install body-comp-tracking
   ```

2. **For GUI Support**:

   The GUI uses native WebView components on each platform. Install the appropriate backend:

   - **Windows (recommended)**:
     ```bash
     pip install pywebview[edgechromium]  # For Edge WebView2 (recommended)
     # OR
     pip install pywebview[winforms]      # For MSHTML (built into Windows)
     ```

   - **macOS**:
     ```bash
     pip install pywebview[cocoa]
     ```

   - **Linux**:
     ```bash
     # For GTK-based environments (GNOME, XFCE, etc.)
     pip install pywebview[gtk]

     # OR for Qt-based environments (KDE, etc.)
     pip install pywebview[qt]  # Requires PyQt5 or PySide2
     ```

   You can also install the package with GUI dependencies directly:
   ```bash
   pip install "body-comp-tracking[gui]"
   ```

## Usage

### Command Line Interface (CLI)

```bash
# Show help
body-comp --help

# Configure Withings API credentials
body-comp config setup-withings

# Show measurements from the last 30 days
body-comp show-measurements

# Show measurements in JSON format
body-comp show-measurements --format json

# Show measurements and save to a file
body-comp show-measurements --output measurements.json
```

### Graphical User Interface (GUI)

Launch the GUI application:

```bash
# If installed with pip install "body-comp-tracking[gui]"
body-comp-gui

# Or directly via Python module
python -m body_comp_tracking.gui.app
```

#### GUI Features

1. **Data Import Tab**:
   - Authenticate with Withings API
   - Import your body composition data
   - Clear local data

2. **Raw Data Tab**:
   - View all your measurements in a sortable table
   - Export data to various formats

3. **Analysis Tab**:
   - Visualize your body composition metrics over time
   - Track progress toward your fitness goals

## Development

### Setting Up for Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/body-composition-tracking.git
   cd body-composition-tracking
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install the package in development mode with all dependencies**:
   ```bash
   pip install -e ".[dev,gui]"
   ```

4. **Install pre-commit hooks**:
   ```bash
   pre-commit install
   ```

### Running Tests

```bash
# Run all tests
pytest

# Run tests with coverage report
pytest --cov=body_comp_tracking tests/
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests.

## Acknowledgments

- Thanks to Withings for their API
- Built with ❤️ using Python and open source tools

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [License](#license)

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

## Architecture

The application is built with modularity in mind:

- `body_comp_tracking/models/`: Data models and interfaces
- `body_comp_tracking/data_sources/`: Data source implementations
- `body_comp_tracking/visualization/`: Data visualization components
- `body_comp_tracking/cli.py`: Command-line interface
- `tests/`: Unit and integration tests

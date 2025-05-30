# Contributing to Body Composition Tracker

First off, thanks for taking the time to contribute! :tada: :+1:

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

- **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/yourusername/body-composition-tracking/issues).
- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/yourusername/body-composition-tracking/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- **Ensure the enhancement was not already suggested** by searching on GitHub under [Issues](https://github.com/yourusername/body-composition-tracking/issues).
- Open a new issue and describe the enhancement you'd like to see. Explain why this enhancement would be useful.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code is properly formatted (see below).
6. Issue that pull request!

## Development Setup

### Prerequisites

- Python 3.8 or higher
- [Poetry](https://python-poetry.org/) (recommended) or pip
- Git

### Installation

1. Fork and clone the repository

   ```bash
   git clone https://github.com/yourusername/body-composition-tracking.git
   cd body-composition-tracking
   ```

2. Set up a virtual environment and install dependencies:

   ```bash
   # Using Poetry (recommended)
   poetry install

   # Or using pip
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -e ".[dev]"
   ```

### Code Style

This project uses:

- **Black** for code formatting
- **isort** for import sorting
- **flake8** for linting
- **mypy** for type checking

Run all checks before committing:

```bash
# Using pre-commit (recommended)
pre-commit install  # Only needed once
pre-commit run --all-files

# Or manually
black .
isort .
flake8
mypy .
```

### Testing

Run the test suite:

```bash
pytest
```

With coverage:

```bash
pytest --cov=body_comp_tracking --cov-report=term-missing
```

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

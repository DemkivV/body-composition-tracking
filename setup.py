from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as f:
    requirements = [line.strip() for line in f if line.strip()]

setup(
    name="body-comp-tracking",
    version="0.1.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="A tool to track and analyze body composition metrics",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/body-composition-tracking",
    packages=find_packages(exclude=["tests"]),
    package_data={
        "body_comp_tracking": ["py.typed"],
    },
    entry_points={
        "console_scripts": [
            "body-comp=body_comp_tracking.cli:cli",
        ],
    },
    install_requires=requirements,
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: End Users/Desktop",
        "Intended Audience :: Healthcare Industry",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Topic :: Scientific/Engineering :: Medical Science Apps.",
        "Topic :: Utilities",
    ],
    keywords="health fitness body-composition withings tracking",
    project_urls={
        "Bug Reports": "https://github.com/yourusername/body-composition-tracking/issues",
        "Source": "https://github.com/yourusername/body-composition-tracking",
    },
)

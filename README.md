# Body Composition Tracker

A SvelteKit web application for tracking and analyzing body composition data from Withings API.

## Features

- **Easy Setup**: Configure Withings API credentials through a user-friendly interface
- **OAuth Authentication**: Secure OAuth 2.0 integration with Withings API  
- **Data Import**: Import body composition measurements from Withings
- **Raw Data View**: Display imported measurements in tabular format
- **Analysis & Visualization**: Interactive charts and trend analysis
- **Responsive Design**: Works on desktop and mobile devices
- **Local Storage**: All data and credentials stored locally in a `data/` directory

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd svelte-body-comp-tracker
npm install
```

### 2. Start the Application

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Configure Withings API (First-time Setup)

On your first visit, you'll see a configuration screen:

1. **Get Withings API Credentials:**
   - Go to [Withings Developer Dashboard](https://developer.withings.com/dashboard/)
   - Create a new application
   - Set the redirect URI to: `http://localhost:5173/auth/callback`
   - Copy your Client ID and Client Secret

2. **Configure in the App:**
   - Enter your Client ID and Client Secret in the configuration form
   - Click "Save Configuration"
   - Your credentials are securely stored in `data/config.json`

3. **Authenticate:**
   - Click "Authenticate" to start the OAuth flow
   - You'll be redirected to Withings to authorize the app
   - After authorization, you'll be redirected back to the app
   - Your access token is stored in `data/authentication_token_withings.json`

That's it! The app is now ready to import and analyze your body composition data.

## Data Storage

All user data is stored locally in the `data/` directory:

- `data/config.json` - Your Withings API credentials
- `data/authentication_token_withings.json` - OAuth access/refresh tokens
- `data/raw_data_withings_api.csv` - Imported measurements (future feature)
- `data/raw_data_this_app.csv` - Unified data format (future feature)

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests only  
npm run test:e2e

# Build for production
npm run build
```

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: 28 tests covering stores, services, and components
- **E2E Tests**: 7 tests covering complete user workflows
- **Test Runner**: Vitest for unit tests, Playwright for E2E

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:unit

# Run E2E tests
npm run test:e2e
```

## Architecture

- **Frontend**: SvelteKit with TypeScript, TailwindCSS v4
- **Authentication**: OAuth 2.0 with Withings API
- **Configuration**: File-based storage in `data/` directory
- **State Management**: Svelte stores with reactive patterns
- **Testing**: Vitest + Testing Library + Playwright
- **Styling**: Custom CSS with glassmorphism design

## Security

- API credentials are stored locally, never transmitted
- OAuth tokens use industry-standard security practices
- File permissions are set to be readable only by the user
- No sensitive data is exposed to the browser

## Troubleshooting

### Configuration Issues
- Make sure your Withings app redirect URI matches: `http://localhost:5173/auth/callback`
- Check that your Client ID and Client Secret are correct
- Verify you have the necessary permissions on your Withings application

### Authentication Issues
- Clear your stored tokens by deleting `data/authentication_token_withings.json`
- Try the authentication flow again
- Check browser console for detailed error messages

### Development Issues
- Environment variables in `.env` are only used as fallbacks during development
- The app should work without any `.env` configuration for end users

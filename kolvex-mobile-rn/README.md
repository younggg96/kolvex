# Kolvex Mobile App

React Native mobile application for Kolvex - AI-Powered Investment Intelligence.

## Features

- **Authentication** - Secure login/signup with Supabase
- **Home Dashboard** - Market overview, trending stocks, top KOLs
- **Stocks** - Browse, search, and track stocks with sentiment analysis
- **KOLs** - Follow and track Key Opinion Leaders across platforms
- **AI Chat** - Get AI-powered investment insights
- **Profile** - Manage account settings and preferences

## Tech Stack

- **Framework**: React Native with Expo SDK 52
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context + Hooks
- **Backend**: Supabase (Auth & Database)
- **UI Components**: Custom components with Lucide icons
- **Styling**: StyleSheet with consistent design system

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

1. Install dependencies:
```bash
cd kolvex-mobile-rn
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
EXPO_PUBLIC_API_URL=https://api.kolvex.app
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Start the development server:
```bash
npm start
```

5. Run on device/simulator:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app for physical device

## Project Structure

```
kolvex-mobile-rn/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Auth screens (login, forgot-password)
│   ├── (tabs)/            # Main tab screens
│   ├── stock/             # Stock detail screen
│   ├── kol/               # KOL detail screen
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   ├── auth/             # Auth components
│   └── ...
├── constants/            # Theme, colors, config
├── hooks/               # Custom React hooks
├── lib/                 # Utilities, API, Supabase client
└── assets/              # Images, fonts
```

## Design System

The app follows the same design system as the web application:

- **Primary Color**: `#00C805` (Kolvex Green)
- **Dark Mode**: Automatic system preference detection
- **Typography**: System fonts with consistent sizing
- **Spacing**: 4px base unit (xs: 4, sm: 8, md: 12, lg: 16, xl: 20)

## Building for Production

### iOS
```bash
npx expo build:ios
# or with EAS Build
npx eas build --platform ios
```

### Android
```bash
npx expo build:android
# or with EAS Build
npx eas build --platform android
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run linting: `npm run lint`
4. Run type check: `npm run type-check`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

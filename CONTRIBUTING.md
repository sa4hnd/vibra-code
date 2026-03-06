# Contributing to Vibra Code

Thank you for your interest in contributing to Vibra Code! This guide covers everything you need to get started.

## Prerequisites

- **Node.js 20+** and npm
- **Yarn** (for mobile app)
- **Xcode 16+** with iOS Simulator (for iOS development)
- **CocoaPods** (`gem install cocoapods`)
- **Git**

## API Keys

You will need accounts and API keys from the following services:

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Anthropic** | Claude AI agent for code generation | https://console.anthropic.com |
| **E2B** | Cloud sandboxes for code execution | https://e2b.dev |
| **Clerk** | Authentication (shared between mobile & web) | https://clerk.com |
| **Convex** | Real-time database | https://convex.dev |
| **Stripe** | Web payment processing | https://stripe.com |
| **RevenueCat** | Mobile in-app purchases | https://revenuecat.com |
| **AssemblyAI** | Speech-to-text for voice input | https://assemblyai.com |

### Backend Environment Variables

Create `vibracode-backend/.env.local`:

```
ANTHROPIC_API_KEY=
E2B_API_KEY=
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Mobile Environment Variables

Create `vibracode-mobile/apps/expo-go/.env`:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CONVEX_URL=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_V0_API_URL=http://localhost:3000
```

## Running Locally

### Backend

```bash
cd vibracode-backend

# Install dependencies
npm install

# Deploy Convex schema (first time only)
npx convex deploy

# Start full stack (Next.js with Turbopack + Inngest dev server)
npm run start

# Or start just Next.js
npm run dev

# Or start just Inngest
npx inngest-cli@latest dev
```

The backend runs at `http://localhost:3000`.

### Mobile App

```bash
cd vibracode-mobile/apps/expo-go

# Install JS dependencies
yarn install

# Install iOS native dependencies
cd ios && pod install && cd ..

# Start Metro bundler (must be port 80)
yarn start
```

Then open `ios/Exponent.xcworkspace` in Xcode and build to a simulator or device.

**Important:** Set `DEV_KERNEL_SOURCE=LOCAL` in `EXBuildConstants.plist` for local development builds.

### Running Tests

```bash
# Mobile app tests
cd vibracode-mobile/apps/expo-go
yarn test

# Lint
yarn lint

# Backend lint
cd vibracode-backend
npm run lint
```

## Pull Request Process

1. **Fork the repository** and create a feature branch from `main`
2. **Make your changes** with clear, focused commits
3. **Run tests and linting** before submitting
4. **Open a PR** against `main` with:
   - A clear title describing the change
   - Description of what changed and why
   - Screenshots for UI changes
   - Link to any related issues
5. **Address review feedback** promptly

### PR Guidelines

- Keep PRs focused on a single concern
- Avoid mixing refactors with feature work
- Update documentation if you change behavior
- Add tests for new functionality

## Code Style

### General

- Use TypeScript for all new backend and React Native code
- Use Objective-C for native iOS menu system code (the `ios/Client/Menu/` directory)
- Follow existing patterns in the codebase

### iOS Native Code

The native chat UI uses Texture (AsyncDisplayKit) + IGListKit for performance:

- All chat nodes extend `ASCellNode`
- Layout uses `ASLayoutSpec` (not Auto Layout)
- Image loading uses SDWebImage
- Animations use spring timing with `UIView.animate(springDuration:)`
- Target iOS 26+ with modern APIs

### Backend

- Convex functions follow the existing schema patterns
- Inngest functions handle background processing
- API routes use Next.js App Router conventions

## Architecture Overview

See [README.md](./README.md) for the full architecture diagram. Key points:

- **Convex schema** is shared between mobile and backend via symlink
- **Session lifecycle** is managed by Inngest background functions
- **Real-time updates** flow from Convex to the mobile app
- **Cloud sandboxes** (E2B) are ephemeral and isolated

## License

By contributing to Vibra Code, you agree that your contributions will be licensed under the [AGPL-3.0 License](./LICENSE).

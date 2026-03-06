# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Standards

### Recommended MCP Tools & Skills

**Use these tools when implementing iOS features:**

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Apple Docs MCP** | Official Apple documentation lookup | API signatures, framework features, deprecations |
| **Apple HIG Skill** | Human Interface Guidelines compliance | UI design, interactions, accessibility |
| **Context7 MCP** | Library documentation | Third-party frameworks (IGListKit, Texture, etc.) |
| **Exa Search** | Code examples, debugging solutions | Stack Overflow, GitHub issues, forum answers |

**Workflow:**
1. **Before coding**: Check Apple docs for APIs
2. **During coding**: Verify HIG compliance, read Apple docs for best practices
3. **After coding**: Run audits (accessibility, performance, concurrency)

### Quality Standards

- **60fps minimum** - No frame drops, jank, or stuttering
- **HIG compliant** - Follow Apple Human Interface Guidelines strictly
- **iOS 26+ optimized** - Use newest Apple APIs and approaches
- **Battery efficient** - Anti-battery-drainage patterns mandatory
- **Thermal aware** - Minimize CPU/GPU heat generation
- **Accessibility first** - VoiceOver, Dynamic Type, Reduce Motion support

### Performance Requirements

**Every implementation must be optimal:**

```
BAD: "It works, ship it"
GOOD: "It works, AND it's:
   - Off-main-thread (Texture/GCD)
   - Memory efficient (no leaks, proper cleanup)
   - Battery friendly (no timers/polling when not needed)
   - Following Apple's recommended pattern from WWDC 2025"
```

**Before implementing ANY feature:**
1. Read Apple documentation for the recommended approach
2. Check WWDC sessions for latest best practices
3. Consider battery, memory, and thermal impact
4. Use Instruments to verify performance

### iOS 26 Best Practices

**Always prefer modern approaches:**

| Old Pattern | Modern Pattern (iOS 26+) |
|-------------|--------------------------|
| `UIBlurEffect` | `UIGlassEffect` (Liquid Glass) |
| Manual layout | `ASLayoutSpec` / SwiftUI |
| `Timer` polling | Combine / async-await observers |
| `URLSession` callbacks | `async/await` networking |
| `ObservableObject` | `@Observable` macro |
| Manual animations | Spring animations with `UIView.animate(springDuration:)` |

---

## Project Overview

**Vibra Code** is an AI-powered mobile app builder. Users describe apps in plain English, and AI builds them in cloud sandboxes with native preview on their phones.

### Repository Structure

- `vibracode-mobile/apps/expo-go/` - **Vibra Code mobile app** (modified Expo Go)
- `vibracode-backend/` - **Website and backend** (Next.js + Convex + Inngest)

## Development Commands

### vibracode-backend (Backend/Website)

```bash
cd vibracode-backend

# Start development (Next.js with Turbopack)
npm run dev

# Start full stack (Next.js + Inngest dev server)
npm run start

# Start Inngest background functions only (port 8288)
npx inngest-cli@latest dev

# Build for production
npm run build

# Lint
npm run lint

# Deploy Convex schema changes
npx convex deploy
```

### vibracode-mobile (Mobile App)

```bash
cd vibracode-mobile/apps/expo-go

# Start Metro bundler (must run on port 80)
yarn start

# Run tests
yarn test

# Lint
yarn lint

# Generate GraphQL types
yarn generate-graphql-code

# iOS build (from ios directory)
cd ios && pod install
# Then open Exponent.xcworkspace in Xcode

# Android build (from android directory)
cd android && ./gradlew app:assembleDebug
```

## Architecture

### Data Flow

1. User describes app in mobile app (VibraCreateAppScreen)
2. Mobile app calls backend API -> creates session in Convex
3. Inngest queues `create-session` function -> spawns E2B sandbox
4. Sandbox clones Expo template, installs deps, starts dev server
5. Inngest runs `run-agent` function -> AI generates code
6. Real-time updates stream via Convex to mobile app
7. Mobile app opens native preview via tunnel URL

### Backend Stack

- **Next.js 15** - App Router, Server Actions, API routes
- **Convex** - Real-time database, sessions/messages/users schema
- **Inngest** - Background job processing (create-session, run-agent, push-to-github)
- **E2B** - Cloud sandboxes for code execution
- **Clerk** - Authentication
- **Stripe** - Web payments (optional)
- **Claude Agent SDK** - AI code generation

### Mobile Stack

- **React Native / Expo SDK 54** - Native mobile runtime
- **Clerk** - Authentication (shared with backend)
- **Convex** - Real-time data sync (symlinked to vibracode-backend/convex)
- **RevenueCat** - In-app purchases (optional)
- **React Navigation** - Stack and bottom tab navigation

### Key Directories

**vibracode-backend:**
- `app/api/` - API routes (create-session, run-agent, webhooks)
- `convex/` - Database schema and functions (sessions, messages, billing, usage)
- `lib/inngest/functions/` - Background jobs (create-session.ts, run-agent.ts, push-to-github.ts)
- `lib/prompts.ts` - AI system prompts
- `lib/e2b/` - E2B sandbox configuration
- `lib/revenuecat/` - RevenueCat webhook handlers
- `e2b-cursor-template/` - E2B sandbox Dockerfile
- `components/vibra/` - Vibra Code UI components

**vibracode-mobile (expo-go):**
- `src/screens/Vibra*.tsx` - Custom Vibra Code screens
- `src/services/` - VibraSessionService, VibraNotificationService, RevenueCatSyncService
- `src/navigation/Navigation.tsx` - App navigation with 3 tabs: Home, Create, Profile
- `src/contexts/` - React contexts
- `src/hooks/` - Custom hooks
- `convex/` - Symlink to vibracode-backend/convex (shared database)

### Convex Schema (Shared)

Core tables in `vibracode-backend/convex/schema.ts`:
- `users` - Clerk ID, subscription, billing, credits/messages
- `sessions` - Build sessions with status, tunnel URL, cost tracking
- `messages` - Chat messages with edits, bash output, tool usage
- `paymentTransactions` - Stripe/RevenueCat transactions
- `githubCredentials` - OAuth tokens for GitHub integration

### Session Status Flow

`IN_PROGRESS` -> `CLONING_REPO` -> `INSTALLING_DEPENDENCIES` -> `STARTING_DEV_SERVER` -> `CREATING_TUNNEL` -> `RUNNING` -> `CUSTOM` (AI working)

## Environment Variables

See `.env.example` files for full documentation:
- `vibracode-backend/.env.example` - All backend variables with comments
- `vibracode-mobile/apps/expo-go/.env.example` - All mobile variables with comments

### Minimum Required

**Backend** (`vibracode-backend/.env.local`):
```
ANTHROPIC_API_KEY=
E2B_API_KEY=
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

**Mobile** (`vibracode-mobile/apps/expo-go/.env`):
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CONVEX_URL=
EXPO_PUBLIC_V0_API_URL=http://localhost:3000
```

## Billing System

- **Token mode** (Cursor agent): Fixed messages per plan
- **Credit mode** (Claude agent): Usage-based with 2x multiplier
- Plans: free, weekly_plus, pro, business, enterprise
- RevenueCat handles mobile subscriptions, Stripe handles web
- Payments are optional for self-hosting

## Agent Types

Configurable via `AGENT_TYPE` environment variable:
- `claude` - Claude agent via Agent SDK (credit billing, default)
- `cursor` - Cursor AI agent (token billing)
- `gemini` - Gemini agent

## iOS Build Notes

- Open `ios/Exponent.xcworkspace` (not .xcodeproj)
- Set `DEV_KERNEL_SOURCE=LOCAL` in `EXBuildConstants.plist` for local builds
- Metro must run on port 80 before building

---

## iOS Native Menu System

The **Menu folder** (`vibracode-mobile/apps/expo-go/ios/Client/Menu/`) contains the core native iOS UI for the app builder experience. This is the app's main functionality -- the zoomed preview, chat interface, bottom bar, top bar, and all modals.

### Menu Folder Structure

```
ios/Client/Menu/
├── EXPreviewZoomManager.h/m         # Main singleton - coordinates zoom, chat, bars
├── EXPreviewZoomManager+Private.h   # Shared private properties across categories
├── EXPreviewZoomManager+Zoom.m      # Zoom in/out animations (3D transform)
├── EXPreviewZoomManager+ChatView.m  # Chat UI, message rendering, session loading
├── EXPreviewZoomManager+TopBar.m    # Top bar (app name, refresh, chevron buttons)
├── EXPreviewZoomManager+BottomBar.m # Bottom bar (input, send, mic, image buttons)
├── EXPreviewZoomManager+Keyboard.m  # Keyboard handling and constraints
├── EXPreviewZoomManager+Gestures.m  # Tap gestures for zoom/chat
├── EXPreviewZoomManager+WebPreview.m # Web project preview (WKWebView)
├── EXPreviewZoomManager+*Modal.m    # Various modals (API, Haptic, ENV, Files, Logs, etc.)
├── Chat/                            # High-performance chat components
│   ├── EXChatListAdapter.h/m        # IGListKit + Texture adapter for chat list
│   ├── EXChatMessageNode.h/m        # ASCellNode for regular messages
│   ├── EXChatGroupNode.h/m          # ASCellNode for read/edit/bash tool groups
│   ├── EXChatTaskCardNode.h/m       # ASCellNode for todo task cards (Liquid Glass)
│   ├── EXChatStatusNode.h/m         # ASCellNode for working status indicator
│   ├── EXChatMessageCache.h/m       # Message caching for offline support
│   ├── EXLottieAnimationHelper.swift # Animation helpers (springIn, fadeIn, shimmer, glass)
│   └── EXMarkdownHelper.swift       # Markdown parsing (bold, italic, code, links)
├── EXChatBackendService.h/m         # API calls to Convex backend
├── EXAudioRecorderService.h/m       # Voice recording for input
├── EXAssemblyAIService.h/m          # Speech-to-text transcription
└── EXWebPreviewView.h/m             # WKWebView wrapper for web projects
```

### Key Classes

#### EXPreviewZoomManager (Singleton)
The main coordinator for the entire preview/chat experience. Access via `[EXPreviewZoomManager sharedInstance]`.

**Public API:**
- `toggleZoom` / `zoomOut` / `zoomIn` - Preview zoom animations
- `toggleChat` - Show/hide chat interface
- `setAppName:` - Set app name from Convex
- `setProjectType:` - "mobile" or "web"
- `loadWebProject:` - Load web URL in preview

**Key Properties (in +Private.h):**
- `isZoomed` - Whether preview is zoomed out
- `isChatMode` - Whether chat is visible
- `chatSessionId` - Current Convex session ID
- `sandboxId` - E2B sandbox ID
- `tunnelUrl` - Preview tunnel URL
- `chatMessages` - Array of message dictionaries
- `isAgentRunning` - Whether AI agent is active
- `chatListAdapter` - IGListKit adapter for chat

#### Chat System (High-Performance)
Uses **Texture (AsyncDisplayKit)** + **IGListKit** for 60fps scrolling:

- **EXChatListAdapter**: Manages ASCollectionNode with IGListDiff for efficient updates
- **EXChatMessageNode**: Renders user/assistant messages with markdown
- **EXChatGroupNode**: Renders read/edit/bash tool operations (expandable)
- **EXChatTaskCardNode**: Renders todo cards with Liquid Glass effect
- **EXChatStatusNode**: Shows "Working..." status with shimmer

**Animation System (EXLottieAnimationHelper.swift):**
- `EXCellAnimationHelper` - Cell appear animations (springIn, fadeIn, slideUp, scaleIn)
- `EXTextShimmerHelper` - Text shimmer for active status
- `EXGlassEffectHelper` - iOS 26 Liquid Glass effects with fallback

#### Bottom Bar
Input area with: text input, send button, mic button (voice), image button, model selector.
- Voice recording via `EXAudioRecorderService` -> `EXAssemblyAIService` for transcription
- Image attachments stored in `pendingImageAttachments`

#### Top Bar
Shows app name (centered in preview mode, left-aligned in chat mode).
- Refresh button, chevron down (close chat), three-dots menu
- Clear history button (in chat mode)

### Message Types in Chat

Messages from Convex have different types, rendered by different nodes:

| Type | Node | Description |
|------|------|-------------|
| `message` | EXChatMessageNode | User/assistant text messages |
| `read` | EXChatGroupNode | File read operations (blue) |
| `edit` | EXChatGroupNode | File edit operations (orange) |
| `bash` | EXChatGroupNode | Terminal commands (green) |
| `tasks` | EXChatTaskCardNode | Todo list with Liquid Glass |
| `status` | EXChatStatusNode | Working indicator |

### Common Tasks

**Fix chat UI issues:**
- Chat rendering: `EXPreviewZoomManager+ChatView.m`
- Message nodes: `Chat/EXChatMessageNode.m`, `EXChatGroupNode.m`
- Scrolling/performance: `Chat/EXChatListAdapter.m`
- Animations: `Chat/EXLottieAnimationHelper.swift`

**Fix bottom bar issues:**
- Input handling: `EXPreviewZoomManager+BottomBar.m`
- Keyboard: `EXPreviewZoomManager+Keyboard.m`
- Voice recording: `EXAudioRecorderService.m`

**Fix top bar issues:**
- Layout/buttons: `EXPreviewZoomManager+TopBar.m`

**Fix zoom issues:**
- Zoom animations: `EXPreviewZoomManager+Zoom.m`
- Gestures: `EXPreviewZoomManager+Gestures.m`

**Fix modals:**
- API selector: `EXPreviewZoomManager+APIModal.m`
- Files browser: `EXPreviewZoomManager+FilesModal.m`
- Logs viewer: `EXPreviewZoomManager+LogsModal.m`
- Publish: `EXPreviewZoomManager+PublishModal.m`

### iOS Libraries Used (Menu System)

- **Texture (AsyncDisplayKit) 3.2** - Off-main-thread layout/rendering for chat
- **IGListKit 5.0** - O(N) diffing for efficient list updates
- **SDWebImage 5.19** - Async image loading with caching
- **Lottie 4.4** - Animation playback

### iOS UI Terminology & View Hierarchy

When discussing the app preview experience, use these exact terms:

#### View Hierarchy (Bottom to Top)
```
+---------------------------------------------+
| UIWindow (keyWindow)                        |
|  +-- Superview (dark background when zoomed)|
|  |    +-- previewContainerView              | <- Container with rounded corners
|  |    |    +-- contentView                  | <- React Native app OR error view
|  |    +-- splashScreenView                  | <- Gradient loading screen (above container)
|  |    +-- topBarView (zPosition: 900)       | <- App name, refresh, chevron
|  |    +-- bottomBarView (zPosition: 1000)   | <- Input, send, mic, image buttons
|  |    +-- chatView                          | <- Chat scroll view (when visible)
|  +-- ...                                    |
+---------------------------------------------+
```

#### Key Views Terminology

| Term | Class | Description |
|------|-------|-------------|
| **App Preview** | `previewContainerView` | Container wrapping the React Native app, rounded corners when zoomed out, 3D transform |
| **Content View** | `contentView` | The actual React Native root view, or error view on failure |
| **Splash Screen** | `splashScreenView` | Gradient loading screen while JS loads, above previewContainerView |
| **Error Screen** | `EXErrorView` | "Something went wrong" with error details, copy button, retry button |
| **Top Bar** | `topBarView` | App name label, refresh button, chevron down, three-dots menu |
| **Bottom Bar** | `bottomBarView` | Text input, send button, mic button, image button, model selector |
| **Chat View** | `chatView` | Scroll view with chat messages (when `isChatMode = YES`) |

#### States

| State | Property | Visual |
|-------|----------|--------|
| **Zoomed Out** | `isZoomed = YES` | App preview scaled down (55-68%), 3D rotated, bars visible |
| **Zoomed In** | `isZoomed = NO` | App preview fullscreen, bars hidden |
| **Chat Mode** | `isChatMode = YES` | Chat visible, preview pushed up/scaled smaller |
| **Keyboard Visible** | `isKeyboardVisible = YES` | Bottom bar floats above keyboard, preview scaled further |

#### Log Prefixes

| Prefix | Component |
|--------|-----------|
| `[ZoomManager]` | EXPreviewZoomManager (zoom/animations) |
| `[AppVC]` | EXAppViewController (app loading, JS finished) |
| `[ErrorView]` | EXErrorView (error display) |
| `[RevenueCat]` | In-app purchase SDK |
| `nw_socket_handle_socket_event` | Network connection errors (timeout, etc.) |

<div align="center">
  <br />
  <img src="vibracode-backend/public/brand-assets/vibra-logo.png" alt="Vibra Code" width="80" />
  <h1>Vibra Code</h1>
  <h3>Open-Source AI App Builder for Mobile</h3>
  <p>Describe what you want &rarr; AI builds it &rarr; Preview it natively on your phone</p>

  <br />

  <a href="https://apps.apple.com/us/app/vibra-code-ai-app-builder/id6752743077">
    <img src="https://img.shields.io/badge/App_Store-Download-black?style=for-the-badge&logo=apple&logoColor=white" alt="App Store" />
  </a>
  &nbsp;
  <a href="https://vibracodeapp.com">
    <img src="https://img.shields.io/badge/Website-vibracodeapp.com-blue?style=for-the-badge" alt="Website" />
  </a>
  &nbsp;
  <a href="https://x.com/sehindhemzani">
    <img src="https://img.shields.io/badge/Follow-@sehindhemzani-black?style=for-the-badge&logo=x&logoColor=white" alt="X" />
  </a>

  <br /><br />

  [![GitHub stars](https://img.shields.io/github/stars/sa4hnd/vibra-code?style=flat-square&color=gold)](https://github.com/sa4hnd/vibra-code/stargazers)
  [![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](./LICENSE)
  [![Built with Claude Code](https://img.shields.io/badge/built_with-Claude_Code-7c3aed?style=flat-square)](https://claude.ai/code)

  <br />

  [![SPONSORED BY E2B FOR STARTUPS](https://img.shields.io/badge/SPONSORED%20BY-E2B%20FOR%20STARTUPS-ff8800?style=for-the-badge)](https://e2b.dev/startups)

  <sub>E2B sponsored $20K in cloud sandbox credits through their <a href="https://e2b.dev/startups">Startups program</a>.</sub>

</div>

<br />

<div align="center">
  <img src="assets/screenshots/hero-banner.png" alt="Build Things You Imagine" width="100%" />
</div>

<br />

<div align="center">
  <img src="assets/screenshots/app-preview.png" width="24%" />
  <img src="assets/screenshots/chat-interface.png" width="24%" />
  <img src="assets/screenshots/publish.png" width="24%" />
  <img src="assets/screenshots/showcase.png" width="24%" />
</div>

<br />

---

## Demos

### Mobile App
https://github.com/user-attachments/assets/f72fcbf0-091a-4cc1-a453-fed062f52bdf

### Website
https://github.com/user-attachments/assets/5610f5e1-d146-4634-b616-301560e230f0

### Game Built with Vibra Code
https://github.com/user-attachments/assets/0d5a79ef-f69a-452b-a25a-9e149de6e05a

---

## What is Vibra Code?

Vibra Code is an **open-source AI app builder** that lets you create mobile apps by describing them in plain English. An AI agent writes the code in a cloud sandbox while you watch in real time. Then you see a live preview — right on your phone.

Think of it as an **open-source alternative to [Vibe Code App](https://www.vibecodeapp.com/), [Rork](https://rork.com/), [Lovable](https://lovable.dev/), and [Bolt.new](https://bolt.new/)** — but you can self-host it, customize the AI prompts, swap AI providers, and fork it to make it your own.

This is the **complete source code** behind the app on the [App Store](https://apps.apple.com/us/app/vibra-code-ai-app-builder/id6752743077). Built by one developer with [Claude Code](https://claude.ai/code). Now open source.

<br />

## Why Open Source?

Every other AI app builder is closed-source. You can't see how it works, can't customize it, can't self-host it.

| | **Vibra Code** | [Vibe Code App](https://www.vibecodeapp.com/) | [Rork](https://rork.com/) | [Lovable](https://lovable.dev/) | [Bolt.new](https://bolt.new/) |
|:--|:---:|:---:|:---:|:---:|:---:|
| **Open source** | **Yes** | No | No | No | No |
| **Self-hostable** | **Yes** | No | No | No | No |
| **Custom AI prompts** | **Yes** | No | No | No | No |
| **Swap AI providers** | **Yes** | No | No | No | No |
| **Fork & modify** | **Yes** | No | No | No | No |

> Looking for an **open-source vibe coding app**? This is it. Fork it, self-host it, make it yours.

<br />

## Features

<table>
<tr>
<td width="50%">

**60fps native chat UI** built with Texture + IGListKit. Off-main-thread rendering. No jank.

**Multi-AI providers** -- Claude (default), Cursor, Gemini. Switch with one env var.

**E2B cloud sandboxes** for isolated, safe code execution.

**Real-time sync** via Convex. Changes stream from sandbox to phone instantly.

</td>
<td width="50%">

**Voice & image input** -- describe apps by voice or attach mockup screenshots.

**GitHub integration** -- push generated projects directly to GitHub.

**Web + mobile preview** -- preview both web and mobile apps.

**Built on Expo** -- modified Expo Go gives you full native control.

</td>
</tr>
</table>

<div align="center">
  <img src="assets/screenshots/database.png" width="30%" />
  <img src="assets/screenshots/payments.png" width="30%" />
</div>

<br />

## Architecture

```
  Phone                     Server                        Cloud
┌──────────┐   API    ┌──────────────┐   Queue    ┌──────────────┐
│  Expo    │ ──────── │   Next.js    │ ────────── │  E2B Sandbox │
│  iOS App │          │   + Convex   │   Inngest  │  + AI Agent  │
└────┬─────┘          └──────┬───────┘            └──────┬───────┘
     │                       │                           │
     └───── real-time sync ──┴─── code generation ───────┘
```

1. User describes an app on their phone
2. Backend creates a session in Convex
3. Inngest spawns an E2B sandbox
4. AI agent generates code in the sandbox
5. Updates stream via Convex back to the phone
6. Phone shows a live preview via tunnel URL

<br />

## Quick Start

### Prerequisites

| Required | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | AI code generation (Claude) |
| `E2B_API_KEY` | Cloud sandboxes ([sign up](https://e2b.dev)) |
| Clerk publishable + secret keys | Authentication ([sign up](https://clerk.com)) |
| Convex deployment URL | Real-time database ([sign up](https://convex.dev)) |

> **Stripe** and **RevenueCat** keys are optional -- only needed if you want payments.

### 1. Backend

```bash
cd vibracode-backend
npm install
cp .env.example .env.local    # then add your API keys

npx convex deploy              # deploy database
npx inngest-cli@latest dev     # job server → localhost:8288
npm run dev                    # Next.js → localhost:3000
```

### 2. Build the E2B Sandbox Template

```bash
npm install -g @e2b/cli && e2b auth login
cd vibracode-backend/e2b-cursor-template
e2b template build
# Copy the template ID → set it in config.ts and lib/e2b/config.ts
```

### 3. Mobile App (macOS required)

```bash
git clone --recurse-submodules https://github.com/sa4hnd/vibra-code.git
cd vibra-code/vibracode-mobile

brew bundle                                                # cmake, ninja for Hermes
yarn                                                       # JS dependencies
yarn setup:native                                          # native setup
cd packages/expo && yarn build && cd ../..                 # build Expo
cd react-native-lab/react-native && yarn install && cd ../..   # RN from source
cd apps/expo-go/ios && pod install && cd ../../..          # CocoaPods
cd apps/expo-go && yarn start                              # Metro (must be port 80)
```

Then in Xcode:

1. Open `apps/expo-go/ios/Exponent.xcworkspace`
2. Set `DEV_KERNEL_SOURCE` → `LOCAL` in `EXBuildConstants.plist`
3. Build and run

<details>
<summary>Troubleshooting</summary>

| Problem | Fix |
|---------|-----|
| SHA-1 / symlink errors | `rm -rf ./react-native-lab/react-native/node_modules` |
| C++ build errors | `find . -name ".cxx" -type d -prune -exec rm -rf '{}' +` |
| Everything broken | `git submodule foreach --recursive git clean -xfd` then re-run setup |

</details>

<br />

## Project Structure

```
vibra-code/
├── vibracode-backend/            # Next.js 15 + Convex + Inngest
│   ├── app/api/                  # API routes
│   ├── convex/                   # Database schema & functions
│   ├── lib/inngest/functions/    # Background jobs
│   ├── lib/e2b/                  # Sandbox configuration
│   └── e2b-cursor-template/      # E2B Dockerfile
│
├── vibracode-mobile/             # React Native / Expo
│   └── apps/expo-go/
│       ├── src/screens/          # App screens
│       ├── src/services/         # Business logic
│       └── ios/Client/Menu/      # Native chat UI (Texture + IGListKit)
│
├── expo-template/                # Sandbox app template (submodule)
└── CLAUDE.md                     # AI dev guidelines
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | Next.js 15 (App Router) |
| **Database** | Convex (real-time) |
| **Jobs** | Inngest |
| **Sandboxes** | E2B |
| **AI** | Claude Agent SDK / Cursor / Gemini |
| **Auth** | Clerk |
| **Payments** | Stripe + RevenueCat (optional) |
| **Mobile** | React Native / Expo SDK 54 |
| **Chat UI** | Texture + IGListKit (60fps) |

<br />

## Built with Claude Code

This entire project — backend, mobile app, native iOS UI, infrastructure — was built by one developer using [Claude Code](https://claude.ai/code).

If you're working on this codebase, Claude Code gives you the best experience. The `CLAUDE.md` has detailed context about every file, pattern, and convention.

## Vibra Code vs Alternatives

Looking for an **AI app builder**? Here's how Vibra Code compares:

- **[Vibe Code App](https://www.vibecodeapp.com/) alternative** — Vibra Code is the open-source version you can self-host and customize
- **[Rork](https://rork.com/) alternative** — Same concept (describe → AI builds → preview on phone) but fully open source
- **[Lovable](https://lovable.dev/) alternative** — Lovable focuses on web apps; Vibra Code builds native mobile apps with Expo
- **[Bolt.new](https://bolt.new/) alternative** — Bolt.new runs in the browser; Vibra Code gives you a native iOS/Android experience
- **[Cursor](https://cursor.sh/) alternative** — Cursor is an AI code editor; Vibra Code is an AI app builder that generates complete apps from descriptions
- **[Replit](https://replit.com/) alternative** — Replit is a cloud IDE; Vibra Code is purpose-built for mobile app generation with native preview

Vibra Code is the **first open-source AI mobile app builder**. Fork it, self-host it, make it yours.

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[AGPL-3.0](./LICENSE) &copy; 2024-2026 Vibra Code contributors.

---

<div align="center">

  Built by **[Sehind Hemzani](https://x.com/sehindhemzani)** &mdash; 19 y/o developer from Kurdistan

  <br />

  <a href="https://x.com/sehindhemzani">
    <img src="https://img.shields.io/badge/𝕏_@sehindhemzani-000000?style=for-the-badge&logo=x&logoColor=white"/>
  </a>
  &nbsp;
  <a href="mailto:sahindhamzani@gmail.com">
    <img src="https://img.shields.io/badge/Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white"/>
  </a>

  <br /><br />

  **If this project is useful, please give it a star** &mdash; it helps others find it.

  [![Star this repo](https://img.shields.io/github/stars/sa4hnd/vibra-code?style=social)](https://github.com/sa4hnd/vibra-code)

</div>

<!--
Keywords: open source AI app builder, AI mobile app builder, vibe coding app, vibe code app,
vibecodeapp alternative, vibecodeapp open source, rork alternative, rork app alternative,
rork open source, lovable alternative, lovable open source, bolt.new alternative, bolt new alternative,
anything.ai alternative, cursor alternative, v0 alternative, replit alternative,
AI app generator, AI mobile app generator, AI code generator, text to app, prompt to app,
describe app AI builds it, build app with AI, create app with AI, make app with AI,
natural language to app, AI builds mobile app, AI app creator, AI app maker,
mobile app builder no code, no code app builder AI, low code app builder,
build ios app with AI, build android app with AI, build react native app with AI,
expo AI app builder, react native AI builder, react native AI code generator,
self hosted AI builder, self hosted app builder, open source vibe coding,
open source AI coding, open source mobile app generator,
claude code project, claude AI app builder, anthropic claude code,
e2b sandbox, e2b code execution, cloud sandbox AI,
convex real time, inngest background jobs, expo sdk 54,
texture iglistkit chat, 60fps chat ui, native ios chat,
AI pair programming, AI software engineer, AI developer tool,
build apps by talking, voice to app, image to app, screenshot to app,
app builder 2024, app builder 2025, app builder 2026,
best AI app builder, top AI app builder, free AI app builder,
AI app builder github, AI app builder open source github,
vibra code, vibracode, vibra code app, vibracode app
-->

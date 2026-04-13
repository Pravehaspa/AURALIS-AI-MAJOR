# 🎙️ Auralis AI

> **Create intelligent voice agents that listen, think, and speak naturally.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/Pravehaspa/Auralis-AI)
[![Murf AI](https://img.shields.io/badge/voice-Murf%20AI-red)](https://murf.ai)
[![Next.js](https://img.shields.io/badge/framework-Next.js%2015-black)](https://nextjs.org)
[![Google AI](https://img.shields.io/badge/AI-Google%20Gemini-blue)](https://ai.google.dev)

A cutting-edge voice AI platform combining **Google Gemini** conversational intelligence with **Murf AI** voice synthesis. Build and deploy intelligent voice agents in minutes.

-----------

## ✨ Key Features

| Feature                  | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| 🎤 **Voice Synthesis**   | 100+ premium voices via Murf AI with real-time generation and live preview     |
| 🧠 **Conversational AI** | Context-aware responses powered by Google Gemini with memory persistence       |
| 🤖 **Agent Builder**     | Create custom AI personalities with prompt engineering and voice profiles      |
| 🔄 **Auto Mode**         | Speech-to-speech flows with real-time speech recognition and automatic replies |
| 📊 **Analytics**         | Track conversations, response times, and voice usage patterns                  |
| 🔐 **Enterprise Ready**  | Secure API, scalable architecture, and team collaboration tools                |

## 🛠️ Tech Stack

### Frontend & UI

- **Next.js 15** — React framework with App Router
- **TypeScript** — Type-safe development
- **Tailwind CSS** — Utility-first styling
- **Radix UI** — Accessible UI primitives
- **Lucide React** — Beautiful icon library

### AI & Backend

- **Google Generative AI** — Advanced language models
- **Murf AI API** — Professional voice synthesis
- **Next.js API Routes** — Serverless endpoints
- **Axios** — HTTP client

### State & Storage

- **React Context** — Global state management
- **Local Storage** — Persistent data
- **Custom Hooks** — Reusable logic

## 🚀 Quick Start

Get Auralis running locally in **under 5 minutes**:

```bash
# 1️⃣ Clone the repository
git clone https://github.com/Pravehaspa/Auralis-AI.git
cd Auralis-AI

# 2️⃣ Install dependencies
npm install
# or: yarn install | pnpm install

# 3️⃣ Set up environment
cp env.example .env.local
# Add your API keys to .env.local

# Required auth and DB values:
# DATABASE_URL=postgresql://postgres:REAL_PASSWORD@db.<project-ref>.supabase.co:5432/postgres
# NEXTAUTH_URL=http://localhost:3000
# NEXTAUTH_SECRET=<long-random-secret>
# GOOGLE_CLIENT_ID=<google-oauth-client-id>
# GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
# Optional on IPv4-only networks: DATABASE_URL_POOLER + DATABASE_URL_USE_POOLER=1

# 4️⃣ Start the dev server
npm run dev

# 5️⃣ Open in browser
# http://localhost:3000
```

### Prerequisites

| Requirement           | Version                          |
| --------------------- | -------------------------------- |
| **Node.js**           | 18+                              |
| **npm/yarn/pnpm**     | Latest                           |
| **Google AI API Key** | [Get one](https://ai.google.dev) |
| **Murf AI API Key**   | [Get one](https://murf.ai)       |

## 📁 Project Structure

```
Auralis-AI/
├── 📱 app/              # Next.js pages & API routes
├── 🧩 components/       # Reusable UI components
├── 📚 lib/              # Utilities, types, API client
├── 🎣 hooks/            # Custom React hooks
├── 🎨 styles/           # Global styles
├── 🖼️  public/          # Static assets & images
└── ⚙️  config files     # TypeScript, Tailwind, etc.
```

## 🎯 Core Features

### Agent Management

- **Create Agents**: Build custom AI assistants with specific personalities
- **Voice Selection**: Choose from 100+ premium voices
- **Prompt Templates**: Pre-built templates for common use cases
- **Category Organization**: Organize agents by purpose

### Chat Interface

- **Real-time Chat**: Instant message exchange
- **Voice Input**: Speech-to-text functionality
- **Voice Output**: Text-to-speech responses
- **Auto Mode**: Hands-free voice conversations
- **Message History**: Persistent conversation storage

### Analytics Dashboard

- **Performance Metrics**: Track conversation and message counts
- **Response Times**: Monitor AI response speed
- **Voice Usage**: Analyze voice preferences
- **Daily Statistics**: Time-based performance data

### Settings & Configuration

- **User Preferences**: Customize app behavior
- **Theme Selection**: Light, dark, or system theme
- **Voice Settings**: Configure audio preferences
- **Data Management**: Export and clear user data

## 🔧 API Endpoints

### Agent Management

- `GET /api/agents` - Get all agents
- `POST /api/agents` - Create new agent
- `GET /api/agents/[id]` - Get specific agent
- `PUT /api/agents/[id]` - Update agent
- `DELETE /api/agents/[id]` - Delete agent

### AI Services

- `POST /api/generate-response` - Generate AI response
- `POST /api/text-to-speech` - Convert text to speech

### Analytics

- `GET /api/analytics` - Get analytics data
- `POST /api/analytics` - Update analytics

### Voice Management

- `GET /api/voices` - Get available voices

### System

- `GET /api/health` - Health check

## 🎨 UI Components

The project uses a custom component library built with:

- **Radix UI**: Accessible primitives
- **Tailwind CSS**: Utility-first styling
- **Custom Design System**: Consistent theming

### Key Components

- **Cards**: Information containers
- **Buttons**: Interactive elements
- **Forms**: Input and validation
- **Charts**: Data visualizationf
- **Modals**: Overlay dialogs

## 🔒 Security

- **API Key Protection**: Environment variable storage
- **Input Validation**: Server-side validation
- **Error Handling**: Graceful error management
- **Rate Limiting**: API request throttling

## 📊 Performance

- **Optimized Loading**: Fast initial page loads
- **Code Splitting**: Dynamic imports for better performance
- **Image Optimization**: Next.js image optimization
- **Caching**: Local storage and API response caching

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

- **Netlify**: Static site deployment
- **Railway**: Full-stack deployment
- **AWS**: Custom infrastructure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License & Acknowledgments

| Aspect           | Details                       |
| ---------------- | ----------------------------- |
| **License**      | MIT — [View License](LICENSE) |
| **Murf AI**      | Voice synthesis platform      |
| **Google AI**    | Generative AI capabilities    |
| **Next.js**      | React framework excellence    |
| **Tailwind CSS** | Utility-first styling         |

## 🤝 Contributing

We ❤️ contributions! Here's how to help:

```bash
# 1. Fork the repository
# 2. Create your feature branch
git checkout -b feature/amazing-feature

# 3. Commit your changes
git commit -m '✨ Add amazing feature'

# 4. Push to branch
git push origin feature/amazing-feature

# 5. Open a Pull Request
```

<!--
## 📞 Support & Community

| Channel | Link |
|---------|------|
| 🐛 **Issues** | [GitHub Issues](https://github.com/Pravehaspa/Auralis-AI/issues) |
| 💬 **Discord** | [Join Community](https://discord.gg/auralis-ai) |
| 📧 **Email** | support@auralis-ai.com |
| 📖 **Docs** | [Documentation](https://docs.auralis-ai.com) |
-->

## 🎉 Major Project 2026

Built as a Major Project submission showcasing the power of combining:

- ✅ **Real-time Voice AI** — Expressive TTS
- ✅ **Intelligent Responses** — Context-aware conversations
- ✅ **Production-Ready** — Scalable & secure architecture
- ✅ **Beautiful UX** — Modern, intuitive interface

---

<!--
**Made with ❤️ by [Pravehaspa](https://github.com/Pravehaspa)**
-->

_Transform your ideas into voice experiences with Auralis AI_ 🚀

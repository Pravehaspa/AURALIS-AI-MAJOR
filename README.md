# 🌌 Auralis AI
### Voice-Native AI Agent Studio

Auralis AI is a premium, enterprise-ready platform for creating and deploying intelligent AI agents with high-fidelity voice synthesis. Built with a focus on minimalism, speed, and intelligence.

---

## 🎨 Design Philosophy: Cobalt & Platinum
Auralis follows a strict **Cobalt Blue** and **Platinum Slate** design system. 
- **Typography**: Outfit (Headings), Inter (Body).
- **Aesthetic**: Deep slate surfaces, crisp cobalt accents, and minimal border-based depth.

## 🚀 Features
- **Voice-Native Core**: Powered by Murf AI and Google Gemini.
- **Auto Mode**: Hands-free conversation with automatic voice synthesis.
- **Embedded Widget**: Premium chat bubble that persists conversation state via localStorage.
- **Analytics Dashboard**: Real-time insights into agent performance and voice usage.

## 🛠️ Tech Stack
- **Frontend**: Next.js 15, Tailwind CSS, Lucide Icons, Shadcn/UI.
- **Backend**: FastAPI (Python), Google AI SDK.
- **Voice**: Murf AI API.

## 📥 Getting Started

### 1. Repository Setup
```bash
git clone https://github.com/Pravehaspa/AURALIS-AI-MAJOR.git
cd Auralis-Ai
```

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root and fill in your API keys:
- `GOOGLE_AI_API_KEY`
- `MURF_API_KEY`

### 3. Installation
**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r requirements.txt
python src/main.py
```

## 🧩 Integration (Widget)
To embed the Auralis Chat Widget on any site, include the following:
```html
<script src="https://auralis.ai/widget.js"></script>
```
*(Self-hosted version available in `frontend/public/chatbot-widget.html`)*

---
&copy; 2025 Auralis AI. Built for the future of voice.

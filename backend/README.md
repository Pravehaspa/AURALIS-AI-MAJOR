# Auralis AI FastAPI Backend

FastAPI backend implementation for Auralis AI - Voice AI Platform with Google Gemini and Murf AI integration.

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- pip or poetry

### Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   # From repo root: copy env.example to .env (one .env for frontend + backend)
   cp ../env.example ../.env
   # Edit .env and add your API keys
   ```

5. **Run the server** (from `backend/`):
   ```bash
   uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at:
- **API:** http://localhost:8000
- **Interactive Docs:** http://localhost:8000/docs
- **Alternative Docs:** http://localhost:8000/redoc

## 📁 Project Structure

```
backend/
├── requirements.txt        # Python dependencies
├── README.md               # This file
└── src/
    ├── main.py             # FastAPI app entry point
    ├── api/
    │   ├── __init__.py
    │   ├── agents.py       # Agent management endpoints
    │   ├── ai_services.py  # AI services (Gemini, Murf)
    │   ├── analytics.py     # Analytics endpoints
    │   ├── conversations.py # Conversation management
    │   ├── voices.py       # Voice management
    │   └── health.py       # Health check
    ├── models/
    │   └── models.py       # Pydantic models (schemas)
    └── storage/
        └── database.py    # In-memory database (replace with real DB)
```

Environment variables: use repo root `.env` (see `../env.example`).

## 🔧 API Endpoints

### Agent Management
- `GET /api/agents` - Get all agents
- `POST /api/agents` - Create new agent
- `GET /api/agents/{id}` - Get specific agent
- `PUT /api/agents/{id}` - Update agent
- `DELETE /api/agents/{id}` - Delete agent

### AI Services
- `POST /api/generate-response` - Generate AI response (Google Gemini)
- `POST /api/text-to-speech` - Convert text to speech (Murf AI)

### Analytics
- `GET /api/analytics` - Get analytics data
- `POST /api/analytics` - Update analytics

### Conversations
- `GET /api/conversations` - Get conversations (optional `?agentId=...`)
- `POST /api/conversations` - Create new conversation

### Voice Management
- `GET /api/voices` - Get available voices (optional filters: `?language=...&gender=...&style=...`)

### System
- `GET /api/health` - Health check

## 🔑 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
MURF_API_KEY=your_murf_api_key_here
HOST=0.0.0.0
PORT=8000
```

## 📝 Example Usage

### Create an Agent
```bash
curl -X POST "http://localhost:8000/api/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Agent",
    "description": "A helpful assistant",
    "category": "General",
    "voiceId": "en-US-terrell",
    "prompt": "You are a helpful assistant.",
    "firstMessage": "Hello! How can I help you?"
  }'
```

### Generate AI Response
```bash
curl -X POST "http://localhost:8000/api/generate-response" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how are you?",
    "agentPrompt": "You are a friendly assistant."
  }'
```

### Convert Text to Speech
```bash
curl -X POST "http://localhost:8000/api/text-to-speech" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test.",
    "voiceId": "en-US-terrell"
  }'
```

## 🗄️ Database

Currently uses **in-memory storage** for demo purposes. For production:

1. **Replace `app/database.py`** with actual database integration:
   - PostgreSQL (recommended)
   - MongoDB
   - SQLite (for small deployments)

2. **Add database models** using SQLAlchemy or similar ORM

3. **Update routers** to use database queries instead of in-memory lists

## 🧪 Testing

```bash
# Run with pytest (when tests are added)
pytest

# Run with coverage
pytest --cov=app
```

## 🚢 Deployment

### Using Docker (recommended)

Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t auralis-backend .
docker run -p 8000:8000 --env-file .env auralis-backend
```

### Using Gunicorn (production)

```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 📚 Documentation

- **FastAPI Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

## 🔒 Security Notes

- Never commit `.env` files
- Use environment variables for API keys
- Add authentication/authorization for production
- Enable HTTPS in production
- Add rate limiting
- Validate and sanitize all inputs

## 🤝 Integration with Frontend

Update your Next.js frontend's `lib/api.ts` to point to the FastAPI backend:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in your frontend `.env.local`.

## 📄 License

MIT License - Same as main project

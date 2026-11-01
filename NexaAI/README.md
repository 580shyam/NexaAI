# NexaAI — Advanced AI Assistant

A portfolio learning project built with React + Vite, FastAPI, SQLite, Groq, and PyPDF.

## Features
- AI chat using Groq chat completions
- Saved chat history (SQLite)
- PDF upload and document Q&A (text-based PDFs)
- Browser speech-to-text input (Chrome/Edge support varies)
- Copy assistant replies and export a conversation
- Responsive dark dashboard
- API key stored only on the backend

## Prerequisites
- Windows 10/11
- Python 3.11+ (use the Python version installed on your laptop)
- Node.js 20 LTS or newer
- VS Code
- Groq API key for AI responses (never commit it to GitHub)

## 1. Open the project
Extract `NexaAI-Advanced-Project.zip`. In VS Code choose **File → Open Folder** and select the `NexaAI` folder.

## 2. Backend setup (PowerShell)
Open a VS Code terminal:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If activation is blocked, run this in the same terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Install backend packages and create the local environment file:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `backend/.env` and set your own key:

```env
GROQ_API_KEY=put_your_own_groq_key_here
GROQ_MODEL=openai/gpt-oss-120b
DATABASE_URL=sqlite:///./nexaai.db
FRONTEND_ORIGIN=http://localhost:5173
```

Save the file, then start the API:

```powershell
uvicorn app.main:app --reload
```

Keep this terminal running. API: `http://127.0.0.1:8000` and API docs: `http://127.0.0.1:8000/docs`.

## 3. Frontend setup
Open a **second** VS Code terminal at the NexaAI project root:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173` in Chrome or Edge.

## 4. Test the project
1. Open `http://127.0.0.1:8000/health`. It should return `{"status":"ok"}`.
2. Open `http://localhost:5173`.
3. Send a simple message such as `Explain Python lists with an example.`
4. Click **New chat**, then refresh the page. Your chat list should remain saved.
5. Open a chat, use the paperclip button to upload a small text-based PDF, then ask a question about it.
6. Try the microphone button (grant browser microphone permission) and export a conversation.

PDF notes: scanned/image-only PDFs are not supported in this starter; use a PDF with selectable text. Upload limit is 8 MB. The document text is stored locally in SQLite for that chat.

## 5. GitHub upload
From the project root:

```powershell
git init
git add .
git commit -m "Create NexaAI advanced chatbot"
```

Create a new empty repository on GitHub, then run the remote/push commands GitHub shows. Check that `.env` is not included in the commit. `.gitignore` already excludes it.

## 6. Deployment (Render backend + Vercel frontend)

### Backend on Render
1. Push the project to GitHub.
2. In Render create a **New → Web Service** and connect the repository.
3. Set **Root Directory** to `backend`.
4. Set **Build Command** to `pip install -r requirements.txt`.
5. Set **Start Command** to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
6. Add these environment variables in Render:
   - `GROQ_API_KEY` = your Groq API key
   - `GROQ_MODEL` = `openai/gpt-oss-120b`
   - `DATABASE_URL` = a PostgreSQL connection URL for a managed PostgreSQL database
   - `FRONTEND_ORIGIN` = your Vercel app URL, e.g. `https://your-app.vercel.app`
7. Deploy and test `https://your-backend.onrender.com/health`.

Important: local SQLite is for development. A hosted service may have an ephemeral filesystem, so SQLite data can be lost on redeploy/restart. Use PostgreSQL for persistent production data. The SQLAlchemy setup accepts a PostgreSQL URL.

### Frontend on Vercel
1. In Vercel choose **Add New → Project**, import the same GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite (usually auto-detected); Build Command: `npm run build`; Output Directory: `dist`.
4. Add environment variable `VITE_API_URL` = your Render backend URL, e.g. `https://your-backend.onrender.com`.
5. Deploy. If you change `FRONTEND_ORIGIN` on Render, redeploy the backend.

Render and Vercel settings can change; follow the current dashboard labels if they differ. Official guides: https://render.com/docs/deploy-fastapi and https://vercel.com/docs.

## Limitations and next upgrades
- This is an advanced educational starter, not a production security-audited service.
- It has no user login or admin roles yet; chats are stored in one local database. Do not put private data into a publicly shared demo.
- PDF support is text extraction only; OCR and vector search/RAG are future upgrades.
- Model availability and account access can change. If Groq rejects the model ID, check the current Groq models page: https://console.groq.com/docs/models.

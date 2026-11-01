from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from groq import APIConnectionError, AuthenticationError, Groq, RateLimitError
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Chat, Document, Message
from app.schemas import ChatCreate, ChatDetail, ChatOut, ChatRequest, MessageOut

router = APIRouter(prefix="/api")


@router.get("/chats", response_model=list[ChatOut])
def list_chats(db: Session = Depends(get_db)):
    return db.scalars(select(Chat).order_by(Chat.created_at.desc())).all()


@router.post("/chats", response_model=ChatOut)
def create_chat(payload: ChatCreate, db: Session = Depends(get_db)):
    title = payload.title.strip() or "New chat"
    chat = Chat(title=title[:160])
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@router.get("/chats/{chat_id}", response_model=ChatDetail)
def get_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    db.delete(chat)
    db.commit()
    return {"deleted": True}


@router.post("/chats/{chat_id}/upload")
async def upload_pdf(chat_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    chat = db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be 8 MB or smaller")
    try:
        reader = PdfReader(BytesIO(raw))
        extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read this PDF") from exc
    if not extracted.strip():
        raise HTTPException(status_code=400, detail="No selectable text found. Scanned PDFs are not supported in this version.")
    document = Document(chat_id=chat_id, filename=filename[:255], extracted_text=extracted[:150000])
    db.add(document)
    db.commit()
    return {"uploaded": True, "filename": document.filename, "characters_extracted": len(document.extracted_text)}


@router.post("/chats/{chat_id}/messages", response_model=MessageOut)
def send_message(chat_id: int, payload: ChatRequest, db: Session = Depends(get_db)):
    chat = db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    question = payload.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not settings.groq_api_key.strip():
        raise HTTPException(status_code=503, detail="AI is not configured. Add GROQ_API_KEY to backend/.env and restart the backend.")

    previous = db.scalars(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.id.desc()).limit(10)
    ).all()
    previous = list(reversed(previous))
    latest_doc = db.scalars(
        select(Document).where(Document.chat_id == chat_id).order_by(Document.id.desc())
    ).first()

    system_prompt = (
        "You are NexaAI, a helpful and accurate AI assistant. Answer in the same language as the user. "
        "Explain clearly and use examples when useful. If document context is provided, prioritize it and "
        "say honestly when the requested answer is not in the document."
    )
    if latest_doc:
        system_prompt += (
            f"\n\nThe user uploaded a PDF named {latest_doc.filename}. "
            "Use the following extracted text as document context (it may be incomplete):\n"
            + latest_doc.extracted_text[:14000]
        )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": item.role, "content": item.content} for item in previous)
    messages.append({"role": "user", "content": question})

    try:
        client = Groq(api_key=settings.groq_api_key.strip(), timeout=60, max_retries=1)
        completion = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_completion_tokens=1800,
        )
        answer = completion.choices[0].message.content or "I could not generate a response. Please try again."
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail="Groq rejected the API key. Check the key in backend/.env.") from exc
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail="Groq rate limit or quota reached. Try again later.") from exc
    except APIConnectionError as exc:
        raise HTTPException(status_code=502, detail="Could not connect to Groq. Check your internet connection.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {str(exc)[:200]}") from exc

    user_message = Message(chat_id=chat_id, role="user", content=question)
    assistant_message = Message(chat_id=chat_id, role="assistant", content=answer)
    if chat.title == "New chat":
        chat.title = question[:55] + ("…" if len(question) > 55 else "")
    db.add_all([user_message, assistant_message])
    db.commit()
    db.refresh(assistant_message)
    return assistant_message

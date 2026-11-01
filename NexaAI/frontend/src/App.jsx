import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Send, Paperclip, Mic, Trash2, Download, Copy, Menu, Sparkles, FileText, X, MessageSquare } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function App() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  }

  async function loadChats() {
    try {
      const data = await api("/api/chats");
      setChats(data);
      setError("");
    } catch (err) {
      setError(`Backend connection error: ${err.message}. Check that FastAPI is running.`);
    }
  }

  async function openChat(id) {
    setError("");
    try {
      const data = await api(`/api/chats/${id}`);
      setActive(data.id);
      setMessages(data.messages || []);
      setDocName("");
    } catch (err) { setError(err.message); }
  }

  async function newChat() {
    setError("");
    try {
      const chat = await api("/api/chats", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" })
      });
      setChats(previous => [chat, ...previous]);
      setActive(chat.id);
      setMessages([]);
      setDocName("");
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { loadChats(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function sendMessage(event) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    let chatId = active;
    if (!chatId) {
      try {
        const chat = await api("/api/chats", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New chat" })
        });
        chatId = chat.id;
        setActive(chatId);
        setChats(previous => [chat, ...previous]);
      } catch (err) { setError(err.message); return; }
    }
    setInput("");
    setError("");
    setMessages(previous => [...previous, { id: `temp-${Date.now()}`, role: "user", content: text }]);
    setBusy(true);
    try {
      const answer = await api(`/api/chats/${chatId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const detail = await api(`/api/chats/${chatId}`);
      setMessages(detail.messages || [answer]);
      await loadChats();
    } catch (err) {
      setError(err.message);
      setMessages(previous => [...previous, { id: `error-${Date.now()}`, role: "assistant", content: `I couldn't complete that request. ${err.message}` }]);
    } finally { setBusy(false); }
  }

  async function uploadPdf(file) {
    if (!file) return;
    if (!active) {
      setError("First click New chat, then upload your PDF.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    setError("");
    try {
      const result = await api(`/api/chats/${active}/upload`, { method: "POST", body: form });
      setDocName(result.filename);
      setToast(`PDF added: ${result.filename}`);
      window.setTimeout(() => setToast(""), 2500);
    } catch (err) { setError(err.message); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteChat(id) {
    if (!window.confirm("Delete this chat permanently?")) return;
    try {
      await api(`/api/chats/${id}`, { method: "DELETE" });
      setChats(previous => previous.filter(chat => chat.id !== id));
      if (active === id) { setActive(null); setMessages([]); setDocName(""); }
    } catch (err) { setError(err.message); }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
      window.setTimeout(() => setToast(""), 1800);
    } catch { setError("Clipboard access is not available in this browser."); }
  }

  function exportChat() {
    if (!messages.length) return;
    const content = messages.map(message => `${message.role.toUpperCase()}\n${message.content}`).join("\n\n---\n\n");
    const blob = new Blob([`NexaAI conversation\n\n${content}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nexaai-chat.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge and allow microphone access.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = event => setInput(previous => `${previous}${previous ? " " : ""}${event.results[0][0].transcript}`);
    recognition.onerror = () => setError("Voice input failed. Check microphone permission and try again.");
    recognition.start();
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-hidden"}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={20} /></div><div><b>NexaAI</b><small>INTELLIGENCE, SIMPLIFIED</small></div></div>
        <button className="new-chat" onClick={newChat}><Plus size={18} /> New chat</button>
        <div className="side-label">YOUR WORKSPACE</div>
        <div className="chat-list">
          {chats.map(chat => (
            <div key={chat.id} className={`chat-row ${active === chat.id ? "selected" : ""}`}>
              <button className="chat-open" onClick={() => openChat(chat.id)}><MessageSquare size={15} /><span>{chat.title}</span></button>
              <button className="icon-btn delete-btn" title="Delete chat" onClick={() => deleteChat(chat.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {chats.length === 0 && <p className="empty-side">Your conversations will appear here.</p>}
        </div>
        <div className="sidebar-bottom"><div className="profile"><div className="avatar">N</div><div><b>Guest workspace</b><small>Local development</small></div></div></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-left"><button className="icon-btn" onClick={() => setSidebarOpen(value => !value)} title="Toggle sidebar"><Menu size={19} /></button><span className="breadcrumb">Workspace <span>/</span> <b>AI Assistant</b></span></div>
          <div className="top-actions"><span className="status-dot" /><span className="online-label">AI assistant</span><button className="export-btn" onClick={exportChat} disabled={!messages.length}><Download size={15} /> Export</button></div>
        </header>

        <section className="conversation">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon"><Bot size={34} /></div>
              <div className="eyebrow"><Sparkles size={13} /> YOUR AI WORKSPACE</div>
              <h1>What can I help you<br /><span>create today?</span></h1>
              <p>Ask questions, explore ideas, understand documents, or get help with code.</p>
              <div className="suggestions">
                {["Explain Python decorators with examples", "Create a 7-day React learning plan", "What can I learn from my PDF?", "Help me debug a FastAPI project"].map((suggestion, index) => (
                  <button key={suggestion} onClick={() => setInput(suggestion)}><span>{["⌘", "◈", "▤", "⌁"][index]}</span>{suggestion}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map(message => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="message-avatar">{message.role === "assistant" ? <Sparkles size={16} /> : "Y"}</div>
                  <div className="message-body"><div className="message-author">{message.role === "assistant" ? "NexaAI" : "You"}</div><div className="message-content">{message.content}</div>
                    {message.role === "assistant" && <button className="copy-btn" onClick={() => copyText(message.content)}><Copy size={13} /> Copy</button>}
                  </div>
                </article>
              ))}
              {busy && <article className="message assistant"><div className="message-avatar"><Sparkles size={16} /></div><div className="message-body"><div className="message-author">NexaAI</div><div className="typing"><i /><i /><i /></div></div></article>}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}
          {(docName || uploading) && <div className="file-chip"><FileText size={14} />{uploading ? "Reading PDF..." : docName}<button onClick={() => setDocName("")}><X size={13} /></button></div>}
          <form className="composer" onSubmit={sendMessage}>
            <input value={input} onChange={event => setInput(event.target.value)} placeholder="Message NexaAI..." aria-label="Message NexaAI" />
            <div className="composer-actions">
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={event => uploadPdf(event.target.files?.[0])} />
              <button type="button" className="tool-btn" title="Upload PDF" onClick={() => fileRef.current?.click()} disabled={uploading}><Paperclip size={18} /></button>
              <button type="button" className="tool-btn" title="Voice input" onClick={startVoice}><Mic size={18} /></button>
              <button type="submit" className="send-btn" disabled={busy || !input.trim()}><Send size={17} /></button>
            </div>
          </form>
          <div className="disclaimer">NexaAI can make mistakes. Check important information. <span>•</span> Your API key stays on the backend.</div>
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

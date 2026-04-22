// ============================================================
// components/ChatBox.jsx — Chat in tempo reale (Lobby + Game)
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";

export default function ChatBox({ roomCode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  useEffect(() => {
    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("chat_message", handleMessage);
    return () => socket.off("chat_message", handleMessage);
  }, []);

  // Scroll automatico all'ultimo messaggio
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !roomCode) return;
    socket.emit("chat_message", { text });
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="chatbox">
      <div className="chatbox-header">
        <span className="chatbox-title">CHAT</span>
        <span className="chatbox-room">#{roomCode}</span>
      </div>

      <div className="chatbox-messages" aria-live="polite" aria-label="Messaggi chat">
        {messages.length === 0 && (
          <p className="chatbox-empty">Nessun messaggio. Di&apos; qualcosa!</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.senderId === socket.id;
          return (
            <div key={i} className={`chat-msg ${isMe ? "chat-msg-me" : "chat-msg-them"}`}>
              <span className="chat-sender">{isMe ? "Tu" : msg.senderName}</span>
              <span className="chat-text">{msg.text}</span>
              <span className="chat-time">{formatTime(msg.ts)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chatbox-input-row">
        <input
          ref={inputRef}
          className="chatbox-input input-field"
          type="text"
          placeholder="Scrivi un messaggio…"
          maxLength={200}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Messaggio chat"
        />
        <button
          className="chatbox-send btn btn-primary btn-sm"
          onClick={sendMessage}
          disabled={!input.trim()}
          aria-label="Invia messaggio"
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

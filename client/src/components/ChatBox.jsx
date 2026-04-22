// ============================================================
// components/ChatBox.jsx — Chat riutilizzabile (lobby + game)
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";

export default function ChatBox({ myId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState("");
  const bottomRef               = useRef(null);

  useEffect(() => {
    const handleNewMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on("new_message", handleNewMessage);
    return () => socket.off("new_message", handleNewMessage);
  }, []);

  // Scroll automatico all'ultimo messaggio
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit("send_message", { text: trimmed });
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chatbox">
      <div className="chat-header">
        <span className="chat-title">💬 Chat</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">Nessun messaggio ancora…</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.playerId === myId;
          return (
            <div key={i} className={`chat-msg ${isMe ? "chat-msg-me" : "chat-msg-other"}`}>
              {!isMe && (
                <span className="chat-author">{msg.playerName}</span>
              )}
              <span className="chat-text">{msg.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          type="text"
          placeholder="Scrivi un messaggio…"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!text.trim()}
          aria-label="Invia"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

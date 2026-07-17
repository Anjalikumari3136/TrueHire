import { Bot } from "lucide-react";
import "./ChatFab.css";

export default function ChatFab() {
  return (
    <button type="button" className="chat-fab" aria-label="Open chat">
      <Bot size={22} />
    </button>
  );
}

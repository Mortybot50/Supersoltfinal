import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble from "./MessageBubble";
import QuickActions from "./QuickActions";
import VoiceInput from "./VoiceInput";
import ProgressIndicator from "./ProgressIndicator";
import { Send } from "lucide-react";

interface ChatInterfaceProps {
  onSendMessage: (
    message: string,
  ) => Promise<{ message: string; quickActions?: any[] }>;
  onQuickAction?: (action: string, value: string) => void;
}

export default function ChatInterface({
  onSendMessage,
  onQuickAction,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickActions, setQuickActions] = useState([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setLoading(true);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await onSendMessage(userMessage);

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.message },
      ]);

      // Update quick actions
      setQuickActions(response.quickActions || []);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: any) => {
    if (onQuickAction && action.action) {
      onQuickAction(action.action, action.value);
    } else {
      // Send as regular message
      setInput(action.value);
      await handleSend();
    }
  };

  const handleVoiceInput = (transcript: string) => {
    setInput(transcript);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      <Card className="flex-1 flex flex-col m-4 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Welcome to SuperSolt</h2>
          <ProgressIndicator progress={25} />
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <MessageBubble
                key={index}
                role={message.role}
                content={message.content}
              />
            ))}
            {loading && (
              <MessageBubble role="assistant" content="Thinking..." loading />
            )}
          </div>
        </ScrollArea>

        {quickActions.length > 0 && (
          <div className="p-4 border-t">
            <QuickActions actions={quickActions} onAction={handleQuickAction} />
          </div>
        )}

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1"
            />
            <VoiceInput onTranscript={handleVoiceInput} />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

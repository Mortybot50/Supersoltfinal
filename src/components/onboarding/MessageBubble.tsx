import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface MessageBubbleProps {
  role: 'assistant' | 'user';
  content: string;
  loading?: boolean;
}

export default function MessageBubble({ role, content, loading }: MessageBubbleProps) {
  const isAssistant = role === 'assistant';

  return (
    <div className={cn(
      "flex gap-3",
      isAssistant ? "justify-start" : "justify-end"
    )}>
      {isAssistant && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[80%] rounded-lg px-4 py-2",
        isAssistant 
          ? "bg-muted text-foreground" 
          : "bg-primary text-primary-foreground"
      )}>
        <p className="text-sm whitespace-pre-wrap">
          {loading ? (
            <span className="flex gap-1">
              <span className="animate-bounce delay-0">.</span>
              <span className="animate-bounce delay-75">.</span>
              <span className="animate-bounce delay-150">.</span>
            </span>
          ) : content}
        </p>
      </div>

      {!isAssistant && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
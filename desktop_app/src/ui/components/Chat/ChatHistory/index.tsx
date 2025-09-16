import { UIMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ScrollArea } from '@ui/components/ui/scroll-area';
import { cn } from '@ui/lib/utils/tailwind';

import { AssistantMessage, MemoriesMessage, OtherMessage, UserMessage } from './Messages';

const CHAT_SCROLL_AREA_ID = 'chat-scroll-area';
const CHAT_SCROLL_AREA_SELECTOR = `#${CHAT_SCROLL_AREA_ID} [data-radix-scroll-area-viewport]`;

interface ChatHistoryProps {
  messages: UIMessage[];
  chatId: number;
  sessionId: string;
  editingMessageId: string | null;
  editingContent: string;
  onEditStart: (messageId: string, content: string) => void;
  onEditCancel: () => void;
  onEditSave: (messageId: string) => void;
  onEditChange: (content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateMessage: (messageIndex: number) => void;
  isRegenerating?: boolean;
  regeneratingIndex?: number | null;
  isSubmitting?: boolean;
}

interface MessageProps {
  message: UIMessage;
  messageIndex: number;
  editingMessageId: string | null;
  editingContent: string;
  onEditStart: (messageId: string, content: string) => void;
  onEditCancel: () => void;
  onEditSave: (messageId: string) => void;
  onEditChange: (content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateMessage: (messageIndex: number) => void;
  isRegenerating?: boolean;
  regeneratingIndex?: number | null;
}

const Message = ({
  message,
  messageIndex,
  editingMessageId,
  editingContent,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditChange,
  onDeleteMessage,
  onRegenerateMessage,
  regeneratingIndex,
}: MessageProps) => {
  const isEditing = editingMessageId === message.id;

  // Extract text content for editing
  let textContent = '';
  if (message.parts) {
    textContent = message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');
  }

  const commonProps = {
    message,
    messageIndex,
    isEditing,
    editingContent: isEditing ? editingContent : '',
    onEditStart: () => onEditStart(message.id, textContent),
    onEditCancel,
    onEditSave: () => onEditSave(message.id),
    onEditChange,
    onDelete: () => onDeleteMessage(message.id),
  };

  switch (message.role) {
    case 'user':
      return <UserMessage {...commonProps} />;
    case 'assistant':
      return (
        <AssistantMessage
          {...commonProps}
          onRegenerate={() => onRegenerateMessage(messageIndex)}
          isRegenerating={regeneratingIndex === messageIndex}
        />
      );
    case 'system':
      // Check if this is a memories message
      if (message.id === 'system-memories') {
        return <MemoriesMessage message={message} />;
      }
      return <OtherMessage message={message} />;
    default:
      return <OtherMessage message={message} />;
  }
};

const getMessageClassName = (role: 'user' | 'assistant' | 'system') => {
  switch (role) {
    case 'user':
      return 'bg-primary border border-primary/20 ml-8 text-primary-foreground';
    case 'assistant':
      return 'bg-muted mr-8';
    case 'system':
      return 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-600';
    default:
      return 'bg-muted border';
  }
};

export default function ChatHistory({
  messages,
  editingMessageId,
  editingContent,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditChange,
  onDeleteMessage,
  onRegenerateMessage,
  isRegenerating,
  regeneratingIndex,
  isSubmitting,
}: ChatHistoryProps) {
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollAreaRef = useRef<HTMLElement | null>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom when new messages are added or content changes
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current && shouldAutoScroll && !isScrollingRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [shouldAutoScroll]);

  const checkIfAtBottom = useCallback(() => {
    if (!scrollAreaRef.current) {
      return false;
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;

    // Consider "at bottom" to be within 10px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    return isAtBottom;
  }, []);

  const handleScroll = useCallback(() => {
    // Mark that user is scrolling
    isScrollingRef.current = true;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce the scroll end detection
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      const isAtBottom = checkIfAtBottom();
      setShouldAutoScroll(isAtBottom);
    }, 150); // 150ms debounce
  }, [checkIfAtBottom]);

  // Set up scroll area ref and scroll listener
  useEffect(() => {
    const scrollArea = document.querySelector(CHAT_SCROLL_AREA_SELECTOR) as HTMLElement;
    if (scrollArea) {
      scrollAreaRef.current = scrollArea;
      scrollArea.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        scrollArea.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  // Trigger scroll when messages change or submission state changes (only if shouldAutoScroll is true)
  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [messages, isSubmitting, scrollToBottom]);

  return (
    <ScrollArea id={CHAT_SCROLL_AREA_ID} className="h-full w-full border rounded-lg overflow-hidden">
      <div className="p-4 space-y-4 max-w-full overflow-hidden">
        {messages.map((message, index) => (
          <div
            key={message.id || `message-${index}`}
            className={cn(
              'rounded-lg overflow-hidden min-w-0',
              // Special handling for memories message
              message.id === 'system-memories' ? '' : 'p-3',
              message.id === 'system-memories' ? '' : getMessageClassName(message.role)
            )}
          >
            {message.id !== 'system-memories' && (
              <div className="text-xs font-medium mb-1 opacity-70 capitalize">{message.role}</div>
            )}
            <div className="overflow-hidden min-w-0">
              <Message
                message={message}
                messageIndex={index}
                editingMessageId={editingMessageId}
                editingContent={editingContent}
                onEditStart={onEditStart}
                onEditCancel={onEditCancel}
                onEditSave={onEditSave}
                onEditChange={onEditChange}
                onDeleteMessage={onDeleteMessage}
                onRegenerateMessage={onRegenerateMessage}
                isRegenerating={isRegenerating}
                regeneratingIndex={regeneratingIndex}
              />
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

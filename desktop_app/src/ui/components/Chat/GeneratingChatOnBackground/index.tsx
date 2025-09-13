import { UIMessage } from '@ai-sdk/react';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card';
import { useChatStore } from '@ui/stores';

interface GeneratingChatOnBackgroundProps {
  chatId: number;
  sessionId: string;
  messages: UIMessage[];
}

export function GeneratingChatOnBackground({ chatId, sessionId, messages }: GeneratingChatOnBackgroundProps) {
  const { selectChat, removeGeneratingChat } = useChatStore();

  const handleRefresh = () => {
    selectChat(chatId);
    if (messages.length > 0) removeGeneratingChat(sessionId);
  };

  useEffect(() => {
    const hasAssistantMessage = messages.some((m) => m.role === 'assistant');
    if (hasAssistantMessage) removeGeneratingChat(sessionId);
  }, [messages, removeGeneratingChat, sessionId]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      handleRefresh();
    }, 3000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto text-center rounded-2xl shadow-md border border-muted">
      <CardHeader>
        <div className="flex justify-center mb-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <CardTitle className="text-lg font-semibold">Generating your chat...</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Please wait a moment while we prepare everything in the background.
        </p>
      </CardContent>
    </Card>
  );
}

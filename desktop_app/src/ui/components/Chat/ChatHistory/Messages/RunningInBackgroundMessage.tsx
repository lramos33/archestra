import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useChatStore } from '@ui/stores';

interface RunningInBackgroundMessageProps {
  chatId: number;
}

export default function RunningInBackgroundMessage({ chatId }: RunningInBackgroundMessageProps) {
  const [dots, setDots] = useState('');
  const { selectChat } = useChatStore();

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    selectChat(chatId);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      handleRefresh();
    }, 2000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 animate-pulse text-orange-500" />
        <span className="text-sm text-muted-foreground">Preparing your request{dots}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        We're running your request in the background and will be ready soon...
      </p>
    </div>
  );
}

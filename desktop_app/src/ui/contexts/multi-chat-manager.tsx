import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import config from '@ui/config';
import { useMessageActions } from '@ui/hooks/useMessageActions';
import { getAllMemories } from '@ui/lib/clients/archestra/api/gen';
import { useChatStore, useCloudProvidersStore, useOllamaStore, useToolsStore } from '@ui/stores';
import { useStatusBarStore } from '@ui/stores/status-bar-store';

interface ChatInstanceState {
  sessionId: string;
  chatId: number;
  title: string;
  messages: UIMessage[];
  status: string;
  isLoading: boolean;
  isSubmitting: boolean;
  editingMessageId: string | null;
  editingContent: string;
  regeneratingIndex: number | null;
  fullMessagesBackup: UIMessage[];
  hasTooManyTools: boolean;
  hasLoadedMemories: boolean;
}

interface ChatInstanceActions {
  setMessages: (msgs: UIMessage[]) => void;
  sendMessage: (args: { text: string }) => void;
  stop: () => void;
  regenerate: () => void;
  setIsSubmitting: (b: boolean) => void;
  setEditingContent: (c: string) => void;
  startEdit: (id: string, content: string) => void;
  cancelEdit: () => void;
  saveEdit: (id: string) => void;
  deleteMessage: (id: string) => void;
  handleRegenerateMessage: (idx: number) => Promise<void>;
  setHasTooManyTools: (b: boolean) => void;
  setHasLoadedMemories: (b: boolean) => void;
  loadMemoriesIfNeeded: () => Promise<void>;
}

export type ChatInstance = ChatInstanceState & ChatInstanceActions;

interface MultiChatManagerContextType {
  getCurrentChatInstance: () => ChatInstance | null;
  getChatInstance: (sessionId: string) => ChatInstance | null;
}

const MultiChatManagerContext = createContext<MultiChatManagerContextType | null>(null);

// Component that manages a single chat instance
function ChatInstanceManager({
  sessionId,
  chatId,
  title,
  onInstanceCreated,
  initialMessages = [],
}: {
  sessionId: string;
  chatId: number;
  title: string;
  onInstanceCreated: (instance: ChatInstance) => void;
  initialMessages?: UIMessage[];
}) {
  const { getCurrentChat } = useChatStore();
  const { selectedToolIds } = useToolsStore();
  const { selectedModel } = useOllamaStore();
  const { availableCloudProviderModels } = useCloudProvidersStore();
  const { setChatInference } = useStatusBarStore();
  const [hasTooManyTools, setHasTooManyTools] = useState(false);
  const [hasLoadedMemories, setHasLoadedMemories] = useState(false);

  // Refs for transport
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const availableCloudProviderModelsRef = useRef(availableCloudProviderModels);
  availableCloudProviderModelsRef.current = availableCloudProviderModels;
  const selectedToolIdsRef = useRef(selectedToolIds);
  selectedToolIdsRef.current = selectedToolIds;

  const transport = useMemo(() => {
    const apiEndpoint = `${config.archestra.chatStreamBaseUrl}/stream`;
    return new DefaultChatTransport({
      api: apiEndpoint,
      prepareSendMessagesRequest: ({ id, messages }) => {
        const currentModel = selectedModelRef.current;
        const currentCloudProviderModels = availableCloudProviderModelsRef.current;
        const cloudModel = currentCloudProviderModels.find((m) => m.id === currentModel);
        const provider = cloudModel ? cloudModel.provider : 'ollama';
        return {
          body: {
            messages,
            model: currentModel || 'llama3.1:8b',
            sessionId: id || sessionId,
            provider: provider,
            chatId: chatId,
            toolChoice: 'auto',
          },
        };
      },
    });
  }, [sessionId, chatId, getCurrentChat]);

  const { sendMessage, messages, setMessages, stop, status, regenerate } = useChat({
    id: sessionId || 'temp-id',
    transport,
    onError: (error) => {
      console.error('Chat error:', error);
    },
    messages: initialMessages,
  });

  // Regeneration logic
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [fullMessagesBackup, setFullMessagesBackup] = useState<UIMessage[]>([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Message actions
  const { editingMessageId, editingContent, setEditingContent, startEdit, cancelEdit, saveEdit, deleteMessage } =
    useMessageActions({
      messages,
      setMessages,
      sendMessage,
      sessionId: sessionId,
    });

  // Regenerate handler
  const handleRegenerateMessage = async (messageIndex: number) => {
    const messageToRegenerate = messages[messageIndex];
    if (!messageToRegenerate || messageToRegenerate.role !== 'assistant') return;
    setRegeneratingIndex(messageIndex);
    setFullMessagesBackup(messages);
    const conversationUpToAssistant = messages.slice(0, messageIndex + 1);
    setMessages(conversationUpToAssistant);
    regenerate();
  };

  // StatusBar inference
  useEffect(() => {
    if (status === 'streaming' || isSubmitting) {
      setChatInference(sessionId, title, true);
    } else if (status === 'ready' || status === 'error') {
      setChatInference(sessionId, title, false);
    }
  }, [status, isSubmitting, sessionId, title, setChatInference]);

  // Submission state reset
  useEffect(() => {
    if (status === 'streaming') setIsSubmitting(false);
  }, [status]);

  useEffect(() => {
    if (status === 'ready' || status === 'error') setIsSubmitting(false);
    if (status === 'error' && regeneratingIndex !== null && fullMessagesBackup.length > 0) {
      setMessages(fullMessagesBackup);
      setFullMessagesBackup([]);
      setRegeneratingIndex(null);
    }
  }, [status, regeneratingIndex, fullMessagesBackup]);

  // Regeneration merge
  useEffect(() => {
    if (status === 'ready' && regeneratingIndex !== null && fullMessagesBackup.length > 0) {
      const newRegeneratedMessage = messages[messages.length - 1];
      if (newRegeneratedMessage && regeneratingIndex < fullMessagesBackup.length) {
        const updatedMessages = [...fullMessagesBackup];
        updatedMessages[regeneratingIndex] = newRegeneratedMessage;
        setMessages(updatedMessages);
      } else {
        setMessages(fullMessagesBackup);
      }
      setFullMessagesBackup([]);
      setRegeneratingIndex(null);
    } else if (status === 'ready' && regeneratingIndex !== null) {
      setRegeneratingIndex(null);
    }
  }, [status, regeneratingIndex, fullMessagesBackup.length]);

  // Memories loader
  const loadMemoriesIfNeeded = useCallback(async () => {
    if (messages.length === 0 && !hasLoadedMemories) {
      try {
        const { data } = await getAllMemories();
        if (data && data.memories && data.memories.length > 0) {
          const memoriesText = data.memories.map((m) => `${m.name}: ${m.value}`).join('\n');
          const systemMessage: UIMessage = {
            id: 'system-memories',
            role: 'system',
            parts: [{ type: 'text', text: `Previous memories loaded:\n${memoriesText}` }],
          };
          setMessages([systemMessage]);
        }
        setHasLoadedMemories(true);
      } catch (error) {
        setHasLoadedMemories(true);
      }
    }
  }, [messages, hasLoadedMemories]);

  const isLoading = status === 'streaming';

  // Create instance object with stable references
  const stableActions = useMemo(
    () => ({
      setMessages,
      sendMessage,
      stop,
      regenerate,
      setIsSubmitting,
      setEditingContent,
      startEdit,
      cancelEdit,
      saveEdit,
      deleteMessage,
      handleRegenerateMessage,
      setHasTooManyTools,
      setHasLoadedMemories,
      loadMemoriesIfNeeded,
    }),
    [
      setMessages,
      sendMessage,
      stop,
      regenerate,
      setIsSubmitting,
      setEditingContent,
      startEdit,
      cancelEdit,
      saveEdit,
      deleteMessage,
      handleRegenerateMessage,
      setHasTooManyTools,
      setHasLoadedMemories,
      loadMemoriesIfNeeded,
    ]
  );

  const instance: ChatInstance = useMemo(
    () => ({
      sessionId,
      chatId,
      title,
      messages,
      status,
      isLoading,
      isSubmitting,
      editingMessageId,
      editingContent,
      regeneratingIndex,
      fullMessagesBackup,
      hasTooManyTools,
      hasLoadedMemories,
      ...stableActions,
    }),
    [
      sessionId,
      chatId,
      title,
      messages,
      status,
      isLoading,
      isSubmitting,
      editingMessageId,
      editingContent,
      regeneratingIndex,
      fullMessagesBackup,
      hasTooManyTools,
      hasLoadedMemories,
      stableActions,
    ]
  );

  // Notify parent when instance is created/updated
  // Only notify on significant state changes to prevent infinite loops
  const prevStatusRef = useRef<string>(null);
  const prevLoadingRef = useRef<boolean>(null);
  const prevSubmittingRef = useRef<boolean>(null);
  const hasNotified = useRef(false);

  useEffect(() => {
    const statusChanged = prevStatusRef.current !== status;
    const loadingChanged = prevLoadingRef.current !== isLoading;
    const submittingChanged = prevSubmittingRef.current !== isSubmitting;
    const isFirstTime = !hasNotified.current;

    if (isFirstTime || statusChanged || loadingChanged || submittingChanged) {
      prevStatusRef.current = status;
      prevLoadingRef.current = isLoading;
      prevSubmittingRef.current = isSubmitting;
      hasNotified.current = true;

      onInstanceCreated(instance);
    }
  }, [status, isLoading, isSubmitting, instance, onInstanceCreated]);

  // This component doesn't render anything
  return null;
}

export function MultiChatManagerProvider({ children }: { children: React.ReactNode }) {
  const { getCurrentChat } = useChatStore();
  const [chatInstances, setChatInstances] = useState<Map<string, ChatInstance>>(new Map());
  const [requestedInstances, setRequestedInstances] = useState<Set<string>>(new Set());

  const currentChat = getCurrentChat();
  const currentChatSessionId = currentChat?.sessionId || '';

  useEffect(() => {
    if (currentChatSessionId) {
      setRequestedInstances((prev) => new Set(prev).add(currentChatSessionId));
    }
  }, [currentChatSessionId]);

  const handleInstanceCreated = useCallback(
    (instance: ChatInstance) => {
      setChatInstances((prev) => {
        const existing = prev.get(instance.sessionId);

        // Only update if there's a significant change to prevent unnecessary re-renders
        if (
          !existing ||
          existing.status !== instance.status ||
          existing.isLoading !== instance.isLoading ||
          existing.isSubmitting !== instance.isSubmitting ||
          existing.messages.length !== instance.messages.length
        ) {
          const newMap = new Map(prev);
          newMap.set(instance.sessionId, instance);

          return newMap;
        }

        return prev;
      });
    },
    [currentChatSessionId]
  );

  const getCurrentChatInstance = useCallback(() => {
    return chatInstances.get(currentChatSessionId) || null;
  }, [chatInstances, currentChatSessionId]);

  const getChatInstance = useCallback(
    (sessionId: string) => {
      return chatInstances.get(sessionId) || null;
    },
    [chatInstances]
  );

  return (
    <MultiChatManagerContext.Provider
      value={{
        getCurrentChatInstance,
        getChatInstance,
      }}
    >
      {Array.from(requestedInstances).map((sessionId) => {
        const chat = useChatStore.getState().chats.find((c) => c.sessionId === sessionId);
        if (!chat) return null;

        return (
          <ChatInstanceManager
            key={sessionId}
            sessionId={sessionId}
            chatId={chat.id}
            title={chat.title || ''}
            onInstanceCreated={handleInstanceCreated}
            initialMessages={chat.messages || []}
          />
        );
      })}
      {children}
    </MultiChatManagerContext.Provider>
  );
}

export function useMultiChatManager() {
  const context = useContext(MultiChatManagerContext);
  if (!context) throw new Error('useMultiChatManager must be used within a MultiChatManagerProvider');
  return context;
}

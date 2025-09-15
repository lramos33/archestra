import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import config from '@ui/config';
import { useMessageActions } from '@ui/hooks/useMessageActions';
import { getAllMemories } from '@ui/lib/clients/archestra/api/gen';
import { useChatStore, useCloudProvidersStore, useOllamaStore, useToolsStore } from '@ui/stores';
import { useStatusBarStore } from '@ui/stores/status-bar-store';

interface IChatAgentContext {
  messages: UIMessage[];
  setMessages: (msgs: UIMessage[]) => void;
  sendMessage: (args: { text: string }) => void;
  stop: () => void;
  status: string;
  regenerate: () => void;
  isLoading: boolean;
  isSubmitting: boolean;
  setIsSubmitting: (b: boolean) => void;
  submissionStartTime: number;
  setSubmissionStartTime: (n: number) => void;
  editingMessageId: string | null;
  editingContent: string;
  setEditingContent: (c: string) => void;
  startEdit: (id: string, content: string) => void;
  cancelEdit: () => void;
  saveEdit: (id: string) => void;
  deleteMessage: (id: string) => void;
  handleRegenerateMessage: (idx: number) => Promise<void>;
  regeneratingIndex: number | null;
  fullMessagesBackup: UIMessage[];
  currentChatSessionId: string;
  currentChat: any;
  currentChatTitle: string;
  pendingPrompt: string | undefined;
  setPendingPrompts: (id: string, prompt: string) => void;
  removePendingPrompt: (id: string) => void;
  hasTooManyTools: boolean;
  setHasTooManyTools: (b: boolean) => void;
  hasLoadedMemories: boolean;
  setHasLoadedMemories: (b: boolean) => void;
  loadMemoriesIfNeeded: () => Promise<void>;
}

const ChatAgentContext = createContext({} as IChatAgentContext);

export function ChatAgentProvider({ children }: { children: React.ReactNode }) {
  // --- Copied from chat.tsx ---
  const { getCurrentChat, getCurrentChatTitle } = useChatStore();
  const { selectedToolIds } = useToolsStore();
  const { selectedModel } = useOllamaStore();
  const { availableCloudProviderModels } = useCloudProvidersStore();
  const { setChatInference } = useStatusBarStore();
  const [hasTooManyTools, setHasTooManyTools] = useState(false);
  const [hasLoadedMemories, setHasLoadedMemories] = useState(false);

  const currentChat = getCurrentChat();
  const currentChatSessionId = currentChat?.sessionId || '';
  const currentChatMessages = currentChat?.messages || [];
  const currentChatTitle = getCurrentChatTitle();

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
        const currentChat = getCurrentChat();
        const cloudModel = currentCloudProviderModels.find((m) => m.id === currentModel);
        const provider = cloudModel ? cloudModel.provider : 'ollama';
        return {
          body: {
            messages,
            model: currentModel || 'llama3.1:8b',
            sessionId: id || currentChatSessionId,
            provider: provider,
            chatId: currentChat?.id,
            toolChoice: 'auto',
          },
        };
      },
    });
  }, [currentChatSessionId, getCurrentChat]);

  const { sendMessage, messages, setMessages, stop, status, regenerate } = useChat({
    id: currentChatSessionId || 'temp-id',
    transport,
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Pending prompts logic
  const pendingPrompts = useChatStore((s) => s.pendingPrompts);
  const setPendingPrompts = useChatStore((s) => s.setPendingPrompts);
  const removePendingPrompt = useChatStore((s) => s.removePendingPrompt);
  const pendingPrompt = pendingPrompts.get(currentChatSessionId);

  // Regeneration logic
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [fullMessagesBackup, setFullMessagesBackup] = useState<UIMessage[]>([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStartTime, setSubmissionStartTime] = useState<number>(Date.now());

  // Message actions
  const { editingMessageId, editingContent, setEditingContent, startEdit, cancelEdit, saveEdit, deleteMessage } =
    useMessageActions({
      messages,
      setMessages,
      sendMessage,
      sessionId: currentChatSessionId,
    });

  // Patch handlers to match expected signatures for ChatHistory
  const handleEditStart = (messageId: string, content: string) => startEdit(messageId, content);
  const handleEditSave = (messageId: string) => saveEdit(messageId);
  const handleDeleteMessage = (messageId: string) => deleteMessage(messageId);

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
      setChatInference(currentChatSessionId, currentChatTitle, true);
    } else if (status === 'ready' || status === 'error') {
      setChatInference(currentChatSessionId, currentChatTitle, false);
    }
  }, [status, isSubmitting, currentChatSessionId, currentChatTitle, setChatInference]);

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
  }, [status, regeneratingIndex, fullMessagesBackup, messages]);

  // Load messages from DB when chat changes
  useEffect(() => {
    if (currentChat && currentChatSessionId) {
      if (currentChatMessages && currentChatMessages.length > 0) {
        setMessages(currentChatMessages);
      } else {
        setMessages([]);
      }
    }
  }, [currentChatSessionId, currentChatMessages, currentChat]);

  // Memories loader
  const loadMemoriesIfNeeded = useCallback(async () => {
    if (messages.length === 0 && !hasLoadedMemories) {
      try {
        const { data } = await getAllMemories();
        if (data && data.memories && data.memories.length > 0) {
          const memoriesText = data.memories.map((m) => `${m.name}: ${m.value}`).join('\n');
          // Add a system message with the memories
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

  return (
    <ChatAgentContext.Provider
      value={{
        messages,
        setMessages,
        sendMessage,
        stop,
        status,
        regenerate,
        isLoading,
        isSubmitting,
        setIsSubmitting,
        submissionStartTime,
        setSubmissionStartTime,
        editingMessageId,
        editingContent,
        setEditingContent,
        startEdit: handleEditStart,
        cancelEdit,
        saveEdit: handleEditSave,
        deleteMessage: handleDeleteMessage,
        handleRegenerateMessage,
        regeneratingIndex,
        fullMessagesBackup,
        currentChatSessionId,
        currentChat,
        currentChatTitle,
        pendingPrompt,
        setPendingPrompts,
        removePendingPrompt,
        hasTooManyTools,
        setHasTooManyTools,
        hasLoadedMemories,
        setHasLoadedMemories,
        loadMemoriesIfNeeded,
      }}
    >
      {children}
    </ChatAgentContext.Provider>
  );
}

export function useChatAgent(): IChatAgentContext {
  const context = useContext(ChatAgentContext);
  if (!context) throw new Error('useChatAgent must be used within a ChatAgentProvider.');
  return context;
}

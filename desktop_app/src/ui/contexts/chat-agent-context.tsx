import { UIMessage } from 'ai';
import { createContext, useContext } from 'react';

import { useChatStore } from '@ui/stores';

import { ChatInstance, MultiChatManagerProvider, useMultiChatManager } from './multi-chat-manager';

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
  hasTooManyTools: boolean;
  setHasTooManyTools: (b: boolean) => void;
  hasLoadedMemories: boolean;
  setHasLoadedMemories: (b: boolean) => void;
  loadMemoriesIfNeeded: () => Promise<void>;

  // Multi-chat support
  getChatInstance: (sessionId: string) => ChatInstance | null;
  getAllChatInstances: () => Map<string, ChatInstance>;
  createChatInstance: (sessionId: string, chatId: number, title: string) => void;
  removeChatInstance: (sessionId: string) => void;
  getActiveChatInstances: () => ChatInstance[];
}

const ChatAgentContext = createContext({} as IChatAgentContext);

function ChatAgentContextProvider({ children }: { children: React.ReactNode }) {
  const { getCurrentChat, getCurrentChatTitle } = useChatStore();
  const multiChatManager = useMultiChatManager();

  const currentChat = getCurrentChat();
  const currentChatSessionId = currentChat?.sessionId || '';
  const currentChatTitle = getCurrentChatTitle();
  const currentChatInstance = multiChatManager.getCurrentChatInstance();

  const currentValues = currentChatInstance || {
    messages: [],
    setMessages: () => {},
    sendMessage: () => {},
    stop: () => {},
    status: 'ready',
    regenerate: () => {},
    isLoading: false,
    isSubmitting: false,
    setIsSubmitting: () => {},
    submissionStartTime: Date.now(),
    setSubmissionStartTime: () => {},
    editingMessageId: null,
    editingContent: '',
    setEditingContent: () => {},
    startEdit: () => {},
    cancelEdit: () => {},
    saveEdit: () => {},
    deleteMessage: () => {},
    handleRegenerateMessage: async () => {},
    regeneratingIndex: null,
    fullMessagesBackup: [],
    hasTooManyTools: false,
    setHasTooManyTools: () => {},
    hasLoadedMemories: false,
    setHasLoadedMemories: () => {},
    loadMemoriesIfNeeded: async () => {},
  };

  return (
    <ChatAgentContext.Provider
      value={{
        messages: currentValues.messages,
        setMessages: currentValues.setMessages,
        sendMessage: currentValues.sendMessage,
        stop: currentValues.stop,
        status: currentValues.status,
        regenerate: currentValues.regenerate,
        isLoading: currentValues.isLoading,
        isSubmitting: currentValues.isSubmitting,
        setIsSubmitting: currentValues.setIsSubmitting,
        submissionStartTime: currentValues.submissionStartTime,
        setSubmissionStartTime: currentValues.setSubmissionStartTime,
        editingMessageId: currentValues.editingMessageId,
        editingContent: currentValues.editingContent,
        setEditingContent: currentValues.setEditingContent,
        startEdit: currentValues.startEdit,
        cancelEdit: currentValues.cancelEdit,
        saveEdit: currentValues.saveEdit,
        deleteMessage: currentValues.deleteMessage,
        handleRegenerateMessage: currentValues.handleRegenerateMessage,
        regeneratingIndex: currentValues.regeneratingIndex,
        fullMessagesBackup: currentValues.fullMessagesBackup,
        currentChatSessionId,
        currentChat,
        currentChatTitle,
        hasTooManyTools: currentValues.hasTooManyTools,
        setHasTooManyTools: currentValues.setHasTooManyTools,
        hasLoadedMemories: currentValues.hasLoadedMemories,
        setHasLoadedMemories: currentValues.setHasLoadedMemories,
        loadMemoriesIfNeeded: currentValues.loadMemoriesIfNeeded,

        // Multi-chat support
        getChatInstance: multiChatManager.getChatInstance,
        getAllChatInstances: multiChatManager.getAllChatInstances,
        createChatInstance: multiChatManager.createChatInstance,
        removeChatInstance: multiChatManager.removeChatInstance,
        getActiveChatInstances: multiChatManager.getActiveChatInstances,
      }}
    >
      {children}
    </ChatAgentContext.Provider>
  );
}

export function ChatAgentProvider({ children }: { children: React.ReactNode }) {
  return (
    <MultiChatManagerProvider>
      <ChatAgentContextProvider>{children}</ChatAgentContextProvider>
    </MultiChatManagerProvider>
  );
}

export function useChatAgent(): IChatAgentContext {
  const context = useContext(ChatAgentContext);
  if (!context) throw new Error('useChatAgent must be used within a ChatAgentProvider.');
  return context;
}

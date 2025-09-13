import { useChat } from '@ai-sdk/react';
import { createFileRoute } from '@tanstack/react-router';
import { DefaultChatTransport, UIMessage } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChatHistory from '@ui/components/Chat/ChatHistory';
import ChatInput from '@ui/components/Chat/ChatInput';
import EmptyChatState from '@ui/components/Chat/EmptyChatState';
import SystemPrompt from '@ui/components/Chat/SystemPrompt';
import config from '@ui/config';
import { useMessageActions } from '@ui/hooks/useMessageActions';
import { useChatStore, useCloudProvidersStore, useOllamaStore, useToolsStore } from '@ui/stores';
import { useStatusBarStore } from '@ui/stores/status-bar-store';

export const Route = createFileRoute('/chat')({
  component: ChatPage,
});

function ChatPage() {
  const { getCurrentChat, getCurrentChatTitle, saveDraftMessage, getDraftMessage, clearDraftMessage } = useChatStore();
  const { selectedToolIds } = useToolsStore();
  const { selectedModel } = useOllamaStore();
  const { availableCloudProviderModels } = useCloudProvidersStore();
  const { setChatInference } = useStatusBarStore();

  const currentChat = getCurrentChat();
  const currentChatSessionId = currentChat?.sessionId || '';
  const currentChatMessages = currentChat?.messages || [];
  const currentChatTitle = getCurrentChatTitle();

  // Get current input from draft messages
  const currentInput = currentChat ? getDraftMessage(currentChat.id) : '';

  // We use useRef because prepareSendMessagesRequest captures values when created.
  // Without ref, switching models/providers wouldn't work - it would always use the old values.
  // The refs let us always get the current selected model and provider values.
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
        const currentSelectedToolIds = selectedToolIdsRef.current;
        const currentChat = getCurrentChat();

        const cloudModel = currentCloudProviderModels.find((m) => m.id === currentModel);
        const provider = cloudModel ? cloudModel.provider : 'ollama';

        return {
          body: {
            messages,
            model: currentModel || 'llama3.1:8b',
            sessionId: id || currentChatSessionId,
            provider: provider,
            // Include chatId so backend can load chat-specific tools
            chatId: currentChat?.id,
            // Don't send requestedTools - let backend use chat's stored selection
            toolChoice: 'auto', // Always enable tool usage
          },
        };
      },
    });
  }, [currentChatSessionId, getCurrentChat]);

  const { sendMessage, messages, setMessages, stop, status, regenerate } = useChat({
    id: currentChatSessionId || 'temp-id', // use the provided chat ID or a temp ID
    transport,
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // ================ Running on background logic ================ //
  const pendingPrompts = useChatStore((s) => s.pendingPrompts);
  const setPendingPrompts = useChatStore((s) => s.setPendingPrompts);
  const removePendingPrompt = useChatStore((s) => s.removePendingPrompt);

  const pendingPrompt = pendingPrompts.get(currentChatSessionId);

  // When streaming finishes and there is an assistant reply and the second to
  // last message is the same as the pending prompt, remove the pending prompt
  useEffect(() => {
    if (status === 'ready' && currentChatSessionId) {
      const secondToLastMessage = messages.at(-2);
      const lastMessage = messages.at(-1);

      const isSecondToLastMessageSameAsPendingPrompt =
        secondToLastMessage?.parts?.[0]?.type === 'text' && secondToLastMessage?.parts?.[0]?.text === pendingPrompt;
      const isLastMessageAssistant = lastMessage?.role === 'assistant';

      if (isLastMessageAssistant && isSecondToLastMessageSameAsPendingPrompt) removePendingPrompt(currentChatSessionId);
    }
  }, [status, currentChatSessionId, messages]);
  // ================================== //

  const isLoading = status === 'streaming';
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [fullMessagesBackup, setFullMessagesBackup] = useState<UIMessage[]>([]);

  // Track pre-generation loading state (between submission and streaming start)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStartTime, setSubmissionStartTime] = useState<number>(Date.now());

  // Use the message actions hook
  const { editingMessageId, editingContent, setEditingContent, startEdit, cancelEdit, saveEdit, deleteMessage } =
    useMessageActions({
      messages,
      setMessages,
      sendMessage,
      sessionId: currentChatSessionId,
    });

  // Handle regeneration for specific message index
  const handleRegenerateMessage = async (messageIndex: number) => {
    const messageToRegenerate = messages[messageIndex];

    if (!messageToRegenerate || messageToRegenerate.role !== 'assistant') {
      console.error('Can only regenerate assistant messages');
      return;
    }

    setRegeneratingIndex(messageIndex);

    // Store the full messages array for display purposes
    setFullMessagesBackup(messages);

    // Create a truncated conversation for the API call only
    const conversationUpToAssistant = messages.slice(0, messageIndex + 1);

    // Temporarily set messages to truncated version for API call
    setMessages(conversationUpToAssistant);

    // Use the built-in regenerate function which will regenerate the last assistant message
    regenerate();
  };

  // Track inference in StatusBar
  useEffect(() => {
    if (status === 'streaming' || isSubmitting) {
      setChatInference(currentChatSessionId, currentChatTitle, true);
    } else if (status === 'ready' || status === 'error') {
      // Only stop inference when this specific chat is done
      setChatInference(currentChatSessionId, currentChatTitle, false);
    }
  }, [status, isSubmitting, currentChatSessionId, currentChatTitle, setChatInference]);

  useEffect(() => {
    if (isLoading) {
      setIsSubmitting(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (status === 'ready' || status === 'error') {
      setIsSubmitting(false);
    }

    // Handle error case during regeneration - restore backup messages
    if (status === 'error' && regeneratingIndex !== null && fullMessagesBackup.length > 0) {
      setMessages(fullMessagesBackup);
      setFullMessagesBackup([]);
      setRegeneratingIndex(null);
    }
  }, [status, regeneratingIndex, fullMessagesBackup]);

  // Clear regenerating state and merge new message when streaming finishes
  useEffect(() => {
    if (status === 'ready' && regeneratingIndex !== null && fullMessagesBackup.length > 0) {
      // Get the new regenerated message (last message in the current truncated array)
      const newRegeneratedMessage = messages[messages.length - 1];

      if (newRegeneratedMessage && regeneratingIndex < fullMessagesBackup.length) {
        // Create new array with the regenerated message replaced
        const updatedMessages = [...fullMessagesBackup];
        updatedMessages[regeneratingIndex] = newRegeneratedMessage;

        // Set the complete updated messages array
        setMessages(updatedMessages);
      } else {
        // Fallback: restore backup if something went wrong
        setMessages(fullMessagesBackup);
      }

      setFullMessagesBackup([]);
      setRegeneratingIndex(null);
    } else if (status === 'ready' && regeneratingIndex !== null) {
      // No backup to restore, just clear the regenerating state
      setRegeneratingIndex(null);
    }
  }, [status, regeneratingIndex, fullMessagesBackup, messages]);

  // Load messages from database when chat changes
  useEffect(() => {
    if (currentChatMessages && currentChatMessages.length > 0) {
      // Messages are already UIMessage type
      setMessages(currentChatMessages);
    } else {
      // Clear messages when no chat or empty chat
      setMessages([]);
    }
  }, [currentChatSessionId, currentChatMessages]); // Now also depend on currentChatMessages

  // Simple debounce implementation
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSaveDraft = useCallback((chatId: number, content: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      // This could be used for future persistence to localStorage or server
      console.log('Debounced save draft:', { chatId, contentLength: content.length });
    }, 500);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (currentChat) {
      // Immediately update UI by saving to store without debounce
      saveDraftMessage(currentChat.id, newValue);
      // Also save with debounce for potential future persistence
      debouncedSaveDraft(currentChat.id, newValue);
    }
  };

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (isSubmittingDisabled) return;
    if (currentInput.trim() && currentChat) {
      setIsSubmitting(true);
      setSubmissionStartTime(Date.now());
      sendMessage({ text: currentInput });
      setPendingPrompts(currentChatSessionId, currentInput);
      clearDraftMessage(currentChat.id);
    }
  };

  const handlePromptSelect = (prompt: string) => {
    setIsSubmitting(true);
    setSubmissionStartTime(Date.now());
    // Directly send the prompt when a tile is clicked
    sendMessage({ text: prompt });
  };

  const isSubmittingDisabled = !currentInput.trim() || isLoading || isSubmitting || !!pendingPrompt;

  if (!currentChat) {
    // TODO: this is a temporary solution, maybe let's make some cool loading animations with a mascot?
    return null;
  }

  const isChatEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full gap-2 max-w-full overflow-hidden">
      {isChatEmpty && !pendingPrompt ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <EmptyChatState onPromptSelect={handlePromptSelect} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden max-w-full">
          <ChatHistory
            chatId={currentChat.id}
            pendingPrompt={pendingPrompt}
            sessionId={currentChatSessionId}
            messages={regeneratingIndex !== null && fullMessagesBackup.length > 0 ? fullMessagesBackup : messages}
            editingMessageId={editingMessageId}
            editingContent={editingContent}
            onEditStart={startEdit}
            onEditCancel={cancelEdit}
            onEditSave={saveEdit}
            onEditChange={setEditingContent}
            onDeleteMessage={deleteMessage}
            onRegenerateMessage={handleRegenerateMessage}
            isRegenerating={regeneratingIndex !== null || isLoading}
            regeneratingIndex={regeneratingIndex}
            isSubmitting={isSubmitting}
            submissionStartTime={submissionStartTime}
          />
        </div>
      )}

      <SystemPrompt />

      <div className="flex-shrink-0">
        <ChatInput
          input={currentInput}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={isSubmittingDisabled}
          stop={stop}
        />
      </div>
    </div>
  );
}

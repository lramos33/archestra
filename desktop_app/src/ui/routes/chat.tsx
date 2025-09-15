import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useRef } from 'react';

import ChatHistory from '@ui/components/Chat/ChatHistory';
import ChatInput from '@ui/components/Chat/ChatInput';
import EmptyChatState from '@ui/components/Chat/EmptyChatState';
import SystemPrompt from '@ui/components/Chat/SystemPrompt';
import { useChatAgent } from '@ui/contexts/chat-agent-context';
import { useChatStore, useToolsStore } from '@ui/stores';

export const Route = createFileRoute('/chat')({
  component: ChatPage,
});

function ChatPage() {
  const { getCurrentChat, getCurrentChatTitle, saveDraftMessage, getDraftMessage, clearDraftMessage } = useChatStore();
  const { setOnlyTools } = useToolsStore();
  const {
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
    startEdit,
    cancelEdit,
    saveEdit,
    deleteMessage,
    handleRegenerateMessage,
    regeneratingIndex,
    fullMessagesBackup,
    currentChatSessionId,
    currentChat,
    currentChatTitle,
    pendingPrompt,
    setPendingPrompts,
    hasTooManyTools,
    setHasTooManyTools,
    hasLoadedMemories,
    setHasLoadedMemories,
    loadMemoriesIfNeeded,
  } = useChatAgent();

  // Get current input from draft messages
  const currentInput = currentChat ? getDraftMessage(currentChat.id) : '';

  // Simple debounce implementation
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSaveDraft = useCallback((chatId: number, content: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // This could be used for future persistence to localStorage or server
      console.log('Debounced save draft:', { chatId, contentLength: content.length });
    }, 500);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (currentChat) {
      saveDraftMessage(currentChat.id, newValue);
      debouncedSaveDraft(currentChat.id, newValue);
    }
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (isSubmittingDisabled) return;
    if (currentInput.trim() && currentChat) {
      await loadMemoriesIfNeeded();
      let messageText = currentInput;
      if (hasTooManyTools) {
        await setOnlyTools(['archestra__list_available_tools', 'archestra__enable_tools', 'archestra__disable_tools']);
        messageText = `You currently have only list_available_tools and enable_tools enabled. Follow these steps:\n1. Call list_available_tools to see all available tool IDs\n2. Call enable_tools with the specific tool IDs you need, for example: {"toolIds": ["filesystem__read_file", "filesystem__write_file"]}\n3. After enabling the necessary tools, disable Archestra tools using disable_tools.\n4. After, proceed with this task: \n\n${currentInput}`;
      }
      setIsSubmitting(true);
      setSubmissionStartTime(Date.now());
      sendMessage({ text: messageText });
      setPendingPrompts(currentChatSessionId, messageText);
      clearDraftMessage(currentChat.id);
    }
  };

  const handlePromptSelect = async (prompt: string) => {
    await loadMemoriesIfNeeded();
    setIsSubmitting(true);
    setSubmissionStartTime(Date.now());
    sendMessage({ text: prompt });
  };

  const handleRerunAgent = async () => {
    const firstUserMessage = messages.find((msg) => msg.role === 'user');
    if (!firstUserMessage) return;
    // Extract text from message.parts for rerun logic
    let messageText = '';
    if ((firstUserMessage as any).parts) {
      const textPart = (firstUserMessage as any).parts.find((part: any) => part.type === 'text');
      if (textPart?.text) messageText = textPart.text;
    }
    if (!messageText) return;
    setMessages([]);
    setHasLoadedMemories(false);
    await loadMemoriesIfNeeded();
    setIsSubmitting(true);
    setSubmissionStartTime(Date.now());
    sendMessage({ text: messageText });
    if (currentChat) setPendingPrompts(currentChatSessionId, messageText);
  };

  const isSubmittingDisabled = !currentInput.trim() || isLoading || isSubmitting || !!pendingPrompt;

  // if (!currentChat) return null;
  const isChatEmpty = messages.length === 0;

  if (!currentChat) {
    return (
      <div className="flex flex-col h-full gap-2 max-w-full overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <EmptyChatState onPromptSelect={handlePromptSelect} />
        </div>
        <ChatInput
          input=""
          disabled={true}
          isLoading={false}
          handleInputChange={() => {}}
          handleSubmit={() => {}}
          stop={() => {}}
          hasMessages={false}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2 max-w-full overflow-hidden">
      {/* <p>{JSON.stringify(messages)}</p> */}

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
          onTooManyTools={setHasTooManyTools}
          hasMessages={messages.length > 0}
          onRerunAgent={handleRerunAgent}
        />
      </div>
    </div>
  );
}

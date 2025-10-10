import { getChatById } from '@shared/api-client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { Suspense } from 'react';
import { chatKeys } from '@/lib/chat.keys';
import { ChatView } from './chat-view';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = new QueryClient();

  // Prefetch chat data on server with actual data
  await queryClient.prefetchQuery({
    queryKey: chatKeys.detail(id),
    queryFn: async () => {
      const response = await getChatById({ path: { id } });
      if (response.error) {
        throw new Error('Failed to fetch chat');
      }
      return response.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ChatLoadingSkeleton />}>
        <ChatView chatId={id} />
      </Suspense>
    </HydrationBoundary>
  );
}

function ChatLoadingSkeleton() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </div>
  );
}

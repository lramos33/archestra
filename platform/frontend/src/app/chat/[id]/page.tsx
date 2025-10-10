import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { Suspense } from "react";
import { chatKeys } from "@/lib/chat.query";
import { ChatView } from "./chat-view";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = new QueryClient();

  // Prefetch chat data on server with mock data
  // Note: The actual data will be fetched on the client via useSuspenseQuery
  await queryClient.prefetchQuery({
    queryKey: chatKeys.detail(id),
    queryFn: async () => {
      // Return placeholder - actual data loaded via client-side query
      return null;
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

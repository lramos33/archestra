// Query keys for chat-related queries
// Separate file without "use client" so it can be imported in Server Components

export const chatKeys = {
  all: ["chats"] as const,
  lists: () => [...chatKeys.all, "list"] as const,
  list: () => [...chatKeys.lists()] as const,
  details: () => [...chatKeys.all, "detail"] as const,
  detail: (id: string) => [...chatKeys.details(), id] as const,
};

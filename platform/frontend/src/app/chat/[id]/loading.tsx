export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </div>
  );
}

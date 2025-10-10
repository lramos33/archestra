"use client";

import { DEMO_AGENT_ID } from "@shared";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateChat } from "@/lib/chat.query";

export function NewAgentButton() {
  const router = useRouter();
  const createChat = useCreateChat();

  const handleNewChat = async () => {
    try {
      const result = await createChat.mutateAsync({
        agentId: DEMO_AGENT_ID,
      });

      toast.success("New chat created");
      router.push(`/chat/${result.id}`);
    } catch (error) {
      toast.error("Failed to create chat");
      console.error("Failed to create chat:", error);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 w-6 p-0"
      onClick={handleNewChat}
      disabled={createChat.isPending}
      title="New chat"
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}

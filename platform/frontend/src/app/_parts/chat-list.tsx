"use client";

import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useChats, useDeleteChat, useUpdateChat } from "@/lib/chat.query";
import { getChatDisplayTitle, sortChatsByRecent } from "@/lib/chat.utils";

const VISIBLE_CHAT_COUNT = 5;

export function ChatList() {
  const { data: chatsData } = useChats();
  const deleteChat = useDeleteChat();
  const updateChat = useUpdateChat();
  const router = useRouter();
  const pathname = usePathname();
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const chats = sortChatsByRecent(chatsData || []);
  const visibleChats = showAll ? chats : chats.slice(0, VISIBLE_CHAT_COUNT);
  const hiddenCount = Math.max(0, chats.length - VISIBLE_CHAT_COUNT);

  const handleChatClick = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  const handleDelete = async (chatId: string) => {
    try {
      await deleteChat.mutateAsync(chatId);
      toast.success("Chat deleted");

      // If we're on this chat's page, navigate to home
      if (pathname === `/chat/${chatId}`) {
        router.push("/");
      }
    } catch (error) {
      toast.error("Failed to delete chat");
      console.error("Failed to delete chat:", error);
    }
  };

  const handleStartEdit = (chatId: string, currentTitle: string | null) => {
    setEditingId(chatId);
    setEditValue(currentTitle || "");
  };

  const handleSaveEdit = async (chatId: string) => {
    try {
      await updateChat.mutateAsync({
        id: chatId,
        data: { title: editValue.trim() || null },
      });
      setEditingId(null);
      toast.success("Chat title updated");
    } catch (error) {
      toast.error("Failed to update title");
      console.error("Failed to update title:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  if (chats.length === 0) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No chats yet
          </div>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    );
  }

  return (
    <SidebarMenuSub>
      {visibleChats.map((chat) => {
        const isActive = pathname === `/chat/${chat.id}`;
        const isEditing = editingId === chat.id;

        return (
          <SidebarMenuSubItem key={chat.id} className="group/chat-item">
            <div className="flex items-center w-full gap-1">
              <SidebarMenuSubButton
                onClick={() => handleChatClick(chat.id)}
                isActive={isActive}
                className="flex-1 cursor-pointer"
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleSaveEdit(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(chat.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    type="button"
                    className="truncate text-xs text-left w-full bg-transparent border-none p-0"
                    onDoubleClick={() =>
                      handleStartEdit(chat.id, chat.title || null)
                    }
                    title={getChatDisplayTitle(chat)}
                  >
                    {getChatDisplayTitle(chat)}
                  </button>
                )}
              </SidebarMenuSubButton>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover/chat-item:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete chat?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the chat and all its messages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(chat.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </SidebarMenuSubItem>
        );
      })}

      {hiddenCount > 0 && (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            onClick={() => setShowAll(!showAll)}
            className="cursor-pointer text-xs text-muted-foreground"
          >
            {showAll ? (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>Show {hiddenCount} more</span>
              </>
            )}
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      )}
    </SidebarMenuSub>
  );
}

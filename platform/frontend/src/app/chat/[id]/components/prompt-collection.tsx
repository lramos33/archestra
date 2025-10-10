"use client";

import { PromptCard } from "./prompt-card";

const STARTER_PROMPTS = [
  {
    id: "email-summary",
    title: "Email Summary",
    description: "Summarize my recent emails and highlight important ones",
    prompt:
      "Please check my email inbox and summarize the important messages from today.",
  },
  {
    id: "task-planning",
    title: "Task Planning",
    description: "Help me organize and prioritize my tasks",
    prompt: "Review my tasks and help me create a prioritized plan for today.",
  },
  {
    id: "research",
    title: "Research Assistant",
    description: "Help me research a topic",
    prompt:
      "I need help researching [topic]. Can you find relevant information and summarize the key points?",
  },
  {
    id: "code-review",
    title: "Code Review",
    description: "Review code and suggest improvements",
    prompt: "Can you review my recent code changes and suggest improvements?",
  },
];

interface PromptCollectionProps {
  onPromptSelect: (prompt: string) => void;
}

export function PromptCollection({ onPromptSelect }: PromptCollectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {STARTER_PROMPTS.map((template) => (
        <PromptCard
          key={template.id}
          template={template}
          onClick={onPromptSelect}
        />
      ))}
    </div>
  );
}

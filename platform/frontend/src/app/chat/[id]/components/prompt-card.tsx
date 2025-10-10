"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

interface PromptCardProps {
  template: PromptTemplate;
  onClick: (prompt: string) => void;
}

export function PromptCard({ template, onClick }: PromptCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={() => onClick(template.prompt)}
    >
      <CardHeader>
        <CardTitle className="text-lg">{template.title}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span>Try this prompt</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

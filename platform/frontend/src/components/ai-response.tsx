"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/utils";

export interface AIResponseProps {
  children: string;
  className?: string;
}

const components: Components = {
  // Lists
  ol: ({ children, className, ...props }) => (
    <ol className={cn("list-inside pl-0.5 list-decimal", className)} {...props}>
      {children}
    </ol>
  ),
  ul: ({ children, className, ...props }) => (
    <ul className={cn("list-inside pl-0.5 list-disc", className)} {...props}>
      {children}
    </ul>
  ),
  li: ({ children, className, ...props }) => (
    <li className={cn("py-1", className)} {...props}>
      {children}
    </li>
  ),

  // Typography
  strong: ({ children, className, ...props }) => (
    <span className={cn("font-semibold", className)} {...props}>
      {children}
    </span>
  ),
  a: ({ children, className, href, ...props }) => (
    <a
      className={cn("font-medium text-primary underline", className)}
      href={href}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // Headings
  h1: ({ children, className, ...props }) => (
    <h1
      className={cn("mt-6 mb-2 font-semibold text-3xl", className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, className, ...props }) => (
    <h2
      className={cn("mt-6 mb-2 font-semibold text-2xl", className)}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, className, ...props }) => (
    <h3 className={cn("mt-6 mb-2 font-semibold text-xl", className)} {...props}>
      {children}
    </h3>
  ),

  // Code blocks
  pre: ({ children }) => {
    // Extract code and language from children
    const codeElement = children as
      | {
          props?: { className?: string; children?: unknown };
          [key: string]: unknown;
        }
      | string
      | null
      | undefined;
    if (
      codeElement &&
      typeof codeElement === "object" &&
      "props" in codeElement &&
      codeElement.props?.className
    ) {
      const language = codeElement.props.className.replace("language-", "");
      const code = codeElement.props.children;
      return <CodeBlock language={language} code={String(code)} />;
    }
    // Fallback for code blocks without language
    return (
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-2">
        {children}
      </pre>
    );
  },
  code: ({ children, className }) => {
    // Inline code (no className means inline)
    if (!className) {
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    // Block code (has className, will be wrapped by pre)
    return <code className="font-mono text-sm">{children}</code>;
  },
};

export const AIResponse = memo(
  ({ children, className }: AIResponseProps) => (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

AIResponse.displayName = "AIResponse";

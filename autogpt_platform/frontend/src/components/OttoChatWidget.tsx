"use client";

import React, { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";

import type { GraphID } from "@/lib/autogpt-server-api/types";
import { askOtto } from "@/app/(platform)/build/actions";
import { cn } from "@/lib/utils";

interface Message {
  type: "user" | "assistant";
  content: string;
}

export default function OttoChatWidget({
  graphID,
  className,
}: {
  graphID?: GraphID;
  className?: string;
}): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [includeGraphData, setIncludeGraphData] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add welcome message when component mounts
    if (messages.length === 0) {
      setMessages([
        {
          type: "assistant",
          content: "Hello, I am Otto! Ask me anything about AutoGPT!",
        },
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsProcessing(true);

    // Add user message to chat
    setMessages((prev) => [...prev, { type: "user", content: userMessage }]);

    // Add temporary processing message
    setMessages((prev) => [
      ...prev,
      { type: "assistant", content: "Processing your question..." },
    ]);

    const conversationHistory = messages.reduce<
      { query: string; response: string }[]
    >((acc, msg, i, arr) => {
      if (
        msg.type === "user" &&
        i + 1 < arr.length &&
        arr[i + 1].type === "assistant" &&
        arr[i + 1].content !== "Processing your question..."
      ) {
        acc.push({
          query: msg.content,
          response: arr[i + 1].content,
        });
      }
      return acc;
    }, []);

    try {
      const data = await askOtto(
        userMessage,
        conversationHistory,
        includeGraphData,
        graphID,
      );

      // Check if the response contains an error
      if ("error" in data && data.error === true) {
        // Handle different error types
        let errorMessage =
          "Sorry, there was an error processing your message. Please try again.";

        if (data.answer === "Authentication required") {
          errorMessage = "Please sign in to use the chat feature.";
        } else if (data.answer === "Failed to connect to Otto service") {
          errorMessage =
            "Otto service is currently unavailable. Please try again later.";
        } else if (data.answer.includes("timed out")) {
          errorMessage = "Request timed out. Please try again later.";
        }

        // Remove processing message and add error message
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { type: "assistant", content: errorMessage },
        ]);
      } else {
        // Remove processing message and add actual response
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { type: "assistant", content: data.answer },
        ]);
      }
    } catch (error) {
      console.error("Unexpected error in chat widget:", error);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          type: "assistant",
          content:
            "An unexpected error occurred. Please refresh the page and try again.",
        },
      ]);
    } finally {
      setIsProcessing(false);
      setIncludeGraphData(false);
    }
  };

  // Don't render the chat widget if we're not on the build page or in local mode
  if (process.env.NEXT_PUBLIC_BEHAVE_AS !== "CLOUD") {
    return null;
  }

  if (!isOpen) {
    return (
      <div className={className}>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex h-14 w-14 items-center justify-center whitespace-nowrap rounded-2xl bg-[rgba(65,65,64,1)] text-neutral-50 shadow transition-colors hover:bg-neutral-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/90 dark:focus-visible:ring-neutral-300"
          aria-label="Open chat widget"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-[600px] w-[600px] flex-col rounded-lg border bg-background shadow-xl",
        className,
        "z-40",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="font-semibold">Otto Assistant</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close chat"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === "user"
                  ? "ml-4 bg-black text-white"
                  : "mr-4 bg-[#8b5cf6] text-white"
              }`}
            >
              {message.type === "user" ? (
                message.content
              ) : (
                <ReactMarkdown
                  className="prose prose-sm dark:prose-invert max-w-none"
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    code(props) {
                      const { children, className, node: _, ...rest } = props;
                      const match = /language-(\w+)/.exec(className || "");
                      return match ? (
                        <pre className="overflow-x-auto rounded-md bg-muted-foreground/20 p-3">
                          <code className="font-mono text-sm" {...rest}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code
                          className="rounded-md bg-muted-foreground/20 px-1 py-0.5 font-mono text-sm"
                          {...rest}
                        >
                          {children}
                        </code>
                      );
                    },
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc pl-4 last:mb-0">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal pl-4 last:mb-0">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="mb-1 last:mb-0">{children}</li>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={isProcessing}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
          {graphID && (
            <button
              type="button"
              onClick={() => {
                setIncludeGraphData((prev) => !prev);
              }}
              className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm transition-all duration-200 ${
                includeGraphData
                  ? "border-primary/30 bg-primary/10 text-primary hover:shadow-[0_0_10px_3px_rgba(139,92,246,0.3)]"
                  : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80 hover:shadow-[0_0_10px_3px_rgba(139,92,246,0.15)]"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {includeGraphData
                ? "Graph data will be included"
                : "Include graph data"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

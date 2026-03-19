"use client";

import "@copilotkit/react-core/v2/styles.css";
import "./style.css";

import MarkdownIt from "markdown-it";
import React, { useEffect, useRef, useState } from "react";
import { diffWords } from "diff";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useAgent,
  UseAgentUpdate,
  useHumanInTheLoop,
  useConfigureSuggestions,
  CopilotChat,
} from "@copilotkit/react-core/v2";
import { CopilotKit } from "@copilotkit/react-core";
import { z } from "zod";

const extensions = [StarterKit];

export default function CanvasPage() {
  // Defer CopilotChat to client-only to avoid Radix hydration ID mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* Animated background */}
      <div className="abstract-bg">
        <div className="blob-3" />
      </div>

      {/* App shell */}
      <div className="brand-shell" style={{ position: "relative", zIndex: 1, height: "100vh", overflow: "hidden" }}>
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          showDevConsole={false}
        >
          <div className="h-screen w-full flex gap-4 p-4" style={{ background: "var(--surface-light)" }}>
            {/* Left: Document Editor */}
            <div className="flex-1 overflow-hidden rounded-lg" style={{ background: "var(--surface-primary)", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)" }}>
              <DocumentEditor />
            </div>

            {/* Right: Chat Panel */}
            <div className="w-[400px] overflow-hidden rounded-lg" style={{ background: "var(--surface-primary)", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)" }}>
              {mounted && <CopilotChat agentId="document_agent" className="h-full flex flex-col" />}
            </div>
          </div>
        </CopilotKit>
      </div>
    </>
  );
}

interface AgentState {
  document: string;
}

const DocumentEditor = () => {
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "tiptap" },
    },
  });

  const [placeholderVisible, setPlaceholderVisible] = useState(false);
  const [currentDocument, setCurrentDocument] = useState("");
  const wasRunning = useRef(false);

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Write a pirate story",
        message: "Please write a story about a pirate named Candy Beard.",
      },
      {
        title: "Write a mermaid story",
        message: "Please write a story about a mermaid named Luna.",
      },
      {
        title: "Add character",
        message: "Please add a character named Courage.",
      },
      {
        title: "Create documentation",
        message: "Create technical documentation for a REST API.",
      },
    ],
    available: "always",
  });

  const { agent } = useAgent({
    agentId: "document_agent",
    updates: [UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged],
  });

  const agentState = agent.state as AgentState | undefined;
  const setAgentState = (s: AgentState) => agent.setState(s);
  const isLoading = agent.isRunning;

  // Handle loading state transitions
  useEffect(() => {
    if (isLoading) {
      setCurrentDocument(editor?.getText() || "");
    }
    editor?.setEditable(!isLoading);
  }, [isLoading, editor]);

  // Handle final state update when run completes
  useEffect(() => {
    if (wasRunning.current && !isLoading) {
      if (currentDocument.trim().length > 0 && currentDocument !== agentState?.document) {
        const newDocument = agentState?.document || "";
        const diff = diffPartialText(currentDocument, newDocument, true);
        const markdown = fromMarkdown(diff);
        editor?.commands.setContent(markdown);
      }
    }
    wasRunning.current = isLoading;
  }, [isLoading, currentDocument, agentState?.document, editor]);

  // Handle streaming updates while agent is running
  useEffect(() => {
    if (isLoading) {
      if (currentDocument.trim().length > 0) {
        const newDocument = agentState?.document || "";
        const diff = diffPartialText(currentDocument, newDocument);
        const markdown = fromMarkdown(diff);
        editor?.commands.setContent(markdown);
      } else {
        const markdown = fromMarkdown(agentState?.document || "");
        editor?.commands.setContent(markdown);
      }
    }
  }, [agentState?.document, isLoading, currentDocument, editor]);

  const text = editor?.getText() || "";

  // Sync user edits to agent state
  useEffect(() => {
    setPlaceholderVisible(text.length === 0);

    if (!isLoading && text !== currentDocument) {
      setCurrentDocument(text);
      setAgentState({
        document: text,
      });
    }
  }, [text, isLoading, currentDocument, setAgentState]);

  // Human-in-the-loop: confirm_changes (legacy)
  useHumanInTheLoop(
    {
      agentId: "document_agent",
      name: "confirm_changes",
      render: ({ args, respond, status }) => (
        <ConfirmChanges
          args={args}
          respond={respond}
          status={status}
          onReject={() => {
            editor?.commands.setContent(fromMarkdown(currentDocument));
            setAgentState({ document: currentDocument });
          }}
          onConfirm={() => {
            editor?.commands.setContent(fromMarkdown(agentState?.document || ""));
            setCurrentDocument(agentState?.document || "");
            setAgentState({ document: agentState?.document || "" });
          }}
        />
      ),
    },
    [agentState?.document],
  );

  // Human-in-the-loop: write_document (primary)
  useHumanInTheLoop(
    {
      agentId: "document_agent",
      name: "write_document",
      description: "Present the proposed changes to the user for review",
      parameters: z.object({
        document: z.string().describe("The full updated document in markdown format"),
      }),
      render({ args, status, respond }: { args: { document?: string }; status: string; respond?: (result: unknown) => Promise<void> }) {
        if (status === "executing") {
          return (
            <ConfirmChanges
              args={args}
              respond={respond}
              status={status}
              onReject={() => {
                editor?.commands.setContent(fromMarkdown(currentDocument));
                setAgentState({ document: currentDocument });
              }}
              onConfirm={() => {
                editor?.commands.setContent(fromMarkdown(agentState?.document || ""));
                setCurrentDocument(agentState?.document || "");
                setAgentState({ document: agentState?.document || "" });
              }}
            />
          );
        }
        return <></>;
      },
    },
    [agentState?.document],
  );

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      {placeholderVisible && (
        <div className="absolute top-6 left-10 pointer-events-none text-sm" style={{ color: "var(--text-tertiary)" }}>
          Write whatever you want here in Markdown format...
        </div>
      )}
      <div className="flex-1 overflow-hidden flex flex-col">
        <EditorContent editor={editor} className="h-full p-10 overflow-y-auto" />
      </div>
    </div>
  );
};

interface ConfirmChangesProps {
  args: any;
  respond: any;
  status: any;
  onReject: () => void;
  onConfirm: () => void;
}

function ConfirmChanges({ args, respond, status, onReject, onConfirm }: ConfirmChangesProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  return (
    <div className="p-4 rounded-lg m-4" style={{ background: "var(--surface-quaternary)" }}>
      <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Confirm Changes</h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Accept the proposed changes?</p>
      {accepted === null && (
        <div className="flex justify-end gap-3">
          <button
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              status === "executing"
                ? "cursor-pointer"
                : "cursor-default"
            }`}
            style={{
              background: status === "executing" ? "var(--surface-quaternary)" : "var(--surface-tertiary)",
              color: status === "executing" ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
            disabled={status !== "executing"}
            onClick={() => {
              if (respond) {
                setAccepted(false);
                onReject();
                respond({ accepted: false });
              }
            }}
          >
            Reject
          </button>
          <button
            className={`px-4 py-2 rounded text-sm font-medium text-white transition-colors ${
              status === "executing"
                ? "cursor-pointer"
                : "cursor-default"
            }`}
            style={{
              background: status === "executing" ? "var(--color-lilac-dark)" : "var(--text-tertiary)",
            }}
            disabled={status !== "executing"}
            onClick={() => {
              if (respond) {
                setAccepted(true);
                onConfirm();
                respond({ accepted: true });
              }
            }}
          >
            Confirm
          </button>
        </div>
      )}
      {accepted !== null && (
        <div className="flex justify-end">
          <div className="text-sm font-medium px-3 py-1 rounded" style={{ background: "var(--surface-quaternary)", color: "var(--text-secondary)" }}>
            {accepted ? "✓ Accepted" : "✗ Rejected"}
          </div>
        </div>
      )}
    </div>
  );
}

function fromMarkdown(text: string) {
  const md = new MarkdownIt({
    typographer: true,
    html: true,
  });

  return md.render(text);
}

function diffPartialText(oldText: string, newText: string, isComplete: boolean = false) {
  let oldTextToCompare = oldText;
  if (oldText.length > newText.length && !isComplete) {
    oldTextToCompare = oldText.slice(0, newText.length);
  }

  const changes = diffWords(oldTextToCompare, newText);

  let result = "";
  changes.forEach((part) => {
    if (part.added) {
      result += `<em>${part.value}</em>`;
    } else if (part.removed) {
      result += `<s>${part.value}</s>`;
    } else {
      result += part.value;
    }
  });

  if (oldText.length > newText.length && !isComplete) {
    result += oldText.slice(newText.length);
  }

  return result;
}

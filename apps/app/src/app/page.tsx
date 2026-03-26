"use client";

import { useEffect, useState } from "react";
import { ExampleLayout } from "@/components/example-layout";
import { useGenerativeUIExamples, useExampleSuggestions } from "@/hooks";
import { ExplainerCardsPortal } from "@/components/explainer-cards";
import { DemoGallery, type DemoItem } from "@/components/demo-gallery";
import { GridIcon } from "@/components/demo-gallery/grid-icon";
import { CopilotChat, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

export default function HomePage() {
  useGenerativeUIExamples();
  useExampleSuggestions();

  const [demoDrawerOpen, setDemoDrawerOpen] = useState(false);
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();

  const handleTryDemo = (demo: DemoItem) => {
    setDemoDrawerOpen(false);
    agent.addMessage({ id: crypto.randomUUID(), content: demo.prompt, role: "user" });
    copilotkit.runAgent({ agent });
  };

  // Widget bridge: handle messages from widget iframes
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "open-link" && typeof e.data.url === "string") {
        window.open(e.data.url, "_blank", "noopener,noreferrer");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);


  return (
    <>
      {/* Mobile block */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 sm:hidden" style={{ background: "var(--color-background, #f5f5f7)" }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl"
            style={{ background: "linear-gradient(135deg, rgba(190,194,255,0.15), rgba(133,224,206,0.12))" }}
          >
            <span className="text-3xl">🪁</span>
          </div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary, #1a1a1a)" }}>
            Desktop Only
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #666)" }}>
            Open Generative UI is not available on mobile yet. Please visit on a desktop browser for the full experience.
          </p>
          <a
            href="https://github.com/CopilotKit/OpenGenerativeUI"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold text-white no-underline"
            style={{
              background: "linear-gradient(135deg, var(--color-lilac-dark, #6366f1), var(--color-mint-dark, #10b981))",
              boxShadow: "0 1px 4px rgba(149,153,204,0.3)",
            }}
          >
            View on GitHub
          </a>
        </div>
      </div>

      {/* Animated background */}
      <div className="abstract-bg">
        <div className="blob-3" />
      </div>

      {/* App shell */}
      <div className="brand-shell" style={{ position: "relative", zIndex: 1 }}>
        <div className="brand-glass-container">
          {/* CTA Banner */}
          <div
            className="shrink-0 border-b border-white/30 dark:border-white/8"
            style={{
              background: "linear-gradient(135deg, rgba(190,194,255,0.08) 0%, rgba(133,224,206,0.06) 100%)",
            }}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="flex items-center justify-center shrink-0 w-9 h-9 rounded-lg"
                  style={{
                    background: "linear-gradient(135deg, rgba(190,194,255,0.15), rgba(133,224,206,0.12))",
                  }}
                >
                  <span className="text-xl leading-none" role="img" aria-label="CopilotKit">🪁</span>
                </div>
                <p className="text-base font-semibold m-0 leading-snug" style={{ color: "var(--text-primary)" }}>
                  Open Generative UI
                  <span className="font-normal" style={{ color: "var(--text-secondary)" }}> — powered by CopilotKit</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDemoDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium no-underline whitespace-nowrap transition-all duration-150 hover:-translate-y-px cursor-pointer"
                  style={{
                    color: "var(--text-secondary)",
                    border: "1px solid var(--color-border-glass, rgba(0,0,0,0.1))",
                    background: "var(--surface-primary, rgba(255,255,255,0.6))",
                    fontFamily: "var(--font-family)",
                  }}
                  title="Open Demo Gallery"
                >
                  <GridIcon size={15} />
                  Demos
                </button>
                <a
                  href="https://github.com/CopilotKit/OpenGenerativeUI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-5 py-2 rounded-full text-sm font-semibold text-white no-underline whitespace-nowrap transition-all duration-150 hover:-translate-y-px"
                  style={{
                    background: "linear-gradient(135deg, var(--color-lilac-dark), var(--color-mint-dark))",
                    boxShadow: "0 1px 4px rgba(149,153,204,0.3)",
                    fontFamily: "var(--font-family)",
                  }}
                >
                  Get started
                </a>
              </div>
            </div>
          </div>

          <ExampleLayout chatContent={
            <CopilotChat
              labels={{
                welcomeMessageText: "What do you want to visualize today?",
                chatDisclaimerText: "Visualizations are AI-generated. You can retry the same prompt or ask the AI to refine the result.",
              }}
            />
          } />
          <ExplainerCardsPortal />
        </div>
      </div>

      <DemoGallery
        open={demoDrawerOpen}
        onClose={() => setDemoDrawerOpen(false)}
        onTryDemo={handleTryDemo}
      />
    </>
  );
}

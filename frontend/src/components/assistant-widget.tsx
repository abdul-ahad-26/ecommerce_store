"use client";

/**
 * Floating AI shopping assistant.
 *
 * Streams from the FastAPI `/assistant/chat/stream` endpoint via the Vercel AI
 * SDK (`useChat` + `DefaultChatTransport`). Text renders token-by-token; the
 * backend's `data-cart-action` parts render as an "Add to cart" button that the
 * customer confirms — the model never writes to the cart itself.
 *
 * Shown on the storefront only (mounted from SiteChrome, which excludes /admin).
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";

import { API_BASE_URL, getAccessToken } from "@/lib/api";
import {
  cartActionToItem,
  listModels,
  type AssistantModel,
  type CartActionData,
} from "@/lib/assistant";
import { formatPKR } from "@/lib/format";
import { useCart } from "@/store/cart";

// Type the custom data part so `part.data` is a typed CartActionData.
type AssistantUIMessage = UIMessage<unknown, { "cart-action": CartActionData }>;

const SUGGESTIONS = [
  "Show me lawn under Rs 5,000",
  "What's your COD policy?",
  "Help me find an unstitched 3-piece",
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const addItem = useCart((s) => s.addItem);
  const [added, setAdded] = useState<Set<number>>(new Set());

  // Dev model picker (only shown when the backend allows overrides).
  const [models, setModels] = useState<AssistantModel[]>([]);
  const [overrideAllowed, setOverrideAllowed] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const modelRef = useRef<string | null>(null);

  // Stable transport for the chat session. `headers`/`prepareSend…` are read
  // per-request, so they pick up the live auth token and selected model.
  const [transport] = useState(
    () =>
      new DefaultChatTransport<AssistantUIMessage>({
        api: `${API_BASE_URL}/assistant/chat/stream`,
        credentials: "include",
        headers: (): Record<string, string> => {
          const token = getAccessToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Reshape the AI SDK UI messages into our backend's {role, content}.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: messages
              .map((m) => ({
                role: m.role,
                content: m.parts
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join(""),
              }))
              .filter(
                (m) =>
                  (m.role === "user" || m.role === "assistant") &&
                  m.content.length > 0,
              ),
            ...(modelRef.current ? { model: modelRef.current } : {}),
          },
        }),
      }),
  );

  const { messages, sendMessage, status, error } = useChat<AssistantUIMessage>({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listModels()
      .then((r) => {
        setModels(r.models);
        setOverrideAllowed(r.override_allowed);
        setSelectedModel(r.default);
        modelRef.current = r.default;
      })
      .catch(() => {
        /* assistant config endpoint unavailable — picker just stays hidden */
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  }

  function handleAdd(a: CartActionData) {
    addItem(cartActionToItem(a), a.qty);
    setAdded((prev) => new Set(prev).add(a.variant_id));
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open shopping assistant"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-madder text-cream shadow-lg transition hover:bg-madder-deep focus:outline-none focus:ring-2 focus:ring-gold"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[34rem] max-h-[calc(100vh-8rem)] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ink/15 bg-cream shadow-2xl">
          {/* Header */}
          <header className="flex items-center justify-between gap-2 border-b border-ink/10 bg-paper-deep px-4 py-3">
            <div>
              <p className="font-display text-base leading-tight text-ink">
                Meher Assistant
              </p>
              <p className="text-xs text-ink-soft">Here to help you shop</p>
            </div>
            {overrideAllowed && models.length > 0 && (
              <select
                aria-label="Model"
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  modelRef.current = e.target.value;
                }}
                className="max-w-[8rem] rounded border border-ink/20 bg-cream px-1 py-1 text-xs text-ink-soft"
              >
                {models.map((m) => (
                  <option key={m.key} value={m.key} disabled={!m.available}>
                    {m.label}
                    {m.available ? "" : " (no key)"}
                  </option>
                ))}
              </select>
            )}
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                  Hi! Ask me about our collection, sizes, stock, shipping, or COD
                  — I can help you find pieces and add them to your cart.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-ink/15 bg-paper px-3 py-1 text-xs text-ink-soft transition hover:border-madder hover:text-madder"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-madder px-3 py-2 text-sm text-cream"
                      : "max-w-[90%] space-y-2 text-sm text-ink"
                  }
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type === "data-cart-action") {
                      const a = part.data;
                      const isAdded = added.has(a.variant_id);
                      return (
                        <div
                          key={i}
                          className="rounded-lg border border-ink/15 bg-paper p-3"
                        >
                          <p className="text-sm font-medium text-ink">{a.label}</p>
                          <p className="text-xs text-ink-soft">
                            {formatPKR(a.unit_price)} · Qty {a.qty}
                          </p>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAdd(a)}
                            className="mt-2 w-full rounded-md bg-madder px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-madder-deep disabled:bg-sage"
                          >
                            {isAdded ? "Added to cart ✓" : "Add to cart"}
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {status === "submitted" && (
              <p className="text-xs text-ink-soft">Thinking…</p>
            )}
            {error && (
              <p className="text-xs text-madder">
                Something went wrong. Please try again.
              </p>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-ink/10 bg-paper-deep px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, sizes, COD…"
              className="flex-1 rounded-full border border-ink/20 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-madder focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-madder text-cream transition hover:bg-madder-deep disabled:bg-sage"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h16v11H8l-4 4V5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l16-8-6 16-3-6-7-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

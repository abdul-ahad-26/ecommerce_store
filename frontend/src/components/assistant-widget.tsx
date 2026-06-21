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
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { API_BASE_URL, getAccessToken } from "@/lib/api";
import {
  cartActionToItem,
  listModels,
  productCardToItem,
  type AssistantModel,
  type CartActionData,
  type ProductCardData,
} from "@/lib/assistant";
import { formatPKR } from "@/lib/format";
import { useCart } from "@/store/cart";

// Type the custom data parts so `part.data` is typed.
type AssistantUIMessage = UIMessage<
  unknown,
  { "cart-action": CartActionData; product: ProductCardData }
>;

const CID_KEY = "meher-assistant-cid";
const MSGS_KEY = "meher-assistant-msgs";

const SUGGESTIONS = [
  "Show me lawn under Rs 5,000",
  "What's your COD policy?",
  "Help me find an unstitched 3-piece",
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const addItem = useCart((s) => s.addItem);
  // Derive "added" from the (persisted) cart so the buttons stay truthful across
  // refreshes and reflect removals — no separate state to keep in sync.
  const cartItems = useCart((s) => s.items);
  const inCart = (variantId: number | null | undefined) =>
    variantId != null && cartItems.some((i) => i.variantId === variantId);

  // Dev model picker (only shown when the backend allows overrides).
  const [models, setModels] = useState<AssistantModel[]>([]);
  const [overrideAllowed, setOverrideAllowed] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const modelRef = useRef<string | null>(null);

  // Read at send-time by the transport (refs stay stable across renders).
  const pageRef = useRef<{ path?: string; product_slug?: string }>({});
  const conversationIdRef = useRef<string>("");
  const pathname = usePathname();

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
            page: pageRef.current,
            conversation_id: conversationIdRef.current || undefined,
            ...(modelRef.current ? { model: modelRef.current } : {}),
          },
        }),
      }),
  );

  const { messages, sendMessage, status, error, setMessages } =
    useChat<AssistantUIMessage>({ transport });

  const busy = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show the typing indicator whenever we're waiting and the assistant hasn't
  // started producing visible text yet (covers the gap during tool calls too).
  const last = messages[messages.length - 1];
  const assistantHasText =
    last?.role === "assistant" &&
    last.parts.some((p) => p.type === "text" && p.text.length > 0);
  const showTyping = busy && !assistantHasText;

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

  // Track what the customer is viewing so the agent can resolve "this".
  useEffect(() => {
    const match = pathname?.match(/^\/product\/(.+)$/);
    pageRef.current = {
      path: pathname ?? undefined,
      product_slug: match ? match[1] : undefined,
    };
  }, [pathname]);

  // Restore the conversation (id + messages) once; persist on every change so a
  // refresh keeps context. The id also groups the runs in OpenAI tracing.
  useEffect(() => {
    try {
      let cid = sessionStorage.getItem(CID_KEY);
      if (!cid) {
        cid = crypto.randomUUID();
        sessionStorage.setItem(CID_KEY, cid);
      }
      conversationIdRef.current = cid;
      const saved = sessionStorage.getItem(MSGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      /* sessionStorage unavailable — run without persistence */
    }
  }, [setMessages]);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(MSGS_KEY, JSON.stringify(messages));
    } catch {
      /* ignore quota/serialization errors */
    }
  }, [messages]);

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
  }

  function handleAddProduct(p: ProductCardData) {
    const item = productCardToItem(p);
    if (!item || p.variant_id == null) return;
    addItem(item, 1);
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
                    if (part.type === "data-product") {
                      const p = part.data;
                      return (
                        <AssistantProductCard
                          key={i}
                          product={p}
                          added={inCart(p.variant_id)}
                          onAdd={() => handleAddProduct(p)}
                          onView={() => setOpen(false)}
                        />
                      );
                    }
                    if (part.type === "data-cart-action") {
                      const a = part.data;
                      const isAdded = inCart(a.variant_id);
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

            {showTyping && <TypingDots />}
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

function AssistantProductCard({
  product,
  added,
  onAdd,
  onView,
}: {
  product: ProductCardData;
  added: boolean;
  onAdd: () => void;
  onView: () => void;
}) {
  const href = `/product/${product.slug}`;
  return (
    <div className="flex gap-3 rounded-lg border border-ink/15 bg-paper p-2">
      <Link
        href={href}
        onClick={onView}
        className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden bg-paper-deep"
      >
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="56px"
            className="object-cover"
          />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={href}
          onClick={onView}
          className="truncate text-sm font-medium text-ink hover:text-madder"
        >
          {product.name}
        </Link>
        <p className="text-xs text-ink-soft">{formatPKR(product.price)}</p>
        <div className="mt-auto flex gap-2 pt-1.5">
          <Link
            href={href}
            onClick={onView}
            className="rounded-md border border-ink/20 px-2.5 py-1 text-xs text-ink transition hover:border-madder hover:text-madder"
          >
            View
          </Link>
          {product.in_stock && product.variant_id != null && (
            <button
              type="button"
              disabled={added}
              onClick={onAdd}
              className="rounded-md bg-madder px-2.5 py-1 text-xs font-medium text-cream transition hover:bg-madder-deep disabled:bg-sage"
            >
              {added ? "Added ✓" : "Add"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1" aria-label="Assistant is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-ink-soft/50"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
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

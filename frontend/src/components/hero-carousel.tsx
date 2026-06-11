"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  image: string;
  name: string;
  slug: string;
}

const INTERVAL = 5000;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const paused = useRef(false);
  const count = slides.length;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    // Honour reduced-motion: no auto-advance.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    const id = setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % count);
    }, INTERVAL);
    return () => clearInterval(id);
  }, [count]);

  return (
    <div
      className="reveal relative aspect-[4/5] overflow-hidden bg-paper-deep"
      style={{ animationDelay: "240ms" }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {slides.map((slide, i) => (
        <Link
          key={slide.slug}
          href={`/product/${slide.slug}`}
          aria-hidden={i !== index}
          tabIndex={i === index ? 0 : -1}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          <Image
            src={slide.image}
            alt={slide.name}
            fill
            priority={i === 0}
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-cover"
          />
        </Link>
      ))}

      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/10" />
      <span className="absolute bottom-4 left-4 bg-paper/85 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink backdrop-blur">
        New In
      </span>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous"
            className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center bg-paper/80 text-ink backdrop-blur transition-colors hover:bg-paper"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next"
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center bg-paper/80 text-ink backdrop-blur transition-colors hover:bg-paper"
          >
            ›
          </button>
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-ink" : "w-1.5 bg-ink/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

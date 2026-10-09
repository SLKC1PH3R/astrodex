"use client";
/* Composants animés portés de Magic UI (MIT), recolorés avec les tokens Nocturne. Styles : app/astrodex.css (.mu-*). */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* Magic UI · Shimmer Button */
export function ShimmerButton({ href, icon = "ph-package", children }) {
  return (
    <Link className="mu-shimmer" href={href}>
      <span className="mu-shimmer-spark"><span><span /></span></span>
      <i className={`ph-fill ${icon}`} />{children}
      <span className="mu-shimmer-highlight" />
      <span className="mu-shimmer-bg" />
    </Link>
  );
}

/* Magic UI · Border Beam */
export function BorderBeam({ size = 160, duration = 9, delay = 0, from = "var(--color-accent-200)", to = "var(--color-accent)" }) {
  return (
    <div className="mu-beam" aria-hidden="true">
      <div style={{ width: size, background: `linear-gradient(to left, ${from}, ${to}, transparent)`, offsetPath: `rect(0 auto auto 0 round ${size}px)`, animationDuration: `${duration}s`, animationDelay: `${-delay}s` }} />
    </div>
  );
}

/* Magic UI · Number Ticker (démarre quand le nombre entre à l'écran) */
export function NumberTicker({ value, duration = 1600 }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(value); return; }
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = t => {
        const k = Math.min(1, (t - t0) / duration);
        setN(Math.round(value * (1 - Math.pow(1 - k, 4))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);
  return <span ref={ref}>{n}</span>;
}

/* Magic UI · Marquee (piste doublée, défilement continu) */
export function Marquee({ children, speed = 26 }) {
  const track = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let off = 0, last = performance.now(), raf;
    const tick = t => {
      const dt = Math.min(64, t - last) / 1000; last = t;
      const el = track.current;
      if (el && el.scrollWidth) { off = (off + speed * dt) % (el.scrollWidth / 2); el.style.transform = `translateX(${-off}px)`; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return (
    <div className="mu-marquee">
      <div className="mu-marquee-track" ref={track}>{children}{children}</div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';

/* ============================================================
   EDIT THIS BLOCK: everything on the site comes from here.
   ============================================================ */
// Your video lives at public/hero.mp4 (every frame is a keyframe so scrubbing stays smooth).
const VIDEO_URL = `${import.meta.env.BASE_URL}hero.mp4`;

const PROFILE = {
  name: 'Vani',
  intro: 'Hi, I am Vani',
  email: 'you@example.com',
  about: [
    'I’m a simple person who stays consistent and disciplined about my goals. I try to get one percent better every day, and I’m especially keen on coding and picking up new skills. Outside of that, I love a good burger and a good movie.',
    'Currently a BTech Undergrad doing CSE with specialization in Artificial Intelligence and Machine Learning.',
  ],
  projects: [
    {
      title: 'This portfolio',
      year: '2026',
      type: 'Web',
      desc: 'A video hero you scrub with your mouse, built with React, Vite and Tailwind.',
      href: 'https://github.com/vangogh-git/my-portfolio',
    },
    {
      title: 'Project name',
      year: '2026',
      type: 'Web',
      desc: 'One line on what it is and what you did. Replace this and the link.',
      href: '#',
    },
    {
      title: 'Project name',
      year: '2025',
      type: 'Video',
      desc: 'One line on the brief, the tools you used and the result.',
      href: '#',
    },
  ],
  skills: [
    { group: 'Build', items: ['HTML and CSS', 'JavaScript', 'React', 'Tailwind', 'Git and GitHub'] },
    { group: 'Create', items: ['Video editing', 'Motion and pacing', 'Colour grading'] },
    { group: 'Think', items: ['Data structures', 'Algorithms', 'Problem solving'] },
  ],
  links: [{ label: 'GitHub', href: 'https://github.com/vangogh-git' }],
};

const NAV = [
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
];

const SENSITIVITY = 0.8;

function useTypewriter(text: string, typeMs = 95, eraseMs = 45, holdMs = 3200, gapMs = 800) {
  const [n, setN] = useState(0);
  const [erasing, setErasing] = useState(false);
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (reduced) return setN(text.length);
    let t: number;
    if (!erasing) {
      t =
        n < text.length
          ? window.setTimeout(() => setN(n + 1), n === 0 ? 500 : typeMs)
          : window.setTimeout(() => setErasing(true), holdMs);
    } else {
      t =
        n > 0
          ? window.setTimeout(() => setN(n - 1), eraseMs)
          : window.setTimeout(() => setErasing(false), gapMs);
    }
    return () => window.clearTimeout(t);
  }, [n, erasing, text, reduced, typeMs, eraseMs, holdMs, gapMs]);
  return { shown: text.slice(0, n) };
}

const pill =
  'inline-flex items-center rounded-full border border-ink/20 px-4 sm:px-5 py-[0.3em] text-[14px] sm:text-[15px] transition-colors duration-200 cursor-pointer whitespace-nowrap';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="px-5 sm:px-8 md:px-10 py-20 md:py-28 border-t border-ink/15">
      <h2 className="font-heading text-[clamp(32px,5vw,56px)] leading-none tracking-tight mb-10 md:mb-14">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prev = useRef<{ x: number; y: number } | null>(null);
  const target = useRef(0);
  const seeking = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const { shown } = useTypewriter(PROFILE.intro);

  const cur = useRef(0); // eased position that is actually shown
  const seekStart = useRef(0);
  const dotRef = useRef<HTMLDivElement>(null);

  const onSeeked = () => {
    seeking.current = false;
  };

  useEffect(() => {
    let raf = 0;
    let hot = false;
    let scale = 1;
    const mouse = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };

    // Mouse or touch movement only moves the *goal*; the tick below eases toward it
    const move = (x: number, y: number, touch: boolean) => {
      mouse.x = x;
      mouse.y = y;
      const v = videoRef.current;
      const inHero = window.scrollY < window.innerHeight * 0.6;
      if (!v || !inHero || !Number.isFinite(v.duration)) {
        prev.current = null;
        return;
      }
      if (prev.current) {
        const dx = x - prev.current.x;
        const dy = y - prev.current.y;
        if (!touch || Math.abs(dx) > Math.abs(dy)) {
          target.current = Math.max(
            0,
            Math.min(v.duration, target.current + (dx / window.innerWidth) * SENSITIVITY * v.duration)
          );
        }
      }
      prev.current = { x, y };
    };

    const tick = () => {
      const v = videoRef.current;
      if (v && Number.isFinite(v.duration)) {
        cur.current += (target.current - cur.current) * 0.1;
        const now = performance.now();
        if (seeking.current && now - seekStart.current > 400) seeking.current = false;
        if (!seeking.current && Math.abs(v.currentTime - cur.current) > 0.004) {
          seeking.current = true;
          seekStart.current = now;
          v.currentTime = cur.current;
        }
      }
      const d = dotRef.current;
      if (d) {
        pos.x += (mouse.x - pos.x) * 0.3;
        pos.y += (mouse.y - pos.y) * 0.3;
        scale += ((hot ? 3 : 1) - scale) * 0.2;
        d.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMouse = (e: MouseEvent) => move(e.clientX, e.clientY, false);
    const onTouch = (e: TouchEvent) => e.touches[0] && move(e.touches[0].clientX, e.touches[0].clientY, true);
    const onOver = (e: MouseEvent) => {
      hot = !!(e.target as Element).closest?.('a,button');
    };
    const reset = () => (prev.current = null);
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);

    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', reset, { passive: true });
    window.addEventListener('mouseleave', reset);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', reset);
      window.removeEventListener('mouseleave', reset);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(PROFILE.email);
    } catch {
      /* clipboard blocked: still show feedback so the button isn't silent */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="font-body text-ink bg-paper">
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      {/* Background video: fixed behind the hero, covered by the sections below */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        playsInline
        loop
        preload="auto"
        onLoadedMetadata={() => {
          if (videoRef.current) videoRef.current.currentTime = 0.001;
        }}
        onSeeked={onSeeked}
        className="fixed inset-0 z-0 w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: '70% center' }}
      />

      <header
        className={`fixed top-0 inset-x-0 z-10 px-5 sm:px-8 md:px-10 py-4 sm:py-5 flex items-center justify-between transition-colors duration-300 ${
          scrolled ? 'bg-paper/85 backdrop-blur-md' : ''
        }`}
      >
        <a href="#top" className="font-heading text-[21px] sm:text-[26px] tracking-tight leading-none">
          {PROFILE.name}
        </a>
        <nav aria-label="Main" className="flex items-center gap-5 sm:gap-8 text-[17px] sm:text-[21px]">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} className="hidden md:inline hover:text-blush transition-colors">
              {l.label}
            </a>
          ))}
          <a href="#contact" className="underline underline-offset-4 hover:text-blush transition-colors">
            Get in touch
          </a>
        </nav>
      </header>

      <main id="top" className="relative z-[1]">
        {/* Hero */}
        <div className="min-h-screen flex flex-col justify-end md:justify-center pb-14 md:pb-0 px-5 sm:px-8 md:px-10">
          <div className="max-w-xl">
            <p
              className="mb-6"
              style={{ fontSize: 'clamp(36px, 7vw, 64px)', lineHeight: 1.1, minHeight: '1.2em' }}
              aria-label={PROFILE.intro}
            >
              <span aria-hidden="true">{shown}</span>
              {(
                <span
                  className="inline-block w-[2px] h-[1.05em] bg-ink align-middle ml-[2px] animate-cursor-blink"
                  aria-hidden="true"
                />
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="#work" className={`${pill} bg-white hover:bg-ink hover:text-paper`}>
                View my work
              </a>
              <a href="#about" className={`${pill} bg-white hover:bg-ink hover:text-paper`}>
                About me
              </a>
              <button type="button" onClick={copyEmail} className={`${pill} hover:bg-ink hover:text-paper`}>
                {copied ? 'Copied to clipboard' : PROFILE.email}
              </button>
            </div>
          </div>
        </div>

        {/* Everything below covers the video */}
        <div className="relative z-[2] bg-paper">
          <Section id="work" title="Selected work">
            <ul>
              {PROFILE.projects.map((p, i) => (
                <li key={i} className="border-t border-ink/15 last:border-b">
                  <a
                    href={p.href}
                    target={p.href.startsWith('http') ? '_blank' : undefined}
                    rel="noreferrer"
                    className="grid gap-1 md:grid-cols-[1.2fr_2fr_auto] md:gap-8 items-baseline px-3 -mx-3 py-6 hover:bg-ink hover:text-paper transition-colors duration-200"
                  >
                    <span className="font-heading text-[26px] md:text-[32px] leading-tight">{p.title}</span>
                    <span className="max-w-prose">{p.desc}</span>
                    <span className="text-wool group-hover:text-paper md:text-right">
                      {p.type}, {p.year}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="about" title="About">
            <div className="max-w-prose space-y-5 text-[18px] md:text-[20px] leading-relaxed">
              {PROFILE.about.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </Section>

          <Section id="skills" title="Skills">
            <div className="grid gap-10 md:grid-cols-3">
              {PROFILE.skills.map((s) => (
                <div key={s.group}>
                  <h3 className="font-heading text-[22px] mb-3">{s.group}</h3>
                  <ul className="space-y-1 text-[18px] text-wool">
                    {s.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="contact" title="Let’s work together">
            <a
              href={`mailto:${PROFILE.email}`}
              className="font-heading text-[clamp(26px,6vw,64px)] leading-tight underline underline-offset-8 decoration-blush decoration-2 hover:text-blush transition-colors break-all"
            >
              {PROFILE.email}
            </a>
            <div className="mt-8 flex flex-wrap gap-2">
              <button type="button" onClick={copyEmail} className={`${pill} hover:bg-ink hover:text-paper`}>
                {copied ? 'Copied' : 'Copy email'}
              </button>
              {PROFILE.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${pill} hover:bg-ink hover:text-paper`}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </Section>

          <footer className="px-5 sm:px-8 md:px-10 py-8 border-t border-ink/15 text-wool text-[15px]">
            © {new Date().getFullYear()} {PROFILE.name}
          </footer>
        </div>
      </main>
    </div>
  );
}

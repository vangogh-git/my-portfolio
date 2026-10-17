/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Video source URL (replace this URL with your video link)
export const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260530_042513_df96a13b-6155-4f6e-8b93-c9dee66fba08.mp4';

/**
 * Custom hook to type out text character by character.
 * @param text The full string to be typed out.
 * @param speed Typing delay per character in ms (default 38ms).
 * @param startDelay Initial delay before typing starts in ms (default 600ms).
 */
export function useTypewriter(
  text: string,
  speed: number = 38,
  startDelay: number = 600
) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let index = 0;
    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));
        if (index >= text.length) {
          if (intervalId) window.clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// IndexedDB helper for storing user-uploaded background video
const DB_NAME = 'MainframeMediaDB';
const STORE_NAME = 'videos';
const KEY = 'active_background_video';

async function saveVideoBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function loadVideoBlob(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve(null);
        return;
      }
      const tx = db.transaction(STORE_NAME, 'readonly');
      const getReq = tx.objectStore(STORE_NAME).get(KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

async function clearVideoBlob(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(KEY);
        tx.oncomplete = () => resolve();
      } else {
        resolve();
      }
    };
    req.onerror = () => resolve();
  });
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const SENSITIVITY = 0.8;

  // Active video source state (defaults to VIDEO_URL, updates on file drop or URL paste)
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>(VIDEO_URL);
  const [isCustomVideo, setIsCustomVideo] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Mobile menu open state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Pill buttons visibility (fade-in + slide-up 400ms after page load)
  const [buttonsVisible, setButtonsVisible] = useState(false);

  // Clipboard copy state for visual feedback
  const [copied, setCopied] = useState(false);

  // Modal states for working interactions (no dead clicks)
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [pitchForm, setPitchForm] = useState({ name: '', email: '', idea: '' });
  const [pitchSubmitted, setPitchSubmitted] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  // Cursor black dot state
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100, visible: false });

  // Magnetic snap state for nav links and action pill buttons
  const [magneticState, setMagneticState] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const getMagneticHandlers = useCallback(() => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setMagneticState({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        active: true,
      });
    },
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // Tactile magnetic attraction: slight elastic pull toward pointer
      const pullX = centerX + (e.clientX - centerX) * 0.18;
      const pullY = centerY + (e.clientY - centerY) * 0.18;
      setMagneticState({
        x: pullX,
        y: pullY,
        active: true,
      });
    },
    onMouseLeave: () => {
      setMagneticState((prev) => ({ ...prev, active: false }));
    },
  }), []);

  // Load saved video from IndexedDB on startup
  useEffect(() => {
    loadVideoBlob().then((blob) => {
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        setCurrentVideoSrc(objectUrl);
        setIsCustomVideo(true);
      }
    });
  }, []);

  // Handle uploaded video file
  const handleApplyFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please upload a video file (.mp4, .webm, etc.)');
      return;
    }
    await saveVideoBlob(file);
    const objectUrl = URL.createObjectURL(file);
    setCurrentVideoSrc(objectUrl);
    setIsCustomVideo(true);
    setActiveModal(null);
  }, []);

  // Handle reset to default video
  const handleResetVideo = async () => {
    await clearVideoBlob();
    setCurrentVideoSrc(VIDEO_URL);
    setIsCustomVideo(false);
  };

  // Drag and drop video file onto window
  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDraggingOver(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingOver(false);

      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/')) {
          await handleApplyFile(file);
        }
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleApplyFile]);

  // Typewriter hook
  const { displayed, done } = useTypewriter(
    'Glad you stopped in. Good taste tends to find us. Now, what are we building?',
    38,
    600
  );

  // 400ms button entrance timer
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setButtonsVisible(true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const queuedTimeRef = useRef<number | null>(null);
  const seekingTimeoutRef = useRef<number | null>(null);

  // Reload video element whenever currentVideoSrc changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setVideoLoaded(false);
    setVideoError(null);
    isSeekingRef.current = false;
    queuedTimeRef.current = null;
    targetTimeRef.current = 0;

    video.load();
  }, [currentVideoSrc]);

  // Handle video loaded metadata
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      setVideoDuration(video.duration);
      setVideoLoaded(true);
      targetTimeRef.current = 0;
      // Nudge currentTime so browser immediately decodes and paints the first frame
      try {
        video.currentTime = 0.001;
      } catch (err) {
        console.warn('Could not set initial currentTime', err);
      }
    }
  };

  const handleVideoCanPlay = () => {
    setVideoLoaded(true);
    setVideoError(null);
  };

  const handleVideoError = () => {
    setVideoError('Video could not be loaded or format is unsupported.');
    setVideoLoaded(false);
  };

  // Perform seek with queueing to prevent seek-flooding
  const applySeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

    const clamped = Math.max(0, Math.min(video.duration, time));
    targetTimeRef.current = clamped;

    if (isSeekingRef.current) {
      // Seek is already in flight, queue this target time
      queuedTimeRef.current = clamped;
    } else {
      isSeekingRef.current = true;
      try {
        video.currentTime = clamped;
      } catch {
        isSeekingRef.current = false;
      }

      // Safety timeout: if onSeeked never fires within 100ms, unlock
      if (seekingTimeoutRef.current) clearTimeout(seekingTimeoutRef.current);
      seekingTimeoutRef.current = window.setTimeout(() => {
        isSeekingRef.current = false;
        if (queuedTimeRef.current !== null) {
          const next = queuedTimeRef.current;
          queuedTimeRef.current = null;
          applySeek(next);
        }
      }, 100);
    }
  }, []);

  const handleSeeked = useCallback(() => {
    if (seekingTimeoutRef.current) clearTimeout(seekingTimeoutRef.current);
    isSeekingRef.current = false;

    if (queuedTimeRef.current !== null) {
      const nextTime = queuedTimeRef.current;
      queuedTimeRef.current = null;
      applySeek(nextTime);
    }
  }, [applySeek]);

  // Toggle play/pause
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Play prevented', e);
      });
    } else {
      video.pause();
      setIsPlaying(false);
      targetTimeRef.current = video.currentTime;
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Update black dot cursor position
      setCursorPos({
        x: e.clientX,
        y: e.clientY,
        visible: true,
      });

      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

      const currentX = e.clientX;
      if (prevXRef.current === null) {
        prevXRef.current = currentX;
        return;
      }

      const delta = currentX - prevXRef.current;
      prevXRef.current = currentX;

      if (Math.abs(delta) < 0.5) return;

      // If playing, pause on mouse scrub so user has tactile manual control
      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      }

      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      const newTarget = targetTimeRef.current + timeOffset;

      applySeek(newTarget);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        prevXRef.current = e.touches[0].clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

      const currentX = e.touches[0].clientX;
      if (prevXRef.current === null) {
        prevXRef.current = currentX;
        return;
      }

      const delta = currentX - prevXRef.current;
      prevXRef.current = currentX;

      if (Math.abs(delta) < 0.5) return;

      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      }

      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      const newTarget = targetTimeRef.current + timeOffset;

      applySeek(newTarget);
    };

    const handleTouchEnd = () => {
      prevXRef.current = null;
    };

    const handleMouseLeave = () => {
      prevXRef.current = null;
      setCursorPos((prev) => ({ ...prev, visible: false }));
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [applySeek]);

  // Copy email handler
  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('hello@mainframe.co').then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenAction = (actionKey: string) => {
    setIsMenuOpen(false);
    setActiveModal(actionKey);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none font-body text-black bg-black">
      {/* Interactive Black Dot Cursor with Magnetic Snap */}
      {cursorPos.visible && (
        <div
          className={`fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black shadow-md ${
            magneticState.active
              ? 'w-5 h-5 ring-2 ring-white/60'
              : 'w-2.5 h-2.5'
          }`}
          style={{
            left: `${magneticState.active ? magneticState.x : cursorPos.x}px`,
            top: `${magneticState.active ? magneticState.y : cursorPos.y}px`,
            transitionProperty: magneticState.active
              ? 'left, top, width, height, transform, box-shadow'
              : 'width, height, opacity',
            transitionDuration: magneticState.active ? '190ms' : '0ms',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Hidden file picker input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleApplyFile(e.target.files[0]);
          }
        }}
      />

      {/* Drag & drop visual overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none transition-all">
          <div className="border-2 border-dashed border-white/60 rounded-3xl p-10 max-w-md text-center text-white">
            <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h4 className="text-xl font-medium tracking-tight mb-1 font-heading">
              Drop Video to Set Background
            </h4>
            <p className="text-sm text-neutral-300">
              Release to load your video with full mouse-scrubbing interaction
            </p>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        BACKGROUND VIDEO (mouse-scrub controlled)
        ========================================================================
      */}
      <video
        ref={videoRef}
        key={currentVideoSrc}
        src={currentVideoSrc}
        muted
        playsInline
        preload="auto"
        loop
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleVideoCanPlay}
        onError={handleVideoError}
        onSeeked={handleSeeked}
        className="fixed inset-0 z-0 w-full h-full object-cover pointer-events-none"
        style={{
          objectPosition: '70% center',
        }}
      />

      {/* 
        ========================================================================
        NAVBAR (fixed, z-index: 10)
        ========================================================================
      */}
      <header className="fixed top-0 left-0 right-0 z-10 w-full px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center">
        {/* Logo (left) */}
        <div className="flex flex-row items-center gap-3">
          <span
            className="text-[21px] sm:text-[26px] tracking-tight text-black font-heading font-medium leading-none"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Mainframe®
          </span>
          <span
            className="text-[25px] sm:text-[30px] text-black select-none leading-none"
            style={{ letterSpacing: '-0.02em' }}
            aria-hidden="true"
          >
            ✳︎
          </span>
        </div>

        {/* Desktop nav links (center, hidden below md) */}
        <nav
          aria-label="Desktop navigation"
          className="hidden md:flex flex-row items-center text-[23px] text-black tracking-normal"
        >
          <a
            href="#labs"
            {...getMagneticHandlers()}
            onClick={(e) => {
              e.preventDefault();
              handleOpenAction('Labs');
            }}
            className="hover:opacity-60 transition-opacity cursor-pointer px-1 py-0.5"
          >
            Labs
          </a>
          <span aria-hidden="true">,&nbsp;</span>
          <a
            href="#studio"
            {...getMagneticHandlers()}
            onClick={(e) => {
              e.preventDefault();
              handleOpenAction('Studio');
            }}
            className="hover:opacity-60 transition-opacity cursor-pointer px-1 py-0.5"
          >
            Studio
          </a>
          <span aria-hidden="true">,&nbsp;</span>
          <a
            href="#openings"
            {...getMagneticHandlers()}
            onClick={(e) => {
              e.preventDefault();
              handleOpenAction('Openings');
            }}
            className="hover:opacity-60 transition-opacity cursor-pointer px-1 py-0.5"
          >
            Openings
          </a>
          <span aria-hidden="true">,&nbsp;</span>
          <a
            href="#shop"
            {...getMagneticHandlers()}
            onClick={(e) => {
              e.preventDefault();
              handleOpenAction('Shop');
            }}
            className="hover:opacity-60 transition-opacity cursor-pointer px-1 py-0.5"
          >
            Shop
          </a>
        </nav>

        {/* Desktop CTA (right, hidden below md) */}
        <div className="hidden md:block">
          <a
            href="#contact"
            {...getMagneticHandlers()}
            onClick={(e) => {
              e.preventDefault();
              handleOpenAction('Get in touch');
            }}
            className="text-[23px] text-black underline underline-offset-2 hover:opacity-60 transition-opacity cursor-pointer px-1 py-0.5"
          >
            Get in touch
          </a>
        </div>

        {/* Mobile hamburger (visible below md) */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          className="md:hidden flex flex-col justify-center items-center gap-[5px] p-2 focus:outline-none cursor-pointer"
        >
          <span
            className={`w-6 h-[2px] bg-black transition-all duration-300 origin-center ${
              isMenuOpen ? 'rotate-45 translate-y-[7px]' : ''
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-black transition-all duration-300 ${
              isMenuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-black transition-all duration-300 origin-center ${
              isMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''
            }`}
          />
        </button>
      </header>

      {/* 
        ========================================================================
        MOBILE OVERLAY (z-index: 9)
        ========================================================================
      */}
      <div
        className={`fixed inset-0 z-[9] bg-white/95 backdrop-blur-sm flex flex-col justify-center px-8 gap-8 transition-opacity duration-300 md:hidden ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMenuOpen}
      >
        <button
          type="button"
          onClick={() => handleOpenAction('Labs')}
          className="text-left text-[32px] font-medium text-black hover:opacity-60 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
        >
          Labs
        </button>
        <button
          type="button"
          onClick={() => handleOpenAction('Studio')}
          className="text-left text-[32px] font-medium text-black hover:opacity-60 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
        >
          Studio
        </button>
        <button
          type="button"
          onClick={() => handleOpenAction('Openings')}
          className="text-left text-[32px] font-medium text-black hover:opacity-60 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
        >
          Openings
        </button>
        <button
          type="button"
          onClick={() => handleOpenAction('Shop')}
          className="text-left text-[32px] font-medium text-black hover:opacity-60 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
        >
          Shop
        </button>
        <button
          type="button"
          onClick={() => handleOpenAction('Get in touch')}
          className="text-left text-[32px] font-medium text-black underline underline-offset-2 hover:opacity-60 transition-opacity bg-transparent border-0 p-0 cursor-pointer mt-4"
        >
          Get in touch
        </button>
      </div>

      {/* 
        ========================================================================
        HERO SECTION (z-index: 1)
        ========================================================================
      */}
      <main className="relative z-[1] w-full h-screen flex flex-col justify-end pb-12 md:justify-center md:pb-0 px-5 sm:px-8 md:px-10 overflow-hidden pointer-events-none">
        <div className="max-w-xl relative z-10 pointer-events-auto">
          {/* 1. Blurred intro label */}
          <div
            className="pointer-events-none select-none mb-5 sm:mb-6"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.3,
              fontWeight: 400,
              color: '#000',
              filter: 'blur(4px)',
            }}
          >
            Hey there, meet A.R.I.A,
            <br />
            Mainframe's Adaptive Response Interface Agent
          </div>

          {/* 2. Typewriter text */}
          <p
            className="text-black mb-5 sm:mb-6"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.35,
              fontWeight: 400,
              minHeight: '54px',
            }}
          >
            {displayed}
            {!done && (
              <span
                className="inline-block w-[2px] h-[1.1em] bg-black align-middle ml-[2px] animate-cursor-blink"
                aria-hidden="true"
              />
            )}
          </p>

          {/* 3. Action pill buttons */}
          <div
            className="flex flex-wrap gap-y-1 transition-all duration-400 ease-out"
            style={{
              opacity: buttonsVisible ? 1 : 0,
              transform: buttonsVisible ? 'translateY(0)' : 'translateY(8px)',
              transitionProperty: 'opacity, transform',
            }}
          >
            {/* White pill 1: Pitch us an idea */}
            <button
              type="button"
              {...getMagneticHandlers()}
              onClick={() => handleOpenAction('Pitch us an idea')}
              className="inline-flex items-center justify-center bg-white text-black border border-black/10 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap hover:bg-black hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Pitch us an idea
            </button>

            {/* White pill 2: Come work here */}
            <button
              type="button"
              {...getMagneticHandlers()}
              onClick={() => handleOpenAction('Come work here')}
              className="inline-flex items-center justify-center bg-white text-black border border-black/10 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap hover:bg-black hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Come work here
            </button>

            {/* White pill 3: Send a brief hello */}
            <button
              type="button"
              {...getMagneticHandlers()}
              onClick={() => handleOpenAction('Send a brief hello')}
              className="inline-flex items-center justify-center bg-white text-black border border-black/10 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap hover:bg-black hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Send a brief hello
            </button>

            {/* White pill 4: See how we operate */}
            <button
              type="button"
              {...getMagneticHandlers()}
              onClick={() => handleOpenAction('See how we operate')}
              className="inline-flex items-center justify-center bg-white text-black border border-black/10 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap hover:bg-black hover:text-white transition-colors duration-200 cursor-pointer"
            >
              See how we operate
            </button>

            {/* Outline pill: Reach us: hello@mainframe.co with copy icon */}
            <button
              type="button"
              {...getMagneticHandlers()}
              onClick={handleCopyEmail}
              title="Click to copy email address"
              className="inline-flex items-center justify-center text-white bg-transparent border border-white rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap gap-2 sm:gap-3 hover:bg-white hover:text-black transition-colors duration-200 cursor-pointer group"
            >
              <span>
                Reach us:{' '}
                <span className="underline underline-offset-1">
                  {copied ? 'copied to clipboard!' : 'hello@mainframe.co'}
                </span>
              </span>

              {/* 12x12 copy icon (inline SVG of two overlapping rectangles) */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 stroke-current"
                strokeWidth="1.2"
                aria-hidden="true"
              >
                {/* Back rectangle */}
                <rect x="3.5" y="1.5" width="6.5" height="7.5" rx="1" />
                {/* Front rectangle */}
                <rect x="1.5" y="3.5" width="6.5" height="7.5" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* 
        ========================================================================
        INTERACTIVE MODAL OVERLAYS (ensures no dead clicks)
        ========================================================================
      */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            setActiveModal(null);
            setPitchSubmitted(false);
          }}
        >
          <div
            className="bg-white text-black rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                setPitchSubmitted(false);
              }}
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-black transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 1L13 13M1 13L13 1" />
              </svg>
            </button>

            {/* Modal Content */}
            {activeModal === 'Pitch us an idea' && (
              <div>
                <h3 className="text-2xl font-heading font-medium tracking-tight mb-2">
                  Pitch Us an Idea
                </h3>
                <p className="text-sm text-neutral-600 mb-6">
                  We partner with audacious founders and brands building category-defining digital products.
                </p>

                {pitchSubmitted ? (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium mb-1">Transmission Received</h4>
                    <p className="text-sm text-neutral-600">
                      Our partners will review your brief and follow up within 24 hours.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        setPitchSubmitted(false);
                        setPitchForm({ name: '', email: '', idea: '' });
                      }}
                      className="mt-6 px-5 py-2 bg-black text-white rounded-full text-xs font-medium cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setPitchSubmitted(true);
                    }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-neutral-600 mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={pitchForm.name}
                        onChange={(e) => setPitchForm({ ...pitchForm, name: e.target.value })}
                        placeholder="e.g. Elena Rostova"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-neutral-600 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={pitchForm.email}
                        onChange={(e) => setPitchForm({ ...pitchForm, email: e.target.value })}
                        placeholder="elena@company.com"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-neutral-600 mb-1">
                        The Idea / Brief
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={pitchForm.idea}
                        onChange={(e) => setPitchForm({ ...pitchForm, idea: e.target.value })}
                        placeholder="Tell us what you want to bring into the world..."
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="mt-2 w-full py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Send Pitch to A.R.I.A
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeModal === 'Come work here' && (
              <div>
                <h3 className="text-2xl font-heading font-medium tracking-tight mb-2">
                  Careers at Mainframe
                </h3>
                <p className="text-sm text-neutral-600 mb-5">
                  We assemble small, hyper-talented teams of designers, engineers, and creative technologists.
                </p>
                <div className="flex flex-col divide-y divide-neutral-200 mb-6">
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">Creative Technologist / WebGL</div>
                      <div className="text-xs text-neutral-500">Remote / NYC · Full-time</div>
                    </div>
                    <span className="text-xs bg-neutral-100 px-2 py-1 rounded">Open</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">Art Director & Brand Architect</div>
                      <div className="text-xs text-neutral-500">London / Remote · Full-time</div>
                    </div>
                    <span className="text-xs bg-neutral-100 px-2 py-1 rounded">Open</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">Lead Systems Engineer</div>
                      <div className="text-xs text-neutral-500">San Francisco / Remote · Full-time</div>
                    </div>
                    <span className="text-xs bg-neutral-100 px-2 py-1 rounded">Open</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('careers@mainframe.co');
                    setActiveModal(null);
                  }}
                  className="w-full py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Send Portfolio to careers@mainframe.co
                </button>
              </div>
            )}

            {activeModal === 'See how we operate' && (
              <div>
                <h3 className="text-2xl font-heading font-medium tracking-tight mb-2">
                  How We Operate
                </h3>
                <p className="text-sm text-neutral-600 mb-5">
                  Our operating principles combine relentless human craft with generative technology.
                </p>
                <div className="space-y-4 text-sm mb-6">
                  <div className="border border-neutral-100 p-3 rounded-lg bg-neutral-50">
                    <span className="font-medium block text-neutral-900">01. Direct Prototypes Over Decks</span>
                    <span className="text-xs text-neutral-600">We build interactive software on day one rather than presenting static slides.</span>
                  </div>
                  <div className="border border-neutral-100 p-3 rounded-lg bg-neutral-50">
                    <span className="font-medium block text-neutral-900">02. Adaptive Intelligence</span>
                    <span className="text-xs text-neutral-600">Interfaces that respond organically to physical user input, velocity, and spatial intent.</span>
                  </div>
                  <div className="border border-neutral-100 p-3 rounded-lg bg-neutral-50">
                    <span className="font-medium block text-neutral-900">03. High Craft & Zero Compromise</span>
                    <span className="text-xs text-neutral-600">Bespoke typographic systems, 60fps gesture physics, and timeless visual identity.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-2 bg-black text-white rounded-full text-sm font-medium cursor-pointer"
                >
                  Understood
                </button>
              </div>
            )}

            {(activeModal === 'Send a brief hello' || activeModal === 'Get in touch') && (
              <div>
                <h3 className="text-2xl font-heading font-medium tracking-tight mb-2">
                  Get in Touch
                </h3>
                <p className="text-sm text-neutral-600 mb-6">
                  Drop us a note about projects, collaborations, or press inquiries.
                </p>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-6">
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Direct Inquiries</div>
                  <div className="text-base font-medium flex items-center justify-between">
                    <span>hello@mainframe.co</span>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="text-xs bg-black text-white px-2.5 py-1 rounded-full cursor-pointer hover:bg-neutral-800"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = 'mailto:hello@mainframe.co';
                  }}
                  className="w-full py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Open Email Client
                </button>
              </div>
            )}

            {(activeModal === 'Labs' || activeModal === 'Studio' || activeModal === 'Openings' || activeModal === 'Shop') && (
              <div>
                <h3 className="text-2xl font-heading font-medium tracking-tight mb-2">
                  Mainframe {activeModal}
                </h3>
                <p className="text-sm text-neutral-600 mb-6">
                  {activeModal === 'Labs' && 'Our experimental skunkworks division pioneering interactive WebGL shaders, agentic UI, and spatial media.'}
                  {activeModal === 'Studio' && 'End-to-end brand identity, digital architecture, and bespoke software design for visionary enterprises.'}
                  {activeModal === 'Openings' && 'We are currently accepting selective project briefs and applications for senior creative technologist roles.'}
                  {activeModal === 'Shop' && 'Limited-edition physical artifacts, typography specimen monographs, and internal hardware kits.'}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                    }}
                    className="flex-1 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Explore {activeModal}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-5 py-2.5 border border-neutral-300 rounded-full text-sm font-medium hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {activeModal === 'video-settings' && (
              <div>
                <h3 className="text-2xl font-heading font-medium tracking-tight mb-2">
                  Replace Background Video
                </h3>
                <p className="text-sm text-neutral-600 mb-5">
                  Select your video file (such as your Grok animation), or drop it anywhere on the page to instantly test mouse scrubbing.
                </p>

                {/* Option 1: File Upload / Browse */}
                <div className="mb-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-neutral-600 mb-2">
                    Option 1: Upload Video File
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-neutral-300 hover:border-black rounded-xl p-6 text-center transition-colors cursor-pointer group bg-neutral-50 hover:bg-neutral-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium text-black">
                      Choose Video File from Computer
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Supports MP4, WebM, MOV · Saved locally in your browser
                    </div>
                  </button>
                </div>

                {/* Option 2: Enter URL */}
                <div className="mb-6">
                  <div className="text-xs font-medium uppercase tracking-wider text-neutral-600 mb-2">
                    Option 2: Video URL Link
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (customUrlInput.trim()) {
                        setCurrentVideoSrc(customUrlInput.trim());
                        setIsCustomVideo(true);
                        setActiveModal(null);
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="url"
                      placeholder="https://example.com/my-video.mp4"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                    />
                    <button
                      type="submit"
                      disabled={!customUrlInput.trim()}
                      className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-neutral-200 flex justify-between items-center">
                  {isCustomVideo ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleResetVideo();
                        setActiveModal(null);
                      }}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      Restore Original Video
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      Default agency video active
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-1.5 border border-neutral-300 rounded-full text-xs font-medium hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discreet Bottom-Right Video Swap & Play Controls */}
      <div className="fixed bottom-4 right-5 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          {...getMagneticHandlers()}
          onClick={togglePlayPause}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg"
          title={isPlaying ? 'Pause video playback' : 'Play video continuously'}
        >
          {isPlaying ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span>Pause</span>
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Play</span>
            </>
          )}
        </button>

        <button
          type="button"
          {...getMagneticHandlers()}
          onClick={() => setActiveModal('video-settings')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg"
          title="Click to replace background video or select file"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>{isCustomVideo ? 'Custom Video' : 'Change Video'}</span>
        </button>
        {isCustomVideo && (
          <button
            type="button"
            {...getMagneticHandlers()}
            onClick={handleResetVideo}
            className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
            title="Reset to default video"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

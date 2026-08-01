"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser dictation, with the failure modes handled.
 *
 * The Web Speech API is not a local feature. In Chrome it ships your audio to a
 * remote speech service, so it can fail for reasons that have nothing to do
 * with the microphone; on iOS it is unreliable in general and worse inside a
 * home-screen app. Two rules follow from that, and they drive this whole file:
 *
 *   1. Stopping never waits for the browser. Every previous version of this
 *      asked the recognition object to stop and let its `end` event flip the
 *      UI back. When recognition never really started, that event never comes,
 *      and the stop button sits there doing nothing. Stopping is now local and
 *      immediate; the browser is merely informed.
 *
 *   2. The button reports what actually happened, not what we asked for.
 *      `start()` returning means nothing — it is `onstart` that means the
 *      microphone is live. Until then the state is "starting", and if that
 *      never arrives a watchdog says so in plain words instead of leaving a
 *      "Stop dictation" button that was never listening.
 */

export type DictationState = "unsupported" | "off" | "starting" | "on";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

const KEYBOARD_HINT = "Your keyboard's own microphone key is more reliable here.";

const ERRORS: Record<string, string> = {
  "not-allowed":
    "The microphone is blocked for this site. Allow it in your browser's site settings, or use your keyboard's microphone key.",
  "service-not-allowed": `The browser refused to run speech recognition. ${KEYBOARD_HINT}`,
  "audio-capture": "No microphone available.",
  network: `Dictation sends audio to the browser's speech service, and it didn't answer. ${KEYBOARD_HINT}`,
  "language-not-supported": "This browser can't dictate in English here.",
};

/**
 * What an `error` event means for us. `aborted` is our own doing, and
 * `no-speech` is Chrome timing out a quiet stretch — a pause while you
 * remember is not a failure, so neither one stops anything.
 */
export function readSpeechError(kind: string): { fatal: boolean; message: string } {
  if (kind === "aborted" || kind === "no-speech") return { fatal: false, message: "" };
  return {
    fatal: true,
    message: ERRORS[kind] ?? `Dictation stopped: ${kind || "unknown error"}. ${KEYBOARD_HINT}`,
  };
}

/** What to do when a session ends: give up, reconnect, or let it lie. */
export function decideOnEnd(x: {
  wanted: boolean;
  everStarted: boolean;
  silentRestarts: number;
}): "idle" | "reconnect" | "giveup" {
  if (!x.wanted) return "idle";
  // A session that never came up won't come up on a retry either.
  if (!x.everStarted) return "giveup";
  return x.silentRestarts + 1 > MAX_SILENT_RESTARTS ? "giveup" : "reconnect";
}

// How long to wait for the microphone to actually come up before admitting it
// isn't going to, and how many silent reconnects to tolerate before giving up.
// Chrome ends a session after roughly five seconds of quiet, and recalling a
// dream is mostly quiet — the budget has to cover thinking, not just talking,
// so it's set nearer a minute of true silence than a few seconds.
const START_TIMEOUT_MS = 5000;
const MAX_SILENT_RESTARTS = 8;

export function useDictation(onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>("unsupported");
  const [interim, setInterim] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [keyboardMic, setKeyboardMic] = useState(false);

  const recRef = useRef<Recognition>(null);
  const wantOnRef = useRef(false); // the user's intent, which survives reconnects
  const liveRef = useRef(false); // has onstart fired for the current session
  const silentRestartsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest callback without making start/stop depend on it.
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Support is decided after mount. Reading `window` during render makes the
  // server and client disagree about whether the button exists at all, and a
  // hydration mismatch can cost the button its click handler.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    if (w.SpeechRecognition || w.webkitSpeechRecognition) setState("off");
    const nav = navigator;
    setKeyboardMic(
      /iP(hone|ad|od)/.test(nav.userAgent) ||
        (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
    );
  }, []);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  /**
   * Tear down locally first, then tell the browser. Detaching the handlers
   * before aborting means a late `end` or `error` from the session we just
   * abandoned can't reach back in and change state under a newer one.
   */
  const teardown = useCallback(() => {
    clearTimer();
    const rec = recRef.current;
    recRef.current = null;
    liveRef.current = false;
    if (!rec) return;
    try {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
    } catch {
      /* nothing to detach */
    }
    try {
      rec.abort?.();
    } catch {
      /* already dead */
    }
    try {
      rec.stop?.();
    } catch {
      /* already dead */
    }
  }, []);

  const stop = useCallback(
    (message?: string) => {
      wantOnRef.current = false;
      teardown();
      setInterim("");
      setState((s) => (s === "unsupported" ? s : "off"));
      if (message !== undefined) setNote(message || null);
    },
    [teardown]
  );

  const spawn = useCallback(() => {
    const w = window as unknown as Record<string, unknown>;
    const Rec = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => Recognition)
      | undefined;
    if (!Rec) return;

    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true; // so you can see it working before it commits
    rec.lang = "en-US";

    rec.onstart = () => {
      liveRef.current = true;
      clearTimer();
      setState("on");
    };

    rec.onresult = (e: Recognition) => {
      let settled = "";
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) settled += r[0].transcript;
        else pending += r[0].transcript;
      }
      if (settled.trim()) {
        silentRestartsRef.current = 0; // it's working; the budget resets
        onTextRef.current(settled.trim());
      }
      setInterim(pending.trim());
    };

    rec.onerror = (e: Recognition) => {
      const { fatal, message } = readSpeechError(String(e?.error ?? ""));
      if (fatal) stop(message);
    };

    rec.onend = () => {
      const move = decideOnEnd({
        wanted: wantOnRef.current,
        everStarted: liveRef.current,
        silentRestarts: silentRestartsRef.current,
      });
      if (move === "idle") return;
      if (move === "giveup") {
        stop(`Dictation kept dropping out. ${KEYBOARD_HINT}`);
        return;
      }
      // Chrome ends a session on its own after a pause; pick straight back up.
      silentRestartsRef.current += 1;
      liveRef.current = false;
      spawn();
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // Thrown when a previous session is still shutting down.
      stop(`Dictation wouldn't start. ${KEYBOARD_HINT}`);
    }
  }, [stop]);

  const start = useCallback(() => {
    if (state === "unsupported") return;
    setNote(null);
    setInterim("");
    wantOnRef.current = true;
    liveRef.current = false;
    silentRestartsRef.current = 0;
    setState("starting");
    teardown();
    spawn();
    // If the microphone never comes up, say so. This is the case that used to
    // strand the button: no start, no end, no error, nothing.
    timerRef.current = setTimeout(() => {
      if (!liveRef.current) {
        stop(`Dictation didn't start — the microphone may be blocked. ${KEYBOARD_HINT}`);
      }
    }, START_TIMEOUT_MS);
  }, [spawn, state, stop, teardown]);

  const toggle = useCallback(() => {
    if (state === "off") start();
    else stop();
  }, [state, start, stop]);

  // Leaving the page must not leave the microphone open.
  useEffect(() => {
    return () => {
      wantOnRef.current = false;
      teardown();
    };
  }, [teardown]);

  return {
    /** "unsupported" | "off" | "starting" | "on" */
    state,
    /** Words heard but not yet committed — display only. */
    interim,
    /** A plain sentence about why it stopped, or null. */
    note,
    /** True on iOS, where the keyboard's microphone key is the better path. */
    keyboardMic,
    toggle,
    stop,
  };
}

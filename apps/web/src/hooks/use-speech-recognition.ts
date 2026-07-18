'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult?: (payload: SpeechRecognitionResultPayload) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface SpeechRecognitionController {
  /** False when the browser has no speech-recognition engine. */
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Thin, SSR-safe wrapper over the Web Speech API's SpeechRecognition. Runs in
 * continuous + interim mode so wake words and silence can be tracked live, and
 * transparently restarts when the engine ends on its own (Chrome cycles the
 * recognizer) until the caller explicitly stops. The caller owns the
 * silence/auto-stop policy.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): SpeechRecognitionController {
  const supported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const ensureRecognition = useCallback((): SpeechRecognition | null => {
    if (!supported) return null;
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = optionsRef.current.lang ?? 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const alternative = result[0];
        if (!alternative) continue;
        if (result.isFinal) final += alternative.transcript;
        else interim += alternative.transcript;
      }
      const transcript = (final || interim).trim();
      if (transcript) optionsRef.current.onResult?.({ transcript, isFinal: Boolean(final) });
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false;
      }
      // 'no-speech' and 'aborted' are benign parts of normal cycling.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        optionsRef.current.onError?.(event.error);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* already started — fall through */
        }
      }
      setListening(false);
      optionsRef.current.onEnd?.();
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [supported]);

  const start = useCallback(() => {
    const recognition = ensureRecognition();
    if (!recognition) return;
    recognition.lang = optionsRef.current.lang ?? 'en-US';
    shouldListenRef.current = true;
    try {
      recognition.start();
    } catch {
      /* start() throws when already running — safe to ignore */
    }
    setListening(true);
  }, [ensureRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* not started */
      }
    }
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      shouldListenRef.current = false;
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  return { supported, listening, start, stop };
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeakOptions {
  rate?: number;
  lang?: string;
  onEnd?: () => void;
}

export interface SpeechSynthesisController {
  /** False when the browser has no speech-synthesis engine. */
  supported: boolean;
  speaking: boolean;
  speak: (text: string, options?: SpeakOptions) => void;
  cancel: () => void;
}

/** Chrome drops utterances spoken synchronously after cancel(); defer one beat. */
const SPEAK_DEFER_MS = 60;
/** Chrome silently pauses long utterances (~15 s) without resume(). */
const CHROME_KEEPALIVE_MS = 10_000;

/** Prefer a natural English voice for a given language; fall back to default. */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const preferred = [
    'Google US English',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Samantha',
  ];
  for (const name of preferred) {
    const voice = voices.find((v) => v.name === name);
    if (voice) return voice;
  }
  const base = lang.split('-')[0]?.toLowerCase() ?? 'en';
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    voices.find((v) => v.default) ??
    voices[0] ??
    null
  );
}

/**
 * Thin controller over the browser's SpeechSynthesis API for spoken Copilot
 * replies. One utterance at a time; speaking a new text cancels the previous
 * one. Always cancelled on unmount so navigation never leaves a voice running.
 */
export function useSpeechSynthesis(): SpeechSynthesisController {
  const supported = useMemo(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    [],
  );
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (speakTimerRef.current) {
      clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }
    if (keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (!supported) return;
    clearTimers();
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [clearTimers, supported]);

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      clearTimers();
      window.speechSynthesis.cancel();
    };
  }, [clearTimers, supported]);

  const speak = useCallback(
    (text: string, options?: SpeakOptions) => {
      if (!supported || !text.trim()) {
        options?.onEnd?.();
        return;
      }
      cancel();
      const lang = options?.lang ?? 'en-US';
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(voicesRef.current, lang);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = lang;
      }
      utterance.rate = options?.rate ?? 1;
      utterance.pitch = 1;
      const finish = () => {
        clearTimers();
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
          setSpeaking(false);
        }
        options?.onEnd?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      utteranceRef.current = utterance;
      setSpeaking(true);
      speakTimerRef.current = setTimeout(() => {
        speakTimerRef.current = null;
        window.speechSynthesis.speak(utterance);
        keepaliveRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
        }, CHROME_KEEPALIVE_MS);
      }, SPEAK_DEFER_MS);
    },
    [cancel, clearTimers, supported],
  );

  return { supported, speaking, speak, cancel };
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeakOptions {
  rate?: number;
  onEnd?: () => void;
}

export interface SpeechController {
  /** False when the browser has no speech synthesis engine. */
  supported: boolean;
  speaking: boolean;
  speak: (text: string, options?: SpeakOptions) => void;
  cancel: () => void;
}

/** Prefer a natural English voice; fall back to the engine default. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
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
  return (
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null
  );
}

/**
 * Thin controller over the browser's SpeechSynthesis API. One utterance at a
 * time; speaking a new text cancels the previous one. Always cancelled on
 * unmount so navigation never leaves a narrator running.
 */
export function useSpeech(): SpeechController {
  const supported = useMemo(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    [],
  );
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    if (utteranceRef.current) {
      // Detach handlers first: cancel() fires 'end'/'error' and must not
      // trigger autoplay-advance callbacks.
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, options?: SpeakOptions) => {
      if (!supported || !text.trim()) {
        options?.onEnd?.();
        return;
      }
      cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.rate = options?.rate ?? 1;
      utterance.pitch = 1;
      const finish = () => {
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
      window.speechSynthesis.speak(utterance);
    },
    [cancel, supported],
  );

  return { supported, speaking, speak, cancel };
}

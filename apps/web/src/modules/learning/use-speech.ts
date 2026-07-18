'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeakOptions {
  rate?: number;
  voiceId?: string;
  onEnd?: () => void;
}

export interface SpeechVoiceOption {
  id: string;
  name: string;
  language: string;
  local: boolean;
}

export interface SpeechController {
  /** False when the browser has no speech synthesis engine. */
  supported: boolean;
  speaking: boolean;
  voices: SpeechVoiceOption[];
  selectedVoiceId: string | null;
  selectVoice: (voiceId: string) => void;
  speak: (text: string, options?: SpeakOptions) => void;
  cancel: () => void;
}

const VOICE_STORAGE_KEY = 'sfcc-academy-narrator-voice';
/** Chrome drops utterances spoken synchronously after cancel(); defer one beat. */
const SPEAK_DEFER_MS = 60;
/** Chrome silently pauses long / remote-voice utterances (~15 s) without resume(). */
const CHROME_KEEPALIVE_MS = 10_000;

export function voiceKey(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || `${voice.name}|${voice.lang}`;
}

/** Prefer a natural English voice; fall back to the engine default. */
export function pickPreferredVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
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

export function listUsefulVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const unique = new Map<string, SpeechSynthesisVoice>();
  for (const voice of voices) unique.set(voiceKey(voice), voice);
  const all = [...unique.values()];
  const english = all.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  return (english.length > 0 ? english : all).sort((left, right) => {
    if (left.default !== right.default) return left.default ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

/** The voice a new utterance must use: the explicit request wins, then the sticky selection. */
export function resolveUtteranceVoice(
  available: SpeechSynthesisVoice[],
  requestedId: string | undefined,
  fallback: SpeechSynthesisVoice | null,
): SpeechSynthesisVoice | null {
  if (requestedId) {
    const requested = available.find((voice) => voiceKey(voice) === requestedId);
    if (requested) return requested;
  }
  return fallback;
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
  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
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

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      const available = listUsefulVoices(window.speechSynthesis.getVoices());
      availableVoicesRef.current = available;
      setVoices(
        available.map((voice) => ({
          id: voiceKey(voice),
          name: voice.name,
          language: voice.lang,
          local: voice.localService,
        })),
      );
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(VOICE_STORAGE_KEY);
      } catch {
        /* storage can be disabled */
      }
      const selected =
        available.find((voice) => voiceKey(voice) === saved) ??
        voiceRef.current ??
        pickPreferredVoice(available);
      voiceRef.current = selected;
      setSelectedVoiceId(selected ? voiceKey(selected) : null);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      clearTimers();
      window.speechSynthesis.cancel();
    };
  }, [clearTimers, supported]);

  const selectVoice = useCallback((id: string) => {
    const selected = availableVoicesRef.current.find((voice) => voiceKey(voice) === id);
    if (!selected) return;
    voiceRef.current = selected;
    setSelectedVoiceId(id);
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, id);
    } catch {
      /* storage can be disabled */
    }
  }, []);

  const cancel = useCallback(() => {
    if (!supported) return;
    clearTimers();
    if (utteranceRef.current) {
      // Detach handlers first: cancel() fires 'end'/'error' and must not
      // trigger autoplay-advance callbacks.
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [clearTimers, supported]);

  const speak = useCallback(
    (text: string, options?: SpeakOptions) => {
      if (!supported || !text.trim()) {
        options?.onEnd?.();
        return;
      }
      cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const selected = resolveUtteranceVoice(
        availableVoicesRef.current,
        options?.voiceId,
        voiceRef.current,
      );
      if (selected) {
        utterance.voice = selected;
        // Engines (Chrome and Edge especially) ignore `voice` and fall back to
        // the OS default when `lang` disagrees with the chosen voice.
        utterance.lang = selected.lang;
      } else {
        utterance.lang = 'en-US';
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
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.resume();
          }
        }, CHROME_KEEPALIVE_MS);
      }, SPEAK_DEFER_MS);
    },
    [cancel, clearTimers, supported],
  );

  return {
    supported,
    speaking,
    voices,
    selectedVoiceId,
    selectVoice,
    speak,
    cancel,
  };
}

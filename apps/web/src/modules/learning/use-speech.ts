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

function voiceId(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || `${voice.name}|${voice.lang}`;
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

function listUsefulVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const unique = new Map<string, SpeechSynthesisVoice>();
  for (const voice of voices) unique.set(voiceId(voice), voice);
  const all = [...unique.values()];
  const english = all.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  return (english.length > 0 ? english : all).sort((left, right) => {
    if (left.default !== right.default) return left.default ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
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

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      const available = listUsefulVoices(window.speechSynthesis.getVoices());
      availableVoicesRef.current = available;
      setVoices(
        available.map((voice) => ({
          id: voiceId(voice),
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
        available.find((voice) => voiceId(voice) === saved) ??
        voiceRef.current ??
        pickVoice(available);
      voiceRef.current = selected;
      setSelectedVoiceId(selected ? voiceId(selected) : null);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const selectVoice = useCallback((id: string) => {
    const selected = availableVoicesRef.current.find((voice) => voiceId(voice) === id);
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
      const selected =
        availableVoicesRef.current.find((voice) => voiceId(voice) === options?.voiceId) ??
        voiceRef.current;
      if (selected) utterance.voice = selected;
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

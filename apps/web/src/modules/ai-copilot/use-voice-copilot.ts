'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COPILOT_VOICE_PAUSE_FINALIZE_MS,
  COPILOT_VOICE_SILENCE_TIMEOUT_MS,
} from '@sfcc/shared';

/** Minimal Web Speech API surface — lib.dom does not ship SpeechRecognition. */
interface VoiceRecognitionAlternative {
  transcript: string;
}

interface VoiceRecognitionResult {
  isFinal: boolean;
  readonly length: number;
  [index: number]: VoiceRecognitionAlternative;
}

interface VoiceRecognitionResultList {
  readonly length: number;
  [index: number]: VoiceRecognitionResult;
}

interface VoiceRecognitionEvent {
  resultIndex: number;
  results: VoiceRecognitionResultList;
}

interface VoiceRecognitionErrorEvent {
  error: string;
}

interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: VoiceRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type VoiceRecognitionCtor = new () => VoiceRecognition;

export function getVoiceRecognitionCtor(): VoiceRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: VoiceRecognitionCtor;
    webkitSpeechRecognition?: VoiceRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceAutoStopReason = 'silence' | 'error';

export interface VoiceInputOptions {
  /** Called with the finalized utterance once the speaker pauses. */
  onUtterance: (transcript: string) => void;
  /** Listening ended on its own — silence timeout or a mic/engine failure. */
  onAutoStop?: (reason: VoiceAutoStopReason) => void;
}

export interface VoiceInputController {
  /** False when the browser has no speech recognition engine. */
  supported: boolean;
  listening: boolean;
  /** Live transcript preview while the user is speaking. */
  interimTranscript: string;
  error: string | null;
  start: () => void;
  /** Stop listening without emitting anything (mic toggle off, turn-taking). */
  stop: () => void;
}

/**
 * Push-to-talk style microphone input over the browser's SpeechRecognition
 * API. Listening never runs unattended: if nothing is said within
 * {@link COPILOT_VOICE_SILENCE_TIMEOUT_MS} the mic stops on its own, and once
 * the user pauses after speaking the utterance is finalized and emitted.
 */
export function useVoiceInput({ onUtterance, onAutoStop }: VoiceInputOptions): VoiceInputController {
  const [supported] = useState(() => getVoiceRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const intendedRef = useRef(false);
  const finalRef = useRef('');
  const interimRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onUtteranceRef = useRef(onUtterance);
  const onAutoStopRef = useRef(onAutoStop);
  onUtteranceRef.current = onUtterance;
  onAutoStopRef.current = onAutoStop;

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    clearTimers();
    intendedRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      // Detach handlers first: abort() fires 'end' and must not restart.
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    }
    finalRef.current = '';
    interimRef.current = '';
    setInterimTranscript('');
    setListening(false);
  }, [clearTimers]);

  /** The pause after speech ended — package everything heard and emit it. */
  const finalize = useCallback(() => {
    const transcript = `${finalRef.current} ${interimRef.current}`.replace(/\s+/g, ' ').trim();
    teardown();
    if (transcript) {
      onUtteranceRef.current(transcript);
    } else {
      onAutoStopRef.current?.('silence');
    }
  }, [teardown]);

  /** Nothing heard for the whole silence window — stop, or flush what we have. */
  const handleSilence = useCallback(() => {
    if (finalRef.current.trim() || interimRef.current.trim()) {
      finalize();
      return;
    }
    teardown();
    onAutoStopRef.current?.('silence');
  }, [finalize, teardown]);

  const armSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(handleSilence, COPILOT_VOICE_SILENCE_TIMEOUT_MS);
  }, [handleSilence]);

  const armFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
    finalizeTimerRef.current = setTimeout(finalize, COPILOT_VOICE_PAUSE_FINALIZE_MS);
  }, [finalize]);

  const start = useCallback(() => {
    if (intendedRef.current) return;
    const Recognition = getVoiceRecognitionCtor();
    if (!Recognition) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.');
      onAutoStopRef.current?.('error');
      return;
    }

    setError(null);
    finalRef.current = '';
    interimRef.current = '';
    setInterimTranscript('');
    intendedRef.current = true;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalRef.current = `${finalRef.current} ${transcript}`.trim();
        } else {
          interim += transcript;
        }
      }
      interimRef.current = interim.trim();
      setInterimTranscript(interimRef.current);
      // Speech activity postpones the auto-stop; a pause after speech sends it.
      armSilenceTimer();
      if (finalRef.current || interimRef.current) armFinalizeTimer();
    };

    recognition.onerror = (event) => {
      // The silence timer owns the no-speech case; 'aborted' is our own stop.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      const message =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow the microphone for this site and try again.'
          : event.error === 'audio-capture'
            ? 'No microphone was found. Check your audio input and try again.'
            : `Voice input failed (${event.error}). Please try again.`;
      setError(message);
      teardown();
      onAutoStopRef.current?.('error');
    };

    recognition.onend = () => {
      // Engines end sessions on their own (Chrome after ~60 s or a network
      // blip). Keep listening while we still intend to.
      if (!intendedRef.current || recognitionRef.current !== recognition) return;
      try {
        recognition.start();
      } catch {
        teardown();
        onAutoStopRef.current?.('error');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError('Could not start the microphone. Please try again.');
      teardown();
      onAutoStopRef.current?.('error');
      return;
    }
    setListening(true);
    armSilenceTimer();
  }, [armFinalizeTimer, armSilenceTimer, teardown]);

  const stop = useCallback(() => {
    teardown();
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { supported, listening, interimTranscript, error, start, stop };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  matchesWakeWord,
  renderVoiceGreeting,
  stripMarkdownForSpeech,
  type CopilotVoiceSettings,
} from '@sfcc/shared';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis';

export type CopilotVoicePhase =
  | 'unsupported'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking';

export interface UseCopilotVoiceOptions {
  settings: CopilotVoiceSettings;
  /** settings.enabled AND the user can access the Copilot module. */
  available: boolean;
  displayName?: string | null;
  /** Dispatch a spoken command to the Copilot (same path as typing). */
  onCommand: (text: string) => void;
}

export interface CopilotVoiceController {
  supported: boolean;
  available: boolean;
  phase: CopilotVoicePhase;
  listening: boolean;
  speaking: boolean;
  interimTranscript: string;
  error: string | null;
  toggleListening: () => void;
  stopAll: () => void;
  /** Speak a finished assistant reply and resume listening if a session is active. */
  speakResponse: (text: string) => void;
  clearError: () => void;
}

/** Longest spoken reply (characters) before it is trimmed on a sentence boundary. */
const MAX_SPOKEN_CHARS = 700;
/** Ignore an identical command repeated within this window (recognizer echoes). */
const DUPLICATE_COMMAND_MS = 4000;

/**
 * Orchestrates the Copilot voice experience: background listening with an
 * auto-stop silence window, wake-word greeting by name, voice commands routed
 * to the Copilot, and spoken replies. All of it is gated by the admin switch
 * (`available`).
 */
export function useCopilotVoice(options: UseCopilotVoiceOptions): CopilotVoiceController {
  const { settings, available, displayName } = options;

  const [phase, setPhase] = useState<CopilotVoicePhase>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionActiveRef = useRef(false);
  const phaseRef = useRef<CopilotVoicePhase>('idle');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommandRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const onCommandRef = useRef(options.onCommand);
  onCommandRef.current = options.onCommand;

  const synth = useSpeechSynthesis();
  const synthRef = useRef(synth);
  synthRef.current = synth;

  const setPhaseSafe = useCallback((next: CopilotVoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Forward declarations resolved via refs so callbacks can reference each other.
  const recognitionRef = useRef<{ start: () => void; stop: () => void }>({
    start: () => {},
    stop: () => {},
  });

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Nothing relevant was said within the window — stop background listening.
      sessionActiveRef.current = false;
      recognitionRef.current.stop();
      setInterimTranscript('');
      if (phaseRef.current === 'listening') setPhaseSafe('idle');
    }, settingsRef.current.listenSilenceMs);
  }, [clearSilenceTimer, setPhaseSafe]);

  const resumeListening = useCallback(() => {
    if (!sessionActiveRef.current) {
      setPhaseSafe('idle');
      return;
    }
    setInterimTranscript('');
    recognitionRef.current.start();
    setPhaseSafe('listening');
    armSilenceTimer();
  }, [armSilenceTimer, setPhaseSafe]);

  /** Pause the mic, speak, then either resume listening or go idle. */
  const speakThen = useCallback(
    (text: string, resume: boolean) => {
      clearSilenceTimer();
      recognitionRef.current.stop();
      const spoken = stripMarkdownForSpeech(text, MAX_SPOKEN_CHARS);
      if (!spoken) {
        if (resume) resumeListening();
        else setPhaseSafe(sessionActiveRef.current ? 'listening' : 'idle');
        return;
      }
      setPhaseSafe('speaking');
      synthRef.current.speak(spoken, {
        rate: settingsRef.current.speechRate,
        lang: settingsRef.current.voiceLang,
        onEnd: () => {
          if (resume && sessionActiveRef.current) resumeListening();
          else setPhaseSafe(sessionActiveRef.current ? 'listening' : 'idle');
        },
      });
    },
    [clearSilenceTimer, resumeListening, setPhaseSafe],
  );

  const dispatchCommand = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = Date.now();
      const last = lastCommandRef.current;
      if (last.text === trimmed && now - last.at < DUPLICATE_COMMAND_MS) return;
      lastCommandRef.current = { text: trimmed, at: now };

      clearSilenceTimer();
      recognitionRef.current.stop();
      setInterimTranscript('');
      setPhaseSafe('thinking');
      onCommandRef.current(trimmed);
    },
    [clearSilenceTimer, setPhaseSafe],
  );

  const handleResult = useCallback(
    ({ transcript, isFinal }: { transcript: string; isFinal: boolean }) => {
      if (!sessionActiveRef.current || phaseRef.current !== 'listening') return;
      if (synthRef.current.speaking) return;

      setInterimTranscript(transcript);
      armSilenceTimer();
      if (!isFinal) return;

      const wake = matchesWakeWord(transcript, settingsRef.current.wakeWords);
      if (wake.matched) {
        const greeting = renderVoiceGreeting(
          settingsRef.current.greetingTemplate,
          displayNameRef.current,
        );
        const command = wake.command?.trim();
        clearSilenceTimer();
        recognitionRef.current.stop();
        setInterimTranscript('');
        setPhaseSafe('speaking');
        synthRef.current.speak(greeting, {
          rate: settingsRef.current.speechRate,
          lang: settingsRef.current.voiceLang,
          onEnd: () => {
            if (command) dispatchCommand(command);
            else if (sessionActiveRef.current) resumeListening();
            else setPhaseSafe('idle');
          },
        });
        return;
      }

      dispatchCommand(transcript);
    },
    [armSilenceTimer, clearSilenceTimer, dispatchCommand, resumeListening, setPhaseSafe],
  );

  const recognition = useSpeechRecognition({
    lang: settings.voiceLang,
    onResult: handleResult,
    onError: (err) => {
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        sessionActiveRef.current = false;
        clearSilenceTimer();
        setInterimTranscript('');
        setPhaseSafe('idle');
        setError('Microphone access is blocked. Allow it in your browser to use voice.');
      }
    },
  });

  // Keep the mutable recognition controls the callbacks reach for in sync.
  recognitionRef.current = { start: recognition.start, stop: recognition.stop };

  const supported = recognition.supported && synth.supported;

  const stopAll = useCallback(() => {
    sessionActiveRef.current = false;
    clearSilenceTimer();
    recognition.stop();
    synth.cancel();
    setInterimTranscript('');
    setPhaseSafe('idle');
  }, [clearSilenceTimer, recognition, setPhaseSafe, synth]);

  const startSession = useCallback(() => {
    if (!available || !supported) return;
    setError(null);
    synth.cancel();
    sessionActiveRef.current = true;
    lastCommandRef.current = { text: '', at: 0 };
    setInterimTranscript('');
    recognition.start();
    setPhaseSafe('listening');
    armSilenceTimer();
  }, [available, armSilenceTimer, recognition, setPhaseSafe, supported, synth]);

  const toggleListening = useCallback(() => {
    if (sessionActiveRef.current || phaseRef.current !== 'idle') stopAll();
    else startSession();
  }, [startSession, stopAll]);

  const speakResponse = useCallback(
    (text: string) => {
      if (phaseRef.current !== 'thinking') return;
      if (!settingsRef.current.speakResponses) {
        if (sessionActiveRef.current) resumeListening();
        else setPhaseSafe('idle');
        return;
      }
      speakThen(text, sessionActiveRef.current);
    },
    [resumeListening, setPhaseSafe, speakThen],
  );

  const clearError = useCallback(() => setError(null), []);

  // `stopAll` closes over the per-render recognition/synth objects, so its
  // identity changes every render. Reach it through a ref from effects so the
  // unmount cleanup only fires on real unmount (not on every render).
  const stopAllRef = useRef(stopAll);
  stopAllRef.current = stopAll;

  // Stop everything if the admin disables voice or the feature becomes unusable.
  useEffect(() => {
    if (!available || !supported) stopAllRef.current();
  }, [available, supported]);

  useEffect(() => () => stopAllRef.current(), []);

  return {
    supported,
    available: available && supported,
    phase: supported ? phase : 'unsupported',
    listening: recognition.listening && sessionActiveRef.current,
    speaking: synth.speaking,
    interimTranscript,
    error,
    toggleListening,
    stopAll,
    speakResponse,
    clearError,
  };
}

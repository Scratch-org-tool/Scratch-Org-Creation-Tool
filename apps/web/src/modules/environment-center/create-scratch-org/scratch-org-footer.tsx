'use client';

import { Rocket, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScratchOrgFooterProps {
  isRunning: boolean;
  onStop: () => void;
  stopping: boolean;
}

export function ScratchOrgFooter({ isRunning, onStop, stopping }: ScratchOrgFooterProps) {
  if (!isRunning) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur px-4 py-3 md:pl-[var(--sidebar-width)] transition-[padding-left] duration-300 ease-in-out">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Rocket className="w-4 h-4 text-primary animate-pulse" />
          <span>Pipeline running…</span>
        </div>
        <Button variant="destructive" size="sm" onClick={onStop} loading={stopping}>
          <Square className="w-3 h-3 mr-1 fill-current" />
          Stop pipeline
        </Button>
      </div>
    </div>
  );
}

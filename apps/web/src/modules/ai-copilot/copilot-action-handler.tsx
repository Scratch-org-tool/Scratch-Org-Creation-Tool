'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isCopilotAction, type CopilotAction } from '@sfcc/shared';
import { useNavigation } from '@/contexts/navigation-context';
import { openCopilot } from '@/store';

interface CopilotActionCardProps {
  action: CopilotAction | Record<string, unknown>;
  onDismiss: () => void;
}

function normalizeAction(action: CopilotAction | Record<string, unknown>): CopilotAction | null {
  if (isCopilotAction(action)) return action;
  const type = (action as { type?: string }).type;
  if (type === 'scratch_org_workflow') {
    return { type: 'navigate', href: '/environment-center/create-scratch-org', label: 'Create Scratch Org' };
  }
  if (type === 'data_replication') {
    return { type: 'navigate', href: '/data-center', label: 'Data Center' };
  }
  if (type === 'release_analysis') {
    return { type: 'navigate', href: '/metadata-deployment', label: 'Metadata Deployment' };
  }
  return null;
}

export function CopilotActionCard({ action, onDismiss }: CopilotActionCardProps) {
  const router = useRouter();
  const { startNavigation } = useNavigation();
  const normalized = normalizeAction(action);

  if (!normalized) return null;

  const label =
    normalized.type === 'navigate' || normalized.type === 'open_tab' || normalized.type === 'prefill_form'
      ? normalized.label
      : 'Continue';

  const handleConfirm = () => {
    switch (normalized.type) {
      case 'navigate': {
        startNavigation(normalized.href);
        router.push(normalized.href);
        onDismiss();
        break;
      }
      case 'open_tab': {
        const href = normalized.tab
          ? `${normalized.href}${normalized.href.includes('?') ? '&' : '?'}tab=${encodeURIComponent(normalized.tab)}`
          : normalized.href;
        startNavigation(href);
        router.push(href);
        onDismiss();
        break;
      }
      case 'prefill_form': {
        const params = new URLSearchParams(normalized.values);
        const href = `${window.location.pathname}?${params.toString()}`;
        startNavigation(href);
        router.push(href);
        onDismiss();
        break;
      }
      case 'open_copilot': {
        openCopilot();
        onDismiss();
        break;
      }
      default:
        onDismiss();
    }
  };

  return (
    <div className="mt-2 rounded-md border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs">
      <p className="text-muted-foreground mb-2">Suggested action</p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{label}</span>
        <div className="flex gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={onDismiss}
            aria-label="Dismiss proposed Copilot action"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" size="sm" className="h-7 gap-1" onClick={handleConfirm}>
            Go
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

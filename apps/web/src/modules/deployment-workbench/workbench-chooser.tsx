'use client';

import { ArrowRight, Check, ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';

export type ChooserTone = 'source' | 'target';

const TONE = {
  source: {
    tile: 'bg-sky-500/15 text-sky-300',
    notch: 'before:bg-sky-400',
    selectedRow: 'border-sky-500/50 bg-sky-500/10',
    hoverRow: 'hover:border-sky-500/40 hover:bg-sky-500/5',
    chevron: 'text-sky-400',
  },
  target: {
    tile: 'bg-emerald-500/15 text-emerald-300',
    notch: 'before:bg-emerald-400',
    selectedRow: 'border-emerald-500/50 bg-emerald-500/10',
    hoverRow: 'hover:border-emerald-500/40 hover:bg-emerald-500/5',
    chevron: 'text-emerald-400',
  },
} as const;

/** Centered hero for the location-selection screens (icon, title, subtitle). */
export function ChooserHero({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 pb-2 pt-1 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_45px_-12px] shadow-primary/60">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/** One side of the source→target layout with an accent header notch. */
export function ChooserPanel({
  tone,
  icon: Icon,
  title,
  question,
  children,
}: {
  tone: ChooserTone;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  const palette = TONE[tone];
  return (
    <section
      aria-label={title}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4',
        'before:absolute before:left-0 before:top-6 before:h-10 before:w-1 before:rounded-r-full',
        palette.notch,
      )}
    >
      <header className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', palette.tile)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{question}</p>
        </div>
      </header>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

/**
 * Selectable location row (radio semantics). When selected it highlights and
 * reveals its configuration content underneath.
 */
export function ChooserOptionRow({
  tone,
  icon,
  title,
  description,
  name,
  value,
  checked,
  onSelect,
  children,
}: {
  tone: ChooserTone;
  icon: React.ReactNode;
  title: string;
  description: string;
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  const palette = TONE[tone];
  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        checked ? palette.selectedRow : cn('border-border/60 bg-background/30', palette.hoverRow),
      )}
    >
      <label className="flex cursor-pointer items-center gap-3 p-3.5 focus-within:ring-2 focus-within:ring-ring rounded-xl">
        <input
          type="radio"
          className="sr-only"
          name={name}
          value={value}
          checked={checked}
          onChange={onSelect}
        />
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-card/70">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
        </span>
        {checked
          ? <Check className={cn('size-4 shrink-0', palette.chevron)} aria-hidden="true" />
          : <ChevronRight className={cn('size-4 shrink-0', palette.chevron)} aria-hidden="true" />}
      </label>
      {checked && children && (
        <div className="border-t border-border/40 p-3.5 pt-3">{children}</div>
      )}
    </div>
  );
}

/** The circular arrow between the source and target panels. */
export function ChooserDivider({
  onClick,
  label,
}: {
  onClick?: () => void;
  label?: string;
}) {
  const content = <ArrowRight className="size-4" aria-hidden="true" />;
  return (
    <div className="flex items-center justify-center">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={label ?? 'Swap source and target'}
          title={label ?? 'Swap source and target'}
          className="flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_30px_-10px] shadow-primary/50 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_30px_-10px] shadow-primary/50"
        >
          {content}
        </span>
      )}
    </div>
  );
}

/** Landing card for one deployment flow (metadata / data). */
export function FlowCard({
  tone,
  icon: Icon,
  title,
  description,
  features,
  cta,
  onOpen,
}: {
  tone: ChooserTone;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  features: string[];
  cta: string;
  onOpen: () => void;
}) {
  const palette = TONE[tone];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 text-left transition-all',
        'hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tone === 'source' ? 'hover:border-sky-500/50 hover:shadow-sky-500/10' : 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 size-44 rounded-full blur-3xl transition-opacity opacity-60 group-hover:opacity-100',
          tone === 'source' ? 'bg-sky-500/10' : 'bg-emerald-500/10',
        )}
      />
      <span className={cn('flex size-12 items-center justify-center rounded-2xl', palette.tile)}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
      <ul className="space-y-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check className={cn('mt-0.5 size-3.5 shrink-0', palette.chevron)} aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <span
        className={cn(
          'mt-auto inline-flex items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          tone === 'source'
            ? 'bg-sky-500/15 text-sky-300 group-hover:bg-sky-500/25'
            : 'bg-emerald-500/15 text-emerald-300 group-hover:bg-emerald-500/25',
        )}
      >
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </button>
  );
}

export interface WorkbenchStepDefinition {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Premium step navigation: icon tiles with state-aware gradients and filled
 * progress connectors instead of bare numbered circles. Reachable steps are
 * clickable so every step behaves like its own page.
 */
export function WorkbenchStepper({
  steps,
  current,
  onStepSelect,
  isStepEnabled,
}: {
  steps: WorkbenchStepDefinition[];
  current: number;
  onStepSelect: (index: number) => void;
  isStepEnabled: (index: number) => boolean;
}) {
  return (
    <nav
      aria-label="Deployment steps"
      className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40 p-2"
    >
      <ol className="flex min-w-[860px] items-center">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const enabled = isStepEnabled(index);
          const Icon = step.icon;
          return (
            <li key={step.label} className={cn('flex items-center', index > 0 && 'flex-1')}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-2 h-0.5 min-w-6 flex-1 rounded-full',
                    done || active
                      ? 'bg-gradient-to-r from-primary/80 to-primary'
                      : 'bg-border/70',
                  )}
                />
              )}
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                disabled={!enabled || active}
                onClick={() => onStepSelect(index)}
                title={enabled ? step.label : 'Complete the previous steps first'}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'bg-primary/10 ring-1 ring-primary/40',
                  !active && enabled && 'hover:bg-muted/40',
                  !enabled && 'cursor-not-allowed opacity-45',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg transition-colors',
                    done && 'bg-emerald-500/15 text-emerald-300',
                    active && 'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
                    !done && !active && 'bg-muted/40 text-muted-foreground',
                  )}
                >
                  {done
                    ? <Check className="size-4" aria-hidden="true" />
                    : enabled || active
                      ? <Icon className="size-4" aria-hidden="true" />
                      : <Lock className="size-3.5" aria-hidden="true" />}
                </span>
                <span className="text-left">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Step {index + 1}
                  </span>
                  <span
                    className={cn(
                      'block text-xs font-semibold',
                      active ? 'text-foreground' : done ? 'text-emerald-200/90' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

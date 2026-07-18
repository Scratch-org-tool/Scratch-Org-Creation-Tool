'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Box,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Code,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  Eye,
  FileText,
  Filter,
  GitBranch,
  Globe,
  GraduationCap,
  Heart,
  Key,
  Layers,
  LifeBuoy,
  Lightbulb,
  Link2,
  ListChecks,
  Lock,
  Mail,
  MessageSquare,
  Network,
  Package,
  Phone,
  PieChart,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Settings,
  Share2,
  Shield,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Table,
  Target,
  Terminal,
  TrendingUp,
  Trophy,
  Truck,
  User,
  Users,
  Workflow,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ExplainerAccent, ExplainerVisual, ExplainerVisualItem } from '@sfcc/shared';

const ICONS: Record<string, LucideIcon> = {
  cloud: Cloud,
  database: Database,
  users: Users,
  user: User,
  shield: Shield,
  lock: Lock,
  workflow: Workflow,
  'git-branch': GitBranch,
  boxes: Boxes,
  box: Box,
  table: Table,
  'file-text': FileText,
  mail: Mail,
  phone: Phone,
  'bar-chart': BarChart3,
  'pie-chart': PieChart,
  'trending-up': TrendingUp,
  rocket: Rocket,
  building: Building2,
  briefcase: Briefcase,
  globe: Globe,
  server: Server,
  zap: Zap,
  'check-circle': CheckCircle2,
  'x-circle': XCircle,
  'alert-triangle': AlertTriangle,
  'dollar-sign': DollarSign,
  clock: Clock,
  settings: Settings,
  layers: Layers,
  'share-2': Share2,
  key: Key,
  'refresh-cw': RefreshCw,
  search: Search,
  target: Target,
  trophy: Trophy,
  lightbulb: Lightbulb,
  'message-square': MessageSquare,
  'list-checks': ListChecks,
  package: Package,
  truck: Truck,
  'shopping-cart': ShoppingCart,
  'credit-card': CreditCard,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  wrench: Wrench,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  code: Code,
  terminal: Terminal,
  cpu: Cpu,
  network: Network,
  link: Link2,
  filter: Filter,
  eye: Eye,
  bell: Bell,
  calendar: Calendar,
  smartphone: Smartphone,
  'life-buoy': LifeBuoy,
};

interface AccentTheme {
  chip: string;
  icon: string;
  glow: string;
  line: string;
}

const ACCENTS: Record<ExplainerAccent, AccentTheme> = {
  sky: {
    chip: 'border-sky-400/35 bg-sky-500/10',
    icon: 'bg-sky-500/20 text-sky-300',
    glow: '#38bdf8',
    line: 'bg-sky-400/50',
  },
  emerald: {
    chip: 'border-emerald-400/35 bg-emerald-500/10',
    icon: 'bg-emerald-500/20 text-emerald-300',
    glow: '#34d399',
    line: 'bg-emerald-400/50',
  },
  violet: {
    chip: 'border-violet-400/35 bg-violet-500/10',
    icon: 'bg-violet-500/20 text-violet-300',
    glow: '#a78bfa',
    line: 'bg-violet-400/50',
  },
  amber: {
    chip: 'border-amber-400/35 bg-amber-500/10',
    icon: 'bg-amber-500/20 text-amber-300',
    glow: '#fbbf24',
    line: 'bg-amber-400/50',
  },
  red: {
    chip: 'border-red-400/35 bg-red-500/10',
    icon: 'bg-red-500/20 text-red-300',
    glow: '#f87171',
    line: 'bg-red-400/50',
  },
  slate: {
    chip: 'border-border/70 bg-secondary/40',
    icon: 'bg-secondary/70 text-muted-foreground',
    glow: '#94a3b8',
    line: 'bg-muted-foreground/40',
  },
};

function ItemIcon({ item, size = 'md' }: { item: ExplainerVisualItem; size?: 'md' | 'lg' }) {
  const Icon = ICONS[item.icon] ?? Sparkles;
  const theme = ACCENTS[item.accent];
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl',
        theme.icon,
        size === 'lg' ? 'size-16' : 'size-9',
      )}
      style={{ boxShadow: `0 0 ${size === 'lg' ? 28 : 14}px ${theme.glow}33` }}
    >
      <Icon className={size === 'lg' ? 'size-8' : 'size-[18px]'} strokeWidth={1.75} />
    </span>
  );
}

const appear = (index: number, extra = 0) => ({
  initial: { opacity: 0, y: 14, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { delay: 0.15 + index * 0.28 + extra, duration: 0.45, ease: 'easeOut' as const },
});

function FlowVisual({ items }: { items: ExplainerVisualItem[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-y-4">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <motion.div
            {...appear(index)}
            className={cn(
              'flex w-32 flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center',
              ACCENTS[item.accent].chip,
            )}
          >
            <ItemIcon item={item} />
            <div>
              <p className="text-xs font-semibold leading-tight">{item.label}</p>
              {item.sublabel && (
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{item.sublabel}</p>
              )}
            </div>
          </motion.div>
          {index < items.length - 1 && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.32 + index * 0.28, duration: 0.3 }}
              className="mx-1 origin-left text-muted-foreground"
            >
              <ChevronRight className="size-5" />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}

function CompareVisual({ items }: { items: ExplainerVisualItem[] }) {
  const left = items.filter((item) => item.side !== 'right');
  const right = items.filter((item) => item.side === 'right');
  const column = (columnItems: ExplainerVisualItem[], fromLeft: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
      {columnItems.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: fromLeft ? -24 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + index * 0.24, duration: 0.4, ease: 'easeOut' }}
          className={cn(
            'flex items-center gap-2.5 rounded-xl border px-3 py-2.5',
            ACCENTS[item.accent].chip,
          )}
        >
          <ItemIcon item={item} />
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">{item.label}</p>
            {item.sublabel && (
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{item.sublabel}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
  return (
    <div className="flex w-full items-stretch gap-3">
      {column(left, true)}
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex flex-col items-center justify-center gap-1"
      >
        <div className="w-px flex-1 bg-border/70" />
        <span className="rounded-full border border-border/70 bg-secondary/60 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
          vs
        </span>
        <div className="w-px flex-1 bg-border/70" />
      </motion.div>
      {column(right, false)}
    </div>
  );
}

function StackVisual({ items }: { items: ExplainerVisualItem[] }) {
  const reversed = [...items].reverse();
  return (
    <div className="flex w-full max-w-md flex-col-reverse gap-2">
      {reversed.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + index * 0.24, duration: 0.4, ease: 'easeOut' }}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-4 py-2.5',
            ACCENTS[item.accent].chip,
          )}
        >
          <ItemIcon item={item} />
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">{item.label}</p>
            {item.sublabel && (
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{item.sublabel}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TimelineVisual({ items }: { items: ExplainerVisualItem[] }) {
  return (
    <div className="w-full max-w-md space-y-0">
      {items.map((item, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <motion.div {...appear(index)}>
              <ItemIcon item={item} />
            </motion.div>
            {index < items.length - 1 && (
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.34 + index * 0.28, duration: 0.25 }}
                className={cn('my-1 w-0.5 flex-1 origin-top rounded-full', ACCENTS[item.accent].line)}
              />
            )}
          </div>
          <motion.div {...appear(index, 0.06)} className="min-w-0 pb-4 pt-1.5">
            <p className="text-xs font-semibold leading-snug">{item.label}</p>
            {item.sublabel && (
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{item.sublabel}</p>
            )}
          </motion.div>
        </div>
      ))}
    </div>
  );
}

function CalloutVisual({ items }: { items: ExplainerVisualItem[] }) {
  const item = items[0]!;
  const theme = ACCENTS[item.accent];
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-2xl"
          style={{ boxShadow: `0 0 0 0 ${theme.glow}55` }}
          animate={{ boxShadow: [`0 0 0 0px ${theme.glow}44`, `0 0 0 22px ${theme.glow}00`] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <ItemIcon item={item} size="lg" />
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="max-w-sm"
      >
        <p className="text-base font-bold leading-snug">{item.label}</p>
        {item.sublabel && <p className="mt-1 text-xs text-muted-foreground">{item.sublabel}</p>}
      </motion.div>
      {items.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {items.slice(1).map((extra, index) => (
            <motion.span
              key={index}
              {...appear(index + 1, -0.1)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-medium',
                ACCENTS[extra.accent].chip,
              )}
            >
              {extra.label}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

function GridVisual({ items }: { items: ExplainerVisualItem[] }) {
  return (
    <div className={cn('grid w-full max-w-lg gap-2.5', items.length > 4 ? 'grid-cols-3' : 'grid-cols-2')}>
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12 + index * 0.14, duration: 0.35, ease: 'easeOut' }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center',
            ACCENTS[item.accent].chip,
          )}
        >
          <ItemIcon item={item} />
          <div>
            <p className="text-[11px] font-semibold leading-tight">{item.label}</p>
            {item.sublabel && (
              <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{item.sublabel}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Renders one storyboard scene's diagram with entrance animations. */
export function SceneVisual({ visual }: { visual: ExplainerVisual }) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex min-h-[210px] w-full items-center justify-center px-2">
        {visual.kind === 'flow' && <FlowVisual items={visual.items} />}
        {visual.kind === 'compare' && <CompareVisual items={visual.items} />}
        {visual.kind === 'stack' && <StackVisual items={visual.items} />}
        {visual.kind === 'timeline' && <TimelineVisual items={visual.items} />}
        {visual.kind === 'callout' && <CalloutVisual items={visual.items} />}
        {visual.kind === 'grid' && <GridVisual items={visual.items} />}
      </div>
      {visual.caption && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          {visual.caption}
        </motion.p>
      )}
    </div>
  );
}

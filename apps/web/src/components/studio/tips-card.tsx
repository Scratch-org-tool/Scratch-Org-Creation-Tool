import { Lightbulb } from 'lucide-react';
import { GlassCard } from './glass-card';

interface TipsCardProps {
  title?: string;
  children: React.ReactNode;
}

export function TipsCard({ title = 'Tips', children }: TipsCardProps) {
  return (
    <GlassCard title={title}>
      <div className="flex gap-3 text-sm text-muted-foreground">
        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">{children}</div>
      </div>
    </GlassCard>
  );
}

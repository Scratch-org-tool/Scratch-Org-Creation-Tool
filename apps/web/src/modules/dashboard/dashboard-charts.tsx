'use client';

import { cn } from '@/utils/cn';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'hsl(222 47% 9%)',
    border: '1px solid hsl(217 33% 20%)',
    borderRadius: '8px',
    fontSize: '12px',
  },
  labelStyle: { color: 'hsl(215 20% 65%)' },
};

interface SparklineProps {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
}

export function Sparkline({ data, color = '#60a5fa', className, height = 32 }: SparklineProps) {
  const chartData = data.map((value, i) => ({ i, value }));

  if (!data.length) {
    return (
      <div className={cn('w-full', className)} style={{ height }}>
        <div className="h-full w-full rounded bg-secondary/30" />
      </div>
    );
  }

  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive
            animationDuration={600}
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  className?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 40,
  color = '#4ade80',
  className,
}: ProgressRingProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const data = [{ name: 'progress', value: pct, fill: color }];

  return (
    <div className={cn(className)} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="72%"
          outerRadius="100%"
          barSize={4}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            background={{ fill: 'rgba(255,255,255,0.06)' }}
            dataKey="value"
            cornerRadius={4}
            isAnimationActive
            animationDuration={700}
            style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  stroke?: string;
  className?: string;
}

export function LineChart({
  data,
  height = 100,
  stroke = '#a78bfa',
  className,
}: LineChartProps) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <div
        className={cn('flex items-center justify-center text-xs text-muted-foreground', className)}
        style={{ height }}
      >
        No duration data for this period
      </div>
    );
  }

  const gradId = 'duration-area';

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: number) => [`${(v / 1000).toFixed(1)}s`, 'Avg duration']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive
            animationDuration={800}
            style={{ filter: `drop-shadow(0 0 8px ${stroke}88)` }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  className?: string;
}

export function DonutChart({ segments, size = 128, className }: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const data = segments.filter((s) => s.value > 0);

  if (total === 0) {
    return (
      <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
        <div className="w-full h-full rounded-full border-[10px] border-secondary/50" />
        <span className="absolute text-muted-foreground text-sm">—</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.length ? data : segments}
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            dataKey="value"
            isAnimationActive
            animationDuration={700}
          >
            {(data.length ? data : segments).map((entry) => (
              <Cell
                key={entry.label}
                fill={entry.color}
                stroke="transparent"
                style={{ filter: `drop-shadow(0 0 6px ${entry.color}66)` }}
              />
            ))}
          </Pie>
          <Tooltip {...CHART_TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-lg font-bold tabular-nums">{total}</span>
      </div>
    </div>
  );
}

interface MiniBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showPercent?: boolean;
}

export function MiniBar({
  label,
  value,
  max = 100,
  color = '#22c55e',
  showPercent = true,
}: MiniBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const display = showPercent ? `${value}%` : String(value);

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs min-w-0">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className="tabular-nums font-medium shrink-0">{display}</span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary/60 border border-border/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            minWidth: pct > 0 ? '4px' : undefined,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: pct > 0 ? `0 0 8px ${color}55` : undefined,
          }}
        />
      </div>
    </div>
  );
}

interface HorizontalBarChartProps {
  data: { label: string; value: number; color: string }[];
  height?: number;
}

export function HorizontalBarChart({ data, height = 120 }: HorizontalBarChartProps) {
  if (!data.length) return null;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={72}
            tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={600}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

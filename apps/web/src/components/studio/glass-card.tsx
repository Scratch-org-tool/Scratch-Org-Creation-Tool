import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';

interface GlassCardProps {
  title?: React.ReactNode;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
  style?: React.CSSProperties;
}

export function GlassCard({
  title,
  description,
  headerAction,
  children,
  className,
  contentClassName,
  noPadding,
  style,
}: GlassCardProps) {
  return (
    <Card
      className={cn(
        'bg-card/60 border-border/60 hover:border-primary/20 transition-colors duration-300',
        className,
      )}
      style={style}
    >
      {(title || description || headerAction) && (
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 flex-1">
            {title &&
              (typeof title === 'string' ? (
                <CardTitle className="text-base">{title}</CardTitle>
              ) : (
                title
              ))}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {headerAction}
        </CardHeader>
      )}
      {noPadding ? children : <CardContent className={contentClassName}>{children}</CardContent>}
    </Card>
  );
}

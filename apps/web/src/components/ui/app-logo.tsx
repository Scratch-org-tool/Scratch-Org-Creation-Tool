import Image from 'next/image';
import { cn } from '@/utils/cn';
import { APP_LOGO_SRC } from '@/lib/error-page-content';

export { APP_LOGO_SRC };

export type AppLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<AppLogoSize, number> = {
  xs: 20,
  sm: 28,
  md: 48,
  lg: 64,
  xl: 96,
};

interface AppLogoProps {
  size?: AppLogoSize;
  className?: string;
  priority?: boolean;
}

export function AppLogo({ size = 'md', className, priority }: AppLogoProps) {
  const px = SIZE_MAP[size];

  return (
    <Image
      src={APP_LOGO_SRC}
      alt="SF DevOps Command Center"
      width={px}
      height={px}
      priority={priority}
      className={cn('rounded-xl object-cover shrink-0', className)}
    />
  );
}

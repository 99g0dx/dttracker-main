import React from 'react';
import type { Platform } from '../../../lib/types/database';
import { getCreatorProfileUrl } from '../../../lib/utils/platform-urls';
import { cn } from './utils';

interface CreatorHandleLinkProps {
  handle: string;
  platform: Platform;
  className?: string;
  children?: React.ReactNode;
}

export function CreatorHandleLink({
  handle,
  platform,
  className,
  children,
}: CreatorHandleLinkProps) {
  const url = getCreatorProfileUrl(handle, platform);

  // If URL generation fails, fall back to plain text
  if (!url) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        {children || `@${handle}`}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'text-xs text-primary hover:text-primary/80 hover:underline transition-colors',
        className
      )}
      aria-label={`Open ${handle}'s ${platform} profile in new tab`}
    >
      {children || `@${handle}`}
    </a>
  );
}

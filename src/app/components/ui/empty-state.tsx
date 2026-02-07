import * as React from "react";
import { LucideIcon, FolderPlus, Users, FileText, Receipt, Zap } from "lucide-react";
import { Button } from "./button";
import { cn } from "./utils";

export interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Custom content to render */
  children?: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Reusable empty state component
 * Use when there's no data to display
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center",
        className
      )}
    >
      {Icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"></div>
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-primary/30">
            <Icon className="w-8 h-8 text-primary" />
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

      {description && (
        <p className="text-muted-foreground text-sm mb-6 max-w-md">
          {description}
        </p>
      )}

      {children}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          {action && (
            <Button onClick={action.onClick} variant="default">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */

export function EmptyCampaigns({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={FolderPlus}
      title="No campaigns yet"
      description="Create your first campaign to start tracking posts and analytics."
      action={{
        label: "Create Campaign",
        onClick: onCreate,
      }}
    />
  );
}

export function EmptyCreators({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No creators yet"
      description="Add creators to your library to start managing your network."
      action={{
        label: "Add Creator",
        onClick: onAdd,
      }}
    />
  );
}

export function EmptyPosts({
  onAdd,
  description,
}: {
  onAdd: () => void;
  description?: string;
}) {
  return (
    <EmptyState
      icon={FileText}
      title="No posts yet"
      description={description || "Add posts to this campaign to start tracking metrics."}
      action={{
        label: "Add Post",
        onClick: onAdd,
      }}
    />
  );
}

export function EmptyTransactions() {
  return (
    <EmptyState
      icon={Receipt}
      title="No transactions yet"
      description="Wallet transactions will appear here once you start funding or making payments."
    />
  );
}

export function EmptyActivations({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={Zap}
      title="No activations yet"
      description="Create contests or SM panels to engage with creators."
      action={{
        label: "Create Activation",
        onClick: onCreate,
      }}
    />
  );
}

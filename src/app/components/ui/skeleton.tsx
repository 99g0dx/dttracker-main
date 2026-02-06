import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-white/[0.05] animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

// Campaign card skeleton for list view
function CampaignCardSkeleton() {
  return (
    <div className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg overflow-hidden">
      {/* Cover image skeleton */}
      <Skeleton className="w-full h-32" />

      <div className="p-5 space-y-3">
        {/* Title */}
        <Skeleton className="h-6 w-2/3" />

        {/* Brand name */}
        <Skeleton className="h-4 w-1/2" />

        {/* Stats row */}
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <Skeleton className="h-3 w-12 mb-1" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-3 w-12 mb-1" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-3 w-12 mb-1" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Post table row skeleton
function PostRowSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-b border-white/[0.08]">
      {/* Avatar */}
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />

      {/* Creator info */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 sm:w-40" />
        <Skeleton className="h-3 w-40 sm:w-56" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
        <Skeleton className="h-8 w-full sm:w-16" />
        <Skeleton className="h-8 w-full sm:w-16" />
        <Skeleton className="h-8 w-full sm:w-16" />
        <Skeleton className="h-8 w-full sm:w-16" />
      </div>
    </div>
  );
}

// Campaign detail header skeleton
function CampaignHeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-9 h-9 rounded-md" />
        <div className="flex-1">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-lg mt-6" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Form input skeleton
function FormSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

// Chart skeleton
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between h-full gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{
              height: `${Math.random() * 60 + 20}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Card grid skeleton
function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Dashboard KPI skeleton
function DashboardKpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-4"
        >
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

// Chart panel skeleton
function ChartPanelSkeleton() {
  return (
    <div className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

// Table row skeleton (compact)
function TableRowSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 border-b border-white/[0.08]">
      <Skeleton className="h-4 w-40 sm:w-56" />
      <Skeleton className="h-4 w-28 sm:w-24" />
      <Skeleton className="h-4 w-24 sm:w-20" />
      <div className="sm:ml-auto">
        <Skeleton className="h-4 w-24 sm:w-16" />
      </div>
    </div>
  );
}

// Creator card skeleton
function CreatorCardSkeleton() {
  return (
    <div className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-8" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

// Request row skeleton
function RequestRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 border border-white/[0.08] rounded-lg p-4 bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <div className="ml-auto">
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4 sm:w-2/3" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20 sm:w-24" />
        <Skeleton className="h-3 w-20 sm:w-24" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  CampaignCardSkeleton,
  PostRowSkeleton,
  CampaignHeaderSkeleton,
  FormSkeleton,
  DashboardKpiSkeleton,
  ChartPanelSkeleton,
  ChartSkeleton,
  CardGridSkeleton,
  TableRowSkeleton,
  CreatorCardSkeleton,
  RequestRowSkeleton,
};

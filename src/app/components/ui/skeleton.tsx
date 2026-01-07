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
    <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.08]">
      {/* Avatar */}
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />

      {/* Creator info */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Stats */}
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
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

export { Skeleton, CampaignCardSkeleton, PostRowSkeleton, CampaignHeaderSkeleton, FormSkeleton };

import { Skeleton } from "./ui/skeleton";

export default function GenericSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <Skeleton className="h-8 sm:h-10 w-48 sm:w-64 mb-2" />
          <Skeleton className="h-4 sm:h-5 w-full sm:w-96 max-w-full" />
        </div>

        {/* Generic content skeleton */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-5 sm:h-6 w-11/12 sm:w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12 sm:w-5/6" />
            <Skeleton className="h-4 w-3/4 sm:w-2/3" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-5 sm:h-6 w-3/4 sm:w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12 sm:w-4/5" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-5 sm:h-6 w-10/12 sm:w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12 sm:w-3/4" />
            <Skeleton className="h-4 w-full sm:w-5/6" />
          </div>
        </div>
      </div>
    </div>
  );
}

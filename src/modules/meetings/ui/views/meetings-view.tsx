"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DataTable } from "../components/data-table";
import { columns } from "../components/columns";
import { EmptyState } from "@/components/empty-state";
import { useRouter } from "next/navigation";
import { useMeetingsFilters } from "../../hooks/use-meeting-filters";
import { DataPagination } from "@/components/data-pagination";

export const MeetingsView = () => {
  const router = useRouter()
  const [filters,setFilters] = useMeetingsFilters()
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.getMany.queryOptions({
    ...filters,
  }));

  return  (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
    <DataTable data={data.items} columns={columns} onRowClick={(row) => router.push(`/meetings/${row.id}`)} />
    <DataPagination
      page={filters.page}
      totalPages={data.totalPages}
      onPageChange={(page) => setFilters({page})}
    />
    {data.items.length === 0 && (
            <EmptyState
              title="Create your first meeting"
              description="Schedule a meeting to connect with others. Each meeting lets you 
              collaborate, share ideas, ad interact with participants in real time."
            />
          )}
        
    </div>
  )
};

export const MeetingViewLoading = () => {
  return (
    <LoadingState
      title="Loading Agents"
      description="This may take a few seconds"
    />
  );
};

export const MeetingErrorLoading = () => {
  return (
    <ErrorState
      title="Error Loading Agents"
      description="Try after few seconds"
    />
  );
};

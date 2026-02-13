"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export const MeetingsView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.getMany.queryOptions({}));

  return <div className="">{JSON.stringify(data)}</div>;
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

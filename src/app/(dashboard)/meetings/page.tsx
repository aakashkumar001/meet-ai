import { auth } from "@/lib/auth";
import { MeetingListHeader } from "@/modules/meetings/ui/components/meetings-list-headers";
import { MeetingErrorLoading, MeetingsView, MeetingViewLoading } from "@/modules/meetings/ui/views/meetings-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { SearchParams } from "nuqs/server";
import { loadSearchParams } from "@/modules/meetings/params";

interface Props {
  searchParams: Promise<SearchParams>;
}

const Page = async ({searchParams}:Props) => {
  const filters = await loadSearchParams(searchParams);
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.meetings.getMany.queryOptions({
    ...filters,
  }));

  const session = await auth.api.getSession({
         headers: await headers(),
       })
     
       if(!session){
         redirect("/sign-in")
       }
  

  return (
    <>
    <MeetingListHeader/>
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<MeetingViewLoading/>}>
        <ErrorBoundary fallback={<MeetingErrorLoading/>}>
          <MeetingsView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
    </>
  );
};

export default Page;

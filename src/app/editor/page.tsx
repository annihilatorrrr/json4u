"use client";

import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import MainPanel from "@/containers/editor/MainPanel";
import { loadEditor } from "@/containers/editor/editor/loader";
import SideNav from "@/containers/editor/sidenav";
import { PricingOverlay } from "@/containers/pricing";
import { init as dbInit } from "@/lib/db/config";
import { type MyWorker } from "@/lib/worker/worker";
import { useEditorStore } from "@/stores/editorStore";
import { useStatusStore } from "@/stores/statusStore";
import { useUserStore } from "@/stores/userStore";
import { ErrorBoundary } from "@sentry/react";
import { wrap } from "comlink";
import { useShallow } from "zustand/react/shallow";

export default function Page() {
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={0}>
        <Main />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

function Main() {
  const inited = useInit();

  return inited ? (
    <div className="flex h-full w-full">
      <SideNav />
      <Separator orientation="vertical" />
      <MainPanel />
      <PricingOverlay />
    </div>
  ) : (
    <Loading />
  );
}

// FIX: If the user enter /editor repeatedly, it will cause multiple executions
function useInit() {
  const [hydrated, setHydrated] = useState(false);
  const setWorker = useEditorStore((state) => state.setWorker);
  const { user, updateActiveOrder } = useUserStore(
    useShallow((state) => ({
      user: state.user,
      updateActiveOrder: state.updateActiveOrder,
    })),
  );

  useEffect(() => {
    (async () => {
      dbInit();

      await Promise.all([
        Promise.resolve(useStatusStore.persist.rehydrate()),
        loadEditor(),
        () => {
          updateActiveOrder(user);

          if (!window.worker) {
            window.worker = new Worker(new URL("@/lib/worker/worker.ts", import.meta.url));
            window.addEventListener("beforeunload", () => {
              console.log("worker is terminated.");
              window.worker?.terminate();
            });
            console.log("Finished worker initial.");
          }
        },
      ]);

      window.worker && setWorker(wrap<MyWorker>(window.worker));
      setHydrated(true);
    })();
  }, []);

  return hydrated;
}

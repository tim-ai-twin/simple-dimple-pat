import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import DetailPanel from "../components/layout/DetailPanel";
import AddApiForm from "../components/api/AddApiForm";
import ApiDetailView from "../components/api/ApiDetailView";
import ReuploadSpecForm from "../components/api/ReuploadSpecForm";
import CreateTokenForm from "../components/token/CreateTokenForm";
import TokenDetailView from "../components/token/TokenDetailView";

type ViewState =
  | { type: "welcome" }
  | { type: "add-api" }
  | { type: "api-detail"; apiId: string }
  | { type: "token-detail"; tokenId: string }
  | { type: "create-token"; apiId: string }
  | { type: "reupload-spec"; apiId: string; apiName: string };

export default function DashboardPage() {
  const [view, setView] = useState<ViewState>({ type: "welcome" });
  const queryClient = useQueryClient();

  // Reset view when user identity changes (e.g. Google → demo switch)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setView({ type: "welcome" });
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSelect = (type: string, id: string) => {
    if (type === "api") setView({ type: "api-detail", apiId: id });
    else if (type === "token") setView({ type: "token-detail", tokenId: id });
  };

  const renderDetail = () => {
    switch (view.type) {
      case "add-api":
        return (
          <AddApiForm
            onSuccess={(apiId) => {
              queryClient.invalidateQueries({ queryKey: ["api-registrations"] });
              setView({ type: "api-detail", apiId });
            }}
            onCancel={() => setView({ type: "welcome" })}
          />
        );
      case "api-detail":
        return (
          <ApiDetailView
            apiId={view.apiId}
            onDeleted={() => setView({ type: "welcome" })}
            onCreateToken={() =>
              setView({ type: "create-token", apiId: view.apiId })
            }
            onReupload={() =>
              setView({
                type: "reupload-spec",
                apiId: view.apiId,
                apiName: "API",
              })
            }
          />
        );
      case "reupload-spec":
        return (
          <ReuploadSpecForm
            apiId={view.apiId}
            apiName={view.apiName}
            onDone={() => setView({ type: "api-detail", apiId: view.apiId })}
          />
        );
      case "create-token":
        return (
          <CreateTokenForm
            apiId={view.apiId}
            onDone={() => setView({ type: "api-detail", apiId: view.apiId })}
          />
        );
      case "token-detail":
        return (
          <TokenDetailView
            tokenId={view.tokenId}
            onDeleted={() => setView({ type: "welcome" })}
          />
        );
      case "welcome":
      default:
        return (
          <div className="flex h-full flex-col items-center justify-center">
            <h2 className="mb-2 font-heading text-2xl font-bold text-primary">
              Welcome to Simple Dimple PAT
            </h2>
            <p className="mb-6 max-w-md text-center text-text-light">
              Register your first API to start creating scoped access tokens
              for your AI agents.
            </p>
            <button
              onClick={() => setView({ type: "add-api" })}
              className="rounded-pill bg-primary px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light"
            >
              + Add Your First API
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onSelect={handleSelect}
          onAddApi={() => setView({ type: "add-api" })}
          selectedId={
            view.type === "api-detail"
              ? view.apiId
              : view.type === "token-detail"
                ? view.tokenId
                : null
          }
        />
        <DetailPanel>{renderDetail()}</DetailPanel>
      </div>
    </div>
  );
}

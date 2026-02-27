import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import DetailPanel from "../components/layout/DetailPanel";
import AddApiForm from "../components/api/AddApiForm";
import ApiDetailView from "../components/api/ApiDetailView";

type ViewState =
  | { type: "welcome" }
  | { type: "add-api" }
  | { type: "api-detail"; apiId: string }
  | { type: "token-detail"; tokenId: string }
  | { type: "create-token"; apiId: string };

export default function DashboardPage() {
  const [view, setView] = useState<ViewState>({ type: "welcome" });
  const queryClient = useQueryClient();

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
          />
        );
      case "token-detail":
        return (
          <p className="text-text-light">Token detail for {view.tokenId}</p>
        );
      case "create-token":
        return (
          <p className="text-text-light">
            Create token for API {view.apiId}
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen flex-col">
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

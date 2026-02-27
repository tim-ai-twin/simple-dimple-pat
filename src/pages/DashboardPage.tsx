import { useState } from "react";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import DetailPanel from "../components/layout/DetailPanel";

type ViewState =
  | { type: "welcome" }
  | { type: "add-api" }
  | { type: "api-detail"; apiId: string }
  | { type: "token-detail"; tokenId: string }
  | { type: "create-token"; apiId: string };

export default function DashboardPage() {
  const [view, setView] = useState<ViewState>({ type: "welcome" });

  const handleSelect = (type: string, id: string) => {
    if (type === "api") setView({ type: "api-detail", apiId: id });
    else if (type === "token") setView({ type: "token-detail", tokenId: id });
  };

  const renderDetail = () => {
    switch (view.type) {
      case "add-api":
        return <p className="text-text-light">Add API form coming soon...</p>;
      case "api-detail":
        return <p className="text-text-light">API detail for {view.apiId}</p>;
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

import React from "react";
import { useParams } from "react-router-dom";
import { useActivation } from "../../../hooks/useActivations";
import { ActivationDetailContest } from "./activation-detail-contest";
import { ActivationDetailSMPanel } from "./activation-detail-sm-panel";
import { ActivationDetailCreatorRequest } from "./activation-detail-creator-request";

interface ActivationDetailProps {
  onNavigate: (path: string) => void;
}

export function ActivationDetail({ onNavigate }: ActivationDetailProps) {
  const { id } = useParams<{ id: string }>();
  const { data: activation, isLoading, error } = useActivation(id ?? null);

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Invalid activation ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-white/[0.04] rounded animate-pulse mb-4" />
        <div className="h-64 bg-white/[0.04] rounded animate-pulse" />
      </div>
    );
  }

  if (error || !activation) {
    return (
      <div className="p-6">
        <p className="text-red-400">
          {error?.message ?? "Activation not found"}
        </p>
        <button
          onClick={() => onNavigate("/activations")}
          className="mt-4 text-primary hover:underline"
        >
          Back to Activations
        </button>
      </div>
    );
  }

  if (activation.type === "contest") {
    return (
      <ActivationDetailContest
        activation={activation}
        onNavigate={onNavigate}
      />
    );
  }

  if (activation.type === "sm_panel") {
    return (
      <ActivationDetailSMPanel
        activation={activation}
        onNavigate={onNavigate}
      />
    );
  }

  if (activation.type === "creator_request") {
    return (
      <ActivationDetailCreatorRequest
        activation={activation}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="p-6">
      <p className="text-slate-400">Unknown activation type</p>
    </div>
  );
}

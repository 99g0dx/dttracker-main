import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Crown } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  title: string;
  message: string;
  ctaLabel?: string;
  onClose: () => void;
  onUpgrade: () => void;
}

export function UpgradeModal({
  open,
  title,
  message,
  ctaLabel = "Upgrade",
  onClose,
  onUpgrade,
}: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="bg-[#0D0D0D] border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            className="border-white/[0.1] text-black"
            onClick={onClose}
          >
            Not now
          </Button>
          <Button onClick={onUpgrade} className="bg-primary text-black">
            <Crown className="w-4 h-4 mr-2" />
            {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

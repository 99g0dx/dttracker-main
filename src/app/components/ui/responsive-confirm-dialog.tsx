import React from "react";
import { X } from "lucide-react";
import { useIsMobile } from "./use-mobile";
import { cn } from "./utils";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./drawer";

interface ResponsiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  className?: string;
}

export function ResponsiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  onConfirm,
  className,
}: ResponsiveConfirmDialogProps) {
  const isMobile = useIsMobile();
  const [isCoarsePointer, setIsCoarsePointer] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    const handleChange = () => setIsCoarsePointer(mql.matches);
    handleChange();
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const handleClose = () => onOpenChange(false);
  const handleConfirm = () => {
    if (confirmDisabled) return;
    onConfirm();
  };

  const content = (
    <>
      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={handleClose}
          className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        <div className="text-base font-semibold text-white">{title}</div>
        {description && (
          <div className="text-sm text-slate-400 line-clamp-3">
            {description}
          </div>
        )}
      </div>
      <div
        className={cn(
          "mt-4 flex gap-2",
          isMobile ? "flex-col" : "flex-row justify-end"
        )}
      >
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={confirmDisabled}
          className={cn("min-h-[44px] w-full", !isMobile && "w-auto")}
        >
          {confirmLabel}
        </Button>
        <Button
          variant="outline"
          onClick={handleClose}
          className={cn(
            "min-h-[44px] w-full border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
            !isMobile && "w-auto"
          )}
        >
          {cancelLabel}
        </Button>
      </div>
    </>
  );

  if (isMobile && isCoarsePointer) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "bg-[#0D0D0D] border-white/[0.08] rounded-t-2xl max-h-[60vh] overflow-y-auto",
            className
          )}
        >
          <DrawerHeader className="relative p-4">
            <DrawerTitle className="sr-only">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">Confirm action</DrawerDescription>
            {content}
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "relative w-[92vw] max-w-md max-h-[80vh] overflow-y-auto bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-4 sm:p-6 !top-1/2 !left-1/2 !bottom-auto !right-auto !translate-x-1/2 !translate-y-1/2",
          className
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Confirm action</DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter className="sr-only" />
      </DialogContent>
    </Dialog>
  );
}

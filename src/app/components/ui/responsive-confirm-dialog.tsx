import React from "react";
import { useIsMobile } from "./use-mobile";
import { cn } from "./utils";
import { Button } from "./button";
import { Loader2 } from "lucide-react";
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
  confirmLoading?: boolean;
  confirmVariant?: "destructive" | "default";
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
  confirmLoading = false,
  confirmVariant = "destructive",
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
    if (confirmDisabled || confirmLoading) return;
    onConfirm();
  };

  const content = (
    <>
      <div className="space-y-2">
        <div className="text-base font-semibold text-white">{title}</div>
        {description && (
          <div
            className={cn(
              "text-sm text-slate-400",
              typeof description === "string" && "line-clamp-3"
            )}
          >
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
          variant={confirmVariant}
          onClick={handleConfirm}
          disabled={confirmDisabled || confirmLoading}
          className={cn(
            "min-h-[44px] w-full flex items-center justify-center gap-2",
            !isMobile && "w-auto",
            confirmVariant === "default" && "bg-white text-black hover:bg-white/90"
          )}
        >
          {confirmLoading && <Loader2 className="w-4 h-4 animate-spin" />}
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
          "w-[92vw] max-w-[345px] sm:max-w-[345px] left-[50%] -translate-x-1/2 bg-[#0D0D0D] border-white/[0.08] p-4",
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

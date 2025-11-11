import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export default function Modal({ isOpen, onClose, children, title }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements?.[0] as HTMLElement;
      firstElement?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "unset";
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
        data-testid="modal-backdrop"
      />
      <div
        ref={modalRef}
        className="relative bg-background rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        data-testid="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b p-6 flex items-center justify-between">
          {title && (
            <h2 id="modal-title" className="text-2xl font-serif font-semibold" data-testid="text-modal-title">
              {title}
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-modal-close"
            aria-label="Close modal"
            className="ml-auto"
          >
            <X size={20} />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

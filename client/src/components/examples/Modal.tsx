import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function ModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)} data-testid="button-open-modal">
        Open Modal
      </Button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Example Modal">
        <div className="space-y-4">
          <p>This is an example modal with keyboard trap and focus management.</p>
          <p className="text-muted-foreground">Press ESC to close, or click the X button.</p>
        </div>
      </Modal>
    </div>
  );
}

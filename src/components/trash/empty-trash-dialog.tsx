'use client';

// ============================================================
// MODUL 17.4: Empty Trash Dialog — Two-step confirmation modal
// Step 1: Checkbox — "I understand this is permanent and cannot be undone"
// Step 2: Text input — user must type "I understand this is permanent"
// Only when BOTH conditions met → enable "Empty Trash" button
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useTrashPurge } from '@/hooks/use-trash';

interface EmptyTrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
}

const CONFIRM_TEXT = 'I understand this is permanent';
const CHECKBOX_LABEL = 'I understand this is permanent and cannot be undone';

export function EmptyTrashDialog({ open, onOpenChange, itemCount }: EmptyTrashDialogProps) {
  const [step, setStep] = useState(1);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const purgeMutation = useTrashPurge();

  // Reset state when dialog closes (handled via onOpenChange wrapper)
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state on close
      setStep(1);
      setCheckboxChecked(false);
      setConfirmInput('');
    }
    onOpenChange(isOpen);
  };

  // Both conditions must be met to enable the button
  const isConfirmEnabled = checkboxChecked && confirmInput === CONFIRM_TEXT;

  const handleNext = () => {
    if (checkboxChecked) {
      setStep(2);
    }
  };

  const handleEmptyTrash = () => {
    if (!isConfirmEnabled) return;
    purgeMutation.mutate(undefined, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Empty Trash
          </DialogTitle>
          <DialogDescription>
            This will permanently delete {itemCount} items from your trash. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Step indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive font-medium">
                  1
                </span>
                <span>Step 1: Confirm understanding</span>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <Checkbox
                  id="confirm-checkbox"
                  checked={checkboxChecked}
                  onCheckedChange={(checked) => setCheckboxChecked(checked === true)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="confirm-checkbox"
                  className="text-sm leading-snug cursor-pointer"
                >
                  {CHECKBOX_LABEL}
                </label>
              </div>

              <Separator />

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleNext}
                  disabled={!checkboxChecked}
                >
                  Continue
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Step indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground font-medium">
                  1
                </span>
                <Separator className="flex-1" />
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive font-medium">
                  2
                </span>
                <span>Step 2: Type confirmation</span>
              </div>

              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-sm mb-3">
                  Type <strong className="text-destructive">"{CONFIRM_TEXT}"</strong> to confirm:
                </p>
                <Input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={CONFIRM_TEXT}
                  className="text-sm"
                  autoFocus
                />
                {confirmInput.length > 0 && confirmInput !== CONFIRM_TEXT && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Text does not match. Please type exactly: "{CONFIRM_TEXT}"
                  </p>
                )}
              </div>

              <Separator />

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleEmptyTrash}
                  disabled={!isConfirmEnabled || purgeMutation.isPending}
                >
                  {purgeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Emptying...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Empty Trash
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

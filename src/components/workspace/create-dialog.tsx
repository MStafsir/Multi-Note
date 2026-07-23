'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderPlus, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCreateFolder } from '@/hooks/use-file-tree';

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'folder' | 'note';
}

export function CreateDialog({ open, onOpenChange, type }: CreateDialogProps) {
  const [name, setName] = useState('');
  const createMutation = useCreateFolder();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate(
      { name: name.trim(), type },
      {
        onSuccess: () => {
          setName('');
          onOpenChange(false);
        },
      }
    );
  };

  // Reset name when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'folder' ? (
              <FolderPlus className="h-5 w-5 text-orange-500" />
            ) : (
              <FileText className="h-5 w-5 text-emerald-600" />
            )}
            Create {type === 'folder' ? 'Folder' : 'Note'}
          </DialogTitle>
          <DialogDescription>
            Enter a name for the new {type === 'folder' ? 'folder' : 'note'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">
                {type === 'folder' ? 'Folder' : 'Note'} name
              </Label>
              <Input
                id="create-name"
                placeholder={type === 'folder' ? 'My Folder' : 'My Note'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={createMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

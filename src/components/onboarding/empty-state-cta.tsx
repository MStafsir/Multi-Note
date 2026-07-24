'use client';

// ============================================================
// MODUL 39.2: Empty State CTAs
// When workspace is empty (no files, folders, or notes),
// show contextual CTAs to guide the user
// ============================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  LayoutGrid,
  Sparkles,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFileTreeStore } from '@/store/file-tree';

interface EmptyStateCTAProps {
  onUploadFile?: () => void;
  onCreateNote?: () => void;
  onOpenTemplateGallery?: () => void;
  parentId?: string | null;
}

export function EmptyStateCTA({
  onUploadFile,
  onCreateNote,
  onOpenTemplateGallery,
  parentId,
}: EmptyStateCTAProps) {
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  // Seed sample content mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      setSeeding(true);
      const res = await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedSampleContent: true }),
      });
      const data = await res.json();
      setSeeding(false);
      return data;
    },
    onSuccess: () => {
      // Invalidate file tree so the seeded content appears
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      // Also invalidate onboarding state
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      // Navigate to root to show the seeded folder
      useFileTreeStore.getState().setCurrentFolder(null, [{ id: null, name: 'My Workspace' }]);
    },
    onError: () => {
      setSeeding(false);
    },
  });

  const handleSeedContent = useCallback(() => {
    seedMutation.mutate();
  }, [seedMutation]);

  const CTAS = [
    {
      key: 'upload',
      label: 'Upload your first file',
      description: 'Drag & drop or browse to add files',
      icon: Upload,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      action: onUploadFile,
    },
    {
      key: 'note',
      label: 'Create your first note',
      description: 'Start writing with rich text editing',
      icon: FileText,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      action: onCreateNote,
    },
    {
      key: 'template',
      label: 'Browse template gallery',
      description: 'Pick a template to get started fast',
      icon: LayoutGrid,
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      action: onOpenTemplateGallery,
    },
    {
      key: 'sample',
      label: 'Explore sample content',
      description: 'Load a demo folder with tips to explore',
      icon: Sparkles,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-950/20',
      action: handleSeedContent,
      isLoading: seeding,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4 }}
      className="py-12 px-4"
    >
      {/* Friendly header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted mb-4">
          <FolderOpen className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-1">Your workspace is empty</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Get started by uploading files, creating notes, or exploring sample content.
        </p>
      </div>

      {/* CTA grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
        {CTAS.map((cta) => (
          <motion.div
            key={cta.key}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + CTAS.indexOf(cta) * 0.05 }}
          >
            <Card
              className="cursor-pointer hover:border-accent hover:shadow-md transition-all group"
              onClick={cta.isLoading ? undefined : cta.action}
              role="button"
              aria-label={cta.label}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${cta.bg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  {cta.isLoading ? (
                    <Loader2 className={`h-6 w-6 ${cta.color} animate-spin`} />
                  ) : (
                    <cta.icon className={`h-6 w-6 ${cta.color}`} />
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium block">{cta.label}</span>
                  <span className="text-xs text-muted-foreground">{cta.description}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

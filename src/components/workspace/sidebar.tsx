'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FolderPlus, FileText, Star, HardDrive, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useFileTreeStore } from '@/store/file-tree';
import { useAuthStore } from '@/store/auth';
import { FileTreeView } from '@/components/file-tree/file-tree-view';
import { CreateDialog } from './create-dialog';
import { useStorageQuota } from '@/hooks/use-file-tree';

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'note'>('folder');
  const { currentFolderPath, setCurrentFolder } = useFileTreeStore();
  const { user } = useAuthStore();
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);

  // Fetch storage quota
  const { data: quota } = useStorageQuota();

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (collapsed) {
    return (
      <div className="flex flex-col h-full items-center py-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => {
            setCreateType('folder');
            setCreateDialogOpen(true);
          }}
          aria-label="New folder"
        >
          <FolderPlus className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => {
            setCreateType('note');
            setCreateDialogOpen(true);
          }}
          aria-label="New note"
        >
          <FileText className="h-5 w-5" />
        </Button>
        <Separator />
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          aria-label="Favorites"
        >
          <Star className="h-5 w-5" />
        </Button>
        <Separator />
        <div className="flex-1" />
        <div className="px-2">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Quick Actions */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium">
            {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              setCreateType('folder');
              setCreateDialogOpen(true);
            }}
          >
            <FolderPlus className="h-4 w-4 mr-1" />
            Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              setCreateType('note');
              setCreateDialogOpen(true);
            }}
          >
            <FileText className="h-4 w-4 mr-1" />
            Note
          </Button>
        </div>
      </div>

      <Separator />

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <FileTreeView />
        </div>
      </ScrollArea>

      <Separator />

      {/* Favorites (Modul 21 prep) */}
      <div className="px-3 py-1">
        <button
          onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          className="flex items-center w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {favoritesExpanded ? (
            <ChevronDown className="h-4 w-4 mr-1" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-1" />
          )}
          <Star className="h-4 w-4 mr-1" />
          Favorites
        </button>
        {favoritesExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="py-1 text-xs text-muted-foreground text-center"
          >
            No favorites yet
          </motion.div>
        )}
      </div>

      <Separator />

      {/* Storage Quota */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Storage</span>
        </div>
        {quota ? (
          <>
            <Progress
              value={quota.percentage}
              className="h-2 mb-1"
            />
            <p className="text-xs text-muted-foreground">
              {formatBytes(quota.usedBytes)} of {formatBytes(quota.limitBytes)} used
            </p>
          </>
        ) : (
          <>
            <Progress value={0} className="h-2 mb-1" />
            <p className="text-xs text-muted-foreground">Loading...</p>
          </>
        )}
      </div>

      {/* Create Dialog */}
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        type={createType}
      />
    </div>
  );
}

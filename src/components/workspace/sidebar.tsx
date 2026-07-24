'use client';

// ============================================================
// MODUL 23.5: Sidebar — 44px touch target audit
// All buttons have min-h-[44px] min-w-[44px] touch targets
// Spacing between targets is minimum 8px (gap-2)
// ============================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderPlus, FileText, File, Star, HardDrive, ChevronDown, ChevronRight, Trash2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFileTreeStore } from '@/store/file-tree';
import { useAuthStore } from '@/store/auth';
import { FileTreeView } from '@/components/file-tree/file-tree-view';
import { CreateDialog } from './create-dialog';
import { useStorageQuota } from '@/hooks/use-file-tree';
import { useFavorites } from '@/hooks/use-tags';
import { ActivityTimeline } from '@/components/activity/activity-timeline';

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'note'>('folder');
  const { currentFolderPath, setCurrentFolder, activeView, setActiveView, currentFolderId } = useFileTreeStore();
  const { user } = useAuthStore();
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  // Fetch storage quota
  const { data: quota } = useStorageQuota();
  // 21 — Fetch favorite nodes
  const { data: favorites } = useFavorites();

  // 21 — Handle favorite item click: navigate to item
  const handleFavoriteClick = (fav: { id: string; type: string; parentId: string | null; name: string }) => {
    setActiveView('workspace');
    if (fav.type === 'folder') {
      setCurrentFolder(fav.id, []);
    } else if (fav.parentId) {
      setCurrentFolder(fav.parentId, []);
    }
  };

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
              onClick={() => {
                setCreateType('folder');
                setCreateDialogOpen(true);
              }}
              aria-label="New folder"
            >
              <FolderPlus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>New Folder (F)</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
              onClick={() => {
                setCreateType('note');
                setCreateDialogOpen(true);
              }}
              aria-label="New note"
            >
              <FileText className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>New Note (N)</p>
          </TooltipContent>
        </Tooltip>
        <Separator />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
              aria-label="Favorites"
            >
              <Star className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Favorites</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeView === 'trash' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
              onClick={() => setActiveView('trash')}
              aria-label="Trash"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Trash</p>
          </TooltipContent>
        </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-h-[44px]"
                onClick={() => {
                  setCreateType('folder');
                  setCreateDialogOpen(true);
                }}
              >
                <FolderPlus className="h-4 w-4 mr-1" />
                Folder
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>New Folder (F)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-h-[44px]"
                onClick={() => {
                  setCreateType('note');
                  setCreateDialogOpen(true);
                }}
              >
                <FileText className="h-4 w-4 mr-1" />
                Note
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>New Note (N)</p>
            </TooltipContent>
          </Tooltip>
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

      {/* Favorites (Modul 21) */}
      <div className="px-3 py-1">
        <button
          onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          className="flex items-center w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 min-h-[44px]"
        >
          {favoritesExpanded ? (
            <ChevronDown className="h-4 w-4 mr-1" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-1" />
          )}
          <Star className="h-4 w-4 mr-1" />
          Favorites
          {favorites && favorites.length > 0 && (
            <span className="ml-auto text-xs tabular-nums">{favorites.length}</span>
          )}
        </button>
        <AnimatePresence>
          {favoritesExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ScrollArea className="max-h-48">
                {favorites && favorites.length > 0 ? (
                  <div className="space-y-1 py-1">
                    {favorites.map((fav) => (
                      <button
                        key={fav.id}
                        className="flex items-center gap-2 w-full px-2 py-2 min-h-[44px] text-xs rounded-sm hover:bg-accent/50 transition-colors"
                        onClick={() => handleFavoriteClick(fav)}
                      >
                        <Star className="h-3 w-3 shrink-0" />
                        {fav.type === 'folder' ? (
                          <FolderPlus className="h-3 w-3 text-orange-500 shrink-0" />
                        ) : fav.type === 'note' ? (
                          <FileText className="h-3 w-3 text-emerald-600 shrink-0" />
                        ) : (
                          <File className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate flex-1 text-left">{fav.name}</span>
                        <span className="text-muted-foreground capitalize shrink-0">{fav.type}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="py-2 text-xs text-muted-foreground text-center">No favorites yet</p>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator />

      {/* Activity (Modul 19) */}
      <div className="px-3 py-1">
        <button
          onClick={() => setActivityExpanded(!activityExpanded)}
          className="flex items-center w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 min-h-[44px]"
        >
          {activityExpanded ? (
            <ChevronDown className="h-4 w-4 mr-1" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-1" />
          )}
          <Activity className="h-4 w-4 mr-1" />
          Activity
        </button>
        {activityExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ActivityTimeline nodeId={currentFolderId} className="px-2 pt-2" />
          </motion.div>
        )}
      </div>

      <Separator />

      {/* Trash (Modul 17) */}
      <button
        onClick={() => setActiveView('trash')}
        className={`flex items-center w-full px-3 py-2 min-h-[44px] text-sm font-medium transition-colors rounded-sm
          ${activeView === 'trash'
            ? 'text-foreground bg-accent'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Trash
      </button>

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

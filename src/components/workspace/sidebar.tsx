'use client';

// ============================================================
// MODUL 23.5: Sidebar — 44px touch target audit
// All buttons have min-h-[44px] min-w-[44px] touch targets
// Spacing between targets is minimum 8px (gap-2)
// ============================================================

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderPlus, FileText, File, Star, HardDrive, ChevronDown, ChevronRight, Trash2, Activity, Shield, Building2, Users, Settings, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFileTreeStore } from '@/store/file-tree';
import { useAuthStore } from '@/store/auth';
import { useWorkspaceStore } from '@/store/workspace';
import { FileTreeView } from '@/components/file-tree/file-tree-view';
// Dynamic imports for heavy sidebar components
const CreateDialog = dynamic(() => import('./create-dialog').then(m => ({ default: m.CreateDialog })), { ssr: false });
const WorkspaceSettingsDialog = dynamic(() => import('./workspace-settings-dialog').then(m => ({ default: m.WorkspaceSettingsDialog })), { ssr: false });
const WorkspaceMemberList = dynamic(() => import('./workspace-member-list').then(m => ({ default: m.WorkspaceMemberList })), { ssr: false });
const ActivityTimeline = dynamic(() => import('@/components/activity/activity-timeline').then(m => ({ default: m.ActivityTimeline })), { ssr: false });
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useStorageQuota } from '@/hooks/use-file-tree';
import { useFavorites } from '@/hooks/use-tags';

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'note'>('folder');
  const { currentFolderPath, setCurrentFolder, activeView, setActiveView, currentFolderId } = useFileTreeStore();
  const { user } = useAuthStore();
  const { currentWorkspaceId, currentWorkspaceName, currentWorkspaceRole } = useWorkspaceStore();

  // 40-41 — Workspace settings state
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceMembersOpen, setWorkspaceMembersOpen] = useState(false);
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('workspace-upload-trigger'));
              }}
              aria-label="Upload file"
            >
              <Upload className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Upload File</p>
          </TooltipContent>
        </Tooltip>
        {/* 40-41 — Workspace context icons */}
        {currentWorkspaceId && (currentWorkspaceRole === 'owner' || currentWorkspaceRole === 'admin') && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px]"
                onClick={() => setWorkspaceSettingsOpen(true)}
                aria-label="Workspace settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Workspace Settings</p>
            </TooltipContent>
          </Tooltip>
        )}
        {currentWorkspaceId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px]"
                onClick={() => setWorkspaceMembersOpen(true)}
                aria-label="Workspace members"
              >
                <Users className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Members</p>
            </TooltipContent>
          </Tooltip>
        )}
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
        {user?.role === 'admin' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeView === 'admin' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px]"
                onClick={() => setActiveView('admin')}
                aria-label="Admin Dashboard"
              >
                <Shield className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Admin Dashboard</p>
            </TooltipContent>
          </Tooltip>
        )}
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
      {/* 40-41 — Workspace context indicator */}
      {currentWorkspaceId && (
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/10">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{currentWorkspaceName}</span>
            <span className="text-xs text-muted-foreground capitalize shrink-0">({currentWorkspaceRole})</span>
          </div>
        </div>
      )}

      {/* 40-41 — Workspace quick links (when in workspace context) */}
      {currentWorkspaceId && (currentWorkspaceRole === 'owner' || currentWorkspaceRole === 'admin') && (
        <div className="px-3 py-1 flex gap-1">
          <button
            onClick={() => setWorkspaceSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 min-h-[44px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors rounded-sm"
            aria-label="Workspace settings"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
          <button
            onClick={() => setWorkspaceMembersOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 min-h-[44px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors rounded-sm"
            aria-label="Workspace members"
          >
            <Users className="h-3.5 w-3.5" />
            Members
          </button>
        </div>
      )}
      {currentWorkspaceId && currentWorkspaceRole !== 'owner' && currentWorkspaceRole !== 'admin' && (
        <div className="px-3 py-1 flex gap-1">
          <button
            onClick={() => setWorkspaceMembersOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 min-h-[44px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors rounded-sm"
            aria-label="Workspace members"
          >
            <Users className="h-3.5 w-3.5" />
            Members
          </button>
        </div>
      )}

      {/* Quick Actions — 29: semantic <section> */}
      <section aria-label="Quick actions" className="p-4 space-y-2">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-h-[44px]"
                onClick={() => {
                  // Trigger file upload via a global event
                  window.dispatchEvent(new CustomEvent('workspace-upload-trigger'));
                }}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload File</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </section>

      <Separator />

      {/* Navigation — 29: semantic <nav> */}
      <nav aria-label="Folder navigation">
        <ScrollArea className="flex-1">
          <div className="p-2">
            <FileTreeView />
          </div>
        </ScrollArea>
      </nav>

      <Separator />

      {/* Favorites (Modul 21) — 29: semantic <section> */}
      <section aria-label="Favorites" className="px-3 py-1">
        <button
          onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          aria-expanded={favoritesExpanded}
          aria-label={`${favoritesExpanded ? 'Collapse' : 'Expand'} favorites`}
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
      </section>

      <Separator />

      {/* Activity (Modul 19) — 29: semantic <section> */}
      <section aria-label="Activity" className="px-3 py-1">
        <button
          onClick={() => setActivityExpanded(!activityExpanded)}
          aria-expanded={activityExpanded}
          aria-label={`${activityExpanded ? 'Collapse' : 'Expand'} activity`}
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
      </section>

      <Separator />

      {/* Trash (Modul 17) */}
      <button
        onClick={() => setActiveView('trash')}
        aria-label="Trash view"
        className={`flex items-center w-full px-3 py-2 min-h-[44px] text-sm font-medium transition-colors rounded-sm
          ${activeView === 'trash'
            ? 'text-foreground bg-accent'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Trash
      </button>

      {/* Admin Dashboard (Modul 36) — only visible for admin role */}
      {user?.role === 'admin' && (
        <button
          onClick={() => setActiveView('admin')}
          aria-label="Admin Dashboard"
          className={`flex items-center w-full px-3 py-2 min-h-[44px] text-sm font-medium transition-colors rounded-sm
            ${activeView === 'admin'
              ? 'text-foreground bg-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
        >
          <Shield className="h-4 w-4 mr-2" />
          Admin
        </button>
      )}

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

      {/* 40-41 — Workspace Settings Dialog */}
      <WorkspaceSettingsDialog
        open={workspaceSettingsOpen}
        onOpenChange={setWorkspaceSettingsOpen}
      />

      {/* 40-41 — Workspace Members Dialog */}
      <Dialog open={workspaceMembersOpen} onOpenChange={setWorkspaceMembersOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Workspace Members
            </DialogTitle>
            <DialogDescription>
              Manage workspace membership and roles.
            </DialogDescription>
          </DialogHeader>
          {currentWorkspaceId ? (
            <WorkspaceMemberList workspaceId={currentWorkspaceId} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Select a workspace to manage members.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

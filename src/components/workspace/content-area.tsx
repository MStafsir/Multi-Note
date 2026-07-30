'use client';

import { Fragment, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  File,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Film,
  Music,
  Code,
  Archive,
  FileQuestion,
  ChevronRight,
  ChevronDown,
  Grid3X3,
  List,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Share2,
  History,
  Star,
  Download,
  Upload,
  Plus,
  FolderPlus,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { TreeNode, NodeType } from '@/types';
import { useFileTreeStore } from '@/store/file-tree';
import { useWorkspaceStore } from '@/store/workspace';
import { Button } from '@/components/ui/button';

import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenameDialog } from './rename-dialog';
import { ErrorBoundary } from '@/components/error/error-boundary';
import { NoteEditorError } from '@/components/error/note-editor-error';
import { useDeleteNode, useUploadFile, useCreateFolder } from '@/hooks/use-file-tree';
import { buildTree } from '@/store/file-tree';
import { toast } from 'sonner';
import { DraggableItem } from '@/components/dnd/draggable-item';
import { DroppableFolder } from '@/components/dnd/droppable-folder';
import { useWorkspaceDnd } from '@/components/dnd/dnd-context';
// Dynamic imports — heavy components loaded on demand to reduce OOM
const NoteEditor = dynamic(() => import('./note-editor').then(m => ({ default: m.NoteEditor })), { ssr: false });
const SearchDropdown = dynamic(() => import('@/components/search/search-dropdown').then(m => ({ default: m.SearchDropdown })), { ssr: false });
const ShareDialog = dynamic(() => import('@/components/sharing/share-dialog').then(m => ({ default: m.ShareDialog })), { ssr: false });
const VersionListDialog = dynamic(() => import('@/components/versions/version-list-dialog').then(m => ({ default: m.VersionListDialog })), { ssr: false });
const RevisionSidebar = dynamic(() => import('@/components/revisions/revision-sidebar').then(m => ({ default: m.RevisionSidebar })), { ssr: false });
const BulkActionToolbar = dynamic(() => import('@/components/bulk/bulk-action-toolbar').then(m => ({ default: m.BulkActionToolbar })), { ssr: false });
const EmptyStateCTA = dynamic(() => import('@/components/onboarding/empty-state-cta').then(m => ({ default: m.EmptyStateCTA })), { ssr: false });
const TemplateGalleryDialog = dynamic(() => import('@/components/template/template-gallery-dialog').then(m => ({ default: m.TemplateGalleryDialog })), { ssr: false });
const FilePreviewModal = dynamic(() => import('@/components/preview/file-preview-modal').then(m => ({ default: m.FilePreviewModal })), { ssr: false });
const CreateDialog = dynamic(() => import('./create-dialog').then(m => ({ default: m.CreateDialog })), { ssr: false });
import { markOnboardingStep } from '@/components/onboarding/onboarding-checklist';
import { useAuthStore } from '@/store/auth';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { getPreviewTier, getMimePreviewType, getMimeLabel } from '@/lib/mime-icons';

// 66.8: Persist viewMode to localStorage across reloads
const VIEW_MODE_KEY = 'app-view-mode';

type SortBy = 'name' | 'createdAt';
type SortDirection = 'asc' | 'desc';

function getInitialViewMode(): 'grid' | 'list' {
  if (typeof window === 'undefined') return 'grid';
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'grid' || stored === 'list') return stored;
  } catch { /* localStorage not available */ }
  return 'grid';
}

export function ContentArea() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(getInitialViewMode);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameNodeId, setRenameNodeId] = useState<string>('');
  const [renameNodeName, setRenameNodeName] = useState<string>('');
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareNode, setShareNode] = useState<TreeNode | null>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionNodeId, setVersionNodeId] = useState<string>('');
  const [versionFileName, setVersionFileName] = useState<string>('');
  const [showRevisionSidebar, setShowRevisionSidebar] = useState(false);
  // 39 — Onboarding empty state: template gallery dialog
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  // 39 — Onboarding empty state: create dialog for note/folder
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'note'>('note');
  // File preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string>('');
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewFileMime, setPreviewFileMime] = useState<string>('application/octet-stream');
  const [previewFileSize, setPreviewFileSize] = useState<number>(0);
  const [previewFileChecksum, setPreviewFileChecksum] = useState<string | null>(null);
  // 39 — File upload
  const uploadMutation = useUploadFile();
  const createMutation = useCreateFolder();
  const { user } = useAuthStore();
  // 66.8: Workspace store for Owner column visibility
  const { currentWorkspaceId } = useWorkspaceStore();
  // 39 — Hidden file input ref for empty state CTA
  const fileInputRef = useState<HTMLInputElement | null>(null);
  const [fileInputEl, setFileInputEl] = fileInputRef;

  // 66.8: Persist viewMode changes to localStorage
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* ignore */ }
  };

  // MODUL 69.4: Persist sort preference changes to localStorage (via store)
  const handleSortChange = (newSortBy: SortBy, newSortDirection: SortDirection) => {
    setSortPreference(newSortBy, newSortDirection);
  };

  // MODUL 69.3: Toggle sort — clicking column header toggles direction
  const handleColumnSort = (column: SortBy) => {
    if (sortBy === column) {
      // Same column: toggle direction
      handleSortChange(column, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Different column: switch to it with ascending default
      handleSortChange(column, 'asc');
    }
  };

  // Listen for sidebar upload trigger event
  useEffect(() => {
    const handler = () => {
      fileInputEl?.click();
    };
    window.addEventListener('workspace-upload-trigger', handler);
    return () => window.removeEventListener('workspace-upload-trigger', handler);
  }, [fileInputEl]);

  const {
    tree,
    flatNodes,
    currentFolderId,
    currentFolderPath,
    setCurrentFolder,
    isLoading,
    selectedNodeIds,
    selectNode,
    // MODUL 69.4: Sort state from store
    sortBy,
    sortDirection,
    setSortPreference,
  } = useFileTreeStore();

  const { isDragging } = useWorkspaceDnd();

  const deleteMutation = useDeleteNode();

  // 21 — Favorite toggle: We use a lazy approach to avoid creating a mutation per node
  // since nodeId varies per item click
  const handleFavoriteToggle = async (nodeId: string) => {
    const node = flatNodes.get(nodeId);
    if (!node) return;
    const res = await fetch(`/api/nodes/${nodeId}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: !node.isFavorite }),
    });
    const data = await res.json();
    if (data.success) {
      // Optimistic update: toggle isFavorite in the local tree
      const flatNodesUpdate = new Map(flatNodes);
      const existing = flatNodesUpdate.get(nodeId);
      if (existing) {
        flatNodesUpdate.set(nodeId, { ...existing, isFavorite: !existing.isFavorite });
      }
      // Force refresh from store
      const storeNodes = Array.from(flatNodesUpdate.values());
      const newTree = buildTree(storeNodes);
      useFileTreeStore.getState().setTree(newTree);
      toast.success(data.data.isFavorite ? 'Added to favorites' : 'Removed from favorites');
    }
  };

  // Get items in the current folder
  const currentFolder = flatNodes.get(currentFolderId || '');
  const itemsInFolder = currentFolder?.children || tree;

  // Search is now handled by SearchDropdown — items display is unfiltered locally
  const filteredItems = itemsInFolder;

  // Multi-select: get selected nodes for drag operations
  const getSelectedNodes = (draggedNode: TreeNode): TreeNode[] => {
    if (multiSelectedIds.size > 0 && multiSelectedIds.has(draggedNode.id)) {
      return Array.from(multiSelectedIds)
        .map(id => flatNodes.get(id))
        .filter(Boolean) as TreeNode[];
    }
    return [draggedNode];
  };

  // Single click: select item (Google Drive style)
  const handleItemClick = (node: TreeNode, e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey)) {
      // Multi-select
      const newSelection = new Set(multiSelectedIds);
      if (newSelection.has(node.id)) {
        newSelection.delete(node.id);
      } else {
        newSelection.add(node.id);
      }
      setMultiSelectedIds(newSelection);
      return;
    }

    // Single click: select the item
    setSelectedNodeId(node.id);
    setMultiSelectedIds(new Set());
  };

  // Double click: open item (folder → navigate, note → editor, file → new tab like Google Drive)
  // ALL file types open in a new browser tab — just like Google Drive
  const handleItemDoubleClick = (node: TreeNode) => {
    if (node.type === 'folder') {
      navigateToFolder(node.id, node.name);
    } else if (node.type === 'note') {
      openNote(node.id);
    } else {
      // All files → open dedicated viewer in new tab (like Google Drive)
      window.open('/view/' + node.id, '_blank');
    }
  };

  // Navigate to folder
  const navigateToFolder = (folderId: string, folderName: string) => {
    const newPath = [...currentFolderPath, { id: folderId, name: folderName }];
    setCurrentFolder(folderId, newPath);
    setSelectedNodeId(null);
  };

  // Navigate up
  const navigateUp = () => {
    if (currentFolderPath.length > 1) {
      const parentPath = currentFolderPath.slice(0, -1);
      const parentFolder = parentPath[parentPath.length - 1];
      setCurrentFolder(parentFolder.id, parentPath);
      setSelectedNodeId(null);
    }
  };

  // Navigate via breadcrumb
  const navigateBreadcrumb = (index: number) => {
    const newPath = currentFolderPath.slice(0, index + 1);
    const target = newPath[newPath.length - 1];
    setCurrentFolder(target.id, newPath);
    setSelectedNodeId(null);
  };

  // Open note editor
  const openNote = (noteId: string) => {
    setSelectedNodeId(noteId);
  };

  const handleRename = (nodeId: string, currentName: string) => {
    setRenameNodeId(nodeId);
    setRenameNodeName(currentName);
    setRenameDialogOpen(true);
  };

  const handleDelete = (nodeId: string) => {
    deleteMutation.mutate({ nodeId });
  };

  const handleShare = (node: TreeNode) => {
    setShareNode(node);
    setShareDialogOpen(true);
    markOnboardingStep('share_item');
  };

  const handleVersionHistory = (node: TreeNode) => {
    setVersionNodeId(node.id);
    setVersionFileName(node.name);
    setVersionDialogOpen(true);
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  // 66.2/67: Type-differentiated file icons using MIME type classification
  // Folder stays orange, note stays emerald, files get icons by MIME category
  const getIcon = (type: NodeType, mimeType?: string) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-5 w-5 text-orange-500" />;
      case 'note':
        return <FileText className="h-5 w-5 text-emerald-600" />;
      case 'file': {
        if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
        const previewType = getMimePreviewType(mimeType);
        switch (previewType) {
          case 'image': return <ImageIcon className="h-5 w-5 text-sky-500" />;
          case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
          case 'video': return <Film className="h-5 w-5 text-purple-500" />;
          case 'audio': return <Music className="h-5 w-5 text-pink-500" />;
          case 'docx': return <FileText className="h-5 w-5 text-blue-500" />;
          case 'xlsx': return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
          case 'pptx': return <Presentation className="h-5 w-5 text-orange-500" />;
          case 'text': return <FileText className="h-5 w-5 text-gray-500" />;
          case 'code': return <Code className="h-5 w-5 text-teal-500" />;
          case 'none':
          case 'download':
          default: {
            const mimeLabel = getMimeLabel(mimeType);
            if (mimeLabel.includes('Archive') || mimeLabel.includes('ZIP') || mimeLabel.includes('RAR') || mimeLabel.includes('GZIP') || mimeLabel.includes('7-Zip'))
              return <Archive className="h-5 w-5 text-amber-600" />;
            return <FileQuestion className="h-5 w-5 text-muted-foreground" />;
          }
        }
      }
    }
  };

  // Compact icon variant for list view rows (h-4 w-4 instead of h-5 w-5)
  const getIconCompact = (type: NodeType, mimeType?: string) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-4 w-4 text-orange-500" />;
      case 'note':
        return <FileText className="h-4 w-4 text-emerald-600" />;
      case 'file': {
        if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
        const previewType = getMimePreviewType(mimeType);
        switch (previewType) {
          case 'image': return <ImageIcon className="h-4 w-4 text-sky-500" />;
          case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
          case 'video': return <Film className="h-4 w-4 text-purple-500" />;
          case 'audio': return <Music className="h-4 w-4 text-pink-500" />;
          case 'docx': return <FileText className="h-4 w-4 text-blue-500" />;
          case 'xlsx': return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
          case 'pptx': return <Presentation className="h-4 w-4 text-orange-500" />;
          case 'text': return <FileText className="h-4 w-4 text-gray-500" />;
          case 'code': return <Code className="h-4 w-4 text-teal-500" />;
          case 'none':
          case 'download':
          default: {
            const label = getMimeLabel(mimeType);
            if (label.includes('Archive') || label.includes('ZIP') || label.includes('RAR') || label.includes('GZIP') || label.includes('7-Zip'))
              return <Archive className="h-4 w-4 text-amber-600" />;
            return <FileQuestion className="h-4 w-4 text-muted-foreground" />;
          }
        }
      }
    }
  };

  // If a note is selected, show the note editor + optional revision sidebar
  const selectedNode = selectedNodeId ? flatNodes.get(selectedNodeId) : null;
  if (selectedNode && selectedNode.type === 'note') {
    return (
      <div className="flex h-full">
        {/* Main content area */}
        <div className={showRevisionSidebar ? 'flex-1 flex flex-col p-6 transition-all min-w-0' : 'flex-1 flex flex-col p-6 transition-all'}>
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
              aria-label="Back to folder view"
              onClick={() => {
                setSelectedNodeId(null);
                setShowRevisionSidebar(false);
              }}
            >
              <ArrowUp className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <h2 className="text-lg font-semibold">{selectedNode.name}</h2>
            <Separator orientation="vertical" className="h-4" />
            <Button
              variant={showRevisionSidebar ? 'secondary' : 'ghost'}
              size="sm"
              className="min-h-[44px]"
              aria-label="Toggle version history sidebar"
              aria-expanded={showRevisionSidebar}
              onClick={() => setShowRevisionSidebar(!showRevisionSidebar)}
            >
              <History className="h-4 w-4 mr-1" />
              Version History
            </Button>
          </div>
          <ErrorBoundary fallback={NoteEditorError} context={{ componentName: 'NoteEditor', action: 'render_note' }}>
            <NoteEditor nodeId={selectedNode.id} />
          </ErrorBoundary>
        </div>

        {/* Revision sidebar panel */}
        <AnimatePresence>
          {showRevisionSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 overflow-hidden"
            >
              <RevisionSidebar
                nodeId={selectedNode.id}
                onClose={() => setShowRevisionSidebar(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Breadcrumb — 29: wrapped in <nav> */}
          <nav aria-label="Breadcrumb">
          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList>
              {currentFolderPath.map((segment, index) => (
                <Fragment key={`bc-${index}`}>
                  {index > 0 && (
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                  )}
                  <BreadcrumbItem>
                    {index === currentFolderPath.length - 1 ? (
                      <BreadcrumbPage className="text-sm truncate" title={segment.name}>
                        {segment.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        onClick={() => navigateBreadcrumb(index)}
                        className="text-sm cursor-pointer truncate"
                        title={segment.name}
                      >
                        {segment.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          </nav>



          {/* Search — 12.4: debounced dropdown */}
          <SearchDropdown
            className="hidden sm:block w-48"
            onNavigateToNode={(nodeId, nodeType, parentId) => {
              setMultiSelectedIds(new Set());
              if (nodeType === 'folder') {
                const folderNode = flatNodes.get(nodeId);
                if (folderNode) {
                  navigateToFolder(nodeId, folderNode.name);
                }
              } else if (nodeType === 'note') {
                // Navigate to parent folder then open note
                if (parentId) {
                  const parentFolder = flatNodes.get(parentId);
                  if (parentFolder) {
                    setCurrentFolder(parentId, []);
                  }
                }
                openNote(nodeId);
              } else {
                // File — navigate to parent folder
                if (parentId) {
                  const parentFolder = flatNodes.get(parentId);
                  if (parentFolder) {
                    setCurrentFolder(parentId, []);
                  }
                }
                setSelectedNodeId(nodeId);
              }
            }}
          />

          {/* MODUL 69.3: Sort dropdown button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] gap-1.5"
                aria-label="Sort options"
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">Sort</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleSortChange('name', 'asc')}
                className={sortBy === 'name' && sortDirection === 'asc' ? 'bg-accent' : ''}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Nama (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSortChange('name', 'desc')}
                className={sortBy === 'name' && sortDirection === 'desc' ? 'bg-accent' : ''}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Nama (Z-A)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSortChange('createdAt', 'desc')}
                className={sortBy === 'createdAt' && sortDirection === 'desc' ? 'bg-accent' : ''}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Terbaru
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSortChange('createdAt', 'asc')}
                className={sortBy === 'createdAt' && sortDirection === 'asc' ? 'bg-accent' : ''}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Terlama
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 min-h-[44px] min-w-[44px]"
              onClick={() => handleViewModeChange('grid')}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 min-h-[44px] min-w-[44px]"
              onClick={() => handleViewModeChange('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Upload button — always visible in toolbar */}
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => fileInputEl?.click()}
            aria-label="Upload files to current folder"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Upload
          </Button>

          {/* Offline status badge — 51: shows online/offline status */}
          <OfflineBadge />
        </div>
      </div>

      {/* Bulk Action Toolbar — 18.2: appears when multi-select is active */}
      {multiSelectedIds.size > 0 && (
        <BulkActionToolbar
          selectedIds={multiSelectedIds}
          onClearSelection={() => setMultiSelectedIds(new Set())}
        />
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 39 — Empty state with onboarding CTAs */}
          {!isLoading && filteredItems.length === 0 && (
            <EmptyStateCTA
              onUploadFile={() => {
                fileInputEl?.click();
              }}
              onCreateNote={() => {
                setCreateType('note');
                setCreateDialogOpen(true);
                markOnboardingStep('create_note');
              }}
              onOpenTemplateGallery={() => {
                setTemplateGalleryOpen(true);
              }}
              parentId={currentFolderId}
            />
          )}
          {/* Hidden file input for upload CTA */}
          <input
            ref={setFileInputEl}
            type="file"
            multiple
            className="hidden"
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files) {
                for (const file of Array.from(e.target.files)) {
                  uploadMutation.mutate({ file, parentId: currentFolderId });
                }
                markOnboardingStep('upload_file');
              }
              e.target.value = ''; // Reset input
            }}
          />

          {/* Items */}
          {!isLoading && filteredItems.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {viewMode === 'grid' ? (
                  <ul role="list" aria-label="Folder contents grid" className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                    {/* + Add New card — always visible at start of every folder */}
                    <li role="listitem" aria-label="Add new item">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Card className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
                            <CardContent className="p-3 flex flex-col items-center text-center gap-1.5 min-h-0">
                              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Plus className="h-6 w-6 text-primary" />
                              </div>
                              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Add New</span>
                            </CardContent>
                          </Card>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => fileInputEl?.click()}>
                            <Upload className="h-4 w-4 mr-2 text-orange-500" />
                            Upload File
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setCreateType('folder'); setCreateDialogOpen(true); }}>
                            <FolderPlus className="h-4 w-4 mr-2 text-orange-500" />
                            New Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setCreateType('note'); setCreateDialogOpen(true); markOnboardingStep('create_note'); }}>
                            <FileText className="h-4 w-4 mr-2 text-emerald-600" />
                            New Note
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                    {filteredItems.map((node) => {
                      // Folder items get DroppableFolder wrapper + DraggableItem
                      // Non-folder items just get DraggableItem
                      const isSelected = multiSelectedIds.has(node.id);

                      const cardContent = (
                        <Card
                          role="listitem"
                          className={`cursor-pointer hover:border-accent transition-colors group relative
                            ${isSelected || selectedNodeId === node.id ? 'ring-2 ring-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10' : ''}
                            ${isDragging ? 'pointer-events-none' : ''}
                          `}
                          onClick={(e) => handleItemClick(node, e)}
                          onDoubleClick={() => handleItemDoubleClick(node)}
                        >
                          <CardContent className="p-3 flex flex-col items-center text-center gap-1.5 min-h-0">
                            <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              {getIcon(node.type, node.metadata?.mimeType)}
                            </div>
                            <span className="text-sm font-medium leading-tight line-clamp-2 w-full break-words" title={node.name}>
                              {node.name}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {node.type === 'folder' && (
                                <span>{node.children?.length || 0} items</span>
                              )}
                              {node.type === 'file' && node.metadata && (
                                <span>{formatBytes(node.metadata.sizeBytes)}</span>
                              )}
                              {node.type === 'note' && (
                                <span>Note</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(node.createdAt)}
                            </span>
                          </CardContent>

                          {/* Actions overlay */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 min-h-[44px] min-w-[44px]" aria-label={`More actions for ${node.name}`}>
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleFavoriteToggle(node.id)}>
                                  <Star className={`h-4 w-4 mr-2 ${node.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                  {node.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRename(node.id, node.name)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShare(node)}>
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                {node.type === 'file' && (
                                  <DropdownMenuItem onClick={() => handleVersionHistory(node)}>
                                    <History className="h-4 w-4 mr-2" />
                                    Version History
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDelete(node.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      );

                      // Wrap folder cards with DroppableFolder for drop targets
                      if (node.type === 'folder') {
                        return (
                          <DraggableItem
                            key={node.id}
                            id={node.id}
                            node={node}
                            selectedNodes={getSelectedNodes(node)}
                          >
                            <DroppableFolder id={node.id} node={node}>
                              {cardContent}
                            </DroppableFolder>
                          </DraggableItem>
                        );
                      }

                      return (
                        <DraggableItem
                          key={node.id}
                          id={node.id}
                          node={node}
                          selectedNodes={getSelectedNodes(node)}
                        >
                          {cardContent}
                        </DraggableItem>
                      );
                    })}
                  </ul>
                ) : (
                  // ============================================================
                  // MODUL 66: List View — Row-Based Layout (Google Drive Parity)
                  // 66.2: Every node rendered as ONE horizontal row, full container width
                  // 66.3: Columnar structure — primary (icon+name), secondary (size/date), owner, actions
                  // 66.4: Fixed compact row height ~44px
                  // 66.5: Interaction contract identical to grid (reuse handlers)
                  // 66.6: Selection via selectedNodeIds Zustand (same as grid)
                  // 66.7: DnD wrapping preserved (DraggableItem + DroppableFolder)
                  // 66.8: viewMode persisted to localStorage
                  // 66.9: Mobile breakpoint — collapse secondary columns
                  // 67: Type-differentiated file icons by MIME category
                  // ============================================================
                  <div className="flex flex-col">
                    {/* 66.3: Column headers — desktop only */}
                    {/* MODUL 69.3: Clickable column headers for sort */}
                    <div className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border select-none">
                      <span className="w-6 shrink-0" /> {/* checkbox spacer */}
                      <span className="w-6 shrink-0" /> {/* icon spacer */}
                      <button
                        className="flex-1 min-w-0 flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => handleColumnSort('name')}
                        aria-label={`Sort by name, ${sortBy === 'name' ? (sortDirection === 'asc' ? 'currently ascending' : 'currently descending') : 'click to sort ascending'}`}
                      >
                        Name
                        {sortBy === 'name' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                      <span className="w-20 shrink-0 text-right">Size</span>
                      <button
                        className="w-28 shrink-0 flex items-center justify-end gap-1 hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => handleColumnSort('createdAt')}
                        aria-label={`Sort by created date, ${sortBy === 'createdAt' ? (sortDirection === 'asc' ? 'currently ascending' : 'currently descending') : 'click to sort ascending'}`}
                      >
                        Created
                        {sortBy === 'createdAt' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                      {currentWorkspaceId && (
                        <span className="w-24 shrink-0 text-right">Owner</span>
                      )}
                      <span className="w-28 shrink-0" /> {/* actions spacer */}
                    </div>

                    <ul role="list" aria-label="Folder contents list" className="space-y-0">
                      {/* + Add New row — always visible at start of every folder */}
                      <li role="listitem" aria-label="Add new item">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="flex items-center gap-2 h-[44px] px-3 rounded-md hover:bg-accent/50 cursor-pointer group transition-colors">
                              <span className="w-6 shrink-0" />
                              <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                <Plus className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Add New</span>
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => fileInputEl?.click()}>
                              <Upload className="h-4 w-4 mr-2 text-orange-500" />
                              Upload File
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setCreateType('folder'); setCreateDialogOpen(true); }}>
                              <FolderPlus className="h-4 w-4 mr-2 text-orange-500" />
                              New Folder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setCreateType('note'); setCreateDialogOpen(true); markOnboardingStep('create_note'); }}>
                              <FileText className="h-4 w-4 mr-2 text-emerald-600" />
                              New Note
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                      {filteredItems.map((node) => {
                        const isSelected = multiSelectedIds.has(node.id) || selectedNodeId === node.id;

                        const rowContent = (
                          <li
                            role="row"
                            aria-selected={isSelected}
                            className={`flex items-center gap-2 h-[44px] px-3 rounded-md hover:bg-accent/50 cursor-pointer group transition-colors
                              ${isSelected ? 'ring-2 ring-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10' : ''}
                              ${isDragging ? 'pointer-events-none' : ''}
                            `}
                            onClick={(e) => handleItemClick(node, e)}
                            onDoubleClick={() => handleItemDoubleClick(node)}
                          >
                            {/* 66.6: Checkbox for multi-select */}
                            <button
                              className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newSelection = new Set(multiSelectedIds);
                                if (newSelection.has(node.id)) {
                                  newSelection.delete(node.id);
                                } else {
                                  newSelection.add(node.id);
                                }
                                setMultiSelectedIds(newSelection);
                              }}
                              aria-label={multiSelectedIds.has(node.id) ? 'Deselect' : 'Select'}
                            >
                              {multiSelectedIds.has(node.id) ? (
                                <CheckSquare className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                              )}
                            </button>

                            {/* 67: Type-differentiated icon */}
                            <div className="w-6 h-6 flex items-center justify-center shrink-0">
                              {getIconCompact(node.type, node.metadata?.mimeType)}
                            </div>

                            {/* 66.3: Primary column — name, flex-grow, truncate-ellipsis + tooltip */}
                            <span className="text-sm font-medium truncate flex-1 min-w-0" title={node.name}>
                              {node.name}
                            </span>

                            {/* 66.3: Secondary columns — fixed-width, hidden on mobile (66.9) */}
                            <div className="hidden sm:flex items-center gap-2 shrink-0">
                              {/* Size column */}
                              <span className="w-20 text-xs text-muted-foreground text-right shrink-0">
                                {node.type === 'folder' ? `${node.children?.length || 0} items`
                                  : node.type === 'file' && node.metadata ? formatBytes(node.metadata.sizeBytes)
                                  : node.type === 'note' ? 'Note'
                                  : ''}
                              </span>

                              {/* MODUL 69.2: Created date column (was Modified/updatedAt) */}
                              <span className="w-28 text-xs text-muted-foreground text-right shrink-0">
                                {formatDate(node.createdAt)}
                              </span>

                              {/* 66.3: Owner column — only in workspace context */}
                              {currentWorkspaceId && (
                                <span className="w-24 text-xs text-muted-foreground text-right truncate shrink-0">
                                  {user?.name || 'You'}
                                </span>
                              )}
                            </div>

                            {/* 66.3: Trailing action icons — appear on row hover */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Download */}
                              {node.type === 'file' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={`Download ${node.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/api/files/${node.id}/content?download=true`, '_blank');
                                  }}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {/* Share */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Share ${node.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShare(node);
                                }}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </Button>
                              {/* Favorite toggle */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={node.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFavoriteToggle(node.id);
                                }}
                              >
                                <Star className={`h-3.5 w-3.5 ${node.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                              </Button>
                              {/* Overflow menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    aria-label={`More actions for ${node.name}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleFavoriteToggle(node.id)}>
                                    <Star className={`h-4 w-4 mr-2 ${node.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                    {node.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRename(node.id, node.name)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleShare(node)}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share
                                  </DropdownMenuItem>
                                  {node.type === 'file' && (
                                    <DropdownMenuItem onClick={() => handleVersionHistory(node)}>
                                      <History className="h-4 w-4 mr-2" />
                                      Version History
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(node.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </li>
                        );

                        // Wrap folder rows with DroppableFolder
                        if (node.type === 'folder') {
                          return (
                            <DraggableItem
                              key={node.id}
                              id={node.id}
                              node={node}
                              selectedNodes={getSelectedNodes(node)}
                            >
                              <DroppableFolder id={node.id} node={node}>
                                {rowContent}
                              </DroppableFolder>
                            </DraggableItem>
                          );
                        }

                        return (
                          <DraggableItem
                            key={node.id}
                            id={node.id}
                            node={node}
                            selectedNodes={getSelectedNodes(node)}
                          >
                            {rowContent}
                          </DraggableItem>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        nodeId={renameNodeId}
        currentName={renameNodeName}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        node={shareNode}
      />

      {/* Version History Dialog */}
      <VersionListDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        nodeId={versionNodeId}
        fileName={versionFileName}
      />

      {/* 39 — Create Dialog (for note creation from empty state CTA) */}
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        type={createType}
      />

      {/* 39 — Template Gallery Dialog (from empty state CTA) */}
      <TemplateGalleryDialog
        open={templateGalleryOpen}
        onOpenChange={setTemplateGalleryOpen}
        parentId={currentFolderId}
        userId={user?.id}
        onTemplateUsed={(newNoteId, noteName) => {
          // Mark onboarding step
          markOnboardingStep('create_note');
        }}
      />

      {/* File Preview Modal — opens when a file is clicked */}
      <FilePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        id={previewFileId}
        name={previewFileName}
        mimeType={previewFileMime}
        sizeBytes={previewFileSize}
        checksumSha256={previewFileChecksum}
      />
    </div>
  );
}

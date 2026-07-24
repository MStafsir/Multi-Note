'use client';

// ============================================================
// MODUL 22: Command Palette — Unified keyboard-driven interface
// Opens with Cmd/Ctrl+K, uses cmdk library with shadcn/ui wrappers
// Features: Search, Quick Navigate, Quick Create, Calculator,
//           Quick Actions, Keyboard Shortcuts Reference
// ============================================================

import { useState, useCallback } from 'react';
import {
  Folder,
  File,
  FileText,
  FolderPlus,
  Calculator,
  Star,
  Trash2,
  Share2,
  Keyboard,
  ArrowRight,
  Undo2,
  Home,
  Search,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useSearch, type SearchResult } from '@/hooks/use-search';
import { useFileTreeStore } from '@/store/file-tree';
import { useCalculatorStore } from '@/store/calculator';
import { useUndoStore } from '@/store/undo';
import { useDeleteNode } from '@/hooks/use-file-tree';

// --- Keyboard Shortcuts Reference ---
const SHORTCUTS = [
  { key: '⌘K', label: 'Ctrl+K', category: 'navigation', description: 'Open command palette', icon: Search },
  { key: '⌘⇧F', label: 'Ctrl+Shift+F', category: 'navigation', description: 'Focus search', icon: Search },
  { key: '⌘⇧K', label: 'Ctrl+Shift+K', category: 'tools', description: 'Open calculator', icon: Calculator },
  { key: 'N', label: 'N', category: 'creation', description: 'Create new note', icon: FileText },
  { key: 'F', label: 'F', category: 'creation', description: 'Create new folder', icon: FolderPlus },
  { key: '⌫', label: 'Delete', category: 'editing', description: 'Move selected item to trash', icon: Trash2 },
  { key: '⌘Z', label: 'Ctrl+Z', category: 'editing', description: 'Undo last action', icon: Undo2 },
  { key: 'Esc', label: 'Esc', category: 'navigation', description: 'Close palette / dialog', icon: Keyboard },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onCreateNote,
  onCreateFolder,
}: CommandPaletteProps) {
  // cmdk manages the search query internally via CommandInput.
  // We track it separately to pass to our search API.
  const [query, setQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Search hook
  const { data: searchData, isLoading: searchLoading } = useSearch(query, {});
  const searchResults = searchData?.results || [];

  // Stores
  const { flatNodes, setCurrentFolder, selectedNodeIds } = useFileTreeStore();
  const { toggleOpen: toggleCalculator } = useCalculatorStore();
  const { popAction } = useUndoStore();
  const deleteMutation = useDeleteNode();

  // Navigate to a search result or node
  const navigateToNode = useCallback((result: SearchResult) => {
    onOpenChange(false);

    if (result.type === 'folder') {
      setCurrentFolder(result.id, []);
    } else if (result.type === 'note') {
      if (result.parentId) {
        setCurrentFolder(result.parentId, []);
      }
    } else {
      if (result.parentId) {
        setCurrentFolder(result.parentId, []);
      }
    }
  }, [onOpenChange, setCurrentFolder]);

  // Handle command execution
  const handleCommand = useCallback((action: string) => {
    onOpenChange(false);

    switch (action) {
      case 'create-note':
        onCreateNote();
        break;
      case 'create-folder':
        onCreateFolder();
        break;
      case 'calculator':
        toggleCalculator();
        break;
      case 'go-home':
        setCurrentFolder(null, [{ id: null, name: 'My Workspace' }]);
        break;
      case 'undo':
        popAction();
        break;
      case 'shortcuts':
        setShowShortcuts(true);
        break;
      default:
        break;
    }
  }, [onOpenChange, onCreateNote, onCreateFolder, toggleCalculator, setCurrentFolder, popAction]);

  // Delete selected item(s)
  const handleDeleteSelected = useCallback(() => {
    onOpenChange(false);
    const selectedIds = Array.from(selectedNodeIds);
    if (selectedIds.length > 0) {
      deleteMutation.mutate({ nodeId: selectedIds[0] });
    }
  }, [onOpenChange, selectedNodeIds, deleteMutation]);

  // Get icon for node type
  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-4 w-4 text-orange-500 shrink-0" />;
      case 'file':
        return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
      case 'note':
        return <FileText className="h-4 w-4 text-emerald-600 shrink-0" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  // Format shortcut display based on platform
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const formatShortcut = (key: string, label: string) => isMac ? key : label;

  // Get all nodes as flat list for navigation
  const allNodes = Array.from(flatNodes.values());
  const recentNodes = allNodes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // Handle open change with reset (event handler — lint-compliant)
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when palette closes
      setQuery('');
      setShowShortcuts(false);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // --- Shortcuts Reference View ---
  if (showShortcuts && open) {
    const categories = {
      navigation: SHORTCUTS.filter(s => s.category === 'navigation'),
      creation: SHORTCUTS.filter(s => s.category === 'creation'),
      editing: SHORTCUTS.filter(s => s.category === 'editing'),
      tools: SHORTCUTS.filter(s => s.category === 'tools'),
    };

    return (
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Keyboard Shortcuts"
        description="Available keyboard shortcuts in Unified Workspace"
      >
        <CommandInput placeholder="Search shortcuts..." />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No shortcuts found.</CommandEmpty>

          {Object.entries(categories).map(([category, shortcuts]) => (
            shortcuts.length > 0 && (
              <CommandGroup key={category} heading={category.charAt(0).toUpperCase() + category.slice(1)}>
                {shortcuts.map((shortcut) => (
                  <CommandItem
                    key={shortcut.label}
                    onSelect={() => handleOpenChange(false)}
                    className="flex items-center gap-2"
                  >
                    <shortcut.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{shortcut.description}</span>
                    <CommandShortcut>{formatShortcut(shortcut.key, shortcut.label)}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          ))}

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setShowShortcuts(false);
              }}
              className="flex items-center gap-2"
            >
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Back to Command Palette</span>
              <CommandShortcut>Esc</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    );
  }

  // --- Main Command Palette View ---
  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command Palette"
      description="Search, navigate, and execute commands"
    >
      <CommandInput
        placeholder="Type a command or search..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Search Results — shown when there's a query */}
        {query.trim().length > 0 && (
          <CommandGroup heading="Search Results">
            {searchLoading && (
              <CommandItem disabled>
                <Search className="h-4 w-4 shrink-0 animate-pulse" />
                <span>Searching...</span>
              </CommandItem>
            )}
            {!searchLoading && searchResults.length > 0 && searchResults.slice(0, 8).map((result) => (
              <CommandItem
                key={result.id}
                value={`${result.name} ${result.type} navigate`}
                onSelect={() => navigateToNode(result)}
                className="flex items-center gap-2"
              >
                {getNodeTypeIcon(result.type)}
                <span className="truncate">{result.name}</span>
                <span className="text-xs text-muted-foreground capitalize shrink-0">{result.type}</span>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            ))}
            {!searchLoading && searchResults.length === 0 && (
              <CommandItem disabled>
                <span>No matches for &ldquo;{query}&rdquo;</span>
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Quick Navigate — recent items (shown when no query) */}
        {query.trim().length === 0 && recentNodes.length > 0 && (
          <CommandGroup heading="Recent">
            {recentNodes.map((node) => (
              <CommandItem
                key={node.id}
                value={`${node.name} ${node.type} recent navigate`}
                onSelect={() => navigateToNode({
                  id: node.id,
                  type: node.type,
                  name: node.name,
                  parentId: node.parentId,
                  createdAt: node.createdAt,
                  updatedAt: node.updatedAt,
                  snippet: null,
                  metadata: null,
                })}
                className="flex items-center gap-2"
              >
                {getNodeTypeIcon(node.type)}
                <span className="truncate">{node.name}</span>
                <span className="text-xs text-muted-foreground capitalize shrink-0">{node.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem
            value="go home workspace root"
            onSelect={() => handleCommand('go-home')}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Go to Home</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Create */}
        <CommandGroup heading="Create">
          <CommandItem
            value="create new note"
            onSelect={() => handleCommand('create-note')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>New Note</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="create new folder"
            onSelect={() => handleCommand('create-folder')}
            className="flex items-center gap-2"
          >
            <FolderPlus className="h-4 w-4 shrink-0 text-orange-500" />
            <span>New Folder</span>
            <CommandShortcut>F</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Actions */}
        <CommandGroup heading="Actions">
          {selectedNodeIds.size > 0 && (
            <CommandItem
              value="delete move trash selected"
              onSelect={handleDeleteSelected}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
              <span>Delete Selected ({selectedNodeIds.size})</span>
              <CommandShortcut>⌫</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem
            value="toggle favorite star"
            onSelect={() => handleCommand('favorite')}
            className="flex items-center gap-2"
          >
            <Star className="h-4 w-4 shrink-0 text-yellow-500" />
            <span>Toggle Favorite</span>
          </CommandItem>
          <CommandItem
            value="share"
            onSelect={() => handleCommand('share')}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Share</span>
          </CommandItem>
          <CommandItem
            value="undo last action"
            onSelect={() => handleCommand('undo')}
            className="flex items-center gap-2"
          >
            <Undo2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Undo</span>
            <CommandShortcut>{formatShortcut('⌘Z', 'Ctrl+Z')}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Tools */}
        <CommandGroup heading="Tools">
          <CommandItem
            value="calculator open"
            onSelect={() => handleCommand('calculator')}
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4 shrink-0 text-orange-500" />
            <span>Calculator</span>
            <CommandShortcut>{formatShortcut('⌘⇧K', 'Ctrl+Shift+K')}</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="keyboard shortcuts help"
            onSelect={() => handleCommand('shortcuts')}
            className="flex items-center gap-2"
          >
            <Keyboard className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Keyboard Shortcuts</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

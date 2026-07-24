'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useFileTreeStore } from '@/store/file-tree';
import { useNodeList } from '@/hooks/use-file-tree';
import { FileTreeItem } from './file-tree-item';

export function FileTreeView() {
  const { tree, isLoading, currentFolderId, setCurrentFolder } = useFileTreeStore();

  // Fetch nodes
  const { isLoading: queryLoading } = useNodeList(currentFolderId);

  // Initialize root folder on mount
  useEffect(() => {
    setCurrentFolder(null, [{ id: null, name: 'My Workspace' }]);
  }, []);

  const loading = isLoading || queryLoading;

  if (loading && tree.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No items yet</p>
        <p className="text-xs text-muted-foreground mt-1">Create a folder or note to get started</p>
      </div>
    );
  }

  return (
    <div role="tree" aria-label="File tree">
      {tree.map((node) => (
        <FileTreeItem key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

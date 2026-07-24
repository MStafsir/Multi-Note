'use client';

// ============================================================
// Module 28: Data Portability Settings Component
// Export My Data, Import Data, Delete My Account (GDPR compliance)
// ============================================================

import { useState, useCallback, useRef } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Loader2,
  AlertTriangle,
  FileArchive,
  CheckCircle2,
  XCircle,
  FolderOpen,
  FileText,
  File,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface ExportResult {
  downloadLink: string;
  expiresAt: string;
  totalNodes: number;
  folders: number;
  files: number;
  notes: number;
  zipSizeBytes: number;
}

interface ImportResult {
  imported: {
    folders: number;
    files: number;
    notes: number;
  };
}

export function DataPortabilitySettings() {
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Export handler
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportResult(null);
    setExportProgress(10);

    try {
      // Simulate progress steps
      setExportProgress(20);

      const response = await fetch('/api/export', { method: 'POST' });
      setExportProgress(60);

      const data = await response.json();
      setExportProgress(90);

      if (!data.success) {
        throw new Error(data.error || 'Export failed');
      }

      setExportResult(data.data);
      setExportProgress(100);
      toast.success('Data export complete! Download link available for 24 hours.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Export failed';
      toast.error(message);
      setExportResult(null);
    } finally {
      setExporting(false);
    }
  }, []);

  // Import handler
  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      toast.error('Please select a ZIP file to import');
      return;
    }

    setImporting(true);
    setImportResult(null);
    setImportProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (targetParentId) {
        formData.append('parentId', targetParentId);
      }

      setImportProgress(30);

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      setImportProgress(70);

      const data = await response.json();

      setImportProgress(90);

      if (!data.success) {
        throw new Error(data.error || 'Import failed');
      }

      setImportResult(data.data);
      setImportProgress(100);
      toast.success(`Imported ${data.data.imported.notes} notes, ${data.data.imported.files} files, ${data.data.imported.folders} folders`);
      setImportDialogOpen(false);
      setSelectedFile(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  }, [selectedFile, targetParentId]);

  // Delete account handler
  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm account deletion');
      return;
    }

    if (!deletePassword) {
      toast.error('Please enter your password');
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          password: deletePassword,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Account deletion failed');
      }

      toast.success('Your account has been permanently deleted. You will be redirected.');

      // Sign out and redirect to home after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Account deletion failed';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmText, deletePassword]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Export Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export My Data
          </CardTitle>
          <CardDescription>
            Download all your data as a ZIP file. Notes are exported as Markdown files,
            and original files maintain their folder structure. The download link expires in 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!exportResult ? (
            <div className="space-y-4">
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="min-h-[44px]"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileArchive className="h-4 w-4 mr-2" />
                    Generate Export
                  </>
                )}
              </Button>
              {exporting && (
                <div className="space-y-2">
                  <Progress value={exportProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {exportProgress < 20 ? 'Preparing export...' :
                     exportProgress < 60 ? 'Collecting your data...' :
                     exportProgress < 90 ? 'Generating ZIP archive...' :
                     'Finishing up...'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Export ready!</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span>{exportResult.folders} folders</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <span>{exportResult.files} files</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{exportResult.notes} notes</span>
                </div>
                <div className="text-muted-foreground">
                  Size: {formatBytes(exportResult.zipSizeBytes)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href={exportResult.downloadLink}
                  download
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  <Download className="h-4 w-4" />
                  Download ZIP
                </a>
                <p className="text-xs text-muted-foreground">
                  Expires: {new Date(exportResult.expiresAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setExportResult(null);
                  setExportProgress(0);
                }}
                className="min-h-[44px]"
              >
                Generate New Export
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>
            Upload a ZIP file to import data into your workspace.
            Markdown files (.md) will be converted to notes, and other files will be stored as-is.
            Folder structure is preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!importResult ? (
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button className="min-h-[44px]">
                  <Upload className="h-4 w-4 mr-2" />
                  Import ZIP
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Data from ZIP</DialogTitle>
                  <DialogDescription>
                    Select a ZIP file to import. Markdown files will become notes, other files will be stored.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="zip-file">ZIP File</Label>
                    <Input
                      id="zip-file"
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setSelectedFile(file || null);
                      }}
                      className="min-h-[44px]"
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedFile.name} ({formatBytes(selectedFile.size)})
                      </p>
                    )}
                  </div>
                  {importing && (
                    <div className="space-y-2">
                      <Progress value={importProgress} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {importProgress < 30 ? 'Reading ZIP file...' :
                         importProgress < 70 ? 'Processing contents...' :
                         'Creating nodes...'}
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportDialogOpen(false);
                      setSelectedFile(null);
                    }}
                    disabled={importing}
                    className="min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || importing}
                    className="min-h-[44px]"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Import complete!</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span>{importResult.imported.folders} folders</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <span>{importResult.imported.files} files</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{importResult.imported.notes} notes</span>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setImportResult(null);
                  setImportProgress(0);
                }}
                className="min-h-[44px]"
              >
                Import More Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Account Card */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete My Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone
            and is performed in compliance with the right-to-be-forgotten principle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="min-h-[44px]">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Confirm Account Deletion
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and ALL associated data including:
                  <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                    <li>All files, folders, and notes</li>
                    <li>All file versions and note revisions</li>
                    <li>All shares, tags, and activity history</li>
                    <li>All calculation history</li>
                    <li>All notifications</li>
                    <li>Your profile and storage data</li>
                  </ul>
                  <strong className="text-destructive">This action cannot be undone.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="delete-confirm-text">
                    Type <strong>DELETE</strong> to confirm
                  </Label>
                  <Input
                    id="delete-confirm-text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="min-h-[44px]"
                  />
                </div>
                <div>
                  <Label htmlFor="delete-password">Enter your password</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Your current password"
                    className="min-h-[44px]"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={deleting}
                  onClick={() => {
                    setDeleteConfirmText('');
                    setDeletePassword('');
                  }}
                  className="min-h-[44px]"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== 'DELETE' || !deletePassword}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Permanently Delete Account
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

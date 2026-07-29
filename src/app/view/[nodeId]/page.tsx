// ============================================================
// MODUL 57: Dedicated New-Tab Viewer — ALL file types supported
// Opens in a new browser tab like Google Drive — no download prompt
// Server component validates session + ownership before rendering
// NO publicAccessToken — all rendering via client-side libraries
// ============================================================

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { getMimePreviewType, getPreviewTier, getMimeLabel, type PreviewType, type PreviewTier } from '@/lib/mime-icons';
import { bigintToNumber } from '@/lib/bigint';
import { redirect } from 'next/navigation';
import { DedicatedViewerClient } from './dedicated-viewer-client';

interface ViewerPageProps {
  params: Promise<{ nodeId: string }>;
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  // 1. Validate session — if no session, redirect to home
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/');
  }

  const userId = session.user.id;
  const { nodeId } = await params;

  // 2. Fetch node metadata from DB (node + file_metadata)
  const node = await db.node.findUnique({
    where: { id: nodeId },
    include: { metadata: true },
  });

  // 3. If node not found, not a file, or soft-deleted → 404
  if (!node || node.type !== 'file' || node.deletedAt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <h1 className="text-2xl font-bold mb-2">404 — File Not Found</h1>
        <p className="text-muted-foreground mb-4">The file you are looking for does not exist or has been deleted.</p>
        <a href="/" className="text-sm text-primary hover:underline">← Back to workspace</a>
      </div>
    );
  }

  // 4. Check access via permission system
  const accessResult = await checkNodeAccess(userId, nodeId, 'view');
  if (!accessResult.hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <h1 className="text-2xl font-bold mb-2">403 — Access Denied</h1>
        <p className="text-muted-foreground mb-4">You do not have permission to view this file.</p>
        <a href="/" className="text-sm text-primary hover:underline">← Back to workspace</a>
      </div>
    );
  }

  // 5. Validate file metadata exists
  if (!node.metadata) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <h1 className="text-2xl font-bold mb-2">404 — Metadata Missing</h1>
        <p className="text-muted-foreground mb-4">File metadata is missing. The file may be corrupted.</p>
        <a href="/" className="text-sm text-primary hover:underline">← Back to workspace</a>
      </div>
    );
  }

  // 6. Determine preview type and tier — ALL tiers open in dedicated viewer now
  const mimeType = node.metadata.mimeType;
  const previewType: PreviewType = getMimePreviewType(mimeType);
  const previewTier: PreviewTier = getPreviewTier(mimeType);
  const mimeLabel = getMimeLabel(mimeType);

  // 7. Prepare data for client component
  const sizeBytes = bigintToNumber(node.metadata.sizeBytes) ?? 0;
  const checksumSha256 = node.metadata.checksumSha256 ?? null;

  // Pass data to client component — no publicAccessToken needed
  // All content fetched via /api/files/[nodeId]/content (session-authenticated)
  return (
    <DedicatedViewerClient
      nodeId={nodeId}
      name={node.name}
      mimeType={mimeType}
      previewType={previewType}
      previewTier={previewTier}
      mimeLabel={mimeLabel}
      sizeBytes={sizeBytes}
      checksumSha256={checksumSha256}
    />
  );
}

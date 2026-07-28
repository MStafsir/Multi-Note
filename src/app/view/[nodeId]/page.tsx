// ============================================================
// MODUL 54.4-54.5: Dedicated New-Tab Viewer — Server Component
// Validates session + ownership at server level BEFORE rendering shell
// Same-origin, same-app — NextAuth session automatically carries over
// Zero token-handoff mechanism needed for authenticated endpoints.
//
// MODUL 54.7: Also generates a one-time public access token for
// Google Docs Viewer integration. The token allows the public-content
// endpoint to serve file bytes without session auth.
// ============================================================

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkNodeAccess } from '@/lib/permissions';
import { getMimePreviewType, getPreviewTier, getMimeLabel, type PreviewType, type PreviewTier } from '@/lib/mime-icons';
import { bigintToNumber } from '@/lib/bigint';
import { generatePublicAccessToken } from '@/lib/public-file-access';
import { redirect } from 'next/navigation';
import { DedicatedViewerClient } from './dedicated-viewer-client';

interface ViewerPageProps {
  params: Promise<{ nodeId: string }>;
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  // 1. Validate session — if no session, redirect to signIn page
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

  // 6. Determine preview type and tier
  const mimeType = node.metadata.mimeType;
  const previewType: PreviewType = getMimePreviewType(mimeType);
  const previewTier: PreviewTier = getPreviewTier(mimeType);
  const mimeLabel = getMimeLabel(mimeType);

  // Only Tier 2/3 should use the dedicated viewer
  // If somehow a Tier 1 file lands here, show a message redirecting back
  if (previewTier === 'tier1_native') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <h1 className="text-2xl font-bold mb-2">This file is best viewed inline</h1>
        <p className="text-muted-foreground mb-4">
          Images, videos, audio, PDFs, and text files are previewed inline in the workspace.
          Please go back and double-click the file to preview it.
        </p>
        <a href="/" className="text-sm text-primary hover:underline">← Back to workspace</a>
      </div>
    );
  }

  // 7. Prepare data for client component
  const sizeBytes = bigintToNumber(node.metadata.sizeBytes) ?? 0;
  const checksumSha256 = node.metadata.checksumSha256 ?? null;

  // 8. Generate a temporary public access token for Google Docs Viewer
  // This token allows the /api/files/[nodeId]/public-content endpoint
  // to serve file content without session authentication.
  // The token is valid for 5 minutes (not one-time-use, since Google Docs
  // Viewer may make multiple HTTP requests).
  const publicAccessToken = generatePublicAccessToken(nodeId);

  // Pass data to client component wrapper for rendering
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
      publicAccessToken={publicAccessToken}
    />
  );
}

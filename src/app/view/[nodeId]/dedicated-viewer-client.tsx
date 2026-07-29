// ============================================================
// MODUL 57: Dedicated Viewer Client Wrapper
// 'use client' component that wraps DedicatedViewer.
// No publicAccessToken — all rendering is client-side,
// same-origin, session-authenticated.
// ============================================================

'use client';

import { DedicatedViewer } from '@/components/preview/dedicated-viewer';
import type { PreviewType, PreviewTier } from '@/lib/mime-icons';

interface DedicatedViewerClientProps {
  nodeId: string;
  name: string;
  mimeType: string;
  previewType: PreviewType;
  previewTier: PreviewTier;
  mimeLabel: string;
  sizeBytes: number;
  checksumSha256: string | null;
}

export function DedicatedViewerClient(props: DedicatedViewerClientProps) {
  return <DedicatedViewer {...props} />;
}

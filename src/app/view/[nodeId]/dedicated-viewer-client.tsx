// ============================================================
// MODUL 54.5: Dedicated Viewer Client Wrapper
// 'use client' component that wraps DedicatedViewer with
// additional props like publicAccessToken for Google Docs
// Viewer integration.
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
  publicAccessToken: string;
}

export function DedicatedViewerClient(props: DedicatedViewerClientProps) {
  return <DedicatedViewer {...props} />;
}

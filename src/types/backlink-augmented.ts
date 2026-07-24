// ============================================================
// MODUL 34: Backlink Type Augmentation
// Extends BacklinkInfo with isBroken and accessRevoked fields
// that are returned by the backlinks API but not in the base type
// (can't modify @/types/index.ts without [STACK CHANGE FLAG])
// ============================================================

import type { BacklinkInfo } from '@/types';

// Augmented BacklinkInfo with API-returned extended fields
export interface BacklinkInfoExtended extends BacklinkInfo {
  isBroken: boolean;     // true if source or target note is deleted
  accessRevoked?: boolean; // true if user doesn't have access to source note
}

// Backlink response type from the API
export interface BacklinkResponse {
  backlinks: BacklinkInfoExtended[];
  total: number;
}

// Graph response type from the API (extended with pagination and node info)
export interface GraphResponse {
  nodes: import('@/types').GraphNode[];
  edges: import('@/types').GraphEdge[];
  extendedNodeInfo: Array<{
    id: string;
    name: string;
    backlinkCount: number;
    isDeleted: boolean;
    isOwner: boolean;
  }>;
  total: number;
  hasMore: boolean;
}

// Note link update API response
export interface NoteLinkUpdateResponse {
  nodeId: string;
  linkCount: number;
  message: string;
}

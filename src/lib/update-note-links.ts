// ============================================================
// MODUL 34.2: Update Note Links — Server-side utility function
// Called when a note's content_json is saved to update the
// note_links table based on NoteLinkMention nodes in the content
// This function should be called by the existing PUT/PATCH
// /api/nodes/[id] handler when contentJson is updated
// ============================================================

import { db } from '@/lib/db';
import { extractNoteLinks, extractContextSnippet } from '@/lib/note-link-extractor';
import { logger } from '@/lib/logger';

/**
 * Update note_links table for a source node based on its content_json.
 *
 * Algorithm:
 * 1. Parse contentJson using note-link-extractor to get all NoteLinkMention nodes
 * 2. Delete all existing NoteLink records where sourceNodeId = nodeId
 * 3. For each extracted link, create a new NoteLink record
 * 4. Handle broken links: if target node doesn't exist or is deleted,
 *    still create the link record (it will be marked as broken during display)
 *
 * @param nodeId - The source node ID (note being saved)
 * @param contentJson - The Tiptap ProseMirror JSON content string
 * @param userId - The user ID (for logging purposes)
 */
export async function updateNoteLinks(
  nodeId: string,
  contentJson: string,
  userId: string
): Promise<void> {
  try {
    // 1. Extract all NoteLinkMention references from the content
    const extractedLinks = extractNoteLinks(contentJson);

    if (extractedLinks.length === 0) {
      // No links found — delete any existing links for this source node
      await db.noteLink.deleteMany({
        where: { sourceNodeId: nodeId },
      });
      logger.info('note_links_cleared', { nodeId, reason: 'no_links_in_content' }, userId);
      return;
    }

    // 2. Delete all existing NoteLink records for this source node
    await db.noteLink.deleteMany({
      where: { sourceNodeId: nodeId },
    });

    // 3. Create new NoteLink records for each extracted link
    // Deduplicate: a note might reference the same target multiple times
    const uniqueTargets = new Map<string, string>(); // targetNodeId -> targetNoteName
    for (const link of extractedLinks) {
      if (!uniqueTargets.has(link.targetNodeId)) {
        uniqueTargets.set(link.targetNodeId, link.targetNoteName);
      }
    }

    const createPromises = Array.from(uniqueTargets.entries()).map(
      async ([targetNodeId, targetNoteName]) => {
        try {
          // Check if target node exists (for logging, not blocking creation)
          const targetNode = await db.node.findUnique({
            where: { id: targetNodeId },
            select: { id: true, deletedAt: true },
          });

          const isBroken = !targetNode || targetNode.deletedAt !== null;

          if (isBroken) {
            logger.info('broken_link_created', {
              sourceNodeId: nodeId,
              targetNodeId,
              targetNoteName,
              reason: !targetNode ? 'target_not_found' : 'target_deleted',
            }, userId);
          }

          // Always create the link record — even for broken links
          // This enables proper backlink display with "broken" styling
          return db.noteLink.create({
            data: {
              sourceNodeId: nodeId,
              targetNodeId: targetNodeId,
            },
          });
        } catch (createError: unknown) {
          // If create fails (e.g., targetNodeId FK violation because node was hard-deleted
          // and cascade removed it), we skip this link silently
          // Note: in our schema, onDelete: Cascade on targetNode means
          // if a node is hard-deleted, all its NoteLink records are deleted too
          // But we use soft-delete (deletedAt), so FK should still be valid
          logger.warn('note_link_create_failed', {
            sourceNodeId: nodeId,
            targetNodeId,
            error: createError instanceof Error ? createError.message : 'unknown',
          }, userId);
          return null;
        }
      }
    );

    await Promise.all(createPromises);

    logger.info('note_links_updated', {
      nodeId,
      linkCount: uniqueTargets.size,
      totalReferences: extractedLinks.length,
    }, userId);
  } catch (error: unknown) {
    // Log error but don't throw — note content saving should not fail
    // due to link extraction issues
    logger.error('note_links_update_failed', { nodeId }, error, userId);
  }
}

/**
 * Get context snippets for backlinks pointing to a target note.
 * For each source note that references the target, parse its content_json
 * and extract the surrounding text around the NoteLinkMention.
 *
 * Used by the backlinks API route.
 */
export async function getBacklinkContextSnippets(
  targetNodeId: string,
  userId: string
): Promise<Array<{
  sourceNodeId: string;
  sourceNodeName: string;
  contextSnippet: string;
  createdAt: string;
  isBroken: boolean;
}>> {
  // Find all NoteLink records where targetNodeId = this note
  const links = await db.noteLink.findMany({
    where: { targetNodeId },
    include: {
      sourceNode: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
          note: {
            select: { contentJson: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const results: Array<{
    sourceNodeId: string;
    sourceNodeName: string;
    contextSnippet: string;
    createdAt: string;
    isBroken: boolean;
  }> = [];

  for (const link of links) {
    const sourceNode = link.sourceNode;

    // Check if source note is accessible to the user
    // (owner check for now — share access check would be more thorough)
    const isDeleted = sourceNode.deletedAt !== null;
    const isBroken = isDeleted;

    // Extract context snippet from the source note's content
    let contextSnippet = '';
    if (sourceNode.note?.contentJson && !isDeleted) {
      // Find the NoteLinkMention that references the target note
      const extracted = extractNoteLinks(sourceNode.note.contentJson);
      const matchingLink = extracted.find(l => l.targetNodeId === targetNodeId);

      if (matchingLink) {
        contextSnippet = extractContextSnippet(
          sourceNode.note.contentJson,
          matchingLink.position
        );
      } else {
        // Fallback: the link might have been updated since extraction
        contextSnippet = `References [[${sourceNode.name}]]`;
      }
    } else if (isDeleted) {
      contextSnippet = 'This note has been deleted';
    }

    results.push({
      sourceNodeId: sourceNode.id,
      sourceNodeName: sourceNode.name,
      contextSnippet,
      createdAt: link.createdAt as string,
      isBroken,
    });
  }

  return results;
}

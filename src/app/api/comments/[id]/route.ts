// ============================================================
// MODUL 35: In-Note Threaded Commenting System — Comment Detail API
// PATCH /api/comments/[id] — Update content or toggle resolve/unresolve
// DELETE /api/comments/[id] — Delete (only by author or node owner)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkNodeAccess } from '@/lib/permissions';

// PATCH /api/comments/[id] — Update comment content or resolve/unresolve
export async function PATCH(
  request: Request,
  context: unknown
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    const body = await request.json();
    const { content, resolved } = body;

    // Find the comment
    const comment = await db.comment.findUnique({
      where: { id },
      include: { node: { select: { ownerId: true } } },
    });

    if (!comment) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    }

    // Check access: user must have at least 'comment' level access
    const accessResult = await checkNodeAccess(userId, comment.nodeId, 'comment');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // --- Update content ---
    if (content !== undefined) {
      // Only author can update content
      if (comment.authorId !== userId) {
        return NextResponse.json({ success: false, error: 'Only the author can edit comment content' }, { status: 403 });
      }

      if (content.length > 2000) {
        return NextResponse.json({ success: false, error: 'Comment content must be 2000 characters or less' }, { status: 400 });
      }

      const updated = await db.comment.update({
        where: { id },
        data: { content },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: serializeComment(updated),
      });
    }

    // --- Toggle resolve/unresolve ---
    if (resolved !== undefined) {
      // Resolve: node owner or comment author or anyone with edit access
      const canResolve =
        comment.authorId === userId ||
        comment.node.ownerId === userId ||
        accessResult.permissionLevel === 'edit' ||
        accessResult.viaOwnerId;

      if (!canResolve) {
        return NextResponse.json({ success: false, error: 'Only the author, node owner, or users with edit access can resolve comments' }, { status: 403 });
      }

      const resolvedAt = resolved ? new Date().toISOString() : null;

      const updated = await db.comment.update({
        where: { id },
        data: { resolvedAt },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: serializeComment(updated),
      });
    }

    return NextResponse.json({ success: false, error: 'Provide content or resolved field to update' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update comment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/comments/[id] — Delete comment (only by author or node owner)
export async function DELETE(
  request: Request,
  context: unknown
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    const comment = await db.comment.findUnique({
      where: { id },
      include: { node: { select: { ownerId: true } } },
    });

    if (!comment) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    }

    // Delete allowed: author OR node owner
    const canDelete =
      comment.authorId === userId ||
      comment.node.ownerId === userId;

    if (!canDelete) {
      return NextResponse.json({ success: false, error: 'Only the comment author or node owner can delete comments' }, { status: 403 });
    }

    // If this is a root comment, delete all replies first
    if (!comment.parentCommentId) {
      await db.comment.deleteMany({
        where: { parentCommentId: id },
      });
    }

    // Delete the comment itself
    await db.comment.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete comment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================
// Helper: Serialize comment for API response
// ============================================================

interface SerializedComment {
  id: string;
  nodeId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  content: string;
  anchorPosition: Record<string, unknown> | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function serializeComment(comment: {
  id: string;
  nodeId: string;
  parentCommentId: string | null;
  authorId: string;
  content: string;
  anchorPosition: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null; email: string | null };
}): SerializedComment {
  return {
    id: comment.id,
    nodeId: comment.nodeId,
    parentCommentId: comment.parentCommentId,
    authorId: comment.authorId,
    authorName: comment.author?.name ?? null,
    authorEmail: comment.author?.email ?? null,
    content: comment.content,
    anchorPosition: comment.anchorPosition ? JSON.parse(comment.anchorPosition) : null,
    resolvedAt: comment.resolvedAt ? comment.resolvedAt.toISOString() : null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

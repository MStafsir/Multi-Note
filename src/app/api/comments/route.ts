// ============================================================
// MODUL 35: In-Note Threaded Commenting System — API Routes
// POST /api/comments — Create a new comment (with anchor_position, parent_comment_id)
// GET  /api/comments — List comments for a node (query: nodeId, includeResolved)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkNodeAccess } from '@/lib/permissions';
import { createNotification } from '@/lib/notification-sender';

// POST /api/comments — Create a new comment
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    const { nodeId, content, anchorPosition, parentCommentId } = body;

    if (!nodeId || !content) {
      return NextResponse.json({ success: false, error: 'nodeId and content are required' }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ success: false, error: 'Comment content must be 2000 characters or less' }, { status: 400 });
    }

    // Check user has at least 'comment' access to this node
    const accessResult = await checkNodeAccess(userId, nodeId, 'comment');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied — need comment permission' }, { status: 403 });
    }

    // If parentCommentId is provided, validate it and flatten reply-to-reply
    if (parentCommentId) {
      const parentComment = await db.comment.findUnique({
        where: { id: parentCommentId },
      });

      if (!parentComment) {
        return NextResponse.json({ success: false, error: 'Parent comment not found' }, { status: 404 });
      }

      if (parentComment.nodeId !== nodeId) {
        return NextResponse.json({ success: false, error: 'Parent comment must belong to the same node' }, { status: 400 });
      }

      // Flatten: if the parent itself has a parent (reply-to-reply), set parentCommentId to the ROOT
      if (parentComment.parentCommentId) {
        // This is a reply to a reply — flatten to root level
        const rootCommentId = parentComment.parentCommentId;
        // Verify root exists
        const rootComment = await db.comment.findUnique({ where: { id: rootCommentId } });
        if (!rootComment) {
          return NextResponse.json({ success: false, error: 'Root comment not found' }, { status: 404 });
        }
        // Use the root as the parent (max 1 level of nesting)
        const createdComment = await db.comment.create({
          data: {
            nodeId,
            authorId: userId,
            content,
            anchorPosition: anchorPosition ? JSON.stringify(anchorPosition) : null,
            parentCommentId: rootCommentId,
          },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        });

        // 35.5 — Check for @mentions in comment content and trigger notifications
        await processMentions(content, userId, nodeId);

        // 35.4 — If parent (root) comment is resolved, reopen it when new reply is added
        if (rootComment.resolvedAt) {
          await db.comment.update({
            where: { id: rootCommentId },
            data: { resolvedAt: null },
          });
        }

        return NextResponse.json({
          success: true,
          data: serializeComment(createdComment),
        });
      }
    }

    // Create comment (root or direct reply to root)
    const createdComment = await db.comment.create({
      data: {
        nodeId,
        authorId: userId,
        content,
        anchorPosition: anchorPosition ? JSON.stringify(anchorPosition) : null,
        parentCommentId: parentCommentId || null,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    // 35.5 — Process @mentions in comment content
    await processMentions(content, userId, nodeId);

    // If replying to a resolved comment, reopen it
    if (parentCommentId) {
      const parent = await db.comment.findUnique({ where: { id: parentCommentId } });
      if (parent?.resolvedAt) {
        await db.comment.update({
          where: { id: parentCommentId },
          data: { resolvedAt: null },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: serializeComment(createdComment),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create comment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/comments — List comments for a node
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const includeResolved = searchParams.get('includeResolved') === 'true';

    if (!nodeId) {
      return NextResponse.json({ success: false, error: 'nodeId query parameter required' }, { status: 400 });
    }

    // Check user has at least 'view' access to this node
    const accessResult = await checkNodeAccess(userId, nodeId, 'view');
    if (!accessResult.hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Build query filter
    const where: Record<string, unknown> = { nodeId };
    if (!includeResolved) {
      where.resolvedAt = null;
    }

    const comments = await db.comment.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group into threads: root comments + their replies
    const threads = groupIntoThreads(comments.map(serializeComment));

    return NextResponse.json({
      success: true,
      data: {
        comments: comments.map(serializeComment),
        threads,
        total: comments.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list comments';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================
// Helpers
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

interface CommentThreadGroup {
  root: SerializedComment;
  replies: SerializedComment[];
}

function groupIntoThreads(comments: SerializedComment[]): CommentThreadGroup[] {
  const rootComments = comments.filter(c => !c.parentCommentId);
  const repliesByRoot = new Map<string, SerializedComment[]>();

  for (const reply of comments.filter(c => c.parentCommentId)) {
    const existing = repliesByRoot.get(reply.parentCommentId!) || [];
    existing.push(reply);
    repliesByRoot.set(reply.parentCommentId!, existing);
  }

  return rootComments.map(root => ({
    root,
    replies: repliesByRoot.get(root.id) || [],
  }));
}

// 35.5 — Process @mentions in comment content and create notifications
async function processMentions(content: string, authorId: string, nodeId: string) {
  // Find all @username patterns in the content
  const mentionRegex = /@(\w[\w.-]*)/g;
  const mentions = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.add(match[1]);
  }

  if (mentions.size === 0) return;

  // Look up mentioned users who have access to the node
  for (const username of mentions) {
    // Try to find user by name or email prefix
    const user = await db.user.findFirst({
      where: {
        OR: [
          { name: { contains: username } },
          { email: { contains: username } },
        ],
      },
      select: { id: true, name: true },
    });

    if (user && user.id !== authorId) {
      // Check if the mentioned user has access to this node
      const access = await checkNodeAccess(user.id, nodeId, 'view');
      if (access.hasAccess) {
        await createNotification({
          recipientId: user.id,
          type: 'mention',
          payload: {
            commentNodeId: nodeId,
            mentionAuthorId: authorId,
            mentionAuthorName: await getAuthorName(authorId),
          },
        });
      }
    }
  }
}

async function getAuthorName(authorId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: authorId },
    select: { name: true, email: true },
  });
  return user?.name || user?.email || 'Unknown';
}

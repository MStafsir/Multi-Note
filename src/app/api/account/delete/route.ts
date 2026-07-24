// ============================================================
// Module 28: Delete Account Endpoint (Right-to-be-forgotten)
// DELETE endpoint: Hard-deletes ALL user data after confirmation
// NOT soft-delete — actual deletion per GDPR compliance
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compare } from '@/lib/password';
import { rm } from 'fs/promises';
import path from 'path';

export async function DELETE(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for confirmation and password
    const body = await request.json();
    const { confirm, password } = body as { confirm: boolean; password?: string };

    // Require explicit confirmation
    if (!confirm) {
      return NextResponse.json(
        { success: false, error: 'Deletion requires explicit confirmation (confirm: true)' },
        { status: 400 }
      );
    }

    // Require password verification
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password verification required for account deletion' },
        { status: 400 }
      );
    }

    // Verify user exists and password matches
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'No password set — cannot verify identity' },
        { status: 400 }
      );
    }

    const passwordValid = await compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid password — account deletion denied' },
        { status: 403 }
      );
    }

    // === HARD DELETE: All data related to ownerId ===

    // 1. Get all file nodes to find their storage paths for physical deletion
    const fileNodes = await db.node.findMany({
      where: { ownerId: userId, type: 'file' },
      include: { metadata: true, versions: true },
    });

    // 2. Delete physical files from storage
    // Delete individual file versions
    for (const fileNode of fileNodes) {
      // Delete all version files
      for (const version of fileNode.versions) {
        try {
          const versionPath = path.join(process.cwd(), 'download', version.storagePath);
          await rm(versionPath, { force: true });
        } catch {
          // File may already be deleted, ignore
        }
      }
      // Delete current file
      if (fileNode.metadata) {
        try {
          const filePath = path.join(process.cwd(), 'download', fileNode.metadata.storagePath);
          await rm(filePath, { force: true });
        } catch {
          // File may already be deleted, ignore
        }
      }
    }

    // 3. Delete entire user uploads directory (catches any orphaned files)
    const userUploadsDir = path.join(process.cwd(), 'download', 'uploads', userId);
    try {
      await rm(userUploadsDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist, ignore
    }

    // 4. Delete all Tag records owned by the user
    await db.tag.deleteMany({ where: { ownerId: userId } });

    // 5. Delete all Node records (cascade deletes: FileMetadata, NoteContent,
    //    NodeShare, NodeTag, ActivityLog→SetNull, FileVersion, NoteRevision)
    await db.node.deleteMany({ where: { ownerId: userId } });

    // 6. Delete ActivityLog records where actorId matches
    //    (Note: nodeId-related ones were cascade-deleted with nodes,
    //    but actorId-indexed ones where nodeId was null need separate deletion)
    await db.activityLog.deleteMany({ where: { actorId: userId } });

    // 7. Delete CalculationHistory records
    await db.calculationHistory.deleteMany({ where: { userId } });

    // 8. Delete Notification records
    await db.notification.deleteMany({ where: { recipientId: userId } });

    // 9. Delete NotificationPreference record
    await db.notificationPreference.deleteMany({ where: { userId } });

    // 10. Delete Profile record
    await db.profile.deleteMany({ where: { userId } });

    // 11. Delete Session records
    await db.session.deleteMany({ where: { userId } });

    // 12. Delete Account records (OAuth accounts)
    await db.account.deleteMany({ where: { userId } });

    // 13. Delete the User record itself
    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Account and all associated data have been permanently deleted',
        deletedUserId: userId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Account deletion failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

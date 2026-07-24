// ============================================================
// MODUL 39: Onboarding API — Track progress, seed sample content
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceHandler } from '@/lib/request-tracer';
import { z } from 'zod/v4';

// 39.5 — Onboarding checklist steps
const CHECKLIST_STEPS = [
  'upload_file',
  'create_note',
  'use_calculator',
  'use_command_palette',
  'create_folder',
  'use_search',
  'share_item',
];

// 39.2 — Sample content seeding payload schema
const seedSchema = z.object({
  seedSampleContent: z.boolean().default(true),
});

async function handleGetOnboarding(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const state = await db.onboardingState.findUnique({
    where: { userId },
  });

  if (!state) {
    // Create initial onboarding state for new user
    const newState = await db.onboardingState.create({
      data: { userId },
    });
    return NextResponse.json({
      success: true,
      data: {
        welcomeCompleted: newState.welcomeCompleted,
        sampleContentLoaded: newState.sampleContentLoaded,
        checklistProgress: JSON.parse(newState.checklistProgress),
        dismissedAt: newState.dismissedAt?.toISOString() || null,
        steps: CHECKLIST_STEPS,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      welcomeCompleted: state.welcomeCompleted,
      sampleContentLoaded: state.sampleContentLoaded,
      checklistProgress: JSON.parse(state.checklistProgress),
      dismissedAt: state.dismissedAt?.toISOString() || null,
      steps: CHECKLIST_STEPS,
    },
  });
}

async function handleUpdateOnboarding(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const updateSchema = z.object({
    welcomeCompleted: z.boolean().optional(),
    sampleContentLoaded: z.boolean().optional(),
    checklistStep: z.string().optional(), // step name to mark as completed
    dismiss: z.boolean().optional(),       // permanently dismiss onboarding
  });

  const validated = updateSchema.parse(body);

  // Get current state
  const current = await db.onboardingState.findUnique({ where: { userId } });
  const currentProgress = current ? JSON.parse(current.checklistProgress) : {};

  // Update checklist progress
  if (validated.checklistStep) {
    currentProgress[validated.checklistStep] = true;
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    checklistProgress: JSON.stringify(currentProgress),
  };

  if (validated.welcomeCompleted !== undefined) {
    updateData.welcomeCompleted = validated.welcomeCompleted;
  }
  if (validated.sampleContentLoaded !== undefined) {
    updateData.sampleContentLoaded = validated.sampleContentLoaded;
  }
  if (validated.dismiss) {
    updateData.dismissedAt = new Date();
    updateData.welcomeCompleted = true; // Dismiss implies welcome completed
  }

  // Upsert onboarding state
  const state = await db.onboardingState.upsert({
    where: { userId },
    create: {
      userId,
      welcomeCompleted: validated.welcomeCompleted ?? false,
      sampleContentLoaded: validated.sampleContentLoaded ?? false,
      checklistProgress: JSON.stringify(currentProgress),
      dismissedAt: validated.dismiss ? new Date() : null,
    },
    update: updateData,
  });

  logger.info('onboarding_updated', {
    step: validated.checklistStep,
    dismissed: validated.dismiss,
  }, userId);

  // 39.6 — Track onboarding funnel drop-off (extend Modul 36 metrics)
  if (validated.checklistStep) {
    await db.activityLog.create({
      data: {
        actorId: userId,
        actionType: 'edit',
        metadata: JSON.stringify({ onboarding_step: validated.checklistStep }),
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      welcomeCompleted: state.welcomeCompleted,
      sampleContentLoaded: state.sampleContentLoaded,
      checklistProgress: JSON.parse(state.checklistProgress),
      dismissedAt: state.dismissedAt?.toISOString() || null,
    },
  });
}

// 39.3 — Seed sample content endpoint
async function handleSeedContent(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = seedSchema.parse(body);

  if (!validated.seedSampleContent) {
    return NextResponse.json({ success: true, data: { seeded: false } });
  }

  // Check if already seeded
  const state = await db.onboardingState.findUnique({ where: { userId } });
  if (state?.sampleContentLoaded) {
    return NextResponse.json({ success: true, data: { seeded: false, reason: 'already_seeded' } });
  }

  // Create sample folder
  const sampleFolder = await db.node.create({
    data: {
      ownerId: userId,
      type: 'folder',
      name: 'Welcome — Getting Started',
      parentId: null,
    },
  });

  // Create sample note with tips
  const sampleNote = await db.node.create({
    data: {
      ownerId: userId,
      type: 'note',
      name: 'Tips & Quick Start Guide',
      parentId: sampleFolder.id,
      note: {
        create: {
          contentJson: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Welcome to Unified Workspace!' }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Here are the key features to get you started:' }],
              },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: '📁 ' },
                          { type: 'text', attrs: { bold: true }, text: 'File Storage' },
                          { type: 'text', text: ' — Upload and organize files in folders' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: '📝 ' },
                          { type: 'text', attrs: { bold: true }, text: 'Rich Notes' },
                          { type: 'text', text: ' — Create notes with rich text editing' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: '🧮 ' },
                          { type: 'text', attrs: { bold: true }, text: 'Calculator' },
                          { type: 'text', text: ' — Use the built-in calculator widget' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: '⌨️ ' },
                          { type: 'text', attrs: { bold: true }, text: 'Command Palette' },
                          { type: 'text', text: ' — Press Ctrl+K for quick actions' },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'You can delete this folder anytime — it\'s just a starting guide!' },
                ],
              },
            ],
          }),
        },
      },
    },
  });

  // Mark sample content as seeded
  await db.onboardingState.upsert({
    where: { userId },
    create: {
      userId,
      sampleContentLoaded: true,
      checklistProgress: '{}',
    },
    update: {
      sampleContentLoaded: true,
    },
  });

  logger.info('onboarding_sample_seeded', { folderId: sampleFolder.id, noteId: sampleNote.id }, userId);

  return NextResponse.json({
    success: true,
    data: {
      seeded: true,
      folderId: sampleFolder.id,
      noteId: sampleNote.id,
    },
  });
}

export const GET = traceHandler(handleGetOnboarding);
export const POST = traceHandler(handleUpdateOnboarding);
export const PUT = traceHandler(handleSeedContent);

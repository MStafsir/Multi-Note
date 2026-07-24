// ============================================================
// MODUL 33.2: System Built-in Template Seed Data
// 5 categories with structured placeholder blocks
// Tiptap ProseMirror JSON format (doc structure)
// ============================================================

import type { TemplateCategory } from '@/types';

interface SystemTemplateSeed {
  title: string;
  category: TemplateCategory;
  contentJsonTemplate: string;
}

// Helper: Build a ProseMirror doc from content blocks
function buildDoc(content: unknown[]): string {
  return JSON.stringify({ type: 'doc', content });
}

// Helper: Create a heading node
function heading(level: 1 | 2 | 3, text: string) {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  };
}

// Helper: Create a paragraph node
function paragraph(text: string) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
}

// Helper: Create an empty paragraph placeholder
function emptyParagraph() {
  return { type: 'paragraph' };
}

// Helper: Create a bullet list
function bulletList(items: string[]) {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  };
}

// Helper: Create a task list (todo pattern)
function taskList(items: string[], checked: boolean[] = []) {
  return {
    type: 'taskList',
    content: items.map((item, i) => ({
      type: 'taskItem',
      attrs: { checked: checked[i] || false },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  };
}

// --- Meeting Notes Template ---
const meetingNotesTemplate: SystemTemplateSeed = {
  title: 'Meeting Notes',
  category: 'meeting_notes',
  contentJsonTemplate: buildDoc([
    heading(1, 'Meeting Notes'),
    paragraph('Date: [Enter date]  ·  Location: [Enter location]'),
    heading(2, 'Attendees'),
    bulletList(['[Name 1]', '[Name 2]', '[Name 3]']),
    heading(2, 'Agenda'),
    bulletList([
      'Topic 1 — [Brief description]',
      'Topic 2 — [Brief description]',
      'Topic 3 — [Brief description]',
    ]),
    heading(2, 'Discussion Notes'),
    emptyParagraph(),
    heading(2, 'Action Items'),
    taskList([
      'Follow up on Topic 1',
      'Prepare report for Topic 2',
      'Schedule next meeting',
    ]),
    heading(2, 'Next Meeting'),
    paragraph('Date: [Enter next meeting date]  ·  Time: [Enter time]'),
    emptyParagraph(),
  ]),
};

// --- Project Plan Template ---
const projectPlanTemplate: SystemTemplateSeed = {
  title: 'Project Plan',
  category: 'project_plan',
  contentJsonTemplate: buildDoc([
    heading(1, 'Project Plan'),
    paragraph('Project: [Project name]  ·  Owner: [Owner name]  ·  Status: Planning'),
    heading(2, 'Objectives'),
    bulletList([
      'Objective 1 — [Description]',
      'Objective 2 — [Description]',
      'Objective 3 — [Description]',
    ]),
    heading(2, 'Timeline'),
    paragraph('Start: [Start date]  ·  End: [End date]  ·  Duration: [X weeks]'),
    heading(2, 'Milestones'),
    bulletList([
      'Milestone 1 — [Date] — [Description]',
      'Milestone 2 — [Date] — [Description]',
      'Milestone 3 — [Date] — [Description]',
    ]),
    heading(2, 'Tasks'),
    taskList([
      'Define project scope',
      'Assign team members',
      'Set up project workspace',
      'Draft initial budget',
      'Review stakeholder requirements',
    ]),
    emptyParagraph(),
  ]),
};

// --- Daily Journal Template ---
const journalTemplate: SystemTemplateSeed = {
  title: 'Daily Journal',
  category: 'journal',
  contentJsonTemplate: buildDoc([
    heading(1, 'Daily Journal'),
    paragraph('[Enter date]'),
    heading(2, 'Morning Reflection'),
    emptyParagraph(),
    heading(2, 'Gratitude'),
    bulletList(['[Something you are grateful for 1]', '[Something you are grateful for 2]', '[Something you are grateful for 3]']),
    heading(2, 'Reflections'),
    emptyParagraph(),
    heading(2, 'Tomorrow'),
    taskList(['[Plan for tomorrow 1]', '[Plan for tomorrow 2]', '[Plan for tomorrow 3]']),
    emptyParagraph(),
  ]),
};

// --- Weekly Review Template ---
const weeklyReviewTemplate: SystemTemplateSeed = {
  title: 'Weekly Review',
  category: 'weekly_review',
  contentJsonTemplate: buildDoc([
    heading(1, 'Weekly Review'),
    paragraph('Week of [Enter date range]'),
    heading(2, 'Wins'),
    bulletList(['[Win 1]', '[Win 2]', '[Win 3]']),
    heading(2, 'Challenges'),
    bulletList(['[Challenge 1]', '[Challenge 2]']),
    heading(2, 'Learnings'),
    emptyParagraph(),
    heading(2, 'Next Week Priorities'),
    taskList([
      'Priority 1 — [Description]',
      'Priority 2 — [Description]',
      'Priority 3 — [Description]',
    ]),
    emptyParagraph(),
  ]),
};

// --- Blank Template ---
const blankTemplate: SystemTemplateSeed = {
  title: 'Blank Note',
  category: 'blank',
  contentJsonTemplate: buildDoc([
    emptyParagraph(),
  ]),
};

// All system template seeds — used for seeding on first GET /api/templates
export const systemTemplateSeeds: SystemTemplateSeed[] = [
  meetingNotesTemplate,
  projectPlanTemplate,
  journalTemplate,
  weeklyReviewTemplate,
  blankTemplate,
];

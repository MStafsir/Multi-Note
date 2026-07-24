// ============================================================
// E2E Tests — Workspace Operations
// Tests: create folder → verify appears,
//        create note → verify appears and editor loads,
//        open calculator → verify works
// ============================================================

import { test, expect } from '@playwright/test';

test.describe('Workspace Operations', () => {
  // Assumes user is already authenticated (use storageState or setup)
  test.beforeEach(async ({ page }) => {
    // Navigate to workspace — for E2E we need to be logged in
    // In CI, this would use a saved auth state from a setup step
    await page.goto('/');
  });

  test('create folder → verify appears in workspace', async ({ page }) => {
    // Find the "New Folder" or "Create" button
    const createButton = page.locator('button', { hasText: /new folder|create folder|folder/i });
    if (await createButton.isVisible()) {
      await createButton.click();
    } else {
      // Try command palette approach
      await page.keyboard.press('Meta+K'); // or Control+K
      await page.locator('input[placeholder*="search" i]').fill('new folder');
      await page.locator('text=New Folder').click();
    }

    // Fill folder name in dialog if prompted
    const nameInput = page.locator('input[placeholder*="name" i]').or(page.locator('input[type="text"]'));
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test Folder');
      await page.locator('button', { hasText: /create|save|ok/i }).click();
    }

    // Verify folder appears in workspace
    await expect(page.locator('text=E2E Test Folder')).toBeVisible({ timeout: 10000 });
  });

  test('create note → verify appears and editor loads', async ({ page }) => {
    // Find the "New Note" or "Create Note" button
    const createNoteButton = page.locator('button', { hasText: /new note|create note|note/i });
    if (await createNoteButton.isVisible()) {
      await createNoteButton.click();
    } else {
      // Try command palette approach
      await page.keyboard.press('Meta+K');
      await page.locator('input[placeholder*="search" i]').fill('new note');
      await page.locator('text=New Note').click();
    }

    // Fill note name if prompted
    const nameInput = page.locator('input[placeholder*="name" i]').or(page.locator('input[type="text"]'));
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test Note');
      await page.locator('button', { hasText: /create|save|ok/i }).click();
    }

    // Verify note appears in workspace
    await expect(page.locator('text=E2E Test Note')).toBeVisible({ timeout: 10000 });

    // Click on the note to open editor
    await page.locator('text=E2E Test Note').click();

    // Verify editor loads (look for Tiptap editor indicators)
    await expect(page.locator('.tiptap').or(page.locator('[data-testid="note-editor"]')).or(page.locator('.ProseMirror'))).toBeVisible({ timeout: 10000 });
  });

  test('open calculator → verify it works', async ({ page }) => {
    // Open calculator via toggle button or command palette
    const calcButton = page.locator('button', { hasText: /calculator/i }).or(page.locator('[aria-label*="calculator" i]'));
    if (await calcButton.isVisible()) {
      await calcButton.click();
    } else {
      // Try keyboard shortcut: Ctrl+Shift+K
      await page.keyboard.press('Meta+Shift+K');
    }

    // Verify calculator is visible
    await expect(page.locator('[data-testid="calculator"]').or(page.locator('text=Basic')).or(page.locator('text=Scientific'))).toBeVisible({ timeout: 10000 });

    // Type a simple expression
    await page.locator('input[placeholder*="calculate" i]').or(page.locator('input[type="text"]')).fill('2+3');

    // Verify result
    await expect(page.locator('text=5')).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// E2E Tests — Authentication Flow
// Tests: register new user → verify workspace loads,
//        login existing user → verify workspace loads,
//        wrong password → verify error message
// ============================================================

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('register new user → verify workspace loads', async ({ page }) => {
    // Should see auth form on the home page
    await expect(page.locator('text=Create Account').or(page.locator('text=Register')).or(page.locator('text=Sign up'))).toBeVisible();

    // Switch to register mode if needed
    const registerTab = page.locator('button', { hasText: /register|create account|sign up/i });
    if (await registerTab.isVisible()) {
      await registerTab.click();
    }

    // Fill registration form
    const uniqueEmail = `e2e-test-${Date.now()}@example.com`;
    await page.locator('input[type="email"], input[placeholder*="email" i]').fill(uniqueEmail);
    await page.locator('input[type="password"], input[placeholder*="password" i]').fill('testpassword123');
    await page.locator('input[placeholder*="name" i]').fill('E2E Test User');

    // Submit registration
    await page.locator('button', { hasText: /register|create|sign up/i }).click();

    // Verify workspace loads after registration
    await expect(page.locator('text=My Workspace').or(page.locator('text=Workspace')).or(page.locator('[data-testid="workspace"]'))).toBeVisible({ timeout: 15000 });

    // Verify sidebar is visible
    await expect(page.locator('text=Favorites').or(page.locator('text=Activity')).or(page.locator('text=Trash'))).toBeVisible();
  });

  test('login existing user → verify workspace loads', async ({ page }) => {
    // Should see login form on the home page
    await expect(page.locator('text=Login').or(page.locator('text=Sign In')).or(page.locator('text=Welcome'))).toBeVisible();

    // Switch to login mode if needed
    const loginTab = page.locator('button', { hasText: /login|sign in/i });
    if (await loginTab.isVisible()) {
      await loginTab.click();
    }

    // Fill login form with existing user credentials
    await page.locator('input[type="email"], input[placeholder*="email" i]').fill('moduletester@test.com');
    await page.locator('input[type="password"], input[placeholder*="password" i]').fill('testpassword123');

    // Submit login
    await page.locator('button', { hasText: /login|sign in/i }).click();

    // Verify workspace loads after login
    await expect(page.locator('text=My Workspace').or(page.locator('text=Workspace')).or(page.locator('[data-testid="workspace"]'))).toBeVisible({ timeout: 15000 });
  });

  test('wrong password → verify error message', async ({ page }) => {
    // Should see login form
    const loginTab = page.locator('button', { hasText: /login|sign in/i });
    if (await loginTab.isVisible()) {
      await loginTab.click();
    }

    // Fill with wrong password
    await page.locator('input[type="email"], input[placeholder*="email" i]').fill('moduletester@test.com');
    await page.locator('input[type="password"], input[placeholder*="password" i]').fill('wrongpassword');

    // Submit login
    await page.locator('button', { hasText: /login|sign in/i }).click();

    // Verify error message appears
    await expect(page.locator('text=Invalid').or(page.locator('text=error')).or(page.locator('[role="alert"]'))).toBeVisible({ timeout: 5000 });
  });
});

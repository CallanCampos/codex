import { expect, test } from '@playwright/test'

test('app loads and step navigation updates current title', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  const title = page.getByTestId('current-entry-title')
  const firstTitle = (await title.textContent()) ?? ''

  await page.getByTestId('next-button').click()
  await expect(title).not.toHaveText(firstTitle)
})

test('deep-link hash opens requested pokemon', async ({ page }) => {
  await page.goto('/#pikachu')
  await page.getByTestId('enter-button').click()

  await expect(page.getByTestId('current-entry-title')).toHaveText(/Pikachu/i)
})
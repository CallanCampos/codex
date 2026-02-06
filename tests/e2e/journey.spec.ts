import { expect, test } from '@playwright/test'

test('app loads and step navigation updates current title', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  const title = page.getByTestId('current-entry-title')
  const firstTitle = (await title.textContent()) ?? ''

  await page.getByTestId('next-button').click()
  await expect(title).not.toHaveText(firstTitle)
  await expect(page).toHaveURL(/#.+/)
})

test('deep-link hash opens requested pokemon', async ({ page }) => {
  await page.goto('/#pikachu')
  await page.getByTestId('enter-button').click()

  await expect(page.getByTestId('current-entry-title')).toHaveText(/Pikachu/i)
  await expect(page.getByTestId('source-link')).toHaveAttribute(
    'href',
    /pokemon\.com\/us\/pokedex\/pikachu/,
  )
})

test('keyboard arrows navigate entries after entering journey', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  const title = page.getByTestId('current-entry-title')
  const before = (await title.textContent()) ?? ''
  await page.keyboard.press('ArrowRight')
  await expect(title).not.toHaveText(before)
})

test('compare mode shows ratio text for selected target', async ({ page }) => {
  await page.goto('/#pikachu')
  await page.getByTestId('enter-button').click()

  await page.getByTestId('compare-toggle').click()
  await page.getByTestId('compare-select').selectOption('charizard')
  await expect(page.getByTestId('compare-ratio')).toContainText(/taller than/i)
})

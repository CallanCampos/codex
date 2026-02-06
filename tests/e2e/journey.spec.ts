import { expect, test } from '@playwright/test'

test('app fills the viewport and wheel progresses through pokemon', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  const title = page.getByTestId('current-entry-title')
  const firstTitle = (await title.textContent()) ?? ''

  await page.mouse.wheel(0, 320)
  await expect(title).not.toHaveText(firstTitle)
  await expect(page).toHaveURL(/#.+/)
  await expect(page.locator('[data-testid^="pokemon-figure-"]')).toHaveCount(2)

  const viewportCheck = await page.evaluate(() => {
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      hasVerticalOverflow: document.documentElement.scrollHeight > window.innerHeight,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })

  expect(viewportCheck.bodyOverflow).toBe('hidden')
  expect(viewportCheck.htmlOverflow).toBe('hidden')
  expect(viewportCheck.hasVerticalOverflow).toBe(false)
  expect(viewportCheck.hasHorizontalOverflow).toBe(false)
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

test('user can jump to any pokemon and adjust zoom', async ({ page }) => {
  await page.goto('/#pikachu')
  await page.getByTestId('enter-button').click()

  await page.getByTestId('jump-input').fill('Charizard')
  await page.getByTestId('jump-button').click()
  await expect(page.getByTestId('current-entry-title')).toHaveText(/Charizard/i)
  await expect(page).toHaveURL(/#charizard/i)

  const activeImage = page.locator('[data-testid^="pokemon-figure-"] img').last()
  const before = Number.parseFloat((await activeImage.getAttribute('data-height-px')) ?? '0')
  await page.getByTestId('zoom-in').click()
  const after = Number.parseFloat((await activeImage.getAttribute('data-height-px')) ?? '0')
  expect(after).toBeGreaterThan(before)
})
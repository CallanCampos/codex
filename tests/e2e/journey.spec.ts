import { expect, test } from '@playwright/test'

test('active pokemon stays centered and wheel progresses smoothly', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  const title = page.getByTestId('current-entry-title')
  const firstTitle = (await title.textContent()) ?? ''

  await page.mouse.wheel(0, 260)
  await expect(title).not.toHaveText(firstTitle)
  await expect(page).toHaveURL(/#.+/)

  const activeSlug = await page.evaluate(() => {
    return window.location.hash.replace(/^#/, '')
  })
  const activeFigure = page.getByTestId(`pokemon-figure-${activeSlug}`)
  await expect(activeFigure).toBeVisible()

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const activeId = window.location.hash.replace(/^#/, '')
        const element = document.querySelector(
          `[data-testid="pokemon-figure-${activeId}"]`,
        ) as HTMLElement | null
        if (!element) {
          return Number.POSITIVE_INFINITY
        }

        const rect = element.getBoundingClientRect()
        const activeCenterX = rect.left + rect.width / 2
        const viewportCenterX = window.innerWidth / 2
        return Math.abs(activeCenterX - viewportCenterX)
      })
    })
    .toBeLessThan(20)
})

test('deep-link hash opens requested pokemon with description and source', async ({ page }) => {
  await page.goto('/#pikachu')
  await page.getByTestId('enter-button').click()

  await expect(page.getByTestId('current-entry-title')).toHaveText(/Pikachu/i)
  await expect(page.getByTestId('active-description')).toContainText(/pikachu/i)
  await expect(page.getByTestId('source-link')).toHaveAttribute(
    'href',
    /pokemon\.com\/us\/pokedex\/pikachu/,
  )
})

test('jump input uses height-ordered dataset and navigates to target', async ({ page }) => {
  await page.goto('/#joltik')
  await page.getByTestId('enter-button').click()

  const firstOption = page.locator('#pokemon-jump-list option').first()
  await expect(firstOption).toHaveAttribute('value', /Joltik/i)

  await page.getByTestId('jump-input').fill('Eternatus')
  await page.getByTestId('jump-button').click()

  await expect(page.getByTestId('current-entry-title')).toHaveText(/Eternatus/i)
  await expect(page).toHaveURL(/#eternatus/i)
})

test('viewport remains full-screen without page scrollbars', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

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

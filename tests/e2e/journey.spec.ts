import { expect, test } from '@playwright/test'

test('active pokemon stays centered and wheel progresses smoothly', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  const title = page.getByTestId('current-entry-title')
  const firstTitle = (await title.textContent()) ?? ''
  const firstSlug = await page.evaluate(() => window.location.hash.replace(/^#/, ''))
  await expect(page.getByTestId('list-counter')).toContainText('1 of')

  await page.mouse.wheel(0, -260)
  await expect(title).not.toHaveText(firstTitle)
  await expect(page).toHaveURL(/#.+/)
  await expect(page.getByTestId('list-counter')).toContainText('2 of')

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
  await expect(page.getByTestId(`pokemon-figure-${firstSlug}`)).toBeVisible()
})

test('deep-link hash opens requested pokemon with description and source', async ({ page }) => {
  await page.goto('/#pikachu')
  await page.getByTestId('enter-button').click()

  await expect(page.getByTestId('current-entry-title')).toHaveText(/Pikachu/i)
  await expect(page.getByTestId('active-focus-name')).toHaveText(/Pikachu/i)
  await expect(page.getByTestId('active-description')).not.toHaveText('')
  await expect(page.getByTestId('source-link')).toHaveAttribute(
    'href',
    /pokemon\.com\/us\/pokedex\/pikachu/,
  )
})

test('known mapped pokemon renders local 3d model canvas', async ({ page }) => {
  await page.goto('/#pikachu')
  await page.getByTestId('enter-button').click()

  await expect(page.getByTestId('current-entry-title')).toHaveText(/Pikachu/i)
  await expect(page.getByTestId('pokemon-model-pikachu')).toBeVisible()
})

test('jump button opens picker and navigates to selected pokemon', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  await page.getByTestId('jump-fab').click()
  await expect(page.getByTestId('jump-menu')).toBeVisible()
  await page.getByTestId('jump-select').selectOption('charizard')

  await expect(page.getByTestId('current-entry-title')).toHaveText(/Charizard/i)
  await expect(page).toHaveURL(/#charizard/i)
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

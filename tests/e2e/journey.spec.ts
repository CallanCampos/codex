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

test('music mute button toggles label', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-button').click()

  const muteButton = page.getByTestId('music-mute-button')
  await expect(muteButton).toHaveText(/Mute Music/i)
  await muteButton.click()
  await expect(muteButton).toHaveText(/Unmute Music/i)
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

test.describe('mobile swipe navigation', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } })

  test('swiping up and down moves exactly one pokemon per gesture', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('enter-button').click()
    await expect(page.getByTestId('list-counter')).toContainText('1 of')

    await page.evaluate(() => {
      const start = new Event('touchstart', { bubbles: true, cancelable: true })
      Object.defineProperty(start, 'touches', {
        value: [{ clientX: 180, clientY: 620 }],
      })
      window.dispatchEvent(start)

      const move = new Event('touchmove', { bubbles: true, cancelable: true })
      Object.defineProperty(move, 'touches', {
        value: [{ clientX: 180, clientY: 520 }],
      })
      window.dispatchEvent(move)

      const end = new Event('touchend', { bubbles: true, cancelable: true })
      Object.defineProperty(end, 'changedTouches', {
        value: [{ clientX: 180, clientY: 500 }],
      })
      window.dispatchEvent(end)
    })

    await expect(page.getByTestId('list-counter')).toContainText('2 of')

    await page.waitForTimeout(260)
    await page.evaluate(() => {
      const start = new Event('touchstart', { bubbles: true, cancelable: true })
      Object.defineProperty(start, 'touches', {
        value: [{ clientX: 180, clientY: 440 }],
      })
      window.dispatchEvent(start)

      const move = new Event('touchmove', { bubbles: true, cancelable: true })
      Object.defineProperty(move, 'touches', {
        value: [{ clientX: 180, clientY: 560 }],
      })
      window.dispatchEvent(move)

      const end = new Event('touchend', { bubbles: true, cancelable: true })
      Object.defineProperty(end, 'changedTouches', {
        value: [{ clientX: 180, clientY: 588 }],
      })
      window.dispatchEvent(end)
    })

    await expect(page.getByTestId('list-counter')).toContainText('1 of')
  })
})

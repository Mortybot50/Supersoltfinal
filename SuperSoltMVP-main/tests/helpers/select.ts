import { Page } from "@playwright/test"

/**
 * Helper function to interact with Radix/shadcn Select components in Playwright tests
 * 
 * Radix Select components render their content in a portal, which can be challenging
 * for Playwright to interact with. This helper handles the portal interaction reliably.
 * 
 * @param page - Playwright Page object
 * @param triggerText - Text of the select trigger button (e.g., "Select organization")
 * @param optionText - Text of the option to select (e.g., "Demo Bistro")
 */
export async function selectRadixOption(
  page: Page,
  triggerText: string,
  optionText: string
) {
  // Open the select by clicking the trigger button
  await page.getByRole("button", { name: triggerText }).click()

  // Wait for the portal content to be visible
  await page.waitForSelector('[data-radix-select-viewport]', { state: 'visible' })

  // Click the option within the portal
  // Radix puts content in a portal; target role=option or the item within viewport
  const option = page.locator(
    '[data-radix-select-viewport] [role="option"]',
    { hasText: optionText }
  )
  
  await option.first().click()
  
  // Wait for the portal to close
  await page.waitForSelector('[data-radix-select-viewport]', { state: 'hidden' })
}

/**
 * Alternative helper that uses data-testid to find the select trigger
 * 
 * @param page - Playwright Page object
 * @param triggerTestId - data-testid of the select trigger (e.g., "select-organisation")
 * @param optionText - Text of the option to select (e.g., "Demo Bistro")
 */
export async function selectRadixOptionByTestId(
  page: Page,
  triggerTestId: string,
  optionText: string
) {
  // Open the select by clicking the trigger using test ID
  await page.locator(`[data-testid="${triggerTestId}"]`).click()

  // Wait for the portal content to be visible
  await page.waitForSelector('[data-radix-select-viewport]', { state: 'visible' })

  // Click the option within the portal
  const option = page.locator(
    '[data-radix-select-viewport] [role="option"]',
    { hasText: optionText }
  )
  
  await option.first().click()
  
  // Wait for the portal to close
  await page.waitForSelector('[data-radix-select-viewport]', { state: 'hidden' })
}

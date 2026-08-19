import { expect, test, type Page } from '@playwright/test'
import { getFallbackArrangementForTests } from '../src/game/arrangement'
import { createInitialGameState } from '../src/game/state'
import { GAME_STORAGE_KEY } from '../src/game/storage'

function validBuildState(seed = 300) {
  const state = createInitialGameState('easy', seed)
  return { ...state, playerGroups: getFallbackArrangementForTests(seed + 1) }
}

async function seedGame(page: Page, state: ReturnType<typeof validBuildState>) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value)
    },
    { key: GAME_STORAGE_KEY, value: JSON.stringify(state) },
  )
}

test('完整完成组牌提交、十轮揭晓与结算', async ({ page }) => {
  await seedGame(page, validBuildState())
  await page.goto('/')
  const submit = page.getByRole('button', { name: /提交牌组/ })
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByText('电脑已锁定出牌')).toBeVisible()

  for (let round = 1; round <= 10; round += 1) {
    await page.locator('.battle-hand-option').first().click()
    await page.getByRole('button', { name: /确认出牌/ }).click()
    if (round < 10) await expect(page.getByText(`第 ${round + 1}`, { exact: false }).first()).toBeVisible()
  }

  await expect(page.getByText(/你赢下了这场暗战|电脑守住了牌桌|双方势均力敌/)).toBeVisible()
  await expect(page.locator('.result-round-card')).toHaveCount(10)
  await expect(page.getByRole('button', { name: /再来一局/ })).toBeVisible()
})

test('刷新后恢复待揭晓的对战状态', async ({ page }) => {
  await seedGame(page, validBuildState(400))
  await page.goto('/')
  await page.getByRole('button', { name: /提交牌组/ }).click()
  await page.locator('.battle-hand-option').first().click()
  await page.getByRole('button', { name: /确认出牌/ }).click()
  await expect(page.getByText('查看本局战报')).toBeVisible()
  await page.reload()
  await expect(page.getByText('第 2', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('电脑已锁定出牌')).toBeVisible()
})

test('手机布局可通过点击选牌并打开规则', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '仅在手机项目验证')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '把一副牌，变成十手牌' })).toBeVisible()
  await page.getByRole('button', { name: '黑桃A' }).click()
  await expect(page.getByText('51 张')).toBeVisible()
  await page.getByRole('button', { name: '规则' }).click({ force: true })
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '明白了，开始游戏' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

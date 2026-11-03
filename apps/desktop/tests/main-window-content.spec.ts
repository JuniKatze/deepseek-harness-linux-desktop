import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { SingleDocumentMainWindowContent } from '../src/main-window-content.ts'

describe('single-document main window content', () => {
  it('uses the BrowserWindow document for both shell and product responsibilities', async () => {
    const contents = {} as WebContents
    const loadURL = vi.fn(async () => {})
    const window = { webContents: contents, loadURL }
    const content = new SingleDocumentMainWindowContent(window)

    expect(content.chromeContents).toBe(contents)
    expect(content.productContents).toBe(contents)
    expect(content.productTop).toBe(0)
    await content.loadProduct('dsh-app://app/')
    expect(loadURL).toHaveBeenCalledExactlyOnceWith('dsh-app://app/')
  })
})

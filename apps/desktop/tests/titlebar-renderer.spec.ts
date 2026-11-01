import { readFileSync } from 'node:fs'
import { runInContext } from 'node:vm'
import { JSDOM } from 'jsdom'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveDesktopLocale } from '../src/locale.ts'
import type { DesktopTitlebarApi, DesktopTitlebarView } from '../src/titlebar-api.ts'

const html = readFileSync(new URL('../renderer/titlebar.html', import.meta.url), 'utf8')
const script = readFileSync(new URL('../renderer/titlebar.js', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../renderer/titlebar.css', import.meta.url), 'utf8')
const documents = new Set<JSDOM>()

function state(locale = 'en', maximized = false, theme: 'light' | 'dark' = 'light'): DesktopTitlebarView {
  const { messages } = resolveDesktopLocale(locale)
  return {
    locale, maximized, theme,
    messages: {
      menuBar: messages.menuBar, edit: messages.edit, windowMinimize: messages.windowMinimize,
      windowMaximize: messages.windowMaximize, windowRestore: messages.windowRestore, updateClose: messages.updateClose,
    },
  }
}

function mount(initial = Promise.resolve(state())) {
  const dom = new JSDOM(html, { url: 'dsh-app://shell/titlebar.html', runScripts: 'outside-only' })
  documents.add(dom)
  const listeners = new Set<(view: DesktopTitlebarView) => void>()
  const unsubscribe = vi.fn()
  const api = {
    status: vi.fn(() => initial),
    control: vi.fn<DesktopTitlebarApi['control']>().mockResolvedValue(undefined),
    openMenu: vi.fn<DesktopTitlebarApi['openMenu']>().mockResolvedValue(undefined),
    subscribe: vi.fn((listener: (view: DesktopTitlebarView) => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener); unsubscribe() }
    }),
  } satisfies DesktopTitlebarApi
  Object.defineProperty(dom.window, 'dshTitlebar', { value: api })
  const errors = vi.spyOn(dom.window.console, 'error').mockImplementation(() => {})
  runInContext(script, dom.getInternalVMContext())
  const button = (id: string): HTMLButtonElement => dom.window.document.getElementById(id) as HTMLButtonElement
  const publish = (view: DesktopTitlebarView): void => { for (const listener of listeners) listener(view) }
  return { dom, document: dom.window.document, api, initial, button, publish, unsubscribe, errors }
}

afterEach(() => {
  for (const dom of documents) {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'))
    dom.window.close()
  }
  documents.clear()
  vi.restoreAllMocks()
})

it.each(['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])('renders accessible labels from shell locale %s', async (locale) => {
  const view = state(locale)
  const fixture = mount(Promise.resolve(view))
  expect(fixture.document.querySelectorAll('button:disabled')).toHaveLength(5)
  await fixture.initial
  expect(fixture.document.documentElement.lang).toBe(locale)
  expect(fixture.document.title).toBe('')
  for (const [id, label] of [
    ['application-menu', view.messages.menuBar], ['edit-menu', view.messages.edit],
    ['minimize', view.messages.windowMinimize], ['maximize', view.messages.windowMaximize], ['close', view.messages.updateClose],
  ] as const) {
    const button = fixture.button(id)
    expect(label).not.toBe('')
    expect(button.getAttribute('aria-label')).toBe(label)
    expect(button.title).toBe(label)
    expect(button.disabled).toBe(false)
    button.focus()
    expect(fixture.document.activeElement).toBe(button)
  }
  expect(fixture.document.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(5)
})

it('follows main-owned theme, locale and maximized state', async () => {
  const fixture = mount()
  await fixture.initial
  const icon = fixture.document.getElementById('maximize-icon')!
  expect(fixture.document.body.hasAttribute('data-ds-dark-theme')).toBe(false)
  expect(fixture.document.documentElement.style.colorScheme).toBe('light')
  expect(icon.getAttribute('d')).toBe('M3.5 3.5h9v9h-9z')
  fixture.publish(state('zh', true, 'dark'))
  expect(fixture.document.documentElement.lang).toBe('zh')
  expect(fixture.document.body.hasAttribute('data-ds-dark-theme')).toBe(true)
  expect(fixture.document.documentElement.style.colorScheme).toBe('dark')
  expect(fixture.document.getElementById('titlebar')!.hasAttribute('data-maximized')).toBe(true)
  expect(fixture.button('maximize').getAttribute('aria-label')).toBe('还原')
  expect(icon.getAttribute('d')).toBe('M5.5 5.5v-2h7v7h-2M3.5 6.5h6v6h-6z')
  fixture.publish(state())
  expect(fixture.document.body.hasAttribute('data-ds-dark-theme')).toBe(false)
  expect(fixture.button('maximize').getAttribute('aria-label')).toBe('Maximize')
  expect(fixture.document.getElementById('titlebar')!.hasAttribute('data-maximized')).toBe(false)
})

it('does not overwrite a state notification with a delayed initial response', async () => {
  const initial = Promise.withResolvers<DesktopTitlebarView>()
  const fixture = mount(initial.promise)
  fixture.publish(state('zh', true, 'dark'))
  initial.resolve(state())
  await fixture.initial
  expect(fixture.document.documentElement.lang).toBe('zh')
  expect(fixture.button('maximize').title).toBe('还原')
})

it('sends window commands and limits double-click to blank titlebar space', async () => {
  const fixture = mount()
  await fixture.initial
  fixture.button('minimize').click()
  fixture.button('maximize').click()
  fixture.button('close').click()
  for (const id of ['titlebar', 'drag-space', 'maximize']) {
    fixture.document.getElementById(id)!.dispatchEvent(new fixture.dom.window.MouseEvent('dblclick', { bubbles: true }))
  }
  fixture.button('application-menu').querySelector('path')!.dispatchEvent(new fixture.dom.window.MouseEvent('dblclick', { bubbles: true }))
  expect(fixture.api.control.mock.calls).toEqual([
    ['minimize'], ['toggle-maximize'], ['close'], ['toggle-maximize'], ['toggle-maximize'],
  ])
})

it.each(['application', 'edit'] as const)('anchors the %s menu and keeps it expanded until the native menu closes', async (name) => {
  const fixture = mount()
  await fixture.initial
  const popup = Promise.withResolvers<undefined>()
  fixture.api.openMenu.mockReturnValueOnce(popup.promise)
  const button = fixture.button(name + '-menu')
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
    x: 4, y: 4, width: 32, height: 32, left: 4, top: 4, right: 36, bottom: 36, toJSON: () => ({}),
  })
  button.click()
  expect(fixture.api.openMenu).toHaveBeenCalledExactlyOnceWith(name, 4, 36)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  fixture.button(name === 'application' ? 'edit-menu' : 'application-menu').click()
  expect(fixture.api.openMenu).toHaveBeenCalledTimes(1)
  popup.resolve(undefined)
  await vi.waitFor(() => { expect(button.getAttribute('aria-expanded')).toBe('false') })
})

it('reports menu failure and clears expanded state', async () => {
  const fixture = mount()
  await fixture.initial
  const error = new Error('native menu failed')
  const popup = Promise.withResolvers<undefined>()
  fixture.api.openMenu.mockReturnValueOnce(popup.promise)
  fixture.button('application-menu').click()
  popup.reject(error)
  await vi.waitFor(() => { expect(fixture.errors).toHaveBeenCalledWith(error) })
  expect(fixture.button('application-menu').getAttribute('aria-expanded')).toBe('false')
  fixture.button('edit-menu').click()
  expect(fixture.api.openMenu).toHaveBeenCalledTimes(2)
})

it('reports status and control failures to the console', async () => {
  const initial = Promise.withResolvers<DesktopTitlebarView>()
  const fixture = mount(initial.promise)
  const statusError = new Error('titlebar status failed')
  initial.reject(statusError)
  await vi.waitFor(() => { expect(fixture.errors).toHaveBeenCalledWith(statusError) })
  expect(fixture.document.querySelectorAll('button:disabled')).toHaveLength(5)
  fixture.publish(state())
  const controlError = new Error('window control failed')
  fixture.api.control.mockRejectedValueOnce(controlError)
  fixture.button('minimize').click()
  await vi.waitFor(() => { expect(fixture.errors).toHaveBeenCalledWith(controlError) })
})

it('removes its main-process subscription when leaving the page', async () => {
  const fixture = mount()
  await fixture.initial
  fixture.dom.window.dispatchEvent(new fixture.dom.window.Event('pagehide'))
  expect(fixture.unsubscribe).toHaveBeenCalledTimes(1)
  fixture.publish(state('zh', true, 'dark'))
  expect(fixture.document.documentElement.lang).toBe('en')
})

it('loads only shell assets and keeps the caption at 40px with focus styling', async () => {
  const fixture = mount()
  await fixture.initial
  const { document } = fixture
  expect([...document.querySelectorAll('script')].map(script => script.getAttribute('src'))).toEqual(['titlebar.js'])
  expect([...document.querySelectorAll('link')].map(link => link.getAttribute('href'))).toEqual(['design-platform.css', 'titlebar.css'])
  expect(document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')).toContain("default-src 'none'")
  const style = document.createElement('style')
  style.textContent = styles
  document.head.append(style)
  expect(fixture.dom.window.getComputedStyle(document.getElementById('titlebar')!).height).toBe('40px')
  expect(fixture.dom.window.getComputedStyle(fixture.button('application-menu')).width).toBe('32px')
  expect(fixture.dom.window.getComputedStyle(fixture.button('close')).width).toBe('38px')
  expect(styles).toContain('-webkit-app-region: drag')
  expect(styles).toContain('-webkit-app-region: no-drag')
  expect(styles).toContain(':focus-visible')
})

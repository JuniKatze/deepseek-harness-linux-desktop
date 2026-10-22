import { useEffect, useState } from 'react'
import css from './DesktopTitlebar.module.css'

interface DesktopWindowState {
  readonly maximized: boolean
  readonly fullscreen: boolean
}

interface DesktopWindowBridge {
  control(action: 'minimize' | 'toggle-maximize' | 'close'): Promise<void>
  state(): Promise<DesktopWindowState>
  openMenu(name: 'application' | 'edit', x: number, y: number): Promise<void>
  subscribe(listener: (state: DesktopWindowState) => void): () => void
}

type TitlebarLabel =
  | 'close'
  | 'edit'
  | 'window.applicationMenu'
  | 'window.minimize'
  | 'window.maximize'
  | 'window.restore'

interface DesktopTitlebarProps {
  readonly t: (key: TitlebarLabel) => string
}

/** Resolve the narrow, origin-scoped native-window bridge injected by Desktop. */
function desktopWindowBridge(): DesktopWindowBridge | undefined {
  return (globalThis as typeof globalThis & {
    dshDesktop?: { readonly window?: DesktopWindowBridge }
  }).dshDesktop?.window
}

/** Read the current document title without the desktop product suffix. */
function documentTitle(): string {
  const value = document.title.replace(/\s+[—-]\s+DeepSeek Harness$/u, '').trim()
  return value === '' ? 'DeepSeek Harness' : value
}

function MinimizeIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5h9" /></svg>
}

function MaximizeIcon(props: { restored: boolean }) {
  return props.restored
    ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5v-2h7v7h-2M3.5 6.5h6v6h-6z" /></svg>
    : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5h9v9h-9z" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
}

/**
 * Linux frameless-window caption.
 *
 * The bar is purely presentational: it talks to the Desktop preload bridge for
 * privileged window commands, while an external UI plugin can shadow the
 * containing `shell.titlebar` slot without gaining access to Electron itself.
 */
export function DesktopTitlebar({ t }: DesktopTitlebarProps) {
  const bridge = desktopWindowBridge()
  const [state, setState] = useState<DesktopWindowState>({ maximized: false, fullscreen: false })
  const [title, setTitle] = useState(() => documentTitle())
  const [openMenu, setOpenMenu] = useState<'application' | 'edit' | undefined>()

  useEffect(() => {
    if (bridge === undefined) return
    let active = true
    void bridge.state().then((next) => {
      if (active) setState(next)
    })
    const dispose = bridge.subscribe((next) => { setState(next) })
    return () => {
      active = false
      dispose()
    }
  }, [bridge])

  useEffect(() => {
    const update = (): void => { setTitle(documentTitle()) }
    const observer = new MutationObserver(update)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    update()
    return () => { observer.disconnect() }
  }, [])

  if (bridge === undefined) return null

  const control = (action: 'minimize' | 'toggle-maximize' | 'close'): void => {
    void bridge.control(action)
  }
  const menu = async (name: 'application' | 'edit', button: HTMLButtonElement): Promise<void> => {
    if (openMenu !== undefined) return
    const rect = button.getBoundingClientRect()
    setOpenMenu(name)
    try {
      await bridge.openMenu(name, rect.left, rect.bottom)
    } finally {
      setOpenMenu(undefined)
    }
  }

  return (
    <div
      className={css.titlebar}
      data-desktop-titlebar
      data-maximized={state.maximized || undefined}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) control('toggle-maximize')
      }}
    >
      <div className={css.menuBar} role="menubar">
        <button
          type="button"
          className={css.menuButton}
          data-menu="application"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'application'}
          aria-label={t('window.applicationMenu')}
          title={t('window.applicationMenu')}
          onClick={(event) => { void menu('application', event.currentTarget) }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10" /></svg>
        </button>
        <button
          type="button"
          className={css.menuButton}
          data-menu="edit"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'edit'}
          aria-label={t('edit')}
          title={t('edit')}
          onClick={(event) => { void menu('edit', event.currentTarget) }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 10.8-.5 2.2 2.2-.5 6.6-6.6-1.7-1.7zM9.4 5l1.7 1.7" /></svg>
        </button>
      </div>
      <div className={css.identity}>
        <span className={css.title} title={title}>{title}</span>
      </div>
      <div className={css.dragSpace} aria-hidden="true" />
      <div className={css.windowControls}>
        <button type="button" data-control="minimize" aria-label={t('window.minimize')} title={t('window.minimize')} onClick={() => { control('minimize') }}>
          <MinimizeIcon />
        </button>
        <button
          type="button"
          data-control="maximize"
          aria-label={state.maximized ? t('window.restore') : t('window.maximize')}
          title={state.maximized ? t('window.restore') : t('window.maximize')}
          onClick={() => { control('toggle-maximize') }}
        >
          <MaximizeIcon restored={state.maximized} />
        </button>
        <button type="button" data-control="close" aria-label={t('close')} title={t('close')} onClick={() => { control('close') }}>
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

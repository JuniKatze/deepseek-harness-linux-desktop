/** 壳标题栏只使用主进程提供的状态和标签，不读取工作区页面。 */
const api = window.dshTitlebar
const titlebar = document.getElementById('titlebar')
const dragSpace = document.getElementById('drag-space')
const application = document.getElementById('application-menu')
const edit = document.getElementById('edit-menu')
const minimize = document.getElementById('minimize')
const maximize = document.getElementById('maximize')
const close = document.getElementById('close')
let menuOpen = false

function render(view) {
  document.documentElement.lang = view.locale
  document.body.toggleAttribute('data-ds-dark-theme', view.theme === 'dark')
  document.documentElement.style.colorScheme = view.theme
  titlebar.toggleAttribute('data-maximized', view.maximized)
  for (const [button, label] of [
    [application, view.messages.menuBar],
    [edit, view.messages.edit],
    [minimize, view.messages.windowMinimize],
    [maximize, view.maximized ? view.messages.windowRestore : view.messages.windowMaximize],
    [close, view.messages.updateClose],
  ]) {
    button.setAttribute('aria-label', label)
    button.title = label
    button.disabled = false
  }
  document.getElementById('maximize-icon').setAttribute('d', view.maximized
    ? 'M5.5 5.5v-2h7v7h-2M3.5 6.5h6v6h-6z'
    : 'M3.5 3.5h9v9h-9z')
}

async function openMenu(name, button) {
  if (menuOpen) return
  menuOpen = true
  button.setAttribute('aria-expanded', 'true')
  const rect = button.getBoundingClientRect()
  try {
    await api.openMenu(name, rect.left, rect.bottom)
  } finally {
    menuOpen = false
    button.setAttribute('aria-expanded', 'false')
  }
}

application.addEventListener('click', () => { void openMenu('application', application).catch(console.error) })
edit.addEventListener('click', () => { void openMenu('edit', edit).catch(console.error) })
minimize.addEventListener('click', () => { void api.control('minimize').catch(console.error) })
maximize.addEventListener('click', () => { void api.control('toggle-maximize').catch(console.error) })
close.addEventListener('click', () => { void api.control('close').catch(console.error) })
titlebar.addEventListener('dblclick', (event) => {
  if (event.target === titlebar || event.target === dragSpace) void api.control('toggle-maximize').catch(console.error)
})

// 订阅先于初始查询，查询结果不能覆盖已收到的窗口变化。
let received = false
const unsubscribe = api.subscribe(view => { received = true; render(view) })
window.addEventListener('pagehide', unsubscribe, { once: true })
void api.status().then(view => { if (!received) render(view) }).catch(console.error)

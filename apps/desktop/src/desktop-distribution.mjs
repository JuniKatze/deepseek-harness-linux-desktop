/** Linux 社区桌面的发行数据；运行时与打包脚本共同读取，避免身份值分叉。 */

/** Linux 并行安装版使用的稳定发行身份。 */
export const LINUX_DESKTOP_DISTRIBUTION = /** @type {const} */ (Object.freeze({
  appId: 'io.github.junikatze.dsh-linux-desktop',
  productName: 'DSH Linux Desktop',
  executableName: 'dsh-linux-desktop',
  debPackageName: 'dsh-desktop-linux',
  protocolScheme: 'dsh-linux',
  profileName: 'linux-desktop',
  userDataDirectoryName: 'DSH Linux Desktop',
  cliLauncherName: 'dsh-linux',
  homepage: 'https://github.com/JuniKatze/deepseek-harness-linux-desktop',
  maintainer: 'JuniKatze <183716199+JuniKatze@users.noreply.github.com>',
  vendor: 'JuniKatze community',
  synopsis: 'Unofficial DeepSeek Harness desktop application for Debian Linux',
  description: 'Unofficial community Electron desktop shell for a bundled DeepSeek Harness runtime and external plugins on Debian Linux.',
}))

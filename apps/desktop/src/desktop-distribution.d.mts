/** Linux 并行安装版使用的稳定发行身份。 */
export interface LinuxDesktopDistribution {
  readonly appId: string
  readonly productName: string
  readonly executableName: string
  readonly debPackageName: string
  readonly protocolScheme: 'dsh-linux'
  readonly profileName: 'linux-desktop'
  readonly userDataDirectoryName: string
  readonly cliLauncherName: string
  readonly homepage: string
  readonly maintainer: string
  readonly vendor: string
  readonly synopsis: string
  readonly description: string
}

/** Linux 社区桌面运行时和打包脚本共同读取的发行数据。 */
export const LINUX_DESKTOP_DISTRIBUTION: Readonly<LinuxDesktopDistribution>

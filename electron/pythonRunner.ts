import { ChildProcessByStdio, execFile, spawn } from 'node:child_process'
import { app } from 'electron'
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  readFileSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { Readable } from 'node:stream'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ChaoxingConfig {
  username: string
  password: string
  cookies: string
  courseList: string
  speed: number
  jobs: number
  useCookies: boolean
}

export interface RunnerResult {
  ok: boolean
  message: string
}

export interface CourseInfo {
  courseId: string
  title: string
}

export interface CourseListResult extends RunnerResult {
  courses: CourseInfo[]
}

type LogLevel = 'info' | 'stdout' | 'stderr' | 'error'

export interface RunnerLog {
  level: LogLevel
  message: string
  timestamp: string
}

export interface RunnerProgress {
  status: 'idle' | 'preparing' | 'running' | 'stopping' | 'finished' | 'error'
  currentChapter: string
  currentTask: string
  currentCourse: string
  videoTitle: string
  percent: number | null
  elapsed: string
  total: string
  completedCourses: number
  totalCourses: number | null
  completedTasks: number
  unfinishedTasks: number | null
  totalTasks: number | null
  retryText: string
  rawLogPath: string
  updatedAt: string
}

type LogSink = (log: RunnerLog) => void
type ProgressSink = (progress: RunnerProgress) => void

const appSupportDir = join(homedir(), 'Library', 'Application Support', 'bk学习捅')
const configPath = join(appSupportDir, 'config.ini')
const cookiesPath = join(appSupportDir, 'cookies.txt')
const bundledCorePath = join(process.resourcesPath, 'core', 'chaoxing')
const bundledUvPath = join(process.resourcesPath, 'runtime', 'uv', 'uv')
const bundledPythonPath = join(process.resourcesPath, 'runtime', 'python', 'bin', 'python3.13')
const bundledPythonPackagesPath = join(process.resourcesPath, 'runtime', 'python-packages')
const runtimeCorePath = join(appSupportDir, 'core', 'chaoxing')
const corePath = app.isPackaged ? runtimeCorePath : resolve(process.cwd(), 'core', 'chaoxing')
const diagnosticsDir = join(appSupportDir, 'diagnostics')
const diagnosticsPath = join(diagnosticsDir, 'latest.txt')
const appLogPath = join(appSupportDir, 'app.log')
const rawLogPath = join(appSupportDir, 'raw.log')
const runtimeCoreVersion = '2026-05-17-bk-runtime-speed8'
const runtimeCoreVersionPath = join(runtimeCorePath, '.chaoxingmac-core-version')
const extraPathEntries = [
  join(homedir(), '.local', 'bin'),
  join(homedir(), '.cargo', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin'
]

let currentProcess: ChildProcessByStdio<null, Readable, Readable> | null = null
let currentConfig: ChaoxingConfig | null = null
let uvPath: string | null = null
let runnerMode: 'bundled' | 'uv' = 'uv'
let sendLog: LogSink = () => undefined
let sendProgress: ProgressSink = () => undefined
let progressState: RunnerProgress = createInitialProgress()

export function setLogSink(sink: LogSink): void {
  sendLog = sink
}

export function setProgressSink(sink: ProgressSink): void {
  sendProgress = sink
}

export async function startChaoxing(config: ChaoxingConfig): Promise<RunnerResult> {
  if (currentProcess) {
    return { ok: false, message: 'Chaoxing 任务已经在运行中。' }
  }

  currentConfig = normalizeConfig(config)

  mkdirSync(appSupportDir, { recursive: true })
  resetAppLog()
  resetRawLog()
  resetProgress('preparing')
  appendRawLog('info', `App packaged=${app.isPackaged}`)
  appendRawLog('info', `process.cwd=${process.cwd()}`)
  appendRawLog('info', `resourcesPath=${process.resourcesPath}`)
  appendRawLog('info', `corePath=${corePath}`)
  appendRawLog('info', `runnerMode=${runnerMode}`)

  const validation = validateConfig(currentConfig)
  if (!validation.ok) {
    log('error', validation.message)
    currentConfig = null
    return validation
  }

  const envCheck = await checkEnvironment()
  if (!envCheck.ok) {
    log('error', envCheck.message)
    currentConfig = null
    return envCheck
  }

  log('info', `准备写入配置：${JSON.stringify(redactedConfig(currentConfig))}`)
  writeFileSync(configPath, buildConfigIni(currentConfig), { encoding: 'utf8', mode: 0o600 })
  writeFileSync(cookiesPath, currentConfig.useCookies ? currentConfig.cookies.trim() : '', {
    encoding: 'utf8',
    mode: 0o600
  })
  ensureCookieSymlink()

  log('info', `配置已写入 ${configPath}`)
  log('info', buildLaunchSummary())
  updateProgress({ status: 'running', retryText: '' })

  const child = spawnChaoxing()
  currentProcess = child

  child.stdout.on('data', (chunk: Buffer) => {
    handleProcessOutput('stdout', chunk.toString('utf8'))
  })

  child.stderr.on('data', (chunk: Buffer) => {
    handleProcessOutput('stderr', chunk.toString('utf8'))
  })

  child.on('error', (error) => {
    log('error', sanitizeLog(error.message))
  })

  child.on('close', (code, signal) => {
    log('info', `子进程已退出，code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    updateProgress({ status: code === 0 ? 'finished' : 'error' })
    currentProcess = null
    currentConfig = null
  })

  return { ok: true, message: 'Chaoxing 子进程已启动。' }
}

export async function stopChaoxing(): Promise<RunnerResult> {
  if (!currentProcess) {
    return { ok: true, message: '当前没有正在运行的 Chaoxing 任务。' }
  }

  const pid = currentProcess.pid
  try {
    if (pid) {
      updateProgress({ status: 'stopping' })
      process.kill(-pid, 'SIGTERM')
    } else {
      currentProcess.kill('SIGTERM')
    }
    log('info', '已发送停止信号。')
    return { ok: true, message: '已请求停止 Chaoxing 子进程。' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('error', `停止失败：${message}`)
    return { ok: false, message }
  }
}

export async function fetchCourseList(config: ChaoxingConfig): Promise<CourseListResult> {
  if (currentProcess) {
    return { ok: false, message: '请先停止正在运行的 Chaoxing 任务。', courses: [] }
  }

  const normalizedConfig = normalizeConfig(config)
  mkdirSync(appSupportDir, { recursive: true })
  resetAppLog()
  resetRawLog()
  resetProgress('preparing')
  log('info', '开始获取课程列表。')

  const validation = validateLoginConfig(normalizedConfig)
  if (!validation.ok) {
    log('error', validation.message)
    return { ...validation, courses: [] }
  }

  const envCheck = await checkEnvironment()
  if (!envCheck.ok) {
    log('error', envCheck.message)
    return { ...envCheck, courses: [] }
  }

  writeFileSync(cookiesPath, normalizedConfig.useCookies ? normalizedConfig.cookies.trim() : '', {
    encoding: 'utf8',
    mode: 0o600
  })
  ensureCookieSymlink()

  try {
    const inlineScript = [
          'import json, os',
          'from api.base import Chaoxing, Account',
          'username = os.environ.get("CHAOXING_USERNAME", "")',
          'password = os.environ.get("CHAOXING_PASSWORD", "")',
          'use_cookies = os.environ.get("CHAOXING_USE_COOKIES", "false").lower() == "true"',
          'cx = Chaoxing(Account(username, password))',
          'result = cx.login(login_with_cookies=use_cookies)',
          'if not result.get("status"):',
          '    raise RuntimeError(result.get("msg", "登录失败"))',
          'courses = cx.get_course_list()',
          'payload = [{"courseId": str(item.get("courseId", "")), "title": str(item.get("title", ""))} for item in courses]',
          'print("CHAOXING_COURSES_JSON_START")',
          'print(json.dumps(payload, ensure_ascii=False))',
          'print("CHAOXING_COURSES_JSON_END")'
        ].join('\n')
    const command = buildInlinePythonCommand(inlineScript)
    const { stdout, stderr } = await execFileAsync(
      command.command,
      command.args,
      {
        cwd: corePath,
        env: {
          ...buildPythonEnv(),
          CHAOXING_USERNAME: normalizedConfig.username,
          CHAOXING_PASSWORD: normalizedConfig.password,
          CHAOXING_USE_COOKIES: normalizedConfig.useCookies ? 'true' : 'false',
          PYTHONUNBUFFERED: '1'
        },
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 10
      }
    )

    if (stderr.trim()) {
      appendRawLog('stderr', stderr)
      emitReadableLines('stderr', stderr)
    }

    const courses = parseCourseList(stdout)
    for (const course of courses) {
      log('info', `课程 ID: ${course.courseId} 课程名: ${course.title}`)
    }
    log('info', `课程列表获取完成，共 ${courses.length} 门。`)
    return { ok: true, message: `课程列表获取完成，共 ${courses.length} 门。`, courses }
  } catch (error) {
    const detail = error as NodeJS.ErrnoException & {
      stdout?: string
      stderr?: string
      code?: string | number
    }
    if (detail.stdout?.trim()) {
      appendRawLog('stdout', detail.stdout)
      emitReadableLines('stdout', detail.stdout)
    }
    if (detail.stderr?.trim()) {
      appendRawLog('stderr', detail.stderr)
      emitReadableLines('stderr', detail.stderr)
    }
    const message = `获取课程列表失败：${errorToString(error)}`
    log('error', message)
    return { ok: false, message, courses: [] }
  }
}

export async function runDiagnostics(): Promise<RunnerResult> {
  mkdirSync(diagnosticsDir, { recursive: true })
  const lines: string[] = []

  const write = (line = ''): void => {
    lines.push(line)
    log('info', `[diagnostics] ${line}`)
  }

  write('bk学习捅 diagnostics')
  write(`time=${new Date().toISOString()}`)
  write(`appVersion=${app.getVersion()}`)
  write(`isPackaged=${app.isPackaged}`)
  write(`process.cwd=${process.cwd()}`)
  write(`resourcesPath=${process.resourcesPath}`)
  write(`appSupportDir=${appSupportDir}`)
  write(`bundledCorePath=${bundledCorePath}`)
  write(`bundledUvPath=${bundledUvPath}`)
  write(`bundledPythonPath=${bundledPythonPath}`)
  write(`bundledPythonPackagesPath=${bundledPythonPackagesPath}`)
  write(`runtimeCorePath=${runtimeCorePath}`)
  write(`corePath=${corePath}`)
  write(`PATH=${buildRunnerPath()}`)
  write('')

  try {
    ensureRuntimeCore()
    write('ensureRuntimeCore=ok')
  } catch (error) {
    write(`ensureRuntimeCore=error ${errorToString(error)}`)
  }

  write(`exists core=${existsSync(corePath)}`)
  write(`exists main.py=${existsSync(join(corePath, 'main.py'))}`)
  write(`exists pyproject.toml=${existsSync(join(corePath, 'pyproject.toml'))}`)
  write(`exists bundled uv=${existsSync(bundledUvPath)}`)
  write(`exists bundled python=${existsSync(bundledPythonPath)}`)
  write(`exists bundled python-packages=${existsSync(bundledPythonPackagesPath)}`)
  write(`exists configPath=${existsSync(configPath)}`)
  write(`exists cookiesPath=${existsSync(cookiesPath)}`)
  write(`exists core cookies.txt=${existsSync(join(corePath, 'cookies.txt'))}`)

  try {
    mkdirSync(corePath, { recursive: true })
    const writeTestPath = join(corePath, '.chaoxingmac-write-test')
    writeFileSync(writeTestPath, 'ok', 'utf8')
    rmSync(writeTestPath, { force: true })
    write('coreWritable=ok')
  } catch (error) {
    write(`coreWritable=error ${errorToString(error)}`)
  }

  if (existsSync(bundledPythonPath)) {
    await recordCommand(write, 'bundled python --version', bundledPythonPath, ['--version'])
    await recordCommand(write, 'bundled python import smoke', bundledPythonPath, [
      '-c',
      'import requests, bs4, tqdm, loguru, lxml, httpx; print("imports ok")'
    ])
  }

  uvPath = await resolveUvPath()
  write(`uvPath=${uvPath ?? '<not found>'}`)
  if (uvPath) {
    await recordCommand(write, 'uv --version', uvPath, ['--version'])
    await recordCommand(write, 'uv python find 3.13', uvPath, ['python', 'find', '3.13'])
    await recordCommand(write, 'uv run python smoke', uvPath, [
      'run',
      '--python',
      '3.13',
      'python',
      '-c',
      'import sys, pathlib; print(sys.version); print(pathlib.Path.cwd())'
    ])
    await recordCommand(write, 'uv run import smoke', uvPath, [
      'run',
      '--python',
      '3.13',
      'python',
      '-c',
      'import requests, bs4, tqdm, loguru; print("imports ok")'
    ])
  }

  writeFileSync(diagnosticsPath, `${lines.join('\n')}\n`, 'utf8')
  log('info', `诊断文件已写入 ${diagnosticsPath}`)
  return { ok: true, message: `诊断完成：${diagnosticsPath}` }
}

export async function exportLogs(): Promise<RunnerResult> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const exportDir = join(homedir(), 'Desktop', `bk学习捅-logs-${stamp}`)
  mkdirSync(exportDir, { recursive: true })

  const files = [
    [appLogPath, 'app.log'],
    [rawLogPath, 'raw.log'],
    [diagnosticsPath, 'diagnostics.txt']
  ] as const

  for (const [source, name] of files) {
    if (existsSync(source)) {
      copyFileSync(source, join(exportDir, name))
    }
  }

  if (existsSync(configPath)) {
    const configText = sanitizeConfigForExport(configPath)
    writeFileSync(join(exportDir, 'config.redacted.ini'), configText, 'utf8')
  }

  log('info', `日志已导出：${exportDir}`)
  return { ok: true, message: `日志已导出：${exportDir}` }
}

function spawnChaoxing(): ChildProcessByStdio<null, Readable, Readable> {
  const command = buildMainPythonCommand()
  return spawn(command.command, command.args, {
    cwd: corePath,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: buildPythonEnv({ PYTHONUNBUFFERED: '1' })
  })
}

function buildMainPythonCommand(): { command: string; args: string[] } {
  if (runnerMode === 'bundled') {
    return { command: bundledPythonPath, args: ['main.py', '-c', configPath] }
  }

  return { command: uvPath ?? 'uv', args: ['run', '--python', '3.13', 'main.py', '-c', configPath] }
}

function buildInlinePythonCommand(script: string): { command: string; args: string[] } {
  if (runnerMode === 'bundled') {
    return { command: bundledPythonPath, args: ['-c', script] }
  }

  return { command: uvPath ?? 'uv', args: ['run', '--python', '3.13', 'python', '-c', script] }
}

function buildLaunchSummary(): string {
  if (runnerMode === 'bundled') {
    return '使用内置 Python 3.13 运行 main.py -c <config.ini>'
  }

  return `${uvPath ?? 'uv'} run --python 3.13 main.py -c <config.ini>`
}

function handleProcessOutput(level: LogLevel, text: string): void {
  appendRawLog(level, text)
  emitReadableLines(level, text)
}

function emitReadableLines(level: LogLevel, text: string): void {
  const parts = text.split(/\r|\n/)
  for (const part of parts) {
    const plain = stripAnsi(part).trim()
    if (!plain) {
      continue
    }

    const visible = processPlainOutputLine(plain)
    if (visible) {
      log(level, visible)
    }
  }
}

function processPlainOutputLine(line: string): string | null {
  const message = extractLogMessage(line)

  const tqdmProgress = message.match(/^(.+?):\s+(\d+)%\|.*\|\s*([0-9:]+)\/([0-9:]+)/)
  if (tqdmProgress) {
    updateProgress({
      videoTitle: tqdmProgress[1].trim(),
      percent: Number(tqdmProgress[2]),
      elapsed: tqdmProgress[3],
      total: tqdmProgress[4],
      status: 'running'
    })
    return null
  }

  const currentChapter = message.match(/当前章节:\s*(.+)$/)
  if (currentChapter) {
    updateProgress({
      currentChapter: currentChapter[1].trim(),
      currentTask: '',
      videoTitle: '',
      percent: null,
      elapsed: '',
      total: '',
      retryText: '',
      status: 'running'
    })
    return null
  }

  const skippedComplete = message.match(/章节：(.+?)\s+已完成所有任务点/)
  if (skippedComplete) {
    updateProgress({
      currentChapter: skippedComplete[1].trim(),
      completedTasks: progressState.completedTasks + 1,
      percent: 100,
      retryText: '',
      status: 'running'
    })
    return null
  }

  const startTask = message.match(/开始任务:\s*(.+?),\s*总时长:\s*(\d+)s,\s*已进行:\s*(\d+)s/)
  if (startTask) {
    const total = secondsToClock(Number(startTask[2]))
    const elapsed = secondsToClock(Number(startTask[3]))
    updateProgress({
      currentTask: startTask[1].trim(),
      videoTitle: startTask[1].trim(),
      percent: null,
      elapsed,
      total,
      retryText: '',
      status: 'running'
    })
    return `开始任务：${startTask[1].trim()}（${elapsed}/${total}）`
  }

  const instantComplete = message.match(/任务瞬间完成:\s*(.+)$/)
  if (instantComplete) {
    updateProgress({
      currentTask: instantComplete[1].trim(),
      videoTitle: instantComplete[1].trim(),
      percent: 100,
      retryText: '',
      status: 'running'
    })
    return null
  }

  const taskSuccess = message.match(/Task success:\s*(.+)$/)
  if (taskSuccess) {
    updateProgress({
      currentChapter: taskSuccess[1].trim(),
      percent: 100,
      retryText: '',
      status: 'running'
    })
    return null
  }

  const unfinished = message.match(/unfinished task:\s*(\d+)/)
  if (unfinished) {
    const unfinishedTasks = Number(unfinished[1])
    const totalTasks = Math.max(progressState.totalTasks ?? 0, unfinishedTasks + progressState.completedTasks)
    updateProgress({ unfinishedTasks, totalTasks, status: 'running' })
    return null
  }

  const retry = message.match(/Retrying task\s+(.+?)\s+\((\d+)\/(\d+)\s+attempts\)/)
  if (retry) {
    const retryText = `${retry[1].trim()} 第 ${retry[2]}/${retry[3]} 次重试`
    updateProgress({ retryText, status: 'running' })
    return `重试：${retryText}`
  }

  if (message.includes('登录成功')) {
    updateProgress({ status: 'running' })
    return '登录成功'
  }

  const courseStart = message.match(/开始学习课程:\s*(.+)$/)
  if (courseStart) {
    const nextCourse = courseStart[1].trim()
    updateProgress({
      currentCourse: nextCourse,
      completedCourses:
        progressState.currentCourse && progressState.currentCourse !== nextCourse
          ? progressState.completedCourses + 1
          : progressState.completedCourses,
      currentChapter: '',
      currentTask: '',
      videoTitle: '',
      percent: null,
      status: 'running'
    })
    return `开始学习课程：${courseStart[1].trim()}`
  }

  const courseFilter = message.match(/课程列表过滤完毕,\s*当前课程任务数量:\s*(\d+)/)
  if (courseFilter) {
    updateProgress({ totalCourses: Number(courseFilter[1]), completedCourses: 0 })
    return `已选择课程任务：${courseFilter[1]} 门`
  }

  if (message.includes('所有课程学习任务已完成')) {
    updateProgress({
      status: 'finished',
      percent: 100,
      retryText: '',
      completedCourses: progressState.totalCourses ?? progressState.completedCourses
    })
    return '所有课程学习任务已完成'
  }

  if (message.includes('课程列表读取完毕')) {
    return '课程列表读取完毕'
  }

  if (message.includes('未找到题库配置') || message.includes('未找到外部通知配置')) {
    return null
  }

  if (message.includes('DEBUG') && !message.includes('Task success') && !message.includes('unfinished task')) {
    return null
  }

  if (message.includes('ERROR') || message.includes('Traceback') || message.includes('错误:')) {
    updateProgress({ status: 'error' })
    return message
  }

  if (message.includes('WARNING')) {
    return message
  }

  return null
}

function extractLogMessage(line: string): string {
  const markerIndex = line.lastIndexOf(' - ')
  if (markerIndex >= 0) {
    return line.slice(markerIndex + 3).trim()
  }
  return line
}

function stripAnsi(value: string): string {
  return value
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
}

function secondsToClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return ''
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

async function checkEnvironment(): Promise<RunnerResult> {
  try {
    ensureRuntimeCore()
  } catch (error) {
    return { ok: false, message: `初始化 Python core 失败：${errorToString(error)}` }
  }

  if (!existsSync(corePath)) {
    return {
      ok: false,
      message: app.isPackaged
        ? '应用包内未找到 core/chaoxing，请重新打包应用。'
        : '未找到 core/chaoxing，请先运行 npm run setup:core 克隆上游仓库。'
    }
  }

  if (app.isPackaged && existsSync(bundledPythonPath) && existsSync(bundledPythonPackagesPath)) {
    runnerMode = 'bundled'
    try {
      await execFileAsync(bundledPythonPath, [
        '-c',
        'import sys, requests, bs4, lxml, loguru, tqdm, httpx; print(sys.version)'
      ], {
        cwd: corePath,
        env: buildPythonEnv(),
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 5
      })
      return { ok: true, message: '环境检查通过：已使用 App 内置 Python 3.13。' }
    } catch (error) {
      return {
        ok: false,
        message: `内置 Python 运行失败，请重新下载应用或导出日志排查：${errorToString(error)}`
      }
    }
  }

  runnerMode = 'uv'
  uvPath = await resolveUvPath()
  if (!uvPath) {
    return {
      ok: false,
      message:
        '未检测到内置 Python 或系统 uv。开发模式请先运行 brew install uv；打包版请重新下载完整 App。'
    }
  }

  try {
    await execFileAsync(uvPath, ['--version'], { env: buildRunnerEnv() })
  } catch {
    return { ok: false, message: '未检测到 uv，请先运行 brew install uv。' }
  }

  try {
    await execFileAsync(uvPath, ['python', 'find', '3.13'], {
      cwd: corePath,
      env: buildRunnerEnv()
    })
  } catch {
    return { ok: false, message: '未检测到 Python 3.13，请先运行 uv python install 3.13。' }
  }

  return { ok: true, message: '环境检查通过。' }
}

function ensureRuntimeCore(): void {
  if (!app.isPackaged) {
    return
  }

  if (
    existsSync(join(runtimeCorePath, 'main.py')) &&
    existsSync(runtimeCoreVersionPath) &&
    readFileSync(runtimeCoreVersionPath, 'utf8').trim() === runtimeCoreVersion
  ) {
    return
  }

  if (!existsSync(join(bundledCorePath, 'main.py'))) {
    throw new Error(`包内 core 缺少 main.py: ${bundledCorePath}`)
  }

  mkdirSync(join(appSupportDir, 'core'), { recursive: true })
  rmSync(runtimeCorePath, { recursive: true, force: true })
  cpSync(bundledCorePath, runtimeCorePath, {
    recursive: true,
    filter: (source) => {
      const normalized = source.split('\\').join('/')
      return (
        !normalized.includes('/.git/') &&
        !normalized.endsWith('/.git') &&
        !normalized.includes('__pycache__') &&
        !normalized.endsWith('.pyc') &&
        !normalized.endsWith('/cookies.txt') &&
        !normalized.endsWith('/config.ini')
      )
    }
  })
  writeFileSync(runtimeCoreVersionPath, `${runtimeCoreVersion}\n`, 'utf8')
}

async function resolveUvPath(): Promise<string | null> {
  const candidates = [
    join(homedir(), '.local', 'bin', 'uv'),
    join(homedir(), '.cargo', 'bin', 'uv'),
    '/opt/homebrew/bin/uv',
    '/usr/local/bin/uv',
    '/usr/bin/uv'
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  try {
    const { stdout } = await execFileAsync('/bin/zsh', ['-lc', 'command -v uv'], {
      env: buildRunnerEnv()
    })
    const resolvedPath = stdout.trim().split('\n')[0]
    return resolvedPath || null
  } catch {
    return null
  }
}

function buildRunnerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: buildRunnerPath()
  }
}

function buildPythonEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const pythonPathParts = [
    app.isPackaged && existsSync(bundledPythonPackagesPath) ? bundledPythonPackagesPath : '',
    process.env.PYTHONPATH ?? ''
  ].filter(Boolean)

  return {
    ...process.env,
    PATH: buildRunnerPath(),
    PYTHONPATH: pythonPathParts.join(':'),
    ...extra
  }
}

function buildRunnerPath(): string {
  const existing = process.env.PATH ? process.env.PATH.split(':') : []
  const bundledEntries = app.isPackaged ? [join(process.resourcesPath, 'runtime', 'uv')] : []
  return Array.from(new Set([...bundledEntries, ...extraPathEntries, ...existing])).join(':')
}

async function recordCommand(
  write: (line?: string) => void,
  label: string,
  command: string,
  args: string[]
): Promise<void> {
  write('')
  write(`$ ${label}`)
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: corePath,
      env: buildPythonEnv(),
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 5
    })
    write(`exit=0`)
    if (stdout.trim()) {
      write(`stdout:\n${stdout.trim()}`)
    }
    if (stderr.trim()) {
      write(`stderr:\n${stderr.trim()}`)
    }
  } catch (error) {
    const detail = error as NodeJS.ErrnoException & {
      stdout?: string
      stderr?: string
      code?: string | number
    }
    write(`exit=${detail.code ?? 'error'}`)
    if (detail.stdout?.trim()) {
      write(`stdout:\n${detail.stdout.trim()}`)
    }
    if (detail.stderr?.trim()) {
      write(`stderr:\n${detail.stderr.trim()}`)
    }
    write(`error=${errorToString(error)}`)
  }
}

function normalizeConfig(config: ChaoxingConfig): ChaoxingConfig {
  return {
    username: String(config.username ?? '').trim(),
    password: String(config.password ?? ''),
    cookies: String(config.cookies ?? '').trim(),
    courseList: String(config.courseList ?? '').trim(),
    speed: normalizeSpeed(config.speed),
    jobs: Number(config.jobs || 1),
    useCookies: Boolean(config.useCookies)
  }
}

function validateConfig(config: ChaoxingConfig): RunnerResult {
  const loginValidation = validateLoginConfig(config)
  if (!loginValidation.ok) {
    return loginValidation
  }

  if (!config.courseList) {
    return {
      ok: false,
      message:
        '请先点击“获取课程列表”，再选择或填写 courseList。上游 CLI 在 course_list 为空时会等待终端输入课程 ID，桌面 App 无法交互输入。'
    }
  }

  if (!Number.isFinite(config.speed) || config.speed < 1 || config.speed > 8) {
    return { ok: false, message: '加速倍率请设置在 1x 到 8x 之间。建议先用 2x 或 4x。' }
  }

  if (!Number.isFinite(config.jobs) || config.jobs < 1 || config.jobs > 6) {
    return { ok: false, message: '并发章节请设置在 1 到 6 之间。' }
  }

  return { ok: true, message: '配置校验通过。' }
}

function validateLoginConfig(config: ChaoxingConfig): RunnerResult {
  if (!config.useCookies && (!config.username || !config.password)) {
    return { ok: false, message: '请填写 username 和 password，或启用 useCookies 并填写 cookies。' }
  }

  if (config.useCookies && !config.cookies) {
    return { ok: false, message: '已启用 useCookies，请填写 cookies。' }
  }

  return { ok: true, message: '配置校验通过。' }
}

function parseCourseList(output: string): CourseInfo[] {
  const match = output.match(/CHAOXING_COURSES_JSON_START\s*([\s\S]*?)\s*CHAOXING_COURSES_JSON_END/)
  if (!match) {
    throw new Error('未能解析课程列表输出。')
  }

  const parsed = JSON.parse(match[1]) as Array<Partial<CourseInfo>>
  return parsed
    .map((course) => ({
      courseId: String(course.courseId ?? '').trim(),
      title: String(course.title ?? '').trim()
    }))
    .filter((course) => course.courseId)
}

function buildConfigIni(config: ChaoxingConfig): string {
  return [
    '[common]',
    `use_cookies=${config.useCookies ? 'true' : 'false'}`,
    `username = ${escapeIniValue(config.username)}`,
    `password = ${escapeIniValue(config.password)}`,
    `course_list = ${escapeIniValue(config.courseList)}`,
    `speed = ${normalizeSpeed(config.speed)}`,
    `jobs = ${Math.max(1, Math.min(6, Math.floor(config.jobs)))}`,
    'notopen_action = retry',
    '',
    '[tiku]',
    'provider=',
    'check_llm_connection=false',
    'submit=false',
    'cover_rate=0.9',
    'delay=1.0',
    'tokens=',
    'url=',
    'endpoint=',
    'key=',
    'model=',
    'min_interval_seconds=3',
    'http_proxy=',
    'true_list=正确,对,√,是',
    'false_list=错误,错,×,否,不对,不正确',
    '',
    '[notification]',
    'provider=',
    'url=',
    'tg_chat_id=',
    ''
  ].join('\n')
}

function normalizeSpeed(value: unknown): number {
  const speed = Number(value || 1)
  if (!Number.isFinite(speed)) {
    return 1
  }
  return Math.max(1, Math.min(8, Number(speed.toFixed(1))))
}

function ensureCookieSymlink(): void {
  const linkPath = join(corePath, 'cookies.txt')
  if (existsSync(linkPath)) {
    const stat = lstatSync(linkPath)
    if (stat.isSymbolicLink()) {
      rmSync(linkPath)
    } else {
      log('error', 'core/chaoxing/cookies.txt 已存在且不是本应用创建的链接，为避免覆盖用户文件，未修改该文件。')
      return
    }
  }

  symlinkSync(cookiesPath, linkPath)
}

function redactedConfig(config: ChaoxingConfig): Omit<ChaoxingConfig, 'password' | 'cookies'> & {
  password: string
  cookies: string
} {
  return {
    ...config,
    password: config.password ? '<redacted>' : '',
    cookies: config.cookies ? '<redacted>' : ''
  }
}

function sanitizeLog(message: string): string {
  let sanitized = message
  if (currentConfig?.password) {
    sanitized = sanitized.split(currentConfig.password).join('<redacted-password>')
  }
  if (currentConfig?.cookies) {
    sanitized = sanitized.split(currentConfig.cookies).join('<redacted-cookies>')
  }
  return sanitized
    .replace(/(password\s*[=:]\s*)[^\s&;]+/gi, '$1<redacted-password>')
    .replace(/((?:_uid|UID|fid|vc3|uf|lv|JSESSIONID)\s*=\s*)[^;\s]+/g, '$1<redacted-cookie>')
}

function escapeIniValue(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}

function log(level: LogLevel, message: string): void {
  const entry = {
    level,
    message: sanitizeLog(message),
    timestamp: new Date().toISOString()
  }
  try {
    mkdirSync(appSupportDir, { recursive: true })
    appendFileSync(appLogPath, `[${entry.timestamp}] ${entry.level} ${entry.message}\n`, 'utf8')
  } catch {
    // Logging must never break the runner.
  }
  sendLog(entry)
}

function createInitialProgress(status: RunnerProgress['status'] = 'idle'): RunnerProgress {
  return {
    status,
    currentChapter: '',
    currentTask: '',
    currentCourse: '',
    videoTitle: '',
    percent: null,
    elapsed: '',
    total: '',
    completedCourses: 0,
    totalCourses: null,
    completedTasks: 0,
    unfinishedTasks: null,
    totalTasks: null,
    retryText: '',
    rawLogPath,
    updatedAt: new Date().toISOString()
  }
}

function resetProgress(status: RunnerProgress['status'] = 'idle'): void {
  progressState = createInitialProgress(status)
  sendProgress(progressState)
}

function updateProgress(next: Partial<RunnerProgress>): void {
  progressState = {
    ...progressState,
    ...next,
    rawLogPath,
    updatedAt: new Date().toISOString()
  }
  sendProgress(progressState)
}

function resetAppLog(): void {
  try {
    mkdirSync(appSupportDir, { recursive: true })
    writeFileSync(appLogPath, '', 'utf8')
  } catch {
    // Logging must never break the runner.
  }
}

function resetRawLog(): void {
  try {
    mkdirSync(appSupportDir, { recursive: true })
    writeFileSync(rawLogPath, '', 'utf8')
  } catch {
    // Logging must never break the runner.
  }
}

function sanitizeConfigForExport(path: string): string {
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line: string) => {
        if (!line.includes('=')) {
          return line
        }
        const [rawKey] = line.split('=', 1)
        const key = rawKey.trim().toLowerCase()
        if (['password', 'cookies', 'token', 'tokens', 'key', 'siliconflow_key'].includes(key)) {
          return `${rawKey}= <redacted>`
        }
        return line
      })
      .join('\n')
  } catch {
    return ''
  }
}

function appendRawLog(level: LogLevel, text: string): void {
  try {
    mkdirSync(appSupportDir, { recursive: true })
    appendFileSync(rawLogPath, `[${new Date().toISOString()}] ${level}\n${sanitizeLog(text)}\n`, 'utf8')
  } catch {
    // Logging must never break the runner.
  }
}

function errorToString(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

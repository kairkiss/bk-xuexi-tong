import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { ChaoxingConfig, CourseInfo, RunnerLog, RunnerProgress } from './lib/chaoxing'

const savedConfigKey = 'bk-xuexi-tong-config-v1'
const savedCoursesKey = 'bk-xuexi-tong-courses-v1'
const speedPresets = [1, 2, 4, 6, 8]

const initialConfig: ChaoxingConfig = {
  username: '',
  password: '',
  cookies: '',
  courseList: '',
  speed: 1,
  jobs: 1,
  useCookies: false
}

const initialProgress: RunnerProgress = {
  status: 'idle',
  currentCourse: '',
  currentChapter: '',
  currentTask: '',
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
  rawLogPath: '',
  updatedAt: new Date().toISOString()
}

export default function App(): JSX.Element {
  const [config, setConfig] = useState<ChaoxingConfig>(() => loadSavedConfig())
  const [logs, setLogs] = useState<RunnerLog[]>([])
  const [courses, setCourses] = useState<CourseInfo[]>(() => loadSavedCourses())
  const [progress, setProgress] = useState<RunnerProgress>(initialProgress)
  const [running, setRunning] = useState(false)
  const [pending, setPending] = useState(false)
  const [courseQuery, setCourseQuery] = useState('')
  const [showEvents, setShowEvents] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [notice, setNotice] = useState('本机运行，不上传账号、密码或 Cookie。')

  useEffect(() => {
    const unsubscribeLog = window.chaoxing.onLog((log) => {
      setLogs((current) => [...current, log].slice(-80))
      if (log.message.includes('子进程已退出')) {
        setRunning(false)
      }
    })
    const unsubscribeProgress = window.chaoxing.onProgress((nextProgress) => {
      setProgress(nextProgress)
      if (nextProgress.status === 'finished' || nextProgress.status === 'error') {
        setRunning(false)
      }
    })
    const unsubscribeClear = window.chaoxing.onClearLog(() => setLogs([]))

    return () => {
      unsubscribeLog()
      unsubscribeProgress()
      unsubscribeClear()
    }
  }, [])

  useEffect(() => {
    const safeConfig = {
      username: config.username,
      courseList: config.courseList,
      speed: config.speed,
      jobs: config.jobs,
      useCookies: config.useCookies
    }
    localStorage.setItem(savedConfigKey, JSON.stringify(safeConfig))
  }, [config.courseList, config.jobs, config.speed, config.useCookies, config.username])

  useEffect(() => {
    localStorage.setItem(savedCoursesKey, JSON.stringify(courses))
  }, [courses])

  useEffect(() => {
    if (!running || !runStartedAt) return
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - runStartedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [runStartedAt, running])

  const selectedCourseIds = useMemo(() => parseCourseIds(config.courseList), [config.courseList])
  const selectedCourses = useMemo(
    () =>
      selectedCourseIds.map((courseId) => ({
        courseId,
        title: courses.find((course) => course.courseId === courseId)?.title ?? '手动输入课程'
      })),
    [courses, selectedCourseIds]
  )
  const filteredCourses = useMemo(() => {
    const query = courseQuery.trim().toLowerCase()
    if (!query) return courses
    return courses.filter(
      (course) =>
        course.courseId.includes(query) ||
        course.title.toLowerCase().includes(query)
    )
  }, [courseQuery, courses])

  const canFetchCourses = !running && !pending && hasLoginInput(config)
  const canStart = !running && !pending && hasLoginInput(config) && selectedCourseIds.length > 0
  const taskPercent = useMemo(() => {
    if (progress.totalTasks && progress.unfinishedTasks !== null) {
      const done = Math.max(progress.totalTasks - progress.unfinishedTasks, progress.completedTasks)
      return clampPercent(Math.round((done / progress.totalTasks) * 100))
    }
    return clampPercent(progress.percent ?? 0)
  }, [progress.completedTasks, progress.percent, progress.totalTasks, progress.unfinishedTasks])
  const coursePercent = useMemo(() => {
    if (!progress.totalCourses) {
      return selectedCourseIds.length > 0 ? 0 : null
    }
    return clampPercent(Math.round((progress.completedCourses / progress.totalCourses) * 100))
  }, [progress.completedCourses, progress.totalCourses, selectedCourseIds.length])

  async function handleStart(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!canStart) {
      setNotice(getStartBlockReason(config, selectedCourseIds.length))
      return
    }

    setPending(true)
    setLogs([])
    setElapsedSeconds(0)
    setRunStartedAt(Date.now())
    const result = await window.chaoxing.start(config)
    pushResult(result.ok ? 'info' : 'error', result.message)
    setRunning(result.ok)
    if (!result.ok) {
      setRunStartedAt(null)
      setNotice(result.message)
    } else {
      setNotice('任务已启动。进度会在右侧实时更新，终端日志默认隐藏。')
    }
    setPending(false)
  }

  async function handleStop(): Promise<void> {
    setPending(true)
    const result = await window.chaoxing.stop()
    pushResult(result.ok ? 'info' : 'error', result.message)
    if (result.ok) {
      setRunning(false)
      setRunStartedAt(null)
      setNotice('已请求停止运行。')
    }
    setPending(false)
  }

  async function handleFetchCourses(): Promise<void> {
    if (!canFetchCourses) {
      setNotice('先填写账号密码，或启用 Cookie 登录并填写 Cookie。')
      return
    }

    setPending(true)
    const result = await window.chaoxing.courses(config)
    pushResult(result.ok ? 'info' : 'error', result.message)
    if (result.ok) {
      setCourses(result.courses)
      setNotice(`已获取 ${result.courses.length} 门课程。可以搜索并多选课程。`)
    } else {
      setNotice(result.message)
    }
    setPending(false)
  }

  async function handleDiagnostics(): Promise<void> {
    setPending(true)
    const result = await window.chaoxing.diagnostics()
    pushResult(result.ok ? 'info' : 'error', result.message)
    setNotice(result.message)
    setPending(false)
  }

  async function handleExportLogs(): Promise<void> {
    const result = await window.chaoxing.exportLogs()
    pushResult(result.ok ? 'info' : 'error', result.message)
    setNotice(result.message)
  }

  async function handleClearLog(): Promise<void> {
    await window.chaoxing.clearLog()
    setLogs([])
  }

  function pushResult(level: RunnerLog['level'], message: string): void {
    setLogs((current) => [
      ...current,
      { level, message, timestamp: new Date().toISOString() }
    ].slice(-80))
  }

  function toggleCourse(courseId: string): void {
    const next = selectedCourseIds.includes(courseId)
      ? selectedCourseIds.filter((item) => item !== courseId)
      : [...selectedCourseIds, courseId]
    setConfig({ ...config, courseList: next.join(',') })
  }

  function clearSelection(): void {
    setConfig({ ...config, courseList: '' })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>bk学习捅</h1>
          <p>本地学习任务运行器</p>
        </div>
        <div className="header-status">
          <span className={`status-dot ${running ? 'on' : ''}`} />
          <span>{running ? '运行中' : pending ? '处理中' : '就绪'}</span>
        </div>
      </header>

      <div className="notice-bar">{notice}</div>

      <form className="product-grid" onSubmit={handleStart}>
        <section className="panel setup-panel">
          <div className="panel-title">
            <h2>登录</h2>
            <span>仅保存在本机</span>
          </div>
          <div className="field-stack">
            <label className="field">
              <span>账号</span>
              <input
                value={config.username}
                onChange={(event) => setConfig({ ...config, username: event.target.value })}
                autoComplete="username"
                disabled={running}
                placeholder="手机号 / 学习通账号"
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                value={config.password}
                onChange={(event) => setConfig({ ...config, password: event.target.value })}
                type="password"
                autoComplete="current-password"
                disabled={running}
                placeholder="默认不保存"
              />
            </label>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={config.useCookies}
                onChange={(event) => setConfig({ ...config, useCookies: event.target.checked })}
                disabled={running}
              />
              <span>使用 Cookie 登录</span>
            </label>
            {config.useCookies ? (
              <label className="field">
                <span>Cookie</span>
                <textarea
                  value={config.cookies}
                  onChange={(event) => setConfig({ ...config, cookies: event.target.value })}
                  rows={4}
                  spellCheck={false}
                  disabled={running}
                  placeholder="粘贴 cookies.txt 内容"
                />
              </label>
            ) : null}
          </div>
        </section>

        <section className="panel courses-panel">
          <div className="panel-title">
            <h2>课程</h2>
            <button type="button" disabled={!canFetchCourses} onClick={handleFetchCourses}>
              {pending ? '获取中' : '获取课程'}
            </button>
          </div>
          <div className="course-toolbar">
            <input
              value={courseQuery}
              onChange={(event) => setCourseQuery(event.target.value)}
              placeholder="搜索课程名或 ID"
              disabled={running}
            />
            <button type="button" disabled={running || selectedCourseIds.length === 0} onClick={clearSelection}>
              清空
            </button>
          </div>
          <div className="selected-strip">
            {selectedCourses.length === 0 ? (
              <span>未选择课程</span>
            ) : (
              selectedCourses.map((course) => (
                <button
                  type="button"
                  key={course.courseId}
                  disabled={running}
                  onClick={() => toggleCourse(course.courseId)}
                >
                  {course.courseId}
                </button>
              ))
            )}
          </div>
          <div className="course-list">
            {courses.length === 0 ? (
              <div className="empty-state">
                填写登录信息后获取课程列表。支持一次选择多门课程，原程序会按顺序处理。
              </div>
            ) : (
              filteredCourses.map((course) => (
                <button
                  className={selectedCourseIds.includes(course.courseId) ? 'course-item selected' : 'course-item'}
                  key={course.courseId}
                  type="button"
                  disabled={running}
                  onClick={() => toggleCourse(course.courseId)}
                >
                  <span>{course.courseId}</span>
                  <strong>{course.title}</strong>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel run-options">
          <div className="panel-title">
            <h2>运行设置</h2>
          </div>
          <div className="speed-card">
            <div className="speed-header">
              <div>
                <span>加速倍率</span>
                <strong>{config.speed}x</strong>
              </div>
              <em>{speedRiskLabel(config.speed)}</em>
            </div>
            <div className="preset-row" aria-label="加速倍率预设">
              {speedPresets.map((speed) => (
                <button
                  className={config.speed === speed ? 'selected' : ''}
                  disabled={running}
                  key={speed}
                  onClick={() => setConfig({ ...config, speed })}
                  type="button"
                >
                  {speed}x
                </button>
              ))}
            </div>
            <label className="field compact-field">
              <span>手动倍率</span>
              <input
                value={config.speed}
                onChange={(event) =>
                  setConfig({ ...config, speed: clampSpeed(Number(event.target.value)) })
                }
                type="number"
                min="1"
                max="8"
                step="0.1"
                disabled={running}
              />
            </label>
            <p>
              原脚本按倍率缩短学习等待时间。建议先用 2x 或 4x；如果课程频繁重试，降低倍率或并发。
            </p>
          </div>
          <div className="option-grid single">
            <label className="field">
              <span>并发课程章节</span>
              <input
                value={config.jobs}
                onChange={(event) => setConfig({ ...config, jobs: clampJobs(Number(event.target.value)) })}
                type="number"
                min="1"
                max="6"
                step="1"
                disabled={running}
              />
            </label>
          </div>
          <div className="actions">
            <button className="primary" type="submit" disabled={!canStart}>
              {running ? '运行中' : pending ? '准备中' : '开始运行'}
            </button>
            <button type="button" disabled={!running || pending} onClick={handleStop}>
              停止
            </button>
            <button type="button" disabled={pending} onClick={handleDiagnostics}>
              检查环境
            </button>
            <button type="button" onClick={handleExportLogs}>
              导出日志
            </button>
          </div>
        </section>

        <section className="panel dashboard-panel">
          <div className="panel-title">
            <h2>运行状态</h2>
            <span>{formatElapsed(elapsedSeconds)}</span>
          </div>
          <div className="metric-grid">
            <Metric label="课程" value={formatCourseProgress(progress, selectedCourseIds.length)} />
            <Metric label="章节任务" value={formatTaskProgress(progress)} />
            <Metric label="加速" value={`${config.speed}x`} />
            <Metric label="并发章节" value={`${config.jobs}`} />
          </div>
          <div className="progress-section">
            <div className="progress-row">
              <span>课程进度</span>
              <strong>{coursePercent === null ? '待开始' : `${coursePercent}%`}</strong>
            </div>
            <div className="progress-bar">
              <div style={{ width: `${coursePercent ?? 0}%` }} />
            </div>
          </div>
          <div className="progress-section">
            <div className="progress-row">
              <span>当前任务</span>
              <strong>{taskPercent}%</strong>
            </div>
            <div className="progress-bar task">
              <div style={{ width: `${taskPercent}%` }} />
            </div>
          </div>
          <div className="current-card">
            <span className={`run-state ${progress.status}`}>{statusText(progress.status)}</span>
            <h3>{progress.currentCourse || '等待开始'}</h3>
            <p>{progress.currentChapter || '选择课程后开始运行。'}</p>
            <p>{progress.currentTask || progress.videoTitle || '终端日志默认隐藏，必要时可导出。'}</p>
            {progress.total ? <small>{progress.elapsed || '00:00'} / {progress.total}</small> : null}
            {progress.retryText ? <div className="retry-note">{progress.retryText}</div> : null}
          </div>
          <div className="course-run-list">
            {selectedCourses.length === 0 ? (
              <div className="empty-state compact">还没有选择课程。</div>
            ) : (
              selectedCourses.map((course, index) => (
                <div className={courseStatusClass(course, progress, index)} key={course.courseId}>
                  <span>{index + 1}</span>
                  <strong>{course.title}</strong>
                  <em>{course.courseId}</em>
                </div>
              ))
            )}
          </div>
          <div className="event-toggle">
            <button type="button" onClick={() => setShowEvents(!showEvents)}>
              {showEvents ? '隐藏最近事件' : '显示最近事件'}
            </button>
            <button type="button" onClick={handleClearLog}>
              清空事件
            </button>
          </div>
          {showEvents ? (
            <div className="event-list" role="log" aria-live="polite">
              {logs.length === 0 ? (
                <div className="empty-state compact">暂无事件。</div>
              ) : (
                logs.map((log, index) => (
                  <div className={`event-line ${log.level}`} key={`${log.timestamp}-${index}`}>
                    <time>{new Date(log.timestamp).toLocaleTimeString()}</time>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>
      </form>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function loadSavedConfig(): ChaoxingConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(savedConfigKey) || '{}') as Partial<ChaoxingConfig>
    return {
      ...initialConfig,
      username: saved.username ?? '',
      courseList: saved.courseList ?? '',
      speed: saved.speed ?? 1,
      jobs: saved.jobs ?? 1,
      useCookies: saved.useCookies ?? false,
      password: '',
      cookies: ''
    }
  } catch {
    return initialConfig
  }
}

function loadSavedCourses(): CourseInfo[] {
  try {
    const saved = JSON.parse(localStorage.getItem(savedCoursesKey) || '[]') as CourseInfo[]
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function parseCourseIds(value: string): string[] {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)))
}

function hasLoginInput(config: ChaoxingConfig): boolean {
  return config.useCookies ? Boolean(config.cookies.trim()) : Boolean(config.username.trim() && config.password)
}

function getStartBlockReason(config: ChaoxingConfig, selectedCount: number): string {
  if (!hasLoginInput(config)) return '请先填写账号密码，或启用 Cookie 登录。'
  if (selectedCount === 0) return '请先获取课程并至少选择一门课程。'
  return '当前不能开始运行。'
}

function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(8, Number(value.toFixed(1))))
}

function clampJobs(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(6, Math.floor(value)))
}

function speedRiskLabel(speed: number): string {
  if (speed <= 2) return '稳妥'
  if (speed <= 4) return '较快'
  if (speed <= 6) return '高倍率'
  return '激进'
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

function formatCourseProgress(progress: RunnerProgress, selectedCount: number): string {
  const total = progress.totalCourses ?? selectedCount
  if (!total) return '0'
  return `${progress.completedCourses}/${total}`
}

function formatTaskProgress(progress: RunnerProgress): string {
  if (progress.totalTasks && progress.unfinishedTasks !== null) {
    return `${progress.totalTasks - progress.unfinishedTasks}/${progress.totalTasks}`
  }
  return '待开始'
}

function statusText(status: RunnerProgress['status']): string {
  const text: Record<RunnerProgress['status'], string> = {
    idle: '空闲',
    preparing: '准备中',
    running: '运行中',
    stopping: '停止中',
    finished: '已完成',
    error: '异常'
  }
  return text[status]
}

function courseStatusClass(course: CourseInfo, progress: RunnerProgress, index: number): string {
  if (progress.currentCourse && course.title === progress.currentCourse) return 'course-run active'
  if (progress.completedCourses > index) return 'course-run done'
  return 'course-run'
}

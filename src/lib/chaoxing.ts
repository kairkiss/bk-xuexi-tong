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

export interface RunnerLog {
  level: 'info' | 'stdout' | 'stderr' | 'error'
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

export interface CourseInfo {
  courseId: string
  title: string
}

export interface CourseListResult extends RunnerResult {
  courses: CourseInfo[]
}

export interface ChaoxingBridge {
  start(config: ChaoxingConfig): Promise<RunnerResult>
  stop(): Promise<RunnerResult>
  courses(config: ChaoxingConfig): Promise<CourseListResult>
  diagnostics(): Promise<RunnerResult>
  exportLogs(): Promise<RunnerResult>
  clearLog(): Promise<RunnerResult>
  onLog(callback: (log: RunnerLog) => void): () => void
  onProgress(callback: (progress: RunnerProgress) => void): () => void
  onClearLog(callback: () => void): () => void
}

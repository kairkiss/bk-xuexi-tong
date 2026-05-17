import { contextBridge, ipcRenderer } from 'electron'
import type {
  ChaoxingConfig,
  CourseListResult,
  RunnerLog,
  RunnerProgress,
  RunnerResult
} from './pythonRunner'

const api = {
  start: (config: ChaoxingConfig): Promise<RunnerResult> => ipcRenderer.invoke('chaoxing:start', config),
  stop: (): Promise<RunnerResult> => ipcRenderer.invoke('chaoxing:stop'),
  courses: (config: ChaoxingConfig): Promise<CourseListResult> =>
    ipcRenderer.invoke('chaoxing:courses', config),
  diagnostics: (): Promise<RunnerResult> => ipcRenderer.invoke('chaoxing:diagnostics'),
  exportLogs: (): Promise<RunnerResult> => ipcRenderer.invoke('chaoxing:export-logs'),
  clearLog: (): Promise<RunnerResult> => ipcRenderer.invoke('chaoxing:clear-log'),
  onLog: (callback: (log: RunnerLog) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, log: RunnerLog): void => callback(log)
    ipcRenderer.on('chaoxing:log', listener)
    return () => ipcRenderer.removeListener('chaoxing:log', listener)
  },
  onProgress: (callback: (progress: RunnerProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: RunnerProgress): void =>
      callback(progress)
    ipcRenderer.on('chaoxing:progress', listener)
    return () => ipcRenderer.removeListener('chaoxing:progress', listener)
  },
  onClearLog: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('chaoxing:clear-log', listener)
    return () => ipcRenderer.removeListener('chaoxing:clear-log', listener)
  }
}

contextBridge.exposeInMainWorld('chaoxing', api)

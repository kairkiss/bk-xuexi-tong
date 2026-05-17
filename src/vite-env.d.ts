/// <reference types="vite/client" />

import type { ChaoxingBridge } from './lib/chaoxing'

declare global {
  interface Window {
    chaoxing: ChaoxingBridge
  }
}

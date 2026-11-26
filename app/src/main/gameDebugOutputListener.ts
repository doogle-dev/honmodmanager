import { ChildProcess } from 'child_process'
import { logLine } from './managerLogger'
import { spawnManagerHelper } from './managerHelper'

export type DebugOutputLineHandler = (processId: number, message: string) => void

let listenerProcess: ChildProcess | null = null
let listenerStarting: boolean = false
const lineHandlers = new Set<DebugOutputLineHandler>()

function attachListenerProcess(child: ChildProcess): void {
  const standardOutput = child.stdout
  if (!standardOutput) {
    logLine('listener', 'debug output listener started without an output stream')
    child.kill()
    return
  }
  let pendingOutput = ''
  standardOutput.setEncoding('utf8')
  standardOutput.on('data', (chunk: string) => {
    pendingOutput += chunk
    const lines = pendingOutput.split('\n')
    pendingOutput = lines.pop() ?? ''
    for (const line of lines) {
      const separatorIndex = line.indexOf('\t')
      if (separatorIndex < 0) {
        continue
      }
      const processId = parseInt(line.slice(0, separatorIndex), 10)
      const message = line.slice(separatorIndex + 1).replace(/\r$/, '')
      for (const lineHandler of lineHandlers) {
        lineHandler(processId, message)
      }
    }
  })
  child.on('error', (error) => {
    logLine('listener', 'debug output listener failed: ' + String(error))
    if (listenerProcess === child) {
      listenerProcess = null
    }
  })
  child.on('exit', (exitCode) => {
    logLine('listener', 'debug output listener exited with code ' + String(exitCode))
    if (listenerProcess === child) {
      listenerProcess = null
    }
  })
  listenerProcess = child
  logLine('listener', 'debug output listener started, pid ' + String(child.pid))
}

export function startDebugOutputListener(onLine: DebugOutputLineHandler): void {
  lineHandlers.add(onLine)
  if (listenerProcess || listenerStarting) {
    return
  }
  listenerStarting = true
  spawnManagerHelper('debug-output', { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
    .then((child) => {
      listenerStarting = false
      // The session can end while the helper is still being prepared.
      if (lineHandlers.size === 0 || listenerProcess) {
        child.kill()
        return
      }
      attachListenerProcess(child)
    })
    .catch((error) => {
      listenerStarting = false
      logLine('listener', 'debug output listener could not start: ' + String(error))
    })
}

export function stopDebugOutputListener(onLine?: DebugOutputLineHandler): void {
  if (onLine) {
    lineHandlers.delete(onLine)
  } else {
    lineHandlers.clear()
  }
  if (lineHandlers.size > 0) {
    return
  }
  if (!listenerProcess) {
    return
  }
  listenerProcess.kill()
  listenerProcess = null
}

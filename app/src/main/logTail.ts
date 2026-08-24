import { WebContents } from 'electron'
import { LOG_TAIL_INITIAL_BYTES, managerLogPath, readLogSlice, translationLogPath } from './managerLogger'

const TAIL_POLL_MILLISECONDS = 700
const TAIL_LINE_LIMIT = 600

export type LogName = 'translation' | 'manager'

type ActiveTail = {
  filePath: string
  offset: number
  partialLine: string
  timer: NodeJS.Timeout
}

const activeTails = new Map<WebContents, ActiveTail>()
const cleanupBoundTargets = new WeakSet<WebContents>()

function logPathFor(logName: LogName): string {
  return logName === 'manager' ? managerLogPath() : translationLogPath()
}

function splitCompleteLines(tail: ActiveTail, text: string): string[] {
  const combined = tail.partialLine + text
  const pieces = combined.split(/\r?\n/)
  tail.partialLine = pieces.pop() ?? ''
  return pieces.filter((line) => line.length > 0)
}

function pollTail(target: WebContents, tail: ActiveTail): void {
  if (target.isDestroyed()) {
    stopLogTail(target)
    return
  }
  const previousOffset = tail.offset
  const slice = readLogSlice(tail.filePath, tail.offset, LOG_TAIL_INITIAL_BYTES)
  const logRotated = slice.nextOffset < previousOffset
  tail.offset = slice.nextOffset
  if (!slice.text) {
    return
  }
  // A rotation or a burst larger than the read window leaves a half line behind, so start clean.
  if (slice.startedMidFile || logRotated) {
    tail.partialLine = ''
  }
  const lines = splitCompleteLines(tail, slice.text)
  if (lines.length > 0) {
    target.send('logs:tailAppend', lines.slice(-TAIL_LINE_LIMIT))
  }
}

export function startLogTail(target: WebContents, logName: LogName): { lines: string[]; filePath: string } {
  stopLogTail(target)
  const filePath = logPathFor(logName)
  const slice = readLogSlice(filePath, 0, LOG_TAIL_INITIAL_BYTES)
  const lines = slice.text.split(/\r?\n/).filter((line) => line.length > 0)
  // A tail that starts mid file almost always begins on half a line, so drop that first fragment.
  if (slice.startedMidFile && lines.length > 0) {
    lines.shift()
  }
  const tail: ActiveTail = {
    filePath,
    offset: slice.nextOffset,
    partialLine: '',
    timer: setInterval(() => pollTail(target, tail), TAIL_POLL_MILLISECONDS)
  }
  activeTails.set(target, tail)
  // Reopening the view must not stack another destroyed handler on the same web contents.
  if (!cleanupBoundTargets.has(target)) {
    cleanupBoundTargets.add(target)
    target.once('destroyed', () => {
      cleanupBoundTargets.delete(target)
      stopLogTail(target)
    })
  }
  return { lines: lines.slice(-TAIL_LINE_LIMIT), filePath }
}

export function stopLogTail(target: WebContents): void {
  const tail = activeTails.get(target)
  if (!tail) {
    return
  }
  clearInterval(tail.timer)
  activeTails.delete(target)
}

import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'

const LISTENER_SCRIPT = String.raw`$typeDefinition = @"
using System;
using System.IO.MemoryMappedFiles;
using System.Text;
using System.Threading;

public static class DebugOutputListener
{
    public static void Run()
    {
        EventWaitHandle bufferReady = new EventWaitHandle(false, EventResetMode.AutoReset, "DBWIN_BUFFER_READY");
        EventWaitHandle dataReady = new EventWaitHandle(false, EventResetMode.AutoReset, "DBWIN_DATA_READY");
        using (MemoryMappedFile mappedFile = MemoryMappedFile.CreateOrOpen("DBWIN_BUFFER", 4096))
        using (MemoryMappedViewAccessor accessor = mappedFile.CreateViewAccessor(0, 4096, MemoryMappedFileAccess.Read))
        {
            bufferReady.Set();
            while (true)
            {
                if (!dataReady.WaitOne(1000)) { continue; }
                int processId = accessor.ReadInt32(0);
                byte[] messageBytes = new byte[4092];
                accessor.ReadArray(4, messageBytes, 0, 4092);
                int length = Array.IndexOf(messageBytes, (byte)0);
                if (length < 0) { length = messageBytes.Length; }
                string message = Encoding.Default.GetString(messageBytes, 0, length);
                Console.WriteLine(processId.ToString() + "\t" + message.TrimEnd('\r', '\n'));
                bufferReady.Set();
            }
        }
    }
}
"@
Add-Type -TypeDefinition $typeDefinition -ReferencedAssemblies System.Core
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[DebugOutputListener]::Run()
`

export type DebugOutputLineHandler = (processId: number, message: string) => void

let listenerProcess: ChildProcess | null = null

export function startDebugOutputListener(onLine: DebugOutputLineHandler): void {
  if (listenerProcess) {
    return
  }
  const scriptPath = join(app.getPath('userData'), 'debugOutputListener.ps1')
  writeFileSync(scriptPath, LISTENER_SCRIPT)
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  })
  let pendingOutput = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
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
      onLine(processId, message)
    }
  })
  child.on('exit', () => {
    if (listenerProcess === child) {
      listenerProcess = null
    }
  })
  listenerProcess = child
}

export function stopDebugOutputListener(): void {
  if (!listenerProcess) {
    return
  }
  listenerProcess.kill()
  listenerProcess = null
}

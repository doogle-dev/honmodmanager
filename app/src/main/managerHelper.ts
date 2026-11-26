import { app } from 'electron'
import { spawn, execFile, ChildProcess, SpawnOptions } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { logLine } from './managerLogger'

export type ManagerHelperMode = 'debug-output' | 'focus-game'

// A small compiled helper does the Windows only work that used to run inside PowerShell, which
// costs tens of megabytes per process where this costs a few.
const HELPER_SOURCE = String.raw`using System;
using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Reflection;
using System.Text;
using System.Threading;

public static class ManagerHelper
{
    [STAThread]
    public static int Main(string[] arguments)
    {
        if (arguments.Length != 1)
        {
            return 1;
        }
        return Run(arguments[0]);
    }

    public static int Run(string mode)
    {
        if (mode == "debug-output")
        {
            ListenToDebugOutput();
            return 0;
        }
        if (mode == "focus-game")
        {
            FocusGameWindow();
            return 0;
        }
        return 1;
    }

    static void ListenToDebugOutput()
    {
        Console.OutputEncoding = Encoding.UTF8;
        EventWaitHandle bufferReady = new EventWaitHandle(false, EventResetMode.AutoReset, "DBWIN_BUFFER_READY");
        EventWaitHandle dataReady = new EventWaitHandle(false, EventResetMode.AutoReset, "DBWIN_DATA_READY");
        using (MemoryMappedFile mappedFile = MemoryMappedFile.CreateOrOpen("DBWIN_BUFFER", 4096))
        using (MemoryMappedViewAccessor accessor = mappedFile.CreateViewAccessor(0, 4096, MemoryMappedFileAccess.Read))
        {
            byte[] messageBytes = new byte[4092];
            bufferReady.Set();
            while (true)
            {
                if (!dataReady.WaitOne(1000)) { continue; }
                int processId = accessor.ReadInt32(0);
                accessor.ReadArray(4, messageBytes, 0, 4092);
                int length = Array.IndexOf(messageBytes, (byte)0);
                if (length < 0) { length = messageBytes.Length; }
                string message = Encoding.Default.GetString(messageBytes, 0, length);
                Console.WriteLine(processId.ToString() + "\t" + message.TrimEnd('\r', '\n'));
                bufferReady.Set();
            }
        }
    }

    static void FocusGameWindow()
    {
        object shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        for (int attempt = 0; attempt < 20; attempt++)
        {
            Thread.Sleep(2000);
            Process gameProcess = FindGameWindowProcess();
            if (gameProcess == null || !ActivateProcessWindow(shell, gameProcess.Id))
            {
                continue;
            }
            Thread.Sleep(5000);
            ActivateProcessWindow(shell, gameProcess.Id);
            return;
        }
    }

    static Process FindGameWindowProcess()
    {
        foreach (Process candidate in Process.GetProcessesByName("juvio"))
        {
            if (candidate.MainWindowHandle != IntPtr.Zero)
            {
                return candidate;
            }
        }
        return null;
    }

    static bool ActivateProcessWindow(object shell, int processId)
    {
        try
        {
            return (bool)shell.GetType().InvokeMember("AppActivate", BindingFlags.InvokeMethod, null, shell, new object[] { processId });
        }
        catch
        {
            return false;
        }
    }
}
`

const SOURCE_HASH = createHash('sha256').update(HELPER_SOURCE).digest('hex').slice(0, 12)

let helperPathPromise: Promise<string | null> | null = null

function helperDirectory(): string {
  const directory = join(app.getPath('userData'), 'helper')
  mkdirSync(directory, { recursive: true })
  return directory
}

function helperSourcePath(): string {
  const sourcePath = join(helperDirectory(), 'ManagerHelper-' + SOURCE_HASH + '.cs')
  if (!existsSync(sourcePath)) {
    writeFileSync(sourcePath, HELPER_SOURCE)
  }
  return sourcePath
}

// The .NET Framework compiler ships with every supported Windows, so the helper is built once on
// the player's machine and reused until its source changes.
function compileHelper(): Promise<string | null> {
  const executablePath = join(helperDirectory(), 'ManagerHelper-' + SOURCE_HASH + '.exe')
  if (existsSync(executablePath)) {
    return Promise.resolve(executablePath)
  }
  const compilerPath = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
  if (!existsSync(compilerPath)) {
    logLine('listener', 'the .NET Framework compiler was not found, using PowerShell for the helper')
    return Promise.resolve(null)
  }
  const compilerArguments = [
    '/nologo',
    '/optimize+',
    '/target:exe',
    '/reference:System.Core.dll',
    '/out:' + executablePath,
    helperSourcePath()
  ]
  return new Promise((resolveHelperPath) => {
    execFile(compilerPath, compilerArguments, { windowsHide: true }, (error, standardOutput) => {
      if (error || !existsSync(executablePath)) {
        logLine('listener', 'helper compile failed, using PowerShell instead: ' + String(error) + ' ' + standardOutput)
        resolveHelperPath(null)
        return
      }
      logLine('listener', 'helper compiled to ' + executablePath)
      resolveHelperPath(executablePath)
    })
  })
}

function prepareManagerHelper(): Promise<string | null> {
  if (!helperPathPromise) {
    helperPathPromise = compileHelper()
  }
  return helperPathPromise
}

export function spawnManagerHelper(mode: ManagerHelperMode, options: SpawnOptions): Promise<ChildProcess> {
  return prepareManagerHelper().then((helperPath) => {
    if (helperPath) {
      return spawn(helperPath, [mode], options)
    }
    const fallbackCommand =
      "Add-Type -Path '" +
      helperSourcePath().replace(/'/g, "''") +
      "' -ReferencedAssemblies System.Core; exit [ManagerHelper]::Run('" +
      mode +
      "')"
    return spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', fallbackCommand], options)
  })
}

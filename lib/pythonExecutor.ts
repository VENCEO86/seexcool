/**
 * Python 실행 유틸리티
 * Python 3.12 전용 실행 경로 관리
 */

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

/**
 * Python 3.12 실행 경로 자동 감지
 */
export function getPython312Command(): string[] {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: Python 3.12 전용 실행
    // 1순위: 절대 경로 (확실한 경로)
    const python312Path = "C:\\Program Files\\Python312\\python.exe";
    const fs = require("fs");
    if (fs.existsSync(python312Path)) {
      return [python312Path];
    }
    // 2순위: py -3.12 (Python Launcher가 자동으로 3.12 찾음)
    return ["py", "-3.12"];
  } else {
    // Linux/Mac: python3.12 우선
    return ["python3.12"];
  }
}

/**
 * Python 스크립트 실행 (Python 3.12 전용)
 */
export function spawnPython312(
  scriptPath: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
  } = {}
): ChildProcessWithoutNullStreams {
  const [command, ...commandArgs] = getPython312Command();
  const allArgs = [...commandArgs, scriptPath, ...args];

  const env = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
    ...options.env,
  };

  return spawn(command, allArgs, {
    cwd: options.cwd || process.cwd(),
    env,
  });
}

/**
 * Python 3.12 설치 여부 확인
 */
export async function checkPython312(): Promise<{
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const [command, ...commandArgs] = getPython312Command();
    const checkProcess = spawn(command, [...commandArgs, "--version"], {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
    });

    let stdout = "";
    let stderr = "";

    checkProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    checkProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    checkProcess.on("close", (code) => {
      if (code === 0) {
        const version = (stdout || stderr).trim();
        resolve({
          available: true,
          version,
          path: command,
        });
      } else {
        resolve({
          available: false,
          error: `Python 3.12 not found. Exit code: ${code}`,
        });
      }
    });

    checkProcess.on("error", (err) => {
      resolve({
        available: false,
        error: err.message,
      });
    });
  });
}


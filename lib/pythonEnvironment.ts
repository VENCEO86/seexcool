export type PythonExecutionMode = 'local' | 'remote';

export function detectPythonEnvironment(): {
  mode: PythonExecutionMode;
  pythonServerUrl?: string;
  useLocalPython: boolean;
} {
  const explicitMode = process.env.PYTHON_EXECUTION_MODE;
  if (explicitMode === 'local' || explicitMode === 'remote') {
    return {
      mode: explicitMode,
      pythonServerUrl: process.env.PYTHON_SERVER_URL,
      useLocalPython: explicitMode === 'local',
    };
  }

  const nodeEnv = process.env.NODE_ENV;
  
  if (nodeEnv === 'development' || !nodeEnv) {
    return {
      mode: 'local',
      pythonServerUrl: undefined,
      useLocalPython: true,
    };
  }
  
  const pythonServerUrl = process.env.PYTHON_SERVER_URL;
  
  // 프로덕션 환경에서는 기본적으로 원격 Python 서버 사용
  // (Render 서버에는 Python이 설치되어 있지 않을 수 있음)
  if (nodeEnv === 'production') {
    // 환경 변수로 명시적으로 설정된 경우
    if (pythonServerUrl && pythonServerUrl.trim() !== '') {
      return {
        mode: 'remote',
        pythonServerUrl: pythonServerUrl.trim(),
        useLocalPython: false,
      };
    }
    
    // 환경 변수가 없어도 기본 원격 서버 URL 사용
    // Render 서버에서는 로컬 Python 실행이 불가능할 수 있으므로 원격 서버 기본 사용
    return {
      mode: 'remote',
      pythonServerUrl: 'https://python-ai-server-ezax.onrender.com/enhance',
      useLocalPython: false,
    };
  }

  return {
    mode: 'local',
    pythonServerUrl: undefined,
    useLocalPython: true,
  };
}

export function getPythonScriptPath(scriptName: string): string {
  const path = require('path');
  return path.join(process.cwd(), 'scripts', scriptName);
}

export function logPythonEnvironment(): void {
  const env = detectPythonEnvironment();
  console.log('[Python Environment]', {
    mode: env.mode,
    useLocalPython: env.useLocalPython,
    pythonServerUrl: env.pythonServerUrl || 'not set',
    nodeEnv: process.env.NODE_ENV || 'not set',
  });
}

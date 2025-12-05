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
  if (pythonServerUrl && pythonServerUrl.trim() !== '' && nodeEnv === 'production') {
    return {
      mode: 'remote',
      pythonServerUrl: pythonServerUrl.trim(),
      useLocalPython: false,
    };
  }
  
  if (nodeEnv === 'production') {
    return {
      mode: 'local',
      pythonServerUrl: undefined,
      useLocalPython: true,
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

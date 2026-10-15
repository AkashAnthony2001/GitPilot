import { FromWebviewMessage } from '../../src/models/types';

interface VSCodeAPI {
  postMessage(message: FromWebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

let vscodeApiInstance: VSCodeAPI | undefined;

export function getVsCodeApi(): VSCodeAPI {
  if (!vscodeApiInstance) {
    if (typeof acquireVsCodeApi === 'function') {
      vscodeApiInstance = acquireVsCodeApi();
    } else {
      // Mock for browser dev environment
      vscodeApiInstance = {
        postMessage: (msg: FromWebviewMessage) => {
          console.log('[Dev Mock VSCode] postMessage:', msg);
        },
        getState: () => ({}),
        setState: (s) => console.log('[Dev Mock VSCode] setState:', s),
      };
    }
  }
  return vscodeApiInstance;
}

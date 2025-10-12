// React 19+ testing environment flag for act(...)
// See: https://react.dev/reference/react/act#testing-environments
// This ensures React knows we are in a testing environment and suppresses the warning.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;


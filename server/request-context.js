import { AsyncLocalStorage } from 'node:async_hooks';

// Each serverless invocation has its own temporary files, including concurrent invocations.
export const requestContext=new AsyncLocalStorage();

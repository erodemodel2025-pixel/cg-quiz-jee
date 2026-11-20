import { onRequest } from './functions/api/[[path]].ts';

interface WorkerEnv {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return onRequest({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};

import cluster from 'node:cluster';
import os from 'node:os';
import { startApi } from './start-api';

const workers = Number(
  process.env.API_WORKERS ?? Math.min(4, os.cpus().length),
);

if (cluster.isPrimary) {
  console.log(`API cluster — starting ${workers} workers on port ${process.env.API_PORT ?? 3001}`);
  for (let i = 0; i < workers; i++) {
    const worker = cluster.fork({ CLUSTER_WORKER_ID: String(i + 1) });
    worker.on('online', () => {
      console.log(`Worker ${worker.process.pid} online`);
    });
  }
  cluster.on('exit', (worker, code) => {
    console.warn(`Worker ${worker.process.pid} exited (${code}) — restarting`);
    cluster.fork({ CLUSTER_WORKER_ID: 'restarted' });
  });
} else {
  startApi().catch((err) => {
    console.error('API worker failed to start', err);
    process.exit(1);
  });
}

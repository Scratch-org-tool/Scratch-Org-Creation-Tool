import './load-env';
import { startApi } from './start-api';

startApi().catch((err) => {
  console.error('API failed to start', err);
  process.exit(1);
});

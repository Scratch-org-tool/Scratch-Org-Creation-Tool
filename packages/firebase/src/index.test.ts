import { it } from 'node:test';
import assert from 'node:assert/strict';
import type { AgentSession, CopilotMessage } from '@sfcc/shared';
import { getAgentSession, initFirebase, saveAgentSession } from './index';

function message(id: string): CopilotMessage {
  return {
    id,
    role: 'user',
    content: id,
    timestamp: new Date().toISOString(),
  };
}

it('fails closed in production and atomically merges concurrent session writes', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFallback = process.env.FIREBASE_ALLOW_IN_MEMORY;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.FIREBASE_ALLOW_IN_MEMORY;
    assert.throws(
      () => initFirebase({ projectId: '', clientEmail: '', privateKey: '' }),
      /Missing or invalid Firebase Admin SDK credentials/,
    );

    process.env.NODE_ENV = 'test';
    const base: Omit<AgentSession, 'messages'> = {
      id: 'concurrent-session',
      userId: 'user-1',
      agentType: 'general',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await Promise.all([
      saveAgentSession({ ...base, messages: [message('message-1')] }),
      saveAgentSession({ ...base, messages: [message('message-2')] }),
    ]);

    const saved = await getAgentSession(base.id);
    assert.deepEqual(
      saved?.messages.map((item) => item.id).sort(),
      ['message-1', 'message-2'],
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFallback === undefined) delete process.env.FIREBASE_ALLOW_IN_MEMORY;
    else process.env.FIREBASE_ALLOW_IN_MEMORY = originalFallback;
  }
});

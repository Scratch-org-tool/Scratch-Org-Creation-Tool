import type { DeploymentState } from '../types/deployment-state';
import { ACTIVE_STATES, TERMINAL_STATES } from '../types/deployment-state';

const VALID_TRANSITIONS: Record<DeploymentState, DeploymentState[]> = {
  NOT_DISCOVERED: ['DISCOVERED'],
  DISCOVERED: ['READY', 'SKIPPED', 'WAITING'],
  READY: ['QUEUED', 'SKIPPED'],
  QUEUED: ['DEPLOYING', 'SKIPPED'],
  DEPLOYING: ['DEPLOYED', 'FAILED', 'WAITING'],
  DEPLOYED: [],
  FAILED: ['RETRYING', 'SKIPPED'],
  WAITING: ['READY', 'SKIPPED'],
  RETRYING: ['QUEUED', 'FAILED', 'SKIPPED'],
  SKIPPED: [],
};

export class DeploymentStateMachine {
  canTransition(from: DeploymentState, to: DeploymentState): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  transition(from: DeploymentState, to: DeploymentState): DeploymentState {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid deployment state transition: ${from} -> ${to}`);
    }
    return to;
  }

  isTerminal(state: DeploymentState): boolean {
    return TERMINAL_STATES.has(state);
  }

  isActive(state: DeploymentState): boolean {
    return ACTIVE_STATES.has(state);
  }
}

export const deploymentStateMachine = new DeploymentStateMachine();

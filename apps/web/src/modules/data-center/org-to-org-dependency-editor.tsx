'use client';

import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/studio';
import type { OrgToOrgObjectDeployConfig, OrgToOrgObjectInfo } from './types';

export function OrgToOrgDependencyEditor({
  objects,
  configs,
  error,
  onMove,
  onToggleDependency,
}: {
  objects: OrgToOrgObjectInfo[];
  configs: Map<string, OrgToOrgObjectDeployConfig>;
  error: string | null;
  onMove: (index: number, direction: -1 | 1) => void;
  onToggleDependency: (objectName: string, dependencyName: string, enabled: boolean) => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border/60 p-4" aria-label="Object dependency order">
      <div>
        <p className="text-sm font-medium">Dependency order</p>
        <p className="text-xs text-muted-foreground">
          Reorder with the buttons and declare prerequisites. Cycles block preflight.
        </p>
      </div>
      {objects.map((object, index) => {
        const dependencies = configs.get(object.apiName)?.dependsOn ?? [];
        return (
          <div key={object.apiName} className="rounded border border-border/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{index + 1}. {object.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{object.apiName}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={index === 0}
                  aria-label={`Move ${object.label} earlier`}
                  onClick={() => onMove(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={index === objects.length - 1}
                  aria-label={`Move ${object.label} later`}
                  onClick={() => onMove(index, 1)}
                >
                  ↓
                </Button>
              </div>
            </div>
            {objects.length > 1 && (
              <fieldset className="mt-2">
                <legend className="text-xs font-medium">Wait for</legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  {objects.filter((candidate) => candidate.apiName !== object.apiName).map((candidate) => (
                    <label key={candidate.apiName} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={dependencies.includes(candidate.apiName)}
                        onChange={(event) => onToggleDependency(
                          object.apiName,
                          candidate.apiName,
                          event.target.checked,
                        )}
                      />
                      {candidate.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        );
      })}
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </section>
  );
}

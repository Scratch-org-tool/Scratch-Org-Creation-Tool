import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import type { KnowledgeTier } from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';

export interface KnowledgeSearchHit {
  id: string;
  source: string;
  sourceType: string;
  tier: string;
  content: string;
  score: number;
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly nvidiaService: NvidiaService) {}

  async ingest(
    source: string,
    sourceType: string,
    content: string,
    tier: KnowledgeTier = 'internal',
  ) {
    const embedding = await this.nvidiaService.embed(content);
    return prisma.knowledgeChunk.create({
      data: {
        source,
        sourceType,
        tier,
        content,
        metadata: { ingestedAt: new Date().toISOString() },
        embedding,
      },
    });
  }

  /** Remove previously ingested chunks for a source type (used by corpus re-seeding). */
  async clearBySourceType(sourceType: string): Promise<number> {
    const result = await prisma.knowledgeChunk.deleteMany({ where: { sourceType } });
    return result.count;
  }

  /**
   * Tier-filtered retrieval. The tier filter runs in the database query, so
   * chunks outside the caller's tiers can never appear in an LLM prompt.
   */
  async search(
    query: string,
    limit = 5,
    tiers: KnowledgeTier[] = ['app_guide', 'internal'],
  ): Promise<KnowledgeSearchHit[]> {
    if (tiers.length === 0) return [];
    const queryEmbedding = await this.nvidiaService.embed(query);
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { tier: { in: tiers } },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    return chunks
      .map((chunk) => ({
        id: chunk.id,
        source: chunk.source,
        sourceType: chunk.sourceType,
        tier: chunk.tier,
        content: chunk.content,
        score: this.cosineSimilarity(
          queryEmbedding,
          (chunk.embedding as number[] | null) ?? [],
        ),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

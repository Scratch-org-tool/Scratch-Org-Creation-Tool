import { Injectable } from '@nestjs/common';
import type { LearningTutorAskInput, LearningTutorReply } from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { getLesson, getModule } from './curriculum';

const TUTOR_TIMEOUT_MS = parseInt(process.env.LEARNING_TUTOR_TIMEOUT_MS ?? '30000', 10) || 30_000;

const MENTOR_PERSONA = [
  'You are "SF Mentor", a principal Salesforce architect mentoring a colleague inside a DevOps platform\'s Salesforce Academy.',
  'Teaching style:',
  '- Explain concepts in plain language first, then the precise Salesforce terminology.',
  '- ALWAYS ground answers with a short real-world example (a company scenario, a concrete org situation).',
  '- Where useful, include a tiny code or formula snippet.',
  '- Correct misconceptions kindly and directly.',
  '- Stay on Salesforce topics; if asked something unrelated, briefly redirect to Salesforce learning.',
  '- Keep answers focused: no filler, no repeated caveats. Aim for 120-250 words unless the question truly needs more.',
].join('\n');

@Injectable()
export class LearningTutorService {
  constructor(private readonly nvidia: NvidiaService) {}

  async ask(input: LearningTutorAskInput): Promise<LearningTutorReply> {
    const context = this.buildContext(input.lessonId, input.moduleId);

    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: `${MENTOR_PERSONA}${context ? `\n\n${context}` : ''}` },
    ];
    for (const turn of input.history ?? []) {
      messages.push({ role: turn.role, content: turn.content });
    }
    messages.push({ role: 'user', content: input.question });

    const result = await this.nvidia.chat({
      messages,
      maxTokens: 900,
      temperature: 0.3,
      timeoutMs: TUTOR_TIMEOUT_MS,
    });

    return {
      answer: result.content,
      model: result.model,
      suggestions: this.buildSuggestions(input.lessonId, input.moduleId),
    };
  }

  /** Lesson/module grounding injected into the system prompt. */
  private buildContext(lessonId?: string, moduleId?: string): string {
    if (lessonId) {
      const location = getLesson(lessonId);
      if (location) {
        const { path, module, lesson } = location;
        const sectionOutline = lesson.sections
          .map((section) => `- ${section.heading}`)
          .join('\n');
        return [
          'Current learning context:',
          `Path: ${path.title} (${path.level})`,
          `Module: ${module.title}`,
          `Lesson: ${lesson.title} — ${lesson.summary}`,
          'Lesson sections:',
          sectionOutline,
          `Key takeaways: ${lesson.keyTakeaways.join(' | ')}`,
          'Prefer answering within this lesson\'s scope and connect explanations back to it.',
        ].join('\n');
      }
    }
    if (moduleId) {
      const location = getModule(moduleId);
      if (location) {
        return [
          'Current learning context:',
          `Path: ${location.path.title} (${location.path.level})`,
          `Module: ${location.module.title} — ${location.module.summary}`,
        ].join('\n');
      }
    }
    return '';
  }

  /** Follow-up prompts derived from lesson content — deterministic, zero latency. */
  private buildSuggestions(lessonId?: string, moduleId?: string): string[] {
    if (lessonId) {
      const location = getLesson(lessonId);
      if (location) {
        const { lesson } = location;
        const fromObjectives = lesson.objectives
          .slice(0, 2)
          .map((objective) => `Can you explain more: ${objective.toLowerCase()}?`);
        return [
          ...fromObjectives,
          `Give me another real-world example of ${lesson.title.toLowerCase()}.`,
          'Quiz me with one quick question on this lesson.',
        ].slice(0, 4);
      }
    }
    if (moduleId) {
      const location = getModule(moduleId);
      if (location) {
        return [
          `What are the hardest concepts in "${location.module.title}"?`,
          'Give me a real-world scenario that uses this module\'s skills.',
          'How does this topic come up in Salesforce interviews?',
        ];
      }
    }
    return [
      'Build me a study plan for the Salesforce Admin certification.',
      'Explain the Salesforce security model with a real example.',
      'What should a fresher learn first on the Salesforce platform?',
    ];
  }
}

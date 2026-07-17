import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { StaticAnalysisIssue } from '@sfcc/shared';

/**
 * Built-in static analysis engine.
 *
 * Runs entirely inside the API process (no external CLI required) so the
 * deployment workbench always has at least one working analyzer. Rules focus
 * on high-signal Salesforce review findings: governor-limit hazards, SOQL
 * injection, sharing declarations, hardcoded IDs, inactive flows, and unsafe
 * Lightning JavaScript.
 */

export const BUILT_IN_ENGINE = 'built-in';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ISSUES_PER_FILE = 100;
const MAX_TOTAL_ISSUES = 2_000;
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', '.sf', '.sfdx', '.vscode']);

/** PMD-compatible Salesforce ID literal shape: 15 or 18 chars with `0` in position 6. */
const HARDCODED_ID_PATTERN = /^[a-zA-Z0-9]{5}0[a-zA-Z0-9]{9}([a-zA-Z0-5]{3})?$/;

interface RawIssue {
  ruleId: string;
  severity: StaticAnalysisIssue['severity'];
  message: string;
  line?: number;
  column?: number;
}

interface SanitizedSource {
  /** Source with comments and string literal contents blanked (structure preserved). */
  code: string;
  /** String literals with their positions in the original source. */
  strings: Array<{ value: string; index: number }>;
}

export interface BuiltInAnalysisReport {
  engine: typeof BUILT_IN_ENGINE;
  scannedFiles: number;
  issues: StaticAnalysisIssue[];
  truncated: boolean;
}

export function runBuiltInAnalysis(projectRoot: string): BuiltInAnalysisReport {
  const issues: StaticAnalysisIssue[] = [];
  let scannedFiles = 0;
  let truncated = false;

  for (const file of collectSourceFiles(projectRoot)) {
    if (issues.length >= MAX_TOTAL_ISSUES) {
      truncated = true;
      break;
    }
    let content: string;
    try {
      const stats = fs.statSync(file.absolute);
      if (stats.size > MAX_FILE_BYTES) continue;
      content = fs.readFileSync(file.absolute, 'utf8');
    } catch {
      continue;
    }
    scannedFiles += 1;
    const raw = analyzeFile(file.relative, content);
    if (raw.length > MAX_ISSUES_PER_FILE) truncated = true;
    for (const issue of raw.slice(0, MAX_ISSUES_PER_FILE)) {
      issues.push(finalizeIssue(file.relative, issue));
      if (issues.length >= MAX_TOTAL_ISSUES) break;
    }
  }
  return { engine: BUILT_IN_ENGINE, scannedFiles, issues, truncated };
}

export function analyzeFile(relativePath: string, content: string): RawIssue[] {
  const name = path.basename(relativePath).toLowerCase();
  if (name.endsWith('.cls') || name.endsWith('.trigger')) {
    return analyzeApex(content, name.endsWith('.trigger'));
  }
  if (name.endsWith('.js') && isLightningJavaScript(relativePath)) {
    return analyzeLightningJs(content);
  }
  if (name.endsWith('.flow-meta.xml')) {
    return analyzeFlow(content);
  }
  if (name.endsWith('-meta.xml')) {
    return analyzeComponentMeta(content);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Apex
// ---------------------------------------------------------------------------

function analyzeApex(content: string, isTrigger: boolean): RawIssue[] {
  const issues: RawIssue[] = [];
  const { code, strings } = sanitize(content);
  const lineAt = lineLocator(content);
  const isTestFile = /@istest\b/i.test(code);

  const loopRanges = findLoopBodies(code);
  const inLoop = (index: number) => loopRanges.some((range) => index > range.start && index < range.end);

  // SOQL / SOSL inside loops.
  for (const match of matchAll(code, /\[\s*(?:select|find)\b/gi)) {
    if (inLoop(match.index)) {
      issues.push({
        ruleId: 'APEX_SOQL_IN_LOOP',
        severity: 'error',
        message: 'SOQL/SOSL query inside a loop consumes governor limits per iteration. Query once before the loop and use collections.',
        ...lineAt(match.index),
      });
    }
  }

  // DML statements and Database.* calls inside loops.
  const dmlPattern = /\b(insert|update|delete|undelete|upsert|merge)\s+[\w([{'"]|\bDatabase\s*\.\s*(insert|update|delete|undelete|upsert|merge|query|countQuery|queryWithBinds)\s*\(/gi;
  for (const match of matchAll(code, dmlPattern)) {
    if (inLoop(match.index)) {
      issues.push({
        ruleId: 'APEX_DML_IN_LOOP',
        severity: 'error',
        message: 'DML or Database operation inside a loop consumes governor limits per iteration. Collect records and perform one bulk operation after the loop.',
        ...lineAt(match.index),
      });
    }
  }

  // Dynamic SOQL built by concatenation (SOQL injection risk).
  for (const match of matchAll(code, /\bDatabase\s*\.\s*(query|countQuery)\s*\(/gi)) {
    const argument = readBalancedArgument(code, match.index + match[0].length - 1);
    if (argument.includes('+')) {
      issues.push({
        ruleId: 'APEX_SOQL_INJECTION',
        severity: 'critical',
        message: 'Dynamic SOQL is built with string concatenation. Use bind variables (Database.queryWithBinds) or String.escapeSingleQuotes to prevent SOQL injection.',
        ...lineAt(match.index),
      });
    }
  }

  // Hardcoded record IDs in string literals.
  for (const literal of strings) {
    if (HARDCODED_ID_PATTERN.test(literal.value)) {
      issues.push({
        ruleId: 'APEX_HARDCODED_ID',
        severity: 'warning',
        message: `Hardcoded Salesforce ID '${literal.value}' will break across orgs. Query the record or use Custom Metadata/Custom Settings instead.`,
        ...lineAt(literal.index),
      });
    }
    if (/^https?:\/\/[^ ]*\.(?:salesforce|force|cloudforce)\.com/i.test(literal.value.trim())) {
      issues.push({
        ruleId: 'APEX_HARDCODED_URL',
        severity: 'warning',
        message: 'Hardcoded Salesforce instance URL will break across orgs and pod migrations. Use URL.getOrgDomainUrl() or a Named Credential.',
        ...lineAt(literal.index),
      });
    }
  }

  // Empty catch blocks swallow failures silently.
  for (const match of matchAll(code, /\bcatch\s*\([^)]*\)\s*\{\s*\}/gi)) {
    issues.push({
      ruleId: 'APEX_EMPTY_CATCH',
      severity: 'warning',
      message: 'Empty catch block silently swallows the exception. Handle it, rethrow it, or log it with context.',
      ...lineAt(match.index),
    });
  }

  // Debug statements left in deployable code.
  for (const match of matchAll(code, /\bSystem\s*\.\s*debug\s*\(/gi)) {
    issues.push({
      ruleId: 'APEX_SYSTEM_DEBUG',
      severity: 'info',
      message: 'System.debug statement left in code. Remove it or guard it behind a logging framework before deploying.',
      ...lineAt(match.index),
    });
  }

  // Tests depending on org data.
  const seeAllData = /@istest\s*\(\s*[^)]*seealldata\s*=\s*true/i.exec(code);
  if (seeAllData) {
    issues.push({
      ruleId: 'APEX_SEEALLDATA_TRUE',
      severity: 'warning',
      message: '@isTest(SeeAllData=true) couples the test to org data and makes it fragile. Create test data with @TestSetup instead.',
      ...lineAt(seeAllData.index),
    });
  }

  if (isTrigger) {
    if (/\[\s*(?:select|find)\b/i.test(code) || matchAll(code, dmlPattern).length > 0) {
      issues.push({
        ruleId: 'APEX_TRIGGER_LOGIC',
        severity: 'warning',
        message: 'Trigger contains query or DML logic directly. Delegate to a handler class so the trigger stays thin and testable.',
        line: 1,
      });
    }
  } else if (!isTestFile) {
    // Sharing declaration on the outer class when it touches data. Modifier
    // order is flexible in Apex, so match any modifier sequence before `class`.
    const classMatch = /(^|\n)[ \t]*(?:@\w+(?:\([^)]*\))?\s*)*((?:(?:global|public|private|protected|virtual|abstract|with\s+sharing|without\s+sharing|inherited\s+sharing)\s+)*)class\b/i
      .exec(code);
    if (classMatch) {
      const modifiers = classMatch[2] ?? '';
      const location = lineAt(classMatch.index + (classMatch[1]?.length ?? 0));
      const touchesData = /\[\s*(?:select|find)\b/i.test(code)
        || /\b(insert|update|delete|undelete|upsert|merge)\s+[\w([{'"]/i.test(code)
        || /\bDatabase\s*\.\s*\w+\s*\(/i.test(code);
      if (touchesData && !/\b(with|without|inherited)\s+sharing\b/i.test(modifiers)) {
        issues.push({
          ruleId: 'APEX_MISSING_SHARING',
          severity: 'warning',
          message: 'Class performs SOQL/DML but does not declare a sharing model. Declare with sharing, inherited sharing, or without sharing explicitly.',
          ...location,
        });
      }
      if (/\bwithout\s+sharing\b/i.test(modifiers)) {
        issues.push({
          ruleId: 'APEX_WITHOUT_SHARING',
          severity: 'info',
          message: 'Class explicitly bypasses sharing rules (without sharing). Confirm this elevation is intentional and documented.',
          ...location,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Lightning JavaScript (LWC / Aura)
// ---------------------------------------------------------------------------

function isLightningJavaScript(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/);
  return segments.includes('lwc') || segments.includes('aura');
}

function analyzeLightningJs(content: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const { code } = sanitize(content);
  const lineAt = lineLocator(content);

  for (const match of matchAll(code, /\beval\s*\(/g)) {
    issues.push({
      ruleId: 'JS_EVAL',
      severity: 'critical',
      message: 'eval() executes arbitrary code and is blocked by Lightning Locker/LWS. Remove it.',
      ...lineAt(match.index),
    });
  }
  for (const match of matchAll(code, /\bdebugger\b/g)) {
    issues.push({
      ruleId: 'JS_DEBUGGER',
      severity: 'warning',
      message: 'debugger statement left in component JavaScript. Remove it before deploying.',
      ...lineAt(match.index),
    });
  }
  for (const match of matchAll(code, /\bconsole\s*\.\s*(log|debug|info|warn|error)\s*\(/g)) {
    issues.push({
      ruleId: 'JS_CONSOLE',
      severity: 'info',
      message: 'console statement left in component JavaScript. Remove it or route it through a logger.',
      ...lineAt(match.index),
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Metadata XML
// ---------------------------------------------------------------------------

function analyzeFlow(content: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const lineAt = lineLocator(content);
  const status = /<status>\s*(Draft|InvalidDraft|Obsolete)\s*<\/status>/i.exec(content);
  if (status) {
    issues.push({
      ruleId: 'FLOW_INACTIVE_STATUS',
      severity: 'warning',
      message: `Flow is deployed with status ${status[1]}, so it will not run in the target org. Activate the flow version if it should be live.`,
      ...lineAt(status.index),
    });
  }
  return issues;
}

function analyzeComponentMeta(content: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const lineAt = lineLocator(content);
  const version = /<apiVersion>\s*(\d+(?:\.\d+)?)\s*<\/apiVersion>/i.exec(content);
  if (version && Number.parseFloat(version[1]) < 50) {
    issues.push({
      ruleId: 'META_OLD_API_VERSION',
      severity: 'info',
      message: `Component API version ${version[1]} is more than ten releases old. Upgrade to a current API version to keep runtime behavior and security fixes.`,
      ...lineAt(version.index),
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Shared parsing helpers
// ---------------------------------------------------------------------------

/**
 * Blank out comments and string literal contents while preserving offsets, so
 * structural rules never match text inside comments or strings.
 */
export function sanitize(content: string): SanitizedSource {
  const output = content.split('');
  const strings: SanitizedSource['strings'] = [];
  let index = 0;
  while (index < content.length) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '/' && next === '/') {
      while (index < content.length && content[index] !== '\n') output[index++] = ' ';
      continue;
    }
    if (char === '/' && next === '*') {
      output[index++] = ' ';
      output[index++] = ' ';
      while (index < content.length && !(content[index] === '*' && content[index + 1] === '/')) {
        if (content[index] !== '\n') output[index] = ' ';
        index += 1;
      }
      if (index < content.length) {
        output[index++] = ' ';
        output[index++] = ' ';
      }
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      const quote = char;
      const start = index;
      index += 1;
      let value = '';
      while (index < content.length && content[index] !== quote) {
        if (content[index] === '\\') {
          value += content.slice(index, index + 2);
          if (content[index] !== '\n') output[index] = ' ';
          if (content[index + 1] !== '\n') output[index + 1] = ' ';
          index += 2;
          continue;
        }
        value += content[index];
        if (content[index] !== '\n') output[index] = ' ';
        index += 1;
      }
      index += 1; // Closing quote.
      strings.push({ value, index: start });
      continue;
    }
    index += 1;
  }
  return { code: output.join(''), strings };
}

/** Locate `{ ... }` body ranges for for/while/do loops via brace matching. */
export function findLoopBodies(code: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const match of matchAll(code, /\b(for|while)\s*\(|\bdo\s*\{/gi)) {
    let cursor = match.index + match[0].length;
    if (!match[0].endsWith('{')) {
      // Skip the loop condition parentheses, then find the opening brace.
      let depth = 1;
      while (cursor < code.length && depth > 0) {
        if (code[cursor] === '(') depth += 1;
        else if (code[cursor] === ')') depth -= 1;
        cursor += 1;
      }
      while (cursor < code.length && /\s/.test(code[cursor])) cursor += 1;
      if (code[cursor] !== '{') {
        // Single-statement loop body: treat the rest of the statement as the body.
        const semicolon = code.indexOf(';', cursor);
        if (semicolon > cursor) ranges.push({ start: cursor - 1, end: semicolon + 1 });
        continue;
      }
      cursor += 1;
    }
    const start = cursor - 1;
    let depth = 1;
    while (cursor < code.length && depth > 0) {
      if (code[cursor] === '{') depth += 1;
      else if (code[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    ranges.push({ start, end: cursor });
  }
  return ranges;
}

function readBalancedArgument(code: string, openParenIndex: number): string {
  let depth = 0;
  let cursor = openParenIndex;
  const start = openParenIndex + 1;
  while (cursor < code.length) {
    if (code[cursor] === '(') depth += 1;
    else if (code[cursor] === ')') {
      depth -= 1;
      if (depth === 0) return code.slice(start, cursor);
    }
    cursor += 1;
  }
  return code.slice(start);
}

function matchAll(code: string, pattern: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    matches.push(match);
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  return matches;
}

function lineLocator(content: string): (index: number) => { line: number; column: number } {
  const lineStarts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') lineStarts.push(index + 1);
  }
  return (index: number) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (lineStarts[middle] <= index) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: index - lineStarts[low] + 1 };
  };
}

function collectSourceFiles(projectRoot: string): Array<{ absolute: string; relative: string }> {
  const files: Array<{ absolute: string; relative: string }> = [];
  const pending = [projectRoot];
  while (pending.length) {
    const directory = pending.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
        continue;
      }
      const lower = entry.name.toLowerCase();
      if (
        lower.endsWith('.cls')
        || lower.endsWith('.trigger')
        || lower.endsWith('.js')
        || lower.endsWith('-meta.xml')
      ) {
        files.push({ absolute, relative: path.relative(projectRoot, absolute) });
      }
    }
  }
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}

function finalizeIssue(relativePath: string, issue: RawIssue): StaticAnalysisIssue {
  const component = componentFromPath(relativePath);
  const fingerprint = createHash('sha256')
    .update([BUILT_IN_ENGINE, issue.ruleId, relativePath, issue.line, issue.message].join('|'))
    .digest('hex');
  return {
    engine: BUILT_IN_ENGINE,
    ruleId: issue.ruleId,
    severity: issue.severity,
    message: issue.message,
    file: relativePath.replace(/\\/g, '/'),
    ...(issue.line ? { line: issue.line } : {}),
    ...(issue.column ? { column: issue.column } : {}),
    ...(component ? { component } : {}),
    fingerprint,
  };
}

function componentFromPath(relativePath: string): string | undefined {
  const base = path.basename(relativePath);
  const lower = base.toLowerCase();
  if (lower.endsWith('.cls')) return `ApexClass:${base.slice(0, -4)}`;
  if (lower.endsWith('.trigger')) return `ApexTrigger:${base.slice(0, -8)}`;
  if (lower.endsWith('.flow-meta.xml')) return `Flow:${base.slice(0, -14)}`;
  const segments = relativePath.split(/[\\/]/);
  const lwc = segments.indexOf('lwc');
  if (lwc >= 0 && segments.length > lwc + 1) return `LightningComponentBundle:${segments[lwc + 1]}`;
  const aura = segments.indexOf('aura');
  if (aura >= 0 && segments.length > aura + 1) return `AuraDefinitionBundle:${segments[aura + 1]}`;
  return undefined;
}

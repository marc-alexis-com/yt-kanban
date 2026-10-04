// Runtime configuration, read once from the environment (see .env.example).
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dataDir = resolve(process.env.DATA_DIR || './data');
const hintsFile = process.env.TRIAGE_HINTS_FILE || join(dataDir, 'triage-hints.md');

export const config = {
  port: Number(process.env.PORT) || 3000,
  dataDir,
  dbPath: join(dataDir, 'kanban.db'),
  thumbsDir: join(dataDir, 'thumbs'),
  // Column where new videos land; the AI triage only moves videos out of it.
  inboxTheme: process.env.INBOX_THEME || 'Inbox',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  // Sorting titles into a fixed list is easy: the small model is plenty and costs ~nothing
  triageModel: process.env.TRIAGE_MODEL || 'claude-haiku-4-5',
  hintsFile,
};

// Free-form classification rules (markdown) given to the model on top of the
// examples it learns from already-sorted videos. Re-read on every triage so it
// can be edited without a restart.
export function readTriageHints() {
  return existsSync(config.hintsFile) ? readFileSync(config.hintsFile, 'utf8').trim() : '';
}

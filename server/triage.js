// AI triage: suggests a theme for every video in the inbox column, using Claude.
// The model only picks among the themes that already exist (or leaves a video
// where it is), and learns the user's habits from a sample of sorted videos.
import Anthropic from '@anthropic-ai/sdk';
import { config, readTriageHints } from './config.js';
import { db } from './db.js';

const KEEP = '__keep__';
const EXAMPLES_PER_THEME = 12;

const client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

export const triageEnabled = () => client !== null;

function buildPrompt(themes, toSort) {
  const examples = themes.map((theme) => {
    const rows = db
      .prepare('SELECT title, author FROM videos WHERE theme = ? ORDER BY id DESC LIMIT ?')
      .all(theme, EXAMPLES_PER_THEME);
    const lines = rows.map((r) => `  - ${r.title}${r.author ? ` — ${r.author}` : ''}`).join('\n');
    return `### ${theme}\n${lines || '  (no video yet)'}`;
  });
  const hints = readTriageHints();

  return [
    'You sort YouTube videos into the themes of a personal "to watch" board.',
    `Return exactly ${toSort.length} assignments: one for every video listed at the end, using its id.`,
    'For each video, pick the existing theme it most plausibly belongs to. Decide by channel first (a channel usually stays in the same theme), then by title.',
    `Use "${KEEP}" only when no theme is plausible at all (placeholder title like "Video abc123", or a title that says nothing about the content).`,
    '',
    '## Existing themes, with recent videos already sorted into them',
    examples.join('\n\n'),
    hints ? `\n## Rules from the owner of the board\n${hints}` : '',
    '',
    '## Videos to sort',
    toSort.map((v) => JSON.stringify({ id: v.id, title: v.title, channel: v.author })).join('\n'),
  ].join('\n');
}

// Returns [{ id, title, author, theme }] for the inbox videos the model could place.
export async function suggestThemes() {
  const themes = db
    .prepare('SELECT DISTINCT theme FROM videos WHERE theme != ? ORDER BY theme')
    .all(config.inboxTheme)
    .map((r) => r.theme);
  const toSort = db
    .prepare('SELECT id, title, author FROM videos WHERE theme = ? ORDER BY id')
    .all(config.inboxTheme);
  if (!toSort.length || !themes.length) return [];

  const response = await client.messages.create({
    model: config.triageModel,
    max_tokens: 16000,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  theme: { type: 'string', enum: [...themes, KEEP] },
                },
                required: ['id', 'theme'],
                additionalProperties: false,
              },
            },
          },
          required: ['assignments'],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: 'user', content: buildPrompt(themes, toSort) }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The model declined to sort these videos');
  if (response.stop_reason === 'max_tokens') throw new Error('Too many videos at once: answer cut off');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Empty answer from the model');

  const byId = new Map(toSort.map((v) => [v.id, v]));
  return JSON.parse(text)
    .assignments.filter((a) => a.theme !== KEEP && themes.includes(a.theme) && byId.has(a.id))
    .map((a) => ({ ...byId.get(a.id), theme: a.theme }));
}

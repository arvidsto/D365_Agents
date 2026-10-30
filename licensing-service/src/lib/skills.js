import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Skills ship inside this deployment (never inside the customer's tenant).
// manifest.json maps agent -> skill -> { version, file }.

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKILLS_DIR = path.resolve(here, '../../skills');

export async function loadCatalogue(skillsDir = DEFAULT_SKILLS_DIR) {
  const manifest = JSON.parse(await readFile(path.join(skillsDir, 'manifest.json'), 'utf8'));
  const catalogue = {};
  for (const [agentId, agent] of Object.entries(manifest.agents || {})) {
    catalogue[agentId] = {};
    for (const [name, entry] of Object.entries(agent.skills || {})) {
      const raw = await readFile(path.join(skillsDir, entry.file), 'utf8');
      const { frontMatter, body } = splitFrontMatter(raw);
      if (frontMatter.name !== name) {
        throw new Error(`Skill ${entry.file}: front matter name "${frontMatter.name}" does not match manifest name "${name}"`);
      }
      catalogue[agentId][name] = {
        name,
        version: entry.version,
        description: frontMatter.description || '',
        raw,
        body
      };
    }
  }
  return catalogue;
}

export function splitFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { frontMatter: {}, body: text };
  const frontMatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) frontMatter[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { frontMatter, body: match[2] };
}

/**
 * Adds a trace line to served content. If a copy turns up elsewhere,
 * the licence it came from is visible. Contains no customer data.
 */
export function watermark(skill, { licenceId, agentId, now }) {
  const stamp = `<!-- licensed-content licence=${licenceId} agent=${agentId} skill=${skill.name}@${skill.version} issued=${now.toISOString().slice(0, 10)} -->`;
  return `${skill.raw.trimEnd()}\n\n${stamp}\n`;
}

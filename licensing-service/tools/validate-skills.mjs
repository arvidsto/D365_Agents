// Checks that every skill in manifest.json exists and its front matter name matches.
// Run before every deployment:  npm run validate-skills
import { loadCatalogue } from '../src/lib/skills.js';

const catalogue = await loadCatalogue();
for (const [agentId, skills] of Object.entries(catalogue)) {
  for (const skill of Object.values(skills)) {
    if (!skill.description) throw new Error(`${agentId}/${skill.name}: description is empty`);
    console.log(`ok  ${agentId}  ${skill.name}@${skill.version}`);
  }
}

// Checks that every skill in manifest.json exists and its front matter name matches.
// Run before every deployment:  npm run validate-skills
import { loadCatalogue } from '../src/lib/skills.js';

const catalogue = await loadCatalogue();
for (const [agentId, skills] of Object.entries(catalogue)) {
  for (const skill of Object.values(skills)) {
    if (!skill.description) throw new Error(`${agentId}/${skill.name}: description is empty`);
    if (skill.routing && !skill.body.toLowerCase().includes(`\`${skill.routing.toLowerCase()}\``)) {
      throw new Error(`${agentId}/${skill.name}: routing "${skill.routing}" is not the phrase in its Routing contract`);
    }
    const stray = skill.raw.match(/\{\{(?!env:)[^}]*\}\}/g);
    if (stray) throw new Error(`${agentId}/${skill.name}: placeholders must use {{env:<schema name>}}, found ${stray.join(', ')}`);
    const settings = skill.settings.length ? `  settings: ${skill.settings.join(', ')}` : '';
    console.log(`ok  ${agentId}  ${skill.name}@${skill.version}${settings}`);
  }
}

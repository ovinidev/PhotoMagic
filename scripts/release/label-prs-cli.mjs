// CI entry point for release.yml, after the release is published.
// Usage: node scripts/release/label-prs-cli.mjs v0.2.1   (needs GH_TOKEN, GITHUB_REPOSITORY and the tags fetched)
// Creates the label if missing and adds it to every PR merged since the previous tag. Idempotent; no PRs is fine.
import { execFileSync } from 'node:child_process'
import { mergedPrNumbers, previousReleaseTag } from './label-prs.mjs'

const tag = process.argv[2]
const repo = process.env.GITHUB_REPOSITORY
if (!tag || !repo) throw new Error('usage: label-prs-cli.mjs <vX.Y.Z> (with GITHUB_REPOSITORY set)')

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' })
const tags = run('git', ['tag', '--list', 'v*']).split('\n').filter(Boolean)
const previous = previousReleaseTag(tags, tag)
const range = previous ? `${previous}..${tag}` : tag
const commits = run('git', ['rev-list', range]).split('\n').filter(Boolean)

const pullLists = commits.map((sha) => JSON.parse(run('gh', ['api', `repos/${repo}/commits/${sha}/pulls`])))
const numbers = mergedPrNumbers(pullLists)

if (numbers.length === 0) {
  console.log(`No merged PRs between ${previous ?? 'the start'} and ${tag}.`)
  process.exit(0)
}

run('gh', ['label', 'create', tag, '--repo', repo, '--color', '0E8A16', '--description', `Released in ${tag}`, '--force'])
for (const number of numbers) {
  run('gh', ['pr', 'edit', String(number), '--repo', repo, '--add-label', tag])
  console.log(`Labeled #${number} with ${tag}`)
}

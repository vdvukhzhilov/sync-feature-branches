import { getInput, debug } from '@actions/core'

export function getActionInputs() {
  const githubToken = getInput('github_token')
  debug(`github_token: ${githubToken}`)
  const sourceBranch = getInput('source_branch')
  debug(`source_branch: ${sourceBranch}`)
  const targetBranchRef = getInput('target_branch_ref')
  debug(`target_branch_ref: ${targetBranchRef}`)

  return {
    githubToken,
    sourceBranch,
    targetBranchRef
  } as const
}

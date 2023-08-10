import { setFailed, info, setOutput, debug } from '@actions/core'
import { context } from '@actions/github'
import { getActionInputs } from './inputs/get'
import { getClient } from './octokit/client'

const isHttpError = (error: any): error is Error & { status: number } => {
  if ('name' in error) {
    return error.name === 'HttpError'
  }

  return false
}

async function createGithubBranch(
  newBranch: string,
  octokit: ReturnType<typeof getClient>
) {
  try {
    await octokit.rest.repos.getBranch({
      ...context.repo,
      branch: newBranch
    })
  } catch (error) {
    const httpError = error as Error

    if (isHttpError(httpError) && httpError.status === 404) {
      await octokit.rest.git.createRef({
        ref: `refs/heads/${newBranch}`,
        sha: context.sha,
        ...context.repo
      })
    } else {
      debug('Failed creating new branch')
      throw httpError
    }
  }
}

async function run() {
  try {
    const { sourceBranch, targetBranchRef } = getActionInputs()

    const {
      payload: { repository }
    } = context

    const owner = repository?.owner?.name
    const repo = repository?.name

    if (!owner || !repo) {
      throw new Error('Missing owner or repo')
    }

    const octokit = getClient()

    const { data: targetBranches } = await octokit.rest.git.listMatchingRefs({
      owner: repository?.owner.login,
      repo: repository?.name,
      ref: `heads/${targetBranchRef}`
    })

    for (const branchData of targetBranches) {
      const branch = branchData.ref.replace('refs/heads/', '')
      info(`Making a pull request for ${branch} from ${sourceBranch}.`)
      // part of test
      const { data: currentPulls } = await octokit.rest.pulls.list({
        owner: repository.owner.login,
        repo: repository.name
      })

      // create new branch from SOURCE_BRANCH and PR between new branch and target branch
      const newBranch = `${sourceBranch}-to-${branch}`

      const currentPull = currentPulls.find(pull => {
        info(`Pull ref: "${pull.head.ref}". Pull base ref: "${pull.base.ref}"`)
        return pull.head.ref === newBranch && pull.base.ref === branch
      })

      if (!currentPull) {
        await createGithubBranch(newBranch, octokit)

        const { data: pullRequest } = await octokit.rest.pulls.create({
          owner: repository.owner.login,
          repo: repository.name,
          head: newBranch,
          base: branch,
          title: `sync: ${sourceBranch} to ${branch}`,
          body: `sync-branches: syncing ${branch} with ${sourceBranch}`,
          draft: false
        })

        info(
          `Pull request (${pullRequest.number}) successful! You can view it here: ${pullRequest.url}.`
        )

        setOutput('PULL_REQUEST_URL', pullRequest.url.toString())
        setOutput('PULL_REQUEST_NUMBER', pullRequest.number.toString())
      } else {
        // If PR exists update PR branch with sourceBranch
        info(
          `There is already a pull request (${currentPull.number}) to ${branch} from ${newBranch}.\n`
        )
        info('Updating PR branch...')

        await octokit.rest.repos.merge({
          owner: repository.owner.login,
          repo: repository.name,
          base: newBranch,
          head: context.sha
        })

        info('PR branch updated\n')
        info(`You can view it here: ${currentPull.url}`)

        setOutput('PULL_REQUEST_URL', currentPull.url.toString())
        setOutput('PULL_REQUEST_NUMBER', currentPull.number.toString())
      }
    }
  } catch (error) {
    console.dir(error)
    setFailed((error as Error).message)
  }
}

run()

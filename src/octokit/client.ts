import { getOctokit } from '@actions/github'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { getProxyForUrl } from 'proxy-from-env'
import { getActionInputs } from '../inputs/get'

export const getClient = () => {
  const { githubToken } = getActionInputs()

  return getOctokit(
    githubToken,
    undefined,
    paginateRest,
    restEndpointMethods,
    /**
     * Octokit plugin to support the standard environment variables
     * http_proxy, https_proxy and no_proxy
     */
    function autoProxyAgent(octokit) {
      octokit.hook.before('request', options => {
        const proxy = getProxyForUrl(options.baseUrl)
        if (proxy) {
          options.request.agent = new HttpsProxyAgent(proxy)
        }
      })
    }
  )
}

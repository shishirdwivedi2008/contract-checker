const axios = require('axios')
const https =require('https')
const httpsAgent = new https.Agent({ keepAlive: false })
async function readFileFromGitHub(service, GITHUB_TOKEN) {
  const response = await axios.get(service, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: GITHUB_TOKEN,
    },
    httpsAgent,
  })
  if (response.status == 401) {
    throw new Error('GitHubToken is incorrect. Unable to pull open spec json file')
  }else if (response.status !== 200) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }
  
  return response.data
}

function closeAgent() {
  httpsAgent.destroy()
}

module.exports = { readFileFromGitHub, closeAgent }

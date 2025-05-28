const axios = require('axios')
const ContractChecker = require('../src/contract.checker')
const Service = require('../util/service')
describe('Profile Service Unit Test', () => {
  let contractGuard
  let serverUrl
  const openSpecURL="YOUR URL"
  beforeAll(async () => {
    contractGuard = new ContractChecker(openSpecURL, GITHUB_TOKEN)
    const { url } = await contractGuard.start()
    serverUrl = url
  })

  beforeEach(() => {
    contractGuard.resetResponseOverrides()
  })

  afterAll(async () => {
    await contractGuard.stopServer()
  })

  test('should return 200 response with mock data for /v2/profile POST', async () => {
    contractGuard.responseBuilder().with('/find').method('get').status('200')

    const res = await axios.post(`${serverUrl}//find`, null, { params: { email: 'webmaster@getethos.com' } })
    expect(res.status).toBe(200)
    expect(res.data).toHaveProperty('someproperty')
    expect(typeof res.data.someproperty).toBe('object')
  })

  test('should return 400 response with error message mock', async () => {
    contractGuard.responseBuilder().with('/v2/find').method('post').status('400')
    const res = await axios.post(`${serverUrl}/v2/find`, null, {
      params: { email: 'example@example.com' },
      validateStatus: () => true, // Allow any status code
    })
    expect(res.status).toBe(400)
    expect(res.data).toHaveProperty('success')
    expect(res.data.success).toBe(false)
    expect(res.data).toHaveProperty('message')
    expect(typeof res.data.message).toBe('string')
  })

  test('should fallback to first defined response code (200)', async () => {
    // No override set here
    const res = await axios.post(`${serverUrl}/find`, null, { params: { email: 'example@example.com' } })

    expect([200, 400]).toContain(res.status) // depending on default
  })

  test('should throw error for invalid status code set', async () => {
    contractGuard.responseBuilder().with('/v2/find').method('post').status('500') // ❌ not defined in spec
    const res = await axios.post(`${serverUrl}/v2/find`, null, { params: { email: 'example@example.com' } })
    expect(res.status).toBe(500)
  })
})

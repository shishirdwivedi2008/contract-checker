const { faker } = require('@faker-js/faker')
const express = require('express')
const { Server, createServer } = require('http')
const ResponseBuilder = require('./response.builder')
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { readFileFromGitHub, closeAgent } = require('./github')
class ContractChecker {
  constructor(openSpecURL, githubToken, responseConfig = {}) {
    if (!openSpecURL) throw new Error('GIT open spec URL is missing')
    if (!githubToken) throw new Error('Git Token is not provided')
    this.githubToken = githubToken
    this.service = openSpecURL
    this.server = null
    this.port = null
    this.definitions = {}
    this.components = {}
    this.paths = {}
    this.responseConfig = responseConfig
    this.statusOverrides = {}
  }

  async start() {
    this.openApiSpec = await readFileFromGitHub(this.service, this.githubToken)
    this.definitions = this.openApiSpec.definitions || {}
    this.components = this.openApiSpec.components?.schemas || {}
    this.paths = this.openApiSpec.paths || {}
    const app = express()
    this.port = await this.getRandomPort()

    for (const path in this.paths) {
      //convert the open spec path to the express path
      const expressPath = path.replace(/{([^}]+)}/g, ':$1')
      const methods = this.paths[path]
      for (const method in methods) {
        const operation = methods[method]

        if (typeof app[method] === 'function') {
          app[method](expressPath, (req, res) => {
            try {
              const overrideKey = `${method.toLowerCase()} ${path}`
              let desiredStatus = this.statusOverrides[overrideKey] || this.responseConfig?.[path]?.[method]

              const availableStatuses = Object.keys(operation.responses || {})
              if (!desiredStatus && availableStatuses.length > 0) {
                desiredStatus = availableStatuses[0] // fallback to first available
              }

              const responseDef = operation.responses?.[desiredStatus]

              if (!responseDef) {
                return res.status(500).json({
                  error: `❌ Response status "${desiredStatus}" is not defined in OpenAPI spec for ${method.toUpperCase()} ${path}`,
                })
              }

              const schema = responseDef.content?.['application/json']?.schema || responseDef.schema

              const mockData = this.generateMockFromSchema(schema)
              res.status(parseInt(desiredStatus)).json(mockData)
            } catch (error) {
              console.error('error', error)
              return res.status(500).json({
                error: `❌ Error generating mock data for ${method.toUpperCase()} ${path}`,
              })
            }
          })
        }
      }
    }

    this.server = createServer(app).setTimeout(60000)
    await new Promise((resolve) => this.server.listen(this.port, resolve))
    console.log(`🚀 Mock Server is running at http://localhost:${this.port}`)
    return { url: `http://localhost:${this.port}`, port: this.port }
  }

  async stopServer() {
    if (this.server) {
      await new Promise((resolve, reject) => {
        this.server.close((err) => {
          if (err) {
            console.error(`❌ Failed to stop mock server:`, err)
            reject(err)
          } else {
            console.log(`🛑 Mock server on port ${this.port} stopped`)
            resolve()
          }
        })
      })
      this.server = null
      this.port = null
    }
    //close close github connection
    closeAgent()
  }
  responseBuilder() {
    return new ResponseBuilder(this)
  }

  async getRandomPort() {
    return new Promise((resolve) => {
      const tempServer = createServer()
      tempServer.listen(0, () => {
        const port = tempServer.address().port
        tempServer.close(() => resolve(port))
      })
    })
  }

  generateMockFromSchema(schema) {
    if (!schema) return {}

    if (schema.$ref) {
      const refPath = schema.$ref
      const refKey = refPath.split('/').pop()

      if (refPath.startsWith('#/definitions/')) {
        const refSchema = this.definitions[refKey]
        return refSchema ? this.generateMockFromSchema(refSchema) : {}
      }

      if (refPath.startsWith('#/components/schemas/')) {
        const refSchema = this.components[refKey]
        return refSchema ? this.generateMockFromSchema(refSchema) : {}
      }

      return {}
    }

    if (schema.allOf && Array.isArray(schema.allOf)) {
      return schema.allOf.reduce((acc, subSchema) => {
        return { ...acc, ...this.generateMockFromSchema(subSchema) }
      }, {})
    }

    if (schema.example) return schema.example

    if (schema.type === 'object') {
      const obj = {}
      for (const [key, prop] of Object.entries(schema.properties || {})) {
        obj[key] = this.generateMockFromSchema(prop)
      }
      return obj
    }

    if (schema.type === 'array') {
      return [this.generateMockFromSchema(schema.items)]
    }

    return this.generatePrimitiveMock(schema)
  }

  generatePrimitiveMock(schema) {
    switch (schema.type) {
      case 'string':
        if (schema.format === 'date-time') return new Date().toISOString()
        return faker.lorem.word()
      case 'integer':
        return faker.number.int({ min: schema.minimum || 0, max: schema.maximum || 100 })
      case 'number':
        return faker.number.float({ min: schema.minimum || 0, max: schema.maximum || 100 })
      case 'boolean':
        return faker.datatype.boolean()
      default:
        return null
    }
  }
  resetResponseOverrides() {
    this.statusOverrides = {}
  }
}

module.exports = ContractChecker

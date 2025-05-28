class ResponseBuilder {
  constructor(server) {
    this.server = server
    this.currentPath = null
    this.currentMethod = null
  }

  with(apiPath) {
    try {
      this.currentPath = apiPath
      console.log(`Set current path to: ${this.currentPath}`)
      return this
    } catch (error) {
      console.error('Error setting path:', error)
      throw error
    }
  }

  method(httpMethod) {
    try {
      this.currentMethod = httpMethod.toLowerCase()
      console.log(`Set current method to: ${this.currentMethod}`)
      return this
    } catch (error) {
      console.error('Error setting method:', error)
      throw error
    }
  }

  status(statusCode) {
    try {
      if (!this.currentPath || !this.currentMethod) {
        throw new Error('Call .with(path).method(httpMethod) before setting .status(statusCode)')
      }

      const operation = this.server.paths?.[this.currentPath]?.[this.currentMethod]
      if (!operation) {
        throw new Error(`No such method "${this.currentMethod}" defined for path "${this.currentPath}"`)
      }

      if (!operation.responses?.[statusCode]) {
        throw new Error(
          `Response status "${statusCode}" not defined in OpenAPI spec for ${this.currentMethod.toUpperCase()} ${this.currentPath}`
        )
      }

      const key = `${this.currentMethod} ${this.currentPath}`
      this.server.statusOverrides[key] = statusCode
      console.log(`Set status override for ${key} to: ${statusCode}`)
      return this
    } catch (error) {
      console.error('Error setting status:', error)
      throw error
    }
  }
}

module.exports = ResponseBuilder

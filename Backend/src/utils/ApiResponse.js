class ApiResponse {
    // Constructor to initialize the API response object
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode // Stores the HTTP status code
        this.data = data // Holds the response data
        this.message = message // Default message is "Success" unless overridden
        this.success = statusCode < 400 // Determines success based on status code (<400 is successful)
    }
}

export { ApiResponse } // Exports the class for use in other modules

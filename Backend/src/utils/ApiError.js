class ApiError extends Error {
    constructor(
        statusCode, // HTTP status code for the error
        message = "Something went wrong", // Default error message
        errors = [], // Optional array of additional errors
        stack = "" // Optional custom stack trace
    ) {
        super(message) // Calls parent Error class constructor with the message
        this.statusCode = statusCode // Stores the status code of the error
        this.data = null // Placeholder for any response data (none by default)
        this.message = message // Stores the error message
        this.success = false // Indicates the operation was unsuccessful
        this.errors = errors // Stores any additional error details

        if (stack) {
            this.stack = stack // Uses custom stack trace if provided
        } else {
            Error.captureStackTrace(this, this.constructor) // Captures the stack trace for debugging
        }
    }
}

export { ApiError } // Exports the ApiError class for external use

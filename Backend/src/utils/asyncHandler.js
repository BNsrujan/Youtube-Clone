const asyncHandler = (requestHandler) => {
    // Returns a middleware function to handle async errors
    return (req, res, next) => {
        // Ensures the requestHandler is resolved and errors are passed to 'next'
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}

export { asyncHandler } // Exports the async handler for use in other routes

// The commented-out versions show the evolution of async handling:

// Basic function with no arguments
// const asyncHandler = () => {}

// Wrapper for a function
// const asyncHandler = (func) => () => {}

// Async wrapper function
// const asyncHandler = (func) => async () => {}

// More detailed version with try/catch for error handling
// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next) // Await the request handling function
//     } catch (error) {
//         // Respond with error status and message
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message
//         })
//     }
// }

// require('dotenv').config({path: './env'}) // Old way to load environment variables
import dotenv from "dotenv" // Import dotenv to load environment variables
import connectDB from "./db/index.js"; // Import the database connection function
import { app } from './app.js' // Import the Express app

// Load environment variables from .env file
dotenv.config({
    path: './.env' // Specify the path to the .env file
})

// Connect to the database
connectDB()
    .then(() => {
        // Start the Express server once the database connection is successful
        app.listen(process.env.PORT || 8000, () => {
            console.log(`⚙️ Server is running at port : ${process.env.PORT}`); // Log the server port
        })
    })
    .catch((err) => {
        // Log an error if the database connection fails
        console.log("MONGO db connection failed !!! ", err);
    })

/*
import express from "express" // Import Express for server creation
const app = express() // Initialize the Express app

// Immediately invoked async function to connect to MongoDB
( async () => {
    try {
        // Connect to MongoDB using the URI from environment variables
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => { // Handle errors in the app
            console.log("ERRR: ", error);
            throw error
        })

        // Start the server and log the port
        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    } catch (error) {
        // Log any errors that occur during the connection
        console.error("ERROR: ", error)
        throw err
    }
})()
*/


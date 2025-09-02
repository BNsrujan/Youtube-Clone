import { v2 as cloudinary } from "cloudinary" // Import cloudinary for cloud-based file storage
import fs from "fs" // Import file system to manage local files

// Configure cloudinary with environment variables for secure access
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            console.log("no file path provided")
            return null // Return null if no file path is provided
        }

        // Check if file exists before attempting upload
        if (!fs.existsSync(localFilePath)) {
            console.error("File not found:", localFilePath);
            return null;
        }

        // Upload the file to cloudinary, resource_type "auto" allows any file type
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })

        fs.unlinkSync(localFilePath) // Delete the local file after successful upload
        return response; // Return the cloudinary upload response

    } catch (error) {
        console.log("Error during Cloudinary upload:", error)
        if (fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (unlinkError) {
                console.log("Error deleting file after upload failure", unlinkError)
            }
        }
    }
}


export { uploadOnCloudinary };
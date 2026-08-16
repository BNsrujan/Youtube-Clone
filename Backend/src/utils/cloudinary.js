import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a local file and always clean up the temp copy.
 *
 * The original swallowed upload failures and returned undefined, so callers
 * doing `avatar.url` crashed with a TypeError instead of getting a clean
 * error. This one throws.
 */
const uploadOnCloudinary = async (localFilePath, options = {}) => {
    if (!localFilePath) return null;

    if (!fs.existsSync(localFilePath)) {
        throw new Error(`Local file not found: ${localFilePath}`);
    }

    try {
        return await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            ...options,
        });
    } catch (error) {
        console.error("Cloudinary upload failed:", error.message);
        throw new Error(`Upload failed: ${error.message}`);
    } finally {
        if (fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (unlinkError) {
                console.error("Temp file cleanup failed:", unlinkError.message);
            }
        }
    }
};

/**
 * Delete a stored asset. Without this, every deleted video and replaced avatar
 * stayed in the bucket forever, silently accruing storage cost.
 */
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    if (!publicId) return null;
    try {
        return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
        // A failed cleanup should not fail the user's request.
        console.error("Cloudinary delete failed:", error.message);
        return null;
    }
};

/** Extract the public_id from a stored Cloudinary URL. */
const publicIdFromUrl = (url) => {
    if (!url) return null;
    const match = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);
    return match ? match[1] : null;
};

export { uploadOnCloudinary, deleteFromCloudinary, publicIdFromUrl };

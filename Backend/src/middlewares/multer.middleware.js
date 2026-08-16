import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const TEMP_DIR = "./public/temp";

// Multer will not create this itself; a missing dir fails every upload.
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => {
        // The original used file.originalname directly, so two users uploading
        // "video.mp4" at once overwrite each other, and a crafted name like
        // "../../app.js" escapes the temp directory entirely.
        const ext = path.extname(file.originalname).toLowerCase();
        const safe = crypto.randomBytes(16).toString("hex");
        cb(null, `${Date.now()}-${safe}${ext}`);
    },
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];

const fileFilter = (req, file, cb) => {
    const allowed = file.fieldname === "videoFile" ? VIDEO_TYPES : IMAGE_TYPES;
    if (!allowed.includes(file.mimetype)) {
        return cb(new Error(`Unsupported file type for ${file.fieldname}: ${file.mimetype}`));
    }
    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024, files: 2 },
});

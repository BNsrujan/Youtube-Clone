import multer from "multer"; // Import multer for handling file uploads

// Configure storage settings for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Set the destination folder for uploaded files
    cb(null, "./public/temp"); // Files will be stored in the 'public/temp' directory
  },
  filename: function (req, file, cb) {
    // Set the filename for the uploaded file
    cb(null, file.originalname); // Use the original file name
  }
});

// Create a multer instance with the defined storage settings
export const upload = multer({
  storage, // Use the configured storage
});

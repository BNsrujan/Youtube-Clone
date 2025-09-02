import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowecase: true,
            trim: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String, // cloudinary url
            required: true,
        },
        coverImage: {
            type: String, // cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken: {
            type: String
        }

    },
    {
        timestamps: true
    }
)

// Pre-save hook to hash the password before saving the user document
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next(); // Skip if password is not modified

    this.password = await bcrypt.hash(this.password, 10); // Hash the password with a salt rounds of 10
    next(); // Proceed to save the document
})

// Method to compare the provided password with the stored hashed password
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password); // Compare and return boolean
}

// Method to generate an access token for the user
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id, // User ID
            email: this.email, // User email
            username: this.username, // User username
            fullName: this.fullName // User full name
        },
        process.env.ACCESS_TOKEN_SECRET, // Secret key from environment variables
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY // Expiry time from environment variables
        }
    );
}

// Method to generate a refresh token for the user
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id, // User ID
        },
        process.env.REFRESH_TOKEN_SECRET, // Secret key from environment variables
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY // Expiry time from environment variables
        }
    );
}

// Create and export the User model based on the schema
export const User = mongoose.model("User", userSchema);
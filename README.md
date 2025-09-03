# Video Streaming Platform Backend

A comprehensive backend API for a video streaming platform built with Node.js, Express, and MongoDB. This project provides a complete social media and video sharing experience with features like user authentication, video management, comments, likes, playlists, and subscriptions.

## Project Status

**This project is currently under development.** Some features may be incomplete or in progress.

## Features

### Core Functionality
- **User Management**: Registration, login, profile management with JWT authentication
- **Video Operations**: Upload, stream, and manage videos with Cloudinary integration
- **Social Features**: Comments, likes, subscriptions, and user interactions
- **Content Organization**: Playlists for organizing videos
- **Analytics**: Dashboard with user and content statistics
- **Micro-blogging**: Tweet-like functionality for short posts

### Technical Features
- RESTful API design with Express.js
- MongoDB with Mongoose ODM
- JWT-based authentication with refresh tokens
- File upload handling with Multer
- Cloud storage integration with Cloudinary
- Password hashing with bcrypt
- CORS enabled for cross-origin requests
- Environment-based configuration

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Cloud Storage**: Cloudinary
- **Password Hashing**: bcrypt
- **Development**: Nodemon for hot reloading

##  Project Structure

```
Backend/
├── src/
│   ├── controllers/     # Route handlers and business logic
│   │   ├── user.controller.js
│   │   ├── video.controller.js
│   │   ├── comment.controller.js
│   │   ├── like.controller.js
│   │   ├── playlist.controller.js
│   │   ├── subscription.controller.js
│   │   ├── tweet.controller.js
│   │   └── dashboard.controller.js
│   ├── models/          # MongoDB schemas
│   │   ├── user.model.js
│   │   ├── video.model.js
│   │   ├── comment.model.js
│   │   ├── like.model.js
│   │   ├── playlist.model.js
│   │   ├── subscription.model.js
│   │   └── tweet.model.js
│   ├── routes/          # API route definitions
│   ├── middlewares/     # Custom middleware functions
│   │   ├── auth.middleware.js
│   │   └── multer.middleware.js
│   ├── utils/           # Utility functions
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── asyncHandler.js
│   │   └── cloudinary.js
│   ├── db/              # Database connection
│   ├── app.js           # Express app configuration
│   └── index.js         # Server entry point
├── public/              # Static files and uploads
└── Frontend/            # Frontend application (basic HTML)
```

##  Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Cloudinary account for file storage

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Install dependencies**
   ```bash
   cd Backend
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.sample .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   PORT=8000
   MONGODB_URI=your_mongodb_connection_string
   CORS_ORIGIN=*
   ACCESS_TOKEN_SECRET=your_access_token_secret
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   REFRESH_TOKEN_EXPIRY=10d
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:8000`

##  API Endpoints

### Base URL: `/api/v1`

#### Health Check
- `GET /healthcheck` - Server health status

#### User Management
- `POST /users/register` - User registration
- `POST /users/login` - User login
- `POST /users/logout` - User logout
- `GET /users/profile` - Get user profile
- `PATCH /users/profile` - Update user profile

#### Video Management
- `POST /videos` - Upload video
- `GET /videos` - Get all videos
- `GET /videos/:id` - Get specific video
- `PATCH /videos/:id` - Update video
- `DELETE /videos/:id` - Delete video

#### Social Features
- `POST /comments` - Add comment
- `GET /comments/:videoId` - Get video comments
- `POST /likes/toggle` - Toggle like/unlike
- `POST /subscriptions/toggle` - Toggle subscription

#### Content Organization
- `POST /playlist` - Create playlist
- `GET /playlist` - Get user playlists
- `PATCH /playlist/:id` - Update playlist

#### Analytics
- `GET /dashboard/stats` - Get dashboard statistics

##  Development

### Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run start` - Start production server

##  Contributing

This project is currently under development. Contributions, issues, and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


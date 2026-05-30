# Deployment Guide for TrustPermit Backend on Render

## Prerequisites
- MongoDB Atlas account (free tier available)
- Render account (free tier available)
- Git repository with backend code

## Step 1: Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account or login
3. Create a new project
4. Create a new cluster (free tier M0)
5. Wait for the cluster to be ready (~5 minutes)
6. Click "CONNECT"
7. Create a database user:
   - Username: `trustpermit_user`
   - Password: Generate a secure password
8. Copy the connection string:
   - Select "Drivers" → "Node.js"
   - Copy the connection string
   - Replace `<password>` with your database password
   - Example: `mongodb+srv://trustpermit_user:your-password@cluster0.mongodb.net/`

## Step 2: Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Fill in the form:
   - **Name**: `trustpermit-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or paid if you need better performance)

5. Add Environment Variables:
   - Click "Add Environment Variable"
   - Add these variables:
     ```
     NODE_ENV = production
     MONGODB_URI = mongodb+srv://trustpermit_user:your-password@cluster0.mongodb.net/
     MONGO_DB_NAME = trustpermit
     ```

6. Click "Create Web Service"
7. Wait for deployment (~2-3 minutes)
8. Once deployed, you'll get a URL like `https://trustpermit-backend.onrender.com`

## Step 3: Test the Deployment

1. Visit `https://trustpermit-backend.onrender.com/api/health`
2. You should see:
   ```json
   {
     "status": "healthy",
     "timestamp": "...",
     "uptime": ...,
     "mongodb": "connected"
   }
   ```

## Step 4: Update Your Mobile App

The app is already configured to use:
```
https://trustpermit-backend.onrender.com
```

Make sure your app has a valid auth token. The token is obtained after:
1. User signs up or logs in
2. Token is automatically saved to shared preferences
3. Token is sent with every API request

## Troubleshooting

### Issue: "Failed to create application" (500 Error)

**Check 1: Is MongoDB connected?**
- Visit `https://trustpermit-backend.onrender.com/api/health`
- Look for `"mongodb": "connected"`
- If disconnected, check your `MONGODB_URI` environment variable

**Check 2: Are environment variables set?**
- Go to your Render dashboard
- Click on your service
- Go to "Environment"
- Verify `MONGODB_URI` and `MONGO_DB_NAME` are set

**Check 3: Is the token valid?**
- Make sure the user has logged in or signed up
- The token is returned in the auth response
- Check if the token is being sent in the Authorization header

**Check 4: View logs**
- Go to your Render dashboard
- Click on your service
- Go to "Logs"
- Look for error messages

### Issue: CORS Errors

The backend allows requests from:
- `https://trustpermit-backend.onrender.com`
- Local development servers
- `http://localhost:5000`
- `http://10.0.2.2:5000` (Android emulator)

If you're deploying a web frontend, add its URL to the `allowedOrigins` array in `server.js`.

### Issue: MongoDB Connection Timeout

1. Check that your IP is whitelisted in MongoDB Atlas:
   - Go to MongoDB Atlas
   - Network Access → IP Whitelist
   - Add `0.0.0.0/0` to allow all IPs (less secure)
   - Or add your Render IP

2. Check the connection string format:
   - Should be: `mongodb+srv://username:password@cluster.mongodb.net/`
   - Make sure password is URL encoded if it contains special characters

## Environment Variables Explained

| Variable | Example | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB connection string |
| `MONGO_DB_NAME` | `trustpermit` | Database name |
| `PORT` | `5000` | Server port (Render sets this) |

## Health Check Endpoint

You can monitor your backend health with:
```
GET https://trustpermit-backend.onrender.com/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-05-30T...",
  "uptime": 1234.5,
  "mongodb": "connected"
}
```

## API Endpoints

- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/applications` - Submit application (requires auth token)
- `GET /api/applications` - List user's applications (requires auth token)
- `GET /api/applications/:id` - Get single application (requires auth token)
- `PATCH /api/applications/:id/requirements` - Update requirements

## Support

If you encounter issues:
1. Check the logs on Render dashboard
2. Verify environment variables are set correctly
3. Test the `/api/health` endpoint
4. Check MongoDB Atlas connection is active

---

For more help, refer to:
- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Guide](https://docs.mongodb.com/atlas/)
- [Express.js Documentation](https://expressjs.com/)

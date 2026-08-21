# CafeMaster MongoDB Deployment Guide

## Complete Migration from SQLite to MongoDB

This guide provides step-by-step instructions to migrate your CafeMaster application from SQLite to MongoDB and deploy it to Vercel.

## What Changed

### New Files Created:
- `src/server/database-mongo.js` - Complete MongoDB database module
- `src/server/app-mongo.js` - HTTP server with MongoDB support
- `server-mongo.js` - Entry point for MongoDB version
- `api/index.js` - Vercel serverless API route
- `vercel.json` - Vercel configuration

### Modified Files:
- `package.json` - Added MongoDB dependency and updated scripts

### Files You Can Keep:
- `server.js` - Original SQLite version (renamed to `start:sqlite` script)
- `src/server/app.js` - Original SQLite version
- `src/server/database.js` - Original SQLite version

## Step 1: Install Dependencies

```bash
npm install
```

This installs the MongoDB driver (`mongodb` package).

## Step 2: Test Locally

### Start with MongoDB:
```bash
npm start
# or
node server-mongo.js
```

The server will start on `http://localhost:3000` and automatically:
1. Connect to MongoDB (default: `mongodb://localhost:27017/cafemaster`)
2. Create indexes
3. Seed the database with default data
4. Start the HTTP server

### Default Admin Credentials:
- **Email:** `admin@cafemaster.local`
- **Password:** `Cafe@12345`

### Using SQLite (Original):
```bash
npm run start:sqlite
# or
node server.js
```

## Step 3: MongoDB Atlas Setup

### 3.1 Create a MongoDB Atlas Account
1. Go to [https://www.mongodb.com/atlas/database](https://www.mongodb.com/atlas/database)
2. Click "Sign Up" and create a free account

### 3.2 Create a Project
1. After logging in, click "New Project"
2. Name it "CafeMaster" (or any name you prefer)
3. Click "Create Project"

### 3.3 Create a Free Cluster
1. Click "Build a Database" (or "New Cluster" if you're in the project)
2. Select "Free" (M0 tier)
3. Choose a cloud provider (AWS, Google Cloud, or Azure)
4. Select a region close to you
5. Click "Create Cluster"
6. **Wait 5-10 minutes** for the cluster to be created

### 3.4 Create a Database User
1. In your project, click "Database Access" in the left menu
2. Click "Add New Database User"
3. Select "Password Authentication"
4. Enter username: `cafemaster`
5. Enter a secure password (remember this!)
6. Under "Database User Privileges", select:
   - **Read and Write to any database**
7. Click "Add User"

### 3.5 Configure Network Access
1. Click "Network Access" in the left menu
2. Click "Add IP Address"
3. For **development/testing**, add `0.0.0.0/0` (Allow Access from Anywhere)
   - **Note:** This is not secure for production! For production, use specific IP addresses.
4. Click "Confirm"

### 3.6 Get Your Connection String
1. Click "Database" in the left menu
2. Click the "Connect" button for your cluster
3. Select "Connect your application"
4. Select "Node.js" and version "4.1 or later"
5. Copy the connection string

It will look like:
```
mongodb+srv://cafemaster:<password>@cluster0.mongodb.net/
```

### 3.7 Format Your Connection String
Replace `<password>` with your actual password and add the database name:

```
mongodb+srv://cafemaster:yourpassword@cluster0.mongodb.net/cafemaster?retryWrites=true&w=majority
```

**Save this connection string!** You'll need it for deployment.

## Step 4: Test with MongoDB Atlas

### Set the connection string as environment variable:

**On Windows (Command Prompt):**
```cmd
set MONGODB_URI=mongodb+srv://cafemaster:yourpassword@cluster0.mongodb.net/cafemaster?retryWrites=true&w=majority
npm start
```

**On macOS/Linux or Windows (Git Bash):**
```bash
export MONGODB_URI="mongodb+srv://cafemaster:yourpassword@cluster0.mongodb.net/cafemaster?retryWrites=true&w=majority"
npm start
```

### Or create a `.env` file:
```bash
echo MONGODB_URI=mongodb+srv://cafemaster:yourpassword@cluster0.mongodb.net/cafemaster?retryWrites=true&w=majority > .env
npm start
```

**Note:** For `.env` to work, you may need to install `dotenv`:
```bash
npm install dotenv
```

## Step 5: Deploy to Vercel

### 5.1 Install Vercel CLI (Optional for local testing)
```bash
npm install -g vercel
```

### 5.2 Push to GitHub
Make sure all your changes are committed and pushed to GitHub:
```bash
git add .
git commit -m "Migrate to MongoDB for Vercel deployment"
git push origin main
```

### 5.3 Deploy via Vercel Dashboard
1. Go to [https://vercel.com](https://vercel.com)
2. Click "Add New" -> "Project"
3. Import your GitHub repository
4. Vercel will automatically detect the Node.js project
5. **Important:** Add your MongoDB connection string as an environment variable:
   - Click "Settings" tab
   - Click "Environment Variables"
   - Click "Add New"
   - **Name:** `MONGODB_URI`
   - **Value:** `mongodb+srv://cafemaster:yourpassword@cluster0.mongodb.net/cafemaster?retryWrites=true&w=majority`
   - Click "Save"
6. Click "Deploy"

### 5.4 Deploy via Vercel CLI
```bash
vercel
```
Follow the prompts. When asked about environment variables:
```
? Add environment variables? Yes
? Enter name: MONGODB_URI
? Enter value: mongodb+srv://cafemaster:yourpassword@cluster0.mongodb.net/cafemaster?retryWrites=true&w=majority
```

## Step 6: Verify Deployment

1. After deployment completes, Vercel will provide a URL (e.g., `https://cafemaster.vercel.app`)
2. Open this URL in your browser
3. Login with:
   - **Email:** `admin@cafemaster.local`
   - **Password:** `Cafe@12345`
4. Test all features:
   - Dashboard
   - Menu management
   - Orders
   - Tables
   - Customers
   - Reports

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server with MongoDB |
| `npm run start:sqlite` | Start with original SQLite (for local dev without MongoDB) |
| `npm run dev` | Start MongoDB server with auto-reload |
| `npm test` | Run tests with SQLite |
| `npm run test:mongo` | Run tests with MongoDB |

## Production Checklist

- [ ] MongoDB Atlas cluster created and running
- [ ] Database user created with read/write permissions
- [ ] Network access configured (IP whitelist)
- [ ] Connection string tested locally
- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] `MONGODB_URI` environment variable set in Vercel
- [ ] Deployment successful
- [ ] Application tested and working

## Troubleshooting

### Connection Refused / Timeout
- **Problem:** Can't connect to MongoDB
- **Solution:** 
  1. Verify your cluster is running (check MongoDB Atlas dashboard)
  2. Check your IP is whitelisted
  3. Verify the database user password is correct
  4. Test the connection string locally first

### Database Not Seeded
- **Problem:** No default data (tables, menu items, admin user)
- **Solution:** The database is seeded automatically on first connection. Delete your collections and restart, or manually insert seed data.

### Authentication Fails
- **Problem:** Can't login with default credentials
- **Solution:** 
  1. Check if the admin user was created in MongoDB
  2. Verify the password hash was stored correctly
  3. Try registering a new user

### Vercel Deployment Fails
- **Problem:** Deployment errors in Vercel
- **Solution:** 
  1. Check Vercel logs for specific errors
  2. Make sure `MONGODB_URI` environment variable is set
  3. Verify your MongoDB Atlas cluster allows connections from Vercel IPs

### Vercel IP Whitelisting
For production, you should whitelist Vercel's IP ranges instead of using `0.0.0.0/0`:

1. Get Vercel's IP ranges from: [https://vercel.com/guides/deploying-mongodb-with-vercel](https://vercel.com/guides/deploying-mongodb-with-vercel)
2. Add each IP range in MongoDB Atlas Network Access

## MongoDB Collections

Your CafeMaster database will have these collections:

| Collection | Description |
|------------|-------------|
| `tables` | Restaurant tables |
| `menu_items` | Menu items |
| `customers` | Customer records |
| `employees` | Employee records |
| `employee_sessions` | Login sessions |
| `employee_shifts` | Work shifts |
| `orders` | Orders |
| `order_items` | Order line items |
| `inventory_movements` | Stock changes |
| `reservations` | Reservations |
| `suppliers` | Suppliers |
| `purchase_orders` | Purchase orders |
| `purchase_order_items` | PO line items |
| `audit_logs` | Activity logs |
| `notifications` | System notifications |
| `restaurant_settings` | Restaurant settings |

## Security Best Practices

### For Production:
1. **Use specific IP whitelisting** instead of `0.0.0.0/0`
2. **Use environment variables** for sensitive data (never hardcode passwords)
3. **Rotate passwords** regularly
4. **Monitor connections** in MongoDB Atlas
5. **Enable 2FA** on your MongoDB account
6. **Use TLS/SSL** for connections (MongoDB Atlas does this by default)

### Database User Permissions:
For better security, create a database user with specific permissions:
- **Database:** `cafemaster`
- **Collection Privileges:** Read/Write on all collections
- **No admin privileges**

## Performance Optimization

### Indexes:
The migration automatically creates indexes for better performance. You can view and manage indexes in MongoDB Atlas:
1. Go to your cluster
2. Click "Collections"
3. Select a collection
4. Click "Indexes" tab

### Monitoring:
MongoDB Atlas provides built-in monitoring:
- Performance metrics
- Query performance
- Memory usage
- Connection count

## Backing Up Your Data

### MongoDB Atlas Backups:
1. Free tier includes automatic backups
2. Go to "Backup" tab in your cluster
3. View backup schedule and create manual backups

### Export Data:
Use MongoDB Compass or `mongodump`:
```bash
mongodump --uri="mongodb+srv://cafemaster:password@cluster0.mongodb.net/cafemaster" --out=backup
```

## Switching Back to SQLite

If you need to switch back to SQLite:

1. Update `package.json`:
```json
"main": "server.js",
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js"
}
```

2. Remove MongoDB dependency:
```bash
npm uninstall mongodb
```

3. Start with SQLite:
```bash
npm start
```

## Need Help?

1. **MongoDB Documentation:** [https://www.mongodb.com/docs/](https://www.mongodb.com/docs/)
2. **Vercel Documentation:** [https://vercel.com/docs](https://vercel.com/docs)
3. **MongoDB Atlas:** [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)

## Summary

You now have:
- ✅ Complete MongoDB database module
- ✅ Updated HTTP server with async support
- ✅ Vercel-ready configuration
- ✅ Production deployment guide

Your CafeMaster application is ready for cloud deployment! 🚀

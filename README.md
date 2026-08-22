# CafeMaster - Restaurant Operations OS

CafeMaster is a comprehensive restaurant management system with full features deployed on Render.

## Live Deployment

The application is deployed and live on Render:
- **Live URL:** https://cafemaster.onrender.com
- **Status:** Production Ready

## Features

### Core Management
- Responsive operations dashboard with real-time statistics
- Table status management (free, occupied, reserved, cleaning)
- Menu management with inventory tracking
- Category-based menu organization
- POS order creation with tax and service charge calculation
- Order history with status updates
- Order splitting and merging

### Customer Management
- Guest CRM with loyalty tracking
- Customer profiles with visit history
- Loyalty points system
- Customer search and filtering
- Customer preferences tracking

### Reservations
- Table reservation system
- Reservation calendar view
- Customer reservation management
- Reservation status tracking
- Automatic table assignment

### Staff Management
- Employee records with salary management
- Staff roles and permissions
- Manager authentication for sensitive operations
- Separate staff management panel
- Employee performance tracking

### Shifts & Attendance
- Staff shift management
- Shift scheduling
- Clock in/out functionality
- Shift reports and analytics
- Overtime tracking

### Inventory Management
- Stock level monitoring
- Low stock alerts
- Restock functionality
- Inventory movement tracking
- Stock history and reporting

### Purchasing
- Supplier management
- Purchase order creation
- Purchase order tracking
- Supplier performance analytics
- PO item management

### Reports & Analytics
- Sales reports with date filtering
- Revenue analytics
- Peak hours analysis
- Menu performance analytics
- Profit margin analysis
- Low stock reports
- Audit logs for all operations

### System Features
- Restaurant settings management
- Notification system
- Activity logging
- Data export capabilities
- Multi-user support
- Session management

## Quick Start

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account (free tier available)
- Git

### Clone the Repository

```bash
# Clone the repository
git clone https://github.com/100KAR7/CAFEEMANAGE.git

# Navigate to the project directory
cd CAFEEMANAGE

# Install dependencies
npm install
```

### Set Up Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your MongoDB connection string
nano .env  # or use any text editor
```

Your `.env` file should contain:
```
# Server Port (optional, default: 3000)
PORT=3000

# Node Environment
NODE_ENV=development

# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/cafemaster?retryWrites=true&w=majority
```

**Important:** Replace `<username>`, `<password>`, and `<cluster-url>` with your actual MongoDB Atlas credentials.

### MongoDB Atlas Setup

1. **Create a free MongoDB Atlas account:** [https://www.mongodb.com/atlas/database](https://www.mongodb.com/atlas/database)
2. **Create a free M0 cluster** (takes 5-10 minutes to provision)
3. **Create a database user:**
   - Username: `cafemaster` (or any name you prefer)
   - Password: Your secure password
   - Privileges: Read and Write to any database
4. **Configure Network Access:**
   - Add `0.0.0.0/0` for development/testing (allow all IPs)
   - For production, use specific IP addresses
5. **Get your connection string:**
   - Go to Database > Connect > Connect your application
   - Select Node.js and copy the connection string
   - Format: `mongodb+srv://username:password@cluster-name.mongodb.net/cafemaster?retryWrites=true&w=majority`

### Run the Application

#### Development Mode
```bash
# Start with auto-reload
npm run dev
```

#### Production Mode
```bash
# Start the server
npm start
```

The application will be available at: `http://localhost:3000`

### Default Admin Credentials

- **Email:** `admin@cafemaster.local`
- **Password:** `Cafe@12345`
- **Role:** Manager

**Security Note:** Change these credentials before deploying to production!

## Deployment to Render

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Create Render Account
1. Go to [https://render.com](https://render.com)
2. Sign up for a free account
3. Connect your GitHub repository

### Step 3: Create a Web Service
1. Click "New +" > "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name:** CafeMaster
   - **Region:** Choose the closest to your users
   - **Branch:** main
   - **Root Directory:** (leave empty)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Click "Create Web Service"

### Step 4: Add Environment Variables
1. Go to your service dashboard
2. Click "Environment" tab
3. Add the following variables:
   - **Name:** `MONGODB_URI`
     **Value:** Your MongoDB Atlas connection string
   - **Name:** `NODE_ENV` (optional)
     **Value:** `production`
4. Click "Save"

### Step 5: Deploy
1. Render will automatically deploy your application
2. Wait for the build to complete (check logs for any errors)
3. Your application will be live at the provided URL

### Step 6: Verify Deployment
1. Open the provided URL in your browser
2. Login with the default credentials
3. Test all features to ensure everything works correctly

## Project Structure

```
.
├── public/
│   ├── app.js              # Frontend JavaScript
│   ├── index.html          # Main HTML file
│   ├── styles.css          # CSS styles
│   └── assets/
│       └── cafemaster-logo.svg
├── src/
│   └── server/
│       ├── app-mongo.js    # HTTP server with MongoDB
│       └── database-mongo.js # MongoDB database module
├── api/
│   └── index.js            # Vercel serverless API route
├── server.js              # Main server entry point (MongoDB)
├── server-mongo.js         # Alternative MongoDB entry point
├── seed-mongo.js           # Database seeding script
├── package.json            # Project dependencies
├── vercel.json            # Vercel configuration
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── README.md               # This file
└── DEPLOYMENT_GUIDE.md     # Detailed deployment guide
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server with MongoDB |
| `npm run dev` | Start with auto-reload for development |
| `npm run seed` | Seed the MongoDB database with default data |
| `npm test` | Run smoke tests |

## Database Collections

The MongoDB database contains the following collections:

- `tables` - Restaurant tables
- `menu_items` - Menu items with categories
- `customers` - Customer records and profiles
- `employees` - Staff records with salaries
- `employee_sessions` - Login sessions
- `employee_shifts` - Work shifts
- `orders` - Customer orders
- `order_items` - Order line items
- `inventory_movements` - Stock changes
- `reservations` - Table reservations
- `suppliers` - Supplier information
- `purchase_orders` - Purchase orders
- `purchase_order_items` - PO line items
- `audit_logs` - Activity logs
- `notifications` - System notifications
- `restaurant_settings` - Restaurant settings

## Troubleshooting

### Clone Issues

If you're having issues cloning or running the project:

1. **Repository not found:** Ensure you have access to the private repository
2. **Authentication failed:** Use SSH or HTTPS with proper credentials
3. **Dependencies missing:** Run `npm install` after cloning
4. **MongoDB connection failed:**
   - Verify your connection string in `.env`
   - Check if MongoDB Atlas cluster is running
   - Verify IP whitelist includes your IP
   - Test connection string locally first

### Database Not Seeded

If the database doesn't have default data:
1. Delete all collections in MongoDB Atlas
2. Restart the server
3. The database will be automatically seeded on first connection

### Authentication Fails

1. Check if the admin user exists in the `employees` collection
2. Verify the password hash is correct
3. Try registering a new user

### Deployment Fails on Render

1. Check Render logs for specific errors
2. Ensure `MONGODB_URI` environment variable is set correctly
3. Verify your MongoDB Atlas cluster allows connections from Render IPs
4. Check if the build command completed successfully

## Security Best Practices

### For Production:
- Use specific IP whitelisting in MongoDB Atlas (not `0.0.0.0/0`)
- Use environment variables for sensitive data (never hardcode passwords)
- Rotate database passwords regularly
- Monitor connections in MongoDB Atlas
- Enable 2FA on your MongoDB account
- Use TLS/SSL for connections (enabled by default in MongoDB Atlas)

### Database User Permissions:
Create a database user with specific permissions:
- **Database:** `cafemaster`
- **Collection Privileges:** Read/Write on all collections
- **No admin privileges**

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js
- **Database:** MongoDB Atlas
- **Deployment:** Render / Vercel
- **Testing:** Node.js smoke tests

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - Feel free to use, modify, and distribute.

## Support

For issues or questions:
- Check the `DEPLOYMENT_GUIDE.md` for detailed instructions
- Review the troubleshooting section above
- Ensure all environment variables are properly configured

---

**CafeMaster** - Your complete restaurant management solution.

Deployed on Render and ready for production use.

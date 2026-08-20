# CafeMaster - Restaurant Operations OS

CafeMaster is a comprehensive restaurant management system with Phase 2 features:

## Current Features (Phase 2)
- A responsive operations dashboard
- POS order creation with tax and service charge calculation
- Table status management
- Menu management with inventory tracking
- Order history with status updates
- Guest CRM and loyalty tracking
- Reservations system
- Staff & Shifts management
- Purchasing & Supplier management
- Reports & Control with audit logs
- Restaurant settings management
- Manager authentication for sensitive operations
- Employee salary management

## Phase 3 Planning

### Planned Features
1. **Advanced Analytics & Business Intelligence**
   - Revenue trends and peak hours analysis
   - Customer lifetime value (CLV) calculation
   - Menu performance analytics
   - Profit margin analysis

2. **Enhanced Inventory Management**
   - Smart stock prediction and AI-powered demand forecasting
   - Recipe & cost management
   - Waste tracking and analysis

3. **Advanced Staff Management**
   - Performance analytics and productivity metrics
   - Payroll integration with overtime tracking
   - Tip reporting and distribution

4. **Customer Relationship Management (CRM)**
   - Advanced guest profiles with preference tracking
   - Marketing campaign targeting
   - Communication system

5. **Multi-Location Support**
   - Centralized inventory across locations
   - Unified customer database
   - Location-specific pricing

6. **Advanced POS Features**
   - Course sequencing and KDS integration
   - Complex modifiers and allergen alerts
   - Split bills and tip suggestions

7. **Integration Capabilities**
   - Payment gateway integration
   - Accounting software integration
   - Third-party platform connections

8. **Mobile & Offline Support**
   - Staff mobile applications
   - Customer-facing ordering app
   - Offline mode support

9. **Security & Compliance**
   - Two-factor authentication
   - Role-based access control
   - Regulatory compliance tools

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

## Default employee login

- Email: `admin@cafemaster.local`
- Password: `Cafe@12345`

Change the seeded credentials before a real deployment.

## New Phase 2 Features

### Manager Authentication
- Manager password verification required for staff management
- Enhanced security for sensitive operations
- Separate staff management panel with salary administration

### Employee Management
- Added salary field to employee records
- Enhanced employee creation and editing
- Staff management table with comprehensive information
- Active/inactive status management

### UI Improvements
- Fixed alignment issues in table layouts
- Improved responsive design for staff management
- Enhanced table column structure for better data display

## Project structure

```text
.
|-- cafe.html
|-- database/
|   `-- schema.sql
|-- data/
|   `-- cafemaster.sqlite
|-- public/
|   |-- app.js
|   |-- index.html
|   |-- styles.css
|   `-- assets/
|       `-- cafemaster-logo.svg
|-- src/
|   `-- server/
|       |-- app.js
|       |-- data.js
|       `-- database.js
|-- tests/
|   `-- smoke.test.js
|-- package.json
`-- server.js
```

## Data stored in SQLite

- Tables
- Menu items
- Customers
- Orders
- Order items
- Inventory movements

## Available scripts

- `npm start` starts the app
- `npm run dev` starts the app in watch mode
- `npm test` runs the smoke test suite

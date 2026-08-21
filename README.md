# ☕ CafeMaster — Restaurant Operations OS

> A modern, full-stack Restaurant Operations Management System for managing POS, tables, menu, inventory, customers, reservations, purchasing, staff, reporting, and restaurant operations from a single platform.

**Status:** 🚧 Active Development
**Current Phase:** Phase 2 — Operations & Management
**Next Phase:** Phase 3 — Intelligence & Integrations

---

## 🚀 Overview

**CafeMaster** is a centralized operating system designed for cafes and restaurants.

It brings together orders, tables, inventory, customers, reservations, employees, purchasing, reports, and operational controls into one unified platform.

```text
                    ☕ CAFEMASTER
                         │
        ┌────────────────┼────────────────┐
        │                │                │
       POS           Operations          CRM
        │                │                │
   ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
 Orders   Billing   Tables  Staff   Guests  Loyalty
        │                │                │
        └────────────────┼────────────────┘
                         │
                    Management
                         │
              ┌──────────┼──────────┐
              │          │          │
          Inventory   Purchasing  Reports
              │          │          │
              └──────────┼──────────┘
                         │
                    Future Layer
                         │
          AI • Analytics • Integrations
```

---

## ✨ Current Features — Phase 2

### 📊 Operations Dashboard

* Responsive operations dashboard
* Revenue monitoring
* Active order monitoring
* Table occupancy overview
* Inventory alerts
* Operational metrics

### 🧾 POS & Order Management

* Create orders
* Add multiple menu items
* Tax calculation
* Service charge calculation
* Order status management
* Order history
* Order item tracking

### 🪑 Table Management

* Table availability tracking
* Occupied table management
* Reserved table management
* Table status updates
* Visual table management

### 🍔 Menu Management

* Create menu items
* Edit menu items
* Delete menu items
* Category management
* Pricing management
* Item availability
* Inventory-linked menu items

### 📦 Inventory Management

* Inventory tracking
* Stock movement tracking
* Low-stock monitoring
* Inventory history
* Menu-to-inventory tracking

### 👥 Guest CRM & Loyalty

* Guest profiles
* Customer order history
* Loyalty tracking
* Customer activity tracking

### 📅 Reservations

* Create reservations
* Manage reservations
* Guest information
* Table allocation
* Reservation status

### 👨‍💼 Staff & Shift Management

* Employee management
* Employee creation and editing
* Active/inactive employee status
* Salary management
* Staff information
* Shift management

### 🛒 Purchasing & Suppliers

* Supplier management
* Purchasing records
* Stock procurement
* Supplier information
* Purchase tracking

### 📈 Reports & Control

* Operational reports
* Sales information
* Audit logs
* Management controls

### 🔐 Security

* Manager authentication
* Protected sensitive operations
* Staff management authorization

---

# 🧠 Phase 3 — Intelligence & Scale

Phase 3 will transform CafeMaster from a management platform into an **intelligent restaurant operating system**.

## 📊 Advanced Analytics & Business Intelligence

* Revenue trends
* Peak-hour analysis
* Customer Lifetime Value (CLV)
* Menu performance analytics
* Profit margin analysis
* Business intelligence dashboards

## 🤖 AI-Powered Inventory

* Smart stock prediction
* AI-powered demand forecasting
* Automated purchasing recommendations
* Recipe and ingredient cost management
* Waste tracking
* Waste analysis

## 👨‍💼 Advanced Staff Management

* Employee performance analytics
* Productivity metrics
* Payroll integration
* Overtime tracking
* Tip reporting
* Tip distribution

## ❤️ Advanced CRM

* Advanced customer profiles
* Preference tracking
* Customer segmentation
* Marketing campaign targeting
* Automated communication

## 🏢 Multi-Location Support

* Multiple restaurant branches
* Centralized inventory
* Unified customer database
* Location-specific pricing
* Branch-level analytics

## 🧾 Advanced POS

* Course sequencing
* Kitchen Display System (KDS) integration
* Complex modifiers
* Allergen alerts
* Split bills
* Tip suggestions

## 🔌 Integrations

Planned integrations include:

* Payment gateways
* Accounting software
* Delivery platforms
* Messaging services
* Third-party restaurant platforms

## 📱 Mobile & Offline Support

* Staff mobile application
* Customer ordering application
* QR-based ordering
* Offline POS mode
* Automatic synchronization

## 🔒 Security & Compliance

* Two-factor authentication
* Role-based access control
* Advanced permissions
* Audit trails
* Regulatory compliance tools

---

# 🛠️ Technology Stack

| Layer              | Technology             |
| ------------------ | ---------------------- |
| Frontend           | HTML, CSS, JavaScript  |
| Backend            | Node.js                |
| API                | REST API               |
| Database — Current | SQLite                 |
| Database — Planned | MongoDB                |
| Authentication     | Manager Authentication |
| Testing            | Node.js Test Runner    |
| Package Manager    | npm                    |
| Version Control    | Git + GitHub           |

---

# 🗄️ Database

## Current Database

CafeMaster currently uses **SQLite**.

The database stores:

* Tables
* Menu items
* Customers
* Orders
* Order items
* Inventory movements
* Employees
* Reservations
* Suppliers
* Purchasing records

## 🔄 MongoDB Migration

The project is transitioning from:

```text
SQLite
   ↓
MongoDB
```

The migration will focus on:

* Data preservation
* Database schema redesign
* API compatibility
* Query optimization
* Indexing
* Scalable data access
* Improved future multi-location support

---

# 📁 Project Structure

```text
CafeMaster/
│
├── cafe.html
│
├── database/
│   └── schema.sql
│
├── data/
│   └── cafemaster.sqlite
│
├── public/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   │
│   └── assets/
│       └── cafemaster-logo.svg
│
├── src/
│   └── server/
│       ├── app.js
│       ├── data.js
│       └── database.js
│
├── tests/
│   └── smoke.test.js
│
├── package.json
│
└── server.js
```

---

# ⚡ Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/CafeMaster.git
cd CafeMaster
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Start the Application

```bash
npm start
```

Open the application at:

```text
http://localhost:3000
```

---

# 🧪 Development

Start the application in watch/development mode:

```bash
npm run dev
```

Run the test suite:

```bash
npm test
```

---

# 🔐 Default Employee Login

```text
Email: admin@cafemaster.local
Password: Cafe@12345
```

> ⚠️ **Important:** These credentials are for development purposes only. Change the seeded credentials before deploying the application publicly.

---

# 🗺️ Development Roadmap

```text
Phase 1
████████████████████  Complete

Core Restaurant Management
├── POS
├── Menu
├── Tables
├── Orders
└── Basic Inventory


Phase 2
████████████████████  Complete

Operations Management
├── CRM
├── Reservations
├── Staff
├── Salary Management
├── Purchasing
├── Suppliers
├── Reports
├── Audit Logs
└── Manager Authentication


Phase 3
██████░░░░░░░░░░░░░░  In Progress

Intelligence & Scale
├── MongoDB Migration
├── Advanced Analytics
├── AI Forecasting
├── Recipe Management
├── Waste Tracking
├── Advanced CRM
├── Multi-Location
├── Advanced POS
├── Payment Integrations
├── Mobile Applications
└── Offline Mode
```

---

# 📌 Project Status

| Module                 | Status         |
| ---------------------- | -------------- |
| Dashboard              | ✅ Complete     |
| POS                    | ✅ Complete     |
| Orders                 | ✅ Complete     |
| Tables                 | ✅ Complete     |
| Menu                   | ✅ Complete     |
| Inventory              | ✅ Complete     |
| CRM                    | ✅ Complete     |
| Reservations           | ✅ Complete     |
| Staff Management       | ✅ Complete     |
| Salary Management      | ✅ Complete     |
| Purchasing             | ✅ Complete     |
| Suppliers              | ✅ Complete     |
| Reports                | ✅ Complete     |
| Audit Logs             | ✅ Complete     |
| Manager Authentication | ✅ Complete     |
| MongoDB Migration      | 🚧 In Progress |
| Advanced Analytics     | 🔜 Planned     |
| AI Demand Forecasting  | 🔜 Planned     |
| Recipe Management      | 🔜 Planned     |
| Waste Tracking         | 🔜 Planned     |
| Multi-Location         | 🔜 Planned     |
| Advanced POS           | 🔜 Planned     |
| Payment Integration    | 🔜 Planned     |
| Mobile App             | 🔜 Planned     |
| Offline Mode           | 🔜 Planned     |

---

# 🔮 Long-Term Vision

CafeMaster aims to evolve from a traditional restaurant management application into a complete **Restaurant Operations OS**.

```text
                 CAFEMASTER
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
     OPERATE      ANALYZE      OPTIMIZE
        │            │            │
       POS          BI           AI
     Inventory    Reports     Forecasting
      Staff       Metrics     Automation
      CRM          CLV        Recommendations
        │            │            │
        └────────────┼────────────┘
                     ↓
              RESTAURANT OS
```

The long-term goal is to provide restaurant owners and managers with **data-driven insights, intelligent automation, predictive analytics, and centralized operational control**.

---

# 🤝 Contributing

Contributions, ideas, bug reports, and feature suggestions are welcome.

### 1. Fork the repository

### 2. Create a feature branch

```bash
git checkout -b feature/your-feature
```

### 3. Make your changes

### 4. Commit your changes

```bash
git add .
git commit -m "feat: add your feature"
```

### 5. Push your branch

```bash
git push origin feature/your-feature
```

### 6. Open a Pull Request

---

# 🧑‍💻 Development Philosophy

CafeMaster is being developed with the following principles:

* **Modular architecture**
* **Clean and maintainable code**
* **API-first development**
* **Security-first operations**
* **Test-driven improvements**
* **Scalable database architecture**
* **AI-ready infrastructure**
* **Mobile-ready backend**
* **Cloud-ready deployment**

---

# ☕ CafeMaster

### From managing a cafe → to intelligently operating one.

Built for modern restaurant operations, automation, analytics, and future AI-powered management.

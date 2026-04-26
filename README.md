# CafeMaster Phase One

CafeMaster is a complete phase-one cafe management project with:

- A responsive dashboard
- POS order creation
- Table status management
- Menu management
- Inventory tracking and restocking
- Order history with status updates
- SQLite persistence using Node.js

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

## Default employee login

- Email: `admin@cafemaster.local`
- Password: `Cafe@12345`

Change the seeded credentials before a real deployment.

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

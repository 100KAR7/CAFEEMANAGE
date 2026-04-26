const DEFAULT_TABLES = [
  { name: "T1", seats: 2, zone: "Window", status: "free" },
  { name: "T2", seats: 2, zone: "Window", status: "free" },
  { name: "T3", seats: 4, zone: "Main Hall", status: "free" },
  { name: "T4", seats: 4, zone: "Main Hall", status: "free" },
  { name: "T5", seats: 4, zone: "Main Hall", status: "free" },
  { name: "T6", seats: 6, zone: "Garden", status: "free" },
  { name: "T7", seats: 6, zone: "Garden", status: "free" },
  { name: "T8", seats: 2, zone: "Counter", status: "reserved" },
  { name: "T9", seats: 2, zone: "Counter", status: "free" },
  { name: "T10", seats: 4, zone: "Family", status: "free" },
  { name: "T11", seats: 4, zone: "Family", status: "free" },
  { name: "T12", seats: 8, zone: "Private", status: "free" }
];

const DEFAULT_MENU_ITEMS = [
  {
    name: "Signature Espresso",
    category: "Coffee",
    description: "Single-origin espresso with dark cocoa notes.",
    price: 95,
    cost: 28,
    stock: 54,
    available: 1,
    prepTime: 4
  },
  {
    name: "Cappuccino",
    category: "Coffee",
    description: "Silky milk foam over double-shot espresso.",
    price: 145,
    cost: 42,
    stock: 42,
    available: 1,
    prepTime: 6
  },
  {
    name: "Caramel Latte",
    category: "Coffee",
    description: "House caramel, espresso, and steamed milk.",
    price: 170,
    cost: 56,
    stock: 31,
    available: 1,
    prepTime: 7
  },
  {
    name: "Cold Brew Tonic",
    category: "Coffee",
    description: "Slow-steeped cold brew with citrus tonic.",
    price: 180,
    cost: 61,
    stock: 18,
    available: 1,
    prepTime: 5
  },
  {
    name: "Masala Chai",
    category: "Tea",
    description: "Fresh ginger, cardamom, and Assam tea.",
    price: 70,
    cost: 18,
    stock: 48,
    available: 1,
    prepTime: 5
  },
  {
    name: "Iced Hibiscus Cooler",
    category: "Tea",
    description: "Floral iced tea with lemon and mint.",
    price: 120,
    cost: 34,
    stock: 20,
    available: 1,
    prepTime: 4
  },
  {
    name: "Breakfast Croissant",
    category: "Bakery",
    description: "Butter croissant with scrambled eggs and cheese.",
    price: 165,
    cost: 62,
    stock: 16,
    available: 1,
    prepTime: 8
  },
  {
    name: "Sourdough Grilled Sandwich",
    category: "Bakery",
    description: "Roasted vegetables, pesto, and mozzarella.",
    price: 210,
    cost: 84,
    stock: 15,
    available: 1,
    prepTime: 10
  },
  {
    name: "Paneer Kathi Wrap",
    category: "Kitchen",
    description: "Charred paneer, mint mayo, onion pickle.",
    price: 225,
    cost: 91,
    stock: 9,
    available: 1,
    prepTime: 12
  },
  {
    name: "Chicken Alfredo Pasta",
    category: "Kitchen",
    description: "Creamy pasta with herbs and parmesan.",
    price: 295,
    cost: 118,
    stock: 11,
    available: 1,
    prepTime: 15
  },
  {
    name: "House Veg Burger",
    category: "Kitchen",
    description: "Smoked veg patty, aioli, and fries.",
    price: 230,
    cost: 96,
    stock: 13,
    available: 1,
    prepTime: 11
  },
  {
    name: "Farmhouse Pizza Slice",
    category: "Kitchen",
    description: "Stone-baked slice with olive tapenade.",
    price: 190,
    cost: 72,
    stock: 14,
    available: 1,
    prepTime: 9
  },
  {
    name: "Brownie Sundae",
    category: "Dessert",
    description: "Warm brownie with vanilla bean ice cream.",
    price: 180,
    cost: 63,
    stock: 17,
    available: 1,
    prepTime: 6
  },
  {
    name: "Classic Cheesecake",
    category: "Dessert",
    description: "Baked cheesecake with berry compote.",
    price: 195,
    cost: 71,
    stock: 8,
    available: 1,
    prepTime: 4
  },
  {
    name: "Mango Tres Leches",
    category: "Dessert",
    description: "Light sponge soaked in mango milk.",
    price: 205,
    cost: 74,
    stock: 12,
    available: 1,
    prepTime: 5
  },
  {
    name: "Sparkling Lime Soda",
    category: "Drinks",
    description: "Fresh lime, mint, and sparkling water.",
    price: 95,
    cost: 21,
    stock: 36,
    available: 1,
    prepTime: 3
  },
  {
    name: "Berry Smoothie",
    category: "Drinks",
    description: "Mixed berries, yogurt, and banana.",
    price: 160,
    cost: 49,
    stock: 19,
    available: 1,
    prepTime: 4
  },
  {
    name: "Mint Lemonade",
    category: "Drinks",
    description: "House lemonade with crushed mint.",
    price: 105,
    cost: 24,
    stock: 28,
    available: 1,
    prepTime: 3
  }
];

const DEFAULT_CUSTOMERS = [
  { name: "Aarav Sen", phone: "9876500001", visits: 6, loyaltyPoints: 120 },
  { name: "Naina Kapoor", phone: "9876500002", visits: 4, loyaltyPoints: 80 },
  { name: "Rohan Das", phone: "9876500003", visits: 3, loyaltyPoints: 60 }
];

const SAMPLE_ORDERS = [
  {
    orderType: "dine-in",
    tableName: "T3",
    customerPhone: "9876500001",
    paymentMethod: "UPI",
    paymentStatus: "paid",
    status: "completed",
    notes: "No sugar in one coffee.",
    discount: 20,
    items: [
      { menuName: "Cappuccino", qty: 2 },
      { menuName: "Brownie Sundae", qty: 1 }
    ]
  },
  {
    orderType: "takeaway",
    customerName: "Walk-in Guest",
    customerPhone: "9876500099",
    paymentMethod: "Card",
    paymentStatus: "paid",
    status: "completed",
    notes: "Packed for office pickup.",
    discount: 0,
    items: [
      { menuName: "Breakfast Croissant", qty: 2 },
      { menuName: "Masala Chai", qty: 2 }
    ]
  },
  {
    orderType: "dine-in",
    tableName: "T6",
    customerPhone: "9876500002",
    paymentMethod: "Cash",
    paymentStatus: "pending",
    status: "preparing",
    notes: "Birthday table, serve dessert later.",
    discount: 35,
    items: [
      { menuName: "Paneer Kathi Wrap", qty: 2 },
      { menuName: "Cold Brew Tonic", qty: 2 },
      { menuName: "Classic Cheesecake", qty: 1 }
    ]
  }
];

module.exports = {
  DEFAULT_TABLES,
  DEFAULT_MENU_ITEMS,
  DEFAULT_CUSTOMERS,
  SAMPLE_ORDERS
};

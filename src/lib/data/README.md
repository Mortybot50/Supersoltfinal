# SuperSolt Data Architecture

## Overview

SuperSolt uses a centralized data store (Zustand) to manage all application data. This architecture makes it easy to:

- Import data from external sources
- Share data across components
- Maintain data consistency
- Prepare for backend integration

## Data Store

All data is stored in `src/lib/data/store.ts` using Zustand state management.

### Available Data Entities

- **Orders**: Customer orders with financial details
- **Order Items**: Line items within orders
- **Tenders**: Payment information for orders
- **Ingredients**: Inventory items with stock levels
- **Stock Counts**: Periodic inventory counts
- **Waste Entries**: Waste tracking records
- **Purchase Orders**: Supplier orders
- **Suppliers**: Supplier information
- **Menu Items**: Items available for sale
- **Recipes**: Recipe definitions with ingredients
- **Staff**: Employee records
- **Shifts**: Scheduled shifts
- **Timesheets**: Time tracking records
- **Forecasts**: Sales forecasts
- **Targets**: Sales targets

## Importing Data

### Step 1: Navigate to Data Imports

Go to **Admin → Data Imports** in the application.

### Step 2: Prepare Your Data

Data must be in JSON format matching the TypeScript interfaces in `src/types/index.ts`.

### Step 3: Upload

Select the entity type and upload your JSON file.

## Data Format Examples

### Orders (orders.json)

```json
[
  {
    "id": "ORD-001",
    "order_number": "001",
    "venue_id": "venue-rowville",
    "order_datetime": "2024-10-25T10:30:00Z",
    "channel": "dine-in",
    "gross_amount": 4520,
    "tax_amount": 411,
    "discount_amount": 0,
    "service_charge": 0,
    "tip_amount": 100,
    "net_amount": 4109,
    "is_void": false,
    "is_refund": false
  }
]
```

### Order Items (order-items.json)

```json
[
  {
    "id": "ITEM-001",
    "order_id": "ORD-001",
    "menu_item_id": "MENU-FLATWHITE",
    "menu_item_name": "Flat White",
    "quantity": 2,
    "unit_price": 450,
    "total_price": 900,
    "menu_category": "Beverages",
    "menu_group": "beverages"
  }
]
```

### Ingredients (ingredients.json)

```json
[
  {
    "id": "ING-001",
    "venue_id": "venue-rowville",
    "name": "Milk (Full Cream)",
    "category": "dairy",
    "unit": "L",
    "current_stock": 50,
    "par_level": 30,
    "cost_per_unit": 150,
    "last_cost_update": "2024-10-20T00:00:00Z",
    "supplier_id": "SUP-001",
    "supplier_name": "Dairy Supplier",
    "active": true
  }
]
```

### Staff (staff.json)

```json
[
  {
    "id": "STAFF-001",
    "organization_id": "org-1",
    "venue_id": "venue-rowville",
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "0400000000",
    "role": "manager",
    "hourly_rate": 3500,
    "start_date": "2024-01-01T00:00:00Z",
    "status": "active"
  }
]
```

## Using Data in Components

### Import the hook

```typescript
import { useSalesMetrics } from "@/lib/hooks/useSalesMetrics";
```

### Use in component

```typescript
function MyComponent() {
  const { metrics, hasData } = useSalesMetrics({
    startDate: new Date('2024-10-01'),
    endDate: new Date('2024-10-31')
  })

  if (!hasData) {
    return <EmptyState message="No data available" />
  }

  return (
    <div>
      Net Sales: {formatCurrency(metrics.net_sales)}
    </div>
  )
}
```

## Currency Format

All monetary values are stored as **integers in cents**:

- $12.50 is stored as `1250`
- $100.00 is stored as `10000`

Use `formatCurrency()` from `@/lib/utils/formatters` to display values.

## Date Format

All dates are stored as ISO 8601 strings:

- `"2024-10-25T10:30:00Z"`

Use `formatDate()` from `@/lib/utils/formatters` to display dates.

## Next Steps

1. Import your data via the Data Imports page
2. View insights in Insights → Sales
3. Add more data entities as needed
4. Connect to real backend when ready

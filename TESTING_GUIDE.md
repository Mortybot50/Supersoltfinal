# Sales Insights Data Flow Testing Guide

## 🎯 Objective
Verify that sales data flows correctly from Excel import → Zustand store → Sales Insights visualization.

---

## 📋 Testing Checklist

### 1. Import Sales Data
**Location:** Data Imports page → Sales Data tab

**Steps:**
1. ✅ Click "Download Template" button
2. ✅ Open SuperSolt-TASK-Import-FIXED.xlsx (19,697 orders)
3. ✅ Click "Select File" and choose the Excel file
4. ✅ Wait for parsing (should take 2-5 seconds)
5. ✅ Verify preview shows:
   - Total Rows: 19,697
   - Valid Rows: 19,697 (green)
   - Invalid Rows: 0
6. ✅ Check preview table shows first 100 orders
7. ✅ Click "Import" button
8. ✅ Wait for success toast: "Import successful! 🎉"
9. ✅ Toast should show: "Imported 19,697 orders. Total store: X orders."

**Console Verification:**
```
🚀 Starting import of 19697 orders
📦 importParsedOrders called with 19697 orders
🔄 Transformed orders: [...]
🔍 Found 19697 unique orders out of 19697
✅ Store now has 19697 total orders
💾 Saving to database...
✅ Import complete!
```

---

### 2. Navigate to Sales Insights
**Location:** Insights → Sales

**Steps:**
1. ✅ Click "Sales Insights" in sidebar
2. ✅ Page should load WITHOUT empty state
3. ✅ Header subtitle should show: "... • 19,697 orders loaded"

**Console Verification:**
```
📊 Sales Insights - Data Update: {
  totalOrders: 19697,
  orderItems: 0,
  tenders: 0,
  dateRange: { from: '2025-09-01', to: '2025-09-30' },
  firstOrder: {
    order_number: 'ORD-...',
    date: '2025-09-XX...',
    channel: 'delivery',
    net_amount: XXXX
  }
}
📅 Date filter: 19697 orders in range out of 19697 total
```

---

### 3. Verify KPI Cards

**Expected Values (September 2025):**

#### 📊 Net Sales
- **Value:** ~$500,000-600,000 (exact depends on data)
- **Badge:** "On Target" (blue) or "Below Target" (red)
- **Subtitle:** "19,697 orders"

#### 💰 Avg Check
- **Value:** ~$25-30 per order
- **Badge:** "Average" (gray)
- **Subtitle:** "per transaction"

#### 🛒 Total Orders
- **Value:** 19,697
- **Badge:** Shows % change vs previous period
- **Subtitle:** "vs previous period"

#### 📦 Items per Order
- **Value:** ~2.5 (estimated)
- **Badge:** "Stable" (gray)
- **Subtitle:** "average basket size"

**Verification Steps:**
1. ✅ All 4 cards display without errors
2. ✅ Net Sales is NOT $0.00
3. ✅ Total Orders shows 19,697
4. ✅ No "NaN" or "undefined" values
5. ✅ All currency values formatted as AUD

---

### 4. Verify Sales Trend Chart

**Expected:**
- **Title:** "Sales Trend (Last 30 Days)"
- **X-Axis:** Dates from Sep 1 to Sep 30, 2025
- **Y-Axis:** Dollar amounts ($)
- **Lines:**
  - 🟣 Purple: Forecast
  - 🔴 Red: Actual (should show data points)
  - ⚪ Gray dashed: Target
- **Data Points:** 30 days of data

**Verification Steps:**
1. ✅ Chart renders without errors
2. ✅ Actual line (red) shows variations (not flat at $0)
3. ✅ Dates span September 2025
4. ✅ Y-axis shows dollar amounts (not $0)
5. ✅ Tooltip shows formatted currency on hover

**Console Verification:**
Should NOT see empty data warnings.

---

### 5. Verify Channel Mix

**Expected Channels (from your data):**
- Delivery
- Dine-in
- Takeaway
- (possibly Online)

**Left Card - Channel Mix Chart:**
1. ✅ Shows progress bars for each channel
2. ✅ Percentages add up to ~100%
3. ✅ At least 2-3 channels visible
4. ✅ No "No channel data available" message

**Right Card - Channel Details Table:**
1. ✅ Table shows all active channels
2. ✅ Revenue column shows dollar amounts (not $0.00)
3. ✅ Orders column shows counts
4. ✅ Avg Check shows dollar amounts
5. ✅ Share column shows percentages

**Console Verification:**
```
🔍 ChannelMix - Processing: {
  totalOrders: 19697,
  dateRange: { ... }
}
✅ ChannelMix - Filtered orders: 19697
```

---

### 6. Test Date Range Filtering

**Test 1: Switch to "Day" View**
1. ✅ Click "Day" button
2. ✅ Should show today's data (likely 0 orders)
3. ✅ Empty state message: "No Data for Selected Period"

**Test 2: Switch to "Week" View**
1. ✅ Click "Week" button
2. ✅ Should show current week's data (likely 0 orders)
3. ✅ Empty state or small amount of data

**Test 3: Switch to "Month" View**
1. ✅ Click "Month" button
2. ✅ Should show current month's data
3. ✅ If current month is September 2025, shows all 19,697 orders
4. ✅ If not, may show 0 orders

**Test 4: Use Custom Date Range**
1. ✅ Click date range selector
2. ✅ Select September 1-30, 2025
3. ✅ All data should reappear
4. ✅ KPIs update to show full dataset

**Console Verification:**
After each date change:
```
📅 Date filter: X orders in range out of 19697 total
```

---

### 7. Verify Payment Methods

**Expected:**
- Most orders likely paid by "Card"
- Possibly some "Cash" or "Digital Wallet"

**Verification Steps:**
1. ✅ Shows at least 1 payment method
2. ✅ Revenue amounts displayed
3. ✅ Share percentages shown
4. ✅ No "No payment data" message

---

### 8. Verify Refunds & Voids

**Expected (from your data):**
- Refund Rate: Low % (most orders valid)
- Void Rate: Low %
- Both should NOT be 0% if there are any refunds/voids

**Verification Steps:**
1. ✅ Refund Rate shows percentage
2. ✅ Void Rate shows percentage
3. ✅ Refund Value shows dollar amount
4. ✅ Card renders without errors

---

## 🐛 Troubleshooting

### Problem: Empty State Shows Even After Import

**Check:**
1. Open Console (F12)
2. Look for: `📊 Sales Insights - Data Update:`
3. Check `totalOrders` value

**If totalOrders = 0:**
- Import may have failed
- Check console for errors during import
- Try re-importing the file
- Check Data Imports page shows imported data

**If totalOrders > 0 but page is empty:**
- Date range may be wrong
- Set date range to September 2025
- Check console for filter count

### Problem: KPIs Show $0.00

**Check:**
1. Open Console
2. Look for orders data structure
3. Verify `net_amount` field exists and is > 0

**If net_amount is 0 or undefined:**
- Check import transformation in dataStore.ts
- Verify Excel parser is calculating net amounts correctly

### Problem: Charts Don't Show Data

**Check:**
1. Open Console
2. Look for ChannelMix logs
3. Verify filtered orders count > 0

**If filtered count = 0:**
- Date range is filtering out all data
- Adjust date range to match imported data dates

### Problem: "No orders" in Store

**Check:**
1. Go to Data Imports page
2. Check if import succeeded
3. Look for success toast
4. Check console logs during import

**If import succeeded but store empty:**
- Clear browser cache
- Refresh page
- Re-import data
- Check Zustand store persistence

---

## ✅ Success Criteria

All of the following must be true:
- ✅ Import completes without errors
- ✅ Sales Insights page loads without empty state
- ✅ All 4 KPI cards show real data (not $0.00)
- ✅ Sales Trend Chart shows line graph with data points
- ✅ Channel Mix shows at least 2-3 channels with revenue
- ✅ Payment Methods shows at least 1 method
- ✅ Date range filtering works correctly
- ✅ Console shows correct order counts
- ✅ No React errors in console

---

## 📊 Expected Data Summary

**From SuperSolt-TASK-Import-FIXED.xlsx:**
- Total Orders: 19,697
- Date Range: September 2025
- Channels: Delivery, Dine-in, Takeaway
- Payment Method: Mostly Card
- Refunds/Voids: Low percentage

**Calculated Metrics:**
- Net Sales: Sum of all net_amount (in cents, display as $)
- Avg Check: Net Sales / Total Orders
- Orders by Channel: Group and count by channel
- Daily Sales: Aggregate by date

---

## 🔍 Debug Commands

**Check Store State:**
```javascript
// In Console
useDataStore.getState().orders.length
// Should return: 19697

useDataStore.getState().orders[0]
// Should return: { id, order_number, net_amount, ... }
```

**Check Date Range:**
```javascript
// Current date range
dateRange
// Should show September 2025 for full data
```

**Check Filtered Orders:**
```javascript
// In Console during Sales page
filteredOrders.length
// Should match displayed count
```

---

## 📝 Notes

- Import saves to both Zustand store (in-memory) and Supabase (persistent)
- Zustand store is used for display (faster)
- Date calculations assume orders in September 2025
- All amounts stored as cents, displayed as dollars
- Channel names are lowercase in data, capitalized in display

const SPREADSHEET_ID = '192sDIXKEY1zGwHrr0twfyGHEVFZ0PXIuOd3i-6RkwM8';
const PRODUCTS_SHEET_NAME = 'منتجات';
const SALES_SHEET_NAME = 'المبيعات';
const ORDERS_SHEET_NAME = 'الطلبات';
const PRODUCTS_DATA_RANGE = 'A4:F'; // تم تحديث النطاق ليشمل العمود F للوصف
const SALES_DATA_RANGE = 'A4:D';
const ORDERS_DATA_RANGE = 'A:J'; // Extend range to include Status (I) and Rating (J)

/**
 * Handles GET and POST requests to the web app.
 * GET is used for fetching data and simple actions.
 * POST could be used for actions requiring larger data payloads if needed, but GET is used here for simplicity.
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    Logger.log('doGet received action: ' + action + ' with parameters: ' + JSON.stringify(e.parameter));

    switch (action) {
      case 'getProducts':
        return getProducts();
      case 'getSales':
        return getSales();
      case 'appendSale': // This might be deprecated if not used by the current HTML
        return appendSale(e);
      case 'submitOrder':
        return submitOrder(e);
      case 'getNextOrderId':
        return getNextOrderId();
      case 'getOrders': // Fetches all orders, might need pagination for large datasets
        return getOrders();
      case 'updateOrderStatus': // New action to update status and rating
        return updateOrderStatus(e);
      default:
        return createJsonResponse({ success: false, error: 'Invalid action specified.' });
    }
  } catch (error) {
    Logger.log('Error in doGet: ' + error + '\nStack: ' + error.stack);
    return createJsonResponse({ success: false, error: 'An unexpected error occurred: ' + error.message });
  }
}

// It's good practice to also handle POST if you might switch methods
function doPost(e) {
    try {
        // Attempt to parse parameters from POST body if needed
        // For now, delegate to doGet as parameters are expected in URL for this implementation
        Logger.log('doPost received. Delegating to doGet. Content: ' + e.postData.contents);
        // You might parse e.postData.contents if sending data in request body
        return doGet(e); // Assuming parameters are still in URL even for POST
    } catch (error) {
        Logger.log('Error in doPost: ' + error + '\nStack: ' + error.stack);
        return createJsonResponse({ success: false, error: 'An unexpected error occurred during POST: ' + error.message });
    }
}


/**
 * Fetches product data from the spreadsheet, including category from column E and description from column F.
 */
function getProducts() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(PRODUCTS_SHEET_NAME);
    if (!sheet) {
      return createJsonResponse({ success: false, error: `Sheet '${PRODUCTS_SHEET_NAME}' not found.` });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 4) {
        return createJsonResponse({ success: true, data: [] }); // No products
    }
    // تم تحديث النطاق ليشمل العمود F للوصف
    const range = sheet.getRange('A4:F' + lastRow);
    const values = range.getValues().filter(row => row[0] && String(row[0]).trim() !== ''); // Filter empty rows based on Column A

    const products = values.map(row => ({
      name: String(row[0]).trim(),
      price: parseFloat(row[1]) || 0,
      qty: parseInt(row[2]) || 0,
      category: String(row[4] ? row[4] : 'غير مصنف').trim(), // Read category from Column E (index 4)
      description: String(row[5] ? row[5] : '').trim() // Read description from Column F (index 5)
    }));

    return createJsonResponse({ success: true, data: products });
  } catch (error) {
    Logger.log('Error fetching products: ' + error);
    return createJsonResponse({ success: false, error: 'Failed to fetch products: ' + error.message });
  }
}

/**
 * Appends a sale record into a fixed range A4:D100.
 * Note: This function seems separate from the main order system now.
 */
function appendSale(e) {
  // ... (Keep existing appendSale logic if still needed, otherwise can be removed)
   try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SALES_SHEET_NAME);
    if (!sheet) {
      return createJsonResponse({ success: false, error: `Sheet '${SALES_SHEET_NAME}' not found.` });
    }
    const date = e.parameter.date;
    const product = e.parameter.product;
    const total = e.parameter.total;
    const soldQty = e.parameter.soldQty;
    if (!date || !product || !total || !soldQty) {
        return createJsonResponse({ success: false, error: 'Missing required sale parameters.' });
    }
    const START_ROW = 4;
    const MAX_ROWS = 97;
    const dataRange = sheet.getRange(START_ROW, 1, MAX_ROWS, 4);
    const data = dataRange.getValues();
    let targetRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (!data[i][0]) {
        targetRow = START_ROW + i;
        break;
      }
    }
    if (targetRow === -1) {
      return createJsonResponse({ success: false, error: 'Sales range (A4:D100) is full.' });
    }
    const targetRange = sheet.getRange(targetRow, 1, 1, 4);
    targetRange.setValues([[date, product, parseFloat(total), parseInt(soldQty)]]);
    return createJsonResponse({ success: true, message: `Sale saved at row ${targetRow}.` });
  } catch (error) {
    Logger.log('Error appending sale: ' + error);
    return createJsonResponse({ success: false, error: 'Failed to append sale: ' + error.message });
  }
}

/**
 * Fetches sales data from the spreadsheet.
 * Note: This function seems separate from the main order system now.
 */
function getSales() {
  // ... (Keep existing getSales logic if still needed, otherwise can be removed)
   try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SALES_SHEET_NAME);
    if (!sheet) {
      return createJsonResponse({ success: false, error: `Sheet '${SALES_SHEET_NAME}' not found.` });
    }
    const range = sheet.getRange(SALES_DATA_RANGE + '100'); // A4:D100
    const values = range.getValues().filter(row => row[0]);
    const sales = values.map(row => ({
      date: row[0],
      product: String(row[1]).trim(),
      total: parseFloat(row[2]) || 0,
      soldQty: parseInt(row[3]) || 0
    }));
    return createJsonResponse({ success: true, data: sales });
  } catch (error) {
    Logger.log('Error fetching sales: ' + error);
    return createJsonResponse({ success: false, error: 'Failed to fetch sales: ' + error.message });
  }
}

/**
 * Helper to return JSON response.
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ======== Order Management Functions ========

/**
 * Ensures the Orders sheet exists and has the correct headers.
 */
function ensureOrdersSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ORDERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ORDERS_SHEET_NAME);
    const headers = [
      'معرف الطلب',    // A (1)
      'تاريخ الطلب',   // B (2)
      'اسم العميل',    // C (3)
      'رقم الهاتف',   // D (4)
      'العنوان/الاستلام', // E (5)
      'موعد الاستلام', // F (6)
      'إجمالي الطلب', // G (7)
      'تفاصيل المنتجات', // H (8)
      'حالة الطلب',    // I (9)
      'التقييم'       // J (10)
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Optional: Set column widths or formatting
    sheet.setColumnWidths(1, 10, 150); // Adjust widths as needed
    sheet.getRange('H:H').setWrap(true); // Wrap text in details column
  }
  // Check if Rating column exists, add if not (for backward compatibility)
  if (sheet.getLastColumn() < 10) {
      sheet.insertColumnAfter(9);
      sheet.getRange(1, 10).setValue('التقييم').setFontWeight('bold');
  }
  return sheet;
}

/**
 * Gets the next order ID (e.g., EL-Daheeh1, EL-Daheeh2, ...)
 */
function getNextOrderId() {
  try {
    const sheet = ensureOrdersSheet();
    const dataRange = sheet.getRange('A2:A'); // Look only in the ID column (A), starting from row 2
    const values = dataRange.getValues();
    let lastOrderNumber = 0;

    for (let i = 0; i < values.length; i++) {
      const orderId = values[i][0];
      if (orderId && String(orderId).startsWith('EL-Daheeh')) {
        const orderNumberStr = String(orderId).replace('EL-Daheeh', '');
        const orderNumber = parseInt(orderNumberStr);
        if (!isNaN(orderNumber) && orderNumber > lastOrderNumber) {
          lastOrderNumber = orderNumber;
        }
      }
    }

    const nextOrderId = `EL-Daheeh${lastOrderNumber + 1}`;
    return createJsonResponse({ success: true, orderId: nextOrderId });

  } catch (error) {
    Logger.log('Error generating next order ID: ' + error);
    return createJsonResponse({ success: false, error: 'Failed to generate next order ID: ' + error.message });
  }
}

/**
 * Submits a new order and saves it to the Orders sheet.
 */
function submitOrder(e) {
  try {
    const sheet = ensureOrdersSheet();

    // Validate required parameters from the request (e.parameter)
    const orderId = e.parameter.orderId;
    const orderDate = e.parameter.orderDate; // Consider standardizing format (e.g., ISO)
    const customerName = e.parameter.customerName;
    const phoneNumber = e.parameter.phoneNumber;
    const address = e.parameter.address || 'استلام من المكتبة';
    const pickupTime = e.parameter.pickupTime;
    const totalAmount = e.parameter.totalAmount;
    const orderDetails = e.parameter.orderDetails; // Product details as JSON string

    if (!orderId || !orderDate || !customerName || !phoneNumber || !totalAmount || !orderDetails) {
        Logger.log('Missing parameters for submitOrder: ' + JSON.stringify(e.parameter));
        return createJsonResponse({ success: false, error: 'Missing required order parameters.' });
    }

    // Prepare the row data for the sheet
    const newRow = [
      orderId,
      orderDate, // Store as passed, or new Date(orderDate) if ISO format preferred
      customerName,
      phoneNumber,
      address,
      pickupTime,
      parseFloat(totalAmount) || 0,
      orderDetails, // Store the JSON string
      'جديد', // Default status: 'جديد' (New)
      '' // Default rating: empty
    ];

    // Append the new row to the sheet
    sheet.appendRow(newRow);
    Logger.log('Order submitted successfully: ' + orderId);

    return createJsonResponse({ success: true, message: 'Order submitted successfully.', orderId: orderId });

  } catch (error) {
    Logger.log('Error submitting order: ' + error + '\nStack: ' + error.stack + '\nParameters: ' + JSON.stringify(e.parameter));
    return createJsonResponse({ success: false, error: 'Failed to submit order: ' + error.message });
  }
}

/**
 * Fetches the list of all orders.
 * Consider adding pagination or filtering for large datasets.
 */
function getOrders() {
  try {
    const sheet = ensureOrdersSheet();
    const dataRange = sheet.getDataRange(); // Get all data
    const values = dataRange.getValues();

    const orders = [];
    // Start from i = 1 to skip header row
    for (let i = 1; i < values.length; i++) {
      if (values[i][0]) { // Check if Order ID exists
        orders.push({
          orderId: values[i][0],
          orderDate: values[i][1],
          customerName: values[i][2],
          phoneNumber: values[i][3],
          address: values[i][4],
          pickupTime: values[i][5],
          totalAmount: values[i][6],
          orderDetails: values[i][7],
          status: values[i][8] || 'جديد', // Default to 'جديد' if status is missing
          rating: values[i][9] || 0 // Default to 0 if rating is missing
        });
      }
    }

    return createJsonResponse({ success: true, data: orders });

  } catch (error) {
    Logger.log('Error fetching orders: ' + error);
    return createJsonResponse({ success: false, error: 'Failed to fetch orders: ' + error.message });
  }
}

/**
 * Updates the status and rating of a specific order in the Orders sheet.
 */
function updateOrderStatus(e) {
  try {
    const sheet = ensureOrdersSheet();

    // Get parameters from request
    const orderIdToUpdate = e.parameter.orderId;
    const newStatus = e.parameter.status; // e.g., 'completed'
    const rating = e.parameter.rating || 0; // Rating (optional)

    if (!orderIdToUpdate || !newStatus) {
      Logger.log('Missing parameters for updateOrderStatus: ' + JSON.stringify(e.parameter));
      return createJsonResponse({ success: false, error: 'Missing order ID or status for update.' });
    }

    // Find the row corresponding to the order ID
    const dataRange = sheet.getRange('A:A'); // Search in the Order ID column
    const orderIds = dataRange.getValues();
    let targetRow = -1;

    // Start from row 2 (index 1) to skip header
    for (let i = 1; i < orderIds.length; i++) {
      if (orderIds[i][0] == orderIdToUpdate) {
        targetRow = i + 1; // Sheet row number (1-based)
        break;
      }
    }

    if (targetRow === -1) {
      Logger.log('Order ID not found for update: ' + orderIdToUpdate);
      return createJsonResponse({ success: false, error: `Order ID '${orderIdToUpdate}' not found.` });
    }

    // Update the status (Column I, index 9) and rating (Column J, index 10)
    sheet.getRange(targetRow, 9).setValue(newStatus); // Update status
    if (rating > 0) {
        sheet.getRange(targetRow, 10).setValue(parseInt(rating)); // Update rating
    }

    SpreadsheetApp.flush(); // Ensure changes are saved
    Logger.log(`Order status updated for ${orderIdToUpdate}. Status: ${newStatus}, Rating: ${rating}`);

    return createJsonResponse({ success: true, message: `Order ${orderIdToUpdate} status updated successfully.` });

  } catch (error) {
    Logger.log('Error updating order status: ' + error + '\nStack: ' + error.stack + '\nParameters: ' + JSON.stringify(e.parameter));
    return createJsonResponse({ success: false, error: 'Failed to update order status: ' + error.message });
  }
}

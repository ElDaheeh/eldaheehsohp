// --- Configuration ---
// !!! استبدل هذا بالرابط الصحيح لـ Google Apps Script المنشور !!!
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxVb6SK2S0Wb06fyebLIcGSyArqhQcq_pCz9kIFM_oGeacdCVI2YryNTxifVaCFwjLnGQ/exec'; // Replace with your actual script URL
const LOCAL_ORDERS_KEY = 'eldaheehLocalOrders';
const PRODUCT_IMAGES_CACHE_KEY = 'eldaheehProductImagesCache'; // مفتاح تخزين الصور في localStorage

// --- Google Custom Search API Configuration (مهم جداً) ---
const GOOGLE_API_KEY = 'AIzaSyAoNagIuSSJUyfW7eHLKu-McuCDdvKxLjI'; // مفتاح API
const GOOGLE_CSE_ID = 'e386819505ae847f5'; // معرف محرك البحث المخصص (CSE ID)
const USE_GOOGLE_API = true; // تفعيل استخدام API للبحث عن الصور

// صورة افتراضية من الملف المحلي favicon.png
const DEFAULT_PRODUCT_IMAGE = 'favicon.png'; // استخدام الملف المحلي favicon.png كصورة افتراضية

// --- DOM Elements ---
const productsGrid = document.getElementById('productsGrid');
const cartIcon = document.getElementById('cartIcon');
const cartCount = document.getElementById('cartCount');
const cartModal = document.getElementById('cartModal');
const closeCartModal = document.getElementById('closeCartModal');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalElement = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutModal = document.getElementById('closeCheckoutModal');
const checkoutForm = document.getElementById('checkoutForm');
const deliveryOption = document.getElementById('deliveryOption');
const addressGroup = document.getElementById('addressGroup');
const submitOrderBtn = document.getElementById('submitOrderBtn');
const confirmationModal = document.getElementById('confirmationModal');
const closeConfirmationModal = document.getElementById('closeConfirmationModal');
const confirmedOrderId = document.getElementById('confirmedOrderId');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const downloadImageBtn = document.getElementById('downloadImageBtn');
const toast = document.getElementById('toastNotification');
const searchInput = document.getElementById('searchInput');
const categoryFiltersContainer = document.getElementById('categoryFilters');
const myOrdersIcon = document.getElementById('myOrdersIcon');
const myOrdersModal = document.getElementById('myOrdersModal');
const closeMyOrdersModal = document.getElementById('closeMyOrdersModal');
const ordersListContainer = document.getElementById('ordersList');
const confirmReceiptModal = document.getElementById('confirmReceiptModal');
const closeConfirmReceiptModal = document.getElementById('closeConfirmReceiptModal');
const confirmReceiptOrderIdElement = document.getElementById('confirmReceiptOrderId');
const ratingStarsContainer = document.getElementById('ratingStars');
const orderRatingInput = document.getElementById('orderRating');
const submitConfirmReceiptBtn = document.getElementById('submitConfirmReceiptBtn');
const phoneNumberInput = document.getElementById('phoneNumber');
const phoneErrorMsg = document.getElementById('phoneError');

// --- State Variables ---
let allProducts = []; // Store all fetched products
let cart = [];
let orderData = {}; // To store details for the current invoice
let currentCategoryFilter = 'all';
let localOrders = []; // Store orders locally
let currentRating = 0;
let orderIdToConfirm = null;
let productImageCache = {}; // لتخزين الصور التي تم البحث عنها مسبقاً

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // تحميل الصور المخزنة من localStorage
  loadImageCacheFromLocalStorage();
  
  loadCartFromLocalStorage();
  loadLocalOrders(); // Load saved orders
  fetchProducts();
  setupEventListeners();
  setMinPickupDate();
});

// --- تخزين واسترجاع الصور ---
function loadImageCacheFromLocalStorage() {
  const savedCache = localStorage.getItem(PRODUCT_IMAGES_CACHE_KEY);
  if (savedCache) {
    try {
      productImageCache = JSON.parse(savedCache);
      console.log('تم تحميل ذاكرة التخزين المؤقت للصور من localStorage');
    } catch (error) {
      console.error('خطأ في تحليل ذاكرة التخزين المؤقت للصور من localStorage:', error);
      productImageCache = {};
    }
  } else {
    productImageCache = {};
  }
}

function saveImageCacheToLocalStorage() {
  localStorage.setItem(PRODUCT_IMAGES_CACHE_KEY, JSON.stringify(productImageCache));
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  cartIcon.addEventListener('click', () => openModal(cartModal));
  closeCartModal.addEventListener('click', () => closeModal(cartModal));
  checkoutBtn.addEventListener('click', () => {
    if (cart.length > 0) {
      closeModal(cartModal);
      openModal(checkoutModal);
    }
  });
  closeCheckoutModal.addEventListener('click', () => closeModal(checkoutModal));
  deliveryOption.addEventListener('change', () => {
    addressGroup.style.display = deliveryOption.checked ? 'flex' : 'none';
    document.getElementById('address').required = deliveryOption.checked;
  });
  checkoutForm.addEventListener('submit', handleOrderSubmit);
  closeConfirmationModal.addEventListener('click', () => {
      closeModal(confirmationModal);
      resetCart(); // Reset cart after closing confirmation
  });
  downloadPdfBtn.addEventListener('click', downloadInvoiceAsPdf);
  downloadImageBtn.addEventListener('click', downloadInvoiceAsImage);

  // Search Input Listener
  searchInput.addEventListener('input', handleSearchAndFilter);

  // Category Filter Listener (using event delegation)
  categoryFiltersContainer.addEventListener('click', (event) => {
      if (event.target.classList.contains('category-filter-btn')) {
          const category = event.target.getAttribute('data-category');
          if (category !== currentCategoryFilter) {
              currentCategoryFilter = category;
              categoryFiltersContainer.querySelectorAll('.category-filter-btn').forEach(btn => btn.classList.remove('active'));
              event.target.classList.add('active');
              handleSearchAndFilter();
          }
      }
  });

  // My Orders Listeners
  myOrdersIcon.addEventListener('click', () => {
      renderLocalOrders(); // Re-render orders when opening
      openModal(myOrdersModal);
  });
  closeMyOrdersModal.addEventListener('click', () => closeModal(myOrdersModal));

  // Confirm Receipt Modal Listeners
  closeConfirmReceiptModal.addEventListener('click', () => closeModal(confirmReceiptModal));
  ratingStarsContainer.addEventListener('click', handleRatingStarClick);
  submitConfirmReceiptBtn.addEventListener('click', handleSubmitConfirmReceipt);

  // Event delegation for confirm receipt buttons in the orders list
  ordersListContainer.addEventListener('click', (event) => {
      if (event.target.classList.contains('confirm-receipt-btn')) {
          orderIdToConfirm = event.target.getAttribute('data-order-id');
          openConfirmReceiptModal(orderIdToConfirm);
      }
  });

  // Phone number validation listener
  phoneNumberInput.addEventListener('input', validatePhoneNumberInput);
}

// --- Product Handling ---
async function fetchProducts() {
  productsGrid.innerHTML = '<div class="loading-products"><i class="fas fa-spinner fa-spin"></i> جاري تحميل المنتجات...</div>';
  try {
    const response = await fetch(`${APP_SCRIPT_URL}?action=getProducts`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      allProducts = result.data;
      populateCategoryFilters();
      renderProducts(allProducts); // Initial display
    } else {
      console.error('Failed to fetch products:', result.error);
      productsGrid.innerHTML = '<div class="loading-products"><i class="fas fa-exclamation-triangle"></i> فشل في تحميل المنتجات.</div>';
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    productsGrid.innerHTML = `<div class="loading-products"><i class="fas fa-exclamation-triangle"></i> حدث خطأ أثناء تحميل المنتجات: ${error.message}</div>`;
  }
}

function populateCategoryFilters() {
    const categories = ['all', ...new Set(allProducts.map(p => p.category || 'غير مصنف'))];
    categoryFiltersContainer.innerHTML = '<span class="filter-label">التصنيف:</span>'; // Clear existing buttons except label

    categories.forEach(category => {
        const button = document.createElement('button');
        button.classList.add('category-filter-btn');
        button.setAttribute('data-category', category);
        button.textContent = category === 'all' ? 'الكل' : category;
        if (category === currentCategoryFilter) { // Use current filter state
            button.classList.add('active');
        }
        categoryFiltersContainer.appendChild(button);
    });
}

function handleSearchAndFilter() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    let filteredProducts = allProducts;

    // Filter by category
    if (currentCategoryFilter !== 'all') {
        filteredProducts = filteredProducts.filter(product => (product.category || 'غير مصنف') === currentCategoryFilter);
    }

    // Filter by search term (name)
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product =>
            product.name.toLowerCase().includes(searchTerm)
        );
    }

    renderProducts(filteredProducts);
}

// دالة البحث عن صورة للمنتج باستخدام Google Custom Search API أو صورة افتراضية
async function searchProductImage(productName, productDescription) {
  const searchTerm = `${productName} ${productDescription || ''}`;
  const cacheKey = productName; // استخدام اسم المنتج كمفتاح للكاش

  // إذا كانت الصورة موجودة في الذاكرة المؤقتة، استخدمها
  if (productImageCache[cacheKey]) {
    return productImageCache[cacheKey];
  }

  // إذا لم تكن الصورة موجودة في الذاكرة المؤقتة، ابحث عنها
  console.log(`البحث عن صورة جديدة لـ: ${productName}`);
  
  // إذا تم تكوين مفاتيح API، حاول البحث باستخدام Google Custom Search
  if (USE_GOOGLE_API) {
    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(searchTerm)}&searchType=image&num=1`;
      const response = await fetch(searchUrl);
      if (!response.ok) {
          throw new Error(`Google API error! status: ${response.status}`);
      }
      const data = await response.json();

      // التحقق من وجود نتائج
      if (data.items && data.items.length > 0 && data.items[0].link) {
        const imageUrl = data.items[0].link;
        productImageCache[cacheKey] = { url: imageUrl, isApiResult: true }; // تخزين النتيجة
        saveImageCacheToLocalStorage(); // حفظ الذاكرة المؤقتة في localStorage
        return productImageCache[cacheKey];
      } else {
        console.warn(`لم يتم العثور على صور عبر Google API لـ: ${productName}`);
        // لا تقم بتخزين الفشل في الكاش هنا، سنستخدم الصورة الافتراضية
      }
    } catch (error) {
      console.error(`خطأ في البحث عن صورة عبر Google API لـ ${productName}:`, error);
      // لا تقم بتخزين الخطأ في الكاش هنا، سنستخدم الصورة الافتراضية
    }
  }

  // إذا لم يتم استخدام API أو فشل البحث، استخدم الصورة الافتراضية (favicon.png)
  productImageCache[cacheKey] = { url: DEFAULT_PRODUCT_IMAGE, isApiResult: false }; // تخزين الصورة الافتراضية
  saveImageCacheToLocalStorage(); // حفظ الذاكرة المؤقتة في localStorage
  return productImageCache[cacheKey];
}

async function renderProducts(productsToDisplay) {
  productsGrid.innerHTML = '<div class="loading-products"><i class="fas fa-spinner fa-spin"></i> جاري تحميل المنتجات والصور...</div>';

  if (productsToDisplay.length === 0) {
    productsGrid.innerHTML = '<div class="loading-products"><i class="fas fa-info-circle"></i> لا توجد منتجات تطابق البحث أو التصنيف المحدد.</div>';
    return;
  }

  // إنشاء مصفوفة من الوعود للبحث عن صور المنتجات
  const productPromises = productsToDisplay.map(async (product) => {
    // البحث عن صورة للمنتج
    const imageResult = await searchProductImage(product.name, product.description);
    return { ...product, imageResult }; // Pass the whole result object
  });

  try {
    // انتظار اكتمال جميع عمليات البحث عن الصور
    const productsWithImages = await Promise.all(productPromises);

    // مسح شاشة التحميل
    productsGrid.innerHTML = '';

    // عرض المنتجات مع الصور
    productsWithImages.forEach(product => {
      const card = document.createElement('div');
      card.classList.add('product-card');
      const stock = product.qty || 0;
      const isOutOfStock = stock <= 0;
      const imageUrl = product.imageResult.url;
      const isApiImage = product.imageResult.isApiResult;

      // إنشاء HTML للصورة (مع رابط بحث جوجل إذا كانت صورة افتراضية)
      let imageHtml;
      const searchTerm = `${product.name} ${product.description || ''}`;
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}&tbm=isch`;

      if (!isApiImage) {
          // إنها صورة افتراضية، اجعلها رابطًا
          imageHtml = `
              <a href="${googleSearchUrl}" target="_blank" title="ابحث عن صور ${product.name} في جوجل">
                  <img src="${imageUrl}" alt="صورة ${product.name} (اضغط للبحث في جوجل)" loading="lazy" onerror="this.onerror=null; this.src='${DEFAULT_PRODUCT_IMAGE}';">
              </a>
          `;
      } else {
          // إنها صورة مباشرة من API
          imageHtml = `<img src="${imageUrl}" alt="${product.name}" loading="lazy" onerror="this.onerror=null; this.src='${DEFAULT_PRODUCT_IMAGE}';">`;
      }

      card.innerHTML = `
        <div class="product-image">
          ${imageHtml}
        </div>
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-category">${product.category || 'غير مصنف'}</div>
          <div class="product-price">${product.price.toFixed(2)} جنيه</div>
          <div class="product-stock" style="color: ${isOutOfStock ? 'var(--danger-color)' : 'var(--text-light)'};">
            المتوفر: ${stock}
          </div>
          <div class="product-description">${product.description || ''}</div>
          <div class="product-actions">
            <button class="add-to-cart-btn" data-product-name="${product.name}" ${isOutOfStock ? 'disabled' : ''}>
              <i class="fas fa-cart-plus"></i> ${isOutOfStock ? 'نفدت الكمية' : 'أضف للسلة'}
            </button>
            <div class="quantity-control">
              <button class="quantity-btn decrease-qty" data-product-name="${product.name}" ${isOutOfStock ? 'disabled' : ''}>-</button>
              <input type="number" class="quantity-input" value="1" min="1" max="${stock}" data-product-name="${product.name}" ${isOutOfStock ? 'disabled' : ''}>
              <button class="quantity-btn increase-qty" data-product-name="${product.name}" ${isOutOfStock ? 'disabled' : ''}>+</button>
            </div>
          </div>
        </div>
      `;
      productsGrid.appendChild(card);
    });

    // إضافة مستمعي الأحداث للأزرار والمدخلات الجديدة
    addCardEventListeners();
  } catch (error) {
    console.error('Error rendering products:', error);
    productsGrid.innerHTML = `<div class="loading-products"><i class="fas fa-exclamation-triangle"></i> حدث خطأ أثناء تحميل المنتجات: ${error.message}</div>`;
  }
}

function addCardEventListeners() {
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.removeEventListener('click', handleAddToCart);
        button.addEventListener('click', handleAddToCart);
    });
    document.querySelectorAll('.increase-qty').forEach(button => {
        button.removeEventListener('click', handleQuantityChange);
        button.addEventListener('click', handleQuantityChange);
    });
    document.querySelectorAll('.decrease-qty').forEach(button => {
        button.removeEventListener('click', handleQuantityChange);
        button.addEventListener('click', handleQuantityChange);
    });
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.removeEventListener('change', handleQuantityInputChange);
        input.addEventListener('change', handleQuantityInputChange);
        input.removeEventListener('input', handleQuantityInputChange); // Also check on input
        input.addEventListener('input', handleQuantityInputChange);
    });
}

function handleAddToCart(event) {
    const button = event.currentTarget;
    const productName = button.getAttribute('data-product-name');
    const product = allProducts.find(p => p.name === productName);
    const quantityInput = document.querySelector(`.quantity-input[data-product-name="${productName}"]`);
    const quantity = parseInt(quantityInput.value);
    const stock = product ? (product.qty || 0) : 0;

    if (product && quantity > 0 && stock >= quantity) {
        addToCart(product, quantity);
    } else if (product && stock < quantity) {
        showToast(`الكمية المطلوبة لـ ${product.name} غير متوفرة. المتوفر: ${stock}`, 'error');
        quantityInput.value = stock > 0 ? stock : 1; // Adjust input if possible
    } else if (!product) {
        showToast('لم يتم العثور على المنتج.', 'error');
    } else {
         showToast('الكمية غير صالحة.', 'error');
         quantityInput.value = 1;
    }
}

function handleQuantityChange(event) {
    const button = event.currentTarget;
    const productName = button.getAttribute('data-product-name');
    const input = document.querySelector(`.quantity-input[data-product-name="${productName}"]`);
    const product = allProducts.find(p => p.name === productName);
    const stock = product ? (product.qty || 0) : 0;
    let currentValue = parseInt(input.value);

    if (isNaN(currentValue)) currentValue = 1;

    if (button.classList.contains('increase-qty')) {
        if (currentValue < stock) {
            input.value = currentValue + 1;
        }
    } else if (button.classList.contains('decrease-qty')) {
        if (currentValue > 1) {
            input.value = currentValue - 1;
        }
    }
}

function handleQuantityInputChange(event) {
    const input = event.currentTarget;
    const productName = input.getAttribute('data-product-name');
    const product = allProducts.find(p => p.name === productName);
    const stock = product ? (product.qty || 0) : 0;
    let value = parseInt(input.value);

    if (isNaN(value) || value < 1) {
        input.value = 1;
    } else if (value > stock) {
        input.value = stock;
        if (stock > 0) {
            showToast(`الكمية القصوى المتوفرة لـ ${product.name} هي ${stock}`, 'error');
        }
    }
}

// --- Cart Handling ---
function addToCart(product, quantity) {
  const existingItem = cart.find(item => item.name === product.name);
  const stock = product.qty || 0;

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity <= stock) {
        existingItem.quantity = newQuantity;
        showToast(`تم تحديث كمية ${product.name} في السلة.`, 'success');
    } else {
        showToast(`لا يمكن إضافة المزيد من ${product.name}. الكمية المتوفرة ${stock}.`, 'error');
        return; // Do not proceed if quantity exceeds stock
    }
  } else {
    if (quantity <= stock) {
        cart.push({ ...product, quantity: quantity });
        showToast(`تمت إضافة ${product.name} إلى السلة.`, 'success');
    } else {
         showToast(`الكمية المطلوبة لـ ${product.name} غير متوفرة. المتوفر: ${stock}`, 'error');
         return; // Do not add if initial quantity exceeds stock
    }
  }
  updateCartDisplay();
  saveCartToLocalStorage();
}

function updateCartDisplay() {
  cartItemsContainer.innerHTML = ''; // Clear existing items
  let total = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<div class="empty-cart-message">
        <i class="fas fa-shopping-basket"></i>
        سلة المشتريات فارغة.
    </div>`;
    checkoutBtn.disabled = true;
  } else {
    cart.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.classList.add('cart-item');
      const itemTotal = item.price * item.quantity;
      total += itemTotal;

      itemElement.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${item.price.toFixed(2)} جنيه</div>
        </div>
        <div class="cart-item-quantity">
          <button class="quantity-btn decrease-cart-qty" data-product-name="${item.name}">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn increase-cart-qty" data-product-name="${item.name}">+</button>
        </div>
        <div class="cart-item-total">${itemTotal.toFixed(2)} جنيه</div>
        <button class="remove-item" data-product-name="${item.name}">
          <i class="fas fa-trash-alt"></i>
        </button>
      `;
      cartItemsContainer.appendChild(itemElement);
    });

    // Add event listeners for cart item buttons
    document.querySelectorAll('.decrease-cart-qty').forEach(button => {
      button.addEventListener('click', decreaseCartQuantity);
    });
    document.querySelectorAll('.increase-cart-qty').forEach(button => {
      button.addEventListener('click', increaseCartQuantity);
    });
    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', removeFromCart);
    });

    checkoutBtn.disabled = false;
  }

  cartTotalElement.textContent = `${total.toFixed(2)} جنيه`;
  cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

function decreaseCartQuantity(event) {
  const productName = event.currentTarget.getAttribute('data-product-name');
  const item = cart.find(item => item.name === productName);
  if (item && item.quantity > 1) {
    item.quantity--;
    updateCartDisplay();
    saveCartToLocalStorage();
  }
}

function increaseCartQuantity(event) {
  const productName = event.currentTarget.getAttribute('data-product-name');
  const item = cart.find(item => item.name === productName);
  const product = allProducts.find(p => p.name === productName);
  const stock = product ? (product.qty || 0) : 0;

  if (item && item.quantity < stock) {
    item.quantity++;
    updateCartDisplay();
    saveCartToLocalStorage();
  } else if (item) {
    showToast(`لا يمكن إضافة المزيد من ${item.name}. الكمية المتوفرة ${stock}.`, 'error');
  }
}

function removeFromCart(event) {
  const productName = event.currentTarget.getAttribute('data-product-name');
  cart = cart.filter(item => item.name !== productName);
  updateCartDisplay();
  saveCartToLocalStorage();
  showToast(`تمت إزالة ${productName} من السلة.`, 'info');
}

function saveCartToLocalStorage() {
  localStorage.setItem('eldaheehCart', JSON.stringify(cart));
}

function loadCartFromLocalStorage() {
  const savedCart = localStorage.getItem('eldaheehCart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
      updateCartDisplay();
    } catch (error) {
      console.error('Error parsing cart from localStorage:', error);
      cart = [];
    }
  }
}

function resetCart() {
  cart = [];
  updateCartDisplay();
  saveCartToLocalStorage();
}

// --- Modal Handling ---
function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = ''; // Restore scrolling
}

// --- Checkout Handling ---
function setMinPickupDate() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateInput = document.getElementById('pickupDate');
  const formattedDate = tomorrow.toISOString().split('T')[0];
  dateInput.min = formattedDate;
  dateInput.value = formattedDate;
}

function validatePhoneNumberInput() {
    const phoneNumber = phoneNumberInput.value.trim();
    const isValid = /^01[0125][0-9]{8}$/.test(phoneNumber);

    if (phoneNumber && !isValid) {
        phoneNumberInput.classList.add('invalid');
        phoneErrorMsg.style.display = 'block';
    } else {
        phoneNumberInput.classList.remove('invalid');
        phoneErrorMsg.style.display = 'none';
    }
}

async function handleOrderSubmit(event) {
  event.preventDefault();

  // Validate phone number
  const phoneNumber = phoneNumberInput.value.trim();
  const isValidPhone = /^01[0125][0-9]{8}$/.test(phoneNumber);
  if (!isValidPhone) {
      phoneNumberInput.classList.add('invalid');
      phoneErrorMsg.style.display = 'block';
      return;
  }

  // Show loading state
  submitOrderBtn.disabled = true;
  submitOrderBtn.querySelector('.spinner').style.display = 'inline-block';

  try {
    // Get next order ID
    const orderIdResponse = await fetch(`${APP_SCRIPT_URL}?action=getNextOrderId`);
    if (!orderIdResponse.ok) {
        throw new Error(`HTTP error! status: ${orderIdResponse.status}`);
    }
    const orderIdResult = await orderIdResponse.json();

    if (!orderIdResult.success) {
        throw new Error(orderIdResult.error || 'Failed to get order ID');
    }

    const orderId = orderIdResult.orderId;
    const customerName = document.getElementById('customerName').value;
    const address = deliveryOption.checked ? document.getElementById('address').value : 'استلام من المكتبة';
    const pickupDate = document.getElementById('pickupDate').value;
    const pickupTime = document.getElementById('pickupTime').value;
    const pickupDateTime = `${pickupDate} ${pickupTime}`;
    const orderDate = new Date().toISOString().split('T')[0];
    const totalAmount = parseFloat(cartTotalElement.textContent);

    // Prepare order details
    const orderDetails = JSON.stringify(cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity
    })));

    // Submit order to server
    const submitResponse = await fetch(`${APP_SCRIPT_URL}?action=submitOrder&orderId=${encodeURIComponent(orderId)}&orderDate=${encodeURIComponent(orderDate)}&customerName=${encodeURIComponent(customerName)}&phoneNumber=${encodeURIComponent(phoneNumber)}&address=${encodeURIComponent(address)}&pickupTime=${encodeURIComponent(pickupDateTime)}&totalAmount=${encodeURIComponent(totalAmount)}&orderDetails=${encodeURIComponent(orderDetails)}`);

    if (!submitResponse.ok) {
        throw new Error(`HTTP error! status: ${submitResponse.status}`);
    }

    const submitResult = await submitResponse.json();

    if (!submitResult.success) {
        throw new Error(submitResult.error || 'Failed to submit order');
    }

    // Store order data for invoice
    orderData = {
        orderId,
        orderDate,
        customerName,
        phoneNumber,
        address,
        pickupTime: pickupDateTime,
        totalAmount,
        items: cart.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
        }))
    };

    // Save order locally
    saveOrderLocally(orderData);

    // Show confirmation
    closeModal(checkoutModal);
    confirmedOrderId.textContent = orderId;
    prepareInvoice(orderData);
    openModal(confirmationModal);

  } catch (error) {
    console.error('Error submitting order:', error);
    showToast(`حدث خطأ أثناء إرسال الطلب: ${error.message}`, 'error');
  } finally {
    // Reset loading state
    submitOrderBtn.disabled = false;
    submitOrderBtn.querySelector('.spinner').style.display = 'none';
  }
}

// --- Local Orders Handling ---
function saveOrderLocally(order) {
    localOrders.push({
        ...order,
        status: 'جديد',
        rating: 0
    });
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));
}

function loadLocalOrders() {
    const savedOrders = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (savedOrders) {
        try {
            localOrders = JSON.parse(savedOrders);
        } catch (error) {
            console.error('Error parsing local orders:', error);
            localOrders = [];
        }
    }
}

function renderLocalOrders() {
    if (localOrders.length === 0) {
        ordersListContainer.innerHTML = '<div class="empty-orders-message">لا توجد طلبات سابقة.</div>';
        return;
    }

    ordersListContainer.innerHTML = '';

    // Sort orders by date (newest first)
    const sortedOrders = [...localOrders].sort((a, b) => {
        return new Date(b.orderDate) - new Date(a.orderDate);
    });

    sortedOrders.forEach(order => {
        const orderElement = document.createElement('div');
        orderElement.classList.add('order-item');

        let statusClass = '';
        switch(order.status) {
            case 'جديد': statusClass = 'new'; break;
            case 'قيد التجهيز': statusClass = 'processing'; break;
            case 'تم التسليم': statusClass = 'completed'; break;
            case 'ملغي': statusClass = 'cancelled'; break;
            default: statusClass = 'new';
        }

        const canConfirmReceipt = order.status !== 'تم التسليم' && order.status !== 'ملغي';

        orderElement.innerHTML = `
            <div class="order-item-details">
                <p class="order-item-id">رقم الطلب: ${order.orderId}</p>
                <p class="order-item-date">تاريخ الطلب: ${order.orderDate}</p>
                <p class="order-item-total">الإجمالي: ${order.totalAmount.toFixed(2)} جنيه</p>
                <p>الحالة: <span class="order-item-status ${statusClass}">${order.status}</span></p>
                ${order.rating > 0 ? `<p>التقييم: ${'★'.repeat(order.rating)}${'☆'.repeat(5-order.rating)}</p>` : ''}
            </div>
            <div class="order-item-actions">
                <button class="order-action-btn view-order-btn" data-order-id="${order.orderId}">
                    <i class="fas fa-eye"></i> عرض التفاصيل
                </button>
                ${canConfirmReceipt ? `
                <button class="order-action-btn confirm-receipt-btn" data-order-id="${order.orderId}">
                    <i class="fas fa-check-circle"></i> تأكيد الاستلام
                </button>
                ` : ''}
            </div>
        `;

        ordersListContainer.appendChild(orderElement);
    });

    // Add event listeners for view order buttons
    document.querySelectorAll('.view-order-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const orderId = event.currentTarget.getAttribute('data-order-id');
            const order = localOrders.find(o => o.orderId === orderId);
            if (order) {
                orderData = order;
                prepareInvoice(order);
                closeModal(myOrdersModal);
                openModal(confirmationModal);
            }
        });
    });
}

function openConfirmReceiptModal(orderId) {
    confirmReceiptOrderIdElement.textContent = orderId;

    // Reset rating stars
    currentRating = 0;
    orderRatingInput.value = 0;
    ratingStarsContainer.querySelectorAll('span').forEach(star => {
        star.classList.remove('active');
    });

    openModal(confirmReceiptModal);
}

function handleRatingStarClick(event) {
    if (event.target.tagName === 'SPAN') {
        const value = parseInt(event.target.getAttribute('data-value'));
        currentRating = value;
        orderRatingInput.value = value;

        // Update star display
        ratingStarsContainer.querySelectorAll('span').forEach(star => {
            const starValue = parseInt(star.getAttribute('data-value'));
            if (starValue <= value) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
}

async function handleSubmitConfirmReceipt() {
    if (!orderIdToConfirm) return;

    // Show loading state
    submitConfirmReceiptBtn.disabled = true;
    submitConfirmReceiptBtn.querySelector('.spinner').style.display = 'inline-block';

    try {
        // Update order status on server
        const response = await fetch(`${APP_SCRIPT_URL}?action=updateOrderStatus&orderId=${encodeURIComponent(orderIdToConfirm)}&status=تم التسليم&rating=${currentRating}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to update order status');
        }

        // Update local order
        const orderIndex = localOrders.findIndex(o => o.orderId === orderIdToConfirm);
        if (orderIndex !== -1) {
            localOrders[orderIndex].status = 'تم التسليم';
            localOrders[orderIndex].rating = currentRating;
            localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));
        }

        closeModal(confirmReceiptModal);
        renderLocalOrders();
        showToast('تم تأكيد استلام الطلب بنجاح!', 'success');

    } catch (error) {
        console.error('Error confirming receipt:', error);
        showToast(`حدث خطأ أثناء تأكيد الاستلام: ${error.message}`, 'error');
    } finally {
        // Reset loading state
        submitConfirmReceiptBtn.disabled = false;
        submitConfirmReceiptBtn.querySelector('.spinner').style.display = 'none';
        orderIdToConfirm = null;
    }
}

// --- Invoice Handling ---
function prepareInvoice(order) {
    document.getElementById('invoiceDate').textContent = order.orderDate;
    document.getElementById('invoiceOrderId').textContent = order.orderId;
    document.getElementById('invoiceCustomerName').textContent = order.customerName;
    document.getElementById('invoicePhoneNumber').textContent = order.phoneNumber;
    document.getElementById('invoiceAddress').textContent = order.address;
    document.getElementById('invoicePickupTime').textContent = order.pickupTime;

    const invoiceItemsContainer = document.getElementById('invoiceItems');
    invoiceItemsContainer.innerHTML = '';

    order.items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.price.toFixed(2)} جنيه</td>
            <td>${item.quantity}</td>
            <td>${item.total.toFixed(2)} جنيه</td>
        `;
        invoiceItemsContainer.appendChild(row);
    });

    document.getElementById('invoiceTotalAmount').textContent = order.totalAmount.toFixed(2);
}

function downloadInvoiceAsPdf() {
    const { jsPDF } = window.jspdf;
    const invoiceElement = document.getElementById('invoiceTemplate');

    // Make invoice visible for html2canvas
    const originalDisplay = invoiceElement.style.display;
    invoiceElement.style.display = 'block';

    html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        logging: false
    }).then(canvas => {
        // Hide invoice again
        invoiceElement.style.display = originalDisplay;

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`فاتورة_${orderData.orderId}.pdf`);

        showToast('تم تحميل الفاتورة بصيغة PDF بنجاح!', 'success');
    }).catch(error => {
        console.error('Error generating PDF:', error);
        showToast('حدث خطأ أثناء إنشاء ملف PDF', 'error');
        invoiceElement.style.display = originalDisplay;
    });
}

function downloadInvoiceAsImage() {
    const invoiceElement = document.getElementById('invoiceTemplate');

    // Make invoice visible for html2canvas
    const originalDisplay = invoiceElement.style.display;
    invoiceElement.style.display = 'block';

    html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        logging: false
    }).then(canvas => {
        // Hide invoice again
        invoiceElement.style.display = originalDisplay;

        // Convert canvas to blob
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `فاتورة_${orderData.orderId}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('تم تحميل الفاتورة كصورة بنجاح!', 'success');
        }, 'image/png');
    }).catch(error => {
        console.error('Error generating image:', error);
        showToast('حدث خطأ أثناء إنشاء الصورة', 'error');
        invoiceElement.style.display = originalDisplay;
    });
}

// --- Toast Notification ---
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

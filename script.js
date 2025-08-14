// ====== CONFIG ======
const STORAGE_KEY = 'products';
const ORDERS_KEY  = 'orders';
const DELIVERY_FEE = 60;

// Add your payment numbers here (can be empty now; editable later)
const BKASH_NUMBER = '01XXXXXXXXX'; // set later
const COD_NUMBER   = '01YYYYYYYYY'; // set later

// Google Apps Script endpoint (orders are POSTed here)
const GOOGLE_ORDERS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVfF0sMeOJ8rmTKGYqc67Lsv-n5Se17T1zLhsMcUvhhzCZJ7opdKstoInb63lPBx17Dw/exec";

// ====== UTIL / STORAGE ======
function newId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
}
function loadProducts() {
  let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  let changed = false;
  list = list.map(p => {
    if (!p.id) { p.id = newId(); changed = true; }
    return p;
  });
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}
function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}
function loadOrders() {
  return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
}
function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

// ====== PRODUCT PAGE ======
function displayProducts() {
  const sections = {
    new: document.getElementById('new-products'),
    hot: document.getElementById('hot-deals'),
    all: document.getElementById('all-products'),
  };
  const products = loadProducts();

  Object.values(sections).forEach(el => { if (el) el.innerHTML = ''; });

  products.forEach(p => {
    if (sections.new && p.category === 'new') sections.new.appendChild(createProductCard(p));
    if (sections.hot && p.category === 'hot') sections.hot.appendChild(createProductCard(p));
    if (sections.all) sections.all.appendChild(createProductCard(p));
  });

  // Checkout modal bindings (on product page)
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    document.getElementById('close-modal-btn').onclick = closeCheckoutModal;
    const form = document.getElementById('checkout-form');
    form.addEventListener('submit', submitCheckoutOrder);
    document.getElementById('co-payment').addEventListener('change', handlePaymentChange);
    document.getElementById('co-qty').addEventListener('input', updateTotalInModal);
    document.getElementById('co-address').addEventListener('input', updateDeliveryCharge);
  }
}

function createProductCard(p) {
  const isOOS = Number(p.stock) <= 0;
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price * (1 - Number(p.discount)/100)) : price;

  const card = document.createElement('div');
  card.className = 'card product-card';

  card.innerHTML = `
    <img src="${p.image}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
    <div class="badges">
      ${p.category === 'new' ? `<span class="badge new">NEW</span>` : ``}
      ${p.category === 'hot' ? `<span class="badge hot">HOT</span>` : ``}
      ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ``}
    </div>
    <h3>${p.name}</h3>
    <div class="muted">Color: ${p.color || '-'}</div>
    <div class="price">
      ${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ``}
      ৳${finalPrice.toFixed(2)} ${hasDiscount ? `(-${p.discount}%)` : ``}
    </div>
    <p class="desc">${p.description || ''}</p>
    <div class="order-row">
      <button ${isOOS ? 'disabled' : ''} data-id="${p.id}" class="order-btn">Order</button>
    </div>
  `;

  card.querySelector('.order-btn').addEventListener('click', (e) => {
    const id = e.currentTarget.getAttribute('data-id');
    openCheckoutModal(id);
  });

  return card;
}

// ====== DELIVERY CHARGE LOGIC ======
function calculateDeliveryFee(address) {
  const lowerAddr = address.toLowerCase();
  if (lowerAddr.includes("savar")) {
    return 70;
  } else if (lowerAddr.includes("dhaka")) {
    return 100;
  }
  return 140;
}

function updateDeliveryCharge() {
  const address = document.getElementById('co-address').value.trim();
  const deliveryFee = calculateDeliveryFee(address);
  document.getElementById('co-delivery').value = `Delivery Charge = ${deliveryFee}`;
  document.getElementById('co-delivery').dataset.fee = deliveryFee; // store raw fee
  updateTotalInModal();
}

// ====== CHECKOUT MODAL FLOW ======
function openCheckoutModal(productId) {
  const p = loadProducts().find(x => x.id === productId);
  if (!p) return;

  const price = Number(p.price) || 0;
  const unit = Number(p.discount) > 0 ? price * (1 - Number(p.discount)/100) : price;

  // Fill modal fields
  document.getElementById('co-product-id').value = p.id;
  document.getElementById('co-product-name').value = p.name;
  document.getElementById('co-color').value = p.color || '';
  document.getElementById('co-price').value = unit.toFixed(2);
  document.getElementById('co-unit-price-raw').value = unit.toString();
  document.getElementById('co-available-stock').value = String(p.stock);
  document.getElementById('co-qty').value = 1; // always start at 1
  document.getElementById('co-payment').value = '';
  document.getElementById('co-payment-number').value = '';
  document.getElementById('co-txn').value = '';
  document.getElementById('co-name').value = '';
  document.getElementById('co-phone').value = '';
  document.getElementById('co-email').value = '';
  document.getElementById('co-address').value = '';
  document.getElementById('co-note').textContent = '';

  // Default delivery fee
  document.getElementById('co-delivery').value = `Delivery Charge = ${DELIVERY_FEE}`;
  document.getElementById('co-delivery').dataset.fee = DELIVERY_FEE;

  updateTotalInModal();

  const modal = document.getElementById('checkout-modal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}
function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}
function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value || 1);
  const unit = Number(document.getElementById('co-unit-price-raw').value || 0);
  const deliveryFee = Number(document.getElementById('co-delivery').dataset.fee || DELIVERY_FEE);
  const total = unit * qty + deliveryFee;
  document.getElementById('co-total').value = total.toFixed(2);
}
function handlePaymentChange() {
  const method = document.getElementById('co-payment').value;
  const payNumInput = document.getElementById('co-payment-number');
  const note = document.getElementById('co-note');

  if (method === 'Bkash') {
    payNumInput.value = BKASH_NUMBER || '(Bkash number: add later)';
    note.textContent = 'Please pay full amount to the Bkash number above and enter the Transaction ID.';
  } else if (method === 'COD') {
    payNumInput.value = COD_NUMBER || '(COD contact number: add later)';
    note.textContent = 'Cash on Delivery. Provide order confirmation (Delivery charge) Transaction ID/reference.';
  } else {
    payNumInput.value = '';
    note.textContent = '';
  }
}

// Validate simple email & phone
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v){ return /^[0-9+\-\s]{6,}$/.test(v); }

// Submit checkout: validate -> POST to Google -> save locally -> reduce stock
async function submitCheckoutOrder(e) {
  e.preventDefault();

  const id = document.getElementById('co-product-id').value;
  const name = document.getElementById('co-product-name').value.trim();
  const color = document.getElementById('co-color').value.trim();
  const unit = Number(document.getElementById('co-unit-price-raw').value || 0);
  const qty = Number(document.getElementById('co-qty').value || 0);
  const stockAvail = Number(document.getElementById('co-available-stock').value || 0);
  const delivery = Number(document.getElementById('co-delivery').dataset.fee || DELIVERY_FEE);
  const total = unit * qty + delivery;

  const custName = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const email = document.getElementById('co-email').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const payment = document.getElementById('co-payment').value;
  const payNumber = document.getElementById('co-payment-number').value.trim();
  const txn = document.getElementById('co-txn').value.trim();

  // Validation: all required & stock
  if (!id || !name || !color || !unit || !qty) { alert('Missing product info.'); return; }
  if (qty < 1) { alert('Quantity must be at least 1.'); return; }
  if (qty > stockAvail) { alert(`Only ${stockAvail} in stock.`); return; }

  if (!custName || !phone || !email || !address) { alert('Please fill Name, Phone, Email, and Address.'); return; }
  if (!validPhone(phone)) { alert('Please enter a valid phone number.'); return; }
  if (!validEmail(email)) { alert('Please enter a valid email.'); return; }
  if (!payment) { alert('Select a payment method.'); return; }
  if (!txn) { alert('Transaction ID is required.'); return; }

  const order = {
    timeISO: new Date().toISOString(),
    productId: id,
    productName: name,
    color,
    unitPrice: Number(unit.toFixed(2)),
    quantity: qty,
    deliveryFee: delivery,
    total: Number(total.toFixed(2)),
    customerName: custName,
    phone,
    email,
    address,
    paymentMethod: payment,
    paymentNumber: payNumber,
    transactionId: txn
  };

  // Send to Google Sheet
  try {
    const res = await fetch(GOOGLE_ORDERS_SCRIPT_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action: 'order', order })
    });
    const data = await res.json().catch(()=>({status:'unknown'}));
    console.log('Google Sheets response:', data);
  } catch (err) {
    console.error('Google Sheets error:', err);
  }

  // Save order locally
  const orders = loadOrders();
  orders.push(order);
  saveOrders(orders);

  // Reduce stock
  const products = loadProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx > -1) {
    products[idx].stock = Math.max(0, Number(products[idx].stock) - qty);
    saveProducts(products);
  }

  // Notify other tabs and refresh UI
  window.dispatchEvent(new StorageEvent('storage', {key: STORAGE_KEY}));
  window.dispatchEvent(new StorageEvent('storage', {key: ORDERS_KEY}));

  closeCheckoutModal();
  alert('Your order was placed successfully!');
  if (document.getElementById('new-products')) displayProducts();
}

// ====== ADMIN: PRODUCTS (inline editable) ======
function addProduct(e) {
  e.preventDefault();

  const product = {
    id: newId(),
    name: document.getElementById('product-name').value.trim(),
    price: Number(document.getElementById('product-price').value || 0),
    image: document.getElementById('product-image').value.trim(),
    category: document.getElementById('product-category').value,
    color: document.getElementById('product-color').value.trim(),
    discount: Number(document.getElementById('product-discount').value || 0),
    stock: Number(document.getElementById('product-stock').value || 0),
    description: document.getElementById('product-description').value.trim(),
  };

  const products = loadProducts();
  products.push(product);
  saveProducts(products);

  e.target.reset();
  renderDataTable();
  alert('Product saved!');
}

function renderDataTable() {
  const tbody = document.getElementById('data-body');
  if (!tbody) return;
  const products = loadProducts();
  tbody.innerHTML = '';

  products.forEach(p => {
    const tr = document.createElement('tr');

    const cols = [
      { key: 'name',        type: 'text' },
      { key: 'price',       type: 'number' },
      { key: 'image',       type: 'text' },
      { key: 'category',    type: 'text' }, // new/hot/all
      { key: 'color',       type: 'text' },
      { key: 'discount',    type: 'number' },
      { key: 'stock',       type: 'number' },
      { key: 'description', type: 'text' },
    ];

    cols.forEach(col => {
      const td = document.createElement('td');
      td.contentEditable = true;
      td.dataset.id = p.id;
      td.dataset.field = col.key;
      td.textContent = p[col.key] ?? '';

      td.addEventListener('blur', () => {
        let val = td.textContent.trim();
        if (col.type === 'number') {
          const n = Number(val);
          if (Number.isNaN(n)) { td.textContent = p[col.key] ?? 0; return; }
          val = n;
        }
        if (col.key === 'category') {
          const allowed = ['new','hot','all'];
          if (!allowed.includes(val)) {
            alert('Category must be one of: new, hot, all');
            td.textContent = p.category;
            return;
          }
        }
        updateProductField(p.id, col.key, val);
        if (col.key === 'stock') {
          const cur = loadProducts().find(x => x.id === p.id);
          tr.querySelector('td[data-status="1"]').textContent = computeStatus(cur);
        }
      });

      tr.appendChild(td);
    });

    const tdStatus = document.createElement('td');
    tdStatus.dataset.status = '1';
    tdStatus.textContent = computeStatus(p);
    tr.appendChild(tdStatus);

    const tdActions = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (confirm(`Delete "${p.name}"?`)) deleteProductById(p.id);
    });
    tdActions.appendChild(del);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function computeStatus(p) { return Number(p.stock) > 0 ? 'In Stock' : 'Out of Stock'; }

function updateProductField(id, field, value) {
  const products = loadProducts();
  const idx = products.findIndex(x => x.id === id);
  if (idx === -1) return;
  if (['price','discount','stock'].includes(field)) value = Number(value) || 0;
  products[idx][field] = value;
  saveProducts(products);
}

function deleteProductById(id) {
  const products = loadProducts().filter(p => p.id !== id);
  saveProducts(products);
  renderDataTable();
}

// ====== ADMIN: ORDERS TABLE ======
function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  const orders = loadOrders();
  tbody.innerHTML = '';

  orders.forEach(o => {
    const tr = document.createElement('tr');
    const tds = [
      new Date(o.timeISO).toLocaleString(),
      o.productName,
      o.color,
      '৳' + Number(o.unitPrice).toFixed(2),
      o.quantity,
      '৳' + Number(o.deliveryFee).toFixed(2),
      '৳' + Number(o.total).toFixed(2),
      o.customerName,
      o.phone,
      o.email,
      o.address,
      o.paymentMethod,
      o.paymentNumber,
      o.transactionId
    ];
    tds.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ====== AUTH ======
function logoutAdmin() {
  localStorage.removeItem('isAdminLoggedIn');
  location.reload();
}

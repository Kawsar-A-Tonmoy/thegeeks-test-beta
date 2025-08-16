// ====== CONFIG ======
const PRODUCTS_COLLECTION = 'products';
const ORDERS_COLLECTION = 'orders';
const DELIVERY_FEE = 60;

// Add your payment numbers here (can be empty now; editable later)
const BKASH_NUMBER = '01XXXXXXXXX'; // set later
const COD_NUMBER   = '01YYYYYYYYY'; // set later

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBYzuaMcH_fH43e9qgdntIH7ez29wVpzaU",
  authDomain: "thegeeks-1b8aa.firebaseapp.com",
  projectId: "thegeeks-1b8aa",
  storageBucket: "thegeeks-1b8aa.firebasestorage.app",
  messagingSenderId: "662440200085",
  appId: "1:662440200085:web:f6d8ecfdc1f4b6d23a189c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ====== UTIL / STORAGE ======
function newId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
}

async function loadProducts() {
  try {
    const querySnapshot = await db.collection(PRODUCTS_COLLECTION).get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

async function saveProduct(product) {
  try {
    if (product.id) {
      await db.collection(PRODUCTS_COLLECTION).doc(product.id).set(product);
    } else {
      const docRef = await db.collection(PRODUCTS_COLLECTION).add(product);
      product.id = docRef.id;
    }
  } catch (error) {
    console.error('Error saving product:', error);
    alert('Unauthorized or error saving product.');
  }
}

async function updateProductField(id, field, value) {
  try {
    const updateObj = { [field]: value };
    await db.collection(PRODUCTS_COLLECTION).doc(id).update(updateObj);
  } catch (error) {
    console.error('Error updating product:', error);
    alert('Unauthorized or error updating product.');
  }
}

async function deleteProductById(id) {
  try {
    await db.collection(PRODUCTS_COLLECTION).doc(id).delete();
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('Unauthorized or error deleting product.');
  }
}

async function loadOrders() {
  try {
    const querySnapshot = await db.collection(ORDERS_COLLECTION).get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading orders:', error);
    alert('Unauthorized or error loading orders.');
    return [];
  }
}

async function saveOrder(order) {
  try {
    await db.collection(ORDERS_COLLECTION).add(order);
  } catch (error) {
    console.error('Error saving order:', error);
    alert('Error placing order.');
  }
}

// ====== PRODUCT PAGE ======
async function displayProducts() {
  const sections = {
    new: document.getElementById('new-products'),
    hot: document.getElementById('hot-deals'),
    all: document.getElementById('all-products'),
  };
  const products = await loadProducts();

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
  document.getElementById('co-delivery').dataset.fee = deliveryFee;
  updateTotalInModal();
}

function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value) || 1;
  const unitPrice = Number(document.getElementById('co-unit').value) || 0;
  const deliveryFee = Number(document.getElementById('co-delivery').dataset.fee) || 0;
  const total = (qty * unitPrice) + deliveryFee;
  document.getElementById('co-total').value = `Total = ${total.toFixed(2)}`;
}

function handlePaymentChange(e) {
  const payment = e.target.value;
  const payNumberField = document.getElementById('co-pay-number');
  payNumberField.value = payment === 'Bkash' ? BKASH_NUMBER : COD_NUMBER;
}

// ====== CHECKOUT MODAL FLOW ======
async function openCheckoutModal(productId) {
  const products = await loadProducts();
  const p = products.find(x => x.id === productId);
  if (!p) return;

  const price = Number(p.price) || 0;
  const unit = Number(p.discount) > 0 ? price * (1 - Number(p.discount)/100) : price;

  document.getElementById('co-product').value = p.name;
  document.getElementById('co-color').value = p.color || '-';
  document.getElementById('co-unit').value = unit.toFixed(2);
  document.getElementById('co-qty').value = 1;
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
  document.getElementById('checkout-form').reset();
}

async function submitCheckoutOrder(e) {
  e.preventDefault();
  const id = document.getElementById('co-product').dataset.id;
  const name = document.getElementById('co-product').value;
  const color = document.getElementById('co-color').value;
  const unit = Number(document.getElementById('co-unit').value);
  const qty = Number(document.getElementById('co-qty').value);
  const delivery = Number(document.getElementById('co-delivery').dataset.fee);
  const total = Number(document.getElementById('co-total').value.replace('Total = ', ''));
  const custName = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const email = document.getElementById('co-email').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const payment = document.getElementById('co-payment').value;
  const payNumber = document.getElementById('co-pay-number').value.trim();
  const txn = document.getElementById('co-txn').value.trim();

  if (!custName || !phone || !address) {
    alert('Please fill in all required fields (Name, Phone, Address).');
    return;
  }

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

  try {
    await db.runTransaction(async (transaction) => {
      const productRef = db.collection(PRODUCTS_COLLECTION).doc(id);
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists) throw 'Product not found';

      const currentStock = productDoc.data().stock || 0;
      if (currentStock < qty) throw 'Insufficient stock';

      transaction.update(productRef, { stock: currentStock - qty });
      const orderRef = db.collection(ORDERS_COLLECTION).doc();
      transaction.set(orderRef, order);
    });

    closeCheckoutModal();
    alert('Your order was placed successfully!');
    if (document.getElementById('new-products')) await displayProducts();
  } catch (error) {
    console.error('Transaction failed:', error);
    alert('Error placing order: ' + error);
  }
}

// ====== ADMIN: PRODUCTS (inline editable) ======
async function addProduct(e) {
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

  await saveProduct(product);

  e.target.reset();
  await renderDataTable();
  alert('Product saved!');
}

async function renderDataTable() {
  const tbody = document.getElementById('data-body');
  if (!tbody) return;
  const products = await loadProducts();
  tbody.innerHTML = '';

  products.forEach(p => {
    const tr = document.createElement('tr');

    const cols = [
      { key: 'name',        type: 'text' },
      { key: 'price',       type: 'number' },
      { key: 'image',       type: 'text' },
      { key: 'category',    type: 'text' },
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

      td.addEventListener('blur', async () => {
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
        await updateProductField(p.id, col.key, val);
        if (col.key === 'stock') {
          const cur = (await loadProducts()).find(x => x.id === p.id);
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
    del.addEventListener('click', async () => {
      if (confirm(`Delete "${p.name}"?`)) {
        await deleteProductById(p.id);
        await renderDataTable();
      }
    });
    tdActions.appendChild(del);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function computeStatus(p) { return Number(p.stock) > 0 ? 'In Stock' : 'Out of Stock'; }

// ====== ADMIN: ORDERS TABLE ======
async function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  const orders = await loadOrders();
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
function loginAdmin(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-password').value;
  console.log('Attempting login with:', email); // Debug: Log email
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      console.log('Logged in successfully! User UID:', userCredential.user.uid); // Debug: Log UID
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('admin-panel').style.display = 'block';
      renderDataTable();
      renderOrdersTable();
    })
    .catch(error => {
      console.error('Login error:', error.code, error.message); // Debug: Log error details
      alert('Login failed: ' + error.message);
    });
}

function logoutAdmin() {
  auth.signOut().then(() => {
    location.reload();
  });
}

// On page load, check auth state (for admin panel)
auth.onAuthStateChanged(user => {
  if (user) {
    console.log('Auth state changed - Current User UID:', user.uid); // Debug: Log UID
    if (document.getElementById('admin-panel')) {
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('admin-panel').style.display = 'block';
      renderDataTable();
      renderOrdersTable();
    }
  } else {
    console.log('No user logged in'); // Debug: Log no user
    if (document.getElementById('admin-panel')) {
      document.getElementById('login-section').style.display = 'block';
      document.getElementById('admin-panel').style.display = 'none';
    }
  }
});

// Bind login form and logout button
document.getElementById('admin-login-form').addEventListener('submit', loginAdmin);
document.getElementById('logout-btn').addEventListener('click', logoutAdmin);

// Bind add product form
document.getElementById('add-product-form').addEventListener('submit', addProduct);

// Initial loads
if (document.getElementById('new-products')) displayProducts();
if (document.getElementById('data-body')) renderDataTable();
if (document.getElementById('orders-body')) renderOrdersTable();

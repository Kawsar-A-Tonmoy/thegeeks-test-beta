from flask import Flask, jsonify, request, abort
from flask_cors import CORS
import json
import os
import time
import random
import string

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from frontend

PRODUCTS_FILE = 'products.json'
ORDERS_FILE = 'orders.json'

def generate_id():
    return 'p_' + str(int(time.time() * 1000)) + '_' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))

def load_data(file):
    if os.path.exists(file):
        with open(file, 'r') as f:
            return json.load(f)
    return []

def save_data(file, data):
    with open(file, 'w') as f:
        json.dump(data, f, indent=4)

# Products Endpoints
@app.route('/products', methods=['GET'])
def get_products():
    products = load_data(PRODUCTS_FILE)
    return jsonify(products)

@app.route('/products', methods=['POST'])
def add_product():
    product = request.json
    if not product or not isinstance(product, dict):
        abort(400, description="Invalid product data")
    product['id'] = generate_id()
    products = load_data(PRODUCTS_FILE)
    products.append(product)
    save_data(PRODUCTS_FILE, products)
    return jsonify(product), 201

@app.route('/products/<product_id>', methods=['PUT'])
def update_product(product_id):
    data = request.json
    if not data or not isinstance(data, dict):
        abort(400, description="Invalid update data")
    products = load_data(PRODUCTS_FILE)
    for p in products:
        if p['id'] == product_id:
            p.update(data)
            save_data(PRODUCTS_FILE, products)
            return jsonify(p)
    abort(404, description="Product not found")

@app.route('/products/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    products = load_data(PRODUCTS_FILE)
    products = [p for p in products if p['id'] != product_id]
    save_data(PRODUCTS_FILE, products)
    return '', 204

# Orders Endpoints
@app.route('/orders', methods=['GET'])
def get_orders():
    orders = load_data(ORDERS_FILE)
    return jsonify(orders)

@app.route('/orders', methods=['POST'])
def add_order():
    order = request.json
    if not order or not isinstance(order, dict):
        abort(400, description="Invalid order data")
    # Atomically reduce stock
    products = load_data(PRODUCTS_FILE)
    for p in products:
        if p['id'] == order['productId']:
            current_stock = int(p.get('stock', 0))
            if current_stock < order['quantity']:
                abort(400, description="Insufficient stock")
            p['stock'] = current_stock - order['quantity']
            save_data(PRODUCTS_FILE, products)
            break
    else:
        abort(404, description="Product not found")
    
    order['timeISO'] = time.strftime('%Y-%m-%dT%H:%M:%S')
    orders = load_data(ORDERS_FILE)
    orders.append(order)
    save_data(ORDERS_FILE, orders)
    return jsonify(order), 201

if __name__ == '__main__':
    app.run(debug=True, port=5000)
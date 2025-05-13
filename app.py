from flask import Flask, render_template, redirect, url_for, flash, request, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import os
import re

app = Flask(__name__)
app.secret_key = 'dev-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///payments.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    name = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    transactions = db.relationship('Transaction', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Transaction(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    amount = db.Column(db.Float, nullable=False)
    card_last_four = db.Column(db.String(4), nullable=False)
    cardholder = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='completed')

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        flash('Invalid email or password')
    
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        name = request.form.get('name')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered')
            return render_template('signup.html')
        
        user = User(email=email, name=name)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        return redirect(url_for('index'))
    
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/payment', methods=['GET', 'POST'])
@login_required
def payment():
    if request.method == 'POST':
        card_number = request.form.get('card_number', '').replace(' ', '')
        expiry_date = request.form.get('expiry_date', '')
        cvv = request.form.get('cvv', '')
        cardholder_name = request.form.get('cardholder_name', '')
        amount = request.form.get('amount', '')
        
        errors = {}
        
        if not card_number or not card_number.isdigit() or len(card_number) not in [15, 16]:
            errors['card_number'] = "Invalid card number"
        
        if not expiry_date or not re.match(r'^(0[1-9]|1[0-2])\/([0-9]{2})$', expiry_date):
            errors['expiry_date'] = "Invalid format (MM/YY)"
        else:
            month, year = expiry_date.split('/')
            current_year = datetime.now().year % 100
            current_month = datetime.now().month
            
            if (int(year) < current_year or 
                (int(year) == current_year and int(month) < current_month)):
                errors['expiry_date'] = "Card has expired"
        
        if not cvv or not cvv.isdigit() or len(cvv) not in [3, 4]:
            errors['cvv'] = "Invalid CVV"
        
        if not cardholder_name or len(cardholder_name.strip()) < 3:
            errors['cardholder_name'] = "Please enter cardholder name"
        
        try:
            amount_value = float(amount)
            if amount_value <= 0:
                errors['amount'] = "Amount must be greater than zero"
        except ValueError:
            errors['amount'] = "Invalid amount"
        
        if errors:
            return render_template('payment.html', errors=errors, form=request.form)
        
        transaction = Transaction(
            id=f"TX-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            user_id=current_user.id,
            amount=float(amount),
            card_last_four=card_number[-4:],
            cardholder=cardholder_name,
            status='completed'
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return redirect(url_for('confirmation', transaction_id=transaction.id))
    
    return render_template('payment.html')

@app.route('/confirmation/<transaction_id>')
@login_required
def confirmation(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)
    if transaction.user_id != current_user.id:
        return redirect(url_for('index'))
    return render_template('confirmation.html', transaction=transaction)

@app.route('/transactions')
@login_required
def transaction_history():
    transactions = Transaction.query.filter_by(user_id=current_user.id)\
        .order_by(Transaction.date.desc()).all()
    return render_template('transactions.html', transactions=transactions)

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run()
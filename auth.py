import os
import uuid
import sqlite3
import re
from datetime import datetime, timedelta
import requests
import bcrypt
from flask import Blueprint, render_template, session, request, flash, url_for, redirect, make_response
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, BooleanField
from wtforms.validators import DataRequired

from dotenv import load_dotenv


auth_bp = Blueprint('auth', __name__, url_prefix='')

load_dotenv()
secret_key = uuid.uuid4()

auth_bp.secret_key = secret_key

# settings the google env variables here
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_DISCOVERY_URL = os.getenv('GOOGLE_DISCOVERY_URL')
COOKIE_MAX_AGE = 30 * 24 * 60 * 60  


def connect_db():
    con = sqlite3.connect('db.db')
    con.row_factory = sqlite3.Row
    return con

def has_special_chars(string):
    pattern = r"[^A-Za-z]+"
    if string == re.sub(pattern, '', string):
        return False
    else:
        return True

def get_google_provider_config():
    try:
        return requests.get(GOOGLE_DISCOVERY_URL, timeout=30).json()
    except:
        # In case of error, return empty dict to prevent crashes
        flash("Could not connect to Google authentication service", "danger")
        return {"authorization_endpoint": "", "token_endpoint": "", "userinfo_endpoint": ""}

# New functions for cookie authentication
def generate_auth_token():
    """Generate a unique authentication token"""
    return uuid.uuid4().hex.upper()

def create_auth_cookie(user_id, remember=False):
    """Create authentication cookie with token"""
    token = generate_auth_token()
    cookie_value = f"_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ACCOUNT.|_{token}"
    
    # Store token in database
    con = connect_db()
    cur = con.cursor()
    
    # Delete any existing tokens for this user
    cur.execute("DELETE FROM auth_tokens WHERE user_id = ?", (user_id,))
    
    # Calculate expiry time
    expires_at = datetime.now() + timedelta(days=30) if remember else None
    expires_timestamp = expires_at.timestamp() if expires_at else None
    
    # Store new token
    cur.execute("INSERT INTO auth_tokens (token, user_id, created_at, expires_at, remember_me) VALUES (?, ?, ?, ?, ?)",
              (token, user_id, datetime.now(), expires_timestamp, int(remember)))
    con.commit()
    con.close()
    
    return cookie_value

def validate_auth_cookie(cookie_value):
    """Validate the authentication cookie and return user_id if valid"""
    if not cookie_value or not cookie_value.startswith("_|WARNING:-DO-NOT-SHARE-THIS"):
        return None
        
    # Extract token
    parts = cookie_value.split('|_')
    if len(parts) < 2:
        return None
        
    token = parts[-1]
    
    # Validate token from database
    con = connect_db()
    cur = con.cursor()
    
    # Get token info and user data
    cur.execute("""
        SELECT t.*, u.* FROM auth_tokens t 
        JOIN users u ON t.user_id = u.user_id
        WHERE t.token = ? 
    """, (token,))
    
    result = cur.fetchone()
    con.close()
    
    if not result:
        return None
        
    # Check if token has expired
    if result['expires_at'] and datetime.now().timestamp() > result['expires_at']:
        return None
        
    return result

class AdminLoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')
    submit = SubmitField('Login')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # Check if already authenticated via cookie
    auth_cookie = request.cookies.get('.ROLSASECURITY')
    if auth_cookie:
        user_data = validate_auth_cookie(auth_cookie)
        if user_data:
            # Set session data from the cookie authentication
            session['user_id'] = user_data['user_id']
            session['profilePic'] = user_data['profilePic']
            if user_data['CustomPfp']:
                session['CustomPfp'] = bool(user_data['CustomPfp'])
            
            # Redirect to next URL if it exists in session
            next_url = session.pop('next', None)
            if next_url:
                return redirect(next_url)
            return redirect(url_for('home'))
    
    if 'user_id' in session:
        return redirect(url_for('home'))
        
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        remember_me = 'remember_me' in request.form
        
        conn = connect_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cur.fetchone()
        conn.close()
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            # Create authentication cookie
            auth_cookie = create_auth_cookie(user['user_id'], remember_me)
            
            # Set session data
            session['user_id'] = user['user_id']
            session['profilePic'] = user['profilePic']
            if 'CustomPfp' in user.keys() and user['CustomPfp']:
                session['CustomPfp'] = bool(user['CustomPfp'])
                
            # Create response with cookie
            flash("Login successful", 'success')
            
            # Redirect to next URL if it exists in session
            next_url = session.pop('next', None)
            if next_url:
                response = redirect(next_url)
            else:
                response = redirect(url_for('home'))
            
            # Set cookie options based on environment
            cookie_options = {
                'httponly': True, 
                'samesite': 'Lax'
            }
            
            # Only set secure flag in production
            if os.environ.get('FLASK_ENV') == 'production':
                cookie_options['secure'] = True
            
            # Set cookie expiry based on remember_me
            if remember_me:
                cookie_options['max_age'] = COOKIE_MAX_AGE
                
            response.set_cookie('.ROLSASECURITY', auth_cookie, **cookie_options)
            return response
        else:
            flash("Incorrect username or password", 'danger')
            return render_template("login.html")
            
    return render_template("login.html")


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('home'))
    if request.method == 'POST':
        firstname = request.form['firstname']
        has_special_chars(firstname)
        if has_special_chars(firstname) is True:
            flash("First name cannot contain special characters", 'danger')
            return render_template("register.html")
        email = request.form['email']
        confirm_email = request.form['email2']
        password = request.form['password']
        confirm_password = request.form['password2']
        remember_me = 'remember_me' in request.form
        is_oauth = False
        if 'isOauth' in request.form:
            is_oauth = True
        
        if email != confirm_email:
            flash("Emails do not match", 'danger')
            return render_template("register.html")
        
        if password != confirm_password:
            flash("Passwords do not match", 'danger')
            return render_template("register.html")
        
        con = connect_db()
        cur = con.cursor()


        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        if cur.fetchone():
            flash("An Account already exists with this email", 'danger')
            con.close()
            return render_template("register.html")
        
        try:
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user_id = uuid.uuid4().hex
            created_at = datetime.now()
            default_pfp = url_for('static', filename='images/default_pfp.svg')
            cur.execute("INSERT INTO users(user_id,email,password,firstname,createdAt,isOAuth,profilePic,CustomPfp) VALUES(?,?,?,?,?,?,?,?)", 
                      (user_id, email, hashed_password, firstname, created_at, is_oauth, default_pfp, 0))
            con.commit()
            
            # Create authentication cookie
            auth_cookie = create_auth_cookie(user_id, remember_me)
            
            # Set session data
            session['user_id'] = user_id
            session['profilePic'] = default_pfp
            session['CustomPfp'] = False
            
            flash("Account created successfully", 'success')
            
            # Create response with cookie
            response = redirect(url_for('home'))
            
            # Set cookie expiry based on remember_me
            if remember_me:
                response.set_cookie('.ROLSASECURITY', auth_cookie, max_age=COOKIE_MAX_AGE, httponly=True, samesite='Lax')
            else:
                response.set_cookie('.ROLSASECURITY', auth_cookie, httponly=True, samesite='Lax')
                
            return response
        except (sqlite3.Error, ValueError) as e:
            flash(f"Error creating account: {str(e)}", 'danger')
            return render_template("register.html")
        finally:
            con.close()

    return render_template("register.html")

        

@auth_bp.route('/logout')
def logout():
    user_id = session.get('user_id')
    
    # Check if we need to clear the auth cookie
    if user_id:
        con = connect_db()
        cur = con.cursor()
        
        # checks if the user have a remember me token
        cur.execute("SELECT remember_me FROM auth_tokens WHERE user_id = ?", (user_id,))
        result = cur.fetchone()
        
        # If remember_me is not set or is False, delete the token
        if not result or not result['remember_me']:
            cur.execute("DELETE FROM auth_tokens WHERE user_id = ?", (user_id,))
            con.commit()
        
        con.close()
    
    # Clear session
    session.clear()
    
    # Create response and clear cookie if not remember_me
    response = redirect(url_for('home'))
    
    # Only clear the cookie if the token was deleted (not remember_me)
    if not result or not result['remember_me']:
        response.delete_cookie('.ROLSASECURITY')
    
    return response

@auth_bp.route('/google_login')
def google_login():
    # ...existing code...
    google_provider_cfg = get_google_provider_config()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]

    request_uri = requests.Request(
        'GET',
        authorization_endpoint,
        params={
            'client_id': GOOGLE_CLIENT_ID,
            'redirect_uri': url_for('auth.google_callback', _external=True),
            'response_type': 'code',
            'scope': 'openid email profile',
        },
    ).prepare().url

    return redirect(request_uri)

@auth_bp.route('/google_login/callback')
def google_callback():
    code = request.args.get("code")
    if not code:
        flash("Authentication failed", 'danger')
        return redirect(url_for('auth.login'))

    # ...existing code...
    google_provider_cfg = get_google_provider_config()
    token_endpoint = google_provider_cfg["token_endpoint"]

    token_url, headers, body = requests.Request(
        'POST',
        token_endpoint,
        params={
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': url_for('auth.google_callback', _external=True),
        },
    ).prepare().url, {}, None

    token_response = requests.post(token_url, headers=headers, data=body, timeout=30)
    tokens = token_response.json()

    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    userinfo_response = requests.get(
        userinfo_endpoint,
        headers={'Authorization': f'Bearer {tokens["access_token"]}'},
        timeout=30,
    )
    
    userinfo = userinfo_response.json()

    if not userinfo.get("email_verified"):
        flash("User email not verified by Google", 'danger')
        return redirect(url_for('auth.login'))
    
    email = userinfo["email"]
    firstname = userinfo.get("given_name", "")
    picture = userinfo.get("picture", "")
    
    con = connect_db()
    cur = con.cursor()
    

    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()
    
    if not user:
        try:
            user_id = uuid.uuid4().hex
            created_at = datetime.now()
            isOauth = True
            

            random_password = uuid.uuid4().hex
            hashed_password = bcrypt.hashpw(random_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cur.execute("INSERT INTO users(user_id,email,password,firstname,createdAt,isOAuth,profilePic,CustomPfp) VALUES(?,?,?,?,?,?,?,?)",
                      (user_id, email, hashed_password, firstname, created_at, isOauth, picture, 0))
            con.commit()
            
            session['user_id'] = user_id
            session['profilePic'] = picture
            session['CustomPfp'] = False
            
            # Google login always uses remember_me
            auth_cookie = create_auth_cookie(user_id, remember=True)
            
            flash("Account created with Google successfully", 'success')
            response = redirect(url_for('home'))
            response.set_cookie('.ROLSASECURITY', auth_cookie, max_age=COOKIE_MAX_AGE, httponly=True, samesite='Lax')
            
            return response
        except Exception as e:
            flash(f"Error creating account: {str(e)}", 'danger')
            return redirect(url_for('auth.login'))
        finally:
            con.close()
    else:
        user_id = user['user_id']
        session['user_id'] = user_id
        
        if 'CustomPfp' in user.keys() and user['CustomPfp'] == 1:
            session['profilePic'] = user['profilePic']
            session['CustomPfp'] = True
        else:
            session['profilePic'] = picture
            session['CustomPfp'] = False
            
            try:
                cur.execute("UPDATE users SET profilePic = ? WHERE user_id = ? AND (CustomPfp IS NULL OR CustomPfp = 0)", 
                          (picture, user['user_id']))
                con.commit()
            except Exception as e:
                print(f"Error updating profile picture: {str(e)}")
        
        # Google login always uses remember_me
        auth_cookie = create_auth_cookie(user_id, remember=True)
        
        flash("Logged in with Google successfully", 'success')
        response = redirect(url_for('home'))
        response.set_cookie('.ROLSASECURITY', auth_cookie, max_age=COOKIE_MAX_AGE, httponly=True, samesite='Lax')
        
        con.close()
        return response

    
@auth_bp.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    form = AdminLoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        remember_me = form.remember_me.data

        if username == "admin" and password == "admin123":
            session['is_admin'] = True
            session['admin_username'] = username
            
            # For admin, we'll still use session-based auth but respect remember_me for session lifetime
            if remember_me:
                # Set session to expire after 30 days
                session.permanent = True
                
            flash("Admin login successful", 'success')
            return redirect(url_for('admin_dashboard'))
        else:
            flash("Invalid admin credentials", 'danger')
    
    return render_template("admin/login.html", form=form)

@auth_bp.route('/admin/logout')
def admin_logout():
    session.pop('is_admin', None)
    session.pop('admin_username', None)
    flash("Admin logged out successfully", 'success')
    return redirect(url_for('auth.admin_login'))

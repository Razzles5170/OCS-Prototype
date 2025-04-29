from flask import Flask, render_template, redirect, session, url_for, request, jsonify
from functools import wraps
import uuid
import sqlite3
import json
from datetime import datetime, timedelta

app = Flask(__name__)
secret_key = uuid.uuid4().hex
app.secret_key = secret_key

# import for the auth blueprint
from auth import auth_bp
app.register_blueprint(auth_bp)

# import for the api blueprint
from api import api_bp
app.register_blueprint(api_bp)

#login required function made so that users will be directed to the login page if a session is not found
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function
# only admins can access the admin pages...
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin', False):
            return redirect(url_for('auth.admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def get_db_connection():
    conn = sqlite3.connect('db.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def base():
    return render_template("home.html")

@app.route('/home')
def home():
    return render_template("home.html")

@app.route('/booking', methods=['GET', 'POST'])
def booking():
    return render_template('booking.html')

# route to get the availibility of the slots for the consultation and installation
@app.route('/api/availability')
def get_availability():
    date = request.args.get('date')

    if not date:
        return jsonify({"error": "Date parameter is required"}), 400

    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d')
        if date_obj.weekday() >= 5:  
            return jsonify({"available_slots": []})
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    if date_obj < datetime.now().replace(hour=0, minute=0, second=0, microsecond=0):
        return jsonify({"available_slots": []})

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT available_times FROM availability WHERE date = ?", (date,))
    custom_availability = cursor.fetchone()

    if custom_availability:

        available_slots = json.loads(custom_availability['available_times'])
    else:

        default_slots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]
        available_slots = default_slots

    cursor.execute("SELECT bookedfor FROM consultation_bookings WHERE bookedfor LIKE ?", (f"{date}%",))
    bookings = cursor.fetchall()

    for booking in bookings:
        booking_time = booking['bookedfor'].split(' ')[1].split(':')[0] + ":00"
        if booking_time in available_slots:
            available_slots.remove(booking_time)

    conn.close()

    return jsonify({"available_slots": available_slots})

@app.route('/book_consultation', methods=['POST'])
@login_required
def book_consultation():
    if not request.is_json:
        return jsonify({"success": False, "message": "Invalid request format"}), 400

    data = request.get_json()

    if not all(key in data for key in ['date', 'time', 'reason']):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    try:
        booking_id = uuid.uuid4().hex
        booked_for = f"{data['date']} {data['time']}:00"

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM consultation_bookings WHERE bookedfor = ?", (booked_for,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": "This time slot is already booked. Please select another time."}), 409

        cursor.execute(
            "INSERT INTO consultation_bookings (consultation_id, user_id, bookedfor, reason, status) VALUES (?, ?, ?, ?, ?)",
            (booking_id, session['user_id'], booked_for, data['reason'], 'pending')
        )

        conn.commit()
        conn.close()

        return jsonify({"success": True, "booking_id": booking_id})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/book_installation', methods=['POST'])
@login_required
def book_installation():
    if not request.is_json:
        return jsonify({"success": False, "message": "Invalid request format"}), 400

    data = request.get_json()

    if not all(key in data for key in ['date', 'time', 'address']):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM consultation_bookings WHERE user_id = ? AND status = 'approve' LIMIT 1", 
        (session['user_id'],)
    )
    approved_consultation = cursor.fetchone()

    if not approved_consultation:
        conn.close()
        return jsonify({
            "success": False, 
            "message": "You must complete a consultation before booking an installation."
        }), 403

    try:
        booking_id = uuid.uuid4().hex

        time_mapping = {
            "morning": "09:00:00",
            "afternoon": "13:00:00"
        }
        booked_for = f"{data['date']} {time_mapping.get(data['time'], '09:00:00')}"

        cursor.execute(
            "INSERT INTO installation_bookings (installation_id, user_id, bookedfor, address, status) VALUES (?, ?, ?, ?, ?)",
            (booking_id, session['user_id'], booked_for, data['address'], 'pending')
        )

        conn.commit()
        conn.close()

        return jsonify({"success": True, "booking_id": booking_id})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/mybookings')
@login_required
def mybookings():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *, 
               strftime('%Y-%m-%d', bookedfor) as booking_date, 
               strftime('%H:%M', bookedfor) as booking_time 
        FROM consultation_bookings 
        WHERE user_id = ?
        ORDER BY bookedfor DESC
    """, (session['user_id'],))
    consultation_bookings = cursor.fetchall()

    cursor.execute("""
        SELECT *, 
               strftime('%Y-%m-%d', bookedfor) as booking_date, 
               strftime('%H:%M', bookedfor) as booking_time 
        FROM installation_bookings 
        WHERE user_id = ?
        ORDER BY bookedfor DESC
    """, (session['user_id'],))
    installation_bookings = cursor.fetchall()

    conn.close()

    return render_template("mybookings.html", 
                           consultation_bookings=consultation_bookings, 
                           installation_bookings=installation_bookings)

@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()
    # fetching the pending consultations and installations from the database
    cursor.execute("""
        SELECT c.*, u.firstname, u.email,
               strftime('%Y-%m-%d', c.bookedfor) as booking_date, 
               strftime('%H:%M', c.bookedfor) as booking_time 
        FROM consultation_bookings c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.status = 'pending'
        ORDER BY c.bookedfor ASC
    """)
    pending_consultations = cursor.fetchall()
    # fetching the pending installations from the database
    cursor.execute("""
        SELECT i.*, u.firstname, u.email,
               strftime('%Y-%m-%d', i.bookedfor) as booking_date, 
               strftime('%H:%M', i.bookedfor) as booking_time 
        FROM installation_bookings i
        JOIN users u ON i.user_id = u.user_id
        WHERE i.status = 'pending'
        ORDER BY i.bookedfor ASC
    """)
    pending_installations = cursor.fetchall()

    conn.close()

    return render_template("admin/dashboard.html", 
                          pending_consultations=pending_consultations, 
                          pending_installations=pending_installations)
# this basically lets the admin add times and dates to the database for the availability of the consultation and installation
@app.route('/admin/availability')
@admin_required
def admin_availability():

    today = datetime.now().strftime('%Y-%m-%d')

    default_slots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]

    conn = get_db_connection()
    cursor = conn.cursor()

    start_date = datetime.now()
    end_date = start_date + timedelta(days=30)

    cursor.execute(
        "SELECT date, available_times FROM availability WHERE date BETWEEN ? AND ?",
        (start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
    )

    custom_availability = {row['date']: json.loads(row['available_times']) for row in cursor.fetchall()}

    conn.close()

    return render_template('admin/availability.html', 
                          today=today, 
                          default_slots=default_slots,
                          custom_availability=custom_availability)

# this function is used to update the availability of the consultation and installation slots in the database
@app.route('/admin/update_availability', methods=['POST'])
@admin_required
def admin_update_availability():
    action = request.form.get('action')

    if action == 'load':
        date = request.form.get('date')

        return redirect(url_for('admin_availability', selected_date=date))

    try:
        date = request.form.get('date')
        selected_slots = request.form.getlist('selected_slots')

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM availability WHERE date = ?", (date,))
        existing = cursor.fetchone()

        if existing:

            cursor.execute(
                "UPDATE availability SET available_times = ? WHERE date = ?",
                (json.dumps(selected_slots), date)
            )
        else:

            cursor.execute(
                "INSERT INTO availability (date, available_times) VALUES (?, ?)",
                (date, json.dumps(selected_slots))
            )

        conn.commit()
        conn.close()

        return redirect(url_for('admin_availability', success=True))
    except Exception as e:
        return redirect(url_for('admin_availability', error=str(e)))

@app.route('/admin/booking/<string:booking_type>/<string:booking_id>/<string:action>', methods=['POST'])
@admin_required
def handle_booking(booking_type, booking_id, action):
    if action not in ['approve', 'reject']:
        return jsonify({"success": False, "message": "Invalid action"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if booking_type == 'consultation':
            cursor.execute(
                "UPDATE consultation_bookings SET status = ? WHERE consultation_id = ?",
                (action, booking_id)
            )
        elif booking_type == 'installation':
            cursor.execute(
                "UPDATE installation_bookings SET status = ? WHERE installation_id = ?",
                (action, booking_id)
            )
        else:
            return jsonify({"success": False, "message": "Invalid booking type"}), 400

        conn.commit()
        conn.close()

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# this function is used to send the contact us form to the database and also display the messages in the admin page
@app.route('/contact', methods=['GET', 'POST'])
def contact_us():
    success_message = None
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        message = request.form.get('message')

        if not name or not email or not message:
            return render_template("contact.html", error="All fields are required.")

        message_id = uuid.uuid4().hex

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS contact_messages (
                    message_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    read INTEGER DEFAULT 0
                )
            ''')

            cursor.execute(
                "INSERT INTO contact_messages (message_id, name, email, message) VALUES (?, ?, ?, ?)",
                (message_id, name, email, message)
            )

            conn.commit()
            conn.close()

            success_message = "Your message has been sent successfully!"
        except Exception as e:
            return render_template("contact.html", error=f"An error occurred: {str(e)}")

    return render_template("contact.html", success_message=success_message)

@app.route('/admin/messages')
@admin_required
def admin_messages():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM contact_messages
        ORDER BY timestamp DESC
    """)
    messages = cursor.fetchall()

    conn.close()

    return render_template("admin/messages.html", messages=messages)
# this function is used to delete the messages from the contact us form in the admin page
@app.route('/admin/messages/<string:message_id>/delete', methods=['POST'])
@admin_required
def delete_message(message_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM contact_messages WHERE message_id = ?", (message_id,))

        conn.commit()
        conn.close()

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/admin/messages/<string:message_id>/mark-read', methods=['POST'])
@admin_required
def mark_message_read(message_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("UPDATE contact_messages SET read = 1 WHERE message_id = ?", (message_id,))

        conn.commit()
        conn.close()

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/info')
def info():
    return render_template("info.html")

@app.route('/footprint')
def footprint():
    return render_template("CarbonFootprintCalc.html")

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template("Profile.html")

@app.route('/privacypolicy')
def privacy_policy():
    return render_template("PrivacyPolicy.html")

@app.route('/track')
def track():
    return render_template("EnergyUsage.html")

@app.route('/tos')
def terms():
    return render_template("TermsOfService.html")

@app.route('/AccessibilityStatement')
def AccessibilityStatement():
    return render_template("AccessibilityStatement.html")
@app.route('/about_us')
def about_us():
    return render_template("AboutUs.html")

#whenever the user gets an error instead of showing werkzeug error page or something that can expose our code, it will jsut show our 404 paage
@app.errorhandler(Exception)
def handle_error(e):
    return render_template('404.html', error=str(e)), 500

@app.route('/404')
def error_404():
    return render_template("404.html")

# this function is used to check if the user has an approved consultation or not so they can book an installation
@app.route('/check_consultation_status')
@login_required
def check_consultation_status():
    """Check if the logged-in user has an approved consultation"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"has_approved_consultation": False, "error": "Not logged in"}), 401

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM consultation_bookings WHERE user_id = ? AND status = 'approve' LIMIT 1", 
            (user_id,)
        )

        approved_consultation = cursor.fetchone()
        conn.close()

        return jsonify({"has_approved_consultation": approved_consultation is not None})
    except Exception as e:
        return jsonify({"has_approved_consultation": False, "error": str(e)}), 500
# for hosting purposes, this function is used to run the app on a specific port and host
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000) 


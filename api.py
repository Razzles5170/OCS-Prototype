import os
import uuid
import re
import requests
import base64
import sqlite3
from flask import Blueprint, request, jsonify, session, current_app
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

api_bp = Blueprint('api', __name__, url_prefix='/api')

secret_key = uuid.uuid4()

api_bp.secret_key = secret_key

JSON_TEMPLATE = {
    "contents": [
        {
            "parts": [
                {
                    "text": ""
                }
            ]
        }
    ]
}

# this is my prompt to gemini it outright tells it to follow a set instruction so it doesnt output wrong info
@api_bp.route('/calculate_footprint', methods=['POST'])
def calculate_footprint():
    data = request.form
    prompt = ("Calculate the carbon footprint of a person based on the "
              "following data, give a score out of 100 make the score sensible there are a limited amount of questions to go off of so dont just like not give low numbers or only give high numbers, be fair , and provide a helpful "
              "message on how to reduce their carbon footprint keep the word count of your message medium as users wouldnt want to read that much if you deem it "
              "high or give them a supportive message if you deem it low. IMPORTANT: Return your answer in this EXACT format with NO markdown: 'score: 75, Message: Your carbon footprint message here.' - no other text, no quotation marks, no markdown text formatting, no additional explanation. Just use exactly the format shown."
              "Here is the data from the questionare: ")

    request_json = JSON_TEMPLATE.copy()
    request_json["contents"][0]["parts"][0]["text"] = f"{prompt}\n\n{data}"

    base_url = "https://generativelanguage.googleapis.com"
    model_path = "v1beta/models/gemini-2.0-flash:generateContent"
    gemini_api_link = f"{base_url}/{model_path}?key={GEMINI_API_KEY}"

    response = requests.post(
        gemini_api_link,
        json=request_json,
        timeout=30
    )

    # the data returned from gemini is a json object with the text in it, we need to extract the text from it
    # and return it in a json object with the score and message as keys
    if response.status_code == 200:
        data = response.json()
        try:
            if 'candidates' in data:
                generated_text = data['candidates'][0]['content']['parts'][0]['text']
            else:
                generated_text = data['contents'][0]['parts'][0]['text']
            json_pattern = r'["\']?score["\']?:\s*(\d+),\s*["\']?Message["\']?:\s*["\']?(.+?)["\']?$'
            match = re.search(json_pattern, generated_text, re.IGNORECASE | re.DOTALL)

            if match:
                score = match.group(1)
                message = match.group(2).strip()
            else:
                lines = generated_text.strip().split('\n')
                score_line = next((line for line in lines if 'score' in line.lower()), "")

                if score_line:
                    score = re.search(r'\d+', score_line).group(0) if re.search(r'\d+', score_line) else "N/A"
                else:
                    score = "N/A"
                if score_line:
                    message_start = generated_text.find(score_line) + len(score_line)
                    message = generated_text[message_start:].strip()
                else:
                    message = generated_text.strip()

            return jsonify({"score": score, "message": message})

        except KeyError as e:
            return jsonify({"error": f"Unexpected API response structure: {str(e)}", "full_response": data}), 500
    else:
        return jsonify({"error": f"Failed to generate text: {response.status_code}", "details": response.text}), 500


@api_bp.route('/save_footprint', methods=['POST'])
def save_footprint():
    """Save a user's carbon footprint score"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'User not logged in'})
    
    data = request.json
    if not data or 'score' not in data:
        return jsonify({'success': False, 'message': 'Invalid data'})
    
    try:
        conn = sqlite3.connect('db.db')
        cur = conn.cursor()
        
        # Save the footprint score with timestamp
        cur.execute("""
            INSERT INTO carbon_footprints (user_id, score, message, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (session['user_id'], data['score'], data.get('message', '')))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True, 
            'message': 'Carbon footprint saved successfully'
        })
        
    except Exception as e:
        print(f"Error saving footprint: {str(e)}")
        return jsonify({'success': False, 'message': f'Error saving footprint: {str(e)}'})


@api_bp.route('/get_footprint_history', methods=['GET'])
def get_footprint_history():
    """Get a user's carbon footprint history"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'User not logged in'})
    
    try:
        conn = sqlite3.connect('db.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, score, message, created_at 
            FROM carbon_footprints 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        """, (session['user_id'],))
        
        rows = cur.fetchall()
        history = []
        
        for row in rows:
            history.append({
                'id': row['id'],
                'score': row['score'],
                'message': row['message'],
                'date': row['created_at']
            })
        
        conn.close()
        
        return jsonify({
            'success': True, 
            'history': history
        })
        
    except Exception as e:
        print(f"Error getting footprint history: {str(e)}")
        return jsonify({'success': False, 'message': f'Error getting footprint history: {str(e)}'})


@api_bp.route('/check_consultation_status', methods=['GET'])
def check_consultation_status():
    """Check if the user has an approved consultation"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'User not logged in'})
    
    try:
        conn = sqlite3.connect('db.db')
        cur = conn.cursor()
        
        cur.execute("""
            SELECT COUNT(*) FROM consultations
            WHERE user_id = ? AND status = 'approved'
        """, (session['user_id'],))
        
        has_approved = cur.fetchone()[0] > 0
        
        conn.close()
        
        return jsonify({
            'success': True,
            'has_approved_consultation': has_approved
        })
        
    except Exception as e:
        print(f"Error checking consultation status: {str(e)}")
        return jsonify({'success': False, 'message': f'Error checking consultation status: {str(e)}'})




@api_bp.route('/availability', methods=['GET'])
def get_availability():
    """Get available time slots for a given date"""
    date = request.args.get('date')
    if not date:
        return jsonify({'error': 'Date parameter is required'}), 400
    
    try:
        conn = sqlite3.connect('db.db')
        cur = conn.cursor()
        
        # Check which time slots are already booked for this date
        cur.execute("""
            SELECT booking_time FROM consultations 
            WHERE booking_date = ? AND status != 'rejected'
        """, (date,))
        
        booked_slots = [row[0] for row in cur.fetchall()]
        
        # Default slotss
        all_slots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
                      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM']
        
        # Remove booked slots
        available_slots = [slot for slot in all_slots if slot not in booked_slots]
        
        conn.close()
        
        return jsonify({
            'date': date,
            'available_slots': available_slots
        })
        
    except Exception as e:
        print(f"Error getting availability: {str(e)}")
        return jsonify({'error': f'Error getting availability: {str(e)}'}), 500

# function for the user to update their profile picture using imgcdn.dev api
@api_bp.route('/update_profile_pic', methods=['POST'])
def update_profile_pic():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'User not logged in'})

    if 'image' not in request.files:
        return jsonify({'success': False, 'message': 'No image file provided'})

    image_file = request.files['image']
    if image_file.filename == '':
        return jsonify({'success': False, 'message': 'No image selected'})

    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
    if not ('.' in image_file.filename and image_file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
        return jsonify({'success': False, 'message': 'File type not allowed'})

    try:
        image_data = image_file.read()

        imgcdn_url = "https://imgcdn.dev/api/1/upload"

        files = {
            'source': image_data
        }

        data = {
            'key': os.getenv('IMGCDN_API_KEY')  
        }

        response = requests.post(imgcdn_url, files=files, data=data, timeout=30)

        if response.status_code != 200:
            return jsonify({'success': False, 'message': f'Error uploading image: {response.text}'})

        json_response = response.json()

        if json_response.get('status_code') != 200:
            return jsonify({'success': False, 'message': 'Failed to upload image'})

        image_url = json_response.get('image', {}).get('url')

        if not image_url:
            return jsonify({'success': False, 'message': 'No image URL returned'})

        conn = sqlite3.connect('db.db')
        cur = conn.cursor()
        cur.execute("UPDATE users SET profilePic = ?, CustomPfp = 1 WHERE user_id = ?", 
                  (image_url, session['user_id']))
        conn.commit()
        conn.close()

        session['profilePic'] = image_url
        session['CustomPfp'] = True

        return jsonify({
            'success': True, 
            'message': 'Profile picture updated successfully',
            'profile_pic': image_url
        })

    except Exception as e:
        print(f"Error updating profile picture: {str(e)}")
        return jsonify({'success': False, 'message': f'Error updating profile picture: {str(e)}'})
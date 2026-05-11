import os
import uuid
from werkzeug.utils import secure_filename
from flask import Blueprint, request, current_app, jsonify

upload_bp = Blueprint('upload', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@upload_bp.route('', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return {'error': 'No file provided'}, 400

    file = request.files['file']
    if file.filename == '':
        return {'error': 'No file selected'}, 400

    if not allowed_file(file.filename):
        return {'error': 'File type not allowed. Use: png, jpg, jpeg, gif, webp, svg'}, 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'uploads'))

    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    url = f"{request.scheme}://{request.host}/uploads/{filename}"
    return {'url': url, 'filename': filename}, 201

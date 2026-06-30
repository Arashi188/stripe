import cloudinary
import cloudinary.uploader
from flask import current_app

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def _init_cloudinary():
    cloudinary.config(
        cloud_name=current_app.config.get('CLOUDINARY_CLOUD_NAME'),
        api_key=current_app.config.get('CLOUDINARY_API_KEY'),
        api_secret=current_app.config.get('CLOUDINARY_API_SECRET'),
        secure=True,
    )


def upload_image(file_storage, folder_name):
    if not file_storage or not file_storage.filename:
        raise ValueError('No file provided')

    ext = file_storage.filename.rsplit('.', 1)[-1].lower() if '.' in file_storage.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Invalid file format "{ext}". Allowed: jpg, jpeg, png, webp')

    file_storage.seek(0, 2)
    size = file_storage.tell()
    file_storage.seek(0)
    if size > MAX_FILE_SIZE:
        raise ValueError(f'File too large ({size / 1024 / 1024:.1f}MB). Maximum is 5MB.')

    _init_cloudinary()

    try:
        result = cloudinary.uploader.upload(
            file_storage,
            folder=folder_name,
        )
        return result.get('secure_url')
    except Exception as e:
        raise RuntimeError(f'Cloudinary upload failed: {str(e)}')

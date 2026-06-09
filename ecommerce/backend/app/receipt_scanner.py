import json
import logging
import os
import re
import signal
import sys
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import pytesseract
    _tesseract_candidates = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        '/usr/bin/tesseract',
        '/usr/local/bin/tesseract',
    ]
    _found = False
    for _p in _tesseract_candidates:
        if os.path.exists(_p):
            pytesseract.pytesseract.tesseract_cmd = _p
            _found = True
            break
    if not _found:
        try:
            import subprocess
            subprocess.run(['tesseract', '--version'], capture_output=True, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

if TESSERACT_AVAILABLE and sys.platform == 'win32':
    _user_tessdata = os.path.join(os.environ.get('USERPROFILE', ''), 'AppData', 'Local', 'Tesseract-OCR', 'tessdata')
    _prog_tessdata = r'C:\Program Files\Tesseract-OCR\tessdata'
    for _td in [_user_tessdata, _prog_tessdata]:
        if os.path.isdir(_td):
            os.environ.setdefault('TESSDATA_PREFIX', _td)
            break

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

NIGERIAN_BANKS = [
    'gtbank', 'guaranty trust', 'access bank', 'zenith bank',
    'uba', 'united bank', 'first bank', 'fidelity', 'sterling',
    'polaris', 'wema', 'keystone', 'union bank', 'stanbic',
    'opay', 'palmpay', 'kuda', 'moniepoint', 'vfd',
]

SUCCESS_KEYWORDS = [
    'successful', 'success', 'approved',
    'transaction successful', 'transfer successful',
    'payment successful', 'completed', 'credit alert',
]

FAILURE_KEYWORDS = [
    'failed', 'declined', 'reversed', 'insufficient',
    'error', 'rejected',
]


def _extract_text_from_image(file_path):
    if not PIL_AVAILABLE or not TESSERACT_AVAILABLE:
        raise RuntimeError('Pillow or pytesseract not installed')
    image = Image.open(file_path)
    text = pytesseract.image_to_string(image)
    return text


def _extract_text_from_pdf(file_path):
    if not PDFPLUMBER_AVAILABLE:
        raise RuntimeError('pdfplumber not installed')
    text = ''
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + '\n'
    return text


def _preprocess_text(text):
    text = text.lower()
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _check_amount(text, total_amount):
    amount_str = f'{total_amount:.2f}'
    if amount_str in text:
        return 'PASS'

    naira_formats = [
        f'ngn {amount_str}',
        f'ngn{amount_str}',
        f'n{amount_str}',
        f'₦{amount_str}',
        f'₦ {amount_str}',
    ]
    for fmt in naira_formats:
        if fmt in text:
            return 'PASS'

    int_part = int(total_amount)
    decimal_part = f'{total_amount:.2f}'.split('.')[1]
    comma_format = f'{int_part:,}.{decimal_part}'
    if comma_format in text:
        return 'PASS'

    return 'FAIL'


def _check_status(text):
    for kw in SUCCESS_KEYWORDS:
        if kw in text:
            return 'PASS'
    for kw in FAILURE_KEYWORDS:
        if kw in text:
            return 'FAIL'
    return 'UNKNOWN'


def _check_bank(text):
    for bank in NIGERIAN_BANKS:
        if bank in text:
            return 'FOUND'
    return 'NOT_FOUND'


def _check_date(text):
    today = datetime.now(timezone.utc)
    yesterday = today - timedelta(days=1)

    date_formats = ['%d/%m/%Y', '%d-%m-%Y', '%d %m %Y']

    for d in (today, yesterday):
        for fmt in date_formats:
            date_str = d.strftime(fmt)
            if date_str in text:
                return 'RECENT'

    month_names = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
    ]
    for d in (today, yesterday):
        day = d.day
        month = month_names[d.month - 1]
        year = d.year
        patterns = [
            f'{month} {day} {year}',
            f'{month} {day:02d} {year}',
            f'{day} {month} {year}',
            f'{day:02d} {month} {year}',
        ]
        for pattern in patterns:
            if pattern in text:
                return 'RECENT'

    return 'NOT_FOUND'


def _calculate_scan_result(checks):
    if checks.get('amount_check') == 'PASS' and checks.get('status_check') == 'PASS':
        return 'VALID'
    if checks.get('amount_check') == 'FAIL' or checks.get('status_check') == 'FAIL':
        return 'INVALID'
    return 'NEEDS_REVIEW'


class TimeoutError(Exception):
    pass


def _timeout_handler(signum, frame):
    raise TimeoutError('Scan timed out')


def scan_receipt(order, file_path):
    if order.receipt_scan_status:
        return

    if not os.path.exists(file_path):
        logger.error('Receipt file not found: %s', file_path)
        order.receipt_scan_status = 'NEEDS_REVIEW'
        order.receipt_scan_details = json.dumps({
            'extracted_text': '',
            'amount_check': 'UNKNOWN',
            'status_check': 'UNKNOWN',
            'bank_check': 'NOT_FOUND',
            'date_check': 'NOT_FOUND',
            'scan_timestamp': datetime.now(timezone.utc).isoformat(),
            'error': 'Receipt file not found',
        })
        return

    if sys.platform != 'win32':
        signal.signal(signal.SIGALRM, _timeout_handler)
        signal.alarm(30)

    extracted_text = ''
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            extracted_text = _extract_text_from_pdf(file_path)
        else:
            extracted_text = _extract_text_from_image(file_path)
    except Exception as e:
        logger.error('OCR failed for %s: %s', file_path, str(e))
        order.receipt_scan_status = 'NEEDS_REVIEW'
        order.receipt_scan_details = json.dumps({
            'extracted_text': '',
            'amount_check': 'UNKNOWN',
            'status_check': 'UNKNOWN',
            'bank_check': 'NOT_FOUND',
            'date_check': 'NOT_FOUND',
            'scan_timestamp': datetime.now(timezone.utc).isoformat(),
            'error': f'OCR failed: {str(e)}',
        })
        return
    finally:
        if sys.platform != 'win32':
            signal.alarm(0)

    cleaned = _preprocess_text(extracted_text)

    checks = {}
    checks['amount_check'] = _check_amount(cleaned, order.total_amount)
    checks['status_check'] = _check_status(cleaned)
    checks['bank_check'] = _check_bank(cleaned)
    checks['date_check'] = _check_date(cleaned)

    scan_result = _calculate_scan_result(checks)

    extra = {
        'amount_check': checks['amount_check'],
        'status_check': checks['status_check'],
        'bank_check': checks['bank_check'],
        'date_check': checks['date_check'],
        'scan_timestamp': datetime.now(timezone.utc).isoformat(),
    }

    preview = extracted_text[:500]
    details = {
        'extracted_text': preview,
        **extra,
    }

    order.receipt_scan_status = scan_result
    order.receipt_scan_details = json.dumps(details)

import re
import unicodedata


def sanitize_argument_body(text: str) -> str:
    """Sanitize argument body text for storage.

    Transformations:
    - Strip leading/trailing whitespace
    - Collapse runs of 3+ newlines to 2
    - Strip HTML tags
    - Normalize unicode to NFC form
    """
    text = text.strip()
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = unicodedata.normalize("NFC", text)
    return text

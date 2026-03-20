from app.services.sanitization import sanitize_argument_body


class TestSanitizeArgumentBody:
    def test_strips_leading_trailing_whitespace(self):
        text = "  " + "x" * 50 + "  "
        result = sanitize_argument_body(text)
        assert result == "x" * 50

    def test_collapses_excessive_newlines(self):
        text = "First paragraph." + "x" * 40 + "\n\n\n\n" + "Second paragraph." + "x" * 40
        result = sanitize_argument_body(text)
        assert "\n\n\n" not in result
        assert "\n\n" in result

    def test_preserves_double_newlines(self):
        text = "Paragraph one." + "x" * 40 + "\n\n" + "Paragraph two." + "x" * 40
        result = sanitize_argument_body(text)
        assert "\n\n" in result

    def test_strips_html_tags(self):
        text = "<b>Bold</b> and <script>alert('xss')</script> " + "x" * 50
        result = sanitize_argument_body(text)
        assert "<b>" not in result
        assert "<script>" not in result
        assert "Bold" in result

    def test_normalizes_unicode(self):
        # é as e + combining accent (NFD) should become single é (NFC)
        text = "caf\u0065\u0301" + " " * 48
        result = sanitize_argument_body(text)
        assert "caf\u00e9" in result

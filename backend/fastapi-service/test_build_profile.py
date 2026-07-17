"""Test /build-profile endpoint after fixes."""
import requests
import io
import json

# 1. Generate JWT token locally simulating Express backend
import jwt
from datetime import datetime, timezone, timedelta
payload = {
    "sub": "test3@test.com",
    "exp": datetime.now(timezone.utc) + timedelta(hours=24),
}
token = jwt.encode(payload, "thjkquyjqsnnnsubdyiuvsnxtwvah", algorithm="HS256")
print(f"Generated Local Token: {token[:20]}...")

# 2. Build a minimal valid PDF
pdf_content = (
    b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
    b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    b"4 0 obj\n<< /Length 200 >>\nstream\nBT\n/F1 12 Tf\n100 750 Td\n"
    b"(John Doe - Software Engineer) Tj\n0 -20 Td\n"
    b"(Skills: Python, JavaScript, React, Node.js, Docker) Tj\n0 -20 Td\n"
    b"(Experience: 3 years at TechCorp) Tj\n0 -20 Td\n"
    b"(Education: B.S. Computer Science, MIT) Tj\nET\nendstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n"
    b"0000000058 00000 n \n0000000115 00000 n \n0000000306 00000 n \n"
    b"0000000236 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\n"
    b"startxref\n558\n%%EOF"
)

# 3. Call /build-profile
resp = requests.post(
    "http://127.0.0.1:8000/build-profile",
    files={"file": ("resume.pdf", io.BytesIO(pdf_content), "application/pdf")},
    data={"github_username": "octocat"},
    headers={"Authorization": f"Bearer {token}"},
)
print(f"build-profile status: {resp.status_code}")
ct = resp.headers.get("content-type", "N/A")
print(f"Content-Type: {ct}")

try:
    body = resp.json()
    if resp.status_code == 200:
        print(f"Response body keys: {list(body.keys())}")
        if "resume" in body:
            print(f"Resume skills: {body['resume'].get('skills', [])}")
            print(f"Verified: {body.get('verified_skills', [])}")
            print(f"Unverified: {body.get('unverified_skills', [])}")
            print(f"Verification rate: {body.get('verification_rate', 0)}")
        print("\nSUCCESS - /build-profile is working!")
    else:
        print(f"Error response: {json.dumps(body, indent=2)}")
except Exception as e:
    print(f"Raw body: {resp.text[:500]}")
    print(f"Parse error: {e}")

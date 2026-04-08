import pdfplumber
import re
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
pdf_path = os.getenv("PDF_PATH")

if not pdf_path or not os.path.exists(pdf_path):
    print("FILE DOES NOT EXIST")
    exit()

try:
    conn = mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    cursor = conn.cursor()
    print("DB CONNECTED")
except Exception as e:
    print("DB CONNECTION FAILED:", e)
    exit()

text = ""

with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages:
        extracted = page.extract_text()
        if extracted:
            text += extracted + "\n"

print("\nExtracted Preview:\n", text[:500])

e = re.search(r"Enrolment No:\s*(\w+)", text)
e_id = e.group(1) if e else None

name_match = re.search(r"Name:\s*(.+)", text)
s_name = name_match.group(1).strip() if name_match else None

prog_match = re.search(r"Programme\s*&\s*Major:\s*(.+)", text)
prog_major = prog_match.group(1).strip() if prog_match else ""

if "-" in prog_major:
    programme, major = prog_major.split("-", 1)
else:
    programme = prog_major
    major = prog_major

programme = programme.strip()
major = major.strip()

email_match = re.search(r"(Email|E-mail|Email ID):\s*([\w\.-]+@[\w\.-]+)", text)
email = email_match.group(2) if email_match else None

minor_match = re.search(r"Minor:\s*(.+)", text)
minor = minor_match.group(1).strip() if minor_match else None

if minor:
    minor = re.sub(r"\(.*?\)", "", minor).strip()

print("\nExtracted Values")
print("Enrolment ID:", e_id)
print("Name:", s_name)
print("Programme:", programme)
print("Major:", major)
print("Email:", email)
print("Minor:", minor)

if e_id and s_name and programme and major:
    try:
        cursor.execute("""
            INSERT INTO Student 
            (e_id, s_name, email, programme, major, minor)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (e_id, s_name, email, programme, major, minor))

        conn.commit()
        print("\nSTUDENT INSERTED")

    except mysql.connector.Error as err:
        print("\nDB Error:", err)
else:
    print("\nSTUDENT EXTRACTION FAILED")

cursor.close()
conn.close()
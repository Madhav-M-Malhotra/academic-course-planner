"""
requirements.py — Loads graduation requirements from Requirements.txt.

Expected tab-separated format (with header row):
  Subject  CourseCode  For(MAJOR|MINOR)  Type(CORE|ELECTIVE)

The Prisma schema defines:
  enum ReqType   { MAJOR MINOR }
  enum CourseType{ CORE ELECTIVE }
"""

import re
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)
cursor = conn.cursor()

VALID_FOR  = {"MAJOR", "MINOR"}
VALID_TYPE = {"CORE", "ELECTIVE"}

inserted = 0
skipped  = 0

try:
    with open("Requirements.txt", "r", encoding="utf-8") as f:
        lines = f.readlines()
except FileNotFoundError:
    print("Requirements.txt not found — skipping.")
    cursor.close()
    conn.close()
    exit()

lines = lines[1:]  # skip header

for line in lines:
    line = line.strip()
    if not line:
        continue

    # Split on tabs or 2+ spaces
    parts = re.split(r"\t+|\s{2,}", line)
    if len(parts) < 4:
        skipped += 1
        continue

    subject     = parts[0].strip()
    course_code = re.sub(r'["\'\[\]]', '', parts[1]).strip()
    for_val     = parts[2].strip().upper()
    type_val    = parts[3].strip().upper()

    # Validate against enums
    if for_val not in VALID_FOR:
        print(f"  Skipping invalid ReqType '{for_val}' for {course_code}")
        skipped += 1
        continue

    if type_val not in VALID_TYPE:
        print(f"  Skipping invalid CourseType '{type_val}' for {course_code}")
        skipped += 1
        continue

    try:
        cursor.execute("""
            INSERT IGNORE INTO Requirements (subject, course_code, `for`, `type`)
            VALUES (%s, %s, %s, %s)
        """, (subject, course_code, for_val, type_val))
        inserted += 1
    except Exception as e:
        print(f"  DB Error [{course_code}]: {e}")
        skipped += 1

conn.commit()
cursor.close()
conn.close()
print(f"Finished. Inserted: {inserted}, Skipped: {skipped}")

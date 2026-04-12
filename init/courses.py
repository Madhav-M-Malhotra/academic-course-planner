"""
courses.py — Ingests all 5 school CSVs into the Course table.

CSV column layout (0-indexed):
  0: Course ID
  1: Course Code  e.g. "BIO103[Undergraduate]"
  2: Course Name
  3: Credits
  4: Faculty      (handled in faculty.py)
  5: Term
  6: Prerequisite Course Code
  7: Antirequisite Course Code
  8: Course Description
  9: GER Category
  10: Schedule     (handled in sections.py)
  11: (empty)
"""

import os
import re
import csv
import mysql.connector
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")

try:
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )
    cursor = conn.cursor()
    print("CONNECTION ESTABLISHED")
except Exception as e:
    print("CONNECTION FAILED:", e)
    exit()

# Map each CSV file to its school label
CSV_FILES = {
    "Course Directory_AMSOM.csv": "AMSOM",
    "Course Directory_SAS.csv":   "SAS",
    "Course Directory_SEAS.csv":  "SEAS",
    "Course Directory_SPH.csv":   "SPH",
    "Course Directory_UGC.csv":   "UGC",
}


def extract_course_code(raw):
    """Pull the bare course code out of strings like 'BIO103[Undergraduate]'"""
    match = re.search(r"([A-Z]{2,5}\d{2,3})", str(raw))
    return match.group(1) if match else None


def extract_credits(text):
    """Parse credits as int (schema uses Int)."""
    try:
        val = float(re.findall(r"\d+\.?\d*", str(text))[0])
        return int(round(val))
    except Exception:
        return None


def clean_text(text):
    if not text or str(text).strip() in ("", "nan"):
        return None
    text = str(text).replace("View/Print Outline", "")
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


def clean_prereq(text):
    if not text or str(text).strip().lower() in ("", "nan", "none"):
        return None
    text = re.sub(r"\[.*?\]", "", str(text))
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


def clean_antireq(text):
    if not text or str(text).strip().lower() in ("", "nan", "none", "[ none ]"):
        return None
    text = re.sub(r"\[.*?\]", "", str(text))
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


GER_MAP = {
    "humanities":   "HL",
    "languages":    "HL",
    "social":       "SS",
    "mathematical": "MPL",
    "physical":     "MPL",
    "biological":   "BLS",
    "life":         "BLS",
    "visual":       "PVA",
    "performing":   "PVA",
}

def map_ger(ger):
    if not ger or str(ger).strip().lower() in ("", "nan", "not applicable"):
        return None
    ger_lower = str(ger).lower()
    for keyword, code in GER_MAP.items():
        if keyword in ger_lower:
            return code
    return None


inserted = 0
skipped = 0

for csv_file, school in CSV_FILES.items():
    if not os.path.exists(csv_file):
        print(f"SKIPPING (not found): {csv_file}")
        continue

    print(f"\nProcessing: {csv_file} → {school}")

    try:
        with open(csv_file, newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)  # skip header row

            for cols in reader:
                try:
                    if len(cols) < 6:
                        skipped += 1
                        continue

                    # Col 1 = Course Code (e.g. "BIO103[Undergraduate]")
                    course_code = extract_course_code(cols[1])
                    if not course_code:
                        skipped += 1
                        continue

                    course_name  = cols[2].strip()
                    credits      = extract_credits(cols[3])
                    term         = cols[5].strip()
                    prereq       = clean_prereq(cols[6]  if len(cols) > 6  else None)
                    antireq      = clean_antireq(cols[7] if len(cols) > 7  else None)
                    description  = clean_text(cols[8]    if len(cols) > 8  else None)
                    ger          = map_ger(cols[9]        if len(cols) > 9  else None)

                    cursor.execute("""
                        INSERT IGNORE INTO Course
                        (code, name, credits, term, description, ger, school, prereqs, antireqs)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (course_code, course_name, credits, term,
                          description, ger, school, prereq, antireq))

                    inserted += 1

                except Exception as row_err:
                    print(f"  ROW ERROR [{school}]:", cols[:3], "→", row_err)
                    skipped += 1

        conn.commit()
        print(f"  Done {school}: inserted so far = {inserted}, skipped = {skipped}")

    except FileNotFoundError:
        print(f"FILE NOT FOUND: {csv_file}")

cursor.close()
conn.close()
print(f"\nFinished. Total inserted: {inserted}, skipped: {skipped}")

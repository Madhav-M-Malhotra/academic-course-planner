"""
faculty.py — Populates the Faculty table from all 5 school CSVs.

Column 4 of each CSV = Faculty name(s), e.g.:
  "Souvik Sen Gupta"
  "Ashim RaiBhuvan PathakKrishna Bs Swamy"   ← sticky-name bug
  "Not added"  ← skip these
"""

import re
import csv
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

CSV_FILES = {
    "Course Directory_AMSOM.csv": "AMSOM",
    "Course Directory_SAS.csv":   "SAS",
    "Course Directory_SEAS.csv":  "SEAS",
    "Course Directory_SPH.csv":   "SPH",
    "Course Directory_UGC.csv":   "UGC",
}

SKIP_VALUES = {"not added", "tba", "to be announced", "", "nan", "-"}


def extract_course_code(raw):
    match = re.search(r"([A-Z]{2,5}\d{2,3})", str(raw))
    return match.group(1) if match else None


def split_sticky_names(text):
    """
    Insert a space before each uppercase letter that immediately follows
    a lowercase letter — this fixes concatenated names like
    'JohnDoeJaneSmith' → 'John Doe Jane Smith'
    """
    return re.sub(r"([a-z])([A-Z])", r"\1 \2", text)


def extract_names(raw_text):
    """
    Returns a list of individual faculty names from a raw faculty cell.
    Handles:
      - Comma / ampersand / semicolon separated
      - CamelCase concatenated (sticky-name bug)
      - Titles like "Dr." / "Prof."
    """
    if not raw_text or str(raw_text).strip().lower() in SKIP_VALUES:
        return []

    text = str(raw_text).strip()

    # First fix sticky names
    text = split_sticky_names(text)

    # Now split on common delimiters: comma, &, semicolon, " and "
    parts = re.split(r",|&|;|\band\b", text, flags=re.IGNORECASE)

    names = []
    for part in parts:
        part = part.strip()
        if not part or part.lower() in SKIP_VALUES:
            continue
        # Must look like a real name: at least two words, each starting uppercase
        # Allow single names like "Not added" to be filtered above
        if re.search(r"[A-Z][a-zA-Z]+\s+[A-Z]?[a-zA-Z]+", part):
            names.append(part)

    return names


inserted = 0
skipped = 0

for csv_file in CSV_FILES:
    if not os.path.exists(csv_file):
        continue

    print(f"Processing: {csv_file}")
    with open(csv_file, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # skip header

        for cols in reader:
            if len(cols) < 5:
                continue

            course_code = extract_course_code(cols[1])
            if not course_code:
                continue

            raw_faculty = cols[4]  # column 4 = Faculty
            names = extract_names(raw_faculty)

            for name in names:
                try:
                    cursor.execute("""
                        INSERT IGNORE INTO Faculty (course_code, name)
                        VALUES (%s, %s)
                    """, (course_code, name.strip()))
                    inserted += 1
                except Exception as e:
                    print(f"  Error: {course_code} / {name} → {e}")
                    skipped += 1

    conn.commit()
    print(f"  Done. Cumulative inserted={inserted}, skipped={skipped}")

cursor.close()
conn.close()
print(f"\nFinished. Total inserted: {inserted}, skipped: {skipped}")

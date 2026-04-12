"""
sections.py — Parses Section and Schedule data from all 5 school CSVs.

Real CSV schedule column format (col 10):
  "Section 1  Mon [11:00 to 12:30] \t\t[05-01-2026 to 19-04-2026]Fri [11:00 to 12:30] \t[05-01-2026 to 19-04-2026]"
  "Section 1  [First Quarter]  Tue [09:30 to 11:00] \t...[05-01-2026 to 20-02-2026]..."
  "Not added"

Key quirks fixed here:
  - Dates appear after multiple tabs, not a space (so we use flexible whitespace)
  - Section label sometimes has extra tags like "[First Quarter]"
  - Time format can be "9:30" (single-digit hour) → normalised to "09:30"
  - Schema uses composite PK (course_code, section_no, day, start_time) so
    same (day, start_time) can only appear once per section — we skip duplicates
  - Section PK is (course_code, section_no) — only insert once per section
"""

import re
import csv
import mysql.connector
import os
from dotenv import load_dotenv
from datetime import datetime

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

DAY_MAP = {
    "Mon": "Monday",
    "Tue": "Tuesday",
    "Wed": "Wednesday",
    "Thu": "Thursday",
    "Fri": "Friday",
    "Sat": "Saturday",
    "Sun": "Sunday",
}


def extract_course_code(raw):
    match = re.search(r"([A-Z]{2,5}\d{2,3})", str(raw))
    return match.group(1) if match else None


def normalise_time(t):
    """Ensure HH:MM format (pad single-digit hours)."""
    parts = t.split(":")
    return f"{int(parts[0]):02d}:{parts[1]}"


def parse_schedule(schedule_text, course_code):
    """
    Split on 'Section N' boundaries and parse each section block.
    For each section, extract all (day, start, end, start_date, end_date) tuples.
    """
    schedule_text = str(schedule_text).strip()
    if schedule_text.lower() in ("not added", "nan", ""):
        return

    # Split the full text into (label, body) pairs
    sections = re.split(r"(Section\s*\d+)", schedule_text)
    # sections[0] = text before first section (usually empty), then alternating label/body

    for i in range(1, len(sections), 2):
        section_label = sections[i]
        section_body  = sections[i + 1] if (i + 1) < len(sections) else ""

        sec_match = re.search(r"(\d+)", section_label)
        if not sec_match:
            continue
        section_no = int(sec_match.group(1))

        # Pattern: Day [HH:MM to HH:MM] ... [DD-MM-YYYY to DD-MM-YYYY]
        # Flexible whitespace between the two bracketed groups (tabs in real data)
        slot_pattern = re.compile(
            r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*"
            r"\[(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})\]"
            r"[\s\S]*?"                        # flexible gap (tabs, spaces, newlines)
            r"\[(\d{2}-\d{2}-\d{4})\s+to\s+(\d{2}-\d{2}-\d{4})\]"
        )

        matches = list(slot_pattern.finditer(section_body))
        if not matches:
            # Fallback: sometimes the date bracket is shared — grab the first date pair
            date_match = re.search(
                r"\[(\d{2}-\d{2}-\d{4})\s+to\s+(\d{2}-\d{2}-\d{4})\]",
                section_body
            )
            if not date_match:
                continue
            start_date_str, end_date_str = date_match.group(1), date_match.group(2)
            # Try simpler pattern without embedded dates
            simple = re.compile(
                r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*"
                r"\[(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})\]"
            )
            for m in simple.finditer(section_body):
                day_short, start, end = m.group(1), m.group(2), m.group(3)
                _insert_slot(course_code, section_no,
                             day_short, start, end,
                             start_date_str, end_date_str,
                             first_slot_tracker={})
            continue

        # Track which (day, start_time) combos already inserted (schema PK)
        inserted_keys = set()
        section_inserted = False

        for m in matches:
            day_short      = m.group(1)
            start          = normalise_time(m.group(2))
            end            = normalise_time(m.group(3))
            start_date_str = m.group(4)
            end_date_str   = m.group(5)

            day_full = DAY_MAP[day_short]
            key = (day_full, start)
            if key in inserted_keys:
                continue  # skip duplicate within same section

            start_date = datetime.strptime(start_date_str, "%d-%m-%Y")
            end_date   = datetime.strptime(end_date_str,   "%d-%m-%Y")

            # Insert Section row only once
            if not section_inserted:
                try:
                    cursor.execute("""
                        INSERT IGNORE INTO Section (course_code, section_no, start_date, end_date)
                        VALUES (%s, %s, %s, %s)
                    """, (course_code, section_no, start_date, end_date))
                    section_inserted = True
                except Exception as e:
                    print(f"  Section insert error [{course_code} S{section_no}]: {e}")
                    section_inserted = True  # don't retry even on error

            # Insert Schedule row
            try:
                start_dt = datetime.strptime(start, "%H:%M")
                end_dt   = datetime.strptime(end,   "%H:%M")
                cursor.execute("""
                    INSERT IGNORE INTO Schedule (course_code, section_no, day, start_time, end_time)
                    VALUES (%s, %s, %s, %s, %s)
                """, (course_code, section_no, day_full, start_dt, end_dt))
                inserted_keys.add(key)
            except Exception as e:
                print(f"  Schedule insert error [{course_code} S{section_no} {day_full} {start}]: {e}")


def _insert_slot(course_code, section_no, day_short, start, end,
                 start_date_str, end_date_str, first_slot_tracker):
    """Helper used in the fallback path."""
    day_full  = DAY_MAP.get(day_short, "Monday")
    start     = normalise_time(start)
    end       = normalise_time(end)
    key       = (course_code, section_no)
    start_date = datetime.strptime(start_date_str, "%d-%m-%Y")
    end_date   = datetime.strptime(end_date_str,   "%d-%m-%Y")

    if key not in first_slot_tracker:
        try:
            cursor.execute("""
                INSERT IGNORE INTO Section (course_code, section_no, start_date, end_date)
                VALUES (%s, %s, %s, %s)
            """, (course_code, section_no, start_date, end_date))
        except Exception as e:
            print(f"  Section insert error [{course_code} S{section_no}]: {e}")
        first_slot_tracker[key] = True

    try:
        start_dt = datetime.strptime(start, "%H:%M")
        end_dt   = datetime.strptime(end,   "%H:%M")
        cursor.execute("""
            INSERT IGNORE INTO Schedule (course_code, section_no, day, start_time, end_time)
            VALUES (%s, %s, %s, %s, %s)
        """, (course_code, section_no, day_full, start_dt, end_dt))
    except Exception as e:
        print(f"  Schedule insert error [{course_code} S{section_no} {day_full} {start}]: {e}")


# ── Main ──────────────────────────────────────────────────────────────────────
sections_total = 0
for csv_file in CSV_FILES:
    if not os.path.exists(csv_file):
        continue

    print(f"Processing: {csv_file}")
    with open(csv_file, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # skip header

        for cols in reader:
            if len(cols) < 11:
                continue
            course_code   = extract_course_code(cols[1])
            schedule_text = cols[10]  # column 10 = Schedule

            if not course_code:
                continue

            parse_schedule(schedule_text, course_code)
            sections_total += 1

    conn.commit()
    print(f"  Done.")

cursor.close()
conn.close()
print(f"\nFinished. Processed {sections_total} rows.")

import os
import re
import csv
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

try:
    conn = mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    cursor = conn.cursor()
    print("CONNECTION ESTABLISHED")
except Exception as e:
    print("CONNECTION FAILED:", e)
    exit()


file_path = "Course Directory_SAS.csv"


def extract_course_code(raw):
    match = re.search(r"([A-Z]{2,5}\d{2,3})", raw)
    return match.group(1) if match else None


def extract_credits(text):
    try:
        return float(re.findall(r"\d+\.?\d*", text)[0])
    except:
        return None


def clean_text(text):
    if not text:
        return None
    text = text.replace("View/Print Outline", "")
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


def clean_prereq(text):
    if not text or str(text).lower() == "none":
        return None
    text = re.sub(r"\[.*?\]", "", text)
    text = text.replace("OR", " OR ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_antireq(text):
    if not text or str(text).lower() == "none":
        return None
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text



def map_ger(ger):
    if not ger:
        return None

    ger = ger.lower()

    if "humanities" in ger:
        return "HL"
    elif "social" in ger:
        return "SS"
    elif "mathematical" in ger or "physical" in ger:
        return "MPL"
    elif "biological" in ger or "life" in ger:
        return "BLS"
    elif "visual" in ger or "performing" in ger:
        return "PVA"
    
    return None  



inserted = 0
skipped = 0

try:
    with open(file_path, newline='', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)  # skip header

        for cols in reader:
            try:
                if len(cols) < 5:
                    skipped += 1
                    continue

        
                cols = cols[1:]

         
                course_code = extract_course_code(cols[0].strip())
                if not course_code:
                    skipped += 1
                    continue

                course_name = cols[1].strip()
                credits = extract_credits(cols[2])
                term = cols[4].strip()

                prereq_text = cols[5] if len(cols) > 5 else None
                antireq_text = cols[6] if len(cols) > 6 else None
                course_desc = cols[7] if len(cols) > 7 else None
                ger_raw = cols[8] if len(cols) > 8 else None

             
                prereq_clean = clean_prereq(prereq_text)
                antireq_clean = clean_antireq(antireq_text)
                course_desc = clean_text(course_desc)
                ger_category = map_ger(ger_raw)  

     
                cursor.execute("""
                    INSERT IGNORE INTO Course
                    (code, name, credits, term, description, ger, school, prereqs, antireqs)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    course_code,
                    course_name,
                    credits,
                    term,
                    course_desc,
                    ger_category,
                    "SAS",
                    prereq_clean,
                    antireq_clean
                ))

                inserted += 1

            except Exception as row_error:
                print("ROW ERROR:", cols)
                print(row_error)
                skipped += 1

    conn.commit()

except FileNotFoundError:
    print("FILE NOT FOUND:", file_path)
    exit()

cursor.close()
conn.close()

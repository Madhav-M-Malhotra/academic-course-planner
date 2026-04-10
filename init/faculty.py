import pandas as pd
import re
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)
cursor = conn.cursor()

df = pd.read_csv("Course Directory_SAS.csv")


def clean_course_code(code):
    return re.sub(r"\[.*?\]", "", str(code)).strip()


def extract_faculty_names(text):
    if not text:
        return []

    text = str(text)

    text = re.sub(r",|&| and |;", " ", text)


    text = re.sub(r"\s+", " ", text).strip()


    names = re.findall(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+', text)

    return names



for _, row in df.iterrows():

    course_code = clean_course_code(row.get("Course Code", ""))
    faculty = row.get("Faculty", "")


    if pd.isna(faculty) or str(faculty).strip().lower() in ["", "-", "tba", "to be announced", "not added"]:
        continue

    faculty_list = extract_faculty_names(faculty)

    for name in faculty_list:
        try:
            cursor.execute("""
                INSERT IGNORE INTO Faculty(course_code, name)
                VALUES (%s, %s)
            """, (course_code, name.strip()))
        except Exception as e:
            print("Error:", course_code, name, e)



conn.commit()
cursor.close()
conn.close()


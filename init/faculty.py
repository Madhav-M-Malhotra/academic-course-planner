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

for _, row in df.iterrows():
    
    course_code = re.sub(r"\[.*?\]", "", str(row["Course Code"])).strip()
    
    faculty = row["Faculty"]

    if pd.isna(faculty) or str(faculty).strip() in ["", "-", "TBA"]:
        continue

    # Handle multiple faculty
    faculty_list = str(faculty).split(",")

    for f in faculty_list:
        f = f.strip()
        try:
            cursor.execute("""
                INSERT INTO Faculty (course_code, name)
                VALUES (%s, %s)
            """, (course_code, f))
        except Exception as e:
            print("Error:", course_code, f, e)

conn.commit()
cursor.close()
conn.close()

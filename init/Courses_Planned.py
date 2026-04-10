import mysql.connector
import os
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)
cursor = conn.cursor()

df = pd.read_excel("Courses_Planned.xlsx")

for _, row in df.iterrows():

    try:
        student_id = str(row["ID"]).strip()
        course_code = str(row["Course Code"]).strip()

    
        section_no = int(row["Section"]) if not pd.isna(row["Section"]) else None

        if section_no is None:
            continue

        cursor.execute("""
            INSERT IGNORE INTO Courses_Planned 
            (student_id, course_code, section_no)
            VALUES (%s, %s, %s)
        """, (student_id, course_code, section_no))

    except Exception as e:
        print("Row Error:", row, e)

conn.commit()
cursor.close()
conn.close()


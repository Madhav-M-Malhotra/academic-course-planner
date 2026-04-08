import mysql.connector
import os
from dotenv import load_dotenv
import re

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)
cursor = conn.cursor()


with open("Courses_Planned.txt", "r", encoding="utf-8") as f:
    lines = f.readlines()


lines = lines[1:]


for line in lines:
    line = line.strip()
    
    if not line:
        continue

    parts = re.split(r"\t+|\s{2,}", line)

    if len(parts) < 2:
        continue

    student_id = parts[0].strip()
    course_code = parts[1].strip()

    try:
        cursor.execute("""
            INSERT INTO Courses_Planned (student_id, course_code)
            VALUES (%s, %s)
        """, (student_id, course_code))
    except:
        pass 


conn.commit()
cursor.close()
conn.close()


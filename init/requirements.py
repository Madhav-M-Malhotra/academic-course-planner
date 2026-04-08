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

with open("Requirements.txt", "r", encoding="utf-8") as f:
    lines = f.readlines()


lines = lines[1:]


for line in lines:
    line = line.strip()
    
    if not line:
        continue

  
    parts = re.split(r"\t+|\s{2,}", line)

    if len(parts) < 4:
        continue

    subject = parts[0].strip()
    course_code = parts[1].strip()


    course_code = re.sub(r'["\']', '', course_code).strip()

    for_field = parts[2].strip().upper()   
    type_field = parts[3].strip().upper()  

    try:
        cursor.execute("""
            INSERT INTO Requirements (subject, course_code, `for`, `type`)
            VALUES (%s, %s, %s, %s)
        """, (subject, course_code, for_field, type_field))
    except:
        pass  

conn.commit()
cursor.close()
conn.close()


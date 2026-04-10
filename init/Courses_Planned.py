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

# Read Excel file properly
df = pd.read_excel(r"C:\Users\helis\Desktop\AU\SE\Courses_Planned.xlsx")

for _, row in df.iterrows():

    student_id = str(row["ID"]).strip()
    course_code = str(row["Course Code"]).strip()

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

print("✅ Courses_Planned table populated!")
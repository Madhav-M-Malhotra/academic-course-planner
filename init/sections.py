import pandas as pd
import re
from datetime import datetime
import mysql.connector
import os


conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="JustFor12345!",
    database="acp"
)
cursor = conn.cursor()

df = pd.read_csv("Course Directory_SAS.csv")

day_map = {
    "Mon": "Monday",
    "Tue": "Tuesday",
    "Wed": "Wednesday",
    "Thu": "Thursday",
    "Fri": "Friday",
    "Sat": "Saturday",
    "Sun": "Sunday"
}

def parse_schedule(schedule_text, course_code):
    results = []


    course_code = re.sub(r"\[.*?\]", "", str(course_code)).strip()

  
    sections = re.split(r"(Section\s*\d+)", schedule_text)

    for i in range(1, len(sections), 2):
        section_label = sections[i]
        section_body = sections[i + 1]

        section_no = int(re.search(r"\d+", section_label).group())

  
        pattern = r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\[(\d{2}:\d{2}) to (\d{2}:\d{2})\]\s*\[(\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\]"
        matches = re.findall(pattern, section_body)

        section_dates_added = False

        for match in matches:
            day_short, start, end, start_d, end_d = match

            start_date = datetime.strptime(start_d, "%d-%m-%Y")
            end_date = datetime.strptime(end_d, "%d-%m-%Y")

     
            if not section_dates_added:
                try:
                    cursor.execute("""
                        INSERT INTO Section (course_code, section_no, start_date, end_date)
                        VALUES (%s, %s, %s, %s)
                    """, (course_code, section_no, start_date, end_date))
                except Exception as e:
                    print("Section insert error:", e)
    
                section_dates_added = True

            try:
                cursor.execute("""
                    INSERT INTO Schedule (course_code, section_no, day, start_time, end_time)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    course_code,
                    section_no,
                    day_map[day_short],
                    datetime.strptime(start, "%H:%M"),
                    datetime.strptime(end, "%H:%M")
                ))
            except Exception as e:
                print("Schedule insert error:", e)

    return results


# RUN
for _, row in df.iterrows():
    schedule_text = str(row["Schedule"])
    course_code = row["Course Code"]

    parse_schedule(schedule_text, course_code)

conn.commit()
cursor.close()
conn.close()

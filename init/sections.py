import pandas as pd
import re
from datetime import datetime

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
    rows = []


    course_code = re.sub(r"\[.*?\]", "", str(course_code)).strip()

  
    section_match = re.search(r"Section\s*(\d+)", schedule_text)
    section_no = int(section_match.group(1)) if section_match else 1


    date_match = re.search(r"\[(\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\]", schedule_text)
    if not date_match:
        return rows

    start_date = datetime.strptime(date_match.group(1), "%d-%m-%Y").date()
    end_date = datetime.strptime(date_match.group(2), "%d-%m-%Y").date()

    pattern = r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\[(\d{2}:\d{2}) to (\d{2}:\d{2})\]"
    matches = re.findall(pattern, schedule_text)

    for day_short, start, end in matches:
        rows.append({
            "course_code": course_code,
            "section_no": section_no,
            "day": day_map[day_short],
            "start_time": start,
            "end_time": end,
            "start_date": start_date,
            "end_date": end_date
        })

    return rows


all_rows = []

for _, row in df.iterrows():
    schedule_text = str(row["Schedule"])
    course_code = row["Course Code"]

    parsed = parse_schedule(schedule_text, course_code)
    all_rows.extend(parsed)


for r in all_rows:
    print(r)


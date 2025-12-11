from pyairtable import Table
import os

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

AIRTABLE_KEY = os.getenv('AIRTABLE_KEY')
AIRTABLE_ID = os.getenv('AIRTABLE_ID')
AIRTABLE_TABLE_NAME = os.getenv('AIRTABLE_TABLE_NAME')

table = Table(AIRTABLE_KEY, AIRTABLE_ID, AIRTABLE_TABLE_NAME)

# Fetch one record to inspect field names
def get_field_names():
    records = table.all(max_records=1)
    if not records:
        print('No records found.')
        return
    fields = records[0]['fields']
    print('Field names:')
    for field in fields:
        print(field)

if __name__ == '__main__':
    get_field_names()

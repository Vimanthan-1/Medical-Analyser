import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GROQ_API_KEY")
print(f"Key loaded: '{key}'")

if not key:
    print("Key is empty!")
    exit(1)

try:
    client = Groq(api_key=key)
    # Try a simple lightweight call
    models = client.models.list()
    print("✅ Key is properly working! Models retrieved.")
except Exception as e:
    print(f"❌ Key is INVALID or API Error: {e}")

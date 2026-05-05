"""Quick smoke test for the backend endpoints."""

import json
import os
import urllib.request

API_BASE = os.getenv("DETECTION_API_URL", "http://localhost:5000")


def fetch(path):
    with urllib.request.urlopen(f"{API_BASE}{path}") as response:
        return response.read().decode("utf-8")


def main():
    print("Health:")
    print(fetch("/api/health"))
    print("\nConfig:")
    print(fetch("/api/v1/config"))

    payload = {
        "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
        "session_id": "test-session"
    }
    req = urllib.request.Request(
        f"{API_BASE}/api/v1/detect/frame",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as response:
        print("\nDetect frame:")
        print(response.read().decode("utf-8"))


if __name__ == "__main__":
    main()

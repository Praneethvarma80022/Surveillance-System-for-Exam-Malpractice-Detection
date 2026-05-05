"""Download shape predictor model for face landmark detection."""
import urllib.request
import os

# Try multiple mirrors/sources
urls = [
    "https://github.com/davisking/dlib-models/raw/master/shape_predictor_68_face_landmarks.dat.bz2",
    "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2",
]

output_file = "shape_predictor_68_face_landmarks.dat.bz2"

def report_progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        percent = min(100, (downloaded * 100) // total_size)
        print(f"\rProgress: {percent}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)", end="")
    else:
        print(f"\rDownloaded: {downloaded // (1024*1024)}MB", end="")

success = False
for url in urls:
    try:
        print(f"Attempting to download from: {url}")
        print("This may take a few minutes (file is ~100MB)...")
        
        urllib.request.urlretrieve(url, output_file, reporthook=report_progress)
        print("\n✓ Download complete!")
        
        file_size = os.path.getsize(output_file)
        print(f"File size: {file_size / (1024*1024):.2f} MB")
        
        if file_size < 50000000:  # Less than 50MB
            print("⚠ Warning: File seems too small, trying next source...")
            continue
        
        print("\nExtracting...")
        import bz2
        with bz2.open(output_file, 'rb') as f_in:
            with open('shape_predictor_68_face_landmarks.dat', 'wb') as f_out:
                f_out.write(f_in.read())
        print("✓ Extraction complete!")
        print(f"✓ shape_predictor_68_face_landmarks.dat is ready")
        success = True
        break
        
    except Exception as e:
        print(f"\n✗ Error with {url}: {e}")
        print("Trying next source...\n")
        continue

if not success:
    print("\n⚠ All automatic downloads failed.")
    print("\nMANUAL DOWNLOAD INSTRUCTIONS:")
    print("=" * 60)
    print("1. Open your browser and visit:")
    print("   https://github.com/davisking/dlib-models/raw/master/shape_predictor_68_face_landmarks.dat.bz2")
    print("   OR")
    print("   http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2")
    print("\n2. Download the file (it should be ~100MB)")
    print("\n3. Extract the .bz2 file using 7-Zip, WinRAR, or Python:")
    print("   python -c \"import bz2; open('shape_predictor_68_face_landmarks.dat','wb').write(bz2.open('shape_predictor_68_face_landmarks.dat.bz2','rb').read())\"")
    print(f"\n4. Place the extracted .dat file in this directory:")
    print(f"   {os.getcwd()}")
    print("=" * 60)

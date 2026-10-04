import os
import sys
import time
import requests
import win32print
import win32api

# ==========================================
# CONFIGURATION
# ==========================================
SERVER_URL = "https://auto-xerox-system-kiosk.onrender.com/"
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
POLL_INTERVAL = 3  # Time in seconds between server checks

# ------------------------------------------------------------------
# PHYSICAL PRINTER NAME SETTING:
# - Replace "HP LaserJet Pro M12" with your EXACT physical printer name as listed in Windows
# - Set to None if you prefer using whichever printer is currently Windows Default
# ------------------------------------------------------------------
TARGET_PRINTER = "EPSON14EB8D (L3250 Series)"  # <-- Change to your physical printer's name


def get_active_printer():
    """
    Retrieves the target printer name or falls back to the system default printer.
    """
    if TARGET_PRINTER:
        try:
            # Enumerate installed local and network printers
            installed_printers = [
                p[2] for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
            ]
            if TARGET_PRINTER in installed_printers:
                return TARGET_PRINTER
            else:
                print(f"[!] Warning: Target printer '{TARGET_PRINTER}' not found in installed printers.")
                print(f"    Available printers: {installed_printers}")
                print("    Falling back to Windows default printer...")
        except Exception as e:
            print(f"[!] Error checking printer list: {e}")

    try:
        return win32print.GetDefaultPrinter()
    except Exception as e:
        print(f"[-] Error getting default printer: {e}")
        return None


def send_to_physical_printer(file_path, printer_name):
    """
    Sends a file directly to the Windows Print Spooler for the specified printer.
    """
    if not os.path.exists(file_path):
        print(f"[-] File not found: {file_path}")
        return False

    try:
        print(f"[>] Sending '{os.path.basename(file_path)}' to printer: [{printer_name}]")
        
        # 'printto' verb routes the file directly to the named printer
        win32api.ShellExecute(
            0,
            "printto",
            file_path,
            f'"{printer_name}"',
            ".",
            0
        )
        print("[+] Successfully submitted job to print spooler!")
        return True
    except Exception as e:
        print(f"[-] Print Spooler Error: {e}")
        return False


def poll_and_process():
    """
    Main polling loop to check Node.js backend for pending print jobs.
    """
    active_printer = get_active_printer()
    
    print("\n==================================================")
    print("   ADVANCED AUTO-XEROX PRINTER AGENT (PHYSICAL)   ")
    print("==================================================")
    print(f" Active Target Printer : {active_printer}")
    print(f" Uploads Directory     : {UPLOADS_DIR}")
    print(f" Server Endpoint       : {SERVER_URL}")
    print(f" Polling Interval      : Every {POLL_INTERVAL} seconds")
    print("==================================================\n")

    if not active_printer:
        print("[-] Critical Error: No printer selected or available. Exiting...")
        return

    while True:
        try:
            response = requests.get(SERVER_URL, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("hasJob"):
                    job = data.get("job")
                    file_name = job.get("filename")
                    job_id = job.get("id")
                    
                    file_path = os.path.join(UPLOADS_DIR, file_name)
                    print(f"\n[*] New Print Job Detected! ID: {job_id}")
                    
                    success = send_to_physical_printer(file_path, active_printer)
                    if not success:
                        print(f"[!] Job {job_id} failed to process.")
            elif response.status_code != 204:
                print(f"[!] Server returned status code: {response.status_code}")

        except requests.exceptions.ConnectionError:
            print("[!] Server unreachable. Retrying...", end="\r")
        except Exception as e:
            print(f"\n[-] Unexpected Error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    # Ensure uploads directory exists
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    
    try:
        poll_and_process()
    except KeyboardInterrupt:
        print("\n\n[!] Printer Agent stopped by user.")
        sys.exit(0)
        
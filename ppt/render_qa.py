import os, sys, time
import win32com.client

pptx_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "NetraX_SIH26106_Email_Forensics.pptx")
out_dir = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else "qa_render")
os.makedirs(out_dir, exist_ok=True)

powerpoint = win32com.client.Dispatch("PowerPoint.Application")
powerpoint.Visible = True
time.sleep(1)
pres = powerpoint.Presentations.Open(pptx_path, WithWindow=False)
for i, slide in enumerate(pres.Slides, start=1):
    out_path = os.path.join(out_dir, f"slide_{i}.png")
    slide.Export(out_path, "PNG", 1920, 1080)
    print("exported", out_path)
pres.Close()
powerpoint.Quit()

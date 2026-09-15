import os, sys, time
import win32com.client

pptx_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "NetraX_SIH26106_Email_Forensics.pptx")
pdf_path = os.path.splitext(pptx_path)[0] + ".pdf"

powerpoint = win32com.client.Dispatch("PowerPoint.Application")
powerpoint.Visible = True
time.sleep(1)
pres = powerpoint.Presentations.Open(pptx_path, WithWindow=False)
pres.SaveAs(pdf_path, 32)  # ppSaveAsPDF
pres.Close()
powerpoint.Quit()
print("Saved", pdf_path)

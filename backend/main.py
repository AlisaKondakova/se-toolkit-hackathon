from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sqlite3, io, os, re
from PIL import Image, ImageOps
import pytesseract

DB_PATH = os.path.dirname(os.path.abspath(__file__)) + '/waste.db'

CATEGORIES = {
    "plastic": {"bin": "🔵", "instr": "Plastic & Polymers. Rinse, dry & flatten.", "co2": "0.3kg CO₂",
        "kw": ["water","bottle","plastic","bag","wrap","film","yogurt","kefir","milk","shampoo","conditioner","soap","gel","detergent","cup","container","lid","cap","packaging","straw","cutlery","sponge","toy","bucket","basin","tube"]},
    "metal": {"bin": "🔵", "instr": "Metal & Aluminum. Crush cans, remove food residue.", "co2": "0.5kg CO₂",
        "kw": ["pepsi","coca","cola","coke","sprite","fanta","7up","can","beer","aluminum","tin","tuna","soup","tomato","soda","energy","foil","screw","nail","knife","fork","spoon","pan","pot","wire","metal","key"]},
    "glass": {"bin": "🟢", "instr": "Glass containers. Rinse & recycle. No mirrors/ceramics!", "co2": "0.5kg CO₂",
        "kw": ["glass","bottle","jar","jam","honey","pickle","sauce","perfume","fragrance","flask","vase","container","transparent","drinking","flacon"]},
    "paper": {"bin": "🟡", "instr": "Paper & Cardboard. Keep dry & clean. Remove tape/staples.", "co2": "1.0kg CO₂",
        "kw": ["paper","newspaper","magazine","book","notebook","tissue","napkin","envelope","receipt","cardboard","box","cereal","white","mail","document","template","solution","tetrapak","juice","carton"]},
    "organic": {"bin": "🟢", "instr": "Food & Organic. Compost or general waste. ⚠️ OIL: Do NOT pour down drain! Collect & dispose properly.", "co2": "0.1kg CO₂",
        "kw": ["banana","apple","orange","lemon","fruit","peel","bread","cake","coffee","tea","egg","shell","vegetable","potato","carrot","salad","food","oil","grease","fat","leftovers","meat","bone","fish","rind","core"]},
    "electronics": {"bin": "🔴", "instr": "⚠️ Electronics & Gadgets. Take to special collection points.", "co2": "0.0kg CO₂",
        "kw": ["phone","laptop","tablet","computer","mouse","keyboard","monitor","tv","charger","cable","usb","headphones","speaker","camera","printer","calculator","remote","electronics","router"]},
    "dangerous": {"bin": "🔴", "instr": "⚠️ Hazardous Waste. NEVER mix with regular trash. Special disposal only!", "co2": "0.0kg CO₂",
        "kw": ["battery","accumulator","bulb","lamp","led","medicine","pill","thermometer","paint","solvent","glue","aerosol","gas","mercury","chemical","pesticide","toner","cartridge","nail polish","lighter"]}
}

SUGGESTIONS = ["plastic bottle", "aluminum can", "glass jar", "cardboard box", "banana peel", "used cooking oil", "phone charger", "battery", "tetrapak", "light bulb"]

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('CREATE TABLE IF NOT EXISTS waste (id INTEGER PRIMARY KEY, category TEXT, keywords TEXT, bin_emoji TEXT, instruction TEXT, co2_saved TEXT)')
    c.execute("SELECT COUNT(*) FROM waste")
    if c.fetchone()[0] == 0:
        for cat, data in CATEGORIES.items():
            c.execute("INSERT INTO waste VALUES(NULL,?,?,?,?,?)", (cat, " ".join(data["kw"]), data["bin"], data["instr"], data["co2"]))
        conn.commit()
    conn.close()
init_db()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def analyze_text_first(img):
    try:
        proc = img.convert('L')
        proc = ImageOps.autocontrast(proc, cutoff=20)
        proc = proc.point(lambda x: 0 if x < 140 else 255, '1')
        w,h = proc.size
        if w < 800:
            scale = 800/w
            proc = proc.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
        text = pytesseract.image_to_string(proc, config='--psm 6').lower().strip()
        words = re.findall(r'\b[a-z]{3,}\b', text)
        for word in words:
            for cat, data in CATEGORIES.items():
                if word in data["kw"]:
                    return cat, 0.90
        return None, 0
    except: return None, 0

def analyze_image_fallback(img):
    w,h = img.size
    gray = img.convert("L")
    mask = gray.point(lambda p: 255 if p < 220 else 0)
    bbox = mask.getbbox()
    obj = img.crop(bbox) if bbox else img
    w,h = obj.size
    aspect = w/h if h>0 else 1
    pixels = list(obj.resize((50,50)).convert("RGB").getdata())
    
    yellow = sum(1 for p in pixels if p[0]>180 and p[1]>160 and p[2]<100)
    green = sum(1 for p in pixels if p[1]>p[0] and p[1]>p[2] and p[1]>120)
    red = sum(1 for p in pixels if p[0]>p[1] and p[0]>p[2] and p[0]>150)
    blue = sum(1 for p in pixels if p[2]>p[0] and p[2]>p[1] and p[2]>130)
    white = sum(1 for p in pixels if p[0]>230 and p[1]>230 and p[2]>230)
    total = len(pixels)
    
    if yellow > total*0.15 or green > total*0.15: return "organic", 0.90
    if red > total*0.20 and 0.6<aspect<1.2: return "organic", 0.85
    if 0.30<aspect<0.45:
        if red>total*0.20 or blue>total*0.20: return "metal", 0.90
    if aspect<0.5 and sum((p[0]+p[1]+p[2])/3 for p in pixels)/len(pixels)>190:
        return "glass", 0.85
    if white > total*0.7: return "paper", 0.80
    if sum((p[0]+p[1]+p[2])/3 for p in pixels)/len(pixels)<60: return "electronics", 0.75
    return None, 0

@app.get("/")
def root(): return {"status":"OK","suggestions":SUGGESTIONS}

@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    try:
        img = Image.open(io.BytesIO(await image.read())).convert("RGB")
        ocr_cat, ocr_conf = analyze_text_first(img)
        if ocr_cat and ocr_conf>=0.85:
            return {"success":True, "bin": CATEGORIES[ocr_cat]["bin"], "instruction": CATEGORIES[ocr_cat]["instr"], "co2": CATEGORIES[ocr_cat]["co2"]}
        cv_cat, cv_conf = analyze_image_fallback(img)
        if cv_cat and cv_conf>=0.75:
            return {"success":True, "bin": CATEGORIES[cv_cat]["bin"], "instruction": CATEGORIES[cv_cat]["instr"], "co2": CATEGORIES[cv_cat]["co2"]}
        return {"success":False,"message":"Not recognized. Try searching manually."}
    except Exception as e:
        return JSONResponse({"success":False,"error":str(e)[:100]},500)

@app.post("/search")
async def search(request:dict):
    text = request.get("text","").lower()
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    for word in text.split():
        if len(word)>=3:
            c.execute("SELECT * FROM waste WHERE keywords LIKE ?",(f'%{word}%',))
            res = c.fetchone()
            if res: conn.close(); return {"success":True,"bin":res[3],"instruction":res[4],"co2":res[5]}
    conn.close()
    return {"success":False,"message":"Not found"}

if __name__=="__main__":
    import uvicorn
    uvicorn.run(app,host="0.0.0.0",port=8000)

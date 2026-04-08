from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sqlite3, io, os, re
from PIL import Image, ImageOps
import pytesseract

DB_PATH = os.path.dirname(os.path.abspath(__file__)) + '/waste.db'

CATEGORIES = {
    "plastic": {"bin": "🔵", "instr": "Plastic. Rinse & recycle", "co2": "0.3kg CO₂",
        "kw": ["pepsi","coca","cola","coke","sprite","fanta","7up","water","bottle","plastic","shampoo","soap","gel","detergent","yogurt","cup","container","bag","lotion"]},
    "metal": {"bin": "🔵", "instr": "Metal/Aluminum. Crush & recycle", "co2": "0.5kg CO₂",
        "kw": ["can","beer","aluminum","tin","tuna","soup","tomato","pepsi","coke","sprite","fanta","soda","energy"]},
    "glass": {"bin": "🟢", "instr": "Glass. Do not break! Recycle", "co2": "0.5kg CO₂",
        "kw": ["glass","bottle","jar","jam","honey","pickle","sauce","perfume","fragrance","flask","vase","container","transparent"]},
    "paper": {"bin": "🟡", "instr": "Paper/Cardboard. Dry recycling", "co2": "1.0kg CO₂",
        "kw": ["paper","newspaper","magazine","book","notebook","tissue","napkin","envelope","receipt","cardboard","box","cereal","white","mail","document","template","solution"]},
    "organic": {"bin": "🟢", "instr": "Organic/Food. Compost", "co2": "0.1kg CO₂",
        "kw": ["banana","apple","orange","lemon","fruit","peel","bread","cake","coffee","tea","egg","shell","vegetable","potato","carrot","salad","food"]},
    "electronics": {"bin": "🔴", "instr": "⚠️ Electronics. Special disposal", "co2": "0.0kg CO₂",
        "kw": ["iphone","samsung","apple","laptop","macbook","charger","cable","mouse","keyboard","monitor","tv","headphones","camera","printer","tablet","ipad"]},
    "dangerous": {"bin": "🔴", "instr": "⚠️ HAZARDOUS! Toxic waste", "co2": "0.0kg CO₂",
        "kw": ["battery","lithium","power","bank","bulb","lamp","led","medicine","pills","pharmacy","paint","solvent","glue","mercury","thermometer"]}
}

SUGGESTIONS = ["pepsi", "water bottle", "glass jar", "banana", "apple", "paper", "cardboard", "iphone", "battery"]

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
        garbage = ['the','and','for','you','page','word','file','doc','zero','sugar','taste','since','made','with','free','gluten','light','original','natural','product','country','imported','bottled','volume','premium','quality','name','address','phone','email','www']
        clean = [w for w in words if w not in garbage and len(w)>=3]
        print(f"📝 OCR: {clean}")
        for word in clean:
            for cat, data in CATEGORIES.items():
                if word in data["kw"]:
                    print(f"✅ Text: '{word}' → {cat}")
                    return cat, 0.90, f"Text: {word}"
        return None, 0, ""
    except: return None, 0, ""

def analyze_image_fallback(img):
    w,h = img.size
    gray = img.convert("L")
    mask = gray.point(lambda p: 255 if p < 220 else 0)
    bbox = mask.getbbox()
    obj = img.crop(bbox) if bbox else img
    w,h = obj.size
    aspect = w/h if h>0 else 1
    pixels = list(obj.resize((50,50)).convert("RGB").getdata())
    
    # Считаем цвета
    yellow_count = green_count = red_count = blue_count = white_count = 0
    for p in pixels:
        r, g, b = p
        if r > 180 and g > 160 and b < 100: yellow_count += 1
        elif g > r and g > b and g > 120: green_count += 1
        elif r > g and r > b and r > 150: red_count += 1
        elif b > r and b > g and b > 130: blue_count += 1
        elif r > 230 and g > 230 and b > 230: white_count += 1
    
    total = len(pixels)
    
    # Края
    edge_pixels = []
    for i in range(5):
        edge_pixels.extend(pixels[i*50:(i+1)*50])
    for i in range(45, 50):
        edge_pixels.extend(pixels[i*50:(i+1)*50])
    for i in range(50):
        for j in range(5):
            edge_pixels.append(pixels[i*50+j])
            edge_pixels.append(pixels[i*50+49-j])
    
    edge_bright = sum((p[0]+p[1]+p[2])/3 for p in edge_pixels) / max(len(edge_pixels), 1)
    all_vals = [v for p in pixels for v in p]
    contrast = (max(all_vals) - min(all_vals)) / 255.0 if all_vals else 0
    non_white = [p for p in pixels if not (p[0]>230 and p[1]>230 and p[2]>230)]
    avg_bright = sum((p[0]+p[1]+p[2])/3 for p in non_white) / max(len(non_white), 1)
    
    print(f"🎨 Aspect={aspect:.2f} | Edge={edge_bright:.0f} | Bright={avg_bright:.0f} | Y={yellow_count} G={green_count} R={red_count} B={blue_count}")
    
    # === 1. ОРГАНИКА (все цвета фруктов!) ===
    if yellow_count > total * 0.15: return "organic", 0.90
    if green_count > total * 0.15: return "organic", 0.85
    if red_count > total * 0.20 and 0.6 < aspect < 1.2: return "organic", 0.85  # Красный + округлая форма
    
    # === 2. СТЕКЛО ===
    if 0.2 < aspect < 0.5:
        if edge_bright > 180: return "glass", 0.85
        if edge_bright > 150 and contrast > 0.5: return "glass", 0.80
    if 0.5 < aspect < 0.85:
        if edge_bright > 170 or (avg_bright > 150 and contrast < 0.6):
            return "glass", 0.80
    
    # === 3. МЕТАЛЛ (ТОЛЬКО банки с правильной формой!) ===
    # Узкий диапазон для банок + явный цвет
    if 0.30 < aspect < 0.45:  # Строго для банок
        if red_count > total * 0.20: return "metal", 0.90
        if blue_count > total * 0.20: return "metal", 0.90
    
    # === 4. Бумага ===
    if white_count > total * 0.7: return "paper", 0.80
    
    # === 5. Электроника ===
    if avg_bright < 60: return "electronics", 0.75
    
    return None, 0

@app.get("/")
def root(): return {"status": "OK", "suggestions": SUGGESTIONS}

@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    try:
        img = Image.open(io.BytesIO(await image.read())).convert("RGB")
        ocr_cat, ocr_conf, ocr_text = analyze_text_first(img)
        if ocr_cat and ocr_conf >= 0.85:
            data = CATEGORIES[ocr_cat]
            print(f"✅ FINAL: {ocr_cat} via OCR")
            return {"success": True, "text": f"Text: {ocr_text}", "bin": data["bin"], "instruction": data["instr"], "co2": data["co2"]}
        cv_cat, cv_conf = analyze_image_fallback(img)
        if cv_cat and cv_conf >= 0.75:
            data = CATEGORIES[cv_cat]
            print(f"✅ FINAL: {cv_cat} via CV")
            return {"success": True, "text": "AI Analysis", "bin": data["bin"], "instruction": data["instr"], "co2": data["co2"]}
        return {"success": False, "text": "Not recognized", "message": "💡 Try: 'apple', 'paper', 'glass jar'"}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)[:100]}, 500)

@app.post("/search")
async def search(request: dict):
    text = request.get("text", "").lower()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    for word in text.split():
        if len(word) >= 3:
            c.execute("SELECT * FROM waste WHERE keywords LIKE ?", (f'%{word}%',))
            res = c.fetchone()
            if res:
                conn.close()
                return {"success": True, "text": text, "bin": res[3], "instruction": res[4], "co2": res[5]}
    conn.close()
    return {"success": False, "text": text, "message": "❌ Not found"}

if __name__ == "__main__":
    import uvicorn
    print("\n🗑️ Smart Waste Sorter (Fixed: Apple = Organic!)")
    uvicorn.run(app, host="0.0.0.0", port=8000)

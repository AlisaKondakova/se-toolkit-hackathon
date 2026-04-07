from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sqlite3, io, os, re
from PIL import Image, ImageOps
import pytesseract

DB_PATH = os.path.dirname(os.path.abspath(__file__)) + '/waste.db'

CATEGORIES = {
    "plastic": {"bin": "🔵", "instr": "Plastic. Rinse & recycle", "co2": "0.3kg CO₂",
        "kw": ["pepsi","coca","cola","coke","sprite","fanta","7up","water","bottle","plastic","shampoo","soap","gel","detergent","yogurt","cup","container","bag"]},
    "metal": {"bin": "🔵", "instr": "Metal/Aluminum. Crush & recycle", "co2": "0.5kg CO₂",
        "kw": ["can","beer","aluminum","tin","tuna","soup","tomato","pepsi","coke","sprite","fanta"]},
    "glass": {"bin": "🟢", "instr": "Glass. Do not break! Recycle", "co2": "0.5kg CO₂",
        "kw": ["vodka","wine","champagne","whiskey","rum","absolut","glass","bottle","jar","jam","honey","pickle","sauce","perfume"]},
    "paper": {"bin": "🟡", "instr": "Paper/Cardboard. Dry recycling", "co2": "1.0kg CO₂",
        "kw": ["paper","newspaper","magazine","book","notebook","tissue","napkin","envelope","receipt","cardboard","box","cereal","white"]},
    "organic": {"bin": "🟢", "instr": "Organic/Food. Compost", "co2": "0.1kg CO₂",
        "kw": ["banana","apple","orange","lemon","fruit","peel","bread","cake","coffee","tea","egg","shell","vegetable","potato","carrot","salad","food"]},
    "electronics": {"bin": "🔴", "instr": "⚠️ Electronics. Special disposal", "co2": "0.0kg CO₂",
        "kw": ["iphone","samsung","apple","laptop","macbook","charger","cable","mouse","keyboard","monitor","tv","headphones","camera","printer","tablet","ipad"]},
    "dangerous": {"bin": "🔴", "instr": "⚠️ HAZARDOUS! Toxic waste", "co2": "0.0kg CO₂",
        "kw": ["battery","lithium","power","bank","bulb","lamp","led","medicine","pills","pharmacy","paint","solvent","glue","mercury","thermometer"]}
}

SUGGESTIONS = ["pepsi", "coca cola", "water bottle", "vodka", "wine", "banana", "apple", "paper", "cardboard", "iphone", "battery"]

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

def analyze_image(img):
    # Анализируем ВСЮ картинку, не обрезая!
    w,h = img.size
    aspect = w/h if h>0 else 1
    
    # Берём все пиксели
    pixels = list(img.resize((50,50)).convert("RGB").getdata())
    
    # Считаем ЦВЕТОВУЮ ГИСТОГРАММУ
    yellow_count = 0
    green_count = 0
    red_count = 0
    blue_count = 0
    white_count = 0
    
    for p in pixels:
        r, g, b = p
        # Жёлтый: R и G высокие, B низкий
        if r > 180 and g > 160 and b < 100:
            yellow_count += 1
        # Зелёный
        elif g > r and g > b and g > 120:
            green_count += 1
        # Красный
        elif r > g and r > b and r > 150:
            red_count += 1
        # Синий
        elif b > r and b > g and b > 130:
            blue_count += 1
        # Белый (фон)
        elif r > 230 and g > 230 and b > 230:
            white_count += 1
    
    total = len(pixels)
    print(f"🎨 Color histogram: Yellow={yellow_count}, Green={green_count}, Red={red_count}, Blue={blue_count}, White={white_count}")
    
    # === ПРИОРИТЕТ 0: ЖЁЛТЫЙ ДОМИНИРУЕТ ===
    if yellow_count > total * 0.2:  # Хотя бы 20% пикселей жёлтые
        print("✅ YELLOW DOMINATES -> Organic (banana)")
        return "organic", 0.95, "yellow fruit"
    
    # === ПРИОРИТЕТ 1: ЗЕЛЁНЫЙ ДОМИНИРУЕТ ===
    if green_count > total * 0.2:
        print("✅ GREEN DOMINATES -> Organic")
        return "organic", 0.90, "green object"
    
    # === ПРИОРИТЕТ 2: ФОРМА БУТЫЛКИ ===
    if 0.15 < aspect < 0.35:
        # Считаем среднюю яркость (игнорируя белый фон)
        non_white = [p for p in pixels if not (p[0]>230 and p[1]>230 and p[2]>230)]
        if non_white:
            avg_bright = sum((p[0]+p[1]+p[2])/3 for p in non_white) / len(non_white)
            if avg_bright > 200:
                print("✅ TRANSPARENT BOTTLE -> Glass")
                return "glass", 0.90, "transparent bottle"
        print("✅ BOTTLE -> Plastic")
        return "plastic", 0.85, "colored bottle"
    
    # === ПРИОРИТЕТ 3: ФОРМА БАНКИ ===
    if 0.25 < aspect < 0.5:
        if red_count > total * 0.15:
            print("✅ RED CAN -> Metal")
            return "metal", 0.90, "red can"
        if blue_count > total * 0.15:
            print("✅ BLUE CAN -> Metal")
            return "metal", 0.90, "blue can"
        print("✅ CAN -> Metal")
        return "metal", 0.85, "can"
    
    # === ПРИОРИТЕТ 4: КРАСНЫЙ ОБЪЕКТ ===
    if red_count > total * 0.2:
        print("✅ RED OBJECT -> Metal")
        return "metal", 0.80, "red object"
    
    # === ПРИОРИТЕТ 5: СИНИЙ ОБЪЕКТ ===
    if blue_count > total * 0.2:
        print("✅ BLUE OBJECT -> Metal/Plastic")
        return "metal", 0.75, "blue object"
    
    # === ПРИОРИТЕТ 6: БЕЛЫЙ ОБЪЕКТ (много белого, мало цвета) ===
    if white_count > total * 0.6:
        print("✅ WHITE -> Paper")
        return "paper", 0.80, "white object"
    
    print("❓ Unknown")
    return None, 0, "unknown"

def analyze_text(img):
    try:
        proc = img.convert('L')
        proc = ImageOps.autocontrast(proc, cutoff=20)
        proc = proc.point(lambda x: 0 if x < 140 else 255, '1')
        w,h = proc.size
        if w < 800:
            scale = 800/w
            proc = proc.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
        text = pytesseract.image_to_string(proc, config='--psm 6').lower().strip()
        words = re.findall(r'\b[a-z]{4,}\b', text)
        garbage = ['the','and','for','you','page','word','file','doc','zero','sugar','taste','since','made','with','free','gluten','light','original','natural','product','country','sweden','imported','bottled','alcohol','volume']
        clean = [w for w in words if w not in garbage and len(w)>=4]
        print(f"📝 OCR words: {clean}")
        for word in clean:
            for cat, data in CATEGORIES.items():
                if word in data["kw"]:
                    print(f"✅ Found '{word}' in {cat}")
                    return cat, 0.85, f"text: {word}"
        return None, 0, "no match"
    except Exception as e:
        print(f"OCR error: {e}")
        return None, 0, "error"

def make_decision(cv_cat, cv_conf, cv_reason, ocr_cat, ocr_conf, ocr_reason):
    print(f"\n🤔 Decision: CV={cv_cat}({cv_conf:.2f}), OCR={ocr_cat}({ocr_conf:.2f})")
    
    if cv_conf >= 0.90:
        data = CATEGORIES[cv_cat]
        return {"cat": cv_cat, "bin": data["bin"], "instr": data["instr"], "co2": data["co2"], "method": f"CV: {cv_reason}"}
    
    if ocr_conf >= 0.85 and ocr_cat:
        data = CATEGORIES[ocr_cat]
        return {"cat": ocr_cat, "bin": data["bin"], "instr": data["instr"], "co2": data["co2"], "method": f"OCR: {ocr_reason}"}
    
    if cv_conf >= 0.75:
        data = CATEGORIES[cv_cat]
        return {"cat": cv_cat, "bin": data["bin"], "instr": data["instr"], "co2": data["co2"], "method": f"CV: {cv_reason}"}
    
    return None

@app.get("/")
def root(): return {"status": "OK", "suggestions": SUGGESTIONS}

@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    try:
        img = Image.open(io.BytesIO(await image.read())).convert("RGB")
        cv_cat, cv_conf, cv_reason = analyze_image(img)
        ocr_cat, ocr_conf, ocr_reason = analyze_text(img)
        result = make_decision(cv_cat, cv_conf, cv_reason, ocr_cat, ocr_conf, ocr_reason)
        if result:
            print(f"✅ FINAL: {result['cat']} | {result['bin']} via {result['method']}")
            return {"success": True, "text": result['method'], "bin": result["bin"], "instruction": result["instr"], "co2": result["co2"]}
        return {"success": False, "text": "Not recognized", "message": "💡 Use search: 'vodka', 'pepsi', 'battery'"}
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
    print("\n🗑️ Smart Waste Sorter v10.0 (Histogram Method)")
    print("✅ Counting color pixels instead of averaging")
    uvicorn.run(app, host="0.0.0.0", port=8000)

# ♻️ Smart Waste Sorter

**AI-powered waste sorting assistant with CO₂ tracking**

## Demo
![Demo](screenshots/main.png)

## Context
- **End users**: Environmentally conscious individuals who sort waste
- **Problem**: Confusion about waste categories and recycling rules
- **Solution**: Take a photo → get instant waste category + disposal instructions

## Features
### Implemented ✅
- Photo-based waste recognition (CV + OCR)
- 7 waste categories (plastic, metal, glass, paper, organic, electronics, dangerous)
- CO₂ footprint tracking
- Mobile-responsive UI
- Search by text
- Sorting rules guide

### Not yet implemented 🚧
- User accounts & history
- Multi-language support
- Location-based recycling points

## Usage
1. Open http://your-vm-ip:3000
2. Upload photo or search manually
3. Get waste category and disposal instructions

## Deployment
**OS**: Ubuntu 24.04

**Prerequisites**:
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nodejs npm tesseract-ocr git

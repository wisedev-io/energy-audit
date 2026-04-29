import re

with open('/Users/kamoliddinrasulov/auditmobile/src/components/audit-steps/photos.tsx', 'r') as f:
    src = f.read()

old_sec_id = """export const SECTION_SEC_ID: Record<string, number> = {
  exterior: 1,
  windows: 2,
  heating: 3,
  appliances: 4,
  bills: 5,
  thermal: 10,
};"""

new_sec_id = """export const SECTION_SEC_ID: Record<string, number> = {
  exterior: 1,
  windows: 2,
  floorplan: 3,
  heating: 4,
  cooling: 5,
  appliances: 6,
  bills: 7,
  temphum: 8,
  lux: 9,
  thermal: 10,
};"""

old_sections = """const photoSections = [
  { id: 'exterior', name: 'House Exterior', required: 2 },
  { id: 'windows', name: 'Windows & Doors', required: 3 },
  { id: 'heating', name: 'Heating System', required: 2 },
  { id: 'appliances', name: 'Major Appliances', required: 3 },
  { id: 'bills', name: 'Utility Bills', required: 2 },
  { id: 'thermal', name: 'Thermal Camera (Optional)', required: 0 },
];"""

new_sections = """const photoSections = [
  { id: 'exterior',   name: "Tashqi ko'rinish",     required: 3 },
  { id: 'windows',    name: 'Eshik & Derazalar',    required: 3 },
  { id: 'floorplan',  name: 'Bino rejasi',           required: 2 },
  { id: 'heating',    name: 'Isitish tizimi',        required: 1 },
  { id: 'cooling',    name: 'Sovutish tizimi',       required: 1 },
  { id: 'appliances', name: 'Elektr jihozlar',       required: 6 },
  { id: 'bills',      name: "To'lov hujjatlari",    required: 12 },
  { id: 'temphum',    name: 'Harorat & Namlik',      required: 2 },
  { id: 'lux',        name: "Yorug'lik o'lchovi",   required: 2 },
  { id: 'thermal',    name: 'Teplovizor (ixtiyoriy)', required: 0 },
];"""

result = src
if old_sec_id in result:
    result = result.replace(old_sec_id, new_sec_id)
    print("OK: SECTION_SEC_ID replaced")
else:
    print("ERROR: SECTION_SEC_ID not found")

if old_sections in result:
    result = result.replace(old_sections, new_sections)
    print("OK: photoSections replaced")
else:
    print("ERROR: photoSections not found")

with open('/Users/kamoliddinrasulov/auditmobile/src/components/audit-steps/photos.tsx', 'w') as f:
    f.write(result)

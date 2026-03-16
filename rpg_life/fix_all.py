import os
import re

def fix_python_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Удаляем пробелы перед закрывающими кавычками в ключах
    content = re.sub(r'"(\w+)_?\s*"\s*:', r'"\1":', content)
    content = re.sub(r':\s*"([^"]*?)\s*"', r': "\1"', content)
    content = re.sub(r'\[\s*"([^"]*?)\s*"', r'["\1"', content)
    content = re.sub(r'"([^"]*?)\s*"\]', r'"\1"]', content)
    content = re.sub(r'\.get\(\s*"([^"]*?)\s*"', r'.get("\1"', content)
    content = re.sub(r'==\s*"([^"]*?)\s*"', r'== "\1"', content)
    content = re.sub(r'in\s*\[\s*"([^"]*?)\s*"', r'in ["\1"', content)
    content = re.sub(r'\.startswith\(\s*"([^"]*?)\s*"', r'.startswith("\1"', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Исправлен: {filepath}")

# Исправляем все Python файлы в app/
for root, dirs, files in os.walk('app'):
    for file in files:
        if file.endswith('.py'):
            fix_python_file(os.path.join(root, file))

print("\n🎉 Все файлы исправлены!")
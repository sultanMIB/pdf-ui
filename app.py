from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import PyPDF2
import pdfplumber
import re
import os
from datetime import datetime
import hashlib
import traceback

app = Flask(__name__)
CORS(app)

# مجلد التحميل
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB حد أقصى

class PDFProcessor:
    def __init__(self, file_path):
        self.file_path = file_path
        self.text_content = ""
        self.metadata = {}
        self.tables = []
        self.entities = []
        
    def extract_basic_info(self):
        """استخراج المعلومات الأساسية من PDF"""
        try:
            with open(self.file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                self.metadata = {
                    'pages': len(pdf_reader.pages),
                    'title': pdf_reader.metadata.get('/Title', 'غير محدد'),
                    'author': pdf_reader.metadata.get('/Author', 'غير محدد'),
                    'creation_date': pdf_reader.metadata.get('/CreationDate', 'غير محدد'),
                    'file_size': f"{os.path.getsize(self.file_path) / 1024:.2f} KB"
                }
                print(f"📊 Basic info: {self.metadata['pages']} pages")
        except Exception as e:
            print(f"❌ Error in basic info: {e}")
            self.metadata = {'pages': 0, 'title': 'غير محدد', 'author': 'غير محدد', 
                           'creation_date': 'غير محدد', 'file_size': 'غير معروف'}
    
    def extract_text_and_tables(self):
        """استخراج النص والجداول باستخدام pdfplumber"""
        try:
            with pdfplumber.open(self.file_path) as pdf:
                self.text_content = ""
                self.tables = []
                
                for page_num, page in enumerate(pdf.pages):
                    # استخراج النص
                    text = page.extract_text() or ""
                    self.text_content += f"\n--- الصفحة {page_num + 1} ---\n{text}\n"
                    
                    # استخراج الجداول
                    page_tables = page.extract_tables() or []
                    for table_num, table in enumerate(page_tables):
                        if table:
                            table_data = {
                                'page': page_num + 1,
                                'table_number': table_num + 1,
                                'headers': [str(cell) if cell is not None else '' for cell in table[0]] if table else [],
                                'rows': [[str(cell) if cell is not None else '' for cell in row] for row in table[1:]] if len(table) > 1 else []
                            }
                            self.tables.append(table_data)
                            
        except Exception as e:
            print(f"❌ Error extracting text: {e}")
            self.text_content = "فشل في استخراج النص من الملف"
    
    def extract_entities(self):
        """استخراج الكيانات المختلفة من النص"""
        if not self.text_content:
            return
            
        # أنماط للتعرف على الكيانات
        patterns = {
            'أسماء': r'\b[أ-ي]{3,}\s[أ-ي]{3,}\b',
            'تواريخ': r'\b\d{1,2}/\d{1,2}/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b',
            'أرقام هواتف': r'\b\d{10,15}\b',
            'بريد إلكتروني': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'عنوان ويب': r'https?://[^\s]+',
            'أرقام': r'\b\d+\b'
        }
        
        for entity_type, pattern in patterns.items():
            try:
                matches = re.finditer(pattern, self.text_content)
                for match in matches:
                    self.entities.append({
                        'type': entity_type,
                        'text': match.group(),
                        'confidence': min(95, 70 + len(match.group()) * 2)
                    })
            except Exception as e:
                continue
    
    def analyze_semantic_content(self):
        """تحليل المحتوى الدلالي"""
        if not self.text_content:
            return {
                'documentType': 'غير معروف',
                'topics': [],
                'language': 'غير معروف',
                'summary': 'لا يوجد محتوى لتحليله'
            }
        
        try:
            # تحديد نوع المستند
            document_type = "عام"
            text_lower = self.text_content.lower()
            
            if any(word in text_lower for word in ['عقد', 'اتفاقية', 'مادة', 'بند']):
                document_type = "عقد"
            elif any(word in text_lower for word in ['فاتورة', 'سعر', 'كمية', 'مجموع']):
                document_type = "فاتورة"
            elif any(word in text_lower for word in ['تقرير', 'تحليل', 'نتيجة']):
                document_type = "تقرير"
            
            # استخراج المواضيع
            topics = self.extract_topics()
            
            # تحديد اللغة
            language = "عربية" if re.search(r'[أ-ي]', self.text_content) else "إنجليزية"
            
            # إنشاء ملخص
            sentences = [s.strip() for s in self.text_content.split('.') if s.strip()]
            summary = '. '.join(sentences[:3]) + '.' if len(sentences) > 3 else self.text_content[:200] + '...'
            
            return {
                'documentType': document_type,
                'topics': topics[:5],
                'language': language,
                'summary': summary
            }
        except Exception as e:
            return {
                'documentType': 'غير معروف',
                'topics': [],
                'language': 'غير معروف',
                'summary': 'حدث خطأ في التحليل'
            }
    
    def extract_topics(self):
        """استخراج المواضيع الرئيسية من النص"""
        try:
            common_arabic_words = {
                'عمل', 'شركة', 'مشروع', 'دراسة', 'تحليل', 'تقرير', 'عقد', 'اتفاق',
                'دفع', 'سعر', 'تكلفة', 'موعد', 'تاريخ', 'مبلغ', 'عملية', 'نظام'
            }
            
            words = re.findall(r'\b[أ-ي]{3,}\b', self.text_content)
            word_freq = {}
            
            for word in words:
                if word in common_arabic_words:
                    word_freq[word] = word_freq.get(word, 0) + 1
            
            sorted_topics = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
            return [topic[0] for topic in sorted_topics[:10]]
        except:
            return []
    
    def process(self):
        """معالجة الملف بالكامل"""
        try:
            print("🔄 Starting PDF processing...")
            
            self.extract_basic_info()
            self.extract_text_and_tables()
            self.extract_entities()
            semantic_analysis = self.analyze_semantic_content()
            
            result = {
                'success': True,
                'basicInfo': self.metadata,
                'rawText': self.text_content[:5000] if self.text_content else 'لم يتم استخراج أي نص',
                'tables': self.tables[:5],
                'entities': self.entities[:20],
                'semanticAnalysis': semantic_analysis,
                'processingTime': datetime.now().isoformat()
            }
            
            print("✅ Processing completed successfully!")
            return result
            
        except Exception as e:
            print(f"❌ Error in processing: {e}")
            return {
                'success': False,
                'error': f'فشل في معالجة الملف: {str(e)}'
            }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze_pdf():
    try:
        print("📨 Received analyze request...")
        
        if 'pdf' not in request.files:
            print("❌ No file in request")
            return jsonify({'success': False, 'error': 'لم يتم تقديم ملف'}), 400
        
        file = request.files['pdf']
        print(f"📄 File: {file.filename}")
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'لم يتم اختيار ملف'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'success': False, 'error': 'الملف يجب أن يكون بصيغة PDF'}), 400
        
        # حفظ الملف
        file_data = file.read()
        if len(file_data) == 0:
            return jsonify({'success': False, 'error': 'الملف فارغ'}), 400
            
        file_hash = hashlib.md5(file_data).hexdigest()
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_hash}.pdf")
        
        # إعادة تعيين الملف وحفظه
        file.seek(0)
        file.save(file_path)
        print(f"💾 File saved: {file_path}")
        
        # معالجة الملف
        processor = PDFProcessor(file_path)
        result = processor.process()
        
        # تنظيف
        try:
            os.remove(file_path)
        except:
            pass
        
        print("📤 Sending response...")
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Critical error: {e}")
        return jsonify({'success': False, 'error': f'فشل في معالجة الملف: {str(e)}'}), 500

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'message': 'خادم PDF جاهز للعمل'})

@app.route('/test')
def test_route():
    return jsonify({'message': 'Test successful', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    print("🚀 Starting PDF Analysis Server...")
    app.run(debug=True, host='0.0.0.0', port=5000)
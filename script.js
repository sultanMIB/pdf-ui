class PDFAnalyzer {
    constructor() {
        this.initializeEventListeners();
        this.currentFile = null;
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const removeBtn = document.getElementById('removeBtn');

        // سحب وإفلات
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        // اختيار ملف
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // تحليل الملف
        analyzeBtn.addEventListener('click', this.analyzeFile.bind(this));

        // إزالة الملف
        removeBtn.addEventListener('click', this.removeFile.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        // التحقق من نوع الملف
        if (file.type !== 'application/pdf') {
            alert('⚠️ يرجى اختيار ملف PDF فقط');
            return;
        }

        // التحقق من حجم الملف (10MB كحد أقصى)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert('⚠️ حجم الملف كبير جداً. الحد الأقصى 10MB');
            return;
        }

        this.currentFile = file;
        this.displayFileInfo(file);
        document.getElementById('analyzeBtn').disabled = false;
    }

    displayFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.style.display = 'block';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeFile() {
        this.currentFile = null;
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('fileInput').value = '';
        document.getElementById('analyzeBtn').disabled = true;
        document.getElementById('resultsContainer').style.display = 'none';
    }

    async analyzeFile() {
        if (!this.currentFile) return;
    
        const analyzeBtn = document.getElementById('analyzeBtn');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
    
        // إعداد واجهة التحميل
        analyzeBtn.disabled = true;
        analyzeBtn.querySelector('.btn-text').textContent = 'جاري التحليل...';
        analyzeBtn.querySelector('.loading-spinner').style.display = 'inline-block';
        progressContainer.style.display = 'block';
    
        try {
            // محاكاة تقدم التحليل
            await this.simulateProgress(progressFill, progressText);
    
            console.log('📤 Uploading file:', this.currentFile.name);
            
            // إرسال الملف للخادم
            const formData = new FormData();
            formData.append('pdf', this.currentFile);
    
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });
    
            console.log('📥 Response status:', response.status);
            
            // نسخ ال response قبل قراءته
            const responseClone = response.clone();
            
            // محاولة قراءة الرد كـ JSON أولاً
            let result;
            try {
                result = await response.json();
                console.log('✅ JSON response received:', result);
            } catch (jsonError) {
                console.log('❌ JSON parse failed, trying text...');
                
                // إذا فشل JSON، جرب قراءة كـ text من الـ clone
                try {
                    const textResponse = await responseClone.text();
                    console.log('📄 Text response:', textResponse.substring(0, 200));
                    
                    if (!textResponse.trim()) {
                        throw new Error('الخادم أعاد رداً فارغاً');
                    }
                    
                    // محاولة تحويل النص إلى JSON يدوياً
                    try {
                        result = JSON.parse(textResponse);
                    } catch (e) {
                        throw new Error(`رد غير متوقع من الخادم: ${textResponse.substring(0, 100)}`);
                    }
                } catch (textError) {
                    console.error('❌ Text read also failed:', textError);
                    throw new Error('تعذر قراءة رد الخادم: ' + textError.message);
                }
            }
    
            // تحقق إذا كان هناك خطأ في النتيجة
            if (result && result.error) {
                throw new Error(result.error);
            }
            
            if (result && result.success === false) {
                throw new Error(result.error || 'فشل في معالجة الملف');
            }
            
            if (!result) {
                throw new Error('لا توجد نتيجة من الخادم');
            }
            
            console.log('✅ Analysis successful, displaying results');
            this.displayResults(result);
    
        } catch (error) {
            console.error('❌ Error in analyzeFile:', error);
            alert('❌ حدث خطأ أثناء تحليل الملف: ' + error.message);
        } finally {
            // إعادة تعيين واجهة المستخدم
            analyzeBtn.disabled = false;
            analyzeBtn.querySelector('.btn-text').textContent = 'بدء التحليل';
            analyzeBtn.querySelector('.loading-spinner').style.display = 'none';
            progressContainer.style.display = 'none';
        }
    }
    async simulateProgress(progressFill, progressText) {
        const steps = [
            { percent: 25, text: 'جاري قراءة الملف...' },
            { percent: 50, text: 'جاري استخراج النص...' },
            { percent: 75, text: 'جاري تحليل المحتوى...' },
            { percent: 100, text: 'جاري تنظيم البيانات...' }
        ];

        for (const step of steps) {
            progressFill.style.width = step.percent + '%';
            progressText.textContent = step.text;
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    displayResults(result) {
        const resultsContainer = document.getElementById('resultsContainer');
        
        // عرض المعلومات الأساسية
        this.displayBasicInfo(result.basicInfo);
        
        // عرض الكيانات المستخرجة
        this.displayEntities(result.entities);
        
        // عرض الجداول
        this.displayTables(result.tables);
        
        // عرض التحليل الدلالي
        this.displaySemanticAnalysis(result.semanticAnalysis);
        
        // عرض النص الخام
        this.displayRawText(result.rawText);
        
        resultsContainer.style.display = 'block';
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    displayBasicInfo(basicInfo) {
        const basicInfoDiv = document.getElementById('basicInfo');
        basicInfoDiv.innerHTML = `
            <p><strong>عدد الصفحات:</strong> ${basicInfo.pages}</p>
            <p><strong>حجم الملف:</strong> ${basicInfo.fileSize}</p>
            <p><strong>العنوان:</strong> ${basicInfo.title || 'غير محدد'}</p>
            <p><strong>الكاتب:</strong> ${basicInfo.author || 'غير محدد'}</p>
            <p><strong>تاريخ الإنشاء:</strong> ${basicInfo.creationDate || 'غير محدد'}</p>
        `;
    }

    displayEntities(entities) {
        const entitiesDiv = document.getElementById('entities');
        if (entities.length === 0) {
            entitiesDiv.innerHTML = '<p>لم يتم العثور على كيانات محددة</p>';
            return;
        }

        entitiesDiv.innerHTML = entities.map(entity => `
            <div class="entity-item">
                <strong>${entity.type}:</strong> ${entity.text}
                <span style="color: #666; font-size: 0.9em;">(الثقة: ${entity.confidence}%)</span>
            </div>
        `).join('');
    }

    displayTables(tables) {
        const tablesDiv = document.getElementById('tables');
        if (tables.length === 0) {
            tablesDiv.innerHTML = '<p>لم يتم العثور على جداول</p>';
            return;
        }

        tablesDiv.innerHTML = tables.map((table, index) => `
            <div class="table-item">
                <h4>الجدول ${index + 1}</h4>
                <div style="overflow-x: auto;">
                    ${this.generateTableHTML(table)}
                </div>
            </div>
        `).join('');
    }

    generateTableHTML(table) {
        if (!table.rows || table.rows.length === 0) {
            return '<p>لا توجد بيانات في الجدول</p>';
        }

        let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
        
        // العنوان (إن وجد)
        if (table.headers && table.headers.length > 0) {
            html += '<thead><tr>';
            table.headers.forEach(header => {
                html += `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5;">${header}</th>`;
            });
            html += '</tr></thead>';
        }

        // الصفوف
        html += '<tbody>';
        table.rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        return html;
    }

    displaySemanticAnalysis(analysis) {
        const semanticDiv = document.getElementById('semanticAnalysis');
        semanticDiv.innerHTML = `
            <p><strong>نوع المستند:</strong> ${analysis.documentType}</p>
            <p><strong>الموضوعات الرئيسية:</strong> ${analysis.topics.join('، ')}</p>
            <p><strong>اللغة:</strong> ${analysis.language}</p>
            <p><strong>ملخص المحتوى:</strong> ${analysis.summary}</p>
        `;
    }

    displayRawText(rawText) {
        const rawTextDiv = document.getElementById('rawText');
        rawTextDiv.textContent = rawText || 'لم يتم استخراج نص من الملف';
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    new PDFAnalyzer();
});
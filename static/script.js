// المتغيرات العامة
let currentFile = null;

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

// إعداد مستمعي الأحداث
function initializeEventListeners() {
    const uploadBox = document.getElementById('uploadBox');
    const fileInput = document.getElementById('pdfFile');
    
    // النقر على منطقة الرفع
    uploadBox.addEventListener('click', () => {
        fileInput.click();
    });
    
    // سحب وإفلات الملفات
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = '#764ba2';
        uploadBox.style.background = '#f8f9fa';
    });
    
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.style.borderColor = '#667eea';
        uploadBox.style.background = 'white';
    });
    
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = '#667eea';
        uploadBox.style.background = 'white';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });
    
    // تغيير اختيار الملف
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });
    
    // رابط الاختيار
    document.querySelector('.browse-link').addEventListener('click', () => {
        fileInput.click();
    });
}

// معالجة اختيار الملف
function handleFileSelection(file) {
    if (file.type !== 'application/pdf') {
        showError('الرجاء اختيار ملف PDF فقط');
        return;
    }
    
    if (file.size > 16 * 1024 * 1024) {
        showError('حجم الملف يجب أن يكون أقل من 16MB');
        return;
    }
    
    currentFile = file;
    displayFileInfo(file);
    document.getElementById('analyzeBtn').disabled = false;
}

// عرض معلومات الملف
function displayFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'block';
}

// تنسيق حجم الملف
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// إزالة الملف
function removeFile() {
    currentFile = null;
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('pdfFile').value = '';
}

// تحليل PDF
async function analyzePDF() {
    if (!currentFile) return;
    
    const formData = new FormData();
    formData.append('pdf', currentFile);
    
    // إظهار حالة التحميل
    showLoading();
    hideResults();
    hideError();
    
    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayResults(data);
        } else {
            showError(data.error || 'حدث خطأ أثناء التحليل');
        }
    } catch (error) {
        showError('فشل في الاتصال بالخادم: ' + error.message);
    } finally {
        hideLoading();
    }
}

// عرض النتائج
function displayResults(data) {
    displayBasicInfo(data.basicInfo);
    displaySemanticAnalysis(data.semanticAnalysis);
    displayEntities(data.entities);
    displayTables(data.tables);
    displayRawText(data.rawText);
    
    showResults();
}

// عرض المعلومات الأساسية
function displayBasicInfo(basicInfo) {
    const container = document.getElementById('basicInfo');
    container.innerHTML = '';
    
    const infoItems = [
        { label: 'عدد الصفحات', value: basicInfo.pages },
        { label: 'العنوان', value: basicInfo.title },
        { label: 'المؤلف', value: basicInfo.author },
        { label: 'تاريخ الإنشاء', value: basicInfo.creation_date },
        { label: 'حجم الملف', value: basicInfo.file_size }
    ];
    
    infoItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'info-item';
        div.innerHTML = `
            <span class="info-label">${item.label}</span>
            <span class="info-value">${item.value}</span>
        `;
        container.appendChild(div);
    });
}

// عرض التحليل الدلالي
function displaySemanticAnalysis(analysis) {
    const container = document.getElementById('semanticAnalysis');
    
    container.innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">نوع المستند</span>
                <span class="info-value">${analysis.documentType}</span>
            </div>
            <div class="info-item">
                <span class="info-label">اللغة</span>
                <span class="info-value">${analysis.language}</span>
            </div>
        </div>
        
        ${analysis.topics && analysis.topics.length > 0 ? `
            <div style="margin-top: 20px;">
                <strong>المواضيع الرئيسية:</strong>
                <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
                    ${analysis.topics.map(topic => 
                        `<span style="background: #e3f2fd; padding: 5px 12px; border-radius: 15px; font-size: 0.9rem;">${topic}</span>`
                    ).join('')}
                </div>
            </div>
        ` : ''}
        
        <div style="margin-top: 20px;">
            <strong>الملخص:</strong>
            <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 8px; line-height: 1.6;">
                ${analysis.summary}
            </div>
        </div>
    `;
}

// عرض الكيانات
function displayEntities(entities) {
    const container = document.getElementById('entitiesList');
    container.innerHTML = '';
    
    if (!entities || entities.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">لم يتم العثور على كيانات</p>';
        return;
    }
    
    entities.forEach(entity => {
        const div = document.createElement('div');
        div.className = 'entity-item';
        div.innerHTML = `
            <span class="entity-type">${entity.type}</span>
            <span class="entity-text">${entity.text}</span>
            ${entity.confidence ? `<small style="color: #666;">ثقة: ${entity.confidence}%</small>` : ''}
        `;
        container.appendChild(div);
    });
}

// عرض الجداول
function displayTables(tables) {
    const container = document.getElementById('tablesList');
    container.innerHTML = '';
    
    if (!tables || tables.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">لم يتم العثور على جداول</p>';
        return;
    }
    
    tables.forEach((table, index) => {
        const tableDiv = document.createElement('div');
        tableDiv.className = 'table-preview';
        
        let tableHTML = `
            <div class="table-title">
                الجدول ${table.table_number} - الصفحة ${table.page}
            </div>
            <div class="table-content">
        `;
        
        if (table.headers && table.headers.length > 0) {
            tableHTML += '<table style="width: 100%; border-collapse: collapse;">';
            tableHTML += '<thead><tr>';
            table.headers.forEach(header => {
                tableHTML += `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5;">${header}</th>`;
            });
            tableHTML += '</tr></thead>';
        }
        
        if (table.rows && table.rows.length > 0) {
            tableHTML += '<tbody>';
            table.rows.forEach(row => {
                tableHTML += '<tr>';
                row.forEach(cell => {
                    tableHTML += `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody>';
        }
        
        tableHTML += '</table></div>';
        tableDiv.innerHTML = tableHTML;
        container.appendChild(tableDiv);
    });
}

// عرض النص الخام
function displayRawText(text) {
    const container = document.getElementById('rawText');
    container.textContent = text || 'لم يتم استخراج أي نص';
}

// إظهار/إخفاء الأقسام
function showLoading() {
    document.getElementById('loadingSection').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingSection').style.display = 'none';
}

function showResults() {
    document.getElementById('resultsSection').style.display = 'block';
}

function hideResults() {
    document.getElementById('resultsSection').style.display = 'none';
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorSection').style.display = 'block';
}

function hideError() {
    document.getElementById('errorSection').style.display = 'none';
}

// اختبار الاتصال عند التحميل
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/health');
        if (!response.ok) {
            throw new Error('الخادم غير متاح');
        }
    } catch (error) {
        showError('تعذر الاتصال بالخادم. تأكد من تشغيل التطبيق.');
    }
});
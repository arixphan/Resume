import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Printer, Code, Mail, Phone, MapPin, Calendar, Download, X } from 'lucide-react';
import './App.css';

// We try to import the CV markdown file.
// In a real Vite app, ?raw imports the content as a string.
import initialCvText from '../CV.md?raw';

function App() {
  const [markdown, setMarkdown] = useState(initialCvText || '');
  const [isEditorVisible, setIsEditorVisible] = useState(true);

  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);

  // Auto-save effect
  useEffect(() => {
    // Don't save if it's the initial load or if auto-save is disabled
    if (!isAutoSaveEnabled || (markdown === initialCvText && saveStatus === 'idle')) {
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:3001/save-cv', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ markdown }),
        });

        if (response.ok) {
          setSaveStatus('saved');
          // Reset status to idle after a while
          setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
        } else {
          setSaveStatus('error');
        }
      } catch (error) {
        console.error('Failed to save:', error);
        setSaveStatus('error');
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [markdown, isAutoSaveEnabled]);

  // Function to handle printing via the backend PDF server
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const cvElement = document.querySelector('.cv-document');
      if (!cvElement) return;

      const html = cvElement.outerHTML;
      const css = Array.from(document.querySelectorAll('style'))
        .map(style => style.innerHTML)
        .join('\n');

      const response = await fetch('http://localhost:3001/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html, css }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error(error);
      alert('Error generating PDF. Make sure the backend server is running on port 3001.');
    } finally {
      setIsPrinting(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = 'PhanDongHo_CV.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const closePreview = () => {
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  // Add class to body to disable background animation when modal is open
  useEffect(() => {
    if (pdfUrl) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [pdfUrl]);

  return (
    <div className="app-container">
      {/* Editor Pane */}
      {isEditorVisible && (
        <div className="editor-pane">
          <div className="editor-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Markdown Editor</span>
              <Code size={18} />
            </div>
            <div className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Changes saved'}
              {saveStatus === 'error' && 'Error saving!'}
            </div>
            <div className="autosave-toggle">
              <span className="toggle-label">Auto-save</span>
              <button
                className={`toggle-switch ${isAutoSaveEnabled ? 'on' : 'off'}`}
                onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                title={isAutoSaveEnabled ? 'Disable auto-save' : 'Enable auto-save'}
              >
                <div className="toggle-slider" />
              </button>
            </div>
          </div>
          <textarea
            className="editor-textarea"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            spellCheck="false"
          />
        </div>
      )}

      {/* Preview Pane */}
      <div className="preview-pane">
        <button className="print-button" onClick={handlePrint} disabled={isPrinting}>
          <Printer size={18} /> {isPrinting ? 'Generating PDF...' : 'Print CV'}
        </button>
        <div className="cv-document">
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => <h1 className="cv-name" {...props} />,
              h2: ({ node, ...props }) => <h2 className="cv-section-title" {...props} />,
              h4: ({ node, ...props }) => <h4 className="cv-project-title" {...props} />,
              h3: ({ node, children, ...props }) => {
                // If it looks like a job title with date
                const text = String(children);
                if (text.includes(' - ')) {
                  const parts = text.split(/(?=[A-Za-z]{3}\s\d{4}|\d{4})/);
                  if (parts.length > 1) {
                    return (
                      <h3 className="cv-job-title" {...props}>
                        <div className="cv-job-header-row">
                          <span className="cv-company-name">{parts[0].trim()}</span>
                          <span className="cv-job-date">{parts.slice(1).join('').trim()}</span>
                        </div>
                      </h3>
                    );
                  }
                }
                return <h3 className="cv-job-title" {...props}>{children}</h3>;
              },
              p: ({ node, ...props }) => <p className="cv-paragraph" {...props} />,
              ul: ({ node, ...props }) => <ul className="cv-list" {...props} />,
              li: ({ node, ...props }) => <li {...props} />,
              strong: ({ node, ...props }) => <strong className="cv-strong" {...props} />,
              em: ({ node, ...props }) => <em className="cv-role" {...props} />,
              hr: ({ node, ...props }) => <hr className="cv-page-break" {...props} />,
              code: ({ node, inline, className, children, ...props }: any) => {
                const text = String(children).trim();

                // Render as contact info block if it looks like the contact block in the CV
                if (!inline && (text.includes('Phone:') || text.includes('Email:'))) {
                  const rawItems = text.split(/[\n•]/);
                  const items = rawItems
                    .map(item => item.trim())
                    .filter(item => item.includes(':'));

                  const getIcon = (key: string) => {
                    const k = key.toLowerCase();
                    if (k.includes('email')) return <Mail size={14} />;
                    if (k.includes('phone')) return <Phone size={14} />;
                    if (k.includes('address')) return <MapPin size={14} />;
                    if (k.includes('birth')) return <Calendar size={14} />;
                    return null;
                  };

                  return (
                    <div className="cv-contact">
                      {items.map((item, i) => {
                        const colonIndex = item.indexOf(':');
                        const key = item.substring(0, colonIndex).trim();
                        const val = item.substring(colonIndex + 1).trim();
                        return (
                          <div className="cv-contact-item" key={i}>
                            <span className="cv-contact-icon">{getIcon(key)}</span>
                            <span className="cv-contact-label">{key}:</span>
                            <span className="cv-contact-value">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return <code className={inline ? 'cv-inline-code' : className} {...props}>{children}</code>;
              }
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {pdfUrl && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Printer size={20} />
                <span>PDF Preview</span>
              </div>
              <div className="modal-actions">
                <button className="download-btn" onClick={downloadPdf}>
                  <Download size={18} /> Download
                </button>
                <button className="close-btn" onClick={closePreview}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <iframe src={pdfUrl} title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

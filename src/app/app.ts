import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { QuillEditorComponent } from 'ngx-quill';
import { createWorker } from 'tesseract.js';

@Component({
  selector: 'app-root',
  imports: [CommonModule, QuillEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('canvasElement', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild(QuillEditorComponent, { static: false }) editorComponent!: QuillEditorComponent;

  // Signals
  canvasVisible = signal(false);
  isDrawing = signal(false);
  isProcessing = signal(false);
  showSuccessMessage = signal(false);

  // Canvas properties
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private currentX = 0;
  private currentY = 0;
  private resizeHandler = () => this.resizeCanvas();

  // Quill editor content
  editorContent = signal('');
  
  // Quill editor modules configuration
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image']
    ]
  };

  ngOnInit() {
    // Component initialization
  }

  ngAfterViewInit() {
    // Initialize canvas after view is ready
    if (this.canvasVisible()) {
      setTimeout(() => {
        this.initializeCanvas();
      }, 100);
    }
  }

  ngOnDestroy() {
    // Cleanup
    window.removeEventListener('resize', this.resizeHandler);
  }

  initializeCanvas() {
    if (this.canvasRef?.nativeElement) {
      this.canvas = this.canvasRef.nativeElement;
      this.ctx = this.canvas.getContext('2d')!;
      
      // Set canvas size
      this.resizeCanvas();
      
      // Set drawing styles
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      // Listen for window resize
      window.addEventListener('resize', this.resizeHandler);
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    
    const container = this.canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      this.canvas.width = rect.width - 40; // Account for padding
      this.canvas.height = 600;
      
      // Redraw if there was content
      this.redrawCanvas();
    }
  }

  redrawCanvas() {
    // This can be used to restore canvas content if needed
    // For now, we'll just clear it on resize
  }

  toggleCanvas() {
    this.canvasVisible.set(!this.canvasVisible());
    if (this.canvasVisible()) {
      setTimeout(() => {
        this.initializeCanvas();
      }, 100);
    }
  }

  getCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if (event instanceof TouchEvent) {
      const touch = event.touches[0] || event.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
  }

  startDrawing(event: MouseEvent | TouchEvent) {
    if (!this.canvas) return;
    event.preventDefault();
    this.isDrawing.set(true);
    const coords = this.getCoordinates(event);
    this.currentX = coords.x;
    this.currentY = coords.y;
  }

  draw(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing() || !this.canvas) return;
    event.preventDefault();
    const coords = this.getCoordinates(event);
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.currentX, this.currentY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();
    
    this.currentX = coords.x;
    this.currentY = coords.y;
  }

  stopDrawing(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing()) return;
    event.preventDefault();
    this.isDrawing.set(false);
  }

  clearCanvas() {
    if (!this.canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  async convertToText() {
    if (!this.canvas) return;
    
    this.isProcessing.set(true);
    
    try {
      // Get canvas image data
      const imageData = this.canvas.toDataURL('image/png');
      
      // Initialize Tesseract worker
      const worker = await createWorker('eng');
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(imageData);
      
      // Get current editor content and append recognized text
      if (this.editorComponent?.quillEditor) {
        const trimmedText = text.trim();
        if (trimmedText) {
          // Get the length of current content
          const length = this.editorComponent.quillEditor.getLength();
          // Insert new text at the end
          this.editorComponent.quillEditor.insertText(length - 1, (length > 1 ? '\n\n' : '') + trimmedText, 'user');
          // Set cursor to end
          this.editorComponent.quillEditor.setSelection(length + trimmedText.length);
          this.editorContent.set(this.editorComponent.quillEditor.root.innerHTML);
        }
      }
      
      // Show success message
      this.showSuccessMessage.set(true);
      setTimeout(() => {
        this.showSuccessMessage.set(false);
      }, 3000);
      
      // Terminate worker
      await worker.terminate();
    } catch (error) {
      alert('Error converting handwriting to text. Please try again.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  onContentChanged(content: string | null) {
    if (content) {
      this.editorContent.set(content);
    }
  }
}

#!/usr/bin/env python3
"""
Simple HTTP server for bzip2.wasm demo with proper MIME types and CORS headers
Supports development and demo hosting
"""

import http.server
import socketserver
import os
import sys
import webbrowser
from pathlib import Path

class WasmHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add proper MIME types for WASM and JS modules
        if self.path.endswith('.wasm'):
            self.send_header('Content-Type', 'application/wasm')
        elif self.path.endswith('.mjs'):
            self.send_header('Content-Type', 'application/javascript')
        elif self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        
        # CORS headers for development
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Cache headers for WASM files
        if self.path.endswith('.wasm'):
            self.send_header('Cache-Control', 'public, max-age=3600')
        
        super().end_headers()
    
    def log_message(self, format, *args):
        # Colorized logging
        message = format % args
        if '.wasm' in message:
            print(f"\033[95m[WASM]\033[0m {message}")
        elif '.js' in message:
            print(f"\033[94m[JS]\033[0m {message}")
        elif 'demo.html' in message:
            print(f"\033[92m[DEMO]\033[0m {message}")
        else:
            print(f"\033[90m[INFO]\033[0m {message}")

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    
    print("🚀 bzip2.wasm Demo Server")
    print("=" * 40)
    
    # Check if demo files exist
    demo_file = Path('demo.html')
    if not demo_file.exists():
        print("❌ demo.html not found in current directory")
        sys.exit(1)
    
    # Check for build artifacts
    build_dir = Path('build')
    wasm_files = list(build_dir.glob('*.wasm')) if build_dir.exists() else []
    
    print(f"📁 Found {len(wasm_files)} WASM build(s):")
    for wasm_file in wasm_files:
        size_kb = wasm_file.stat().st_size / 1024
        print(f"   {wasm_file.name}: {size_kb:.1f} KB")
    
    if not wasm_files:
        print("⚠️  No WASM builds found. Run 'npm run build' first.")
        print("   The demo will still work for showcasing the interface.")
    
    # Start server
    os.chdir(Path(__file__).parent)
    
    try:
        with socketserver.TCPServer(("", port), WasmHTTPRequestHandler) as httpd:
            server_url = f"http://localhost:{port}/demo.html"
            
            print(f"\n✅ Server running at: {server_url}")
            print(f"📱 Mobile-friendly responsive design")
            print(f"🔧 Proper WASM MIME types and CORS headers")
            print(f"⚡ SIMD support detection and optimization")
            print(f"\n🎯 Demo Features:")
            print(f"   • Interactive compression testing")
            print(f"   • Real-time performance monitoring") 
            print(f"   • File drag & drop")
            print(f"   • Code examples and API docs")
            print(f"   • Memory usage debugging")
            print(f"   • Build variant comparison")
            print(f"\n💡 Try:")
            print(f"   • Paste large text for compression testing")
            print(f"   • Drop files to test real-world performance")
            print(f"   • Check different compression levels")
            print(f"   • Monitor memory usage and SIMD utilization")
            
            print(f"\nPress Ctrl+C to stop the server")
            
            # Auto-open browser
            try:
                webbrowser.open(server_url)
                print(f"🌐 Opening browser automatically...")
            except:
                print(f"🌐 Open {server_url} in your browser")
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n👋 Demo server stopped")
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Port {port} is already in use")
            print(f"💡 Try: python3 serve-demo.py {port + 1}")
        else:
            print(f"❌ Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()